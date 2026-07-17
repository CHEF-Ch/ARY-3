# 调整 CA 异常口径

> 我现在发现仍检出旧 CA 门禁口径，需把 CA 异常统一改为风险提示和审计线索，而不是资格硬门禁。计划如何修正

<details><summary>8 previous messages</summary>

> 我先核对当前近期窗口、任务定义和产品验收口径，定位“旧 CA 门禁”具体残留在哪些规则、状态与测试中，再给出可执行的修正规划；这一步只做只读检查，不改文件。
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `Get-Content -Raw .\docs\ary.plan.md`
> - Ran `Get-Content -Raw .\docs\README.md`
> - Ran `Get-Content -Raw .\docs\ary-mvp.prd.md`
> - Ran `Get-Content -Raw .\STATUS.md`
> - Ran `Get-Content -Raw .\PLAN.md`
>
> </details>
>
> 现有权威文档的目标口径已经明确：CA 只决定证据是否可信、完整，不决定 Registration、提交、评审或 Award 资格。下一步我会把仓库中的残留分成“业务判定、接口/UI 文案、测试断言、文档验收”四类，避免只改措辞而漏掉实际阻断逻辑。
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `Get-Content -Raw .\docs\registration-ca-rules-alignment.taskbook.md`
> - Ran `rg -n -i --glob '!node_modules/**' --glob '!dist/**' "eligib|ineligib|资格|门禁|硬门禁|准入|阻断|不允许提交|禁止提交|不能提交" .`
> - Ran `rg -n -i --glob '!node_modules/**' --glob '!dist/**' "CAConnection|ca_connection|caConnection|ingestionStatus|ingestion_status|not_configured|failed" server client docs design-prototype`
> - Ran `rg -n -i --glob '!node_modules/**' --glob '!dist/**' "review.?readiness|review.?flag|risk.?flag|风险提示|审计线索|audit" server client docs`
> - Ran `rg -n -i "aggregate_ingestion_status|ingestion_status|not_configured|failed|eligib|资格|门禁" server/src client/src --glob '*.{ts,tsx,js,mjs}'`
> - Ran `rg -n "submit|judg|award|registration" server/src/modules/portfolio server/src/modules/race-mgmt --glob '*.{ts,js,mjs}'`
> - Ran `rg -n -C 5 "reviewWarnings|aggregate_ingestion_status|ingestion_status" server/src/modules/portfolio client/src/pages/console client/src/pages/works`
> - Ran `git status --short`
>
> </details>
>
> 刚才并行检索遇到 Windows 进程启动限制，没有产生写入。我会缩小到实现目录逐项核对，重点确认 CA 状态是否仍被用于 `submit / judging / award` 的拒绝条件，以及风险提示是否真正返回给 Organizer / Judge。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `rg -n -i "aggregate_ingestion_status|ingestion_status|not_configured|failed|eligib|资格|门禁" server/src client/src --glob '*.{ts,tsx,js,mjs}'`
> - Ran `rg -n "submit|judg|award|registration" server/src/modules/portfolio server/src/modules/race-mgmt --glob '*.{ts,js,mjs}'`
> - Ran `git status --short`
>
> </details>
>
> 从实现侧看，提交接口目前只校验 Registration、赛事阶段、作品状态和权限，没有用 CA 状态拒绝提交；`not_configured / failed` 已被转换成 `reviewWarnings`。真正的缺口更像是“防回归与语义统一不完整”：CA 数据接收仍需安全拒收，但这种拒收必须沉淀为审计线索，不能被上层误读成参赛资格失败。
>
> <details><summary>Ran a command</summary>
>
> - Ran `Get-Content .\server\src\modules\portfolio\routes.ts | Select-Object -Skip 235 -First 70`
>
> </details>
</details>

建议重新打开 `PRD-TEMP-1`，从“待复审”调整为“整改中”。本轮不只是替换文案，而是建立一条明确边界：

> CA 校验可以拒收不可信数据，但任何 CA 异常都不能拒绝参赛、作品提交、评审或 Award；异常统一输出为风险提示和可追溯审计线索。

修正计划如下：

1. **清理残留旧口径**
   - 修改 [ary-ca-integration-spec.md](./docs/ary-ca-integration-spec.md:254) 和 [ary-ca-integration-spec.md](./docs/ary-ca-integration-spec.md:355) 示例中的 `registration eligibility gate`。
   - 将 [ary.plan.md](./docs/ary.plan.md:187) 的 `mock eligibility` 改成明确的“流程前置条件”，避免再次被理解为 CA 资格检查。
   - 区分任务书里的“历史旧口径说明”和现行规则，避免关键词扫描把历史背景误报为有效要求。

2. **统一领域语义**
   - CA 状态只影响：
     - 数据是否进入 `Session / Evidence / Projection / Report`
     - `ReviewFlag / ReviewWarning`
     - `IngestionAudit`
   - CA 状态不得影响：
     - `Registration.status`
     - Work 创建和提交
     - JudgeAssignment、JudgingRecord
     - Award 创建和发布
   - 明确保留的唯一“门禁”是 CA 数据可信性门禁，不是参赛资格门禁。

3. **统一异常输出**
   - `not_configured`、无有效 Session、握手失败、连接禁用、签名失败、重放等统一映射为稳定的风险码。
   - Organizer / Judge 获得风险摘要和审计引用；Rider 获得可操作的接入提示。
   - Public 默认不暴露内部风险与审计详情。
   - 审计记录保留原因、连接、发生时间和处理结果，但敏感签名、nonce、原始载荷继续脱敏。

4. **补齐实现防回归**
   - 检查所有 `submit / judging / award` 路由，禁止读取 CA 状态作为 `4xx` 拒绝条件。
   - 保留非法 CA 消息拒收逻辑，并确认拒收后写入 `ingestion_audits`。
   - 将 Portfolio 当前的 `reviewWarnings` 与 race-mgmt 的 ingestion audit 建立可追溯关联，避免只有提示、没有证据入口。

5. **增加端到端验收矩阵**
   - `not_configured`：Work 可提交，评审可继续，出现风险提示。
   - `failed`：Work 可提交，可评分，可授奖，出现风险提示和审计线索。
   - 签名错误、重放、连接禁用：消息不进入事实链，但参赛流程不受阻。
   - `active`：正常形成 Evidence，无异常提示。
   - 混合多 CA：合法连接继续生效，异常连接单独留痕，不拖累整个 RaceProject。

