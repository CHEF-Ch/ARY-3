# PLAN-C: 模块 C portfolio 工程计划

本文面向后续实现 agent。当前任务只产出计划，不实现代码。所有路径以仓库根目录 `C:\Users\Administrator\Desktop\SE_experiment\ARY-3` 为参考。

## 1. 模块范围与边界

模块 C 名称：`portfolio`。

模块 C 负责：

* 作品资产：`works` 的创建、编辑、提交、锁定、发布和公开读取。
* 评审分配：`judge_assignments` 的创建与移除。
* 评审事实：`judging_records` 的创建、提交和提交后不可变。
* 奖项结果：`awards` 的草稿创建、唯一性校验和发布。
* 证据事实：`evidences` 的采集、引用和可见性控制。
* 评审前风险提示：读取 B 的 `race_projects.aggregate_ingestion_status`，当值为 `not_configured` 或 `failed` 时，在 Organizer / Judge 相关响应中返回警告。

模块 C 不负责：

* 不实现 B 的 Race、Registration、RaceProject、CAConnection 或 Session 接口。
* 不 import B 的 `server/src/modules/race-mgmt/routes.ts`，只通过 `server/src/db.ts` 读取 JSON 表。
* 不实现 D 的 Projection / leaderboard_read_model。
* 不实现 E 的 Report 生成。
* 不新增权限矩阵，不手写当前用户角色判断；当前用户鉴权只能调用 `authorize(user, "ResourceType", "action", ctx)`。

本模块需要新建或修改的文件：

