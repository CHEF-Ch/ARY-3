# PRD-TEMP-1 报名 / RaceProject / CA 参赛语义整改临时任务书

版本：v0.4
状态：核心对象与窗口口径冻结 / 待复审
任务编号：PRD-TEMP-1
上游入口：`ary-mvp.prd.md`、`ary-domain-analysis.v0.3.md`、`ary-ca-integration-spec.md`
关联任务：`PRD-1`、`DEV-1`、`DEV-4`、`DEV-5`、`UX-1`
当前目的：承接报名、RaceProject 自动生成、CAConnection 动态接入、评审前风险提示和接入审计线索的产品规则调整，形成一致性整改入口并防止旧 CA 资格门禁回归。

---

# 1. 背景

首轮整改前，文档曾把 CA 接入健康度与参赛业务流程错误耦合。二轮复审发现，临时任务书仍逐字保留废弃规则，导致自动一致性检查继续检出旧口径。现行任务书不再复述废弃规则原句，只保留迁移原因和目标行为。

新的产品意见提出三项调整：

1. ARY 为已批准的 Registration 自动生成 RaceProject。
2. 不要求在报名时确定全部 CA；参赛过程中可以随时增加 CA 接入。
3. CA 接入失败不影响参赛资格；空骑行、空作品、违规作品等应在评审前被识别，并提醒 Judge。

这会改变当前 PRD、领域模型、IA、权限、QA、发布运维和 CA 接入契约中的多处硬约束。因此需要先建立临时任务书，作为后续文档一致性整改的共同入口。

---

# 2. 整改目标

将 ARY MVP 的报名与参赛语义调整为：

```text
Registration approved
-> ARY 幂等生成 RaceProject
-> Rider 在参赛过程中可为 RaceProject 增加一个或多个 CAConnection
-> CA 数据作为骑行过程证据、Projection 输入和评审参考
-> CA 接入状态不作为参赛资格硬门禁
-> 系统在评审前识别空骑行、空作品、材料缺失、违规作品和接入异常
-> Organizer / Judge 在评审前和评审时看到风险提示
```

整改完成后，文档之间必须保持以下一致行为：

* Registration 状态只由报名审核和显式退出动作改变。
* RaceProject 聚合接入异常只生成风险提示和审计线索。
* Rider 可在规则允许的参赛窗口内新增 CAConnection。
* 提交、评审和 Award 不读取 CA 聚合状态作为拒绝条件。

---

# 3. 目标口径

## 3.1 Registration 与 RaceProject

* 一个 User 对同一 Race 最多一个 Registration。
* 一个 Registration 最多一个 RaceProject。
* Registration 进入 approved 后，ARY 自动创建 RaceProject。
* RaceProject 创建必须幂等；重复审批、重试或补偿任务不得生成多个 RaceProject。
* Rider View 不再要求 Rider 手动绑定 RaceProject，而是进入已生成的参赛工作区。

## 3.2 CAConnection 与骑行数据

* 一个 RaceProject 可有 0 个或多个 CAConnection。
* Rider 可在 registration、running、submitting 为自己的 RaceProject 新增和握手 CAConnection。
* CAConnection 必须先完成登记和握手，之后产生的数据才可进入有效证据链。
* 未登记、归属错误、未握手或被禁用的 CAConnection push 不得直接进入 Projection、Evidence 或 Report 输入。
* GitHub Repo / 代码材料仍只能作为作品代码入口或 Evidence 外部材料引用，不能伪装成实时 CA Session。
* 事后手动上传 Session Summary 不能伪造实时 CA 证据；如后续允许作为说明材料，必须标记来源、时间和可信度。

## 3.3 参赛资格与评审风险

* CA 接入状态不改变 Registration 资格状态。
* RaceProject aggregate ingestion failed / not_configured 只表达接入健康度或证据缺口，不表达 Registration 状态变化。
* 空骑行、无 CA 数据、空作品、缺必填材料、疑似违规、接入异常等进入评审前风险提示。
* 风险提示不自动替代 Judge 评分，也不自动决定 Award。
* CA 消息拒收只决定不可信数据不得进入事实链；拒收应形成脱敏审计线索，但不得改变 Registration、Work Submission、JudgingRecord 或 Award 资格。
* Organizer 可在评审前查看和处理风险；Judge 可在评审时看到与自己分配作品相关的风险摘要。

---

# 4. 整改范围

## 4.1 必改文档

| 文档 | 整改重点 |
| --- | --- |
| `ary-mvp.prd.md` | 产品硬约束、Rider View、CA Data Ingestion、状态定义、验收标准、风险章节 |
| `ary-domain-analysis.v0.3.md` | Registration Status、RaceProject Aggregate Ingestion Status、CAConnection Acceptance Window、评审前风险概念 |
| `ary-ca-integration-spec.md` | CAConnection 动态登记、握手、有效数据边界、失败语义、push / fetch 校验 |
| `ary-mvp.ia.md` | Rider View、Organizer CA Status、Judge View、CA 接入与证据完整度章节 |
| `ux-hifi.taskbook.md` | UX-1 设计护栏、Rider / Organizer / Judge 关键场景和高保真后续页面工作流 |
| `ary-permission-matrix.md` | Rider 新增 CAConnection 的状态窗口、Organizer / Admin 异常处理、Judge 风险摘要可见性 |
| `ary-qa-plan.md` | CA 失败不阻断提交评审、动态新增 CA、评审前风险提示、无主数据隔离 |
| `ary-release-ops-plan.md` | 赛事当天 CA 异常处理、告警语义、禁止事项 |
| `ary.plan.md` | DEV-1、DEV-4、DEV-5 的验收与不做事项 |
| `PLAN.md`、`STATUS.md` | 近期窗口、任务看板和风险同步 |

