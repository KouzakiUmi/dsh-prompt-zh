# 1.3.2 适配、审查与发布前验证

[返回主页](../README.md) · [兼容性](compatibility.md) · [开发与验证](development.md) · [更新记录](../CHANGELOG.md)

本报告记录 2026-10-22 至 2026-10-23 的适配，以及后续独立核查发现的问题与修复。**版本发布状态以 GitHub Release 和 npm registry 为准；源码版本、测试通过和生产 Profile 生效是不同事实。** 本次没有更新生产 Profile 或重启宿主。

> 时点说明（2026-10-25）：以下内容保留 1.3.2 的验证记录。其后已复核 Core `0.2.1-rc.3` 并追加精确兼容声明；当前基线、证据与证据边界以 [兼容性与覆盖范围](compatibility.md) 和 [更新记录](../CHANGELOG.md) 为准。

## 1. 1.3.2 适配基线（历史）

| 层级／组件 | 已核验版本与范围 |
| --- | --- |
| Desktop 桌面壳 | 2.0.19-next；与 Core、CLI 分开记录 |
| Core | 0.2.1-rc.2；保留 alpha.2／alpha.3 的兼容声明与既有回归 |
| Cordis／Schemastery | 4.0.5／3.18.5；来自当前安装包 manifest |
| Web 前端 | Core 0.2.1-rc.2 随包静态库，React 18.3.1 |
| Git Bash | dsh-gitbash-shell 0.42.2；保留 0.39.0／0.39.4 回归 |
| Hindsight | @vectorize-io/hindsight-coding-agents 0.8.2；保留 0.8.1 已知包装 |
| MCP | blender、context7、github、playwright、chrome-devtools 按原文守卫；未知 server 不放行 |

工作区有 **239 条规则**，其中 MCP 94 条。匹配元数据为 pattern 162、literal 25、guarded-section 23、generated 19、prefix 6、derived 4；没有仅标记为 `section` 的条目。元数据标签不是守卫的执行证明，仍须检查实际分发与回归。

`engines.dsh`、`dsh.compatibility.dsh` 和 `dshReleases` 使用同一份已核验精确版本集合。Core 文本以原文守卫决定是否翻译；第三方 Git Bash／Hindsight 独立按精确版本门控，不将 Core 升级当作第三方放行证据。

## 2. 本次修复

### 2.1 系统提示词部分替换的巡检漏报

原巡检把“某英文片段发生过任何替换”当成整段已覆盖。例如一行时间说明后紧接一行未知英文，时间行被翻译便让严格模式返回 0。

修复后，回放仍有独立英文残留时继续计入待核对，同时保留已经命中的规则归因；不通过扩大整条来源白名单制造通过。完整大写指导不再被当成缩写逐词抹除；拼合快照的 section 归因按独立行保守回放，避免已知前缀吞掉下一行未知内容。分段、同段、部分替换、纯协议标识符和 CLI 严格退出码均有回归。

### 2.2 Hindsight 包装与正文分开核查

原巡检豁免整个 `plugin:hindsight` 来源，导致已知包装被版本门控阻止时仍显示通过。

现在按已核对的包装结构区分指导与任意记忆正文，核查已知包装及知识／刷新指导，保留正文不通用翻译的边界。不能把包装未翻译解释为“记忆正文按设计不翻译”。未知形态仍需人工复核，巡检不声称理解任意正文。

### 2.3 权限说明增加全文守卫

`subagent:delegation` 此前仍只按名称替换。现仅接受已核实的权限说明全文，语义变化或追加内容均保留原文。独立复核又发现 goal 可被轮数子串误触发；`tool:goal` 同样改用完整已知原文，仅轮数允许动态捕获。冷启动登记使用真实原文，既有条目 ID 与保存的覆盖值不迁移。

其他部分 section 仍使用前缀守卫，只能识别已知开头，无法证明后文语义未变；此限制不包装成全文一致性保证。

### 2.4 自定义译文与工具可见性保护

句子裁剪依赖内置译文片段；用户仅改自然语言措辞，也可能让旧裁剪失效。

现对带工具句子关联的段落，在关联工具不齐全时，本次渲染临时回退内置值再裁剪。保存值、条目 ID 和其他无关覆盖不变；关联工具齐全后继续使用自定义译文。状态接口和设置页记录内置回退次数，不把回退误称为已还原配置。

### 2.5 Blender 诊断计数

已中文化的 Blender 标题重入时，原实现仍用固定英文标题作为比较输入，造成输出不变却累加替换次数。

现在使用本次实际匹配标题计算变化；回归验证首次替换、重复处理及分阶段计数。输出变化信号仍只代表插件阶段，不证明最终请求完全中文化。

