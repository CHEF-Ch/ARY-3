# 必读文件 开始前先读完以下文件（按顺序）： PLAN-C.md —— 你的主参考文档 server/src/db.ts…

> ## 必读文件
>
>   开始前先读完以下文件（按顺序）：
>
>   1. PLAN-C.md —— 你的主参考文档
>   2. server/src/db.ts —— 了解 JSON store API 的 7 个函数签名和 snake_case 字段约定
>   3. server/src/modules/race-mgmt/routes.ts —— 代码风格参照（命名、结构、鉴权写法、toRaceResponse 模式）
>   4. server/src/shared/auth.ts —— 鉴权流程和 MATRIX
>
>   ## 实现顺序
>
>   严格按 PLAN-C.md 第 9 节的 C0→C1→C2→C3→C4→C5→C6 推进，每个里程碑完成并自检后再进入下一个。
>
>   **C0**：建 5 个 migration SQL 文件。字段定义照抄 PLAN-C.md 第 4 节的 SQL，不要自创。文件命名 `008-works.sql` 到 `012-evidences.sql`，snake_case。
>
>   **C1**：在 `server/src/modules/portfolio/routes.ts` 实现 works 的全部 7 个路由（GET 列表、GET 详情、POST 创建、PATCH 编辑、POST submit、POST
>   lock、POST publish）和 `toWorkResponse` 转换函数、`getReviewWarningsForRegistration` helper。注意 slug 为空时从 title 自动生成（规则见 PLAN-C 4.1
>   节 L168-170）。race_id 和 user_id 从 Registration 派生，不接受请求体传入。
>
>   **C2**：实现 judge_assignments 和 judging_records。两条路由链有关联——先建 assignment 再建 record。注意移除 assignment 前检查是否有已提交的
>   judging_record。
>
>   **C3**：实现 awards。三条唯一性校验必须在代码里手动检查（JSON store 无真正 UNIQUE）。Award 发布前 Public 不可见。race_id 从 Registration 派生。
>
>   **C4**：实现 evidences。type 枚举以 PLAN-C 4.5 节 L309 的 7 个值为准。
>
>   **C5**：取消 `server/src/app.ts` 中 portfolio 那两行的注释。然后在 `client/vite.config.ts` 追加
>   `/awards`、`/evidences`、`/judge-assignments`、`/judging-records` 四个代理（`/works` 已存在）。
>
>   **C6**：按 PLAN-C 第 10 节写 `test.sh`并运行验证。假数据用 `db.ts` 直接 insert，不调 B 的接口。
>
>   ## 必须遵守
>
>   - 所有当前用户鉴权走 `authorize(user, "ResourceType", "action", ctx)`，ctx 参数照抄 PLAN-C 第 6 节的表，禁止写 `if (user.roles.includes(...))`
>   - DB 字段 snake_case，API 响应 camelCase，每个资源做 DB→API 转换函数
>   - JSON store 没有真正的唯一约束/外键，所有校验在代码里手动做
>   - 跨模块只读 B 的表（via db.ts），不 import B 的 routes
>   - 遇到 PLAN-C.md 和 auth.ts 冲突时以 auth.ts 为准，并告诉我；遇到任何不确定的内容，询问我让我确认

<details><summary>49 previous messages</summary>

