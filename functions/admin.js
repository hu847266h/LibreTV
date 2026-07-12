// functions/admin.js
// 路由 /admin → 输出 admin.html（带 PASSWORD 注入）
// 替代 _redirects 方案，确保 _middleware.js 能处理 PASSWORD 替换

import { sha256 } from '../js/sha256.js';

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 通过 ASSETS 拿到静态文件
    const assetUrl = new URL(url.origin);
    assetUrl.pathname = '/admin.html';
    const assetReq = new Request(assetUrl, request);
    const response = await env.ASSETS.fetch(assetReq);

    // 注入 PASSWORD（与 functions/_middleware.js 逻辑一致）
    const password = env.PASSWORD || '';
    let html = await response.text();
    let passwordHash = '';
    if (password) {
        passwordHash = await sha256(password);
    }
    html = html.replace(
        'window.__ENV__.PASSWORD = "{{PASSWORD}}";',
        `window.__ENV__.PASSWORD = "${passwordHash}";`
    );

    return new Response(html, {
        headers: {
            'content-type': 'text/html; charset=utf-8',
            ...Object.fromEntries(response.headers),
        },
        status: response.status,
    });
}
