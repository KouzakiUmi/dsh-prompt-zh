# 开发与验证

[返回主页](../README.md) · [覆盖范围](compatibility.md) · [更新记录](../CHANGELOG.md)

## 模块结构

| 文件 | 职责 |
| --- | --- |
| `lib/index.js` | 静态组装监听、section／context 翻译、句子级工具裁剪、网络／文件／委派策略；导出纯函数 |
| `lib/lifecycle.js` | 全局与 agent 作用域消息翻译接线、动态 `agents` 依赖、外部监听 disposer 的所有权 |
| `lib/injections.js` | 工作区指令、技能目录、时间／时区、Hindsight 等已知注入片段；消息安全浅拷贝 |
| `lib/mcp.js` | MCP 服务器指导说明的识别与中文化 |
| `cordis.patch.yml` | bundle 注册 `prompt-zh` Host 插件 |
| `tests/check.mjs` / `tests/lifecycle.mjs` | 离线回归、幂等、句子关联、委派解析、动态依赖与生命周期模拟 |
| `tests/host-smoke.mjs` | 可选的真实宿主隔离验证 |
| `scripts/check-manifest.mjs` | 清单、导出目标、patch 与发布字段校验 |
| `scripts/prepare-release.mjs` | 检查 npm pack 文件清单，并复制固定名称的 Release 资产 |

纯 JavaScript ESM，无构建步骤或额外运行依赖；Node.js `>=18`。修改前核对目标宿主实际导出的契约，不把通用 Cordis 或最新版文档直接套到旧宿主。

## 设计约束

- 已知规则才改写；保留工具名、代码、schema 和动态值。不添加联网翻译服务。
- 委派句式只维护一个解析器，由识别、移除英文、插入锚点和生成中文策略共用。
- 先执行长匹配再执行包含其中的短匹配，避免完整基线被提前替换导致漏译。
- 不修改冻结请求，不 patch 宿主方法，不操作私有 hook 列表。
- `agent.ctx` 注册不自动属于本插件；把返回的 disposer 保存在本插件自身的 `effect` 中，同时处理 agent 注销。
- 动态依赖通过 `ctx.inject(['agents'], ...)` 管理；不只在启动时 `ctx.get` 一次。

## 离线检查

在源码克隆中运行：

```powershell
npm test
npm run check
node scripts/market-alignment-check.mjs
```

`npm test` 运行翻译断言与生命周期模拟；`npm run check` 追加发布清单检查。兼容入口 `node check.mjs` 与 CI 使用同一套测试。市场检查是有界静态扫描，不等于商店已收录或完整安全审计。

源码是 JavaScript，语法检查使用 `node --check`；没有 TypeScript 构建配置，不额外安装编译器来虚构类型检查结果。

## 真实宿主契约验证

```powershell
node tests/host-smoke.mjs "<宿主 app 根目录>"
```

脚本从该目录解析实际的 `@deepseek-ai/cordis`、`dsh-scope`、`dsh-system-prompt`、`dsh-llm` 和 `dsh-time-context`。只创建内存服务和作用域，不加载生产 Profile、不读凭据、不启动服务器、不调用模型。

验证项：

- 插件真实加载，已知身份与新版多工具委派规则进入中文组装结果。
- 工具 description 保持原文；上下文翻译会被 `refreshContext` 覆盖，明确验证未解决边界。
- 插件先加载、preset 后注册时，旧全局接线漏译；初始化后的作用域接线修复该顺序。
- 已有／新建 agent、真实时间插件、缺省／已知时区、子作用域路由与冻结消息。
- `agents` 卸载／恢复、插件卸载时，对外部 `agent.ctx` 监听器的清理。

本轮基线与生产验收状态见 [兼容性文档](compatibility.md)。此脚本不自动进入公共 CI，因为 CI 没有桌面宿主安装目录。

## 定位某个英文片段

发布包导出纯函数，npm 安装者也可以调用；测试目录不随 npm 包发布。

```js
import { translate, translateInjectedText } from 'dsh-prompt-zh'

console.log(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.'))
console.log(translateInjectedText('Elapsed since the preceding step context: unavailable.'))
```

如果纯函数能翻译但模型收到英文，检查注入点、注册时机、来源与宿主后续重建；不要继续堆同一句的字典。若原文变化，保留原文并为已核实的新规则补测试。

## 打包与发布

现有 `.github/workflows/release.yml` 只由 `v*` tag 推送触发：

1. 校验 tag 等于 `package.json` 的 `v<version>`。
2. 清单检查、离线回归；`npm pack --ignore-scripts` 生成发布包。
3. `prepare-release.mjs` 验证文件清单；拒绝测试、CI、node_modules 泄漏。
4. 发布固定资产名 `dsh-prompt-zh.tgz` 的 GitHub Release。
5. `publish-npm` 在 `npm` environment 内，通过 Trusted Publisher／OIDC 发布 public npm 包，并附 provenance。

**推送 main 本身不发布；GitHub Release 成功也不代表 npm job 成功。** 发布后分别核验 workflow、Release 资产、npm 版本及 `latest` 标签，不绕过 environment 审批或权限。

发布包包括 `lib`、`icon.svg`、patch、许可证、README、更新记录、文档和横幅；测试与开发脚本仅留在仓库。文档相对链接的目标随包携带，README 图片使用仓库 main 的 raw URL。

本地预检（只落盘到当前仓库，不发布）：

```powershell
npm pack --ignore-scripts --json > pack.json
node scripts/prepare-release.mjs
```

执行前确认现有产物与路径。版本、提交、tag 和远端推送都应针对当前这次发布单独授权；测试通过不等于授权发布，也不授权更新生产 Profile。
