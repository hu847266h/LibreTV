-- LibreTV 登录历史 / 审计日志表
-- 在 Cloudflare Dashboard 绑定 D1 后执行：
--   wrangler d1 execute libretv-db --file=./schema.sql --remote
--   wrangler d1 execute libretv-db --file=./schema.sql --local   (本地开发)

CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 会话标识（踢出时关联到 KV）
    session_id TEXT,
    -- 用户标识：单密码模式下用 PASSWORD 的 SHA-256 hash 前 16 位
    user_id TEXT NOT NULL,
    -- 客户端信息
    ip TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    -- User-Agent 解析后的设备信息
    device_type TEXT,    -- mobile / desktop / tablet / bot
    os TEXT,
    browser TEXT,
    user_agent TEXT,     -- 完整 UA（兜底）
    -- 事件类型
    event TEXT NOT NULL, -- login_success / login_failed / kicked / expired
    reason TEXT,         -- 失败原因 / 踢出原因
    -- 时间戳（毫秒）
    created_at INTEGER NOT NULL
);

-- 高频查询索引
CREATE INDEX IF NOT EXISTS idx_login_user_time
    ON login_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_session
    ON login_history (session_id);

CREATE INDEX IF NOT EXISTS idx_login_event
    ON login_history (event, created_at DESC);
