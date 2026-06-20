import { RequestHandler, Router } from "express";
import jwt from "jsonwebtoken";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { config } from "./config";
import { pool } from "./db";
import { requireActiveUser } from "./middleware/active-user";
import { requireAdmin } from "./middleware/admin";
import { requireAuth } from "./middleware/auth";
import { emitConversationMessage, emitReadReceipt, isUserOnline } from "./realtime";
import { codeToOpenId } from "./utils";
import {
  decryptWechatCallbackEncryptedText,
  parseWechatXml,
  persistWechatCallbackEvent,
  syncNotificationTaskByCallbackMessage,
  verifyWechatCallbackSignature,
  verifyWechatMessageSignature,
  WechatPushError
} from "./wechat-push";

const router = Router();
const wrap = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

type NotificationSettings = {
  pushEnabled: boolean;
  messagePushEnabled: boolean;
  matchPushEnabled: boolean;
};

function toTinyInt(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function parseBooleanField(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

async function getConversationParticipantIds(conversationId: number): Promise<number[]> {
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

async function getNotificationSettings(userId: number): Promise<NotificationSettings> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT push_enabled, message_push_enabled, match_push_enabled
     FROM notification_preferences
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  if (!rows[0]) {
    await pool.query(
      `INSERT IGNORE INTO notification_preferences
       (user_id, push_enabled, message_push_enabled, match_push_enabled)
       VALUES (?, 1, 1, 1)`,
      [userId]
    );
    return {
      pushEnabled: true,
      messagePushEnabled: true,
      matchPushEnabled: true
    };
  }
  return {
    pushEnabled: Number(rows[0].push_enabled) === 1,
    messagePushEnabled: Number(rows[0].message_push_enabled) === 1,
    matchPushEnabled: Number(rows[0].match_push_enabled) === 1
  };
}

async function enqueueOfflineMessageNotification(params: {
  conversationId: number;
  senderId: number;
  messageId: number;
  messageContent: string;
}): Promise<void> {
  const participantIds = await getConversationParticipantIds(params.conversationId);
  const receiverIds = participantIds.filter((userId) => userId !== params.senderId);
  const plainText = params.messageContent.trim();
  const contentPreview = plainText.length > 80 ? `${plainText.slice(0, 80)}...` : plainText;

  for (const receiverId of receiverIds) {
    if (isUserOnline(receiverId)) continue;
    const settings = await getNotificationSettings(receiverId);
    if (!settings.pushEnabled || !settings.messagePushEnabled) continue;
    await pool.query(
      `INSERT INTO notification_tasks
       (user_id, conversation_id, message_id, task_type, channel, title, content, status, retry_count, max_retries)
       VALUES (?, ?, ?, 'new_message', 'wx_subscribe', ?, ?, 'pending', 0, ?)`,
      [
        receiverId,
        params.conversationId,
        params.messageId,
        "你收到一条新消息",
        contentPreview || "点击查看详情",
        config.push.maxRetries
      ]
    );
  }
}

router.post("/auth/wx-login", wrap(async (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code) {
    res.status(400).json({ message: "code is required" });
    return;
  }

  const openid = codeToOpenId(code);
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE openid = ? LIMIT 1",
    [openid]
  );

  let userId = existing[0]?.id as number | undefined;
  if (!userId) {
    const nickname = `用户${openid.slice(0, 6)}`;
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (openid, nickname) VALUES (?, ?)",
      [openid, nickname]
    );
    userId = result.insertId;
  }

  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: "7d" });
  res.json({ data: { token, userId } });
}));

