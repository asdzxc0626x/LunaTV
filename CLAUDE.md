# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览
- 这是一个基于 **Next.js 14 App Router + TypeScript + Tailwind CSS** 的影视聚合播放器（MoonTV/LunaTV）。
- 应用在 `src/app` 同时承载页面与 API 路由：前端页面（首页、搜索、播放、直播、管理页）与后端接口（`/api/*`）共仓实现。
- 核心业务主线：
  1. 从管理员配置中获取可用资源源（资源站 / 直播源）；
  2. 通过下游聚合接口搜索与详情拉取；
  3. 通过统一存储抽象保存用户数据（播放记录、收藏、搜索历史、管理配置等）；
  4. 在客户端通过 `window.RUNTIME_CONFIG` 读取运行时配置并驱动 UI 行为。

## 开发与质量命令
> 包管理器使用 `pnpm`（`packageManager: pnpm@10.14.0`，Node 版本见 `.nvmrc`）。

- 安装依赖：`pnpm install`
- 本地开发：`pnpm dev`
- 生产构建：`pnpm build`
- 生产启动：`pnpm start`
- 类型检查：`pnpm typecheck`
- Lint：`pnpm lint`
- 严格 Lint（禁止 warning）：`pnpm lint:strict`
- 自动修复 Lint + 格式化：`pnpm lint:fix`
- 代码格式化：`pnpm format`
- 检查格式：`pnpm format:check`
- 运行全部测试：`pnpm test`
- 监听模式测试：`pnpm test:watch`
- 运行单个测试文件：`pnpm test -- <test-file-path>`
  - 示例：`pnpm test -- src/app/api/detail/route.ts`
- 按测试名运行：`pnpm test -- -t "<test name>"`

## Docker 相关
- 本地 Docker 开发编排（应用 + Redis）：`docker compose -f docker-compose.dev.yml up -d --build`
- 项目脚本封装：`./scripts/dev-docker.sh [up|down|rebuild|logs]`
- 生产镜像为多阶段构建，依赖 `next.config.js` 的 `output: 'standalone'` 与 `start.js` 预加载逻辑。

## 架构与关键模块

### 1) App Router 分层
- `src/app/*/page.tsx`：页面层（首页、搜索、播放、豆瓣、直播、管理等）。
- `src/app/api/**/route.ts`：服务端接口层，运行时多数显式设置为 `nodejs`。
- `src/middleware.ts`：统一鉴权入口，拦截页面与 API（排除登录、静态资源、部分公开 API）。

### 2) 配置中心（站点配置/资源源/用户配置）
- `src/lib/config.ts` 是配置核心：
  - 从存储层读取管理员配置并做内存缓存；
  - 将配置文件（`ConfigFile` JSON）与数据库中的可编辑配置合并（`refineConfig`）；
  - 输出可用源、缓存时间、站点展示配置等。
- `src/app/layout.tsx` 服务端读取配置后，将运行时参数注入 `window.RUNTIME_CONFIG`，客户端侧读取该对象控制行为（如代理、过滤、流式搜索开关等）。

### 3) 鉴权与用户模型
- `src/app/api/login/route.ts` 负责登录与 `auth` Cookie 发放：
  - `localstorage` 模式：直接比对 `PASSWORD`；
  - 数据库存储模式：校验用户并基于站长密码对用户名做签名。
- `src/lib/auth.ts` 提供服务端/客户端 Cookie 解析。
- `src/middleware.ts` 校验 Cookie 与签名并执行重定向/401。

### 4) 存储抽象（最核心的后端基础设施）
- `src/lib/db.ts` 通过 `DbManager` 暴露统一接口（播放记录、收藏、搜索历史、用户、管理员配置、跳过片头片尾配置）。
- 底层实现按 `NEXT_PUBLIC_STORAGE_TYPE` 切换：
  - `redis` -> `src/lib/redis.db.ts`
  - `kvrocks` -> `src/lib/kvrocks.db.ts`
  - `upstash` -> `src/lib/upstash.db.ts`
  - `localstorage` -> 服务端无持久化实例（仅客户端本地存储）
- `src/lib/db.client.ts` 是浏览器侧数据访问与混合缓存层（localStorage + API 同步）。

### 5) 搜索/详情/直播业务链路
- 聚合下游访问与解析在 `src/lib/downstream.ts`：
  - 搜索分页并发拉取；
  - 详情解析；
  - 站点级缓存与超时控制。
- API 入口：
  - 搜索：`src/app/api/search/route.ts`
  - 详情：`src/app/api/detail/route.ts`
- 直播能力在 `src/lib/live.ts`：解析 M3U、拉取 EPG、缓存频道数据；对应接口位于 `src/app/api/live/*` 与 `src/app/api/admin/live/*`。

### 6) 管理后台能力
- 页面：`src/app/admin/page.tsx`
- 管理 API：`src/app/api/admin/**/route.ts`
  - 站点配置、资源源管理、直播源、分类、用户、配置导入导出、订阅拉取等。
- 管理接口在 `localstorage` 模式下受限（例如管理员配置接口直接拒绝）。

## 重要运行约束（来自代码与 README）
- 项目部署后默认是“空壳”，需要在后台配置资源站（`ConfigFile` / 订阅）后才能正常检索与播放。
- 生产推荐使用 Docker 部署；仓库内已提供 `Dockerfile` 与 `docker-compose.dev.yml`。
- 关键环境变量（至少需关注）：
  - `USERNAME` / `PASSWORD`
  - `NEXT_PUBLIC_STORAGE_TYPE`（`redis` / `kvrocks` / `upstash` / `localstorage`）
  - 对应存储连接变量（`REDIS_URL` / `KVROCKS_URL` / `UPSTASH_URL` + `UPSTASH_TOKEN`）

## CI/CD 与自动化
- GitHub Actions：`.github/workflows/docker-image.yml`
  - 在 `main/master` push、PR、release 时构建并推送多架构镜像到 GHCR。
