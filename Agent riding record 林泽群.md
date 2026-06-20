# Agent riding record 林泽群
## 基本信息

| 项目 | 内容 |
| --- | --- |
| 项目 | ARY-3 |
| 记录对象 | D 模块 projection / read model 第一轮实现与收敛 |
| 参与 Agent | Codex |
| 记录人 | 林泽群 |
| 负责模块 | `DEV-5` / `server/src/modules/projection` |
| 关键文档入口 | `docs/ary.plan.md`、`docs/ary-mvp.prd.md`、`docs/ary-ca-integration-spec.md`、`开发指南.md` |
| 当前模块状态 | D 第一轮核心实现已完成，任务板口径仍为“继续细化中” |

## 本次骑行目标

本次对话围绕 D 模块展开，核心目标不是扩展其他模块，而是在 D 自己的职责边界内完成 Projection 层的落地、联调、fallback、契约收敛和可观测性增强。

本次目标包括：
* 完成 `projections` 存储与后端路由落地。
* 输出 8 类 projection，并提供统一读取与重建接口。
* 为公开端和大屏端建立稳定 fallback / 静态 fallback 机制。
* 为 Results / Review 提供只读 read model，而不是让公开页直接碰底层事实。
* 收敛 D 的契约元信息，明确“来源是什么、能给谁看、是不是 fallback”。
* 继续在 D 内部收敛 `screen_feed` 协议与 `status-summary` 可服务性摘要。
* 让 D 模块具备可单独回归的 `test.sh` 验证入口。

## 主要骑行阶段

### 阶段一：确认 D 的职责边界

先按仓库规则阅读了 `PLAN.md`、`STATUS.md`、`docs/ary.plan.md`、`docs/ary-mvp.prd.md` 和 `docs/ary-ca-integration-spec.md`，确认 D 模块不是事实拥有者，而是 Projection / Read Model / Live Hall / Screen Display 的读取基础设施。

阶段结论：
* D 只消费 B/C 的事实表，不回写上游。
* D 可以重建 projection，但不能把 projection 当作最终事实源。
* 过程榜只能服务过程展示，不能污染最终榜单。
* 公开端不能直接暴露原始 CA Session。

### 阶段二：落地 projection 存储与后端入口

完成了以下核心后端产物：
* 新增 migration：[database/migrations/013-projections.sql](C:\Users\18192\Desktop\ARY-3-main\database\migrations\013-projections.sql)
* 新增模块路由：[server/src/modules/projection/routes.ts](C:\Users\18192\Desktop\ARY-3-main\server\src\modules\projection\routes.ts)
* 在 [server/src/app.ts](C:\Users\18192\Desktop\ARY-3-main\server\src\app.ts) 注册 projection 路由

对外能力包括：
* `GET /projections/:raceId/:type`
* `POST /projections/:raceId/rebuild`

支持的 8 类 projection：
* `race_progress`
* `registration_status`
* `cost`
* `risk`
* `submission`
* `judging`
* `current_leaderboard`
* `screen_feed`

### 阶段三：补齐 read model 与公开端联调

为了避免公开页直接读取底层事实或误用过程榜，新增并联调了 3 个 read model：
* `leaderboard_read_model`
* `results_page_read_model`
* `review_summary_read_model`

其中关键边界是：
* `current_leaderboard` 只代表过程榜。
* 最终榜只来自 `Award + leaderboard_read_model`。
* `results_page_read_model` 和 `review_summary_read_model` 只做读取整形，不回写事实。

联调落地页面：
* [client/src/pages/home/HomePage.tsx](C:\Users\18192\Desktop\ARY-3-main\client\src\pages\home\HomePage.tsx)
* [client/src/pages/live/LivePage.tsx](C:\Users\18192\Desktop\ARY-3-main\client\src\pages\live\LivePage.tsx)
* [client/src/pages/console/ScreenConsole.tsx](C:\Users\18192\Desktop\ARY-3-main\client\src\pages\console\ScreenConsole.tsx)
* [client/src/pages/screen/ScreenPage.tsx](C:\Users\18192\Desktop\ARY-3-main\client\src\pages\screen\ScreenPage.tsx)
* [client/src/pages/results/ResultsPage.tsx](C:\Users\18192\Desktop\ARY-3-main\client\src\pages\results\ResultsPage.tsx)
* [client/src/pages/review/ReviewPage.tsx](C:\Users\18192\Desktop\ARY-3-main\client\src\pages\review\ReviewPage.tsx)

