# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览
- LunaTV 是一个基于 **Next.js 14 App Router + TypeScript + Tailwind CSS** 的影视聚合播放器，前端页面与后端 API 都位于同一仓库。
- 应用启动后本身是“空壳”：必须先在后台配置资源站 / 直播源 / 配置订阅，搜索、详情、播放与直播能力才会真正可用（README 已明确说明）。
- 仓库当前主要面向 **Docker 部署**；本地纯 Node 开发可运行，但生产构建、镜像启动和定时任务都围绕 Docker/standalone 模式设计。

## 常用开发命令
> 包管理器固定为 `pnpm@10.14.0`，Node 版本见 `.nvmrc`（当前为 `v20.10.0`）。

- 安装依赖：`pnpm install`
- 本地开发：`pnpm dev`
- 生产构建：`pnpm build`
- 生产启动：`pnpm start`
- 类型检查：`pnpm typecheck`
- Lint：`pnpm lint`
- 严格 Lint（warning 视为失败）：`pnpm lint:strict`
- 自动修复 Lint 并格式化：`pnpm lint:fix`
- 代码格式化：`pnpm format`
- 校验格式：`pnpm format:check`
- 运行全部测试：`pnpm test`
- 监听模式测试：`pnpm test:watch`
- 运行单个测试文件：`pnpm test -- <test-file>`
- 按测试名过滤：`pnpm test -- -t "<test name>"`

## Docker / 运行相关命令
- 本地 Docker 开发环境（应用 + Redis）：`docker compose -f docker-compose.dev.yml up -d --build`
- 停止本地 Docker 开发环境：`docker compose -f docker-compose.dev.yml down`
- 使用封装脚本启动/停止/重建/看日志：`./scripts/dev-docker.sh [up|down|rebuild|logs]`

## 测试与工具链约定
- Jest 通过 `next/jest` 集成 Next.js 配置，测试环境为 `jest-environment-jsdom`。
- TypeScript 路径别名：`@/* -> src/*`，`~/* -> public/*`。
- 构建或开发前会先执行 `pnpm gen:manifest`，对应脚本为 `scripts/generate-manifest.js`；修改 PWA/manifest 相关逻辑时需要留意这个前置生成步骤。

## 高层架构

### 1. App Router 同时承载页面与后端接口
- 页面路由和 API 路由都在 `src/app` 下：UI 页面使用 `page.tsx`，服务端接口使用 `api/**/route.ts`。
- 大多数业务接口显式声明 `runtime = 'nodejs'`，说明它们依赖 Node 运行时能力而不是 Edge Runtime。
- `src/middleware.ts` 是统一鉴权入口：除登录、warning、静态资源、少量公开接口外，页面与 API 都会经过鉴权。

### 2. 配置中心是业务主轴
- `src/lib/config.ts` 是整个应用最关键的配置聚合层：
  - 生成初始化后台配置；
  - 读取存储中的管理员配置；
  - 把 `ConfigFile` JSON 与后台可编辑配置合并（`refineConfig`）；
  - 向搜索、详情、直播、站点展示层提供统一配置读取接口。
- 配置不仅决定资源站列表，也决定站点名称、公告、豆瓣代理、是否开启黄色内容过滤、流式搜索、Web 直播等运行行为。
- `src/app/layout.tsx` 会在服务端读取配置，并将运行时配置注入 `window.RUNTIME_CONFIG`；很多客户端逻辑依赖这个全局对象，而不是在构建期写死。

### 3. 存储层通过统一抽象屏蔽实现差异
- `src/lib/db.ts` 中的 `DbManager` 是统一数据访问入口，负责：
  - 播放记录
  - 收藏
  - 搜索历史
  - 用户管理
  - 管理员配置
  - 跳过片头片尾配置
- 底层实现按 `NEXT_PUBLIC_STORAGE_TYPE` 切换：
  - `redis` -> `src/lib/redis.db.ts`
  - `kvrocks` -> `src/lib/kvrocks.db.ts`
  - `upstash` -> `src/lib/upstash.db.ts`
  - `localstorage` -> 无服务端持久化能力，很多后台能力会受限
- `DbManager` 在初始化时会自动触发数据迁移与密码迁移，因此修改存储实现时要留意首次访问的副作用。
- 浏览器侧的数据读写不直接复用服务端类，而是走 `src/lib/db.client.ts` 的本地缓存/API 混合逻辑。

### 4. 鉴权模型与存储模式强相关
- `src/app/api/login/route.ts` 有两套登录逻辑：
  - `localstorage` 模式：只校验环境变量 `PASSWORD`
  - 数据库存储模式：站长账号走环境变量，其它用户走数据库校验
