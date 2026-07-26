# STATUS

本文是 ARY 任务瞬时看板，记录当前任务状态、证据和风险。不记录历史流水。

## 当前结论

* 项目处于 MVP 文档基线与架构前准备阶段。
* 业务文档已集中到 `docs/` 下。
* 当前正式项目任务定义入口是 `docs/ary.plan.md`。
* `PRD-TEMP-1` 已完成首轮整改，报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的新口径已同步到主要文档和高保真原型。
* `UX-1` 已产出第一轮高保真原型和设计说明，但尚未评审验收，不能直接进入 `M2` 或启动架构设计。
* 当前已有 server/client 应用代码；模块 C portfolio 后端路由、迁移、代理和测试脚本已完成实现与验证，`server/src/modules/portfolio/test.sh` 已适配真实登录入口并通过 Git Bash 复跑。
* 模块 C 前端接入已完成当前要求的四个页面：`WorksPage`、`ResultsPage`、`JudgeView`、`OrganizerJudging` 均已完成真实 API 接入。
* 模块 B race-mgmt 加固已合入 `main`，并通过合并后的后端 race-mgmt smoke test 与前端构建验证。
* 模块 E report-gen 初版已完成；完整 B/C/D/E 联调、生产部署配置和统一 P0 回归仍待补齐。

## 任务看板

| 任务 | 状态 | 当前判断 | 证据 / 下一入口 |
| --- | --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 进行中 | 业务文档已集中到 `docs/`，正在校准项目管理结构。 | `docs/README.md`、`docs/ary.plan.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 待复审 | 已完成首轮文档和原型整改。 | `docs/registration-ca-rules-alignment.taskbook.md` |
| `UX-1` UX/UI 高保真原型与设计基线 | 进行中 | 高保真原型已按 IA 重构。 | `design-prototype/index.html` |
| `B` race-mgmt 实现 | 已完成 | 已合入 `main`，smoke test 通过。 | `server/src/modules/race-mgmt/` |
| `C` portfolio 实现 | 已完成 | 后端 + 前端四个页面已完成；Git Bash 执行 `server/src/modules/portfolio/test.sh` 通过，server/client `npx.cmd tsc --noEmit` 通过。 | `server/src/modules/portfolio/`、`client/src/pages/works/WorksPage.tsx`、`client/src/pages/results/ResultsPage.tsx`、`client/src/pages/console/JudgeView.tsx`、`client/src/pages/console/OrganizerJudging.tsx` |
| `E` report-gen 实现 | 已完成 | 后端路由 + 测试脚本完成，前端 ReviewPage 完成。已 rebase 到最新 main。 | `server/src/modules/report-gen/` |
| `D` projection 实现 | 进行中 | 服务端逻辑正确（8 种投影 + rebuild + feedItemType），但分支目录结构异常需重建。 | `server/src/modules/projection/` |
| `DEV-5` CA 接入 / Projection / Live Hall | 细化中 | CA 接入防伪/防篡改方案已落盘（Section 8）。 | `docs/ary-ca-integration-spec.md` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 待开始 | 等待联调完成。 | `docs/ary-release-ops-plan.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 待开始 | 等待发布方案。 | `docs/ary-release-ops-plan.md` |
