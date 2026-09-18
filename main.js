(() => {
  'use strict';

  const K = {
    THEME: 'leonard.theme',
    READ: 'leonard.read',
    FAV: 'leonard.fav',
    CUR: 'leonard.current',
    STREAK: 'leonard.streak',
    SCROLL: 'leonard.scroll',
    NOTES: 'leonard.notes',
    COURSE: 'leonard.course',
    SEARCH_HISTORY: 'leonard.search.history',
  };

  const state = {
    theme: 'system',
    readLessons: new Set(),
    favorites: new Set(),
    verified: new Set(),
    currentCourseId: null,
    courses: [],
    currentLesson: null,
    view: 'lesson',
    lessons: [],
    cache: {},
    sidebarOpen: false,
    ctxLesson: null,
    searchFilters: new Set(),
    searchHistoryByCourse: {},
    searchHistory: [],
    paletteOpen: false,
    paletteItems: [],
    paletteSelected: 0,
    notes: {},
    streak: { count: 0, lastDay: null },
    scrollPositions: {},
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const el = {
    html: document.documentElement,
    themeBtn: $('#themeBtn'),
    themeIcon: $('#themeIcon'),
    logoLink: $('#logoLink'),
    logoIcon: $('#logoIcon'),
    logoText: $('#logoText'),
    courseSwitch: $('#courseSwitch'),
    courseMenu: $('#courseMenu'),
    lessonList: $('#lessonList'),
    sidebar: $('#sidebar'),
    sidebarOverlay: $('#sidebarOverlay'),
    sidebarCount: $('#sidebarCount'),
    hamburger: $('#hamburger'),
    lessonView: $('#lessonView'),
    searchView: $('#searchView'),
    favoritesView: $('#favoritesView'),
    lessonChip: $('#lessonChip'),
    lessonTimeChip: $('#lessonTimeChip'),
    lessonTimeText: $('#lessonTimeText'),
    lessonFavChip: $('#lessonFavChip'),
    lessonTitle: $('#lessonTitle'),
    lessonBody: $('#lessonBody'),
    nextBtn: $('#nextBtn'),
    nextBtnText: $('#nextBtnText'),
    contentArea: $('#contentArea'),
    searchBar: $('#searchBar'),
    searchStage: $('.search-stage'),
    searchInput: $('#searchInput'),
    searchResults: $('#searchResults'),
    searchClear: $('#searchClear'),
    searchFilters: $('#searchFilters'),
    searchChips: $('#searchChips'),
    favGrid: $('#favGrid'),
    heatmap: $('#heatmap'),
    contextMenu: $('#contextMenu'),
    ctxFavBtn: $('#ctxFavBtn'),
    ctxFavIcon: $('#ctxFavIcon'),
    ctxFavText: $('#ctxFavText'),
    ctxResetBtn: $('#ctxResetBtn'),
    toast: $('#toast'),
    hljsTheme: $('#hljsTheme'),
    navBtns: $$('.nav-btn[data-view]'),
    readProgress: $('#readProgress'),
    lessonContext: $('#lessonContext'),
    lessonContextNum: $('#lessonContextNum'),
    lessonContextTitle: $('#lessonContextTitle'),
    lessonContextTime: $('#lessonContextTime'),
    streakBadge: $('#streakBadge'),
    streakCount: $('#streakCount'),
    toc: $('#toc'),
    tocInner: $('#tocInner'),
    minimap: $('#minimap'),
    paletteOverlay: $('#paletteOverlay'),
    paletteBox: $('#paletteBox'),
    paletteInput: $('#paletteInput'),
    paletteResults: $('#paletteResults'),
    paletteClose: $('#paletteClose'),
    shortcutsOverlay: $('#shortcutsOverlay'),
    shortcutsClose: $('#shortcutsClose'),
    quoteMenu: $('#quoteMenu'),
    quoteBtn: $('#quoteBtn'),
  };

  const keyOf = (n) => `${state.currentCourseId}:${n}`;
  const parseKey = (key) => {
    const i = key.indexOf(':');
    if (i === -1) return { course: 'cpp', lesson: Number(key) };
    return { course: key.slice(0, i), lesson: Number(key.slice(i + 1)) };
  };

  const migrateLegacy = () => {
    if (localStorage.getItem('leonard.migrated-v2')) return;

    const read = JSON.parse(localStorage.getItem(K.READ) || '[]');
    const fav = JSON.parse(localStorage.getItem(K.FAV) || '[]');
    const notes = JSON.parse(localStorage.getItem(K.NOTES) || '{}');
    const cur = localStorage.getItem(K.CUR);

    if (read.length && typeof read[0] === 'number') {
      localStorage.setItem(K.READ, JSON.stringify(read.map(n => `cpp:${n}`)));
    }
    if (fav.length && typeof fav[0] === 'number') {
      localStorage.setItem(K.FAV, JSON.stringify(fav.map(n => `cpp:${n}`)));
    }
    const newNotes = {};
    for (const k in notes) {
      if (/^\d+$/.test(k)) newNotes[`cpp:${k}`] = notes[k];
      else newNotes[k] = notes[k];
    }
    localStorage.setItem(K.NOTES, JSON.stringify(newNotes));
    if (cur && /^\d+$/.test(cur)) {
      localStorage.setItem(K.CUR + ':cpp', cur);
      localStorage.removeItem(K.CUR);
    }

    localStorage.setItem('leonard.migrated-v2', '1');
  };

  const loadState = () => {
    try {
      migrateLegacy();
      state.theme = localStorage.getItem(K.THEME) || 'system';
      state.readLessons = new Set(JSON.parse(localStorage.getItem(K.READ) || '[]'));
      state.favorites = new Set(JSON.parse(localStorage.getItem(K.FAV) || '[]'));
      state.streak = JSON.parse(localStorage.getItem(K.STREAK) || '{"count":0,"lastDay":null}');
      state.scrollPositions = JSON.parse(localStorage.getItem(K.SCROLL) || '{}');
      state.notes = JSON.parse(localStorage.getItem(K.NOTES) || '{}');

      const rawHistory = JSON.parse(localStorage.getItem(K.SEARCH_HISTORY) || '{}');
      if (Array.isArray(rawHistory)) {
        state.searchHistoryByCourse = { cpp: rawHistory };
      } else if (rawHistory && typeof rawHistory === 'object') {
        state.searchHistoryByCourse = rawHistory;
      } else {
        state.searchHistoryByCourse = {};
      }
    } catch (e) {
      console.warn('Storage load error', e);
    }
  };

  const persist = (key, val) => {
    try {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  };

  const getCourseHistory = (cid = state.currentCourseId) => {
    return state.searchHistoryByCourse[cid] || [];
  };

  const setCourseHistory = (cid, arr) => {
    state.searchHistoryByCourse[cid] = arr.slice(0, 8);
    persist(K.SEARCH_HISTORY, state.searchHistoryByCourse);
    if (cid === state.currentCourseId) {
      state.searchHistory = state.searchHistoryByCourse[cid];
    }
  };

  const pushSearchHistory = (q) => {
    const clean = q.trim();
    if (!clean || clean.length < 2) return;
    const cid = state.currentCourseId;
    const current = getCourseHistory(cid);
    const next = [clean, ...current.filter(x => x !== clean)];
    setCourseHistory(cid, next);
  };

  const removeSearchHistory = (q) => {
    const cid = state.currentCourseId;
    const next = getCourseHistory(cid).filter(x => x !== q);
    setCourseHistory(cid, next);
    renderSearchSuggestions();
  };

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const updateStreak = () => {
    const today = todayKey();
    const last = state.streak.lastDay;
    if (last === today) return;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterday = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
    if (last === yesterday) state.streak.count += 1;
    else state.streak.count = 1;
    state.streak.lastDay = today;
    persist(K.STREAK, state.streak);
    renderStreak();
  };

  const renderStreak = () => {
    if (state.streak.count > 0) {
      el.streakBadge.hidden = false;
      el.streakCount.textContent = state.streak.count;
    } else {
      el.streakBadge.hidden = true;
    }
  };

  const resolveTheme = (pref) => {
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (pref === 'auto') {
      const h = new Date().getHours();
      return (h >= 22 || h < 7) ? 'dark' : 'light';
    }
    return pref;
  };

  const applyTheme = (theme, withTransition = true) => {
    state.theme = theme;
    persist(K.THEME, theme);
    const resolved = resolveTheme(theme);
    const isDark = resolved === 'dark';

    if (withTransition) {
      document.documentElement.classList.add('theme-switching');
      setTimeout(() => document.documentElement.classList.remove('theme-switching'), 320);
    }

    el.html.setAttribute('data-theme', resolved);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? '#0f0f14' : '#fafafa');

    const iconMap = { system: 'monitor', auto: 'clock', light: 'sun', dark: 'moon' };
    el.themeIcon.className = 'ico-' + (iconMap[theme] || 'monitor');

    if (el.hljsTheme) {
      el.hljsTheme.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css';
    }
  };

  const cycleTheme = () => {
    const order = ['system', 'light', 'dark', 'auto'];
    const next = order[(order.indexOf(state.theme) + 1) % order.length];
    applyTheme(next, true);
    const labels = {
      system: 'Системная тема',
      light: 'Светлая тема',
      dark: 'Тёмная тема',
      auto: 'Авто (день/ночь)',
    };
    showToast(labels[next]);
  };

  const isVerified = (n) => state.verified.has(n);
  const isRead = (n) => state.readLessons.has(keyOf(n));
  const isFav = (n) => state.favorites.has(keyOf(n));

  const isUnlocked = (n) => {
    const idx = state.lessons.indexOf(n);
    if (idx <= 0) return true;
    for (let i = 0; i < idx; i++) {
      if (!state.readLessons.has(keyOf(state.lessons[i]))) return false;
    }
    return true;
  };

  const unlockedLessons = () => state.lessons.filter(isUnlocked);

  const extractTitle = (md) => {
    const m = md.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : null;
  };

  const estimateReadingTime = (md) => {
    const words = md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  };

  const cleanMarkdown = (md) => md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const extractCodeText = (md) => {
    const codes = md.match(/```[\s\S]*?```/g) || [];
    return codes.join(' ').replace(/```[a-z]*/gi, ' ');
  };

  const isHttpContext = () => location.protocol === 'http:' || location.protocol === 'https:';

  const fetchLesson = async (n) => {
    const cid = state.currentCourseId;
    const ck = keyOf(n);
    if (state.cache[ck]) return state.cache[ck];

    let raw = null;

    if (isHttpContext()) {
      try {
        const url = `courses/${cid}/lessons/${n}.md`;
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
        raw = await res.text();
      } catch (e) {
        console.warn(`[leonard] fetch не удался для ${cid}/${n}:`, e.message);
      }
    }

    if (raw == null && window.__LESSONS__?.[cid]?.[n] != null) {
      raw = window.__LESSONS__[cid][n];
    }

    if (raw == null) {
      const hint = isHttpContext()
        ? `Проверь, что файл courses/${cid}/lessons/${n}.md существует.`
        : `Открыто как file:// – fetch не работает. Запусти локальный сервер.`;
      throw new Error(`Урок ${n} не найден. ${hint}`);
    }

    const html = marked.parse(raw);
    const title = extractTitle(raw) || `Урок ${n}`;
    const minutes = estimateReadingTime(raw);
    state.cache[ck] = { raw, html, title, minutes };
    return state.cache[ck];
  };

  const prefetchAll = async () => {
    await Promise.allSettled(state.lessons.map(n =>
      fetchLesson(n).then(() => renderSidebar()).catch(() => {})
    ));
    if (state.view === 'favorites') renderHeatmap();
  };

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const slugify = (s) => s
    .toLowerCase()
    .replace(/[^\w\u0400-\u04ff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const renderSidebar = () => {
    el.sidebarCount.textContent = state.lessons.length;
    el.lessonList.innerHTML = '';
    state.lessons.forEach(n => {
      const unlocked = isUnlocked(n);
      const read = isRead(n);
      const fav = isFav(n);
      const active = state.currentLesson === n;
      const verified = isVerified(n);

      const li = document.createElement('li');
      li.className = 'lesson-item';
      if (!unlocked) li.classList.add('locked');
      if (read) li.classList.add('read');
      if (fav) li.classList.add('favorite');
      if (active) li.classList.add('active');
      li.dataset.lesson = n;

      const title = state.cache[keyOf(n)]?.title || `Урок ${n}`;

      li.innerHTML = `
        <span class="lesson-num">${n}</span>
        <span class="lesson-name">${escapeHtml(title)}</span>
        <span class="lesson-icons">
          ${read && verified ? '<i class="ico-check"></i>' : ''}
          <i class="ico-star"></i>
          <i class="ico-lock"></i>
        </span>
      `;
      el.lessonList.appendChild(li);
    });
  };

  const processLessonHtml = (html) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;

    wrap.querySelectorAll('h1').forEach(h => h.style.display = 'none');

    wrap.querySelectorAll('h2, h3, h4').forEach((h, i) => {
      const text = h.textContent.trim();
      let id = h.id || slugify(text);
      if (!id) id = 'section-' + i;
      let uniq = id;
      let c = 1;
      while (wrap.querySelector(`#${CSS.escape(uniq)}`) && wrap.querySelector(`#${CSS.escape(uniq)}`) !== h) {
        uniq = `${id}-${c++}`;
      }
      h.id = uniq;
      const a = document.createElement('a');
      a.className = 'anchor-link';
      a.href = `#${uniq}`;
      h.insertBefore(a, h.firstChild);
    });

    return wrap.innerHTML;
  };

  const attachCopyButtons = () => {
    el.lessonBody.querySelectorAll('pre').forEach(pre => {
      if (pre.dataset.copyReady) return;
      pre.dataset.copyReady = '1';
      pre.style.position = 'relative';

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.setAttribute('aria-label', 'Копировать код');
      btn.setAttribute('title', 'Копировать');
      btn.innerHTML = '<i class="ico-copy"></i>';

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        const code = pre.querySelector('code');
        if (!code) return;

        const text = code.textContent;

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
          } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }

          btn.classList.add('copied');
          btn.innerHTML = '<i class="ico-check"></i>';
          btn.setAttribute('title', 'Скопировано');

          clearTimeout(btn._copyTimer);
          btn._copyTimer = setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="ico-copy"></i>';
            btn.setAttribute('title', 'Копировать');
          }, 1600);
        } catch (err) {
          showToast('Не удалось скопировать');
        }
      });

      pre.appendChild(btn);
    });
  };

  const renderToc = () => {
    const headings = [...el.lessonBody.querySelectorAll('h2, h3')];
    if (headings.length < 2 || window.innerWidth < 1200) {
      el.toc.hidden = true;
      return;
    }
    el.toc.hidden = false;
    el.tocInner.innerHTML = '<div class="toc-title">Содержание</div>';
    headings.forEach(h => {
      const a = document.createElement('a');
      a.className = 'toc-link' + (h.tagName === 'H3' ? ' level-3' : '');
      a.href = `#${h.id}`;
      a.textContent = h.textContent.replace(/^#\s*/, '');
      a.dataset.target = h.id;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      el.tocInner.appendChild(a);
    });
    renderMinimap();
  };

  const renderMinimap = () => {
    const headings = [...el.lessonBody.querySelectorAll('h2, h3')];
    if (headings.length < 2) {
      el.minimap.innerHTML = '';
      return;
    }
    el.minimap.innerHTML = '';
    headings.forEach(h => {
      const seg = document.createElement('div');
      seg.className = 'minimap-seg';
      seg.dataset.target = h.id;
      seg.style.flex = '1';
      seg.title = h.textContent.trim();
      seg.addEventListener('click', () => {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      el.minimap.appendChild(seg);
    });
  };

  const updateTocActive = () => {
    const links = $$('.toc-link', el.tocInner);
    if (!links.length) return;
    const containerTop = el.contentArea.getBoundingClientRect().top;
    let activeId = null;
    for (const link of links) {
      const h = document.getElementById(link.dataset.target);
      if (!h) continue;
      const rect = h.getBoundingClientRect();
      if (rect.top - containerTop <= 120) activeId = link.dataset.target;
      else break;
    }
    links.forEach(l => l.classList.toggle('active', l.dataset.target === activeId));
    $$('.minimap-seg', el.minimap).forEach(s => {
      s.classList.toggle('active', s.dataset.target === activeId);
    });
  };

  const updateReadProgress = () => {
    const area = el.contentArea;
    if (state.view !== 'lesson') {
      el.readProgress.style.width = '0%';
      return;
    }
    const max = area.scrollHeight - area.clientHeight;
    if (max <= 0) {
      el.readProgress.style.width = '100%';
      return;
    }
    const pct = Math.min(100, Math.max(0, (area.scrollTop / max) * 100));
    el.readProgress.style.width = pct + '%';
  };

  const unwrapSpan = (span) => {
    if (!span.parentNode) return;
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  };

  const scrollToElement = (target) => {
    const rect = target.getBoundingClientRect();
    const areaRect = el.contentArea.getBoundingClientRect();
    const top = el.contentArea.scrollTop + (rect.top - areaRect.top) - 140;
    el.contentArea.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const scrollToBlockMatch = (needle) => {
    const blocks = el.lessonBody.querySelectorAll('p, li, h2, h3, h4, blockquote, td, th');
    for (const block of blocks) {
      if (!block.textContent.toLowerCase().includes(needle)) continue;
      block.classList.add('match-flash-block');
      scrollToElement(block);
      setTimeout(() => block.classList.remove('match-flash-block'), 2200);
      return true;
    }
    return false;
  };

  const scrollToMatch = (query) => {
    if (!query) return;
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return;

    const walker = document.createTreeWalker(
      el.lessonBody,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.anchor-link, .code-copy-btn, .note-marker')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.nodeValue.toLowerCase().includes(needle)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const node = walker.nextNode();
    if (!node) {
      scrollToBlockMatch(needle);
      return;
    }

    const idx = node.nodeValue.toLowerCase().indexOf(needle);
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + needle.length);

    const span = document.createElement('span');
    span.className = 'match-flash';
    try {
      range.surroundContents(span);
    } catch (e) {
      scrollToBlockMatch(needle);
      return;
    }

    scrollToElement(span);
    setTimeout(() => unwrapSpan(span), 2200);
  };

  const renderLesson = async (n, opts = {}) => {
    if (!isUnlocked(n)) {
      showToast('Сначала пройдите предыдущий урок');
      return;
    }

    if (state.currentLesson != null && state.currentLesson !== n) {
      state.scrollPositions[keyOf(state.currentLesson)] = el.contentArea.scrollTop;
      persist(K.SCROLL, state.scrollPositions);
    }

    state.currentLesson = n;
    persist(K.CUR + ':' + state.currentCourseId, n);
    renderSidebar();
    switchView('lesson');
    updateFavChip();
    updateNextButton();

    el.contentArea.scrollTop = 0;
    updateReadProgress();

    el.lessonChip.textContent = `Урок ${n}`;
    el.lessonTitle.textContent = 'Загрузка…';
    el.lessonTimeChip.hidden = true;
    el.lessonFavChip.hidden = true;
    el.lessonBody.innerHTML = '<div class="loader"><span></span><span></span><span></span></div>';

    const minLoaderTime = new Promise(r => setTimeout(r, 400));
    let lessonError = null;
    if (!state.cache[keyOf(n)]) {
      try {
        await fetchLesson(n);
      } catch (err) {
        lessonError = err;
      }
    }
    await minLoaderTime;

    if (lessonError) {
      el.lessonTitle.textContent = 'Ошибка';
      el.lessonBody.innerHTML =
        `<p style="color:var(--danger)">Не удалось загрузить урок: ${escapeHtml(lessonError.message)}</p>`;
      return;
    }

    renderLessonContent(n);

    if (opts.matchQuery) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => scrollToMatch(opts.matchQuery), 80);
        });
      });
    }
  };

  const renderLessonContent = (n) => {
    const lesson = state.cache[keyOf(n)];
    if (!lesson) return;
    el.lessonChip.textContent = `Урок ${n}`;
    el.lessonTitle.textContent = lesson.title;
    el.lessonTimeText.textContent = `${lesson.minutes} мин`;
    el.lessonTimeChip.hidden = false;
    el.lessonBody.innerHTML = processLessonHtml(lesson.html);

    el.lessonBody.querySelectorAll('pre code').forEach(block => {
      try { hljs.highlightElement(block); } catch (e) {}
    });

    attachCopyButtons();

    el.lessonBody.querySelectorAll('p').forEach(p => {
      if (p.closest('blockquote, pre, li')) return;
      const text = p.textContent.trim().slice(0, 40);
      if (!text) return;
      const notes = state.notes[keyOf(n)] || {};
      if (notes[text]) attachNoteMarker(p, n, text);
      p.addEventListener('dblclick', (e) => {
        if (e.target.closest('a, code, .note-marker')) return;
        openNotePopover(p, n, text);
      });
    });

    renderToc();
    updateLessonContext();
    updateNextButton();
    updateFavChip();

    void el.lessonBody.offsetHeight;
  };

  const updateLessonContext = () => {
    const n = state.currentLesson;
    if (!n || state.view !== 'lesson') {
      el.lessonContext.hidden = true;
      return;
    }
    const lesson = state.cache[keyOf(n)];
    el.lessonContextNum.textContent = `Урок ${n}`;
    el.lessonContextTitle.textContent = lesson?.title || '…';
    el.lessonContextTime.textContent = lesson ? `${lesson.minutes} мин` : '–';
    el.lessonContext.hidden = state.view !== 'lesson' || el.contentArea.scrollTop < 60;
  };

  const updateFavChip = () => {
    const n = state.currentLesson;
    if (!n) { el.lessonFavChip.hidden = true; return; }
    el.lessonFavChip.hidden = !isFav(n);
  };

  const updateNextButton = () => {
    const n = state.currentLesson;
    if (!n) return;
    if (isRead(n)) {
      el.nextBtn.disabled = true;
      el.nextBtnText.textContent = 'Прочитано';
    } else {
      el.nextBtn.disabled = false;
      el.nextBtnText.textContent = 'Дальше';
    }
  };

  const flyCheckmark = (from, to) => {
    const icon = document.createElement('div');
    icon.className = 'checkmark-fly';
    icon.textContent = 'check';
    icon.style.left = from.x + 'px';
    icon.style.top = from.y + 'px';
    document.body.appendChild(icon);
    requestAnimationFrame(() => {
      icon.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(1.6)`;
      icon.style.opacity = '0';
    });
    setTimeout(() => icon.remove(), 600);
  };

  const goNext = () => {
    const n = state.currentLesson;
    if (!n || isRead(n)) return;

    const btnRect = el.nextBtn.getBoundingClientRect();
    const numEl = el.lessonList.querySelector(`[data-lesson="${n}"] .lesson-num`);
    if (numEl) {
      const r = numEl.getBoundingClientRect();
      flyCheckmark(
        { x: btnRect.left + btnRect.width / 2, y: btnRect.top + btnRect.height / 2 },
        { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      );
    }

    state.readLessons.add(keyOf(n));
    persist(K.READ, [...state.readLessons]);
    renderSidebar();
    updateNextButton();

    const idx = state.lessons.indexOf(n);
    const next = state.lessons[idx + 1];

    if (next && isUnlocked(next)) {
      setTimeout(() => renderLesson(next), 260);
    } else {
      showToast('Все доступные уроки прочитаны');
    }
  };

  const goPrev = () => {
    const n = state.currentLesson;
    if (!n) return;
    const idx = state.lessons.indexOf(n);
    if (idx <= 0) return;
    const prev = state.lessons[idx - 1];
    if (isUnlocked(prev)) renderLesson(prev);
  };

  const goNextLesson = () => {
    const n = state.currentLesson;
    if (!n) return;
    const idx = state.lessons.indexOf(n);
    const next = state.lessons[idx + 1];
    if (next && isUnlocked(next)) renderLesson(next);
    else showToast('Дальше уроков нет');
  };

  const openLastUnlocked = () => {
    const unlocked = unlockedLessons();
    const last = unlocked[unlocked.length - 1];
    if (last) renderLesson(last);
    switchView('lesson');
  };

  const switchView = (view) => {
    state.view = view;
    el.lessonView.hidden = view !== 'lesson';
    el.searchView.hidden = view !== 'search';
    el.favoritesView.hidden = view !== 'favorites';
    if (view !== 'lesson') el.toc.hidden = true;

    el.navBtns.forEach(b => {
      b.classList.toggle('active',
        (view === 'lesson' && b.dataset.view === 'lessons') ||
        (view === 'search' && b.dataset.view === 'search') ||
        (view === 'favorites' && b.dataset.view === 'favorites'));
    });

    el.contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    updateReadProgress();
    updateLessonContext();

    if (view === 'favorites') { renderFavorites(); renderHeatmap(); }
    if (view === 'search') {
      setTimeout(() => {
        el.searchInput.focus();
        el.searchInput.style.height = 'auto';
      }, 120);
    }
    if (view === 'lesson') setTimeout(renderToc, 50);
  };

  let searchTimeout;

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const findMatches = (text, query, limit = 4) => {
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    const matches = [];
    let idx = 0;
    while (matches.length < limit) {
      const found = lower.indexOf(q, idx);
      if (found === -1) break;
      const start = Math.max(0, found - 60);
      const end = Math.min(text.length, found + q.length + 120);
      matches.push({
        start: found,
        snippet: (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : ''),
      });
      idx = found + q.length;
    }
    return matches;
  };

  const parseSmartQuery = (raw) => {
    const tokens = raw.trim().split(/\s+/);
    const filters = [];
    const words = [];
    let numberRange = null;

    for (const t of tokens) {
      const m = t.match(/^(code|unread|fav|title|lessons):(.+)$/i);
      if (m) {
        const key = m[1].toLowerCase();
        const val = m[2];
        if (key === 'lessons') {
          const range = val.match(/^(\d+)(?:-(\d+))?$/);
          if (range) {
            const from = parseInt(range[1], 10);
            const to = range[2] ? parseInt(range[2], 10) : from;
            numberRange = [from, to];
          }
        } else {
          filters.push({ key, value: val });
        }
      } else {
        words.push(t);
      }
    }

    return {
      words: words.join(' ').trim(),
      filters,
      numberRange,
    };
  };

  const renderSearchThinking = () => {
    el.searchResults.innerHTML = `
      <div class="search-thinking">
        <span>Ищу совпадения</span>
        <span class="search-thinking-dots"><span></span><span></span><span></span></span>
      </div>
    `;
  };

  const renderNoResults = (raw) => {
    const suggestions = state.lessons
      .filter(isUnlocked)
      .slice(0, 3)
      .map(n => state.cache[keyOf(n)]?.title || `Урок ${n}`);

    el.searchResults.innerHTML = `
      <div class="search-empty">
        <i class="ico-search"></i>
        <p style="margin-bottom:6px;">Ничего не найдено по запросу «${escapeHtml(raw)}»</p>
        ${suggestions.length ? `<p style="font-size:12.5px;color:var(--text-soft);">Попробуйте: ${suggestions.map(escapeHtml).join(' · ')}</p>` : ''}
      </div>
    `;
  };

  const renderSearchChips = () => {
    if (!el.searchChips) return;
    const course = state.courses.find(c => c.id === state.currentCourseId);
    const chips = (course?.searchChips && course.searchChips.length)
      ? course.searchChips
      : ['указатели', 'циклы', 'функции'];

    el.searchChips.innerHTML = chips.map(q =>
      `<button class="search-chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`
    ).join('');
  };

  const performSearch = (query) => {
    const raw = query.trim();
    el.searchFilters.hidden = !raw;

    if (el.searchChips) el.searchChips.style.display = raw ? 'none' : 'flex';
    if (el.searchStage) el.searchStage.classList.toggle('has-results', !!raw);

    if (!raw) {
      el.searchResults.innerHTML = '';
      renderSearchSuggestions();
      return;
    }

    renderSearchThinking();

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const parsed = parseSmartQuery(raw);
      const q = parsed.words.toLowerCase();
      const manualFilters = state.searchFilters;
      const smartFilters = parsed.filters;
      const numberRange = parsed.numberRange;

      const results = [];
      const unlocked = unlockedLessons();

      for (const n of unlocked) {
        const lesson = state.cache[keyOf(n)];
        if (!lesson) continue;

        if (manualFilters.has('unread') && isRead(n)) continue;
        if (manualFilters.has('fav') && !isFav(n)) continue;
        if (smartFilters.some(sf => sf.key === 'unread' && isRead(n))) continue;
        if (smartFilters.some(sf => sf.key === 'fav' && !isFav(n))) continue;
        if (numberRange && (n < numberRange[0] || n > numberRange[1])) continue;

        const codeOnly = manualFilters.has('code') || smartFilters.some(f => f.key === 'code');
        const titleOnly = manualFilters.has('title') || smartFilters.some(f => f.key === 'title');

        const plain = cleanMarkdown(lesson.raw);
        const codeText = extractCodeText(lesson.raw);
        const lowerTitle = lesson.title.toLowerCase();
        const lowerPlain = plain.toLowerCase();
        const lowerCode = codeText.toLowerCase();

        if (q) {
          const titleMatch = lowerTitle.includes(q);
          const bodyMatch = lowerPlain.includes(q);
          const codeMatch = lowerCode.includes(q);

          if (titleOnly && !titleMatch) continue;
          if (codeOnly && !codeMatch) continue;
          if (!titleMatch && !bodyMatch && !codeMatch) continue;
        }

        const source = codeOnly ? codeText : plain;
        const isCodeSource = codeOnly;
        const snippets = q ? findMatches(source, q, 4) : [];

        if (q && !snippets.length && !titleOnly) {
          snippets.push({
            start: 0,
            snippet: plain.slice(0, 160) + (plain.length > 160 ? '…' : ''),
          });
        }

        results.push({
          n,
          title: lesson.title,
          snippets,
          isCodeSource,
          titleMatch: q && lowerTitle.includes(q),
          query: q,
        });
      }

      el.searchResults.innerHTML = '';

      if (results.length === 0) {
        renderNoResults(raw);
        return;
      }

      if (q) pushSearchHistory(raw);

      results.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = 'search-result';
        card.style.animationDelay = (i * 100) + 'ms';
        card.dataset.lesson = r.n;

        const re = r.query ? new RegExp(`(${escapeRegExp(r.query)})`, 'gi') : null;
        const titleHtml = re
          ? escapeHtml(r.title).replace(re, '<mark>$1</mark>')
          : escapeHtml(r.title);

        const totalCount = r.snippets.length;
        const shown = r.snippets.slice(0, 2);
        const rest = r.snippets.slice(2);

        const snippetsHtml = shown.map(s => {
          const inner = re
            ? escapeHtml(s.snippet).replace(re, '<mark>$1</mark>')
            : escapeHtml(s.snippet);
          const cls = 'search-snippet' + (r.isCodeSource ? ' is-code' : '');
          return `<div class="${cls}" data-lesson="${r.n}" data-match="${escapeHtml(s.snippet)}">${inner}</div>`;
        }).join('');

        const restHtml = rest.length ? `
          <button class="search-snippet-toggle" data-lesson="${r.n}" data-rest="${escapeHtml(JSON.stringify(rest))}">
            Ещё ${rest.length} совпад.
          </button>
        ` : '';

        card.innerHTML = `
          <div class="search-result-head" data-lesson="${r.n}">
            <span class="search-result-badge">Урок ${r.n}</span>
            <span class="search-result-title">${titleHtml}</span>
            <span class="search-result-count">${totalCount} совпад.</span>
          </div>
          <div class="search-result-snippets">${snippetsHtml}</div>
          ${restHtml}
        `;
        el.searchResults.appendChild(card);
      });
    }, 250);
  };

  const renderSearchSuggestions = () => {
    const recent = [...state.readLessons]
      .map(parseKey)
      .filter(x => x.course === state.currentCourseId)
      .map(x => x.lesson)
      .slice(-3).reverse()
      .map(n => state.cache[keyOf(n)] ? { n, title: state.cache[keyOf(n)].title } : null)
      .filter(Boolean);

    const favs = [...state.favorites]
      .map(parseKey)
      .filter(x => x.course === state.currentCourseId)
      .map(x => x.lesson)
      .slice(0, 4)
      .map(n => state.cache[keyOf(n)] ? { n, title: state.cache[keyOf(n)].title } : null)
      .filter(Boolean);

    let html = '';

    if (state.searchHistory.length) {
      html += '<div class="search-section-title">Недавние запросы</div>';
      html += '<div class="search-history-row">';
      state.searchHistory.forEach(q => {
        html += `<button class="search-history-chip" data-history="${escapeHtml(q)}">
          <i class="ico-search"></i>
          <span>${escapeHtml(q)}</span>
          <span class="history-remove" data-remove="${escapeHtml(q)}"><i class="ico-close"></i></span>
        </button>`;
      });
      html += '</div>';
    }

    if (recent.length) {
      html += '<div class="search-section-title">Недавние уроки</div>';
      recent.forEach(r => {
        html += `<div class="search-result" data-lesson="${r.n}">
          <div class="search-result-head">
            <span class="search-result-badge">Урок ${r.n}</span>
            <span class="search-result-title">${escapeHtml(r.title)}</span>
          </div>
        </div>`;
      });
    }
    if (favs.length) {
      html += '<div class="search-section-title">Избранное</div>';
      favs.forEach(r => {
        html += `<div class="search-result" data-lesson="${r.n}">
          <div class="search-result-head">
            <span class="search-result-badge">Урок ${r.n}</span>
            <span class="search-result-title">${escapeHtml(r.title)}</span>
          </div>
        </div>`;
      });
    }

    el.searchResults.innerHTML = html;
  };

  const renderFavorites = () => {
    const favs = [...state.favorites]
      .map(parseKey)
      .filter(x => x.course === state.currentCourseId)
      .map(x => x.lesson)
      .filter(n => state.lessons.includes(n) && isUnlocked(n))
      .sort((a, b) => a - b);

    el.favGrid.innerHTML = '';

    if (favs.length === 0) {
      el.favGrid.innerHTML = `
        <div class="search-empty" style="grid-column: 1/-1;">
          <i class="ico-star-o"></i>
          Пока нет избранных уроков в этом курсе.<br>
          Нажмите правой кнопкой мыши на урок в списке, чтобы добавить его.
        </div>`;
      return;
    }

    favs.forEach(n => {
      const lesson = state.cache[keyOf(n)];
      const title = lesson?.title || `Урок ${n}`;
      const read = isRead(n);
      const minutes = lesson?.minutes || '–';

      const card = document.createElement('div');
      card.className = 'fav-card';
      card.dataset.lesson = n;
      card.innerHTML = `
        <div class="fav-card-num">Урок ${n} · ${minutes} мин</div>
        <div class="fav-card-title">${escapeHtml(title)}</div>
        <div class="fav-card-foot">
          <span>${read ? 'Прочитан' : 'Не прочитан'}</span>
          <i class="ico-star"></i>
        </div>
      `;
      el.favGrid.appendChild(card);
    });
  };

  const renderHeatmap = () => {
    el.heatmap.innerHTML = '';
    state.lessons.forEach(n => {
      const cell = document.createElement('div');
      cell.className = 'heat-cell';
      if (!isUnlocked(n)) cell.classList.add('locked');
      else if (isRead(n)) cell.classList.add('read');
      if (state.currentLesson === n) cell.classList.add('active');
      cell.textContent = n;
      cell.title = state.cache[keyOf(n)]?.title || `Урок ${n}`;
      cell.addEventListener('click', () => {
        if (isUnlocked(n)) renderLesson(n);
        else showToast('Урок заблокирован');
      });
      el.heatmap.appendChild(cell);
    });
  };

  const openContextMenu = (x, y, lessonNum) => {
    if (!isUnlocked(lessonNum)) return;
    state.ctxLesson = lessonNum;
    const fav = isFav(lessonNum);
    const read = isRead(lessonNum);

    el.ctxFavIcon.className = fav ? 'ico-star-o' : 'ico-star';
    el.ctxFavText.textContent = fav ? 'Удалить из избранного' : 'Добавить в избранное';
    el.ctxResetBtn.hidden = !read;

    el.contextMenu.hidden = false;
    el.contextMenu.style.left = '-9999px';
    el.contextMenu.style.top = '-9999px';

    const rect = el.contextMenu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 10;
    let px = x, py = y;
    if (px + rect.width + pad > vw) px = vw - rect.width - pad;
    if (py + rect.height + pad > vh) py = vh - rect.height - pad;
    el.contextMenu.style.left = px + 'px';
    el.contextMenu.style.top = py + 'px';
  };

  const closeContextMenu = () => {
    el.contextMenu.hidden = true;
    state.ctxLesson = null;
  };

  let toastTimer;
  const showToast = (msg) => {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  };

  const attachLongPress = (node, cb) => {
    let timer = null;
    let moved = false;
    let startX = 0, startY = 0;
    const clear = () => { clearTimeout(timer); timer = null; };
    node.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      moved = false;
      timer = setTimeout(() => { if (!moved) cb(t.clientX, t.clientY); }, 500);
    }, { passive: true });
    node.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) {
        moved = true; clear();
      }
    }, { passive: true });
    node.addEventListener('touchend', clear);
    node.addEventListener('touchcancel', clear);
  };

  const openNotePopover = (p, lessonNum, textKey) => {
    $$('.note-popover').forEach(n => n.remove());
    const popover = document.createElement('div');
    popover.className = 'note-popover';
    const ck = keyOf(lessonNum);
    const existing = state.notes[ck]?.[textKey] || '';

    popover.innerHTML = `
      <textarea placeholder="Заметка к абзацу…">${escapeHtml(existing)}</textarea>
      <div class="note-popover-actions">
        <button class="note-btn danger" data-action="delete">Удалить</button>
        <button class="note-btn secondary" data-action="cancel">Отмена</button>
        <button class="note-btn primary" data-action="save">Сохранить</button>
      </div>
    `;

    document.body.appendChild(popover);

    const rect = p.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
    if (top + popRect.height > window.innerHeight - 12) top = rect.top - popRect.height - 8;
    popover.style.left = Math.max(12, left) + 'px';
    popover.style.top = Math.max(12, top) + 'px';

    const textarea = popover.querySelector('textarea');
    textarea.focus();

    popover.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'cancel') {
        popover.remove();
      } else if (action === 'save') {
        const val = textarea.value.trim();
        if (!state.notes[ck]) state.notes[ck] = {};
        if (val) state.notes[ck][textKey] = val;
        else delete state.notes[ck][textKey];
        persist(K.NOTES, state.notes);
        popover.remove();
        applyNoteMarkers(lessonNum);
        showToast(val ? 'Заметка сохранена' : 'Заметка удалена');
      } else if (action === 'delete') {
        if (state.notes[ck]) delete state.notes[ck][textKey];
        persist(K.NOTES, state.notes);
        popover.remove();
        applyNoteMarkers(lessonNum);
        showToast('Заметка удалена');
      }
    });
  };

  const attachNoteMarker = (p, lessonNum, textKey) => {
    if (p.querySelector('.note-marker')) return;
    const marker = document.createElement('span');
    marker.className = 'note-marker';
    marker.title = 'Заметка';
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      openNotePopover(p, lessonNum, textKey);
    });
    p.appendChild(marker);
  };

  const applyNoteMarkers = (lessonNum) => {
    el.lessonBody.querySelectorAll('.note-marker').forEach(m => m.remove());
    const notes = state.notes[keyOf(lessonNum)] || {};
    el.lessonBody.querySelectorAll('p').forEach(p => {
      if (p.closest('blockquote, pre, li')) return;
      const text = p.textContent.trim().slice(0, 40);
      if (notes[text]) attachNoteMarker(p, lessonNum, text);
    });
  };

  const openCourseMenu = () => {
    el.courseMenu.innerHTML = '';
    state.courses.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'course-menu-item' + (c.id === state.currentCourseId ? ' active' : '');
      btn.innerHTML = `
        <i class="ico-${c.icon || 'bolt'}"></i>
        <span>${escapeHtml(c.title)}</span>
        <span class="course-menu-count">${c.allLessons.length}</span>
      `;
      btn.addEventListener('click', () => switchCourse(c.id));
      el.courseMenu.appendChild(btn);
    });
    el.courseMenu.hidden = false;
  };

  const closeCourseMenu = () => { el.courseMenu.hidden = true; };

  const switchCourse = async (cid) => {
    if (state.currentCourseId === cid) { closeCourseMenu(); return; }

    state.currentCourseId = cid;
    persist(K.COURSE, cid);

    state.cache = {};
    state.currentLesson = null;
    state.searchFilters.clear();
    state.sidebarOpen = false;
    state.verified = new Set();

    state.searchHistory = getCourseHistory(cid);

    $$('.filter-chip').forEach(c => c.classList.remove('active'));

    if (el.searchInput) el.searchInput.value = '';
    if (el.searchClear) el.searchClear.hidden = true;
    if (el.searchResults) el.searchResults.innerHTML = '';
    if (el.searchFilters) el.searchFilters.hidden = true;
    if (el.searchChips) el.searchChips.style.display = 'flex';
    if (el.searchStage) el.searchStage.classList.remove('has-results');

    const course = state.courses.find(c => c.id === cid);
    state.verified = new Set(
      [...new Set(course.completed || [])].filter(n => Number.isFinite(n) && n > 0)
    );

    state.lessons = [...new Set(course.allLessons)]
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    el.logoText.innerHTML = `leonard<em>${cid}</em>`;
    el.logoIcon.className = 'ico-' + (course.icon || 'bolt');

    renderSearchChips();

    const savedLesson = Number(localStorage.getItem(K.CUR + ':' + cid)) || null;
    const unlocked = unlockedLessons();
    let initial = savedLesson;
    if (initial == null || !state.lessons.includes(initial) || !isUnlocked(initial)) {
      initial = unlocked[unlocked.length - 1] || state.lessons[0];
    }

    renderSidebar();
    closeCourseMenu();
    if (initial != null) await renderLesson(initial);
    prefetchAll();
  };

  const openPalette = () => {
    if (state.paletteOpen) return;
    state.paletteOpen = true;

    el.paletteOverlay.hidden = false;
    el.paletteOverlay.classList.remove('closing');
    el.paletteInput.value = '';
    renderPaletteItems('');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.paletteOverlay.classList.add('open');
        el.paletteInput.focus();
      });
    });
  };

  const closePalette = () => {
    if (!state.paletteOpen) return;
    state.paletteOpen = false;

    el.paletteOverlay.classList.remove('open');
    el.paletteOverlay.classList.add('closing');

    const overlay = el.paletteOverlay;
    const finish = () => {
      overlay.hidden = true;
      overlay.classList.remove('closing');
      overlay.removeEventListener('transitionend', onEnd);
    };

    const onEnd = (e) => {
      if (e.target === el.paletteBox || e.target === overlay) finish();
    };

    overlay.addEventListener('transitionend', onEnd);
    setTimeout(finish, 400);
  };

  const paletteCommands = () => {
    const cmds = [
      { id: 'go-lessons', label: 'К последнему доступному уроку', icon: 'book', action: () => { closePalette(); openLastUnlocked(); } },
      { id: 'go-search', label: 'Открыть поиск', icon: 'search', action: () => { closePalette(); switchView('search'); } },
      { id: 'go-favorites', label: 'Открыть избранное', icon: 'star', action: () => { closePalette(); switchView('favorites'); } },
      { id: 'theme', label: 'Сменить тему', icon: 'palette', action: () => { closePalette(); cycleTheme(); } },
      { id: 'shortcuts', label: 'Показать горячие клавиши', icon: 'bolt', action: () => { closePalette(); openShortcuts(); } },
      { id: 'export', label: 'Экспортировать прогресс', icon: 'download', action: () => { closePalette(); exportProgress(); } },
      { id: 'import', label: 'Импортировать прогресс', icon: 'upload', action: () => { closePalette(); importProgress(); } },
    ];

    const lessons = unlockedLessons().map(n => ({
      id: 'lesson-' + n,
      label: state.cache[keyOf(n)]?.title || `Урок ${n}`,
      icon: 'book',
      hint: `Урок ${n}`,
      action: () => { closePalette(); renderLesson(n); },
    }));

    return { cmds, lessons };
  };

  const fuzzyScore = (str, query) => {
    str = str.toLowerCase();
    query = query.toLowerCase();
    if (!query) return 1;
    let si = 0, qi = 0, score = 0, streak = 0;
    while (si < str.length && qi < query.length) {
      if (str[si] === query[qi]) {
        score += 1 + streak * 0.5;
        streak++;
        qi++;
      } else {
        streak = 0;
      }
      si++;
    }
    if (qi < query.length) return 0;
    return score / (str.length * 0.1 + score);
  };

  const renderPaletteItems = (query) => {
    const { cmds, lessons } = paletteCommands();
    const q = query.trim();

    const scoreCmd = cmds.map(c => ({ ...c, score: fuzzyScore(c.label, q), section: 'Команды' }))
      .filter(c => !q || c.score > 0.05).sort((a, b) => b.score - a.score).slice(0, q ? 4 : cmds.length);

    const scoreLesson = lessons.map(l => ({ ...l, score: fuzzyScore(l.label, q), section: 'Уроки' }))
      .filter(l => !q || l.score > 0.05).sort((a, b) => b.score - a.score).slice(0, 6);

    state.paletteItems = [...scoreCmd, ...scoreLesson];
    state.paletteSelected = 0;

    if (!state.paletteItems.length) {
      el.paletteResults.innerHTML = '<div class="palette-empty">Ничего не найдено</div>';
      return;
    }

    let html = '';
    let lastSection = '';
    state.paletteItems.forEach((item, i) => {
      if (item.section !== lastSection) {
        html += `<div class="palette-section">${item.section}</div>`;
        lastSection = item.section;
      }
      html += `<div class="palette-item ${i === 0 ? 'selected' : ''}" data-index="${i}">
        <i class="ico-${item.icon}"></i>
        <span class="palette-item-text">${escapeHtml(item.label)}</span>
        ${item.hint ? `<span class="palette-item-hint">${escapeHtml(item.hint)}</span>` : ''}
      </div>`;
    });
    el.paletteResults.innerHTML = html;
  };

  const paletteNavigate = (dir) => {
    if (!state.paletteItems.length) return;
    state.paletteSelected = (state.paletteSelected + dir + state.paletteItems.length) % state.paletteItems.length;
    $$('.palette-item', el.paletteResults).forEach((node, i) => {
      node.classList.toggle('selected', i === state.paletteSelected);
      if (i === state.paletteSelected) node.scrollIntoView({ block: 'nearest' });
    });
  };

  const paletteExecute = () => {
    const item = state.paletteItems[state.paletteSelected];
    if (item && item.action) item.action();
  };

  const openShortcuts = () => { el.shortcutsOverlay.hidden = false; };
  const closeShortcuts = () => { el.shortcutsOverlay.hidden = true; };

  const exportProgress = () => {
    const data = {
      version: 2,
      exported: new Date().toISOString(),
      read: [...state.readLessons],
      favorites: [...state.favorites],
      notes: state.notes,
      streak: state.streak,
      course: state.currentCourseId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leonard-progress-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Прогресс выгружен');
  };

  const importProgress = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.read)) state.readLessons = new Set(data.read);
        if (Array.isArray(data.favorites)) state.favorites = new Set(data.favorites);
        if (data.notes) state.notes = data.notes;
        if (data.streak) state.streak = data.streak;
        persist(K.READ, [...state.readLessons]);
        persist(K.FAV, [...state.favorites]);
        persist(K.NOTES, state.notes);
        persist(K.STREAK, state.streak);
        renderSidebar();
        renderStreak();
        showToast('Прогресс загружен');
      } catch (e) {
        showToast('Не удалось прочитать файл');
      }
    });
    input.click();
  };

  const setupQuote = () => {
    document.addEventListener('mouseup', (e) => {
      if (state.view !== 'lesson') return;
      if (e.target.closest('.quote-menu, .context-menu, .note-popover, .palette-overlay, .shortcuts-overlay, .course-menu')) return;
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length < 3) {
        el.quoteMenu.hidden = true;
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      el.quoteMenu.hidden = false;
      el.quoteMenu.style.left = Math.max(8, rect.left + rect.width / 2 - 100) + 'px';
      el.quoteMenu.style.top = Math.max(8, rect.top - 44) + 'px';
      el.quoteBtn.dataset.text = text;
    });

    el.quoteBtn.addEventListener('click', () => {
      const text = el.quoteBtn.dataset.text || '';
      const n = state.currentLesson;
      const title = state.cache[keyOf(n)]?.title || '';
      const course = state.courses.find(c => c.id === state.currentCourseId);
      const quote = `«${text}»\n\n– leonard ${course?.title || ''}, урок ${n}: ${title}`;
      navigator.clipboard.writeText(quote).then(() => {
        showToast('Цитата скопирована');
        el.quoteMenu.hidden = true;
      });
    });

    document.addEventListener('mousedown', (e) => {
      if (!el.quoteMenu.hidden && !el.quoteMenu.contains(e.target)) {
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || !sel.toString().trim()) el.quoteMenu.hidden = true;
        }, 100);
      }
    });
  };

  const resizeSearchInput = () => {
    if (!el.searchInput) return;
    el.searchInput.style.height = 'auto';
    el.searchInput.style.height = Math.min(el.searchInput.scrollHeight, 200) + 'px';
  };

  const expandSnippets = (btn) => {
    const lessonNum = Number(btn.dataset.lesson);
    const rest = JSON.parse(btn.dataset.rest || '[]');
    const container = btn.parentElement.querySelector('.search-result-snippets');
    const q = el.searchInput.value.trim().toLowerCase();
    const re = q ? new RegExp(`(${escapeRegExp(q)})`, 'gi') : null;

    rest.forEach(s => {
      const div = document.createElement('div');
      const inner = re
        ? escapeHtml(s.snippet).replace(re, '<mark>$1</mark>')
        : escapeHtml(s.snippet);
      div.className = 'search-snippet';
      div.dataset.lesson = lessonNum;
      div.dataset.match = s.snippet;
      div.innerHTML = inner;
      container.appendChild(div);
    });

    btn.remove();
  };

  const setupEvents = () => {
    el.themeBtn.addEventListener('click', cycleTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.theme === 'system') applyTheme('system', true);
    });

    el.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        if (v === 'lessons') openLastUnlocked();
        else if (v === 'search') switchView('search');
        else if (v === 'favorites') switchView('favorites');
      });
    });

    el.logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      openLastUnlocked();
    });

    el.courseSwitch.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.courseMenu.hidden) openCourseMenu();
      else closeCourseMenu();
    });

    document.addEventListener('click', (e) => {
      if (!el.courseMenu.hidden && !el.courseMenu.contains(e.target) && !el.courseSwitch.contains(e.target)) {
        closeCourseMenu();
      }
    });

    el.hamburger.addEventListener('click', () => {
      state.sidebarOpen = !state.sidebarOpen;
      el.sidebar.classList.toggle('open', state.sidebarOpen);
      el.sidebarOverlay.classList.toggle('show', state.sidebarOpen);
    });

    el.sidebarOverlay.addEventListener('click', () => {
      state.sidebarOpen = false;
      el.sidebar.classList.remove('open');
      el.sidebarOverlay.classList.remove('show');
    });

    el.lessonList.addEventListener('click', (e) => {
      const item = e.target.closest('.lesson-item');
      if (!item) return;
      const n = Number(item.dataset.lesson);
      if (item.classList.contains('locked')) {
        showToast('Урок пока недоступен');
        return;
      }
      renderLesson(n);
      if (window.innerWidth <= 900) {
        state.sidebarOpen = false;
        el.sidebar.classList.remove('open');
        el.sidebarOverlay.classList.remove('show');
      }
    });

    el.lessonList.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.lesson-item');
      if (!item) return;
      e.preventDefault();
      const n = Number(item.dataset.lesson);
      if (item.classList.contains('locked')) return;
      openContextMenu(e.clientX, e.clientY, n);
    });

    const observer = new MutationObserver(() => {
      $$('.lesson-item', el.lessonList).forEach(item => {
        if (item.dataset.lpBound) return;
        item.dataset.lpBound = '1';
        attachLongPress(item, (x, y) => {
          if (item.classList.contains('locked')) return;
          openContextMenu(x, y, Number(item.dataset.lesson));
        });
      });
    });
    observer.observe(el.lessonList, { childList: true });

    el.ctxFavBtn.addEventListener('click', () => {
      const n = state.ctxLesson;
      if (n == null) return;
      const ck = keyOf(n);
      if (isFav(n)) {
        state.favorites.delete(ck);
        showToast('Удалено из избранного');
      } else {
        state.favorites.add(ck);
        showToast('Добавлено в избранное');
      }
      persist(K.FAV, [...state.favorites]);
      renderSidebar();
      if (state.view === 'favorites') renderFavorites();
      updateFavChip();
      closeContextMenu();
    });

    el.ctxResetBtn.addEventListener('click', () => {
      const n = state.ctxLesson;
      if (n == null) return;
      state.readLessons.delete(keyOf(n));
      persist(K.READ, [...state.readLessons]);
      renderSidebar();
      if (state.currentLesson === n) updateNextButton();
      showToast(`Прогресс урока ${n} сброшен`);
      closeContextMenu();
    });

    document.addEventListener('click', (e) => {
      if (!el.contextMenu.hidden && !el.contextMenu.contains(e.target)) closeContextMenu();
    });

    el.nextBtn.addEventListener('click', goNext);

    el.searchInput.addEventListener('input', () => {
      const v = el.searchInput.value;
      el.searchClear.hidden = !v;
      resizeSearchInput();
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => performSearch(v), 200);
    });

    el.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        performSearch(el.searchInput.value);
      }
    });

    el.searchClear.addEventListener('click', () => {
      el.searchInput.value = '';
      el.searchClear.hidden = true;
      el.searchInput.style.height = 'auto';
      el.searchResults.innerHTML = '';
      el.searchFilters.hidden = true;
      if (el.searchChips) el.searchChips.style.display = 'flex';
      if (el.searchStage) el.searchStage.classList.remove('has-results');
      renderSearchSuggestions();
      el.searchInput.focus();
    });

    el.searchChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.search-chip');
      if (!chip) return;
      el.searchInput.value = chip.dataset.q;
      el.searchClear.hidden = false;
      resizeSearchInput();
      performSearch(chip.dataset.q);
      el.searchInput.focus();
    });

    el.searchFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      const f = chip.dataset.filter;
      if (state.searchFilters.has(f)) state.searchFilters.delete(f);
      else state.searchFilters.add(f);
      chip.classList.toggle('active', state.searchFilters.has(f));
      performSearch(el.searchInput.value);
    });

    el.searchResults.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.history-remove');
      if (removeBtn) {
        e.stopPropagation();
        removeSearchHistory(removeBtn.dataset.remove);
        return;
      }

      const historyChip = e.target.closest('.search-history-chip');
      if (historyChip) {
        const q = historyChip.dataset.history;
        el.searchInput.value = q;
        el.searchClear.hidden = false;
        resizeSearchInput();
        performSearch(q);
        el.searchInput.focus();
        return;
      }

      const toggle = e.target.closest('.search-snippet-toggle');
      if (toggle) {
        expandSnippets(toggle);
        return;
      }

      const snippet = e.target.closest('.search-snippet');
      if (snippet) {
        const lessonNum = Number(snippet.dataset.lesson);
        const q = el.searchInput.value.trim();
        renderLesson(lessonNum, { matchQuery: q });
        return;
      }

      const card = e.target.closest('.search-result');
      if (!card) return;
      const lessonNum = Number(card.dataset.lesson);
      renderLesson(lessonNum);
    });

    el.favGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.fav-card');
      if (!card) return;
      renderLesson(Number(card.dataset.lesson));
    });

    el.contentArea.addEventListener('scroll', () => {
      updateReadProgress();
      updateTocActive();
      updateLessonContext();
    }, { passive: true });

    el.paletteInput.addEventListener('input', () => {
      renderPaletteItems(el.paletteInput.value);
    });

    el.paletteClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closePalette();
    });

    el.paletteOverlay.addEventListener('mousedown', (e) => {
      if (e.target === el.paletteOverlay) closePalette();
    });

    el.paletteResults.addEventListener('click', (e) => {
      const item = e.target.closest('.palette-item');
      if (!item) return;
      state.paletteSelected = Number(item.dataset.index);
      paletteExecute();
    });

    el.shortcutsClose.addEventListener('click', closeShortcuts);
    el.shortcutsOverlay.addEventListener('click', (e) => {
      if (e.target === el.shortcutsOverlay) closeShortcuts();
    });

    document.addEventListener('keydown', (e) => {
      if (state.paletteOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); paletteNavigate(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); paletteNavigate(-1); return; }
        if (e.key === 'Enter') { e.preventDefault(); paletteExecute(); return; }
      }

      const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        if (state.paletteOpen) closePalette();
        else openPalette();
        return;
      }

      if (e.key === 'Escape') {
        if (!el.shortcutsOverlay.hidden) { closeShortcuts(); return; }
        if (!el.contextMenu.hidden) { closeContextMenu(); return; }
        if (!el.courseMenu.hidden) { closeCourseMenu(); return; }
        if (!el.quoteMenu.hidden) { el.quoteMenu.hidden = true; return; }
        if (state.view === 'search') {
          state.searchFilters.clear();
          $$('.filter-chip').forEach(c => c.classList.remove('active'));
          el.searchInput.value = '';
          el.searchClear.hidden = true;
          el.searchInput.style.height = 'auto';
          if (el.searchChips) el.searchChips.style.display = 'flex';
          if (el.searchStage) el.searchStage.classList.remove('has-results');
          renderSearchSuggestions();
          return;
        }
        return;
      }

      if (inInput) return;

      if (e.code === 'Slash' && !e.shiftKey) {
        e.preventDefault();
        switchView('search');
        return;
      }
      if (e.shiftKey && (e.code === 'Slash' || e.code === 'Digit7')) {
        e.preventDefault();
        openShortcuts();
        return;
      }
      if (e.code === 'KeyJ' || e.key === 'ArrowRight') { goNextLesson(); return; }
      if (e.code === 'KeyK' || e.key === 'ArrowLeft') { goPrev(); return; }
      if (e.code === 'KeyF') {
        const n = state.currentLesson;
        if (!n || !isUnlocked(n)) return;
        const ck = keyOf(n);
        if (isFav(n)) { state.favorites.delete(ck); showToast('Удалено из избранного'); }
        else { state.favorites.add(ck); showToast('Добавлено в избранное'); }
        persist(K.FAV, [...state.favorites]);
        renderSidebar();
        updateFavChip();
        if (state.view === 'favorites') renderFavorites();
        return;
      }
      if (e.code === 'KeyT') { cycleTheme(); return; }
      if (e.code === 'KeyG') { openLastUnlocked(); return; }
      if (e.code === 'KeyC') {
        if (el.courseMenu.hidden) openCourseMenu();
        else closeCourseMenu();
        return;
      }
    });

    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', () => {
      if (state.view === 'lesson') renderToc();
    });

    setupQuote();
  };

  const init = async () => {
    if (typeof COURSES === 'undefined' || !Array.isArray(COURSES) || !COURSES.length) {
      document.body.innerHTML =
        '<p style="padding:40px;font-family:sans-serif;">Не найден массив COURSES в courses.js</p>';
      return;
    }

    state.courses = COURSES;

    loadState();

    const saved = localStorage.getItem(K.COURSE);
    const cid = (saved && COURSES.find(c => c.id === saved)) ? saved : COURSES[0].id;
    state.currentCourseId = cid;

    state.searchHistory = getCourseHistory(cid);

    const course = COURSES.find(c => c.id === cid);
    state.verified = new Set(
      [...new Set(course.completed || [])].filter(n => Number.isFinite(n) && n > 0)
    );
    state.lessons = [...new Set(course.allLessons)]
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    applyTheme(state.theme, false);
    updateStreak();
    setupEvents();
    renderSearchChips();

    el.logoText.innerHTML = `leonard<em>${cid}</em>`;
    el.logoIcon.className = 'ico-' + (course.icon || 'bolt');

    const savedLesson = Number(localStorage.getItem(K.CUR + ':' + cid)) || null;
    state.currentLesson = null;

    renderSidebar();

    let initial = savedLesson;
    if (initial == null || !state.lessons.includes(initial) || !isUnlocked(initial)) {
      const unlocked = unlockedLessons();
      initial = unlocked[unlocked.length - 1] || state.lessons[0];
    }

    if (initial != null) await renderLesson(initial);
    prefetchAll();
  };

  document.addEventListener('DOMContentLoaded', init);
})();