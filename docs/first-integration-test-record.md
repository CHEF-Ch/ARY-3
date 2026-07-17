# ARY 第一次集成测试记录

日期：2026-06-20
测试分支：`merge-test`（team/main + A + B + C + E 合并后）
测试方式：curl 接口级验证

---

## 测试环境

```
Server: http://localhost:3000
数据存储: JSON file store (database/data/)
测试用户: admin / admin123（手动赋予 admin+organizer+rider）
```

## 测试结果

| # | 接口 | 方法 | 结果 | 备注 |
|---|------|------|------|------|
| 1 | `/health` | GET | ✅ | 服务正常启动 |
| 2 | `/auth/register` | POST | ✅ | 注册成功，默认 rider 角色 |
| 3 | `/auth/login` | POST | ✅ | 登录成功，session Cookie 可用 |
| 4 | `/auth/me` | GET | ✅ | 返回当前用户信息 |
| 5 | `/admin/users/:id/roles` | PUT | ✅ | requireAdmin 生效：非 admin 返回 403 |
| 6 | `/races` | POST | ✅ | 赛事创建成功 |
| 7 | `/races` | GET | ✅ | 公开赛事列表 |
| 8 | `/races/:id` | GET | ✅ | 按 slug 查询 |
| 9 | `/races/:id/publish` | POST | ✅ | draft→published，visibility→public |
| 10 | `/races/:id` (status) | PATCH | ✅ | published→registration，CTA 更新为 Register |
| 11 | `/works` | POST | ✅ | 正确拒绝无 Registration 的提交（INV-09） |
| 12 | `/reports/generate` | POST | ✅ | race_report 生成成功，sourceCounts 正确归零 |

## 模块路由注册验证

| 模块 | 日志输出 | 状态 |
|------|---------|------|
| identity | `[identity] Routes registered: /auth/*, /admin/*` | ✅ |
| communication | `[communication] Routes registered: /communication/*` | ✅ |
| race-mgmt | `[race-mgmt] Routes registered: /races/*` | ✅ |
| portfolio | `[portfolio] Routes registered: /works/*, /judge-assignments/*, ...` | ✅ |
| report-gen | `[report-gen] Routes registered: /reports/*` | ✅ |

## 编译检查

| 检查项 | 结果 |
|--------|------|
| `server/ npx tsc --noEmit` | ✅ 无错误 |
| `client/ npx tsc --noEmit` | ✅ 无错误 |

## 已知未覆盖

- D projection 模块（分支异常，未合入，未测试）
- CA 接入全链路（B 的烟雾测试已单独验证，集成环境未重跑）
- 前端页面实际渲染（仅验证 API）
- 多角色并发访问
