import { STATUS_TEXTS } from '@hydrooj/common/status';
import type { RecordJudgeInfo } from '@hydrooj/common/types';
import {
  addPage, AutoloadPage, getAvailableLangs, i18n, loadMonaco, request, Socket,
} from '@hydrooj/ui-default';
import type * as Monaco from 'monaco-editor';

function initializeCalendar() {
  const grid = document.querySelector<HTMLElement>('[data-copylc-calendar]');
  if (!grid || grid.childElementCount) return;
  const today = new Date();
  const locale = document.documentElement.lang.replace('_', '-');
  const month = document.querySelector<HTMLElement>('[data-copylc-month]');
  if (month) month.textContent = today.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const count = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const fragment = document.createDocumentFragment();
  for (let offset = 0; offset < 7; offset++) {
    const weekday = document.createElement('span');
    weekday.className = 'copylc-muted';
    weekday.textContent = new Date(2024, 0, 7 + offset).toLocaleDateString(locale, { weekday: 'narrow' });
    fragment.appendChild(weekday);
  }
  for (let offset = 0; offset < start.getDay(); offset++) fragment.appendChild(document.createElement('span'));
  for (let day = 1; day <= count; day++) {
    const cell = document.createElement('span');
    cell.textContent = String(day);
    if (day === today.getDate()) {
      cell.className = 'copylc-calendar__today';
      cell.setAttribute('aria-current', 'date');
      cell.setAttribute('aria-label', `${i18n('copylc.today')}: ${day}`);
    }
    fragment.appendChild(cell);
  }
  grid.appendChild(fragment);
}

function initializeDropdowns() {
  const dropdowns = [...document.querySelectorAll<HTMLDetailsElement>('.copylc-dropdown')];
  for (const dropdown of dropdowns) {
    dropdown.addEventListener('toggle', () => {
      if (dropdown.open) dropdowns.filter((other) => other !== dropdown).forEach((other) => { other.open = false; });
    });
    dropdown.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      dropdown.open = false;
      dropdown.querySelector('summary')?.focus();
    });
  }
  document.addEventListener('click', (event) => {
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target as Node)) dropdown.open = false;
    });
  });
}

