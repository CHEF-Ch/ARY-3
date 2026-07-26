# ARY 文档索引

本文用于帮助 Agent 和开发者快速找到当前权威文档。根目录 `PLAN.md` 负责近期任务窗口，根目录 `STATUS.md` 负责任务瞬时看板。

## APMD 阅读顺序

1. 先读根目录 `AGENTS.md`，确认长期协作规则、权威顺序和更新纪律。
2. 再读本文，按问题类型定位产品、领域、权限、计划、QA、发布或专项任务书。
3. 涉及长期任务、依赖、验收或非目标时，读 `ary.plan.md`。
4. 涉及近期优先级或下一步时，读根目录 `PLAN.md`。
5. 涉及当前状态、证据、风险、阻塞或有效决策时，读根目录 `STATUS.md`。

## 文档路由

| 文档 | 作用 |
| --- | --- |
| `ary-mvp.prd.md` | 产品目标、MVP 范围、角色路径、产品验收口径。 |
| `ary-domain-analysis.v0.3.md` | 领域概念、核心对象、关系和不变量。 |
| `ary-mvp.ia.md` | 信息架构、页面层级、导航、页面状态和 URL 建议。 |
| `ary-permission-matrix.md` | 资源动作级权限、角色范围和接口鉴权输入。 |
| `ary.plan.md` | 研发任务定义、工作域编号、任务产出、任务验收和 Demo 节奏。 |
| `ary-qa-plan.md` | 测试覆盖、回归要求和质量门。 |
| `ary-release-ops-plan.md` | 发布、监控、备份、值守和回滚要求。 |
| `ary-ca-integration-spec.md` | CA 接入契约草案，定义参赛过程中 CAConnection 登记与握手、多 CAConnection、push / fetch 边界、骑行状态消息、Projection 输入和评审前风险提示。 |
| `ux-hifi.taskbook.md` | UX-1 高保真原型任务书，定义视觉为主、体验为先的原型工作方式。 |
| `registration-ca-rules-alignment.taskbook.md` | PRD-TEMP-1 临时任务书，承接报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的一致性整改。 |

## 阅读建议

* 产品或范围问题：先读 `ary-mvp.prd.md`。
* 报名、RaceProject、CA 参赛语义调整：读 `registration-ca-rules-alignment.taskbook.md`，再同步 PRD、领域、IA、权限、QA、OPS 和 CA 契约。
* 架构、模型或权限问题：读 `ary-domain-analysis.v0.3.md` 和 `ary-permission-matrix.md`。
* 页面和体验问题：读 `ary-mvp.ia.md` 与 `ux-hifi.taskbook.md`，必要时参考 `../design-prototype/`。
* 项目推进问题：读 `ary.plan.md`，再看根目录 `PLAN.md`。
* 验收和上线问题：读 `ary-qa-plan.md` 与 `ary-release-ops-plan.md`。
