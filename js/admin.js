// js/admin.js
// 管理页面：会话列表 + 登录历史

// ---------- 工具函数 ----------

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

const EVENT_LABELS = {
    login_success: '登录成功',
    login_failed: '登录失败',
    kicked: '已被踢出',
    expired: '会话过期',
};

function eventLabel(e) {
    return EVENT_LABELS[e] || e;
}

function deviceIcon(deviceType) {
    const icons = {
        mobile: '📱',
        tablet: '📟',
        desktop: '💻',
        bot: '🤖',
    };
    return icons[deviceType] || '💻';
}

function flagEmoji(country) {
    if (!country || country.length !== 2) return '🌍';
    const codePoints = country.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
    return String.fromCodePoint(...codePoints);
}

function shortUa(ua) {
    if (!ua) return '-';
    // 截取前 40 字符
    return ua.length > 40 ? ua.slice(0, 40) + '…' : ua;
}

function showToast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast-${type} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
}

function showLoading(el, loading = true) {
    if (loading) {
        el.innerHTML = '<div class="loading-spinner"></div><span class="ml-2">加载中…</span>';
    } else {
        el.innerHTML = '';
    }
}

// ---------- 会话管理 ----------

async function loadSessions() {
    const listEl = document.getElementById('sessionList');
    const countEl = document.getElementById('sessionCount');
    const kickAllBtn = document.getElementById('kickAllOthersBtn');

    showLoading(listEl, true);
    try {
        const data = await checkSession();
        if (!data) {
            listEl.innerHTML = '<div class="text-center text-red-400 py-8">❌ 未登录，请先访问主页验证密码</div>';
            return;
        }

        const sessions = data.sessions || [];
        countEl.textContent = `${sessions.length} 个活跃设备`;
        kickAllBtn.style.display = sessions.length > 1 ? 'inline-flex' : 'none';

        if (sessions.length === 0) {
            listEl.innerHTML = '<div class="text-center text-gray-500 py-8">暂无活跃会话</div>';
            return;
        }

        let html = '';
        for (const s of sessions) {
            const { deviceType = 'desktop', os = '', browser = '' } = parseUaString(s.ua);
            const isCurrent = s.isCurrent;
            html += `
                <div class="session-card${isCurrent ? ' session-current' : ''}">
                    <div class="session-header">
                        <div class="session-device">
                            ${deviceIcon(deviceType)}
                            <span class="font-medium">${escapeHtml(deviceType)}</span>
                            ${isCurrent ? '<span class="current-badge">当前设备</span>' : ''}
                        </div>
                        <div class="session-actions">
                            ${isCurrent ? `
                                <button onclick="logoutCurrent()" class="btn-danger-outline btn-sm">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                                    登出
                                </button>
                            ` : `
                                <button onclick="kickOne('${s.sid}')" class="btn-danger-outline btn-sm">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                    踢出
                                </button>
                            `}
                        </div>
                    </div>
                    <div class="session-details">
                        <div class="detail-row">
                            <span class="detail-label">IP</span>
                            <span>${flagEmoji(s.country)} ${escapeHtml(s.ip)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">系统</span>
                            <span>${escapeHtml(os)} ${escapeHtml(browser)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">UA</span>
                            <span class="text-xs text-gray-500">${escapeHtml(shortUa(s.ua))}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">登录时间</span>
                            <span>${formatTime(s.createdAt)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">最后活跃</span>
                            <span>${formatTime(s.lastSeenAt)}</span>
                        </div>
                    </div>
                </div>`;
        }
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = `<div class="text-center text-red-400 py-8">❌ 加载失败: ${escapeHtml(e.message)}</div>`;
    }
}

async function kickOne(sid) {
    if (!confirm('确定踢出该设备？')) return;
    try {
        await kickSession(sid);
        showToast('已踢出该设备', 'success');
        loadSessions();
    } catch (e) {
        showToast(`操作失败: ${e.message}`, 'error');
    }
}

