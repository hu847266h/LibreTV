const CUSTOMER_SITES = {
    sanliuling: {
        api: 'https://360zy.com/api.php/provide/vod/',
        name: '360资源',
    },
    hongniu2: {
        api: 'https://www.hongniuzy2.com/api.php/provide/vod/',
        name: '红牛资源',
    },
    liangzi2: {
        api: 'https://cj.lziapi.com/api.php/provide/vod/',
        name: '量子资源',
    },
    uku2: {
        api: 'https://api.ukuapi.com/api.php/provide/vod/',
        name: 'U酷资源',
    },
    yinghua2: {
        api: 'https://m3u8.apiyhzy.com/api.php/provide/vod/',
        name: '樱花资源',
    },
    baidu2: {
        api: 'https://api.apibdzy.com/api.php/provide/vod/',
        name: '百度资源',
    },
    niuniu: {
        api: 'https://api.niuniuzy.me/api.php/provide/vod/',
        name: '牛牛资源',
    },
    yaya: {
        api: 'https://cj.yayazy.net/api.php/provide/vod/',
        name: '丫丫资源',
    },
    jisu: {
        api: 'https://jszyapi.com/api.php/provide/vod',
        name: '极速资源',
    },
    suoni: {
        api: 'https://suoniapi.com/api.php/provide/vod/',
        name: '索尼资源',
    },
    ikun: {
        api: 'https://ikunzyapi.com/api.php/provide/vod/',
        name: 'ikun资源',
    },
    baofeng: {
        api: 'https://bfzyapi.com/api.php/provide/vod/',
        name: '暴风资源',
    },
    huya: {
        api: 'https://www.huyaapi.com/api.php/provide/vod/',
        name: '虎牙资源',
    },
    wujin: {
        api: 'https://api.wujinapi.com/api.php/provide/vod/',
        name: '无尽资源',
    },
    subo: {
        api: 'https://subocaiji.com/api.php/provide/vod/',
        name: '速博资源',
    },
    modu: {
        api: 'https://caiji.moduapi.cc/api.php/provide/vod/',
        name: '魔都资源',
    },
    xinlang: {
        api: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/',
        name: '新浪资源',
    },
    haohua2: {
        api: 'https://hhzyapi.com/api.php/provide/vod/',
        name: '豪华资源',
    },
    aidan: {
        api: 'http://lovedan.net/api.php/provide/vod',
        name: '艾旦影视',
    },
    feifan: {
        api: 'http://cj.ffzyapi.com/api.php/provide/vod/',
        name: '非凡资源',
    },
    zuida: {
        api: 'http://zuidazy.me/api.php/provide/vod/',
        name: '最大资源',
    },
    shandian3: {
        api: 'http://sdzyapi.com/api.php/provide/vod/',
        name: '闪电资源',
    },
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
