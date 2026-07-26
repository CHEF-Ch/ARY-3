# AGENTS.md

本文定义 ARY 项目中 Agent 协作的长期规则。业务细节以 `docs/` 下的权威文档为准。

## 工作规范

* 项目文档、计划、状态更新和协作说明优先使用中文。
* 开始任务前先读根目录 `PLAN.md`，再按任务入口阅读 `docs/` 下的相关文档。
* 不把临时进度写进长期规则；近期窗口写入 `PLAN.md`，任务状态写入 `STATUS.md`。

## 文档入口

* 产品入口：`docs/ary-mvp.prd.md`
* 任务定义：`docs/ary.plan.md`
* 文档路由：`docs/README.md`
* 近期窗口：`PLAN.md`
* 任务看板：`STATUS.md`

## APMD 权威顺序

* 长期协作规则以本文为准；业务范围、任务定义和验收口径以 `docs/` 下的权威文档为准。
* `docs/ary.plan.md` 负责长期任务定义、依赖关系、产出、验收和非目标。
* `PLAN.md` 只负责近期窗口、当前优先级、近期任务和下一步。
* `STATUS.md` 只负责当前结论、任务看板、证据、风险 / 阻塞和有效决策。
* 文档冲突时，先按上述职责定位真相源；无法裁决时记录为确认点，不静默覆盖。

## 执行纪律

* 实施前确认目标、产出、验收口径和不做事项。
* 完成任务、改变近期窗口或改变重要产物后，更新 `PLAN.md` 和 `STATUS.md`。
* 修改长期范围、验收口径或发布要求时，同步更新对应的 `docs/` 文档。
* 重要结论必须能追溯到用户指令、仓库文件或验证结果。

## Focus 提交纪律

* 需要提交 CA session focus 时，使用 `CaSessionFocusDeclarationSubmitRequest`。
* `sourceRefs.sourceType` 只使用契约允许值：`apmd`、`ca-session-source`、`cli`、`system`。
* 引用 `PLAN.md`、`STATUS.md`、`docs/ary.plan.md` 或其它 APMD 文档时，`sourceType` 使用 `apmd`，不要使用 `file`。
* Focus 只记录本次工作所需的目标、来源和边界；不要把临时执行流水写入长期规则。
