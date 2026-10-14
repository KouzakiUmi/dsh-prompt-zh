// MCP 服务器指令中文化模块。
// 适配通过 systemPrompt.section({ name: "mcp:<server>", ... }) 注入的 MCP 说明，
// 以及组合提示词、运行时注入消息中的 MCP 说明。
// 保留工具 schema、参数名、JSON 字段名，将规则、工作流与指导中文化。
import { translateBlender } from './blender.js';
import { replacement, componentEnabled, defineRule, renderRule } from './rules.js';

export const MCP_TRANSLATIONS = {
  blender: translateBlender,
  context7: (text, runtime) => {
    if (!componentEnabled(runtime, 'mcp.context7')) return text;
    return text
      .replace(/(?:^|\n)###\s*MCP\s+server:\s*context7/gi, replacement('mcp.context7', /(?:^|\n)###\s*MCP\s+server:\s*context7/gi, '### MCP 服务器：context7', runtime, { prefixNewline: true }))
      .replace(
        /Use this server to fetch current documentation whenever the user asks about a library,\s*framework,\s*SDK,\s*API,\s*CLI tool,\s*or cloud service\s*[—\-]+\s*even well-known ones like React,\s*Next\.js,\s*Prisma,\s*Express,\s*Tailwind,\s*Django,\s*or Spring Boot\.\s*This includes API syntax,\s*configuration,\s*version migration,\s*library-specific debugging,\s*setup instructions,\s*and CLI tool usage\.\s*Use even when you think you know the answer\s*[—\-]+\s*your training data may not reflect recent changes\.\s*Prefer this over web search for library docs\./gu,
        replacement('mcp.context7', /Use this server to fetch current documentation whenever the user asks about a library,\s*framework,\s*SDK,\s*API,\s*CLI tool,\s*or cloud service\s*[—\-]+\s*even well-known ones like React,\s*Next\.js,\s*Prisma,\s*Express,\s*Tailwind,\s*Django,\s*or Spring Boot\.\s*This includes API syntax,\s*configuration,\s*version migration,\s*library-specific debugging,\s*setup instructions,\s*and CLI tool usage\.\s*Use even when you think you know the answer\s*[—\-]+\s*your training data may not reflect recent changes\.\s*Prefer this over web search for library docs\./gu, '当用户询问有关库、框架、SDK、API、CLI 工具或云服务（包括 React、Next.js、Prisma、Express、Tailwind、Django 或 Spring Boot 等知名项目）时，使用此服务器获取最新文档。这涵盖 API 语法、配置、版本迁移、特定库的排错、安装指引和 CLI 工具用法。即使你认为自己知道答案也应使用——训练数据可能未反映最新变更。查询库文档时优先使用此服务器，而非网页搜索。', runtime)
      )
      .replace(
        /Do not use for:\s*refactoring,\s*writing scripts from scratch,\s*debugging business logic,\s*code review,\s*or general programming concepts\./gu,
        replacement('mcp.context7', /Do not use for:\s*refactoring,\s*writing scripts from scratch,\s*debugging business logic,\s*code review,\s*or general programming concepts\./gu, '请勿用于：重构代码、从零编写脚本、排查业务逻辑、代码审查或通用编程概念。', runtime)
      );
  },

  github: (text, runtime) => {
    if (!componentEnabled(runtime, 'mcp.github')) return text;
    return text
      .replace(/(?:^|\n)###\s*MCP\s+server:\s*github/gi, replacement('mcp.github', /(?:^|\n)###\s*MCP\s+server:\s*github/gi, '### MCP 服务器：github', runtime, { prefixNewline: true }))
      .replace(
        /The GitHub MCP Server provides tools to interact with GitHub platform\./gu,
        replacement('mcp.github', /The GitHub MCP Server provides tools to interact with GitHub platform\./gu, 'GitHub MCP 服务器提供与 GitHub 平台交互的工具。', runtime)
      )
      .replace(/Tool selection guidance:/gu, replacement('mcp.github', /Tool selection guidance:/gu, '工具选择指引：', runtime))
      .replace(
        /1\.\s*Use\s+['"]list_[\*]?['"]\s+tools for broad,\s*simple retrieval and pagination of all items of a type\s*\(e\.g\.,\s*all issues,\s*all PRs,\s*all branches\)\s*with basic filtering\./gu,
        replacement('mcp.github', /1\.\s*Use\s+['"]list_[\*]?['"]\s+tools for broad,\s*simple retrieval and pagination of all items of a type\s*\(e\.g\.,\s*all issues,\s*all PRs,\s*all branches\)\s*with basic filtering\./gu, "1. 对于某种类型所有条目的广泛、简单检索与分页（例如所有 issue、所有 PR、所有分支）以及基础过滤，使用 'list_*' 工具。", runtime)
      )
      .replace(
        /2\.\s*Use\s+['"]search_[\*]?['"]\s+tools for targeted queries with specific criteria,\s*keywords,\s*or complex filters\s*\(e\.g\.,\s*issues with certain text,\s*PRs by author,\s*code containing functions\)\./gu,
        replacement('mcp.github', /2\.\s*Use\s+['"]search_[\*]?['"]\s+tools for targeted queries with specific criteria,\s*keywords,\s*or complex filters\s*\(e\.g\.,\s*issues with certain text,\s*PRs by author,\s*code containing functions\)\./gu, "2. 对于具有特定条件、关键词或复杂过滤器的针对性查询（例如包含特定文本的 issue、指定作者的 PR、包含特定函数的代码），使用 'search_*' 工具。", runtime)
      )
      .replace(/Context management:/gu, replacement('mcp.github', /Context management:/gu, '上下文管理：', runtime))
      .replace(
        /1\.\s*Use pagination whenever possible with batches of 5[—\-–]10 items\./gu,
        replacement('mcp.github', /1\.\s*Use pagination whenever possible with batches of 5[—\-–]10 items\./gu, '1. 尽可能使用分页，每批 5–10 项。', runtime)
      )
      .replace(
        /2\.\s*Use minimal_output parameter set to true if the full information is not needed to accomplish a task\./gu,
        replacement('mcp.github', /2\.\s*Use minimal_output parameter set to true if the full information is not needed to accomplish a task\./gu, '2. 当完成任务不需要完整信息时，将 minimal_output 参数设为 true。', runtime)
      )
      .replace(/Tool usage guidance:/gu, replacement('mcp.github', /Tool usage guidance:/gu, '工具使用指引：', runtime))
      .replace(
        /1\.\s*For\s+['"]search_[\*]?['"]\s+tools:\s*Use separate\s+['"]sort['"]\s+and\s+['"]order['"]\s+parameters if available for sorting results\s*[—\-–]+\s*do not include\s+['"]sort:['"]\s+syntax in query strings\.\s*Query strings should contain only search criteria\s*\(e\.g\.,\s*['"]org:google language:python['"]\),\s*not sorting instructions\.\s*Always call\s+['"]get_me['"]\s+first to understand current user permissions and context\./gu,
        replacement('mcp.github', /1\.\s*For\s+['"]search_[\*]?['"]\s+tools:\s*Use separate\s+['"]sort['"]\s+and\s+['"]order['"]\s+parameters if available for sorting results\s*[—\-–]+\s*do not include\s+['"]sort:['"]\s+syntax in query strings\.\s*Query strings should contain only search criteria\s*\(e\.g\.,\s*['"]org:google language:python['"]\),\s*not sorting instructions\.\s*Always call\s+['"]get_me['"]\s+first to understand current user permissions and context\./gu, "1. 对于 'search_*' 工具：如需排序结果，若可用请使用独立的 'sort' 和 'order' 参数——不要在查询字符串中包含 'sort:' 语法。查询字符串应仅包含搜索条件（例如 'org:google language:python'），不要包含排序指令。始终先调用 'get_me' 以了解当前用户的权限和上下文。", runtime)
      )
      .replace(/(?:^|\n)##\s*Issues/gu, replacement('mcp.github', /(?:^|\n)##\s*Issues/gu, '## Issue 处理', runtime, { prefixNewline: true }))
      .replace(/## Issues/gu, replacement('mcp.github', /## Issues/gu, '## Issue 处理', runtime))
      .replace(
        /Check\s+['"]list_issue_types['"]\s+first for organizations to use proper issue types\.\s*Use\s+['"]search_issues['"]\s+before creating new issues to avoid duplicates\.\s*Always set\s+['"]state_reason['"]\s+when closing issues\./gu,
        replacement('mcp.github', /Check\s+['"]list_issue_types['"]\s+first for organizations to use proper issue types\.\s*Use\s+['"]search_issues['"]\s+before creating new issues to avoid duplicates\.\s*Always set\s+['"]state_reason['"]\s+when closing issues\./gu, "对于组织，先检查 'list_issue_types' 以使用正确的 issue 类型。创建新 issue 之前先用 'search_issues' 避免重复。关闭 issue 时务必设置 'state_reason'。", runtime)
      )
      .replace(/(?:^|\n)##\s*Pull Requests/gu, replacement('mcp.github', /(?:^|\n)##\s*Pull Requests/gu, '## Pull Request 处理', runtime, { prefixNewline: true }))
      .replace(/## Pull Requests/gu, replacement('mcp.github', /## Pull Requests/gu, '## Pull Request 处理', runtime))
      .replace(
        /PR review workflow:\s*Always use\s+['"]pull_request_review_write['"]\s+with method\s+['"]create['"]\s+to create a pending review,\s*then\s+['"]add_comment_to_pending_review['"]\s+to add comments,\s*and finally\s+['"]pull_request_review_write['"]\s+with method\s+['"]submit_pending['"]\s+to submit the review for complex reviews with line-specific comments\./gu,
        replacement('mcp.github', /PR review workflow:\s*Always use\s+['"]pull_request_review_write['"]\s+with method\s+['"]create['"]\s+to create a pending review,\s*then\s+['"]add_comment_to_pending_review['"]\s+to add comments,\s*and finally\s+['"]pull_request_review_write['"]\s+with method\s+['"]submit_pending['"]\s+to submit the review for complex reviews with line-specific comments\./gu, "PR 审查工作流：对于包含逐行评论的复杂审查，始终先用 'pull_request_review_write'（method: 'create'）创建待决审查，再用 'add_comment_to_pending_review' 添加评论，最后用 'pull_request_review_write'（method: 'submit_pending'）提交审查。", runtime)
      )
      .replace(
        /Before creating a pull request,\s*search for pull request templates in the repository\.\s*Template files are called pull_request_template\.md or they're located in\s+['"]\.github\/PULL_REQUEST_TEMPLATE['"]\s+directory\.\s*Use the template content to structure the PR description and then call create_pull_request tool\./gu,
        replacement('mcp.github', /Before creating a pull request,\s*search for pull request templates in the repository\.\s*Template files are called pull_request_template\.md or they're located in\s+['"]\.github\/PULL_REQUEST_TEMPLATE['"]\s+directory\.\s*Use the template content to structure the PR description and then call create_pull_request tool\./gu, "创建 pull request 之前，先在仓库中搜索 pull request 模板。模板文件名为 pull_request_template.md 或位于 '.github/PULL_REQUEST_TEMPLATE' 目录中。使用模板内容组织 PR 描述，然后调用 create_pull_request 工具。", runtime)
      );
  },

  playwright: (text, runtime) => {
    if (!componentEnabled(runtime, 'mcp.playwright')) return text;
    return text
      .replace(/(?:^|\n)###\s*MCP\s+server:\s*playwright/gi, replacement('mcp.playwright', /(?:^|\n)###\s*MCP\s+server:\s*playwright/gi, '### MCP 服务器：playwright', runtime, { prefixNewline: true }))
      .replace(
        /The Playwright MCP Server provides browser automation capabilities/gu,
        replacement('mcp.playwright', /The Playwright MCP Server provides browser automation capabilities/gu, 'Playwright MCP 服务器提供浏览器自动化能力', runtime)
      );
  },

  'chrome-devtools': (text, runtime) => {
    if (!componentEnabled(runtime, 'mcp.chrome-devtools')) return text;
    return text
      .replace(/(?:^|\n)###\s*MCP\s+server:\s*chrome-devtools/gi, replacement('mcp.chrome-devtools', /(?:^|\n)###\s*MCP\s+server:\s*chrome-devtools/gi, '### MCP 服务器：chrome-devtools', runtime, { prefixNewline: true }))
      .replace(
        /The Chrome DevTools MCP Server provides DevTools inspection capabilities/gu,
        replacement('mcp.chrome-devtools', /The Chrome DevTools MCP Server provides DevTools inspection capabilities/gu, 'Chrome DevTools MCP 服务器提供开发者工具检查与调试能力', runtime)
      );
  }
};

/**
 * 翻译单个 MCP server section 内容
 */
const HEADER_PATTERN = /(?:^|\n)###\s*MCP\s+server:\s*([^\r\n]+)/gi;
const HEADER_RULE = defineRule('mcp.other', HEADER_PATTERN, '### MCP 服务器：$1');
function translateHeaders(text, runtime) {
  return text.replace(HEADER_PATTERN, (match, serverName) => {
    const server = serverName.trim();
    const component = Object.hasOwn(MCP_TRANSLATIONS, server) ? `mcp.${server}` : 'mcp.other';
    if (!componentEnabled(runtime, component)) return match;
    const output = renderRule(HEADER_RULE, [server], runtime, match);
    return output !== match && match.startsWith('\n') ? `\n${output}` : output;
  });
}

export function translateMcp(name, text, runtime) {
  if (!name || typeof text !== 'string') return text;
  const server = name.startsWith('mcp:') ? name.slice(4).trim() : name;
  const component = Object.hasOwn(MCP_TRANSLATIONS, server) ? `mcp.${server}` : 'mcp.other';
  if (!componentEnabled(runtime, component)) return text;
  const translated = Object.hasOwn(MCP_TRANSLATIONS, server) ? MCP_TRANSLATIONS[server](text, runtime) : text;
  return translateHeaders(translated, runtime);
}

/**
 * 全文扫描翻译所有 MCP 提示词片段（供组合提示词及运行时消息使用）
 */
export function translateAllMcp(text, runtime) {
  if (typeof text !== 'string' || !text) return text;
  if (!text.includes('MCP') && !text.includes('context7') && !text.includes('github') && !text.includes('Blender')) return text;

  let result = text;
  for (const server of Object.keys(MCP_TRANSLATIONS)) {
    result = MCP_TRANSLATIONS[server](result, runtime);
  }
  return translateHeaders(result, runtime);
}

// 登记静态默认值，不读取 MCP 服务端状态或真实场景。
for (const translate of Object.values(MCP_TRANSLATIONS)) translate('');
