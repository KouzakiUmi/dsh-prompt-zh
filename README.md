# dsh-prompt-zh — DSH 系统提示词中文化

把 DSH 内置的**系统提示词**、**MCP 指导说明**以及**各插件动态注入的提示词片段**替换为简体中文。**纯 Host 插件，无 UI。**

## 它接管什么

| 目标 | 注入点 | 说明 |
|---|---|---|
| 提示词正文段落与 context | `system-prompt/assemble` | 逐段翻译 `sections`、翻译 `contexts`，并按可见工具集裁剪与重排（`filePolicy` / `networkPolicy` / `delegationPolicy`） |
| MCP 服务器系统指令 | `system-prompt/assemble` | 逐项接管 `mcp:<server>`（如 `context7`、`github`、`playwright`、`chrome-devtools` 等）的规则与指导说明 |
| 运行时动态注入提示词片段 | `llm/stream` | 拦截模型输入流，实时将各插件动态注入的消息级提示词翻译为简体中文 |

### 动态注入提示词覆盖范围（`llm/stream` 阶段）

许多内置与三方插件会向消息流中注入 `<system-reminder>`、`<hindsight_*>` 或快照消息。插件在 `llm/stream` 处以幂等、低开销方式自动中文化这些片段：

1. **运行时上下文快照头部**（`@deepseek-ai/dsh-system-prompt` / `@deepseek-ai/dsh-agent-loop`）：
   `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.` → `当前运行时上下文。此快照替代此前的运行时上下文快照。`
2. **工作区指令**（`@deepseek-ai/dsh-agent-instructions`）：
   AGENTS.md、CLAUDE.md 等工作区指令的引导语（`The following workspace instructions may be relevant...`）、基线替换声明与来源标记（`Instructions from: ...`）。
3. **技能系统提示与更新**（`@deepseek-ai/dsh-tool-skill` / `@deepseek-ai/dsh-skill`）：
   `<system-reminder>` 中的可用技能列表说明、技能目录更新提示（`The available skill catalog changed...`）、调用纪律与 `<skill_content>` 资源路径指引。
4. **时间与时区采样**（`@deepseek-ai/dsh-time-context`）：
   每轮每步注入的时间采样、浏览器时区与自前序上下文耗时（`Time sampled while preparing turn...`）。
5. **Hindsight 记忆与知识库**（`@vectorize-io/hindsight-coding-agents`）：
   知识库引导（`<hindsight_knowledge>`）、记忆检索说明（`<hindsight_memory>`）与刷新提醒（`<hindsight_knowledge_refresh>`），包括工具调用时机、纠错机制与归属声明。

## 判断模块：句子 ↔ 工具关联

翻译之后再过一道**句子级裁剪**（`SENTENCE_TOOL_LINKS` + `applySentenceGate`）：
每个句子片段声明它引用的工具/模块，`assemble` 时按当前会话**可见工具集**逐条核对，
不可见就从文本中移除该句——避免「没有的东西也发过去」：

- pwsh 会话不收到 `Bash` 指引（`team:policy` 里 `Bash、` 片段按 `bash` 工具可见性裁剪）；
- 没有 `present` 就不教 `present` 的用法（`ui:deliverable-file-references` 相关四句整体裁掉）；
- `tool:jobs` 后半句按 `job_output` / `job_kill` 各自可见性裁剪，不再因缺一而整段丢弃
  （section 级要求相应从「全部具备」放宽为「至少一个」，`team:policy` 同理）；
- `tool:ralph` 只在 `subagent`/`workflow`/`goal` 工具存在时才给出对应建议；
- `plan:policy` 中 `todo_write` / `ask_user_question` 的提名按可见性裁剪；
- `networkPolicy` 在没有任何联网/外部来源面（含 MCP、桌面操作）时整段不生成；
  `x_search` 的「不要改用 web_search/grok_web_search」只在对应工具确实存在时附在句尾；
- `filePolicy` 不再于 `edit` 缺席时提名 `edit`。

⚠ 表内片段必须与译文字面**完全一致**，否则会静默不命中——离线自检已把
「每条关联都能在译文中找到」列为硬校验（2026-10-02 就靠它修掉了一处
`present` 裁剪因字面漂移而从未生效的问题）。自行生成的三段 policy
在生成时按同样的可见性判断组装，不进关联表。

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

运行 `node check.mjs`：把真实英文原文喂进去，断言中文输出含关键句、句子关联完整命中且二次翻译逐字节幂等。**升级后先跑它。**

## 依赖

- `systemPrompt`（必需，`export const inject`）

无其他外部服务依赖，无文件系统写入，无网络访问。
