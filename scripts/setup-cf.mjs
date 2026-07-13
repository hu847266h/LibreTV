// scripts/setup-cf.mjs
// Cloudflare 自动化设置脚本
// 一键创建 KV Namespace + D1 Database → 绑定到 Pages 项目 → 执行 D1 建表
//
// 用法：
//   set CLOUDFLARE_API_TOKEN=xxxx
//   set CLOUDFLARE_ACCOUNT_ID=xxxx
//   set CF_PROJECT_NAME=libretv       (可选，默认 libretv)
//   node scripts/setup-cf.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ================================
// 配置
// ================================

const API_TOKEN  = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID  || process.env.CF_ACCOUNT_ID || '';
const PROJECT    = process.env.CF_PROJECT_NAME || 'libretv';

const KV_NAME    = process.env.CF_KV_NAME || 'LIBRETV_SESSIONS';
const D1_NAME    = process.env.CF_D1_NAME || 'libretv-db';

const CF_API = 'https://api.cloudflare.com/client/v4';

// ================================
// 工具函数
// ================================

function log(step, msg) {
    console.log(`[${step}] ${msg}`);
}
function ok(step, msg) {
    console.log(`  ✓ ${msg}`);
}
function warn(step, msg) {
    console.log(`  ⚠ ${msg}`);
}
function fail(step, msg) {
    console.error(`  ✗ ${msg}`);
}

async function cf(method, path, body) {
    const url = `${CF_API}${path}`;
    const opts = {
        method,
        headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({ success: false, errors: [{ message: res.statusText }] }));

    if (!res.ok || data.success === false) {
        const errMsg = data.errors?.[0]?.message || data.error || `HTTP ${res.status}`;
        throw new Error(errMsg);
    }
    return data.result;
}