router.get("/wechat/push/callback", wrap(async (req, res) => {
  const signature = String(req.query.signature || "");
  const msgSignature = String(req.query.msg_signature || "");
  const timestamp = String(req.query.timestamp || "");
  const nonce = String(req.query.nonce || "");
  const echoStr = String(req.query.echostr || "");
  if (msgSignature && echoStr) {
    const passed = verifyWechatMessageSignature({
      msgSignature,
      timestamp,
      nonce,
      encrypted: echoStr
    });
    if (!passed) {
      res.status(401).send("signature invalid");
      return;
    }
    try {
      const plainEcho = decryptWechatCallbackEncryptedText(echoStr);
      res.type("text/plain").send(plainEcho || "ok");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "decrypt failed";
      res.status(400).send(message);
      return;
    }
  } else {
    const passed = verifyWechatCallbackSignature({ signature, timestamp, nonce });
    if (!passed) {
      res.status(401).send("signature invalid");
      return;
    }
    res.type("text/plain").send(echoStr || "ok");
    return;
  }
}));

router.post("/wechat/push/callback", wrap(async (req, res) => {
  const signature = String(req.query.signature || "");
  const msgSignature = String(req.query.msg_signature || "");
  const timestamp = String(req.query.timestamp || "");
  const nonce = String(req.query.nonce || "");
  const rawBody = typeof req.body === "string" ? req.body : "";
  if (!rawBody) {
    res.status(400).json({ message: "empty callback body" });
    return;
  }

  let messageXml = rawBody;
  const rootMessage = parseWechatXml(rawBody);
  const encrypted = String(rootMessage.Encrypt || "");

  if (encrypted) {
    const passed = verifyWechatMessageSignature({
      msgSignature,
      timestamp,
      nonce,
      encrypted
    });
    if (!passed) {
      res.status(401).json({ message: "signature invalid" });
      return;
    }
    try {
      messageXml = decryptWechatCallbackEncryptedText(encrypted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "decrypt failed";
      res.status(400).json({ message });
      return;
    }
  } else {
    const passed = verifyWechatCallbackSignature({ signature, timestamp, nonce });
    if (!passed) {
      res.status(401).json({ message: "signature invalid" });
      return;
    }
  }

  try {
    const result = await persistWechatCallbackEvent({ messageXml });
    const syncResult = await syncNotificationTaskByCallbackMessage({ messageXml });
    res.json({
      message: "success",
      data: {
        eventId: result.eventId,
        inserted: result.inserted,
        taskSynced: syncResult.synced,
        taskId: syncResult.taskId || null
      }
    });
  } catch (error) {
    if (error instanceof WechatPushError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
}));

router.get("/profile/me", requireAuth, wrap(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nickname, avatar, gender, age_range, city, bio, status, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [req.authUserId]
  );
  if (!rows[0]) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json({ data: rows[0] });
}));

router.get("/notifications/settings", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const settings = await getNotificationSettings(req.authUserId || 0);
  res.json({ data: settings });
}));

router.put("/notifications/settings", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const incomingPushEnabled = parseBooleanField(req.body?.pushEnabled);
  const incomingMessagePushEnabled = parseBooleanField(req.body?.messagePushEnabled);
  const incomingMatchPushEnabled = parseBooleanField(req.body?.matchPushEnabled);

  if (
    incomingPushEnabled === null &&
    incomingMessagePushEnabled === null &&
    incomingMatchPushEnabled === null
  ) {
    res.status(400).json({ message: "at least one setting is required" });
    return;
  }

  const current = await getNotificationSettings(req.authUserId || 0);
  const nextSettings: NotificationSettings = {
    pushEnabled: incomingPushEnabled === null ? current.pushEnabled : incomingPushEnabled,
    messagePushEnabled:
      incomingMessagePushEnabled === null
        ? current.messagePushEnabled
        : incomingMessagePushEnabled,
    matchPushEnabled:
      incomingMatchPushEnabled === null ? current.matchPushEnabled : incomingMatchPushEnabled
  };

  await pool.query(
    `INSERT INTO notification_preferences
     (user_id, push_enabled, message_push_enabled, match_push_enabled)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       push_enabled = VALUES(push_enabled),
       message_push_enabled = VALUES(message_push_enabled),
       match_push_enabled = VALUES(match_push_enabled),
       updated_at = CURRENT_TIMESTAMP`,
    [
      req.authUserId,
      toTinyInt(nextSettings.pushEnabled),
      toTinyInt(nextSettings.messagePushEnabled),
      toTinyInt(nextSettings.matchPushEnabled)
    ]
  );

  res.json({ data: nextSettings });
}));

