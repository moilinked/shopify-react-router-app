# Waterdrop Shopify App 部署文档

## 目录

- [架构概览](#架构概览)
- [一、服务器配置（一次性）](#一服务器配置一次性)
  - [1.1 环境要求](#11-环境要求)
  - [1.2 安装 Docker](#12-安装-docker)
  - [1.3 创建项目目录](#13-创建项目目录)
  - [1.4 配置 SSL 证书](#14-配置-ssl-证书)
  - [1.5 创建环境变量文件](#15-创建环境变量文件)
  - [1.6 配置安全组](#16-配置安全组)
  - [1.7 首次启动](#17-首次启动)
- [二、GitHub Actions 配置（一次性）](#二github-actions-配置一次性)
  - [2.1 配置 Secrets](#21-配置-secrets)
  - [2.2 Workflow 说明](#22-workflow-说明)
  - [2.3 如何触发部署](#23-如何触发部署)
- [三、日常运维](#三日常运维)
  - [3.1 常用命令](#31-常用命令)
  - [3.2 查看日志](#32-查看日志)
  - [3.3 版本回滚](#33-版本回滚)
  - [3.4 SSL 证书续期](#34-ssl-证书续期)
  - [3.5 数据备份](#35-数据备份)

---

## 架构概览

```
GitHub Actions (手动触发)
    │
    ├── 1. 构建 Docker 镜像
    ├── 2. 推送到 GitHub Container Registry (ghcr.io)
    └── 3. SSH 连接阿里云
        ├── 同步 docker-compose.yml 和 nginx 配置（从仓库）
        ├── 拉取最新镜像
        └── 重启容器

阿里云服务器内部：

    外部流量
        │
        ▼
  ┌──────────┐      ┌──────────┐
  │  Nginx   │ ───▶ │   App    │
  │ :80/:443 │      │  :3000   │
  └──────────┘      └──────────┘
                         │
                    ┌────┴────┐
                    │ SQLite  │
                    │ (volume)│
                    └─────────┘
```

- **Nginx**：处理 SSL 终止、HTTP→HTTPS 跳转、反向代理
- **App**：Shopify 应用容器，监听 3000 端口
- **SQLite**：通过 Docker Volume 持久化，容器重建不丢数据

### 项目仓库中的部署文件

```
项目仓库
├── Dockerfile                     # 应用镜像构建
├── .dockerignore                  # 构建排除文件
├── .github/workflows/deploy.yml   # 构建+部署工作流
└── deploy/                        # 部署配置（自动同步到服务器）
    ├── docker-compose.yml         # 容器编排
    └── nginx/
        └── default.conf           # Nginx 反代 + SSL
```

> `docker-compose.yml` 和 Nginx 配置**放在仓库中版本控制**，每次部署自动同步到服务器。
> 服务器上只需手动维护 `.env`（敏感信息）和 `ssl/`（证书文件）。

---

## 一、服务器配置（一次性）

> 以下操作在阿里云服务器上执行，只需配置一次。

### 1.1 环境要求

| 项目     | 要求                  |
| -------- | --------------------- |
| 操作系统 | Ubuntu 22.04          |
| 内存     | ≥ 1GB（推荐 2GB）     |
| Docker   | ≥ 20.10               |
| 域名     | 已解析到服务器公网 IP |
| SSL 证书 | 阿里云 DV 证书        |

### 1.2 安装 Docker

```bash
# 安装 Docker（阿里云镜像加速）
curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun

# 启动并设置开机自启
systemctl enable docker && systemctl start docker

# 验证安装
docker --version
docker compose version
```

### 1.3 创建项目目录

```bash
sudo mkdir -p /opt/waterdrop/nginx/ssl
```

> 部署完成后服务器的目录结构如下：
>
> ```
> /opt/waterdrop/
> ├── docker-compose.yml   ← 由 GitHub Actions 自动同步
> ├── .env                 ← 手动创建（敏感信息）
> └── nginx/
>     ├── default.conf     ← 由 GitHub Actions 自动同步
>     └── ssl/
>         ├── fullchain.pem  ← 手动上传（SSL 证书）
>         └── privkey.pem    ← 手动上传（SSL 私钥）
> ```

### 1.4 配置 SSL 证书

**使用阿里云购买的 DV 证书：**

1. 登录阿里云控制台 → **数字证书管理服务**
2. 找到你的证书 → 点击 **下载** → 选择 **Nginx** 格式
3. 下载后得到两个文件，上传到服务器：

```bash
# 在你的本地电脑执行
scp 你的域名.pem  root@服务器IP:/opt/waterdrop/nginx/ssl/fullchain.pem
scp 你的域名.key  root@服务器IP:/opt/waterdrop/nginx/ssl/privkey.pem
```

4. 在服务器上确认文件权限：

```bash
chmod 600 /opt/waterdrop/nginx/ssl/privkey.pem
chmod 644 /opt/waterdrop/nginx/ssl/fullchain.pem
```

### 1.5 创建环境变量文件

在服务器 `/opt/waterdrop/.env` 写入：

```bash
cat > /opt/waterdrop/.env << 'EOF'
# GitHub 仓库名（小写，用于 docker-compose 镜像地址）
GITHUB_REPO=你的github用户名/waterdrop-shopify-app

# Shopify App 配置（从 Partner Dashboard 获取）
SHOPIFY_API_KEY=你的API_KEY
SHOPIFY_API_SECRET=你的API_SECRET
SCOPES=write_products
SHOPIFY_APP_URL=https://你的域名.com

# 数据库（SQLite 持久化路径，对应 Docker Volume 挂载点）
DATABASE_URL=file:/app/data/sqlite.db
EOF
```

> **安全提示**：`.env` 文件包含敏感信息，仅存在于服务器上，不要提交到 Git。

### 1.6 配置安全组

在阿里云控制台 → **ECS 实例** → **安全组规则**，确保以下端口已开放：

| 端口 | 协议 | 来源                      | 用途                   |
| ---- | ---- | ------------------------- | ---------------------- |
| 22   | TCP  | 你的 IP / 0.0.0.0（按需） | SSH 远程登录           |
| 80   | TCP  | 0.0.0.0/0                 | HTTP（自动跳转 HTTPS） |
| 443  | TCP  | 0.0.0.0/0                 | HTTPS                  |

> **不要开放 3000 端口**，所有外部流量通过 Nginx 代理进入。

### 1.7 首次启动

首次启动前，需要先在 GitHub Actions 中运行一次构建（deploy 选 `no`），将镜像推送到 ghcr.io。然后：

```bash
cd /opt/waterdrop

# 登录 ghcr.io（使用 GitHub Personal Access Token，需有 read:packages 权限）
echo "你的GITHUB_TOKEN" | docker login ghcr.io -u 你的GitHub用户名 --password-stdin

# 启动所有服务
docker compose up -d

# 确认容器运行状态
docker compose ps

# 查看启动日志
docker compose logs -f
```

看到 App 日志输出类似 `Listening on port 3000` 表示启动成功。

浏览器访问 `https://你的域名.com`，确认能正常打开。

---

## 二、GitHub Actions 配置（一次性）

### 2.1 配置 Secrets

进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

| Secret 名称      | 值                           | 说明                                          |
| ---------------- | ---------------------------- | --------------------------------------------- |
| `DEPLOY_HOST`    | `1.2.3.4`                    | 阿里云服务器公网 IP                           |
| `DEPLOY_USER`    | `root`                       | SSH 登录用户名                                |
| `DEPLOY_SSH_KEY` | SSH 私钥内容                 | 见下方获取方式                                |
| `DEPLOY_TOKEN`   | GitHub Personal Access Token | 需有 `read:packages` 权限，用于服务器拉取镜像 |

**获取 SSH 私钥：**

在你本地能 SSH 到服务器的电脑上执行：

```bash
cat ~/.ssh/id_rsa
```

将完整输出（包含 `-----BEGIN` 和 `-----END` 行）粘贴到 Secret 中。

**创建 DEPLOY_TOKEN（Personal Access Token）：**

1. 打开 GitHub → 右上角头像 → **Settings** → 左侧 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. 点击 **Generate new token (classic)**
3. 勾选 `read:packages` 权限
4. 生成后复制 Token，添加到仓库 Secrets 中

> `GITHUB_TOKEN` 是 Actions 运行时自动注入的，但它的作用域仅限于 Actions runner 内部，无法在阿里云服务器上使用，因此服务器拉取镜像需要单独的 `DEPLOY_TOKEN`。

### 2.2 Workflow 说明

当前 `.github/workflows/deploy.yml` 的完整流程：

```
手动触发 (workflow_dispatch)
    │
    ├── 选择是否部署（deploy: yes/no）
    │
    ├── Build Job
    │   ├── Checkout 代码
    │   ├── 设置 Docker Buildx（支持缓存加速）
    │   ├── 登录 GitHub Container Registry
    │   └── 构建镜像并推送（标签: latest + commit SHA）
    │
    └── Deploy Job（仅 deploy=yes 时执行）
        ├── Checkout 代码
        ├── SCP 同步 deploy/ 目录到服务器
        │   （docker-compose.yml + nginx/default.conf）
        └── SSH 到服务器
            ├── 使用 DEPLOY_TOKEN 登录 ghcr.io
            ├── docker compose pull app（拉取新镜像）
            ├── docker compose up -d --force-recreate app（重启容器）
            └── docker image prune -f（清理旧镜像）
```

**关键特性：**

| 特性                      | 说明                                           |
| ------------------------- | ---------------------------------------------- |
| `workflow_dispatch`       | 手动触发，不会因 push 代码自动部署             |
| `deploy` 选项             | 可选择只构建镜像不部署（用于验证构建是否正常） |
| 自动同步配置文件          | `deploy/` 目录中的文件每次部署自动同步到服务器 |
| `cache-from/to: type=gha` | 利用 GitHub Actions 缓存层，后续构建显著加速   |
| 双标签 `latest` + `SHA`   | 始终有最新版可用，也保留历史版本用于回滚       |
| `--force-recreate app`    | 仅重建 App 容器，Nginx 不受影响                |

### 2.3 如何触发部署

1. 打开 GitHub 仓库页面
2. 点击顶部 **Actions** 标签
3. 左侧选择 **Build and Deploy**
4. 点击右侧 **Run workflow** 按钮
5. 选择要部署的分支（通常为 `main`）
6. `deploy` 选择 `yes`（仅构建则选 `no`）
7. 点击绿色 **Run workflow**
8. 等待 workflow 完成（通常 2~5 分钟）

---

## 三、日常运维

> 以下命令在服务器 `/opt/waterdrop` 目录下执行。

### 3.1 常用命令

```bash
cd /opt/waterdrop

# 查看所有容器状态
docker compose ps

# 重启应用
docker compose restart app

# 手动更新（不通过 GitHub Actions）
docker compose pull app && docker compose up -d app

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会丢失 SQLite 数据）
docker compose down -v

# 清理无用镜像释放磁盘
docker image prune -f
```

### 3.2 查看日志

应用使用 [Pino](https://github.com/pinojs/pino) 结构化日志库，通过 `pino.transport()`（`pino/file`，worker 线程）**直接写入日志文件**，绕开 Node.js 主进程 stdout 的管道缓冲；容器启动阶段（pnpm、Prisma 迁移等）的输出则由 shell `tee` 另存一份，便于排障。

日志持久化到服务器 `/opt/waterdrop/logs/` 目录，容器重建不会丢失：

```
/opt/waterdrop/logs/
├── app/
│   ├── app.log            # App 业务日志（JSON 格式，由 Pino worker 直写）
│   └── startup.log        # 容器启动阶段输出（pnpm / prisma migrate / react-router-serve）
└── nginx/
    ├── access.log         # Nginx 访问日志（JSON 格式）
    └── error.log          # Nginx 错误日志
```

> **说明**：`app.log` 仅包含 Pino 产生的结构化业务日志；启动相关输出（端口监听、迁移结果、依赖告警等）请查看 `startup.log` 或 `docker compose logs app`。

**App 日志格式示例：**

```json
{"level":30,"time":1710820800000,"msg":"Webhook received","shop":"example.myshopify.com","topic":"app/uninstalled"}
{"level":50,"time":1710820801000,"msg":"SSR render error","err":{"type":"Error","message":"..."}}
```

| 级别值 | 名称  | 用途                          |
| ------ | ----- | ----------------------------- |
| 30     | info  | 关键业务事件（Webhook、启动） |
| 40     | warn  | 需关注但不影响功能            |
| 50     | error | 影响功能的错误                |

**实时查看：**

```bash
# App 业务日志（原始 JSON）
tail -f /opt/waterdrop/logs/app/app.log

# App 业务日志（格式化阅读，需安装 pino-pretty）
tail -f /opt/waterdrop/logs/app/app.log | npx pino-pretty

# 容器启动阶段输出（pnpm / prisma / 监听端口等）
tail -f /opt/waterdrop/logs/app/startup.log

# Nginx 访问日志
tail -f /opt/waterdrop/logs/nginx/access.log

# Nginx 错误日志
tail -f /opt/waterdrop/logs/nginx/error.log
```

**搜索/过滤：**

```bash
# 搜索 App 日志中的错误（level 50 = error）
grep '"level":50' /opt/waterdrop/logs/app/app.log

# 按 shop 过滤 Webhook 日志
grep '"shop":"example.myshopify.com"' /opt/waterdrop/logs/app/app.log

# 查看 Nginx 中所有 5xx 错误
grep '"status": 5' /opt/waterdrop/logs/nginx/access.log

# 查看历史压缩日志
zcat /opt/waterdrop/logs/app/app.log.2.gz
```

**也可以用 docker compose 方式查看（不含历史）：**

```bash
docker compose logs -f app
docker compose logs --tail=100 app
docker compose logs --since="2026-03-19T00:00:00" app
```

**日志轮转策略：**

| 配置     | 说明                                           |
| -------- | ---------------------------------------------- |
| 轮转频率 | 每天一次                                       |
| 保留天数 | 7 天                                           |
| 压缩     | 旧日志自动压缩为 `.gz`                         |
| 配置文件 | `/etc/logrotate.d/waterdrop`（部署时自动同步） |

### 3.3 版本回滚

每次部署都会生成 commit SHA 标签的镜像，回滚步骤：

```bash
cd /opt/waterdrop

# 1. 查看可用的镜像版本
docker images ghcr.io/你的用户名/waterdrop-shopify-app

# 2. 修改 docker-compose.yml 中 app 的 image 标签
#    将 :latest 改为 :目标commit的SHA
#    例如: ghcr.io/oreah/waterdrop-shopify-app:a1b2c3d

# 3. 重启
docker compose up -d app
```

### 3.4 SSL 证书续期

阿里云 DV 证书到期前需要手动续期：

1. 在阿里云控制台续期/重新申请证书
2. 下载新证书（Nginx 格式）
3. 替换服务器上的证书文件：

```bash
# 在本地执行
scp 新证书.pem  root@服务器IP:/opt/waterdrop/nginx/ssl/fullchain.pem
scp 新证书.key  root@服务器IP:/opt/waterdrop/nginx/ssl/privkey.pem

# 在服务器上重启 Nginx 使新证书生效
cd /opt/waterdrop
docker compose restart nginx
```

### 3.5 数据备份

SQLite 数据存储在 Docker Volume 中，备份方式：

```bash
# 查看 volume 在宿主机的实际路径
docker volume inspect waterdrop_app-data

# 备份数据库文件
docker compose exec app cp /app/data/sqlite.db /app/data/sqlite.db.bak
docker cp $(docker compose ps -q app):/app/data/sqlite.db.bak ~/backup/sqlite-$(date +%Y%m%d).db

# 建议：设置 crontab 定时备份
# crontab -e
# 0 3 * * * docker cp $(cd /opt/waterdrop && docker compose ps -q app):/app/data/sqlite.db ~/backup/sqlite-$(date +\%Y\%m\%d).db
```

---

## 附录

### A. Dockerfile 说明

项目 Dockerfile 使用单阶段构建，基于 `node:22-alpine`：

| 步骤         | 作用                                                   |
| ------------ | ------------------------------------------------------ |
| 安装系统依赖 | `openssl`（Prisma 需要）、`pnpm`（corepack）           |
| 安装项目依赖 | `pnpm install --frozen-lockfile`                       |
| 构建项目     | `pnpm run build`                                       |
| 创建日志目录 | `/app/logs`（Pino transport + 启动 tee 共用）          |
| 启动命令     | `pnpm run docker-start`（运行 Prisma 迁移 + 启动服务） |

日志写入分两路：

- **业务日志** 由 Pino 的 `pino.transport()`（`pino/file`）在 worker 线程中直写 `/app/logs/app.log`，不阻塞主线程，也不经过 stdout 管道缓冲；
- **启动阶段输出** 由 CMD 中的 `tee -a /app/logs/startup.log` 捕获 pnpm、Prisma、服务启动的 stdout/stderr，便于排障。

### B. 完整文件清单

| 位置     | 文件                                | 来源     | 说明                     |
| -------- | ----------------------------------- | -------- | ------------------------ |
| 项目仓库 | `Dockerfile`                        | —        | 多阶段构建配置           |
| 项目仓库 | `.dockerignore`                     | —        | Docker 构建排除文件      |
| 项目仓库 | `.github/workflows/deploy.yml`      | —        | 构建+部署工作流          |
| 项目仓库 | `deploy/docker-compose.yml`         | —        | 容器编排配置             |
| 项目仓库 | `deploy/nginx/default.conf`         | —        | Nginx 反代 + SSL 配置    |
| 服务器   | `/opt/waterdrop/docker-compose.yml` | 自动同步 | 每次部署从仓库同步       |
| 服务器   | `/opt/waterdrop/nginx/default.conf` | 自动同步 | 每次部署从仓库同步       |
| 服务器   | `/opt/waterdrop/.env`               | 手动创建 | 生产环境变量（敏感信息） |
| 服务器   | `/opt/waterdrop/nginx/ssl/*.pem`    | 手动上传 | 阿里云 DV 证书文件       |
