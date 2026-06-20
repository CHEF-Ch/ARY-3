# STATUS

本文是 ARY 任务瞬时看板，记录当前任务状态、证据和风险。不记录历史流水。

## 当前结论

* 项目处于 MVP 文档基线与架构前准备阶段。
* 业务文档已集中到 `docs/` 下。
* 当前正式项目任务定义入口是 `docs/ary.plan.md`。
* `PRD-TEMP-1` 已完成首轮整改，报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的新口径已同步到主要文档和高保真原型。
* `UX-1` 已产出第一轮高保真原型和设计说明，但尚未评审验收，不能直接进入 `M2` 或启动架构设计。
* 当前已有 server/client 应用代码；模块 C portfolio 后端路由、迁移、代理和测试脚本已完成一轮实现与验证。
* 模块 C 前端接入已完成当前要求的四个页面：`WorksPage`、`ResultsPage`、`JudgeView`、`OrganizerJudging` 均已完成真实 API 接入。
* 模块 B race-mgmt 加固已合入 `main`，并通过合并后的后端 race-mgmt smoke test 与前端构建验证。
* 模块 D projection 已完成第一轮落地：后端 projection 路由、`013-projections.sql`、Home / Live Hall / Screen Console / Screen Display 页面已接入，`server` 构建与 `client` 类型检查 / 生产构建已通过；`server/src/modules/projection/test.sh` 已跑通模块级回归；读取接口已显式返回 `live` / `stable_fallback` / `static_fallback`，页面会提示当前是否在使用最近一次稳定 Projection 或静态 fallback；Results / Review 已切到统一读取模型；所有 projection / read model 响应已收敛到统一契约元信息。

## 任务看板