> 我会先按项目要求读取 `PLAN-C.md`，再顺序读取三个代码文件；如果过程中发现 `PLAN-C.md` 和现有 `auth.ts` 不一致，会先标出来再继续。当前线程已有一个未完成 goal，我先查看它的状态再对齐本次工作。
>
> 已读完 `PLAN-C.md`。关键执行口径是只实现模块 C 的后端、迁移、代理和测试；前端页面真实数据接入属于后续范围，本次 C5 只改代理和 app 注册。
>
> `db.ts` 已确认：可用 API 是 `findAll/findById/findBy/filterBy/insert/update/remove`，字段存储没有 schema enforcement，所以 C 模块必须自己做存在性、唯一性和状态校验。
>
> 已读 `race-mgmt/routes.ts` 和 `auth.ts`。我发现一个冲突：`PLAN-C.md` 第 6 节写了 Work/Evidence 私有读取可用 assigned judge 或 organizer 上下文，但 `auth.ts` 的 MATRIX 中 `Work.view_private` 和 `Evidence.view_private_summary` 都是 `OWN`，不接受 `ASSIGNED` 或 `MANAGED_RACE`；我会按你的要求以 `auth.ts` 为准实现，并在非读取型操作上使用各自已有的 `lock/publish/create/remove` 等 MANAGED_RACE/ASSIGNED 动作。
>
> 我再补读根目录项目计划和当前状态，用来确认这次变更完成后需要同步哪些长期/近期文档；实现仍按 C0 到 C6 顺序推进。
>
> 项目状态文档仍停留在“尚未看到应用代码”的旧结论，和当前仓库已有 `server/`、`client/` 不一致。完成实现后我会只做与本任务直接相关的 `PLAN.md`/`STATUS.md` 状态同步，不扩散改动。
>
> 下一步开始 C0。我会先创建 5 个 migration，内容直接使用 `PLAN-C.md` 第 4 节 SQL；随后跑一次迁移命令验证文件能被记录。
>
> 开始写 C0 迁移文件。这里不会推断字段，直接把计划中的 SQL 放到 `database/migrations/008` 到 `012`。
>
> <details><summary>Created 5 files</summary>
>
> - Wrote `./database/migrations/008-works.sql` (+24 -0)
> - Wrote `./database/migrations/009-judge-assignments.sql` (+10 -0)
> - Wrote `./database/migrations/010-judging-records.sql` (+12 -0)
> - Wrote `./database/migrations/011-awards.sql` (+18 -0)
> - Wrote `./database/migrations/012-evidences.sql` (+13 -0)
>
> </details>
>
> C0 文件已创建。现在运行 server 侧迁移命令，确认新文件会按 JSON migration 记录机制被识别。
>
> 迁移命令没有进入业务逻辑，失败原因是本地 `server/node_modules` 不存在或没有安装 `tsx`。我先确认依赖目录状态，再决定是否需要安装依赖。
>
> `server/node_modules` 确实不存在。为了继续 C0 验证和后续 TypeScript 构建，我需要安装 server 依赖；先尝试使用 lockfile 的 `npm ci`。
>
> `npm ci` 在沙箱内失败，错误点包含写入用户级 npm cache 日志目录。按权限规则，我会用提权方式重跑同一个安装命令，让它正常写依赖缓存。
>
> 依赖已安装，继续执行 C0 的迁移验证。
>
> C0 完成：5 个 migration 已创建，`npm run db:migrate` 成功记录到 `008` 至 `012`。现在进入 C1，先实现 `portfolio/routes.ts` 中 Works 路由、转换函数和 review warning helper。
>
> C1 的实现会新建 `server/src/modules/portfolio/routes.ts`，先把共用类型、Work 路由和 review warning helper 放进去；后续 C2-C4 会在同一文件继续追加对应资源路由。
>
> 现在扩展同一个 `routes.ts` 到 C2-C4 的资源链。这样可以让跨资源校验（assignment -> judging record、award/evidence 引用 work/registration）在一个模块里共享同一套转换和校验 helper。
>
> <details><summary>Created a file</summary>
>
> - Wrote `./server/src/modules/portfolio/routes.ts` (+1150 -0)
>
> </details>
>
> `routes.ts` 已放入 C1-C4 的后端实现。现在先用 TypeScript 构建做第一轮自检，随后按 C2/C3/C4 的验证点继续补测试脚本覆盖。
>
> 构建暴露了一个局部签名错误：`buildWorkEditableUpdates` 已经从 `req.params.id` 读取当前 Work id，不需要传入 `work`。我会做最小修正后重跑。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./server/src/modules/portfolio/routes.ts` (+2 -2)
>
> </details>
>
> 签名修正已完成，继续跑 server 构建。
>
> server 构建已通过。C1-C4 的代码层自检先过了一轮；我会再检查当前用户鉴权是否误写了直接角色判断，然后进入 C5 激活 app 和代理。
>
> 鉴权扫描没有发现 portfolio 里对当前用户写 `user.roles.includes(...)`。进入 C5：取消 app 中 portfolio 注册注释，并补齐 Vite 代理前缀。
>
> <details><summary>Edited 2 files</summary>
>
> - Wrote `./client/vite.config.ts` (+10 -6)
> - Wrote `./server/src/app.ts` (+12 -12)
>
> </details>
>
> C5 已修改 app 注册和 Vite 代理。现在进入 C6：写 `server/src/modules/portfolio/test.sh`，用 `db.ts` 直接准备和清理假数据，并覆盖每条接口的正常路径与关键异常路径。
>
> 本机命令路径里只有 Windows 自带的 `bash.exe`（通常是 WSL 入口），没找到 Git Bash 安装路径。我仍会按 Git Bash 兼容脚本写 `test.sh`；运行验证时先尝试可用的 bash，如果环境不兼容会明确记录。
>
> 我会让测试脚本自带 setup/cleanup：setup 用 `tsx` 直接 import `db.ts` 的 `insert/findById` 写 JSON 假数据，cleanup 只删除 `test-c-` 相关行和测试产生的关联行。
>
> <details><summary>Created a file</summary>
>
> - Wrote `./server/src/modules/portfolio/test.sh` (+232 -0)
>
> </details>
>
> `test.sh` 已写好。我发现里面有一条多余的根路径 sanity check，不属于 C 模块接口覆盖；我会删掉，避免测试噪声。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./server/src/modules/portfolio/test.sh` (+0 -2)
>
> </details>
>
> 由于当前环境没有可用 Git Bash/`sh`，我先用同一套数据和接口顺序在 Node 里跑等价验证；这不替代 `test.sh` 的存在，但能确认后端实际行为。
>
> 等价 Node 验证已通过，覆盖了 C6 表里的主要正常/异常路径。接下来我仍会按要求尝试执行 `test.sh` 本身；如果当前 `bash.exe` 仍因未配置 WSL/Git Bash失败，我会把这个环境限制写清楚。
>
> `test.sh` 本体在当前环境无法执行：系统的 `bash.exe` 是未配置发行版的 WSL 入口，不是 Git Bash。后端行为已用同等流程验证通过；我再检查 client 配置是否能构建。
>
> client 也没有安装依赖，`tsc` 不存在。为验证 Vite 配置，我会按 lockfile 安装 client 依赖后重跑构建。
>
> client 依赖安装在沙箱内同样卡在用户级 npm cache 写入；我会用已同意过的 `npm ci` 提权方式重跑。
>
> client 依赖已安装，继续跑前端构建验证代理配置。
>
> 前端构建失败点是 esbuild 读取上级目录时被沙箱拒绝，不是配置语法错误。我按权限规则用提权重跑构建来确认。
>
> 后端构建、前端构建和接口等价验证都已通过；`test.sh` 受本机 Bash 环境限制未能直接执行。最后按项目规则同步 `PLAN.md` 和 `STATUS.md`，只记录本次模块 C 实现状态和验证证据。
>
> 前端构建的 `tsc` 在源码目录旁边吐出了未跟踪 `.js` 文件，这是本轮验证产生的临时产物，不应进入变更。我会只删除 `client/src` 下这批生成的 `.js` 文件。
>
> 现在同步近期计划和看板：新增一条模块 C 后端实现记录，并把验证证据和 Bash 环境限制写到 `STATUS.md`，不改动其他任务定义。
>
> <details><summary>Edited 2 files</summary>
>
> - Wrote `./PLAN.md` (+8 -6)
> - Wrote `./STATUS.md` (+10 -7)
>
> </details>
>
> 我注意到 `STATUS.md` 风险区仍保留“尚未建立可运行应用和测试命令”的旧表述，和本次结果冲突。我会把它收敛成当前真实风险：只剩 Git Bash 环境复跑。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./STATUS.md` (+1 -1)
>
> </details>
>
> 文档同步完成。最后我会查看工作区差异，确认没有残留构建生成物或不相关改动。
>
> 看板风险区出现了两条含义重复的 Git Bash 风险记录。我会保留一条更具体的，删掉重复项。
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./STATUS.md` (+3 -4)
>
> </details>
>
> 我再补一次关键行号和最终状态检查，用于最后给你简明交付说明。
>
> 最终状态检查显示只有本任务相关文件变更，另有 `PLAN-C.md` 仍是未跟踪文件但我没有修改它。portfolio 代码里也没有对当前用户的直接 `roles.includes` 鉴权判断。
</details>