async function kickAllOthers() {
    if (!confirm('确定踢出所有其他设备？这将使其他会话立即过期。')) return;
    try {
        const data = await kickOtherSessions();
        showToast(`已踢出 ${data.kicked} 个设备`, 'success');
        loadSessions();
    } catch (e) {
        showToast(`操作失败: ${e.message}`, 'error');
    }
}

async function logoutCurrent() {
    if (!confirm('确定退出登录？')) return;
    try {
        await logoutSession();
        showToast('已登出，请刷新页面', 'success');
        setTimeout(() => location.href = '/', 1500);
    } catch (e) {
        showToast(`操作失败: ${e.message}`, 'error');
    }
}

// ---------- 登录历史 ----------

async function loadHistory() {
    const listEl = document.getElementById('historyList');
    showLoading(listEl, true);
    try {
        const rows = await getLoginHistory(200);
        if (!rows || rows.length === 0) {
            listEl.innerHTML = '<div class="text-center text-gray-500 py-8">暂无登录记录</div>';
            return;
        }
        let html = '';
        for (const r of rows) {
            const { deviceType = '', os = '', browser = '' } = parseUaString(r.user_agent);
            const flag = r.country ? flagEmoji(r.country) : '🌍';
            html += `
                <div class="history-row">
                    <div class="history-icon">${deviceIcon(deviceType)}</div>
                    <div class="history-main">
                        <div class="history-event">${eventLabel(r.event)}${r.reason ? ` <span class="text-xs text-gray-500">(${r.reason})</span>` : ''}</div>
                        <div class="history-meta">${flag} ${escapeHtml(r.ip)} · ${escapeHtml(os)} ${escapeHtml(browser)} · ${escapeHtml(shortUa(r.user_agent))}</div>
                    </div>
                    <div class="history-time">${formatTime(r.created_at)}</div>
                </div>`;
        }
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = `<div class="text-center text-red-400 py-8">❌ 加载失败: ${escapeHtml(e.message)}</div>`;
    }
}

/**
 * 解析 UA 字符串（前端简化版，与后端 UA.js 一致）
 */
function parseUaString(ua) {
    if (!ua) return { deviceType: 'desktop', os: 'Unknown', browser: 'Unknown' };
    let deviceType = 'desktop';
    if (/bot|crawler|spider|slurp/i.test(ua)) deviceType = 'bot';
    else if (/ipad|tablet|playbook|silk/i.test(ua)) deviceType = 'tablet';
    else if (/mobi|iphone|ipod|android.*mobile|blackberry|opera mini/i.test(ua)) deviceType = 'mobile';
    let os = 'Unknown';
    if (/Windows NT ([\d.]+)/i.test(ua)) os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/iPhone OS|iPad.*OS/i.test(ua)) os = 'iOS';
    else if (/Android ([\d.]+)/i.test(ua)) os = 'Android';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/CrOS/i.test(ua)) os = 'Chrome OS';
    let browser = 'Unknown';
    if (/Edg\/([\d.]+)/i.test(ua)) browser = 'Edge';
    else if (/OPR\/([\d.]+)|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome\/([\d.]+)/i.test(ua) && !/Edg|OPR/i.test(ua)) browser = 'Chrome';
    else if (/Safari\/([\d.]+)/i.test(ua) && !/Chrome|Edg|OPR/i.test(ua)) browser = 'Safari';
    else if (/Firefox\/([\d.]+)/i.test(ua)) browser = 'Firefox';
    return { deviceType, os, browser };
}

// ---------- 初始化 ----------

document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    loadHistory();
    document.getElementById('refreshSessionsBtn')?.addEventListener('click', loadSessions);
    document.getElementById('refreshHistoryBtn')?.addEventListener('click', loadHistory);
    document.getElementById('kickAllOthersBtn')?.addEventListener('click', kickAllOthers);
});
