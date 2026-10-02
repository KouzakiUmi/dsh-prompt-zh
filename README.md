# dsh-prompt-zh — DSH 系统提示词中文化

把 DSH 内置的**系统提示词**替换为简体中文。**纯 Host 插件，无 UI。**

## 它接管什么

| 目标 | 注入点 |
|---|---|
| 提示词正文段落与 context | `system-prompt/assemble` |

**只有这一个注入点。** 具体改写的对象是 `system-prompt/assemble` 回调里的
`{ sections, contexts, tools }`：逐段翻译 `sections`、翻译 `contexts`、
并按可见工具集裁剪与重排（`filePolicy` / `networkPolicy` / `delegationPolicy` 三段是重新生成的）。

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
- 上游任何一个工具改描述，字典就落后一次，且**不会报错**（见下节）。

> 曾经实现过一版经 `llm/stream` 就地改写 `GenerateOptions.tools[].description` 的方案
> （`options.tools` 确实是模型实际收到的那份 `ToolSchema[]`，且 `tools.schemas()` 返回深拷贝、
> 可安全就地改写），后按上述决定整体移除。`lib/index.js` 里留有一行注释标记此事，
> 若将来需要恢复，从那里入手。

## 两种"静默落后"的风险

本插件用两种方式接管提示词，**两者在上游原文变化时都不会报错**：

1. `TEXT` 字典是**整段无条件替换**（不比对英文原文）；
2. `networkPolicy` / `filePolicy` / `delegationPolicy` 是**自行生成**的段落，同时
   `translate()` 把对应原 section 置空（`return ''`）。

⇒ **升级 DSH 后必须复查。** 复查方法：在
`resources/app/node_modules/@deepseek-ai/` 下 grep 对应 section 名
（如 `name: "tool:read"`、`name: "ui:deliverable-file-references"`、
`FILE_REFERENCE_PROMPT`、以及 `dsh-base/cordis.patch.yml` 里的 plan-mode `section:`），
再与 `lib/index.js` 的 `TEXT` / `PLAN_PARAGRAPHS` / `filePolicy` / `SENTENCE_TOOL_LINKS` **逐句**比对。

2026-10-02 对照已安装 ASAR 做过一次全量覆盖面盘点（只读解析，未改包）：
核心共注册 **24 个 prompt section**（`tool:*` 11、`tools:*` 2、`deployment:*` 2、
`harness:identity`、`plan:policy`、`app:web-surface`、`team:policy`、
`ui:deliverable-file-references`、`context:file-reference`）与 **4 个 context**
（`approval:policy`、`sandbox:policy`、`subagent:delegation` + section 形式的
`context:file-reference`），插件全部覆盖；`mcp:*` / `computer-use:*` /
`working-activity:*` / `tool:structured_output` / `tool:grok_web_search` 等
当前安装未注册，插件仅保留防御性处理。

**注意两类漂移不同**：句子级遗漏只是少译一句；**段落级前缀失配**会让整段保持英文
（2026-09-29 就修过一次 —— `PLAN_PARAGRAPHS[2]` 的前缀多了一个句点，
`startsWith` 失败，plan mode 第 3 段一直是英文原文）。所以**必须实测，不能只看译文**。

## 离线自检

`lib/index.js` 导出了纯函数，可脱离运行中的 DSH 验证：

```js
import { translate, translateContext, networkPolicy, filePolicy, delegationPolicy } from 'dsh-prompt-zh'
```

`~\.dsh\prompt-zh-check.mjs` 就是这样一个脚本：把**真实英文原文**喂进去，
断言中文输出含关键句、且二次翻译逐字节幂等。**升级后先跑它。**

（脚本内嵌的英文原文取自核心 `0.2.0-rc.1` / 壳 `2.0.15-next`；上游再改时这些字面量要同步更新。）

## 依赖

- `systemPrompt`（必需，`export const inject`）

无其他服务依赖，无文件系统写入，无网络访问。