6. **收口项目状态**
   - 开工时更新 `PLAN.md`、`STATUS.md`，将该任务重新标记为整改中。
   - 文档、实现和测试全部通过后，再恢复“待复审”。
   - 最终验收不能只靠旧关键词清零，还要用行为测试证明 CA 异常不会导致提交、评审或 Award 返回拒绝。

本轮不改变空作品、缺必填材料、违规作品的独立处理规则，也不放宽 CA 数据真实性校验。核心是把“数据能否被信任”和“选手是否有资格继续比赛”彻底拆开。

> 按照计划开始

<details><summary>37 previous messages</summary>

> 我按刚才的边界开始实施：先把 `PRD-TEMP-1` 重新置为整改中并清理文档残留，再统一后端风险提示与审计关联，最后补防回归测试并更新 `PLAN.md`、`STATUS.md`。CA 消息真实性校验仍保留，变化只针对参赛资格和上层流程。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `git status --short`
> - Ran `git status --short`
> - Ran `git status --short`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
>
> </details>
>
> 工作树里只有 `Riding Record` 下的既有删除与新增，我不会触碰。现在先读取 Portfolio 风险提示生成、CA 审计响应和现有测试脚本的相邻代码，确保改动沿用现有数据结构。
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `Get-Content .\server\src\modules\portfolio\routes.ts | Select-Object -Skip 235 -First 75`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
> - Ran `Get-Content .\server\src\modules\portfolio\routes.ts | Select-Object -Skip 750 -First 105`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Read-only inspection of a specific local source file is a routine, reversible action with no meaningful risk.
> - Ran `Get-Content .\server\src\modules\race-mgmt\routes.ts | Select-Object -Skip 900 -First 70`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Read-only inspection of a specific local source file is low-risk and directly supports the user-authorized code review task.
> - Ran `Get-Content .\server\src\modules\portfolio\test.sh | Select-Object -First 260`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Reading a specific local test file is a narrowly scoped, read-only action with minimal risk and is directly aligned with the user-authorized task.
>
> </details>
>
> Stream error
>
> Reconnecting 3/5
> unexpected status 403 Forbidden: 令牌额度不足：模型 gpt-5.6-sol，预估上下文约 60925 tokens，最低需预扣 ¥0.106618，令牌剩余额度 ¥0.060944。请充值，或减小上下文 / 降低 max_tokens 后重试。 (request id: 202607170951046098560198268d9d65TNhUfv3), url: https://www.micuapi.ai/v1/responses, cf-ray: a1c858912868fd90-SIN
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `Get-Content -Raw .\server\package.json`
> - Ran `Get-Content -Raw .\package.json`
>
> </details>
>
> 现有 Portfolio 回归已经覆盖 `failed` 状态下仍能提交、评审、授奖，这是可复用的基础。我要补的关键能力是：风险提示返回非敏感审计摘要（关联连接、拒收次数、最近原因与时间），并增加 `not_configured` 同样不阻断流程的断言；不会把 nonce、签名或 payload 暴露到 Portfolio 响应。
>
> <details><summary>Denied a request, ran a command</summary>
>
> - Ran `Get-Content .\server\src\modules\portfolio\routes.ts | Select-Object -First 155`
> - Auto-review: denied
> - Auto-review risk: high
> - Auto-review rationale: Automatic approval review failed: unexpected status 403 Forbidden: 令牌额度不足：模型 codex-auto-review，预估上下文约 100830 tokens，最低需预扣 ¥0.176452，令牌剩余额度 ¥0.169234。请充值，或减小上下文 / 降低 max_tokens 后重试。 (request id: 202607170951403679984728268d9d6pLjt2nEG), url: https://www.micuapi.ai/v1/responses, cf-ray: a1c85973dceecb36-SIN
>
> </details>
>
> 沙箱外只读请求被审批服务因额度问题拒绝，和仓库内容无关。我会改用权限更低的工作区内只读方式继续；若 Windows 沙箱仍无法启动进程，我会停在不需要猜测代码结构的位置。
>
> <details><summary>Ran a command</summary>
>
> - Ran `Get-Content .\server\src\modules\portfolio\routes.ts | Select-Object -First 155`
>
> </details>
>
> 我先落文档和项目状态：把任务重新打开，清除会触发旧口径检出的 `eligibility gate / mock eligibility`，并把“风险提示 + 非敏感审计线索”的输出和验收写进权威文档。实现文件将在能够可靠读取后再改，避免盲改现有类型。
>
> <details><summary>Edited 8 files, ran 14 commands</summary>
>
> - Wrote `./PLAN.md` (+2 -2)
> - Wrote `./STATUS.md` (+2 -2)
> - Wrote `./docs/ary-ca-integration-spec.md` (+2 -2)
> - Wrote `./docs/ary.plan.md` (+4 -4)
> - Wrote `./docs/ary-ca-integration-spec.md` (+3 -1)
> - Wrote `./docs/ary-domain-analysis.v0.3.md` (+3 -2)
> - Wrote `./docs/ary-mvp.prd.md` (+3 -2)
> - Wrote `./docs/ary-qa-plan.md` (+5 -2)
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+4 -3)
> - Ran `rg -n "registration eligibility gate|mock eligibility|CA 数据接收校验|审计线索|PRD-TEMP-1" PLAN.md STATUS.md docs`
> - Ran `rg -n -C 8 "interface ReviewWarning|interface RaceProject" server/src/modules/portfolio/routes.ts`
> - Ran `rg -n -C 8 "interface IngestionAudit|interface CAConnection" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -C 8 "export type ReviewWarning|interface ReviewWarning|type ReviewWarning" client/src/shared/apiTypes.ts`
> - Ran `rg -n -C 12 "function toWorkResponse" server/src/modules/portfolio/routes.ts`
> - Ran `rg -n -C 12 "function toIngestionAuditResponse" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -A 20 "interface IngestionAudit" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -A 35 "function toWorkResponse" server/src/modules/portfolio/routes.ts`
> - Ran `rg -n -C 5 "reviewWarnings:" server/src/modules/portfolio/routes.ts`
> - Ran `rg -n -C 8 "connection_failed|signature_mismatch|nonce_replay|disabled" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -C 5 "insert\(\"ingestion_audits\"" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -A 38 "function recordIngestionAudit" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -C 12 "recordIngestionAudit\(" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -C 8 "const updated = update<CAConnection>\(\"ca_connections\", connection.id" server/src/modules/race-mgmt/routes.ts`
>
> </details>
>
> 实现改动会保持现有 API 兼容：只给 `ReviewWarning` 增加可选的 `auditSummary`，并在握手失败、连接禁用时补写接入审计事件。风险摘要仅包含事件数、最近原因/时间、事件 ID 和连接 ID，不返回 detail、nonce、sequence、payload hash 或签名。
>
> <details><summary>Edited 4 files</summary>
>
> - Wrote `./client/src/shared/apiTypes.ts` (+15 -8)
> - Wrote `./server/src/modules/portfolio/routes.ts` (+63 -28)
> - Wrote `./server/src/modules/race-mgmt/routes.ts` (+41 -18)
> - Wrote `./server/src/modules/portfolio/test.sh` (+17 -10)
> - Wrote `./server/src/modules/race-mgmt/routes.ts` (+3 -2)
>
> </details>
>
> 核心实现已经接上：失败风险提示现在能携带脱敏审计摘要，握手失败与连接禁用也会写审计事件。接下来补两层验证：Portfolio 确认异常状态不阻断业务流程且不泄露敏感字段，race-mgmt 确认生命周期异常确实进入审计。
>
> <details><summary>Edited 2 files, ran 4 commands</summary>
>
> - Ran `rg -n -C 18 "handshake|disable|ingestion-review" server/src/modules/race-mgmt/security-smoke-test.mjs`
> - Ran `rg -n -C 8 "test-c-ingestion-audit|auditSummary" server/src/modules/portfolio/test.sh`
> - Ran `rg -n "registration eligibility gate|mock eligibility|EligibilitySignal" docs PLAN.md STATUS.md`
> - Ran `rg -n -C 4 "handshake_verification_failed|connection_disabled|rejectedEvents" server/src/modules/race-mgmt/routes.ts`
> - Wrote `./server/src/modules/race-mgmt/security-smoke-test.mjs` (+21 -4)
> - Wrote `./server/src/modules/portfolio/test.sh` (+29 -10)
>
> </details>
>
> 代码与测试用例已补齐，现在进入验证：先跑服务端 TypeScript 构建，再跑 race-mgmt 安全 smoke test 和 Portfolio 端到端脚本。这里会验证两件最重要的事：异常 CA 数据仍被拒收并留审计，同时 `failed / not_configured` 不阻断提交、评审和授奖。
>
> <details><summary>Ran a command</summary>
>
> - Ran `npm.cmd run build`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the project build is a standard local verification step with limited, reversible workspace-side effects and directly supports the user-authorized implementation.
>
> </details>
>
> 构建没有进入编译阶段：`server/node_modules/.bin/tsc` 不存在，说明当前工作区的服务端依赖未安装或不完整。先确认依赖目录状态；若确实缺失，安装依赖需要网络权限，我会按最小范围请求。
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `Get-ChildItem -Force .\node_modules\.bin`
> - Ran `Get-ChildItem -Force`
> - Ran `npm.cmd ci`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Installing dependencies from the existing lockfile is a bounded local setup step needed for the user-authorized build/test workflow, with moderate risk from executing third-party package install scripts.
> - Ran `npm.cmd run build`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Re-running the local TypeScript build after installing dependencies is a standard verification step with limited, reversible workspace side effects.
> - Ran `npm.cmd run test:race-mgmt`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the local race-mgmt smoke test is a bounded verification step for the user-requested changes; it may mutate test data locally but has limited, reversible workspace impact.
>
> </details>
>
> TypeScript 构建通过。race-mgmt 测试在启动前置数据阶段失败，原因是 `database/data/users.json` 尚未初始化，不是断言失败；我会先运行仓库提供的迁移/种子命令，再重跑测试。
>
> <details><summary>Ran 6 commands</summary>
>
> - Ran `npm.cmd run db:migrate`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the repository’s database migration is a standard local setup step to create test data files needed for the user-authorized verification workflow, with bounded reversible local side effects.
> - Ran `npm.cmd run test:race-mgmt`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Re-running the local race-mgmt smoke test after migration is a bounded verification step for the user-requested changes, with only limited reversible local test-data side effects.
> - Ran `npm.cmd run db:seed`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the repository’s seed command is a standard local test-setup step to create missing smoke-test data, with bounded reversible side effects in the local project data store.
> - Ran `npm.cmd run test:race-mgmt`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Re-running the local race-mgmt smoke test after seeding is a bounded verification step for the user-requested changes, with only limited reversible local test-data side effects.
> - Ran `rg -n -C 6 "DATA_DIR|database|dataDir|users.json|process.cwd" server/src/db.ts server/src/modules/race-mgmt/security-smoke-test.mjs`
> - Ran `rg -n -C 12 "async function main|setOrganizerRole|auth/register|spawn" server/src/modules/race-mgmt/security-smoke-test.mjs`
>
> </details>
>
> 迁移和种子命令都正常，但 smoke test 自己先清空数据，然后启动的子服务没有写出用户文件；脚本当前吞掉了服务启动日志，所以错误表现为缺少 `users.json`。我先直接检查构建产物能否启动，定位是端口占用还是服务启动配置问题。
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `node dist/app.js`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Briefly starting the built local service to inspect startup behavior is a bounded diagnostic step for the user-authorized test workflow, with limited reversible local side effects such as binding a local port or creating local data files.
> - Ran `rg -n -C 8 "listen\(|PORT|console.log" server/src/app.ts server/dist/app.js`
> - Ran `Get-NetTCPConnection -LocalPort 3120 -ErrorAction SilentlyContinue`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Checking whether local port 3120 is in use is a read-only diagnostic action with minimal risk and directly supports the user-authorized smoke-test troubleshooting.
> - Ran `rg -n -C 5 "auth/github|router.post|githubAccount" server/src/modules/identity/routes.ts server/src/app.ts`
> - Ran `rg -n -C 8 "auth.post\(" server/src/modules/identity/routes.ts`
> - Ran `rg -n -A 18 "function toUserResponse" server/src/modules/identity/routes.ts`
> - Ran `rg -n -A 48 "auth.post\(\"/register\"" server/src/modules/identity/routes.ts`
>
> </details>
>
> 定位到现有 smoke test 的独立老问题：它仍调用已删除的 `POST /auth/github` mock 入口，因此服务正常启动也不会创建用户。为使本次回归可运行，我会把脚本切到当前真实的 `/auth/register` 本地测试入口，继续保留随后显式设置 organizer 角色的测试逻辑。
>
> <details><summary>Edited a file, ran 2 commands</summary>
>
> - Wrote `./server/src/modules/race-mgmt/security-smoke-test.mjs` (+2 -2)
> - Ran `npm.cmd run test:race-mgmt`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Re-running the local race-mgmt smoke test after fixing its auth entrypoint is a bounded verification step for the user-authorized changes, with only limited reversible local test-data side effects.
> - Ran `bash ./src/modules/portfolio/test.sh`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the local Portfolio end-to-end test is a bounded verification step for the user-authorized changes, with only limited reversible local test-data and process side effects.
>
> </details>
>
> `bash` 命中了未安装发行版的 WSL，不是测试失败。仓库此前要求用 Git Bash 执行该脚本，我会改用本机 Git for Windows 的 Bash 路径重跑。
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `Get-ChildItem -Force 'C:\Program Files\Git\bin\bash.exe'`
> - Ran `& 'C:\Program Files\Git\bin\bash.exe' ./src/modules/portfolio/test.sh`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the local Portfolio end-to-end test via the verified Git Bash executable is a bounded verification step for the user-authorized changes, with only limited reversible local test-data and process side effects.
>
> </details>
>
> 两组关键回归都已通过：race-mgmt 验证握手失败、连接禁用和非法 push 都留审计；Portfolio 验证 `failed / not_configured` 下提交、评审、Award 全链路可继续，且公开端不暴露风险提示。现在做最后的关键词复查、前端类型检查和状态收口。
>
> <details><summary>Edited a file, ran 4 commands</summary>
>
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+1 -1)
> - Ran `Get-ChildItem -Force .\node_modules\.bin\tsc.cmd`
> - Ran `Get-ChildItem -Force`
> - Ran `npm.cmd ci`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Installing frontend dependencies from the existing lockfile is a bounded local setup step needed for the user-authorized type-check workflow, with moderate risk from executing third-party package install scripts.
> - Ran `npm.cmd run build`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the frontend build is a standard local verification step for the user-authorized changes, with limited reversible workspace side effects.
>
> </details>
>
> 前后端构建均通过。还差一个用户可见闭环：后端已返回审计摘要，但 Judge/Organizer 页面目前只显示风险条数和消息；我会在现有风险区域增加最近审计原因、事件数和时间，确保“审计线索”不是仅存在于 API 中。
>
> <details><summary>Edited 3 files, ran 6 commands</summary>
>
> - Ran `rg -n -C 14 "reviewWarnings.map|评审前风险提示|warning.message" client/src/pages/console/JudgeView.tsx`
> - Ran `rg -n -C 14 "reviewWarnings.map|评审前风险提示|warning.message" client/src/pages/console/OrganizerJudging.tsx`
> - Ran `rg -n -C 14 "reviewWarnings.map|评审前风险提示|warning.message" client/src/pages/works/WorksPage.tsx`
> - Ran `rg -n -C 4 "format.*Reason|toLocale|receivedAt" client/src/pages/console/JudgeView.tsx client/src/pages/console/OrganizerJudging.tsx client/src/pages/works/WorksPage.tsx`
> - Ran `rg -n -C 18 "selectedWork.*reviewWarnings|selectedWork \?" client/src/pages/console/OrganizerJudging.tsx`
> - Wrote `./client/src/pages/console/JudgeView.tsx` (+11 -6)
> - Wrote `./client/src/pages/console/OrganizerJudging.tsx` (+10 -3)
> - Wrote `./client/src/pages/works/WorksPage.tsx` (+9 -4)
> - Ran `npm.cmd run build`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Re-running the frontend build after the UI change is a standard local verification step with limited, reversible workspace side effects.
>
> </details>
>
> 可见页面也已接入脱敏审计线索，前端重新构建通过。最后我会检查 diff、残留旧关键词和格式问题，然后把 `PLAN.md` / `STATUS.md` 收口为“待复审”，并记录本轮验证证据。
>
> <details><summary>Edited 4 files, ran 7 commands</summary>
>
> - Ran `rg -n "registration eligibility gate|mock eligibility|EligibilitySignal" docs PLAN.md STATUS.md`
> - Ran `git diff --check`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
> - Ran `git diff --stat`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: This is a read-only git diff summary check with minimal risk and no side effects beyond inspecting local repository state.
> - Ran `git status --short`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Auto-review returned a low-risk allow decision.
> - Ran `git diff -- docs/ary-ca-integration-spec.md docs/ary.plan.md server/src/modules/portfolio/routes.ts server/src/modules/race-mgmt/routes.ts server/src/modules/race-mgmt/security-smoke-test.mjs client/src/shared/apiTypes.ts`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: This is a read-only git diff inspection of specific local files, with minimal risk and no side effects beyond reviewing repository state.
> - Ran `rg -n -C 3 "状态：|当前建议|首轮|二轮|本任务已完成" docs/registration-ca-rules-alignment.taskbook.md PLAN.md STATUS.md`
> - Wrote `./PLAN.md` (+2 -2)
> - Wrote `./STATUS.md` (+4 -4)
> - Wrote `./docs/README.md` (+1 -1)
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+3 -3)
> - Ran `rg -n "参赛资格条件|放弃参赛|注册阶段|开赛后只允许已登记|冻结语义|不进入提交、评审和 Award|已登记 CAConnection 聚合接入成功后|事后上传 Session Summary 补救" docs PLAN.md STATUS.md client/src server/src`
>
> </details>
>
> 最终复查确认残留全部集中在临时任务书的“旧口径复述”和旧关键词清单，业务代码与其他权威文档已清零。为了不再让自动检查把历史说明当成有效规则，我会把这部分改成不复述旧规则原句的迁移说明，并把验收方式改为行为断言。
>
> <details><summary>Edited a file, ran 7 commands</summary>
>
> - Ran `rg -n -C 3 "当前文档基线|旧规则|目标调整" docs/registration-ca-rules-alignment.taskbook.md`
> - Ran `rg -n -C 3 "UX-1：|建议验收搜索词|在本任务复审完成前" docs/registration-ca-rules-alignment.taskbook.md`
> - Ran `rg -n -A 42 "当前文档基线" docs/registration-ca-rules-alignment.taskbook.md`
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+19 -32)
> - Ran `rg -n "参赛资格条件|放弃参赛|注册阶段|开赛后只允许已登记|冻结语义|不进入提交、评审和 Award|已登记 CAConnection 聚合接入成功后|事后上传 Session Summary 补救|registration eligibility gate|mock eligibility|EligibilitySignal" docs PLAN.md STATUS.md client/src server/src`
> - Ran `git diff --check`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: This is a read-only git formatting check with minimal risk and no side effects beyond inspecting local repository state.
> - Ran `rg -n "auditSummary|getReviewAuditSummary|handshake_verification_failed|connection_disabled|CA not configured does not block" server/src client/src`
> - Ran `rg -n "二轮整改已完成|二轮整改完成|CA 数据接收校验|行为断言验收" PLAN.md STATUS.md docs`
>
> </details>
>
> <details><summary>Plan</summary>
>
> 文档、实现、UI 和回归测试均已完成；旧口径关键词清零，任务状态已收口为待复审。
>
> - [x] 核对工作树与目标文件，确定现有测试入口
> - [x] 更新 PLAN/STATUS 和权威文档中的 CA 语义
> - [x] 统一风险提示与审计线索实现
> - [x] 补充 CA 非门禁回归测试并执行验证
> - [x] 收口 PLAN/STATUS 与验收证据
>
> </details>
</details>

