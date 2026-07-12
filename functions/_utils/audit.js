// functions/_utils/audit.js
// 审计日志：写入 D1 login_history 表

import { parseUserAgent } from './ua.js';

const MAX_UA_LEN = 500;

/**
 * 写入一条登录/审计事件
 */
export async function logEvent(env, params) {
    const {
        sessionId = null,
        userId,
        request,
        event,        // login_success | login_failed | kicked | expired
        reason = null,
    } = params;

    if (!userId || !event) return;

    const uaHeader = request.headers.get('User-Agent') || '';
    const ua = uaHeader.slice(0, MAX_UA_LEN);
    const { deviceType, os, browser } = parseUserAgent(ua);

    const ip = request.headers.get('CF-Connecting-IP')
            || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
            || '0.0.0.0';
    const country = request.headers.get('CF-IPCountry') || '';
    // region/city 暂不接入第三方（避免外部依赖 + 限流）

    try {
        await env.DB.prepare(
            `INSERT INTO login_history
                (session_id, user_id, ip, country, region, city,
                 device_type, os, browser, user_agent, event, reason, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            sessionId,
            userId,
            ip,
            country,
            '',
            '',
            deviceType,
            os,
            browser,
            ua,
            event,
            reason,
            Date.now()
        ).run();
    } catch (e) {
        // 审计写失败不应影响主流程
        console.error('audit log failed:', e?.message || e);
    }
}

/**
 * 读取该 user 的登录历史（按时间倒序）
 */
export async function listHistory(env, userId, limit = 100) {
    if (!userId) return [];
    const { results } = await env.DB.prepare(
        `SELECT id, session_id, ip, country, device_type, os, browser, user_agent,
                event, reason, created_at
         FROM login_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
    ).bind(userId, Math.min(limit, 500)).all();
    return results || [];
}
