# 掌柜 AI — 接上云端（Supabase）设置指南

接好后：任何餐厅老板都能注册自己的帐号，资料存云端，换手机/电脑/系统登入同一帐号都看到同一份资料。
**没接 Supabase 时 App 仍可运行**（纯本地 + demo 一键进入），所以你可以随时再接。

---

## 一、建立 Supabase 项目（约 3 分钟）

1. 打开 https://supabase.com → 用 GitHub 登入 → **New project**
2. 项目名随意（如 `zhanggui-ai`），选最近的区域（新加坡 `Southeast Asia`），设一个数据库密码
3. 等项目建好（约 1–2 分钟）

## 二、建立资料表（贴 SQL 执行）

1. 左侧 **SQL Editor** → **New query**
2. 把 `supabase/schema.sql` 整个文件内容贴进去 → **Run**
3. 看到成功即可（脚本可重复执行，不会重复建表）

## 三、拿到金钥

左侧 **Project Settings → API**，复制这些值：
- **Project URL** → 填到 `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → 填到 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → 填到 `SUPABASE_SERVICE_ROLE_KEY`（只放服务器 / Vercel 环境变量，不可放到前端公开）

> anon key 是公开金钥，放前端是安全的——真正的资料隔离靠资料表上的 RLS（已在 SQL 里设好）。

## 四、填环境变量

**本地**：在 `app/.env.local` 加上：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
POS_INGEST_TOKEN=可选；只给内部后台兼容测试
```

**Vercel**：项目 → Settings → Environment Variables，加上同样环境变量（Production + Preview），然后 Redeploy。

## 五、（建议）关掉邮箱验证，让注册即用

Supabase 控制台 → **Authentication → Providers → Email** →
关掉 **Confirm email**（开发/早期阶段）。这样老板注册后立即进入，不必等确认信。
之后要正式上线再打开，体验更安全。

## 六、设置重设密码跳转

Supabase 控制台 → **Authentication → URL Configuration**：

- **Site URL**：填线上网址，例如 `https://app-tan-ten-65.vercel.app`
- **Redirect URLs**：至少加入：
  - `https://app-tan-ten-65.vercel.app/login?reset=1`
  - `http://localhost:3000/login?reset=1`

这样客户点「忘记密码」收到邮件后，会回到掌柜 AI 的「设置新密码」页面；换电脑、换系统、忘记密码时都能自助处理。

---

## 验证是否成功

1. `npm run dev` 打开 App → 登入页应出现「登入 / 注册」切换 + 邮箱密码栏
2. 注册一个测试帐号 → 进入后随便加一笔订单
3. 换一个浏览器（或手机）登入同一帐号 → 应看到刚才那笔订单
4. Supabase 控制台 → **Table Editor → data_documents** → 应看到对应的资料行
5. 在登入页点「忘记密码？」→ 输入邮箱 → 收到邮件后应能回到 `/login?reset=1` 设置新密码

## 运作原理（简述）

- 每个登入帐号 = 一个 `tenant`（一家餐厅）。资料按 `tenant_id` 用 RLS 隔离，彼此看不到对方。
- App 仍先写本地 `localStorage`（所以离线也能用、瞬时），再防抖同步到云端。
- 登入时云端资料会覆盖本地（精确镜像），确保换设备看到的是同一份、且不会残留上一个帐号的资料。
- 想把现有本机资料搬上云：登入后到 **设置 → 帐号 → 上传本机资料到云端**。
- 客户要清空测试资料或结束使用：先到 **设置 → 数据备份 → 下载备份**，再到 **设置 → 帐号 → 清除云端业务资料**。这个操作会删除云端和本机业务资料，但不会删除登入帐号本身。

## 实体 POS webhook 接入

如果餐厅的 POS、Make、Zapier 或本地小工具可以发 HTTP webhook，可把每日 POS 结算直接写入掌柜 AI：

```bash
curl -X POST https://app-tan-ten-65.vercel.app/api/pos/ingest \
  -H "Content-Type: application/json" \
  -H "x-zg-pos-token: <restaurant-pos-token>" \
  -d '{
    "date": "2026-06-02",
    "sourceName": "POS",
    "cashSales": 1280.5,
    "qrSales": 860,
    "cardSales": 420,
    "platformSales": 560,
    "platformFees": 72,
    "orderCount": 86,
    "externalId": "receipt-batch-2026-06-02"
  }'
```

正式给客户接 POS 时，先让老板用云端账号登入 `/pos`，点击「生成密钥」，把页面显示的一次性完整 token 交给 POS 厂商 / Make / Zapier。系统只保存 token hash，POS 厂商不需要知道客户 email 或 tenantId。也可以发送 `reportText`，系统会按 CSV / 文字日报规则尝试识别金额。接口会同时更新云端 `POS 导入` 和 `每日结算`。如果 POS 厂商要做正式双向 API，需要向该 POS 厂商申请 API key / webhook 权限后再做品牌适配。

## 后续可强化（非必须）

- 用 `@supabase/ssr` 在 `proxy.ts` 校验 Supabase session cookie，取代目前的 gate cookie（更严谨的外壳保护）。
- 邀请员工共用一家餐厅：把员工 `profiles.tenant_id` 设成老板的 id。
- 资料表从「整包 JSON」拆成正规化表（要做跨租户报表统计时再做）。
