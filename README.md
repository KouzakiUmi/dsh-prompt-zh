<p align="center">
  <img src="https://raw.githubusercontent.com/KouzakiUmi/dsh-prompt-zh/main/assets/banner.svg" width="100%" alt="Prompt ZH：让Deepseek使用中文回复。系统段落、MCP 指导与已知运行时注入；其他模型的语言遵循情况可能不同。">
</p>

<div align="center">

# Prompt ZH

**少一点语言切换，多一点规则可读性。**

DeepSeek Harness 的系统提示词中文化插件。把已知英文规则译成简体中文，并加入中文语言指令，引导 Deepseek 使用中文回复；不改宿主源码，不改工具 schema。

<sub>中文提示词是语言引导，不是输出保证。其他模型不一定同样遵循；本轮未做跨模型回复语言对照测试。</sub>

[![Release](https://github.com/KouzakiUmi/dsh-prompt-zh/actions/workflows/release.yml/badge.svg)](https://github.com/KouzakiUmi/dsh-prompt-zh/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/dsh-prompt-zh?color=1f6feb&label=npm)](https://www.npmjs.com/package/dsh-prompt-zh)
[![MIT](https://img.shields.io/badge/license-MIT-68786a)](LICENSE)

[开始使用](#开始使用) · [覆盖范围](#中文化不等于全部改写) · [兼容性](docs/compatibility.md) · [开发文档](docs/development.md) · [更新记录](CHANGELOG.md)

</div>

## 规则更易读，契约不改动

它不是聊天翻译器，也不增加设置页。Prompt ZH 是一个纯 Host 插件，在宿主的提示词组装和运行时注入环节处理已知规则：

| 你关心的内容 | Prompt ZH 如何处理 |
| --- | --- |
| 系统行为指引 | 中文化已知提示词段落，按当前可见工具裁剪相关句子 |
| MCP 使用规则 | 翻译已识别服务器的指导说明；未知正文保守保留 |
| 运行时提醒 | 处理时间／时区、工作区指令包装、技能目录调用纪律、Hindsight 记忆规则等已知文本 |
| 工具调用契约 | 保留工具名、description、参数 schema、代码和动态值 |

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

> [!IMPORTANT]
> **仍看到英文，不一定是插件未生效。** 宿主在翻译之后重建的 runtime-context 快照、创建完成后新增的外层注入方，以及宿主之外追加的系统消息仍可能为英文。技能自身的摘要／正文、未知 MCP 正文和工具 schema 也不做全面翻译。完整边界见 [兼容性与覆盖范围](docs/compatibility.md)。

## 开始使用

### 安装 npm 版本

统一通过已核对的 `dsh plugin` 入口操作目标 Profile，使用实际 Profile 名称执行：

```powershell
dsh plugin --profile <profile> add dsh-prompt-zh
```

更新已安装版本：

```powershell
dsh plugin --profile <profile> update dsh-prompt-zh@latest
```

安装／更新后，按部署方式重新启动或重载 DSH，让 Host 插件重新加载。**npm 徽章显示实际已发布版本；main、版本字段与当前运行会话不自动等同。** 不要混用其他 Profile，也不要改用裸 `npm install` / `pnpm install` 或桌面内部脚本修改生产安装。

### 使用固定版本的 Release 包

从 [GitHub Releases](https://github.com/KouzakiUmi/dsh-prompt-zh/releases) 下载 `dsh-prompt-zh.tgz`，使用下载文件的绝对路径：

```powershell
dsh plugin --profile <profile> add "<tarball 的绝对路径>"
```

不要把 GitHub 源码 ZIP 当作验证过的发布包。已有安装优先用上面的 npm 更新命令。

## 克制，也包括权限

**无文件系统写入，无网络访问，不读账户凭据，不改宿主安装包。** 插件只处理提示词字符串与消息的安全浅拷贝，并注册自身的生命周期监听器。

- `systemPrompt` 是必需宿主服务；`agents` 动态接入，缺少时保留静态翻译与全局兜底。
- Node.js 要求 `>=18`。兼容声明不代表所有宿主、provider 和插件组合均完成现场验收。
- 本轮真实宿主隔离测试使用 Desktop 壳 `2.0.17-next` 随包的 Core 模块 `0.2.1-alpha.2` 和 Cordis `4.0.5-alpha.1`，验证了插件加载、实际时间注入及卸载清理；未在当前生产 Profile 安装验收。

## 进一步了解

| 文档 | 内容 |
| --- | --- |
| [兼容性与覆盖范围](docs/compatibility.md) | 能翻译什么、英文残留原因、已验证环境与权限边界 |
| [开发与验证](docs/development.md) | 模块结构、离线测试、真实宿主验证、打包与发布流程 |
| [更新记录](CHANGELOG.md) | 1.2.6 的修复内容与已核实的历史里程碑 |
| [展示资源说明](assets/README.md) | 横幅的事实来源、字体引用与文档素材约定 |

---

[MIT License](LICENSE) · [报告问题](https://github.com/KouzakiUmi/dsh-prompt-zh/issues) · [GitHub Releases](https://github.com/KouzakiUmi/dsh-prompt-zh/releases)