完成了模块 C 的 C0-C6 实现。

主要变更：
- 新增 5 个 migration：`008-works.sql` 到 `012-evidences.sql`
- 新增 [portfolio routes](./server/src/modules/portfolio/routes.ts:135)，包含 works、judge assignments、judging records、awards、evidences 全部接口、DB→API 转换函数和 `getReviewWarningsForRegistration`
- 激活 [server/src/app.ts](./server/src/app.ts:8) 的 portfolio 注册
- 补齐 [client/vite.config.ts](./client/vite.config.ts:14) 的 C 模块代理
- 新增 [test.sh](./server/src/modules/portfolio/test.sh:1)，测试数据用 `db.ts` 直接写入，不调用 B 接口
- 更新 [PLAN.md](./PLAN.md:20) 和 [STATUS.md](./STATUS.md:22)

验证结果：
- `npm run db:migrate` 通过
- `server npm run build` 通过
- `client npm run build` 通过
- C6 等价 Node 接口验证通过，覆盖 works、assignments、records、awards、evidences 的正常和异常路径
- `test.sh` 本体已尝试运行，但当前机器的 `bash.exe` 是未配置发行版的 WSL 入口，不是 Git Bash，因此无法直接执行；这个限制已记录到 `PLAN.md` / `STATUS.md`

按你的要求处理了 `PLAN-C.md` 与 `auth.ts` 的冲突：`auth.ts` 为准。具体是 `Work.view_private` 和 `Evidence.view_private_summary` 在 MATRIX 中都是 `OWN`，所以 Evidence 私有摘要没有实现 assigned/organizer 私读；Work 的 assigned judge 读取使用了 `auth.ts` 里已有的 `Work.review`。当前用户鉴权没有写直接 `user.roles.includes(...)`。

Goal 已完成。工具记录用量：167229 tokens，约 22 分 32 秒。
