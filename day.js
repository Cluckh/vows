/* ============================================================================
   ORDO — День: денні цілі, квести, досвід і звання.
   Цілі дня повторюються як нагадування в iPhone (щодня, будні, дні тижня,
   щомісяця…). Кожна справа дає досвід; досвід — рівні й звання Ордену.
   Квести підкидають храмовники: рідкісні (жовті), легендарні (помаранчеві),
   міфічні (фіолетові). Тексти квестів і сцен — у зашифрованому вмісті
   (D.QUESTS, D.DAY), тут лише механіка.
   ========================================================================== */
(function () {
  "use strict";
  const API = () => window.ORDO_API || {};
  const D = () => window.ORDO_DATA || {};
  const H = () => window.ORDO_HALL;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const fx = (s) => { const F = API().FX; if (F) F.play(s, true); };
  const buzz = (s) => { const F = API().FX; if (F) F.buzz(s || "light"); };
  const fmtN = (v) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: 1 });
  const numIn = (s) => { if (s == null) return null; const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isNaN(v) ? null : v; };
  const pick = (a) => a && a.length ? a[Math.floor(Math.random() * a.length)] : "";

  /* ------------------------------------------------------------- дати --- */
  const p2 = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const today = () => keyOf(new Date());
  const dt = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const add = (k, n) => { const d = dt(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const diff = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);            // днів від a до b
  const wd = (k) => (dt(k).getDay() + 6) % 7 + 1;                         // 1 — понеділок … 7 — неділя
  const dim = (y, m) => new Date(y, m, 0).getDate();
  const endOfMonth = (k) => { const d = dt(k); return keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
  const WD = ["", "пн", "вт", "ср", "чт", "пт", "сб", "нд"];
  const WDL = ["", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота", "неділя"];
  const MN = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
  const MG = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  const human = (k) => { const d = dt(k); return `${d.getDate()} ${MG[d.getMonth()]}`; };
  const rel = (k) => { const n = diff(today(), k); return n === 0 ? "Сьогодні" : n === -1 ? "Вчора" : n === 1 ? "Завтра" : n === 2 ? "Післязавтра" : n === -2 ? "Позавчора" : `${WDL[wd(k)].replace(/^./, (c) => c.toUpperCase())}`; };
  /* детермінований «кидок кубика» на день — однаковий на всіх пристроях */
  const roll = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  /* ============================================================ СТАН ======= */
  const XP_START_DAY = "2026-10-26";       // з цього дня рахується досвід; усе раніше — у стартовому
  const START_XP = 4650;                    // посвята: рівень 7, звання «Лицар»
  /* стан читаємо й при завантаженні скрипта, і ще раз у init(): перед стартом boot.js міг підтягнути свіжіше з іншого пристрою */
  let S, Q, X, ACH;
  function loadState() {
    S = LS.get("ordo.day", null); if (!S || typeof S !== "object") S = {};
    S.tasks = S.tasks || {}; S.log = S.log || {}; S.wake = S.wake || {}; S.sleep = S.sleep || {}; S.night = S.night || {}; S.journal = S.journal || {};
    Q = LS.get("ordo.quests", null); if (!Q || typeof Q !== "object") Q = {};
    Q.list = Q.list || []; Q.clock = Q.clock || {}; Q.trig = Q.trig || [];
    X = LS.get("ordo.xp", null); if (!X || typeof X !== "object") X = {};
    X.e = X.e || {};
    ACH = LS.get("ordo.ach", {}) || {};
    GYM = LS.get("ordo.gym", null) || {}; GYM.log = GYM.log || {}; GYM.w = GYM.w || {};
  }
  let PK = LS.get("ordo.k.poker", null);                    // роздачі й сесії з бази HM3 (з компа через приватний репозиторій)
  let HL = LS.get("ordo.k.health", null);                   // кроки й сон зі «Здоровʼя» (лише на пристрої; джерело — приватний репозиторій)
  let GYM;                                                   // w: записи тренувань «день|ціль» → { text, at, fin }
  loadState();
  const saveG = () => LS.set("ordo.gym", GYM);
  const saveS = () => LS.set("ordo.day", S), saveQ = () => LS.set("ordo.quests", Q), saveX = () => LS.set("ordo.xp", X), saveA = () => LS.set("ordo.ach", ACH);

  /* ======================================================= ПОВТОРЕННЯ ===== */
  /* rep: { f: none|day|wd|we|week|month|year, n: кожні n, days: [1..7] } */
  function occurs(t, k) {
    if (t.del || k < t.start || (t.end && k > t.end)) return false;
    const r = t.rep || { f: "none" }, n = Math.max(1, r.n || 1);
    switch (r.f) {
      case "day": return diff(t.start, k) % n === 0;
      case "wd": return wd(k) <= 5;
      case "we": return wd(k) >= 6;
      case "week": {
        const days = r.days && r.days.length ? r.days : [wd(t.start)];
        if (!days.includes(wd(k))) return false;
        const w = Math.floor(diff(add(t.start, 1 - wd(t.start)), add(k, 1 - wd(k))) / 7);
        return w % n === 0;
      }
      case "month": {
        const s = dt(t.start), d = dt(k), months = (d.getFullYear() - s.getFullYear()) * 12 + d.getMonth() - s.getMonth();
        if (months % n) return false;
        return d.getDate() === Math.min(s.getDate(), dim(d.getFullYear(), d.getMonth() + 1));
      }
      case "year": return t.start.slice(5) === k.slice(5);
      case "mlast": return k === endOfMonth(k);
      default: return k === t.start;
    }
  }
  function repText(t) {
    const r = t.rep || { f: "none" }, n = r.n || 1;
    if (r.f === "day") return n > 1 ? `кожні ${n} дні` : "щодня";
    if (r.f === "wd") return "у будні";
    if (r.f === "we") return "у вихідні";
    if (r.f === "week") { const ds = (r.days && r.days.length ? r.days : [wd(t.start)]).slice().sort(); return (n > 1 ? `кожні ${n} тижні: ` : "") + (ds.length === 7 ? "щодня" : ds.map((d) => WD[d]).join(", ")); }
    if (r.f === "month") return n > 1 ? `кожні ${n} місяці` : `щомісяця, ${dt(t.start).getDate()}-го`;
    if (r.f === "year") return `щороку, ${human(t.start)}`;
    if (r.f === "mlast") return "в останній день місяця";
    return "";
  }

  /* екземпляри на день: за розкладом + перенесені сюди */
  function rec(k, id) { return (S.log[k] || {})[id] || null; }
  function setRec(k, id, patch) {
    const day = S.log[k] || (S.log[k] = {});
    day[id] = Object.assign({}, day[id] || {}, patch, { at: Date.now() });
    saveS();
  }
  function items(k) {
    const out = [], seen = new Set(), day = S.log[k] || {};
    Object.values(S.tasks).forEach((t) => { if (occurs(t, k)) { out.push({ t, r: day[t.id] || null }); seen.add(t.id); } });
    Object.keys(day).forEach((id) => { const r = day[id]; if (!seen.has(id) && r && r.from && S.tasks[id] && !S.tasks[id].del) out.push({ t: S.tasks[id], r }); });
    return out.sort((a, b) => (a.t.time || "99") < (b.t.time || "99") ? -1 : (a.t.time || "99") > (b.t.time || "99") ? 1 : (a.t.ord || 0) - (b.t.ord || 0));
  }
  /* стан екземпляра: open | done | fix | part | moved | cancel | miss */
  function stOf(t, r, k) {
    if (r && (r.st === "moved" || r.st === "cancel" || r.st === "fix")) return r.st;
    if (t.type === "count") {
      const cur = (r && r.cur) || 0;
      if (t.target && cur >= t.target) return "done";
      if (r && r.st === "part") return "part";
      if (k < today()) return cur > 0 ? "part" : "miss";
      return "open";
    }
    if (r && r.st === "done") return "done";
    return k < today() ? "miss" : "open";
  }
  const isWin = (st) => st === "done" || st === "fix";

  /* ===================================================== ДЖЕРЕЛА ДАНИХ ===== */
  /* звідки ціль бере дані: steps — «Здоровʼя», poker — HM3, mind — Calm, bank — виписка, "" — вручну.
     Старі цілі без поля src — за колишніми ознаками (позначка кроків, одиниця «роздач», назва з «медит») */
  const DUO_MIN = 10;                         // скільки хвилин у Duolingo зараховують денну ціль
  const SRC = { "": "вручну", steps: "кроки", poker: "роздачі", mind: "медитації", weight: "вага", journal: "сповідь", app: "час у програмі", bank: "скарбниця" };
  function srcOf(t) {
    if (!t) return "";
    if (t.src === "duo") return "app";
    if (t.src != null) return t.src;
    if (t.health === "steps") return "steps";
    if (t.type === "count" && /роздач/i.test(t.unit || "")) return "poker";
    if (/медит|meditat|calm/i.test(t.t || "")) return "mind";
    if (/journal|щоденник|сповід/i.test(t.t || "")) return "journal";
    if (/duolingo|дуолінго/i.test(t.t || "")) return "app";
    if (t.type !== "count" && /зважит|ваг[аиу]\b|weigh/i.test(t.t || "")) return "weight";
    return "";
  }
  /* час у програмі: { n: назва, як у «Швидких командах», min: хвилин, lim: true — «не більше» (YouTube, Reddit) } */
  const appKey = (n) => String(n || "").trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "").slice(0, 24);
  const appOf = (t) => t.app || { n: "duolingo", min: DUO_MIN, lim: false };
  /* квест рахується сам (без «+»): бюджет, програма, або одиниця з автоматичних джерел */
  const qAuto = (q) => q.type === "budget" || !!q.app || !!q.weight || /вірн|сповід|вечор|ранк|тренуван|крок|^роздач$/i.test((q.unit || "").trim());
  const appTracked = (n) => { for (let k = add(today(), -30); k <= today(); k = add(k, 1)) { const h = hDay(k) || {}; if ((h.apps && h.apps[n]) || (n === "duolingo" && h.duo && h.duo.min)) return true; } return false; };
  const appMin = (k, n) => { const h = hDay(k) || {}, a = h.apps && h.apps[n]; return (a && a.min) || (n === "duolingo" && h.duo && h.duo.min) || 0; };
  /* старі цілі Duolingo («Зробити»/«Число» за назвою) — у «час у програмі», 10 хв на день */
  const appMigrate = () => Object.values(S.tasks).forEach((t) => { if (!t.del && !t.app && srcOf(t) === "app" && !(t.type === "count" && /xp/i.test(t.unit || ""))) {
    Object.assign(t, { src: "app", app: { n: "duolingo", min: DUO_MIN, lim: false }, type: "do", mt: Date.now() }); saveS(); } });

  /* ========================================================== ЗДОРОВʼЯ ===== */
  /* день: кроки зі «Здоровʼя» + сон, записаний уранці в додатку, + час першого відкриття (підйом) */
  const hDay = (k) => {
    const h = Object.assign({}, (HL && HL.days && HL.days[k]) || {}), sl = S.sleep[k];
    if (sl && sl.min && !h.sleepMin) h.sleepMin = sl.min;
    if (S.wake[k]) h.up = S.wake[k];
    return Object.keys(h).length ? h : null;
  };
  /* «↻ оновити з телефона»: відкриває «Швидкі команди» з командою, що запускає всі вивантаження; після повернення — кілька свіжих зчитувань */
  const PHONE_SHORTCUT = "Update health";
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let hSyncAt = LS.get("ordo.k.hsync", 0);
  function phoneSync() { hSyncAt = Date.now(); LS.set("ordo.k.hsync", hSyncAt); location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(PHONE_SHORTCUT)}`; }
  function afterPhoneSync() {
    if (Date.now() - hSyncAt > 10 * 60e3) return;
    [0, 25, 50, 90].forEach((s) => setTimeout(() => { loadHealth(true); if (s === 90) render(); }, s * 1000));     // обробка на GitHub — ~15–40 с
  }
  const EARLY = "08:00", DAWN = "04:00";
  const early = (k) => !!(S.wake[k] && S.wake[k] >= DAWN && S.wake[k] < EARLY);
  let hAt = 0;
  async function loadHealth(force) {
    const V = window.ORDO_VAULT; if (!V || !V.readSealed || (!force && Date.now() - hAt < 5 * 60e3)) return;
    hAt = Date.now();
    try { const h = await V.readSealed("health/log.json"); if (h && h.at !== (HL && HL.at)) { HL = h; LS.set("ordo.k.health", h); applyHealth(); render(); const A = API(); if (A.goalsSync) A.goalsSync(); } } catch (e) {}
  }
  /* кроки з телефона — у лічильники з позначкою «кроки» і в квести на кроки */
  function applyHealth() {
    if (!HL || !HL.days) return;
    let ch = false;
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      const h = hDay(k); if (!h || h.steps == null) continue;
      items(k).forEach(({ t, r }) => { if (srcOf(t) === "steps" && (!r || (r.cur || 0) < h.steps) && !(r && (r.st === "moved" || r.st === "cancel"))) { setRec(k, t.id, { cur: h.steps, auto: 1 }); ch = true; } });
    }
    /* вага: ціль «зважитися» відмічається сама, щойно в «Здоровʼї» є зважування за день */
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      if (!(hDay(k) || {}).weight) continue;
      items(k).forEach(({ t, r }) => { if (srcOf(t) === "weight" && (!r || r.st !== "done") && !(r && (r.st === "moved" || r.st === "cancel"))) { setRec(k, t.id, { st: "done", auto: 1 }); ch = true; } });
    }
    /* час у програмі: «щонайменше» — зараховується, щойно набралось; «не більше» — за минулі дні, коли день закрито й ліміт не перевищено.
       «Число» — хвилини за день (Duolingo з одиницею «XP» — XP за день з профілю) */
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      const h = hDay(k) || {};
      items(k).forEach(({ t, r }) => {
        if (srcOf(t) !== "app" || (r && (r.st === "moved" || r.st === "cancel"))) return;
        const a = appOf(t), m = appMin(k, a.n), du = a.n === "duolingo" ? h.duo || {} : {};
        if (t.type === "count") { const v = /xp/i.test(t.unit || "") ? du.today || 0 : Math.floor(m); if (v > ((r && r.cur) || 0)) { setRec(k, t.id, { cur: v, auto: 1 }); ch = true; } return; }
        const ok = a.lim ? k < today() && m <= a.min : m >= a.min || !!du.ext;
        if (ok && (!r || r.st !== "done")) { setRec(k, t.id, { st: "done", auto: 1 }); ch = true; }
        else if (a.lim && m > a.min && r && r.st === "done" && r.auto) { setRec(k, t.id, { st: null, auto: 0 }); ch = true; }   // запізніле «закрив»
      });
    }
    /* медитації з Calm («Усвідомлені хвилини»): ціль про медитацію відмічається сама */
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      const m = (hDay(k) || {}).mind; if (!m) continue;
      items(k).forEach(({ t, r }) => {
        if (srcOf(t) !== "mind" || (r && (r.st === "moved" || r.st === "cancel"))) return;
        if (t.type === "count") { if (!r || (r.cur || 0) < m) { setRec(k, t.id, { cur: m, auto: 1 }); ch = true; } }
        else if (!r || r.st !== "done") { setRec(k, t.id, { st: "done", auto: 1 }); ch = true; }
      });
    }
    Q.list.forEach((q) => {
      if (q.st !== "active" || q.type !== "count" || !/крок/i.test(q.unit || "")) return;
      let sum = 0; for (let k = q.from; k <= (q.until < today() ? q.until : today()); k = add(k, 1)) sum += (hDay(k) || {}).steps || 0;
      if (sum > (q.cur || 0)) { q.cur = sum; q.at = Date.now(); ch = true; if (q.target && q.cur >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
    });
    if (ch) { saveQ(); const before = totalXP(); settle(); if (totalXP() > before) toast(`<b>+${totalXP() - before}</b> досвіду`); }
  }
  const hm = (min) => `${Math.floor(min / 60)} год ${p2(min % 60)} хв`;
  /* сесії медитації за місяць ("2026-10") чи рік ("2026"): з «Швидких команд», а якщо їх немає — сума записаних днів і місяців */
  function periodMind(key) {
    const D = (HL && HL.days) || {}, M = (HL && HL.months) || {};
    const month = (mk) => { let n = 0; Object.keys(D).forEach((k) => { if (k.startsWith(mk)) n += D[k].mind || 0; }); return Math.max((M[mk] && M[mk].mind) || 0, n); };
    const mks = key.length === 7 ? [key] : [...new Set(Object.keys(D).concat(Object.keys(M)).map((k) => k.slice(0, 7)))].filter((m) => m.startsWith(key));
    const y = key.length === 4 && HL && HL.years && HL.years[key] && HL.years[key].mind;
    const n = Math.max(y || 0, mks.reduce((a, m) => a + month(m), 0));
    return n ? { steps: n, avg: null } : null;
  }
  /* кроки за місяць ("2026-10") чи рік ("2026"): з «Швидких команд», а якщо їх немає — сума записаних днів */
  function periodSteps(key) {
    const up = HL && (key.length === 4 ? HL.years : HL.months), u = up && up[key];
    let sum = 0, n = 0;
    Object.keys((HL && HL.days) || {}).forEach((k) => { const v = HL.days[k].steps; if (k.startsWith(key) && v != null) { sum += v; n++; } });
    if (!u && !n) return null;
    return u && u.steps >= sum ? { steps: u.steps, avg: u.avg, at: u.at } : { steps: sum, avg: Math.round(sum / n), at: null };
  }

  /* разова ціль, яку не встиг зробити, сама переїжджає на сьогодні (як «перенести»; повторювані — ні, вони прийдуть знову) */
  function carryOver() {
    const t0 = today(); let ch = false;
    for (let k = add(t0, -14); k < t0; k = add(k, 1)) items(k).forEach(({ t, r }) => {
      if ((t.rep && t.rep.f !== "none") || t.del || t.quest) return;
      const st = stOf(t, r, k); if (st !== "miss" && st !== "part" && st !== "open") return;
      if (S.log[t0] && S.log[t0][t.id]) return;
      setRec(k, t.id, { st: "moved", to: t0, auto: 1 }); setRec(t0, t.id, { from: (r && r.from) || k, st: null }); ch = true;
    });
    return ch;
  }

  /* ======================================================= ЗВʼЯЗКИ ЦІЛЕЙ ===== */
  /* повторювані денні цілі, які можна привʼязати до місячної чи річної */
  const faithCount = (from, to) => { const F = faithIdx(), end = to < today() ? to : add(today(), -1); let n = 0; for (let k = from; k <= end; k = add(k, 1)) if (faithful(F, k)) n++; return n; };
  const linkables = () => Object.values(S.tasks).filter((t) => !t.del && t.rep && t.rep.f !== "none" && (!t.end || t.end >= today()))
    .map((t) => ({ id: t.id, t: t.t, type: t.type, unit: t.unit || "" }));
  /* що дали привʼязані цілі за період: «Зробити» — дні виконання, «Число» — сума відміток */
  function linkCount(ids, from, to) {
    let n = 0; const end = to < today() ? to : today();
    for (let k = from; k <= end; k = add(k, 1)) items(k).forEach(({ t, r }) => {            // разом із перенесеними на цей день
      if (!(ids || []).includes(t.id)) return;
      if (t.type === "count") n += (r && r.cur) || 0; else if (isWin(stOf(t, r, k))) n++;
    });
    return n;
  }
  /* вага зі «Здоровʼя» на день k: last — останнє зважування (до 14 днів тому), avg7 — середня за 7 днів */
  function weightOn(k, mode) {
    const D = (HL && HL.days) || {}, ks = Object.keys(D).filter((d) => d <= k && d > add(k, mode === "last" ? -14 : -7) && D[d].weight).sort();
    if (!ks.length) return null;
    if (mode === "last") return D[ks[ks.length - 1]].weight;
    return Math.round(ks.reduce((a, d) => a + D[d].weight, 0) / ks.length * 10) / 10;
  }

  /* ============================================================== ПОКЕР ===== */
  let pAt = 0;
  async function loadPoker(force) {
    const V = window.ORDO_VAULT; if (!V || !V.readSealed || (!force && Date.now() - pAt < 5 * 60e3)) return;
    pAt = Date.now();
    try { const p = await V.readSealed("poker/log.json"); if (p && p.at !== (PK && PK.at)) { PK = p; LS.set("ordo.k.poker", p); applyPoker(); render(); const A = API(); if (A.goalsSync) A.goalsSync(); } } catch (e) {}
  }
  const pDay = (k) => (PK && PK.days && PK.days[k]) || null;
  /* роздачі з HM3 — у лічильники з одиницею «роздач» (квести на роздачі рахуються з них самі) */
  function applyPoker() {
    if (!PK || !PK.days) return;
    let ch = false;
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      const p = pDay(k); if (!p || !p.hands) continue;
      items(k).forEach(({ t, r }) => { if (t.type === "count" && srcOf(t) === "poker" && (!r || (r.cur || 0) < p.hands) && !(r && (r.st === "moved" || r.st === "cancel"))) { setRec(k, t.id, { cur: p.hands, auto: 1 }); ch = true; } });
    }
    if (ch) { const before = totalXP(); settle(); if (totalXP() > before) toast(`<b>+${totalXP() - before}</b> досвіду`); }
  }
  /* ціль зі скарбниці: витрати в категоріях за день не більші за ліміт; день зараховується, коли виписка його вже покрила */
  const bankSpent = (t, k) => T() && T().ready() && t.bank && t.bank.cats && t.bank.cats.length ? T().spentIn(t.bank.cats, k, k) : null;
  function applyBank() {
    if (!T() || !T().ready()) return;
    let ch = false;
    for (let k = add(today(), -6); k < today(); k = add(k, 1)) {
      if (T().at() <= k) continue;
      items(k).forEach(({ t, r }) => {
        if (srcOf(t) !== "bank" || (r && (r.st === "moved" || r.st === "cancel"))) return;
        const sp = bankSpent(t, k); if (sp == null) return;
        const ok = sp <= (t.bank.limit || 0);
        if (ok && (!r || r.st !== "done")) { setRec(k, t.id, { st: "done", auto: 1 }); ch = true; }
        else if (!ok && r && r.st === "done" && r.auto) { setRec(k, t.id, { st: null, auto: 0 }); ch = true; }      // запізніла транзакція
      });
    }
    if (ch) { const before = totalXP(); settle(); if (totalXP() > before) toast(`<b>+${totalXP() - before}</b> досвіду`); }
  }
  /* роздачі за місяць ("2026-10") чи рік ("2026"): з HM3, а якщо їх немає — сума записаних днів */
  function periodHands(key) {
    const up = PK && (key.length === 4 ? PK.years : PK.months), u = up && up[key];
    let sum = 0, n = 0;
    Object.keys((PK && PK.days) || {}).forEach((k) => { const v = PK.days[k].hands; if (k.startsWith(key) && v) { sum += v; n++; } });
    if (!u && !n) return null;
    const hands = Math.max(u ? u.hands : 0, sum);
    return { steps: hands, hands, avg: n ? Math.round(sum / n) : null };
  }

  /* ============================================================ СПОВІДЬ ===== */
  /* щоденний звіт: що було за день, настрій, позначки. Пишеться поступово (зберігається з кожною літерою),
     «Віддати сповідь» — і ціль «Journaling» закривається; писар читає сповіді й зважає на них у квестах, подіях і листах-зведеннях */
  const MOODS = [["1", "важкий"], ["2", "так собі"], ["3", "рівний"], ["4", "добрий"], ["5", "світлий"]];
  const JTAGS = { work: "робота", people: "люди", poker: "покер", body: "тіло", money: "гроші", anx: "тривога", joy: "радість", win: "перемога", fall: "зрив" };
  const jSent = (k) => !!(S.journal[k] && S.journal[k].sent);
  const journalCount = (from, to) => { let n = 0; const end = to < today() ? to : today(); for (let k = from; k <= end; k = add(k, 1)) if (jSent(k)) n++; return n; };
  function applyJournal() {
    let ch = false;
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      if (!jSent(k)) continue;
      items(k).forEach(({ t, r }) => { if (srcOf(t) === "journal" && (!r || r.st !== "done") && !(r && (r.st === "moved" || r.st === "cancel"))) { setRec(k, t.id, { st: "done", auto: 1 }); ch = true; } });
    }
    return ch;
  }
  function openJournal(k) { openSheet("journal", null, k || today()); }
  let jT = 0;
  function jAutosave(v) {
    if (!sh || sh.mode !== "journal") return;
    const J = S.journal[sh.k] = S.journal[sh.k] || {}; J.text = v; J.at = Date.now();
    clearTimeout(jT); jT = setTimeout(() => { jT = 0; saveS(); const el = $("jSaved"); if (el) el.textContent = `збережено о ${clock(J.at)}`; }, 400);
  }
  const jFlush = () => { if (jT) { clearTimeout(jT); jT = 0; saveS(); } };
  function confessStatus() {
    const el = $("confessSt"), b = $("confessBtn"); if (!el) return;
    const J = S.journal[today()];
    el.textContent = jSent(today()) ? "віддано сьогодні" : J && (J.text || "").trim() ? "чернетка — допиши й віддай" : "як минув день?";
    if (b) b.classList.toggle("is-done", jSent(today()));
  }

  /* ======================================================== НІЧНА ВАРТА ===== */
  /* відкрив Орден між 00:30 і 04:30 — приходить храмовник: що розбудило? Тривогу кладемо на ранок і дихаємо;
     вранці той самий храмовник повертає її: справа, відпустити чи доручення на день. Наступний день — легший протокол */
  const hmNow = () => { const n = new Date(); return `${p2(n.getHours())}:${p2(n.getMinutes())}`; };
  const isNight = () => { const x = hmNow(); return x >= "00:30" && x < "04:30"; };
  const TOPICS = { work: "робота", money: "гроші", poker: "покер", health: "здоровʼя", people: "люди", future: "майбутнє", none: "без причини" };
  const TOPIC_ABOUT = { work: "роботу", money: "гроші", poker: "покер", health: "здоровʼя", people: "людей", future: "майбутнє" };
  const NIGHT_KEEPERS = () => ["supreme", "seneschal", "chronicler"].concat((D().VOWS || []).map((v) => v.id));
  const NL = {
    open: ["Тихо, брате. Ніч — не час для битви, я тут на варті.", "Не спиться? Я посиджу поруч. Говоримо пошепки.", "Ніч довга, але вона мине. Я тут."],
    anx: ["Тривога вночі завжди більша, ніж є насправді. Віддай її мені до ранку — я збережу.", "Вночі думки ростуть, як тіні від свічки. Запиши — і я покладу це на ранок."],
    awake: ["Буває. Не дивись на годинник — він тільки підганяє. Телефон зараз відкладемо.", "Не воюй зі сном — він приходить, коли за ним не женуться."],
    bye: ["Тоді спи. Я на варті до світанку.", "Добре. Екран донизу — і в темряву. Добраніч, брате."],
    let: ["Правильно. Ніч перебільшує — ранок ставить на місце.", "Відпущено. Якщо повернеться — вирішимо вдень, на свіжу голову."],
    siren: ["Чую сирену, брате. Спершу — не думки, а стіни.", "Тривога. Я поруч. Спершу безпека, все інше — потім."],
    safe: ["Добре. Ти зробив усе, що залежить від тебе. Небо — не твоя варта, на ньому стоять інші.", "Ти в безпечнішому місці — це головне. Тепер просто чекаємо відбою разом."],
    stay: ["Твій вибір, брате, тиснути не буду. Але хоча б подалі від вікон — у коридор, за дві стіни. Ковдру можна взяти з собою.", "Розумію — сил вставати нема. Тоді хоча б не біля вікна: дві стіни між тобою й вулицею — вже інша ніч."],
    ground: ["Назви про себе пʼять речей, які бачиш. Чотири — які чуєш. Три — яких торкаєшся. Повільно. Я рахую з тобою.", "Притисни долоні до підлоги чи стіни — відчуй, яка вона тверда й холодна. Ти тут, у цій кімнаті, і ти не сам."]
  };
  /* дихання: 4·7·8 — заспокоїтись і заснути; 4·6 — без затримок, коли серце калатає (сирена) */
  const PATS = {
    478: { name: "4 · 7 · 8", rounds: 4, ph: [["вдих через ніс", 4, "in"], ["затримай подих", 7, "hold"], ["видих через рот", 8, "out"]], note: "Чотири кола. Видих повільний, через рот. Думки приходять — хай пливуть далі." },
    46: { name: "4 · 6", rounds: 6, ph: [["вдих через ніс", 4, "in"], ["довгий видих", 6, "out"]], note: "Без затримок: спокійний вдих, видих довший за вдих. Шість кіл — близько хвилини." }
  };
  let nbTimer = 0;
  async function nightScene() {
    const h = H(), t0 = today(), N = S.night[t0];
    if (!h || (N && (N.done || Date.now() - (N.ts || 0) < 20 * 60e3))) return;
    const giver = (N && N.keeper) || pick(NIGHT_KEEPERS());
    S.night[t0] = Object.assign(N || { at: hmNow() }, { keeper: giver, ts: Date.now() }); saveS();
    h.stage(giver);
    if ((await h.say(pick(NL.open))) === "closed") return;
    const i = await h.choose("Що тебе розбудило?", ["Повітряна тривога", "Тривога на душі", "Щось муляє", "Просто не спиться", "Нічого, засинаю"]);
    if (i === "closed") return;
    const kind = ["siren", "anx", "bug", "awake", "fine"][i]; S.night[t0].kind = kind; S.night[t0].ts = Date.now(); saveS();
    if (kind === "fine") { S.night[t0].done = 1; saveS(); await h.say(pick(NL.bye)); if (h.isOpen()) h.close(); return; }
    if (kind === "siren") {                 // повітряна тривога: спершу укриття, потім — тіло, а не думки
      if ((await h.say(pick(NL.siren))) === "closed") return;
      const w = await h.choose("Ти в укритті або хоча б за двома стінами?", ["Так, я в безпечнішому місці", "Іду туди зараз", "Лишаюсь у ліжку"]);
      if (w === "closed") return;
      if (w === 1) { S.night[t0].ts = 0; saveS(); await h.say("Іди. Телефон і воду — з собою. Як дійдеш — відкрий мене знову, я почекаю."); if (h.isOpen()) h.close(); return; }
      if ((await h.say(pick(w === 0 ? NL.safe : NL.stay))) === "closed") return;
      const j = await h.choose("Поки чекаємо відбою:", ["Подихаємо (4 · 6)", "Заземлитись", "Відбій уже був — спати"]);
      if (j === "closed") return;
      if (j === 1) { await h.say(pick(NL.ground)); const z = await h.choose("Як зараз?", ["Тихіше. Подихаю ще", "Краще, лягаю"]); if (h.isOpen()) h.close(); if (z === 0) nightSheet("breath", 46); else { S.night[t0].done = 1; saveS(); } return; }
      if (h.isOpen()) h.close();
      if (j === 0) nightSheet("breath", 46); else { S.night[t0].done = 1; saveS(); }
      return;
    }
    if (kind === "awake") {
      await h.say(pick(NL.awake));
      const j = await h.choose("Подихаємо хвилину?", ["Так, подихаю", "Ні, просто лягаю"]);
      if (h.isOpen()) h.close();
      if (j === 0) nightSheet("breath"); else { S.night[t0].done = 1; saveS(); }
      return;
    }
    await h.say(pick(NL.anx));
    if (h.isOpen()) h.close();
    nightSheet("park");
  }
  function nightSheet(step, pat) { openSheet("night", null, today()); sh.step = step; sh.pat = pat || 478; renderSheet(); if (step === "breath") breathe(); }
  /* дихання 4-7-8, чотири кола; коло — вдих 4 с, затримка 7 с, видих 8 с */
  function breathe() {
    clearInterval(nbTimer);
    const P = PATS[(sh && sh.pat) || 478], PH = P.ph;
    let round = 0, ph = 0, left = PH[0][1];
    const show = () => { const o = $("nbOrb"), t = $("nbT"), n = $("nbN"); if (!o) return false;
      if (left === PH[ph][1]) o.style.transition = PH[ph][2] === "hold" ? "none" : `transform ${PH[ph][1]}s ease-in-out`;     // тривалість анімації = тривалість фази
      o.className = `nb__orb is-${PH[ph][2]}`; t.textContent = PH[ph][0]; n.textContent = left; return true; };
    setTimeout(show, 30);
    nbTimer = setInterval(() => {
      if (!sh || sh.mode !== "night" || sh.step !== "breath") { clearInterval(nbTimer); return; }
      left--;
      if (left <= 0) { ph++; if (ph >= PH.length) { ph = 0; round++; } if (round >= P.rounds) { clearInterval(nbTimer); nightRest(P.rounds); return; } left = PH[ph][1]; buzz("light"); }
      show();
    }, 1000);
  }
  function nightRest(rounds) {
    const N = S.night[today()]; if (N) { N.breath = Math.max(N.breath || 0, rounds); N.done = 1; saveS(); }
    if (sh && sh.mode === "night") { sh.step = "rest"; renderSheet(); }
  }
  /* ранок: храмовник повертає покладене на збереження */
  async function nightMorning() {
    const h = H(), t0 = today(), N = S.night[t0];
    if (!h || isNight() || !N || !(N.kind === "anx" || N.kind === "bug") || N.dealt) return true;
    h.stage(N.keeper || "supreme");
    const what = N.text ? `«${N.text}»` : TOPIC_ABOUT[N.topic] ? `тривогу про ${TOPIC_ABOUT[N.topic]}` : "свою тривогу";
    if ((await h.say(`Уночі${N.at ? `, о ${N.at},` : ""} ти віддав мені на збереження ${what}. Ранок тверезіший за ніч.`)) === "closed") return false;
    const i = await h.choose("Що з нею зробимо?", ["Зробити справою на сьогодні", "Відпустити — це була ніч", "Дай доручення на день"]);
    if (i === "closed") return false;
    N.dealt = ["task", "let", "quest"][i]; saveS();
    if (i === 0) {
      const id = uid();
      S.tasks[id] = { id, t: N.text ? `Розібратися: ${N.text}` : `Один крок щодо: ${TOPICS[N.topic] || "тривоги"}`, type: "do", diff: "normal", rep: { f: "none" }, start: t0, created: t0, mt: Date.now(), notes: "з нічної варти" };
      saveS(); render();
      return (await h.say("Записав у справи дня. Один маленький крок — і вона втратить половину ваги.")) !== "closed";
    }
    if (i === 1) return (await h.say(pick(NL.let))) !== "closed";
    const q = draw("rare", N.topic === "money" ? "night-money" : "night");
    if (!q) return true;
    Q.list.push(q); Q.clock.rare = t0; saveQ();
    return offerScene(q);
  }
  /* день після неспокійної ночі */
  const roughNight = (k) => { const N = S.night[k]; return !!(N && N.kind && N.kind !== "fine"); };

  /* ================================================================ ЗАЛ ===== */
  /* тренування: позначка «тренування» (t.gym) або назва — зал, кардіо…; gym: false — вимкнено вручну */
  const GYM_RE = /(^|[^а-яіїєґ])зал([^а-яіїєґ]|$)|тренуван|кардіо|cardio|gym/i;
  const isGym = (t) => !!(t && t.gym !== false && (t.gym || GYM_RE.test(t.t || "")));
  const isLift = (t) => !!(t && /(^|[^а-яіїєґ])зал([^а-яіїєґ]|$)|gym|силов/i.test(t.t || ""));     // зал — ще й таблиця підходів для порад
  const wKey = (k, id) => `${k}|${id}`;
  const clock = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  /* завершені тренування по днях: таблиця підходів (зал) + тексти, написані по ходу */
  function sessions() {
    const days = new Set(Object.keys(GYM.log).filter((k) => GYM.log[k].ex && GYM.log[k].ex.length));
    Object.keys(GYM.w).forEach((x) => { if (GYM.w[x].fin && (GYM.w[x].text || "").trim()) days.add(x.split("|")[0]); });
    return [...days].sort().map((k) => {
      const L = GYM.log[k] || {};
      const text = Object.keys(GYM.w).filter((x) => x.startsWith(k + "|") && GYM.w[x].fin && (GYM.w[x].text || "").trim())
        .map((x) => { const t = S.tasks[x.split("|")[1]]; return (t ? `${t.t}: ` : "") + GYM.w[x].text.trim(); }).join("\n");
      return { k, ex: L.ex || [], note: L.note || "", text };
    });
  }
  /* порада на наступний зал: прогресія ваги/повторів і черговість вправ */
  function gymAdvice(k) {
    const ss = sessions().filter((x) => x.k < k && x.ex.length); if (!ss.length) return null;
    const last = ss[ss.length - 1], prev = ss[ss.length - 2];
    const names = (x) => x.ex.map((e) => e.n.toLowerCase());
    let rot = null;
    if (prev && !names(last).some((n) => names(prev).includes(n))) rot = prev;              // спліт: минулого разу інші вправи → черга попередніх
    const base = rot || last, tips = [];
    base.ex.slice(0, 4).forEach((e) => {
      const sets = (e.sets || []).filter((x) => x.r), w = Math.max(0, ...sets.map((x) => x.w || 0)), minR = Math.min(...sets.map((x) => x.r));
      if (!sets.length) return;
      if (w && minR >= 10) tips.push(roughNight(k) ? `${e.n}: ${fmtN(w)} кг, як минулого разу` : `${e.n}: ${fmtN(w + 2.5)} кг`);
      else if (w && minR >= 6) tips.push(`${e.n}: ${fmtN(w)} кг, на повтор більше`);
      else if (w) tips.push(`${e.n}: ${fmtN(w)} кг, дотисни техніку`);
      else tips.push(`${e.n}: ${minR + 1}+ повторів`);
    });
    const L = (D().DAY || {}).gym || {};
    const head = rot ? fill(pick(L.rotate) || "Минулого разу було інше. Сьогодні черга {day}.", { day: human(rot.k) }) : fill(pick(L.again) || "Минулого разу ({day}) ти взяв своє. Тиснемо далі.", { day: human(last.k) });
    return { giver: L.giver || "supreme", head, tips };
  }
  const gymSig = (g) => JSON.stringify([g.ex.map((e) => [e.n, (e.sets || []).map((z) => [z.r, z.w])]), g.note || ""]);
  /* текст для живого тренера в чаті: останні тренування з підходами й нотатками */
  function gymText(draft) {
    const ss = sessions().filter((x) => !draft || x.k !== draft.k);
    if (draft && ((draft.text || "").trim() || draft.ex.some((e) => e.n && e.sets.some((z) => z.r)))) ss.push(draft);
    ss.sort((a, b) => a.k < b.k ? -1 : 1);
    const set = (z) => z.w ? `${z.r}×${fmtN(z.w)}` : `${z.r}`;
    const out = ss.slice(-8).map((x) => [`${human(x.k)} (${WDL[wd(x.k)]}):`]
      .concat(x.ex.filter((e) => e.n).map((e) => `— ${e.n}: ${(e.sets || []).filter((z) => z.r).map(set).join(", ")}`))
      .concat(x.text ? [x.text] : []).concat(x.note ? [`Нотатка: ${x.note}`] : []).join("\n"));
    const adv = gymAdvice(add(today(), 1));
    return `Мої останні тренування:\n\n${out.join("\n\n")}` + (adv && adv.tips.length ? `\n\nДодаток радить на наступне: ${adv.tips.join("; ")}.` : "") +
      `\n\nПодивись на прогрес, що б ти змінив і на що звернути увагу?`;
  }

  /* ========================================================= ВІРНІСТЬ ===== */
  /* день вірності — жодна обітниця не зірвана (вікна дозволені). На відміну від стріку, зрив не забирає вже прожитих днів */
  function faithIdx() {
    const all = new Set(), by = {};
    LS.get("ordo.log", []).forEach((e) => { if (e.k === "breach") { all.add(e.d); (by[e.v] = by[e.v] || new Set()).add(e.d); } });
    return { since: LS.get("ordo.since", today()), all, by };
  }
  const faithful = (F, k, vid) => k >= F.since && k <= today() && !(vid ? F.by[vid] && F.by[vid].has(k) : F.all.has(k));
  function faith() {
    const F = faithIdx(), t0 = today(), y = add(t0, -1);
    let total = 0, run = 0, best = 0, rise = false, fell = false, months = 0, d30 = 0, n30 = 0;
    for (let k = F.since; k <= y; k = add(k, 1)) {
      if (faithful(F, k)) { total++; run++; best = Math.max(best, run); if (fell && run >= 7) rise = true; }
      else { run = 0; fell = true; }
      if (k.slice(8) === endOfMonth(k).slice(8) && `${k.slice(0, 7)}-01` >= F.since && ![...F.all].some((d) => d.startsWith(k.slice(0, 7)))) months++;
    }
    for (let k = add(t0, -29); k <= t0; k = add(k, 1)) if (k >= F.since) { n30++; if (faithful(F, k)) d30++; }
    return { total, run, best, rise, months, d30, n30 };
  }
  /* шлях повернення: сім днів вірності після останнього зриву; n — скільки вже прожито */
  function comeback() {
    const F = faithIdx(), t0 = today();
    for (let i = 0; i <= 7; i++) if (F.all.has(add(t0, -i))) return { from: add(t0, -i), n: Math.max(0, i - 1), today: i === 0 };
    return null;
  }

  const BASE = { easy: 8, normal: 15, hard: 30 };
  const DIFF = { easy: "легка", normal: "звичайна", hard: "важка" };
  /* скільки разів поспіль перед цим днем повторювана ціль була виконана */
  function chainBefore(t, k) {
    if (!t.rep || t.rep.f === "none") return 0;
    let c = 0, d = add(k, -1);
    for (let guard = 0; guard < 400 && c < 60 && d >= t.start; guard++, d = add(d, -1)) {
      if (!occurs(t, d)) continue;
      const st = stOf(t, rec(d, t.id), d);
      if (st === "moved" || st === "cancel") continue;
      if (isWin(st)) c++; else break;
    }
    return c;
  }
  function xpTask(t, r, k) {
    const st = stOf(t, r, k), base = BASE[t.diff || "normal"];
    const bonus = Math.min(0.3, 0.03 * chainBefore(t, k));
    if (st === "done") {
      let m = 1 + bonus;
      if (t.type === "count" && t.target) m *= 1 + Math.min(0.2, Math.max(0, (r.cur / t.target - 1) * 0.4));   // перевиконання
      return Math.round(base * m);
    }
    if (st === "fix") return Math.round(base * 0.7);
    if (t.type === "count" && t.target && r && r.cur > 0 && st !== "moved" && st !== "cancel") {
      const q = Math.min(1, r.cur / t.target); return Math.round(base * q * (q >= 0.5 ? 0.9 : 0.6));
    }
    return 0;
  }
  function putXP(id, xp, src, why, d) {
    if (xp > 0) X.e[id] = { d: d || today(), xp, src, why };
    else delete X.e[id];
  }
  const totalXP = () => START_XP + Object.values(X.e).reduce((a, e) => a + (e.xp || 0), 0);

  /* звання: рівень L → наступний коштує 400 + 150·(L−1) */
  const RANKS = [
    { lv: 1, name: "Послушник" }, { lv: 3, name: "Зброєносець" }, { lv: 5, name: "Сержант" }, { lv: 7, name: "Лицар" },
    { lv: 10, name: "Лицар Хреста" }, { lv: 13, name: "Банерет" }, { lv: 16, name: "Командор" }, { lv: 19, name: "Маршал" },
    { lv: 22, name: "Приор" }, { lv: 26, name: "Великий приор" }, { lv: 30, name: "Магістр Ордену" }
  ];
  const need = (L) => 400 * (L - 1) + 75 * (L - 1) * (L - 2);
  function levelOf(xp) {
    let L = 1; while (need(L + 1) <= xp && L < 60) L++;
    const ri = RANKS.reduce((a, r, i) => L >= r.lv ? i : a, 0);
    return { L, xp, from: need(L), to: need(L + 1), rank: RANKS[ri], ri, next: RANKS[ri + 1] || null };
  }

  /* похідний досвід: обітниці щодня, віхи, цілі місяця/року, чисті дні — перераховується щоразу */
  const VOW_DAY = 4;
  const MS_XP = { 10: 60, 25: 120, 75: 250, 180: 500, 365: 1000, 500: 1300, 730: 1800, 1000: 2500 };
  function settleDerived() {
    const A = API(), t0 = today();
    Object.keys(X.e).forEach((id) => { if (/^(v|vm|g|gm|pd|sl|st|gy|er|rt|nw|jr):/.test(id)) delete X.e[id]; });
    const vows = D().VOWS || [], starts = LS.get("ordo.starts", {});
    if (A.dayState) for (let k = XP_START_DAY; k < t0; k = add(k, 1)) vows.forEach((v) => {
      /* день стріку важить більше, що довше серія йде підряд: +1 за кожні 30 днів (до +6); дні до зриву досвіду не дають */
      const s = A.dayState(v, k), st = starts[v.id] || v.start;
      if ((s === "c" || s === "w") && (!st || k >= st)) X.e[`v:${v.id}:${k}`] = { d: k, xp: VOW_DAY + Math.min(6, Math.floor((st ? diff(st, k) : 0) / 30)), src: "vow", why: v.name };
    });
    if (A.streak) vows.forEach((v) => {
      const st = starts[v.id] || v.start, n = A.streak(v);
      (D().MILESTONES || Object.keys(MS_XP).map(Number)).forEach((m) => {
        const when = add(st, m);
        if (n >= m && when >= XP_START_DAY) X.e[`vm:${v.id}:${m}:${st}`] = { d: when, xp: MS_XP[m] || Math.round(m * 2.5), src: "vow", why: `${v.name}: ${m} днів` };
      });
    });
    const G = LS.get("ordo.goals", { y: {}, m: {} });
    ["m", "y"].forEach((kind) => Object.keys(G[kind] || {}).forEach((key) => {
      const P = G[kind][key];
      (P.items || []).forEach((it) => { if (it.done && it.done >= XP_START_DAY) X.e[`g:${it.id}`] = { d: it.done, xp: kind === "y" ? 400 : 120, src: "goal", why: it.t }; });
      if (P.res && P.items && P.items.length) {
        const pct = Math.round(100 * P.items.filter((i) => P.res[i.id]).length / P.items.length);
        const when = kind === "y" ? `${key}-12-31` : endOfMonth(`${key}-01`);
        if (when >= XP_START_DAY && pct > 0) X.e[`gm:${kind}${key}`] = { d: when, xp: kind === "y" ? pct * 6 : pct * 2, src: "goal", why: kind === "y" ? `ревю ${key} року` : "ревю місяця" };
      }
    }));
    for (let k = XP_START_DAY; k <= t0; k = add(k, 1)) {
      if (perfect(k)) X.e[`pd:${k}`] = { d: k, xp: 25, src: "day", why: "чистий день" };
      const h = hDay(k);
      if (h && h.sleepMin >= 420) X.e[`sl:${k}`] = { d: k, xp: 10, src: "body", why: "сон 7+ годин" };
      if (h && h.steps >= 10000) X.e[`st:${k}`] = { d: k, xp: 10, src: "body", why: "10 000 кроків" };
      const g = GYM.log[k]; if ((g && g.ex && g.ex.length) || Object.keys(GYM.w).some((x) => x.startsWith(k + "|") && GYM.w[x].fin)) X.e[`gy:${k}`] = { d: k, xp: 20, src: "body", why: "запис тренування" };
      if (early(k)) X.e[`er:${k}`] = { d: k, xp: 5, src: "body", why: "ранній підйом" };
      if (S.night[k] && S.night[k].breath) X.e[`nw:${k}`] = { d: k, xp: 5, src: "body", why: "нічна варта" };
      if (jSent(k)) X.e[`jr:${k}`] = { d: k, xp: 10, src: "day", why: "сповідь" };
    }
    const F = faithIdx();          // шлях повернення: кожен вірний день із семи після зриву
    for (let k = XP_START_DAY; k < t0; k = add(k, 1)) {
      if (!faithful(F, k)) continue;
      for (let i = 1; i <= 7; i++) if (F.all.has(add(k, -i))) { X.e[`rt:${k}`] = { d: k, xp: 3, src: "vow", why: `шлях повернення, день ${i}` }; break; }
    }
  }
  /* чистий день: щонайменше 3 справи, усі (крім перенесених і скасованих) виконані */
  function perfect(k) {
    const its = items(k).map(({ t, r }) => stOf(t, r, k)).filter((s) => s !== "moved" && s !== "cancel");
    return its.length >= 3 && its.every(isWin);
  }
  function settleTasks(k) { items(k).forEach(({ t, r }) => putXP(`t:${t.id}:${k}`, xpTask(t, r, k), "task", t.t, k)); }

  /* =========================================================== НАГОРОДИ ==== */
  function ctx() {
    let done = 0, early = 0, pdRun = 0, pdBest = 0, chainBest = 0;
    const days = Object.keys(S.log).sort();
    days.forEach((k) => Object.keys(S.log[k]).forEach((id) => {
      const t = S.tasks[id], r = S.log[k][id]; if (!t) return;
      if (isWin(stOf(t, r, k))) { done++; if (r.at && new Date(r.at).getHours() < 8 && keyOf(new Date(r.at)) === k) early++; }
    }));
    for (let k = XP_START_DAY; k <= today(); k = add(k, 1)) { if (perfect(k)) { pdRun++; pdBest = Math.max(pdBest, pdRun); } else if (k < today()) pdRun = 0; }
    Object.values(S.tasks).forEach((t) => { if (t.rep && t.rep.f !== "none") chainBest = Math.max(chainBest, chainBefore(t, add(today(), 1))); });
    const qd = (rar) => Q.list.filter((q) => q.st === "done" && (!rar || q.rar === rar)).length;
    const f = faith();
    return { f, jn: Object.keys(S.journal).filter(jSent).length, gym: sessions().length, done, early, pdBest, pdN: Object.keys(X.e).filter((i) => i.startsWith("pd:")).length, chainBest, qd, lv: levelOf(totalXP()).L };
  }
  const ACHS = [
    { id: "first", tier: "bronze", n: "Перший крок", h: "Виконати першу денну ціль", ok: (c) => c.done >= 1, xp: 30 },
    { id: "t50", tier: "silver", n: "Півсотні справ", h: "50 виконаних денних цілей", ok: (c) => c.done >= 50, xp: 100 },
    { id: "t200", tier: "gold", n: "Двісті справ", h: "200 виконаних денних цілей", ok: (c) => c.done >= 200, xp: 250 },
    { id: "t500", tier: "gold", n: "Пʼятсот справ", h: "500 виконаних денних цілей", ok: (c) => c.done >= 500, xp: 500 },
    { id: "pd1", tier: "bronze", n: "Чистий день", h: "День, коли виконано все (від 3 справ)", ok: (c) => c.pdN >= 1, xp: 30 },
    { id: "pd7", tier: "silver", n: "Тиждень без огріхів", h: "7 чистих днів поспіль", ok: (c) => c.pdBest >= 7, xp: 200 },
    { id: "pd30", tier: "gold", n: "Місяць залізної волі", h: "30 чистих днів поспіль", ok: (c) => c.pdBest >= 30, xp: 800 },
    { id: "early", tier: "bronze", n: "Ранній птах", h: "Справа виконана до 8:00", ok: (c) => c.early >= 1, xp: 30 },
    { id: "ch14", tier: "silver", n: "Звичка", h: "Повторювана ціль 14 разів поспіль", ok: (c) => c.chainBest >= 14, xp: 120 },
    { id: "ch30", tier: "gold", n: "Друга натура", h: "Повторювана ціль 30 разів поспіль", ok: (c) => c.chainBest >= 30, xp: 300 },
    { id: "qr", tier: "gold", n: "Перше доручення", h: "Виконати рідкісний квест", ok: (c) => c.qd("rare") >= 1, xp: 40, rar: "rare" },
    { id: "ql", tier: "legend", n: "Легенда", h: "Виконати легендарний квест", ok: (c) => c.qd("legend") >= 1, xp: 100, rar: "legend" },
    { id: "qm", tier: "myth", n: "Міф", h: "Виконати міфічний квест", ok: (c) => c.qd("myth") >= 1, xp: 300, rar: "myth" },
    { id: "q10", tier: "gold", n: "Мандрівний лицар", h: "10 виконаних квестів", ok: (c) => c.qd() >= 10, xp: 200 },
    { id: "f10", tier: "bronze", n: "Десять вірних днів", h: "10 днів без жодного зриву — не обовʼязково поспіль", ok: (c) => c.f.total >= 10, xp: 40 },
    { id: "f50", tier: "silver", n: "Пів сотні вірних", h: "50 днів вірності сумарно", ok: (c) => c.f.total >= 50, xp: 150 },
    { id: "f100", tier: "gold", n: "Сто днів вірності", h: "100 днів вірності сумарно", ok: (c) => c.f.total >= 100, xp: 400 },
    { id: "f365", tier: "myth", n: "Рік вірності", h: "365 днів вірності сумарно", ok: (c) => c.f.total >= 365, xp: 1200 },
    { id: "rise", tier: "silver", n: "Друге дихання", h: "Після зриву — 7 днів вірності поспіль", ok: (c) => c.f.rise, xp: 120 },
    { id: "fmon", tier: "gold", n: "Місяць без падінь", h: "Календарний місяць без жодного зриву", ok: (c) => c.f.months >= 1, xp: 300 },
    { id: "j1", tier: "bronze", n: "Перша сповідь", h: "Віддати першу сповідь дня", ok: (c) => c.jn >= 1, xp: 30 },
    { id: "j30", tier: "silver", n: "Літописець себе", h: "30 сповідей", ok: (c) => c.jn >= 30, xp: 200 },
    { id: "j100", tier: "gold", n: "Сто сторінок душі", h: "100 сповідей", ok: (c) => c.jn >= 100, xp: 500 },
    { id: "gym10", tier: "silver", n: "Зброярня", h: "10 записаних тренувань", ok: (c) => c.gym >= 10, xp: 150 },
    { id: "gym50", tier: "gold", n: "Залізний брат", h: "50 записаних тренувань", ok: (c) => c.gym >= 50, xp: 400 },
    { id: "lv10", tier: "silver", n: "Лицар Хреста", h: "Дійти до 10-го рівня", ok: (c) => c.lv >= 10, xp: 0 },
    { id: "lv16", tier: "gold", n: "Командор", h: "Дійти до 16-го рівня", ok: (c) => c.lv >= 16, xp: 0 }
  ];
  function settleAch() {
    const c = ctx(), fresh = [];
    ACHS.forEach((a) => { if (!ACH[a.id] && a.ok(c)) { ACH[a.id] = today(); fresh.push(a); } });
    ACHS.forEach((a) => { if (ACH[a.id] && a.xp) X.e[`a:${a.id}`] = { d: ACH[a.id], xp: a.xp, src: "ach", why: a.n }; });
    if (fresh.length) saveA();
    return fresh;
  }

  /* перерахунок усього; повертає зміну рівня й нові нагороди */
  let lastLevel = null;
  function settle() {
    for (let k = add(today(), -3); k <= today(); k = add(k, 1)) settleTasks(k);
    settleDerived(); settleQuests();
    const fresh = settleAch();
    saveX();
    /* тригери: третій чистий день поспіль → рідкісний квест; віха обітниці сьогодні → легендарний */
    const t0 = today();
    if (perfect(t0) && perfect(add(t0, -1)) && perfect(add(t0, -2)) && Q.clock.tPd !== t0) { Q.clock.tPd = t0; trigger("rare"); }
    if (Object.keys(X.e).some((id) => id.startsWith("vm:") && X.e[id].d === t0) && Q.clock.tMs !== t0) { Q.clock.tMs = t0; trigger("legend"); }
    const cb = comeback();          // зрив → доручення на шлях повернення
    if (cb && cb.n === 0 && Q.clock.tRet !== cb.from) { Q.clock.tRet = cb.from; trigger("rare", "return"); }
    const lv = levelOf(totalXP());
    const up = lastLevel && lv.L > lastLevel.L ? { from: lastLevel, to: lv } : null;
    lastLevel = lv;
    return { lv, up, fresh };
  }

  /* ============================================================ КВЕСТИ ===== */
  const RAR = { rare: { n: "Рідкісний", xp: 80 }, legend: { n: "Легендарний", xp: 300 }, myth: { n: "Міфічний", xp: 1000 } };
  const pool = () => (D().QUESTS || []).concat(LS.get("ordo.k.drop", {}).quests || []);
  function untilFor(scope, from, days) {
    if (days) return add(from, days - 1);
    if (scope === "week") return add(from, 6);
    if (scope === "month") return add(from, 29);                      // місяць — це 30 днів від згоди, а не залишок календаря
    if (scope === "year") return `${from.slice(0, 4)}-12-31`;
    return from;
  }
  const T = () => window.ORDO_TREASURY;
  /* бюджетний квест: скільки витрачено в його категоріях від згоди до сьогодні (за випискою) */
  function qSpent(q) { const t = T(); return t && q.from ? t.spentIn(q.cats, q.from, q.until < today() ? q.until : today()) : null; }
  function qProg(q) {
    if (q.type === "budget") { const sp = qSpent(q); return q.st === "done" ? 1 : sp == null ? 0 : q.limit ? Math.max(0, 1 - sp / q.limit) : sp > 0 ? 0 : 1; }
    return q.type === "count" && q.target ? Math.min(1, (q.cur || 0) / q.target) : q.st === "done" ? 1 : 0;
  }
  /* квест-лічильник з тією ж одиницею, що й денний лічильник, рахується з денних відміток */
  function autoCount() {
    Q.list.forEach((q) => {
      if (q.st === "active" && q.type === "count" && /ранк/i.test(q.unit || "")) {
        let n = 0; for (let k = q.from; k <= (q.until < today() ? q.until : today()); k = add(k, 1)) if (early(k)) n++;
        if (n > (q.cur || 0)) { q.cur = n; q.at = Date.now(); if (q.target && n >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
        return;
      }
      if (q.st === "active" && q.weight) {          // вага: { op: "<" | "<=", v: 84.5, mode: "avg7" | "last" } — зараховується, щойно «Здоровʼя» покаже потрібне
        const w = weightOn(today(), q.weight.mode || "avg7"), ok = w != null && (q.weight.op === "<=" ? w <= q.weight.v : w < q.weight.v);
        if (ok) { q.cur = 1; q.at = Date.now(); q.st = "done"; q.end = today(); pendingDone.push(q); }
        return;
      }
      if (q.st === "active" && q.type === "count" && q.app) {          // час у програмі: сума хвилин, або (appMax) дні, прожиті в межах ліміту
        if (!appTracked(q.app)) return;
        let n = 0; const end = q.appMax != null ? (q.until < today() ? q.until : add(today(), -1)) : (q.until < today() ? q.until : today());
        for (let k = q.from; k <= end; k = add(k, 1)) n += q.appMax != null ? (appMin(k, q.app) <= q.appMax ? 1 : 0) : Math.floor(appMin(k, q.app));
        if (n > (q.cur || 0)) { q.cur = n; q.at = Date.now(); if (q.target && n >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
        return;
      }
      if (q.st === "active" && q.type === "count" && /^роздач$/i.test((q.unit || "").trim())) {       // зіграні роздачі — прямо з HM3
        let n = 0; for (let k = q.from; k <= (q.until < today() ? q.until : today()); k = add(k, 1)) n += (pDay(k) || {}).hands || 0;
        if (n > (q.cur || 0)) { q.cur = n; q.at = Date.now(); if (q.target && n >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
        return;
      }
      if (q.st === "active" && q.type === "count" && /тренуван/i.test(q.unit || "")) {        // зал, кардіо — усе з позначкою «тренування»
        let n = 0; for (let k = q.from; k <= (q.until < today() ? q.until : today()); k = add(k, 1)) if (items(k).some(({ t, r }) => isGym(t) && r && isWin(r.st))) n++;
        if (n > (q.cur || 0)) { q.cur = n; q.at = Date.now(); if (q.target && n >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
        return;
      }
      if (q.st === "active" && q.type === "count" && /сповід|вечор/i.test(q.unit || "")) {    // «вечори в літописі» — це теж сповіді
        const n = journalCount(q.from, q.until);
        if (n > (q.cur || 0)) { q.cur = n; q.at = Date.now(); if (q.target && n >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
        return;
      }
      if (q.st === "active" && q.type === "count" && /вірн/i.test(q.unit || "")) {          // дні вірності: лише прожиті до кінця
        const F = faithIdx(), end = q.until < today() ? q.until : add(today(), -1);
        let n = 0; for (let k = q.from; k <= end; k = add(k, 1)) if (faithful(F, k, q.vow)) n++;
        if (n > (q.cur || 0)) { q.cur = n; q.at = Date.now(); if (q.target && n >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
        return;
      }
      if (q.st !== "active" || q.type !== "count" || !q.unit || /крок/i.test(q.unit)) return;
      const ts = Object.values(S.tasks).filter((t) => t.type === "count" && !t.del && t.unit && t.unit.trim().toLowerCase() === q.unit.trim().toLowerCase());
      if (!ts.length) return;
      let sum = 0; for (let k = q.from; k <= (q.until < today() ? q.until : today()); k = add(k, 1)) ts.forEach((t) => { const r = rec(k, t.id); if (r && r.cur) sum += r.cur; });
      if (sum > (q.cur || 0)) { q.cur = sum; q.at = Date.now(); if (q.target && q.cur >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
    });
  }
  function settleQuests() {
    const t0 = today();
    autoCount();
    Q.list.forEach((q) => {
      if (q.type === "budget" && q.st === "active" && T() && T().ready()) {          // бюджет: суддя — виписка банку
        const sp = qSpent(q);
        if (sp != null && sp > (q.limit || 0) && !q.limit) { q.st = "fail"; q.end = t0; }
        else if (q.until < t0 && T().at() > q.until) { q.st = sp <= (q.limit || 0) ? "done" : "fail"; q.end = t0; q.at = Date.now(); }
        if (q.st !== "active") { q.spent = sp; if (q.st === "done") pendingDone.push(q); }
        else return;
      }
      if (q.type === "budget" && q.st === "active") return;
      if (q.st === "active" && q.until < t0) { q.st = q.type === "count" && q.cur > 0 ? "part" : "fail"; q.end = t0; }
      if (q.st === "offer" && q.offerOn && diff(q.offerOn, t0) > 2) q.st = "lapsed";          // пропозиція згасла
      const id = `q:${q.id}`;
      if (q.st === "done") X.e[id] = { d: q.end || t0, xp: q.xp, src: "quest", why: q.t };
      else if (q.st === "part") X.e[id] = { d: q.end || t0, xp: Math.round(q.xp * qProg(q) * 0.6), src: "quest", why: q.t };
      else delete X.e[id];
    });
    saveQ();
  }
  /* обрати квест із пулу: потрібної рідкості, ще не бачений */
  /* only — конкретний квест (писар призначив на дату); квести з датою в випадковий розіграш не потрапляють */
  function draw(rar, tag, only) {
    const seen = new Set(Q.list.map((q) => q.pid)), can = (p) => (only ? p.id === only : !p.offerOn) && (p.type !== "budget" || (T() && T().ready() && (!p.limitPct || T().avgWeek(p.cats)))) && (!p.app || appTracked(p.app));
    let c = pool().filter((p) => (only || p.rar === rar) && can(p) && !seen.has(p.id) && (!tag || (p.tags || []).includes(tag)));
    const free = (p) => p.rar === rar && can(p) && !Q.list.some((q) => q.pid === p.id && (q.st === "active" || q.st === "offer"));
    if (!c.length && tag) c = pool().filter((p) => free(p) && (p.tags || []).includes(tag));      // тематичні можна повторювати
    if (!c.length) c = pool().filter(free);
    if (!c.length) return null;
    const p = c[Math.floor(roll(today() + rar + Q.list.length) * c.length)]; rar = p.rar;
    return { id: uid(), pid: p.id, rar, giver: p.giver || "supreme", t: p.t, desc: p.desc || "", scope: p.scope || "day", days: p.days || 0,
      type: p.type === "count" || p.type === "budget" ? p.type : "do", target: p.target || null, unit: p.unit || "", xp: p.xp || RAR[rar].xp,
      cats: p.cats || null, limitPct: p.limitPct || 0, limit: p.limit || 0, vow: p.vow || null, app: p.app || null, appMax: p.appMax != null ? p.appMax : null, weight: p.weight || null,
      offer: p.offer || "", accept: p.accept || "", decline: p.decline || "", done: p.done || "",
      st: "offer", offerOn: today(), cur: 0 };
  }
  /* розклад: рідкісні ~2–3 на тиждень, легендарні ~раз на 10 днів, міфічні ~раз на місяць; плюс тригери */
  function dailyRoll() {
    const t0 = today(), again = Q.clock.roll === t0;
    if (again && !Q.trig.length) return;
    Q.clock.roll = t0;
    if (Q.list.some((q) => q.st === "offer")) { saveQ(); return; }
    const since = (r) => Q.clock[r] ? diff(Q.clock[r], t0) : 99;
    /* квест, який писар призначив саме на сьогодні (під сповідь, ціль, віху), — замість випадкового, не на додачу */
    const due = !again && ((DROP && DROP.quests) || []).find((p) => p.offerOn && p.offerOn <= t0 && (!p.offerUntil || p.offerUntil >= t0) && !Q.list.some((q) => q.pid === p.id));
    if (due) { const q = draw(due.rar, null, due.id); if (q) { Q.list.push(q); Q.clock[q.rar] = t0; saveQ(); return; } }
    const [trig, tag] = (Q.trig.shift() || "").split(":");
    /* щоранку жереб: кожна рідкість кидається окремо, тож може випасти будь-яка, а щастя — то й дві-три одразу; одночасних квестів — без обмежень.
       Одразу після попереднього того ж ґатунку шанс менший. У середньому: рідкісний ~2 на тиждень, легендарний ~раз на 10–12 днів, міфічний ~раз на 1,5 місяця.
       Тригери (зрив, віха, три ідеальні дні) — понад жереб */
    const ODDS = { myth: [21, 0.03, 0.012], legend: [7, 0.12, 0.05], rare: [2, 0.35, 0.15] };     // [після скількох днів — повний шанс, повний, знижений]
    const rolled = again ? [] : ["myth", "legend", "rare"].filter((r) => { const [d, hi, lo] = ODDS[r]; return roll(t0 + r[0]) < (since(r) >= d ? hi : lo); });
    (trig ? [[trig, tag]] : []).concat(rolled.map((r) => [r, null])).forEach(([r, tg]) => { const q = draw(r, tg); if (q) { Q.list.push(q); Q.clock[r] = t0; } });
    saveQ();
  }
  function trigger(rar, tag) { const t = tag ? `${rar}:${tag}` : rar; if (!Q.trig.includes(t)) { Q.trig.push(t); saveQ(); } }

  /* ============================================================ СЦЕНИ ====== */
  const glowOf = (rar) => rar;
  const fill = (s, o) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : "");
  function questCard(q) {
    const r = RAR[q.rar], due = q.until ? (q.until === today() ? "до кінця дня" : `до ${human(q.until)}`) : q.scope === "day" ? "на сьогодні" : q.scope === "week" ? "на тиждень" : q.scope === "month" ? "на 30 днів" : "до кінця року";
    const lim = q.type === "budget" ? (q.limitPct && T() ? ` Ліміт — близько ${T().money(q.limitPct * (T().avgWeek(q.cats) || 0) * ((q.days || (q.scope === "week" ? 7 : q.scope === "month" ? 30 : 1))) / 7)}.` : q.limit ? ` Ліміт — ${T() ? T().money(q.limit) : q.limit}.` : " Жодної монети.") + " Перевірить виписка банку." : "";
    return `«${q.t}»${q.desc ? ` — ${q.desc}` : ""} ${r.n} квест, ${due}, +${q.xp} досвіду.${lim}`;
  }
  async function offerScene(q) {
    const h = H(); if (!h) return false;
    const L = (D().DAY || {}).quest || {};
    h.stage(q.giver, { glow: glowOf(q.rar) });
    const lines = (L.offer && L.offer[q.rar]) || [];
    const open = q.offer || pick(lines) || "Брате, маю для тебе доручення.";
    if ((await h.say(fill(open, { rar: RAR[q.rar].n.toLowerCase() }))) === "closed") return false;
    const G = window.ORDO_GOLD, rr = G && G.can("reroll");                  // реліквія чи жетон перекидання — можна попросити інше доручення
    const i = await h.choose(questCard(q), rr ? ["Приймаю", "Не цього разу", "Інше 🎲"] : ["Приймаю", "Не цього разу"], "hall__acts--row");
    if (i === "closed") return false;
    if (i === 2) {
      const nq = draw(q.rar); if (nq && G.use("reroll")) { q.st = "rerolled"; q.at = Date.now(); Q.list.push(nq); saveQ(); await h.say("Добре. Маю для тебе інше."); return offerScene(nq); }
    }
    if (i === 0) {
      const nxt = ((pool().find((p) => p.id === q.pid) || {}).tags || []).includes("return");          // «з наступних днів»: день зриву не рахується
      q.st = "active"; q.from = nxt ? add(today(), 1) : today(); q.until = untilFor(q.scope, q.from, q.days); q.at = Date.now();
      if (q.type === "budget" && q.limitPct && T()) { const days = diff(q.from, q.until) + 1; q.limit = Math.round(q.limitPct * (T().avgWeek(q.cats) || 0) * days / 7 / 100) * 100; }
      saveQ();
      fx("yes"); buzz("medium");
      await h.say(q.accept || pick(L.accept) || "Добре. Я стежитиму.");
    } else {
      q.st = "declined"; q.at = Date.now(); saveQ();
      await h.say(q.decline || pick(L.decline) || "Як скажеш. Доручення почекає іншого дня.");
    }
    render();
    return h.isOpen();
  }
  async function doneScene(q) {
    const h = H(); if (!h || h.isOpen()) return;
    const L = (D().DAY || {}).quest || {};
    h.stage(q.giver, { glow: glowOf(q.rar) });
    await h.say(q.done || pick(L.done && L.done[q.rar]) || "Доручення виконано. Орден це памʼятає.");
    if (h.isOpen()) h.close();
  }
  async function rankScene(up) {
    const h = H(); if (!h || h.isOpen()) return;
    const L = (D().DAY || {}).rank || {};
    h.stage("supreme", { glow: "legend" });
    if (up.to.ri > up.from.ri) {
      await h.say(fill(pick(L.up) || "Брате. Орден підносить тебе до звання «{rank}».", { rank: up.to.rank.name, lv: up.to.L }));
    } else {
      await h.say(fill(pick(L.level) || "Рівень {lv}. Тримай стрій.", { lv: up.to.L, rank: up.to.rank.name }));
    }
    if (h.isOpen()) h.close();
  }
  /* посвята: перший вхід у День */
  async function knightScene() {
    const h = H(); if (!h) return false;
    const K = (D().DAY || {}).knight;
    const A = API(), vows = D().VOWS || [];
    const best = A.streak ? vows.slice().sort((a, b) => A.streak(b) - A.streak(a))[0] : null;
    const o = { best: best ? best.name : "", days: best && A.streak ? A.streak(best) : 0, daysw: best && A.daysWord ? A.daysWord(A.streak(best)) : "днів", rank: "Лицар", lv: 7 };
    h.stage("supreme", { glow: "legend" });
    const nodes = K && K.n ? K.n : [{ s: "Брате. Відтепер Орден рахує кожну твою справу." }, { s: "Встань, лицарю." }];
    return h.runDialog({ n: nodes.map((n) => Object.assign({}, n, { s: fill(n.s, o), c: n.c && n.c.map((c) => ({ t: fill(c.t, o), r: fill(c.r, o) })) })) });
  }

  /* черга сцен: посвята → пропозиції квестів → підвищення; лише коли нічого не відкрито */
  let busy = false;
  async function scenes() {
    const A = API();
    if (busy || !H() || H().isOpen() || (A.queueBusy && A.queueBusy())) return;
    const intro = $("intro"); if (intro && !intro.hasAttribute("hidden")) return;
    if (document.querySelector(".rite.open, .sheet.open, .confirm.open, .kc")) return;
    busy = true;
    try {
      if (isNight()) { if (X.knighted) await nightScene(); return; }           // уночі — лише варта, без доручень і подій
      if (!X.knighted) {
        if (TAB() !== "day") return;
        if (!(await knightScene())) { if (H().isOpen()) H().close(); return; }
        X.knighted = today(); saveX();
        if (!Q.clock.first) {                     // перші доручення: по одному кожної рідкості
          Q.clock.first = today();
          ["rare", "legend", "myth"].forEach((r) => { const q = draw(r); if (q) { q.offerOn = today(); Q.list.push(q); Q.clock[r] = today(); } });
          Q.clock.roll = today(); saveQ();
        }
        render();
      }
      if (!(await nightMorning())) return;
      dailyRoll();
      for (const q of Q.list.filter((x) => x.st === "offer")) { if (!(await offerScene(q))) break; }
      while (pendingDone.length) { const q = pendingDone.shift(); await doneScene(q); }
      if (!(await eventScene())) return;
      if (window.ORDO_TREASURY) await window.ORDO_TREASURY.scenes();
      if (H().isOpen()) H().close();
      if (pendingUp) { const u = pendingUp; pendingUp = null; await rankScene(u); }
    } finally { busy = false; }
  }
  let pendingUp = null;
  const pendingDone = [];

  /* ============================================================ ВІДГУК ====== */
  function toast(html, cls) {
    let el = $("dyToast");
    if (!el) { el = document.createElement("div"); el.id = "dyToast"; el.className = "dy-toast"; document.body.appendChild(el); }
    el.className = "dy-toast" + (cls ? " " + cls : ""); el.innerHTML = html;
    void el.offsetWidth; el.classList.add("on");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), cls ? 3200 : 1700);
  }
  /* після будь-якої дії: перерахунок, підсумок досвіду, підвищення, нагороди */
  function after(before) {
    const res = settle(), gain = totalXP() - before;
    if (gain > 0) toast(`<b>+${gain}</b> досвіду`);
    res.fresh.forEach((a, i) => setTimeout(() => { toast(`<span>нагорода</span><b>${esc(a.n)}</b>`, "dy-toast--ach"); fx("date"); }, 900 + i * 1800));
    if (res.up) { pendingUp = res.up; setTimeout(() => { toast(`<span>новий рівень</span><b>${res.up.to.L} · ${esc(res.up.to.rank.name)}</b>`, "dy-toast--lv"); scenes(); }, 600); }
    const A = API(); if (A.goalsSync) A.goalsSync();          // привʼязані місячні й річні цілі
    if (window.ORDO_GOLD) window.ORDO_GOLD.tick();          // золото — слідом за досвідом
    render(); renderStatsIfOpen();
  }

  /* ============================================================ РЕНДЕР ===== */
  let view = null;                            // день, що показується
  const TAB = () => (API().tab ? API().tab() : "");
  function emblem(ri, cls) {
    const g = ri >= 3 ? "gold" : ri >= 1 ? "steel" : "bronze";
    let s = `<path class="em-sh" d="M32 4 L56 12 V30 C56 46 45 56 32 61 C19 56 8 46 8 30 V12 Z"/>`;
    if (ri <= 2) {
      s += `<path class="em-x" d="M32 18 V44 M22 28 H42"/>`;
      for (let i = 0; i < ri; i++) s += `<path class="em-ch" d="M18 ${46 + i * 5} L32 ${40 + i * 5} L46 ${46 + i * 5}"/>`;
    } else {
      s += `<path class="em-x em-x--p" d="M29 16 h6 l-1 10 l10 -1 v6 l-10 -1 l1 14 h-6 l1 -14 l-10 1 v-6 l10 1 Z"/>`;
      if (ri === 4 || ri === 5) for (let i = 0; i < ri - 3; i++) s += `<circle class="em-st" cx="${ri === 4 ? 32 : 26 + i * 12}" cy="50" r="2.4"/>`;
      if (ri === 6 || ri === 9) s += `<path class="em-lf" d="M14 40 C14 50 22 56 30 58 M50 40 C50 50 42 56 34 58"/>`;
      if (ri === 7) s += `<path class="em-sw" d="M14 52 L50 14 M50 52 L14 14"/>`;
      if (ri >= 8) s += `<path class="em-cr" d="M22 10 L25 4 L29 8 L32 2 L35 8 L39 4 L42 10 Z"/>`;
      if (ri === 10) s += `<circle class="em-halo" cx="32" cy="32" r="30"/>`;
    }
    return `<svg class="em em--${g}${cls ? " " + cls : ""}" viewBox="0 0 64 64" aria-hidden="true">${s}</svg>`;
  }
  function rankStrip() {
    const lv = levelOf(totalXP()), p = Math.min(1, (lv.xp - lv.from) / (lv.to - lv.from));
    return `<button class="dy-rank" type="button" data-dgo="stats">${emblem(lv.ri)}
      <div class="dy-rank__t"><b>${esc(lv.rank.name)}</b><span>рівень ${lv.L}</span></div>
      <div class="dy-rank__bar"><i style="width:${Math.round(p * 100)}%"></i></div>
      <em class="dy-rank__n">${fmtN(lv.xp - lv.from)} / ${fmtN(lv.to - lv.from)}${window.ORDO_GOLD ? window.ORDO_GOLD.chip() : ""}</em></button>`;
  }
  function metaOf(t, r, k) {
    const bits = [];
    if (t.time) bits.push(t.time);
    const rt = repText(t); if (rt) bits.push(`<span class="dy-rep">↻ ${rt}</span>`);
    const wr = isGym(t) && GYM.w[wKey(k, t.id)];
    if (wr && (wr.text || "").trim()) bits.push(wr.fin ? "записано" : "✎ запис триває");
    if (r && r.from) bits.push(`перенесено з ${human(r.from)}`);
    if (r && r.st === "moved" && r.to) bits.push(r.early ? `зроблено наперед ${human(r.to)}` : `перенесено на ${human(r.to)}`);
    if (r && r.st === "done" && r.early) bits.push(`зроблено наперед ${human(r.early)}`);
    if (r && r.note) bits.push(`<i>${esc(r.note)}</i>`);
    else if (t.notes && t.notes.length <= 40) bits.push(`<i>${esc(t.notes)}</i>`);
    return bits.join(" · ");
  }
  function rowHTML(t, r, k) {
    const st = stOf(t, r, k), cnt = t.type === "count";
    const ro = k > today();
    const cur = (r && r.cur) || 0, pr = cnt && t.target ? Math.min(1, cur / t.target) : 0;
    const xp = xpTask(t, r || {}, k);
    const mark = cnt ? `<span class="dy-mark dy-mark--n" data-dopen="${t.id}">${Math.round(pr * 100)}<small>%</small></span>`
      : `<button class="dy-mark" type="button" data-dmark="${t.id}" aria-label="${ro ? "Зробити наперед" : "Виконано"}"></button>`;
    return `<li class="dy-it st-${st}${t.quest ? " dy-it--q" : ""}" data-dopen="${t.id}">${mark}
      <div class="dy-body"><span class="dy-t">${esc(t.t)}</span>
        ${cnt ? `<div class="gl-bar"><i style="width:${Math.round(pr * 100)}%"></i></div><span class="dy-num">${fmtN(cur)} <em>/ ${fmtN(t.target)} ${esc(t.unit || "")}</em></span>` : ""}
        ${(() => { if (srcOf(t) !== "app" || t.type === "count" || k > today()) return ""; const a = appOf(t), m = Math.floor(appMin(k, a.n));
          return a.lim ? `<span class="dy-num${m > a.min ? " is-over" : ""}">${m} хв <em>/ ліміт ${a.min}</em></span>` : m ? `<span class="dy-num">${m} <em>/ ${a.min} хв</em></span>` : ""; })()}
        ${(() => { const sp = srcOf(t) === "bank" && k <= today() ? bankSpent(t, k) : null; return sp == null ? "" : `<span class="dy-num${sp > (t.bank.limit || 0) ? " is-over" : ""}">витрачено ${T().money(sp)} <em>/ ліміт ${T().money(t.bank.limit || 0)}</em></span>`; })()}
        <span class="dy-meta">${metaOf(t, r, k)}</span></div>
      ${cnt && !ro && st !== "done" && st !== "moved" && st !== "cancel" ? `<button type="button" class="gs-plus" data-dplus="${t.id}" aria-label="Додати">+</button>` : ""}
      ${xp ? `<span class="dy-xp">+${xp}</span>` : ""}</li>`;
  }
  function questHTML(q) {
    const r = RAR[q.rar], pr = qProg(q), left = q.until ? diff(today(), q.until) : 0;
    const due = q.st !== "active" ? "" : left <= 0 ? "сьогодні останній день" : `ще ${left} ${API().daysWord ? API().daysWord(left) : "дн."}`;
    const who = q.giver === "supreme" ? (D().KEEPERS || {}).supreme : q.giver === "seneschal" ? D().SENESCHAL : q.giver === "chronicler" ? D().CHRONICLER : (D().KEEPERS || {})[q.giver];
    const img = who && who.art ? `<img src="${esc(who.art)}" alt="">` : "";
    return `<li class="dy-q dy-q--${q.rar} st-${q.st}" data-dq="${q.id}">
      <div class="dy-q__fig">${img}</div>
      <div class="dy-q__body"><span class="dy-q__kind">${r.n} квест${who ? ` · ${esc(who.name)}` : ""}</span><b class="dy-q__t">${esc(q.t)}</b>
        ${q.desc ? `<span class="dy-q__d">${esc(q.desc)}</span>` : ""}
        ${q.type === "budget" ? budgetLine(q) : ""}
        ${q.type === "count" && q.target ? `<div class="gl-bar"><i style="width:${Math.round(pr * 100)}%"></i></div><span class="dy-num">${fmtN(q.cur || 0)} <em>/ ${fmtN(q.target)} ${esc(q.unit || "")}</em></span>` : ""}
        <span class="dy-q__due">${q.st === "done" ? `виконано · +${q.xp}` : due}${q.st === "active" ? ` · +${q.xp}` : ""}</span></div>
      ${q.st === "active" && !qAuto(q) ? (q.type === "count" ? `<button type="button" class="gs-plus" data-dqplus="${q.id}" aria-label="Додати">+</button>` : `<button type="button" class="dy-mark dy-mark--q" data-dqdone="${q.id}" aria-label="Виконано"></button>`) : ""}</li>`;
  }
  function budgetLine(q) {
    const sp = qSpent(q), m = T() ? T().money : (x) => x;
    if (sp == null) return `<span class="dy-num"><em>чекаю виписку банку</em></span>`;
    const pr = q.limit ? Math.min(1, sp / q.limit) : sp > 0 ? 1 : 0;
    return `<div class="gl-bar dy-bud"><i style="width:${Math.round(pr * 100)}%"></i></div><span class="dy-num">${m(sp)} <em>${q.limit ? `/ ліміт ${m(q.limit)}` : "— має бути нуль"}</em></span>`;
  }
  /* страховка: якщо якийсь блок упаде, день однаково перемкнеться, а помилка буде видна (і піде в діагностику) */
  function render() {
    try { renderDay(); }
    catch (e) {
      const box = $("dayBody"), k = view || today(); if (!box) return;
      try { const errs = LS.get("ordo.k.errs", []); errs.push({ at: new Date().toISOString(), day: k, msg: String(e && e.message || e), st: String(e && e.stack || "").split("\n").slice(0, 3).join(" | ") }); LS.set("ordo.k.errs", errs.slice(-10)); } catch (x) {}
      box.dataset.seg = ""; box.innerHTML = `<div class="dy-nav"><button type="button" data-dnav="-1" aria-label="Попередній день">‹</button><div class="dy-nav__c"><b>${rel(k)}</b><span>${WDL[wd(k)]}, ${human(k)}</span></div><button type="button" data-dnav="1" aria-label="Наступний день">›</button></div>
        <button class="dy-today" type="button" data-dnav="0">до сьогодні</button><p class="dy-note">Не вдалося показати цей день: ${esc(String(e && e.message || e))}. Скинь цей текст — виправлю.</p>`;
    }
  }
  function renderDay() {
    const box = $("dayBody"); if (!box) return;
    const k = view || today(); view = k;
    const sub = $("daySub"); if (sub) sub.textContent = `${WDL[wd(today())]}, ${human(today())}`;
    const its = items(k);
    const open = its.filter(({ t, r }) => { const s = stOf(t, r, k); return s === "open" || s === "part" && k >= today(); });
    const shut = its.filter((x) => !open.includes(x));
    const doneN = its.filter(({ t, r }) => isWin(stOf(t, r, k))).length;
    const live = Q.list.filter((q) => q.st === "active" || (q.st === "done" && q.end === k));
    const dayXP = Object.values(X.e).filter((e) => e.d === k).reduce((a, e) => a + e.xp, 0);
    const segR = rankStrip(); let h = "";
    h += `<div class="dy-nav"><button type="button" data-dnav="-1" aria-label="Попередній день">‹</button>
      <div class="dy-nav__c"><b>${rel(k)}</b><span>${WDL[wd(k)]}, ${human(k)}</span></div>
      <button type="button" data-dnav="1" aria-label="Наступний день">›</button></div>`;
    /* смуга днів: вчора … +5 — великі цілі для пальця, один тап на потрібний день */
    const t0d = today(), strip = []; for (let i = -1; i <= 5; i++) strip.push(add(t0d, i));
    if (!strip.includes(k)) strip.push(k);
    h += `<div class="dy-strip">${strip.map((d) => `<button type="button" data-dday="${d}" class="${d === k ? "is-on" : ""}${d === t0d ? " is-today" : ""}"><span>${WD[wd(d)]}</span><b>${dt(d).getDate()}</b></button>`).join("")}</div>`;
    if (k !== today()) h += `<button class="dy-today" type="button" data-dnav="0">до сьогодні</button>`;
    const hd = hDay(k) || {};             // на майбутній день даних ще немає — порожньо, а не null
    const wl = weightOn(k, "last"), wa = weightOn(k, "avg7");
    const apm = Object.entries(hd.apps || {}).filter(([, a]) => a.min >= 1);
    if (hd.steps != null || hd.sleepMin || hd.up || hd.mind || hd.duo || apm.length || wl) h += `<div class="dy-body-line">${hd.up ? `<span><svg><use href="#i-sun"/></svg>підйом <b>${hd.up}</b></span>` : ""}${hd.sleepMin ? `<span><svg><use href="#i-moon"/></svg>сон <b>${hm(hd.sleepMin)}</b></span>` : ""}${hd.steps != null ? `<span><svg><use href="#i-steps"/></svg><b>${fmtN(hd.steps)}</b> кроків</span>` : ""}${hd.mind ? `<span>медитація${hd.mind > 1 ? ` <b>×${hd.mind}</b>` : ""}</span>` : ""}${hd.duo && (hd.duo.streak || hd.duo.today) && !(hd.apps && hd.apps.duolingo && hd.apps.duolingo.min >= 1) ? `<span>duolingo${hd.duo.streak ? ` <b>${hd.duo.streak}</b>🔥` : ""}${hd.duo.today ? ` · +${hd.duo.today} XP` : ""}</span>` : ""}${apm.map(([n, a]) => `<span>${esc(n)} <b>${Math.floor(a.min)}</b> хв${n === "duolingo" && hd.duo && hd.duo.streak ? ` · <b>${hd.duo.streak}</b>🔥` : ""}</span>`).join("")}${wl ? `<span>вага <b>${fmtN(wl)}</b>${wa && wa !== wl ? ` · ~${fmtN(wa)}` : ""}</span>` : ""}</div>`;
    const pk = pDay(k);
    if (pk && pk.hands) h += `<div class="dy-body-line dy-body-line--sub"><span>покер <b>${fmtN(pk.hands)}</b> роздач${pk.sessions ? ` · ${pk.sessions} ${pk.sessions === 1 ? "сесія" : pk.sessions < 5 ? "сесії" : "сесій"}, ${(pk.min || 0) < 60 ? `${pk.min || 0} хв` : hm(pk.min).replace(" 00 хв", "")}` : ""}</span></div>`;
    if (k === today() && IOS) h += `<div class="dy-hsync"><button type="button" data-hsync>${Date.now() - hSyncAt < 2 * 60e3 ? "оновлюю з телефона…" : "↻ оновити з телефона"}</button></div>`;
    const pm = periodSteps(k.slice(0, 7)), py = periodSteps(k.slice(0, 4));
    if (pm || py) h += `<div class="dy-body-line dy-body-line--sub">${pm ? `<span>${MN[+k.slice(5, 7) - 1]} <b>${fmtN(pm.steps)}</b> · ~${fmtN(pm.avg)}/день</span>` : ""}${py ? `<span>${k.slice(0, 4)} <b>${fmtN(py.steps)}</b> · ~${fmtN(py.avg)}/день</span>` : ""}</div>`;
    if (k === today() && roughNight(k) && !isNight()) {
      const N = S.night[k], gymToday = its.some(({ t }) => isGym(t));
      const tips = ["кава — до 12:00", "денний сон — до 20 хв і до 15:00", "за годину до сну — без екранів", "лягти до 23:00"].concat(gymToday ? ["у залі — без підвищення ваги"] : []);
      h += `<div class="dy-ret dy-night"><span class="dy-ret__t">Після нічної варти</span>
        <span class="dy-ret__s">${N.kind === "siren" ? `повітряна тривога${N.at ? ` о ${N.at}` : ""}` : N.at ? `прокидався о ${N.at}` : "ніч була неспокійна"}${N.parked && !N.dealt ? " · тривога чекає на розмову" : ""}</span>
        <ul class="dy-tips">${tips.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
    }
    const cb = k === today() ? comeback() : null;
    if (cb) h += `<div class="dy-ret"><span class="dy-ret__t">Шлях повернення</span><span class="dy-ret__pips">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<i class="${i <= cb.n ? "is-on" : ""}"></i>`).join("")}</span>
      <span class="dy-ret__s">${cb.today ? "новий стрік почнеться завтра — тримай перший день" : `день ${cb.n + 1} з 7 · новий стрік уже росте`}</span></div>`;
    const gymT = its.find(({ t, r }) => isGym(t) && !isWin(stOf(t, r, k)) && stOf(t, r, k) !== "moved" && stOf(t, r, k) !== "cancel");
    const adv = gymT && k >= today() ? gymAdvice(k) : null;
    if (adv) { const K = adv.giver === "supreme" ? (D().KEEPERS || {}).supreme : (D().KEEPERS || {})[adv.giver];
      h += `<div class="md md--voice dy-adv"><div class="md__fig"${K && K.art ? ` data-card="${adv.giver}"` : ""}>${K && K.art ? `<img class="md__img" src="${esc(K.art)}" alt="">` : ""}</div><div class="md__txt"><div class="md__who">${esc(K ? K.name : "")} · порада на зал</div><p class="md__say">${esc(adv.head)}</p>${adv.tips.length ? `<ul class="dy-tips">${adv.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div>`; }
    const segA = h; h = "";
    const segQ = live.length ? `<section class="dy-sec"><div class="gl-sec__head"><span class="gl-sec__kind">Квести</span></div><ul class="dy-qs">${live.map(questHTML).join("")}</ul></section>` : "";
    h += `<section class="dy-sec"><div class="gl-sec__head"><span class="gl-sec__kind">${k === today() ? "Справи дня" : k < today() ? "Того дня" : "Заплановано"}</span><span class="gl-sec__meta">${its.length ? `${doneN}/${its.length}` : ""}</span></div>`;
    if (!its.length) h += `<p class="gl-empty">${k < today() ? "Того дня справ не було." : "Справ на цей день немає."}</p>`;
    h += `<ul class="dy-list">${open.map(({ t, r }) => rowHTML(t, r, k)).join("")}</ul>`;
    if (shut.length) h += `<ul class="dy-list dy-list--shut">${shut.map(({ t, r }) => rowHTML(t, r, k)).join("")}</ul>`;
    h += `<button class="gl-new" type="button" data-dnew="1"><svg><use href="#i-plus"/></svg>Нова ціль</button></section>`;
    if (dayXP) h += `<p class="dy-sum">${k === today() ? "За сьогодні" : "За день"}: <b>+${fmtN(dayXP)}</b> досвіду${perfect(k) ? " · чистий день" : ""}</p>`;
    patch(box, [segR, segA, segQ, h]);
  }
  /* екран дня — чотири шматки (звання, день, квести, справи); оновлюється лише те, що змінилось:
     перемикання дня не перебудовує квести з портретами — на iPhone це найдорожче */
  const segs = [];
  function patch(box, parts) {
    if (box.dataset.seg !== "4" || box.children.length !== parts.length) { box.innerHTML = parts.map(() => "<div></div>").join(""); box.dataset.seg = "4"; segs.length = 0; }
    parts.forEach((html, i) => { if (segs[i] !== html) { box.children[i].innerHTML = html; segs[i] = html; } });
  }

  /* ============================================================ ДІЇ ======== */
  /* зробити наперед: якщо ціль сьогодні не припадає — переїжджає на сьогодні виконаною (рахується одразу, і в привʼязаних цілях);
     якщо сьогодні вона й так є — майбутній день просто позначається виконаним наперед */
  function earlyDone(id, k) {
    const t = S.tasks[id], t0 = today(), r = rec(k, id), before = totalXP(); if (!t || k <= t0) return;
    if (r && (r.st === "done" || (r.st === "moved" && r.early))) {                    // скасувати «наперед»
      if (r.st === "moved") { setRec(t0, id, { from: null, st: null }); }
      setRec(k, id, { st: null, to: null, early: null }); buzz("light"); after(before); return;
    }
    if (items(t0).some((x) => x.t.id === id)) setRec(k, id, { st: "done", early: t0 });
    else { setRec(k, id, { st: "moved", to: t0, early: 1 }); setRec(t0, id, { from: k, st: isGym(t) || srcOf(t) === "journal" ? null : "done" }); }
    fx("yes"); buzz("medium"); after(before);
    if (isGym(t) && !(rec(t0, id) || {}).st) setTimeout(() => openSheet("gym", id, t0), 400);   // тренування — запис і «Готово» вже сьогодні
  }
  function mark(id, k) {
    const t = S.tasks[id]; if (!t) return;
    if (k > today()) { earlyDone(id, k); return; }
    if (isGym(t) && k <= today()) { openSheet("gym", id, k); return; }           // тренування закривається кнопкою «Готово» в записі
    if (srcOf(t) === "journal" && k <= today()) { openJournal(k); return; }       // сповідь закриває ціль сама
    const before = totalXP(), r = rec(k, id), st = stOf(t, r, k);
    if (st === "done" || st === "fix") { setRec(k, id, { st: null, note: null }); buzz("light"); }
    else { setRec(k, id, { st: "done" }); fx("yes"); buzz("medium"); if (isGym(t)) setTimeout(() => openSheet("gym", id, k), 500); }
    after(before);
  }
  function plus(id, k, n) {
    const t = S.tasks[id]; if (!t) return;
    const before = totalXP(), r = rec(k, id) || {};
    const cur = Math.max(0, (r.cur || 0) + (n == null ? (t.step || 1) : n));
    setRec(k, id, { cur });
    if (t.target && cur >= t.target && (r.cur || 0) < t.target) { fx("yes"); buzz("medium"); } else buzz("light");
    after(before);
  }
  function qDone(id) {
    const q = Q.list.find((x) => x.id === id); if (!q || q.st !== "active") return;
    const before = totalXP(); q.st = "done"; q.end = today(); q.at = Date.now(); saveQ();
    fx("date"); buzz("heavy"); after(before); doneScene(q);
  }
  function qPlus(id, n) {
    const q = Q.list.find((x) => x.id === id); if (!q || q.st !== "active") return;
    q.cur = Math.max(0, (q.cur || 0) + (n == null ? 1 : n)); q.at = Date.now();
    if (q.target && q.cur >= q.target) return qDone(id);
    saveQ(); buzz("light"); render();
  }

  /* ---------------------------------------------------------- шторка ------ */
  let sh = null;                               // { mode, id, k }
  function sheetEl() {
    let el = $("dSheet"); if (el) return el;
    el = document.createElement("div"); el.className = "sheet dsheet"; el.id = "dSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", onSheet);
    el.addEventListener("change", onSheetChange);
    const A = API(); if (A.dragDismiss) A.dragDismiss(el, { target: () => el, close: closeSheet, follow: A.scrimFollow,
      scroller: () => el, can: (e) => !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) });
    return el;
  }
  function openSheet(mode, id, k) {
    sheetEl().onclick = null;
    sh = { mode, id, k: k || view || today(), draft: null };
    if (mode === "edit") { const t = id && S.tasks[id]; sh.draft = t ? JSON.parse(JSON.stringify(t)) : { t: "", type: "do", diff: "normal", rep: { f: "none" }, start: sh.k, time: "" }; }
    renderSheet();
    fx("open"); buzz("light");
    const sc = $("scrim"); if (sc) sc.classList.add("open");
    requestAnimationFrame(() => sheetEl().classList.add("open"));
  }
  function closeSheet() {
    gyFlush(); jFlush(); clearInterval(nbTimer);
    if (sh && sh.mode === "night") { const N = S.night[sh.k]; if (N && !N.done) { N.done = 1; saveS(); } }
    const wasGym = sh && sh.mode === "gym";
    const el = $("dSheet"); if (el) el.classList.remove("open");
    if (!document.querySelector(".sheet.open, .confirm.open")) { const sc = $("scrim"); if (sc) sc.classList.remove("open"); }
    sh = null;
    if (wasGym) render();                         // «✎ запис триває» у списку
  }
  const REPS = [["none", "Ніколи"], ["day", "Щодня"], ["wd", "У будні"], ["we", "У вихідні"], ["week", "Щотижня"], ["month", "Щомісяця"], ["mlast", "Останній день місяця"], ["year", "Щороку"]];
  function renderSheet() {
    const el = sheetEl(); if (!sh) return;
    let h = `<div class="sheet__grip"></div>`;
    if (sh.mode === "edit") {
      const d = sh.draft, r = d.rep || { f: "none" };
      h += `<div class="gs-kicker">${sh.id ? "Правити ціль" : "Нова ціль дня"}</div>
        <input class="dy-in dy-in--t" id="dsT" type="text" placeholder="Що зробити?" value="${esc(d.t)}" autocomplete="off">
        <div class="dy-f"><label>Тип</label><div class="dy-chips" data-dk="type">
          <button type="button" data-dv="do" class="${d.type !== "count" ? "is-on" : ""}">Зробити</button>
          <button type="button" data-dv="count" class="${d.type === "count" ? "is-on" : ""}">Число</button></div></div>
        ${d.type === "count" ? `<div class="dy-f dy-f--row"><label>Мета</label><input class="dy-in dy-in--n" id="dsN" inputmode="decimal" value="${d.target || ""}" placeholder="10 000"><input class="dy-in dy-in--u" id="dsU" value="${esc(d.unit || "")}" placeholder="кроків"></div>
          <div class="dy-f dy-f--row"><label>Крок «+»</label><input class="dy-in dy-in--n" id="dsP" inputmode="decimal" value="${d.step || 1}"></div>` : ""}
        <div class="dy-f"><label>Повтор</label><div class="dy-chips dy-chips--wrap" data-dk="rep">${REPS.map(([v, n]) => `<button type="button" data-dv="${v}" class="${r.f === v ? "is-on" : ""}">${n}</button>`).join("")}</div></div>
        ${r.f === "week" ? `<div class="dy-f"><label>Дні</label><div class="dy-chips dy-chips--days" data-dk="days">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<button type="button" data-dv="${i}" class="${(r.days && r.days.length ? r.days : [wd(d.start)]).includes(i) ? "is-on" : ""}">${WD[i]}</button>`).join("")}</div></div>` : ""}
        ${["day", "week", "month"].includes(r.f) ? `<div class="dy-f dy-f--row"><label>Кожні</label><input class="dy-in dy-in--n" id="dsE" inputmode="numeric" value="${r.n || 1}"><span class="dy-unit">${r.f === "day" ? "дн." : r.f === "week" ? "тиж." : "міс."}</span></div>` : ""}
        <div class="dy-f dy-f--row"><label>${r.f === "none" ? "Дата" : "Починаючи з"}</label><input class="dy-in" id="dsD" type="date" value="${d.start}"></div>
        <div class="dy-f dy-f--row"><label>Час</label><input class="dy-in" id="dsH" type="time" value="${d.time || ""}"></div>
        <div class="dy-f"><label>Нотатка</label><textarea class="dy-in dy-in--note" id="dsO" rows="2" placeholder="деталі, норма, що саме">${esc(d.notes || "")}</textarea></div>
        <div class="dy-f"><label>Вага</label><div class="dy-chips" data-dk="diff">${Object.keys(DIFF).map((v) => `<button type="button" data-dv="${v}" class="${(d.diff || "normal") === v ? "is-on" : ""}">${DIFF[v]} · ${BASE[v]}</button>`).join("")}</div></div>
        <div class="dy-f"><label>Дані</label><div class="dy-chips dy-chips--wrap" data-dk="src">${Object.keys(SRC).map((v) => `<button type="button" data-dv="${v}" class="${srcOf(d) === v ? "is-on" : ""}">${SRC[v]}</button>`).join("")}</div></div>
        <p class="dy-note dy-note--src">${{ "": "Відмічаєш сам.", steps: "Кроки зі «Здоровʼя» підтягуються самі.", poker: "Роздачі з HM3 підтягуються самі (з компа, через рандомайзер).", mind: "Відмічається сама, щойно в «Здоровʼї» є сесія Calm.", journal: "Відмічається сама, щойно віддаси сповідь дня.", app: (d.app && d.app.lim ? "Зараховується наступного дня, якщо за день у програмі пробув не більше ліміту." : "Зараховується сама, щойно за день набереться потрібний час у програмі.") + ` Потрібні дві автоматизації «Коли програму … Відкрито / Закрито», що шлють <b>app: ${esc((d.app && d.app.n) || "назва")}</b> та <b>ev: open</b> / <b>close</b> (event_type health). «Число» — хвилини за день.`, weight: "Відмічається сама, щойно в «Здоровʼї» є зважування за день.", bank: "Зараховується сама, якщо за день витрати в категоріях не перевищили ліміт (за випискою)." }[srcOf(d)]}</p>
        ${srcOf(d) === "app" ? `<div class="dy-f dy-f--row"><label>Програма</label><input class="dy-in" id="dsAN" value="${esc(appOf(d).n)}" placeholder="duolingo, youtube…" autocomplete="off" autocapitalize="off"></div>
          <div class="dy-f"><label>Скільки</label><div class="dy-chips" data-dk="alim"><button type="button" data-dv="" class="${appOf(d).lim ? "" : "is-on"}">щонайменше</button><button type="button" data-dv="1" class="${appOf(d).lim ? "is-on" : ""}">не більше</button></div></div>
          ${d.type === "count" ? "" : `<div class="dy-f dy-f--row"><label>Хвилин</label><input class="dy-in dy-in--n" id="dsAM" inputmode="numeric" value="${appOf(d).min}"><span class="dy-unit">${appOf(d).lim ? "на день, 0 — не відкривати" : "на день"}</span></div>`}` : ""}
        ${srcOf(d) === "bank" ? `<div class="dy-f"><label>Категорії</label><div class="dy-chips dy-chips--wrap" data-dk="bcat">${Object.entries(T() ? T().cats() : {}).filter(([c]) => c !== "own").map(([c, n]) => `<button type="button" data-dv="${c}" class="${(d.bank && d.bank.cats || []).includes(c) ? "is-on" : ""}">${esc(n)}</button>`).join("") || `<span class="dy-note">чекаю першу виписку банку</span>`}</div></div>
          <div class="dy-f dy-f--row"><label>Ліміт на день</label><input class="dy-in dy-in--n" id="dsBL" inputmode="decimal" value="${d.bank && d.bank.limit ? d.bank.limit / 100 : 0}"><span class="dy-unit">грн · 0 — без витрат</span></div>` : ""}
        <div class="dy-f"><label>Позначки</label><div class="dy-chips" data-dk="flags">
          <button type="button" data-dv="gym" class="${isGym(d) ? "is-on" : ""}">тренування</button></div></div>
        <button class="btn btn--gold" type="button" data-ds="save">${sh.id ? "Зберегти" : "Додати"}</button>
        ${sh.id ? `<button class="btn btn--reset" type="button" data-ds="del">Видалити ціль</button>` : ""}
        <button class="btn btn--ghost" type="button" data-ds="close">Скасувати</button>`;
    } else if (sh.mode === "item") {
      const t = S.tasks[sh.id]; if (!t) { closeSheet(); return; }
      const k = sh.k, r = rec(k, t.id), st = stOf(t, r, k), fut = k > today(), cnt = t.type === "count";
      const xp = xpTask(t, r || {}, k), ch = chainBefore(t, k);
      h += `<div class="gs-kicker">${rel(k)}, ${human(k)}</div><div class="sheet__title dy-sht">${esc(t.t)}</div>
        <div class="sheet__stat">${[repText(t), t.time, DIFF[t.diff || "normal"] + " · " + BASE[t.diff || "normal"]].filter(Boolean).join(" · ")}${ch ? ` · поспіль ${ch}` : ""}</div>
        ${t.notes ? `<p class="dy-note dy-note--t">${esc(t.notes)}</p>` : ""}
        ${t.link === "goals" ? `<button type="button" class="btn btn--line" data-ds="goals">Відкрити Цілі</button>` : ""}`;
      if (cnt) h += `<div class="dy-f dy-f--row dy-f--cur"><label>Зараз</label><input class="dy-in dy-in--n" id="dsC" inputmode="decimal" value="${(r && r.cur) || 0}"><span class="dy-unit">/ ${fmtN(t.target)} ${esc(t.unit || "")}</span></div>`;
      if (!fut) {
        h += `<div class="dy-acts">`;
        if (cnt) h += `<button type="button" class="btn btn--gold" data-ds="cur">Записати</button><button type="button" class="btn btn--line" data-ds="part">Закрити частково</button>`;
        else h += st === "done" || st === "fix" ? `<button type="button" class="btn btn--line" data-ds="undo">Зняти відмітку</button>` : `<button type="button" class="btn btn--gold" data-ds="done">Виконано</button>`;
        h += `<button type="button" class="btn btn--line" data-ds="fixq">З поправкою</button></div>`;
      } else {
        const early = r && (r.early || (r.st === "moved" && r.early));
        h += `<div class="dy-acts"><button type="button" class="btn ${early ? "btn--line" : "btn--gold"}" data-ds="early">${early ? "Скасувати «наперед»" : "Зробити наперед"}</button></div>
          ${early ? "" : `<p class="dy-note">${items(today()).some((x) => x.t.id === t.id) ? "Сьогодні ця ціль теж є — цей день позначиться виконаним наперед." : "Ціль переїде на сьогодні виконаною — і одразу зарахується, зокрема в привʼязаних цілях місяця й року."}</p>`}`;
      }
      h += `<div class="dy-acts dy-acts--3"><button type="button" class="btn btn--ghost" data-ds="move">Перенести</button>
        <button type="button" class="btn btn--ghost" data-ds="${st === "cancel" ? "uncancel" : "cancel"}">${st === "cancel" ? "Повернути" : "Скасувати"}</button>
        <button type="button" class="btn btn--ghost" data-ds="edit">Правити</button></div>`;
      if (isGym(t) && !fut) h += `<button type="button" class="btn btn--line" data-ds="gym">Запис тренування</button>`;
      if (xp) h += `<p class="dy-note">За цю справу: +${xp} досвіду${ch ? ` (серія ${ch} дає +${Math.round(Math.min(0.3, ch * 0.03) * 100)}%)` : ""}</p>`;
      if (r && r.note) h += `<p class="dy-note">Поправка: ${esc(r.note)}</p>`;
    } else if (sh.mode === "sleep") {
      const sl = S.sleep[today()] || {}, BEDS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00", "01:30"];
      h += `<div class="gs-kicker">Ранок · ${human(today())}</div><div class="sheet__title dy-sht">Доброго ранку, лицарю. Як спав?</div>
        <p class="dy-note">Ти на ногах до восьмої — це вже ранній підйом.</p>
        <div class="dy-f"><label>Ліг о</label><div class="dy-chips dy-chips--wrap" data-dk="bed">${BEDS.map((b) => `<button type="button" data-dv="${b}" class="${(sh.bed || sl.bed) === b ? "is-on" : ""}">${b}</button>`).join("")}</div>
          <input class="dy-in" id="slB" type="time" value="${sh.bed || sl.bed || ""}" style="margin-top:8px"></div>
        <div class="dy-f dy-f--row"><label>Встав о</label><input class="dy-in" id="slW" type="time" value="${sl.wake || S.wake[today()] || ""}"></div>
        <div class="dy-f"><label>Самопочуття</label><div class="dy-chips" data-dk="q">${[["3", "бадьоро"], ["2", "нормально"], ["1", "розбитий"]].map(([v, n]) => `<button type="button" data-dv="${v}" class="${String(sh.q || sl.q || "") === v ? "is-on" : ""}">${n}</button>`).join("")}</div></div>
        <button class="btn btn--gold" type="button" data-ds="slsave">Записати</button><button class="btn btn--ghost" type="button" data-ds="slskip">Не зараз</button>`;
    } else if (sh.mode === "gym") {
      const t = S.tasks[sh.id], wk = wKey(sh.k, sh.id), w = GYM.w[wk] || {}, r = rec(sh.k, sh.id), done = !!(t && isWin(stOf(t, r, sh.k)));
      const lift = !!(t && isLift(t)) || !!GYM.log[sh.k];
      h += `<div class="gs-kicker">Тренування · ${rel(sh.k)}, ${human(sh.k)}</div><div class="sheet__title dy-sht">${esc(t ? t.t : "Тренування")}</div>`;
      if (sh.fin) {
        h += `<p class="dy-note dy-note--t">Записано. ${(w.text || "").trim() ? "Звіт у журналі, писар його побачить." : ""}</p>
          ${(w.text || "").trim() ? `<div class="gy-report">${esc(w.text.trim()).replace(/\n/g, "<br>")}</div>` : ""}
          <button class="btn btn--gold" type="button" data-ds="gcopy">Скопіювати для тренера</button><button class="btn btn--ghost" type="button" data-ds="close">Закрити</button>`;
      } else {
        h += `<p class="dy-note">Пиши по ходу: вправа, підходи, відчуття. Кожна літера зберігається сама — можна закривати й повертатися.</p>
          <textarea class="dy-in gy-text" id="gyText" rows="9" placeholder="напр.: жим 60×8, 60×8, 62.5×6 · плече ок">${esc(w.text || "")}</textarea>
          <div class="gy-saved" id="gySaved">${w.at ? `збережено о ${clock(w.at)}` : ""}</div>`;
        if (lift && (sh.table || GYM.log[sh.k])) {
          if (!sh.gym) {
            const ex = GYM.log[sh.k], ss = sessions().filter((x) => x.k < sh.k && x.ex.length), adv = gymAdvice(sh.k);
            const tpl = ex ? ex : { ex: (adv && ss.length ? (ss.length > 1 && !ss[ss.length - 1].ex.some((e) => ss[ss.length - 2].ex.some((f) => f.n.toLowerCase() === e.n.toLowerCase())) ? ss[ss.length - 2] : ss[ss.length - 1]).ex : [{ n: "", sets: [{}] }]).map((e) => ({ n: e.n, sets: (e.sets || [{}]).map((x) => ({ r: x.r, w: x.w, hint: true })) })) };
            sh.gym = JSON.parse(JSON.stringify({ ex: tpl.ex, note: tpl.note || "" })); sh.gymTpl = gymSig(sh.gym);
          }
          const g = sh.gym, known = [...new Set(sessions().flatMap((x) => x.ex.map((e) => e.n)))];
          h += `<p class="dy-note">Підходи: повтори × вага. Значення з минулого разу підставлено — виправ, що змінилось.</p>
        <datalist id="gyKnown">${known.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        ${g.ex.map((e, i) => `<div class="gy-ex" data-i="${i}"><div class="gy-ex__h"><input class="dy-in gy-n" list="gyKnown" placeholder="Вправа" value="${esc(e.n)}"><button type="button" class="gy-x" data-ds="gdel" data-i="${i}" aria-label="Прибрати">×</button></div>
          <div class="gy-sets">${e.sets.map((x, j) => `<span class="gy-set"><input class="dy-in gy-r" inputmode="numeric" placeholder="повт" value="${x.r == null ? "" : x.r}"><i>×</i><input class="dy-in gy-w" inputmode="decimal" placeholder="кг" value="${x.w == null ? "" : x.w}"></span>`).join("")}
          <button type="button" class="gy-plus" data-ds="gset" data-i="${i}">+ підхід</button></div></div>`).join("")}
        <button type="button" class="gl-new" data-ds="gadd"><svg><use href="#i-plus"/></svg>Вправа</button>
        <textarea class="dy-in dy-in--note" id="gyNote" rows="2" placeholder="нотатка: самопочуття, що боліло, що вдалось">${esc(g.note || "")}</textarea>`;
        } else if (lift) h += `<button type="button" class="btn btn--ghost" data-ds="gtable">+ підходи таблицею (для порад на наступний зал)</button>`;
        h += done ? `<button class="btn btn--gold" type="button" data-ds="gdone">Зберегти</button><button class="btn btn--line" type="button" data-ds="gundo">Зняти відмітку</button>`
          : `<button class="btn btn--gold" type="button" data-ds="gdone">Готово — тренування завершено</button>`;
        h += `<button class="btn btn--line" type="button" data-ds="gcopy">Скопіювати для тренера</button>
          <div class="dy-acts"><button class="btn btn--ghost" type="button" data-ds="gmore">Перенести / правити</button><button class="btn btn--ghost" type="button" data-ds="close">Закрити</button></div>`;
      }
    } else if (sh.mode === "journal") {
      const J = S.journal[sh.k] || {}, sent = !!J.sent;
      h += `<div class="gs-kicker">Сповідь · ${rel(sh.k)}, ${human(sh.k)}</div><div class="sheet__title dy-sht">${sent && !sh.edit ? "Сповідь прийнято" : "Як минув день?"}</div>`;
      if (sent && !sh.edit) {
        h += `${J.mood ? `<p class="dy-note">настрій: <b>${(MOODS.find((m) => m[0] === J.mood) || [])[1] || ""}</b>${(J.tags || []).length ? ` · ${J.tags.map((x) => JTAGS[x] || x).join(", ")}` : ""}</p>` : ""}
          <div class="gy-report">${esc((J.text || "").trim()).replace(/\n/g, "<br>") || "<i>без тексту</i>"}</div>
          <p class="dy-note">Писар прочитає це до наступного нічного запуску й зважить у дорученнях, подіях і листі-зведенні.</p>
          <button class="btn btn--line" type="button" data-ds="jedit">Доповнити</button>`;
      } else {
        h += `<div class="dy-f"><label>Настрій</label><div class="dy-chips dy-chips--wrap" data-dk="jmood">${MOODS.map(([v, n]) => `<button type="button" data-dv="${v}" class="${J.mood === v ? "is-on" : ""}">${n}</button>`).join("")}</div></div>
          <div class="dy-f"><label>Позначки</label><div class="dy-chips dy-chips--wrap" data-dk="jtag">${Object.entries(JTAGS).map(([v, n]) => `<button type="button" data-dv="${v}" class="${(J.tags || []).includes(v) ? "is-on" : ""}">${n}</button>`).join("")}</div></div>
          <textarea class="dy-in gy-text" id="jText" rows="10" placeholder="Що було сьогодні? Що вдалось, що ні, що відчуваєш? Пиши як є — це бачиш ти й писар.">${esc(J.text || "")}</textarea>
          <div class="gy-saved" id="jSaved">${J.at ? `збережено о ${clock(J.at)}` : "зберігається саме, можна закривати й повертатися"}</div>
          <button class="btn btn--gold" type="button" data-ds="jsend">${sent ? "Зберегти доповнення" : "Віддати сповідь"}</button>`;
      }
      const past = Object.keys(S.journal).filter((d) => d !== sh.k && jSent(d)).sort().reverse().slice(0, 7);
      if (past.length) h += `<div class="gs-h">Попередні сповіді</div><ul class="j-past">${past.map((d) => `<li data-jday="${d}"><b>${human(d)}</b><span>${esc(((S.journal[d].text || "").trim().split("\n")[0] || "").slice(0, 70))}</span></li>`).join("")}</ul>`;
      h += `<button class="btn btn--ghost" type="button" data-ds="close">Закрити</button>`;
    } else if (sh.mode === "night") {
      const N = S.night[sh.k] || {};
      if (sh.step === "breath") {
        const P = PATS[sh.pat || 478];
        h += `<div class="gs-kicker">Нічна варта</div><div class="sheet__title dy-sht">Дихання ${P.name}</div>
          <div class="nb"><div class="nb__orb" id="nbOrb"></div><div class="nb__t" id="nbT">вдих через ніс</div><div class="nb__n" id="nbN">4</div></div>
          <p class="dy-note">${P.note}</p>
          <button class="btn btn--ghost" type="button" data-ds="nbend">Досить, лягаю</button>`;
      } else if (sh.step === "rest") {
        h += `<div class="gs-kicker">Нічна варта</div><div class="sheet__title dy-sht">${N.parked ? "Тривога під замком" : "Тепер — спати"}</div>
          <p class="dy-note dy-note--t">${N.parked ? "Вранці я принесу її назад, і вирішимо на свіжу голову. Зараз з нею нічого не треба робити." : "Не дивись на годинник. Екран донизу."}</p>
          <button class="btn btn--gold" type="button" data-ds="close">Добраніч</button>`;
      } else {
        h += `<div class="gs-kicker">Нічна варта${N.at ? ` · ${N.at}` : ""}</div><div class="sheet__title dy-sht">${N.kind === "bug" ? "Що муляє?" : "Про що тривога?"}</div>
          <div class="dy-chips dy-chips--wrap" data-dk="ntopic">${Object.entries(TOPICS).map(([v, n]) => `<button type="button" data-dv="${v}" class="${N.topic === v ? "is-on" : ""}">${n}</button>`).join("")}</div>
          <textarea class="dy-in dy-in--note" id="nTxt" rows="2" placeholder="одним реченням — можна й пропустити">${esc(N.text || "")}</textarea>
          <p class="dy-note">Записане я покладу на ранок. Зараз з ним нічого не треба робити.</p>
          <button class="btn btn--gold" type="button" data-ds="npark">Покласти на ранок</button>
          <button class="btn btn--ghost" type="button" data-ds="nskip">Без запису — просто подихати</button>`;
      }
    } else if (sh.mode === "fix") {
      const t = S.tasks[sh.id], r = rec(sh.k, sh.id);
      h += `<div class="gs-kicker">Виконано з поправкою</div><div class="sheet__title dy-sht">${esc(t.t)}</div>
        <p class="dy-note">Що пішло не так, як планувалось? Зараховується 70% досвіду.</p>
        <textarea class="dy-in dy-in--note" id="dsF" rows="3" placeholder="наприклад: 30 хвилин замість години">${esc((r && r.note) || "")}</textarea>
        <button class="btn btn--gold" type="button" data-ds="fix">Зарахувати</button><button class="btn btn--ghost" type="button" data-ds="back">Назад</button>`;
    } else if (sh.mode === "move") {
      const k = sh.k, t1 = add(today(), 1), base = k < today() ? today() : k;
      const nextMon = add(base, 8 - wd(base));
      h += `<div class="gs-kicker">Перенести</div><div class="sheet__title dy-sht">${esc(S.tasks[sh.id].t)}</div>
        <div class="dy-acts dy-acts--col">
          ${k < today() ? `<button type="button" class="btn btn--line" data-dmv="${today()}">На сьогодні</button>` : ""}
          <button type="button" class="btn btn--line" data-dmv="${k < t1 ? t1 : add(k, 1)}">На ${k < t1 ? "завтра" : "наступний день"}</button>
          <button type="button" class="btn btn--line" data-dmv="${nextMon}">На понеділок, ${human(nextMon)}</button></div>
        <div class="dy-f dy-f--row"><label>Інша дата</label><input class="dy-in" id="dsM" type="date" min="${today()}" value=""></div>
        <button class="btn btn--ghost" type="button" data-ds="back">Назад</button>`;
    }
    el.innerHTML = h;
    const gt = $("gyText"); if (gt) gt.oninput = () => gyAutosave(gt.value);
    const jt = $("jText"); if (jt) jt.oninput = () => jAutosave(jt.value);
  }
  /* запис тренування зберігається з кожною літерою (з невеликою затримкою) */
  let gyT = 0;
  function gyAutosave(v) {
    if (!sh || sh.mode !== "gym") return;
    const wk = wKey(sh.k, sh.id), w = GYM.w[wk] = GYM.w[wk] || { start: Date.now() };
    w.text = v; w.at = Date.now();
    clearTimeout(gyT); gyT = setTimeout(() => { gyT = 0; saveG(); const s = $("gySaved"); if (s) s.textContent = `збережено о ${clock(w.at)}`; }, 400);
  }
  const gyFlush = () => { if (gyT) { clearTimeout(gyT); gyT = 0; saveG(); } };
  const el0 = () => $("dSheet");
  function readGym() {
    if (!sh || !sh.gym) return;
    el0().querySelectorAll(".gy-ex").forEach((box) => {
      const e = sh.gym.ex[+box.dataset.i]; if (!e) return;
      e.n = box.querySelector(".gy-n").value.trim();
      e.sets = [...box.querySelectorAll(".gy-set")].map((st) => ({ r: numIn(st.querySelector(".gy-r").value), w: numIn(st.querySelector(".gy-w").value) }));
    });
    const n = $("gyNote"); if (n) sh.gym.note = n.value.trim();
  }
  function readDraft() {
    const d = sh.draft, v = (id) => { const e = $(id); return e ? e.value : null; };
    if ($("dsT")) d.t = v("dsT").trim();
    if ($("dsN")) d.target = numIn(v("dsN"));
    if ($("dsU")) d.unit = v("dsU").trim();
    if ($("dsP")) d.step = numIn(v("dsP")) || 1;
    if ($("dsE")) d.rep.n = Math.max(1, Math.round(numIn(v("dsE")) || 1));
    if ($("dsD") && v("dsD")) d.start = v("dsD");
    if ($("dsH")) d.time = v("dsH") || "";
    if ($("dsO")) d.notes = v("dsO").trim();
    if ($("dsAN")) { d.app = Object.assign({}, appOf(d), { n: appKey(v("dsAN")) }); }
    if ($("dsAM")) { d.app = Object.assign({}, appOf(d), { min: Math.max(0, Math.round(numIn(v("dsAM")) || 0)) }); }
    if ($("dsBL")) { d.bank = d.bank || { cats: [], limit: 0 }; d.bank.limit = Math.max(0, Math.round((numIn(v("dsBL")) || 0) * 100)); }
  }
  function onSheetChange(e) {
    if (!sh) return;
    if (e.target.id === "dsM" && e.target.value) moveTo(e.target.value);
  }
  function moveTo(k2) {
    const id = sh.id, k = sh.k, before = totalXP();
    if (k2 === k) return;
    setRec(k, id, { st: "moved", to: k2 });
    setRec(k2, id, { from: k, st: null });
    buzz("light"); closeSheet(); after(before);
  }
  function onSheet(e) {
    if (!sh) return;
    const ch = e.target.closest("[data-dv]");
    if (ch && sh.mode === "journal") {
      const J = S.journal[sh.k] = S.journal[sh.k] || {}, tx = $("jText"), key = ch.parentElement.dataset.dk; if (tx) J.text = tx.value;
      if (key === "jmood") J.mood = J.mood === ch.dataset.dv ? null : ch.dataset.dv;
      if (key === "jtag") { const s2 = new Set(J.tags || []); s2.has(ch.dataset.dv) ? s2.delete(ch.dataset.dv) : s2.add(ch.dataset.dv); J.tags = [...s2]; }
      J.at = Date.now(); saveS(); buzz("light"); renderSheet(); return;
    }
    if (ch && sh.mode === "night") {
      const N = S.night[sh.k] = S.night[sh.k] || {}, tx = $("nTxt"); if (tx) N.text = tx.value.trim();
      N.topic = ch.dataset.dv; saveS(); buzz("light"); renderSheet(); return;
    }
    if (ch && sh.mode === "sleep") {
      const k = ch.parentElement.dataset.dk;
      if (k === "bed") { sh.bed = ch.dataset.dv; const b = $("slB"); if (b) b.value = sh.bed; }
      if (k === "q") sh.q = ch.dataset.dv;
      sh.wakeV = ($("slW") || {}).value; buzz("light"); renderSheet(); if (sh.wakeV && $("slW")) $("slW").value = sh.wakeV; return;
    }
    if (ch && sh.mode === "edit") {
      readDraft();
      const d = sh.draft, k = ch.parentElement.dataset.dk, v = ch.dataset.dv;
      if (k === "type") d.type = v;
      if (k === "rep") { d.rep = { f: v, n: 1 }; if (v === "week") d.rep.days = [wd(d.start)]; }
      if (k === "days") { const s = new Set(d.rep.days || []); const n = +v; s.has(n) ? s.delete(n) : s.add(n); d.rep.days = [...s].sort(); if (!d.rep.days.length) d.rep.days = [n]; }
      if (k === "diff") d.diff = v;
      if (k === "flags" && v === "gym") d.gym = !isGym(d);
      if (k === "src") {
        d.src = v; d.health = v === "steps" ? "steps" : null;
        if (v === "steps") { d.type = "count"; d.unit = d.unit || "кроків"; d.target = d.target || 10000; }
        if (v === "poker") { d.type = "count"; d.unit = /роздач/i.test(d.unit || "") ? d.unit : "роздач"; d.target = d.target || 1000; }
        if (v === "mind" || v === "bank" || v === "weight" || v === "journal") d.type = "do";
        if (v === "bank") d.bank = d.bank || { cats: [], limit: 0 };
        if (v === "app") d.app = Object.assign({}, appOf(d));
      }
      if (k === "alim") d.app = Object.assign({}, appOf(d), { lim: !!v });
      if (k === "bcat") { d.bank = d.bank || { cats: [], limit: 0 }; const c = new Set(d.bank.cats); c.has(v) ? c.delete(v) : c.add(v); d.bank.cats = [...c]; }
      buzz("light"); renderSheet(); return;
    }
    const jd = e.target.closest("[data-jday]"); if (jd && sh.mode === "journal") { jFlush(); sh.k = jd.dataset.jday; sh.edit = false; renderSheet(); return; }
    const mv = e.target.closest("[data-dmv]"); if (mv) { moveTo(mv.dataset.dmv); return; }
    const b = e.target.closest("[data-ds]"); if (!b) return;
    const a = b.dataset.ds, k = sh.k, id = sh.id, before = totalXP();
    if (a === "close") { closeSheet(); return; }
    if (a === "back") { sh.mode = "item"; renderSheet(); return; }
    if (a === "save") {
      readDraft(); const d = sh.draft;
      if (!d.t) { const i = $("dsT"); if (i) i.focus(); return; }
      if (d.type === "count" && !(d.target > 0)) { const i = $("dsN"); if (i) i.focus(); return; }
      if (srcOf(d) === "bank" && !(d.bank && d.bank.cats.length)) { toast("Обери хоча б одну категорію витрат"); return; }
      if (srcOf(d) === "app") { const a = appOf(d); if (!a.n) { const i = $("dsAN"); if (i) i.focus(); return; } if (!a.lim && !(a.min > 0) && d.type !== "count") { const i = $("dsAM"); if (i) i.focus(); return; } d.src = "app"; d.app = a; }
      const nid = sh.id || uid();
      S.tasks[nid] = Object.assign({}, d, { id: nid, mt: Date.now(), created: d.created || today() });
      saveS(); fx("yes"); buzz("medium"); closeSheet(); after(before); return;
    }
    if (a === "del") {
      const t = S.tasks[id]; if (!t) return;
      if (t.rep && t.rep.f !== "none" && t.start < today()) { t.end = add(today(), -1); t.mt = Date.now(); }        // історія лишається
      else t.del = Date.now();
      saveS(); buzz("medium"); closeSheet(); after(before); return;
    }
    if (a === "edit") { openSheet("edit", id, k); return; }
    if (a === "done") { setRec(k, id, { st: "done" }); fx("yes"); buzz("medium"); closeSheet(); after(before); if (isGym(S.tasks[id])) setTimeout(() => openSheet("gym", id, k), 500); return; }
    if (a === "undo") { setRec(k, id, { st: null, note: null }); buzz("light"); closeSheet(); after(before); return; }
    if (a === "fixq") { sh.mode = "fix"; renderSheet(); setTimeout(() => { const f = $("dsF"); if (f) f.focus(); }, 300); return; }
    if (a === "fix") { const n = ($("dsF") || {}).value || ""; setRec(k, id, { st: "fix", note: n.trim() || null }); fx("yes"); buzz("medium"); closeSheet(); after(before); if (isGym(S.tasks[id])) setTimeout(() => openSheet("gym", id, k), 500); return; }
    if (a === "gym") { openSheet("gym", id, k); return; }
    if (a === "slsave" || a === "slskip") {
      const t0 = today();
      if (a === "slskip") S.sleep[t0] = { skip: 1 };
      else {
        const bed = ($("slB") || {}).value || sh.bed || "", wake = ($("slW") || {}).value || S.wake[t0] || "";
        const toMin = (x) => { const [hh, mm] = x.split(":").map(Number); return hh * 60 + mm; };
        let min = bed && wake ? toMin(wake) - toMin(bed) : 0; if (min <= 0) min += 1440;
        S.sleep[t0] = { bed, wake, q: sh.q ? +sh.q : null, min: bed && wake && min < 16 * 60 ? min : null };
        fx("yes"); buzz("medium");
      }
      saveS(); closeSheet(); after(before); setTimeout(scenes, 900); return;
    }
    if (a === "goals") { closeSheet(); const A = API(); if (A.showTab) setTimeout(() => A.showTab("goals"), 300); return; }
    if (a === "gsave") { readGym(); const g = sh.gym; g.ex = g.ex.filter((e) => e.n && e.sets.some((x) => x.r)); g.at = Date.now();
      if (g.ex.length) GYM.log[k] = g; else delete GYM.log[k]; saveG(); fx("yes"); buzz("medium"); closeSheet(); after(before); return; }
    if (a === "jsend") {
      jFlush(); const J = S.journal[k] = S.journal[k] || {}, tx = $("jText"); if (tx) J.text = tx.value;
      if (!(J.text || "").trim() && !J.mood) { const t2 = $("jText"); if (t2) t2.focus(); return; }
      const first = !J.sent; J.sent = J.sent || Date.now(); J.at = Date.now(); saveS();
      applyJournal(); if (first) fx("yes"); buzz("medium"); sh.edit = false;
      after(before); writerSync(true); confessStatus(); renderSheet(); return;
    }
    if (a === "early") { closeSheet(); earlyDone(id, k); return; }
    if (a === "jedit") { sh.edit = true; renderSheet(); return; }
    if (a === "npark" || a === "nskip") {
      const N = S.night[k] = S.night[k] || {}, tx = $("nTxt");
      if (a === "npark") { N.text = tx ? tx.value.trim() : N.text || ""; N.parked = 1; }
      saveS(); sh.step = "breath"; renderSheet(); breathe(); return;
    }
    if (a === "nbend") { clearInterval(nbTimer); nightRest(1); return; }
    if (a === "gdone" || a === "gundo") {
      gyFlush(); readGym();
      const t = S.tasks[id], wk = wKey(k, id), w = GYM.w[wk] = GYM.w[wk] || { start: Date.now() }, gt = $("gyText");
      if (gt) { w.text = gt.value; w.at = Date.now(); }
      if (sh.gym) { const g = sh.gym; g.ex = g.ex.filter((e) => e.n && e.sets.some((x) => x.r)); g.at = Date.now(); if (g.ex.length) GYM.log[k] = g; else if (GYM.log[k] && sh.table) delete GYM.log[k]; }
      const wasDone = !!(t && isWin(stOf(t, rec(k, id), k)));
      if (a === "gundo") { w.fin = null; setRec(k, id, { st: null, note: null }); saveG(); buzz("light"); after(before); renderSheet(); return; }
      w.fin = w.fin || Date.now(); saveG();
      if (!wasDone) { setRec(k, id, { st: "done" }); fx("yes"); buzz("medium"); }
      after(before); sh.fin = true; renderSheet(); return;
    }
    if (a === "gtable") { sh.table = true; renderSheet(); return; }
    if (a === "gmore") { gyFlush(); openSheet("item", id, k); return; }
    if (a === "gcopy") {
      gyFlush(); readGym();
      const wt = (GYM.w[wKey(k, id)] || {}).text || "", tb = sh.gym && (GYM.log[k] || gymSig(sh.gym) !== sh.gymTpl) ? JSON.parse(JSON.stringify(sh.gym)) : { ex: [], note: "" };
      const t0 = S.tasks[id], txt = gymText(Object.assign({ k }, tb, { text: wt.trim() ? `${t0 ? t0.t + ": " : ""}${wt.trim()}` : "" }));
      const ask = () => prompt("Скопіюй і встав у чат:", txt);
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { b.textContent = "Скопійовано — встав у чат із тренером"; buzz("light"); }, ask); else ask();
      return;
    }
    if (a === "gadd") { readGym(); sh.gym.ex.push({ n: "", sets: [{ r: null, w: null }] }); renderSheet(); setTimeout(() => { const i = el0().querySelectorAll(".gy-n"); if (i.length) i[i.length - 1].focus(); }, 50); return; }
    if (a === "gset") { readGym(); const e = sh.gym.ex[+b.dataset.i]; const l = e.sets[e.sets.length - 1] || {}; e.sets.push({ r: l.r, w: l.w }); renderSheet(); return; }
    if (a === "gdel") { readGym(); sh.gym.ex.splice(+b.dataset.i, 1); renderSheet(); return; }
    if (a === "cur" || a === "part") {
      const c = numIn(($("dsC") || {}).value); setRec(k, id, { cur: c == null ? (rec(k, id) || {}).cur || 0 : Math.max(0, c), st: a === "part" ? "part" : null });
      buzz("medium"); closeSheet(); after(before); return;
    }
    if (a === "move") { sh.mode = "move"; renderSheet(); return; }
    if (a === "cancel") { setRec(k, id, { st: "cancel" }); buzz("light"); closeSheet(); after(before); return; }
    if (a === "uncancel") { setRec(k, id, { st: null }); buzz("light"); closeSheet(); after(before); return; }
  }

  /* ------------------------------------------------------------ кліки ------ */
  /* перемикання днів одразу на дотик: на iPhone «клік» інколи не доходить; повторний клік після дотику ігноруємо */
  let navTapAt = 0;
  function goDay(nv) {
    if (nv.dataset.dday) view = nv.dataset.dday;
    else { const n = +nv.dataset.dnav; view = n === 0 ? today() : add(view || today(), n); }
    buzz("light"); renderSoon();
  }
  let rq = 0;
  const renderSoon = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); };      // кілька швидких тапів — один показ
  function onBodyTouch(e) {
    const nv = e.target.closest && e.target.closest("[data-dnav], [data-dday]"); if (!nv || e.pointerType === "mouse") return;
    navTapAt = Date.now(); e.preventDefault(); goDay(nv);
  }
  function onBody(e) {
    if (e.target.closest("[data-hsync]")) { phoneSync(); return; }
    const nv0 = e.target.closest("[data-dnav], [data-dday]");
    if (nv0) { if (Date.now() - navTapAt > 700) goDay(nv0); return; }
    const g = e.target.closest("[data-dgo]"); if (g) { const A = API(); if (A.showTab) A.showTab("stats"); return; }
    const nv = e.target.closest("[data-dnav]");
    if (nv) { const n = +nv.dataset.dnav; view = n === 0 ? today() : add(view || today(), n); buzz("light"); render(); return; }
    const mk = e.target.closest("[data-dmark]"); if (mk) { mark(mk.dataset.dmark, view); return; }
    const pl = e.target.closest("[data-dplus]"); if (pl) { plus(pl.dataset.dplus, view); return; }
    const qd = e.target.closest("[data-dqdone]"); if (qd) { qDone(qd.dataset.dqdone); return; }
    const qp = e.target.closest("[data-dqplus]"); if (qp) { qPlus(qp.dataset.dqplus); return; }
    const nw = e.target.closest("[data-dnew]"); if (nw) { openSheet("edit", null, view); return; }
    const op = e.target.closest("[data-dopen]"); if (op) { const t = S.tasks[op.dataset.dopen]; if (srcOf(t) === "journal" && (view || today()) <= today()) { openJournal(view); return; } openSheet(isGym(t) && (view || today()) <= today() ? "gym" : "item", op.dataset.dopen, view); return; }
    const q = e.target.closest("[data-dq]"); if (q) { qSheet(q.dataset.dq); }
  }
  /* квест: шторка з подробицями */
  function qSheet(id) {
    const q = Q.list.find((x) => x.id === id); if (!q) return;
    const el = sheetEl(); sh = { mode: "quest", id };
    const left = q.until ? diff(today(), q.until) : 0;
    el.innerHTML = `<div class="sheet__grip"></div><div class="gs-kicker dy-kick--${q.rar}">${RAR[q.rar].n} квест</div><div class="sheet__title dy-sht">${esc(q.t)}</div>
      ${q.desc ? `<p class="dy-note">${esc(q.desc)}</p>` : ""}
      <div class="sheet__stat">${q.st === "active" ? (left <= 0 ? "сьогодні останній день" : `до ${human(q.until)}`) : q.st === "done" ? "виконано" : ""} · +${q.xp} досвіду</div>
      ${q.st === "active" && q.type === "count" ? `<div class="dy-f dy-f--row dy-f--cur"><label>Зараз</label><input class="dy-in dy-in--n" id="dqC" inputmode="decimal" value="${q.cur || 0}"><span class="dy-unit">/ ${fmtN(q.target)} ${esc(q.unit || "")}</span></div>` : ""}
      ${q.st === "active" && q.until && window.ORDO_GOLD && window.ORDO_GOLD.can("extend") ? `<button class="btn btn--line" type="button" data-dqs="ext">Відстрочка +1 день ⏳</button>` : ""}
      ${q.st === "active" ? `<div class="dy-acts">${q.type === "count" ? `<button class="btn btn--gold" type="button" data-dqs="cur">Записати</button>` : `<button class="btn btn--gold" type="button" data-dqs="done">Виконано</button>`}
        <button class="btn btn--ghost" type="button" data-dqs="drop">Відмовитись</button></div>` : ""}
      <button class="btn btn--ghost" type="button" data-dqs="close">Закрити</button>`;
    el.onclick = (e) => {
      const b = e.target.closest("[data-dqs]"); if (!b) return; e.stopPropagation();
      const a = b.dataset.dqs;
      if (a === "close") { closeSheet(); el.onclick = null; return; }
      if (a === "done") { closeSheet(); el.onclick = null; qDone(q.id); return; }
      if (a === "cur") { const c = numIn(($("dqC") || {}).value); if (c != null) { q.cur = Math.max(0, c); q.at = Date.now(); if (q.target && q.cur >= q.target) { closeSheet(); el.onclick = null; qDone(q.id); return; } saveQ(); } closeSheet(); el.onclick = null; render(); return; }
      if (a === "ext") { if (window.ORDO_GOLD.use("extend")) { q.until = add(q.until, 1); q.at = Date.now(); saveQ(); fx("yes"); toast(`квест — до <b>${human(q.until)}</b>`); } closeSheet(); el.onclick = null; render(); return; }
      if (a === "drop") { q.st = "declined"; q.at = Date.now(); saveQ(); buzz("light"); closeSheet(); el.onclick = null; render(); }
    };
    fx("open"); buzz("light");
    const sc = $("scrim"); if (sc) sc.classList.add("open");
    requestAnimationFrame(() => el.classList.add("open"));
  }

  /* ============================================ ЛІТОПИС: звитяга й нагороди === */
  function gloryHTML() {
    const lv = levelOf(totalXP()), p = Math.min(1, (lv.xp - lv.from) / (lv.to - lv.from));
    const last14 = []; for (let i = 13; i >= 0; i--) { const k = add(today(), -i); last14.push({ k, xp: Object.values(X.e).filter((e) => e.d === k).reduce((a, e) => a + e.xp, 0) }); }
    const mx = Math.max(50, ...last14.map((x) => x.xp));
    const qn = (r) => Q.list.filter((q) => q.st === "done" && q.rar === r).length;
    const vowMedals = (D().VOWS || []).map((v) => { const s = API().streak ? API().streak(v) : 0; const tiers = [30, 90, 180, 365].filter((n) => s >= n); return tiers.length ? { v, n: tiers[tiers.length - 1] } : null; }).filter(Boolean);
    let h = `<section class="st-sec dy-glory"><div class="st-h">Звитяга</div>
      <div class="dy-g__top">${emblem(lv.ri, "em--big")}<div><b class="dy-g__rank">${esc(lv.rank.name)}</b><span class="dy-g__lv">рівень ${lv.L} · ${fmtN(lv.xp)} досвіду</span>
        <div class="dy-rank__bar"><i style="width:${Math.round(p * 100)}%"></i></div>
        <span class="dy-g__next">до ${lv.L + 1}-го рівня — ${fmtN(lv.to - lv.xp)}${lv.next ? ` · звання «${esc(lv.next.name)}» з ${lv.next.lv}-го` : ""}</span></div></div>
      <div class="dy-g__bars" aria-label="Досвід за 14 днів">${last14.map((x) => `<i style="height:${Math.round(4 + 40 * x.xp / mx)}px" title="${human(x.k)}: ${x.xp}"></i>`).join("")}</div>
      <div class="dy-g__qs"><span class="dy-q--rare"><b>${qn("rare")}</b>рідкісних</span><span class="dy-q--legend"><b>${qn("legend")}</b>легендарних</span><span class="dy-q--myth"><b>${qn("myth")}</b>міфічних</span></div>
      ${(() => { const f = faith(); return `<div class="dy-g__qs dy-g__faith"><span><b>${f.total}</b>днів вірності</span><span><b>${f.d30}/${f.n30}</b>за 30 днів</span><span><b>${f.best}</b>найдовше поспіль</span></div>`; })()}
      <div class="st-h st-h--sub">Нагороди</div><div class="dy-ach">`;
    h += ACHS.map((a) => `<div class="dy-a${ACH[a.id] ? " is-on" : ""} tier-${ACH[a.id] ? a.tier || "gold" : "ash"}" title="${esc(a.h)}"><svg><use href="#medal"/></svg><b>${esc(a.n)}</b><span>${ACH[a.id] ? human(ACH[a.id]) : esc(a.h)}</span></div>`).join("");
    h += vowMedals.map((m) => `<div class="dy-a is-on dy-a--vow"><svg><use href="#i-${m.v.icon}"/></svg><b>${esc(m.v.name)} · ${m.n}</b><span>печатка обітниці</span></div>`).join("");
    h += `</div><div class="st-h st-h--sub">Шлях звань</div><ol class="dy-ranks">${RANKS.map((r, i) => `<li class="${i < lv.ri ? "is-past" : i === lv.ri ? "is-on" : ""}">${emblem(i)}<b>${esc(r.name)}</b><span>з ${r.lv}-го</span></li>`).join("")}</ol>`;
    const done = Q.list.filter((q) => q.st === "done").slice(-6).reverse();
    if (done.length) h += `<div class="st-h st-h--sub">Хроніка квестів</div><ul class="dy-qlog">${done.map((q) => `<li class="dy-q--${q.rar}"><b>${esc(q.t)}</b><span>${human(q.end)} · +${q.xp}</span></li>`).join("")}</ul>`;
    return h + `</section>`;
  }
  function renderStatsIfOpen() { const A = API(); if (A.tab && A.tab() === "stats" && A.renderStats) A.renderStats(); }

  /* ============================================================ ПИСАР ====== */
  /* зведення для нічного писаря: що відбувається в житті Ордену (шифрується ключем сховища) */
  function writerState() {
    const A = API(), t0 = today(), vows = D().VOWS || [], LOG = LS.get("ordo.log", []), lv = levelOf(totalXP());
    const since = (n) => add(t0, -n), days14 = []; for (let i = 13; i >= 0; i--) days14.push(add(t0, -i));
    /* виконання за 2 тижні — з тих самих справ дня, що й у списку (перенесені рахуються там, де зроблені) */
    const rate = (t) => { let o = 0, w = 0; days14.forEach((k) => { if (k > t0) return; const x = items(k).find((y) => y.t.id === t.id); if (!x) return; const st = stOf(t, x.r, k); if (st === "moved" || st === "cancel") return; o++; if (isWin(st)) w++; }); return o ? `${w}/${o}` : null; };
    const G = LS.get("ordo.goals", { y: {}, m: {} }), mk = t0.slice(0, 7), yk = t0.slice(0, 4);
    const goals = (P) => P ? (P.items || []).map((it) => ({ t: it.t, type: it.type || "once", done: !!it.done, cur: it.cur, target: it.target })) : [];
    const T = window.ORDO_TREASURY;
    return {
      at: new Date().toISOString(), today: t0, weekday: WDL[wd(t0)],
      rank: { name: lv.rank.name, level: lv.L, xp: lv.xp, toNext: lv.to - lv.xp },
      xp7: days14.slice(-7).map((k) => ({ d: k, xp: Object.values(X.e).filter((e) => e.d === k).reduce((a, e) => a + e.xp, 0) })),
      vows: vows.map((v) => ({ id: v.id, name: v.name, streak: A.streak ? A.streak(v) : null, start: (LS.get("ordo.starts", {})[v.id]) || v.start, best: (LS.get("ordo.best", {})[v.id]) || null })),
      breaches30: LOG.filter((e) => e.k === "breach" && e.d >= since(30)).map((e) => ({ v: e.v, d: e.d, why: e.why || "" })),
      calls30: LOG.filter((e) => e.k === "call" && e.d >= since(30)).map((e) => ({ v: e.v, d: e.d, st: e.st })),
      tasks: Object.values(S.tasks).filter((t) => !t.del && (!t.end || t.end >= t0)).map((t) => ({ t: t.t, type: t.type, target: t.target, unit: t.unit, rep: repText(t) || "раз", time: t.time || "", gym: isGym(t), rate14: rate(t),
        auto: srcOf(t) ? SRC[srcOf(t)] + (srcOf(t) === "app" ? ` ${appOf(t).n} ${appOf(t).lim ? "≤" : "≥"} ${appOf(t).min} хв` : "") : null })),
      apps: days14.map((k) => { const h = hDay(k) || {}, o = {}; Object.entries(h.apps || {}).forEach(([n, a]) => { if (a.min >= 1) o[n] = Math.floor(a.min); }); return Object.keys(o).length ? Object.assign({ d: k }, o) : null; }).filter(Boolean),
      perfectDays14: days14.filter((k) => perfect(k)).length,
      quests: Q.list.slice(-25).map((q) => ({ pid: q.pid, rar: q.rar, giver: q.giver, t: q.t, st: q.st, from: q.from || q.offerOn, until: q.until, cur: q.cur, target: q.target })),
      achievements: Object.keys(ACH),
      goals: { month: goals(G.m && G.m[mk]), year: goals(G.y && G.y[yk]) },
      gym: sessions().slice(-6).map((x) => ({ d: x.k, ex: x.ex.map((e) => `${e.n} ${e.sets.map((z) => `${z.r || "?"}×${z.w || 0}`).join(",")}`), note: x.note || "", text: (x.text || "").slice(0, 500) })),
      steps: { month: periodSteps(t0.slice(0, 7)), year: periodSteps(t0.slice(0, 4)) },
      faith: Object.assign(faith(), { comeback: comeback() }),
      weight: { last: weightOn(t0, "last"), avg7: weightOn(t0, "avg7") },
      journal: Object.keys(S.journal).filter((k) => k >= since(14) && jSent(k)).sort().map((k) => { const J = S.journal[k]; return { d: k, mood: J.mood ? +J.mood : null, tags: J.tags || [], text: (J.text || "").trim().slice(0, 1500) }; }),
      nights: Object.keys(S.night).filter((k) => k >= since(14)).sort().map((k) => { const N = S.night[k]; return { d: k, at: N.at, kind: N.kind || "", topic: N.topic || "", text: (N.text || "").slice(0, 140), dealt: N.dealt || "" }; }),
      poker: { days: days14.map((k) => Object.assign({ d: k }, pDay(k) || {})).filter((x) => x.hands), month: periodHands(t0.slice(0, 7)), year: periodHands(t0.slice(0, 4)) },
      health: days14.map((k) => ({ d: k, steps: (hDay(k) || {}).steps, sleepMin: (hDay(k) || {}).sleepMin, weight: (hDay(k) || {}).weight, up: S.wake[k] || null, feel: (S.sleep[k] || {}).q || null })).filter((x) => x.steps != null || x.sleepMin || x.up),
      bank: T && T.ready() ? { week: T.spentIn("*", since(7), t0), prevWeek: T.spentIn("*", since(14), since(8)), courier7: T.spentIn(["courier"], since(7), t0), verdicts: LS.get("ordo.bank", {}).seen || {} } : null,
      seenEvents: Object.keys(S.ev || {})
    };
  }
  let wAt = LS.get("ordo.k.writerAt", 0);
  async function writerSync(force) {
    const V = window.ORDO_VAULT; if (!V || !V.writeSealed || (!force && Date.now() - wAt < 6 * 3600e3)) return;
    try { if (await V.writeSealed("writer/state.json", writerState(), "писар: стан Ордену")) { wAt = Date.now(); LS.set("ordo.k.writerAt", wAt); } } catch (e) {}
  }
  /* те, що написав писар: нові квести (у пул), репліки храмовників, листи, події-сцени */
  let DROP = LS.get("ordo.k.drop", null), dAt = 0;
  function applyDrop() {
    if (!DROP) return;
    const K = D().KEEPERS || {};
    Object.entries(DROP.lines || {}).forEach(([id, ls]) => { const k = id === "seneschal" ? null : K[id]; if (k && Array.isArray(ls)) { k.lines = k.lines || []; ls.forEach((l) => { if (!k.lines.includes(l)) k.lines.push(l); }); } });
    if (Array.isArray(DROP.letters) && D().LETTERS) DROP.letters.forEach((l) => { if (!D().LETTERS.some((x) => x.id === l.id)) D().LETTERS.push(l); });
  }
  async function loadDrop() {
    const V = window.ORDO_VAULT; if (!V || !V.readSealed || Date.now() - dAt < 30 * 60e3) return;
    dAt = Date.now();
    try { const d = await V.readSealed("writer/drop.json"); if (d && d.at !== (DROP && DROP.at)) { DROP = d; LS.set("ordo.k.drop", d); applyDrop(); } } catch (e) {}
  }
  async function eventScene() {
    const h = H(); if (!h || !DROP || !Array.isArray(DROP.events)) return true;
    S.ev = S.ev || {};
    const ev = DROP.events.find((e) => e.on <= today() && (!e.until || e.until >= today()) && !S.ev[e.id] && e.n && e.n.length);
    if (!ev) return true;
    S.ev[ev.id] = today(); saveS();
    h.stage(ev.giver || "supreme", ev.glow ? { glow: ev.glow } : {});
    return h.runDialog({ n: ev.n });
  }

  /* ============================================================ СТАРТ ====== */
  let started = false;
  function init() {
    if (started) return; started = true;
    loadState();
    const box = $("dayBody"); if (box) { box.addEventListener("click", onBody); box.addEventListener("pointerup", onBodyTouch); }
    const sc = $("scrim"); if (sc) sc.addEventListener("click", () => { if (sh) closeSheet(); });
    const seed = (D().DAY || {}).seed;
    if (seed && seed.tasks && S.seeded !== seed.v) {
      seed.tasks.forEach((t) => { if (!S.tasks[t.id]) S.tasks[t.id] = Object.assign({ diff: "normal", rep: { f: "none" }, created: today() }, t, { mt: Date.now() }); });
      S.seeded = seed.v; saveS();
    }
    appMigrate();
    /* «Monthly review» — разом із ревю місяця, зранку 1-го (раніше — останній день місяця) */
    const mr = S.tasks["rm-monthly-review"];
    if (mr && mr.rep && mr.rep.f === "mlast" && !(S.mig && S.mig.mr1)) { mr.rep = { f: "month", n: 1 }; mr.start = "2026-11-01"; mr.mt = Date.now(); S.mig = Object.assign({}, S.mig, { mr1: 1 }); saveS(); }
    /* квести повернення, прийняті до виправлення, рахували й день зриву — зсуваємо на день уперед */
    Q.list.forEach((q) => { if (q.st === "active" && !q.shifted && !q.cur && q.from === (q.offerOn || q.from) && ((pool().find((p) => p.id === q.pid) || {}).tags || []).includes("return")) {
      q.from = add(q.from, 1); q.until = add(q.until, 1); q.shifted = 1; q.at = Date.now(); saveQ(); } });
    lastLevel = levelOf(totalXP());
    carryOver(); applyHealth(); applyPoker(); applyBank(); applyJournal(); settle(); lastLevel = levelOf(totalXP());
    if (window.ORDO_GOLD) window.ORDO_GOLD.tick();
    const cb2 = $("confessBtn"); if (cb2) cb2.addEventListener("click", () => openJournal(today())); confessStatus();
    render(); loadHealth(true); loadPoker(true); applyDrop(); loadDrop(); setTimeout(writerSync, 8000); setTimeout(stamp, 1200);
    let day = today();
    setInterval(() => { if (today() !== day) { if (view === day) view = today(); day = today(); carryOver(); applyHealth(); settle(); render(); } }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { carryOver(); confessStatus(); stamp(); loadHealth(); afterPhoneSync(); loadPoker(); loadDrop(); settle(); render(); setTimeout(scenes, 1500); } else writerSync(); });
    setTimeout(scenes, 2500);
  }
  /* перше відкриття дня = підйом; до 8:00 — питаємо, як спав (після ритуалу, коли нічого не відкрито) */
  function stamp() {
    const n = new Date(), hm = `${p2(n.getHours())}:${p2(n.getMinutes())}`, t0 = today();
    if (!S.wake[t0] && hm >= DAWN && !isNight()) { S.wake[t0] = hm; saveS(); }
    if (early(t0) && !S.sleep[t0]) morning(Date.now());
  }
  function morning(t0) {
    const busy = () => { const i = $("intro"); return (i && !i.hasAttribute("hidden")) || document.querySelector(".rite.open, .sheet.open, .confirm.open, .kc, .hall.open"); };
    if (S.sleep[today()] || Date.now() - t0 > 15 * 60e3) return;
    if (busy()) { setTimeout(() => morning(t0), 1500); return; }
    openSheet("sleep", null, today());
  }
  function shown() { settle(); render(); setTimeout(scenes, 700); }

  window.ORDO_DAY = { init, shown, render, gloryHTML, trigger, scenes, levelOf: () => levelOf(totalXP()), emblem, isNight, faithCount, journalCount, openJournal, periodSteps, periodHands, periodMind, linkables, linkCount, weightOn, bankSync: () => { applyBank(); render(); },
    _state: () => ({ S, Q, X, ACH }), _writer: writerState };
})();
