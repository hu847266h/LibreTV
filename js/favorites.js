// LibreTV 收藏功能
const FAVORITES_KEY = 'favorites';

// ==== 核心数据操作 ====

function getFavorites() {
    try {
        const data = localStorage.getItem(FAVORITES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('获取收藏失败:', e);
        return [];
    }
}

function saveFavorites(favorites) {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
        console.error('保存收藏失败:', e);
        showToast('存储空间不足，请清理一些收藏', 'error');
    }
}

function isFavorited(vodId, sourceCode) {
    const favorites = getFavorites();
    return favorites.some(f => f.vod_id === vodId && f.source_code === sourceCode);
}

function addFavorite(item) {
    const favorites = getFavorites();
    if (favorites.some(f => f.vod_id === item.vod_id && f.source_code === item.source_code)) {
        return false;
    }
    favorites.unshift({
        vod_id: item.vod_id || '',
        vod_name: item.vod_name || '',
        vod_pic: item.vod_pic || '',
        type_name: item.type_name || '',
        vod_year: item.vod_year || '',
        vod_remarks: item.vod_remarks || '',
        source_name: item.source_name || '',
        source_code: item.source_code || '',
        api_url: item.api_url || '',
        addedAt: Date.now()
    });
    if (favorites.length > 500) { favorites.length = 500; }
    saveFavorites(favorites);
    return true;
}

function removeFavorite(vodId, sourceCode) {
    let favorites = getFavorites();
    favorites = favorites.filter(f => !(f.vod_id === vodId && f.source_code === sourceCode));
    saveFavorites(favorites);
}

function toggleFavorite(item, event) {
    if (event) event.stopPropagation();
    if (isFavorited(item.vod_id, item.source_code)) {
        removeFavorite(item.vod_id, item.source_code);
        showToast('已取消收藏', 'info');
    } else {
        addFavorite(item);
        showToast('已添加收藏', 'success');
    }
    refreshAllFavoriteButtons();
    refreshPanelContent();
}

// ==== 按钮刷新 ====

function refreshAllFavoriteButtons() {
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const vodId = btn.getAttribute('data-vod-id');
        const sourceCode = btn.getAttribute('data-source-code');
        if (isFavorited(vodId, sourceCode)) {
            btn.classList.add('favorited');
            btn.innerHTML = '\u2764\ufe0f'; // ❤️
        } else {
            btn.classList.remove('favorited');
            btn.innerHTML = '\u{1F90D}'; // 🤍
        }
    });
}

// ==== 收藏按钮 HTML 生成 ====