function initializeProfileTabs() {
  for (const container of document.querySelectorAll<HTMLElement>('.copylc-profile__tabs .section__tab-container')) {
    const header = container.querySelector<HTMLElement>('.section__tab-header');
    if (!header) continue;
    const tabs = [...header.querySelectorAll<HTMLElement>('[data-tab-index]')];
    const panels = [...container.querySelectorAll<HTMLElement>('.section__tab-main')];
    header.setAttribute('role', 'tablist');
    const sync = () => tabs.forEach((tab, index) => {
      const selected = tab.classList.contains('selected');
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[index]?.setAttribute('aria-hidden', String(!selected));
    });
    tabs.forEach((tab, index) => {
      tab.id = `copylc-profile-tab-${index}`;
      tab.setAttribute('role', 'tab');
      if (panels[index]) {
        panels[index].id = `copylc-profile-panel-${index}`;
        panels[index].setAttribute('role', 'tabpanel');
        panels[index].setAttribute('aria-labelledby', tab.id);
        panels[index].tabIndex = 0;
        tab.setAttribute('aria-controls', panels[index].id);
      }
      tab.addEventListener('keydown', (event) => {
        const offsets = { ArrowRight: 1, ArrowLeft: -1 };
        if (event.key in offsets) {
          event.preventDefault();
          const next = tabs[(index + offsets[event.key] + tabs.length) % tabs.length];
          next.focus();
          next.click();
        } else if (['Enter', ' ', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tab;
          next.focus();
          next.click();
        }
      });
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(header, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }
}

function initializeAvatars() {
  const fallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E'
    + '%3Crect width="96" height="96" rx="48" fill="%23414141"/%3E%3Ccircle cx="48" cy="35" r="17" fill="%23b3b3b3"/%3E'
    + '%3Cpath d="M17 88a31 31 0 0 1 62 0" fill="%23b3b3b3"/%3E%3C/svg%3E';
  const selector = '.copylc-profile__avatar, .copylc-dropdown summary img, .copylc-feed-item > img';
  for (const avatar of document.querySelectorAll<HTMLImageElement>(selector)) {
    avatar.addEventListener('error', () => { avatar.src = fallback; }, { once: true });
    if (avatar.complete && !avatar.naturalWidth) avatar.src = fallback;
  }
}

function initializeSearch() {
  const toggle = document.querySelector<HTMLButtonElement>('.omnibar-toggle');
  const account = document.querySelector('.copylc-nav__account');
  if (toggle && account) {
    toggle.type = 'button';
    toggle.setAttribute('aria-label', i18n('Search'));
    account.prepend(toggle);
  }
  const dialog = document.querySelector<HTMLElement>('.omnibar');
  const input = dialog?.querySelector<HTMLInputElement>('input');
  input?.setAttribute('aria-label', i18n('Search'));
  if (!dialog || !toggle) return;
  dialog.id = 'copylc-search-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', i18n('Search'));
  toggle.setAttribute('aria-controls', dialog.id);
  const sync = () => {
    const open = getComputedStyle(dialog).display !== 'none';
    toggle.setAttribute('aria-expanded', String(open));
    if (!open && dialog.contains(document.activeElement)) toggle.focus();
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(dialog, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      toggle.click();
      toggle.focus();
    } else if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll<HTMLElement>('input, a[href], button, [tabindex="0"]')]
        .filter((control) => control.getBoundingClientRect().width > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
}

async function initializeWorkbench() {
  const workbench = document.querySelector<HTMLElement>('[data-copylc-workbench]');
  if (!workbench) return;
  const language = workbench.querySelector<HTMLSelectElement>('#copylc-language');
  const container = workbench.querySelector<HTMLElement>('[data-copylc-editor]');
  const fallback = container.querySelector<HTMLTextAreaElement>('textarea');
  const saveStatus = workbench.querySelector<HTMLElement>('[data-copylc-save]');
  const output = workbench.querySelector<HTMLElement>('[data-copylc-output]');
  const input = workbench.querySelector<HTMLTextAreaElement>('[data-copylc-input]');
  const record = workbench.querySelector<HTMLAnchorElement>('[data-copylc-record]');
  const run = workbench.querySelector<HTMLButtonElement>('[data-copylc-run]');
  const submit = workbench.querySelector<HTMLButtonElement>('[data-copylc-submit]');
  const languages = getAvailableLangs(UiContext.pdoc.config.langs);
  const keys = Object.keys(languages);
  if (!keys.length) {
    run.disabled = true;
    submit.disabled = true;
    output.textContent = i18n('copylc.noLanguages');
    return;
  }
  const cacheKey = `copylc-ui/${UserContext._id}/${UiContext.pdoc.domainId}/${UiContext.pdoc.docId}`;
  let storedLanguage = UiContext.codeLang;
  let code = UiContext.codeTemplate || '';
  try {
    storedLanguage = localStorage.getItem(`${cacheKey}/language`) || storedLanguage;
    code = localStorage.getItem(`${cacheKey}/code`) ?? code;
  } catch {
    saveStatus.textContent = i18n('copylc.unsaved');
  }
  for (const key of keys) language.add(new Option(languages[key].display || key, key));
  language.value = keys.includes(storedLanguage) ? storedLanguage : keys[0];
  fallback.value = code;
  let editor: Monaco.editor.IStandaloneCodeEditor;
  let monaco: typeof Monaco;
  let saveTimer: ReturnType<typeof setTimeout>;
  let socket: Socket;
  let activeRecord = '';
  let pending = false;
  let cooldown: ReturnType<typeof setTimeout>;
  let connected: Promise<boolean>;
  let live = false;
  let closed = false;
  const updates = new Map<string, RecordJudgeInfo & { _id: string }>();

  const renderRecord = (rdoc: RecordJudgeInfo) => {
    const lines = [`${i18n(STATUS_TEXTS[rdoc.status])} · ${rdoc.time}ms · ${rdoc.memory}KiB`];
    if (rdoc.compilerTexts?.length) lines.push(...rdoc.compilerTexts);
    if (rdoc.judgeTexts?.length) {
      lines.push(...rdoc.judgeTexts.map((text) => (typeof text === 'string' ? text : i18n(text.message, ...(text.params || [])))));
    }
    if (rdoc.testCases?.length) lines.push(...rdoc.testCases.map((test) => test.message || '').filter(Boolean));
    output.textContent = lines.join('\n');
  };

  const save = () => {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(`${cacheKey}/code`, editor ? editor.getValue() : fallback.value);
      localStorage.setItem(`${cacheKey}/language`, language.value);
      saveStatus.textContent = i18n('copylc.saved');
    } catch {
      saveStatus.textContent = i18n('copylc.unsaved');
    }
  };
  fallback.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  });
  const updateRun = () => {
    const info = languages[language.value];
    run.hidden = info.pretest === false || (UiContext.pdoc.config.type === 'remote_judge' && !info.pretest && !info.validAs);
  };
  updateRun();
  language.addEventListener('change', () => {
    if (editor) monaco.editor.setModelLanguage(editor.getModel(), languages[language.value].monaco || 'plaintext');
    updateRun();
    save();
  });
  const showRecord = (rid: string) => {
    activeRecord = rid;
    record.href = decodeURIComponent(UiContext.getRecordDetailUrl).replace('{rid}', rid);
    record.hidden = false;
  };
  const connect = () => {
    if (socket) return connected;
    socket = new Socket(UiContext.ws_prefix + UiContext.pretestConnUrl);
    connected = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      socket.onopen = () => {
        live = true;
        clearTimeout(timeout);
        resolve(true);
        if (activeRecord) socket.send(JSON.stringify({ rids: [activeRecord] }));
      };
    });
    socket.onmessage = (_message, data) => {
      try {
        const { rdoc } = JSON.parse(data);
        if (!rdoc) return;
        updates.set(rdoc._id, rdoc);
        if (updates.size > 20) updates.delete(updates.keys().next().value);
        if (rdoc._id === activeRecord) renderRecord(rdoc);
      } catch {
        output.textContent = i18n('copylc.connectionError');
      }
    };
    socket.onclose = () => {
      live = false;
      if (activeRecord && !closed) output.textContent = i18n('copylc.connectionClosed');
    };
    return connected;
  };
  const send = async (pretest: boolean) => {
    if (pending) return;
    pending = true;
    run.disabled = true;
    submit.disabled = true;
    save();
    try {
      await connect();
      const payload = { lang: language.value, code: editor ? editor.getValue() : fallback.value };
      const result = await request.post(UiContext.postSubmitUrl, pretest ? { ...payload, pretest: true, input: [input.value] } : payload);
      showRecord(result.rid);
      output.textContent = i18n(live ? 'copylc.running' : 'copylc.connectionClosed');
      if (updates.has(activeRecord)) renderRecord(updates.get(activeRecord));
      if (live) socket.send(JSON.stringify({ rids: [activeRecord] }));
    } catch (error) {
      output.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      cooldown = setTimeout(() => {
        pending = false;
        run.disabled = false;
        submit.disabled = false;
      }, pretest ? 5000 : 8000);
    }
  };
  run.addEventListener('click', () => send(true));
  submit.addEventListener('click', () => send(false));
  let observer: ResizeObserver;
  let frame = 0;
  let layoutTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('pagehide', () => {
    closed = true;
    save();
    clearTimeout(cooldown);
    clearTimeout(layoutTimer);
    cancelAnimationFrame(frame);
    observer?.disconnect();
    socket?.close();
    const model = editor?.getModel();
    editor?.dispose();
    model?.dispose();
  }, { once: true });
  let host: HTMLDivElement;
  try {
    const loaded = await loadMonaco([languages[language.value].monaco || 'plaintext']);
    if (closed) return;
    monaco = loaded.monaco;
    host = document.createElement('div');
    host.className = 'copylc-monaco';
    container.appendChild(host);
    editor = monaco.editor.create(host, {
      ...loaded.customOptions,
      value: fallback.value,
      language: languages[language.value].monaco || 'plaintext',
      theme: 'vs-dark',
      fontFamily: UserContext.codeFontFamily,
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: false,
      ariaLabel: i18n('Code'),
    });
    loaded.registerAction(editor, editor.getModel());
    fallback.hidden = true;
    editor.onDidChangeModelContent(() => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 300);
    });
    observer = new ResizeObserver(() => {
      clearTimeout(layoutTimer);
      layoutTimer = setTimeout(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => editor.layout());
      }, 120);
    });
    observer.observe(container);
    save();
  } catch {
    editor?.getModel()?.dispose();
    editor?.dispose();
    editor = null;
    host?.remove();
    fallback.hidden = false;
    saveStatus.textContent = i18n('copylc.editorFallback');
  }
}

addPage(new AutoloadPage('copylc-ui', async () => {
  if (!document.documentElement.classList.contains('copylc-ui')) return;
  initializeCalendar();
  initializeDropdowns();
  initializeProfileTabs();
  initializeAvatars();
  initializeSearch();
  window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
  await initializeWorkbench();
}));
