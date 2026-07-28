/**
 * LibreTV WebDAV 云同步模块
 * 同步收藏列表和搜索历史到 WebDAV 服务器
 */
(function() {
    'use strict';

    const WDAV_CONFIG_KEY = 'webdav_config';
    const WDAV_SYNC_STATE = 'webdav_sync_state';
    const SYNC_DEBOUNCE_MS = 3000;

    // WebDAV 存储路径
    const FAVORITES_PATH = 'libretv/favorites.json';
    const HISTORY_PATH = 'libretv/history.json';

    // ====== 配置管理 ======

    function getConfig() {
        try {
            const raw = localStorage.getItem(WDAV_CONFIG_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveConfig(config) {
        localStorage.setItem(WDAV_CONFIG_KEY, JSON.stringify(config));
    }

    function isConfigured() {
        const cfg = getConfig();
        return cfg && cfg.url && cfg.username && cfg.password;
    }

    // ====== 同步状态 ======

    function getSyncState() {
        try {
            const raw = localStorage.getItem(WDAV_SYNC_STATE);
            return raw ? JSON.parse(raw) : { lastSync: 0, lastHash: null };
        } catch (e) {
            return { lastSync: 0, lastHash: null };
        }
    }

    function updateSyncState(hash) {
        const state = { lastSync: Date.now(), lastHash: hash };
        localStorage.setItem(WDAV_SYNC_STATE, JSON.stringify(state));
    }

    // ====== WebDAV 请求 ======

    function getAuthHeader() {
        const cfg = getConfig();
        if (!cfg) return null;
        const cred = btoa(unescape(encodeURIComponent(cfg.username + ':' + cfg.password)));
        return 'Basic ' + cred;
    }

    function buildUrl(path) {
        const cfg = getConfig();
        let base = cfg.url.replace(/\/$/, '');
        return base + '/' + path.replace(/^\//, '');
    }

    async function davRequest(method, path, body) {
        const auth = getAuthHeader();
        if (!auth) throw new Error('WebDAV 未配置');

        const headers = {
            'Authorization': auth,
            'Accept': '*/*',
        };

        if (body) {
            headers['Content-Type'] = 'application/json; charset=utf-8';
        }

        const resp = await fetch(buildUrl(path), {
            method: method,
            headers: headers,
            body: body || undefined,
        });

        if (!resp.ok) {
            if (resp.status === 401) throw new Error('WebDAV 认证失败，请检查用户名和密码');
            if (resp.status === 404) return null;
            throw new Error('WebDAV 请求失败: HTTP ' + resp.status);
        }

        return resp;
    }

    async function readFile(path) {
        const resp = await davRequest('GET', path);
        if (!resp) return null;
        return await resp.text();
    }

    async function writeFile(path, content) {
        await davRequest('PUT', path, content);
    }

    // 确保目录存在
    async function ensureDir(path) {
        const cfg = getConfig();
        const dirs = path.split('/').slice(0, -1);
        let currentPath = '';
        for (const dir of dirs) {
            currentPath += dir + '/';
            try {
                const resp = await fetch(buildUrl(currentPath), {
                    method: 'PROPFIND',
                    headers: {
                        'Authorization': getAuthHeader(),
                        'Depth': '0',
                    },
                });
                if (resp.status === 404) {
                    // 创建目录
                    await fetch(buildUrl(currentPath), {
                        method: 'MKCOL',
                        headers: {
                            'Authorization': getAuthHeader(),
                        },
                    });
                }
            } catch (e) {
                // 忽略，可能已存在
            }
        }
    }

    // ====== 简单哈希（用于变更检测） ======

    function simpleHash(data) {
        let hash = 0;
        const str = JSON.stringify(data);
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString(36);
    }

    // ====== 同步逻辑 ======

    /**
     * 上传数据到 WebDAV
     */
    async function uploadData(path, data) {
        if (!isConfigured()) return;
        try {
            await ensureDir(path);
            const json = JSON.stringify(data);
            await writeFile(path, json);

            const state = getSyncState();
            state[path] = simpleHash(data);
            updateSyncState(state);
            console.log('[WebDAV] 上传成功:', path, '(' + json.length + ' bytes)');
        } catch (e) {
            console.error('[WebDAV] 上传失败:', path, e.message);
        }
    }

    /**
     * 从 WebDAV 下载数据
     */
    async function downloadData(path) {
        if (!isConfigured()) return null;
        try {
            const text = await readFile(path);
            if (!text) return null;
            const data = JSON.parse(text);
            console.log('[WebDAV] 下载成功:', path, '(' + text.length + ' bytes)');
            return data;
        } catch (e) {
            console.error('[WebDAV] 下载失败:', path, e.message);
            return null;
        }
    }

    /**
     * 同步收藏数据到云端
     */
    async function syncFavoritesToCloud() {
        if (!isConfigured()) return;
        const favorites = getFavoritesData();
        if (!favorites) return;
        await uploadData(FAVORITES_PATH, favorites);
    }

    /**
     * 从云端拉取收藏数据
     */
    async function syncFavoritesFromCloud() {
        if (!isConfigured()) return null;
        const data = await downloadData(FAVORITES_PATH);
        return data;
    }

    /**
     * 同步搜索历史到云端
     */
    async function syncHistoryToCloud() {
        if (!isConfigured()) return;
        const history = getSearchHistoryData();
        if (!history) return;
        await uploadData(HISTORY_PATH, history);
    }

    /**
     * 从云端拉取搜索历史
     */
    async function syncHistoryFromCloud() {
        if (!isConfigured()) return null;
        const data = await downloadData(HISTORY_PATH);
        return data;
    }

    // ====== 数据读写代理 ======

    function getFavoritesData() {
        try {
            const raw = localStorage.getItem('favorites');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function setFavoritesData(data) {
        localStorage.setItem('favorites', JSON.stringify(data));
    }

    function getSearchHistoryData() {
        try {
            const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function setSearchHistoryData(data) {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(data));
    }

    function getViewingHistoryData() {
        try {
            const raw = localStorage.getItem('viewingHistory');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function setViewingHistoryData(data) {
        localStorage.setItem('viewingHistory', JSON.stringify(data));
    }

    // ====== 自动同步调度 ======

    let syncTimer = null;

    function scheduleSync() {
        if (!isConfigured()) return;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(async () => {
            await Promise.all([
                syncFavoritesToCloud(),
                syncHistoryToCloud(),
            ]);
            updateSyncStatusUI();
        }, SYNC_DEBOUNCE_MS);
    }

    /**
     * 完全同步：先拉取云端，再上传本地
     */
    async function fullSync() {
        if (!isConfigured()) {
            throw new Error('请先配置 WebDAV 连接');
        }

        showSyncStatus('sync', '正在同步...');

        try {
            // 1. 拉取云端数据
            const [cloudFavs, cloudHistory] = await Promise.all([
                syncFavoritesFromCloud(),
                syncHistoryFromCloud(),
            ]);

            // 2. 合并策略：云端优先（更新时间更新的保留）
            const state = getSyncState();
            const localFavs = getFavoritesData();
            const localHistory = getSearchHistoryData();

            // 收藏：云端覆盖本地（简单策略，云端=主副本）
            if (cloudFavs && Array.isArray(cloudFavs)) {
                setFavoritesData(cloudFavs);
                console.log('[WebDAV] 收藏已从云端恢复 (' + cloudFavs.length + ' 条)');
            }

            // 搜索历史：合并去重
            if (cloudHistory && Array.isArray(cloudHistory)) {
                const merged = mergeHistory(localHistory, cloudHistory);
                setSearchHistoryData(merged);
                console.log('[WebDAV] 历史已从云端恢复 (' + merged.length + ' 条)');
            }

            // 3. 重新上传合并后的数据
            await Promise.all([
                syncFavoritesToCloud(),
                syncHistoryToCloud(),
            ]);

            updateSyncState({ lastSync: Date.now() });

            // 4. 刷新 UI
            if (typeof refreshAllFavoriteButtons === 'function') refreshAllFavoriteButtons();
            if (typeof refreshPanelContent === 'function') refreshPanelContent();
            if (typeof renderSearchHistory === 'function') renderSearchHistory();

            showSyncStatus('success', '同步完成 ' + formatTime(new Date()));
        } catch (e) {
            showSyncStatus('error', '同步失败: ' + e.message);
            throw e;
        }
    }

    function mergeHistory(local, cloud) {
        const map = new Map();
        // 云端优先
        for (const item of cloud) {
            map.set(item.query, item);
        }
        for (const item of local) {
            if (!map.has(item.query)) {
                map.set(item.query, item);
            }
        }
        return Array.from(map.values())
            .sort((a, b) => (b.time || 0) - (a.time || 0))
            .slice(0, 50);
    }

    // ====== 同步状态 UI ======

    function showSyncStatus(type, msg) {
        const el = document.getElementById('webdavSyncStatus');
        if (!el) return;
        const icons = { sync: '\u{1F504}', success: '\u2705', error: '\u274C', idle: '\u2601\uFE0F' };
        el.innerHTML = '<span class="text-xs">' + (icons[type] || '') + ' ' + msg + '</span>';
        el.className = 'text-xs ' + (type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : 'text-blue-400');
    }

    function updateSyncStatusUI() {
        if (!isConfigured()) {
            showSyncStatus('idle', '未配置');
            return;
        }
        const state = getSyncState();
        if (state.lastSync > 0) {
            showSyncStatus('success', '上次: ' + formatTime(new Date(state.lastSync)));
        } else {
            showSyncStatus('idle', '已配置，待同步');
        }
    }

    function formatTime(date) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
    }

    // ====== 测试连接 ======

    async function testConnection() {
        const cfg = getConfig();
        if (!cfg || !cfg.url) {
            throw new Error('请先填写 WebDAV 地址');
        }

        try {
            const resp = await fetch(buildUrl(''), {
                method: 'OPTIONS',
                headers: { 'Authorization': getAuthHeader() },
            });
            // 即使 405 也算连通（OPTIONS 不被允许但服务器可达）
            if (resp.status === 401) throw new Error('用户名或密码错误');
            return true;
        } catch (e) {
            if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
                throw new Error('无法连接到服务器，请检查地址');
            }
            throw e;
        }
    }

    // ====== Hook 本地操作 ======

    function hookLocalStorage() {
        const origSetItem = Storage.prototype.setItem;
        const self = this;

        Storage.prototype.setItem = function(key, value) {
            const result = origSetItem.call(this, key, value);

            // 收藏变更 → 触发同步
            if (key === 'favorites') {
                scheduleSync();
            }
            // 搜索历史变更 → 触发同步
            if (key === SEARCH_HISTORY_KEY) {
                scheduleSync();
            }

            return result;
        };
    }

    // ====== 导出到 window ======

    window.WebDAVSync = {
        isConfigured,
        getConfig,
        saveConfig,
        testConnection,
        fullSync,
        syncFavoritesToCloud,
        syncFavoritesFromCloud,
        syncHistoryToCloud,
        syncHistoryFromCloud,
        scheduleSync,
        updateSyncStatusUI,
        showSyncStatus,
    };

    // ====== 初始化 ======

    function init() {
        hookLocalStorage();

        // 启动时更新状态 UI
        setTimeout(updateSyncStatusUI, 500);
        setTimeout(renderWebDAVSettings, 1000);

        // 页面加载后，如果已配置则自动拉取一次
        setTimeout(async () => {
            if (isConfigured()) {
                try {
                    await fullSync();
                } catch (e) {
                    console.warn('[WebDAV] 自动同步失败:', e.message);
                }
            }
        }, 2000);
    }

    /**
     * 渲染 WebDAV 设置 UI
     */
    function renderWebDAVSettings() {
        const container = document.getElementById('webdavSettingsArea');
        if (!container) return;

        const cfg = getConfig();
        const configured = isConfigured();

        container.innerHTML = ''
            + '<label class="block text-sm font-medium text-gray-400 mb-3 border-b border-[#333] pb-1">'
            +   '\u2601\uFE0F WebDAV 云同步'
            + '</label>'

            // 配置表单
            + '<div id="webdavForm" class="' + (configured ? 'hidden' : '') + '">'
            +   '<input type="url" id="webdavUrl" placeholder="https://dav.example.com/remote.php/dav/files/user/"'
            +     ' class="w-full bg-[#222] border border-[#333] text-white px-3 py-2 rounded mb-2 text-sm"'
            +     ' value="' + (cfg ? cfg.url : 'https://merry.us.ci/dav/douyin') + '" autocomplete="off">'
            +   '<input type="text" id="webdavUsername" placeholder="用户名"'
            +     ' class="w-full bg-[#222] border border-[#333] text-white px-3 py-2 rounded mb-2 text-sm"'
            +     ' value="' + (cfg ? cfg.username : 'admin') + '" autocomplete="off">'
            +   '<input type="password" id="webdavPassword" placeholder="密码"'
            +     ' class="w-full bg-[#222] border border-[#333] text-white px-3 py-2 rounded mb-3 text-sm"'
            +     ' autocomplete="new-password">'
            +   '<div class="flex space-x-2">'
            +     '<button onclick="WebDAVSync.saveAndTest()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs transition-colors">'
            +       '\u{1F50D} 保存并测试'
            +     '</button>'
            +   '</div>'
            + '</div>'

            // 已配置状态
            + '<div id="webdavConfigured" class="' + (configured ? '' : 'hidden') + '">'
            +   '<div class="text-xs text-gray-400 mb-2">'
            +     '\u2705 已连接到 <span class="text-white">' + (cfg ? new URL(cfg.url).hostname : '') + '</span>'
            +   '</div>'
            +   '<div id="webdavSyncStatus" class="mb-2"></div>'
            +   '<div class="flex space-x-2">'
            +     '<button onclick="WebDAVSync.manualSync()" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs transition-colors">'
            +       '\u{1F504} 立即同步'
            +     '</button>'
            +     '<button onclick="WebDAVSync.disconnect()" class="px-3 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded text-xs transition-colors">'
            +       '\u{1F6AB} 断开'
            +     '</button>'
            +   '</div>'
            + '</div>';
    }

    // ====== 用户操作 ======

    window.WebDAVSync.saveAndTest = async function() {
        const url = document.getElementById('webdavUrl').value.trim();
        const username = document.getElementById('webdavUsername').value.trim();
        const password = document.getElementById('webdavPassword').value;

        if (!url || !username || !password) {
            showSyncStatus('error', '请填写完整信息');
            return;
        }

        saveConfig({ url, username, password });
        renderWebDAVSettings();
        updateSyncStatusUI();

        showSyncStatus('sync', '正在测试连接...');
        try {
            await testConnection();
            showSyncStatus('success', '连接成功！正在同步...');
            await fullSync();
        } catch (e) {
            showSyncStatus('error', e.message);
        }
    };

    window.WebDAVSync.manualSync = async function() {
        showSyncStatus('sync', '正在同步...');
        try {
            await fullSync();
        } catch (e) {
            showSyncStatus('error', e.message);
        }
    };

    window.WebDAVSync.disconnect = function() {
        localStorage.removeItem(WDAV_CONFIG_KEY);
        localStorage.removeItem(WDAV_SYNC_STATE);
        renderWebDAVSettings();
        updateSyncStatusUI();
        showSyncStatus('idle', '已断开连接');
    };

    init();
})();
