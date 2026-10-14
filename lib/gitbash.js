// 已核实的 dsh-gitbash-shell 0.39.0 / 0.39.4 自然语言附加说明。
// 只替换已知原文；不改变路径、变量、工具名称或参数结构。
import { defineRule, renderRule, componentEnabled } from './rules.js';
const TEXT = [
  [
    'The working shell is Git for Windows bash: paths use MSYS drive roots (/c/Users/...), and every tool accepts that form directly — including the bash-native habits (~ home shorthand, /tmp, /dev/null, /usr/bin/...), which resolve in every tool exactly as bash itself resolves them.',
    '当前工作 shell 为 Git for Windows bash：路径使用 MSYS 盘根形式（/c/Users/...），所有工具均直接接受该形式；包括 bash 原生习惯写法（~ 主目录缩写、/tmp、/dev/null、/usr/bin/...），它们在各工具中的解析方式与 bash 自身一致。'
  ],
  [
    'The working shell is Git for Windows bash: paths use MSYS drive roots (/c/Users/...), and every tool accepts that form directly.',
    '当前工作 shell 为 Git for Windows bash：路径使用 MSYS 盘根形式（/c/Users/...），所有工具均直接接受该形式。'
  ],
  [
    'Path literals written inside a run_code program are translated the same way before the program runs; shell expansion is not available there, so spell paths out instead of relying on $VARS.',
    'run_code 程序中的路径字面量会在运行前以相同方式转换；程序内没有 shell 展开，因此应显式写出路径，不要依赖 $VARS。'
  ],
  [
    'Path literals written inside a run_code program are translated before the program runs.',
    'run_code 程序中的路径字面量会在程序运行前转换。'
  ],
  [
    'In a run_code program, compatible plain MSYS path literals are translated on a best-effort basis; interpolated or tagged templates and uncertain syntax are not rewritten. For direct native Node fs/path APIs, prefer explicit Windows drive-letter or cwd-relative paths. Do not rely on literal rewriting for dynamic paths, shell command strings, routes or search data; tool path arguments are translated separately. Shell expansion is unavailable in program strings, so do not rely on $VARS.',
    '在 run_code 程序中，兼容的普通 MSYS 路径字面量会尽力转换；含插值的模板、标签模板及不确定的语法不会改写。直接使用 Node 原生 fs/path API 时，优先使用明确的 Windows 盘符路径或相对于 cwd 的路径。对于动态路径、shell 命令字符串、路由或搜索数据，不要依赖字面量改写；工具的路径参数会单独转换。程序字符串没有 shell 展开，因此不要依赖 $VARS。'
  ],
  [
    'In a run_code program, automatic path-literal rewriting is OFF. Direct native Node fs/path APIs require Windows drive-letter or cwd-relative paths, not MSYS /c/... strings. Tool path arguments are still translated separately; program strings do not perform shell expansion.',
    '在 run_code 程序中，路径字面量自动改写已关闭。直接使用 Node 原生 fs/path API 时，需要 Windows 盘符路径或相对于 cwd 的路径，不能使用 MSYS /c/... 字符串。工具的路径参数仍会单独转换；程序字符串不会进行 shell 展开。'
  ],
  [
    'Path dialect for tool calls and tool results: MSYS drive roots (/c/Users/...) plus the bash-native mounts (~, /tmp, /dev/null, /usr); every tool accepts these forms directly.',
    '工具调用与结果的路径方言：MSYS 盘根（/c/Users/...）及 bash 原生挂载写法（~、/tmp、/dev/null、/usr）；所有工具均直接接受这些形式。'
  ],
  [
    'Prefer this bash tool for ALL commands; use the pwsh tool ONLY when a Windows-native capability (cmdlets, registry, services, WMI) is truly required.',
    '所有命令优先使用此 bash 工具；只有确实需要 Windows 原生能力（cmdlet、注册表、服务、WMI）时才使用 pwsh 工具。'
  ],
  [
    'Fix failed bash commands in bash — never switch shells mid-task, never embed `pwsh -Command` inside a bash command (variable expansion and output encoding break there).',
    '在 bash 中修正失败的 bash 命令；绝不在任务中途切换 shell，也不要在 bash 命令中嵌入 `pwsh -Command`（这会破坏变量展开和输出编码）。'
  ],
  [
    "Prefer this bash tool for ALL commands — it is this host's shell.",
    '所有命令优先使用此 bash 工具——它就是本机的 shell。'
  ],
  [
    'Fix failed commands in bash; there is no PowerShell tool on this host.',
    '在 bash 中修正失败的命令；本机没有 PowerShell 工具。'
  ],
  [
    'This bash is Git for Windows (MSYS): paths use drive roots (/c/Users/...), and ~, /tmp, /dev/null and /usr/... resolve exactly as Git Bash resolves them.',
    '此 bash 为 Git for Windows（MSYS）：路径使用盘根形式（/c/Users/...），~、/tmp、/dev/null 和 /usr/... 的解析方式与 Git Bash 完全一致。'
  ]
];

const RULES = TEXT.map(([source, localized], index) => ({
  source,
  rule: defineRule('gitbash', source, localized, {
    versions: index === 2 || index === 3 ? ['0.39.0'] : index === 4 || index === 5 ? ['0.39.4'] : ['0.39.0', '0.39.4'],
    coverage: index < 6 ? 'assemble-refresh-warning' : 'plugin-stage'
  })
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