已按计划完成二轮整改，`PRD-TEMP-1` 已收口为“待复审”。

主要结果：

- CA 异常不再影响提交、评审或 Award，只生成风险提示和脱敏审计摘要：[routes.ts](./server/src/modules/portfolio/routes.ts:799)
- 握手失败、连接禁用均写入接入审计：[routes.ts](./server/src/modules/race-mgmt/routes.ts:791)
- Judge、Organizer 和内部作品详情可查看审计线索，公开响应仍隐藏风险信息。
- `failed / not_configured` 非门禁行为测试已补齐：[test.sh](./server/src/modules/portfolio/test.sh:188)
- 旧口径关键词检查已清零，状态同步到 [PLAN.md](./PLAN.md:17) 和 [STATUS.md](./STATUS.md:22)。

验证通过：

- 服务端 TypeScript build
- 客户端 production build
- race-mgmt security smoke test
- Portfolio Git Bash 端到端测试
- `git diff --check`

依赖审计仍报告服务端 1 个 moderate、客户端 1 个 moderate 和 1 个 high 漏洞，本次未做可能引入破坏性升级的 `npm audit fix --force`。`Riding Record` 下原有删除和新增改动未触碰。

> 问题理解与产品边界	10
> PRD / IA / 领域一致性	15
> UX 高保真原型与体验表达	15
> CA 接入、权限与评审风险语义	15
> QA / OPS / Demo 可复核性	10
> Agent Riding Skill 与过程质量	25
> 文档、表达与工程可交付性	10
> 按照这几个方面评分，然后给我修改建议

