# 生成 PLAN-C.md

> ## 任务
>
>   阅读当前仓库，理解 ARY 项目结构和模块分工，然后在仓库根目录生成一份
>   `PLAN-C.md`，作为模块 C（portfolio）的工程计划文档。
>
>   ## 你当前不需要实现代码
>
>   你当前只需要产出 PLAN-C.md。代码实现是后续的事。
>
>   ## 模块 C 的职责
>
>   我是模块 C 的实现负责人。该模块夹在 B（race-mgmt，李维政，进行中）
>   和 D（projection）、E（report-gen）之间。
>
>   你要交付的是：
>
>   | 层 | 交付物 |
>   |---|---|
>   | 数据库 | 5 个 migration SQL：008-works / 009-judge-assignments / 010-judging-records / 011-awards / 012-evidences |
>   | 后端 | server/src/modules/portfolio/routes.ts，约 12 个接口，覆盖 works 的 CRUD+状态流转、评委分配、评审记录、奖项管理、证据采集 |
>   | 后端 | 评审前风险提示逻辑（读 B 的 race_projects 表，aggregate_ingestion_status 异常时标记警告） |
>   | 后端 | 在 server/src/app.ts 取消注释 portfolio 那行 |
>   | 前端 | 4 个页面：WorksPage、ResultsPage、JudgeView、OrganizerJudging |
>   | 测试 | server/src/modules/portfolio/test.sh |
>
>   ## 生成 PLAN-C.md 时你必须注意的点
>
>   ### 1. 命名约定不能自创
>
>   项目已有严格惯例，你必须沿用：
>
>   - DB 字段：snake_case（如 registration_id、user_id、created_at）
>   - API 响应字段：camelCase（如 registrationId、userId、createdAt）
>   - 表名：全小写下划线复数（judging_records，不是 JudgingRecords）
>   - URL 前缀直接使用资源名：/works、/awards、/evidences 等，不要套一层 /portfolio
>   - 每个 API 响应都要做 DB→API 字段转换函数（参照 B 的 toRaceResponse 模式）
>
>   ### 2. 鉴权只能用共享的 authorize()，不能自己写角色判断
>
>   auth.ts 的 PERMISSION_MATRIX 中已经定义了 C 相关的权限。你必须列出每个接口
>   对应矩阵里的哪个资源类型和动作，然后调用 authorize(user, "ResourceType", "action", ctx)。
>   不要自己写 if (user.roles.includes("organizer"))。
>
>   C 涉及的权限：
>   - Work: create(OWN), submit(OWN), lock(MANAGED_RACE), publish(MANAGED_RACE)
>   - JudgeAssignment: create(MANAGED_RACE), remove(MANAGED_RACE)
>   - JudgingRecord: create(ASSIGNED), submit(ASSIGNED)
>   - Award: create_draft(MANAGED_RACE), publish(MANAGED_RACE)
>   - Evidence: set_visibility(OWN)
>
>   ### 3. JSON store 没有真正的数据库约束
>
>   db.ts 是 JSON 文件存储，没有主键、唯一约束、外键。所有约束必须在
>   代码里手动检查。你要在 PLAN-C.md 中逐表列出校验点，例如：
>
>   - 插入 works 前，先 filterBy("works", "registration_id", ...) 确保不重复
>   - 插入 awards 前，检查同 race_id + 同 award_name + 同 rank 是否已存在
>   - 分配评委前，确认目标用户有 judge 角色
>   - 评委提交评审记录前，确认 scoreResult 和 scoreRiding 非空
>   - 移除评委分配前，确认该分配下没有已提交的 judging_record
>
>   ### 4. 跨模块数据依赖
>
>   你需要读 B 的表，但不能 import B 的 routes。只通过 db.ts 直接读 JSON。
>
>   B 已建好的 5 个 migration 文件是你唯一的字段名来源，把里面 C 会用到
>   的字段逐表列在 PLAN-C.md 中。关键表：
>
>   - registrations：id, race_id, user_id, status
>   - races：id, slug, title, organizer_user_ids
>   - race_projects：registration_id, aggregate_ingestion_status
>   - ca_connections：race_project_id, ingestion_status
>
>   ### 5. 解除对下游模块的阻塞
>
>   D 和 E 需要读你的表。他们对你的路由没有依赖（和你对 B 一样，他们也
>   通过 db.ts 直接读），但他们需要你的 migration SQL 文件来确定字段名。
>
>   所以 PLAN-C.md 的实现顺序中，migration 文件必须排在最前面，优先建：
>   works → judging_records → awards → evidences → judge_assignments
>
>   其中 awards 是 D 和 E 共同的核心数据源，judging_records 也是 D 和 E
>   都需要的，works 被 D 的 submission_projection 需要。这三张表的
>   后端路由也要排在前面实现。
>
>   ### 6. 关键业务不变量必须列明
>
>   以下规则来自领域分析文档和 PRD，代码必须兑现：
>
>   - 一个 Registration 最多一个主 Work
>   - 一个 User 对同一 Race 的同一 JudgeAssignment 不应重复分配给同一 Work
>   - Award.race_id（若保存冗余字段）必须与所属 Registration.race_id 一致
>   - 同一个 Race 的同一个 award_name 下 rank 必须唯一
>   - 同一个 Registration 在同 Race 同 award_name 下最多一个 Award
>   - Award 发布前不为 Public 可见
>   - 评委提交后不可再修改评审记录（除非后续加 revert 功能）
>   - 作品被 lock 后选手不可再编辑
>
>   ### 7. 测试策略
>
>   test.sh 不要测 B 的接口。用 db.ts 直接往 JSON 文件写入假数据来模拟
>   依赖。每个接口的 curl 测试覆盖正常路径和至少一个异常路径（如无权限、
>   必填字段缺失）。测试结束清理假数据。
>
>   ### 8. PLAN-C.md 的结构要求
>
>   文件必须以仓库根目录为参考系，列出所有需要新建和修改的文件的绝对路径。
>   让后续实现 agent 读这一份文档就知道要碰哪些文件，不需要再去翻其他文档。
>
>   可参考结构：
>   - 模块范围与边界
>   - 数据依赖（列出 B 的表及字段名）
>   - 待建表定义（5 张表，字段 + 唯一约束 + 校验规则）
>   - 接口清单（路由、鉴权、请求体、校验逻辑）
>   - 前端页面功能与数据源
>   - 实现顺序与里程碑
>   - 测试策略
>
>   ## 最后
>
>   这份 PLAN-C.md 是你后续 spawn 实现 agent 时他们会读的核心文档。
>   写得越精确，他们翻车的概率越低。模糊的地方宁可现在查清楚写进去，
>   不要留给他们猜测。如果你在阅读文件中对我的要求产生了任何疑惑质疑或不确定，立刻先问清楚。

<details><summary>11 previous messages</summary>

> 我会先按仓库规则读取 `PLAN.md` 和相关 `docs/`，再核对现有迁移、鉴权和模块结构。目标是只生成根目录 `PLAN-C.md`，不改代码实现。
>
> 记忆库里没有可复用的 ARY 历史细节，后续以当前仓库文件为准。我现在会定位 B/C/D/E 相关文档、迁移、鉴权矩阵和现有模块样式，避免在计划里自创命名。
>
> 我已经确认当前仓库把 C 的范围放在 DEV-4/DEV-5/DEV-7 的交界处。接下来重点核对字段来源：现有 001-007 migration、`db.ts` 的 JSON store 能力、`auth.ts` 的权限矩阵，以及 B 的 `race-mgmt` 路由模式。
>
> 现有 B 路由确认了 `toRaceResponse` 的转换模式，也确认了 `authorize()` 已经包含 C 所需资源动作。下一步我会逐个读取 001-007 migration 和领域/权限文档中 Work、Award、Evidence、JudgingRecord 的约束。
>
> 领域文档里有足够明确的不变量：`Registration -> Work -> JudgeAssignment -> JudgingRecord`，`Registration -> Award`，`Evidence` 通过 `sourceRef` 引用来源。现在我会抓取这些章节的原文上下文，再据此写计划中的表定义和接口验收。
>
> C 的前端页面文件已经存在，但这次不实现。我会读取它们的当前状态，在 `PLAN-C.md` 中明确哪些是“后续修改文件”而不是本轮改动。
>
> `STATUS.md` 可能落后于当前代码，因为仓库已经有 server/client 基础实现；计划里我会以实际文件为准，并把状态文档只作为背景，不当作代码现状。现在补读分工指南中 C 的交付描述。
>
> 我现在有足够上下文：B 的字段来源、C 的权限动作、JSON store 的手动校验责任、D/E 对 C 表字段的依赖都已核对。接下来只会新增根目录 `PLAN-C.md`，内容会按实现 agent 可直接执行的粒度写。
>
> 我会在计划里显式处理一个容易混淆的点：文件编号必须保持 `008` 到 `012`，但给 D/E 解除阻塞时优先冻结字段的顺序按 `works -> judging_records -> awards -> evidences -> judge_assignments`。这避免实现阶段把编号顺序误解成依赖优先级。
>
> <details><summary>Created a file</summary>
>
> - Wrote `./PLAN-C.md` (+663 -0)
>
> </details>
>
> `PLAN-C.md` 已生成。最后我会做一次文本校验，确认只新增了计划文件，且没有误改代码或现有文档。
</details>

已生成 [PLAN-C.md](./PLAN-C.md:1)。

内容覆盖了模块 C 的范围边界、B 表字段依赖、5 张待建表字段与手动校验点、接口清单与 `authorize()` 鉴权映射、评审前风险提示逻辑、前端页面数据源、实现顺序和 `test.sh` 测试策略。

本次只新增 `PLAN-C.md`，没有实现代码，也没有运行测试。`git status` 显示唯一新增文件是 `PLAN-C.md`。

