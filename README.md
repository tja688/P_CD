# PCD

策划 playtest 预览，以及网页端与 Unity 端共用的规则内核。本仓库目前是工程骨架：同一份 C# 内核可以在 .NET 10、WebAssembly 与 Unity 6.6 里编译。

## 测试

```bash
dotnet test Pcd.slnx
```

## 模拟命令行

```bash
dotnet run --project src/Pcd.Sim -- version
```

当前只输出内核版本 `0.1.0`。不带参数时同样输出版本。

## .NET 与 WebAssembly 对照

先安装 WebAssembly 构建工具（只需一次）：

```bash
dotnet workload install wasm-tools
```

然后比较同一次调用的标准输出：

```bash
node tools/compare-runtimes.mjs
```

脚本会分别在 .NET 与 Node 里的 WebAssembly 上调用内核，并要求两边的标准输出逐字节相同。默认比较两条请求：`{"seed":1234567,"count":5}` 与 `{"seed":42,"count":1}`。也可以把一条请求作为参数传入。推送时 GitHub Actions 会先跑 `dotnet test`，再跑这个脚本。

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
