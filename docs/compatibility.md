# 兼容性与覆盖范围

[返回主页](../README.md) · [开发与验证](development.md) · [本轮报告](audit-report.md)

## 翻译从哪里进入

| 接入点 | 处理内容 | 不代表什么 |
| --- | --- | --- |
| `system-prompt/assemble` | 已知 `sections` 和 `contexts`；MCP 指导说明；按可见工具组装文件、网络和委派策略 | 不会拦截宿主后续重新生成的上下文 |
| 全局 `agent/pre-step` | 汇入 `decision.messages` 的已知注入文本，作为兜底 | 全局 `prepend` 不保证早于所有运行时注册 |
| `agent/created` 后的作用域 `agent/pre-step` | factory setup 完成后通过 `agent.ctx` 注册；对已有 agent 回补；处理 preset 后挂载的时间等注入 | 不保证覆盖创建完成后新增的外层 `prepend` |

`agents` 使用动态 `ctx.inject`；依赖恢复后重新回补。重复创建通知不重复注册。agent 注销时清理本 agent 的监听器；依赖或插件卸载时通过自己的 `effect` disposer 清理外部 `agent.ctx` 注册。

## 已知文本覆盖

- 系统段落：身份／persona、计划模式、后台 Job、交付物引用、文件操作纪律、goal、委派、桌面操作和宿主 Web 界面等已知规则。
- MCP：已识别服务器的规则，包括 `context7`、`github`、`playwright`、`chrome-devtools`，以及 Blender 全文指导（手册、代码执行、场景／数据块、对象创建、变换／坐标空间）；Blender 译表限定在自己的 MCP 区块内，不猜译未知正文。服务器版本无法核验时，已知 server 仍按每条原文特征翻译（命中才替换，未命中的原文保持英文）；未知 server 的标题与正文保留原文，不把 MCP 客户端版本当作服务器版本。
- Git Bash：已核实的 `dsh-gitbash-shell` 0.39.0／0.39.4／0.42.2 指导文本，包括完整／严格 MSYS 盘根说明、`run_code` 旧版提示与新版开启／关闭分支、pwsh 可见／隐藏路由和 MSYS 工具附加说明；0.42.2 重写的执行通道选择、`gitbash_native`／`gitbash_to_native_path` 原生通道与持久终端方言单独按版本登记。保留路径与 `$VARS` 等字面值，不把“尽力转换”译成保证转换。
- 工作区指令：来源说明、完整基线／替换基线、截断提示、文件更新包装；用户自己的指令正文不做通用翻译。
- 技能系统：目录引导、目录变化、调用纪律与资源路径说明；不翻译任意技能的自然语言摘要和完整正文。
- 时间上下文：时间采样、已知／缺省／混合浏览器时区、前序消息／步骤耗时；保留时间戳、IANA 时区列表和实际时长。
- Hindsight：记忆、知识页与刷新包装中的已知提示语；检索到的任意记忆内容不做通用翻译。

固定译文表和 CUA section 分支均带原文特征守卫：仅在匹配时替换，不匹配则保留原文。权限相关的 `subagent:delegation` 只接受已核实全文，内容追加或权限语义变化均保留原文。其他部分守卫只校验前缀，不是全文一致性校验；若上游保留开头却改变后续语义，仍需人工复核。此处不包括按工具可见性重新生成或移除的策略段，也不宣称适配任意上游重写。

## 设置与第三方精确版本门控

Host＋Client 接入已核验 Core `0.2.1-alpha.2`、`0.2.1-alpha.3`、`0.2.1-rc.2` 与 `0.2.1-rc.3` 的 `settings`、`configForms` 和已认证 `connection.fetch` 契约；不沿用旧纯 Host 版本对早期 Core 的界面兼容声明。缺少相应服务或 Schema 时不能冒充可保存配置。兼容指宿主接口与既有规则回归通过，不表示新版新增的每条英文都有译文。

