// functions/api/history.js
// GET /api/history?limit=100
// 返回该 user 的登录历史

import { getUserId, loadSession } from '../_utils/session.js';
import { listHistory } from '../_utils/audit.js';
import { json, requireMethod, handleOptions } from '../_utils/cors.js';

export async function onRequest(context) {
    const { request, env } = context;
    if (request.method === 'OPTIONS') return handleOptions();
    const methodErr = requireMethod(request, 'GET');
    if (methodErr) return methodErr;

    const userId = await getUserId(env);
    if (!userId) {
        return json({ success: false, error: '服务器未配置 PASSWORD' }, { status: 500 });
    }
    const session = await loadSession(env, request);
    if (!session || session.uid !== userId) {
        return json({ success: false, error: '未登录或会话已过期' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const rows = await listHistory(env, userId, limit);
    return json({ success: true, history: rows });
}
