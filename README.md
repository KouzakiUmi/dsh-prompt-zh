# dsh-prompt-zh — DSH 系统提示词中文化

把 DSH 内置的**系统提示词**、**MCP 指导说明**以及**各插件动态注入的提示词片段**替换为简体中文。**纯 Host 插件，无 UI。**

## 支持的宿主环境与插件版本

本插件在以下 DSH 核心与插件环境中完成完整验证与对齐：

| 目标 / 插件包 | 验证基线版本 | 覆盖说明 |
|---|---|---|
| **DSH Core** | `0.2.0-rc.1` / `0.2.1-alpha.1` | 核心宿主运行环境与 Cordis 事件流水线 |
| **DSH Desktop** | `2.0.15-next` | 桌面壳及配套扩展 |
| `@deepseek-ai/dsh-system-prompt` | `0.2.1-alpha.1` | 系统提示词组装、多段落规约与运行时上下文快照总头部 |
| `@deepseek-ai/dsh-agent-instructions` | `0.2.1-alpha.1` | AGENTS.md / CLAUDE.md 等工作区指令提示语、来源说明与截断提示 |
| `@deepseek-ai/dsh-time-context` | `0.2.1-alpha.1` | 每步时间采样、浏览器时区与步进耗时（含 step 1 前序消息耗时） |
| `@deepseek-ai/dsh-tool-skill` / `dsh-skill` | `0.2.1-alpha.1` | 可用技能目录 `<available_skills>`、变更提示、调用纪律与资源路径指引 |
| `@deepseek-ai/dsh-mcp-client` | `0.2.1-alpha.1` | MCP 服务器系统指令，预置 `context7`、`github`、`playwright`、`chrome-devtools` |
| `@deepseek-ai/dsh-plan-mode` | `0.2.1-alpha.1` | Plan mode 行为守则与多模式目录稳定性说明 |
| `@deepseek-ai/dsh-tool-jobs` | `0.2.1-alpha.1` | 后台 Job 管理与生命周期提示 |
| `@deepseek-ai/dsh-experimental-tool-agent-team` | `0.2.1-alpha.1` | Agent Teams 多代理协作纪律 |
| `@vectorize-io/hindsight-coding-agents` | `0.8.0` | 外部记忆库 `<hindsight_knowledge>`、`<hindsight_memory>`、刷新提醒 `<hindsight_knowledge_refresh>` |

## 它接管什么

| 目标 | 注入点 | 说明 |
|---|---|---|
| 提示词正文段落与 context | `system-prompt/assemble` | 逐段翻译 `sections`、翻译 `contexts`，并按可见工具集裁剪与重排（`filePolicy` / `networkPolicy` / `delegationPolicy`） |
| MCP 服务器系统指令 | `system-prompt/assemble` | 逐项接管 `mcp:<server>`（如 `context7`、`github`、`playwright`、`chrome-devtools` 等）的规则与指导说明 |

> **注意（v1.2.2 稳定性修复）**：DSH 核心（`@deepseek-ai/dsh-agent-loop`）对下发至 LLM 的请求体实施了严格的不可变保护（`Object.freeze`）。此前的 `llm/stream` 拦截试图就地修改 `options.messages` 会引发只读属性赋值异常；v1.2.2 遵循核心设计规范，纯净保留 `system-prompt/assemble` 组装点，彻底杜绝请求崩溃。
>
> **v1.2.3 健壮性修复**：① 按 name 整段替换的条目改为"输入特征匹配才替换"——上游措辞漂移时保守保留英文原文，不再套用可能过时的旧译文；② Hindsight 片段守卫改为大小写不敏感；③ `filePolicy` 在缺少 `read` 工具时不再指示模型"先读取"。

## 多环境隔离与条件兼容机制

在不同用户的机器上，启用的插件组合与工具权限各不相同（例如未安装 Hindsight、未接入特定 MCP 服务器、或会话处于受限沙箱中）。插件设计了严密的条件判断与自适应机制，确保在任何环境下均稳定运行：

1. **句子级工具感知裁剪（`applySentenceGate`）**：
   在系统提示词组装时实时读取当前会话的可用工具集合 `tools`。如果当前环境未提供某个工具（如 `bash`、`present`、`job_kill`、`job_output`、`ralph` 等），对应引用该工具的句子会被自动剥除，绝不向模型传达无法使用的工具指引。
2. **策略段落按需动态组装**：
   `policy:network`、`policy:filesystem`、`policy:delegation` 纯按当前可用工具及外部接口动态生成。若会话中没有任何联网/外部工具（亦无外部 MCP 与桌面操作），网络策略段落直接为空串，不会强行插入。
3. **MCP 动态识别与保守降级**：
   仅当会话中实际连接并加载了对应 MCP 时才产生相应 section。针对预置的常见 MCP（`context7`、`github` 等）进行深度中文化；遇到用户私有的未知 MCP，仅将标题前缀本地化为 `### MCP 服务器：...`，正文不做任何猜测性改写，杜绝误伤。
4. **提示词动态片段的无侵入性与幂等性**：
   在系统提示词组装与翻译过程中，采用纯字符串特征探测与幂等替换。如果环境中未加载某些特性标签，处理器将直接跳过，零外部依赖，不抛出任何异常，更不会污染其他正常的提示词内容。

## 有意不做的事：工具 schema 保持英文

**工具的 `description` 与参数 schema 一律保持英文，不翻译。**

这一条是刻意的决定，不是遗漏：

- 工具 schema 是模型调用工具的直接依据，改写它有实际的误配风险；
- 工具集会随 agent、preset、PTC 模式变化，逐条维护字典的成本高而收益低；
- 上游任何一个工具改描述，字典就落后一次，且**不会报错**。

## 离线自检

`lib/index.js` 导出了纯函数，可脱离运行中的 DSH 验证：

```js
import { translate, translateContext, filePolicy, networkPolicy, delegationPolicy, translateMcp, translateInjectedText, translateMessages } from 'dsh-prompt-zh'
```

运行 `node check.mjs`（**仅源码克隆可用**——该文件不随 npm 包发布）：把真实英文原文喂进去，断言中文输出含关键句、句子关联完整命中且二次翻译逐字节幂等。**升级后先跑它。**

npm 安装者可用上方 import 示例把导出的纯函数喂入自己的样本做离线验证；若某段英文原文与内置特征不匹配，插件会原样保留该段而不强行翻译。

## 依赖

- `systemPrompt`（必需，`export const inject`）

无其他外部服务依赖，无文件系统写入，无网络访问。