## 4.2 可能受影响产物

* `design-prototype/` 中 Rider / Judge / Organizer 页面若已表达 CA 资格门禁，需要后续复审和整改。
* 后续架构、数据模型和接口鉴权设计。

---

# 5. 不做事项

本临时任务不直接定义：

* 完整反作弊系统。
* 自动判罚或自动取消 Award 资格。
* 高级 AI 自动评审。
* 完整多 CA 标准化协议。
* 复杂申诉、仲裁和人工复核工作流。
* 团队参赛、多组织、多学校租户规则。

---

# 6. 建议执行步骤

## Step 1：PRD 口径先行

先修改 `ary-mvp.prd.md`，把产品级硬约束改成唯一新口径：

* Registration approved 后自动生成 RaceProject。
* CA 是过程证据和评审参考，不是参赛资格硬门禁。
* registration、running、submitting 可以新增和握手 CAConnection；正式 Session 只在 running、submitting 接收。
* 评审前风险提示承接空骑行、空作品、违规作品和接入异常。

## Step 2：领域与状态收敛

再修改 `ary-domain-analysis.v0.3.md`：

* Registration Status 不再由 CA 接入状态驱动 withdrawn。
* RaceProject Aggregate Ingestion Status 改为接入健康度。
* 旧锁定事件已收敛为 CAConnectionAcceptanceWindowClosed；窗口只控制连接登记、握手和 Session 接收，不表达资格变化。
* 领域统一命名为 ReviewFlag，API 展示字段统一为 `reviewWarnings`。

## Step 3：CA 契约重写

修改 `ary-ca-integration-spec.md`：

* 保留登记和握手，但不要求赛前锁死。
* 明确 running 后新增 CAConnection 的流程。
* 明确只有合法 CAConnection 后续数据可进入有效证据链。
* 明确接入失败只影响证据完整度和风险提示。

## Step 4：IA、权限、QA、OPS 同步

依次同步：

* IA：Rider View 从资格门禁改为证据完整度；Judge View 增加风险提示。
* UX-1：更新高保真任务书中的设计护栏，确保 CA 状态只表达证据完整度和风险。
* 高保真原型：复审 Rider / Organizer / Judge 相关页面，确保 CA 异常不会表现为提交禁用、Registration 状态变化或 CAConnection 新增入口提前关闭。
* 权限：Rider 可在参赛窗口内新增 CAConnection。
* QA：翻转原有阻断型测试，增加风险提示测试。
* OPS：CA 失败从资格事故改为数据完整性 / 评审风险事件。

## Step 5：计划和状态收口

最后同步 `ary.plan.md`、`PLAN.md`、`STATUS.md`，并用全文搜索清除旧口径残留。

---

# 7. 验收口径

本任务完成时应满足：

* 文档中不再把 CA 接入失败定义为 Registration 状态变化。
* 文档中不再把 CA 聚合成功定义为 Work Submission 的前置硬门禁。
* 文档中明确 Registration approved 后由 ARY 自动生成 RaceProject。
* 文档中明确 Rider 可在 registration、running、submitting 新增和握手 CAConnection。
* 文档中明确未登记、未握手、归属错误或被禁用的 CA 数据不得污染 Projection、Evidence、Report。
* 文档中明确评审前风险提示的用途、边界和可见角色。
* UX-1 设计护栏不再表达 CA 接入资格门禁。
* 高保真原型中 Rider / Organizer / Judge 关键页面不再表达旧资格门禁；首轮已整改页面后续新增或改版时必须继续防回归。
* PRD、领域、IA、权限、QA、OPS、CA Spec、项目计划之间无高优先级冲突。

建议使用行为断言验收，而不是仅依赖关键词：

* failed / not_configured 时 Work Submission 返回成功并携带 Review Warning。
* CA 异常时 JudgeAssignment、JudgingRecord 和 Award 路径保持可用。
* 不可信 CA 消息被拒收，且 Ingestion Audit 可追溯、评审摘要已脱敏。
* Public 响应不包含内部 Review Warning 或 Ingestion Audit。

---

# 8. 已冻结决策与剩余风险

| 项目 | 冻结结论 / 风险 |
| --- | --- |
| ReviewFlag 命名 | 领域使用 ReviewFlag；API 使用 `reviewWarnings`；禁止使用资格判定式命名。 |
| Work 内容准入 | 标题以及 repoUrl / demoUrl 至少一项必填；缺失时保持 draft。CA 状态不参与内容准入。 |
| CAConnection 登记与握手窗口 | registration、running、submitting 开放；judging 起关闭。 |
| 正式 Session 接收窗口 | 仅 running、submitting 开放；其他状态拒收并写接入审计。 |
| 疑似违规处理 | 生成 ReviewFlag，由 Organizer 人工处理、Judge 参考；不自动改变 Registration、评审或 Award。 |
| UX / 高保真原型防回归 | 已完成首轮复审和整改；后续 Rider / Organizer / Judge 页面新增或改版时，需继续避免表达旧资格门禁 |

---

# 9. 当前建议

本任务已完成 v0.4 一致性整改：RaceProject 明确为参赛工作区，CAConnection 承载单个外部 CA 实例；登记 / 握手与正式 Session 接收窗口已分离；ReviewFlag、作品内容准入和疑似违规人工处理已冻结；窗口规则、接入审计和 CA 非门禁行为测试均已落地。建议作为 `PRD-1` 的子任务复审，并在确认后并入正式文档基线。

在本任务复审完成前，`DEV-5` 不应重新把 CAConnection 接入健康度与 Registration、提交、评审或 Award 状态机耦合。