<details><summary>6 previous messages</summary>

> 我会按这 7 项做一次证据化评审，满分 100。重点不是看文档是否“写过”，而是看当前仓库能否从产品口径一路追溯到原型、实现、测试和 Agent 过程记录；本轮只评分和提建议，不修改文件。
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `Get-Content -Raw .\PLAN.md`
> - Ran `Get-Content -Raw .\STATUS.md`
> - Ran `Get-ChildItem -Force '.\Riding Record'`
> - Ran `rg -n "验收|风险|不做什么|CA|Review|Audit|Demo|回滚|证据" docs/ary-mvp.prd.md docs/ary-mvp.ia.md docs/ary-domain-analysis.v0.3.md docs/ary-permission-matrix.md docs/ary-qa-plan.md docs/ary-release-ops-plan.md docs/ux-hifi.taskbook.md docs/registration-ca-rules-alignment.taskbook.md`
> - Ran `rg -n "TODO|待定|待复审|暂缓|未完成|风险|缺口" PLAN.md STATUS.md docs design-prototype/README.md`
>
> </details>
>
> 文档侧已经能看出两点：CA/权限/评审风险的一致性很强，但 UX 尚未正式验收，完整联调和统一 P0 回归也未闭环。为了公平评价“高保真原型与体验表达”，我需要实际打开原型而不是只读说明；我会使用浏览器检查关键页面、异常态和移动端表现。
>
> <details><summary>Ran 2 commands, called a tool</summary>
>
> - Ran `Get-Content -Raw 'C:\Users\lenovo\.codex\plugins\cache\openai-bundled\browser\26.707.72221\skills\control-in-app-browser\SKILL.md'`
>
> - Ran `Start-Process python -ArgumentList '-m','http.server','4173' -WorkingDirectory 'D:\Learning\se_hw\ARY-3\design-prototype' -WindowStyle Hidden -PassThru | Select-Object Id`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Starting a hidden local static server for the project prototype is a bounded, reversible diagnostic step with only limited local side effects such as opening a localhost port, and it reasonably supports the user-requested UX review.
>
> MCP tool call
>
> node_repl.js
>
> ```json
> {
>   "title": "连接浏览器评审原型",
>   "code": "if (globalThis.agent?.browsers == null) {\n  const { setupBrowserRuntime } = await import(\"C:/Users/lenovo/.codex/plugins/cache/openai-bundled/browser/26.707.72221/scripts/browser-client.mjs\");\n  await setupBrowserRuntime({ globals: globalThis });\n}\nif (globalThis.browser == null) {\n  globalThis.browser = await agent.browsers.getForUrl(\"http://localhost:4173/\");\n  nodeRepl.write(await browser.documentation());\n}"
> }
> ```
>
> ```text
> No browser is available
> ```
>
> </details>
>
> 浏览器运行环境当前没有可用实例，我会按浏览器检查规范做一次连接诊断；若仍不可用，UX 分数会明确标注为“基于原型代码与说明、未完成视觉实测”，不会把未验证内容按满分计算。
>
> <details><summary>Ran 7 commands, called 2 tools</summary>
>
> MCP tool call
>
> node_repl.js
>
> ```json
> {
>   "title": "诊断浏览器连接",
>   "code": "nodeRepl.write(await agent.documentation.get(\"bootstrap-troubleshooting\"));"
> }
> ```
>
> ```text
> # Browser Runtime Troubleshooting
>
> - If browser setup completed but discovery or selection fails, reuse the existing `agent`; do not reset the JavaScript session or import another browser runtime.
> - Inspect `await agent.browsers.list()` once to see which browser types are available. Do not assume that a missing requested browser can be replaced with another backend when the user explicitly named it.
> - If a requested backend has specific troubleshooting documentation in the skill's setup catalog, read it before retrying.
> - If the requested browser remains unavailable, report that plainly instead of controlling it through an unrelated browser tool or source-code workaround.
> ```
>
> MCP tool call
>
> node_repl.js
>
> ```json
> {
>   "title": "检查可用浏览器",
>   "code": "nodeRepl.write(await agent.browsers.list());"
> }
> ```
>
> ```text
> []
> ```
>
> - Ran `Get-ChildItem -Force '.\Riding Record\陈齐锋'`
>
> - Ran `Get-ChildItem -Force '.\Riding Record\李维政'`
>
> - Ran `Get-ChildItem -Force '.\Riding Record\郑立峰'`
>
> - Ran `Get-Content -Raw '.\Riding Record\林泽群.md'`
>
> - Ran `Get-Content -Raw '.\Riding Record\骑行记录-E-report-gen.md'`
>
> - Ran `rg -n "目标|计划|验证|测试|失败|复盘|决策|风险|证据|commit|token|耗时|Agent|并行|分工|阻塞" "Riding Record" --glob '*.md'`
>
> - Ran `Stop-Process -Id 66884`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Stopping the specific temporary local server process the agent started is a low-risk cleanup action with a narrow, reversible effect.
>
> </details>
</details>

