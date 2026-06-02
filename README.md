# 掌柜 AI / Zhanggui AI

餐厅老板用的 AI 生意助手。核心目标是让传统餐厅老板可以在手机、平板、Windows、Mac 和不同浏览器上登入同一个帐号，看到同一份经营资料。

## 主要模块

- 今日经营雷达
- 订单和接单管理
- 客户 CRM 和回访
- 现金账本
- POS 日报导入
- 预订日历
- 供应商账款
- 库存、员工、营运任务
- AI 对话和内容工具
- 设置、备份、云端同步

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量

复制 `.env.local.example` 为 `.env.local`，再填入真实值。

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ACCESS_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 没有填写时，App 会自动降级为 demo / 本机模式；填写后才会启用客户注册、登入、云端同步和跨电脑使用。

## Supabase

1. 在 Supabase 建项目。
2. 到 SQL Editor 执行 `supabase/schema.sql`。
3. 到 Project Settings -> API 复制 Project URL 和 anon public key。
4. 把这两个值填到本地 `.env.local` 和 Vercel Environment Variables。
5. 到 Authentication -> URL Configuration 设置：
   - Site URL：线上网址，例如 `https://app-tan-ten-65.vercel.app`
   - Redirect URLs：加入 `https://app-tan-ten-65.vercel.app/login?reset=1`

详细步骤见 `SUPABASE_SETUP.md`。

## Vercel 上线

Vercel 项目需要配置这些环境变量：

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `ACCESS_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

配置后重新部署。生产构建命令：

```bash
npm run build
```

## 公开版验收

公开给客户前，至少确认：

1. 线上 `/login` 能注册新帐号。
2. 同一个帐号在两个浏览器登入后能看到同一份订单 / 客户资料。
3. 「忘记密码？」能发送邮件，并回到 `/login?reset=1` 设置新密码。
4. demo 模式不会污染正式帐号资料。
5. `/pos` 能导入 POS CSV / 文字日报，并写入每日结算。
6. 设置页能下载备份、上传本机资料到云端、清除云端业务资料。
7. `npm run lint` 没有 error。
8. `npm run build` 通过。

## 数据说明

App 采用本地优先 + 云端镜像：

- 老板操作时先写入浏览器本机资料，离线时也能继续工作。
- 登入云端帐号后，资料会同步到 Supabase 的 `data_documents`。
- 每个帐号通过 Supabase RLS 隔离资料。
- 登出会清除本机业务资料，避免下一位使用同一台电脑的人看到前一个账号的数据。

客户要清空测试资料时，应先下载备份，再到设置页清除云端业务资料。
