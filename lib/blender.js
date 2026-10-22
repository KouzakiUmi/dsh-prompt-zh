// 本轮实际收到的 Blender MCP 指导文本；不加载 Blender，不执行 bpy，不猜译未知规则。
import { defineRule, renderRule, componentEnabled } from './rules.js';
const TEXT = [
  ['You have access to Blender tools to interact with a Blender scene directly.', '你可以使用 Blender 工具直接操作 Blender 场景。'],
  ['Blender must be running with the MCP add-on enabled and connected.', 'Blender 必须处于运行状态，且 MCP 插件已启用并连接。'],
  ['IMPORTANT: Respect existing structure and naming conventions.', '重要：遵守现有结构和命名约定。'],
  ['NEVER assume missing values - inspect the scene first.', '绝不猜测缺失的值——先检查场景。'],
  ['Do not destructively modify objects without confirmation.', '未经确认，不得破坏性修改对象。'],
  ['# Bundled Manuals', '# 随附手册'],
  ['Reference documentation is bundled alongside this server as plain-text RST files.', '本服务器随附纯文本 RST 格式的参考文档。'],
  ['Search and read them directly with standard text tools (grep, file read, etc.):', '使用标准文本工具（grep、文件读取等）直接搜索和阅读这些文档：'],
  ['* `data/api/` - Blender Python API reference (RST files per module/class).', '* `data/api/`——Blender Python API 参考（按模块／类组织的 RST 文件）。'],
  ['Consult when writing or debugging `bpy` code: operator signatures, type properties, enum values, etc.', '编写或调试 `bpy` 代码时查阅，用于核对操作器签名、类型属性、枚举值等。'],
  ['* `data/manual/` - Blender user manual (RST files mirroring the official manual structure).', '* `data/manual/`——Blender 用户手册（RST 文件结构与官方手册对应）。'],
  ['Consult for conceptual explanations, workflow guidance, and feature overviews.', '用于查阅概念解释、工作流指导和功能概览。'],
  ['# Executing Code', '# 执行代码'],
  ['The `execute_blender_code` tool runs Python code via `bpy` in the connected Blender instance.', '`execute_blender_code` 工具通过 `bpy` 在已连接的 Blender 实例中运行 Python 代码。'],
  ['The `execute_blender_code` tool is a last resort, if there are other tools that provide the functionality you need, use those instead.', '`execute_blender_code` 工具仅作为最后手段；若其他工具已提供所需功能，应优先使用其他工具。'],
  ['Prefer operators (`bpy.ops`) for standard actions (adding primitives, applying modifiers, setting origins) - they handle defaults and context. Use the data API (`bpy.data`) for precise control or to avoid side effects.', '标准操作（添加基本体、应用修改器、设置原点）优先使用操作器（`bpy.ops`），它们会处理默认值和上下文。需要精确控制或避免副作用时使用数据 API（`bpy.data`）。'],
  ['Many operators depend on the current mode (Object, Edit, Sculpt, etc.) and which objects are active/selected. Verify or set the mode first - wrong mode either fails or silently does nothing.', '许多操作器依赖当前模式（Object、Edit、Sculpt 等）以及活动／选中的对象。先核实或设置模式；模式错误可能导致失败，或静默地不执行任何操作。'],
  ['The **active object** and **selection** are distinct. Many operators require both. Set them explicitly - do not assume the current state. Operators change selection and active state as a side effect, so re-set both between sequential operator calls on different objects.', '**活动对象**和**选择集**是不同概念，许多操作器同时要求两者。请显式设置，不要假设当前状态。操作器会以副作用改变选择集和活动状态，因此连续对不同对象调用操作器时，应在调用之间重新设置两者。'],
  ['Update the dependency graph after changes before reading computed properties (world matrices, modifier results, etc.).', '修改后、读取计算属性（世界矩阵、修改器结果等）前，先更新依赖关系图。'],
  ['In edit mode, access mesh geometry through the bmesh API, not the regular mesh data API. Flush bmesh changes back to the mesh - forgetting this silently loses all edits.', '在编辑模式下，通过 bmesh API 访问网格几何，而不是普通网格数据 API。将 bmesh 的修改同步回网格；忘记同步会静默丢失所有编辑。'],
  ['Return structured data (dicts, lists) from executed code, not print output.', '执行的代码应返回结构化数据（dict、list），不要仅打印输出。'],
  ['# Scene & Data Structure', '# 场景与数据结构'],
  ['Blender uses a datablock system - objects and their underlying data (meshes, materials, cameras, etc.) are separate entities.', 'Blender 使用数据块系统：对象与其底层数据（网格、材质、相机等）是独立实体。'],
  ['Hierarchy:', '层级结构：'],
  ['* **Scene** - top-level container. A .blend can have multiple.', '* **Scene（场景）**——顶层容器，一个 .blend 文件可以包含多个场景。'],
  ['* **View Layer** - controls collection visibility/selectability.', '* **View Layer（视图层）**——控制集合的可见性和可选择性。'],
  ['* **Collection** - organizational tree. Objects live in collections; can be nested; objects can belong to multiple collections.', '* **Collection（集合）**——用于组织对象的树结构；集合可以嵌套，对象可以属于多个集合。'],
  ['* **Object** - has a transform (location, rotation, scale) and references underlying data (Mesh, Curve, Camera, etc.). Multiple objects can share the same data (linked duplicates).', '* **Object（对象）**——具有变换（位置、旋转、缩放），并引用底层数据（Mesh、Curve、Camera 等）。多个对象可以共享相同数据（关联复制）。'],
  ['* **Datablocks** - the actual data: geometry, materials, textures, etc.', '* **Datablocks（数据块）**——实际的数据，如几何、材质、纹理等。'],
  ['Key concepts:', '关键概念：'],
  ['* Objects and data are separate - deleting one does not delete the other.', '* 对象和数据彼此独立；删除其中一项不会自动删除另一项。'],
  ['* Orphaned datablocks (zero users) are purged on save/reload or manual purge.', '* 孤立数据块（使用者数为零）会在保存／重新加载或手动清理时移除。'],
  ['* Objects created via the data API must be linked to a collection to appear in a scene.', '* 通过数据 API 创建的对象必须关联到集合，才能出现在场景中。'],
  ['* Shared data: check user count before modifying a datablock - editing a shared mesh affects all objects referencing it. Make single-user first if needed.', '* 共享数据：修改数据块前先检查使用者数量；编辑共享网格会影响所有引用它的对象。必要时先将其设为单用户数据。'],
  ['* In most cases file assets:', '* 大多数情况下，文件资源：'],
  ['* Images, Fonts, Sounds, other `.blend` files - corraspond to a data-block.', '* 图像、字体、声音及其他 `.blend` 文件——对应一个数据块。'],
  ['Visibility has three independent states:', '可见性包含三个独立状态：'],
  ['* **Viewport hidden** - still fully scriptable.', '* **Viewport hidden（视口隐藏）**——仍可完整地通过脚本访问。'],
  ['* **Disabled in view layer** - excluded; may be inaccessible to view-layer-dependent operators.', '* **Disabled in view layer（视图层禁用）**——已被排除，依赖视图层的操作器可能无法访问。'],
  ['* **Disabled for render** - skipped during render, otherwise normal.', '* **Disabled for render（渲染禁用）**——渲染时跳过，其余行为正常。'],
  ['Check these when objects seem "missing" or operators skip them.', '对象看似“缺失”或被操作器跳过时，检查这些状态。'],
  ['Blender defaults to meters. Check scene unit settings before creating dimensioned objects.', 'Blender 默认使用米。创建具有指定尺寸的对象前，先检查场景单位设置。'],
  ['Exploring scenes:', '探索场景：'],
  ['* Walk the collection hierarchy for an overview first.', '* 先遍历集合层级，了解整体结构。'],
  ["* Don't dump entire scenes - inspect progressively for large scenes.", '* 不要一次输出整个场景；大型场景应逐步检查。'],
  ['* Check object types, parenting, modifiers, and materials before making changes.', '* 修改前先检查对象类型、父子关系、修改器和材质。'],
  ['# Object Types & Creation', '# 对象类型与创建'],
  ['Object types: Mesh, Curve, Surface, Metaball, Text (Font), Armature, Lattice, Empty, Camera, Light, Light Probe, Grease Pencil.', '对象类型：Mesh（网格）、Curve（曲线）、Surface（曲面）、Metaball（融球）、Text（Font，文本／字体）、Armature（骨架）、Lattice（晶格）、Empty（空物体）、Camera（相机）、Light（灯光）、Light Probe（光照探头）、Grease Pencil（蜡笔）。'],
  ['Creating objects:', '创建对象：'],
  ['* Operators for standard primitives - handle defaults and collection linking.', '* 标准基本体使用操作器创建；操作器会处理默认值和集合关联。'],
  ['* Data API for procedural/batch creation - avoids side effects (selection changes, etc.).', '* 程序化／批量创建使用数据 API，以避免选择集变化等副作用。'],
  ['* Always link new objects to a collection.', '* 始终将新对象关联到集合。'],
  ['* Names auto-append `.001`, `.002` on collision - capture references immediately after creation, never look up by assumed name.', '* 名称冲突时会自动追加 `.001`、`.002`；创建后立即保存对象引用，绝不凭假定的名称查找。'],
  ['Delete with unlinking enabled to cleanly remove from all collections.', '删除时启用解除关联，以完整地从所有集合中移除。'],
  ['Prefer non-destructive workflows: modifiers over direct mesh edits where possible, keeping changes adjustable. Apply or edit directly only when final or unavoidable.', '优先使用非破坏性工作流：尽可能使用修改器而非直接编辑网格，保留可调整性。仅在最终确定或无法避免时，才应用修改器或直接编辑。'],
  ['# Transformations & Coordinate Spaces', '# 变换与坐标空间'],
  ['Location, rotation, and scale are in local space (parent-relative, or world if unparented).', '位置、旋转和缩放处于局部空间（相对于父对象；无父对象时相对于世界空间）。'],
  ['Rotation mode determines which property to use (Euler, Quaternion, Axis-Angle). Always check rotation mode first - writing to the wrong property is silently ignored.', '旋转模式决定应使用的属性（Euler、Quaternion、Axis-Angle）。始终先检查旋转模式；写入错误的属性可能被静默忽略。'],
  ['Coordinate spaces:', '坐标空间：'],
  ['* **World** - global. Use the world matrix for reliable positions.', '* **World（世界）**——全局空间。使用世界矩阵获取可靠的位置。'],
  ['* **Local** - relative to parent. Location/rotation/scale operate here.', '* **Local（局部）**——相对于父对象，位置／旋转／缩放在此空间中操作。'],
  ["* **Object** - the object's own system. Mesh vertices are in object space; multiply by world matrix for world positions.", '* **Object（对象）**——对象自身的坐标系。网格顶点位于对象空间；乘以世界矩阵可得到世界坐标。'],
  ['Strategies:', '操作策略：'],
  ['* The origin is the reference point for location; vertices are relative to it.', '* 原点是位置的参考点，顶点坐标相对于原点。'],
  ['* Apply transforms (especially scale) before geometry-dependent operations (booleans, physics) - non-uniform scale causes unexpected results.', '* 在依赖几何的操作（布尔、物理）前应用变换，尤其是缩放；非均匀缩放会导致意外结果。'],
  ['* Set the parent inverse matrix when parenting to preserve visual position.', '* 设置父子关系时设置父级逆矩阵，以保留视觉位置。'],
  ['* Use the world matrix for world-space reads, not manual composition of location/rotation/scale.', '* 读取世界空间数据时使用世界矩阵，不要手工组合位置／旋转／缩放。'],
  ['* The 3D cursor is a persistent world-space reference used by many operations.', '* 3D 游标是许多操作使用的持久世界空间参考点。']
];

