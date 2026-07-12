// functions/_utils/session.js
// 会话管理：基于 Cloudflare KV
// 单用户模型：所有 session 归属于同一个 user_id（即 PASSWORD 的 SHA-256）

import { sha256 } from '../../js/sha256.js';

export const SESSION_COOKIE = 'libretv_sid';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;       // 30 天
export const SESSION_RENEW_THRESHOLD = 60 * 60 * 24 * 7;    // 剩余 < 7 天则续期

/**
 * 计算单用户 user_id（基于 PASSWORD 环境变量）
 * 如果 PASSWORD 为空，返回 null —— 调用方应拒绝登录
 */
export async function getUserId(env) {
    const pwd = env.PASSWORD || '';
    if (!pwd) return null;
    const hash = await sha256(pwd);
    return hash.slice(0, 16);
}

/**
 * 生成 session id（16 字节十六进制）
 */
export function newSessionId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 从请求中读取 session cookie
 */
export function readSessionCookie(request) {
    const header = request.headers.get('Cookie') || '';
    const m = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
}

/**
 * 创建 session 记录并返回 Set-Cookie 头
 */
export async function createSession(env, request, sessionId, userId) {
    const ua = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP')
            || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
            || '0.0.0.0';
    const country = request.headers.get('CF-IPCountry') || '';
    const now = Date.now();
    const record = {
        sid: sessionId,
        uid: userId,
        ip,
        country,
        ua,
        createdAt: now,
        lastSeenAt: now,
    };
    await env.SESSIONS.put(`s:${sessionId}`, JSON.stringify(record), {
        expirationTtl: SESSION_TTL_SECONDS,
    });
    // 维护 user -> sessions 索引（list 形式）
    const indexKey = `u:${userId}:sessions`;
    const existing = await env.SESSIONS.get(indexKey, { type: 'json' }) || [];
    if (!existing.includes(sessionId)) {
        existing.push(sessionId);
        await env.SESSIONS.put(indexKey, JSON.stringify(existing), {
            expirationTtl: SESSION_TTL_SECONDS,
        });
    }
    return buildSetCookie(sessionId, SESSION_TTL_SECONDS);
}

export function buildSetCookie(sid, maxAge) {
    const attrs = [
        `${SESSION_COOKIE}=${encodeURIComponent(sid)}`,
        `Path=/`,
        `Max-Age=${maxAge}`,
        `HttpOnly`,
        `SameSite=Lax`,
    ];
    // 仅在 https 下加 Secure（CF Pages 默认 https）
    attrs.push('Secure');
    return attrs.join('; ');
}

export function clearSessionCookie() {
    return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

/**
 * 读取并验证 session —— 刷新 lastSeenAt（节流：>5min 才写）
 */
export async function loadSession(env, request) {
    const sid = readSessionCookie(request);
    if (!sid) return null;
    const key = `s:${sid}`;
    const raw = await env.SESSIONS.get(key);
    if (!raw) return null;
    let record;
    try { record = JSON.parse(raw); } catch { return null; }
    // 滑窗：每 5 分钟最多写一次 lastSeen
    const now = Date.now();
    if (now - record.lastSeenAt > 5 * 60 * 1000) {
        record.lastSeenAt = now;
        await env.SESSIONS.put(key, JSON.stringify(record), {
            expirationTtl: SESSION_TTL_SECONDS,
        });
    }
    return record;
}

/**
 * 列出该 user 的所有 session
 */
export async function listSessions(env, userId) {
    const indexKey = `u:${userId}:sessions`;
    const ids = await env.SESSIONS.get(indexKey, { type: 'json' }) || [];
    const result = [];
    for (const sid of ids) {
        const raw = await env.SESSIONS.get(`s:${sid}`);
        if (!raw) continue;  // 已过期
        try {
            result.push(JSON.parse(raw));
        } catch { /* skip */ }
    }
    // 按 lastSeenAt 降序
    result.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    return result;
}

/**
 * 踢出指定 session（删除记录 + 索引中移除）
 */
export async function killSession(env, userId, sid) {
    await env.SESSIONS.delete(`s:${sid}`);
    const indexKey = `u:${userId}:sessions`;
    const ids = await env.SESSIONS.get(indexKey, { type: 'json' }) || [];
    const next = ids.filter(x => x !== sid);
    if (next.length === 0) {
        await env.SESSIONS.delete(indexKey);
    } else {
        await env.SESSIONS.put(indexKey, JSON.stringify(next), {
            expirationTtl: SESSION_TTL_SECONDS,
        });
    }
}

/**
 * 踢出除当前外的所有 session
 */
export async function killOtherSessions(env, userId, currentSid) {
    const sessions = await listSessions(env, userId);
    const killed = [];
    for (const s of sessions) {
        if (s.sid !== currentSid) {
            await killSession(env, userId, s.sid);
            killed.push(s);
        }
    }
    return killed;
}