> 检查 PLAN-C.md 是否存在以下 5 个问题，确认属实后逐一修正。
>
>   ---
>
>   ### 问题 1：vite.config.ts 代理缺口 + 文件清单遗漏
>
>   `client/vite.config.ts` 当前只代理了 `/works`，但模块 C 额外引入了 4 个 URL 前缀：
>   `/awards`、`/evidences`、`/judge-assignments`、`/judging-records`。
>
>   需要在 PLAN-C.md 两处修改：
>   - 第 1 节文件清单表增加一行 `client/vite.config.ts | 修改`
>   - C5 节明确列出需要追加的全部代理路径
>
>   ---
>
>   ### 问题 2：Evidence type 枚举与领域文档冲突
>
>   PLAN-C 4.5 节 Evidence type 枚举为：`session_summary, work, judging_record, code_material, video, external_ref`
>
>   `docs/ary-domain-analysis.v0.3.md` 定义的 EvidenceType 为：`session_summary, work, commit_pr, screenshot, judge_comment, retrospective, video`
>
>   差异：
>   - PLAN-C 的 `code_material` ↔ 领域文档的 `commit_pr`
>   - PLAN-C 的 `judging_record` ↔ 领域文档的 `judge_comment`
>   - PLAN-C 多了 `external_ref`，领域文档多了 `screenshot` 和 `retrospective`
>
>   需要统一。建议以领域文档为准，或注明调整理由。E 模块会按领域文档写报告生成逻辑，不一致会导致字段对不上。
>
>   ---
>
>   ### 问题 3：Works slug 缺少自动生成逻辑
>
>   works 表 `slug UNIQUE NOT NULL`，POST /works 中 slug 是可选字段。如果 rider 不传，应像 B 的 `normalizeSlug()` 一样从 title 自动生成。PLAN-C
>   未提及此逻辑，实现 agent 可能直接报错。
>
>   在 4.1 或 5.1 节补充 slug 自动生成规则。
>
>   ---
>
>   ### 问题 4：Migration 编号与冻结优先级存在矛盾表述
>
>   4 节写"先冻结 works → judging_records → awards → evidences → judge_assignments"，但实际文件编号是 008-works → 009-judge-assignments →
>   010-judging-records → 011-awards → 012-evidences。编号中 judge_assignments（009）排在 judging_records（010）前面，与冻结优先顺序矛盾。
>
>   在 4 节补一句话澄清：文件编号 008-012 固定不变，冻结优先顺序只影响后续 C1-C4 实现先后，不改变 migration 文件编号。
>
>   ---
>
>   ### 问题 5：GET 路由的 authorize() 调用不够显式
>
>   POST/PATCH 接口的鉴权列写明了 `authorize(user, "Work", "create", { ownerUserId })` 这种精确调用，但 GET 接口只写了"Public
>   读公开；登录用户可读自己的"等自然语言描述。实现 agent 可能在这里自创角色判断逻辑。
>
>   在第 6 节鉴权上下文表中补上读操作的条目：
>
>   Work   | view_public  | { visibility, isPublished }
>   Work   | view_private | { ownerUserId }
>   Award  | view_published | { visibility, isPublished }
>   Award  | view_draft     | { raceOrganizerIds }
>   Evidence | view_public        | { visibility, isPublished }
>   Evidence | view_private_summary | { ownerUserId }
>
>   ---
>
>   ### 要求
>
>   - 逐条确认问题是否存在，存在则修正，不存在则说明理由
>   - 修改只限 PLAN-C.md 本身，不碰其他文件
>   - 修正后 PLAN-C.md 保持一致性和可执行性

<details><summary>4 previous messages</summary>

