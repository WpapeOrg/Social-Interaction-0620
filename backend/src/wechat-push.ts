import crypto from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { config } from "./config";
import { pool } from "./db";

type AccessTokenCache = {
  value: string;
  expiresAt: number;
};

type WechatSendResult = {
  msgid?: number;
  trace_id?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatXmlMap = Record<string, string>;

export class WechatPushError extends Error {
  permanent: boolean;

  constructor(message: string, permanent: boolean) {
    super(message);
    this.permanent = permanent;
  }
}

let accessTokenCache: AccessTokenCache | null = null;
let tokenLoadingPromise: Promise<string> | null = null;

function sanitizeTemplateValue(value: string, maxLength: number): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "新消息提醒";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function ensureWechatConfigReady(): void {
  if (!config.push.wxAppId || !config.push.wxAppSecret || !config.push.wxTemplateId) {
    throw new WechatPushError(
      "wechat push config missing: PUSH_WX_APP_ID/PUSH_WX_APP_SECRET/PUSH_WX_TEMPLATE_ID",
      true
    );
  }
}

async function loadAccessTokenFromWechat(): Promise<string> {
  ensureWechatConfigReady();
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(
    config.push.wxAppId
  )}&secret=${encodeURIComponent(config.push.wxAppSecret)}`;

  const response = await fetch(tokenUrl, { method: "GET" });
  if (!response.ok) {
    throw new WechatPushError(`wechat token http ${response.status}`, false);
  }
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };
  if (!json.access_token) {
    const errorText = `wechat token failed: ${json.errcode || -1} ${json.errmsg || "unknown"}`;
    throw new WechatPushError(errorText, false);
  }
  const ttl = Math.max(Number(json.expires_in || 7200), 300);
  accessTokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (ttl - 120) * 1000
  };
  return json.access_token;
}

async function getWechatAccessToken(): Promise<string> {
  const cached = accessTokenCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (tokenLoadingPromise) {
    return tokenLoadingPromise;
  }
  tokenLoadingPromise = loadAccessTokenFromWechat().finally(() => {
    tokenLoadingPromise = null;
  });
  return tokenLoadingPromise;
}

async function getUserOpenId(userId: number): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT openid FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const openid = String(rows[0]?.openid || "").trim();
  if (!openid) {
    throw new WechatPushError(`user ${userId} openid missing`, true);
  }
  return openid;
}

function parseWechatSendError(result: WechatSendResult): WechatPushError | null {
  const errcode = Number(result.errcode || 0);
  if (!errcode) return null;
  const message = `wechat send failed: ${errcode} ${result.errmsg || ""}`.trim();
  const permanentCodes = new Set([40003, 40037, 41028, 43101, 47003, 48001]);
  const tokenCodes = new Set([40001, 40014, 42001]);
  if (permanentCodes.has(errcode)) {
    return new WechatPushError(message, true);
  }
  if (tokenCodes.has(errcode)) {
    accessTokenCache = null;
  }
  return new WechatPushError(message, false);
}

export async function sendWechatSubscribeMessage(params: {
  userId: number;
  title: string;
  content: string;
}): Promise<void> {
  ensureWechatConfigReady();
  const [openid, accessToken] = await Promise.all([
    getUserOpenId(params.userId),
    getWechatAccessToken()
  ]);
  const payload = {
    touser: openid,
    template_id: config.push.wxTemplateId,
    page: config.push.wxPagePath,
    miniprogram_state: config.push.wxMiniProgramState,
    lang: config.push.wxLang,
    data: {
      [config.push.wxTitleKey]: {
        value: sanitizeTemplateValue(params.title, 20)
      },
      [config.push.wxContentKey]: {
        value: sanitizeTemplateValue(params.content, 20)
      }
    }
  };

  const endpoint = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(
    accessToken
  )}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new WechatPushError(`wechat send http ${response.status}`, false);
  }
  const result = (await response.json()) as WechatSendResult;
  const sendError = parseWechatSendError(result);
  if (sendError) {
    throw sendError;
  }
}

export function verifyWechatCallbackSignature(params: {
  signature: string;
  timestamp: string;
  nonce: string;
}): boolean {
  const token = String(config.push.wxCallbackToken || "").trim();
  if (!token) return false;
  const plain = [token, params.timestamp, params.nonce].sort().join("");
  const digest = crypto.createHash("sha1").update(plain).digest("hex");
  return digest === params.signature;
}

export function verifyWechatMessageSignature(params: {
  msgSignature: string;
  timestamp: string;
  nonce: string;
  encrypted: string;
}): boolean {
  const token = String(config.push.wxCallbackToken || "").trim();
  if (!token) return false;
  const plain = [token, params.timestamp, params.nonce, params.encrypted].sort().join("");
  const digest = crypto.createHash("sha1").update(plain).digest("hex");
  return digest === params.msgSignature;
}

export function parseWechatXml(xmlText: string): WechatXmlMap {
  const xml = String(xmlText || "");
  const output: WechatXmlMap = {};
  const cdataPattern = /<([A-Za-z0-9_]+)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
  const textPattern = /<([A-Za-z0-9_]+)>([^<]+)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = cdataPattern.exec(xml))) {
    output[match[1]] = String(match[2] || "").trim();
  }
  while ((match = textPattern.exec(xml))) {
    if (output[match[1]] !== undefined) continue;
    output[match[1]] = String(match[2] || "").trim();
  }
  return output;
}

function decodePkcs7(data: Buffer): Buffer {
  if (data.length === 0) {
    throw new WechatPushError("wechat decrypt empty data", true);
  }
  const pad = data[data.length - 1];
  if (pad < 1 || pad > 32) {
    return data;
  }
  return data.subarray(0, data.length - pad);
}

function getWechatAesKey(): Buffer {
  const aesKey = String(config.push.wxCallbackAesKey || "").trim();
  if (!aesKey) {
    throw new WechatPushError("wechat callback aes key missing", true);
  }
  const buffer = Buffer.from(`${aesKey}=`, "base64");
  if (buffer.length !== 32) {
    throw new WechatPushError("wechat callback aes key invalid", true);
  }
  return buffer;
}

export function decryptWechatCallbackEncryptedText(encryptedText: string): string {
  const aesKey = getWechatAesKey();
  const iv = aesKey.subarray(0, 16);
  const encrypted = Buffer.from(String(encryptedText || ""), "base64");
  if (encrypted.length === 0) {
    throw new WechatPushError("wechat encrypted payload invalid", true);
  }
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const plain = decodePkcs7(decrypted);
  if (plain.length < 20) {
    throw new WechatPushError("wechat decrypted payload too short", true);
  }
  const msgLength = plain.readUInt32BE(16);
  const msgStart = 20;
  const msgEnd = msgStart + msgLength;
  if (plain.length < msgEnd) {
    throw new WechatPushError("wechat decrypted payload length mismatch", true);
  }
  const xmlText = plain.subarray(msgStart, msgEnd).toString("utf8");
  const fromAppId = plain.subarray(msgEnd).toString("utf8").trim();
  if (fromAppId && config.push.wxAppId && fromAppId !== config.push.wxAppId) {
    throw new WechatPushError("wechat callback appid mismatch", true);
  }
  return xmlText;
}

function buildCallbackEventId(message: WechatXmlMap): string {
  const msgId = message.MsgId || message.MsgID || "";
  const fromUserName = message.FromUserName || "";
  const createTime = message.CreateTime || "";
  const event = message.Event || "";
  const eventKey = message.EventKey || "";
  const status = message.Status || "";
  const candidate = [msgId, fromUserName, createTime, event, eventKey, status]
    .filter((item) => item)
    .join("|");
  const base = candidate || JSON.stringify(message);
  return crypto.createHash("sha1").update(base).digest("hex");
}

export async function persistWechatCallbackEvent(params: {
  messageXml: string;
}): Promise<{ inserted: boolean; eventId: string }> {
  const message = parseWechatXml(params.messageXml);
  const eventId = buildCallbackEventId(message);
  const eventType = String(message.Event || message.MsgType || "unknown").slice(0, 64);
  const eventStatus = String(message.Status || "").slice(0, 64) || null;
  const fromUserOpenid = String(message.FromUserName || "").slice(0, 64) || null;
  const msgId = String(message.MsgId || message.MsgID || "").slice(0, 64) || null;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT IGNORE INTO notification_callback_events
     (event_id, event_type, event_status, from_user_openid, msg_id, payload_xml)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [eventId, eventType, eventStatus, fromUserOpenid, msgId, params.messageXml]
  );
  const inserted = Number(result.affectedRows || 0) > 0;
  return { inserted, eventId };
}
