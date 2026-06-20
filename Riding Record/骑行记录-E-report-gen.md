# E 模块 Agent 骑行记录：Report Generator 协作开发

记录日期：2026-06-20  
项目：ARY 软件工程小组作业  
本人分工：E 模块，`report-gen`，比赛报告与个人成绩单生成  
协作分支：`feat/report-gen`  
提交记录：`3c19a71 feat: add report generation module`

---

## 1. 本次骑行目标

本次我使用 Agent 完成 E 模块的基础开发与协作提交。我的目标不是让 Agent 随意改完整个项目，而是在已有小组分工和接口约定下，完成自己负责的 `report-gen` 模块，并让同伴可以在 GitHub 上看到我的工作。

本次任务的核心目标包括：

* 明确 E 模块只负责报告生成、报告发布、Review 页和 Rider Report 展示。
* 不越界修改 B/C/D 模块的赛事、作品、榜单和投影逻辑。
* 按小组开发指南创建独立分支，避免直接污染 `main`。
* 生成可验证的后端接口、前端展示页面和测试脚本。
* 最后提交并推送到 GitHub，方便小组成员 review。

---

## 2. 我给 Agent 定义的边界

我在开工前重点提醒 Agent：这是小组协作项目，必须注意接口和协作规范，不能因为能改代码就随便改。Agent 先阅读了项目根目录的 `PLAN.md`、`STATUS.md`、`开发指南.md` 和 `待办与分工文档.md`，确认我的分工是 E 模块。

我给 Agent 划定了以下边界：

* 只实现 E 模块 `report-gen`，不改 B 的 `race-mgmt`、C 的 `portfolio`、D 的 `projection` 业务逻辑。
* 需要依赖其他模块数据时，先使用本地 mock 数据测试，不调用其他模块的 routes。
* 后端接口必须按开发指南约定：
  * `POST /reports/generate`
  * `GET /reports/:id`
  * `PATCH /reports/:id`
  * `POST /reports/:id/publish`
* 权限必须使用已有 `authorize()`，不能自己绕过鉴权。
* `rider_report` 必须关联 `subjectRegistrationId`。
* `race_report` 和 `review_summary` 必须不关联 `subjectRegistrationId`。
* 未发布 Report 不能进入 Public Site。
* 提交前必须创建独立分支，不能直接在 `main` 上推代码。

这一步让我感觉比较重要，因为软件工程作业不是只看功能有没有跑，而是看协作边界是否清楚。如果 Agent 没有先确认边界，可能会把同伴负责的模块一起改掉，后面合并时会很麻烦。

---

## 3. 关键回合记录：我如何判断和指挥 Agent

下面不是逐字聊天记录，而是我对本次 Agent Riding 的关键回合复盘。重点记录我在每一步如何判断风险、如何约束 Agent，以及如何根据反馈调整下一步。

### 回合一：先判断“能不能直接写代码”

我的第一反应不是马上让 Agent 实现 E 模块，而是先判断这个项目是否适合直接动代码。因为这是小组作业，仓库里已经有同伴改过的内容。如果我直接让 Agent 写，很可能出现三个问题：

* 改到别人负责的模块，造成合并冲突。
* 没按已有接口命名，导致后续联调对不上。
* 没按 Git 协作流程开分支，最后不知道怎么交给同伴。

所以我给 Agent 的第一条有效指令不是“开始写”，而是“先看项目和协作规定，尤其注意接口和小组分工”。这个指令的目的，是把 Agent 从“代码生成工具”拉回到“协作工程成员”的角色。

Agent 读取文档后，确认 E 模块对应 `report-gen`。这一步让我获得了第一个边界判断：我的任务不是完整实现 Results，也不是写评分系统，而是围绕 Report 做生成、编辑、发布和展示。

### 回合二：把 E 模块从大系统里切出来

确认分工后，我没有让 Agent 直接实现“报告系统”这个大概念，而是要求它说清楚 E 和其他模块的关系。

我的判断是：

* B 模块负责赛事、报名、RaceProject、CAConnection。
* C 模块负责作品、评委分配、评分、奖项和 Evidence。
* D 模块负责 Projection、大屏、Live Hall 和排行榜读取模型。
* E 模块只能消费这些数据生成报告，不能反向改写上游事实。

这个边界非常关键。比如报告里需要 Award 和 Evidence，但 E 不能自己创建 Award，也不能自己假装完成评分。否则短期看起来功能完整，长期会破坏模块分工。

因此我让 Agent 采用“读取上游数据 + mock 自测”的方式。也就是说，在 B/C/D 没有完全合并前，E 模块可以用本地假数据验证接口，但正式逻辑仍然按共享 JSON store 读取上游表。

### 回合三：先定接口契约，再写实现

在实现前，我重点要求 Agent 遵守 `开发指南.md` 中给 E 模块规定的接口：

* `POST /reports/generate`
* `GET /reports/:id`
* `PATCH /reports/:id`
* `POST /reports/:id/publish`

这里我做了一个取舍：不追求一次性做很漂亮的报告编辑后台，而是先把后端契约做稳。原因是小组协作时，接口比页面更像“合同”。只要接口稳定，前端和其他模块后续都能对接；如果先做页面但接口不稳定，后面返工会更多。

Agent 根据这个边界设计了 `reports` 的字段参考和路由模块，并把路由注册到 `server/src/app.ts`。我确认它没有 import 其他模块 routes，而是通过共享数据层读取数据，这符合开发指南里的跨模块调用规则。

### 回合四：把权限当成验收重点，而不是附加功能

报告模块最容易出问题的地方不是生成文字，而是“谁能看”。所以我要求 Agent 特别注意权限。

我的判断是：

