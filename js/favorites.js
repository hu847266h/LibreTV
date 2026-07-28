// LibreTV 收藏功能
const FAVORITES_KEY = 'favorites';

// 获取收藏列表
function getFavorites() {
    try {
        const data = localStorage.getItem(FAVORITES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('获取收藏失败:', e);
        return [];
    }
}

// 保存收藏列表
function saveFavorites(favorites) {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
        console.error('保存收藏失败:', e);
        showToast('收藏列表存储空间不足，请清理一些收藏', 'error');
    }
}

// 检查是否已收藏
function isFavorited(vodId, sourceCode) {
    const favorites = getFavorites();
    return favorites.some(f => f.vod_id === vodId && f.source_code === sourceCode);
}

// 添加收藏
function addFavorite(item) {
    const favorites = getFavorites();
    
    // 去重检查
    if (favorites.some(f => f.vod_id === item.vod_id && f.source_code === item.source_code)) {
        return false;
    }

    favorites.unshift({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic || '',
        type_name: item.type_name || '',
        vod_year: item.vod_year || '',
        vod_remarks: item.vod_remarks || '',
        source_name: item.source_name || '',
        source_code: item.source_code || '',
        api_url: item.api_url || '',
        addedAt: Date.now()
    });

    // 限制最多500条
    if (favorites.length > 500) {
        favorites.length = 500;
    }

    saveFavorites(favorites);
    return true;
}

// 取消收藏
function removeFavorite(vodId, sourceCode) {
    let favorites = getFavorites();
    favorites = favorites.filter(f => !(f.vod_id === vodId && f.source_code === sourceCode));
    saveFavorites(favorites);
}

// 切换收藏状态
function toggleFavorite(item, event) {
    if (event) event.stopPropagation();
    
    if (isFavorited(item.vod_id, item.source_code)) {
        removeFavorite(item.vod_id, item.source_code);
        showToast('已取消收藏', 'info');
    } else {
        addFavorite(item);
        showToast('已添加收藏', 'success');
    }
    
    // 刷新所有收藏按钮状态
    refreshAllFavoriteButtons();
    // 刷新收藏面板（如果打开）
    refreshFavoritesPanel();
}

// 刷新所有收藏按钮图标
function refreshAllFavoriteButtons() {
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const vodId = btn.getAttribute('data-vod-id');
        const sourceCode = btn.getAttribute('data-source-code');
        if (isFavorited(vodId, sourceCode)) {
            btn.classList.add('favorited');
            btn.innerHTML = '❤️';
        } else {
            btn.classList.remove('favorited');
            btn.innerHTML = '🤍';
        }
    });
}

// 切换收藏面板
function toggleFavorites(e) {
    if (e) e.stopPropagation();
    
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    
    const isShowingFav = panel.getAttribute('data-tab') === 'favorites';
    
    if (isShowingFav) {
        // 如果收藏面板已打开，关闭它
        panel.classList.remove('show');
        panel.setAttribute('aria-hidden', 'true');
        return;
    }
    
    // 打开面板并切换到收藏标签
    panel.setAttribute('data-tab', 'favorites');
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    
    // 关闭设置面板
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel && settingsPanel.classList.contains('show')) {
        settingsPanel.classList.remove('show');
    }
    
    refreshFavoritesPanel();
}

// 刷新收藏面板内容
function refreshFavoritesPanel() {
    const panel = document.getElementById('historyPanel');
    if (!panel || panel.getAttribute('data-tab') !== 'favorites') return;
    renderFavoritesPanel();
}

