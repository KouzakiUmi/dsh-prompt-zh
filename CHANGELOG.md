# 更新记录

[返回主页](README.md) · [GitHub Releases](https://github.com/KouzakiUmi/dsh-prompt-zh/releases)

发布状态以 GitHub Release 和 npm registry 为准；本文件与 main 的版本字段不自动证明该版本已发布。以下历史条目根据仓库提交与既有说明整理，不是逐版本重新验收。

## 未发布

暂无。

## 1.3.6 — 2026-10-31

- 追加 `0.2.1-rc.4` 精确兼容声明：`engines.dsh`、`dsh.compatibility.dsh`、`dshReleases` 与五个核心组件版本元数据（`core`、`workspace`、`skills`、`time`、`context`）同步更新。
- 本轮验收环境为 dsh-go 手机 App 本机引擎（bridge 0.4.0，Core `0.2.1-rc.4`，Node 24.22.1，`dshPatches` 为 fs-create-exclusive／route-guard／zz-direct-runtime）。只读核对确认 go 侧没有独立提示词系统：`/opt/dsh-go` 与 dsh-go-bridge 均不含 `system-prompt`／`assemble`／`pre-step` 接入，手机提示词走同一套 Core 管线加同一份 `~/.dsh/AGENTS.md`。
- 用该宿主自身导出的 `evaluatePluginCompatibility` 判定 `1.3.6` 清单为 compatible；`tests/host-smoke.mjs /opt/dsh` 在该 rc.4 宿主上 ALL PASS（插件真实加载、assemble、时间注入、作用域监听、卸载／恢复与 `refreshContext` 边界）。
- 未在本轮做：rc.4 与 rc.3／rc.5 的逐文件 SHA256 对照、设置页浏览器回归、生产 Profile 的真实配置保存验收。新增译文条目（`tool:read`／`tool:write`／`tool:edit`／`tool:glob`／`tool:grep`／`tool:web_search`／`tool:web_fetch`／`mcp-resource-servers`）按既有原文守卫执行，未在 go 实机会话中逐条验收。

## 1.3.5 — 2026-10-30

- 追加 `0.2.1-rc.5` 精确兼容声明：`engines.dsh`、`dsh.compatibility.dsh`、`dshReleases` 与五个核心组件版本元数据（`core`、`workspace`、`skills`、`time`、`context`）同步更新；兼容指宿主接口与既有规则回归通过，不表示新版新增的每条英文都有译文。更新 README 与兼容性文档版本列表。

## 1.3.4 — 2026-10-25

- 修复运行时上下文快照在宿主 `refreshContext` 重建后恢复英文：assemble 阶段命中译文的 context 条目改挂 `prompt-zh:*` 自有名字，宿主重建时 `providers.get(name)` 为空，译文保留。覆盖文件策略、审批策略、Subagent 委派、实现目录、Web GUI URL 与 Git Bash POSIX 指导。
- 新增 `harness:source`、`app:web-surface` 的上下文措辞译文（与同名 section 措辞不同，各自按原文守卫）；冷启动登记同步。
- 已核实边界：快照标题句由宿主 `joinContextSections` 拼接固定英文常量；`working-directory:current` 与 `team:identity` 为 `required: true`，改名会被宿主按原名补回英文条目并重复出现，因此仍为英文。
- 核验并放行 `dsh-gitbash-shell 0.43.2`：逐条比对当前 Profile 实际安装副本，11 条原文与既有基线一致；0.42.2 的破折号变体在新版已移除，该条只保留 0.42.2 登记。新增 `tests/fixtures/gitbash-0.43.2.json`，并断言未列版本 `0.43.1` 保留原文。
- 设置页刷新提示改为重建说明（译文保留、标题与 required 边界）；`context:file-reference` 的覆盖标记按当前宿主形态（系统提示 section）改回 `plugin-stage`；巡检中的 `runtime-context` 边界说明同步。
- 验证：离线回归新增运行时上下文与 Git Bash 0.43.2 断言；rc.3 解包宿主 host-smoke 增加 `refreshContext` 后译文保留、required 不重复与最终快照断言。已在 desktop Profile 安装本版本（托管 `dsh plugin add` 因宿主 CLI 的 crashpad 崩溃不可用，改用随包 node 驱动同一 pnpm 完成，spec 暂为本地 tarball 的 file:）；重启宿主后的界面验收与模型调用验收未做。

## 1.3.3 — 2026-10-25

- 复核官方 DeepSeek Harness 桌面安装包 `0.2.1-rc.3`（随包 Core `0.2.1-rc.3`）并新增精确兼容声明：`engines.dsh`、`dsh.compatibility.dsh`、`dshReleases` 与五个核心译文的版本元数据同步为 `0.2.1-alpha.2`、`0.2.1-alpha.3`、`0.2.1-rc.2`、`0.2.1-rc.3`，保留 alpha.2／alpha.3／rc.2。
- rc.2→rc.3 对照（npm registry 发布包，只读下载、内存解包、逐文件 SHA256）：`dsh-system-prompt`、`dsh-time-context`、`dsh-agent-instructions`、`dsh-tool-skill`、`dsh-agent-loop`、`dsh-scope`、`dsh-llm`、`dsh-settings`、`dsh-config-editor`、`dsh-client-connection`、`dsh-app-boot` 仅 `package.json` 版本号不同，无新增或删除文件；桌面 ASAR 缺少 README／LICENSE 属安装包打包裁剪。`pluginPackages.packageOf(specifier, parentURL)` 签名与返回结构保持，`profileContext.resolvePackageManifest` 服务在 rc.2 与 rc.3 中均不存在。
- rc.3 只读解包宿主运行 host-smoke 为 ALL PASS；rc.3 随包前端静态库（随包资源哈希已变更，React 18.3.1）通过同一套离线浏览器回归。rc.3 桌面随包未包含 `dsh-computer-use` 等实验包（npm 上仍有对应 rc.3 版本），相应 CUA 译文只在原文命中时生效，条目不删除。
- 版本解析改用宿主 `pluginPackages.packageOf` 已解析记录的 `name`/`version`，运行时不再读取任何文件；旧的 `profileContext.resolvePackageManifest` 路径在已声明的全部核心版本（alpha.2/alpha.3/rc.2/rc.3）宿主中并不存在，测试桩同步改为 `pluginPackages` 并删除孤儿 package-meta fixture。

## 1.3.2 — 2026-10-23

- 修复系统提示词巡检的部分替换漏报：回放后仍存在的独立英文片段继续计入待核对，不能因同段中其他句子被替换而通过严格模式；完整大写指令不再被当作缩写删除，section 归因按独立行保守回放。
- 收紧 goal 原文守卫，防止轮数子串误触发整段替换；无标签 Hindsight 包装按原始上下文回放后再提取残留，避免丢失标记造成误报。
- Hindsight 巡检区分包装指导与记忆／知识正文；已知包装被版本门控阻止不再被整条来源白名单豁免。
- `subagent:delegation` 权限说明增加已核实全文守卫，输入漂移或追加语义时保留原文；保留既有规则 ID 与冷启动覆盖值。
- 工具关联段落的自定义译文在关联工具缺失时临时回退内置值再裁剪；不改保存值，工具齐全时恢复使用覆盖值，诊断单列回退次数。
- 修复 Blender 已中文化标题重入时输出不变却累加替换次数；修正浏览器测试的硬编码条目数。
- 补齐 DSH STORE 使用的 `engines.dsh`／`dsh.compatibility.dsh` 精确范围，并与逐版本兼容声明保持一致；文件只读解析和同源诊断能力如实披露，商店安装资格仍由其固定源码复核决定。
- 保留旧 Git Bash fixture，独立覆盖 0.42.2 的八项路由／原生通道指导及精确版本门控。

- 修复 CUA 原文守卫阻断静态登记的问题，恢复两条桌面操作译文在冷启动目录和保存值校验中的可用性；新增先于任何翻译调用执行的冷启动回归。
- MCP 全文扫描按英文或已中文化的服务器标题划分区块，防止已知服务器译表误改未知或其他服务器正文；覆盖混合区块、禁用开关、CRLF 和重入。
- 加固覆盖巡检：`--json --strict` 正确返回非零；无系统消息、损坏 JSON、截断压缩帧停止巡检而非假通过；按标准帧长度拆分 zstd，并在合并字节后解码 UTF-8。归因使用实际回放结果，排除明确标记的用户输入，检测混合语言消息中的独立英文行；补充固定回归并明确启发式限制。
- 巡检归因口径修正：MCP 区块之后的宿主段落不再计入该服务器的未译残留；会话压缩摘要、模型切换通知和 Hindsight 知识页正文列为已知边界，使 `--strict` 在真实会话上可作为可用判据。
- 新增 [本轮适配与加固报告](docs/audit-report.md)，记录改动依据、真实会话巡检结果、验证证据与未验证项。

- 补齐剩余 section 条目的原文守卫：`context:file-reference`、`tool:bash`、`tool:pwsh`、`tools:ptc-only`、`tool:ralph`、`team:policy`（休眠的 `tool:structured_output` 按保守前缀）以及 `computer-use:cua-driver-native` 分支。此前这些条目只按 section 名信任替换；现在统一为原文特征命中才替换、不匹配则保留原文。前缀守卫并非全文一致性校验，开头未变的后续语义漂移仍需人工复核。测试改用宿主真实原文，并新增“漂移保留／命中翻译”断言。
- MCP 已知 server（`blender`、`context7`、`github`、`playwright`、`chrome-devtools`）改为按原文守卫放行：不再要求服务器版本基线，命中才替换、未命中的原文保持英文；未知 server 的标题与正文仍不翻译，不把 MCP 客户端版本当作服务器版本。此前这些译文因版本不可核验而永不执行。
- 新增 `scripts/audit-coverage.mjs`（`npm run audit:coverage`）：只读最近一次会话，列出仍为英文的提示词段、可归因规则与已知边界（宿主刷新覆盖、工具返回值、技能正文），`--strict` 在有未归因项时失败。
- 在 Desktop 2.0.19-next／Core `0.2.1-rc.2` 的当前 ASAR 上再复核：新增 rc.2 精确兼容声明并同步核心译文版本元数据，保留 alpha.2／alpha.3；cordis `4.0.5`、schemastery `3.18.5` 按实际 manifest 记录。
- 在 Desktop 2.0.18-next 的当前 ASAR 静态 SDK 上复核宿主与设置页契约，新增 Core `0.2.1-alpha.3` 精确兼容声明；同步核心译文版本元数据，保留 alpha.2。
- 用真实会话原文复核 rc.2 措辞：`tool:pty`、`tool:session-query`、`harness:source`、`app:web-surface` 均可命中；Git Bash `0.42.2` 的工具附加指导与 Hindsight `0.8.2` 的记忆／知识页／刷新包装在实机原文上全量替换。
- 把 ASAR 只读解包到临时目录后运行 host-smoke：rc.2 宿主与 alpha.3 fixture 均 ALL PASS；确认宿主 `profileContext` 不含 `resolvePackageManifest`，第三方版本改由 `pluginPackages.packageOf` 解析（插件既有回退路径）。
- 浏览器隔离测试按实际唯一前端资源与内置库映射取样，不再固定旧资源哈希；兼容表与核心条目版本增加一致性回归。
- 兼容不表示新增英文已全量覆盖，也不代表生产 Profile 写入已验收。

## 1.3.1

- 修复与 dsh-tool-discovery 的 PTC SDK 校验冲突：组装时保留 interpolate=false 的 tools:sdk 原文，避免局部翻译使出站文本与披露快照失配。其他提示词继续中文化。
- 新增回归检查，覆盖 literal SDK 保留及其他 PTC 提示词的正常翻译。

## 1.3.0 — 2026-10-14

- 新增原生设置页：每个内置译文独立条目，展示区块、精确版本、匹配方式与插件阶段计数；不允许新增或编辑原文匹配规则。
- 自定义保存值由实际替换函数读取，支持组件开关、当前 Profile 原生保存和修订号冲突保护；还原仅改草稿，保存后才写入。
- 第三方严格版本门控：未核验或版本不符保留原文；MCP 缺乏服务器版本证明时停译，不使用客户端版本代替。
- 诊断走宿主已认证 Connection GET，不保留会话正文、动态捕获值或完整提示词；刷新覆盖条目不标最终请求生效。

- 新增本轮 Blender MCP 全文指导的中文化：随附手册、代码执行、场景／数据块、对象创建、变换／坐标空间；按 Blender 区块隔离，保留 API 标识符及未知段落。
- 新增 Git Bash 完整／严格 MSYS 路径说明、旧版 `run_code` 提示、0.39.4 的转换开启／关闭分支、pwsh 可见／隐藏路由和 MSYS 附加说明译文。
- 新增工具说明的最小例外：只中文化 `bash` description 中匹配的已知附加指导，通用说明、其他工具及参数 schema 保持原文；支持冻结输入和无匹配零分配。
- 通过既有 assemble／pre-step 管线接入，补全文、区块隔离、未知输入、幂等、注册顺序和宿主隔离回归。
- 仍保留运行时边界：Core 在翻译后重建 context，`gitbash-shell:posix-paths` 最终快照仍可能恢复英文；未修改宿主或来源插件，不将译表覆盖表述为最终请求全量中文化。

## 1.2.6 — 2026-10-12

### 修复

- 保留全局 `agent/pre-step` 兜底，并在 `agent/created` 后注册 agent 作用域的 `prepend` 翻译监听器，修复 preset 后挂载的时间注入漏译。
- 动态接入 `agents`，回补已有 agent；重复通知不重复注册；agent、依赖及插件卸载时清理外部监听器。
- 新旧委派句式共用解析器，支持一条规则中的多个委派工具、去重和可见性裁剪。
- 补齐浏览器时区不可用／混合时区、耗时不可用，以及工作区指令更新包装的中文化。
- 完整工作区基线优先于其通用短句匹配，修复长规则永远无法命中的替换顺序。

### 验证与文档

- 新增生命周期模拟回归和可选真实宿主隔离测试；验证真实插件组装、time-context、作用域隔离、冻结消息及卸载／恢复。
- 主页改为横幅、效果说明、安装入口和独立文档导航；拆出覆盖边界、开发与发布说明。
- 明确未解决的 runtime-context 后续重建、晚注册外层注入和宿主外部系统消息边界；不宣称最终请求全量中文化。
- 本轮隔离测试基线为 Desktop 壳 `2.0.17-next` 随包 Core 模块 `0.2.1-alpha.2`、Cordis `4.0.5-alpha.1`，未在当前生产 Profile 安装验收。

## 1.2.5

首次将运行时注入翻译接入全局 `agent/pre-step`，使用 `prepend`；新增接线、reject 透传和重入幂等测试。全局加载顺序仍不足以覆盖随后挂载的 preset，后续在 1.2.6 修复。

## 1.2.4

补充 MIT LICENSE、Node engines、DSH 兼容声明和安装说明；测试逻辑归入 `tests/`，保留兼容入口。

## 1.2.3

输入特征保守守卫、Hindsight 大小写不敏感守卫，以及无 `read` 时的文件策略裁剪修复。

## 1.2.2

移除尝试改写冻结请求的 `llm/stream` 钩子，保留合法提示词组装入口。

## 1.2.1

完善 MCP 正则匹配、全文扫描与组合提示词中文化。

## 1.2.0

增加 MCP 服务器指导说明翻译及已知运行时注入片段译文。

## 1.1.0

建立系统提示词 section／context 中文化、句子级工具关联判断、按可见工具组装策略及离线自检。
