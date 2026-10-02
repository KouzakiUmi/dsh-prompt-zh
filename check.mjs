// 离线自检：用当前版本（核心 0.2.0-rc.1 / 壳 2.0.15-next）的真实英文原文，
// 喂给 dsh-prompt-zh 插件包的导出函数，逐项确认译文完整且幂等。
// 插件升级后先跑本脚本；上游改写英文原文时，下面的字面量要同步更新。
import { translate, translateContext, filePolicy, networkPolicy, delegationPolicy, applySentenceGate, isSectionVisible, SENTENCE_TOOL_LINKS } from './lib/index.js'

const PLAN_EN = `You are in plan mode. Stay in plan mode until exit_plan_mode succeeds or the user switches the session mode. Imperative language to implement changes means plan the implementation, not execute it. A user's conversational agreement — including an answer confirming something you asked — approves nothing and does not end plan mode; fold the confirmed decision into the plan and submit it through exit_plan_mode.

Explore first. Use non-mutating reads, searches, static analysis, and checks to ground the plan in the actual repository. Do not edit or write files, change configuration, run formatters or code generation that rewrites tracked files, commit, or otherwise carry out the plan. Prefer existing functions and patterns over new machinery.

The tool catalog stays the same across modes for request-cache stability. These plan-mode rules override any later tool description or guidance that suggests using mutation tools; those tools remain listed only to keep the request shape stable. Do not use todo_write to track this planning phase: it tracks implementation after an approved plan, while the plan itself belongs in exit_plan_mode.

Resolve discoverable facts by inspection. Use ask_user_question only for user-owned choices or material ambiguity that inspection cannot answer. Do not ask the user where code lives or how current behavior works when you can find out.

Make the plan decision-complete: state the goal and success criteria; group implementation changes by subsystem; identify public API, schema, and data-flow changes; cover edge cases, failure modes, tests, acceptance criteria, and explicit assumptions. Keep it concise enough to review but detailed enough that another engineer can implement it without making design decisions.

When ready, call exit_plan_mode with the complete plan markdown, starting with a # title. Make exit_plan_mode the only and final tool call in that assistant response: it presents the plan for approval, and implementation begins only in a later step after approval. Do not paste the final plan as a plain reply or ask "should I proceed?" through prose or ask_user_question. If review rejects it, incorporate the feedback and present again. If the review channel is unavailable or aborted, stay in plan mode and ask the user to switch modes manually; do not proceed with implementation.`

const DELIVERABLES_EN = `Prefer showing the primary results within your final response alongside a brief explanation. Use ![Description](<path/to/image.png>) when an image supports an explanation or comparison. Use [Description](<path/to/image.png>) when referring to an image or listing files. Enclose Markdown file destinations in angle brackets, especially paths containing spaces. Do not call present just to list edited source files, or run commands to check whether a diff view will appear. Use present when a separate file card helps the user open the complete deliverable, including images, Office documents, spreadsheets, and slide decks. Each presented file adds a card below the reply, with preview and native-open actions. Avoid repeating results already shown inline unless the separate card adds useful access. Outside commands, configuration expressions, and code blocks, link every mention of an existing file, including repeats and tables, to its full path relative to the working directory or absolute; append #L24 or #L24-L30 to the target for known lines. Use the filename or a clear alias as the label, adding only enough parent directories to distinguish files; keep full paths out of labels. Default to the name alone; when precise locations matter, append :24 or :24–30, with no # or L in the line suffix.`

const FILEREF_EN = `Tokens prefixed with @ are paths the user explicitly referenced. Relative paths resolve from the workspace root; absolute paths identify files or directories on the host. A trailing slash marks a directory: list it when its contents matter. Anything else is a file: use the read tool when its contents are needed, and do not claim to have inspected it before reading. @"..." quotes a path containing spaces.`

const IDENTITY_EN = `You are an AI agent powered by DeepSeek Harness.`
const JOBS_EN = `Track every background job id you start. You are notified in-session when a job finishes — do not busy-poll or sleep on one; keep working on independent steps and do not duplicate a running job's work. Before giving a final answer, collect every still-relevant job with job_output (set wait: true only when you are genuinely blocked on it), and job_kill jobs that stopped mattering.`

