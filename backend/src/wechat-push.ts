import crypto from "crypto";
import { RowDataPacket } from "mysql2";
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