按当前仓库状态评分：**79 / 100**。整体已超过“文档型作业”，进入可运行工程阶段；主要失分在 UX 未正式验收、统一联调不足，以及 Riding Record 缺少标准化量化证据。

> UX 项因当前浏览器实例不可用，只能依据原型代码、设计说明和已有记录评分，未完成本轮视觉实测。

| 评分项 | 得分 | 判断 |
|---|---:|---|
| 问题理解与产品边界 | **9 / 10** | MVP、角色、事实源、Projection、Report 和各模块“不做什么”定义清晰，能主动避免跨模块越权。 |
| PRD / IA / 领域一致性 | **12 / 15** | 核心对象和 CA 新口径基本一致，但仍存在待定项和少量旧模型残留。 |
| UX 高保真原型与体验表达 | **10 / 15** | 页面覆盖和 IA 设计较完整，但尚未正式评审，响应式、异常态和真实交互证据不足。 |
| CA 接入、权限与评审风险语义 | **14 / 15** | 当前最强部分：数据接收门禁与参赛资格已分离，并有权限、审计和行为测试支撑。 |
| QA / OPS / Demo 可复核性 | **7 / 10** | 模块测试和 OPS 文档较扎实，但统一 P0、真机 DCR、完整彩排尚未闭环。 |
| Agent Riding Skill 与过程质量 | **19 / 25** | 有丰富过程记录、边界判断、失败恢复和测试意识，但记录不统一、过长且缺少量化复盘。 |
| 文档、表达与工程可交付性 | **8 / 10** | 文档路由和工程入口清晰，构建测试可执行；仍有状态矛盾、依赖风险和交付入口分散。 |