// 每个断言：修复后译文里必须出现的片段
const EXPECTED = {
	plan: ['你处于 plan mode', '先只读探索', '各模式保持相同的工具目录', '可通过检查查明的事实', '计划应写明目标与验收标准', '提交计划时，exit_plan_mode', '不要在能自行查明时问用户代码在哪里', '不要以普通回复粘贴最终计划', '并请用户手动切换模式'],
	deliverables: ['每张被展示的文件都会在回复下方加一张卡片', '除非独立卡片能提供有用的访问方式', '在命令、配置表达式和代码块之外', '包括重复提及和表格中的提及'],
	files: ['fs-observation-policy'],
	identity: ['AI agent'],
	jobs: ['job_output']
}

const results = []
const check = (label, text, fragments) => {
	const missing = fragments.filter((f) => !text.includes(f))
	results.push({ label, ok: missing.length === 0, missing })
}

const planOut = translate('plan:policy', PLAN_EN)
check('plan:policy', planOut, EXPECTED.plan)
const deliverOut = translate('ui:deliverable-file-references', DELIVERABLES_EN)
check('ui:deliverable-file-references', deliverOut, EXPECTED.deliverables)
const filesOut = filePolicy(new Set(['read', 'write', 'edit', 'glob', 'grep']))
check('filePolicy', filesOut, EXPECTED.files)
const identOut = translate('harness:identity', IDENTITY_EN)
check('harness:identity', identOut, EXPECTED.identity)
const jobsOut = translate('tool:jobs', JOBS_EN)
check('tool:jobs', jobsOut, EXPECTED.jobs)
const fileRefOut = translateContext('context:file-reference', FILEREF_EN)
check('context:file-reference', fileRefOut, ['以 @ 开头的 token'])

// 幂等：把输出再喂回去，必须逐字节不变
const idemPlan = translate('plan:policy', planOut) === planOut
const idemDeliver = translate('ui:deliverable-file-references', deliverOut) === deliverOut
const idemRef = translateContext('context:file-reference', fileRefOut) === fileRefOut

console.log('=== 断言结果 ===')
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  缺失: ' + r.missing.join(' | ')}`)
console.log('\n=== 幂等（二次翻译必须逐字节不变）===')
console.log(`  plan:policy                     ${idemPlan ? 'PASS' : 'FAIL'}`)
console.log(`  ui:deliverable-file-references  ${idemDeliver ? 'PASS' : 'FAIL'}`)
console.log(`  context:file-reference          ${idemRef ? 'PASS' : 'FAIL'}`)

console.log('\n=== plan:policy 实际输出 ===')
console.log(planOut.split('\n\n').map((p, i) => `  [${i + 1}] ${p.slice(0, 90)}…`).join('\n'))

console.log('\n=== filePolicy 实际输出 ===')
console.log(filesOut.split('\n').map((l) => '  ' + l).join('\n'))

// ── 句子关联覆盖：SENTENCE_TOOL_LINKS 的每个片段必须真实存在于对应译文里 ──
// 失配即静默不命中（历史上的 present 裁剪失效就是这类 bug），所以逐条硬校验。
const linkResults = []
for (const [name, fragment] of SENTENCE_TOOL_LINKS) {
  const sample = name === 'plan:policy' ? PLAN_EN : 'upstream sample text'
  const source = translate(name, sample)
  if (!source.includes(fragment)) linkResults.push({ label: `${name} ⇐ ${fragment.slice(0, 40)}…`, ok: false })
}
console.log('\n=== 句子关联覆盖（片段必须存在于译文）===')
console.log(linkResults.length === 0 ? '  PASS  全部 ' + SENTENCE_TOOL_LINKS.length + ' 条关联均命中' : '  FAIL  ' + linkResults.length + ' 条失配')

// ── 判断模块行为：按可见工具集裁剪句子，避免「没有的东西也发过去」──
const gateResults = []
const gateCheck = (label, ok) => gateResults.push({ label, ok })
const teamTools = ['spawn_teammate', 'send_message', 'list_agents', 'wait_agent', 'team_task_create', 'team_task_list', 'team_task_get', 'team_task_update']