- 登录成功后会写入 `auth` Cookie；非 localstorage 模式下通过用户名 + 站长密码生成 HMAC 签名。
- `src/middleware.ts` 负责验证这个 Cookie，并决定是跳转登录页还是返回 401。
- 如果没有设置 `PASSWORD`，middleware 会把用户重定向到 `/warning`，所以很多“站点无法进入”的问题首先要检查环境变量是否完整。

### 5. 搜索 / 详情链路是“配置驱动的多源聚合”
- `src/lib/downstream.ts` 负责下游资源站访问：
  - 按资源站配置拼接搜索/详情接口；
  - 搜索分页并发拉取；
  - 针对单页搜索结果做缓存；
  - 提取播放地址、剧集标题、年份、简介等统一结构。
- `src/app/api/search/route.ts` 是普通聚合搜索接口：并发请求所有启用源，单源失败不会拖垮整体响应。
- `src/app/api/search/ws/route.ts` 提供基于 SSE 的流式搜索：每个源完成后立刻回推结果，最终再发送 complete 事件。
- `src/app/api/detail/route.ts` 通过配置筛选目标源，再调用 downstream 解析详情；它和搜索接口都会读取 `getCacheTime()` 来设置 CDN/代理缓存头。
- 黄色内容过滤不是下游接口逻辑，而是在 API 聚合返回前根据配置统一过滤。

### 6. 直播能力是独立的一条配置驱动链路
- `src/lib/live.ts` 负责：
  - 拉取并解析 M3U 直播源
  - 提取频道分组、台标、频道号
  - 流式解析 EPG XML，避免整文件载入内存
  - 维护直播频道缓存
- 直播源同样来自管理员配置（`LiveConfig`），并且刷新后会把频道数写回管理配置。
- 相关接口分布在 `src/app/api/live/*` 和 `src/app/api/admin/live/*`；如果改直播功能，通常需要同时检查解析层与后台管理接口。

### 7. 管理后台不是简单页面，而是系统控制面
- `src/app/admin/page.tsx` 是管理入口，但真正的能力分散在 `src/app/api/admin/**/route.ts`：
  - 站点配置
  - 配置文件与订阅拉取
  - 资源站增删改查与校验
  - 直播源管理与刷新
  - 用户管理
  - 数据导入导出 / 重置
  - 自定义分类管理
- README 里提到的“部署后为空壳，需要站长在后台填写配置文件”就是通过这一组管理接口落地的。

### 8. Docker 运行方式不是普通 `next start`
- `next.config.js` 使用 `output: 'standalone'`，生产镜像依赖 `.next/standalone` 输出。
- `start.js` 在启动时会先执行 `scripts/generate-manifest.js`，然后直接 `require('./server.js')` 启动 standalone server。
- `start.js` 还会在服务就绪后主动请求 `/api/cron`，并每小时轮询一次，因此定时任务是“应用自触发”的，不依赖外部 cron 服务。
- `Dockerfile` 使用三阶段构建，并复制 `start.js`、`scripts/`、`public/` 与 `.next/static` 到最终运行镜像。

## 重要环境变量
优先关注这些变量，因为它们直接影响能否进入站点以及核心功能是否可用：

- `USERNAME`
- `PASSWORD`
- `NEXT_PUBLIC_STORAGE_TYPE` (`localstorage` / `redis` / `kvrocks` / `upstash`)
- `REDIS_URL`
- `KVROCKS_URL`
- `UPSTASH_URL`
- `UPSTASH_TOKEN`
- `NEXT_PUBLIC_SITE_NAME`
- `ANNOUNCEMENT`
- `NEXT_PUBLIC_SEARCH_MAX_PAGE`
- `NEXT_PUBLIC_DOUBAN_PROXY_TYPE`
- `NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE`
- `NEXT_PUBLIC_DISABLE_YELLOW_FILTER`
- `NEXT_PUBLIC_FLUID_SEARCH`

## 仓库内已有文档/自动化的补充信息
- README 明确说明：项目不内置播放源和直播源，部署后需要自行配置。
- 仓库当前没有 `.cursor/rules/`、`.cursorrules` 或 `.github/copilot-instructions.md` 可额外继承。
- `.github/workflows/docker-image.yml` 会在 `main/master` 的 push、PR、release 上构建并推送多架构 Docker 镜像到 GHCR；如果改动 Dockerfile、构建产物结构或镜像入口，通常也要同步检查这条工作流。