**主要依据**

- 产品硬约束明确：[ary-mvp.prd.md](./docs/ary-mvp.prd.md:348)
- 领域不变量完整：[ary-domain-analysis.v0.3.md](./docs/ary-domain-analysis.v0.3.md:938)
- CA 非门禁行为已有自动测试：[test.sh](./server/src/modules/portfolio/test.sh:188)
- CA 生命周期异常已有审计：[routes.ts](./server/src/modules/race-mgmt/routes.ts:791)
- UX 尚未正式验收：[STATUS.md](./STATUS.md:11)
- 完整 B/C/D/E 联调和统一 P0 仍缺：[STATUS.md](./STATUS.md:15)

**优先修改建议**

1. **正式冻结产品基线**

   复审并关闭 `PRD-TEMP-1`，同时确定三个待定项：空作品/缺材料的提交策略、CAConnection 最终新增窗口、违规作品人工处理流程。完成后同步 PRD、IA、领域、权限和 QA，不再让临时任务书承担长期规则。

2. **清理领域模型残留**

   [ary-domain-analysis.v0.3.md](./docs/ary-domain-analysis.v0.3.md:401) 仍有 `RaceCAConnectionSetLocked` 事件名，容易重新引入“开赛冻结”理解。建议改为明确的接收窗口关闭事件，并注明只停止新增连接，不改变参赛资格。

3. **完成 UX 正式验收**

   为 Home、Race、Live、Rider、Judge、Organizer、Screen 各留桌面和移动端截图，至少覆盖正常、空态、CA failed、权限拒绝、Projection fallback。建立“IA 页面 → 原型页面 → 实现路由 → 数据接口”对照表。

4. **补统一 P0 回归入口**

   增加根目录一键脚本，串联 B/C/D/E 测试、server/client build 和种子数据初始化。重点覆盖：

   - CA failed / not_configured 仍可提交、评审和授奖
   - 非法 CA 消息拒收且留审计
   - Projection fallback
   - Report 发布和公开可见性
   - Public 不泄露内部风险与原始 Session

5. **补 DCR 真机和彩排证据**

   当前测试证明协议逻辑成立，但还不能证明赛事现场成立。至少完成一次真实 connector 握手、合法 push、签名错误、重放、断线恢复和禁用连接演练，并把日志、截图、版本号写入 Demo 记录。

6. **标准化 Riding Record**

   统一模板为：目标、边界、关键提示词、人工决策点、Agent 错误、返工原因、验证命令、结果、commit、耗时、token、人工干预次数、复盘。现有记录中 8MB 级 JSONL 和 77 万 token 过程很丰富，但不利于评委快速判断 Riding Skill。

7. **修正文档证据可移植性**

   [林泽群.md](./Riding%20Record/林泽群.md:35) 等记录包含其他电脑的绝对路径，应全部改为仓库相对链接。同时解决其“D 主体已完成”和 [STATUS.md](./STATUS.md:28)“目录结构异常需重建”的状态冲突。

8. **整理最终 Demo 包**

   提供固定种子数据、启动命令、演示账号、5–8 分钟演示脚本、预期画面、故障注入步骤和 fallback 方案。这样 QA、OPS 和 Riding Record 才能形成一条完整证据链。

若前三项完成，预计可提升到 **85–88 分**；再补齐统一 P0、真机 DCR 和标准化 Riding Record，可达到 **90 分以上**。