每个内置译文条目使用同一运行时登记点，保存的覆盖值在真实 section、context、消息或附加说明替换函数中读取。带工具关联的自定义段落在关联工具缺失时临时回退内置值再裁剪，并记录回退次数；不改保存值，工具齐全后继续使用覆盖值。组件关闭后保留原文。第三方按精确版本放行：Git Bash 0.39.0／0.39.4 与 0.42.2 的提示分别登记适用版本（0.42.2 的路由与原生通道指导独立列出），Hindsight 包装基线为 0.8.1／0.8.2；未知版本不放行。MCP 已知 server 是例外：每条译文都带原文特征守卫，命中才替换，因此不依赖服务器版本；未知 server 仍按标题与正文保留原文处理。

界面所称“当前版本”是宿主公开包解析服务提供的 manifest 版本，不证明旧模块已经重载。命中次数、输出改变与版本是否一致分别展示；固定原文、正则、section 名和生成条件不能混称全文精确匹配。上下文条目明确标记刷新覆盖风险，计数不代表最终请求全量中文化。详见[设置说明](<settings.md>)。

## 提示词语言与模型回复语言

主页横幅的“让Deepseek使用中文回复”表达语言引导目标：插件在 persona 提示词中加入“必须使用简体中文思考和回答。”，并中文化已知规则。它不改模型参数、解码器或模型权重，不保证某次回复必定使用中文。

其他模型可能不受中文提示词同样影响。中文提示词是否改变回复语言，应在实际模型、provider、指令优先级和会话条件下核验；本轮只验证翻译与宿主链路，未做 Deepseek 与其他模型的回复语言对照实验。

## 为什么仍可能看到英文

1. **运行时快照被覆盖**：核心 `dsh-agent-loop` 在 `pre-step` 后通过 `refreshContext` 重新调用 context provider，并替换 `runtime-context` 消息。快照的标题、工作目录、文件策略与审批正文仍可能为英文。静态组装阶段存在相应译文，不意味着快照最终保留译文。新增 `gitbash-shell:posix-paths` 也遵循这条链路：译表和组装测试已覆盖，但刷新后仍可能恢复来源插件的英文；本次未修改 Core 或来源插件。
2. **注册发生得更晚**：创建完成后才挂载的外层 `prepend`（例如运行期间重组 preset），其返回内容仍可能晚于翻译处理。没有 Cordis `ctx` 的自定义 registry agent 也只能使用全局层，不保证覆盖其后追加的 preset 消息。
3. **宿主之外的系统消息**：provider、网关或远端服务追加的文本可能不经过本插件的两个翻译管线。
4. **刻意保留的工具契约**：参数 schema、工具调用名称、代码和动态值保持原状；通用 `description` 及未知附加内容不翻译。唯一新增的例外是 `bash` description 中已核实的 Git Bash 自然语言附加说明，使用安全浅拷贝翻译，不修改参数结构或其他工具。
5. **未知内容**：不调用额外模型猜译未知 MCP、任意技能正文或上游变化后的规则。
6. **工具返回值**：`skill` 等工具直接返回的全文不经过 `agent/pre-step` 注入翻译；有对应字符串译文，也不等于该工具结果被拦截。

不采用替换宿主方法、操作私有 hook 列表或改写冻结请求来绕过这些边界。`llm/stream` 的 `next()` 不接收替换消息参数，冻结的 options 也不能就地改写。

## 验证证据与版本归属

[宿主隔离测试](<../tests/host-smoke.mjs>)先前直接解析展开的 Desktop 模块；2026-10-15 再核验了当前 ASAR 版本的只读静态副本。2026-10-22 以只读 ASAR 解析复核包版本与插件依赖的服务契约（`settings.configure`、`configEditor`、`connection.fetch.register`、`pluginPackages.packageOf`）仍存在，并把 ASAR 只读解包到工作区临时目录后运行 host-smoke：rc.2 宿主与 alpha.3 fixture 均为 ALL PASS（插件加载、assemble、作用域监听、卸载清理与 `refreshContext` 边界）。该次静态复核未运行浏览器回归。提取时验证归档文件完整性，未修改安装包；测试只创建内存服务，不加载生产 Profile、凭据或真实 provider。

