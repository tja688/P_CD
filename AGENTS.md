# Agent instructions

一款非对称单机CCG卡牌冒险游戏。

Web runtime，Retro-futurist Monochrome Phosphor CRT Interface 视觉风格，平面 2D 视觉构成，8bit像素音效。

## 仓库定位

- 本仓库是策划与 playtest 用的**前置预览版**，同时承载网页端与 Unity 端共用的**规则内核**。Unity 本体不在本仓库，只做 PC（Steam），通过 UPM git 地址按版本标签引用本仓库的共享包。
- 规则以 `docs/game design` 下的策划文档为准；术语以 `CONTEXT.md` 为准；架构决策见 `docs/adr/`；表现层设计见 `docs/amber-phosphor-presentation-handoff.md/`。
- 卡牌数值与效果以内容文件为准，策划文档中的卡表由内容文件生成（ADR-0008）。

## Repository workflow

1. **Do not create branches on your own.** Stay on the branch the user is already on unless they explicitly ask you to create or switch branches.
2. **Do not use git worktrees.** If a skill, script, or workflow expects a worktree, implement the same outcome on the current branch in this clone instead.
3. 游戏核心设计文档：C:\Users\jinji\Documents\GitHub\P_CD\docs\game design。
4. 网页表现层接力、视觉规范、色板、CRT 管线、输入和验收清单见 `docs/amber-phosphor-presentation-handoff.md`；修改 `src/Pcd.Web` 前 MUST 先读该文档。

## 代码约定

- **代码即逻辑**：人或 AI 读代码就是在读设计。换主题时会改名的是内容，使用与虚构无关的内容 ID；换主题也不会变的规则骨架（格位、点数、覆盖、手牌、弃牌堆、出牌机会、回合等）使用描述功能的英文名（ADR-0004）。
- **内核硬约束**（ADR-0001、ADR-0002）：C# 9 / .NET Standard 2.1；不引用 UnityEngine；规则数值只用整数；只用内核自带、状态可序列化的随机数，不用 `System.Random`；不依赖字典遍历顺序、系统时钟与运行环境；不允许可变静态状态；不用运行时代码生成，尽量少用反射。
- 内核只生产事件；表现层自由编排演出，不自行判断合法性（ADR-0003）。
- 怪物 AI 只经信息视图与前向模型接触对局，思考预算按节点数计量（ADR-0007）。

## 测试护栏

- 每次推送必须通过：规则场景测试、内容校验、不变量随机测试、跨运行时一致性测试（.NET 与 WebAssembly）。
- 规则场景测试只使用测试内临时定义的卡牌，不引用真实内容；调整卡牌数值不应让规则测试失败。
- 黄金录像只生成"行为变化报告"，不阻塞提交。改规则或内容后跑一次，把受影响对局的差异汇报给用户。

## 测试与汇报方式

- 人只关注游戏画面；内部状态、录像、批量模拟结果只需要 AI 能读取。
- 用模拟命令行（play / batch / replay / scenario / explain）运行并阅读其 JSON 与 Markdown 输出，再用策划工作名向用户汇报。

## Agent skills

### Issue tracker

Issues live as GitHub issues in `tja688/P_CD` (origin). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
