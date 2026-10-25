<p align="center">
  <img src="https://raw.githubusercontent.com/KouzakiUmi/dsh-prompt-zh/main/assets/banner.svg" width="100%" alt="Prompt ZH：让Deepseek使用中文回复。系统段落、MCP 指导与已知运行时注入；其他模型的语言遵循情况可能不同。">
</p>

<div align="center">

# Prompt ZH

**少一点语言切换，多一点规则可读性。**

DeepSeek Harness 的系统提示词中文化插件。把已知英文规则译成简体中文，并加入中文语言指令，引导 Deepseek 使用中文回复；不改宿主源码，不改工具名和参数结构。

<sub>中文提示词是语言引导，不是输出保证。其他模型不一定同样遵循；本轮未做跨模型回复语言对照测试。</sub>

[![Release](https://github.com/KouzakiUmi/dsh-prompt-zh/actions/workflows/release.yml/badge.svg)](https://github.com/KouzakiUmi/dsh-prompt-zh/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/dsh-prompt-zh?color=1f6feb&label=npm)](https://www.npmjs.com/package/dsh-prompt-zh)
[![MIT](https://img.shields.io/badge/license-MIT-68786a)](LICENSE)

[开始使用](#开始使用) · [覆盖范围](#中文化不等于全部改写) · [兼容性](docs/compatibility.md) · [开发文档](docs/development.md) · [更新记录](CHANGELOG.md)

</div>

## 规则更易读，契约不改动

它不是聊天翻译器。Prompt ZH 在宿主的提示词组装和运行时注入环节处理已知规则，并提供原生译文设置页：逐条编辑实际替换用的译文、按组件开关、查看精确版本与插件阶段的命中／输出改变信号。

| 你关心的内容 | Prompt ZH 如何处理 |
| --- | --- |
| 系统行为指引 | 中文化已知提示词段落，按当前可见工具裁剪相关句子 |
| MCP 使用规则 | Blender、Context7、GitHub、Playwright、Chrome DevTools 按已知原文守卫翻译，不依赖服务器版本；未知服务器保持原文，不用 MCP 客户端版本冒充 |
| 运行时提醒 | 处理时间／时区、工作区指令包装、技能目录调用纪律、Hindsight 记忆规则等已知文本 |
| Git Bash 附加指导 | 中文化已知 MSYS 路径、shell 路由及 `run_code` 开启／关闭提示；只替换匹配的 Bash description 附加文本 |
| 工具调用契约 | 保留工具名、参数 schema、代码和动态值；通用 description 及未知附加内容保持原文 |

### 看一个真实例子

```text
You are an AI agent powered by DeepSeek Harness.
↓
你是由 DeepSeek Harness 驱动的 AI agent。
```

```text
Browser time zone for this request: unavailable. Ask the user to clarify otherwise-unqualified dates and times.
↓
本次请求的浏览器时区：不可用。请用户澄清未明确限定时区的日期和时间。
```

<sub>示例与横幅取自当前翻译函数，并有离线断言；横幅是说明图，不是 DSH 界面截图。</sub>

## 中文化，不等于全部改写

**已知规则才替换，未知内容不猜译。** 翻译可以重复执行；没有命中时保留原文。工具相关句子按可见工具集裁剪，不向模型推荐不存在的工具。

运行时翻译保留全局兜底，并在 agent 初始化完成后注册本 agent 的作用域监听器，覆盖随后由 preset 挂载的时间等注入；对已经存在的 agent 回补，并随 agent、依赖或插件卸载清理。

1.3.2 延续逐条译文设置页，并适配已核验的 Core 0.2.1-rc.2、Git Bash 0.42.2 与 Hindsight 0.8.2；版本发布状态以 GitHub Release 与 npm registry 为准，安装后仍需在目标 Profile 验收。main 分支的后续未发布改动已复核 Core 0.2.1-rc.3 并追加精确兼容声明，该声明在对应版本发布前不代表 npm 包已包含。Git Bash、Hindsight 仅在当前解析包版本与条目已核验精确版本一致时翻译，未知或不符版本保留原文；已知 MCP server 独立按原文守卫执行。Git Bash context 在组装时可以有译文，但当前 Core 的后续 `refreshContext` 仍可能恢复来源英文；补译文不等于改变宿主的最终快照生成。

## 逐条编辑译文

在宿主的 **Prompt ZH 设置页**或插件配置区域中，每条内置译文都有区块、匹配方式、已核验／当前解析版本和处理计数。编辑框默认是内置译文，保存覆盖值后由实际翻译函数读取；不能编辑原文匹配规则。

- **保存到当前 Profile**：使用原生配置表单及修订号校验，不使用浏览器存储代替。保存成功不代表已经遇到原文或最终请求已生效。
- **还原全部草稿／还原此条草稿**：只改变编辑内容，再点保存才持久化。
- **组件开关**：关闭后对应文本保留原文；第三方版本门控不能由开关绕过（MCP 已知 server 例外：按每条原文守卫执行，不依赖服务器版本，未知 server 仍不翻译）。
- **刷新信号**：读取当前保存配置的累计命中／输出改变；不保留会话正文或动态捕获值。
- **工具可见性保护**：关联工具缺失时，该段自定义译文临时回退内置值再裁剪，并显示回退次数；保存值不变，关联工具齐全时继续使用自定义译文。

动态 `$1`、`$2` 等占位符必须保留。保存失败或并发冲突保留草稿，不会自动覆盖更新后的远端配置。详见[设置说明](<docs/settings.md>)。

> [!IMPORTANT]
> **仍看到英文，不一定是插件未生效。** 宿主在翻译之后重建的 runtime-context 快照、创建完成后新增的外层注入方，以及宿主之外追加的系统消息仍可能为英文。技能自身的摘要／正文、未知 MCP 正文和工具 schema 也不做全面翻译。完整边界见 [兼容性与覆盖范围](docs/compatibility.md)。

## 开始使用

### 安装 npm 版本

一般安装参考使用 `dsh plugin`，以下统一以 `web` 作为示例 Profile：

```powershell
dsh plugin --profile web add dsh-prompt-zh
```

更新已安装版本：

```powershell
dsh plugin --profile web update dsh-prompt-zh@latest
```

`web` 仅是文档示例，不代表你的实际安装目标。实际操作前应核实环境、Profile 和命令入口；Desktop 使用目标桌面壳自带的 DSH Desktop CLI，不用独立公共/Core CLI 管理保留的 `desktop` Profile，也不在 Profile 中裸跑 npm/pnpm 安装。

安装／更新后，按部署方式重新启动或重载 DSH，让 Host 插件重新加载。**npm 徽章显示实际已发布版本；main、版本字段与当前运行会话不自动等同。**

### 使用固定版本的 Release 包

从 [GitHub Releases](https://github.com/KouzakiUmi/dsh-prompt-zh/releases) 下载 `dsh-prompt-zh.tgz`，使用下载文件的绝对路径：

```powershell
dsh plugin --profile web add "<tarball 的绝对路径>"
```

不要把 GitHub 源码 ZIP 当作验证过的发布包。已有安装优先用上面的 npm 更新命令。

## 克制，也包括权限

**不读取账户凭据，不改宿主安装包，不启动子进程，不向外部翻译服务发送提示词。** 翻译处理本身不写文件；保存操作复用宿主原生配置表单，由宿主写入当前 Profile。版本证据只读取公开解析得到的包 manifest 名称／版本；客户端仅以同源 GET 读取已认证的固定诊断路径，不进行外部网络翻译。

- `systemPrompt` 是必需宿主服务；`agents` 动态接入，缺少时保留静态翻译与全局兜底。
- Node.js 要求 `>=18`；DSH 范围仅列已核验的 Core `0.2.1-alpha.2`、`0.2.1-alpha.3`、`0.2.1-rc.2`、`0.2.1-rc.3`，范围与逐版本声明保持一致。兼容声明不代表所有宿主、provider 和插件组合均完成现场验收。
- 当前适配基线为官方 DeepSeek Harness 桌面安装包 `0.2.1-rc.3` 随包 Core `0.2.1-rc.3`、Cordis `4.0.5` 与 Schemastery `3.18.5`；宿主隔离测试及该版本前端静态库的 React 离线浏览器回归均通过。保留 alpha.3 fixture 与 rc.2 既有验证记录；没有在生产 Profile 安装或进行真实配置保存验收。

## 进一步了解

| 文档 | 内容 |
| --- | --- |
| [兼容性与覆盖范围](docs/compatibility.md) | 能翻译什么、英文残留原因、已验证环境与权限边界 |
| [开发与验证](docs/development.md) | 模块结构、离线测试、真实宿主验证、打包与发布流程 |
| [本轮适配与加固报告](docs/audit-report.md) | 本轮改动、真实会话巡检结果、验证证据与待决事项 |
| [更新记录](CHANGELOG.md) | 未发布改动、1.3.2 修复内容与已核实的历史里程碑 |
| [展示资源说明](assets/README.md) | 横幅的事实来源、字体引用与文档素材约定 |

---

[MIT License](LICENSE) · [报告问题](https://github.com/KouzakiUmi/dsh-prompt-zh/issues) · [GitHub Releases](https://github.com/KouzakiUmi/dsh-prompt-zh/releases)
