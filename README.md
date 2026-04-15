# AutoNovel 轻小说机翻机器人

[![GPL-3.0](https://img.shields.io/github/license/auto-novel/auto-novel)](https://github.com/auto-novel/auto-novel#license)
[![cd-web](https://github.com/auto-novel/auto-novel/actions/workflows/cd-web.yml/badge.svg)](https://github.com/auto-novel/auto-novel/actions/workflows/cd-web.yml)
[![cd-api](https://github.com/auto-novel/auto-novel/actions/workflows/cd-api.yml/badge.svg)](https://github.com/auto-novel/auto-novel/actions/workflows/cd-api.yml)

> 重建巴别塔！！

[轻小说机翻机器人](https://n.novelia.top/)是一个自动生成轻小说机翻并分享的网站。

## 贡献

请务必在编写代码前阅读[贡献指南](https://github.com/auto-novel/auto-novel/blob/main/CONTRIBUTING.md)，感谢所有为本项目做出贡献的人们！

## 部署

> [!WARNING]
> 注意：本项目并不是为了个人部署设计的，不保证所有功能可用和前向兼容。

```bash
# 1. 克隆仓库
git clone https://github.com/auto-novel/auto-novel.git
cd auto-novel

# 2. 生成环境变量配置
cat > .env << EOF
HTTPS_PROXY=              # web 小说代理，可以为空
PIXIV_COOKIE_PHPSESSID=   # Pixiv Cookie，用于爬取P站小说，可以为空

# 以下字段个人部署不需要填写
ACCESS_TOKEN_SECRET=
MAILGUN_API_KEY=
MAILGUN_API_URL=https://api.eu.mailgun.net/v3/verify.fishhawk.top/messages
MAILGUN_FROM_EMAIL=postmaster@verify.fishhawk.top
EOF

# 3. 启动服务
mkdir -p -m 777 ./data/es/data ./data/es/plugins
docker compose up -d
```

启动后，访问 http://localhost 即可。

## 桌面端与安卓端运行（同一套 Web 代码）

项目已提供 `web` 子项目的跨端打包基础：

- 桌面端：Tauri
- 安卓端：Capacitor
- 统一入口：`web` 构建产物 `dist/`

### 1) 安装依赖

```bash
pnpm install
```

### 2) 桌面端（Tauri）

```bash
cd web
pnpm tauri:dev
# 或打包
pnpm tauri:build
```

### 3) 安卓端（Capacitor）

```bash
cd web
# 首次执行
pnpm android:add

# 同步 Web 构建产物到原生工程
pnpm cap:sync

# 使用 Android Studio 打开工程
pnpm android:open
```

### 4) API 地址策略

- Web 默认：`/api`（由 Web 服务侧反向代理处理）
- `VITE_API_MODE=native` 开发态：`/api`（沿用 Vite 代理）
- `VITE_API_MODE=native` 生产态默认：`https://n.novelia.cc/api`
- 可通过 `VITE_API_BASE_URL` 覆盖

### 5) 双端验收清单

- [ ] 启动应用（桌面/安卓）
- [ ] 小说检索与阅读
- [ ] 翻译任务下发与结果回显
- [ ] 缓存/存储数据可读写
- [ ] 网络异常后的重试/恢复
- [ ] 日志导出能力可用
