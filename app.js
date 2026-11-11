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
    { id: 'photos', label: 'Photos', color: RAINBOW[2] },
    { id: 'map', label: 'Map', color: RAINBOW[4] },
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
      photos: [],
      places: [],
      ui: { editItems: false, docStatus: '', wishCat: '', wishCatAdd: 'Places', placeFilter: '' },
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
      photos: Array.isArray(s.photos) ? s.photos : [],
      places: Array.isArray(s.places) ? s.places : [],
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

  const SYNC_KEY = 'exchange-sync-v1';
  const hadData = !!(localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_KEY));
  let state = load();
  let storageOk = true;
  // edited = when this device last changed something; synced = the cloud copy's time at last sync
  let syncMeta = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || null; } catch { return null; } })()
    || { edited: hadData ? 1 : 0, synced: 0 };
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); storageOk = true; }
    catch (e) { storageOk = false; toast('Could not save — browser storage may be full or disabled', RAINBOW[0]); }
  }
  function save() {
    persist();
    syncMeta.edited = Date.now(); writeMeta();
    scheduleSync();
  }
  persist();

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


  /* ---------------- cloud sync (Supabase) ----------------
     The app always works from the copy saved on this device. When you're signed in,
     the whole state is kept as one row per account, and the newest copy wins.
     Attached files go to a private storage bucket, in a folder named after your account. */
  const SUPABASE_URL = 'https://spfxutzadzukrynwaqhq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bxoICjWc8Z8gKbRx8EWS7w_U1VbWadk';
  const BUCKET = 'attachments';
  const sb = window.supabase && SUPABASE_KEY && !SUPABASE_KEY.startsWith('__')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const sync = { user: null, status: sb ? 'signedout' : 'off', busy: false, again: false, timer: null, asking: false, uploading: false };

  function writeMeta() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncMeta)); } catch (e) { /* ignore */ } }

  function syncLabel() {
    const ago = syncMeta.synced ? relTime(syncMeta.synced) : '';
    return {
      off: '', signedout: '<a class="link" href="#settings">Turn on sync</a>',
      syncing: 'syncing…', ok: `synced${ago ? ' · ' + ago : ''}`,
      offline: 'offline — will sync later', error: '<span class="c1">sync problem</span> · <a class="link" data-action="sync-now">retry</a>',
    }[sync.status] || '';
  }
  function relTime(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function setStatus(s) {
    sync.status = s;
    const el = $('#sync-status'); if (el) el.innerHTML = syncLabel();
    const box = $('#sync-box'); if (box && route() === 'settings') box.innerHTML = syncBoxHtml();
  }

  function scheduleSync(delay = 1200) {
    if (!sb || !sync.user) return;
    if (sync.busy) { sync.again = true; return; }
    clearTimeout(sync.timer);
    sync.timer = setTimeout(syncNow, delay);
  }

  function applyRemote(data) {
    state = upgrade(normalize(data));
    persist();
    if (!modalStack.length) render();
  }

  async function pushLocal() {
    const at = new Date(Math.max(syncMeta.edited || 0, 1)).toISOString();
    const { error } = await sb.from('app_state').upsert({ user_id: sync.user.id, data: state, updated_at: at });
    if (error) throw error;
    syncMeta.synced = Date.parse(at);
    if (!syncMeta.edited) syncMeta.edited = syncMeta.synced;
  }

  // first sign-in on a device that already has its own data, while the account has data too
  function askWhichCopy() {
    return new Promise(resolve => {
      const el = showModal(`
        <div class="modal-head"><div><div class="eyebrow"><span class="dot"></span>sync</div>
        <h2>Which data should this device use?</h2>
        <p>Your account already has saved data, and this device has its own. Pick which one to keep — the other is replaced on this device.</p></div></div>
        <div class="modal-foot"><button class="btn" data-pick="device">Replace account with this device's data</button>
        <button class="btn primary" data-pick="account">Use my account's data</button></div>`, { size: 'narrow' });
      $$('[data-pick]', el).forEach(b => b.addEventListener('click', () => { closeModal(); resolve(b.dataset.pick); }));
    });
  }

  async function syncNow() {
    if (!sb || !sync.user) return;
    if (sync.busy) { sync.again = true; return; }
    sync.busy = true; setStatus('syncing');
    try {
      const { data: row, error } = await sb.from('app_state').select('data, updated_at').eq('user_id', sync.user.id).maybeSingle();
      if (error) throw error;
      const remoteAt = row ? Date.parse(row.updated_at) : 0;
      const localAt = syncMeta.edited || 0;
      if (row && !syncMeta.synced && localAt > 0 && !sync.asking) {
        sync.asking = true;
        const pick = await askWhichCopy();
        sync.asking = false;
        if (pick === 'account') { applyRemote(row.data); syncMeta.edited = syncMeta.synced = remoteAt; }
        else { syncMeta.edited = Date.now(); await pushLocal(); }
      } else if (row && remoteAt > localAt) {
        if (remoteAt !== syncMeta.synced) applyRemote(row.data);
        syncMeta.edited = syncMeta.synced = remoteAt;
      } else if (!row || localAt > (syncMeta.synced || 0)) {
        await pushLocal();
      }
      writeMeta();
      setStatus('ok');
      uploadPendingFiles();
    } catch (e) {
      console.error('sync failed', e);
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      sync.busy = false;
      if (sync.again) { sync.again = false; scheduleSync(300); }
    }
  }

  /* attachments in the cloud */
  const cloudPath = id => `${sync.user.id}/${id}`;
  async function uploadFile(id, rec) {
    if (!sb || !sync.user) return false;
    const { error } = await sb.storage.from(BUCKET).upload(cloudPath(id), rec.blob, { upsert: true, contentType: rec.type || 'application/octet-stream' });
    if (error) { console.error(error); return false; }
    return true;
  }
  async function deleteCloudFile(id) {
    if (!sb || !sync.user || !id) return;
    try { await sb.storage.from(BUCKET).remove([cloudPath(id)]); } catch (e) { console.error(e); }
  }
  async function uploadPendingFiles() {
    if (!sb || !sync.user || sync.uploading) return;
    sync.uploading = true;
    let changed = false;
    try {
      for (const d of state.documents.filter(x => x.fileId && !x.fileCloud)) {
        const rec = await files.get(d.fileId).catch(() => null);
        if (rec && await uploadFile(d.fileId, rec)) { d.fileCloud = true; changed = true; }
      }
      for (const p of state.photos.filter(x => !x.cloud)) {
        const full = await files.get(p.full).catch(() => null), thumb = await files.get(p.thumb).catch(() => null);
        if (full && thumb && await uploadFile(p.full, full) && await uploadFile(p.thumb, thumb)) { p.cloud = true; changed = true; }
      }
    } finally { sync.uploading = false; }
    if (changed) save();
  }
  // this device's copy first, then the cloud (and keep a copy here for next time)
  async function getFileRec(d) {
    const local = await files.get(d.fileId).catch(() => null);
    if (local) return local;
    if (!sb || !sync.user || !d.fileCloud) return null;
    const { data, error } = await sb.storage.from(BUCKET).download(cloudPath(d.fileId));
    if (error || !data) { console.error(error); return null; }
    const rec = { blob: data, name: d.fileName, type: d.fileType || data.type };
    try { await files.put(d.fileId, rec); } catch (e) { console.error(e); }
    return rec;
  }

  function syncBoxHtml() {
    if (!sb) return `<p class="dim" style="margin:0;font-size:13px">Sync isn't available right now (offline, or not set up). Everything still saves on this device.</p>`;
    if (!sync.user) return `
      <form id="sync-form" class="form-grid" novalidate autocomplete="on">
        <div class="field"><label for="sync-email">Email</label><input class="input" id="sync-email" name="email" type="email" autocomplete="email" required/></div>
        <div class="field"><label for="sync-pass">Password</label><input class="input" id="sync-pass" name="password" type="password" autocomplete="current-password" minlength="6" required/></div>
        <div class="field full"><div class="flex wrap">
          <button type="submit" class="btn primary">Sign in</button>
          <button type="button" class="btn" data-action="sync-signup">Create account</button>
          <span class="dim" id="sync-msg" style="font-size:12.5px"></span>
        </div></div>
      </form>`;
    return `<div class="flex wrap" style="align-items:center">
        <div class="grow"><div style="color:var(--text)">${esc(sync.user.email || 'Signed in')}</div>
          <div class="dim" style="font-size:12.5px;margin-top:2px">${sync.status === 'ok' ? `Synced ${syncMeta.synced ? relTime(syncMeta.synced) : ''}` : syncLabel()}</div></div>
        <button class="btn sm" data-action="sync-now">Sync now</button>
        <button class="btn sm ghost" data-action="sync-signout">Sign out</button>
      </div>`;
  }

  function syncMsg(text, bad) { const m = $('#sync-msg'); if (m) { m.textContent = text; m.className = bad ? 'c1' : 'dim'; } }
  function syncCreds() {
    const f = $('#sync-form'); if (!f) return null;
    const email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) { syncMsg('Enter your email and a password.', true); return null; }
    if (password.length < 6) { syncMsg('Password needs at least 6 characters.', true); return null; }
    return { email, password };
  }

  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      // run outside the auth callback, as the Supabase docs recommend
      setTimeout(() => {
        const was = sync.user && sync.user.id;
        sync.user = session ? session.user : null;
        if (!sync.user) { setStatus('signedout'); if (route() === 'settings') render(); return; }
        if (was !== sync.user.id) { setStatus('ok'); if (route() === 'settings') render(); syncNow(); }
      }, 0);
    });
    const kick = () => { if (document.visibilityState === 'visible') scheduleSync(200); };
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('focus', kick);
    window.addEventListener('online', kick);
    setInterval(() => { if (document.visibilityState === 'visible') scheduleSync(0); }, 60000);
  }

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

  /* ---------------- photos ----------------
     Each photo is shrunk before saving (a full copy up to 1600px and a small one
     for the wall), stored on this device, and synced to your account like attachments. */
  const photoRec = (p, which) => ({ fileId: which === 'thumb' ? p.thumb : p.full, fileCloud: p.cloud, fileName: `${p.id}.jpg`, fileType: 'image/jpeg' });
  const photoUrls = new Map();
  async function photoUrl(p, which = 'thumb') {
    const id = which === 'thumb' ? p.thumb : p.full;
    if (photoUrls.has(id)) return photoUrls.get(id);
    const rec = await getFileRec(photoRec(p, which));
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
    photoUrls.set(id, url);
    return url;
  }
  function hydratePhotos(root = document) {
    $$('img[data-photo]', root).forEach(async img => {
      const p = find(state.photos, img.dataset.photo);
      if (!p) return;
      const url = await photoUrl(p, img.dataset.size || 'thumb');
      if (url) { img.src = url; img.closest('.polaroid, .lightbox-img')?.classList.add('loaded'); }
      else img.closest('.polaroid, .lightbox-img')?.classList.add('missing');
    });
  }

  function shrinkImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('encode failed')), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
      img.src = url;
    });
  }

  async function addPhotos(list) {
    const imgs = [...list].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name));
    if (!imgs.length) { toast('Pick some photos to add', RAINBOW[2]); return; }
    toast(`Adding ${plural(imgs.length, 'photo')}…`, RAINBOW[2]);
    let added = 0, failed = 0;
    for (const f of imgs) {
      try {
        const [full, thumb] = await Promise.all([shrinkImage(f, 1600, 0.85), shrinkImage(f, 600, 0.8)]);
        const p = { id: uid(), created: Date.now(), date: f.lastModified ? ymd(new Date(f.lastModified)) : today(), caption: '', place: '', full: uid(), thumb: uid(), cloud: false };
        await files.put(p.full, { blob: full, name: `${p.id}.jpg`, type: 'image/jpeg' });
        await files.put(p.thumb, { blob: thumb, name: `${p.id}-small.jpg`, type: 'image/jpeg' });
        state.photos.push(p);
        added++;
      } catch (e) { console.error(e); failed++; }
    }
    if (added) commit(`${plural(added, 'photo')} added${failed ? ` · ${failed} couldn't be read` : ''} — tap one to write on it`, RAINBOW[2]);
    else toast('Couldn\'t read those photos — try JPG or PNG', RAINBOW[0]);
  }

  async function deletePhoto(p) {
    for (const id of [p.full, p.thumb]) {
      try { await files.del(id); } catch (e) { console.error(e); }
      if (p.cloud) deleteCloudFile(id);
      if (photoUrls.has(id)) { URL.revokeObjectURL(photoUrls.get(id)); photoUrls.delete(id); }
    }
    removeById('photos', p.id);
    state.places.forEach(pl => { if (pl.photoIds) pl.photoIds = pl.photoIds.filter(x => x !== p.id); });
  }

  // a gentle, stable tilt for each polaroid
  const tilt = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 70) / 10 - 3.5).toFixed(1); };

  function pagePhotos() {
    const photos = state.photos.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.created - a.created);
    let html = '', lastMonth = '';
    for (const p of photos) {
      const m = (p.date || '').slice(0, 7);
      if (m !== lastMonth) {
        if (lastMonth) html += '</div>';
        html += `<div class="photo-month">${p.date ? fmtDate(p.date, { month: 'long', year: 'numeric' }) : 'No date'}</div><div class="polaroids">`;
        lastMonth = m;
      }
      html += `<button class="polaroid" style="--tilt:${tilt(p.id)}deg;--tape:${rc(p.id.charCodeAt(p.id.length - 1))}" data-action="photo-open" data-id="${p.id}" aria-label="${esc(p.caption || 'Photo')}">
        <span class="tape"></span>
        <span class="photo"><img data-photo="${p.id}" alt="${esc(p.caption || 'Photo')}"/></span>
        <span class="cap">${p.caption ? esc(p.caption) : '<span class="dim">tap to write…</span>'}</span>
        <span class="meta">${p.place ? esc(p.place) + ' · ' : ''}${p.date ? fmtDate(p.date, { month: 'short', day: 'numeric' }) : ''}</span>
      </button>`;
    }
    if (photos.length) html += '</div>';

    return `<div class="page" data-drop-photos>
      ${pageHead('photos', 'Pictures from <em>Japan</em>', 'Add the photos you take, and write a little something on each one.',
        `<button class="btn primary" data-action="photo-add">${icon('plus')} Add photos</button>`)}
      ${photos.length
        ? `<p class="dim mono" style="font-size:11px;margin:0 0 6px">${plural(photos.length, 'photo')} · drag photos onto the page to add more</p>${html}`
        : `<div class="rows">${emptyState('No photos yet', 'Once you\'re in Japan, add the photos you take — they\'ll show up here as polaroids.', `<button class="btn primary sm" data-action="photo-add">${icon('plus')} Add photos</button>`)}</div>`}
    </div>`;
  }

  function photoModal(p) {
    const el = showModal(`
      <form novalidate>
        <div class="lightbox-img"><img data-photo="${p.id}" data-size="full" alt="${esc(p.caption || 'Photo')}"/></div>
        <div class="modal-body"><div class="form-grid">
          <div class="field full"><label for="ph-cap">Caption</label><input class="input caption-input" id="ph-cap" name="caption" value="${esc(p.caption)}" placeholder="What was happening?" maxlength="120" autocomplete="off"/></div>
          <div class="field"><label for="ph-place">Place</label><input class="input" id="ph-place" name="place" value="${esc(p.place)}" placeholder="e.g. Shibuya" autocomplete="off"/></div>
          <div class="field"><label for="ph-date">Date</label><input class="input" id="ph-date" name="date" type="date" value="${esc(p.date)}"/></div>
        </div></div>
        <div class="modal-foot">
          <button type="button" class="btn danger left" data-del>${icon('trash')} Delete</button>
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn primary">Save</button>
        </div>
      </form>`, { size: 'wide' });
    hydratePhotos(el);
    $('[data-del]', el).addEventListener('click', () => confirmDialog({
      title: 'Delete this photo?', message: 'It will be removed from every device. This cannot be undone.',
      onConfirm: async () => { closeModal(); await deletePhoto(p); commit('Photo deleted', RAINBOW[0]); },
    }));
    $('form', el).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Object.assign(p, { caption: f.caption.value.trim(), place: f.place.value.trim(), date: f.date.value });
      closeModal();
      commit('Saved', RAINBOW[2]);
    });
  }

  /* ---------------- map ----------------
     MapLibre with OpenFreeMap tiles, just Japan. Terrain loads only while tilted,
     and the map library is fetched in the background once the app is idle.
     Place search uses OpenStreetMap's Nominatim, only when you press Search. */
  const PLACE_KINDS = ['Sights', 'Food', 'Nature', 'City', 'Stay', 'Shopping', 'Other'];
  const placeColor = p => catColor(PLACE_KINDS, p.kind);
  let mapLibLoading = null, map = null, mapView = null, pickMode = false, focusId = null, japanLoading = null;
  const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl';
  const JAPAN_BOX = [[127.4, 25.9], [146.2, 45.6]];   // all of Japan, Okinawa to Hokkaido — the farthest you can zoom out
  const JAPAN_LIMIT = [[116, 19], [158, 51]];         // how far you can drag

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('could not load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadMapLib() {
    if (window.maplibregl) return Promise.resolve();
    if (!mapLibLoading) {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = MAPLIBRE + '.css';
      document.head.appendChild(css);
      mapLibLoading = loadScript(MAPLIBRE + '.js').catch(e => { mapLibLoading = null; throw e; });
    }
    return mapLibLoading;
  }

  // Japan's outline (Natural Earth, saved with the app as japan.json): fades the rest of the map and traces the coast in rainbow
  const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a; };
  function loadJapanShape() {
    if (!japanLoading) japanLoading = fetch('japan.json').then(r => r.json()).then(land => {
      const polys = land.geometry.coordinates;
      const outer = [[90, -10], [190, -10], [190, 70], [90, 70], [90, -10]];
      const sign = Math.sign(ringArea(outer));
      const holes = polys.map(p => Math.sign(ringArea(p[0])) === sign ? p[0].slice().reverse() : p[0]);
      return {
        land,
        mask: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, ...holes] } },
        coast: { type: 'FeatureCollection', features: polys.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p[0] } })) },
      };
    }).catch(e => { japanLoading = null; throw e; });
    return japanLoading;
  }
  // start fetching the map in the background once the app is idle, so the Map page opens quickly
  function preloadMap() {
    const go = () => { loadMapLib().catch(() => {}); loadJapanShape().catch(() => {}); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2500);
  }

  // 3D terrain only loads while the map is tilted
  const DEM = { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 12, attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS Open Data</a>' };
  function syncTerrain(m) {
    const want = m.getPitch() > 8;
    try {
      if (want && !m.getTerrain()) {
        if (!m.getSource('dem')) m.addSource('dem', DEM);
        m.setTerrain({ source: 'dem', exaggeration: 1.3 });
      } else if (!want && m.getTerrain()) m.setTerrain(null);
    } catch (e) { console.warn(e); }
  }

  const shownPlaces = () => state.places.filter(p => !state.ui.placeFilter || p.status === state.ui.placeFilter);
  const placePhotos = p => (p.photoIds || []).map(id => find(state.photos, id)).filter(Boolean);
  const placesGeo = () => ({
    type: 'FeatureCollection',
    features: shownPlaces().map(p => ({ type: 'Feature', properties: { id: p.id, color: placeColor(p), want: p.status === 'want' ? 1 : 0 }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
  });

  function placePopup(p) {
    const ph = placePhotos(p);
    return `<div class="pop">
      <div class="pop-title">${esc(p.name)}</div>
      <div class="pop-meta"><span class="pill" style="--c:${placeColor(p)}"><span class="sw"></span>${esc(p.kind)}</span> · ${p.status === 'want' ? 'want to go' : p.date ? fmtDate(p.date) : 'been here'}</div>
      ${p.notes ? `<div class="pop-notes">${esc(p.notes)}</div>` : ''}
      ${ph.length ? `<div class="pop-photos">${ph.slice(0, 6).map(x => `<span class="polaroid mini" style="--tilt:${tilt(x.id)}deg"><span class="photo"><img data-photo="${x.id}" alt=""/></span></span>`).join('')}</div>` : ''}
      <button class="btn sm" data-action="place-edit" data-id="${p.id}">${icon('edit')} Edit</button>
    </div>`;
  }

  let popup = null;
  function openPlace(p, fly) {
    if (!map || !p) return;
    if (popup) popup.remove();
    const show = () => {
      popup = new maplibregl.Popup({ maxWidth: '290px', offset: 14, className: 'place-pop' }).setLngLat([p.lng, p.lat]).setHTML(placePopup(p)).addTo(map);
      hydratePhotos(popup.getElement());
    };
    if (fly) { map.flyTo({ center: [p.lng, p.lat], zoom: 10.5, pitch: 45, bearing: -15, duration: 2000, essential: true }); map.once('moveend', show); }
    else show();
  }

  async function mountMap() {
    const el = $('#map');
    if (!el) return;
    const shapeP = loadJapanShape().catch(e => { console.warn('Japan outline unavailable', e); return null; });
    try { await loadMapLib(); }
    catch { el.innerHTML = '<div class="map-off">The map needs an internet connection to load.</div>'; return; }
    if (!document.contains(el)) return;
    if (map) { try { mapView = { c: map.getCenter().toArray(), z: map.getZoom(), p: map.getPitch(), b: map.getBearing() }; map.remove(); } catch { /* already gone */ } map = null; }

    const m = new maplibregl.Map({
      container: el,
      style: 'https://tiles.openfreemap.org/styles/dark',
      ...(mapView ? { center: mapView.c, zoom: mapView.z, pitch: mapView.p, bearing: mapView.b } : { bounds: JAPAN_BOX, fitBoundsOptions: { padding: 12 } }),
      maxBounds: JAPAN_LIMIT, maxZoom: 17, maxPitch: 70,
      attributionControl: { compact: true }, fadeDuration: 0,
    });
    map = m;
    // the farthest you can zoom out is the whole of Japan on this screen
    const homeZoom = () => m.cameraForBounds(JAPAN_BOX, { padding: 12 })?.zoom ?? 4;
    m.setMinZoom(Math.max(0, homeZoom() - 0.05));
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    m.on('pitchend', () => syncTerrain(m));

    m.on('load', async () => {
      el.classList.add('ready');
      el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      const firstLabel = (m.getStyle().layers.find(l => l.type === 'symbol') || {}).id;
      // shaded relief once you zoom in a little
      m.addSource('dem-shade', { ...DEM });
      m.addLayer({ id: 'relief', type: 'hillshade', source: 'dem-shade', minzoom: 6, paint: { 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#4a4a52', 'hillshade-accent-color': '#111114', 'hillshade-exaggeration': 0.55 } }, firstLabel);
      syncTerrain(m);

      m.addSource('places', { type: 'geojson', data: placesGeo() });
      m.addLayer({ id: 'places-glow', type: 'circle', source: 'places', paint: { 'circle-radius': 15, 'circle-color': ['get', 'color'], 'circle-opacity': ['case', ['==', ['get', 'want'], 1], 0.12, 0.28], 'circle-blur': 1, 'circle-pitch-alignment': 'viewport' } });
      m.addLayer({ id: 'places-dot', type: 'circle', source: 'places', paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-opacity': ['case', ['==', ['get', 'want'], 1], 0, 0.95], 'circle-stroke-width': 2, 'circle-stroke-color': ['get', 'color'], 'circle-pitch-alignment': 'viewport' } });
      m.on('mouseenter', 'places-dot', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'places-dot', () => { m.getCanvas().style.cursor = ''; });
      m.on('click', 'places-dot', e => { if (pickMode) return; openPlace(find(state.places, e.features[0].properties.id)); });

      const jp = await shapeP;
      if (map !== m) return;
      if (jp) {
        m.addSource('not-japan', { type: 'geojson', data: jp.mask });
        m.addLayer({ id: 'not-japan', type: 'fill', source: 'not-japan', paint: { 'fill-color': '#060608', 'fill-opacity': 0.94, 'fill-antialias': false } }, 'places-glow');
        m.addSource('coast', { type: 'geojson', data: jp.coast, lineMetrics: true });
        m.addLayer({ id: 'coast', type: 'line', source: 'coast', paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 8, 2], 'line-opacity': 0.75, 'line-gradient': ['interpolate', ['linear'], ['line-progress'], ...RAINBOW.flatMap((c, i) => [i / 6, c])] } }, 'places-glow');
        // hide every label outside Japan
        m.getStyle().layers.filter(l => l.type === 'symbol').forEach(l => {
          const f = m.getFilter(l.id);
          try { m.setFilter(l.id, f ? ['all', f, ['within', jp.land]] : ['within', jp.land]); } catch (e) { console.warn(l.id, e); }
        });
      }

      if (focusId) { const p = find(state.places, focusId); focusId = null; openPlace(p, true); }
      else if (!mapView && shownPlaces().length) {
        const b = new maplibregl.LngLatBounds();
        shownPlaces().forEach(p => b.extend([p.lng, p.lat]));
        m.fitBounds(b, { padding: 70, maxZoom: 8, duration: 0 });
      }
    });

    m.on('click', e => {
      if (!pickMode) return;
      pickMode = false; el.classList.remove('picking');
      const moving = pendingMove ? find(state.places, pendingMove) : null;
      pendingMove = null;
      placeForm(moving, { lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    if (pickMode) el.classList.add('picking');
  }

  function pageMap() {
    const all = state.places, f = state.ui.placeFilter;
    const been = all.filter(p => p.status !== 'want').length, want = all.length - been;
    const list = shownPlaces().slice().sort((a, b) => (a.status === 'want') - (b.status === 'want') || (b.date || '').localeCompare(a.date || '') || b.created - a.created);
    return `<div class="page">
      ${pageHead('map', 'Where I\'ve <em>been</em>', 'Pin the places you go — and the ones you still want to see.',
        `<button class="btn primary" data-action="place-add">${icon('plus')} Add place</button>`)}
      <div class="toolbar">
        <div class="chips">
          <button class="chip ${!f ? 'on' : ''}" data-action="place-filter" data-val="">All <span class="ct">${all.length}</span></button>
          <button class="chip ${f === 'been' ? 'on' : ''}" style="--c:${RAINBOW[3]}" data-action="place-filter" data-val="been"><span class="sw"></span>Been there <span class="ct">${been}</span></button>
          <button class="chip ${f === 'want' ? 'on' : ''}" style="--c:${RAINBOW[5]}" data-action="place-filter" data-val="want"><span class="sw"></span>Want to go <span class="ct">${want}</span></button>
        </div>
        <div class="grow"></div>
        <span class="dim hide-sm" style="font-size:11.5px">Filled = been there · hollow = want to go</span>
        <button class="btn sm" data-action="map-tilt">3D tilt</button>
        <button class="btn sm ghost" data-action="map-home">All of Japan</button>
      </div>
      <div id="map" class="map"><div class="map-loading">Loading Japan…</div></div>
      <p class="dim" style="font-size:11.5px;margin:8px 0 0">Drag to move · scroll or pinch to zoom · tap 3D tilt (or two-finger drag) to see the mountains.</p>
      <section class="section">
        ${list.length ? `<div class="rows">${list.map(p => `<div class="row" style="align-items:center">
            <span class="map-dot ${p.status === 'want' ? 'want' : ''}" style="--c:${placeColor(p)}"></span>
            <div class="grow"><div class="row-title" data-action="place-focus" data-id="${p.id}" style="cursor:pointer">${esc(p.name)}</div>
              <div class="row-meta"><span class="tag">${esc(p.kind)}</span><span>${p.status === 'want' ? 'want to go' : p.date ? fmtDate(p.date) : 'been here'}</span>${placePhotos(p).length ? `<span>${plural(placePhotos(p).length, 'photo')}</span>` : ''}${p.notes ? `<span class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px">${esc(p.notes)}</span>` : ''}</div></div>
            <div class="actions"><button class="icon-btn" data-action="place-edit" data-id="${p.id}" aria-label="Edit">${icon('edit')}</button><button class="icon-btn del" data-action="place-del" data-id="${p.id}" aria-label="Delete">${icon('trash')}</button></div>
          </div>`).join('')}</div>`
          : `<div class="rows">${all.length ? emptyState('Nothing here', 'No places with this filter.', `<button class="btn sm" data-action="place-filter" data-val="">Show all</button>`)
            : emptyState('No places yet', 'Search for a place or tap a spot on the map to drop your first pin.', `<button class="btn primary sm" data-action="place-add">${icon('plus')} Add place</button>`)}</div>`}
      </section>
    </div>`;
  }

  function placeForm(p, preset = {}) {
    const v = p ? { ...p, ...(preset.lat != null ? { lat: preset.lat, lng: preset.lng } : {}) } : { name: preset.name || '', lat: preset.lat ?? null, lng: preset.lng ?? null, kind: 'Sights', status: 'been', date: today(), notes: '', photoIds: [] };
    const photos = state.photos.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const locText = () => v.lat != null ? `Pinned at ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}` : 'No location yet — search above or pick a spot on the map';
    const el = showModal(`
      <form novalidate>
        <div class="modal-head"><div><div class="eyebrow"><span class="dot"></span>map</div><h2>${p ? 'Edit place' : 'Add a place'}</h2></div>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="modal-body">
          <div class="field"><label for="pl-q">${p ? 'Move the pin — search' : 'Search for a place'}</label>
            <div class="flex" style="gap:8px"><input class="input" id="pl-q" placeholder="e.g. Fushimi Inari, Kyoto" autocomplete="off"/><button type="button" class="btn" data-search>Search</button></div>
            <div class="place-results" data-results></div>
            <div class="flex wrap" style="margin-top:8px;align-items:center"><span class="dim" style="font-size:12px" data-loc>${locText()}</span><button type="button" class="btn sm ghost" data-pick>Pick on the map instead</button></div>
          </div>
          <div class="divider"></div>
          <div class="form-grid">
            <div class="field full"><label for="pl-name">Name *</label><input class="input" id="pl-name" name="name" value="${esc(v.name)}" placeholder="What do you call it?" autocomplete="off"/></div>
            <div class="field"><label>Status</label><div class="seg" data-status>${[['been', 'Been there'], ['want', 'Want to go']].map(([k, l]) => `<button type="button" data-val="${k}" class="${v.status === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            <div class="field"><label for="pl-kind">Type</label><select class="select" id="pl-kind" name="kind">${options(PLACE_KINDS, v.kind)}</select></div>
            <div class="field"><label for="pl-date">Date</label><input class="input" id="pl-date" name="date" type="date" value="${esc(v.date || '')}"/><span class="hint">When you went (leave blank for want-to-go)</span></div>
            <div class="field full"><label for="pl-notes">Notes</label><textarea class="textarea" id="pl-notes" name="notes" placeholder="What it was like, who you went with…">${esc(v.notes)}</textarea></div>
            ${photos.length ? `<div class="field full"><label>Photos from here</label><div class="photo-pick">${photos.map(x => `<label class="pick ${v.photoIds.includes(x.id) ? 'on' : ''}"><input type="checkbox" value="${x.id}" ${v.photoIds.includes(x.id) ? 'checked' : ''}/><span class="polaroid mini"><span class="photo"><img data-photo="${x.id}" alt=""/></span></span></label>`).join('')}</div></div>` : ''}
          </div>
          <div class="form-error"></div>
        </div>
        <div class="modal-foot">
          ${p ? `<button type="button" class="btn danger left" data-del>${icon('trash')} Delete</button>` : ''}
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn primary">${p ? 'Save' : 'Add to map'}</button>
        </div>
      </form>`, { size: 'wide' });
    hydratePhotos(el);
    const err = t => { $('.form-error', el).textContent = t; };

    $('[data-status]', el).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      v.status = b.dataset.val;
      $$('[data-status] button', el).forEach(x => x.classList.toggle('on', x === b));
    });
    $$('.photo-pick input', el).forEach(c => c.addEventListener('change', () => c.closest('.pick').classList.toggle('on', c.checked)));

    const search = async () => {
      const q = $('#pl-q', el).value.trim();
      const box = $('[data-results]', el);
      if (!q) return;
      box.innerHTML = '<div class="dim" style="font-size:12px;padding:8px 0">Searching…</div>';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.length) { box.innerHTML = '<div class="dim" style="font-size:12px;padding:8px 0">No matches — try adding the city, or pick on the map.</div>'; return; }
        box.innerHTML = data.map((r, i) => `<button type="button" class="place-result" data-i="${i}"><b>${esc(r.name || r.display_name.split(',')[0])}</b><span>${esc(r.display_name)}</span></button>`).join('');
        $$('.place-result', box).forEach(b => b.addEventListener('click', () => {
          const r = data[Number(b.dataset.i)];
          v.lat = Number(r.lat); v.lng = Number(r.lon);
          const nm = $('#pl-name', el);
          if (!nm.value.trim()) nm.value = r.name || r.display_name.split(',')[0];
          $('[data-loc]', el).textContent = locText();
          box.innerHTML = `<div class="c4" style="font-size:12px;padding:8px 0">${icon('check')} ${esc(r.display_name)}</div>`;
        }));
      } catch (e) { console.error(e); box.innerHTML = '<div class="c1" style="font-size:12px;padding:8px 0">Search didn\'t work — check your connection, or pick on the map.</div>'; }
    };
    $('[data-search]', el).addEventListener('click', search);
    $('#pl-q', el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });

    $('[data-pick]', el).addEventListener('click', () => {
      closeModal();
      if (route() !== 'map') go('map');
      pickMode = true;
      $('#map')?.classList.add('picking');
      toast('Tap the map where the place is', RAINBOW[4]);
      if (p) pendingMove = p.id;
    });
    if (p) $('[data-del]', el).addEventListener('click', () => confirmDialog({ title: 'Delete this place?', message: `“${esc(p.name)}” will be removed from your map. Its photos stay.`, onConfirm: () => { closeModal(); removeById('places', p.id); commit('Place removed', RAINBOW[0]); } }));

    $('form', el).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim();
      if (!name) { err('Give the place a name.'); f.name.focus(); return; }
      if (v.lat == null) { err('Search for the place or pick it on the map first.'); return; }
      const data = { name, kind: f.kind.value, status: v.status, date: f.date.value, notes: f.notes.value.trim(), lat: v.lat, lng: v.lng, photoIds: $$('.photo-pick input:checked', el).map(c => c.value) };
      if (p) Object.assign(p, data);
      else state.places.push({ id: uid(), created: Date.now(), ...data });
      closeModal();
      focusId = p ? p.id : state.places[state.places.length - 1].id;
      mapView = null;
      commit(p ? 'Place updated' : 'Pinned to your map', RAINBOW[4]);
    });
  }
  let pendingMove = null;

  /* ---------------- settings ---------------- */
  function pageSettings() {
    const s = S();
    const usage = (() => { try { return (localStorage.getItem(STORE_KEY) || '').length; } catch { return 0; } })();
    return `<div class="page">
      ${pageHead('settings', 'Settings', `${esc(HOME)} → ${esc(HOST)}, ${CITY}.`)}

      <div class="settings-block">
        <div><h3>Sync</h3><p>Sign in on your PC and your phone to keep them in step. Everything still works offline and catches up later.</p></div>
        <div id="sync-box">${syncBoxHtml()}</div>
      </div>

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
        <div><h3>Your data</h3><p>Saved on this device${sync.user ? ' and synced to your account' : ' only'}. Export now and then to keep a backup.</p></div>
        <div>
          <div class="flex wrap">
            <button class="btn" data-action="export">${icon('download')} Export backup</button>
            <button class="btn" data-action="import">${icon('upload')} Import backup</button>
            <span class="dim mono" style="font-size:11px">${(usage / 1024).toFixed(1)} KB used · ${storageOk ? 'saved' : 'save failed'}</span>
          </div>
          <div class="danger-zone mt-24">
            <div><div style="color:var(--text)">Start over</div><div class="dim" style="font-size:12.5px">Deletes your saved amount, documents, attachments, milestones, Japan list, photos and map, and resets the budget to Sophia defaults.</div></div>
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
      const rec = { blob: file, name: file.name, type: file.type };
      await files.put(id, rec);
      Object.assign(doc, { fileId: id, fileName: file.name, fileType: file.type, fileCloud: false });
      if (await uploadFile(id, rec)) doc.fileCloud = true;
    } catch (e) { console.error(e); return 'Could not store the file in this browser.'; }
  }

  async function deleteDoc(d) {
    if (d.fileId) { try { await files.del(d.fileId); } catch (e) { console.error(e); } deleteCloudFile(d.fileId); }
    removeById('documents', d.id);
    commit('Document deleted', RAINBOW[0]);
  }

  async function openFile(d) {
    try {
      const rec = await getFileRec(d);
      if (!rec) { toast(sync.user ? 'Attachment not found' : 'Attachment not on this device — sign in to sync it', RAINBOW[0]); return; }
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
      try { const rec = await getFileRec(d); if (rec) attachments[d.fileId] = { name: rec.name, type: rec.type, data: await blobToDataURL(rec.blob) }; } catch (e) { console.error(e); }
    }
    for (const p of state.photos) {
      for (const which of ['full', 'thumb']) {
        try { const rec = await getFileRec(photoRec(p, which)); if (rec) attachments[p[which]] = { name: rec.name, type: rec.type, data: await blobToDataURL(rec.blob) }; } catch (e) { console.error(e); }
      }
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
          state.documents.forEach(d => { d.fileCloud = false; });
          state.photos.forEach(p => { p.cloud = false; });
          photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls.clear();
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
    'remove-file': el => { const d = find(state.documents, el.dataset.id); confirmDialog({ title: 'Remove attachment?', message: `“${esc(d.fileName)}” will be deleted. The document stays.`, confirm: 'Remove', onConfirm: async () => { try { await files.del(d.fileId); } catch (e) { console.error(e); } deleteCloudFile(d.fileId); Object.assign(d, { fileId: null, fileName: '', fileType: '', fileCloud: false }); commit('Attachment removed', RAINBOW[0]); } }); },
    'starter-docs': () => { state.documents.push(...starterDocs()); commit('Document list added', RAINBOW[3]); },

    'photo-add': () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = () => inp.files.length && addPhotos(inp.files);
      inp.click();
    },
    'place-add': () => placeForm(null),
    'place-edit': el => { const p = find(state.places, el.dataset.id); if (p) placeForm(p); },
    'place-del': el => { const p = find(state.places, el.dataset.id); confirmDialog({ title: 'Delete this place?', message: `“${esc(p.name)}” will be removed from your map. Its photos stay.`, onConfirm: () => { removeById('places', p.id); commit('Place removed', RAINBOW[0]); } }); },
    'place-focus': el => {
      $('#map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (map && map.loaded()) openPlace(find(state.places, el.dataset.id), true);
      else { focusId = el.dataset.id; mountMap(); }
    },
    'map-tilt': () => { if (map) map.easeTo({ pitch: map.getPitch() > 15 ? 0 : 60, bearing: map.getPitch() > 15 ? 0 : -20, duration: 1200 }); },
    'map-home': () => { if (map) map.fitBounds(JAPAN_BOX, { padding: 12, pitch: 0, bearing: 0, duration: 1600 }); },
    'place-filter': el => { state.ui.placeFilter = el.dataset.val; mapView = null; save(); render(); },
    'photo-open': el => photoModal(find(state.photos, el.dataset.id)),
    'wish-filter': el => { state.ui.wishCat = el.dataset.val; save(); render(); },
    'wish-toggle': el => { const w = find(state.wishes, el.dataset.id); w.done = !w.done; w.doneAt = w.done ? today() : ''; commit(w.done ? 'Done — nice' : 'Marked not done', w.done ? RAINBOW[3] : RAINBOW[2]); },
    'wish-edit': el => wishForm(find(state.wishes, el.dataset.id)),
    'wish-del': el => { const w = find(state.wishes, el.dataset.id); confirmDialog({ title: 'Delete this idea?', message: `“${esc(w.title)}” will be removed from your list.`, onConfirm: () => { removeById('wishes', w.id); commit('Removed', RAINBOW[0]); } }); },

    'add-ms': () => msForm(),
    'edit-ms': el => msForm(find(state.milestones, el.dataset.id)),
    'del-ms': el => { const m = find(state.milestones, el.dataset.id); confirmDialog({ title: 'Delete this milestone?', message: `“${esc(m.title)}” will be removed from your timeline.`, onConfirm: () => { removeById('milestones', m.id); commit('Milestone deleted', RAINBOW[0]); } }); },
    'toggle-ms': el => { const m = find(state.milestones, el.dataset.id); m.done = !m.done; commit(m.done ? 'Milestone complete' : 'Marked not done', m.done ? RAINBOW[3] : RAINBOW[2]); },
    'starter-ms': () => { state.milestones.push(...starterMs()); commit('Milestone list added', RAINBOW[6]); },

    'sync-now': () => { if (sync.user) syncNow(); else go('settings'); },
    'sync-signout': () => confirmDialog({ title: 'Sign out?', message: 'Your data stays on this device, but changes stop syncing until you sign in again.', confirm: 'Sign out', danger: false, onConfirm: async () => { await sb.auth.signOut(); } }),
    'sync-signup': async () => {
      const c = syncCreds(); if (!c) return;
      syncMsg('Creating account…');
      const { data, error } = await sb.auth.signUp({ ...c, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) { syncMsg(error.message, true); return; }
      if (!data.session) syncMsg('Check your email and click the confirm link, then come back and sign in here.');
    },
    'export': () => exportData(),
    'import': () => pickFile('application/json,.json', importData),
    'reset': () => confirmDialog({
      title: 'Reset all data?', confirm: 'Yes, delete everything',
      message: 'This deletes your saved amount, documents, attachments, milestones, Japan list, photos and budget edits — on every device, if you\'re signed in to sync. Consider exporting a backup first. <b style="color:var(--text)">This cannot be undone.</b>',
      onConfirm: async () => {
        try { await files.clear(); } catch (e) { console.error(e); }
        if (sb && sync.user) {
          try {
            const { data } = await sb.storage.from(BUCKET).list(sync.user.id, { limit: 1000 });
            if (data && data.length) await sb.storage.from(BUCKET).remove(data.map(f => cloudPath(f.name)));
          } catch (e) { console.error(e); }
        }
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
  const PAGES = { budget: pageBudget, earnings: pageEarnings, documents: pageDocuments, timeline: pageTimeline, list: pageList, photos: pagePhotos, map: pageMap, settings: pageSettings };
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
      + `<div class="foot-bar" title="${Math.round(pct)}% of your goal saved"><span style="width:${pct}%"></span></div><div class="foot-label" style="margin-top:8px">${Math.round(pct)}% saved</div>`
      + (sb ? `<div class="foot-label" id="sync-status" style="margin-top:10px">${syncLabel()}</div>` : '');
  }

  function render() {
    const r = route();
    const meta = ROUTES.find(x => x.id === r);
    document.body.style.setProperty('--accent', meta.color);
    document.title = `${meta.label} — exchange`;
    renderNav();
    $('#main').innerHTML = PAGES[r]();
    if (r === 'photos') hydratePhotos($('#main'));
    if (r === 'map') mountMap(); else { pickMode = false; pendingMove = null; }
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
    if (e.target.id === 'sync-form') {
      e.preventDefault();
      const c = syncCreds(); if (!c) return;
      syncMsg('Signing in…');
      sb.auth.signInWithPassword(c).then(({ error }) => { if (error) syncMsg(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message, true); });
      return;
    }
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

  document.addEventListener('dragover', e => { if (e.target.closest?.('[data-drop-photos]')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    if (!e.target.closest?.('[data-drop-photos]')) return;
    e.preventDefault();
    if (e.dataTransfer.files.length) addPhotos(e.dataTransfer.files);
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); $('#main').focus({ preventScroll: true }); });

  // keep tabs in sync if the app is open in two windows
  window.addEventListener('storage', e => {
    if (e.key === STORE_KEY) { state = load(); render(); }
    if (e.key === SYNC_KEY) { try { syncMeta = JSON.parse(e.newValue) || syncMeta; } catch { /* ignore */ } }
  });

  // refresh countdowns after midnight
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (!modalStack.length) render(); } }, 60000);

  render();
  preloadMap();
})();
