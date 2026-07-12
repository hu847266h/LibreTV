// functions/_utils/cors.js
// CORS 工具 + 统一 JSON 响应

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

export function json(data, init = {}) {
    const headers = new Headers(init.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { ...init, headers });
}

export function handleOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function requireMethod(request, method) {
    if (request.method === 'OPTIONS') return handleOptions();
    if (request.method !== method) {
        return json({ success: false, error: `Method ${request.method} not allowed` }, { status: 405 });
    }
    return null;
}