### 阶段四：实现 fallback 体系

本轮为 D 模块建立了 3 层读取语义：
* `live`
* `stable_fallback`
* `static_fallback`

语义说明：
* 如果 projection 正常，则返回 `live`。
* 如果 projection 失败但已有最近一次成功快照，则返回 `stable_fallback`。
* 如果 projection 失败且没有稳定快照，则返回 `static_fallback`。

静态 fallback 的设计原则：
* 只使用稳定事实，如 `Race`、`Announcement`、`Work`、`Award`。
* 不直接读取原始 `Session`。
* 公开端可以继续看，但知道自己看到的是降级画面。

### 阶段五：投影契约收敛

为避免前端和其他模块“猜接口”，把 projection / read model 统一收敛到同一批元信息字段。

统一契约包括：
* `contractVersion: "d.v1"`
* `readKind`
* `sourceOfTruth`
* `consumerBoundary`
* `fallback.mode`
* `fallback.active`
* `fallback.code`
* `fallback.reason`

共享类型同步在：
* [client/src/shared/apiTypes.ts](C:\Users\18192\Desktop\ARY-3-main\client\src\shared\apiTypes.ts)

这一步的意义是：
* 前端知道自己读到的是 projection 还是 read model。
* D 可以清楚声明“我服务给谁，不负责什么”。
* fallback 不再靠散乱布尔值判断，而是变成结构化契约。

### 阶段六：收敛 `screen_feed` 编排协议

`screen_feed` 在本轮进一步收敛为可编排协议，而不只是简单 feed 数组。

新增的 feed-level 协议字段：
* `defaultDisplayMode`
* `availableModes`
* `autoRotate`
* `recommendedRotationOrder`

新增的 item-level 编排字段：
* `order`
* `durationMs`
* `recommendedDisplayMode`
* `fallbackPriority`

这使 D 模块在不侵入前端控制逻辑的情况下，可以对“大屏该怎么轮播”给出明确建议。

### 阶段七：增强 D 内部可观测性

新增了内部状态摘要接口：
* `GET /projections/:raceId/status-summary`

作用：
* 只给 Organizer / 内部维护看。
* 汇总 projection 与 read model 的当前可服务性。
* 判断现在是 live、stable fallback、还是 static fallback。
* 快速定位大屏是否可用、公开端是否可读、最近一次成功时间是什么。

后续又继续增强了这一接口，新增：
* `serveReadiness`
* `publicReadable`
* `screenReady`
* `screenServeMode`
* `modeCounts`
* `lastSuccessfulByType`
* projection / read model 条目上的 `serveReady`

这让 D 的状态摘要从“列状态”提升到“能直接判断是否可服务”。

## 关键设计决策

### 1. D 只做读取基础设施，不做事实拥有者

这是整个模块最核心的约束。

明确坚持：
* D 不回写 B/C 事实表。
* D 不拥有最终榜单事实。
* D 不拥有评审结论事实。
* D 只负责把上游事实转成适合 Live Hall / Screen / Public Page 消费的数据形态。

### 2. 过程榜和最终榜强隔离

明确约束：
* `current_leaderboard` 是过程榜，只用于过程展示。
* `leaderboard_read_model` 是最终榜读取模型，只依赖已发布 `Award`。
* `results_page_read_model` 明确排除 process leaderboard 作为 final result。

这避免了 D 和 C/E 在“谁代表最终结果”上发生冲突。

### 3. fallback 是 D 自身的职责，不是前端临时拼接

而不是把失败逻辑甩给页面自己兜底。

设计收益：
* 公开端和大屏端不必自己理解投影失败细节。
* fallback 语义统一，不会每个页面各写一套。
* 现场演示和联调时更容易排障。

### 4. `status-summary` 是 D 内部可观测性接口，不扩散为通用事实接口

这个接口只服务 D 的运行健康检查：
* 看 projection 是否 ready
* 看 read model 是否可服务
* 看 screen 是否可用
* 看当前是否处于降级状态

它不是新的事实源，也不替代其他模块的管理页。

## 与其他模块的关系与边界

### 与 B 的关系

D 依赖 B 提供的事实包括：
* `Race`
* `Registration`
* `RaceProject`
* `CAConnection`
* `Session`

但 D 不修改这些事实，只读取并整形成 projection / read model。

### 与 C 的关系

D 依赖 C 提供的事实包括：
* `Work`
* `JudgeAssignment`
* `JudgingRecord`
* `Award`