// 渲染收藏面板
function renderFavoritesPanel() {
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    
    const favorites = getFavorites();
    
    // 构建标签切换
    const tabHtml = `
        <div class="flex justify-between items-center mb-6">
            <button onclick="toggleHistory()" class="close-btn">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
            <div class="flex bg-[#1a1a1a] rounded-lg p-1">
                <button onclick="switchToHistory()" class="px-3 py-1 rounded-md text-sm transition-colors text-gray-400 hover:text-white">
                    📺 历史
                </button>
                <button onclick="switchToFavorites()" class="px-3 py-1 rounded-md text-sm transition-colors bg-[#333] text-white">
                    ❤️ 收藏
                </button>
            </div>
            <div class="w-4"></div>
        </div>
    `;
    
    if (favorites.length === 0) {
        panel.innerHTML = tabHtml + `
            <div class="flex flex-col items-center justify-center py-16 text-gray-500">
                <svg class="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <p class="text-sm">还没有收藏任何视频</p>
                <p class="text-xs mt-1 text-gray-600">在搜索结果中点击 ❤️ 即可收藏</p>
            </div>
        `;
        return;
    }
    
    const itemsHtml = favorites.map(item => {
        const safeName = item.vod_name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeSource = (item.source_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeType = (item.type_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeCode = (item.source_code || '').replace(/"/g, '\"');
        const safeId = (item.vod_id || '').replace(/[^\w-]/g, '');
        const apiUrlAttr = item.api_url ? `data-api-url="${item.api_url.replace(/"/g, '&quot;')}"` : '';
        const addTime = formatTimestamp(item.addedAt);
        
        return `
            <div class="flex items-center gap-3 p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#222] transition-colors cursor-pointer group"
                 onclick="showDetails('${safeId}','${safeName}','${safeCode}')" ${apiUrlAttr}>
                ${item.vod_pic ? `
                <div class="flex-shrink-0 w-12 h-16 rounded overflow-hidden bg-[#111]">
                    <img src="${item.vod_pic}" alt="${safeName}" class="w-full h-full object-cover" loading="lazy" 
                         onerror="this.onerror=null; this.style.display='none';">
                </div>` : ''}
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-medium text-white truncate" title="${safeName}">${safeName}</h4>
                    <div class="flex items-center gap-2 mt-1">
                        ${safeType ? `<span class="text-xs text-blue-400">${safeType}</span>` : ''}
                        <span class="text-xs text-gray-500">${safeSource}</span>
                    </div>
                    <p class="text-xs text-gray-600 mt-1">${addTime}</p>
                </div>
                <button onclick="event.stopPropagation(); removeFavoriteItem('${safeId}','${safeCode}')" 
                        class="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="取消收藏">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
    
    panel.innerHTML = tabHtml + `
        <div class="pb-4 space-y-2" id="favoritesList">
            ${itemsHtml}
        </div>
        <div class="mt-4 text-center sticky bottom-0 pb-2 pt-2 bg-[#111]">
            <p class="text-xs text-gray-500 mb-2">共 ${favorites.length} 个收藏</p>
            <button onclick="clearAllFavorites()" class="px-4 py-2 w-full bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 hover:from-red-600 hover:via-pink-600 hover:to-rose-600 text-white rounded-lg text-sm transition-all duration-300 shadow-md hover:shadow-lg">
                清空收藏
            </button>
        </div>
    `;
}

// 切换回历史面板
function switchToHistory() {
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    panel.setAttribute('data-tab', 'history');
    loadViewingHistory();
}

// 切换到收藏面板
function switchToFavorites() {
    renderFavoritesPanel();
}

// 从面板中移除单个收藏
function removeFavoriteItem(vodId, sourceCode) {
    removeFavorite(vodId, sourceCode);
    refreshAllFavoriteButtons();
    renderFavoritesPanel();
    showToast('已取消收藏', 'info');
}

// 清空所有收藏
function clearAllFavorites() {
    if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
        localStorage.removeItem(FAVORITES_KEY);
        refreshAllFavoriteButtons();
        renderFavoritesPanel();
        showToast('收藏已全部清空', 'success');
    }
}

// 生成收藏按钮 HTML（用于搜索结果卡片和详情页）
function getFavoriteButtonHtml(item) {
    const vodId = (item.vod_id || '').replace(/"/g, '&quot;');
    const sourceCode = (item.source_code || '').replace(/"/g, '&quot;');
    const isFav = isFavorited(item.vod_id, item.source_code);
    const heartIcon = isFav ? '❤️' : '🤍';
    const favClass = isFav ? 'favorited' : '';
    
    return `<button class="fav-btn ${favClass} text-sm leading-none hover:scale-125 transition-transform p-1" 
                    data-vod-id="${vodId}" data-source-code="${sourceCode}"
                    data-vod-name="${(item.vod_name || '').replace(/"/g, '&quot;')}"
                    data-vod-pic="${(item.vod_pic || '').replace(/"/g, '&quot;')}"
                    data-type-name="${(item.type_name || '').replace(/"/g, '&quot;')}"
                    data-vod-year="${(item.vod_year || '').replace(/"/g, '&quot;')}"
                    data-vod-remarks="${(item.vod_remarks || '').replace(/"/g, '&quot;')}"
                    data-source-name="${(item.source_name || '').replace(/"/g, '&quot;')}"
                    data-api-url="${(item.api_url || '').replace(/"/g, '&quot;')}"
                    title="${isFav ? '取消收藏' : '添加收藏'}">
                ${heartIcon}
            </button>`;
}