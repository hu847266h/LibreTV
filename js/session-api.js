// js/session-api.js
// 前端会话管理 API 客户端

async function api(path, options = {}) {
    const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    const data = await res.json().catch(() => ({ success: false, error: '响应不是合法 JSON' }));
    if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

/**
 * 获取当前会话信息
 */
async function checkSession() {
    try {
        const data = await api('/api/sessions');
        return data.success ? data : null;
    } catch {
        return null;
    }
}

/**
 * 获取登录历史
 */
async function getLoginHistory(limit = 100) {
    const data = await api(`/api/history?limit=${limit}`);
    return data.success ? data.history : [];
}

/**
 * 踢出指定设备
 */
async function kickSession(sid) {
    return api(`/api/sessions?sid=${encodeURIComponent(sid)}`, { method: 'DELETE' });
}

/**
 * 踢出所有其他设备（不包括当前）
 */
async function kickOtherSessions() {
    return api('/api/kick-others', { method: 'POST' });
}

/**
 * 登出当前设备
 */
async function logoutSession() {
    return api('/api/logout', { method: 'POST' });
}
