/* ==========================================================
   exchange — SLCC → Sophia University (Tokyo)
   Personal planner. Plain JS, no build step.
   Data lives in localStorage; attached files live in IndexedDB.
   ========================================================== */
(() => {
  'use strict';

  /* ---------------- me ---------------- */
  const HOME = 'Salt Lake Community College';
  const HOST = 'Sophia University';
  const CITY = 'Tokyo';

  /* ---------------- constants ---------------- */
  const STORE_KEY = 'exchange-journal-v2';
  const OLD_KEY = 'exchange-journal-v1';
  const RAINBOW = ['#e5717a', '#e89a6a', '#e6c878', '#93c58c', '#6cb8c4', '#7f93d9', '#b18ad6'];
  const NEUTRAL = '#b9b8b4';
  const rc = i => RAINBOW[((i % 7) + 7) % 7];

  const ROUTES = [
    { id: 'budget', label: 'Budget', color: RAINBOW[1] },
    { id: 'earnings', label: 'Earnings', color: RAINBOW[3] },
    { id: 'documents', label: 'Documents', color: RAINBOW[4] },
    { id: 'timeline', label: 'Timeline', color: RAINBOW[6] },
    { id: 'list', label: 'Japan list', color: RAINBOW[5] },
    { id: 'settings', label: 'Settings', color: NEUTRAL },
  ];

  const CATS = ['Housing', 'Food', 'Flights', 'Travel', 'Transportation', 'School', 'Phone & personal', 'Insurance', 'Documents', 'Other'];
  const DOC_CATS = ['GED', 'Passport', 'Visa', 'SLCC', 'Sophia', 'Housing', 'Flights', 'Money', 'Insurance', 'Other'];
  const WISH_CATS = ['Places', 'Food', 'Experiences', 'Learn', 'Buy', 'Other'];
  const MS_TYPES = ['GED', 'SLCC', 'Sophia', 'Visa', 'Housing', 'Flights', 'Money', 'Other'];
  const DOC_STATUS = {
    obtained: { label: 'Obtained', color: RAINBOW[3] },
    pending: { label: 'Pending', color: RAINBOW[2] },
    attention: { label: 'Needs attention', color: RAINBOW[0] },
  };
  const catColor = (list, name) => { const i = list.indexOf(name); return i < 0 ? NEUTRAL : rc(i); };

  /* ---------------- utils ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (arr, f = x => x) => arr.reduce((a, b) => a + (Number(f(b)) || 0), 0);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const pad = n => String(n).padStart(2, '0');
  const plural = (n, w, p = w + 's') => `${n} ${Math.abs(n) === 1 ? w : p}`;
  const find = (list, id) => list.find(x => x.id === id);
  const removeById = (key, id) => { state[key] = state[key].filter(x => x.id !== id); };

  // dates are stored as local 'YYYY-MM-DD' strings
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parseD = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysUntil = s => s ? Math.round((parseD(s) - parseD(today())) / 864e5) : null;
  const fmtDate = (s, o) => s ? parseD(s).toLocaleDateString('en-US', o || { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const rel = n => n === null ? '' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;

  /* ---------------- icons ---------------- */
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    clip: '<path d="M20 11.5l-7.8 7.8a5 5 0 01-7-7L13 4.5a3.3 3.3 0 014.7 4.7l-7.8 7.8a1.7 1.7 0 01-2.4-2.4L14.8 7.3"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

  /* ---------------- Sophia budget ----------------
     Starting figures come from Sophia's published guidance for exchange
     students (living costs + dorm list). Every number is editable. */
  const SOPHIA_ITEMS = [
    { name: 'Round-trip flight (Salt Lake City ⇄ Tokyo)', amount: 1400, cur: 'USD', unit: 'once', cat: 'Flights', note: 'Usually one connection — booking 2–3 months out gets the best fares' },
    { name: 'Sophia dormitory', amount: 75000, cur: 'JPY', unit: 'month', cat: 'Housing', note: 'Sophia dorms run about ¥286k–¥520k per semester, utilities included' },
    { name: 'Move-in setup (bedding, household)', amount: 20000, cur: 'JPY', unit: 'once', cat: 'Housing', note: 'Skip if your dorm rents bedding' },
    { name: 'Food', amount: 45000, cur: 'JPY', unit: 'month', cat: 'Food', note: 'Sophia estimate: ¥30k–¥60k / month' },
    { name: 'Commuter pass & trains', amount: 8000, cur: 'JPY', unit: 'month', cat: 'Transportation', note: 'Sophia estimate: ¥5k–¥10k / month' },
    { name: 'Travel & weekend trips', amount: 25000, cur: 'JPY', unit: 'month', cat: 'Travel', note: 'Kyoto, Osaka, Nikko… adjust to taste' },
    { name: 'Textbooks', amount: 40000, cur: 'JPY', unit: 'semester', cat: 'School', note: 'Sophia estimate: ¥30k–¥50k / semester' },
    { name: 'GED tests (4 subjects)', amount: 150, cur: 'USD', unit: 'once', cat: 'School', note: 'Roughly $30–40 per subject test — check ged.com for Utah pricing' },
    { name: 'SLCC tuition & study abroad fees', amount: 0, cur: 'USD', unit: 'semester', cat: 'School', note: 'Exchange students pay their home school — enter what SLCC bills you for the term' },
    { name: 'Phone (SIM / eSIM)', amount: 3000, cur: 'JPY', unit: 'month', cat: 'Phone & personal', note: 'Budget carriers start around ¥1k–¥3k' },
    { name: 'Personal spending', amount: 20000, cur: 'JPY', unit: 'month', cat: 'Phone & personal', note: 'Sophia estimate: ~¥20k / month' },
    { name: 'National Health Insurance', amount: 2000, cur: 'JPY', unit: 'month', cat: 'Insurance', note: 'Required — ¥1.5k–¥3k / month depending on ward' },
    { name: 'Student accident insurance', amount: 800, cur: 'JPY', unit: 'year', cat: 'Insurance', note: 'Required by Sophia' },
    { name: 'Passport, visa & documents', amount: 200, cur: 'USD', unit: 'once', cat: 'Documents', note: 'Passport renewal, photos, mailing to the consulate' },
  ];
  const UNITS = [['once', 'one-time'], ['month', 'per month'], ['semester', 'per semester'], ['year', 'per year']];
  const DURATIONS = { semester: { label: 'One semester', months: 5 }, year: { label: 'Full year', months: 10 } };
  const makeItems = () => SOPHIA_ITEMS.map(i => ({ id: uid(), ...i }));

  const GED_DOCS = [
    ['GED certificate & transcript', 'GED', 'SLCC asks for this when you apply'],
    ['SLCC admission email', 'SLCC', ''],
  ];
  const STARTER_DOCS = [
    ...GED_DOCS,
    ['Passport', 'Passport', 'Must be valid for your whole stay'],
    ['SLCC study abroad application', 'SLCC', ''],
    ['SLCC transcript', 'SLCC', ''],
    ['Sophia University acceptance letter', 'Sophia', ''],
    ['Certificate of Eligibility (CoE)', 'Visa', 'Sophia applies for this and mails it to you'],
    ['Japanese student visa', 'Visa', 'Apply at the Consulate-General of Japan in Denver (covers Utah) — bring passport, CoE, photo and application form'],
    ['Sophia dorm confirmation', 'Housing', ''],
    ['Flight confirmation', 'Flights', ''],
    ['Proof of funds (bank statement)', 'Money', ''],
    ['Health insurance card / info', 'Insurance', ''],
    ['Passport photos', 'Other', 'Extra copies for the visa and Sophia forms'],
  ];
  const GED_MS = [
    ['Pass the GED', 'GED', '4 tests: Math, Science, Social Studies and Reasoning Through Language Arts — schedule them at ged.com'],
    ['Apply to SLCC', 'SLCC', 'Apply online at slcc.edu once you have your GED (or while you finish it)'],
    ['Submit the FAFSA', 'Money', 'Free federal aid — Pell Grants can cover SLCC tuition. Opens every October at studentaid.gov'],
    ['Start classes at SLCC', 'SLCC', ''],
    ['Meet with the SLCC study abroad office', 'SLCC', 'Ask about Sophia, GPA and credit requirements, and scholarships'],
  ];
  const STARTER_MS = [
    ...GED_MS,
    ['SLCC study abroad application submitted', 'SLCC'],
    ['Nominated to Sophia by SLCC', 'SLCC'],
    ['Sophia exchange application submitted', 'Sophia'],
    ['Accepted to Sophia', 'Sophia'],
    ['Dorm application sent', 'Housing'],
    ['Certificate of Eligibility arrives', 'Visa'],
    ['Visa approved', 'Visa'],
    ['Flights booked', 'Flights'],
    ['Savings goal reached', 'Money'],
  ];
  const starterDocs = () => STARTER_DOCS.map(([name, category, notes], i) => ({ id: uid(), created: Date.now() + i, name, category, status: 'pending', expiration: '', notes, fileId: null, fileName: '', fileType: '' }));
  const starterMs = () => STARTER_MS.map(([title, type, notes = ''], i) => ({ id: uid(), created: Date.now() + i, title, type, date: '', notes, done: false }));

  // adds the GED / SLCC application steps to data saved before they existed
  function upgrade(st) {
    if (!st.seeded.includes('ged')) {
      const has = (list, key, v) => list.some(x => String(x[key] || '').toLowerCase() === v.toLowerCase());
      st.milestones = [...GED_MS.filter(([t]) => !has(st.milestones, 'title', t)).map(([title, type, notes], i) => ({ id: uid(), created: i, title, type, date: '', notes, done: false })), ...st.milestones];
      st.documents = [...GED_DOCS.filter(([n]) => !has(st.documents, 'name', n)).map(([name, category, notes], i) => ({ id: uid(), created: i, name, category, status: 'pending', expiration: '', notes, fileId: null, fileName: '', fileType: '' })), ...st.documents];
      if (!st.plan.items.some(i => /\bGED\b/.test(i.name))) {
        const g = SOPHIA_ITEMS.find(i => /\bGED\b/.test(i.name));
        st.plan.items.push({ id: uid(), ...g });
      }
      st.seeded.push('ged');
    }
    return st;
  }

  /* ---------------- state ---------------- */
  function defaultState() {
    return {
      version: 2,
      settings: { goal: 15000, departureDate: '', targetTerm: 'fall', targetYear: new Date().getFullYear() + 2, returnDate: '', currency: 'USD', jpyRate: 150, showSecondary: true },
      seeded: ['ged'],
      saved: 0,
      plan: { duration: 'semester', months: 5, buffer: 10, items: makeItems() },
      earn: { wage: 0, hours: 0, tax: 10, save: 50 },
      documents: starterDocs(),
      milestones: starterMs(),
      wishes: [],
      ui: { editItems: false, docStatus: '', wishCat: '', wishCatAdd: 'Places' },
    };
  }

  // bring data over from the first (bigger) version of the app
  const OLD_DOC_CATS = { University: 'Sophia', 'Exchange program': 'SLCC', Financial: 'Money', Medical: 'Other' };
  const OLD_MS_TYPES = { 'Application deadline': 'SLCC', Acceptance: 'Sophia', Passport: 'Other', Finances: 'Money', Departure: 'Other' };
  function fromV1(o) {
    const st = defaultState();
    st.seeded = [];
    const s = o.settings || {};
    Object.assign(st.settings, {
      departureDate: s.departureDate || '', returnDate: s.returnDate || '',
      currency: s.currency === 'JPY' ? 'JPY' : 'USD',
      jpyRate: Number(s.jpyRate) > 0 ? Number(s.jpyRate) : 150,
      showSecondary: s.showSecondary !== false,
    });
    st.saved = Math.max(0, Math.round(sum(o.transactions || [], t => t.amount) * 100) / 100);
    if (o.estimate) {
      st.plan.months = clamp(Number(o.estimate.months) || 5, 1, 24);
      st.plan.duration = Object.keys(DURATIONS).find(k => DURATIONS[k].months === st.plan.months) || 'custom';
      st.plan.buffer = Number(o.estimate.buffer) >= 0 ? Number(o.estimate.buffer) : 10;
    }
    if (o.earn) Object.assign(st.earn, { wage: Number(o.earn.wage) || 0, hours: Number(o.earn.hours) || 0 });
    if (Array.isArray(o.documents) && o.documents.length) st.documents = o.documents.map(d => ({ ...d, category: OLD_DOC_CATS[d.category] || d.category }));
    if (Array.isArray(o.milestones) && o.milestones.length) st.milestones = o.milestones.map(m => ({ ...m, type: OLD_MS_TYPES[m.type] || m.type }));
    return st;
  }

  function normalize(s) {
    const base = defaultState();
    return {
      ...base, ...s,
      settings: { ...base.settings, ...(s.settings || {}) },
      plan: s.plan && Array.isArray(s.plan.items) ? { ...base.plan, ...s.plan } : base.plan,
      earn: { ...base.earn, ...(s.earn || {}) },
      documents: Array.isArray(s.documents) ? s.documents : base.documents,
      milestones: Array.isArray(s.milestones) ? s.milestones : base.milestones,
      wishes: Array.isArray(s.wishes) ? s.wishes : [],
      ui: { ...base.ui, ...(s.ui || {}) },
      seeded: Array.isArray(s.seeded) ? s.seeded : [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return upgrade(normalize(JSON.parse(raw)));
      const old = localStorage.getItem(OLD_KEY);
      if (old) return upgrade(fromV1(JSON.parse(old)));
    } catch (e) { console.error('Could not read saved data', e); }
    return defaultState();
  }

  let state = load();
  let storageOk = true;
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); storageOk = true; }
    catch (e) { storageOk = false; toast('Could not save — browser storage may be full or disabled', RAINBOW[0]); }
  }
  save();

  /* ---------------- file storage (IndexedDB) ---------------- */
  const files = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((res, rej) => {
        const req = indexedDB.open('exchange-journal-files', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => { this._db = req.result; res(this._db); };
        req.onerror = () => rej(req.error);
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const t = db.transaction('files', mode);
        const r = fn(t.objectStore('files'));
        t.oncomplete = () => res(r && r.result);
        t.onerror = () => rej(t.error);
      });
    },
    put(id, rec) { return this.tx('readwrite', s => s.put(rec, id)); },
    get(id) { return this.tx('readonly', s => s.get(id)); },
    del(id) { return this.tx('readwrite', s => s.delete(id)); },
    clear() { return this.tx('readwrite', s => s.clear()); },
  };

  /* ---------------- money ---------------- */
  const S = () => state.settings;
  const rate = () => Number(S().jpyRate) > 0 ? Number(S().jpyRate) : 150;
  const cur = () => S().currency === 'JPY' ? 'JPY' : 'USD';
  const sym = () => cur() === 'JPY' ? '¥' : '$';

  /* departure: the exact date if you know it, otherwise an estimate from the target semester
     (Sophia's spring term starts in April, fall in September) */
  const TERMS = { spring: { label: 'Spring', md: '03-25' }, fall: { label: 'Fall', md: '09-01' } };
  function dep() {
    const s = S();
    if (s.departureDate) return { date: s.departureDate, approx: false, label: fmtDate(s.departureDate, { month: 'long', day: 'numeric', year: 'numeric' }) };
    const t = TERMS[s.targetTerm] || TERMS.fall;
    const y = Number(s.targetYear) || new Date().getFullYear() + 2;
    return { date: `${y}-${t.md}`, approx: true, label: `${t.label} ${y} semester` };
  }

  function money(usd, { currency, whole } = {}) {
    const c = currency || cur();
    const v = c === 'JPY' ? (Number(usd) || 0) * rate() : (Number(usd) || 0);
    const opts = { style: 'currency', currency: c };
    if (c === 'JPY' || whole) opts.maximumFractionDigits = 0;
    else { opts.minimumFractionDigits = 2; opts.maximumFractionDigits = 2; }
    if (c === 'USD' && whole) opts.minimumFractionDigits = 0;
    return new Intl.NumberFormat(c === 'JPY' ? 'ja-JP' : 'en-US', opts).format(v).replace('￥', '¥');
  }
  const altMoney = usd => S().showSecondary ? money(usd, { currency: cur() === 'USD' ? 'JPY' : 'USD', whole: true }) : '';
  const toBase = v => { const n = Number(v) || 0; return cur() === 'JPY' ? n / rate() : n; };
  const fromBase = usd => { const n = Number(usd) || 0; return cur() === 'JPY' ? Math.round(n * rate()) : Math.round(n * 100) / 100; };

  /* ---------------- budget math ---------------- */
  const mult = (unit, months) => unit === 'month' ? months : unit === 'semester' ? Math.max(1, Math.ceil(months / 5.5)) : unit === 'year' ? Math.max(1, Math.ceil(months / 12)) : 1;
  const itemUSD = i => i.cur === 'JPY' ? (Number(i.amount) || 0) / rate() : (Number(i.amount) || 0);
  function totals() {
    const p = state.plan;
    const months = Math.max(1, Number(p.months) || 1);
    const rows = p.items.map(i => ({ ...i, total: itemUSD(i) * mult(i.unit, months) }));
    const sub = sum(rows, r => r.total);
    const buf = sub * (Number(p.buffer) || 0) / 100;
    const byCat = {};
    rows.forEach(r => { if (r.total > 0) byCat[r.cat] = (byCat[r.cat] || 0) + r.total; });
    return { rows, months, sub, buf, total: sub + buf, perMonth: (sub + buf) / months, byCat };
  }
  const saved = () => Math.max(0, Number(state.saved) || 0);
  // the savings goal (with extra cushion) — falls back to the estimated cost if unset
  const goal = () => Number(S().goal) > 0 ? Number(S().goal) : totals().total;
  const stillNeed = () => Math.max(0, goal() - saved());
  const durationLabel = () => DURATIONS[state.plan.duration] ? DURATIONS[state.plan.duration].label.toLowerCase() : plural(totals().months, 'month');

  /* ---------------- toasts ---------------- */
  function toast(msg, color = RAINBOW[3]) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--c', color);
    el.innerHTML = `<span class="sw"></span><span>${esc(msg)}</span>`;
    const root = $('#toast-root');
    while (root.children.length >= 3) root.firstElementChild.remove();
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
  }

  /* ---------------- modals ---------------- */
  let modalStack = [];
  function closeModal() {
    const m = modalStack.pop();
    if (m) m.el.remove();
    if (m && m.returnFocus && document.contains(m.returnFocus)) m.returnFocus.focus();
  }
  function showModal(html, { size = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true">${html}</div>`;
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) wrap.dataset.down = '1'; });
    wrap.addEventListener('mouseup', e => { if (e.target === wrap && wrap.dataset.down) closeModal(); delete wrap.dataset.down; });
    $('#modal-root').appendChild(wrap);
    modalStack.push({ el: wrap, returnFocus: document.activeElement });
    $$('[data-close]', wrap).forEach(b => b.addEventListener('click', closeModal));
    const first = $('input:not([type=hidden]):not([type=checkbox]), textarea, select', wrap);
    if (first) setTimeout(() => first.focus(), 30);
    return wrap;
  }
  function confirmDialog({ title = 'Are you sure?', message = '', confirm = 'Delete', danger = true, onConfirm }) {
    const el = showModal(`
      <div class="modal-head"><div><div class="eyebrow"><span class="dot" style="--accent:${danger ? RAINBOW[0] : RAINBOW[3]}"></span>confirm</div>
      <h2>${esc(title)}</h2>${message ? `<p>${message}</p>` : ''}</div></div>
      <div class="modal-foot"><button class="btn" data-close>Cancel</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirm)}</button></div>`, { size: 'narrow' });
    const ok = $('[data-ok]', el);
    ok.addEventListener('click', async () => { closeModal(); await onConfirm(); });
    setTimeout(() => ok.focus(), 30);
  }

  /** field: { name, label, type, options, required, value, placeholder, hint, full } */
  function formModal({ title, eyebrow = '', fields, submit = 'Save', onSubmit, onDelete, size = '' }) {
    const fieldHtml = f => {
      const id = 'f_' + f.name;
      const req = f.required ? 'required' : '';
      const v = f.value ?? '';
      let input;
      if (f.type === 'textarea') input = `<textarea class="textarea" id="${id}" name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      else if (f.type === 'select') input = `<select class="select" id="${id}" name="${f.name}">${f.options.map(o => {
        const [val, lab] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
      }).join('')}</select>`;
      else if (f.type === 'checkbox') return `<div class="field ${f.full ? 'full' : ''}" style="justify-content:flex-end"><label class="check" style="text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:13.5px;color:var(--text-2)"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}/> ${esc(f.label)}</label></div>`;
      else if (f.type === 'file') input = `<input class="input" type="file" id="${id}" name="${f.name}" style="padding:7px 10px"/>`;
      else input = `<input class="input" type="${f.type || 'text'}" id="${id}" name="${f.name}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${req} autocomplete="off"/>`;
      return `<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}</div>`;
    };
    const el = showModal(`
      <form novalidate>
        <div class="modal-head"><div>
          ${eyebrow ? `<div class="eyebrow"><span class="dot"></span>${esc(eyebrow)}</div>` : ''}
          <h2>${esc(title)}</h2>
        </div><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="modal-body"><div class="form-grid">${fields.map(fieldHtml).join('')}</div><div class="form-error"></div></div>
        <div class="modal-foot">
          ${onDelete ? `<button type="button" class="btn danger left" data-del>${icon('trash')} Delete</button>` : ''}
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn primary">${esc(submit)}</button>
        </div>
      </form>`, { size });
    if (onDelete) $('[data-del]', el).addEventListener('click', onDelete);
    $('form', el).addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const vals = {};
      for (const f of fields) {
        if (f.type === 'checkbox') { vals[f.name] = !!$(`[name="${f.name}"]`, el).checked; continue; }
        if (f.type === 'file') { vals[f.name] = $(`[name="${f.name}"]`, el).files[0] || null; continue; }
        const v = String(fd.get(f.name) ?? '').trim();
        if (f.required && !v) { $('.form-error', el).textContent = `${f.label} is required.`; $(`[name="${f.name}"]`, el)?.focus(); return; }
        vals[f.name] = v;
      }
      const res = await onSubmit(vals);
      if (typeof res === 'string') { $('.form-error', el).textContent = res; return; }
      closeModal();
    });
  }

  /* ---------------- shared bits ---------------- */
  const emptyState = (title, text, buttons = '', small = false) => `
    <div class="empty ${small ? 'small' : ''}"><div class="empty-mark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <h4>${esc(title)}</h4><p>${text}</p>${buttons ? `<div class="btns">${buttons}</div>` : ''}</div>`;
  const progress = (pct, cls = '') => `<div class="progress ${cls}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div class="rest" style="width:${100 - clamp(pct, 0, 100)}%"></div></div>`;
  const solidBar = (pct, color, cls = '') => `<div class="progress solid ${cls}" style="--c:${color}"><div class="fill" style="width:${clamp(pct, 0, 100)}%"></div></div>`;
  const pageHead = (eyebrow, title, sub = '', actions = '') => `
    <header class="page-head"><div>
      <div class="eyebrow"><span class="dot"></span>${eyebrow}</div>
      <h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}
    </div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;
  const sectionHead = (idx, title, right = '') => `
    <div class="section-head"><h2 class="section-title"><span class="idx">${idx}</span>${esc(title)}</h2>${right}</div>`;
  const options = (list, sel) => list.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');

  /* ==========================================================
     PAGES
     ========================================================== */

  /* ---------------- budget (home) ---------------- */
  function budgetTopHtml() {
    const t = totals();
    const dp = dep(), d = daysUntil(dp.date);
    return `<div class="est-hero">
        <div>
          <div class="lbl">Savings goal</div>
          <div class="est-total num">${money(goal(), { whole: true })}</div>
          <div class="dim" style="font-size:13px;margin-top:6px">${altMoney(goal()) ? altMoney(goal()) + ' · ' : ''}estimated cost for ${esc(durationLabel())} is ${money(t.total, { whole: true })}
            ${goal() >= t.total ? `— <span class="c4">${money(goal() - t.total, { whole: true })} extra cushion</span>` : `— <span class="c1">${money(t.total - goal(), { whole: true })} short of it</span>`}</div>
        </div>
        <div class="est-compare">
          <div class="lbl">Departure</div>
          <div class="mono" style="font-size:18px;margin-top:6px">${d >= 0 ? (dp.approx ? '~' : '') + plural(d, 'day') : 'departed'}</div>
          <div class="dim" style="font-size:12px;margin-top:2px">${dp.approx ? `around ${esc(dp.label)} · <a class="link" href="#settings">change</a>` : esc(dp.label)}</div>
        </div>
      </div>`;
  }

  function budgetNeedHtml() {
    const g = goal(), sv = saved(), need = Math.max(0, g - sv);
    const pct = g > 0 ? sv / g * 100 : 0;
    return `<div class="progress-meta" style="margin:0 0 8px"><span>${Math.round(pct)}% saved</span><span>${need > 0 ? `<b style="color:var(--text);font-weight:500">${money(need, { whole: true })}</b> still to save` : '<span class="c4">goal reached</span>'}</span></div>
      ${progress(pct, 'thick')}`;
  }

  function budgetCatsHtml() {
    const t = totals();
    const cats = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]);
    if (t.buf > 0) cats.push(['Safety buffer', t.buf]);
    const extra = goal() - t.total;
    if (extra > 0) cats.push(['Extra cushion', extra]);
    if (t.total <= 0 && extra <= 0) return emptyState('Nothing in the budget', 'Add line items below to build it.', '', true);
    const whole = Math.max(t.total, goal());
    const color = n => n === 'Extra cushion' ? '#dcdad5' : n === 'Safety buffer' ? NEUTRAL : catColor(CATS, n);
    return `<div class="stack">${cats.map(([n, v]) => `<span style="width:${v / whole * 100}%;background:${color(n)}" title="${esc(n)}"></span>`).join('')}</div>
      <div class="cat-list">${cats.map(([n, v]) => `<div class="bar-row">
        <div class="top"><span class="pill" style="--c:${color(n)}"><span class="sw"></span>${esc(n)}</span><span class="mono">${money(v, { whole: true })}<span class="pct">${Math.round(v / whole * 100)}%</span></span></div>
        ${solidBar(v / whole * 100, color(n), 'thin')}</div>`).join('')}</div>
      <p class="dim" style="font-size:12px;margin:18px 0 0">Adds up to your ${money(whole, { whole: true })} goal. The safety buffer is ${state.plan.buffer}% on top of the line items; the extra cushion is whatever your goal sets aside beyond that.</p>`;
  }

  function pageBudget() {
    const p = state.plan, open = state.ui.editItems, t = totals();
    return `<div class="page">
      ${pageHead(`${esc(HOST)} · ${CITY}`, 'What Japan will <em>cost</em>', `${esc(HOME)} → ${esc(HOST)}. Everything you need to have saved before you go.`,
        `<div class="seg">${Object.entries(DURATIONS).map(([k, d]) => `<button class="${p.duration === k ? 'on' : ''}" data-action="duration" data-val="${k}">${d.label}</button>`).join('')}${p.duration === 'custom' ? `<button class="on" data-action="toggle-items">${plural(t.months, 'month')}</button>` : ''}</div>`)}

      <div class="panel">
        <div id="b-top">${budgetTopHtml()}</div>
        <div class="divider"></div>
        <div class="saved-row">
          <label class="field" style="width:170px"><span class="lbl">Savings goal</span>
            <div class="input-wrap"><span class="prefix">${sym()}</span><input class="input" type="number" min="0" step="any" data-goal value="${S().goal ? fromBase(S().goal) : ''}" placeholder="${fromBase(totals().total).toFixed(0)}"/></div></label>
          <label class="field" style="width:170px"><span class="lbl">Saved so far</span>
            <div class="input-wrap"><span class="prefix">${sym()}</span><input class="input" type="number" min="0" step="any" data-saved value="${saved() ? fromBase(saved()) : ''}" placeholder="0"/></div></label>
          <div class="grow" id="b-need">${budgetNeedHtml()}</div>
        </div>
      </div>

      <section class="section">
        ${sectionHead('01', 'Where the money goes')}
        <div class="panel" id="b-cats">${budgetCatsHtml()}</div>
      </section>

      <section class="section">
        ${sectionHead('02', 'Line items', `<button class="btn sm ghost" data-action="toggle-items">${icon(open ? 'minus' : 'edit')} ${open ? 'Done editing' : 'Edit amounts'}</button>`)}
        ${open ? `<div class="panel">
          <div class="flex wrap" style="gap:18px;margin-bottom:16px;align-items:flex-end">
            <label class="field" style="width:130px"><span class="lbl">Length (months)</span><input class="input sm" type="number" min="1" max="24" step="1" data-plan="months" value="${p.months}"/></label>
            <label class="field" style="width:150px"><span class="lbl">Safety buffer %</span><input class="input sm" type="number" min="0" max="100" step="1" data-plan="buffer" value="${p.buffer}"/></label>
            <span class="dim" style="font-size:12px;padding-bottom:7px">Yen items convert at ¥${rate()} per $1 — change the rate in Settings.</span>
          </div>
          <div class="table-wrap"><table class="table est-table">
            <thead><tr><th>Item</th><th>Amount</th><th>How often</th><th class="hide-sm">Category</th><th class="r">Subtotal</th><th></th></tr></thead>
            <tbody>${t.rows.map(r => `<tr>
              <td style="min-width:220px"><input class="input sm" data-item="${r.id}|name" value="${esc(r.name)}" aria-label="Item name"/>${r.note ? `<div class="dim" style="font-size:11.5px;margin-top:4px">${esc(r.note)}</div>` : ''}</td>
              <td><div class="flex" style="gap:4px"><select class="select sm" data-item="${r.id}|cur" style="width:56px" aria-label="Currency"><option value="JPY" ${r.cur === 'JPY' ? 'selected' : ''}>¥</option><option value="USD" ${r.cur === 'USD' ? 'selected' : ''}>$</option></select><input class="input sm" type="number" min="0" step="any" data-item="${r.id}|amount" value="${r.amount}" style="width:104px" aria-label="Amount"/></div></td>
              <td><select class="select sm" data-item="${r.id}|unit" aria-label="How often">${options(UNITS, r.unit)}</select></td>
              <td class="hide-sm"><select class="select sm" data-item="${r.id}|cat" aria-label="Category">${options(CATS, r.cat)}</select></td>
              <td class="r amount" data-item-sub="${r.id}">${money(r.total, { whole: true })}</td>
              <td class="actions-cell"><button class="icon-btn del" data-action="item-del" data-id="${r.id}" aria-label="Remove line">${icon('trash')}</button></td>
            </tr>`).join('')}</tbody></table></div>
          <div class="flex wrap mt-16">
            <button class="btn sm" data-action="item-add">${icon('plus')} Add line</button>
            <button class="btn sm ghost" data-action="items-reset">${icon('undo')} Reset to Sophia defaults</button>
          </div>
        </div>` : `<div class="rows">${t.rows.map(r => `<div class="row" style="align-items:center">
            <span class="pill" style="--c:${catColor(CATS, r.cat)}"><span class="sw"></span></span>
            <div class="grow"><div class="row-title">${esc(r.name)}</div><div class="row-meta"><span>${r.cur === 'JPY' ? '¥' + Number(r.amount).toLocaleString('en-US') : '$' + Number(r.amount).toLocaleString('en-US')} ${esc((UNITS.find(u => u[0] === r.unit) || UNITS[0])[1])}</span><span class="tag">${esc(r.cat)}</span></div></div>
            <div class="mono" style="font-size:13px;color:var(--text-2)">${money(r.total, { whole: true })}</div>
          </div>`).join('')}</div>`}
        <p class="dim" style="font-size:11.5px;margin:16px 0 0">Starting figures are based on Sophia's published estimates for exchange students (about ¥150,000 / month to live, plus the dorm). Confirm fees with Sophia's exchange office and SLCC's study abroad office before you lock it in.</p>
      </section>
    </div>`;
  }

  function refreshBudget() {
    const top = $('#b-top'); if (top) top.innerHTML = budgetTopHtml();
    const need = $('#b-need'); if (need) need.innerHTML = budgetNeedHtml();
    const cats = $('#b-cats'); if (cats) cats.innerHTML = budgetCatsHtml();
    totals().rows.forEach(r => { const c = $(`[data-item-sub="${r.id}"]`); if (c) c.textContent = money(r.total, { whole: true }); });
    renderNav();
  }

  /* ---------------- earnings ---------------- */
  function earnResultsHtml() {
    const e = state.earn;
    const wage = Number(e.wage) || 0, hours = Number(e.hours) || 0;
    if (!wage || !hours) return `<div class="panel">${emptyState('Enter your wage and hours', 'You\'ll see your take-home pay and how much of it goes toward Japan.', '', true)}</div>`;
    const tax = clamp(Number(e.tax) || 0, 0, 100) / 100, share = clamp(Number(e.save) || 0, 0, 100) / 100;
    const gross = wage * hours, net = gross * (1 - tax), toJapan = net * share, spend = net - toJapan;
    const dp = dep(), d = daysUntil(dp.date);
    const weeks = d > 0 ? d / 7 : null;
    const need = stillNeed();
    const byDep = weeks ? toJapan * weeks : null;
    const pm = x => x * 52 / 12;

    let goal = '';
    if (need <= 0) goal = `<p class="c4" style="margin:0">You've already saved your whole goal.</p>`;
    else if (!weeks) goal = `<p class="dim" style="margin:0;font-size:13px">Your departure date has passed — update it in <a class="link" href="#settings">Settings</a>.</p>`;
    else if (share <= 0) goal = `<p class="dim" style="margin:0;font-size:13px">Move the slider above 0% to see how fast you'd reach your goal.</p>`;
    else {
      const pct = byDep / need * 100;
      const hrs = need / weeks / (wage * (1 - tax) * share);
      goal = `<div class="flex between" style="margin-bottom:8px;font-size:13px"><span>Covers <b class="${pct >= 100 ? 'c4' : 'c3'}">${Math.round(Math.min(pct, 999))}%</b> of the ${money(need, { whole: true })} you still need</span><span class="mono dim" style="font-size:11px">${money(byDep, { whole: true })} / ${money(need, { whole: true })}</span></div>
        ${progress(Math.min(pct, 100))}
        <div class="earn-notes"><div>${pct >= 100
          ? `You'd have it covered — about <b>${Math.ceil(hrs * 10) / 10} hours a week</b> would be enough at ${Math.round(share * 100)}%.`
          : `To reach your goal by departure while putting ${Math.round(share * 100)}% toward Japan, work about <b>${Math.ceil(hrs * 10) / 10} hours a week</b>${hrs > 40 ? ' <span class="c1">— more than full time, try a higher percentage</span>' : ''}.`}</div></div>`;
    }

    return `<div class="panel" style="border-top:0;border-radius:0">
        <div class="split-bar"><span class="j" style="width:${share * 100}%"></span><span class="s" style="width:${100 - share * 100}%"></span></div>
        <div class="flex between" style="font-size:12.5px;margin-top:10px">
          <span><span class="pill" style="--c:${RAINBOW[5]}"><span class="sw"></span>Toward Japan</span> <b class="mono" style="font-weight:400;color:var(--text)">${money(toJapan, { whole: true })}</b><span class="dim">/week</span></span>
          <span><span class="pill" style="--c:#5a5a60"><span class="sw"></span>Spending money</span> <b class="mono" style="font-weight:400;color:var(--text)">${money(spend, { whole: true })}</b><span class="dim">/week</span></span>
        </div>
      </div>
      <div class="stats" style="border-radius:0;border-top:0">
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[3]}"></span>Take-home / week</div><div class="stat-value num">${money(net, { whole: true })}</div><div class="stat-sub">${money(gross, { whole: true })} before ${Math.round(tax * 100)}% taxes</div></div>
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[4]}"></span>Take-home / month</div><div class="stat-value num">${money(pm(net), { whole: true })}</div><div class="stat-sub">${money(pm(gross), { whole: true })} before taxes</div></div>
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[5]}"></span>Toward Japan / month</div><div class="stat-value num">${money(pm(toJapan), { whole: true })}</div><div class="stat-sub">${Math.round(share * 100)}% of take-home</div></div>
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[1]}"></span>Saved by departure</div><div class="stat-value num">${byDep !== null ? money(byDep, { whole: true }) : '—'}</div><div class="stat-sub">${weeks ? (dp.approx ? '~' : '') + plural(Math.floor(weeks), 'week') + ' left' : 'departed'}</div></div>
      </div>
      <div class="panel" style="border-top:0;border-radius:0 0 var(--radius) var(--radius)">${goal}
        ${dp.approx ? `<p class="dim" style="font-size:11.5px;margin:16px 0 0">Counting until about ${esc(dp.label)}.</p>` : ''}
      </div>`;
  }

  function pageEarnings() {
    const e = state.earn;
    const sv = clamp(Number(e.save) || 0, 0, 100);
    return `<div class="page">
      ${pageHead('earnings', 'What a job <em>adds up to</em>', 'Put in your pay and hours to see what you\'d take home, and how much of it can go toward Tokyo.')}
      <div class="panel" style="border-radius:var(--radius) var(--radius) 0 0">
        <div class="earn-inputs">
          <label class="field"><span class="lbl">Hourly wage</span><div class="input-wrap"><span class="prefix">${sym()}</span><input class="input" type="number" min="0" step="any" data-earn="wage" value="${e.wage ? fromBase(e.wage) : ''}" placeholder="${cur() === 'JPY' ? '2,250' : '15'}"/></div></label>
          <label class="field"><span class="lbl">Hours per week</span><input class="input" type="number" min="0" step="any" data-earn="hours" value="${e.hours || ''}" placeholder="20"/></label>
          <label class="field"><span class="lbl">Taxes %</span><input class="input" type="number" min="0" max="100" step="any" data-earn="tax" value="${e.tax}"/></label>
        </div>
        <p class="dim" style="font-size:11.5px;margin:10px 0 0">Taxes start at 10% — a rough figure for a part-time job in Utah (Social Security &amp; Medicare are 7.65%, plus some state and federal tax). Check a pay stub and adjust.</p>
        <div class="divider"></div>
        <label class="field"><span class="lbl">How much of your take-home goes toward Japan — <b id="save-pct" style="color:var(--text);font-weight:500">${Math.round(sv)}%</b></span>
          <input class="range" type="range" min="0" max="100" step="5" data-earn="save" value="${sv}" aria-label="Percent of take-home pay toward Japan"/></label>
      </div>
      <div id="earn-results">${earnResultsHtml()}</div>
    </div>`;
  }

  /* ---------------- documents ---------------- */
  function pageDocuments() {
    const docs = state.documents, f = state.ui.docStatus;
    const count = k => docs.filter(d => d.status === k).length;
    const order = { attention: 0, pending: 1, obtained: 2 };
    const list = docs.filter(d => !f || d.status === f).sort((a, b) => order[a.status] - order[b.status] || (a.created || 0) - (b.created || 0));

    const expInfo = d => {
      if (!d.expiration) return '';
      const dd = daysUntil(d.expiration);
      const cls = dd < 0 ? 'overdue' : dd <= 180 ? 'soon' : '';
      const txt = dd < 0 ? `expired ${fmtDate(d.expiration)}` : `expires ${fmtDate(d.expiration)}${dd <= 180 ? ` · ${rel(dd)}` : ''}`;
      const warn = d.category === 'Passport' && S().returnDate && d.expiration < S().returnDate && dd >= 0 ? ' · before you come home' : '';
      return `<span class="${cls || (warn ? 'soon' : '')}">${txt}${warn}</span>`;
    };

    return `<div class="page">
      ${pageHead('documents', 'Paperwork', 'Everything for the GED, SLCC, Sophia and the consulate — what you have and what you\'re still waiting on.',
        `<button class="btn primary" data-action="add-doc">${icon('plus')} New document</button>`)}

      <div class="stats s-3">
        ${Object.entries(DOC_STATUS).map(([k, v]) => `<div class="stat"><div class="stat-label"><span class="sw" style="background:${v.color}"></span>${v.label}</div><div class="stat-value num ${k === 'attention' && count(k) ? 'c1' : ''}">${count(k)}</div><div class="stat-sub">of ${plural(docs.length, 'document')}</div></div>`).join('')}
      </div>
      ${docs.length ? `<div class="status-split" style="margin-top:16px">${Object.entries(DOC_STATUS).map(([k, v]) => `<span style="width:${count(k) / docs.length * 100}%;background:${v.color}"></span>`).join('')}</div>` : ''}

      <section class="section">
        <div class="toolbar"><div class="chips">
          <button class="chip ${!f ? 'on' : ''}" data-action="doc-filter" data-val="">All <span class="ct">${docs.length}</span></button>
          ${Object.entries(DOC_STATUS).map(([k, v]) => `<button class="chip ${f === k ? 'on' : ''}" style="--c:${v.color}" data-action="doc-filter" data-val="${k}"><span class="sw"></span>${v.label} <span class="ct">${count(k)}</span></button>`).join('')}
        </div></div>
        ${list.length ? `<div class="rows">${list.map(d => {
          const st = DOC_STATUS[d.status] || DOC_STATUS.pending;
          return `<div class="row" style="align-items:center">
            <div class="doc-ico" style="--c:${st.color}"><i></i></div>
            <div class="grow">
              <div class="row-title">${esc(d.name)}</div>
              <div class="row-meta"><span class="tag">${esc(d.category)}</span>${expInfo(d)}${d.notes ? `<span class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:460px">${esc(d.notes)}</span>` : ''}</div>
            </div>
            <div class="hide-sm">${d.fileId
              ? `<span class="flex" style="gap:4px"><button class="file-link" data-action="open-file" data-id="${d.id}" title="Open ${esc(d.fileName)}">${icon('clip')}${esc(d.fileName)}</button><button class="icon-btn del" data-action="remove-file" data-id="${d.id}" aria-label="Remove attachment">${icon('x')}</button></span>`
              : `<button class="btn sm ghost" data-action="attach-file" data-id="${d.id}">${icon('clip')} Attach</button>`}</div>
            <label class="status-wrap" style="--c:${st.color}"><select class="status-select" data-doc-status="${d.id}" aria-label="Status">${options(Object.entries(DOC_STATUS).map(([k, v]) => [k, v.label]), d.status)}</select></label>
            <div class="actions"><button class="icon-btn" data-action="edit-doc" data-id="${d.id}" aria-label="Edit document">${icon('edit')}</button><button class="icon-btn del" data-action="del-doc" data-id="${d.id}" aria-label="Delete document">${icon('trash')}</button></div>
          </div>`;
        }).join('')}</div>`
          : `<div class="rows">${docs.length
            ? emptyState('Nothing here', 'No documents with this status.', `<button class="btn sm" data-action="doc-filter" data-val="">Show all</button>`)
            : emptyState('No documents', 'Add the SLCC → Sophia paperwork list, or add your own.', `<button class="btn sm" data-action="starter-docs">Add my document list</button><button class="btn primary sm" data-action="add-doc">${icon('plus')} New document</button>`)}</div>`}
        <p class="dim mt-16" style="font-size:12px">Attachments are stored privately in this browser only. Export a backup from Settings to keep a copy.</p>
      </section>
    </div>`;
  }

  /* ---------------- timeline ---------------- */
  function pageTimeline() {
    const s = S();
    const items = state.milestones.map(m => ({ ...m, kind: 'milestone' }));
    const dp = dep();
    items.push({ id: '__dep', title: dp.approx ? `Fly to ${CITY} (around ${dp.label})` : `Fly to ${CITY}`, date: dp.date, type: 'Departure', notes: dp.approx ? 'Estimated — set the exact date in Settings once you know it' : HOST, kind: 'departure', done: daysUntil(dp.date) < 0 });
    if (s.returnDate) items.push({ id: '__ret', title: 'Back home to Salt Lake', date: s.returnDate, type: 'Return', notes: '', kind: 'return', done: daysUntil(s.returnDate) < 0 });
    const dated = items.filter(i => i.date).sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'departure' ? 1 : -1));
    const undated = items.filter(i => !i.date);
    const ms = state.milestones, msDone = ms.filter(m => m.done).length;
    const next = dated.find(i => !i.done && i.date >= today());

    const tlItem = it => {
      const dd = daysUntil(it.date);
      const color = it.kind === 'milestone' ? catColor(MS_TYPES, it.type) : RAINBOW[6];
      const past = dd < 0;
      const cls = [it.done ? 'done' : '', past ? 'past' : '', it.kind === 'departure' ? 'departure' : ''].join(' ');
      const actions = it.kind === 'milestone'
        ? `<button class="icon-btn ${it.done ? 'on' : ''}" data-action="toggle-ms" data-id="${it.id}" aria-label="${it.done ? 'Mark not done' : 'Mark done'}" title="${it.done ? 'Mark not done' : 'Mark done'}">${icon(it.done ? 'undo' : 'check')}</button><button class="icon-btn" data-action="edit-ms" data-id="${it.id}" aria-label="Edit">${icon('edit')}</button><button class="icon-btn del" data-action="del-ms" data-id="${it.id}" aria-label="Delete">${icon('trash')}</button>`
        : `<a class="icon-btn" href="#settings" aria-label="Edit dates">${icon('edit')}</a>`;
      return `<div class="tl-item ${cls}" style="--c:${color}">
        <span class="tl-node"></span>
        <div class="tl-date"><b>${parseD(it.date).getDate()}</b>${fmtDate(it.date, { weekday: 'short', month: 'short' })}</div>
        <div class="grow" style="min-width:0">
          <div class="row-title" style="${it.kind === 'departure' ? 'font-family:var(--serif);font-size:22px' : ''}">${esc(it.title)}</div>
          <div class="row-meta"><span class="pill" style="--c:${color};font-size:12px;color:var(--dim)"><span class="sw"></span>${esc(it.type || 'Milestone')}</span>
            <span class="${!it.done && past ? 'overdue' : !it.done && dd <= 14 ? 'soon' : ''}">${it.done && it.kind === 'milestone' ? 'completed' : rel(dd)}</span></div>
          ${it.notes ? `<div class="muted" style="font-size:13px;margin-top:8px;white-space:pre-wrap">${esc(it.notes)}</div>` : ''}
        </div>
        <div class="flex" style="gap:2px">${actions}</div>
      </div>`;
    };

    let html = '', lastMonth = '', todayPlaced = false;
    const t = today();
    const month = d => { if (d.slice(0, 7) !== lastMonth) { html += `<div class="tl-month">${fmtDate(d, { month: 'long', year: 'numeric' })}</div>`; lastMonth = d.slice(0, 7); } };
    for (const it of dated) {
      if (!todayPlaced && it.date >= t) { month(t); html += `<div class="tl-today"><span>Today</span></div>`; todayPlaced = true; }
      month(it.date);
      html += tlItem(it);
    }
    if (dated.length && !todayPlaced) { month(t); html += `<div class="tl-today"><span>Today</span></div>`; }

    return `<div class="page">
      ${pageHead('timeline', 'The road to <em>Tokyo</em>', 'Every step from your GED to Sophia, in order.',
        `<button class="btn primary" data-action="add-ms">${icon('plus')} New milestone</button>`)}

      <div class="stats s-3">
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[6]}"></span>Next up</div><div class="stat-value" style="font-size:24px">${next ? esc(next.title) : '—'}</div><div class="stat-sub">${next ? `${fmtDate(next.date)} · ${rel(daysUntil(next.date))}` : 'nothing dated yet'}</div></div>
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[3]}"></span>Milestones</div><div class="stat-value num">${msDone}<span class="dim" style="font-size:22px">/${ms.length}</span></div><div class="stat-sub">completed</div></div>
        <div class="stat"><div class="stat-label"><span class="sw" style="background:${RAINBOW[0]}"></span>Departure</div><div class="stat-value num">${daysUntil(dp.date) >= 0 ? (dp.approx ? '~' : '') + daysUntil(dp.date) : '✓'}</div><div class="stat-sub">${daysUntil(dp.date) >= 0 ? (dp.approx ? 'days to go · estimate' : 'days to go') : 'departed'}</div></div>
      </div>

      <section class="section">
        ${dated.length ? `<div class="timeline">${html}</div>` : `<div class="rows">${emptyState('Nothing dated yet', 'Give a milestone below a date, or set your departure date in Settings, to start the timeline.', `<button class="btn primary sm" data-action="add-ms">${icon('plus')} New milestone</button>`)}</div>`}
        ${undated.length ? `<div class="section">${sectionHead('—', 'Not dated yet')}<div class="rows">${undated.map(m => `<div class="row"><span class="pill" style="--c:${catColor(MS_TYPES, m.type)}"><span class="sw"></span></span><div class="grow"><div class="row-title">${esc(m.title)}</div><div class="row-meta">${esc(m.type || 'Milestone')}${m.done ? ' · completed' : ''}</div></div><div class="actions" style="opacity:1"><button class="btn sm" data-action="edit-ms" data-id="${m.id}">${icon('calendar')} Set date</button><button class="icon-btn del" data-action="del-ms" data-id="${m.id}" aria-label="Delete">${icon('trash')}</button></div></div>`).join('')}</div></div>` : ''}
        ${!ms.length ? `<div class="flex mt-16"><button class="btn sm" data-action="starter-ms">Add my milestone list</button></div>` : ''}
      </section>
    </div>`;
  }

  /* ---------------- Japan list ---------------- */
  const WISH_HINTS = ['See Mt. Fuji', 'Eat ramen in a tiny shop', 'Ride the shinkansen', 'Visit Kyoto in autumn', 'Sing karaoke with classmates', 'Climb to Fushimi Inari'];
  function pageList() {
    const all = state.wishes, f = state.ui.wishCat;
    const done = all.filter(w => w.done).length;
    const count = c => all.filter(w => w.category === c).length;
    // open items first (newest on top), finished ones after
    const list = all.filter(w => !f || w.category === f).sort((a, b) => (a.done - b.done) || (a.done ? (b.doneAt || '').localeCompare(a.doneAt || '') : b.created - a.created));
    const hint = WISH_HINTS[all.length % WISH_HINTS.length];

    return `<div class="page">
      ${pageHead('japan list', 'Things to do in <em>Japan</em>', 'Write ideas down whenever they come to you, and check them off once you\'re there.')}

      <form id="wish-form" class="panel wish-add" autocomplete="off">
        <input class="input" name="title" placeholder="e.g. ${esc(hint)}" aria-label="New idea" maxlength="200"/>
        <select class="select" name="category" aria-label="Category">${options(WISH_CATS, state.ui.wishCatAdd)}</select>
        <button type="submit" class="btn primary">${icon('plus')} Add</button>
      </form>

      <section class="section">
        <div class="toolbar">
          <div class="chips">
            <button class="chip ${!f ? 'on' : ''}" data-action="wish-filter" data-val="">All <span class="ct">${all.length}</span></button>
            ${WISH_CATS.filter(c => count(c)).map(c => `<button class="chip ${f === c ? 'on' : ''}" style="--c:${catColor(WISH_CATS, c)}" data-action="wish-filter" data-val="${c}"><span class="sw"></span>${c} <span class="ct">${count(c)}</span></button>`).join('')}
          </div>
          <div class="grow"></div>
          ${all.length ? `<span class="mono dim" style="font-size:11px">${done} of ${all.length} done</span>` : ''}
        </div>
        ${list.length ? `<div class="rows">${list.map(w => {
          const color = catColor(WISH_CATS, w.category);
          return `<div class="row task ${w.done ? 'done' : ''}" style="align-items:center">
            <button class="tick ${w.done ? 'done' : ''}" style="--c:${color}" data-action="wish-toggle" data-id="${w.id}" aria-label="${w.done ? 'Mark not done' : 'Mark done'}" aria-pressed="${!!w.done}">${icon('check')}</button>
            <div class="grow">
              <div class="row-title" data-action="wish-edit" data-id="${w.id}">${esc(w.title)}</div>
              <div class="row-meta"><span class="pill" style="--c:${color};font-size:12px;color:var(--dim)"><span class="sw"></span>${esc(w.category)}</span>${w.done && w.doneAt ? `<span>done ${fmtDate(w.doneAt)}</span>` : ''}${w.notes ? `<span class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:460px">${esc(w.notes)}</span>` : ''}</div>
            </div>
            <div class="actions"><button class="icon-btn" data-action="wish-edit" data-id="${w.id}" aria-label="Edit">${icon('edit')}</button><button class="icon-btn del" data-action="wish-del" data-id="${w.id}" aria-label="Delete">${icon('trash')}</button></div>
          </div>`;
        }).join('')}</div>`
          : `<div class="rows">${all.length
            ? emptyState('Nothing in this category', 'Try another filter.', `<button class="btn sm" data-action="wish-filter" data-val="">Show all</button>`)
            : emptyState('Your list is empty', 'Places to see, food to try, things to learn — add them as you think of them.')}</div>`}
      </section>
    </div>`;
  }

  function wishForm(w) {
    formModal({
      eyebrow: 'japan list', title: 'Edit idea',
      fields: [
        { name: 'title', label: 'Idea', required: true, value: w.title, full: true },
        { name: 'category', label: 'Category', type: 'select', options: WISH_CATS, value: w.category },
        { name: 'done', label: 'Done', type: 'checkbox', value: w.done },
        { name: 'notes', label: 'Notes', type: 'textarea', value: w.notes || '', placeholder: 'Where it is, who told you about it, when to go…', full: true },
      ],
      submit: 'Save changes',
      onDelete: () => confirmDialog({ title: 'Delete this idea?', message: `“${esc(w.title)}” will be removed from your list.`, onConfirm: () => { closeModal(); removeById('wishes', w.id); commit('Removed', RAINBOW[0]); } }),
      onSubmit: v => {
        if (v.done && !w.done) v.doneAt = today();
        if (!v.done) v.doneAt = '';
        Object.assign(w, v);
        commit('Saved', RAINBOW[5]);
      },
    });
  }

  /* ---------------- settings ---------------- */
  function pageSettings() {
    const s = S();
    const usage = (() => { try { return (localStorage.getItem(STORE_KEY) || '').length; } catch { return 0; } })();
    return `<div class="page">
      ${pageHead('settings', 'Settings', `${esc(HOME)} → ${esc(HOST)}, ${CITY}.`)}

      <form id="settings-form" novalidate>
        <div class="settings-block">
          <div><h3>Dates</h3><p>Don't know the exact day yet? Pick the semester you're aiming for — the countdown and earnings use an estimate until you add the real date.</p></div>
          <div class="form-grid">
            <div class="field"><label>Target semester at Sophia</label><select class="select" name="targetTerm">${options([['spring', 'Spring (starts April)'], ['fall', 'Fall (starts September)']], s.targetTerm)}</select></div>
            <div class="field"><label>Year</label><select class="select" name="targetYear">${options(Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i), s.targetYear)}</select></div>
            <div class="field"><label>Exact departure date</label><input class="input" type="date" name="departureDate" value="${esc(s.departureDate)}"/><span class="hint">Leave blank until you book your flight</span></div>
            <div class="field"><label>Return date</label><input class="input" type="date" name="returnDate" value="${esc(s.returnDate)}"/><span class="hint">Optional — used to check your passport is valid long enough</span></div>
          </div>
        </div>
        <div class="settings-block">
          <div><h3>Money</h3><p>How amounts are shown.</p></div>
          <div class="form-grid">
            <div class="field"><label>Show amounts in</label><select class="select" name="currency">${options([['USD', 'US Dollars ($)'], ['JPY', 'Japanese Yen (¥)']], s.currency)}</select></div>
            <div class="field"><label>Exchange rate</label><div class="input-wrap"><span class="prefix" style="font-size:11px">¥</span><input class="input" type="number" name="jpyRate" min="0.01" step="any" value="${esc(s.jpyRate)}"/></div><span class="hint">Yen per $1. Update it now and then — nothing is fetched online.</span></div>
            <div class="field full"><label class="check"><input type="checkbox" name="showSecondary" ${s.showSecondary ? 'checked' : ''}/> Show the other currency beside the total</label></div>
          </div>
        </div>
        <div class="settings-block">
          <div></div>
          <div class="flex"><button type="submit" class="btn primary">${icon('check')} Save settings</button></div>
        </div>
      </form>

      <div class="settings-block">
        <div><h3>Your data</h3><p>Stored in this browser only. Export now and then to keep a backup.</p></div>
        <div>
          <div class="flex wrap">
            <button class="btn" data-action="export">${icon('download')} Export backup</button>
            <button class="btn" data-action="import">${icon('upload')} Import backup</button>
            <span class="dim mono" style="font-size:11px">${(usage / 1024).toFixed(1)} KB used · ${storageOk ? 'saved' : 'save failed'}</span>
          </div>
          <div class="danger-zone mt-24">
            <div><div style="color:var(--text)">Start over</div><div class="dim" style="font-size:12.5px">Deletes your saved amount, documents, attachments, milestones and Japan list, and resets the budget to Sophia defaults.</div></div>
            <button class="btn danger" data-action="reset">${icon('trash')} Reset all data</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ==========================================================
     FORMS / ACTIONS
     ========================================================== */
  function commit(msg, color) { save(); render(); if (msg) toast(msg, color); }

  function docForm(d) {
    formModal({
      eyebrow: 'documents', title: d ? 'Edit document' : 'New document', size: 'wide',
      fields: [
        { name: 'name', label: 'Document name', required: true, value: d?.name || '', placeholder: 'e.g. Passport', full: true },
        { name: 'category', label: 'Category', type: 'select', options: DOC_CATS.includes(d?.category) || !d ? DOC_CATS : [d.category, ...DOC_CATS], value: d?.category || DOC_CATS[0] },
        { name: 'status', label: 'Status', type: 'select', options: Object.entries(DOC_STATUS).map(([k, v]) => [k, v.label]), value: d?.status || 'pending' },
        { name: 'expiration', label: 'Expiration date', type: 'date', value: d?.expiration || '', hint: 'Leave blank if it doesn\'t expire' },
        { name: 'file', label: d?.fileId ? `Replace attachment (${d.fileName})` : 'Attachment', type: 'file', hint: 'Optional — PDF, photo, anything' },
        { name: 'notes', label: 'Notes', type: 'textarea', value: d?.notes || '', placeholder: 'Document number, where it\'s kept…', full: true },
      ],
      submit: d ? 'Save changes' : 'Add document',
      onDelete: d ? () => confirmDialog({ title: 'Delete this document?', message: `“${esc(d.name)}” and any attached file will be removed.`, onConfirm: async () => { closeModal(); await deleteDoc(d); } }) : null,
      onSubmit: async v => {
        const file = v.file; delete v.file;
        let doc = d;
        if (doc) Object.assign(doc, v);
        else { doc = { id: uid(), created: Date.now(), fileId: null, fileName: '', fileType: '', ...v }; state.documents.push(doc); }
        if (file) { const err = await storeFile(doc, file); if (err) { save(); render(); return err; } }
        commit(d ? 'Document updated' : 'Document added', RAINBOW[3]);
      },
    });
  }

  async function storeFile(doc, file) {
    if (file.size > 50 * 1024 * 1024) return 'That file is over 50 MB — please attach a smaller copy.';
    try {
      const id = doc.fileId || uid();
      await files.put(id, { blob: file, name: file.name, type: file.type });
      Object.assign(doc, { fileId: id, fileName: file.name, fileType: file.type });
    } catch (e) { console.error(e); return 'Could not store the file in this browser.'; }
  }

  async function deleteDoc(d) {
    if (d.fileId) { try { await files.del(d.fileId); } catch (e) { console.error(e); } }
    removeById('documents', d.id);
    commit('Document deleted', RAINBOW[0]);
  }

  async function openFile(d) {
    try {
      const rec = await files.get(d.fileId);
      if (!rec) { toast('Attachment not found in this browser', RAINBOW[0]); return; }
      const url = URL.createObjectURL(rec.blob);
      const w = window.open(url, '_blank');
      if (!w) { const a = document.createElement('a'); a.href = url; a.download = rec.name; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { console.error(e); toast('Could not open the attachment', RAINBOW[0]); }
  }

  function msForm(m) {
    formModal({
      eyebrow: 'timeline', title: m ? 'Edit milestone' : 'New milestone',
      fields: [
        { name: 'title', label: 'Milestone', required: true, value: m?.title || '', placeholder: 'e.g. Sophia application due', full: true },
        { name: 'date', label: 'Date', type: 'date', value: m?.date || '' },
        { name: 'type', label: 'Type', type: 'select', options: MS_TYPES.includes(m?.type) || !m ? MS_TYPES : [m.type, ...MS_TYPES], value: m?.type || MS_TYPES[0] },
        { name: 'notes', label: 'Notes', type: 'textarea', value: m?.notes || '', full: true },
        ...(m ? [{ name: 'done', label: 'Completed', type: 'checkbox', value: m.done }] : []),
      ],
      submit: m ? 'Save changes' : 'Add to timeline',
      onDelete: m ? () => confirmDialog({ title: 'Delete this milestone?', message: `“${esc(m.title)}” will be removed from your timeline.`, onConfirm: () => { closeModal(); removeById('milestones', m.id); commit('Milestone deleted', RAINBOW[0]); } }) : null,
      onSubmit: v => {
        if (m) Object.assign(m, v); else state.milestones.push({ id: uid(), created: Date.now(), done: false, ...v });
        commit(m ? 'Milestone updated' : 'Added to timeline', RAINBOW[6]);
      },
    });
  }

  function pickFile(accept, cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept;
    inp.onchange = () => inp.files[0] && cb(inp.files[0]);
    inp.click();
  }

  const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

  async function exportData() {
    const attachments = {};
    for (const d of state.documents.filter(x => x.fileId)) {
      try { const rec = await files.get(d.fileId); if (rec) attachments[d.fileId] = { name: rec.name, type: rec.type, data: await blobToDataURL(rec.blob) }; } catch (e) { console.error(e); }
    }
    const blob = new Blob([JSON.stringify({ app: 'exchange-journal', exported: new Date().toISOString(), state, attachments }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `exchange-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup exported');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch { toast('That file isn\'t a valid backup', RAINBOW[0]); return; }
      const incoming = data && data.state ? data.state : data;
      if (!incoming || typeof incoming !== 'object' || !incoming.settings) { toast('That file isn\'t a valid backup', RAINBOW[0]); return; }
      confirmDialog({
        title: 'Replace current data?', confirm: 'Import backup',
        message: `This replaces everything in the app with the backup${data.exported ? ` from ${esc(new Date(data.exported).toLocaleDateString())}` : ''}.`,
        onConfirm: async () => {
          try { await files.clear(); } catch (e) { console.error(e); }
          for (const [id, a] of Object.entries(data.attachments || {})) {
            try { const blob = await (await fetch(a.data)).blob(); await files.put(id, { blob, name: a.name, type: a.type }); } catch (e) { console.error(e); }
          }
          state = upgrade(incoming.version === 2 ? normalize(incoming) : fromV1(incoming));
          commit('Backup imported');
        },
      });
    };
    reader.readAsText(file);
  }

  const actions = {
    'duration': el => {
      const p = state.plan; p.duration = el.dataset.val;
      if (DURATIONS[p.duration]) p.months = DURATIONS[p.duration].months;
      save(); render();
    },
    'toggle-items': () => { state.ui.editItems = !state.ui.editItems; save(); render(); },
    'item-add': () => {
      state.plan.items.push({ id: uid(), name: 'New item', amount: 0, cur: cur(), unit: 'once', cat: 'Other', note: '' });
      save(); render();
      const last = $$('[data-item$="|name"]').pop(); if (last) { last.focus(); last.select(); }
    },
    'item-del': el => {
      const it = find(state.plan.items, el.dataset.id);
      confirmDialog({ title: 'Remove this line?', message: `“${esc(it.name)}” will be removed from the budget.`, confirm: 'Remove', onConfirm: () => { removeById2(it.id); commit('Line removed', RAINBOW[0]); } });
    },
    'items-reset': () => confirmDialog({ title: 'Reset to Sophia defaults?', message: 'Your edits to the line items will be replaced with the starting figures.', confirm: 'Reset', onConfirm: () => { state.plan.items = makeItems(); commit('Budget reset'); } }),

    'add-doc': () => docForm(),
    'edit-doc': el => docForm(find(state.documents, el.dataset.id)),
    'del-doc': el => { const d = find(state.documents, el.dataset.id); confirmDialog({ title: 'Delete this document?', message: `“${esc(d.name)}” and any attached file will be removed.`, onConfirm: () => deleteDoc(d) }); },
    'doc-filter': el => { state.ui.docStatus = el.dataset.val; save(); render(); },
    'attach-file': el => { const d = find(state.documents, el.dataset.id); pickFile('', async f => { const err = await storeFile(d, f); if (err) toast(err, RAINBOW[0]); else commit('File attached', RAINBOW[3]); }); },
    'open-file': el => openFile(find(state.documents, el.dataset.id)),
    'remove-file': el => { const d = find(state.documents, el.dataset.id); confirmDialog({ title: 'Remove attachment?', message: `“${esc(d.fileName)}” will be deleted from this browser. The document stays.`, confirm: 'Remove', onConfirm: async () => { try { await files.del(d.fileId); } catch (e) { console.error(e); } Object.assign(d, { fileId: null, fileName: '', fileType: '' }); commit('Attachment removed', RAINBOW[0]); } }); },
    'starter-docs': () => { state.documents.push(...starterDocs()); commit('Document list added', RAINBOW[3]); },

    'wish-filter': el => { state.ui.wishCat = el.dataset.val; save(); render(); },
    'wish-toggle': el => { const w = find(state.wishes, el.dataset.id); w.done = !w.done; w.doneAt = w.done ? today() : ''; commit(w.done ? 'Done — nice' : 'Marked not done', w.done ? RAINBOW[3] : RAINBOW[2]); },
    'wish-edit': el => wishForm(find(state.wishes, el.dataset.id)),
    'wish-del': el => { const w = find(state.wishes, el.dataset.id); confirmDialog({ title: 'Delete this idea?', message: `“${esc(w.title)}” will be removed from your list.`, onConfirm: () => { removeById('wishes', w.id); commit('Removed', RAINBOW[0]); } }); },

    'add-ms': () => msForm(),
    'edit-ms': el => msForm(find(state.milestones, el.dataset.id)),
    'del-ms': el => { const m = find(state.milestones, el.dataset.id); confirmDialog({ title: 'Delete this milestone?', message: `“${esc(m.title)}” will be removed from your timeline.`, onConfirm: () => { removeById('milestones', m.id); commit('Milestone deleted', RAINBOW[0]); } }); },
    'toggle-ms': el => { const m = find(state.milestones, el.dataset.id); m.done = !m.done; commit(m.done ? 'Milestone complete' : 'Marked not done', m.done ? RAINBOW[3] : RAINBOW[2]); },
    'starter-ms': () => { state.milestones.push(...starterMs()); commit('Milestone list added', RAINBOW[6]); },

    'export': () => exportData(),
    'import': () => pickFile('application/json,.json', importData),
    'reset': () => confirmDialog({
      title: 'Reset all data?', confirm: 'Yes, delete everything',
      message: 'This deletes your saved amount, documents, attachments, milestones and budget edits in this browser. Consider exporting a backup first. <b style="color:var(--text)">This cannot be undone.</b>',
      onConfirm: async () => {
        try { await files.clear(); } catch (e) { console.error(e); }
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(OLD_KEY);
        state = defaultState();
        save(); go('budget'); render(); toast('All data reset', RAINBOW[0]);
      },
    }),
  };
  const removeById2 = id => { state.plan.items = state.plan.items.filter(i => i.id !== id); };

  /* ==========================================================
     ROUTER / RENDER
     ========================================================== */
  const PAGES = { budget: pageBudget, earnings: pageEarnings, documents: pageDocuments, timeline: pageTimeline, list: pageList, settings: pageSettings };
  const route = () => { const h = location.hash.replace('#', ''); return PAGES[h] ? h : 'budget'; };
  function go(r) { if (location.hash !== '#' + r) location.hash = r; else render(); }

  function renderNav() {
    const r = route();
    const attention = state.documents.filter(d => d.status === 'attention').length;
    $('#nav').innerHTML = ROUTES.map((x, i) => `<a href="#${x.id}" class="${x.id === r ? 'active' : ''}" style="--accent:${x.color}" ${x.id === r ? 'aria-current="page"' : ''}>
      <span class="num">0${i + 1}</span>${x.label}
      ${x.id === 'documents' && attention ? `<span class="badge" title="${attention} need attention">${attention}</span>` : ''}
    </a>`).join('');
    const dp = dep(), d = daysUntil(dp.date);
    const g = goal(), pct = g ? clamp(saved() / g * 100, 0, 100) : 0;
    $('#sidebar-foot').innerHTML = (d >= 0
      ? `<div class="foot-count num">${dp.approx ? '~' : ''}${d}</div><div class="foot-label">days to ${CITY}${dp.approx ? ' · estimate' : ''}</div>`
      : `<div class="foot-label" style="margin-top:0">お疲れ様 — you made it</div>`)
      + `<div class="foot-bar" title="${Math.round(pct)}% of your goal saved"><span style="width:${pct}%"></span></div><div class="foot-label" style="margin-top:8px">${Math.round(pct)}% saved</div>`;
  }

  function render() {
    const r = route();
    const meta = ROUTES.find(x => x.id === r);
    document.body.style.setProperty('--accent', meta.color);
    document.title = `${meta.label} — exchange`;
    renderNav();
    $('#main').innerHTML = PAGES[r]();
  }

  /* ---------------- global events ---------------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el); }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.item && t.tagName === 'SELECT') {
      const [id, k] = t.dataset.item.split('|'); const it = find(state.plan.items, id);
      if (it) { it[k] = t.value; save(); render(); }
      return;
    }
    if (t.dataset.docStatus) {
      const d = find(state.documents, t.dataset.docStatus);
      d.status = t.value; commit(`Marked ${DOC_STATUS[t.value].label.toLowerCase()}`, DOC_STATUS[t.value].color);
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.hasAttribute('data-goal')) {
      S().goal = Math.max(0, Math.round(toBase(t.value) * 100) / 100);
      save(); refreshBudget(); return;
    }
    if (t.hasAttribute('data-saved')) {
      state.saved = Math.max(0, Math.round(toBase(t.value) * 100) / 100);
      save(); refreshBudget(); return;
    }
    if (t.dataset.item && t.tagName === 'INPUT') {
      const [id, k] = t.dataset.item.split('|'); const it = find(state.plan.items, id);
      if (!it) return;
      it[k] = k === 'amount' ? Math.max(0, Number(t.value) || 0) : t.value;
      save(); refreshBudget(); return;
    }
    if (t.dataset.plan) {
      const k = t.dataset.plan, v = Math.max(0, Number(t.value) || 0);
      if (k === 'months') {
        if (v < 1) return;
        state.plan.months = Math.min(24, Math.round(v));
        const match = Object.entries(DURATIONS).find(([, d]) => d.months === state.plan.months);
        state.plan.duration = match ? match[0] : 'custom';
        $$('[data-action="duration"]').forEach(b => b.classList.toggle('on', b.dataset.val === state.plan.duration));
      } else state.plan.buffer = Math.min(100, v);
      save(); refreshBudget(); return;
    }
    if (t.dataset.earn) {
      let v = Math.max(0, Number(t.value) || 0);
      if (t.dataset.earn === 'wage') v = toBase(v);
      else if (t.dataset.earn !== 'hours') v = Math.min(100, v);
      state.earn[t.dataset.earn] = v;
      if (t.dataset.earn === 'save') { const l = $('#save-pct'); if (l) l.textContent = Math.round(v) + '%'; }
      save();
      const box = $('#earn-results'); if (box) box.innerHTML = earnResultsHtml();
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id === 'wish-form') {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim();
      const category = WISH_CATS.includes(fd.get('category')) ? fd.get('category') : 'Other';
      state.ui.wishCatAdd = category;
      if (!title) { $('#wish-form [name=title]').focus(); return; }
      state.wishes.push({ id: uid(), created: Date.now(), title, category, notes: '', done: false, doneAt: '' });
      commit('Added to your list', RAINBOW[5]);
      $('#wish-form [name=title]')?.focus();
      return;
    }
    if (e.target.id !== 'settings-form') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const s = S();
    const newRate = Number(fd.get('jpyRate'));
    if (!(newRate > 0)) { toast('Exchange rate must be greater than zero', RAINBOW[0]); return; }
    const dep = fd.get('departureDate'), ret = fd.get('returnDate');
    if (dep && ret && ret < dep) { toast('Return date must be after departure', RAINBOW[0]); return; }
    s.departureDate = dep; s.returnDate = ret;
    s.targetTerm = fd.get('targetTerm') === 'spring' ? 'spring' : 'fall';
    s.targetYear = Number(fd.get('targetYear')) || s.targetYear;
    s.jpyRate = newRate;
    s.currency = fd.get('currency') === 'JPY' ? 'JPY' : 'USD';
    s.showSecondary = !!fd.get('showSecondary');
    commit('Settings saved', NEUTRAL);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); closeModal(); }
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); $('#main').focus({ preventScroll: true }); });

  // keep tabs in sync if the app is open in two windows
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { state = load(); render(); } });

  // refresh countdowns after midnight
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (!modalStack.length) render(); } }, 60000);

  render();
})();
