# ARY 第一次集成审查报告

日期：2026-06-20
审查分支：`merge-test`（team/main + A + B + C + E）
审查人：Claude

---

## 一、分支状态

| 分支 | 模块 | 编译 | 接口联通 | 审查结论 |
|------|------|------|---------|---------|
| `A-identity-communication` | identity + communication | ✅ | ✅ | 合入通过 |
| `B_parts`（已在 team/main） | race-mgmt | ✅ | ✅ | 合入通过 |
| `team/main`（C） | portfolio | ✅ | ✅ | 合入通过 |
| `feat/E-report-gen`（已 rebase） | report-gen | ✅ | ✅ | 合入通过 |
| `feat/d-projection-contracts-linzequn` | projection | — | — | ❌ 需重建分支 |

## 二、各模块审查

### A — identity + communication
- 注册/登录：`POST /auth/register` + `POST /auth/login` 正常
- Admin：`requireAdmin` 中间件生效，越权请求被拒
- 登录页：双卡片身份选择 + 表单切换
- Header：导航高亮，Login→/login 链接
- 前端：AdminView 含主办方审核队列，RiderProfile/Cooperation 已搭建骨架

### B — race-mgmt
- 赛事 CRUD + 状态流转（draft→published→registration）正常
- CTA 随状态联动更新
- 安全烟雾测试 7/7 通过（之前独立测试已验证）
- 前端：RacePage/OrganizerOverview/RiderView 完整

### C — portfolio
- 5 张表 21 个路由完整
- Works 创建校验 Registration 存在性（INV-09）
- Awards 三条唯一约束生效
- 前端：WorksPage/ResultsPage/JudgeView/OrganizerJudging 完整

### E — report-gen
- 三类报告生成（rider_report/race_report/review_summary）正常
- subjectRegistrationId 约束正确
- sourceCounts 在数据缺失时归零（不崩溃）
- 前端：ReviewPage 完整

### D — projection
- 服务端逻辑正确（8 种投影 + rebuild + feedItemType + fallback）
- **分支目录结构异常**：文件被嵌套到 `Desktop/ARY-3-main/` 下，`app.ts` 被删除
- 需从最新 main 重建分支，修复指南已交付

## 三、编译检查

| 端 | 结果 |
|----|------|
| server `tsc --noEmit` | ✅ 通过 |
| client `tsc --noEmit` | ✅ 通过 |

## 四、合并建议

1. 当前 `merge-test` 分支已验证 A+B+C+E 可同时运行，可直接推送到 `team/main`
2. D 修复分支后作为最后一次合入
3. 合并后全链路回归
