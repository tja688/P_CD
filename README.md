# PCD

策划 playtest 预览，以及网页端与 Unity 端共用的规则内核。同一份 C# 内核可以在 .NET 10、WebAssembly 与 Unity 6.6 里编译；网页表现层采用 640×360 单色琥珀磷光 CRT 图形终端。

## 网页游玩

```bash
dotnet run --project src/Pcd.DevHost
```

打开 `http://127.0.0.1:5180/`。A–09 图形接收终端已经接入三个真实怪物、三套预设牌组、51 张玩家卡牌与 3 张怪物初始卡、自定义牌组、九宫格对局、效果目标选择和结算。刷新页面可继续本机保存的对局；已完成对局可以导出内核录像。

卡盒另提供 13 种现有卡背的只读图形档案。由于当前内核构建牌组接口仅接收卡牌 ID，这里不提供未接通的装备按钮。

画面先绘制为 640×360 灰度帧缓冲，再使用 WebGL 执行琥珀着色、克制辉光、扫描栅格、曲面、暗角与余辉。无 WebGL 时保留可玩的琥珀 Canvas2D 显示。界面与 8bit 风格电子音效均由代码生成，中文像素字体和许可证随仓库提供；运行时不依赖 CDN。

`Tab` / `Enter` 选择与确认，数字键选择手牌和格位，`E` 结束回合，`Escape` 返回或暂停，`F1` 操作手册，`Space` 加速演出。终端校准可调整亮度、声音和静态舒适模式。

后续视觉开发必须先读 [Amber Phosphor CRT 表现层接力手册](docs/amber-phosphor-presentation-handoff.md)。目前未接入的商店、奖励和大地图元游戏不提供假按钮。

## 测试

```bash
dotnet test Pcd.slnx
```

## 模拟命令行

```bash
dotnet run --project src/Pcd.Sim -- version
```

模拟命令行支持 `version / play / batch / replay / scenario / explain`；用 `dotnet run --project src/Pcd.Sim -- --help` 查看参数。输出供 AI 和策划读取，不是玩家界面。

## .NET 与 WebAssembly 对照

先安装 WebAssembly 构建工具（只需一次）：

```bash
dotnet workload install wasm-tools
```

然后比较同一次调用的标准输出：

```bash
node tools/compare-runtimes.mjs
```

脚本会分别在 .NET 与 Node 里的 WebAssembly 上调用内核，并要求两边的标准输出逐字节相同。默认比较随机数探针、白板对局、规则内容对局与录像重放哈希。也可以把一条请求作为参数传入。推送时 GitHub Actions 会先跑 `dotnet test`，再跑这个脚本。

请求是一段 JSON，键的顺序固定为 `seed`、`count`。`seed` 是十进制无符号整数，`count` 取 1 到 16。响应没有空白：

```json
{"version":"0.1.0","values":[...]}
```

`values` 是 SplitMix64（Vigna，2015）从该状态字起连续取出的 64 位无符号整数。构造时种子直接作为状态字，不另做混合。

`.NET` 侧的入口是 `src/Pcd.ProbeHost`，WebAssembly 侧是 `src/Pcd.Wasm`。模拟命令行不承担这次对照。

## Unity 6.6

用 Git URL 加路径引用共享包（把 `<标签>` 换成版本标签）：

```text
https://github.com/tja688/P_CD.git?path=/src/Pcd.Kernel#<标签>
```

包目录是 `src/Pcd.Kernel`。`package.json` 的 `version` 与代码里的 `KernelVersion.Text` 同为 `0.1.0`。

内核语言锁定在 C# 9 / .NET Standard 2.1，见 `src/Pcd.Kernel/Pcd.Kernel.csproj`。`Runtime/Pcd.Kernel.asmdef` 里 `noEngineReferences` 为 `true`，Unity 编译该程序集时不会引用引擎。

核对方式：

- 导入后在 Unity 里选中 `Pcd.Kernel` 程序集，确认没有 UnityEngine 引用。
- `dotnet test` 中的 `Compiled_kernel_does_not_reference_unity` 检查已编译程序集的引用列表里没有 UnityEngine 或 UnityEditor。