2026-10-23 的 1.3.2 修复快照重新通过离线回归、清单校验、alpha.3 fixture 与 rc.2 解包宿主的 host-smoke。使用现场已有 Playwright Core 1.63.0、Chrome 和 rc.2 前端静态库（React 18.3.1）完成离线浏览器回归：编辑／模拟宿主保存进入实际翻译、草稿还原、390px 布局、依赖消失禁用保存和样式清理均通过。没有访问生产 GUI 或进行生产 Profile 保存。

2026-10-25 复核当前官方桌面安装包（DeepSeek Harness，桌面壳 `@deepseek-ai/dsh-desktop` 与 Core 均为 `0.2.1-rc.3`）。rc.2→rc.3 的只读解析先校验 ASAR 头与条目 SHA256 完整性，再逐文件比对（rc.2 侧使用复核时保留的上一基线只读解包副本，副本未入库；本机该旧安装随后已不在，结论来自本次实测）：`@deepseek-ai/dsh-system-prompt`、`dsh-time-context`、`dsh-agent-instructions`、`dsh-tool-skill`、`dsh-agent-loop`、`dsh-scope`、`dsh-llm` 的 JS 内容未变（差异仅为 `package.json` 版本号与上游删除的 README／LICENSE 文件），因此既有 section／context 原文守卫与时间、工作区、技能目录译文无需改表。插件依赖的 `settings.configure`（`dsh-settings`）、`configEditor`（`dsh-config-editor`）、`connection.fetch.register`（`dsh-client-connection`）实现文件同样未变；`pluginPackages.packageOf(specifier, parentURL)` 签名与返回结构（`name`／`version`／`dir`／`manifestPath`／`manifest`）保持不变，`profileContext.resolvePackageManifest` 服务在 rc.2 与 rc.3 中均不存在，插件改用的 `packageOf` 解析路径继续适用。`dsh-app-boot` 在 `readProfilePatches` 中移除了 `context.readPatches` 短路，在 `manifestOf` 中移除了 `profileContext.resolvePackageManifest` 回退；这些分支都不在本插件调用路径上。把 ASAR 只读解包到工作区临时目录后运行 host-smoke：rc.3 宿主 ALL PASS（插件加载、assemble、时间注入、作用域监听、卸载／恢复与 `refreshContext` 边界）。使用现场 Playwright Core `1.64.0-alpha-1790635538000`、Chrome `155.0.8059.85` 与 rc.3 随包前端静态库（随包资源哈希已变更、React 18.3.1）完成同一套离线浏览器回归：编辑／模拟宿主保存进入实际翻译、草稿还原、390px 布局、依赖消失禁用保存与样式清理均通过。rc.3 移除了 `dsh-computer-use`、`dsh-experimental-computer-use-cua-driver-native` 等实验包，相应 CUA 译文只在匹配到原文时才生效；条目未删除，不影响其他已知文本。提取时验证归档完整性，未修改安装包；没有访问生产 GUI、没有做真实配置保存，也没有在生产 Profile 安装。