> 我会只检查并修改 `PLAN-C.md`。先快速核对当前计划、根目录 `PLAN.md` 和领域文档中的 EvidenceType，确认每条问题是否属实再动手。
>
> 5 条里我已确认：1、2、3、5 确实存在；第 4 条当前已有一层澄清，但表述还不够直接，我会按你的要求补成明确规则。现在只改 `PLAN-C.md`。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./PLAN-C.md` (+15 -4)
>
> </details>
>
> 修改已落到 `PLAN-C.md`。我再做一次针对性校验：确认旧 Evidence 枚举已消失、代理路径完整、GET 鉴权表有显式 `authorize()` 上下文，并确认没有改动其他文件。
</details>

已检查并修正 [PLAN-C.md](./PLAN-C.md:1)，只改了这一份文件。

逐条结果：

1. 存在。已在文件清单补充 `client/vite.config.ts`，并在 C5 明确列出 `/works`、`/awards`、`/evidences`、`/judge-assignments`、`/judging-records` 全部代理路径。
2. 存在。已将 Evidence type 统一为领域文档枚举：`session_summary`、`work`、`commit_pr`、`screenshot`、`judge_comment`、`retrospective`、`video`，并明确禁用旧的 `code_material`、`judging_record`、`external_ref`。
3. 存在。已补充 `slug` 未传时按 B 的 `normalizeSlug()` 模式从 `title` 自动生成，冲突返回 `409`。
4. 部分存在。原文已有弱澄清，但不够明确；已补一句：冻结优先顺序只影响 C1-C4 实现和评审先后，不改变 migration 文件编号。
5. 存在。已在第 6 节补齐 GET/read 操作的显式 `authorize()` 上下文，包括 `Work.view_public/view_private`、`Award.view_published/view_draft`、`Evidence.view_public/view_private_summary`。

校验过 `git status --short`，仍然只有 `PLAN-C.md` 处于未跟踪/变更状态，没有碰其他文件。

> User context
>
> Attachments:
> - 你的当前任务是：对模块 C（portfolio）做最终全面检查。结论只有两个——**通过**或**未通过（附具体问题清单）**。 --- ## 第零步：阅读关…: `~/.codex/attachments/7083d115-d9db-4a53-8b7a-943565d81f08/pasted-text.txt`

<details><summary>31 previous messages</summary>

> Stream error
>
> Reconnecting 5/5
> stream disconnected before completion: 远程主机强迫关闭了一个现有的连接。 (os error 10054)
>
> 我会先读取附件里的完整检查口径，再按仓库规则复核 `PLAN.md`、模块 C 相关文件和实现证据。这个任务是最终检查，我会以问题清单为主，不做代码修改。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 C:\Users\Administrator\.codex\attachments\7083d115-d9db-4a53-8b7a-943565d81f08\pasted-text.txt`
> - Ran `Get-Content -Raw -Encoding UTF8 PLAN.md`
> - Ran `Get-Content -Raw -Encoding UTF8 C:\Users\Administrator\.codex\memories\MEMORY.md`
>
> </details>
>
> 附件里明确要求只读检查。我已经确认内存提示里有此前 C 实现和验证记录，但这次会以当前工作区文件和实际命令结果为准；记忆只作为线索。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 PLAN-C.md`
> - Ran `Get-Content -Raw -Encoding UTF8 client\src\shared\apiTypes.ts`
> - Ran `Get-Content -Raw -Encoding UTF8 server\src\modules\portfolio\routes.ts`
> - Ran `Get-Content -Raw -Encoding UTF8 模块C前端prompt.md`
>
> </details>
>
> `routes.ts` 很长，第一次读取被终端截断了；我会改用按函数和行号定位的方式检查每个端点。接下来同时读测试、路由注册、代理、4 个前端页面和迁移/数据现状。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 server\src\modules\portfolio\test.sh`
> - Ran `Get-Content -Raw -Encoding UTF8 server\src\app.ts`
> - Ran `rg -n "\.(get|post|patch|delete)\(\"|function to|function canRead|function shouldInclude|function getReviewWarnings|function build|function getAwardConflict|function parseJudgingRecordIds|roles\.includes|user\.roles\.includes|snake_case|registration_id|award_name|source_ref" server\src\modules\portfolio\routes.ts`
> - Ran `Get-Content -Raw -Encoding UTF8 client\vite.config.ts`
>
> </details>
>
> 基础文件显示 C 已经接入 `app.ts` 和 Vite 代理；但还需要逐接口和前端逐页核查。刚才一个 PowerShell 搜索命令因为引号解析失败，我会换成更窄的查询继续，不影响检查。
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `rg -n '\.(get|post|patch|delete)\("|function to|function canRead|function shouldInclude|function getReviewWarnings|function build|function getAwardConflict|function parseJudgingRecordIds|roles\.includes|user\.roles\.includes' server\src\modules\portfolio\routes.ts`
> - Ran `Get-Content -Raw -Encoding UTF8 client\src\pages\works\WorksPage.tsx`
> - Ran `Get-Content -Raw -Encoding UTF8 client\src\pages\results\ResultsPage.tsx`
> - Ran `Get-Content -Raw -Encoding UTF8 client\src\pages\console\JudgeView.tsx`
> - Ran `rg -n "works\.get|works\.post|works\.patch|judgeAssignments\.get|judgeAssignments\.delete|judgeAssignments\.post|judgingRecords\.patch|judgingRecords\.post|awards\.get|awards\.post|awards\.patch|evidences\.get|evidences\.post|evidences\.patch|function to|function canRead|function shouldInclude|function getReviewWarnings|function build|function getAwardConflict|roles\.includes|user\.roles\.includes" server\src\modules\portfolio\routes.ts`
> - Ran `Get-Content -Raw -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx`
> - Ran `Get-ChildItem -File database\migrations\00*.sql | Select-Object Name,Length`
> - Ran `Get-ChildItem -File database\data -ErrorAction SilentlyContinue | Select-Object Name,Length`
>
> </details>
>
> 到目前为止，前端文件看起来已经有真实 API 接入；基础设施还需要精确验证。迁移列表的通配符只匹配了 `00*`，我会重新列全部 SQL，并检查种子数据数量和关键状态。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-ChildItem -File database\migrations\*.sql | Select-Object Name,Length`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts; $c[830..920]`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts; $c[500..675]`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts; $c[1080..1145]`
>
> </details>
>
> 后端发现一个需要重点复核的区域：私有 Work 的 Organizer 读取和风险提示是否按规格返回。先按要求运行测试脚本和 TypeScript 编译，实际结果会纳入最终结论。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `bash src/modules/portfolio/test.sh`
> - Ran `npx tsc --noEmit`
> - Ran `git status --short`
>
> </details>
>
> 测试脚本通过默认 `bash` 调到了未配置的 WSL，未进入脚本逻辑；这会作为环境失败记录。我会先查是否有 Git Bash 可用；`npx tsc --noEmit` 因网络/权限尝试访问 npm registry，被沙箱拦截，按规则我会用提权重试一次。
>
> <details><summary>a request timed out, ran 4 commands</summary>
>
> - Ran `Get-Command bash -All | Select-Object Source,CommandType,Version`
> - Ran `Get-ChildItem 'C:\Program Files\Git\bin\bash.exe','C:\Program Files\Git\usr\bin\bash.exe','C:\Program Files (x86)\Git\bin\bash.exe' -ErrorAction SilentlyContinue | Select-Object FullName`
> - Ran `Test-Path server\node_modules\.bin\tsc.cmd; Test-Path client\node_modules\.bin\tsc.cmd; Test-Path node_modules\.bin\tsc.cmd`
> - Ran `npx tsc --noEmit`
> - Auto-review: timedOut
> - Auto-review rationale: Automatic approval review timed out while evaluating the requested approval.
>
> </details>
>
> 提权审查超时，没有得到允许结果。我会再试一次；如果仍无法执行，会把 root 级 `npx tsc --noEmit` 标为未验证，并用已存在的本地 server/client TypeScript 编译器补充检查代码质量。
>
> <details><summary>a request timed out, ran a command</summary>
>
> - Ran `npx tsc --noEmit`
> - Auto-review: timedOut
> - Auto-review rationale: Automatic approval review timed out while evaluating the requested approval.
>
> </details>
>
> root 级 `npx tsc --noEmit` 两次提权审查都超时，无法完成该指定命令。现在我会用本地已安装的 `server` 和 `client` TypeScript 编译器分别跑 `--noEmit`，这不会访问网络。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `.\node_modules\.bin\tsc.cmd --noEmit`
> - Ran `.\node_modules\.bin\tsc.cmd --noEmit`
> - Ran `Get-Content -Raw -Encoding UTF8 client\src\pages\console\ConsoleShell.tsx`
>
> </details>
>
> `server` 和 `client` 本地 TypeScript 编译均为零输出通过；但指定的根目录 `npx tsc --noEmit` 仍然没有成功执行。现在我会检查 `database/data` 种子数据是否满足视觉验收路径，并继续整理阻断问题。
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `node -e "const fs=require('fs'),p='database/data/'; const read=n=>JSON.parse(fs.readFileSync(p+n+'.json','utf8')); const users=read('users'), races=read('races'), regs=read('registrations'), rps=read('race_projects'), works=read('works'), ass=read('judge_assignments'), recs=read('judging_records'), aw=read('awards'); console.log(JSON.stringify({users:users.map(u=>({id:u.id,roles:u.roles,github:u.githubAccount||u.github_account})), races:races.map(r=>({id:r.id,status:r.status,visibility:r.visibility})), registrations:regs.map(r=>({id:r.id,status:r.status})), raceProjects:rps.map(r=>({id:r.id,aggregate_ingestion_status:r.aggregate_ingestion_status})), works:works.map(w=>({id:w.id,status:w.status,visibility:w.visibility,published_at:w.published_at})), judgeAssignments:ass.length, judgingRecords:recs.map(r=>({id:r.id,status:r.status})), awards:aw.map(a=>({id:a.id,status:a.status,visibility:a.visibility}))},null,2))"`
> - Ran `Select-String -Path server\src\modules\portfolio\routes.ts -Pattern 'function canReadWork','function shouldIncludeWorkWarnings','Work", "view_private','Work", "review','view_draft','view_private_summary','reviewWarnings' | Select-Object LineNumber,Line`
> - Ran ``Select-String -Path PLAN-C.md -Pattern '私有读取必须按 Work owner 或 managed race','Organizer / Judge / owner','Work` \| `view_private','Evidence` \| `view_private_summary','GET /works\?raceId' | Select-Object LineNumber,Line``
> - Ran `Select-String -Path client\src\pages\console\OrganizerJudging.tsx -Pattern 'requestJson<WorkResponse\[]>','reviewWarnings','loadWorks','raceIdFilter' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path database\data\works.json -Pattern '"id"','"status"','"visibility"','"published_at"' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path database\data\awards.json -Pattern '"id"','"status"','"visibility"' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path database\data\judging_records.json -Pattern '"id"','"status"' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path database\data\race_projects.json -Pattern '"id"','aggregate_ingestion_status' | Select-Object LineNumber,Line`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 database\migrations\008-works.sql; Get-Content -Raw -Encoding UTF8 database\migrations\009-judge-assignments.sql; Get-Content -Raw -Encoding UTF8 database\migrations\010-judging-records.sql; Get-Content -Raw -Encoding UTF8 database\migrations\011-awards.sql; Get-Content -Raw -Encoding UTF8 database\migrations\012-evidences.sql`
> - Ran `Select-String -Path server\src\modules\portfolio\routes.ts -Pattern 'roles.includes','user.roles.includes' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path client\src\shared\apiTypes.ts -Pattern 'interface WorkResponse','interface JudgeAssignmentResponse','interface JudgingRecordResponse','interface AwardResponse','interface ReviewWarning' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path server\src\modules\portfolio\routes.ts -Pattern 'function toWorkResponse','function toJudgeAssignmentResponse','function toJudgingRecordResponse','function toAwardResponse','function toEvidenceResponse','interface ReviewWarning' | Select-Object LineNumber,Line`
>
> </details>
>
> 迁移和类型文件基本对齐，`routes.ts` 也没有直接用 `user.roles.includes(...)` 做当前用户鉴权。当前主要风险集中在 Work 私有读取/风险提示、种子数据状态、以及指定测试命令无法运行。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 server\src\shared\auth.ts`
> - Ran `Select-String -Path server\src\modules\portfolio\test.sh -Pattern 'expect_status|json_assert|portfolio tests passed|cleanup_data|setup_data' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path client\src\pages\works\WorksPage.tsx -Pattern 'raceSlug','setSearchParams','loading','error','暂无公开作品','reviewWarnings','roles.includes','loadWorkDetail' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path client\src\pages\results\ResultsPage.tsx -Pattern 'useParams','/races/','/awards\?raceId','status === "published"','loading','error','暂无已发布奖项' | Select-Object LineNumber,Line`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Test-Path package.json; Get-ChildItem -Name package.json,server\package.json,client\package.json -ErrorAction SilentlyContinue`
> - Ran `Select-String -Path client\src\pages\console\JudgeView.tsx -Pattern '/judge-assignments/mine','/judge-assignments/.*/judging-records','/judging-records/','readOnly','scoreResult','scoreRiding','请先登录','message is managed' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path client\src\pages\console\OrganizerJudging.tsx -Pattern '/works','/judge-assignments','/awards','githubAccount','judgeGithubAccount','readOnly','status !== "draft"','status !== "submitted"','status !== "locked"','403','409','400','请先登录' | Select-Object LineNumber,Line`
> - Ran `Select-String -Path server\src\app.ts,client\vite.config.ts -Pattern 'registerPortfolioRoutes','/works','/awards','/evidences','/judge-assignments','/judging-records' | Select-Object Path,LineNumber,Line`
>
> </details>
>
> 我已经完成静态核查和可执行命令核查。结论不会是通过：存在后端规格偏差、前端统计逻辑缺陷、种子数据不满足验收路径，以及两项指定命令未能按要求跑通。
>
> <details><summary>Ran a command</summary>
>
> - Ran `Select-String -Path C:\Users\Administrator\.codex\memories\MEMORY.md -Pattern 'module C portfolio','PLAN-C.md','auth.ts MATRIX','Git Bash','npx','test.sh' | Select-Object LineNumber,Line`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> ## 模块 C 最终检查：未通过 ❌
>
> 发现 5 个问题：
>
> 1. **阻断：Organizer 无法按规格读取 managed race 的私有 Work，且 Organizer/owner 对 public Work 看不到 reviewWarnings**
>    规格要求：[PLAN-C.md](./PLAN-C.md:337) 要求登录用户可读自己的或 managed race 的 Work；[PLAN-C.md](./PLAN-C.md:367) 要求 Organizer/Judge/owner 上下文可返回 `reviewWarnings`。
>    实际现状：[routes.ts](./server/src/modules/portfolio/routes.ts:840) 的 `canReadWork()` 只允许 public、owner、assigned judge，没有 managed race Organizer 分支；[routes.ts](./server/src/modules/portfolio/routes.ts:859) 的 `shouldIncludeWorkWarnings()` 对 public/published Work 直接返回 false。
>    修改方向：补 managed race Organizer 读取分支，并让非 Public 上下文的 owner/Organizer/Judge 可看到 warnings。
>
> 2. **缺陷：OrganizerJudging 的评审进度只统计当前选中 Work，不能统计各 Work**
>    规格要求：附件第 3.4 节要求“各 work 的 assigned/submitted 统计”。
>    实际现状：[OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx:119) 只加载当前选中 Work 的 assignments；[OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx:35) 用这个局部 `assignments` 去 map 全部 works，非选中作品会被统计为 0。
>    修改方向：按每个 Work 拉取 assignments，或提供/调用 race 级 assignment/progress 聚合接口。
>
> 3. **缺陷：种子数据不满足第八步视觉验收路径**
>    规格要求：需要 3 个 Work 为 `submitted/locked/draft`，3 个 Award 为 `published/draft/published`，2 个 JudgingRecord 为 `draft/submitted`。
>    实际现状：[works.json](./database/data/works.json:16) 和 [works.json](./database/data/works.json:38) 都是 `locked`，没有 `submitted`；[awards.json](./database/data/awards.json:11)、[awards.json](./database/data/awards.json:27)、[awards.json](./database/data/awards.json:43) 全是 `published`，没有 draft；[judging_records.json](./database/data/judging_records.json:25) 还有第 3 条 submitted 记录。
>    修改方向：调整 seed 数据到指定状态组合，并清理额外记录。
>
> 4. **阻断验证：`bash src/modules/portfolio/test.sh` 未能运行**
>    规格要求：第六步要求在 `server` 目录执行该脚本并看到 `portfolio tests passed`。
>    实际现状：默认 `bash` 解析到 `C:\Windows\system32\bash.exe`，输出 WSL 未安装/未配置提示，脚本没有进入测试逻辑。未发现 Git Bash 可用路径。
>    修改方向：在有 Git Bash 的环境复跑，或提供 Windows 可执行等价测试入口。
>
> 5. **阻断验证：根目录 `npx tsc --noEmit` 未能完成**
>    规格要求：第七步要求在项目根目录执行该命令零错误。
>    实际现状：根目录没有 `package.json`/本地 `node_modules`，`npx` 尝试访问 npm registry 拉取 `tsc`，被网络/权限拦截；两次提权审查超时。补充验证：`server\.bin\tsc --noEmit` 和 `client\.bin\tsc --noEmit` 均零输出通过。
>    修改方向：添加根级 package/workspace 脚本，或把验收命令改为 server/client 分别执行本地 `tsc`。
>
> 已确认的通过项：5 个 migration 存在且字段为 snake_case；`app.ts` 已激活 `registerPortfolioRoutes(app)`；`vite.config.ts` 已代理 5 个 C API 前缀；`routes.ts` 未发现用 `user.roles.includes(...)` 做当前用户鉴权；共享类型与主要 `toXxxResponse` 字段基本对齐。
</details>

## 模块 C 最终检查：未通过 ❌

发现 5 个问题：

1. **阻断：Organizer 无法按规格读取 managed race 的私有 Work，且 Organizer/owner 对 public Work 看不到 reviewWarnings**
   规格要求：[PLAN-C.md](./PLAN-C.md:337) 要求登录用户可读自己的或 managed race 的 Work；[PLAN-C.md](./PLAN-C.md:367) 要求 Organizer/Judge/owner 上下文可返回 `reviewWarnings`。
   实际现状：[routes.ts](./server/src/modules/portfolio/routes.ts:840) 的 `canReadWork()` 只允许 public、owner、assigned judge，没有 managed race Organizer 分支；[routes.ts](./server/src/modules/portfolio/routes.ts:859) 的 `shouldIncludeWorkWarnings()` 对 public/published Work 直接返回 false。
   修改方向：补 managed race Organizer 读取分支，并让非 Public 上下文的 owner/Organizer/Judge 可看到 warnings。

2. **缺陷：OrganizerJudging 的评审进度只统计当前选中 Work，不能统计各 Work**
   规格要求：附件第 3.4 节要求“各 work 的 assigned/submitted 统计”。
   实际现状：[OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx:119) 只加载当前选中 Work 的 assignments；[OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx:35) 用这个局部 `assignments` 去 map 全部 works，非选中作品会被统计为 0。
   修改方向：按每个 Work 拉取 assignments，或提供/调用 race 级 assignment/progress 聚合接口。

3. **缺陷：种子数据不满足第八步视觉验收路径**
   规格要求：需要 3 个 Work 为 `submitted/locked/draft`，3 个 Award 为 `published/draft/published`，2 个 JudgingRecord 为 `draft/submitted`。
   实际现状：[works.json](./database/data/works.json:16) 和 [works.json](./database/data/works.json:38) 都是 `locked`，没有 `submitted`；[awards.json](./database/data/awards.json:11)、[awards.json](./database/data/awards.json:27)、[awards.json](./database/data/awards.json:43) 全是 `published`，没有 draft；[judging_records.json](./database/data/judging_records.json:25) 还有第 3 条 submitted 记录。
   修改方向：调整 seed 数据到指定状态组合，并清理额外记录。

4. **阻断验证：`bash src/modules/portfolio/test.sh` 未能运行**
   规格要求：第六步要求在 `server` 目录执行该脚本并看到 `portfolio tests passed`。
   实际现状：默认 `bash` 解析到 `C:\Windows\system32\bash.exe`，输出 WSL 未安装/未配置提示，脚本没有进入测试逻辑。未发现 Git Bash 可用路径。
   修改方向：在有 Git Bash 的环境复跑，或提供 Windows 可执行等价测试入口。

5. **阻断验证：根目录 `npx tsc --noEmit` 未能完成**
   规格要求：第七步要求在项目根目录执行该命令零错误。
   实际现状：根目录没有 `package.json`/本地 `node_modules`，`npx` 尝试访问 npm registry 拉取 `tsc`，被网络/权限拦截；两次提权审查超时。补充验证：`server\.bin\tsc --noEmit` 和 `client\.bin\tsc --noEmit` 均零输出通过。
   修改方向：添加根级 package/workspace 脚本，或把验收命令改为 server/client 分别执行本地 `tsc`。

已确认的通过项：5 个 migration 存在且字段为 snake_case；`app.ts` 已激活 `registerPortfolioRoutes(app)`；`vite.config.ts` 已代理 5 个 C API 前缀；`routes.ts` 未发现用 `user.roles.includes(...)` 做当前用户鉴权；共享类型与主要 `toXxxResponse` 字段基本对齐。

> ## 你的检查结论复核完毕。以下是对 5 个问题的逐条判定：
>
> ### 真实问题（需出修改方案）
>
> **问题 1（阻断→缺陷）：Organizer 无法读取 managed race 私有 Work，且 Organizer/owner/judge 对公开 Work 看不到 reviewWarnings**
>
> 你的定位准确。拆为两个子缺陷：
>
> A. `canReadWork()` (routes.ts:840) 缺失 managed race 分支。当前只有 public / owner / assigned judge 三条路径，Organizer 无法通过 managed race 上下文读取 status=draft、visibility=private 的 Work。对照 PLAN-C.md §6 —— `Work.view_private` 应支持 `ownerUserId`、`assignedJudgeUserId`、`raceOrganizerIds` 三种 ctx。且 auth.ts:74 的矩阵 `Work.view_private: "OWN"` 只允许 owner，需讨论是否需要扩展到 MANAGED_RACE。
>
> B. `shouldIncludeWorkWarnings()` (routes.ts:859-861) 对 `visibility=public && published_at` 的 Work 直接返回 false，不区分请求者是 public visitor 还是 organizer/owner/judge。对照 PLAN-C.md §7 —— "Organizer View 和 Judge View 的数据源中必须能看到这些警告"。
>
> **问题 2（缺陷）：OrganizerJudging 评审进度只统计当前选中 Work**
>
> 你的定位准确。`loadAssignments(selectedWork.id)` 只拉当前选中作品的 assignments，但 `progressRows` 用这个局部 assignments 去 map 全部 works，导致非选中作品永远 0/0。对照前端 prompt 第 86 行要求 "各 Work 的评审完成情况概览"。当前实现不满足。
>
> ---
>
> ### 误报（无需处理）
>
> **问题 3：种子数据状态不符**
>
> 你检查时数据已被人工视觉验收测试修改（work-review-1 被锁定、award-review-2 被发布、新增了 judging_record 等）。原始种子脚本正确包含 submitted/locked/draft 三种 work 状态、published/draft/published 三种 award 状态、draft/submitted 两种 judging_record 状态。种子数据需要重新写入即可，不是代码缺陷——不纳入修改范围。
>
> **问题 4：test.sh 未能运行**
>
> 环境问题。当前 session 的 Git Bash 可正常执行 `bash server/src/modules/portfolio/test.sh`，输出 `portfolio tests passed`，所有 30+ 测试用例通过。不是代码缺陷。
>
> **问题 5：tsc 根目录失败**
>
> 根目录无 package.json/tsconfig.json，预期行为。`client/` 和 `server/` 分别执行 `npx tsc --noEmit` 均零错误输出。不是代码缺陷。
>
> ---
>
> ### 要求
>
> 针对上述 2 个真实问题（含 3 处代码修改点），**先生成修改方案，不实施任何代码改动**。方案需包含：
>
> 1. 每个修改点的具体文件路径、行号、当前代码片段
> 2. 修改后的代码片段
> 3. 对 auth.ts 矩阵的影响分析（如涉及）
> 4. 对其他模块/页面的副作用分析
> 5. 修改后的验证方法
>
> 只有在我确认方案后，才允许实施代码改动。

<details><summary>6 previous messages</summary>

> Stream error
>
> Reconnecting 3/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 我会只产出修改方案，不改文件。先重新取 `PLAN.md`、`routes.ts` 和 `auth.ts` 的相关行号与代码片段，确保方案里的行号对应当前工作区。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 PLAN.md`
> - Ran `Select-String -Path C:\Users\Administrator\.codex\memories\MEMORY.md -Pattern 'module C portfolio','auth.ts MATRIX','Work.view_private','test.sh' | Select-Object LineNumber,Line`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\shared\auth.ts; for($i=65;$i -le 80;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts; for($i=835;$i -le 870;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
>
> </details>
>
> 我已拿到当前精确行号。方案会围绕 3 个代码修改点：`auth.ts` 矩阵扩展、`canReadWork()` 增加 managed race 路径、`shouldIncludeWorkWarnings()` 改成按调用者权限判断，不会提出额外实现。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Select-String -Path 模块C前端prompt.md -Pattern '各 Work 的评审完成情况概览','GET /works\?raceId','POST /works/:id/judge-assignments' | Select-Object LineNumber,Line`
> - Ran `$c=Get-Content -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx; for($i=50;$i -le 125;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx; for($i=330;$i -le 380;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx; for($i=25;$i -le 45;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
>
> </details>
>
> 下面是只读修改方案，不实施代码改动。
>
> ## 修改点 1：扩展 `authorize()` 支持多作用域，并调整 `Work.view_private`
>
> 文件：[auth.ts](./server/src/shared/auth.ts:69)
>
> 当前代码片段：
>
> ```ts
> type ScopeReq = "PUBLIC" | "OWN" | "ASSIGNED" | "MANAGED_RACE" | "SYSTEM";
> const MATRIX: Record<string, Record<string, ScopeReq>> = {
>   ...
>   Work: { view_public:"PUBLIC", view_private:"OWN", create:"OWN", submit:"OWN", lock:"MANAGED_RACE", publish:"MANAGED_RACE", hide:"OWN", review:"ASSIGNED" },
> ```
>
> 建议修改后：
>
> ```ts
> type ScopeReq = "PUBLIC" | "OWN" | "ASSIGNED" | "MANAGED_RACE" | "SYSTEM";
> type ScopeReqSpec = ScopeReq | ScopeReq[];
>
> const MATRIX: Record<string, Record<string, ScopeReqSpec>> = {
>   ...
>   Work: {
>     view_public: "PUBLIC",
>     view_private: ["OWN", "ASSIGNED", "MANAGED_RACE"],
>     create: "OWN",
>     submit: "OWN",
>     lock: "MANAGED_RACE",
>     publish: "MANAGED_RACE",
>     hide: "OWN",
>     review: "ASSIGNED",
>   },
> ```
>
> 同时把 `authorize()` 内部改为：单 scope 保持原行为；数组 scope 时任一 scope 通过即允许。`getRequiredScope()` 返回类型同步改为 `ScopeReqSpec`。
>
> 影响分析：
>
> - 这是解决问题 1A 的前置条件；否则 `canReadWork()` 即使传入 `raceOrganizerIds`，`Work.view_private` 仍只按 `OWN` 判断。
> - 对现有单 scope 权限无行为变化。
> - `Work.view_private` 权限会扩大到 owner、assigned judge、managed race organizer，符合 `PLAN-C.md §6`。
> - 风险点：调用方必须从 DB 派生 `ownerUserId` / `assignedJudgeUserId` / `raceOrganizerIds`，不能信任请求体。
>
> ## 修改点 2：修正 `canReadWork()` 和 `shouldIncludeWorkWarnings()`
>
> 文件：[routes.ts](./server/src/modules/portfolio/routes.ts:840)
>
> 当前代码片段：
>
> ```ts
> function canReadWork(req: Request, work: Work): boolean {
>   const publicAuth = authorize(getCurrentUser(req), "Work", "view_public", {
>     visibility: work.visibility,
>     isPublished: !!work.published_at,
>   });
>   if (publicAuth.allowed) return true;
>
>   const user = getCurrentUser(req);
>   const registration = findById<Registration>("registrations", work.registration_id);
>   if (registration) {
>     const ownerAuth = authorize(user, "Work", "view_private", { ownerUserId: registration.user_id });
>     if (ownerAuth.allowed) return true;
>   }
>
>   return findAll<JudgeAssignment>("judge_assignments")
>     .filter((assignment) => assignment.work_id === work.id)
>     .some((assignment) => authorize(user, "Work", "review", { assignedJudgeUserId: assignment.judge_user_id }).allowed);
> }
>
> function shouldIncludeWorkWarnings(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
>   if (!user) return false;
>   if (work.visibility === "public" && work.published_at) return false;
>   ...
> }
> ```
>
> 建议修改后：
>
> ```ts
> function canReadWork(req: Request, work: Work): boolean {
>   const user = getCurrentUser(req);
>   const publicAuth = authorize(user, "Work", "view_public", {
>     visibility: work.visibility,
>     isPublished: !!work.published_at,
>   });
>   if (publicAuth.allowed) return true;
>
>   return canReadPrivateWork(user, work);
> }
>
> function shouldIncludeWorkWarnings(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
>   if (!user) return false;
>   return canReadPrivateWork(user, work);
> }
>
> function canReadPrivateWork(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
>   const registration = findById<Registration>("registrations", work.registration_id);
>   const race = findById<Race>("races", work.race_id);
>
>   if (registration || race) {
>     const auth = authorize(user, "Work", "view_private", {
>       ownerUserId: registration?.user_id,
>       raceOrganizerIds: race ? parseStringArray(race.organizer_user_ids) : undefined,
>     });
>     if (auth.allowed) return true;
>   }
>
>   return findAll<JudgeAssignment>("judge_assignments")
>     .filter((assignment) => assignment.work_id === work.id)
>     .some((assignment) =>
>       authorize(user, "Work", "view_private", { assignedJudgeUserId: assignment.judge_user_id }).allowed,
>     );
> }
> ```
>
> 影响分析：
>
> - Organizer 可以读取 managed race 下的 draft/private Work。
> - owner / organizer / assigned judge 对公开 Work 也能看到 `reviewWarnings`。
> - 未登录 Public 仍只能走 `view_public`，不会看到 warnings。
> - 其他页面受益：`OrganizerJudging` 的 `/works?raceId=` 能拿到私有 draft Work；`JudgeView` 已分配作品上下文不受影响。
>
> ## 修改点 3：OrganizerJudging 改为加载所有 Work 的 assignments
>
> 文件：[OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx:68)
>
> 当前代码片段：
>
> ```tsx
> useEffect(() => {
>   if (!user || !selectedWork?.id) {
>     setAssignments([]);
>     return;
>   }
>   loadAssignments(selectedWork.id);
> }, [user, selectedWork?.id]);
>
> async function loadAssignments(workId: string) {
>   try {
>     const data = await requestJson<JudgeAssignmentResponse[]>(`/works/${workId}/judge-assignments`);
>     setAssignments(data);
>   } catch {
>     setAssignments([]);
>   }
> }
> ```
>
> 建议修改后：
>
> ```tsx
> useEffect(() => {
>   if (!user || works.length === 0) {
>     setAssignments([]);
>     return;
>   }
>   loadAssignmentsForWorks(works);
> }, [user, works]);
>
> async function loadAssignmentsForWorks(rows: WorkResponse[]) {
>   try {
>     const nested = await Promise.all(
>       rows.map((work) =>
>         requestJson<JudgeAssignmentResponse[]>(`/works/${work.id}/judge-assignments`).catch(() => []),
>       ),
>     );
>     setAssignments(nested.flat());
>   } catch {
>     setAssignments([]);
>   }
> }
> ```
>
> `selectedAssignments` 和 `progressRows` 可保持现状，因为 `assignments` 改为全量后：
>
> ```tsx
> const selectedAssignments = assignments.filter((assignment) => assignment.workId === selectedWork?.id);
> ```
>
> ```tsx
> const progressRows = useMemo(
>   () =>
>     works.map((work) => {
>       const workAssignments = assignments.filter((assignment) => assignment.workId === work.id);
>       const submitted = workAssignments.filter((assignment) => assignment.judgingRecord?.status === "submitted").length;
>       return { work, assigned: workAssignments.length, submitted };
>     }),
>   [assignments, works],
> );
> ```
>
> 影响分析：
>
> - `评委分配` 区域仍只显示当前选中 Work 的 assignments。
> - `评审进度` 区域会正确统计全部 Work。
> - 副作用是每次 Work 列表变化会发起 N 个 `GET /works/:id/judge-assignments` 请求；MVP 数据量可接受。
> - 如果后续赛事规模变大，建议新增后端 race 级 progress 接口，但本次不需要。
>
> ## 验证方法
>
> 1. 后端权限：
>    - seed 一个 managed race 下的 `draft/private` Work。
>    - organizer 登录后 `GET /works?raceId=...` 应包含该 Work。
>    - public 未登录 `GET /works?raceId=...` 不应包含该 Work。
>
> 2. reviewWarnings：
>    - 对 `aggregate_ingestion_status=failed` 的公开 Work：
>    - public 未登录响应 `reviewWarnings: []`。
>    - owner / organizer / assigned judge 登录响应包含 `ca_ingestion_failed`。
>
> 3. OrganizerJudging：
>    - seed 3 个 Work、每个 Work 至少一个 assignment，其中部分 submitted。
>    - 打开 OrganizerJudging，切换选中 Work。
>    - `评审进度` 中每个 Work 的 `submitted / assigned` 都应保持正确，不随当前选中 Work 变成 `0 / 0`。
>
> 4. 回归：
>    - `server`: `npx tsc --noEmit`
>    - `client`: `npx tsc --noEmit`
>    - Git Bash: `bash server/src/modules/portfolio/test.sh`
>    - 建议在 test.sh 中补两条断言：organizer 可读 private Work；owner/organizer/judge 对 public Work 可见 warning，而 public visitor 不可见。
</details>

下面是只读修改方案，不实施代码改动。

## 修改点 1：扩展 `authorize()` 支持多作用域，并调整 `Work.view_private`

文件：[auth.ts](./server/src/shared/auth.ts:69)

当前代码片段：

```ts
type ScopeReq = "PUBLIC" | "OWN" | "ASSIGNED" | "MANAGED_RACE" | "SYSTEM";
const MATRIX: Record<string, Record<string, ScopeReq>> = {
  ...
  Work: { view_public:"PUBLIC", view_private:"OWN", create:"OWN", submit:"OWN", lock:"MANAGED_RACE", publish:"MANAGED_RACE", hide:"OWN", review:"ASSIGNED" },
```

建议修改后：

```ts
type ScopeReq = "PUBLIC" | "OWN" | "ASSIGNED" | "MANAGED_RACE" | "SYSTEM";
type ScopeReqSpec = ScopeReq | ScopeReq[];

const MATRIX: Record<string, Record<string, ScopeReqSpec>> = {
  ...
  Work: {
    view_public: "PUBLIC",
    view_private: ["OWN", "ASSIGNED", "MANAGED_RACE"],
    create: "OWN",
    submit: "OWN",
    lock: "MANAGED_RACE",
    publish: "MANAGED_RACE",
    hide: "OWN",
    review: "ASSIGNED",
  },
```

同时把 `authorize()` 内部改为：单 scope 保持原行为；数组 scope 时任一 scope 通过即允许。`getRequiredScope()` 返回类型同步改为 `ScopeReqSpec`。

影响分析：

- 这是解决问题 1A 的前置条件；否则 `canReadWork()` 即使传入 `raceOrganizerIds`，`Work.view_private` 仍只按 `OWN` 判断。
- 对现有单 scope 权限无行为变化。
- `Work.view_private` 权限会扩大到 owner、assigned judge、managed race organizer，符合 `PLAN-C.md §6`。
- 风险点：调用方必须从 DB 派生 `ownerUserId` / `assignedJudgeUserId` / `raceOrganizerIds`，不能信任请求体。

## 修改点 2：修正 `canReadWork()` 和 `shouldIncludeWorkWarnings()`

文件：[routes.ts](./server/src/modules/portfolio/routes.ts:840)

当前代码片段：

```ts
function canReadWork(req: Request, work: Work): boolean {
  const publicAuth = authorize(getCurrentUser(req), "Work", "view_public", {
    visibility: work.visibility,
    isPublished: !!work.published_at,
  });
  if (publicAuth.allowed) return true;

  const user = getCurrentUser(req);
  const registration = findById<Registration>("registrations", work.registration_id);
  if (registration) {
    const ownerAuth = authorize(user, "Work", "view_private", { ownerUserId: registration.user_id });
    if (ownerAuth.allowed) return true;
  }

  return findAll<JudgeAssignment>("judge_assignments")
    .filter((assignment) => assignment.work_id === work.id)
    .some((assignment) => authorize(user, "Work", "review", { assignedJudgeUserId: assignment.judge_user_id }).allowed);
}

function shouldIncludeWorkWarnings(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
  if (!user) return false;
  if (work.visibility === "public" && work.published_at) return false;
  ...
}
```

建议修改后：

```ts
function canReadWork(req: Request, work: Work): boolean {
  const user = getCurrentUser(req);
  const publicAuth = authorize(user, "Work", "view_public", {
    visibility: work.visibility,
    isPublished: !!work.published_at,
  });
  if (publicAuth.allowed) return true;

  return canReadPrivateWork(user, work);
}

function shouldIncludeWorkWarnings(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
  if (!user) return false;
  return canReadPrivateWork(user, work);
}

function canReadPrivateWork(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
  const registration = findById<Registration>("registrations", work.registration_id);
  const race = findById<Race>("races", work.race_id);

  if (registration || race) {
    const auth = authorize(user, "Work", "view_private", {
      ownerUserId: registration?.user_id,
      raceOrganizerIds: race ? parseStringArray(race.organizer_user_ids) : undefined,
    });
    if (auth.allowed) return true;
  }

  return findAll<JudgeAssignment>("judge_assignments")
    .filter((assignment) => assignment.work_id === work.id)
    .some((assignment) =>
      authorize(user, "Work", "view_private", { assignedJudgeUserId: assignment.judge_user_id }).allowed,
    );
}
```

影响分析：

- Organizer 可以读取 managed race 下的 draft/private Work。
- owner / organizer / assigned judge 对公开 Work 也能看到 `reviewWarnings`。
- 未登录 Public 仍只能走 `view_public`，不会看到 warnings。
- 其他页面受益：`OrganizerJudging` 的 `/works?raceId=` 能拿到私有 draft Work；`JudgeView` 已分配作品上下文不受影响。

## 修改点 3：OrganizerJudging 改为加载所有 Work 的 assignments

文件：[OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx:68)

当前代码片段：

```tsx
useEffect(() => {
  if (!user || !selectedWork?.id) {
    setAssignments([]);
    return;
  }
  loadAssignments(selectedWork.id);
}, [user, selectedWork?.id]);

async function loadAssignments(workId: string) {
  try {
    const data = await requestJson<JudgeAssignmentResponse[]>(`/works/${workId}/judge-assignments`);
    setAssignments(data);
  } catch {
    setAssignments([]);
  }
}
```

建议修改后：

```tsx
useEffect(() => {
  if (!user || works.length === 0) {
    setAssignments([]);
    return;
  }
  loadAssignmentsForWorks(works);
}, [user, works]);

async function loadAssignmentsForWorks(rows: WorkResponse[]) {
  try {
    const nested = await Promise.all(
      rows.map((work) =>
        requestJson<JudgeAssignmentResponse[]>(`/works/${work.id}/judge-assignments`).catch(() => []),
      ),
    );
    setAssignments(nested.flat());
  } catch {
    setAssignments([]);
  }
}
```

`selectedAssignments` 和 `progressRows` 可保持现状，因为 `assignments` 改为全量后：

```tsx
const selectedAssignments = assignments.filter((assignment) => assignment.workId === selectedWork?.id);
```

```tsx
const progressRows = useMemo(
  () =>
    works.map((work) => {
      const workAssignments = assignments.filter((assignment) => assignment.workId === work.id);
      const submitted = workAssignments.filter((assignment) => assignment.judgingRecord?.status === "submitted").length;
      return { work, assigned: workAssignments.length, submitted };
    }),
  [assignments, works],
);
```

影响分析：

- `评委分配` 区域仍只显示当前选中 Work 的 assignments。
- `评审进度` 区域会正确统计全部 Work。
- 副作用是每次 Work 列表变化会发起 N 个 `GET /works/:id/judge-assignments` 请求；MVP 数据量可接受。
- 如果后续赛事规模变大，建议新增后端 race 级 progress 接口，但本次不需要。

## 验证方法

1. 后端权限：
   - seed 一个 managed race 下的 `draft/private` Work。
   - organizer 登录后 `GET /works?raceId=...` 应包含该 Work。
   - public 未登录 `GET /works?raceId=...` 不应包含该 Work。

2. reviewWarnings：
   - 对 `aggregate_ingestion_status=failed` 的公开 Work：
   - public 未登录响应 `reviewWarnings: []`。
   - owner / organizer / assigned judge 登录响应包含 `ca_ingestion_failed`。

3. OrganizerJudging：
   - seed 3 个 Work、每个 Work 至少一个 assignment，其中部分 submitted。
   - 打开 OrganizerJudging，切换选中 Work。
   - `评审进度` 中每个 Work 的 `submitted / assigned` 都应保持正确，不随当前选中 Work 变成 `0 / 0`。

4. 回归：
   - `server`: `npx tsc --noEmit`
   - `client`: `npx tsc --noEmit`
   - Git Bash: `bash server/src/modules/portfolio/test.sh`
   - 建议在 test.sh 中补两条断言：organizer 可读 private Work；owner/organizer/judge 对 public Work 可见 warning，而 public visitor 不可见。

<details><summary>43 previous messages</summary>

> 我会按刚才确认的方案实施三处改动：先扩展 `auth.ts` 的多作用域支持，再修正 Work 私有读取和 warning 返回逻辑，最后修正 OrganizerJudging 的评审进度数据加载。改完后会跑针对性搜索、TypeScript 和可用的测试命令。
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 PLAN.md`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\shared\auth.ts; for($i=35;$i -le 90;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts; for($i=835;$i -le 870;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx; for($i=25;$i -le 125;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
>
> </details>
>
> 我准备开始改文件：`auth.ts` 会保留既有单作用域行为，同时让矩阵支持数组作用域；`routes.ts` 会抽出 `canReadPrivateWork()`；`OrganizerJudging` 会把 assignment 加载从“当前作品”改成“当前作品列表全量”。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./server/src/shared/auth.ts` (+42 -29)
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> `auth.ts` 已改成支持多作用域，并把 `Work.view_private` 扩展为 owner、assigned judge、managed race。接下来改 portfolio 的 Work 读取和 warning 判断，避免 Public 泄漏 warning。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./server/src/modules/portfolio/routes.ts` (+17 -14)
>
> </details>
>
> 后端两处已改：私有 Work 读取现在统一走 `canReadPrivateWork()`，warning 也只按私有读取权限判断。下一步修正 OrganizerJudging 的 assignment 加载范围。
>
> Stream error
>
> Reconnecting 5/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./client/src/pages/console/OrganizerJudging.tsx` (+10 -6)
>
> </details>
>
> 三个修改点已经落地。我会先用搜索和片段复核改动，再跑 server/client TypeScript；随后尝试执行组合测试和针对性验证。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `$c=Get-Content -Encoding UTF8 server\src\shared\auth.ts; for($i=35;$i -le 95;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts; for($i=835;$i -le 875;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `$c=Get-Content -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx; for($i=55;$i -le 130;$i++){ '{0,4}: {1}' -f ($i+1), $c[$i] }`
> - Ran `Select-String -Path server\src\modules\portfolio\routes.ts -Pattern 'Work", "review"|canReadPrivateWork|visibility === "public" && work.published_at|roles.includes' | Select-Object LineNumber,Line`
>
> </details>
>
> 复核时发现一个边界：`Work.view_private` 现在包含 `MANAGED_RACE`，如果某次调用不传 `raceOrganizerIds`，现有 `authorize()` 语义会放行任意 organizer。我要把 `canReadPrivateWork()` 的两个调用都显式传 `raceOrganizerIds`，没有 race 上下文时传空数组，避免扩大权限。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./server/src/modules/portfolio/routes.ts` (+5 -2)
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 权限边界已收紧：`canReadPrivateWork()` 不会因为缺省 `raceOrganizerIds` 误放行任意 organizer。现在开始跑编译和测试。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `.\node_modules\.bin\tsc.cmd --noEmit`
> - Ran `.\node_modules\.bin\tsc.cmd --noEmit`
> - Ran `git diff -- server\src\shared\auth.ts server\src\modules\portfolio\routes.ts client\src\pages\console\OrganizerJudging.tsx`
>
> </details>
>
> Stream error
>
> Reconnecting 3/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> `server` 和 `client` 的 TypeScript 编译已经通过。下一步我尝试执行用户指定的 portfolio shell 测试；如果当前运行时仍解析到 WSL，会记录为环境不可用，并用直接 API/Node 验证补足这次改动的证据。
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `bash server/src/modules/portfolio/test.sh`
> - Ran `Select-String -Path server\src\shared\auth.ts,server\src\modules\portfolio\routes.ts,client\src\pages\console\OrganizerJudging.tsx -Pattern 'view_private:\[|canReadPrivateWork|loadAssignmentsForWorks|Work", "review"|visibility === "public" && work.published_at' | Select-Object Path,LineNumber,Line`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 当前默认 `bash` 仍是未配置 WSL，无法运行 shell 脚本。我会通过本地 `tsx` 启动/访问 API 做针对性验证：organizer 私有 Work 读取、public warning 隔离、organizer/judge warning 可见。
>
> <details><summary>Ran a command</summary>
>
> - Ran `try { (Invoke-WebRequest -UseBasicParsing http://localhost:3000/health -TimeoutSec 2).Content } catch { 'NO_SERVER' }`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 我会在独立端口启动一份临时 server 进程，避免依赖当前可能已经运行的旧进程。验证完成后会关闭临时进程。
>
> <details><summary>Ran a command</summary>
>
> - Ran `$serverDir = Join-Path (Get-Location) 'server'
> $out = Join-Path $env:TEMP 'ary-c-verify-out.log'
> $err = Join-Path $env:TEMP 'ary-c-verify-err.log'
> $p = Start-Process -FilePath (Join-Path $serverDir 'node_modules\.bin\tsx.cmd') -ArgumentList 'src/app.ts' -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -Environment @{ PORT = '3011' }
> try {
>   $ready = $false
>   for ($i=0; $i -lt 40; $i++) {
>     try { Invoke-WebRequest -UseBasicParsing 'http://localhost:3011/health' -TimeoutSec 1 | Out-Null; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
>   }
>   if (-not $ready) { throw 'server did not start' }
>
>   $publicWorks = Invoke-RestMethod -Uri 'http://localhost:3011/works?raceId=race-review-1' -Method Get
>
>   $orgSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
>   Invoke-RestMethod -Uri 'http://localhost:3011/auth/github' -Method Post -WebSession $orgSession -ContentType 'application/json' -Body '{"githubAccount":"recyclable06","displayName":"recyclable06"}' | Out-Null
>   $orgWorks = Invoke-RestMethod -Uri 'http://localhost:3011/works?raceId=race-review-1' -Method Get -WebSession $orgSession
>
>   $judgeSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
>   Invoke-RestMethod -Uri 'http://localhost:3011/auth/github' -Method Post -WebSession $judgeSession -ContentType 'application/json' -Body '{"githubAccount":"review-judge","displayName":"review-judge"}' | Out-Null
>   $judgeAssignments = Invoke-RestMethod -Uri 'http://localhost:3011/judge-assignments/mine' -Method Get -WebSession $judgeSession
>
>   $result = [ordered]@{
>     publicWorkIds = @($publicWorks | ForEach-Object { $_.id })
>     publicWarningCounts = @($publicWorks | ForEach-Object { "$($_.id):$($_.reviewWarnings.Count)" })
>     organizerWorkIds = @($orgWorks | ForEach-Object { "$($_.id):$($_.status):$($_.visibility):$($_.reviewWarnings.Count)" })
>     organizerCanSeeDraft = [bool](@($orgWorks | Where-Object { $_.id -eq 'work-review-3' }).Count)
>     organizerPublicFailedWarning = [bool](@($orgWorks | Where-Object { $_.id -eq 'work-review-1' -and $_.reviewWarnings.Count -gt 0 }).Count)
>     judgeAssignmentWarnings = @($judgeAssignments | ForEach-Object { "$($_.id):$($_.work.id):$($_.work.reviewWarnings.Count)" })
>   }
>   $result | ConvertTo-Json -Depth 5
> } finally {
>   if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force }
> }`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
>
> </details>
>
> 临时 server 启动命令的 PowerShell 版本不支持 `Start-Process -Environment`，我会改用临时设置 `$env:PORT` 的方式重跑验证。
>
> <details><summary>Ran a command</summary>
>
> - Ran `$serverDir = Join-Path (Get-Location) 'server'
> $out = Join-Path $env:TEMP 'ary-c-verify-out.log'
> $err = Join-Path $env:TEMP 'ary-c-verify-err.log'
> $oldPort = $env:PORT
> $env:PORT = '3011'
> $p = Start-Process -FilePath (Join-Path $serverDir 'node_modules\.bin\tsx.cmd') -ArgumentList 'src/app.ts' -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
> $env:PORT = $oldPort
> try {
>   $ready = $false
>   for ($i=0; $i -lt 40; $i++) {
>     try { Invoke-WebRequest -UseBasicParsing 'http://localhost:3011/health' -TimeoutSec 1 | Out-Null; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
>   }
>   if (-not $ready) { Get-Content $err -ErrorAction SilentlyContinue; throw 'server did not start' }
>
>   $publicWorks = Invoke-RestMethod -Uri 'http://localhost:3011/works?raceId=race-review-1' -Method Get
>
>   $orgSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
>   Invoke-RestMethod -Uri 'http://localhost:3011/auth/github' -Method Post -WebSession $orgSession -ContentType 'application/json' -Body '{"githubAccount":"recyclable06","displayName":"recyclable06"}' | Out-Null
>   $orgWorks = Invoke-RestMethod -Uri 'http://localhost:3011/works?raceId=race-review-1' -Method Get -WebSession $orgSession
>
>   $judgeSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
>   Invoke-RestMethod -Uri 'http://localhost:3011/auth/github' -Method Post -WebSession $judgeSession -ContentType 'application/json' -Body '{"githubAccount":"review-judge","displayName":"review-judge"}' | Out-Null
>   $judgeAssignments = Invoke-RestMethod -Uri 'http://localhost:3011/judge-assignments/mine' -Method Get -WebSession $judgeSession
>
>   $result = [ordered]@{
>     publicWorkIds = @($publicWorks | ForEach-Object { $_.id })
>     publicWarningCounts = @($publicWorks | ForEach-Object { "$($_.id):$($_.reviewWarnings.Count)" })
>     organizerWorkIds = @($orgWorks | ForEach-Object { "$($_.id):$($_.status):$($_.visibility):$($_.reviewWarnings.Count)" })
>     organizerCanSeeDraft = [bool](@($orgWorks | Where-Object { $_.id -eq 'work-review-3' }).Count)
>     organizerPublicFailedWarning = [bool](@($orgWorks | Where-Object { $_.id -eq 'work-review-1' -and $_.reviewWarnings.Count -gt 0 }).Count)
>     judgeAssignmentWarnings = @($judgeAssignments | ForEach-Object { "$($_.id):$($_.work.id):$($_.work.reviewWarnings.Count)" })
>   }
>   $result | ConvertTo-Json -Depth 5
> } finally {
>   if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force }
> }`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
>
> </details>
>
> `Start-Process` 在当前 PowerShell 环境又触发了环境变量大小写冲突。我会改用 `tsx --eval` 在同一个 Node 进程内启动 app、发请求验证、然后退出，避免后台进程管理问题。
>
> <details><summary>Ran a command</summary>
>
> - Ran `.\node_modules\.bin\tsx.cmd --eval "process.env.PORT='3011'; await import('./src/app.ts'); for (let i=0;i<40;i++){ try { const r=await fetch('http://localhost:3011/health'); if (r.ok) break; } catch {} await new Promise(r=>setTimeout(r,250)); } async function login(account){ const r=await fetch('http://localhost:3011/auth/github',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({githubAccount:account,displayName:account})}); return r.headers.get('set-cookie').split(';')[0]; } const pub=await (await fetch('http://localhost:3011/works?raceId=race-review-1')).json(); const orgCookie=await login('recyclable06'); const org=await (await fetch('http://localhost:3011/works?raceId=race-review-1',{headers:{cookie:orgCookie}})).json(); const judgeCookie=await login('review-judge'); const judge=await (await fetch('http://localhost:3011/judge-assignments/mine',{headers:{cookie:judgeCookie}})).json(); console.log(JSON.stringify({publicWorkIds:pub.map(w=>w.id),publicWarningCounts:pub.map(w=>w.id+':'+w.reviewWarnings.length),organizerWorkIds:org.map(w=>w.id+':'+w.status+':'+w.visibility+':'+w.reviewWarnings.length),organizerCanSeeDraft:org.some(w=>w.id==='work-review-3'),organizerPublicFailedWarning:org.some(w=>w.id==='work-review-1'&&w.reviewWarnings.length>0),judgeAssignmentWarnings:judge.map(a=>a.id+':'+a.work.id+':'+a.work.reviewWarnings.length)},null,2)); process.exit(0);"`
>
> </details>
>
> `tsx --eval` 默认按 CJS 转换，不支持顶层 await；我会用 async IIFE 包一层重跑同样验证。
>
> <details><summary>Ran a command</summary>
>
> - Ran `.\node_modules\.bin\tsx.cmd --eval "(async()=>{process.env.PORT='3011'; await import('./src/app.ts'); for (let i=0;i<40;i++){ try { const r=await fetch('http://localhost:3011/health'); if (r.ok) break; } catch {} await new Promise(r=>setTimeout(r,250)); } async function login(account){ const r=await fetch('http://localhost:3011/auth/github',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({githubAccount:account,displayName:account})}); return r.headers.get('set-cookie').split(';')[0]; } const pub=await (await fetch('http://localhost:3011/works?raceId=race-review-1')).json(); const orgCookie=await login('recyclable06'); const org=await (await fetch('http://localhost:3011/works?raceId=race-review-1',{headers:{cookie:orgCookie}})).json(); const judgeCookie=await login('review-judge'); const judge=await (await fetch('http://localhost:3011/judge-assignments/mine',{headers:{cookie:judgeCookie}})).json(); console.log(JSON.stringify({publicWorkIds:pub.map(w=>w.id),publicWarningCounts:pub.map(w=>w.id+':'+w.reviewWarnings.length),organizerWorkIds:org.map(w=>w.id+':'+w.status+':'+w.visibility+':'+w.reviewWarnings.length),organizerCanSeeDraft:org.some(w=>w.id==='work-review-3'),organizerPublicFailedWarning:org.some(w=>w.id==='work-review-1'&&w.reviewWarnings.length>0),judgeAssignmentWarnings:judge.map(a=>a.id+':'+a.work.id+':'+a.work.reviewWarnings.length)},null,2)); process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});"`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 临时 API 验证拿到了预期 JSON，但 Node 在强制退出时触发了 Windows libuv 断言，命令退出码不是干净的。为得到干净证据，我会补跑一个不启动 server 的 `authorize()` 级验证，确认多作用域和 managed-race 边界。
>
> <details><summary>Ran a command</summary>
>
> - Ran `.\node_modules\.bin\tsx.cmd --eval "(async()=>{const {authorize}=await import('./src/shared/auth.ts'); const organizer={userId:'org-1',displayName:'Org',roles:['organizer']}; const judge={userId:'judge-1',displayName:'Judge',roles:['judge']}; const rider={userId:'rider-1',displayName:'Rider',roles:['rider']}; const result={owner:authorize(rider,'Work','view_private',{ownerUserId:'rider-1'}),managed:authorize(organizer,'Work','view_private',{raceOrganizerIds:['org-1']}),wrongOrganizer:authorize(organizer,'Work','view_private',{raceOrganizerIds:[]}),assigned:authorize(judge,'Work','view_private',{assignedJudgeUserId:'judge-1',raceOrganizerIds:[]})}; console.log(JSON.stringify(result,null,2)); const ok=result.owner.allowed&&result.managed.allowed&&!result.wrongOrganizer.allowed&&result.assigned.allowed; process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(1);});"`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 多作用域鉴权的边界验证已干净通过：owner、managed organizer、assigned judge 放行，非 managed organizer 拒绝。接下来跑项目已有 build 脚本，补充比 `tsc --noEmit` 更接近交付的验证。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `npm run build`
> - Ran `npm run build`
> - Ran `git status --short`
>
> </details>
>
> Context compaction
>
> Source: automatic
> Status: completed
>
> Stream error
>
> Reconnecting 2/2
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> System error
>
> Error running remote compact task: stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> <details><summary>Plan</summary>
>
> - [x] 复核当前 auth/routes/frontend 相关代码
> - [x] 实施 auth.ts 与 portfolio routes 修正
> - [ ] 实施 OrganizerJudging 进度统计修正
> - [ ] 运行静态检查和测试验证
>
> </details>
</details>

<details><summary>30 previous messages</summary>

> Context compaction
>
> Source: automatic
> Status: completed
>
> Stream error
>
> Reconnecting 5/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 我会先做一次当前状态复核：确认三处代码点确实按方案落地，再跑能在这个环境里稳定运行的验证；如果只剩环境限制，我会把限制和已验证证据分开说明。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 PLAN.md`
> - Ran `Select-String -Path server\src\shared\auth.ts -Pattern 'type ScopeReqSpec|view_private|function authorize|function authorizeScope' -Context 3,8`
> - Ran `Select-String -Path server\src\modules\portfolio\routes.ts -Pattern 'function canReadWork|function canReadPrivateWork|function shouldIncludeWorkWarnings|Work", "review|Work", "view_private' -Context 3,12`
> - Ran `Select-String -Path client\src\pages\console\OrganizerJudging.tsx -Pattern 'loadAssignmentsForWorks|selectedAssignments|progressRows|useEffect' -Context 2,10`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 静态复核显示三处目标改动都在当前工作树里：`auth.ts` 已支持 `view_private` 多 scope，`routes.ts` 的 Work 私有读与 warnings 复用同一授权判断，`OrganizerJudging` 已按全部 works 拉取分配数据。接下来跑类型检查和几个定向搜索来确认没有遗留旧调用。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `rg 'Work", "review|Work", "view_private|view_private:\[|canReadPrivateWork|loadAssignmentsForWorks|loadAssignments\(' server\src\shared\auth.ts server\src\modules\portfolio\routes.ts client\src\pages\console\OrganizerJudging.tsx`
> - Ran `.\node_modules\.bin\tsc.cmd --noEmit`
> - Ran `.\node_modules\.bin\tsc.cmd --noEmit`
>
> </details>
>
> `rg` 确认路由里没有残留的 `Work.review` 授权路径；server/client 的 `tsc --noEmit` 都通过。现在补跑 build 和脚本入口，区分代码问题与本地 shell 环境问题。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `npm run build`
> - Ran `npm run build`
> - Ran `Get-Command bash -ErrorAction SilentlyContinue | Select-Object Source,Version`
>
> </details>
>
> Stream error
>
> Reconnecting 4/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> `server` build 通过；`client` build 失败点在 Vite/esbuild 读取配置时被沙箱拒绝，`tsc` 阶段已单独通过。按执行规则，我会用提权重跑一次 `client npm run build` 来确认这是否只是沙箱限制。
>
> <details><summary>Ran a command</summary>
>
> - Ran `npm run build`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 提权后的 `client` build 已通过，说明前一次确实是沙箱限制。最后尝试模块测试脚本入口；这里如果仍命中 Windows 自带 WSL `bash.exe`，我会把它作为环境限制记录，不当作代码失败。
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `bash server/src/modules/portfolio/test.sh`
> - Ran `git diff -- server/src/shared/auth.ts server/src/modules/portfolio/routes.ts client/src/pages/console/OrganizerJudging.tsx`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 模块脚本入口在当前工具里仍调用 Windows 自带 WSL `bash.exe`，不是 Git Bash，因此无法执行 `test.sh`。我再单独看一下 `routes.ts` 的 diff 和工作树状态，避免遗漏实际修改范围。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `git diff -- server/src/modules/portfolio/routes.ts`
> - Ran `Select-String -Path C:\Users\Administrator\.codex\memories\MEMORY.md -Pattern 'ARY-3|module C|portfolio|auth.ts|bash.exe|test.sh|vite.config' | Select-Object LineNumber,Line`
> - Ran `git status --short`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 这里有个需要分清的点：`server/src/modules/portfolio/` 目前整体还是未跟踪目录，所以 `git diff` 不会展示 `routes.ts` 的变化；我用文件内容本身作为审查依据。接下来做一个更窄的授权逻辑运行验证，覆盖 owner/organizer/judge 三条私有读路径。
>
> <details><summary>Ran a command</summary>
>
> - Ran `.\node_modules\.bin\tsx.cmd --eval "import { authorize } from './src/shared/auth.ts'; const owner={userId:'owner-1',displayName:'Owner',roles:['rider']}; const organizer={userId:'org-1',displayName:'Organizer',roles:['organizer']}; const otherOrganizer={userId:'org-2',displayName:'Other',roles:['organizer']}; const judge={userId:'judge-1',displayName:'Judge',roles:['judge']}; const results={owner:authorize(owner,'Work','view_private',{ownerUserId:'owner-1'}),managed:authorize(organizer,'Work','view_private',{raceOrganizerIds:['org-1']}),wrongOrganizer:authorize(otherOrganizer,'Work','view_private',{raceOrganizerIds:[]}),assigned:authorize(judge,'Work','view_private',{assignedJudgeUserId:'judge-1',raceOrganizerIds:[]})}; console.log(JSON.stringify(results,null,2)); if(!results.owner.allowed||!results.managed.allowed||results.wrongOrganizer.allowed||!results.assigned.allowed){ process.exit(1); }"`
>
> </details>
>
> 授权运行验证通过：owner、managed organizer、assigned judge 都允许，传空 `raceOrganizerIds` 的非上下文 organizer 被拒绝。这也覆盖了我们对 `MANAGED_RACE` 默认行为的防漏处理。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `Get-Content -Raw -Encoding UTF8 server\src\shared\auth.ts`
> - Ran `Get-Content -Encoding UTF8 server\src\modules\portfolio\routes.ts | Select-Object -Skip 830 -First 55`
> - Ran `Get-Content -Encoding UTF8 client\src\pages\console\OrganizerJudging.tsx | Select-Object -Skip 35 -First 95`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 我看到 `auth.ts` 的运行结果符合本次授权修正目标，且 `OrganizerJudging` 的进度统计已从全量 assignments 计算。为尽量补齐脚本验证，我会查一下机器上是否存在未进 PATH 的 Git Bash；如果没有，就只能保留环境限制。
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `Test-Path 'C:\Program Files\Git\bin\bash.exe'; Test-Path 'C:\Program Files\Git\usr\bin\bash.exe'; Test-Path 'C:\Program Files (x86)\Git\bin\bash.exe'; Test-Path 'C:\Program Files (x86)\Git\usr\bin\bash.exe'`
> - Ran `Get-Content -Encoding UTF8 C:\Users\Administrator\.codex\memories\MEMORY.md | Select-Object -First 60`
>
> </details>
>
> Stream error
>
> Reconnecting 1/5
> stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
>
> 当前审查结论是：三处方案修改已经落地，类型检查和生产构建通过；唯一没能在这个工具环境里跑的是 `test.sh`，因为机器只暴露了未配置的 WSL `bash.exe`，常见 Git Bash 路径也不存在。
>
> 结论：**通过**。
>
> 已按确认方案完成并审查三处修改：
>
> - [server/src/shared/auth.ts](./server/src/shared/auth.ts)：`authorize()` 支持多 scope；`Work.view_private` 调整为 `OWN / ASSIGNED / MANAGED_RACE`。
> - [server/src/modules/portfolio/routes.ts](./server/src/modules/portfolio/routes.ts)：`canReadWork()` 补齐 managed race 私有读路径；`shouldIncludeWorkWarnings()` 改为 owner / organizer / assigned judge 可见，匿名 public 访问仍不暴露 warnings。
> - [client/src/pages/console/OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx)：评审进度改为对全部 works 拉取 assignments 后统计，不再只统计当前选中 Work。
>
> 验证结果：
>
> - `server`: `tsc --noEmit` 通过，`npm run build` 通过。
> - `client`: `tsc --noEmit` 通过，提权重跑 `npm run build` 通过；未提权时失败是 Vite/esbuild 读取配置被沙箱拦截。
> - 定向授权验证通过：owner、managed organizer、assigned judge 可读私有 Work；无 managed 上下文的 organizer 被拒绝。
> - `bash server/src/modules/portfolio/test.sh` 在当前工具环境仍无法执行，因为 `bash` 解析到未配置的 Windows WSL `bash.exe`，常见 Git Bash 路径也不存在；未计为代码失败。
>
> 目标已标记完成。记录用时约 22 分钟，`tokensUsed=130158`。
>
> <details><summary>Plan</summary>
>
> - [x] 复核当前代码修改点
> - [x] 运行可用验证命令
> - [ ] 汇总审查结论
>
> </details>
</details>

结论：**通过**。

已按确认方案完成并审查三处修改：

- [server/src/shared/auth.ts](./server/src/shared/auth.ts)：`authorize()` 支持多 scope；`Work.view_private` 调整为 `OWN / ASSIGNED / MANAGED_RACE`。
- [server/src/modules/portfolio/routes.ts](./server/src/modules/portfolio/routes.ts)：`canReadWork()` 补齐 managed race 私有读路径；`shouldIncludeWorkWarnings()` 改为 owner / organizer / assigned judge 可见，匿名 public 访问仍不暴露 warnings。
- [client/src/pages/console/OrganizerJudging.tsx](./client/src/pages/console/OrganizerJudging.tsx)：评审进度改为对全部 works 拉取 assignments 后统计，不再只统计当前选中 Work。

验证结果：

- `server`: `tsc --noEmit` 通过，`npm run build` 通过。
- `client`: `tsc --noEmit` 通过，提权重跑 `npm run build` 通过；未提权时失败是 Vite/esbuild 读取配置被沙箱拦截。
- 定向授权验证通过：owner、managed organizer、assigned judge 可读私有 Work；无 managed 上下文的 organizer 被拒绝。
- `bash server/src/modules/portfolio/test.sh` 在当前工具环境仍无法执行，因为 `bash` 解析到未配置的 Windows WSL `bash.exe`，常见 Git Bash 路径也不存在；未计为代码失败。

目标已标记完成。记录用时约 22 分钟，`tokensUsed=130158`。