router.get("/notifications/tasks", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const status = String(req.query.status || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const statusValues = ["pending", "processing", "sent", "failed", "dead"];
  const hasStatusFilter = statusValues.includes(status);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, user_id, conversation_id, message_id, task_type, channel, title, content,
            status, retry_count, max_retries, provider_msg_id, provider_trace_id,
            callback_status, callback_at, error_message, scheduled_at, sent_at, created_at, updated_at
     FROM notification_tasks
     WHERE user_id = ?
       AND (? = 0 OR status = ?)
     ORDER BY id DESC
     LIMIT ?`,
    [req.authUserId, hasStatusFilter ? 1 : 0, status, limit]
  );
  res.json({ data: rows });
}));

router.patch("/notifications/tasks/:id", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const taskId = Number(req.params.id);
  const status = String(req.body?.status || "").trim();
  const errorMessage = String(req.body?.errorMessage || "").trim();

  if (!Number.isInteger(taskId) || taskId <= 0) {
    res.status(400).json({ message: "invalid task id" });
    return;
  }
  if (!["pending", "sent", "failed", "dead"].includes(status)) {
    res.status(400).json({ message: "invalid status" });
    return;
  }

  const sentAt = status === "sent" ? new Date() : null;
  await pool.query(
    `UPDATE notification_tasks
     SET status = ?, error_message = ?, sent_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [status, errorMessage || null, sentAt, taskId, req.authUserId]
  );
  res.json({ message: "ok" });
}));

router.put("/profile/me", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const { nickname, avatar, gender, ageRange, city, bio, tags } = req.body || {};

  await pool.query(
    `UPDATE users
     SET nickname = COALESCE(?, nickname),
         avatar = COALESCE(?, avatar),
         gender = COALESCE(?, gender),
         age_range = COALESCE(?, age_range),
         city = COALESCE(?, city),
         bio = COALESCE(?, bio)
     WHERE id = ?`,
    [nickname, avatar, gender, ageRange, city, bio, req.authUserId]
  );

  if (Array.isArray(tags)) {
    await pool.query("DELETE FROM user_tags WHERE user_id = ?", [req.authUserId]);
    for (const tagNameRaw of tags.slice(0, 10)) {
      const tagName = String(tagNameRaw || "").trim();
      if (!tagName) continue;
      const [tagRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM tags WHERE name = ? LIMIT 1",
        [tagName]
      );
      let tagId = tagRows[0]?.id as number | undefined;
      if (!tagId) {
        const [insertTag] = await pool.query<ResultSetHeader>(
          "INSERT INTO tags (name) VALUES (?)",
          [tagName]
        );
        tagId = insertTag.insertId;
      }
      await pool.query("INSERT IGNORE INTO user_tags (user_id, tag_id) VALUES (?, ?)", [
        req.authUserId,
        tagId
      ]);
    }
  }

  res.json({ message: "ok" });
}));