async function cfRaw(method, path, body) {
    const url = `${CF_API}${path}`;
    const opts = {
        method,
        headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// ================================
// 步骤一：校验 Token & Account
// ================================

async function validateAuth() {
    log('AUTH', '验证 API Token 和 Account ID…');
    if (!API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN 未设置');
    if (!ACCOUNT_ID) throw new Error('CLOUDFLARE_ACCOUNT_ID 未设置');

    // 验证 token 有效性
    const res = await cfRaw('GET', '/user/tokens/verify');
    if (!res.ok) throw new Error(`API Token 无效: ${res.data.errors?.[0]?.message || res.data.error || '验证失败'}`);
    ok('AUTH', `Token 有效 (ID: ${res.data.result?.id || '?'})`);
}

// ================================
// 步骤二：创建 KV Namespace
// ================================

async function setupKV() {
    log('KV', `创建/查找 KV Namespace "${KV_NAME}"…`);

    // 先列出已有 KV，避免重复创建
    let allKvs = [];
    let page = 1;
    while (true) {
        const list = await cf('GET', `/accounts/${ACCOUNT_ID}/storage/kv/namespaces?per_page=100&page=${page}`);
        if (!list || list.length === 0) break;
        allKvs = allKvs.concat(list);
        page++;
    }

    const existing = allKvs.find(k => k.title === KV_NAME);
    if (existing) {
        ok('KV', `已存在: id=${existing.id}`);
        return { id: existing.id };
    }

    const result = await cf('POST', `/accounts/${ACCOUNT_ID}/storage/kv/namespaces`, { title: KV_NAME });
    ok('KV', `创建成功: id=${result.id}`);
    return { id: result.id };
}

// ================================
// 步骤三：创建 D1 Database
// ================================

async function setupD1() {
    log('D1', `创建/查找 D1 Database "${D1_NAME}"…`);

    // 列出已有 D1
    let allDbs = [];
    let page = 1;
    while (true) {
        const list = await cf('GET', `/accounts/${ACCOUNT_ID}/d1/database?per_page=100&page=${page}`);
        if (!list || list.length === 0) break;
        allDbs = allDbs.concat(list);
        page++;
    }

    const existing = allDbs.find(d => d.name === D1_NAME);
    if (existing) {
        ok('D1', `已存在: uuid=${existing.uuid}, name=${existing.name}`);
        return { id: existing.uuid, name: existing.name };
    }

    const result = await cf('POST', `/accounts/${ACCOUNT_ID}/d1/database`, { name: D1_NAME });
    ok('D1', `创建成功: uuid=${result.uuid}`);
    return { id: result.uuid, name: result.name };
}

// ================================
// 步骤四：绑定到 Pages 项目
// ================================

async function bindToPages(kvId, d1Id) {
    log('BIND', `绑定到 Pages 项目 "${PROJECT}"…`);

    // 先获取当前项目配置
    let project;
    try {
        project = await cf('GET', `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`);
    } catch (e) {
        throw new Error(`项目 "${PROJECT}" 不存在或无法访问: ${e.message}`);
    }

    const configs = project.deployment_configs || {};
    const production = configs.production || {};
    const preview = configs.preview || {};

    // 构造绑定配置
    const newConfig = {
        deployment_configs: {
            production: {
                ...production,
                kv_namespaces: {
                    ...(production.kv_namespaces || {}),
                    SESSIONS: { namespace_id: kvId },
                },
                d1_databases: {
                    ...(production.d1_databases || {}),
                    DB: {
                        database_id: d1Id,
                    },
                },
            },
            preview: {
                ...preview,
                kv_namespaces: {
                    ...(preview.kv_namespaces || {}),
                    SESSIONS: { namespace_id: kvId },
                },
                d1_databases: {
                    ...(preview.d1_databases || {}),
                    DB: {
                        database_id: d1Id,
                    },
                },
            },
        },
    };

    const result = await cf('PATCH', `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`, newConfig);
    ok('BIND', 'KV + D1 绑定成功（production + preview）');
    return result;
}

// ================================
// 步骤五：执行 D1 Schema
// ================================

async function runD1Schema(d1Id) {
    log('SQL', '执行 D1 建表语句…');

    const schemaPath = join(ROOT, 'schema.sql');
    let sql;
    try {
        sql = readFileSync(schemaPath, 'utf-8');
    } catch {
        warn('SQL', 'schema.sql 不存在，跳过建表');
        return;
    }

    // 分割多条 SQL 语句
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    let success = 0;
    let failed = 0;

    for (const stmt of statements) {
        try {
            const result = await cf('POST', `/accounts/${ACCOUNT_ID}/d1/database/${d1Id}/query`, { sql: stmt + ';' });
            success++;
        } catch (e) {
            // CREATE TABLE IF NOT EXISTS 可能轻微重复执行，忽略
            if (e.message.includes('already exists')) {
                success++;
                continue;
            }
            warn('SQL', `语句执行失败: ${stmt.slice(0, 60)}… — ${e.message}`);
            failed++;
        }
    }

    if (failed === 0) {
        ok('SQL', `全部 ${success} 条 SQL 执行成功`);
    } else {
        warn('SQL', `${success} 条成功, ${failed} 条失败（可忽略已存在错误）`);
    }
}

// ================================
// 步骤六：更新 wrangler.toml
// ================================

function updateWranglerToml(kvId, d1Id) {
    log('TOML', '更新 wrangler.toml（local dev 用）…');

    const tomlPath = join(ROOT, 'wrangler.toml');
    let content;
    try {
        content = readFileSync(tomlPath, 'utf-8');
    } catch {
        warn('TOML', 'wrangler.toml 不存在，跳过');
        return;
    }

    const replaced = content
        .replace(/id = "REPLACE_WITH_KV_ID"/g, `id = "${kvId}"`)
        .replace(/preview_id = "REPLACE_WITH_KV_PREVIEW_ID"/g, `preview_id = "${kvId}"`)
        .replace(/database_id = "REPLACE_WITH_D1_ID"/g, `database_id = "${d1Id}"`);

    if (content === replaced) {
        ok('TOML', 'wrangler.toml 已配置，无需更新');
        return;
    }

    writeFileSync(tomlPath, replaced, 'utf-8');
    ok('TOML', `wrangler.toml 已更新: kv=${kvId.slice(0,12)}… d1=${d1Id.slice(0,12)}…`);
}

// ================================
// 主流程
// ================================

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   Cloudflare 资源初始化脚本              ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    try {
        // 1. 验证
        await validateAuth();

        // 2. KV
        const kv = await setupKV();

        // 3. D1
        const d1 = await setupD1();

        // 4. 绑定到 Pages
        await bindToPages(kv.id, d1.id);

        // 5. 执行建表
        await runD1Schema(d1.id);

        // 6. 更新本地 wrangler.toml
        updateWranglerToml(kv.id, d1.id);

        console.log('');
        console.log('╔══════════════════════════════════════════╗');
        console.log('║   ✅  全部完成！                         ║');
        console.log('╚══════════════════════════════════════════╝');
        console.log('');
        console.log(`  KV Namespace: ${KV_NAME} → ${kv.id}`);
        console.log(`  D1 Database:  ${D1_NAME} → ${d1.id}`);
        console.log(`  Pages 项目:   ${PROJECT} 绑定完成`);
        console.log(`  wrangler.toml: 已更新`);
        console.log('');
        console.log('  如需重新部署 Pages，请触发一次部署：');
        console.log('    git push 或 在 CF Dashboard 手动触发');
        console.log('');

    } catch (e) {
        console.error('');
        console.error('╔══════════════════════════════════════════╗');
        console.error('║   ❌  设置失败                           ║');
        console.error('╚══════════════════════════════════════════╝');
        console.error(`  ${e.message}`);
        console.error('');
        process.exit(1);
    }
}

main();