* `review_summary` 是公开评审总结，发布后可以在 Public Review 页面展示。
* `race_report` 是赛事报告，发布后可以作为公开或主办方材料。
* `rider_report` 是个人成绩单，默认不应该公开。

因此我要求 Agent 实现两个硬约束：

* `rider_report` 必须有关联的 `subjectRegistrationId`。
* `race_report` 和 `review_summary` 必须没有 `subjectRegistrationId`。

Agent 最初实现后，我又关注到一个细节：现有 `auth.ts` 里的 `Report.view_private` 更偏 OWN 语义，不能完全表达 Organizer 查看 managed race 报告的情况。这里没有去改 A 模块的权限矩阵，因为那会影响别人负责的基础模块。我让 Agent 在 E 模块内部兼容现有权限：Rider 自己报告走 OWN，Organizer 管理范围读取则使用已有 managed-race 能力。这个决策避免了为了 E 模块去扩大修改 A 模块。

### 回合五：验证不只看“能跑”，还看“不该发生的事有没有被拒绝”

实现完成后，我没有只接受“页面能打开”这样的结果，而是要求 Agent 做构建和接口验证。

验证分成两类：

* 正向验证：可以生成并发布 `review_summary`，发布后 Public 可以读取。
* 反向验证：`race_report` / `review_summary` 如果错误携带 `subjectRegistrationId`，必须返回 400。

我认为反向验证更能体现工程质量。因为很多作业项目只验证成功路径，但真正的协作系统里，错误输入如果不拦住，后续数据会变乱。

本机没有 `bash`，所以 Agent 不能直接跑 `test.sh`。我没有让它跳过测试，而是接受它用等价 PowerShell HTTP 流程验证接口，同时保留 `test.sh` 给 Git Bash 环境使用。这个处理方式既尊重了小组文档，也适应了本机环境。

---

## 4. 本次产出

本次 Agent 骑行的实际产出如下：

| 类型 | 文件 | 说明 |
| --- | --- | --- |
| 后端模块 | `server/src/modules/report-gen/routes.ts` | E 模块报告生成、编辑、发布、读取接口 |
| 后端注册 | `server/src/app.ts` | 注册 `/reports/*` 路由 |
| 数据字段参考 | `database/migrations/014-reports.sql` | reports 表字段、状态、类型约束参考 |
| 模块测试 | `server/src/modules/report-gen/test.sh` | E 模块独立接口测试，使用 mock 数据并清理 |
| 前端 Review | `client/src/pages/review/ReviewPage.tsx` | 展示已发布 `review_summary` |
| 前端 Rider | `client/src/pages/rider/RiderPage.tsx` | 展示可见的个人成绩单 |
| 状态文档 | `STATUS.md` | 同步 E 模块当前状态和验证证据 |

---

## 6. 本次骑行中的关键决策

### 决策一：先开独立分支

我没有让 Agent 直接在 `main` 上提交，而是使用 `feat/report-gen` 分支。这样同伴可以 review，我也不会影响主分支。

### 决策二：不依赖未完成模块

B/C/D 模块还没有完全合并，所以 E 模块不能假设这些接口已经存在。Agent 使用 JSON store 里的 mock 数据来验证自己的接口，这是符合小组开发指南的。

### 决策三：权限不绕过已有框架

项目已有 `authorize()` 权限框架，所以 E 模块读取、编辑、发布报告时都要用现有鉴权规则。这样后续和 A 模块合并时不会形成另一套权限系统。

### 决策四：个人报告默认不公开

根据 PRD 和权限矩阵，`rider_report` 默认只给本人、主办方和管理员看。即使执行 publish，也保持 `private`。这避免了个人报告误公开的问题。

### 决策五：保留测试脚本

虽然当前 Windows 环境不能直接跑 `bash`，Agent 仍然保留了 `test.sh`，因为开发指南要求每个模块提供自己的测试脚本。这样同伴在 Git Bash 环境中仍然可以验证。

---

## 7. 验收结果

本次 E 模块基础版本达到以下验收点：

* 能生成 `rider_report`、`race_report`、`review_summary` 三类报告。
* 能编辑和发布报告。
* 能公开读取已发布 `review_summary`。
* 能保持 `rider_report` 私有读取边界。
* 能拒绝错误的 `subjectRegistrationId` 使用方式。
* 前端 Review 页可以读取公开评审总结。
* Rider 页可以展示当前用户可见的个人成绩单。
* 代码已经提交并推送到 GitHub 分支 `feat/report-gen`。

还没有完成的部分：

* B/C/D 模块尚未全部合并，所以完整赛事闭环还不能最终联调。
* Organizer 的报告管理页面还可以继续增强。
* 报告内容目前是基础草稿，后续可增加更丰富的评分摘要、Evidence 引用和获奖说明。
* 全链路 P0 回归需要等待小组其他模块合并后统一执行。

---

## 8. 个人总结

这次使用 Agent 的最大收获是：Agent 很适合做工程执行，但前提是我要先把问题讲清楚。尤其是在小组项目里，边界比速度更重要。

如果我只是说“帮我写 E 模块”，Agent 可能会一次性改很多文件，甚至影响别人负责的模块。实际过程中，我先强调“这是小组协作”“我的分工是 E”“接口和协作规定要十分注意”，Agent 才会先读文档、确认分工、创建分支、按模块边界实现。

我觉得这次骑行比较成功的地方是：

* 我把任务范围控制在 `report-gen`。
* Agent 帮我把复杂的接口、权限、测试和 Git 流程串起来。
* 最后产物不仅能跑，而且能被同伴通过 GitHub 分支看到。

后续如果继续使用 Agent，我会继续采用这套方式：先读文档，先定边界，先讲验收，再让 Agent 写代码和验证。这样既能提高效率，也能减少小组协作中的冲突。
