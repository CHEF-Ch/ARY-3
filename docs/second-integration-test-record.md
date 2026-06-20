# ARY 第二次集成测试记录（全套模块）

日期：2026-06-20
测试分支：`merge-test`（team/main + A + B + C + E + D）
测试方式：curl 接口级验证

---

## 模块路由注册

| 模块 | 日志 | 状态 |
|------|------|------|
| identity | `/auth/*, /admin/*` | ✅ |
| communication | `/communication/*` | ✅ |
| race-mgmt | `/races/*` | ✅ |
| portfolio | `/works/*, /judge-assignments/*, ...` | ✅ |
| report-gen | `/reports/*` | ✅ |
| projection | `/projections/*` | ✅ |

## 接口测试

| # | 模块 | 接口 | 结果 | 备注 |
|---|------|------|------|------|
| 1 | A | `POST /auth/register` | ✅ | |
| 2 | A | `POST /auth/login` | ✅ | |
| 3 | B | `POST /races` | ✅ | |
| 4 | B | `POST /races/:id/publish` | ✅ | draft→published |
| 5 | B | `PATCH /races/:id status` (published→running) | ✅ | 正确拦截非法状态流转 |
| 6 | D | `GET /projections/:id/race_progress` | ✅ | 返回完整投影数据含 contractVersion/feedItemType/fallback |
| 7 | E | `POST /reports/generate` | ✅ | race_report 生成成功 |
| 8 | C | `GET /works` | ✅ | 公开作品列表正常 |

## 编译

| 端 | 结果 |
|----|------|
| server `tsc --noEmit` | ✅ |
| client `tsc --noEmit` | ✅ |
