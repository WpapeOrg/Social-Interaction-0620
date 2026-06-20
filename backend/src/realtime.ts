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

type ClientEvent =
  | {
      type: "typing";
      conversationId: number;
      isTyping: boolean;
    }
  | {
      type: "delivered";
      conversationId: number;
      messageId: number;
    }
  | {
      type: "ping";
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

export function isUserOnline(userId: number): boolean {
  const socketSet = userSocketMap.get(userId);
  if (!socketSet || socketSet.size === 0) return false;
  for (const socket of socketSet) {
    if (socket.readyState === WebSocket.OPEN) return true;
  }
  return false;
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

async function canAccessConversation(userId: number, conversationId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id
     FROM conversations c
     JOIN matches m ON m.id = c.match_id
     WHERE c.id = ? AND m.status = 'active' AND (m.user_a = ? OR m.user_b = ?)
     LIMIT 1`,
    [conversationId, userId, userId]
  );
  return Boolean(rows[0]);
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
  message: Record<string, unknown>
): Promise<void> {
  const participants = await getConversationParticipants(conversationId);
  if (participants.length === 0) return;
  emitToUsers(participants, {
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
  if (receiverIds.length > 0) {
    emitToUsers(receiverIds, {
      type: "read_receipt",
      conversationId,
      readerId,
      lastReadMessageId
    });
  }
  emitToUsers([readerId], {
    type: "self_read_sync",
    conversationId,
    lastReadMessageId
  });
}

async function emitTypingStatus(
  conversationId: number,
  senderId: number,
  isTyping: boolean
): Promise<void> {
  const participants = await getConversationParticipants(conversationId);
  const receiverIds = participants.filter((userId) => userId !== senderId);
  if (receiverIds.length === 0) return;
  emitToUsers(receiverIds, {
    type: "typing_status",
    conversationId,
    senderId,
    isTyping
  });
}

async function emitDeliveryReceipt(
  conversationId: number,
  receiverId: number,
  messageId: number
): Promise<void> {
  const participants = await getConversationParticipants(conversationId);
  const senderIds = participants.filter((userId) => userId !== receiverId);
  if (senderIds.length === 0) return;
  emitToUsers(senderIds, {
    type: "delivery_receipt",
    conversationId,
    receiverId,
    messageId
  });
  emitToUsers([receiverId], {
    type: "self_delivery_sync",
    conversationId,
    messageId
  });
}

async function markDelivered(
  conversationId: number,
  receiverId: number,
  messageId: number
): Promise<void> {
  if (!Number.isInteger(messageId) || messageId <= 0) return;
  const [messageRows] = await pool.query<RowDataPacket[]>(
    `SELECT sender_id
     FROM messages
     WHERE id = ? AND conversation_id = ?
     LIMIT 1`,
    [messageId, conversationId]
  );
  if (!messageRows[0]) return;
  if (Number(messageRows[0].sender_id) === receiverId) return;

  await pool.query(
    `INSERT INTO message_deliveries (conversation_id, user_id, last_delivered_message_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_delivered_message_id = GREATEST(last_delivered_message_id, VALUES(last_delivered_message_id)),
       updated_at = CURRENT_TIMESTAMP`,
    [conversationId, receiverId, messageId]
  );
  await emitDeliveryReceipt(conversationId, receiverId, messageId);
}

async function handleSocketMessage(socket: SocketWithUser, rawData: Buffer): Promise<void> {
  if (!socket.userId) return;
  let event: ClientEvent;
  try {
    event = JSON.parse(rawData.toString()) as ClientEvent;
  } catch (_error) {
    return;
  }

  if (event.type === "ping") {
    socket.send(JSON.stringify({ type: "pong" }));
    return;
  }

  if (event.type === "typing") {
    const conversationId = Number(event.conversationId);
    const isTyping = Boolean(event.isTyping);
    if (!Number.isInteger(conversationId) || conversationId <= 0) return;
    const allowed = await canAccessConversation(socket.userId, conversationId);
    if (!allowed) return;
    await emitTypingStatus(conversationId, socket.userId, isTyping);
    return;
  }

  if (event.type === "delivered") {
    const conversationId = Number(event.conversationId);
    const messageId = Number(event.messageId);
    if (!Number.isInteger(conversationId) || conversationId <= 0) return;
    if (!Number.isInteger(messageId) || messageId <= 0) return;
    const allowed = await canAccessConversation(socket.userId, conversationId);
    if (!allowed) return;
    await markDelivered(conversationId, socket.userId, messageId);
  }
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

      socket.on("message", async (rawData: Buffer) => {
        await handleSocketMessage(socket, rawData);
      });

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