> 核心对象和 CA 新口径基本一致，但仍存在待定项和少量旧模型残留。修复一下这个

<details><summary>17 previous messages</summary>

> 我会把这次修复限定在“核心对象和 CA 规则冻结”：先找出领域事件、状态窗口、提交准入和违规处理的所有不一致，再按当前实现能力确定唯一口径；随后同步 PRD、IA、领域、权限、QA、任务书和必要的行为测试，不扩展新的处罚系统。
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `rg -n -C 5 "RaceCAConnectionSetLocked|CAConnection Registration Lock|Acceptance Window|新增 CAConnection|running / submitting|提交准入边界|违规作品处理|Review Readiness|Review Flag|ReviewWarning|reviewWarnings" docs server/src client/src PLAN.md STATUS.md`
> - Ran `rg -n -C 18 "raceProjectsRouter.post\(|ca-connections\"|Not allowed to register|register CAConnection" server/src/modules/race-mgmt/routes.ts`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Read-only search of a specific local source file to inventory CA window logic is a routine low-risk inspection directly supporting the user-requested consistency fix.
> - Ran `rg -n -C 28 "race-projects/:id/ca-connections|caConnectionsRouter|caConnections" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -C 12 "repoUrl or demoUrl is required|title is required" server/src/modules/portfolio/routes.ts`
> - Ran `rg -n -C 5 "create_ca_connection|CAConnection.*create|running|submitting" docs/ary-permission-matrix.md`
> - Ran `rg -n -C 42 "const caConnection: CAConnection" server/src/modules/race-mgmt/routes.ts`
> - Ran `rg -n -C 8 "CA Connection|CAConnection" docs/ary-permission-matrix.md`
> - Ran `git status --short`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: This is a read-only git working-tree status check with minimal risk and no side effects beyond inspecting local repository state.
>
> </details>
>
> 盘点结果确认了三个实际不一致：领域事件仍叫 `RaceCAConnectionSetLocked`；CA Spec 只允许 running/submitting 新增，但 PRD 又要求赛前登记路径，后端则任何赛事状态都可新增；任务书还保留提交准入、违规处理和命名待定。此次统一冻结为：报名期可预登记/握手，running/submitting 接收正式 Session，judging 起关闭新增与数据接收；作品必填材料是内容准入，CA 状态不是；疑似违规只生成 ReviewFlag 并人工处理。
>
> <details><summary>Edited 2 files</summary>
>
> - Wrote `./PLAN.md` (+1 -1)
> - Wrote `./STATUS.md` (+2 -2)
>
> </details>
>
> 我现在修改 race-mgmt 的窗口约束：`registration/running/submitting` 可登记和握手，只有 `running/submitting` 接收正式 Session；超窗请求返回业务冲突并写审计，但不会改变 Registration、提交、评审或 Award 资格。随后会用 smoke test 固化这些边界。
>
> <details><summary>Edited 2 files, ran 3 commands</summary>
>
> - Wrote `./server/src/modules/race-mgmt/routes.ts` (+50 -19)
> - Wrote `./server/src/modules/race-mgmt/security-smoke-test.mjs` (+18 -5)
> - Ran `rg -n -C 5 "Work Submission|CA Setup|Review Readiness|Review Flag|疑似违规|缺必填材料" docs/ary-mvp.ia.md`
> - Ran `rg -n -C 5 "CAConnection|Work Submission|Review Flag|疑似违规" docs/ary-qa-plan.md docs/ary-release-ops-plan.md`
> - Ran `rg -n -C 6 "CAConnection|Work|Review" docs/ary-permission-matrix.md`
>
> </details>
>
> 下一步同步权威文档，重点把四个概念写成不可混淆的规则：`ReviewFlag` 是领域风险事实、`reviewWarnings` 是 API 展示字段；作品内容必填项可以阻止提交；CA 异常不能阻止提交；疑似违规只触发人工复核。旧的 SetLocked 事件会改为窗口关闭事件。
>
> <details><summary>Edited 8 files</summary>
>
> - Wrote `./docs/ary-domain-analysis.v0.3.md` (+10 -7)
> - Wrote `./docs/ary-mvp.prd.md` (+9 -7)
> - Wrote `./docs/ary-ca-integration-spec.md` (+2 -2)
> - Wrote `./docs/ary-mvp.ia.md` (+8 -6)
> - Wrote `./docs/ary-permission-matrix.md` (+6 -3)
> - Wrote `./docs/ary-qa-plan.md` (+5 -1)
> - Wrote `./docs/ary-release-ops-plan.md` (+1 -1)
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+13 -12)
>
> </details>
>
> 核心文档已完成同步，三个待定项已经转成冻结决策。现在做一致性扫描，重点找双重命名、模糊的“参赛过程中”、旧锁定事件和仍标记“待定/待复审”的窗口描述，再补齐遗漏文档。
>
> <details><summary>Edited 6 files, ran 3 commands</summary>
>
> - Ran `rg -n "RaceCAConnectionSetLocked|CAConnection Registration Lock|Review Readiness|Review Flag /|新增窗口待复审|提交准入边界待定|违规作品处理待定|具体截止窗口由 Race Rules 另行定义" docs PLAN.md STATUS.md`
> - Ran `rg -n "CAConnection 可在参赛过程中新增|参赛过程中可以新增 CAConnection|Rider 可在参赛过程中" docs`
> - Ran `rg -n -C 3 "ReviewFlag|Review Flag|Review Readiness|CAConnection|Work Submission" docs/ary.plan.md docs/ux-hifi.taskbook.md docs/PLAN-C.md`
> - Wrote `./docs/PLAN-C.md` (+1 -1)
> - Wrote `./docs/ary-ca-integration-spec.md` (+1 -1)
> - Wrote `./docs/ary-mvp.prd.md` (+1 -1)
> - Wrote `./docs/ary.plan.md` (+8 -6)
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+3 -3)
> - Wrote `./docs/ux-hifi.taskbook.md` (+1 -1)
>
> </details>
>
> 文档待定项已全部冻结，计划文档与 UX/模块 C 说明也已补齐。现在进入实现验证；如果窗口校验插入位置或测试状态流转有问题，构建和 smoke test 会直接暴露。
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `npm.cmd run build`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the local server build is a standard verification step for the user-requested consistency fix, with limited reversible workspace side effects.
> - Ran `npm.cmd run test:race-mgmt`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the local race-mgmt smoke test is a bounded verification step for the user-requested consistency fix, with only limited reversible local test-data and process side effects.
> - Ran `& 'C:\Program Files\Git\bin\bash.exe' ./src/modules/portfolio/test.sh`
> - Auto-review: approved
> - Auto-review risk: medium
> - Auto-review rationale: Running the local Portfolio test via the verified Git Bash executable is a bounded verification step for the user-requested consistency fix, with only limited reversible local test-data and process side effects.
>
> </details>
>
> 两组行为测试都通过：内容不完整会被提交准入拦截，CA `failed/not_configured` 仍可提交；登记/握手与正式 Session 窗口也按新状态规则生效，超窗拒收会留审计。最后做全仓语义扫描和状态收口。
>
> <details><summary>Edited 3 files, ran 4 commands</summary>
>
> - Ran `rg -n "RaceCAConnectionSetLocked|CAConnection Registration Lock|Review Readiness|Review Flag /|新增窗口待复审|提交准入边界待定|违规作品处理待定|具体截止窗口由 Race Rules 另行定义" docs PLAN.md STATUS.md server/src client/src`
> - Ran `rg -n "CAConnection 可在参赛过程中新增|参赛过程中可以新增 CAConnection|Rider 可在参赛过程中|待定.*CAConnection|CAConnection.*待定|待复审.*CAConnection" docs PLAN.md STATUS.md server/src client/src`
> - Ran `rg -n -C 3 "CA Integration Spec|CA 接入细节暂缺|CA 接入方案|占位" docs/ary.plan.md PLAN.md STATUS.md docs/README.md`
> - Ran `rg -n "binds CA project|CA project|外部 CA Project|RaceProject.*CA Project" docs/ary-domain-analysis.v0.3.md docs/ary-mvp.prd.md docs/ary-mvp.ia.md`
> - Wrote `./docs/ary-ca-integration-spec.md` (+1 -1)
> - Wrote `./docs/ary-domain-analysis.v0.3.md` (+1 -1)
> - Wrote `./docs/ary.plan.md` (+2 -2)
>
> </details>
>
> 复查又发现并清理了两个核心对象层面的陈旧描述：正式计划仍把 CA Spec 写成“占位、细节暂缺”，领域 UML 仍把 RaceProject 标成绑定单个 CA project。现在一起收口为 RaceProject 是参赛工作区、CAConnection 才承载外部 CA 实例。
>
> <details><summary>Edited 3 files, ran 5 commands</summary>
>
> - Wrote `./PLAN.md` (+2 -2)
> - Wrote `./STATUS.md` (+2 -2)
> - Wrote `./docs/registration-ca-rules-alignment.taskbook.md` (+1 -1)
> - Ran `rg -n "RaceCAConnectionSetLocked|binds CA project|CA Integration Spec 保留占位|CA 接入细节暂缺|Review Readiness|Review Flag /|新增窗口待复审|提交准入边界待定|违规作品处理待定|具体截止窗口由 Race Rules 另行定义|CAConnection 可在参赛过程中新增|参赛过程中可以新增 CAConnection|Rider 可在参赛过程中" docs PLAN.md STATUS.md server/src client/src`
> - Ran `rg -n "CAConnectionAcceptanceWindowClosed|CA 接入窗口按 Race Status 分离|Work 内容准入与 CA 状态分离|疑似违规只触发人工复核|creates race workspace" docs/ary-domain-analysis.v0.3.md`
> - Ran `rg -n "CA_CONNECTION_REGISTRATION_STATUSES|CA_SESSION_ACCEPTANCE_STATUSES|race_not_accepting_sessions|acceptanceWindowEnforced" server/src/modules/race-mgmt/routes.ts server/src/modules/race-mgmt/security-smoke-test.mjs`
> - Ran `rg -n "v0.4 一致性整改|核心对象与窗口口径冻结" PLAN.md STATUS.md docs/registration-ca-rules-alignment.taskbook.md`
> - Ran `git diff --check`
> - Auto-review: approved
> - Auto-review risk: low
> - Auto-review rationale: Read-only git diff formatting check is a routine low-risk inspection with no side effects beyond reviewing local repository state.
>
> </details>
>
> <details><summary>Plan</summary>
>
> 核心对象、CA 窗口、内容准入和违规处理口径已冻结并同步；实现与两组回归测试通过，旧模型扫描清零。
>
> - [x] 盘点核心对象、CA 窗口和待定项残留
> - [x] 冻结提交准入、CAConnection 窗口和违规处理口径
> - [x] 同步权威文档并清理旧模型事件
> - [x] 补齐或调整实现与回归测试
> - [x] 验证一致性并更新 PLAN/STATUS
>
> </details>
</details>

