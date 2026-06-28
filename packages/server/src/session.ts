import { sign, unsign } from "cookie-signature";
import type { AppConfig } from "@timebank/shared";

const COOKIE_NAME = "tb_sess";

export interface SessionPayload {
  childId: string;
  exp: number; // 毫秒时间戳
}

export class SessionStore {
  private secret: string;
  private lifetimeMs: number;
  /** 进程级吊销集合：登出后令牌摘要失效 */
  private revoked = new Set<string>();

  constructor(config: AppConfig) {
    this.secret = config.server.sessionSecret;
    this.lifetimeMs = config.session.lifetimeDays * 24 * 60 * 60 * 1000;
  }

  /** 创建签名 cookie 值 */
  issue(childId: string, now = Date.now()): string {
    const payload: SessionPayload = { childId, exp: now + this.lifetimeMs };
    return sign(JSON.stringify(payload), this.secret);
  }

  /** 验证并解析签名 cookie，返回 payload 或 null */
  verify(signedValue: string, now = Date.now()): SessionPayload | null {
    const raw = unsign(signedValue, this.secret);
    if (raw === false) return null;
    try {
      const payload = JSON.parse(raw) as SessionPayload;
      if (this.revoked.has(tokenDigest(signedValue))) return null;
      if (payload.exp <= now) return null;
      return payload;
    } catch {
      return null;
    }
  }

  /** 滑动续期：若剩余寿命 < 一半，签发新 token */
  shouldRenew(payload: SessionPayload, now = Date.now()): boolean {
    const remaining = payload.exp - now;
    return remaining < this.lifetimeMs / 2;
  }

  /** 登出：加入吊销集合 */
  revoke(signedValue: string): void {
    this.revoked.add(tokenDigest(signedValue));
  }

  get cookieName() {
    return COOKIE_NAME;
  }

  get lifetimeMsValue() {
    return this.lifetimeMs;
  }
}

function tokenDigest(signedValue: string): string {
  // 简单截取签名段作为摘要，足够进程内去重
  const idx = signedValue.lastIndexOf(".");
  return idx > 0 ? signedValue.slice(idx) : signedValue;
}