router.get("/recommendations", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.nickname, u.avatar, u.city, u.bio
     FROM users u
     WHERE u.id != ?
       AND u.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM swipes s WHERE s.from_user_id = ? AND s.to_user_id = u.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM blocks b WHERE b.user_id = ? AND b.blocked_user_id = u.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM blocks b2 WHERE b2.user_id = u.id AND b2.blocked_user_id = ?
       )
     ORDER BY u.id DESC
     LIMIT 20`,
    [req.authUserId, req.authUserId, req.authUserId, req.authUserId]
  );
  res.json({ data: rows });
}));

router.post("/swipes", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const targetUserId = Number(req.body?.targetUserId);
  const action = String(req.body?.action || "").toLowerCase();
  if (!Number.isInteger(targetUserId) || targetUserId <= 0 || !["like", "pass"].includes(action)) {
    res.status(400).json({ message: "invalid params" });
    return;
  }
  if (targetUserId === req.authUserId) {
    res.status(400).json({ message: "cannot swipe self" });
    return;
  }

  await pool.query(
    `INSERT INTO swipes (from_user_id, to_user_id, action)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE action = VALUES(action), created_at = CURRENT_TIMESTAMP`,
    [req.authUserId, targetUserId, action]
  );

  let matched = false;
  if (action === "like") {
    const [reverseLike] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM swipes
       WHERE from_user_id = ? AND to_user_id = ? AND action = 'like' LIMIT 1`,
      [targetUserId, req.authUserId]
    );

    if (reverseLike[0]) {
      matched = true;
      const [matchRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM matches
         WHERE ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))
         LIMIT 1`,
        [req.authUserId, targetUserId, targetUserId, req.authUserId]
      );

      let matchId = matchRows[0]?.id as number | undefined;
      if (!matchId) {
        const userA = Math.min(req.authUserId || 0, targetUserId);
        const userB = Math.max(req.authUserId || 0, targetUserId);
        const [insertMatch] = await pool.query<ResultSetHeader>(
          "INSERT INTO matches (user_a, user_b, status) VALUES (?, ?, 'active')",
          [userA, userB]
        );
        matchId = insertMatch.insertId;
      }

      await pool.query("INSERT IGNORE INTO conversations (match_id) VALUES (?)", [matchId]);
    }
  }

  res.json({ data: { matched } });
}));

router.get("/matches", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.user_a, m.user_b, m.status, m.created_at
     FROM matches m
     WHERE (m.user_a = ? OR m.user_b = ?) AND m.status = 'active'
     ORDER BY m.id DESC`,
    [req.authUserId, req.authUserId]
  );
  res.json({ data: rows });
}));