| 类型 | 绝对路径 | 动作 |
|---|---|---|
| 计划 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\PLAN-C.md` | 本文件 |
| migration | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\008-works.sql` | 新建 |
| migration | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\009-judge-assignments.sql` | 新建 |
| migration | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\010-judging-records.sql` | 新建 |
| migration | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\011-awards.sql` | 新建 |
| migration | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\012-evidences.sql` | 新建 |
| 后端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\server\src\modules\portfolio\routes.ts` | 新建 |
| 后端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\server\src\app.ts` | 修改：取消 portfolio import / register 注释 |
| 测试 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\server\src\modules\portfolio\test.sh` | 新建 |
| 前端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\vite.config.ts` | 修改：补齐模块 C API 代理 |
| 前端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\works\WorksPage.tsx` | 后续修改 |
| 前端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\results\ResultsPage.tsx` | 后续修改 |
| 前端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\console\JudgeView.tsx` | 后续修改 |
| 前端 | `C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\console\OrganizerJudging.tsx` | 后续修改 |

## 2. 命名和实现约定

必须沿用现有约定：

* DB 字段使用 `snake_case`，例如 `registration_id`、`user_id`、`created_at`。
* API 响应字段使用 `camelCase`，例如 `registrationId`、`userId`、`createdAt`。
* 表名使用全小写下划线复数：`works`、`judge_assignments`、`judging_records`、`awards`、`evidences`。
* URL 前缀直接使用资源名，不加 `/portfolio`。例如 `/works`、`/awards`、`/evidences`。
* 每个 API 响应都必须有 DB -> API 转换函数，参照 `server/src/modules/race-mgmt/routes.ts` 的 `toRaceResponse`。
* JSON store 没有真实主键、唯一约束或外键，所有约束必须在 `routes.ts` 中用 `findById`、`findBy`、`filterBy`、`findAll` 手动检查。
* migration SQL 只作为字段和约束参考；运行时仍由 `server/src/db.ts` 读写 `database/data/*.json`。

建议转换函数：

* `toWorkResponse(work, extras?)`
* `toJudgeAssignmentResponse(assignment)`
* `toJudgingRecordResponse(record)`
* `toAwardResponse(award)`
* `toEvidenceResponse(evidence)`
* `toReviewWarningResponse(warning)`

## 3. 上游数据依赖

C 需要读取 B 的表，字段名只能来自已存在的 B migration。

### 3.1 `registrations`

来源：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\004-registrations.sql`

C 会用到：

| 字段 | 用途 |
|---|---|
| `id` | `works.registration_id`、`awards.registration_id`、`evidences.registration_id` 的来源 |
| `race_id` | 校验 Work / Award / Evidence 所属 Race；构造 `MANAGED_RACE` 鉴权上下文 |
| `user_id` | `OWN` 鉴权的 owner；Work 作者 |
| `status` | 创建 Work 前应要求 Registration 存在且未 `withdrawn`；推荐只允许 `approved` 创建 / 提交主 Work |

### 3.2 `races`

来源：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\003-races.sql`

C 会用到：

| 字段 | 用途 |
|---|---|
| `id` | 路由查询、Award / Work 冗余 `race_id` 校验 |
| `slug` | 前端按 Race 页面读取 Works / Results 时使用 |
| `title` | 页面展示上下文 |
| `organizer_user_ids` | `MANAGED_RACE` 鉴权上下文：`{ raceOrganizerIds: race.organizer_user_ids }` |

### 3.3 `race_projects`

来源：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\005-race-projects.sql`

C 会用到：

| 字段 | 用途 |
|---|---|
| `id` | 查找 RaceProject 或与 CAConnection 关联 |
| `registration_id` | 从 Work / Award / Evidence 找到对应 RaceProject |
| `race_id` | 交叉校验必须与 Registration 的 `race_id` 一致 |
| `user_id` | 交叉校验必须与 Registration 的 `user_id` 一致 |
| `aggregate_ingestion_status` | 评审前风险提示核心字段；`not_configured` 和 `failed` 必须返回警告 |

### 3.4 `ca_connections`

来源：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\database\migrations\006-ca-connections.sql`

C 会用到：

| 字段 | 用途 |
|---|---|
| `id` | Evidence 的 `source_ref` 可引用具体 CAConnection |
| `race_project_id` | 从 RaceProject 聚合到单个连接状态 |
| `ingestion_status` | 风险提示扩展信息；不是提交、评审或 Award 的硬门禁 |

### 3.5 其他可读表

* `users.id`、`users.roles`：分配评委前确认目标用户存在且具有 `judge` role。注意这是数据完整性校验，不替代当前请求用户的 `authorize()` 鉴权。
* `sessions.id`、`sessions.race_project_id`：`evidences.source_ref` 为 `session_summary` 时可引用，MVP 不允许赛后手动上传伪造实时 Session Summary。

## 4. 待建表定义

字段必须先落 migration，供 D / E 确认字段名。实现优先级上，先冻结 `works -> judging_records -> awards -> evidences -> judge_assignments` 的字段，因为 `works`、`judging_records`、`awards` 是 D / E 的核心输入。文件名仍必须按固定编号 `008` 到 `012` 创建；`runMigrations()` 会按文件名排序记录，不代表下游开发优先级。冻结优先顺序只影响后续 C1-C4 的实现和评审先后，不改变 migration 文件编号。

### 4.1 `008-works.sql`

建议 SQL：

```sql
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  registration_id TEXT UNIQUE NOT NULL,
  race_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  problem_statement TEXT NOT NULL DEFAULT '',
  solution_summary TEXT NOT NULL DEFAULT '',
  tech_stack TEXT NOT NULL DEFAULT '',
  repo_url TEXT,
  demo_url TEXT,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  submitted_at TEXT,
  locked_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (registration_id),
  UNIQUE (slug)
);
```

手动校验点：

* 插入前 `findById("registrations", registration_id)` 必须存在。
* 插入前 Registration `status` 不得为 `withdrawn`；建议只允许 `approved` 创建和提交。
* 插入前 `filterBy("works", "registration_id", registration_id)` 必须为空，兑现“一个 Registration 最多一个主 Work”。
* 插入或更新 `race_id`、`user_id` 必须从 Registration 派生，不接受请求体自带值覆盖。
* `slug` 请求体可选；未传时必须按 B 的 `normalizeSlug()` 模式从 `title` 自动生成：`trim()`、转小写、非 `a-z0-9` 替换为 `-`、去除首尾 `-`、截断到 80 字符。不要 import B 的 helper，可在 C 内部实现同等逻辑。
* 若传入或生成后的 `slug` 为空，返回 `400`。
* 插入前 `findBy("works", "slug", slug)` 必须为空；若冲突返回 `409`，不要静默覆盖或随机改名。
* Rider 编辑前调用 `authorize(user, "Work", "create" 或 "submit", { ownerUserId: registration.user_id })`。
* Organizer 锁定或发布前调用 `authorize(user, "Work", "lock" 或 "publish", { raceOrganizerIds: race.organizer_user_ids })`。
* `status === "locked"` 后 Rider 不可再编辑。
* `visibility === "public"` 且 `published_at` 非空时才可进入 Public Works。
* Work 是否获奖由 `awards` 推导，不在 Work 中保存 `awarded`。

状态建议：

| 状态 | 语义 |
|---|---|
| `draft` | Rider 草稿，仅本人和 managed race Organizer / Admin 可见 |
| `submitted` | 已提交，可进入评审 |
| `locked` | 主办方锁定，Rider 不可继续编辑 |
| `hidden` | 不进入 Public Works |

### 4.2 `009-judge-assignments.sql`

建议 SQL：

```sql
CREATE TABLE IF NOT EXISTS judge_assignments (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  judge_user_id TEXT NOT NULL,
  assigned_by_user_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (work_id, judge_user_id)
);
```

手动校验点：

* 分配前 `findById("works", work_id)` 必须存在。
* Work 对应 Registration、Race 必须存在。
* 当前请求用户必须调用 `authorize(user, "JudgeAssignment", "create", { raceOrganizerIds: race.organizer_user_ids })`。
* 目标用户 `findById("users", judge_user_id)` 必须存在，且 `roles` 包含 `judge`。
* 分配前 `findAll("judge_assignments")` 中不得已有同一 `work_id + judge_user_id`。
* `assigned_by_user_id` 只能来自当前登录用户 `user.userId`。
* 移除前调用 `authorize(user, "JudgeAssignment", "remove", { raceOrganizerIds: race.organizer_user_ids })`。
* 移除前确认该 assignment 下没有 `status === "submitted"` 的 `judging_records`；已有提交评审时禁止移除。

### 4.3 `010-judging-records.sql`

建议 SQL：

```sql
CREATE TABLE IF NOT EXISTS judging_records (
  id TEXT PRIMARY KEY,
  judge_assignment_id TEXT NOT NULL,
  score_result INTEGER,
  score_riding INTEGER,
  comments TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (judge_assignment_id)
);
```

手动校验点：

* 创建前 `findById("judge_assignments", judge_assignment_id)` 必须存在。
* 当前请求用户必须调用 `authorize(user, "JudgingRecord", "create", { assignedJudgeUserId: assignment.judge_user_id })`。
* 创建前 `filterBy("judging_records", "judge_assignment_id", judge_assignment_id)` 必须为空；MVP 一个 assignment 最多一个评审记录。
* 提交前调用 `authorize(user, "JudgingRecord", "submit", { assignedJudgeUserId: assignment.judge_user_id })`。
* 提交前 `score_result` 和 `score_riding` 必须非空，且为合理数值。建议 MVP 使用 `0` 到 `100` 整数。
* 提交前 `comments` 必须是字符串，建议允许空字符串但前端提示评委填写。
* `status === "submitted"` 后不可再修改评审记录，除非后续新增 revert 功能。
* JudgingRecord 的评委和 Work 从 JudgeAssignment 推导，不在记录中重复保存 `judge_user_id` 或 `work_id` 作为事实来源。

### 4.4 `011-awards.sql`

建议 SQL：

```sql
CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  work_id TEXT,
  award_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  decision_reason TEXT NOT NULL DEFAULT '',
  judging_record_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  published_at TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (race_id, award_name, rank),
  UNIQUE (race_id, award_name, registration_id)
);
```

手动校验点：

* 创建前 Registration 必须存在。
* 请求体如传 `raceId`，必须等于 Registration 的 `race_id`；最终写入的 `race_id` 以 Registration 为准。
* `Award.race_id` 必须与所属 Registration `race_id` 一致。
* 如传 `workId`，Work 必须存在，且 `work.registration_id === registration_id`。
* 当前请求用户必须调用 `authorize(user, "Award", "create_draft", { raceOrganizerIds: race.organizer_user_ids })`。
* 插入前检查同 `race_id + award_name + rank` 不重复。
* 插入前检查同 `race_id + award_name + registration_id` 不重复。
* `rank` 必须为正整数。
* `award_name` 必须为非空字符串。
* `judging_record_ids` 中每个记录必须存在；若实现弱校验，至少确保它是数组并在响应中原样转换为 `judgingRecordIds`。
* 发布前调用 `authorize(user, "Award", "publish", { raceOrganizerIds: race.organizer_user_ids })`。
* Award 发布前不得 Public 可见：`status` 为 `draft`、`visibility` 为 `private`、`published_at` 为 `null`。
* 发布时设置 `status: "published"`、`visibility: "public"`、`published_at: now`。

### 4.5 `012-evidences.sql`

建议 SQL：

```sql
CREATE TABLE IF NOT EXISTS evidences (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  work_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_ref TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

手动校验点：

* 创建前 Registration 必须存在。
* 如传 `workId`，Work 必须存在，且 `work.registration_id === registration_id`。
* `type` 必须以 `docs/ary-domain-analysis.v0.3.md` 的 `EvidenceType` 为准：`session_summary`、`work`、`commit_pr`、`screenshot`、`judge_comment`、`retrospective`、`video`。不要使用 `code_material`、`judging_record` 或 `external_ref`，避免 E 模块报告生成逻辑字段对不上。
* `source_ref` 必须非空。建议存 JSON 字符串，API 层转换为 `sourceRef` 对象或字符串。
* `type === "session_summary"` 时，只能引用已有 `sessions.id` 或由实时 Session 派生的摘要，不允许把赛后手动上传内容伪造成实时证据。
* `type === "commit_pr"` 时，`source_ref` 引用 GitHub commit / PR / repo 材料；GitHub 只作为代码材料引用，不作为实时 CA 接入来源。
* `type === "judge_comment"` 时，`source_ref` 应引用已有 `judging_records.id`。
* 创建 Evidence 的权限按来源决定：Rider 创建自己 Registration / Work 的 Evidence 时用 `authorize(user, "Evidence", "set_visibility", { ownerUserId: registration.user_id })`；Organizer 内部采集证据时若当前矩阵缺少 C 要求动作，不新增动作，本期优先只实现 OWN 创建和可见性控制。
* 设置可见性前调用 `authorize(user, "Evidence", "set_visibility", { ownerUserId: registration.user_id })`。
* `visibility` 只能为 `private` 或 `public`。
* 公开端只展示 `visibility === "public"` 的摘要，不暴露敏感原始 Session。

## 5. 后端接口清单

实现文件：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\server\src\modules\portfolio\routes.ts`。

路由注册：

* `app.use("/works", worksRouter)`
* `app.use("/judge-assignments", judgeAssignmentsRouter)`
* `app.use("/judging-records", judgingRecordsRouter)`
* `app.use("/awards", awardsRouter)`
* `app.use("/evidences", evidencesRouter)`

不要注册 `/portfolio` 前缀。

### 5.1 Works

| 接口 | 鉴权 | 请求体 / 查询 | 核心校验 |
|---|---|---|---|
| `GET /works?raceId=&raceSlug=` | Public 读公开；登录用户可读自己的或 managed race | 查询参数 | Public 只返回 `visibility=public` 且 `published_at` 非空；私有读取必须按 Work owner 或 managed race 过滤 |
| `GET /works/:id` | `Work.view_public` 或 `Work.view_private` | path id | 公开 Work 走 `authorize(userOrNull, "Work", "view_public", { visibility, isPublished })`；私有 Work 走 owner / assigned / managed race 上下文 |
| `POST /works` | `Work.create` | `registrationId,title,summary,problemStatement,solutionSummary,techStack,repoUrl,demoUrl,videoUrl,slug?` | Registration 存在且 owner；一个 Registration 不得已有 Work；race/user 从 Registration 派生 |
| `PATCH /works/:id` | `Work.create` 复用 OWN 语义 | 可编辑字段 | 仅 Rider owner 可改草稿；`locked` 后不可改；不得改 `registration_id/race_id/user_id/status/visibility` |
| `POST /works/:id/submit` | `Work.submit` | 可选补充字段 | owner；标题必填；建议 `repo_url` 或 `demo_url` 至少一个非空；提交后 `status=submitted, submitted_at=now` |
| `POST /works/:id/lock` | `Work.lock` | 空 | managed race；设置 `status=locked, locked_at=now` |
| `POST /works/:id/publish` | `Work.publish` | 空 | managed race；只允许 `submitted` 或 `locked` Work 发布；设置 `visibility=public, published_at=now` |

Work 响应必须包含：

* `id`
* `registrationId`
* `raceId`
* `userId`
* `slug`
* `title`
* `summary`
* `problemStatement`
* `solutionSummary`
* `techStack`
* `repoUrl`
* `demoUrl`
* `videoUrl`
* `status`
* `visibility`
* `submittedAt`
* `lockedAt`
* `publishedAt`
* `createdAt`
* `updatedAt`
* `reviewWarnings`：Organizer / Judge / owner 上下文可返回评审前风险提示；Public 响应不暴露内部风险细节，除非后续产品明确公开。

### 5.2 JudgeAssignment

| 接口 | 鉴权 | 请求体 | 核心校验 |
|---|---|---|---|
| `POST /works/:id/judge-assignments` | `JudgeAssignment.create` | `judgeUserId` | managed race；目标用户存在且有 `judge` role；同 `work_id + judge_user_id` 不重复 |
| `DELETE /judge-assignments/:id` | `JudgeAssignment.remove` | 空 | managed race；该 assignment 下没有已提交 judging_record |
| `GET /judge-assignments/mine` | `JudgeAssignment.view` | 无 | 登录 Judge 查看自己的 assignment；用 `authorize(user, "JudgeAssignment", "view", { assignedJudgeUserId: assignment.judge_user_id })` 逐条过滤 |

### 5.3 JudgingRecord

| 接口 | 鉴权 | 请求体 | 核心校验 |
|---|---|---|---|
| `POST /judge-assignments/:id/judging-records` | `JudgingRecord.create` | `scoreResult?,scoreRiding?,comments?` | assigned judge；一个 assignment 最多一个 record；创建草稿 |
| `PATCH /judging-records/:id` | `JudgingRecord.update_before_submit` | `scoreResult?,scoreRiding?,comments?` | assigned judge；只允许 `draft` 更新 |
| `POST /judging-records/:id/submit` | `JudgingRecord.submit` | 可带最终 `scoreResult,scoreRiding,comments` | assigned judge；`scoreResult` 和 `scoreRiding` 非空；提交后不可再改 |

### 5.4 Awards

| 接口 | 鉴权 | 请求体 / 查询 | 核心校验 |
|---|---|---|---|
| `GET /awards?raceId=` | Public / managed race | 查询参数 | Public 只看 `published/public`；Organizer 可看 draft |
| `POST /awards` | `Award.create_draft` | `registrationId,workId?,awardName,rank,decisionReason,judgingRecordIds?` | managed race；`race_id` 与 Registration 一致；两条唯一性校验 |
| `PATCH /awards/:id` | `Award.edit_draft` | `awardName?,rank?,decisionReason?,judgingRecordIds?` | managed race；只允许 draft；重复执行唯一性校验 |
| `POST /awards/:id/publish` | `Award.publish` | 空 | managed race；发布前校验仍满足唯一性；发布后 Public 可见 |

### 5.5 Evidences

| 接口 | 鉴权 | 请求体 | 核心校验 |
|---|---|---|---|
| `GET /evidences?registrationId=&workId=` | `Evidence.view_public` / 私有摘要按 owner 或 assigned context | 查询参数 | Public 只返回 public 摘要；Judge 只能在 assigned Work 上下文读取摘要 |
| `POST /evidences` | `Evidence.set_visibility` 复用 OWN | `registrationId,workId?,type,title,summary,sourceRef,visibility?` | owner；sourceRef 非空；session_summary 不可伪造 |
| `PATCH /evidences/:id/visibility` | `Evidence.set_visibility` | `visibility` | owner；只允许 `private/public` |

## 6. 鉴权上下文清单

实现时必须逐接口按下表调用 `authorize()`。

| 资源 | 动作 | ctx 构造 |
|---|---|---|
| `Work` | `view_public` | `{ visibility: work.visibility, isPublished: !!work.published_at }` |
| `Work` | `view_private` | `{ ownerUserId: registration.user_id }`；assigned Judge 读取时可用 `{ assignedJudgeUserId: assignment.judge_user_id }`；Organizer 读取时可用 `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Work` | `create` | `{ ownerUserId: registration.user_id }` |
| `Work` | `submit` | `{ ownerUserId: registration.user_id }` |
| `Work` | `lock` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Work` | `publish` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `JudgeAssignment` | `create` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `JudgeAssignment` | `remove` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `JudgeAssignment` | `view` | `{ assignedJudgeUserId: assignment.judge_user_id }` |
| `JudgingRecord` | `create` | `{ assignedJudgeUserId: assignment.judge_user_id }` |
| `JudgingRecord` | `submit` | `{ assignedJudgeUserId: assignment.judge_user_id }` |
| `JudgingRecord` | `update_before_submit` | `{ assignedJudgeUserId: assignment.judge_user_id }` |
| `Award` | `view_published` | `{ visibility: award.visibility, isPublished: !!award.published_at }` |
| `Award` | `view_draft` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Award` | `create_draft` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Award` | `edit_draft` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Award` | `publish` | `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Evidence` | `view_public` | `{ visibility: evidence.visibility, isPublished: evidence.visibility === "public" }` |
| `Evidence` | `view_private_summary` | `{ ownerUserId: registration.user_id }`；assigned Judge 读取时可用 `{ assignedJudgeUserId: assignment.judge_user_id }`；Organizer 读取时可用 `{ raceOrganizerIds: race.organizer_user_ids }` |
| `Evidence` | `set_visibility` | `{ ownerUserId: registration.user_id }` |

禁止写法：

```ts
if (user.roles.includes("organizer")) { ... }
```

允许的数据完整性校验：

```ts
const target = findById("users", judgeUserId);
// parse target.roles, confirm it contains "judge"
```

这不是当前请求用户鉴权；它只是确认被分配对象有 Judge 身份。

## 7. 评审前风险提示逻辑

实现一个内部 helper，例如：

```ts
function getReviewWarningsForRegistration(registrationId: string): ReviewWarning[] { ... }
```

读取流程：

1. `findById("registrations", registrationId)`，不存在则返回数据异常警告。
2. `findBy("race_projects", "registration_id", registrationId)`。
3. 若没有 RaceProject，返回 `missing_race_project` 警告。
4. 若 `aggregate_ingestion_status === "not_configured"`，返回 `ca_not_configured` 警告。
5. 若 `aggregate_ingestion_status === "failed"`，返回 `ca_ingestion_failed` 警告。
6. 可选读取 `ca_connections`，把全部 failed 或无连接作为 warning detail，不阻断 Work Submission、JudgingRecord 或 Award。

警告对象建议 API 字段：

```ts
{
  code: "ca_not_configured" | "ca_ingestion_failed" | "missing_race_project",
  severity: "warning",
  message: string,
  registrationId: string,
  raceProjectId?: string,
  aggregateIngestionStatus?: string
}
```

必须兑现：

* 风险提示只提示，不自动取消 Registration。
* `not_configured` / `failed` 不阻断 Work 提交、评审或 Award。
* Organizer View 和 Judge View 的数据源中必须能看到这些警告。
* 不要从 B 的 routes 读取或调用接口。

## 8. 前端页面功能与数据源

本轮不实现前端，但后续实现应按以下数据源接入。

前端展示文案约束：除 Agent Racing Yard、Race、Rider、Demo、Repo、API 字段名、作品名、技术名和其他必要专有名词外，页面可见文案优先使用中文。后续 ResultsPage、JudgeView、OrganizerJudging 与 WorksPage 后续 API 阶段均遵守该约束。

### 8.1 WorksPage

文件：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\works\WorksPage.tsx`

职责：

* 公开 Works 列表：读取 `GET /works?raceSlug=` 或 `GET /works?raceId=`。
* Work 详情：读取 `GET /works/:id`。
* 只展示已公开作品；隐藏或未发布作品不进入公开列表。
* 卡片展示标题、作者、所属赛事、summary、Demo / 视频入口、奖项或精选标识、评审结果摘要。

### 8.2 ResultsPage

文件：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\results\ResultsPage.tsx`

职责：

* 读取 `GET /awards?raceId=` 或先由 `raceSlug` 查 Race 后读取 Award。
* 按 `awardName` 分组，按 `rank` 排序。
* 只展示 `published/public` Award。
* 不读取过程 Projection 作为最终结果。

### 8.3 JudgeView

文件：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\console\JudgeView.tsx`

职责：

* 读取 `GET /judge-assignments/mine` 获取分配作品。
* 展示 Work Detail、Evidence Summary、Review Warnings、Score Form、Comments。
* 创建或更新 draft JudgingRecord。
* 提交时调用 `POST /judging-records/:id/submit`，前端也提示 `scoreResult` 和 `scoreRiding` 必填，但以后端校验为准。

### 8.4 OrganizerJudging

文件：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\client\src\pages\console\OrganizerJudging.tsx`

职责：

* 管理 Work 列表、锁定、发布。
* 分配评委和移除未提交评审的分配。
* 查看评审进度和 Review Warnings。
* 创建 Award draft、编辑 draft、发布 Award。

## 9. 实现顺序与里程碑

### C0 字段冻结，解除 D/E 阻塞

目标：

* 新建 5 个 migration 文件。
* 虽然文件编号是 `008 -> 012`，字段评审优先顺序是 `works -> judging_records -> awards -> evidences -> judge_assignments`。
* D 至少可以确认 `works`、`judging_records`、`awards` 字段；E 至少可以确认 `awards`、`judging_records`、`evidences` 字段。

验证：

* `npm run db:migrate` 在 `server` 下能记录新 migration。
* migration 文件表名、字段名均为 snake_case。

### C1 Works 后端

目标：

* 实现 `works` 公开读取、创建、编辑、提交、锁定、发布。
* 实现 `toWorkResponse`。
* 实现基本 review warning helper。

验证：

* Rider 可以为自己的 approved Registration 创建一个 Work。
* 同 Registration 重复创建返回 `409`。
* locked 后 Rider PATCH 返回 `409` 或 `400`。
* Organizer 可以 lock / publish managed race 的 Work。

### C2 JudgingRecord 和 JudgeAssignment 后端

目标：

* 实现分配评委、移除分配、我的分配、评审草稿、提交评审。
* JudgeAssignment 字段后置实现不影响 D/E 先读表字段，但 JudgingRecord 创建必须依赖 assignment。

验证：

* Organizer 可以把 Work 分配给有 `judge` role 的用户。
* 重复分配同一 Work + Judge 返回 `409`。
* 非 assigned Judge 不能创建或提交 JudgingRecord。
* 提交后不可修改。

### C3 Awards 后端

目标：

* 实现 Award draft 创建、编辑、发布和公开读取。
* 兑现同奖项名次唯一、同 Registration 同奖项唯一、race_id 一致性。

验证：

* 同 `race_id + award_name + rank` 重复返回 `409`。
* 同 `race_id + award_name + registration_id` 重复返回 `409`。
* Award 发布前 Public `GET /awards` 不可见，发布后可见。

### C4 Evidences 后端

目标：

* 实现 Evidence 创建、公开 / 私有摘要读取、可见性设置。
* `sourceRef` 进入响应时转为 `sourceRef`，不泄漏原始敏感 Session。

验证：

* Rider 可以为自己的 Registration 创建 Evidence。
* 其他 Rider 不能设置该 Evidence 可见性。
* Public 只能看到 public Evidence 摘要。

### C5 app.ts 激活和前端接入

目标：

* 在 `server/src/app.ts` 取消 portfolio import / register 注释。
* 接入四个前端页面。

验证：

* `/works`、`/awards`、`/evidences` 等路由可访问。
* `client/vite.config.ts` 必须代理模块 C 的全部 API 前缀到 `http://localhost:3000`：`/works`、`/awards`、`/evidences`、`/judge-assignments`、`/judging-records`。当前文件已有 `/works`，实现时需要追加 `/awards`、`/evidences`、`/judge-assignments`、`/judging-records`。

### C6 模块测试

目标：

* 新建 `server/src/modules/portfolio/test.sh`。
* 覆盖每个接口的正常路径和至少一个异常路径。

验证：

* `server/src/modules/portfolio/test.sh` 可在 Git Bash 下运行。
* 测试结束清理假数据。

## 10. 测试策略

测试文件：`C:\Users\Administrator\Desktop\SE_experiment\ARY-3\server\src\modules\portfolio\test.sh`。

原则：

* 不测 B 的接口。
* 不通过 B routes 准备数据。
* 依赖 B 的数据时，用 `server/src/db.ts` 直接写 JSON 假数据。
* 测试结束清理本次写入的 fake rows。
* 每个接口至少覆盖一个正常路径和一个异常路径。

建议准备数据：

* users：一个 rider、一个 organizer、一个 judge、一个 outsider。
* races：一个 race，`organizer_user_ids` 包含 organizer。
* registrations：一个 approved registration，绑定 rider 和 race。
* race_projects：一个 `aggregate_ingestion_status: "failed"` 或 `not_configured` 的记录，用于验证 review warning。
* ca_connections：可选，构造 failed detail。

建议测试用例：

| 场景 | 正常路径 | 异常路径 |
|---|---|---|
| Work create | Rider 为自己的 approved Registration 创建 | outsider 创建返回 403；重复 registration 返回 409 |
| Work submit | owner 提交，返回 `submittedAt` | 缺 title / 必填材料返回 400 |
| Work lock/publish | Organizer lock / publish | 非 managed race organizer 返回 403 |
| JudgeAssignment create | Organizer 分配 judge | 目标用户没有 `judge` role 返回 400；重复分配返回 409 |
| JudgeAssignment remove | 未提交评审时移除 | 已有 submitted JudgingRecord 时返回 409 |
| JudgingRecord create/submit | assigned judge 创建并提交 | 非 assigned judge 返回 403；缺 `scoreResult` 或 `scoreRiding` 返回 400 |
| Award create/publish | Organizer 创建草稿并发布 | 重复 rank 或重复 registration award 返回 409 |
| Evidence create/visibility | owner 创建 Evidence 并设 public | 非 owner 设置 visibility 返回 403 |
| Review warning | Work / assignment 响应包含 failed / not_configured warning | CA 状态异常不阻断 submit / judging / award |

清理策略：

* 测试数据使用固定前缀，例如 `test-c-`。
* 结束时从 `database/data/*.json` 中过滤删除 `id` 或字段带 `test-c-` 前缀的记录。
* 不删除非测试数据。

## 11. 完成口径

模块 C 后续实现完成时，至少满足：

* 5 个 migration 文件存在，字段名稳定，D/E 可直接按字段读取。
* `server/src/modules/portfolio/routes.ts` 注册所有 C 路由，且所有响应执行 DB -> API 字段转换。
* `server/src/app.ts` 已激活 `registerPortfolioRoutes(app)`。
* 所有当前用户鉴权通过 `authorize()` 完成。
* JSON store 的唯一性、外键存在性、状态流转和提交后不可变规则均由代码手动校验。
* 评审前风险提示读取 B 的 `race_projects`，且不阻断提交、评审、Award。
* 四个前端页面完成真实数据接入。
* `server/src/modules/portfolio/test.sh` 覆盖正常路径和异常路径，并能清理假数据。
