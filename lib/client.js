// 原生 Client 模块：直接提供惰性 CommonJS 工厂，不引入 Node 模块或浏览器存储。
window.__ModuleLoader__.load({
  id: 'dsh-prompt-zh',
  factory: function (require) {
    var React = require('react');
    var h = React.createElement;
    var EMPTY_FORM = Object.freeze({ status: 'unavailable', writable: false, mode: 'memory' });
    var PATH = '/api/prompt-zh/status';
    var CSS = '.pzh-page{max-width:960px;color:var(--dsw-alias-label-primary,inherit);font:inherit;padding:8px 4px 24px}.pzh-page *{box-sizing:border-box}.pzh-page h2{margin:0;font-size:22px}.pzh-page h3{margin:0;font-size:15px}.pzh-note{font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,inherit)}.pzh-toolbar,.pzh-rowhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.pzh-toolbar{position:sticky;top:0;z-index:1;padding:12px;margin:14px 0;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid var(--dsw-alias-border-l4,#8884);border-radius:10px}.pzh-page button,.pzh-page select,.pzh-page input[type=search]{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid var(--dsw-alias-border-l4,#8885);border-radius:6px;padding:6px 10px}.pzh-page button{cursor:pointer}.pzh-page button:disabled{opacity:.45;cursor:not-allowed}.pzh-primary{border-color:var(--dsw-alias-brand-primary,#916200)!important}.pzh-components{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin:14px 0}.pzh-component,.pzh-entry{border:1px solid var(--dsw-alias-border-l4,#8884);border-radius:9px;padding:12px;background:var(--dsw-alias-bg-layer-1,transparent)}.pzh-component label{display:flex;gap:8px;align-items:center}.pzh-badge{display:inline-block;border-radius:4px;padding:2px 6px;font-size:11px;background:var(--dsw-alias-bg-layer-2,#8882);margin:3px 4px 3px 0}.pzh-ok{color:var(--dsw-alias-state-success,#22804a)}.pzh-warn{color:var(--dsw-alias-state-warning,#996600)}.pzh-error{color:var(--dsw-alias-state-error,#c33)}.pzh-list{display:grid;gap:10px}.pzh-entry textarea{width:100%;min-height:125px;resize:vertical;font:inherit;line-height:1.65;color:inherit;background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l4,#8885);border-radius:6px;padding:10px;margin:10px 0}.pzh-entry pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:12px;max-height:240px;overflow:auto}.pzh-filters{display:flex;gap:8px;margin:16px 0}.pzh-filters input{flex:1;min-width:0}.pzh-page :focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#916200);outline-offset:2px}@media(max-width:560px){.pzh-filters{flex-direction:column}.pzh-toolbar{position:static}.pzh-components{grid-template-columns:1fr}}';
    function copyPreferences(value) {
      value = value || {};
      return { disabledComponents: (value.disabledComponents || []).slice(), overrides: Object.assign({}, value.overrides || {}) };
    }
    function fingerprint(value) { return JSON.stringify(copyPreferences(value)); }
    function createDraftController() {
      var listeners = new Set();
      var saved = copyPreferences();
      var state = Object.freeze({ draft: copyPreferences(), revision: null, dirty: false, saving: false, conflict: false, message: '', error: '' });
      function update(patch) {
        var next = Object.assign({}, state, patch);
        next.dirty = fingerprint(next.draft) !== fingerprint(saved);
        state = Object.freeze(next);
        listeners.forEach(function (listener) { listener(); });
      }
      return {
        getSnapshot: function () { return state; },
        subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener); }; },
        observe: function (snapshot) {
          if (snapshot.status !== 'ready') return;
          var value = copyPreferences(snapshot.value && snapshot.value.preferences);
          if (state.revision === null || (!state.dirty && !state.saving)) {
            saved = value;
            update({ draft: copyPreferences(value), revision: snapshot.revision, conflict: false });
          } else if (snapshot.revision !== state.revision && !state.saving) update({ conflict: true });
        },
        edit: function (entry, text) {
          var next = copyPreferences(state.draft);
          if (text === entry.defaultText) delete next.overrides[entry.id];
          else next.overrides[entry.id] = text;
          update({ draft: next, message: '', error: '' });
        },
        toggle: function (id, enabled) {
          var next = copyPreferences(state.draft);
          next.disabledComponents = next.disabledComponents.filter(function (item) { return item !== id; });
          if (!enabled) next.disabledComponents.push(id);
          update({ draft: next, message: '', error: '' });
        },
        restore: function () { update({ draft: copyPreferences(), error: '', message: '已还原草稿；点击保存后才写入 Profile。' }); },
        reload: function (snapshot) {
          if (snapshot.status !== 'ready') return;
          saved = copyPreferences(snapshot.value && snapshot.value.preferences);
          update({ draft: copyPreferences(saved), revision: snapshot.revision, conflict: false, error: '', message: '已载入当前保存值。' });
        },
        save: async function (form, entries) {
          if (!form || state.saving || state.conflict) return false;
          var payload = copyPreferences(state.draft);
          var issue = validateDraft(payload, entries);
          if (issue) { update({ error: issue, message: '' }); return false; }
          update({ saving: true, error: '', message: '' });
          try {
            var accepted = await form.mutate([{ op: 'set', path: ['preferences'], value: payload }], state.revision);
            if (accepted !== true) {
              update({ saving: false, conflict: true, error: '宿主未接受保存，可能存在并发修改或配置验证失败。草稿已保留，请重新载入保存值后再编辑。' });
              return false;
            }
            var snapshot = form.getSnapshot();
            saved = copyPreferences(snapshot.value && snapshot.value.preferences);
            update({ saving: false, revision: snapshot.revision, conflict: false, message: '已保存到当前 Profile；下次对应原文命中时使用新译文。保存成功不代表已经发生替换。' });
            return true;
          } catch (_error) {
            update({ saving: false, error: '保存请求失败，草稿已保留；未确认写入成功。' });
            return false;
          }
        }
      };
    }
    function validateDraft(draft, entries) {
      var lookup = new Map((entries || []).map(function (entry) { return [entry.id, entry]; }));
      for (var pair of Object.entries(draft.overrides)) {
        var entry = lookup.get(pair[0]);
        if (!entry) return '存在未识别的旧译文条目，请还原草稿后重新编辑。';
        if (typeof pair[1] !== 'string' || !pair[1].trim()) return '译文不能为空：' + entry.title;
        var tokens = Array.from(pair[1].matchAll(/\$(\$|&|[1-9]\d?)/g)).filter(function (match) { return /^[1-9]/.test(match[1]); }).map(function (match) { return match[0]; });
        if (entry.placeholders.some(function (token) { return tokens.indexOf(token) < 0; })) return '请保留动态占位符：' + entry.placeholders.join('、');
        if (tokens.some(function (token) { return entry.placeholders.indexOf(token) < 0; })) return '译文包含未知动态占位符。';
      }
      return '';
    }
    function badge(text, kind) { return h('span', { className: 'pzh-badge ' + (kind ? 'pzh-' + kind : '') }, text); }
    function versionLabel(status) { return ({ exact: '精确版本一致', mismatch: '版本不一致', unavailable: '版本不可核验' })[status] || '版本未知'; }
    function matchLabel(mode) { return ({ literal: '固定原文逐字匹配', pattern: '正则模板', section: 'section 名匹配', prefix: '原文前缀', 'guarded-section': 'section 名＋守卫', generated: '按条件生成', derived: '上下文分支' })[mode] || mode; }
    function Entry(props) {
      var entry = props.entry, component = props.component, draft = props.draft;
      var edited = Object.prototype.hasOwnProperty.call(draft.overrides, entry.id);
      var value = edited ? draft.overrides[entry.id] : entry.defaultText;
      var metrics = entry.metrics;
      var enabled = draft.disabledComponents.indexOf(component.id) < 0;
      var state = !enabled ? '组件草稿已关闭' : !entry.active ? '当前版本门控未放行' : component.translateWithoutVersion ? '版本不可核验，按原文守卫翻译' : metrics.replaced > 0 ? '插件阶段输出已改变' : metrics.matched > 0 ? '已命中，输出未改变' : '尚未观察到命中';
      var warning = entry.coverage.indexOf('refresh') >= 0;
      return h('article', { className: 'pzh-entry', 'data-entry-id': entry.id },
        h('div', { className: 'pzh-rowhead' }, h('h3', null, entry.title), badge(edited ? '自定义草稿' : '内置译文')),
        h('div', null, badge(component.label), badge(versionLabel(entry.versionStatus), entry.versionStatus === 'exact' ? 'ok' : 'warn'), badge(matchLabel(entry.matchMode)), badge(state, enabled && entry.active && metrics.replaced > 0 ? 'ok' : 'warn')),
        h('p', { className: 'pzh-note' }, '当前解析包：', component.package || 'MCP 服务器版本来源不可用', ' · ', component.currentVersion || '未知', '；本条已核验版本：', entry.versions.join('、') || '尚无可核验版本基线'),
        h('p', { className: 'pzh-note' }, '当前保存配置累计：命中 ', metrics.matched, ' / 输出改变 ', metrics.replaced, ' / 规则级阻止 ', metrics.blocked, '。分阶段：', Object.entries(metrics.stages || {}).map(function (pair) { return pair[0] + ' 命中 ' + pair[1].matched + ' / 改变 ' + pair[1].replaced; }).join('；') || '尚未处理'),
        metrics.defaulted > 0 ? h('p', { className: 'pzh-note pzh-warn' }, '工具可见性保护：本条自定义译文已临时回退内置值 ', metrics.defaulted, ' 次，再按工具集裁剪；保存值未修改，关联工具齐全时仍使用自定义译文。') : null,
        !entry.active ? h('p', { className: 'pzh-note' }, '组件关闭或版本未放行时不运行原文匹配，零计数不表示放行。') : null,
        warning ? h('p', { className: 'pzh-note pzh-warn' }, '刷新覆盖警告：已保存或插件已替换，不代表最终请求生效；宿主后续可能重新生成英文 context。') : null,
        entry.coverage === 'server-version-unavailable' ? h('p', { className: 'pzh-note pzh-warn' }, component.translateWithoutVersion ? '没有可靠服务器版本证据时，仍按每条原文守卫翻译；未命中的原文保持英文，不使用 MCP 客户端版本冒充服务器版本。' : '未知 MCP 服务器的标题与正文保持原文，不猜译；不使用 MCP 客户端版本冒充服务器版本。') : null,
        h('label', null, h('span', { className: 'pzh-note' }, '替换时实际使用的译文'), h('textarea', {
          'aria-label': '译文：' + entry.title, value: value, disabled: props.saving,
          onChange: function (event) { props.controller.edit(entry, event.target.value); }
        })),
        entry.placeholders.length ? h('p', { className: 'pzh-note' }, '必须保留 ', entry.placeholders.join('、'), '；可调整位置，实际捕获值不会显示在诊断中。') : null,
        h('button', { type: 'button', disabled: props.saving || !edited, onClick: function () { props.controller.edit(entry, entry.defaultText); } }, '还原此条草稿'),
        h('details', null, h('summary', { className: 'pzh-note' }, '查看内置默认值与匹配依据'), h('pre', null, entry.defaultText), h('pre', null, entry.source), h('small', { className: 'pzh-note' }, entry.id)));
    }
    function SettingsPage(props) {
      var forms = React.useSyncExternalStore(props.formsStore.subscribe, props.formsStore.getSnapshot, props.formsStore.getSnapshot);
      var controller = React.useMemo(createDraftController, []);
      var state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
      var dataState = React.useState(null), data = dataState[0], setData = dataState[1];
      var errorState = React.useState(''), error = errorState[0], setError = errorState[1];
      var groupState = React.useState('core'), group = groupState[0], setGroup = groupState[1];
      var searchState = React.useState(''), search = searchState[0], setSearch = searchState[1];
      var tickState = React.useState(0), tick = tickState[0], setTick = tickState[1];
      var alive = React.useRef(true);
      React.useEffect(function () { alive.current = true; return function () { alive.current = false; }; }, []);
      React.useEffect(function () {
        var ignore = false;
        var abort = new AbortController();
        fetch(PATH, { credentials: 'same-origin', headers: { accept: 'application/json' }, signal: abort.signal })
          .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
          .then(function (value) { if (!ignore) { setData(value); setError(''); } })
          .catch(function (failure) { if (!ignore) setError('无法读取插件状态（' + (failure.message || '请求失败') + '）；请确认 Host 已加载插件且浏览器已认证。'); });
        return function () { ignore = true; abort.abort(); };
      }, [tick]);
      var form = React.useMemo(function () {
        return data && forms ? forms.get(data.namespace) : null;
      }, [forms, data && data.namespace]);
      var formStore = React.useMemo(function () {
        return form ? { subscribe: function (listener) { return form.subscribe(listener); }, getSnapshot: function () { return form.getSnapshot(); } }
          : { subscribe: function () { return function () {}; }, getSnapshot: function () { return EMPTY_FORM; } };
      }, [form]);
      var snapshot = React.useSyncExternalStore(formStore.subscribe, formStore.getSnapshot, formStore.getSnapshot);
      React.useEffect(function () { controller.observe(snapshot); }, [controller, snapshot]);
      var canSave = snapshot.status === 'ready' && snapshot.writable && snapshot.mode === 'host' && !state.saving && !state.conflict;
      if (!data) return h('section', { className: 'pzh-page' }, h('h2', null, 'Prompt ZH · 译文设置'), h('p', { role: error ? 'alert' : 'status' }, error || '正在读取内置条目与 Profile 状态…'), h('button', { onClick: function () { setTick(tick + 1); } }, '重新读取'));
      var lookup = new Map(data.components.map(function (component) { return [component.id, component]; }));
      var filtered = data.entries.filter(function (entry) { return (group === 'all' || entry.component === group) && (!search || (entry.title + entry.id + entry.defaultText).toLowerCase().indexOf(search.toLowerCase()) >= 0); });
      return h('section', { className: 'pzh-page' },
        h('h2', null, 'Prompt ZH · 译文设置'),
        h('p', { className: 'pzh-note' }, data.entries.length, ' 个内置条目 · 当前 Profile 配置项 ', data.namespace, '。只编辑实际替换用的译文，不新增或修改原文匹配规则。'),
        h('p', { className: 'pzh-note' }, '所有命中／替换信号仅来自插件阶段，不保证宿主刷新后的最终请求。解析包版本也不代表旧模块已重新加载。'),
        error ? h('p', { role: 'alert', className: 'pzh-error' }, error) : null,
        data.configurationError ? h('p', { role: 'alert', className: 'pzh-error' }, '当前配置无效，翻译已停用；请还原草稿并保存，或核查旧条目。') : null,
        h('div', { className: 'pzh-toolbar' },
          h('span', { className: 'pzh-note' }, state.dirty ? '有未保存的修改' : '草稿与保存值一致'),
          h('div', null,
            h('button', { type: 'button', className: 'pzh-primary', disabled: !canSave || (!state.dirty && !data.configurationError), onClick: function () { controller.save(form, data.entries).then(function (accepted) { if (accepted && alive.current) setTick(function (n) { return n + 1; }); }); } }, state.saving ? '正在保存…' : '保存到当前 Profile'), ' ',
            h('button', { type: 'button', disabled: state.saving, onClick: controller.restore }, '还原全部草稿'), ' ',
            h('button', { type: 'button', disabled: state.saving, onClick: function () { if (!state.dirty || window.confirm('载入保存值将丢弃当前草稿，是否继续？')) controller.reload(snapshot); } }, '载入保存值'), ' ',
            h('button', { type: 'button', onClick: function () { setTick(function (n) { return n + 1; }); } }, '刷新信号'))),
        snapshot.status !== 'ready' || snapshot.mode !== 'host' || !snapshot.writable ? h('p', { className: 'pzh-warn', role: 'status' }, '当前没有可写的宿主 Profile 表单；不会以浏览器本地存储冒充保存。') : null,
        state.conflict ? h('p', { className: 'pzh-warn', role: 'alert' }, '保存值的修订已变化或上次保存被拒绝。草稿保留，请载入当前保存值后再编辑。') : null,
        state.error ? h('p', { className: 'pzh-error', role: 'alert' }, state.error) : null,
        state.message ? h('p', { className: 'pzh-note', role: 'status' }, state.message) : null,
        h('details', null, h('summary', null, '组件开关与精确版本（', data.components.length, ' 个区块）'), h('div', { className: 'pzh-components' }, data.components.map(function (component) {
          return h('div', { key: component.id, className: 'pzh-component' },
            h('label', null, h('input', { type: 'checkbox', checked: state.draft.disabledComponents.indexOf(component.id) < 0, disabled: state.saving, onChange: function (event) { controller.toggle(component.id, event.target.checked); } }), component.label),
            badge(versionLabel(component.versionStatus), component.versionStatus === 'exact' ? 'ok' : 'warn'),
            h('div', { className: 'pzh-note' }, '解析：', component.currentVersion || '未知', ' · 核验：', component.versions.join('、') || '未提供'));
        }))),
        h('div', { className: 'pzh-filters' }, h('select', { 'aria-label': '译文区块', value: group, onChange: function (event) { setGroup(event.target.value); } }, h('option', { value: 'all' }, '所有区块'), data.components.map(function (component) { return h('option', { key: component.id, value: component.id }, component.label); })), h('input', { type: 'search', 'aria-label': '搜索译文条目', placeholder: '搜索译文、标题或条目 ID', value: search, onChange: function (event) { setSearch(event.target.value); } })),
        h('p', { className: 'pzh-note' }, '显示 ', filtered.length, ' 条；还原按钮只改变草稿。工具名、参数结构与动态占位符保持原状。'),
        h('div', { className: 'pzh-list' }, filtered.map(function (entry) { return h(Entry, { key: entry.id, entry: entry, component: lookup.get(entry.component), draft: state.draft, saving: state.saving, controller: controller }); })));
    }
    function apply(ctx) {
      var forms = null;
      var listeners = new Set();
      var formsStore = {
        subscribe: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },
        getSnapshot: function () { return forms; }
      };
      function setForms(value) { forms = value; listeners.forEach(function (fn) { fn(); }); }
      ctx.inject(['configForms'], function (scope) {
        setForms(scope.configForms);
        scope.effect(function () { return function () { setForms(null); }; }, 'prompt-zh: form dependency');
      });
      ctx.effect(function () {
        var style = document.createElement('style'); style.dataset.pluginCss = 'dsh-prompt-zh'; style.textContent = CSS;
        document.head.appendChild(style); return function () { style.remove(); };
      }, 'prompt-zh: settings styles');
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({ name: 'settings.section', id: 'dsh-prompt-zh', order: 66, label: function () { return 'Prompt ZH'; } }, function () { return h(SettingsPage, { formsStore: formsStore }); });
      });
      ctx.slots.inject('plugins.bundle.config', function () {
        return ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-prompt-zh' }, function () { return h(SettingsPage, { formsStore: formsStore }); });
      });
    }
    return { name: 'dsh-prompt-zh/client', inject: ['slots'], apply: apply, createDraftController: createDraftController, validateDraft: validateDraft };
  }
});
