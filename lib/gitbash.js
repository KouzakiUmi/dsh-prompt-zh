// 已核实的 dsh-gitbash-shell 自然语言附加说明：0.39.0 / 0.39.4 / 0.42.2。
// 只替换已知原文；不改变路径、变量、工具名称或参数结构。
// 0.42.2 起路由指导整体重写（bash/pwsh 分工、原生通道、持久终端方言），按版本逐条登记。
// 与 PTC（`run_code` / `tools:sdk`）相关的指导条目保持原状：宿主用披露快照校验该字面 SDK，
// 任何改写都可能让 PTC 模式不可用，因此这里既不新增也不扩版本。
import { defineRule, renderRule, componentEnabled } from './rules.js';

// [原文, 译文, 适用版本, 覆盖标注]
const TEXT = [
  [
    'The working shell is Git for Windows bash: paths use MSYS drive roots (/c/Users/...), and every tool accepts that form directly — including the bash-native habits (~ home shorthand, /tmp, /dev/null, /usr/bin/...), which resolve in every tool exactly as bash itself resolves them.',
    '当前工作 shell 为 Git for Windows bash：路径使用 MSYS 盘根形式（/c/Users/...），所有工具均直接接受该形式；包括 bash 原生习惯写法（~ 主目录缩写、/tmp、/dev/null、/usr/bin/...），它们在各工具中的解析方式与 bash 自身一致。',
    ['0.39.0', '0.39.4', '0.42.2'], 'assemble-refresh-warning'
  ],
  [
    'The working shell is Git for Windows bash: paths use MSYS drive roots (/c/Users/...), and every tool accepts that form directly.',
    '当前工作 shell 为 Git for Windows bash：路径使用 MSYS 盘根形式（/c/Users/...），所有工具均直接接受该形式。',
    ['0.39.0', '0.39.4', '0.42.2'], 'assemble-refresh-warning'
  ],
  [
    'Path literals written inside a run_code program are translated the same way before the program runs; shell expansion is not available there, so spell paths out instead of relying on $VARS.',
    'run_code 程序中的路径字面量会在运行前以相同方式转换；程序内没有 shell 展开，因此应显式写出路径，不要依赖 $VARS。',
    ['0.39.0'], 'assemble-refresh-warning'
  ],
  [
    'Path literals written inside a run_code program are translated before the program runs.',
    'run_code 程序中的路径字面量会在程序运行前转换。',
    ['0.39.0'], 'assemble-refresh-warning'
  ],
  [
    'In a run_code program, compatible plain MSYS path literals are translated on a best-effort basis; interpolated or tagged templates and uncertain syntax are not rewritten. For direct native Node fs/path APIs, prefer explicit Windows drive-letter or cwd-relative paths. Do not rely on literal rewriting for dynamic paths, shell command strings, routes or search data; tool path arguments are translated separately. Shell expansion is unavailable in program strings, so do not rely on $VARS.',
    '在 run_code 程序中，兼容的普通 MSYS 路径字面量会尽力转换；含插值的模板、标签模板及不确定的语法不会改写。直接使用 Node 原生 fs/path API 时，优先使用明确的 Windows 盘符路径或相对于 cwd 的路径。对于动态路径、shell 命令字符串、路由或搜索数据，不要依赖字面量改写；工具的路径参数会单独转换。程序字符串没有 shell 展开，因此不要依赖 $VARS。',
    ['0.39.4'], 'assemble-refresh-warning'
  ],
  [
    'In a run_code program, automatic path-literal rewriting is OFF. Direct native Node fs/path APIs require Windows drive-letter or cwd-relative paths, not MSYS /c/... strings. Tool path arguments are still translated separately; program strings do not perform shell expansion.',
    '在 run_code 程序中，路径字面量自动改写已关闭。直接使用 Node 原生 fs/path API 时，需要 Windows 盘符路径或相对于 cwd 的路径，不能使用 MSYS /c/... 字符串。工具的路径参数仍会单独转换；程序字符串不会进行 shell 展开。',
    ['0.39.4'], 'assemble-refresh-warning'
  ],
  [
    'Path dialect for tool calls and tool results: MSYS drive roots (/c/Users/...) plus the bash-native mounts (~, /tmp, /dev/null, /usr); every tool accepts these forms directly.',
    '工具调用与结果的路径方言：MSYS 盘根（/c/Users/...）及 bash 原生挂载写法（~、/tmp、/dev/null、/usr）；所有工具均直接接受这些形式。',
    ['0.39.0', '0.39.4', '0.42.2'], 'plugin-stage'
  ],
  [
    'Prefer this bash tool for ALL commands; use the pwsh tool ONLY when a Windows-native capability (cmdlets, registry, services, WMI) is truly required.',
    '所有命令优先使用此 bash 工具；只有确实需要 Windows 原生能力（cmdlet、注册表、服务、WMI）时才使用 pwsh 工具。',
    ['0.39.0', '0.39.4'], 'plugin-stage'
  ],
  [
    'Fix failed bash commands in bash — never switch shells mid-task, never embed `pwsh -Command` inside a bash command (variable expansion and output encoding break there).',
    '在 bash 中修正失败的 bash 命令；绝不在任务中途切换 shell，也不要在 bash 命令中嵌入 `pwsh -Command`（这会破坏变量展开和输出编码）。',
    ['0.39.0', '0.39.4'], 'plugin-stage'
  ],
  [
    "Prefer this bash tool for ALL commands — it is this host's shell.",
    '所有命令优先使用此 bash 工具——它就是本机的 shell。',
    ['0.39.0', '0.39.4'], 'plugin-stage'
  ],
  [
    'Fix failed commands in bash; there is no PowerShell tool on this host.',
    '在 bash 中修正失败的命令；本机没有 PowerShell 工具。',
    ['0.39.0', '0.39.4'], 'plugin-stage'
  ],
  [
    'This bash is Git for Windows (MSYS): paths use drive roots (/c/Users/...), and ~, /tmp, /dev/null and /usr/... resolve exactly as Git Bash resolves them.',
    '此 bash 为 Git for Windows（MSYS）：路径使用盘根形式（/c/Users/...），~、/tmp、/dev/null 和 /usr/... 的解析方式与 Git Bash 完全一致。',
    ['0.39.0', '0.39.4', '0.42.2'], 'plugin-stage'
  ],
  // ── 0.42.2 重写后的 bash 侧路由指导（不含 run_code 分支）────────────────
  [
    'Prefer this bash tool for shell syntax, scripts, pipelines, redirection, globbing and POSIX utilities; use the pwsh tool ONLY when PowerShell cmdlets, registry, services or WMI are truly required.',
    'shell 语法、脚本、管道、重定向、通配符和 POSIX 工具优先使用此 bash 工具；只有确实需要 PowerShell cmdlet、注册表、服务或 WMI 时才使用 pwsh 工具。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    'Fix failed bash syntax in bash; never embed `pwsh -Command` inside a bash command as a workaround (variable expansion and output encoding break there). Choose a separately offered native route for its documented purpose before execution, never as a policy-denial retry.',
    '在 bash 中修正失败的 bash 语法；绝不要在 bash 命令中嵌入 `pwsh -Command` 作为变通（变量展开和输出编码在那里会失效）。执行前就按各自文档用途选择单独提供的原生通道，绝不要把它当作策略拒绝后的重试手段。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    "Prefer this bash tool for shell syntax, scripts, pipelines, redirection, globbing and POSIX utilities — it is this host's shell.",
    'shell 语法、脚本、管道、重定向、通配符和 POSIX 工具优先使用此 bash 工具——它就是本机的 shell。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    'Fix failed bash syntax in bash; no PowerShell tool is offered here. Do not invent a hidden tool or embed another interpreter as a workaround.',
    '在 bash 中修正失败的 bash 语法；本机不提供 PowerShell 工具。不要臆造隐藏工具，也不要用其他解释器作为变通。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    'The persistent terminal tools (terminal_open/read/send/...) run Git Bash (MSYS) on this host: the same drive-root paths (/c/...) and MINGW64 semantics as this bash tool; they are NOT PowerShell.',
    '在此主机上，持久终端工具（terminal_open/read/send/...）运行的是 Git Bash（MSYS）：与此 bash 工具相同的盘根路径（/c/...）和 MINGW64 语义；它们不是 PowerShell。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    'Use gitbash_native before execution when a Windows .exe needs exact literal argv such as /all or /c without MSYS conversion, or independently declared stdout/stderr encodings. Supply an absolute executable, mark each argument literal or path, and select only a known encoding (raw for unknown/mixed bytes). It does not implement shell pipelines, expansion or .cmd/.bat wrappers; only resolved danger-full-access can execute it.',
    '当 Windows .exe 需要未经 MSYS 转换的精确字面 argv（如 /all 或 /c），或需要独立声明 stdout/stderr 编码时，在执行前使用 gitbash_native。提供绝对可执行文件路径，把每个参数标记为字面值或路径，并且只选择已知编码（未知或混合字节用 raw）。它不实现 shell 管道、展开或 .cmd/.bat 包装；只有解析为 danger-full-access 时才能执行。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    'Use gitbash_to_native_path only for a complete caller-declared MSYS filesystem path that a native Node fs/path API needs, especially a runtime-built value. Read native_path from the result. Never convert routes, search strings or shell/program source. Already-native or cwd-relative Node paths need no conversion; ordinary tool path fields already use their own translation. Conversion grants no access.',
    '仅当原生 Node fs/path API 需要调用方声明的完整 MSYS 文件系统路径（尤其是运行时生成的值）时，才使用 gitbash_to_native_path。从结果中读取 native_path。绝不要转换路由、搜索字符串或 shell/程序源码。已经是原生形式或相对于 cwd 的 Node 路径无需转换；普通工具路径字段使用各自的转换。转换本身不授予任何访问权限。',
    ['0.42.2'], 'plugin-stage'
  ],
  [
    'Choose the execution route before running. A policy/access denial is a stop condition: never switch tools, shells or permissions to bypass it. A decoding/display failure does not mean the command failed to run; preserve its exit facts and never blindly repeat a side-effecting command. Do not guess unknown or mixed encodings.',
    '运行前先选择执行通道。策略/访问拒绝是停止条件：绝不要通过切换工具、shell 或权限来绕过。解码/显示失败不代表命令未运行；保留其退出事实，绝不要盲目重复有副作用的命令。不要猜测未知或混合编码。',
    ['0.42.2'], 'plugin-stage'
  ]
];

const RULES = TEXT.map(([source, localized, versions, coverage]) => ({
  source,
  rule: defineRule('gitbash', source, localized, { versions, coverage })
}));

export function translateGitBashText(text, runtime) {
  if (typeof text !== 'string' || !text || !componentEnabled(runtime, 'gitbash')) return text;
  return RULES.reduce((value, { source, rule }) => value.replaceAll(source, (match) => renderRule(rule, [], runtime, match)), text);
}

export function translateToolGuidance(tools, runtime) {
  if (!Array.isArray(tools)) return tools;
  let modified = false;
  const result = tools.map((tool) => {
    if (!tool || tool.name !== 'bash' || typeof tool.description !== 'string') return tool;
    const description = translateGitBashText(tool.description, runtime);
    if (description === tool.description) return tool;
    modified = true;
    return { ...tool, description };
  });
  return modified ? result : tools;
}