function getFavoriteButtonHtml(item) {
    const vodId = (item.vod_id || '').replace(/"/g, '&quot;');
    const sourceCode = (item.source_code || '').replace(/"/g, '&quot;');
    const isFav = isFavorited(item.vod_id, item.source_code);
    const heartIcon = isFav ? '\u2764\ufe0f' : '\u{1F90D}';
    const favClass = isFav ? 'favorited' : '';
    const esc = s => (s || '').replace(/"/g, '&quot;');
    return '<button class="fav-btn ' + favClass + ' text-sm leading-none hover:scale-125 transition-transform p-1"' +
        ' data-vod-id="' + vodId + '" data-source-code="' + sourceCode + '"' +
        ' data-vod-name="' + esc(item.vod_name) + '"' +
        ' data-vod-pic="' + esc(item.vod_pic) + '"' +
        ' data-type-name="' + esc(item.type_name) + '"' +
        ' data-vod-year="' + esc(item.vod_year) + '"' +
        ' data-vod-remarks="' + esc(item.vod_remarks) + '"' +
        ' data-source-name="' + esc(item.source_name) + '"' +
        ' data-api-url="' + esc(item.api_url) + '"' +
        ' title="' + (isFav ? '取消收藏' : '添加收藏') + '">' + heartIcon + '</button>';
}

// ==== 面板切换 ====

function toggleFavorites(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('historyPanel');
    if (!panel) return;

    const isShowingFav = panel.getAttribute('data-tab') === 'favorites' && panel.classList.contains('show');

    if (isShowingFav) {
        panel.classList.remove('show');
        panel.setAttribute('aria-hidden', 'true');
        return;
    }

    panel.setAttribute('data-tab', 'favorites');
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');

    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel && settingsPanel.classList.contains('show')) {
        settingsPanel.classList.remove('show');
    }

    buildPanelStructure();
    renderFavoritesContent();
}

// ==== 统一面板结构 ====

function buildPanelStructure() {
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    const currentTab = panel.getAttribute('data-tab') || 'history';

    panel.innerHTML = ''
        + '<div class="flex justify-between items-center mb-6">'
        +   '<button onclick="closeHistoryPanel()" class="close-btn">'
        +     '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">'
        +       '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
        +     '</svg>'
        +   '</button>'
        +   '<div class="flex bg-[#1a1a1a] rounded-lg p-1">'
        +     '<button onclick="switchPanelTab(\'history\')" class="panel-tab px-3 py-1 rounded-md text-sm transition-colors '
        +       (currentTab === 'history' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white') + '">\u{1F4FA} \u5386\u53F2</button>'
        +     '<button onclick="switchPanelTab(\'favorites\')" class="panel-tab px-3 py-1 rounded-md text-sm transition-colors '
        +       (currentTab === 'favorites' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white') + '">\u2764\ufe0f \u6536\u85CF</button>'
        +   '</div>'
        +   '<div class="w-4"></div>'
        + '</div>'
        + '<div id="panelContent" class="pb-4 overflow-y-auto" style="max-height: calc(100vh - 200px);"></div>'
        + '<div id="panelAction" class="mt-4 text-center sticky bottom-0 pb-2 pt-2 bg-[#111]"></div>';
}

function switchPanelTab(tab) {
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    panel.setAttribute('data-tab', tab);
    buildPanelStructure();
    if (tab === 'history') {
        loadViewingHistoryContent();
    } else {
        renderFavoritesContent();
    }
}

function closeHistoryPanel() {
    const panel = document.getElementById('historyPanel');
    if (panel) {
        panel.classList.remove('show');
        panel.setAttribute('aria-hidden', 'true');
    }
}

function refreshPanelContent() {
    const panel = document.getElementById('historyPanel');
    if (!panel || !panel.classList.contains('show')) return;
    const tab = panel.getAttribute('data-tab') || 'history';
    if (tab === 'favorites') {
        buildPanelStructure();
        renderFavoritesContent();
    }
}

// ==== 收藏面板内容渲染 ====

function renderFavoritesContent() {
    const contentEl = document.getElementById('panelContent');
    const actionEl = document.getElementById('panelAction');
    if (!contentEl) return;

    const favorites = getFavorites();

    if (favorites.length === 0) {
        contentEl.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-gray-500">'
            + '<svg class="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">'
            + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />'
            + '</svg><p class="text-sm">还没有收藏任何视频</p>'
            + '<p class="text-xs mt-1 text-gray-600">在搜索结果中点击 \u{1F90D} 即可收藏</p></div>';
        if (actionEl) actionEl.innerHTML = '';
        return;
    }

    const itemsHtml = favorites.map(item => {
        const esc = s => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeName = esc(item.vod_name);
        const safeSource = esc(item.source_name);
        const safeType = esc(item.type_name);
        const safeCode = (item.source_code || '').replace(/"/g, '\\"');
        const safeId = (item.vod_id || '').replace(/[^\w-]/g, '');
        const apiUrlAttr = item.api_url ? ' data-api-url="' + esc(item.api_url) + '"' : '';
        const addTime = formatTimestamp(item.addedAt);
        return '<div class="flex items-center gap-3 p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#222] transition-colors cursor-pointer group"'
            + ' onclick="(function(){var si=\'' + safeId + '\';var sc=\'' + safeCode + '\';if(sc===\'douban\')fillAndSearchWithDouban(\'' + safeName + '\');else showDetails(si,\'' + safeName + '\',sc);})()"' + apiUrlAttr + '>'
            + (item.vod_pic ? '<div class="flex-shrink-0 w-12 h-16 rounded overflow-hidden bg-[#111]">'
                + '<img src="' + item.vod_pic + '" alt="' + safeName + '" class="w-full h-full object-cover" loading="lazy"'
                + ' onerror="this.onerror=null; this.style.display=\'none\';">'
                + '</div>' : '')
            + '<div class="flex-1 min-w-0">'
            + '<h4 class="text-sm font-medium text-white truncate" title="' + safeName + '">' + safeName + '</h4>'
            + '<div class="flex items-center gap-2 mt-1">'
            + (safeType ? '<span class="text-xs text-blue-400">' + safeType + '</span>' : '')
            + '<span class="text-xs text-gray-500">' + safeSource + '</span></div>'
            + '<p class="text-xs text-gray-600 mt-1">' + addTime + '</p></div>'
            + '<button onclick="event.stopPropagation(); removeFavoriteItem(\'' + safeId + '\',\'' + safeCode + '\')"'
            + ' class="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="取消收藏">'
            + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">'
            + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
            + '</svg></button></div>';
    }).join('');

    contentEl.innerHTML = '<div class="space-y-2">' + itemsHtml + '</div>';
    if (actionEl) {
        actionEl.innerHTML = '<p class="text-xs text-gray-500 mb-2">共 ' + favorites.length + ' 个收藏</p>'
            + '<button onclick="clearAllFavorites()" class="px-4 py-2 w-full bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 hover:from-red-600 hover:via-pink-600 hover:to-rose-600 text-white rounded-lg text-sm transition-all duration-300 shadow-md hover:shadow-lg">清空收藏</button>';
    }
}

function removeFavoriteItem(vodId, sourceCode) {
    removeFavorite(vodId, sourceCode);
    refreshAllFavoriteButtons();
    renderFavoritesContent();
    showToast('已取消收藏', 'info');
}

function clearAllFavorites() {
    if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
        localStorage.removeItem(FAVORITES_KEY);
        refreshAllFavoriteButtons();
        renderFavoritesContent();
        showToast('收藏已全部清空', 'success');
    }
}

// ==== 观看历史面板内容渲染（覆盖原 loadViewingHistory） ====

function loadViewingHistoryContent() {
    const panel = document.getElementById('historyPanel');
    if (!panel || panel.getAttribute('data-tab') !== 'history') return;
    buildPanelStructure();

    const contentEl = document.getElementById('panelContent');
    const actionEl = document.getElementById('panelAction');
    if (!contentEl) return;

    const history = getViewingHistory();

    if (history.length === 0) {
        contentEl.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-gray-500">'
            + '<svg class="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">'
            + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
            + '</svg><p class="text-sm">暂无观看记录</p></div>';
        if (actionEl) actionEl.innerHTML = '';
        return;
    }

    const itemsHtml = history.map(item => {
        const esc = s => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeTitle = esc(item.title);
        const safeSource = esc(item.sourceName || '未知来源');
        const episodeText = item.episodeIndex !== undefined ? '第' + (item.episodeIndex + 1) + '集' : '';
        const timeStr = formatTimestamp(item.timestamp);

        return '<div class="mb-3 p-3 bg-[#1a1a1a] rounded-lg hover:bg-[#222] cursor-pointer transition-colors"'
            + ' onclick="navigateToWatch(\'' + esc(item.id || '') + '\', \'' + esc(item.source || '') + '\', \'' + esc(item.title || '') + '\', ' + (item.episodeIndex || 0) + ')"'
            + (item.apiUrl ? ' data-api-url="' + esc(item.apiUrl) + '"' : '') + '>'
            + '<div class="flex justify-between items-start mb-2">'
            + '<div class="flex-1 min-w-0"><h4 class="text-sm font-medium text-white truncate">' + safeTitle + '</h4>'
            + '<div class="flex items-center gap-2 mt-1">'
            + '<span class="text-xs text-gray-500">' + safeSource + '</span>'
            + (episodeText ? '<span class="text-xs text-blue-400">' + episodeText + '</span>' : '')
            + '</div></div>'
            + '<button onclick="event.stopPropagation(); deleteSingleHistoryItem(\'' + esc(item.id || '') + '\', \'' + esc(item.source || '') + '\')"'
            + ' class="p-1 text-gray-600 hover:text-red-400 ml-2 flex-shrink-0" title="删除此记录">'
            + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">'
            + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>'
            + '<p class="text-xs text-gray-600">' + timeStr + '</p></div>';
    }).join('');

    contentEl.innerHTML = itemsHtml;

    if (actionEl) {
        actionEl.innerHTML = '<p class="text-xs text-gray-500 mb-2">共 ' + history.length + ' 条记录</p>'
            + '<button onclick="clearViewingHistory()" class="px-4 py-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-lg text-sm transition-all duration-300 shadow-md hover:shadow-lg">清空历史记录</button>';
    }
}

// 删除单条历史记录
function deleteSingleHistoryItem(id, source) {
    let history = getViewingHistory();
    history = history.filter(h => !(h.id === id && h.source === source));
    try { localStorage.setItem('viewingHistory', JSON.stringify(history)); } catch (e) {}
    loadViewingHistoryContent();
    showToast('已删除该记录', 'info');
}

// 导航到播放页
function navigateToWatch(id, source, title, episodeIndex) {
    const params = new URLSearchParams();
    params.set('id', id);
    params.set('source', source);
    params.set('title', title);
    if (episodeIndex !== undefined) params.set('episode', episodeIndex);
    window.location.href = '/watch?' + params.toString();
}


// ====== 覆盖原有功能，统一使用带标签的面板 ======

// 覆盖 toggleHistory - 使用统一的标签面板
(function() {
    const _origToggleHistory = toggleHistory;
    toggleHistory = function(e) {
        // 密码保护校验
        if (window.isPasswordProtected && window.isPasswordVerified) {
            if (window.isPasswordProtected() && !window.isPasswordVerified()) {
                showPasswordModal && showPasswordModal();
                return;
            }
        }
        if (e) e.stopPropagation();

        const panel = document.getElementById('historyPanel');
        if (!panel) return;

        // 如果面板已打开且是历史 tab，关闭
        if (panel.getAttribute('data-tab') === 'history' && panel.classList.contains('show')) {
            panel.classList.remove('show');
            panel.setAttribute('aria-hidden', 'true');
            return;
        }

        panel.setAttribute('data-tab', 'history');
        panel.classList.add('show');
        panel.setAttribute('aria-hidden', 'false');

        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel && settingsPanel.classList.contains('show')) {
            settingsPanel.classList.remove('show');
        }

        buildPanelStructure();
        loadViewingHistoryContent();
    };

    // 覆盖 loadViewingHistory - 原来用于 panel 打开后加载
    loadViewingHistory = function() {
        buildPanelStructure();
        loadViewingHistoryContent();
    };
})();