## 3. 延续的适配与加固

- 补齐 terminal／session-query、runtime-named checkout／Web GUI 等已知 Core 原文。
- 已知 MCP server 不再因缺少服务器版本证据而永久不可达；每条规则命中才翻译。
- 组合 MCP 按英文或中文服务器标题分块，不跨服务器套用译表；覆盖未知 server、禁用、CRLF 和重入。
- CUA 两条译文冷启动即登记，旧覆盖值有效，首次翻译不临时新增条目。
- Git Bash 0.42.2 的八项非 PTC 路由指导使用独立 fixture，核对实际安装副本原文，不替换旧 fixture。
- 保持 `interpolate=false` 的字面 PTC SDK 不变，不改工具名、参数 schema 或宿主冻结请求。
- zstd 按标准帧长度拆分并先合并解压字节再解码；损坏 JSON、缺少系统快照和截断帧明确失败。

## 4. 验证分层

| 验证项 | 入口与边界 |
| --- | --- |
| 离线回归与清单 | `npm run check`；包含新增守卫、计数、回退和巡检回归 |
| 语法检查 | `node --check`；运行时、脚本与测试入口 |
| 市场静态检查 | `node scripts/market-alignment-check.mjs`；不代替商店安装资格或独立安全审阅 |
| alpha.3 宿主隔离 | `node tests/host-smoke.mjs <alpha.3 fixture>` |
| rc.2 宿主隔离 | 当前 ASAR 只读解包副本；验证加载、assemble、时间注入、作用域、卸载／恢复与刷新覆盖边界 |
| 离线浏览器 | 已有 Playwright Core 1.63.0 和 Chrome；真实 React 编辑、模拟宿主表单保存进入翻译、草稿还原、390px 布局、依赖消失禁用保存与样式清理 |
| 打包 | `npm pack --ignore-scripts --json` 与 `prepare-release.mjs`；验证固定名称资产和分发边界 |

宿主测试只创建内存服务，不加载生产 Profile、凭据或真实 provider；浏览器使用隔离数据，不访问生产 GUI。诊断路由实际生产认证、生产 Profile 写入及全 provider 组合不在本次验收结论内。

## 5. 原始会话证据的保留边界

修复前的历史巡检记录为：最后系统快照 12,742 字符／62 段，MCP 回放后有 4 段英文可归因到 tool:pty、tool:session-query、harness:source 和 app:web-surface。其时已安装 1.3.1 有 226 条规则，工作区有 239 条。

**这不是修复后重读同一会话的结果。** 原始“未归因 0”来自存在部分替换漏报与整条来源豁免的旧判据，不能提升为当前覆盖率证明。发布前以固定回归、针对性反例和隔离宿主验证为证据；安装后还需要在目标 Profile 复核最终请求。

## 6. 插件库兼容

已核对 [DSH STORE 的固定源规则](https://github.com/AI-Scarlett/DSH-Store/blob/main/registry/README.md) 与 [Awesome DSH Plugins 贡献规则](https://github.com/white0dew/awesome-dsh-plugins/blob/main/CONTRIBUTING.md)。包名、仓库、MIT 许可证、Bundle 入口 `prompt-zh` 和原生 Host＋Client 形态保持不变；范围声明与精确版本声明同步。

DSH STORE 在本次核对时仍登记旧版 1.3.1 和旧固定提交，状态为 blocked／external-only，原因包括兼容范围缺失，以及文件、网络能力需专项审阅。版本解析的只读文件访问、同源诊断 GET 和原生配置保存均如实披露，不为通过扫描而隐藏。

**兼容字段补齐不自动解除能力复核。** 商店目录刷新、固定新提交审阅与恢复安装资格由商店独立决定；GitHub／npm 发布不代表商店已批准安装。

## 7. 仍保留的结构性边界

- `runtime-context` 在 `agent/pre-step` 后由宿主 `refreshContext` 重建，仍可能恢复英文；不 patch 宿主方法或私有 hook 绕过。
- 创建完成后新增的外层 `prepend`、provider／网关追加文本仍可能晚于本插件处理。
- 任意技能、记忆、知识正文、工具返回值与未知 MCP 不做通用翻译。
- 巡检是启发式归因，不是全文覆盖率；同行中英混排、短词、代码、动态值和原文守卫未识别的变化仍需人工核对。
- 本轮没有生产 Profile 安装、真实配置保存、模型调用或跨模型回复语言实验。

发布结果需分别核验 tag 对应提交、Actions、GitHub Release 固定资产、npm 精确版本、`latest` 和 provenance；不能仅凭推送退出码宣称已发布。