其中最重要的边界是：
* D 可以消费 `Award` 形成最终榜读取模型
* D 不能替代 C 生成 `Award`
* D 可以消费评审事实形成过程榜，但不能把它包装成最终结果

### 与 E 的关系

D 在 E 未完整落地前，为 Review 页提供降级读取模型：
* `review_summary_read_model`

但 D 不拥有 Report 的生成事实，只做读取整形与优雅降级。

### 冲突结论

本轮实现没有发现以下冲突：
* 没有发现 D 回写其他模块事实表
* 没有发现 D 把过程榜冒充最终榜
* 没有发现 D 公开暴露原始 Session
* 没有发现 D 抢占 C/E 的事实所有权

因此可以判断：D 当前实现与其他模块边界基本一致，没有明确职责冲突。

## 验证与证据

### 后端验证

```powershell
cd server
npm.cmd run build
```

结果：
* TypeScript 构建通过。

### 前端类型验证

```powershell
cd client
.\node_modules\.bin\tsc.cmd --noEmit
```

结果：
* 共享类型与页面消费侧通过。

### D 模块回归验证

```powershell
C:\Program Files\Git\bin\bash.exe server/src/modules/projection/test.sh
```

结果：
* 全量通过。

该脚本覆盖：
* 公开赛事读取
* 私有赛事权限
* Organizer 重建
* 8 类 projection 持久化
* 过程榜 / 最终榜边界
* `results_page_read_model`
* `review_summary_read_model`
* `screen_feed` 协议字段
* `stable_fallback`
* `static_fallback`
* `status-summary`
* 契约元信息与 readiness 断言

关键验证文件：
* [server/src/modules/projection/test.sh](C:\Users\18192\Desktop\ARY-3-main\server\src\modules\projection\test.sh)
* [server/src/modules/projection/routes.ts](C:\Users\18192\Desktop\ARY-3-main\server\src\modules\projection\routes.ts)
* [client/src/shared/apiTypes.ts](C:\Users\18192\Desktop\ARY-3-main\client\src\shared\apiTypes.ts)

## 文档同步

本轮已同步更新：
* [PLAN.md](C:\Users\18192\Desktop\ARY-3-main\PLAN.md)
* [STATUS.md](C:\Users\18192\Desktop\ARY-3-main\STATUS.md)
* [开发指南.md](C:\Users\18192\Desktop\ARY-3-main\开发指南.md)

同步内容包括：
* D 第一轮实现已完成
* fallback 与 static fallback 已落地
* C/D 公开端联调已完成
* 契约收敛已完成
* `screen_feed` 协议已收敛一轮
* `status-summary` 已具备可服务性判断字段
* 开发指南中的 D 模块状态已从“待创建”改为“已实现”

## 当前结论

D 模块现在可以这样判断：

* D 的第一轮核心交付已经完成。
* D 与其他模块当前没有发现明确冲突。
* D 已经具备独立测试、独立回归、独立健康判断能力。
* 但按任务板口径，`DEV-5` 仍是“继续细化中”，不建议宣称整个任务卡完全关闭。

更准确的表达是：

**D 模块主体已完成并可用，当前进入模块内部质量和协议细化阶段。**

## 后续仅属于 D 的优化方向

下一步继续优化时，建议仍然限定在 D 模块内部：

* `screen_feed` 空模式替补策略
* `screen_feed` mode-grouped rotation 建议
* `current_leaderboard` 可解释性增强，如 score breakdown
* `risk` 排序和严重度口径收敛
* `event_stream` 去重、截断、排序规则收敛
* `status-summary` 的聚合视图继续压缩成更易读的健康摘要

## 当前记录对应的关键文件

* [server/src/modules/projection/routes.ts](C:\Users\18192\Desktop\ARY-3-main\server\src\modules\projection\routes.ts)
* [server/src/modules/projection/test.sh](C:\Users\18192\Desktop\ARY-3-main\server\src\modules\projection\test.sh)
* [client/src/shared/apiTypes.ts](C:\Users\18192\Desktop\ARY-3-main\client\src\shared\apiTypes.ts)
* [database/migrations/013-projections.sql](C:\Users\18192\Desktop\ARY-3-main\database\migrations\013-projections.sql)
* [开发指南.md](C:\Users\18192\Desktop\ARY-3-main\开发指南.md)
* [PLAN.md](C:\Users\18192\Desktop\ARY-3-main\PLAN.md)
* [STATUS.md](C:\Users\18192\Desktop\ARY-3-main\STATUS.md)
