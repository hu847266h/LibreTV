// functions/api/kick-others.js
// POST /api/kick-others
// 独立路由：URL 不便在 /api/sessions 下做 POST，单独一个文件

import {
    getUserId, loadSession, killOtherSessions,
} from '../_utils/session.js';
import { logEvent } from '../_utils/audit.js';
import { json, requireMethod, handleOptions } from '../_utils/cors.js';

export async function onRequest(context) {
    const { request, env } = context;
    if (request.method === 'OPTIONS') return handleOptions();
    const methodErr = requireMethod(request, 'POST');
    if (methodErr) return methodErr;

    const userId = await getUserId(env);
    if (!userId) {
        return json({ success: false, error: '服务器未配置 PASSWORD' }, { status: 500 });
    }
    const session = await loadSession(env, request);
    if (!session || session.uid !== userId) {
        return json({ success: false, error: '未登录或会话已过期' }, { status: 401 });
    }

    const killed = await killOtherSessions(env, userId, session.sid);
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
