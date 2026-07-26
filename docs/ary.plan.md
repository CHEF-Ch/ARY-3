# ARY MVP Plan

版本：v0.1
文档类型：Project Plan
状态：有效草案 / 项目任务定义入口
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`
近期任务窗口：`../PLAN.md`
任务瞬时看板：`../STATUS.md`

治理说明：

* 本文是 ARY MVP 的正式任务定义入口，承接 PRD、领域基线、权限矩阵、QA Plan 和 Release & Ops Plan。
* 本文定义长期任务、产出、验收和不做事项；不记录当前进度，也不强制任务与里程碑一一对应。
* 近期任务窗口和里程碑由根目录 `PLAN.md` 维护；任务瞬时状态由根目录 `STATUS.md` 维护。
* 稳定任务编号按工作域使用 `PRD`、`DEV`、`REL`、`OPS` 前缀；每个前缀各自从 1 开始编号。

编号规则：

| 前缀 | 工作域 |
| --- | --- |
| `PRD` | 产品方向、需求基线、文档冻结和产品事实校正。 |
| `UX` | 用户体验、视觉设计、高保真原型、交互状态和设计验收。 |
| `DEV` | 架构、数据模型、接口、应用实现和技术交付。 |
| `REL` | 验收、彩排、灰度、发布和 go / no-go 判断。 |
| `OPS` | 监控、备份、值守、回滚、事故处理和赛后归档。 |

依赖说明：

* 任务 ID 前缀和编号只表示工作域与稳定编号，不表示执行依赖。
* 执行前置、解锁、阻塞或完成依赖以本文依赖关系和任务定义为准。
* 若后续专项任务书定义了更细依赖，专项任务书必须回链本文或同步更新本文。

---

# 1. 文档目的

本文把 PRD 中的产品目标初步转成研发任务定义。本文负责在架构设计前粗分任务、产出、验收、风险和 Demo 节奏。

本文不是正式开发排期或交付承诺。正式项目计划应在架构文档、数据模型、CA 接入方案、Projection / Report 生成链路、权限落地方式、部署方案和技术栈确认后重估并细化。

交付原则：

* 先跑通首场赛事闭环，再增强体验。
* 先保证事实源和权限，再做投影和大屏。
* 每个任务都应有可验收产物。

---

# 2. 任务定义

## PRD-1 文档基线与范围确认

交付范围：

* PRD、领域模型、IA、权限矩阵、QA Plan、Project Plan、Release & Ops Plan 形成首轮基线。
* CA Integration Spec 保留占位，后续架构阶段补齐。

不做什么：

* 不做代码实现。
* 不展开完整 CA 接口契约。

验收用例：

* 文档之间没有 Team、Organization、RoleAssignment、手动 Session Summary 补交等冲突。
* PRD 能作为架构设计入口。

风险：

* CA 接入细节暂缺，后续可能影响技术排期。

是否可 demo：否。

## UX-1 UX/UI 高保真原型与设计基线

交付范围：

* 基于 PRD、IA、领域基线和权限矩阵输出 MVP 高保真 UX/UI 原型。
* 覆盖 Public Site、Race Console、Admin Console、Screen Console、Screen Display 的关键页面和关键状态。
* 明确 Gallery-first 首页、Race Page、Live Hall、Works、Results、Review、Rider Profile、Organizer / Rider / Judge View、Admin 用户与角色管理、大屏展示模式的视觉与交互基线。
* 输出桌面端和移动端关键视口设计，标注核心组件、页面状态、空态、错误态、权限差异和数据依赖。
* 明确哪些设计资产进入架构输入，哪些仍为视觉探索或后续增强。

不做什么：

* 不做代码实现。
* 不替代领域模型、权限规则、接口契约或数据库设计。
* 不展开 P1 / P2 平台化体验。

验收用例：

* 高保真原型能支撑公众、Rider、Organizer、Judge、Admin、Screen Operator 的 P0 主路径走查。
* 关键页面状态、权限入口和信息密度足以反推前端路由、组件边界、接口读取模型和 Projection 消费方式。
* 设计输出与 Gallery-first、实时 CA 接入、Projection 不作为事实源、原始 CA Session 默认不公开等核心约束不冲突。
* 设计基线被明确记录为 `M2` 架构设计输入之一。

风险：

* 如果没有高保真原型，架构设计会缺少页面状态、权限入口、信息密度和大屏展示约束，后续实现和接口设计容易返工。

是否可 demo：是，以可点击原型、设计稿走查或高保真静态页面走查验收。

## DEV-1 领域模型 + 权限 + 数据模型

交付范围：

* 基于领域基线设计聚合边界和数据模型草案。
* 将 `ary-permission-matrix.md` 转成接口鉴权规则。
* 明确 Race、User、Registration、RaceProject、CAConnection、Session、Work、JudgeAssignment、JudgingRecord、Award、Evidence、Report、Projection 的存储边界。

不做什么：

* 不做完整 UI。
* 不做多组织、多团队、多租户。

验收用例：

* 一个 User 对同一 Race 最多一个 Registration。
* 一个 Registration 最多一个 RaceProject 和一个主 Work；Registration approved 后由 ARY 幂等生成 RaceProject；一个 RaceProject 可在参赛过程中登记多个 CAConnection。
* 只有已登记、已握手、归属正确且未禁用的 CAConnection 后续数据可以进入 Projection、Evidence 或 Report 输入。
* RaceProject 聚合 CA 接入 failed / not_configured 不阻断提交、评审和 Award 流程，但应生成评审前风险提示。

风险：

* 如果权限范围定义不清，后续 Console 会出现越权风险。

是否可 demo：可用数据模型和权限用例 demo。

## DEV-2 Public Site 静态闭环

交付范围：

* Home / Race Gallery。
* Race Page。
* Works / Work Page。
* Results。
* Cooperation。
* 使用 mock 或种子数据形成公开浏览路径。

不做什么：

* 不做真实登录和后台。
* 不做实时 Projection。

验收用例：

* 公众用户 2 次点击内进入当前主推赛事。
* 公众用户可以查看作品、赛果和评审总结 mock。

风险：

* 公开端容易过早做成营销页，需要保持 Gallery-first。

是否可 demo：是。

## DEV-3 登录 / 角色 / Race Console

交付范围：

* GitHub 登录。
* 资料补全。
* Admin Console 基础版。
* `User.roles` 维护。
* Race Console 框架和 Organizer / Rider / Judge View 入口。

不做什么：

* 不做完整赛事执行。
* 不做 Screen Console。

验收用例：

* 用户可登录并补全资料。
* Admin 可维护 `User.roles`。
* 不同 role 看到不同 Console 入口。

风险：

* 多 role 用户的视图切换和权限边界容易混淆。

是否可 demo：是。

## DEV-4 报名 / RaceProject / Work / Judge 结构流程

交付范围：

* Race 创建、发布、报名、审核。
* Registration 管理。
* RaceProject 自动生成和状态查看入口。
* Work 创建和提交的结构流程。
* JudgeAssignment 和 JudgingRecord 基础结构流程。
* 使用 mock eligibility 验证提交和评审路径。

不做什么：

* 不做完整 CA 实时接入。
* 不启用生产级 CA 接入证据完整度检查。
* 不承诺真实评审前风险提示完整性。
* 不做 Report Generator。

验收用例：

* Organizer 可以发布 Race 并审核报名。
* Rider 可以在 mock eligibility 下验证 Work 提交流程。
* Organizer 可以在 mock eligibility 下给 Judge 分配 Work。
* Judge 可以在 mock eligibility 下验证评分和评语提交流程。

风险：

* 如果 RaceProject 自动生成和 CA 接入状态未明确，后续 CA 接入任务会返工。
* 本任务的提交和评审只验证结构流程，真实证据完整度和评审前风险提示必须在 CA 接入任务完成后重新验收。

是否可 demo：是。

## DEV-5 CA 接入 / Projection / Live Hall

交付范围：

* CA 实时接入基础版。
* 参赛过程中 CAConnection 登记与握手校验。
* 已登记且握手成功 CAConnection 骑行信号接入。
* GitHub Repo / 代码材料绑定和引用。
* 多 CAConnection 接入状态追踪与 RaceProject 聚合状态。
* Riding Metrics 基础摘要。
* Projection 生成和重算。
* Live Hall 读取 Projection。

不做什么：

* 不接受事后上传 Session Summary 伪造实时 CA 证据。
* 不做完整多 CA 标准化协议。

验收用例：

* 接入成功的 Registration 可以形成骑行证据、Projection 和评审摘要。
* RaceProject 聚合接入 failed / not_configured 的 Registration 仍可进入提交、评审和 Award 流程，但必须生成评审前风险提示。
* 未登记、未握手、归属错误或被禁用的 CAConnection 数据不进入 Projection、Evidence 或 Report。
* 部分 CAConnection 接入失败不影响 Live Hall 整体展示。
* Projection 失败不污染事实数据。

风险：

* CA 来源数据格式不稳定。
* 实时性和稳定性可能影响赛事当天观感。

是否可 demo：是。

## DEV-6 Screen Console / 大屏联调

交付范围：

* Screen Console 基础版。
* Jumbotron / Billboard。
* Live / 榜单 / 作品 / 公告切换。
* 全屏展示。
* 大屏 fallback。

不做什么：

* 不做复杂主题系统。
* 不做独立 Data / Ops Console。

验收用例：

* 操作员可以选择 Race 并切换展示模式。
* 弱网或 Projection 异常时可 fallback 到稳定 Projection 或静态公告 / 榜单。

风险：

* 现场屏幕比例、浏览器环境和网络质量不可控。

是否可 demo：是，需现场或模拟大屏联调。

## DEV-7 Report / Review / Results

交付范围：

* Award / Leaderboard 发布。
* rider_report、race_report、review_summary。
* Report 生成、编辑、发布。
* Results / Review 与公开端联动。

不做什么：

* 不做高级 AI 自动评审。
* 不做奖项推荐。

验收用例：

* Organizer 可以发布榜单。
* Report 生成失败可手动重跑或人工编辑发布。
* 未发布 Report 不出现在 Public Site。

风险：

* Report 内容若缺少 Evidence 引用，会影响可信度。

是否可 demo：是。

## REL-1 赛事彩排 / 灰度发布 / 正式发布

交付范围：

* Staging 全流程彩排。
* 灰度发布。
* 生产环境发布。

不做什么：

* 开赛冻结窗口内不做非必要功能变更。
* 不临时改变 CA 数据接收和评审前风险规则。

验收用例：

* P0 回归一键跑通。
* 大屏、Live Hall、Report、Results 均完成彩排。
* go / no-go 判断有明确证据。

风险：

* 现场网络、CA 接入、投屏设备、突发数据异常。

是否可 demo：是，必须做完整彩排。

## OPS-1 赛事值守 / 回滚 / 赛后归档

交付范围：

* 赛事当天值守。
* 回滚方案和备份方案。
* 事故记录。
* 赛后归档和复盘。

不做什么：

* 不在冻结窗口内做非必要功能变更。
* 不临时改变已确认的赛事资格和发布规则。

验收用例：

* 值守表、回滚方案和备份方案已确认。
* 关键数据完成赛后归档。
* 事故和复盘有记录入口。

风险：

* 现场网络、CA 接入、投屏设备、突发数据异常。

是否可 demo：否，以演练和记录验收。

## OPS-2 赛事归档包导出与组织者交付

交付范围：

* 导出赛事归档包，覆盖赛事配置、报名与参赛记录、作品、评审记录、奖项、Report、Evidence / Projection 摘要和必要的运行记录索引。
* 形成可交付给组织者的归档包说明，包括包内容、生成时间、数据范围、已知缺口和复核入口。
* 明确归档包交付、确认和保存位置。

不做什么：

* 不替代生产数据库备份。
* 不承诺包含未发布、未授权公开或权限不允许交付的数据。
* 不做长期对象存储或跨赛事归档平台。

验收用例：

* Organizer 可以收到并打开归档包，按说明核对赛事关键产物。
* 归档包能追溯到已发布 Results / Review / Report 和必要证据摘要。
* 归档包记录生成时间、数据范围和未包含项。

风险：

* 若 Evidence、Report 或 Results 发布链路未完成，归档包内容会不完整。
* 若交付权限和脱敏规则不清，可能出现不应交付的数据。

是否可 demo：否，以导出产物和组织者确认记录验收。

---

# 3. 任务依赖关系

| 任务 | 依赖 / 前置 | 解锁 / 后续 |
| --- | --- | --- |
| `PRD-1` | 无；作为产品和文档基线入口。 | 解锁 `UX-1`、`DEV-1` 和后续架构输入。 |
| `PRD-TEMP-1` | 依赖 `PRD-1` 的主线口径；用于临时校正报名、RaceProject 和 CA 参赛语义。 | 复审通过后并入 `PRD-1` 基线，并同步影响 `DEV-1`、`DEV-5`、`REL-1`、`OPS-1`。 |
| `UX-1` | 依赖 PRD、IA、领域基线和权限矩阵。 | 验收后作为 `M2` 架构设计输入之一，影响 `DEV-2` 至 `DEV-7` 的页面和状态边界。 |
| `DEV-1` | 依赖 `PRD-1`、领域基线和权限矩阵；当前暂缓到 `UX-1` 高保真原型评审后继续。 | 解锁 `DEV-2` 至 `DEV-7` 的数据模型、接口鉴权和聚合边界。 |
| `DEV-2` | 依赖 `DEV-1` 的公开读取模型；可使用 mock 或种子数据先形成公开浏览路径。 | 为公开端 Works、Results、Review 联动提供页面基础。 |
| `DEV-3` | 依赖 `DEV-1` 的用户、角色和权限边界。 | 解锁 Race Console、Admin Console 和后续角色视图实现。 |
| `DEV-4` | 依赖 `DEV-1`、`DEV-3`；报名审核、RaceProject、Work 和 Judge 结构流程需先具备角色入口。 | 解锁 `DEV-5` 的真实 CA 接入、`DEV-7` 的评审和 Report 链路。 |
| `DEV-5` | 依赖 `DEV-1` 的数据模型、`DEV-4` 的 RaceProject / Work 结构和 CA 接入契约。 | 解锁 Projection、Live Hall、评审前风险提示和 `DEV-6` 大屏数据输入。 |
| `DEV-6` | 依赖 `DEV-5` 的 Projection 输出和 fallback 规则。 | 解锁发布前大屏联调和赛事彩排。 |
| `DEV-7` | 依赖 `DEV-4` 的 Work / Judge 结构、`DEV-5` 的 Evidence / Projection 输入和 Award 发布规则。 | 解锁 Results / Review 公开联动和 `REL-1` 完整彩排。 |
| `REL-1` | 依赖 P0 主路径、B/C/D/E 联调、QA Plan 和 Release & Ops Plan。 | 解锁 `OPS-1` 赛事值守、回滚和赛后归档。 |
| `OPS-1` | 依赖 `REL-1` 彩排、发布方案、值守表、备份和回滚方案。 | 支撑赛事当天运行和赛后复盘。 |
| `OPS-2` | 依赖 `OPS-1` 赛事值守和赛后归档入口；归档包内容依赖 Results / Review / Report / Evidence 发布状态。 | 支撑组织者交付确认和赛后留存。 |

---

# 4. 任务完成标准

每个任务完成时必须输出：

* 可演示产物或可审查设计。
* 任务验收记录。
* 未完成项和风险列表。
* 是否进入后续任务或里程碑的判断。
