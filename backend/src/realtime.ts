import { Server } from "http";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "./config";
import { pool } from "./db";
import { normalizeBearerToken } from "./utils";

type TokenPayload = {
  userId: number;
};

type SocketWithUser = WebSocket & {
  userId?: number;
};

const userSocketMap = new Map<number, Set<SocketWithUser>>();

function addUserSocket(userId: number, socket: SocketWithUser): void {
  const socketSet = userSocketMap.get(userId) || new Set<SocketWithUser>();
  socketSet.add(socket);
  userSocketMap.set(userId, socketSet);
}

function removeUserSocket(userId: number, socket: SocketWithUser): void {
  const socketSet = userSocketMap.get(userId);
  if (!socketSet) return;
  socketSet.delete(socket);
  if (socketSet.size === 0) {
    userSocketMap.delete(userId);
  }
}

function emitToUsers(userIds: number[], payload: Record<string, unknown>): void {
  const text = JSON.stringify(payload);
  for (const userId of userIds) {
    const socketSet = userSocketMap.get(userId);
    if (!socketSet) continue;
    for (const socket of socketSet) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(text);
      }
    }
  }
}

async function getConversationParticipants(conversationId: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.user_a, m.user_b
     FROM conversations c
     JOIN matches m ON m.id = c.match_id
     WHERE c.id = ? AND m.status = 'active'
     LIMIT 1`,
    [conversationId]
  );
  if (!rows[0]) return [];
  return [Number(rows[0].user_a), Number(rows[0].user_b)];
}

async function isActiveUser(userId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0]?.status === "active";
}

export async function emitConversationMessage(
  conversationId: number,
  message: Record<string, unknown>,
  excludeUserId?: number
): Promise<void> {
  const participants = await getConversationParticipants(conversationId);
  const receiverIds = excludeUserId
    ? participants.filter((userId) => userId !== excludeUserId)
    : participants;
  if (receiverIds.length === 0) return;
  emitToUsers(receiverIds, {
    type: "new_message",
    conversationId,
    message
  });
}

export async function emitReadReceipt(
  conversationId: number,
  readerId: number,
  lastReadMessageId: number
): Promise<void> {
  const participants = await getConversationParticipants(conversationId);
  const receiverIds = participants.filter((userId) => userId !== readerId);
  if (receiverIds.length === 0) return;
  emitToUsers(receiverIds, {
    type: "read_receipt",
    conversationId,
    readerId,
    lastReadMessageId
  });
}

export function registerRealtimeGateway(server: Server): void {
  const wsServer = new WebSocketServer({ server, path: "/ws" });
  wsServer.on("connection", async (socket: SocketWithUser, request) => {
    const requestUrl = new URL(request.url || "", "http://localhost");
    const tokenParam = requestUrl.searchParams.get("token") || "";
    const token = normalizeBearerToken(tokenParam);
    if (!token) {
      socket.close(1008, "Unauthorized");
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
      const active = await isActiveUser(payload.userId);
      if (!active) {
        socket.close(1008, "Account is banned");
        return;
      }

      socket.userId = payload.userId;
      addUserSocket(payload.userId, socket);
      socket.send(
        JSON.stringify({
          type: "connected",
          userId: payload.userId
        })
      );

      socket.on("close", () => {
        if (!socket.userId) return;
        removeUserSocket(socket.userId, socket);
      });

      socket.on("error", () => {
        if (!socket.userId) return;
        removeUserSocket(socket.userId, socket);
      });
    } catch (_error) {
      socket.close(1008, "Invalid token");
    }
  });
}