// 原文会按行折叠；只容忍空白变化，措辞变化或未知段落仍保留原文。
const RULES = TEXT.map(([source, localized]) => {
  const heading = source.startsWith('# ') || ['Hierarchy:', 'Key concepts:', 'Exploring scenes:', 'Creating objects:', 'Coordinate spaces:', 'Strategies:'].includes(source);
  const pattern = source.split(/\s+/u).map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('\\s+');
  const matcher = new RegExp(heading ? `(^|\\n)([ \\t]*)${pattern}(?=[ \\t]*(?:\\r?\\n|$))` : pattern, 'gu');
  return [matcher, defineRule('mcp.blender', source, localized, { matchMode: 'pattern' }), heading];
});
const HEADER = defineRule('mcp.blender', '### MCP server: blender', '### MCP 服务器：blender');
function translateBody(text, runtime) {
  return RULES.reduce((value, [pattern, rule, heading]) =>
    value.replace(pattern, (match, prefix, indent) => {
      const output = renderRule(rule, [], runtime, match);
      return heading && output !== match ? `${prefix}${indent}${output}` : output;
    }), text);
}

export function translateBlender(text, runtime) {
  if (!componentEnabled(runtime, 'mcp.blender')) return text;
  // 组合提示词中只翻译 Blender 区块，不能把通用标题替换到其他 MCP 的正文中。
  const block = /(^|\n)###\s*MCP\s+(?:server:[ \t]*|服务器：[ \t]*)blender[ \t]*(\r?\n[\s\S]*?)(?=\r?\n###\s*MCP\s+(?:server:|服务器：)|$)/giu;
  let found = false;
  const result = text.replace(block, (_match, prefix, body) => {
    found = true;
    const heading = _match.slice(prefix.length, _match.length - body.length);
    return `${prefix}${renderRule(HEADER, [], runtime, heading)}${translateBody(body, runtime)}`;
  });
  if (found) return result;
  // 单独的服务器指令可能没有 MCP 标题；用明确的开头特征识别。
  return text.trimStart().startsWith(TEXT[0][0]) ? translateBody(text, runtime) : text;
}