router.get("/conversations", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.match_id, c.last_message_at,
            (
              SELECT COUNT(1)
              FROM messages msg
              LEFT JOIN message_reads mr
                ON mr.conversation_id = c.id AND mr.user_id = ?
              WHERE msg.conversation_id = c.id
                AND msg.sender_id <> ?
                AND msg.id > COALESCE(mr.last_read_message_id, 0)
            ) AS unread_count
     FROM conversations c
     JOIN matches m ON m.id = c.match_id
     WHERE (m.user_a = ? OR m.user_b = ?) AND m.status = 'active'
     ORDER BY c.last_message_at DESC, c.id DESC`,
    [req.authUserId, req.authUserId, req.authUserId, req.authUserId]
  );
  res.json({ data: rows });
}));

router.get("/conversations/:id/messages", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const conversationId = Number(req.params.id);
  const afterId = Math.max(Number(req.query.afterId || 0), 0);
  const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 200);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ message: "invalid conversation id" });
    return;
  }

  const [allowed] = await pool.query<RowDataPacket[]>(
    `SELECT c.id
     FROM conversations c
     JOIN matches m ON m.id = c.match_id
     WHERE c.id = ? AND m.status = 'active' AND (m.user_a = ? OR m.user_b = ?)
     LIMIT 1`,
    [conversationId, req.authUserId, req.authUserId]
  );
  if (!allowed[0]) {
    res.status(403).json({ message: "forbidden" });
    return;
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, conversation_id, sender_id, type, content, created_at
     FROM messages
     WHERE conversation_id = ? AND id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [conversationId, afterId, limit]
  );
  res.json({ data: rows });
}));

router.post("/conversations/:id/messages", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const conversationId = Number(req.params.id);
  const content = String(req.body?.content || "").trim();

  if (!Number.isInteger(conversationId) || conversationId <= 0 || !content) {
    res.status(400).json({ message: "invalid params" });
    return;
  }

  const [allowed] = await pool.query<RowDataPacket[]>(
    `SELECT c.id
     FROM conversations c
     JOIN matches m ON m.id = c.match_id
     WHERE c.id = ? AND m.status = 'active' AND (m.user_a = ? OR m.user_b = ?)
     LIMIT 1`,
    [conversationId, req.authUserId, req.authUserId]
  );
  if (!allowed[0]) {
    res.status(403).json({ message: "forbidden" });
    return;
  }

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO messages (conversation_id, sender_id, type, content) VALUES (?, ?, 'text', ?)",
    [conversationId, req.authUserId, content]
  );
  await pool.query("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?", [
    conversationId
  ]);

  const [messageRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, conversation_id, sender_id, type, content, created_at
     FROM messages WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  if (messageRows[0]) {
    await emitConversationMessage(conversationId, messageRows[0]);
    await enqueueOfflineMessageNotification({
      conversationId,
      senderId: req.authUserId || 0,
      messageId: Number(messageRows[0].id),
      messageContent: String(messageRows[0].content || "")
    });
  }

  res.json({ data: messageRows[0] || { id: result.insertId } });
}));

router.post("/conversations/:id/read", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const conversationId = Number(req.params.id);
  const lastReadMessageId = Number(req.body?.lastReadMessageId);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ message: "invalid conversation id" });
    return;
  }

  const [allowed] = await pool.query<RowDataPacket[]>(
    `SELECT c.id
     FROM conversations c
     JOIN matches m ON m.id = c.match_id
     WHERE c.id = ? AND m.status = 'active' AND (m.user_a = ? OR m.user_b = ?)
     LIMIT 1`,
    [conversationId, req.authUserId, req.authUserId]
  );
  if (!allowed[0]) {
    res.status(403).json({ message: "forbidden" });
    return;
  }

  const [maxRows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id), 0) AS max_id FROM messages WHERE conversation_id = ?",
    [conversationId]
  );
  const maxId = Number(maxRows[0]?.max_id || 0);
  const normalizedReadId = Number.isInteger(lastReadMessageId)
    ? Math.max(0, Math.min(lastReadMessageId, maxId))
    : maxId;

  await pool.query(
    `INSERT INTO message_reads (conversation_id, user_id, last_read_message_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_read_message_id = GREATEST(last_read_message_id, VALUES(last_read_message_id)),
       updated_at = CURRENT_TIMESTAMP`,
    [conversationId, req.authUserId, normalizedReadId]
  );

  await emitReadReceipt(conversationId, req.authUserId || 0, normalizedReadId);
  res.json({ data: { conversationId, lastReadMessageId: normalizedReadId } });
}));

router.post("/reports", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const targetUserId = req.body?.targetUserId ? Number(req.body.targetUserId) : null;
  const targetMessageId = req.body?.targetMessageId ? Number(req.body.targetMessageId) : null;
  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    res.status(400).json({ message: "reason is required" });
    return;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO reports (reporter_id, target_user_id, target_message_id, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [req.authUserId, targetUserId, targetMessageId, reason]
  );
  res.json({ data: { id: result.insertId } });
}));

router.post("/blocks", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const blockedUserId = Number(req.body?.blockedUserId);
  if (!Number.isInteger(blockedUserId) || blockedUserId <= 0) {
    res.status(400).json({ message: "invalid blocked user id" });
    return;
  }

  await pool.query("INSERT IGNORE INTO blocks (user_id, blocked_user_id) VALUES (?, ?)", [
    req.authUserId,
    blockedUserId
  ]);
  await pool.query(
    `UPDATE matches
     SET status = 'closed'
     WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)`,
    [req.authUserId, blockedUserId, blockedUserId, req.authUserId]
  );

  res.json({ message: "ok" });
}));

router.delete("/blocks/:blockedUserId", requireAuth, requireActiveUser, wrap(async (req, res) => {
  const blockedUserId = Number(req.params.blockedUserId);
  if (!Number.isInteger(blockedUserId) || blockedUserId <= 0) {
    res.status(400).json({ message: "invalid blocked user id" });
    return;
  }
  await pool.query("DELETE FROM blocks WHERE user_id = ? AND blocked_user_id = ?", [
    req.authUserId,
    blockedUserId
  ]);
  res.json({ message: "ok" });
}));

router.get("/admin/reports", requireAdmin, wrap(async (req, res) => {
  const status = String(req.query.status || "pending").trim();
  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 100);
  const offset = (page - 1) * pageSize;

  const statusValues = ["pending", "processed", "rejected"];
  const statusFilter = statusValues.includes(status) ? status : "pending";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.reporter_id, ru.nickname AS reporter_nickname,
            r.target_user_id, tu.nickname AS target_user_nickname,
            r.target_message_id, m.content AS target_message_content,
            r.reason, r.status, r.review_note, r.reviewed_by, r.reviewed_at, r.created_at
     FROM reports r
     LEFT JOIN users ru ON ru.id = r.reporter_id
     LEFT JOIN users tu ON tu.id = r.target_user_id
     LEFT JOIN messages m ON m.id = r.target_message_id
     WHERE r.status = ?
     ORDER BY r.id DESC
     LIMIT ? OFFSET ?`,
    [statusFilter, pageSize, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(1) AS total FROM reports WHERE status = ?",
    [statusFilter]
  );

  res.json({
    data: rows,
    meta: {
      page,
      pageSize,
      total: Number(countRows[0]?.total || 0),
      status: statusFilter
    }
  });
}));

