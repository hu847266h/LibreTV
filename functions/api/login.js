// functions/api/login.js
// POST /api/login
// Body: { password: string }
// 验证通过后写入 KV session 并 Set-Cookie

import { sha256 } from '../../js/sha256.js';
import {
    getUserId, newSessionId, createSession, loadSession,
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

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 });
    }
    const password = (body?.password || '').toString();

    // 1) 校验密码
    const expectedHash = await sha256(env.PASSWORD);
    const inputHash = await sha256(password);
    if (inputHash !== expectedHash) {
        await logEvent(env, {
            userId,
            request,
            event: 'login_failed',
            reason: 'bad_password',
        });
        return json({ success: false, error: '密码错误' }, { status: 401 });
    }

    // 2) 创建 session
    const sid = newSessionId();
    const setCookie = await createSession(env, request, sid, userId);

    // 3) 写审计日志（成功）
    await logEvent(env, {
        sessionId: sid,
        userId,
        request,
        event: 'login_success',
    });

    // 4) 返回 session 信息（不含密码）
    const session = await loadSession(env, request);  // 重新从 cookie 读取
    return json({
        success: true,
        session: {
            sid: session?.sid,
            ip: session?.ip,
            country: session?.country,
            createdAt: session?.createdAt,
            lastSeenAt: session?.lastSeenAt,
        },
    }, {
        status: 200,
        headers: { 'Set-Cookie': setCookie },
    });
}
