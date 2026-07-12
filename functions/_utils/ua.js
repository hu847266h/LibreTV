// functions/_utils/ua.js
// User-Agent 解析（纯本地，不调用外部 API）
// 用于展示设备类型 / 操作系统 / 浏览器

const DEVICE_PATTERNS = [
    { type: 'bot',     test: /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram/i },
    { type: 'tablet',  test: /ipad|tablet|playbook|silk/i },
    { type: 'mobile',  test: /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i },
];

const OS_PATTERNS = [
    { name: 'Windows',    test: /Windows NT ([\d.]+)/i },
    { name: 'macOS',      test: /Mac OS X ([\d_]+)|Macintosh/i },
    { name: 'iOS',        test: /iPhone OS ([\d_]+)|iPad.*OS ([\d_]+)/i },
    { name: 'Android',    test: /Android ([\d.]+)/i },
    { name: 'Linux',      test: /Linux/i },
    { name: 'Chrome OS',  test: /CrOS/i },
];

const BROWSER_PATTERNS = [
    { name: 'Edge',       test: /Edg\/([\d.]+)/i },
    { name: 'Opera',      test: /OPR\/([\d.]+)|Opera/i },
    { name: 'Chrome',     test: /Chrome\/([\d.]+)/i },
    { name: 'Safari',     test: /Safari\/([\d.]+)/i,  exclude: /Chrome|Edg|OPR/i },
    { name: 'Firefox',    test: /Firefox\/([\d.]+)/i },
    { name: 'Samsung',    test: /SamsungBrowser\/([\d.]+)/i },
    { name: 'UCBrowser',  test: /UCBrowser\/([\d.]+)/i },
    { name: 'QQBrowser',  test: /QQBrowser\/([\d.]+)/i },
    { name: 'WeChat',     test: /MicroMessenger\/([\d.]+)/i },
    { name: 'curl',       test: /curl\/([\d.]+)/i },
    { name: 'Postman',    test: /Postman/i },
];

function pickFirst(list, ua) {
    for (const p of list) {
        if (p.test.test(ua)) {
            if (p.exclude && p.exclude.test(ua)) continue;
            return p.name;
        }
    }
    return 'Unknown';
}

export function parseUserAgent(ua = '') {
    if (!ua) {
        return { deviceType: 'unknown', os: 'Unknown', browser: 'Unknown' };
    }
    const deviceType = pickFirst(DEVICE_PATTERNS, ua);
    const os = pickFirst(OS_PATTERNS, ua);
    const browser = pickFirst(BROWSER_PATTERNS, ua);
    return { deviceType, os, browser };
}
