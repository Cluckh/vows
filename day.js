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
  const MG = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  const human = (k) => { const d = dt(k); return `${d.getDate()} ${MG[d.getMonth()]}`; };
  const rel = (k) => { const n = diff(today(), k); return n === 0 ? "Сьогодні" : n === -1 ? "Вчора" : n === 1 ? "Завтра" : n === 2 ? "Післязавтра" : n === -2 ? "Позавчора" : `${WDL[wd(k)].replace(/^./, (c) => c.toUpperCase())}`; };
  /* детермінований «кидок кубика» на день — однаковий на всіх пристроях */
  const roll = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  /* ============================================================ СТАН ======= */
  const XP_START_DAY = "2026-10-26";       // з цього дня рахується досвід; усе раніше — у стартовому
  const START_XP = 4650;                    // посвята: рівень 7, звання «Лицар»
  let S = LS.get("ordo.day", null); if (!S || typeof S !== "object") S = {};
  S.tasks = S.tasks || {}; S.log = S.log || {}; S.wake = S.wake || {}; S.sleep = S.sleep || {};
  let Q = LS.get("ordo.quests", null); if (!Q || typeof Q !== "object") Q = {};
  Q.list = Q.list || []; Q.clock = Q.clock || {}; Q.trig = Q.trig || [];
  let X = LS.get("ordo.xp", null); if (!X || typeof X !== "object") X = {};
  X.e = X.e || {};
  let ACH = LS.get("ordo.ach", {}) || {};
  let HL = LS.get("ordo.k.health", null);                   // кроки й сон зі «Здоровʼя» (лише на пристрої; джерело — приватний репозиторій)
  let GYM = LS.get("ordo.gym", null) || {}; GYM.log = GYM.log || {};
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

  /* ========================================================== ЗДОРОВʼЯ ===== */
  /* день: кроки зі «Здоровʼя» + сон, записаний уранці в додатку, + час першого відкриття (підйом) */
  const hDay = (k) => {
    const h = Object.assign({}, (HL && HL.days && HL.days[k]) || {}), sl = S.sleep[k];
    if (sl && sl.min && !h.sleepMin) h.sleepMin = sl.min;
    if (S.wake[k]) h.up = S.wake[k];
    return Object.keys(h).length ? h : null;
  };
  const EARLY = "08:00", DAWN = "04:00";
  const early = (k) => !!(S.wake[k] && S.wake[k] >= DAWN && S.wake[k] < EARLY);
  let hAt = 0;
  async function loadHealth(force) {
    const V = window.ORDO_VAULT; if (!V || !V.readSealed || (!force && Date.now() - hAt < 5 * 60e3)) return;
    hAt = Date.now();
    try { const h = await V.readSealed("health/log.json"); if (h && h.at !== (HL && HL.at)) { HL = h; LS.set("ordo.k.health", h); applyHealth(); render(); } } catch (e) {}
  }
  /* кроки з телефона — у лічильники з позначкою «кроки» і в квести на кроки */
  function applyHealth() {
    if (!HL || !HL.days) return;
    let ch = false;
    for (let k = add(today(), -6); k <= today(); k = add(k, 1)) {
      const h = hDay(k); if (!h || h.steps == null) continue;
      items(k).forEach(({ t, r }) => { if (t.health === "steps" && (!r || (r.cur || 0) < h.steps) && !(r && (r.st === "moved" || r.st === "cancel"))) { setRec(k, t.id, { cur: h.steps, auto: 1 }); ch = true; } });
    }
    Q.list.forEach((q) => {
      if (q.st !== "active" || q.type !== "count" || !/крок/i.test(q.unit || "")) return;
      let sum = 0; for (let k = q.from; k <= (q.until < today() ? q.until : today()); k = add(k, 1)) sum += (hDay(k) || {}).steps || 0;
      if (sum > (q.cur || 0)) { q.cur = sum; q.at = Date.now(); ch = true; if (q.target && q.cur >= q.target) { q.st = "done"; q.end = today(); pendingDone.push(q); } }
    });
    if (ch) { saveQ(); const before = totalXP(); settle(); if (totalXP() > before) toast(`<b>+${totalXP() - before}</b> досвіду`); }
  }
  const hm = (min) => `${Math.floor(min / 60)} год ${p2(min % 60)} хв`;

  /* ================================================================ ЗАЛ ===== */
  const isGym = (t) => !!(t && (t.gym || /(^|[^а-яіїєґ])зал([^а-яіїєґ]|$)|тренуван|gym/i.test(t.t || "")));
  function sessions() { return Object.keys(GYM.log).sort().map((k) => Object.assign({ k }, GYM.log[k])).filter((x) => x.ex && x.ex.length); }
  /* порада на наступний зал: прогресія ваги/повторів і черговість вправ */
  function gymAdvice(k) {
    const ss = sessions().filter((x) => x.k < k); if (!ss.length) return null;
    const last = ss[ss.length - 1], prev = ss[ss.length - 2];
    const names = (x) => x.ex.map((e) => e.n.toLowerCase());
    let rot = null;
    if (prev && !names(last).some((n) => names(prev).includes(n))) rot = prev;              // спліт: минулого разу інші вправи → черга попередніх
    const base = rot || last, tips = [];
    base.ex.slice(0, 4).forEach((e) => {
      const sets = (e.sets || []).filter((x) => x.r), w = Math.max(0, ...sets.map((x) => x.w || 0)), minR = Math.min(...sets.map((x) => x.r));
      if (!sets.length) return;
      if (w && minR >= 10) tips.push(`${e.n}: ${fmtN(w + 2.5)} кг`);
      else if (w && minR >= 6) tips.push(`${e.n}: ${fmtN(w)} кг, на повтор більше`);
      else if (w) tips.push(`${e.n}: ${fmtN(w)} кг, дотисни техніку`);
      else tips.push(`${e.n}: ${minR + 1}+ повторів`);
    });
    const L = (D().DAY || {}).gym || {};
    const head = rot ? fill(pick(L.rotate) || "Минулого разу було інше. Сьогодні черга {day}.", { day: human(rot.k) }) : fill(pick(L.again) || "Минулого разу ({day}) ти взяв своє. Тиснемо далі.", { day: human(last.k) });
    return { giver: L.giver || "supreme", head, tips };
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
    Object.keys(X.e).forEach((id) => { if (/^(v|vm|g|gm|pd|sl|st|gy|er):/.test(id)) delete X.e[id]; });
    const vows = D().VOWS || [], starts = LS.get("ordo.starts", {});
    if (A.dayState) for (let k = XP_START_DAY; k < t0; k = add(k, 1)) vows.forEach((v) => {
      const s = A.dayState(v, k); if ((s === "c" || s === "w") && (!starts[v.id] || k >= starts[v.id])) X.e[`v:${v.id}:${k}`] = { d: k, xp: VOW_DAY, src: "vow", why: v.name };
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
      const g = GYM.log[k]; if (g && g.ex && g.ex.length) X.e[`gy:${k}`] = { d: k, xp: 20, src: "body", why: "журнал залу" };
      if (early(k)) X.e[`er:${k}`] = { d: k, xp: 5, src: "body", why: "ранній підйом" };
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
    return { gym: sessions().length, done, early, pdBest, pdN: Object.keys(X.e).filter((i) => i.startsWith("pd:")).length, chainBest, qd, lv: levelOf(totalXP()).L };
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
  function draw(rar, tag) {
    const seen = new Set(Q.list.map((q) => q.pid)), can = (p) => p.type !== "budget" || (T() && T().ready() && (!p.limitPct || T().avgWeek(p.cats)));
    let c = pool().filter((p) => p.rar === rar && can(p) && !seen.has(p.id) && (!tag || (p.tags || []).includes(tag)));
    if (!c.length) c = pool().filter((p) => p.rar === rar && can(p) && !Q.list.some((q) => q.pid === p.id && (q.st === "active" || q.st === "offer")));
    if (!c.length) return null;
    const p = c[Math.floor(roll(today() + rar + Q.list.length) * c.length)];
    return { id: uid(), pid: p.id, rar, giver: p.giver || "supreme", t: p.t, desc: p.desc || "", scope: p.scope || "day", days: p.days || 0,
      type: p.type === "count" || p.type === "budget" ? p.type : "do", target: p.target || null, unit: p.unit || "", xp: p.xp || RAR[rar].xp,
      cats: p.cats || null, limitPct: p.limitPct || 0, limit: p.limit || 0,
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
    const trig = Q.trig.shift();
    let rar = null;
    if (trig) rar = trig;
    else if (again) rar = null;
    else if (since("myth") >= 21 && roll(t0 + "m") < 0.1) rar = "myth";
    else if (since("legend") >= 7 && roll(t0 + "l") < 0.25) rar = "legend";
    else if (since("rare") >= 2 && roll(t0 + "r") < 0.4) rar = "rare";
    if (rar) { const q = draw(rar); if (q) { Q.list.push(q); Q.clock[rar] = t0; } }
    saveQ();
  }
  function trigger(rar) { if (!Q.trig.includes(rar)) { Q.trig.push(rar); saveQ(); } }

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
    const i = await h.choose(questCard(q), ["Приймаю", "Не цього разу"], "hall__acts--row");
    if (i === "closed") return false;
    if (i === 0) {
      q.st = "active"; q.from = today(); q.until = untilFor(q.scope, q.from, q.days); q.at = Date.now();
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
      <em class="dy-rank__n">${fmtN(lv.xp - lv.from)} / ${fmtN(lv.to - lv.from)}</em></button>`;
  }
  function metaOf(t, r, k) {
    const bits = [];
    if (t.time) bits.push(t.time);
    const rt = repText(t); if (rt) bits.push(`<span class="dy-rep">↻ ${rt}</span>`);
    if (r && r.from) bits.push(`перенесено з ${human(r.from)}`);
    if (r && r.st === "moved" && r.to) bits.push(`перенесено на ${human(r.to)}`);
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
      : `<button class="dy-mark" type="button" ${ro ? "disabled" : `data-dmark="${t.id}"`} aria-label="Виконано"></button>`;
    return `<li class="dy-it st-${st}${t.quest ? " dy-it--q" : ""}" data-dopen="${t.id}">${mark}
      <div class="dy-body"><span class="dy-t">${esc(t.t)}</span>
        ${cnt ? `<div class="gl-bar"><i style="width:${Math.round(pr * 100)}%"></i></div><span class="dy-num">${fmtN(cur)} <em>/ ${fmtN(t.target)} ${esc(t.unit || "")}</em></span>` : ""}
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
      ${q.st === "active" && q.type !== "budget" ? (q.type === "count" ? `<button type="button" class="gs-plus" data-dqplus="${q.id}" aria-label="Додати">+</button>` : `<button type="button" class="dy-mark dy-mark--q" data-dqdone="${q.id}" aria-label="Виконано"></button>`) : ""}</li>`;
  }
  function budgetLine(q) {
    const sp = qSpent(q), m = T() ? T().money : (x) => x;
    if (sp == null) return `<span class="dy-num"><em>чекаю виписку банку</em></span>`;
    const pr = q.limit ? Math.min(1, sp / q.limit) : sp > 0 ? 1 : 0;
    return `<div class="gl-bar dy-bud"><i style="width:${Math.round(pr * 100)}%"></i></div><span class="dy-num">${m(sp)} <em>${q.limit ? `/ ліміт ${m(q.limit)}` : "— має бути нуль"}</em></span>`;
  }
  function render() {
    const box = $("dayBody"); if (!box) return;
    const k = view || today(); view = k;
    const sub = $("daySub"); if (sub) sub.textContent = `${WDL[wd(today())]}, ${human(today())}`;
    const its = items(k);
    const open = its.filter(({ t, r }) => { const s = stOf(t, r, k); return s === "open" || s === "part" && k >= today(); });
    const shut = its.filter((x) => !open.includes(x));
    const doneN = its.filter(({ t, r }) => isWin(stOf(t, r, k))).length;
    const live = Q.list.filter((q) => q.st === "active" || (q.st === "done" && q.end === k));
    const dayXP = Object.values(X.e).filter((e) => e.d === k).reduce((a, e) => a + e.xp, 0);
    let h = rankStrip();
    h += `<div class="dy-nav"><button type="button" data-dnav="-1" aria-label="Попередній день">‹</button>
      <div class="dy-nav__c"><b>${rel(k)}</b><span>${WDL[wd(k)]}, ${human(k)}</span></div>
      <button type="button" data-dnav="1" aria-label="Наступний день">›</button></div>`;
    if (k !== today()) h += `<button class="dy-today" type="button" data-dnav="0">до сьогодні</button>`;
    const hd = hDay(k);
    if (hd && (hd.steps != null || hd.sleepMin || hd.up)) h += `<div class="dy-body-line">${hd.up ? `<span><svg><use href="#i-sun"/></svg>підйом <b>${hd.up}</b></span>` : ""}${hd.sleepMin ? `<span><svg><use href="#i-moon"/></svg>сон <b>${hm(hd.sleepMin)}</b></span>` : ""}${hd.steps != null ? `<span><svg><use href="#i-steps"/></svg><b>${fmtN(hd.steps)}</b> кроків</span>` : ""}</div>`;
    const gymT = its.find(({ t, r }) => isGym(t) && !isWin(stOf(t, r, k)) && stOf(t, r, k) !== "moved" && stOf(t, r, k) !== "cancel");
    const adv = gymT && k >= today() ? gymAdvice(k) : null;
    if (adv) { const K = adv.giver === "supreme" ? (D().KEEPERS || {}).supreme : (D().KEEPERS || {})[adv.giver];
      h += `<div class="md md--voice dy-adv"><div class="md__fig"${K && K.art ? ` data-card="${adv.giver}"` : ""}>${K && K.art ? `<img class="md__img" src="${esc(K.art)}" alt="">` : ""}</div><div class="md__txt"><div class="md__who">${esc(K ? K.name : "")} · порада на зал</div><p class="md__say">${esc(adv.head)}</p>${adv.tips.length ? `<ul class="dy-tips">${adv.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div>`; }
    if (live.length && k === today()) h += `<section class="dy-sec"><div class="gl-sec__head"><span class="gl-sec__kind">Квести</span></div><ul class="dy-qs">${live.map(questHTML).join("")}</ul></section>`;
    h += `<section class="dy-sec"><div class="gl-sec__head"><span class="gl-sec__kind">${k === today() ? "Справи дня" : k < today() ? "Того дня" : "Заплановано"}</span><span class="gl-sec__meta">${its.length ? `${doneN}/${its.length}` : ""}</span></div>`;
    if (!its.length) h += `<p class="gl-empty">${k < today() ? "Того дня справ не було." : "Справ на цей день немає."}</p>`;
    h += `<ul class="dy-list">${open.map(({ t, r }) => rowHTML(t, r, k)).join("")}</ul>`;
    if (shut.length) h += `<ul class="dy-list dy-list--shut">${shut.map(({ t, r }) => rowHTML(t, r, k)).join("")}</ul>`;
    h += `<button class="gl-new" type="button" data-dnew="1"><svg><use href="#i-plus"/></svg>Нова ціль</button></section>`;
    if (dayXP) h += `<p class="dy-sum">${k === today() ? "За сьогодні" : "За день"}: <b>+${fmtN(dayXP)}</b> досвіду${perfect(k) ? " · чистий день" : ""}</p>`;
    box.innerHTML = h;
  }

  /* ============================================================ ДІЇ ======== */
  function mark(id, k) {
    const t = S.tasks[id]; if (!t) return;
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
    const el = $("dSheet"); if (el) el.classList.remove("open");
    if (!document.querySelector(".sheet.open, .confirm.open")) { const sc = $("scrim"); if (sc) sc.classList.remove("open"); }
    sh = null;
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
        <div class="dy-f"><label>Позначки</label><div class="dy-chips" data-dk="flags">
          <button type="button" data-dv="gym" class="${d.gym ? "is-on" : ""}">зал</button>
          <button type="button" data-dv="steps" class="${d.health === "steps" ? "is-on" : ""}">кроки зі «Здоровʼя»</button></div></div>
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
      }
      h += `<div class="dy-acts dy-acts--3"><button type="button" class="btn btn--ghost" data-ds="move">Перенести</button>
        <button type="button" class="btn btn--ghost" data-ds="${st === "cancel" ? "uncancel" : "cancel"}">${st === "cancel" ? "Повернути" : "Скасувати"}</button>
        <button type="button" class="btn btn--ghost" data-ds="edit">Правити</button></div>`;
      if (isGym(t) && !fut) h += `<button type="button" class="btn btn--line" data-ds="gym">${GYM.log[k] ? "Журнал тренування — правити" : "Записати, що зроблено в залі"}</button>`;
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
      if (!sh.gym) {
        const ex = GYM.log[sh.k], ss = sessions().filter((x) => x.k < sh.k), adv = gymAdvice(sh.k);
        const tpl = ex ? ex : { ex: (adv && ss.length ? (ss.length > 1 && !ss[ss.length - 1].ex.some((e) => ss[ss.length - 2].ex.some((f) => f.n.toLowerCase() === e.n.toLowerCase())) ? ss[ss.length - 2] : ss[ss.length - 1]).ex : [{ n: "", sets: [{}] }]).map((e) => ({ n: e.n, sets: (e.sets || [{}]).map((x) => ({ r: x.r, w: x.w, hint: true })) })) };
        sh.gym = JSON.parse(JSON.stringify({ ex: tpl.ex, note: tpl.note || "" }));
      }
      const g = sh.gym, known = [...new Set(sessions().flatMap((x) => x.ex.map((e) => e.n)))];
      h += `<div class="gs-kicker">Журнал залу · ${human(sh.k)}</div><div class="sheet__title dy-sht">Що зроблено?</div>
        <p class="dy-note">Підходи: повтори × вага. Значення з минулого разу підставлено — виправ, що змінилось.</p>
        <datalist id="gyKnown">${known.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        ${g.ex.map((e, i) => `<div class="gy-ex" data-i="${i}"><div class="gy-ex__h"><input class="dy-in gy-n" list="gyKnown" placeholder="Вправа" value="${esc(e.n)}"><button type="button" class="gy-x" data-ds="gdel" data-i="${i}" aria-label="Прибрати">×</button></div>
          <div class="gy-sets">${e.sets.map((x, j) => `<span class="gy-set"><input class="dy-in gy-r" inputmode="numeric" placeholder="повт" value="${x.r == null ? "" : x.r}"><i>×</i><input class="dy-in gy-w" inputmode="decimal" placeholder="кг" value="${x.w == null ? "" : x.w}"></span>`).join("")}
          <button type="button" class="gy-plus" data-ds="gset" data-i="${i}">+ підхід</button></div></div>`).join("")}
        <button type="button" class="gl-new" data-ds="gadd"><svg><use href="#i-plus"/></svg>Вправа</button>
        <textarea class="dy-in dy-in--note" id="gyNote" rows="2" placeholder="нотатка: самопочуття, що боліло, що вдалось">${esc(g.note || "")}</textarea>
        <button class="btn btn--gold" type="button" data-ds="gsave">Записати тренування · +20</button><button class="btn btn--ghost" type="button" data-ds="close">Пізніше</button>`;
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
  }
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
      if (k === "flags") { if (v === "gym") d.gym = !d.gym; if (v === "steps") { d.health = d.health === "steps" ? null : "steps"; if (d.health) { d.type = "count"; d.unit = d.unit || "кроків"; d.target = d.target || 10000; } } }
      buzz("light"); renderSheet(); return;
    }
    const mv = e.target.closest("[data-dmv]"); if (mv) { moveTo(mv.dataset.dmv); return; }
    const b = e.target.closest("[data-ds]"); if (!b) return;
    const a = b.dataset.ds, k = sh.k, id = sh.id, before = totalXP();
    if (a === "close") { closeSheet(); return; }
    if (a === "back") { sh.mode = "item"; renderSheet(); return; }
    if (a === "save") {
      readDraft(); const d = sh.draft;
      if (!d.t) { const i = $("dsT"); if (i) i.focus(); return; }
      if (d.type === "count" && !(d.target > 0)) { const i = $("dsN"); if (i) i.focus(); return; }
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
  function onBody(e) {
    const g = e.target.closest("[data-dgo]"); if (g) { const A = API(); if (A.showTab) A.showTab("stats"); return; }
    const nv = e.target.closest("[data-dnav]");
    if (nv) { const n = +nv.dataset.dnav; view = n === 0 ? today() : add(view || today(), n); buzz("light"); render(); return; }
    const mk = e.target.closest("[data-dmark]"); if (mk) { mark(mk.dataset.dmark, view); return; }
    const pl = e.target.closest("[data-dplus]"); if (pl) { plus(pl.dataset.dplus, view); return; }
    const qd = e.target.closest("[data-dqdone]"); if (qd) { qDone(qd.dataset.dqdone); return; }
    const qp = e.target.closest("[data-dqplus]"); if (qp) { qPlus(qp.dataset.dqplus); return; }
    const nw = e.target.closest("[data-dnew]"); if (nw) { openSheet("edit", null, view); return; }
    const op = e.target.closest("[data-dopen]"); if (op) { openSheet("item", op.dataset.dopen, view); return; }
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
      ${q.st === "active" ? `<div class="dy-acts">${q.type === "count" ? `<button class="btn btn--gold" type="button" data-dqs="cur">Записати</button>` : `<button class="btn btn--gold" type="button" data-dqs="done">Виконано</button>`}
        <button class="btn btn--ghost" type="button" data-dqs="drop">Відмовитись</button></div>` : ""}
      <button class="btn btn--ghost" type="button" data-dqs="close">Закрити</button>`;
    el.onclick = (e) => {
      const b = e.target.closest("[data-dqs]"); if (!b) return; e.stopPropagation();
      const a = b.dataset.dqs;
      if (a === "close") { closeSheet(); el.onclick = null; return; }
      if (a === "done") { closeSheet(); el.onclick = null; qDone(q.id); return; }
      if (a === "cur") { const c = numIn(($("dqC") || {}).value); if (c != null) { q.cur = Math.max(0, c); q.at = Date.now(); if (q.target && q.cur >= q.target) { closeSheet(); el.onclick = null; qDone(q.id); return; } saveQ(); } closeSheet(); el.onclick = null; render(); return; }
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
    const rate = (t) => { let o = 0, w = 0; days14.forEach((k) => { if (!occurs(t, k) || k > t0) return; const st = stOf(t, rec(k, t.id), k); if (st === "moved" || st === "cancel") return; o++; if (isWin(st)) w++; }); return o ? `${w}/${o}` : null; };
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
      tasks: Object.values(S.tasks).filter((t) => !t.del && (!t.end || t.end >= t0)).map((t) => ({ t: t.t, type: t.type, target: t.target, unit: t.unit, rep: repText(t) || "раз", time: t.time || "", gym: isGym(t), rate14: rate(t) })),
      perfectDays14: days14.filter((k) => perfect(k)).length,
      quests: Q.list.slice(-25).map((q) => ({ pid: q.pid, rar: q.rar, giver: q.giver, t: q.t, st: q.st, from: q.from || q.offerOn, until: q.until, cur: q.cur, target: q.target })),
      achievements: Object.keys(ACH),
      goals: { month: goals(G.m && G.m[mk]), year: goals(G.y && G.y[yk]) },
      gym: sessions().slice(-6).map((x) => ({ d: x.k, ex: x.ex.map((e) => `${e.n} ${e.sets.map((z) => `${z.r || "?"}×${z.w || 0}`).join(",")}`), note: x.note || "" })),
      health: days14.map((k) => ({ d: k, steps: (hDay(k) || {}).steps, sleepMin: (hDay(k) || {}).sleepMin, up: S.wake[k] || null, feel: (S.sleep[k] || {}).q || null })).filter((x) => x.steps != null || x.sleepMin || x.up),
      bank: T && T.ready() ? { week: T.spentIn("*", since(7), t0), prevWeek: T.spentIn("*", since(14), since(8)), courier7: T.spentIn(["courier"], since(7), t0), verdicts: LS.get("ordo.bank", {}).seen || {} } : null,
      seenEvents: Object.keys(S.ev || {})
    };
  }
  let wAt = LS.get("ordo.k.writerAt", 0);
  async function writerSync() {
    const V = window.ORDO_VAULT; if (!V || !V.writeSealed || Date.now() - wAt < 6 * 3600e3) return;
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
    const box = $("dayBody"); if (box) box.addEventListener("click", onBody);
    const sc = $("scrim"); if (sc) sc.addEventListener("click", () => { if (sh) closeSheet(); });
    const seed = (D().DAY || {}).seed;
    if (seed && seed.tasks && S.seeded !== seed.v) {
      seed.tasks.forEach((t) => { if (!S.tasks[t.id]) S.tasks[t.id] = Object.assign({ diff: "normal", rep: { f: "none" }, created: today() }, t, { mt: Date.now() }); });
      S.seeded = seed.v; saveS();
    }
    lastLevel = levelOf(totalXP());
    applyHealth(); settle(); lastLevel = levelOf(totalXP());
    render(); loadHealth(true); applyDrop(); loadDrop(); setTimeout(writerSync, 8000); setTimeout(stamp, 1200);
    let day = today();
    setInterval(() => { if (today() !== day) { if (view === day) view = today(); day = today(); settle(); render(); } }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { stamp(); loadHealth(); loadDrop(); settle(); render(); setTimeout(scenes, 1500); } else writerSync(); });
    setTimeout(scenes, 2500);
  }
  /* перше відкриття дня = підйом; до 8:00 — питаємо, як спав (після ритуалу, коли нічого не відкрито) */
  function stamp() {
    const n = new Date(), hm = `${p2(n.getHours())}:${p2(n.getMinutes())}`, t0 = today();
    if (!S.wake[t0] && hm >= DAWN) { S.wake[t0] = hm; saveS(); }
    if (early(t0) && !S.sleep[t0]) morning(Date.now());
  }
  function morning(t0) {
    const busy = () => { const i = $("intro"); return (i && !i.hasAttribute("hidden")) || document.querySelector(".rite.open, .sheet.open, .confirm.open, .kc, .hall.open"); };
    if (S.sleep[today()] || Date.now() - t0 > 15 * 60e3) return;
    if (busy()) { setTimeout(() => morning(t0), 1500); return; }
    openSheet("sleep", null, today());
  }
  function shown() { settle(); render(); setTimeout(scenes, 700); }

  window.ORDO_DAY = { init, shown, render, gloryHTML, trigger, scenes, levelOf: () => levelOf(totalXP()), emblem,
    _state: () => ({ S, Q, X, ACH }), _writer: writerState };
})();
