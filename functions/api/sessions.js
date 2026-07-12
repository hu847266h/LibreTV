// functions/api/sessions.js
// GET    /api/sessions              -> 列出当前 user 所有活跃 session
// DELETE /api/sessions?sid=xxx      -> 踢出指定 session
// POST   /api/sessions/kick-others  -> 踢出除当前外的所有 session

import {
    getUserId, readSessionCookie, loadSession,
    listSessions, killSession, killOtherSessions,
} from '../_utils/session.js';
import { logEvent } from '../_utils/audit.js';
import { json, requireMethod, handleOptions } from '../_utils/cors.js';

async function requireAuth(request, env) {
    const userId = await getUserId(env);
    if (!userId) {
        return { error: json({ success: false, error: '服务器未配置 PASSWORD' }, { status: 500 }) };
    }
    const session = await loadSession(env, request);
    if (!session || session.uid !== userId) {
        return { error: json({ success: false, error: '未登录或会话已过期' }, { status: 401 }) };
    }
    return { userId, session };
}

export async function onRequest(context) {
    const { request, env, params } = context;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return handleOptions();

    const auth = await requireAuth(request, env);
    if (auth.error) return auth.error;
    const { userId, session: current } = auth;

    // POST /api/sessions/kick-others
    if (request.method === 'POST' && url.pathname.endsWith('/kick-others')) {
        const killed = await killOtherSessions(env, userId, current.sid);
        for (const s of killed) {
            await logEvent(env, {
                sessionId: s.sid,
                userId,
                request,
                event: 'kicked',
                reason: 'kicked_by_other_session',
            });
        }
        return json({ success: true, kicked: killed.length });
    }

    // DELETE /api/sessions?sid=xxx
    if (request.method === 'DELETE') {
        const target = url.searchParams.get('sid');
        if (!target) {
            return json({ success: false, error: '缺少 sid 参数' }, { status: 400 });
        }
        if (target === current.sid) {
            return json({ success: false, error: '不能踢出当前会话，请使用 /api/logout' }, { status: 400 });
        }
        await killSession(env, userId, target);
        await logEvent(env, {
            sessionId: target,
            userId,
            request,
            event: 'kicked',
            reason: 'manual_kick',
        });
        return json({ success: true });
    }

    // GET /api/sessions
    if (request.method !== 'GET') {
        return json({ success: false, error: `Method ${request.method} not allowed` }, { status: 405 });
    }
    const all = await listSessions(env, userId);
    return json({
        success: true,
        currentSid: current.sid,
        sessions: all.map(s => ({
            sid: s.sid,
            ip: s.ip,
            country: s.country,
            ua: s.ua,
            createdAt: s.createdAt,
            lastSeenAt: s.lastSeenAt,
            isCurrent: s.sid === current.sid,
        })),
    });
}