router.patch("/admin/reports/:id", requireAdmin, wrap(async (req, res) => {
  const reportId = Number(req.params.id);
  const status = String(req.body?.status || "").trim();
  const action = String(req.body?.action || "none").trim();
  const note = String(req.body?.note || "").trim();
  const reviewedBy = String(req.body?.reviewedBy || "admin").trim();

  if (!Number.isInteger(reportId) || reportId <= 0) {
    res.status(400).json({ message: "invalid report id" });
    return;
  }
  if (!["processed", "rejected"].includes(status)) {
    res.status(400).json({ message: "invalid status" });
    return;
  }
  if (!["none", "ban_target", "ban_reporter"].includes(action)) {
    res.status(400).json({ message: "invalid action" });
    return;
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT reporter_id, target_user_id FROM reports WHERE id = ? LIMIT 1",
    [reportId]
  );
  if (!rows[0]) {
    res.status(404).json({ message: "report not found" });
    return;
  }

  await pool.query(
    `UPDATE reports
     SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, note || null, reviewedBy, reportId]
  );

  if (status === "processed" && action === "ban_target" && rows[0].target_user_id) {
    await pool.query("UPDATE users SET status = 'banned' WHERE id = ?", [rows[0].target_user_id]);
  }
  if (status === "processed" && action === "ban_reporter" && rows[0].reporter_id) {
    await pool.query("UPDATE users SET status = 'banned' WHERE id = ?", [rows[0].reporter_id]);
  }

  res.json({ message: "ok" });
}));

router.get("/admin/users", requireAdmin, wrap(async (req, res) => {
  const keyword = String(req.query.keyword || "").trim();
  const like = `%${keyword}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nickname, city, status, created_at
     FROM users
     WHERE (? = '' OR nickname LIKE ? OR city LIKE ?)
     ORDER BY id DESC
     LIMIT 100`,
    [keyword, like, like]
  );
  res.json({ data: rows });
}));

router.patch("/admin/users/:id/status", requireAdmin, wrap(async (req, res) => {
  const userId = Number(req.params.id);
  const status = String(req.body?.status || "").trim();
  if (!Number.isInteger(userId) || userId <= 0 || !["active", "banned"].includes(status)) {
    res.status(400).json({ message: "invalid params" });
    return;
  }
  await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
  res.json({ message: "ok" });
}));

export { router };