| 层级／包 | 先前基线 → 当前再核验 | 核验范围 |
| --- | --- | --- |
| Desktop 桌面壳 | `2.0.19-next` → `0.2.1-rc.3` | 当前运行进程来源与安装包 manifest；官方 DeepSeek Harness 安装包，不是 CLI 版本 |
| `@deepseek-ai/dsh`（Core） | 当前 `0.2.1-rc.3` | ASAR 中实际 Core manifest，与壳版本分开 |
| `@deepseek-ai/dsh-system-prompt` | `0.2.1-rc.2` → `0.2.1-rc.3` | JS 内容逐文件一致；真实模块组装、工具 schema 保留、`refreshContext` 覆盖边界 |
| `@deepseek-ai/dsh-time-context` | `0.2.1-rc.2` → `0.2.1-rc.3` | JS 内容逐文件一致；真实时间注入、已知与缺省时区 |
| `@deepseek-ai/dsh-scope` | 随对应 Core 解析（`0.2.1-rc.3`） | agent 作用域路由与子作用域隔离 |
| `@deepseek-ai/cordis` | `4.0.5`（rc.2／rc.3 相同） | 动态依赖、冻结消息、卸载／恢复、插件清理 |
| `@deepseek-ai/schemastery` | `3.18.5`（rc.2／rc.3 相同） | 保存值校验、动态占位符保护与客户端 JSON 重建 |
| `@deepseek-ai/dsh-web-frontend` | 当前 `0.2.1-rc.3` | 新资源哈希；rc.3 静态库已通过离线浏览器回归，覆盖编辑、保存进入真实翻译、草稿还原、窄屏布局与依赖卸载 |

**这些是具体包和桌面壳的版本，不是 DSH CLI 或 DSH 自带 npm 管理器版本。** 本轮不以 `dsh --version` 推断 Core，也未单独验证 CLI 发行版本。

当前工作区清单明确列出 `0.2.1-alpha.2`、`0.2.1-alpha.3`、`0.2.1-rc.2` 和 `0.2.1-rc.3`，核心译文条目的已核验版本元数据与之同步。其他 Core 版本不自动获得兼容验收结论；核心译文仍按原文守卫尝试翻译，不将版本元数据误作严格阻断门。现场 Git Bash 为 0.42.2、Hindsight 为 0.8.2，两者均已列入精确放行清单；MCP 已知 server 不依赖服务器版本，按原文守卫执行，未知 server 仍不翻译。以上不是生产 Profile 写入、全 provider 组合或所有新增英文文本的验收；本次未安装到生产 Profile，发布状态以 GitHub Release 和 npm registry 为准。

## 插件库兼容与固定来源复核

`engines.dsh`、`dsh.compatibility.dsh` 与逐版本 `dshReleases` 使用同一份已核验精确版本集合，避免市场把范围缺失误解为完全未声明兼容。发布前清单与设置回归会检查三者一致，不用宽泛范围冒充其他 Core 的验收。

DSH STORE 的固定源码策略还会识别文件与网络能力。本插件通过 Host 只读包 manifest 名称／版本，并由 Client 对已认证的固定同源诊断路径发 GET；配置保存使用宿主原生表单。这些是应如实审阅的功能，不为通过扫描而隐藏。商店目录更新、固定提交审阅与安装资格是独立步骤，GitHub／npm 发布成功不代表商店已恢复可安装；详见 [DSH STORE 规则](https://github.com/AI-Scarlett/DSH-Store/blob/main/registry/README.md)。

## 权限与数据边界

- Host 与 Client 物理隔离；原生设置页不使用浏览器存储代替 Profile 保存。
- 保存通过宿主原生配置表单完成；版本证据只读公开解析的包 manifest。诊断仅访问已认证的固定同源 GET，不向外部翻译服务发送提示词，不读账户凭据、不启动子进程。
- 消息翻译采用安全浅拷贝，保留身份和来源；无匹配时返回原消息数组，`reject` 决策原样透传。
- 精确命中的用户文本也可能被已有注入翻译器改写；它不是任意文本的语言隔离器。
- 没有工具时裁掉相关指引，但翻译插件不授予、扩大或代替宿主权限。

## 报告漏译

请提供脱敏后的英文原文、插件版本、目标 Profile／preset 和发生阶段。优先给最小片段，不上传密钥、Cookie、完整生产配置或未经脱敏的会话日志。可使用导出的纯函数先确认是“字典未命中”还是“运行链路未经过翻译”，见 [开发文档](development.md)。
