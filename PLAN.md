# PLAN

本文是 ARY 近期任务窗口，记录近期要推进的任务和里程碑。长期任务定义见 `docs/ary.plan.md`；任务瞬时状态见 `STATUS.md`。

## 近期窗口

| 窗口 | 目标 |
| --- | --- |
| UX 高保真原型评审 | 完成 UX-1 第一轮高保真原型评审，确认能否作为架构设计输入继续推进。 |
| 报名 / CA 参赛语义整改 | 确认 Registration approved 自动生成 RaceProject、CAConnection 参赛中动态接入、CA 接入状态不再作为参赛资格硬门禁，并完成文档一致性整改。 |

## 近期任务

| 任务 | 目标 | 下一入口 |
| --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 完成首轮文档一致性检查，确认能否作为架构入口。 | `docs/ary.plan.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 已完成首轮整改并进入待复审：PRD、领域、CA 契约、IA、UX / 高保真原型、权限、QA、OPS 和计划文档已同步新口径。 | `docs/registration-ca-rules-alignment.taskbook.md` |
| `UX-1` UX/UI 高保真原型与设计基线 | 已产出 IA 对齐版 1080P 高密度高保真原型，后续页面按高保真页面工作流继续深化。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 输出聚合边界、数据模型草案和接口鉴权规则。 | `docs/ary-domain-analysis.v0.3.md` |
| `DEV-C` 模块 C portfolio 前端接入 | 后端迁移、路由、app 激活、前端代理和测试脚本已完成；`WorksPage`、`ResultsPage`、`JudgeView`、`OrganizerJudging` 均已完成真实 API 接入。 | `PLAN-C.md`、`client/src/pages/works/WorksPage.tsx`、`client/src/pages/results/ResultsPage.tsx`、`client/src/pages/console/JudgeView.tsx`、`client/src/pages/console/OrganizerJudging.tsx` |
| `B` race-mgmt 第一至四阶段加固 | 已合入 `main` 并完成合并后验证：Race 状态流转、Race 级管理权限、smoke test、B 前端中文业务化、赛事状态推进、DCR 握手 / 禁用连接、CA 接收审计摘要和动态传输安全复查均已收口。 | `server/src/modules/race-mgmt/routes.ts`、`server/src/app.ts`、`server/src/shared/auth.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs`、`client/src/pages/race/RacePage.tsx`、`client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx` |
| `DEV-5` CA 接入 / Projection / Live Hall | 已完成模块 D 第一轮实现、模块测试、稳定回退、静态 fallback、C/D 公开端联调与投影契约收敛：所有 projection / read model 读取接口现统一返回 `contractVersion`、`readKind`、`sourceOfTruth`、`consumerBoundary` 与 `fallback` 契约元信息；`server/src/modules/projection/test.sh` 已覆盖这些收敛后的 contract 断言。当前继续细化 `screen_feed` 编排与投影计算质量。 | `docs/ary-ca-integration-spec.md`、`server/src/modules/projection/routes.ts`、`server/src/modules/projection/test.sh`、`client/src/shared/apiTypes.ts` |

## 近期里程碑

| 里程碑 | 完成口径 |
| --- | --- |
| `M1` 文档基线可作为架构入口 | PRD、领域、IA、权限、QA、计划、OPS、CA 草案无高优先级冲突。 |
| `M2` 架构设计输入就绪 | 领域边界、权限规则、数据模型、CA 接入待定项、UX/UI 高保真原型和关键页面状态有明确输入。 |

## 下一步

1. 评审 `UX-1` IA 对齐版 1080P 高密度高保真原型，重点确认首页 Public Header、Race Gallery 层级、具体内容卡、蓝白竞赛视觉、Console 气质和 Screen Display 表达。
2. 后续高保真页面新增或整改时，使用 `.agents/skills/hifi-ui-page-workflow/SKILL.md`，先确认 IA 合约、数据面和已通过页面惯例，再进入页面实现和浏览器复审。
3. 暂缓 `DEV-1` 架构设计进入，直到 `UX-1` 的高保真原型和关键页面状态被确认可作为输入。
4. 复审 `PRD-TEMP-1` 整改后的 PRD、领域、IA、UX / 高保真原型、权限、QA、OPS 和 CA 契约一致性，确认是否可将临时任务并入正式 `PRD-1` 基线。
5. 继续细化 D 内部 `screen_feed` 编排协议，例如排序、轮播时长、推荐模式与静态 item 策略。
6. 继续校准 D 内部投影计算质量，例如 `current_leaderboard`、`risk`、`event_stream` 的口径与排序。
7. 在有 Git Bash 的环境中复跑 `server/src/modules/portfolio/test.sh`，确认 shell 脚本入口与已通过的 Node 等价验证一致。

## 执行纪律

* 开工前读取对应任务在 `docs/ary.plan.md` 中的定义。
* 近期窗口变化时更新本文；任务状态变化时更新 `STATUS.md`。
## 2026-06-20 D 模块补充

* 已完成 D 内部 `status-summary` 收敛增强：新增 `serveReadiness`、`publicReadable`、`screenReady`、`screenServeMode`、`modeCounts`、`lastSuccessfulByType`，用于直接判断投影层是否可服务。
* 已将该增强纳入 D 模块回归：`server/src/modules/projection/test.sh` 新增 readiness / fallback / per-type success index 断言。
* D 模块下一步优先方向继续限定在模块内：`screen_feed` 空模式替补策略、`current_leaderboard` 解释性、`risk/event_stream` 排序口径收敛。
* 已同步更新 `开发指南.md` 中的 D 模块章节：目录状态、交付物、fallback / read model / 状态摘要接口、测试入口与模块边界已与当前实现一致。
* 已新增 `Agent riding record 林泽群.md`，归档 D 模块第一轮实现、契约收敛、fallback、状态摘要增强与验证结论。
