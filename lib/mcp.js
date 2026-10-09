// MCP 服务器指令中文化模块。
// 适配通过 systemPrompt.section({ name: "mcp:<server>", ... }) 注入的 MCP 说明。
// 保留工具 schema、参数名、JSON 字段名，将规则、工作流与指导中文化。

export const MCP_TRANSLATIONS = {
  context7: (text) => {
    return text
      .replace(/### MCP server:\s*context7/gi, '### MCP 服务器：context7')
      .replace(
        /Use this server to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service — even well-known ones like React, Next\.js, Prisma, Express, Tailwind, Django, or Spring Boot\. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage\. Use even when you think you know the answer — your training data may not reflect recent changes\. Prefer this over web search for library docs\./gu,
        '当用户询问有关库、框架、SDK、API、CLI 工具或云服务（包括 React、Next.js、Prisma、Express、Tailwind、Django 或 Spring Boot 等知名项目）时，使用此服务器获取最新文档。这涵盖 API 语法、配置、版本迁移、特定库的排错、安装指引和 CLI 工具用法。即使你认为自己知道答案也应使用——训练数据可能未反映最新变更。查询库文档时优先使用此服务器，而非网页搜索。'
      )
      .replace(
        /Do not use for:\s*refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts\./gu,
        '请勿用于：重构代码、从零编写脚本、排查业务逻辑、代码审查或通用编程概念。'
      );
  },

  github: (text) => {
    return text
      .replace(/### MCP server:\s*github/gi, '### MCP 服务器：github')
      .replace(
        /The GitHub MCP Server provides tools to interact with GitHub platform\./gu,
        'GitHub MCP 服务器提供与 GitHub 平台交互的工具。'
      )
      .replace(/Tool selection guidance:/gu, '工具选择指引：')
      .replace(
        /1\.\s*Use 'list_\*' tools for broad, simple retrieval and pagination of all items of a type \(e\.g\., all issues, all PRs, all branches\) with basic filtering\./gu,
        "1. 对于某种类型所有条目的广泛、简单检索与分页（例如所有 issue、所有 PR、所有分支）以及基础过滤，使用 'list_*' 工具。"
      )
      .replace(
        /2\.\s*Use 'search_\*' tools for targeted queries with specific criteria, keywords, or complex filters \(e\.g\., issues with certain text, PRs by author, code containing functions\)\./gu,
        "2. 对于具有特定条件、关键词或复杂过滤器的针对性查询（例如包含特定文本的 issue、指定作者的 PR、包含特定函数的代码），使用 'search_*' 工具。"
      )
      .replace(/Context management:/gu, '上下文管理：')
      .replace(
        /1\.\s*Use pagination whenever possible with batches of 5-10 items\./gu,
        '1. 尽可能使用分页，每批 5–10 项。'
      )
      .replace(
        /2\.\s*Use minimal_output parameter set to true if the full information is not needed to accomplish a task\./gu,
        '2. 当完成任务不需要完整信息时，将 minimal_output 参数设为 true。'
      )
      .replace(/Tool usage guidance:/gu, '工具使用指引：')
      .replace(
        /1\.\s*For 'search_\*' tools:\s*Use separate 'sort' and 'order' parameters if available for sorting results - do not include 'sort:' syntax in query strings\. Query strings should contain only search criteria \(e\.g\., 'org:google language:python'\), not sorting instructions\. Always call 'get_me' first to understand current user permissions and context\./gu,
        "1. 对于 'search_*' 工具：如需排序结果，若可用请使用独立的 'sort' 和 'order' 参数——不要在查询字符串中包含 'sort:' 语法。查询字符串应仅包含搜索条件（例如 'org:google language:python'），不要包含排序指令。始终先调用 'get_me' 以了解当前用户的权限和上下文。"
      )
      .replace(/## Issues/gu, '## Issue 处理')
      .replace(
        /Check 'list_issue_types' first for organizations to use proper issue types\. Use 'search_issues' before creating new issues to avoid duplicates\. Always set 'state_reason' when closing issues\./gu,
        "对于组织，先检查 'list_issue_types' 以使用正确的 issue 类型。创建新 issue 之前先用 'search_issues' 避免重复。关闭 issue 时务必设置 'state_reason'。"
      )
      .replace(/## Pull Requests/gu, '## Pull Request 处理')
      .replace(
        /PR review workflow:\s*Always use 'pull_request_review_write' with method 'create' to create a pending review, then 'add_comment_to_pending_review' to add comments, and finally 'pull_request_review_write' with method 'submit_pending' to submit the review for complex reviews with line-specific comments\./gu,
        "PR 审查工作流：对于包含逐行评论的复杂审查，始终先用 'pull_request_review_write'（method: 'create'）创建待决审查，再用 'add_comment_to_pending_review' 添加评论，最后用 'pull_request_review_write'（method: 'submit_pending'）提交审查。"
      )
      .replace(
        /Before creating a pull request, search for pull request templates in the repository\. Template files are called pull_request_template\.md or they're located in '\.github\/PULL_REQUEST_TEMPLATE' directory\. Use the template content to structure the PR description and then call create_pull_request tool\./gu,
        "创建 pull request 之前，先在仓库中搜索 pull request 模板。模板文件名为 pull_request_template.md 或位于 '.github/PULL_REQUEST_TEMPLATE' 目录中。使用模板内容组织 PR 描述，然后调用 create_pull_request 工具。"
      );
  },

  playwright: (text) => {
    return text
      .replace(/^### MCP server:\s*playwright/gim, '### MCP 服务器：playwright')
      .replace(
        /The Playwright MCP Server provides browser automation capabilities/gu,
        'Playwright MCP 服务器提供浏览器自动化能力'
      );
  },

  'chrome-devtools': (text) => {
    return text
      .replace(/^### MCP server:\s*chrome-devtools/gim, '### MCP 服务器：chrome-devtools')
      .replace(
        /The Chrome DevTools MCP Server provides DevTools inspection capabilities/gu,
        'Chrome DevTools MCP 服务器提供开发者工具检查与调试能力'
      );
  }
};

/**
 * 翻译 MCP server section 内容
 */
export function translateMcp(name, text) {
  if (!name || typeof text !== 'string') return text;
  const server = name.startsWith('mcp:') ? name.slice(4).trim() : name;
  let translated = text;
  if (MCP_TRANSLATIONS[server]) {
    translated = MCP_TRANSLATIONS[server](translated);
  }
  // 通用兜底：处理标题 ### MCP server: <name>
  translated = translated.replace(/^### MCP server:\s*(\S+)/gim, '### MCP 服务器：$1');
  return translated;
}
