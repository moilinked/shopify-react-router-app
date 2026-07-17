# Prisma 使用说明

## 什么是 Prisma

Prisma 是 Node.js / TypeScript 的 ORM（对象关系映射）工具，让你用 TypeScript 代码操作数据库，而不用手写 SQL。

```typescript
// 手写 SQL
db.query("SELECT * FROM Session WHERE shop = 'my-store.myshopify.com'");

// 使用 Prisma（类型安全，有自动补全）
prisma.session.findMany({ where: { shop: "my-store.myshopify.com" } });
```

---

## 项目中的 Prisma 结构

```
prisma/
├── schema.prisma       # 模型定义文件（数据库的「设计图纸」）
├── dev.sqlite          # SQLite 数据库文件（实际存储数据）
└── migrations/         # 迁移记录
    ├── migration_lock.toml                # 锁定数据库类型（sqlite）
    └── 20260225013411/migration.sql       # 创建 Session 表的 SQL
```

---

## 核心文件说明

### `prisma/schema.prisma` — 模型定义

```prisma
generator client {
  provider = "prisma-client-js"    // 生成 TypeScript 客户端代码
}

datasource db {
  provider = "sqlite"              // 数据库类型：SQLite
  url      = "file:dev.sqlite"    // 数据库文件路径
}

model Session {
  id            String    @id              // 主键
  shop          String                     // 店铺域名
  state         String                     // OAuth 状态
  isOnline      Boolean   @default(false)  // 是否在线会话
  scope         String?                    // API 权限范围（可选）
  expires       DateTime?                  // 过期时间（可选）
  accessToken   String                     // Shopify API 访问令牌
  userId        BigInt?                    // 用户 ID（可选）
  firstName     String?                    // 名（可选）
  lastName      String?                    // 姓（可选）
  email         String?                    // 邮箱（可选）
  accountOwner  Boolean   @default(false)  // 是否店铺所有者
  locale        String?                    // 语言区域（可选）
  collaborator  Boolean?  @default(false)  // 是否协作者
  emailVerified Boolean?  @default(false)  // 邮箱是否验证
}
```

**Schema 语法速查：**

| 语法 | 含义 | 示例 |
|---|---|---|
| `String` | 文本类型 | `shop String` |
| `Boolean` | 布尔类型 | `isOnline Boolean` |
| `DateTime` | 日期时间 | `expires DateTime?` |
| `BigInt` | 大整数 | `userId BigInt?` |
| `@id` | 主键 | `id String @id` |
| `@default(value)` | 默认值 | `@default(false)` |
| `?` | 可选（可为 null） | `scope String?` |

### `prisma/dev.sqlite` — 数据库文件

SQLite 的所有数据存在这一个文件中，不需要运行数据库服务器。

> **注意：** 该文件包含 accessToken 等敏感数据，已在 `.gitignore` 中排除，不会提交到 Git。

### `prisma/migrations/migration_lock.toml` — 数据库类型锁

锁定迁移历史对应的数据库类型，防止意外切换。如果要换数据库（如 PostgreSQL），需要删除整个 `migrations/` 目录重新生成。

---

## 项目中的数据流

```
prisma/schema.prisma          ← 定义 Session 模型
        │
        ▼ prisma generate
        │
node_modules/@prisma/client   ← 生成 TypeScript 客户端代码
        │
        ▼ import
        │
app/db.server.ts               ← 创建 Prisma 客户端单例
        │
        ▼ import
        │
app/shopify.server.ts          ← 传给 PrismaSessionStorage
        │
        ▼
Shopify SDK 自动管理 Session    ← 安装时写入 / 认证时读取 / 卸载时删除
```

### `app/db.server.ts` — 客户端单例

```typescript
import { PrismaClient } from "@prisma/client";

// 开发环境：复用全局实例，避免热更新时重复创建连接
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();
export default prisma;
```

### `app/shopify.server.ts` — 交给 Shopify SDK

```typescript
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  // ...
  sessionStorage: new PrismaSessionStorage(prisma),
});
```

Shopify SDK 通过 `PrismaSessionStorage` 自动调用 `prisma.session.create()` / `findUnique()` / `delete()` 管理会话，无需手动操作。

---

## 常用命令

### `npx prisma generate`

根据 `schema.prisma` 生成 TypeScript 客户端代码到 `node_modules/@prisma/client`。

**什么时候用：** 修改了 `schema.prisma` 之后，或者刚 clone 项目执行 `pnpm install` 之后。

```bash
npx prisma generate
```

### `npx prisma migrate dev`

**开发环境专用。** 对比 `schema.prisma` 和当前数据库的差异，自动生成迁移 SQL 并执行。

**什么时候用：** 在 `schema.prisma` 中添加/修改/删除了 model 字段。

```bash
# 会提示输入迁移名称
npx prisma migrate dev

# 直接指定名称
npx prisma migrate dev --name add_product_table
```

执行后会在 `prisma/migrations/` 下生成新的迁移目录和 SQL 文件。

### `npx prisma migrate deploy`

**生产环境专用。** 执行所有未应用的迁移，不会生成新迁移。

**什么时候用：** 部署到服务器时初始化/更新数据库结构。

```bash
npx prisma migrate deploy
```

> 项目中 `package.json` 的 `setup` 脚本就是调用的这个命令：
> `"setup": "prisma generate && prisma migrate deploy"`

### `npx prisma studio`

打开浏览器中的可视化数据库管理界面，可以直接查看和编辑表中的数据。

**什么时候用：** 想看数据库里存了什么数据（如已安装 App 的店铺 session 信息）。

```bash
npx prisma studio
# 默认在 http://localhost:5555 打开
```

### `npx prisma db push`

直接将 `schema.prisma` 的变更推到数据库，**不生成迁移文件**。

**什么时候用：** 快速原型开发阶段，不需要保留迁移历史。

```bash
npx prisma db push
```

> **注意：** 不推荐在正式开发中使用，因为没有迁移记录，无法回滚。

### `npx prisma migrate reset`

**危险操作。** 删除数据库中所有数据，重新执行所有迁移。

**什么时候用：** 开发时想重置数据库到初始状态。

```bash
npx prisma migrate reset
```

> **警告：** 会丢失所有数据，已安装的店铺需要重新安装 App。

---

## 添加新模型示例

如果将来需要存储自定义业务数据，在 `schema.prisma` 中添加新的 model：

```prisma
model Product {
  id         String   @id @default(uuid())
  shopDomain String
  title      String
  syncedAt   DateTime @default(now())
}
```

然后执行：

```bash
npx prisma migrate dev --name add_product_table
```

之后就可以在代码中使用：

```typescript
import prisma from "./db.server";

// 创建
await prisma.product.create({
  data: { shopDomain: "my-store.myshopify.com", title: "Blue T-Shirt" },
});

// 查询
const products = await prisma.product.findMany({
  where: { shopDomain: "my-store.myshopify.com" },
});

// 更新
await prisma.product.update({
  where: { id: "xxx" },
  data: { title: "Red T-Shirt" },
});

// 删除
await prisma.product.delete({ where: { id: "xxx" } });
```

---

## 参考链接

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma Schema 参考](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
- [Shopify Prisma Session Storage](https://www.npmjs.com/package/@shopify/shopify-app-session-storage-prisma)
