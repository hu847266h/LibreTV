// functions/api/logout.js
// POST /api/logout
// 销毁当前 session 并清 cookie

import {
    getUserId, readSessionCookie, killSession, clearSessionCookie,
} from '../_utils/session.js';
import { logEvent } from '../_utils/audit.js';
import { json, requireMethod } from '../_utils/cors.js';

export async function onRequest(context) {
    const { request, env } = context;

    const methodErr = requireMethod(request, 'POST');
    if (methodErr) return methodErr;

    const userId = await getUserId(env);
    if (!userId) {
        return json({ success: false, error: '服务器未配置 PASSWORD' }, { status: 500 });
    }

    const sid = readSessionCookie(request);
    if (sid) {
        await killSession(env, userId, sid);
        await logEvent(env, {
            sessionId: sid,
            userId,
            request,
            event: 'kicked',
            reason: 'self_logout',
        });
    }

    return json({ success: true }, {
        status: 200,
        headers: { 'Set-Cookie': clearSessionCookie() },
    });
}
