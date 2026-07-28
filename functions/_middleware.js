// LibreTV Cloudflare Pages Middleware
// 处理密码环境变量注入 + 设备管理 API 路由

// SHA-256 内联实现（Cloudflare Workers 环境使用 Web Crypto API）
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 设备管理 API 路由：转发到 admin.js
  if (url.pathname.startsWith("/api/")) {
    try {
      const { onRequest: adminHandler } = await import("./admin.js");
      return adminHandler(context);
    } catch (e) {
      return new Response(JSON.stringify({ error: "API error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // HTML 页面：注入 PASSWORD 哈希
  try {
    const response = await next();
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await response.text();

      // 读取环境变量 PASSWORD
      const password = env.PASSWORD || "";
      let passwordHash = "";
      if (password) {
        passwordHash = await sha256(password);
      }

      // 替换占位符
      html = html.replace(
        'window.__ENV__.PASSWORD = "{{PASSWORD}}";',
        `window.__ENV__.PASSWORD = "${passwordHash}";`
      );

      return new Response(html, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  } catch (e) {
    // 出错时原样返回，避免页面白屏
    console.error("[LibreTV middleware error]", e);
    return next();
  }
}