| 任务 | 状态 | 当前判断 | 证据 / 下一入口 |
| --- | --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 进行中 | 业务文档已集中到 `docs/`，正在校准项目管理结构。 | `docs/README.md`、`docs/ary.plan.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 待复审 | 已完成首轮文档和原型整改：Registration approved 自动生成 RaceProject、参赛中可新增 CAConnection、CA 接入异常进入评审前风险提示而非硬门禁。需复审是否并入正式 `PRD-1` 基线。 | `docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-mvp.prd.md`、`docs/ary-domain-analysis.v0.3.md`、`design-prototype/` |
| `UX-1` UX/UI 高保真原型与设计基线 | 进行中 | 高保真原型已按 IA 重构为 1080P 高密度蓝白竞赛风格页面，并接入样例赛事数据驱动主要页面；页面可见文案已清理 PRD / 实现说明口吻，二级页面口号式大标题已降级为对象名和状态摘要；本轮已按明确审查标准修正首页 IA：Public Header 收敛为 Races / Works / Riders / Cooperation，Race 子页面入口回到具体 Race/赛果模块，底部快捷菜单移除，Hero 与 Featured Race 合体，Latest Results / Past Races 去重，开放报名 / 合作入口命名明确，首页独立 Leaderboards / Live Skill Board 已撤销，未登录态只显示 Login；首页整改经验已沉淀为通用高保真页面工作流 Skill，后续页面需先审 IA 合约、补足领域样例数据并复用已通过页面视觉 / 交互惯例。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html`、`design-prototype/README.md` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 暂缓 | 不能在缺少 UX/UI 高保真原型和关键页面状态输入时启动架构设计。 | `docs/ary-domain-analysis.v0.3.md`、`docs/ary-permission-matrix.md`、`docs/ary-mvp.ia.md` |
| `DEV-C` 模块 C portfolio 前端接入 | 待复审 | 后端 C0-C6 已完成并验证；四个前端页面均已替换为真实 API，包含公开 Works、最终榜单、评委评审和主办方评审 / Award 管理。OrganizerJudging 的主办方分配列表受后端缺少 listing 接口限制，仅展示本页新建或已知分配。 | `PLAN-C.md`、`client/src/pages/works/WorksPage.tsx`、`client/src/pages/results/ResultsPage.tsx`、`client/src/pages/console/JudgeView.tsx`、`client/src/pages/console/OrganizerJudging.tsx`、`server/src/modules/portfolio/routes.ts` |
| `B` race-mgmt 实现 | 已完成 | 已合入 `main`：第一至四阶段加固及动态传输安全复查已进入主线，并通过 `server` 的 `npm.cmd run test:race-mgmt` 与 `client` 的 `npm.cmd run build`。 | `server/src/modules/race-mgmt/routes.ts`、`server/src/app.ts`、`server/src/shared/auth.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs`、`client/src/pages/race/RacePage.tsx`、`client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx` |
| `DEV-5` CA 接入 / Projection / Live Hall | 进行中 | 已完成模块 D 第一轮实现、模块测试、稳定回退、静态 fallback、C/D 公开端联调与投影契约收敛：新增 `projections` migration 与 `/projections/:raceId/:type`、`POST /projections/:raceId/rebuild`；支持 `race_progress`、`registration_status`、`cost`、`risk`、`submission`、`judging`、`current_leaderboard`、`screen_feed` 八类投影与 `leaderboard_read_model`，并新增 `results_page_read_model`、`review_summary_read_model` 两个读取模型；首页、Live Hall、Screen Console、Screen Display、Results、Review 已接入真实 projection / read model API；所有 projection / read model 响应统一返回 `contractVersion`、`readKind`、`sourceOfTruth`、`consumerBoundary`、`fallback` 等契约元信息；读取接口仍会明确返回 `readMode`、`usingStableFallback`、`usingStaticFallback` 和 `fallbackReason`，页面能识别“当前看到的是最新投影、最近一次稳定投影，还是静态 fallback”。`server/src/modules/projection/test.sh` 已覆盖公开读取、私有赛事权限、Organizer 重建、过程榜/最终榜边界、Results / Review 读取模型、契约元信息、`screen_feed` 类型区分、稳定回退、静态 fallback 与投影持久化。当前继续细化 `screen_feed` 编排与投影计算质量。 | `server/src/modules/projection/routes.ts`、`server/src/modules/projection/test.sh`、`client/src/shared/apiTypes.ts`、`client/src/pages/results/ResultsPage.tsx`、`client/src/pages/review/ReviewPage.tsx`、`client/src/pages/live/LivePage.tsx`、`client/src/pages/console/ScreenConsole.tsx`、`client/src/pages/screen/ScreenPage.tsx` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 待开始 | 等待开发任务和验收证据完成。 | `docs/ary-release-ops-plan.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 待开始 | 等待发布方案和赛事执行计划明确。 | `docs/ary-release-ops-plan.md` |

## 证据索引

| 结论 | 证据 |
| --- | --- |
| 文档集合存在且已集中到 `docs/` | `docs/*.md` |
| 长期任务定义入口为 `docs/ary.plan.md` | `docs/ary.plan.md` |
| 近期窗口入口为 `PLAN.md` | `PLAN.md` |
| CA 接入契约已形成原始骑行状态消息草案，仍需继续讨论完善 | `docs/ary-ca-integration-spec.md` |
| 报名 / RaceProject / CA 参赛语义整改已形成临时任务书 | `docs/registration-ca-rules-alignment.taskbook.md` |
| 当前仓库包含设计原型 | `design-prototype/` |
| UX/UI 高保真原型已作为 `M2` 前置验收任务进入看板 | `PLAN.md`、`docs/ary.plan.md` |
| UX-1 高保真原型已按 IA 和 1080P 视口修订并通过本地截图验证 | `design-prototype/index.html`、`design-prototype/*.png` |
| UX-1 样例赛事数据已生成并接入原型渲染，用于支撑 IA 页面密度和状态差异 | `design-prototype/data/sample-races.json`、`design-prototype/data/sample-races.js`、`design-prototype/script.js` |
| UX-1 页面可见文案已去除 PRD、需求说明和实现术语口吻 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/data/sample-races.json`、`design-prototype/README.md` |
| UX-1 二级页面口号式大标题已降级为对象名和状态摘要 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 本轮 IA 整改已完成：公开导航边界、Home Gallery 模块、单场 Results、Works 筛选/详情入口、Race Riders 入口、Review 下一场、Rider 能力证据、Screen 输出/控制边界，且静态兜底与动态渲染一致 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页 IA 复审标准已落地：顶层导航不放 Race 子页面，CTA 依附具体 Race / 作品 / 合作场景，首页不设置独立 Leaderboards 模块 | `docs/ary-mvp.ia.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/README.md` |
| UX-1 外审意见已落实：Hero 直接承载 Featured Race 信息，Latest Results / Past Races 去重，Next Entry 改为开放报名 / 合作入口，Header 按未登录态只显示 Login | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Leaderboards 已撤销：Live Skill Board 从首页移除，过程榜保留在 Live Hall，最终榜保留在 Results | `docs/ary-mvp.ia.md`、`docs/ary-mvp.prd.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页视觉复审已处理：右侧首卡从重复 Race Card 改为 Open Registration，首页 page-label 横线已隐藏，避免与 Public Header 分隔线冲突 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页 Live Now 结构已修正：独立 Live Now 框已撤销，Hero / Featured Races 直接支持 live Race 切换 | `docs/ary-mvp.ia.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/README.md` |
| UX-1 首页 title 层级已修正：不在顶部额外强调 Series / Gallery title，当前 Live Race title 居中成为首屏主标题，下划线式 Live Race 切换器位于标题下方，赛题位于切换器下方 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 品牌区 logo 已修正：使用 ico 原图展示，移除额外圆形套框、描边和外圈光晕 | `design-prototype/index.html`、`design-prototype/styles.css` |
| UX-1 首页布局节奏已调整：Header 更轻，Hero 信息组上移并压缩，赛道视觉下沉，作品 / Rider 卡缩高并落在赛道下缘，右侧信息栈与主 Hero 保持错落间距 | `design-prototype/styles.css` |
| UX-1 首页 Live Race 切换器已简化：取消重复赛事文字，只保留下划线式选择指示，并加入自动轮播切换 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Live Race 未激活切换线已增强为浅蓝可见状态，active 状态仍保持深蓝加长 | `design-prototype/styles.css` |
| UX-1 右侧信息卡头部状态标签已降噪：从高饱和蓝色实心 pill 改为浅蓝描边淡底标签，避免抢主 Hero 注意力 | `design-prototype/styles.css` |
| UX-1 首页赛道 Riding Signal 角标已移到赛道容器左上，避免与轨迹节点产生关系误读 | `design-prototype/script.js` |
| UX-1 首页右侧辅助信息已改为 Drawer：默认只露出窄 Rail，点击后从右侧滑出 Open Registration、Latest Results、Past Races 和 Cooperation 四个模块 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Live Title 已按 Drawer 默认收起态重新居中，Hero 信息组与赛道主画布中轴对齐 | `design-prototype/styles.css` |
| UX-1 品牌区 logo 已替换为马头罗盘 PNG，生成透明底裁切版并按竖向比例调整 Header 图标容器 | `design-prototype/assets/logo-horse-compass-transparent.png`、`design-prototype/index.html`、`design-prototype/styles.css` |
| UX-1 首页设计与交互短视频已录制，覆盖默认首页、Live Race 切换、右侧 Drawer 打开 / 收起，并内嵌字幕说明 | `design-prototype/recordings/ary-homepage-demo.mp4` |
| UX-1 首页整改经验已沉淀为通用高保真页面工作流 Skill，并在任务书和原型 README 中引用；后续页面需先审 IA、补领域样例数据、复用已通过页面视觉 / 交互惯例，再浏览器复审 | `.agents/skills/hifi-ui-page-workflow/SKILL.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/README.md` |
| DEV-C portfolio 已完成后端实现和验证：server 构建通过，client 构建通过，C6 等价 Node 验证覆盖主要正常 / 异常路径 | `server/src/modules/portfolio/routes.ts`、`server/src/modules/portfolio/test.sh`、`server/src/app.ts`、`client/vite.config.ts` |
| DEV-C WorksPage 阶段 1 mock UI 已完成：列表、详情、`raceSlug` 筛选和 review warnings 权限展示已接入 mock 数据 | `client/src/pages/works/WorksPage.tsx` |
| DEV-C 前端页面深链接空白问题已定位并修复：Vite proxy 不再把 `Accept: text/html` 的页面导航转发给后端 API，临时 5174 dev server 验证 `/works`、`/works/packpulse`、`/races/alpine-agent-race` 均返回 React HTML | `client/vite.config.ts` |
| DEV-C 前端新增中文展示约束：除必要专有名词外，页面可见文案优先使用中文；WorksPage 阶段 1 和公共 Header 已按该规则调整 | `PLAN-C.md`、`client/src/pages/works/WorksPage.tsx`、`client/src/shared/Header.tsx` |
| DEV-C WorksPage 阶段 2 已完成：列表和详情改为真实 API，支持 loading / error / empty；详情优先按 id 请求，slug 路径回退到公开列表匹配后再按 id 取详情 | `client/src/pages/works/WorksPage.tsx` |
| DEV-C ResultsPage 阶段 1 mock UI 已完成：mock published Award 数据字段对齐 `toAwardResponse`，按 `awardName` 分组并按 `rank` 升序展示 rank、registrationId、workId、decisionReason | `client/src/pages/results/ResultsPage.tsx` |
| DEV-C ResultsPage 阶段 2 已完成：通过 `raceSlug` 读取 Race，再按 `raceId` 调用 `/awards?raceId=`，支持 loading / error / empty 并保留按 awardName / rank 展示 | `client/src/pages/results/ResultsPage.tsx` |
| DEV-C JudgeView 阶段 1 mock UI 已完成：使用 `useAuth()` 判断登录态，展示 mock assignment、reviewWarnings、draft / submitted 评分表单状态、已提交记录列表，并校验赛果评分和骑行评分必填 | `client/src/pages/console/JudgeView.tsx` |
| DEV-C JudgeView 阶段 2 已完成：替换为 `GET /judge-assignments/mine`，接入创建草稿、编辑草稿和提交评审接口，支持 loading / error / empty 和 400 / 403 / 409 提示 | `client/src/pages/console/JudgeView.tsx`、`server/src/modules/portfolio/routes.ts` |
| DEV-C OrganizerJudging 阶段 1 mock UI 已完成：使用 `useAuth()` 判断登录态，展示作品管理、评委分配、奖项管理、评审进度四个区域，支持本地 lock / publish、分配 / 删除、Award 草稿编辑 / 发布和重复创建提示 | `client/src/pages/console/OrganizerJudging.tsx` |
| DEV-C Console 入口检查已完成：`评审与奖项` 按 `organizer` role 展示；修正了无角色用户也会默认看到赛事管理内容的问题，当前本地 `recyclable06` 已具备 `organizer` / `judge` / `rider` 角色，可用于视觉审查 | `client/src/pages/console/ConsoleShell.tsx`、`database/data/users.json` |
| DEV-C OrganizerJudging 阶段 2 已完成：作品列表、锁定、发布、评委分配、删除分配、Award 列表、创建草稿、编辑草稿和发布均接入真实 API；loading / error / empty 与 400 / 403 / 409 提示已处理 | `client/src/pages/console/OrganizerJudging.tsx`、`server/src/modules/portfolio/routes.ts` |
| DEV-5 模块 D 第一轮实现已完成：投影只读消费 B/C 事实表，不回写上游；`screen_feed` 明确输出 `feedItemType` 区分 live / 过程榜 / 最终榜 / 作品 / 公告；首页、Live Hall 和 Screen 页已接入真实 projection 读取 | `server/src/modules/projection/routes.ts`、`client/src/pages/home/HomePage.tsx`、`client/src/pages/live/LivePage.tsx`、`client/src/pages/console/ScreenConsole.tsx`、`client/src/pages/screen/ScreenPage.tsx` |
| DEV-5 当前验证已通过：`server` 执行 `npm.cmd run build`；`client` 执行 `.\node_modules\.bin\tsc.cmd --noEmit` 与 `npm.cmd run build` | 本地验证输出 |
| DEV-5 模块测试已通过：`server/src/modules/projection/test.sh` 在 Git Bash 环境跑通，覆盖公开/私有读取权限、Organizer 重建、过程榜与最终榜边界、`screen_feed` 类型区分及 8 条 projection 持久化 | `server/src/modules/projection/test.sh` |
| DEV-5 稳定回退语义已落地：projection 失败但已有稳定快照时，接口返回 `stable_fallback`，并暴露 `fallbackReason`；Live Hall、Screen Console、Screen Display 会提示当前正在使用最近一次稳定 Projection | `server/src/modules/projection/routes.ts`、`client/src/pages/live/LivePage.tsx`、`client/src/pages/console/ScreenConsole.tsx`、`client/src/pages/screen/ScreenPage.tsx` |
| DEV-5 静态 fallback 已落地：当 projection 失败且没有稳定快照时，接口返回 `static_fallback`；静态兜底数据来自赛事状态、公告、公开作品和最终榜单，不读取原始 Session；Live Hall、Screen Console、Screen Display 会提示当前处于静态 fallback | `server/src/modules/projection/routes.ts`、`server/src/modules/projection/test.sh`、`client/src/pages/live/LivePage.tsx`、`client/src/pages/console/ScreenConsole.tsx`、`client/src/pages/screen/ScreenPage.tsx` |
| DEV-5 C/D 公开端联调已落地：`ResultsPage` 读取 `results_page_read_model`，`ReviewPage` 读取 `review_summary_read_model`；最终榜单明确来自 `Award + leaderboard_read_model`，Review 在 E 未落地前会优雅降级到 Award / Winning Works / 导航入口，而不是直接暴露底层事实 | `server/src/modules/projection/routes.ts`、`client/src/pages/results/ResultsPage.tsx`、`client/src/pages/review/ReviewPage.tsx`、`server/src/modules/projection/test.sh` |
| DEV-5 投影契约收敛已落地：所有 projection / read model 响应统一返回 `contractVersion`、`readKind`、`sourceOfTruth`、`consumerBoundary` 与结构化 `fallback` 对象；模块测试已覆盖收敛后的 contract 断言 | `server/src/modules/projection/routes.ts`、`client/src/shared/apiTypes.ts`、`server/src/modules/projection/test.sh` |
| B race-mgmt `B_parts` 分支提交 `0cbf817 feat: harden race management flow` 已通过 merge commit `5878b0e Merge branch 'B_parts'` 合入 `main` | `B_parts`、`main` |
| B race-mgmt 第一阶段加固已完成：Race 状态不能从 draft 直接跳 completed；Race 级 MANAGED_RACE 权限要求明确 raceOrganizerIds；安全 smoke test 增补重复报名、重复 approve 幂等、未握手 / 禁用 / 归属错误 / 篡改 / 重放 push 拒收和审计隔离 | `server/src/modules/race-mgmt/routes.ts`、`server/src/shared/auth.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs` |
| B race-mgmt 第二阶段前端复审体验已完成：Race Page 使用中文状态和阶段说明；Organizer Overview 展示报名审核、RaceProject 和 CA 风险摘要；Rider View 独立展示一次性 DCR 凭据、CAConnection 状态和“CA 异常不阻断作品提交”的业务语义 | `client/src/pages/race/RacePage.tsx`、`client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx` |
| B race-mgmt 第三阶段操作闭环已完成：Organizer Overview 接入赛事状态机推进动作；Rider View 接入 DCR HMAC-SHA256 握手和 CAConnection 禁用动作，连接禁用后后续 push 将由后端拒收并审计 | `client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx`、`server/src/modules/race-mgmt/routes.ts` |
| B race-mgmt 第四阶段 CA 审计可见性已完成：Organizer Overview 和 Rider View 读取 `/ca-connections/:id/ingestion-review`，展示 accepted Sessions、rejected pushes 和最近拒收原因，便于复审 DCR 防篡改 / 防重放 / 隔离审计能力 | `client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx`、`server/src/modules/race-mgmt/routes.ts` |
| B race-mgmt 动态传输安全复查已完成：拒收 push 不再消耗 nonce，避免伪造签名抢占合法 nonce；全局 JSON body 限制为 256KB，Session payload 限制为 64KB；ingestion-review 响应仅返回审计摘要，不再暴露 nonce / payloadHash；安全 smoke test 已覆盖这些断言 | `server/src/app.ts`、`server/src/modules/race-mgmt/routes.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs` |
| B race-mgmt 合并后验证通过：`server` 执行 `npm.cmd run test:race-mgmt`，`client` 执行 `npm.cmd run build` | 本地验证输出 |

## 风险与阻塞

| 项目 | 状态 |
| --- | --- |
| 架构、数据模型和接口契约尚未完成 | `DEV-1` 前置风险 |
| UX/UI 高保真原型和关键页面状态尚未评审验收 | `M2` 前置风险 |
| 报名 / RaceProject / CA 参赛语义已完成首轮整改，但仍需人工复审确认是否并入正式基线 | `PRD-TEMP-1` 待复审，重点看评审前风险命名、CAConnection 新增窗口和违规作品处理 |
| Git Bash 脚本入口尚未在本机直接跑通 | 当前环境 `bash.exe` 指向未配置 WSL；需在 Git Bash 环境复跑 `server/src/modules/portfolio/test.sh` |
| 本轮 in-app browser 自动化仍不可用 | 内置浏览器控制运行环境被 Windows 沙箱拒绝启动；已用 HTTP 响应验证代替自动化截图检查 |
## 2026-06-20 D 模块更新

* D 模块已完成 `status-summary` 增强，新增 `serveReadiness`、`publicReadable`、`screenReady`、`screenServeMode`、`modeCounts`、`lastSuccessfulByType` 等可服务性字段。
* `status-summary` 的 projection/read model 条目已补充 `serveReady`、`publicReadable`，用于区分“可读”和“可对外服务”。
* 本轮验证已通过：`server` 执行 `npm.cmd run build` 成功，`client` 执行 `.\node_modules\.bin\tsc.cmd --noEmit` 成功，`C:\Program Files\Git\bin\bash.exe server/src/modules/projection/test.sh` 全量通过。
* 已同步更新 `开发指南.md`：D 模块不再标记为“待创建”，其 read model、fallback、`status-summary`、测试入口和跨模块边界已按当前真实实现收敛到指南。
* 已新增 `Agent riding record 林泽群.md`，整理 D 模块目标、阶段推进、边界判断、验证证据与后续优化方向，便于团队复审与归档。