const jobsFull = translate('tool:jobs', JOBS_EN)
gateCheck('jobs: 双工具齐全 → 两句都在', applySentenceGate('tool:jobs', jobsFull, new Set(['job_output', 'job_kill'])).includes('job_kill') && applySentenceGate('tool:jobs', jobsFull, new Set(['job_output', 'job_kill'])).includes('job_output'))
gateCheck('jobs: 只有 job_output → 不提 job_kill', !applySentenceGate('tool:jobs', jobsFull, new Set(['job_output'])).includes('job_kill') && applySentenceGate('tool:jobs', jobsFull, new Set(['job_output'])).includes('job_output'))
gateCheck('jobs: 只有 job_kill → 不提 job_output', !applySentenceGate('tool:jobs', jobsFull, new Set(['job_kill'])).includes('job_output') && applySentenceGate('tool:jobs', jobsFull, new Set(['job_kill'])).includes('job_kill'))
gateCheck('jobs: 双缺 → 只留通用纪律', !applySentenceGate('tool:jobs', jobsFull, new Set()).includes('job_output'))

const ralphFull = translate('tool:ralph', 'sample')
gateCheck('ralph: 无 subagent/workflow → 不提名', !applySentenceGate('tool:ralph', ralphFull, new Set(['ralph'])).includes('subagent/workflow'))
gateCheck('ralph: 齐全 → 保留', applySentenceGate('tool:ralph', ralphFull, new Set(['ralph', 'subagent', 'workflow'])).includes('subagent/workflow'))
gateCheck('ralph: 无 goal 工具 → 不提示 goal', !applySentenceGate('tool:ralph', ralphFull, new Set(['ralph'])).includes('同会话 goal'))

const teamFull = translate('team:policy', 'sample')
const teamNoBash = applySentenceGate('team:policy', teamFull, new Set(teamTools))
gateCheck('team: 无 bash → 不提 Bash', !teamNoBash.includes('Bash、') && teamNoBash.includes('formatter、code generator'))
const teamMinimal = applySentenceGate('team:policy', teamFull, new Set(['send_message']))
gateCheck('team: 只有 send_message → 不提 wait_agent', !teamMinimal.includes('wait_agent') && teamMinimal.includes('send_message'))

const uiFull = translate('ui:deliverable-file-references', DELIVERABLES_EN)
const uiNoPresent = applySentenceGate('ui:deliverable-file-references', uiFull, new Set())
gateCheck('ui: 无 present → 不提 present', !uiNoPresent.includes('present'))
gateCheck('ui: 有 present → 保留', applySentenceGate('ui:deliverable-file-references', uiFull, new Set(['present'])) === uiFull)

const planFull = translate('plan:policy', PLAN_EN)
gateCheck('plan: 无 todo_write → 不提名', !applySentenceGate('plan:policy', planFull, new Set()).includes('todo_write'))
gateCheck('plan: 无 ask_user_question → 不提名', !applySentenceGate('plan:policy', planFull, new Set()).includes('ask_user_question'))

const once = applySentenceGate('team:policy', teamFull, new Set(['send_message']))
gateCheck('gate 幂等（二次执行不变）', applySentenceGate('team:policy', once, new Set(['send_message'])) === once)

gateCheck('networkPolicy: 无联网工具且无外部 section → 空串', networkPolicy(new Set(), []) === '')
gateCheck('networkPolicy: 仅 x_search → 不提 web_search/grok_web_search 备选', !networkPolicy(new Set(['x_search']), []).includes('web_search'))
gateCheck('networkPolicy: x_search + web_search → 附备选警告', networkPolicy(new Set(['x_search', 'web_search']), []).includes('不要改用 `web_search`'))
gateCheck('filePolicy: 仅 write → 不提 edit', !filePolicy(new Set(['write'])).includes('`edit`'))
gateCheck('filePolicy: 全工具 → 含 read/edit 指引', filePolicy(new Set(['read', 'write', 'edit', 'glob', 'grep'])).includes('局部修改优先 `edit`'))
gateCheck('section 可见性: tool:jobs any 模式', isSectionVisible('tool:jobs', new Set(['job_output'])) && !isSectionVisible('tool:jobs', new Set()))
gateCheck('section 可见性: team:policy any 模式', isSectionVisible('team:policy', new Set(['wait_agent'])) && !isSectionVisible('team:policy', new Set()))
gateCheck('section 可见性: tool:bash all 模式', isSectionVisible('tool:bash', new Set(['bash'])) && !isSectionVisible('tool:bash', new Set()))

console.log('\n=== 判断模块行为（句子↔工具关联）===')
for (const r of gateResults) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`)

const allOk = results.every((r) => r.ok) && idemPlan && idemDeliver && idemRef && linkResults.length === 0 && gateResults.every((r) => r.ok)
console.log(`\n总判定: ${allOk ? 'ALL PASS' : 'HAS FAILURES'}`)
process.exitCode = allOk ? 0 : 1
