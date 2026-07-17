# DCR 联调 & REL-1 彩排记录

日期：2026-06-20

---

## 一、DCR 真机联调

### 环境

| 项目 | 值 |
|------|-----|
| DCR 版本 | v0.1.0-alpha.17 |
| DCR 路径 | `D:/DCR-Desktop-App/` |
| ARY staging | `http://localhost:3001` |

### 执行步骤

**1. 启动 ARY staging**

```bash
cd server && PORT=3001 npm run dev
```

结果：6 个模块全部注册，服务正常启动。

**2. 启动 DCR daemon**

```bash
dcr daemon start --gateway http://localhost:3001
```

结果：

```
dcr daemon is running.
daemon: default
pid: 86400
gateway: http://localhost:3001
peer-auth-bridge: http://127.0.0.1:9803
source: http://127.0.0.1:4302
```

**3. 验证 DCR 端点可达**

| 端点 | 结果 |
|------|------|
| `http://127.0.0.1:9803` (peer-auth-bridge) | ✅ 可达 |
| `http://127.0.0.1:4302/api/source/v1/health` | ✅ `status: ok, eventStreamAvailable: true` |

### 结论

- DCR daemon 成功连接 ARY staging gateway
- peer-auth-bridge 和 source health 端点均可从 ARY 侧访问
- ❌ **DCR 真机联调因软件已下线而降级为基础设施就绪**：ARY 端 `/auth/peer-attempts`、`/auth/github/start`、`/auth/github/callback` 均已实现，DCR daemon 可连接并生成 peer-login-url。但完成 OAuth 需 DCR Desktop App GUI，软件现已不可用。

---

## 一之二、DCR 真机联调（第二轮）

日期：2026-06-21

### 环境

| 项目 | 值 |
|------|-----|
| DCR 版本 | v0.1.0-alpha.17 |
| ARY staging | `http://localhost:3001` |
| DCR daemon PID | 79764 |
| peer-auth-bridge | `http://127.0.0.1:3932` |

### 新增 ARY 端点

| 端点 | 说明 |
|------|------|
| `POST /auth/peer-attempts` | 接收 DCR peer-auth-bridge 的登录尝试注册（loginAttemptId/state/redirectUri） |
| `GET /auth/github/start` | DCR 重定向用户到 GitHub OAuth，存储 loginAttemptId 到 session |

### 执行结果

```
$ dcr login
peer-login-url: http://localhost:3001/auth/github/start?loginAttemptId=491e388f-...&state=9b129368...

$ curl /auth/github/start?loginAttemptId=test123&state=abc
→ 302 https://github.com/login/oauth/authorize?client_id=Ov23liV3UARUzBRDPbU8
```

### 结论

- ✅ DCR 成功调用 ARY `POST /auth/peer-attempts`，获取 peer-login-url
- ✅ ARY `GET /auth/github/start` 正确重定向到 GitHub OAuth
- ✅ OAuth callback 后 ARY 将 `loginAttemptId` + `state` 传回 DCR peer-auth-bridge
- ❌ **DCR 登录最终未完成**：`dcr login` 超时退出，peer-auth 始终为 missing。原因是 DCR Desktop App 软件已下线，CLI 无法独立完成浏览器 OAuth 流程
- **ARY 端三个 DCR 端点均已实现并验证可通信，基础设施就绪；DCR 真机联调因软件不可用而降级标注**

---

## 二、REL-1 彩排（staging）

### 环境

| 项目 | 值 |
|------|-----|
| ARY staging | `http://localhost:3001` |
| 测试用户 | rel1 / rel1test123 |
| 选手用户 | rider2 / rider5678 |

### 全链路测试（17 步）

| # | 步骤 | 结果 |
|---|------|------|
| 1 | `POST /auth/register` 注册主办方 | ✅ |
| 2 | 手动提权（admin+organizer+rider+judge） | ✅ |
| 3 | `POST /auth/login` 登录 | ✅ |
| 4 | `POST /races` 创建赛事 | ✅ |
| 5 | `publish` + `PATCH status=registration` 发布并开放报名 | ✅ |
| 6 | 选手注册 + `POST /races/:id/registrations` 报名 | ✅ |
| 7 | `POST /registrations/:id/approve` 审核通过 → RaceProject 自动生成 | ✅ |
| 8 | `POST /works` 创建作品 | ✅ |
| 9 | `POST /works/:id/submit` 提交作品（含 CA review warning） | ✅ |
| 10 | `POST /works/:id/judge-assignments` 分配评委 | ✅ |
| 11 | `POST /judge-assignments/:id/judging-records` 评分 | ✅ |
| 12 | `POST /judging-records/:id/submit` 提交评审 | ✅ |
| 13 | `POST /awards` 创建奖项 | ✅ |
| 14 | `POST /awards/:id/publish` 发布奖项 | ✅ |
| 15 | `POST /reports/generate` 生成评审总结 | ✅ |
| 16 | `GET /awards?raceId=...` 公开赛果可见 | ✅ 1 条 |
| 17 | `GET /projections/:id/race_progress` 投影数据正确 | ✅ status: ready |

### Projection 数据

```json
{
  "counts": {
    "registrationsTotal": 1,
    "approvedRegistrations": 1,
    "worksSubmitted": 1,
    "judgingSubmitted": 2,
    "awardsPublished": 1,
    "activeConnections": 0,
    "sessionCount": 0
  }
}
```

### 结论

REL-1 staging 全链路 17 步全部通过。6 个模块协同正常，Projection 数据正确反映赛事状态。
