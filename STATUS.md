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
* 模块 B race-mgmt 加固已从 `B_parts` 合入本地 `main`，当前等待合并后验证并推送 `origin/main`。

## 任务看板

| 任务 | 状态 | 当前判断 | 证据 / 下一入口 |
| --- | --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 进行中 | 业务文档已集中到 `docs/`，正在校准项目管理结构。 | `docs/README.md`、`docs/ary.plan.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 待复审 | 已完成首轮文档和原型整改：Registration approved 自动生成 RaceProject、参赛中可新增 CAConnection、CA 接入异常进入评审前风险提示而非硬门禁。需复审是否并入正式 `PRD-1` 基线。 | `docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-mvp.prd.md`、`docs/ary-domain-analysis.v0.3.md`、`design-prototype/` |
| `UX-1` UX/UI 高保真原型与设计基线 | 进行中 | 高保真原型已按 IA 重构为 1080P 高密度蓝白竞赛风格页面，并接入样例赛事数据驱动主要页面；页面可见文案已清理 PRD / 实现说明口吻，二级页面口号式大标题已降级为对象名和状态摘要；本轮已按明确审查标准修正首页 IA：Public Header 收敛为 Races / Works / Riders / Cooperation，Race 子页面入口回到具体 Race/赛果模块，底部快捷菜单移除，Hero 与 Featured Race 合体，Latest Results / Past Races 去重，开放报名 / 合作入口命名明确，首页独立 Leaderboards / Live Skill Board 已撤销，未登录态只显示 Login；首页整改经验已沉淀为通用高保真页面工作流 Skill，后续页面需先审 IA 合约、补足领域样例数据并复用已通过页面视觉 / 交互惯例。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html`、`design-prototype/README.md` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 暂缓 | 不能在缺少 UX/UI 高保真原型和关键页面状态输入时启动架构设计。 | `docs/ary-domain-analysis.v0.3.md`、`docs/ary-permission-matrix.md`、`docs/ary-mvp.ia.md` |
| `DEV-C` 模块 C portfolio 前端接入 | 待复审 | 后端 C0-C6 已完成并验证；四个前端页面均已替换为真实 API，包含公开 Works、最终榜单、评委评审和主办方评审 / Award 管理。OrganizerJudging 的主办方分配列表受后端缺少 listing 接口限制，仅展示本页新建或已知分配。 | `PLAN-C.md`、`client/src/pages/works/WorksPage.tsx`、`client/src/pages/results/ResultsPage.tsx`、`client/src/pages/console/JudgeView.tsx`、`client/src/pages/console/OrganizerJudging.tsx`、`server/src/modules/portfolio/routes.ts` |
| `B` race-mgmt 实现 | 待验证 / 待推送 main | `B_parts` 已合入本地 `main`：第一至四阶段加固及动态传输安全复查已进入主线工作区；下一步是在合并后复跑 `server` 的 `npm.cmd run test:race-mgmt` 与 `client` 的 `npm.cmd run build`，再推送 `origin/main`。 | `server/src/modules/race-mgmt/routes.ts`、`server/src/app.ts`、`server/src/shared/auth.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs`、`client/src/pages/race/RacePage.tsx`、`client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx` |
| `DEV-5` CA 接入 / Projection / Live Hall | 细化中 | 已将 CA 作为 Agent Race 工具、比赛信号源和评审参考的口径落盘；CAConnection 可在参赛过程中登记和握手，合法连接数据进入证据链，接入异常进入评审前风险提示；`task_progress` 仅用于 unblock / 说明，不做定期推送，且不设 `session_progress` push。 | `docs/ary-ca-integration-spec.md` |
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
| B race-mgmt `B_parts` 分支提交 `0cbf817 feat: harden race management flow` 已合入本地 `main`，等待合并后验证和推送 `origin/main` | `B_parts`、`main` |
| B race-mgmt 第一阶段加固已完成：Race 状态不能从 draft 直接跳 completed；Race 级 MANAGED_RACE 权限要求明确 raceOrganizerIds；安全 smoke test 增补重复报名、重复 approve 幂等、未握手 / 禁用 / 归属错误 / 篡改 / 重放 push 拒收和审计隔离 | `server/src/modules/race-mgmt/routes.ts`、`server/src/shared/auth.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs` |
| B race-mgmt 第二阶段前端复审体验已完成：Race Page 使用中文状态和阶段说明；Organizer Overview 展示报名审核、RaceProject 和 CA 风险摘要；Rider View 独立展示一次性 DCR 凭据、CAConnection 状态和“CA 异常不阻断作品提交”的业务语义 | `client/src/pages/race/RacePage.tsx`、`client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx` |
| B race-mgmt 第三阶段操作闭环已完成：Organizer Overview 接入赛事状态机推进动作；Rider View 接入 DCR HMAC-SHA256 握手和 CAConnection 禁用动作，连接禁用后后续 push 将由后端拒收并审计 | `client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx`、`server/src/modules/race-mgmt/routes.ts` |
| B race-mgmt 第四阶段 CA 审计可见性已完成：Organizer Overview 和 Rider View 读取 `/ca-connections/:id/ingestion-review`，展示 accepted Sessions、rejected pushes 和最近拒收原因，便于复审 DCR 防篡改 / 防重放 / 隔离审计能力 | `client/src/pages/console/OrganizerOverview.tsx`、`client/src/pages/console/RiderView.tsx`、`server/src/modules/race-mgmt/routes.ts` |
| B race-mgmt 动态传输安全复查已完成：拒收 push 不再消耗 nonce，避免伪造签名抢占合法 nonce；全局 JSON body 限制为 256KB，Session payload 限制为 64KB；ingestion-review 响应仅返回审计摘要，不再暴露 nonce / payloadHash；安全 smoke test 已覆盖这些断言 | `server/src/app.ts`、`server/src/modules/race-mgmt/routes.ts`、`server/src/modules/race-mgmt/security-smoke-test.mjs` |
| B race-mgmt 本轮验证通过：`server` 执行 `npm.cmd run test:race-mgmt`，`client` 执行 `npm.cmd run build` | 本地验证输出 |

## 风险与阻塞

| 项目 | 状态 |
| --- | --- |
| 架构、数据模型和接口契约尚未完成 | `DEV-1` 前置风险 |
| UX/UI 高保真原型和关键页面状态尚未评审验收 | `M2` 前置风险 |
| 报名 / RaceProject / CA 参赛语义已完成首轮整改，但仍需人工复审确认是否并入正式基线 | `PRD-TEMP-1` 待复审，重点看评审前风险命名、CAConnection 新增窗口和违规作品处理 |
| Git Bash 脚本入口尚未在本机直接跑通 | 当前环境 `bash.exe` 指向未配置 WSL；需在 Git Bash 环境复跑 `server/src/modules/portfolio/test.sh` |
| 本轮 in-app browser 自动化仍不可用 | 内置浏览器控制运行环境被 Windows 沙箱拒绝启动；已用 HTTP 响应验证代替自动化截图检查 |