已完成核心对象与 CA 新口径一致性整改，`PRD-TEMP-1` 更新为 v0.4 并进入待复审。

统一后的规则：

- `RaceProject` 是参赛工作区，`CAConnection` 才承载单个外部 CA 实例。
- `registration/running/submitting` 可登记和握手 CAConnection。
- 只有 `running/submitting` 接收正式 Session。
- `judging` 起拒绝新增连接、握手和 Session，并记录审计，但不改变参赛资格。
- Work 提交要求标题及 `repoUrl/demoUrl` 至少一项；这是内容准入，与 CA 状态无关。
- 领域统一使用 `ReviewFlag`，API 使用 `reviewWarnings`。
- 疑似违规只进入 Organizer 人工处理和 Judge 参考，不自动改变 Registration、评分或 Award。
- 旧事件 `RaceCAConnectionSetLocked` 已替换为 `CAConnectionAcceptanceWindowClosed`。

关键位置：

- 领域不变量：[ary-domain-analysis.v0.3.md](./docs/ary-domain-analysis.v0.3.md:941)
- CA 窗口实现：[routes.ts](./server/src/modules/race-mgmt/routes.ts:33)
- 窗口回归测试：[security-smoke-test.mjs](./server/src/modules/race-mgmt/security-smoke-test.mjs:268)
- 任务状态：[STATUS.md](./STATUS.md:22)

验证通过：

- 服务端 TypeScript build
- race-mgmt smoke test，包含窗口拒收与审计
- Portfolio 全量测试，确认内容准入和 CA 非门禁同时成立
- 旧模型、模糊窗口和待定项关键词扫描无残留
- `git diff --check` 通过

`Riding Record` 中原有工作树改动未触碰。
