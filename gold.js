/* ============================================================================
   ORDO — золото й реліквії Ордену.
   Золото нараховується з книги досвіду (ідеальні дні, квести, віхи, цілі, зал…) — рахується саме й однаково
   на всіх пристроях; плюс бонуси реліквій, благословення (золото ×2) і здобич зі скринь.
   Витрачається у крамниці Сенешаля (скрині, жетони) або виводиться 1:1 на білу картку — Орден бачить
   поповнення у виписці банку й закриває виведення сам. Реліквії: каталог — у зашифрованому вмісті (D.RELICS),
   три активні; бонуси діють лише на золото й квести — стріки обітниць не захищає жодна.
   ========================================================================== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtN = (n) => Math.round(n).toLocaleString("uk-UA");
  const roll = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
  const DAY = () => window.ORDO_DAY, T = () => window.ORDO_TREASURY, API = () => window.ORDO_API || {}, D = () => window.ORDO_DATA || {};
  const p2 = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const weekKey = (k) => { const d = new Date(k + "T12:00:00"); const t = new Date(d); t.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(t.getFullYear(), 0, 4);
    return `${t.getFullYear()}-W${p2(1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7))}`; };
  const fx = (s) => { const A = API(); if (A.FX) { if (A.FX.play) A.FX.play(s); if (A.FX.buzz) A.FX.buzz(s === "yes" ? "medium" : "light"); } };

  const START = "2026-10-26";                                  // з цього дня Орден платить золотом
  const START_T = Date.parse(START + "T00:00:00+02:00") / 1000;
  const RN = { common: "звичайна", rare: "рідкісна", legend: "легендарна", myth: "міфічна" };
  const DROP = { rare: 0.15, legend: 0.4, myth: 1 };          // шанс реліквії за виконаний квест
  const BLESS = 0.05;                                          // базовий шанс благословення
  const SLOTS = 3;
  const SHOP = [
    { id: "chest", n: "Скриня Сенешаля", p: 150, d: "Що всередині — не знає навіть Орест: золото, жетони, реліквія… а інколи й скарб." },
    { id: "reroll", n: "Жетон перекидання", p: 60, d: "Не твоє доручення? Попроси в храмовника інше." },
    { id: "extend", n: "Жетон відстрочки", p: 80, d: "+1 день до активного квесту." }
  ];

  /* G синхронізується між пристроями (boot.js обʼєднує кожен розділ):
     out — виведення й покупки, inc — здобич зі скринь, bon — бонуси реліквій і благословення, proc — уже оброблені записи досвіду,
     own — реліквії, eq — активні (eqAt — коли змінено), tk — жетони (+1 куплено / −1 використано), use — використання бонусів реліквій */
  let G = LS.get("ordo.gold", null) || {};
  ["out", "inc", "bon", "proc", "own", "tk", "use"].forEach((k) => { G[k] = G[k] || {}; });
  G.eq = G.eq || [];
  const save = () => LS.set("ordo.gold", G);
  const coin = (cls) => `<svg class="gd-coin${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5"/><path d="M12 8.5v7M9.5 12h5"/></svg>`;
  const gem = (r, cls) => `<svg class="rl-gem rl-gem--${r}${cls ? " " + cls : ""}" viewBox="0 0 48 48" aria-hidden="true"><path class="rl-g1" d="M24 4 41 16 34 42H14L7 16Z"/><path class="rl-g2" d="M7 16h34M24 4l-7 12 7 26 7-26-7-12M14 42l3-26M34 42l-3-26"/></svg>`;
  const relics = () => D().RELICS || [];
  const relic = (id) => relics().find((r) => r.id === id);

  /* ------------------------------------------------------------- нарахування */
  /* золото за запис книги досвіду — за таблицею window.ORDO_ECON (day.js) */
  function goldOf(id, e, Q, S) {
    const E = window.ORDO_ECON, p = id.split(":")[0];
    if (!E) return 0;
    if (e.gold != null) return e.gold;                                          // ціль місяця / року — ціна вже в записі
    if (p === "t") {                                                             // справа дня: пропорційно досвіду (ланцюжок, «з поправкою», частково)
      const t = S.tasks[id.split(":")[1]], r = ({ easy: "common", normal: "rare", hard: "legend" })[t && t.diff] || (t && E.task[t.diff] ? t.diff : "rare");
      const [xp, g] = E.task[r]; return e.xp > 0 ? Math.max(1, Math.round(e.xp * g / xp)) : 0;
    }
    if (E.day[p]) return E.day[p][1];                                           // ідеальний день, зал, сповідь, кроки, підйом
    if (p === "v") return E.vowDay[1];                                          // чистий день обітниці
    if (p === "a") return E.ach[1];
    if (p === "g") return e.xp >= 400 ? 300 : 80;                               // старі записи цілей без ціни
    if (p === "gm") return Math.round(e.xp / 2);                                // ревю: відсоток виконаного
    if (p === "vm") { const m = +id.split(":")[2], v = E.milestone[m]; return v ? v[1] : Math.round(m * 1.5); }
    if (p === "q") { const q = Q.list.find((x) => "q:" + x.id === id), b = (E.quest[q && q.rar] || E.quest.rare)[1]; return q && q.st === "part" ? Math.round(b * Math.min(1, (q.cur || 0) / (q.target || 1)) * 0.6) : b; }     // частково — як і досвід: частка прогресу × 0.6
    return 0;
  }
  const CAT = { pd: "day", jr: "day", t: "day", gy: "body", st: "body", er: "body", q: "quest", vm: "vow", v: "vow" };
  function ledger() {
    const Dy = DAY(); if (!Dy || !Dy._state) return [];
    const { X, Q, S } = Dy._state();
    return Object.entries(X.e || {}).filter(([, e]) => e.d >= START).map(([id, e]) => ({ id, d: e.d, why: e.why, g: goldOf(id, e, Q, S) })).filter((x) => x.g > 0);
  }
  const sum = (o) => Object.values(o).reduce((a, x) => a + (typeof x === "number" ? x : x.amt || 0), 0);
  const earned = () => ledger().reduce((a, x) => a + x.g, 0) + sum(G.bon) + sum(G.inc);
  const spent = () => Object.values(G.out).filter((o) => o.st !== "cancel").reduce((a, o) => a + o.amt, 0);
  const balance = () => earned() - spent();
  const pending = () => Object.values(G.out).filter((o) => o.kind === "white" && o.st === "pending");

  /* ---------------------------------------------------------------- реліквії */
  const equipped = () => G.eq.map(relic).filter(Boolean);
  const bonusOf = (type, src) => equipped().filter((r) => r.bonus && r.bonus.type === type && (!src || r.bonus.src === "all" || r.bonus.src === src)).reduce((a, r) => a + (r.bonus.v || 0), 0);
  function grant(id, src) {
    if (!relic(id)) return null;
    if (G.own[id]) {                                           // дублікат — переплавка в золото
      const g = { common: 50, rare: 100, legend: 250, myth: 600 }[relic(id).rar];
      G.inc["dup:" + id + ":" + Date.now()] = { at: Date.now(), amt: g, why: `переплавлено: ${relic(id).n}` };
      return { dup: true, id, g };
    }
    G.own[id] = { at: Date.now(), src };
    if (G.eq.length < SLOTS) { G.eq.push(id); G.eqAt = Date.now(); }
    return { id };
  }
  /* випадкова реліквія з тих, яких ще нема (без таємних — ті тільки за подвиги); рідкість не вища за maxR, частіше — саме maxR */
  function randomRelic(maxR, seed) {
    const order = ["common", "rare", "legend", "myth"], top = order.indexOf(maxR);
    const pool = relics().filter((r) => !r.secret && !G.own[r.id] && order.indexOf(r.rar) <= top);
    if (!pool.length) return null;
    const w = pool.map((r) => (order.indexOf(r.rar) === top ? 3 : 1)), tot = w.reduce((a, x) => a + x, 0);
    let x = (seed != null ? roll(seed) : Math.random()) * tot;
    for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i].id; }
    return pool[pool.length - 1].id;
  }
  /* таємні подвиги — зі свіжих записів досвіду (від початку золота) та даних «Здоровʼя» й покеру */
  function secrets() {
    const Dy = DAY(); if (!Dy || !Dy._state) return [];
    const E = Object.entries(Dy._state().X.e || {}).filter(([, e]) => e.d >= START), ids = E.map(([id]) => id);
    const n = (p) => ids.filter((i) => i.startsWith(p + ":")).length;
    const HL = LS.get("ordo.k.health", {}) || {}, PK = LS.get("ordo.k.poker", {}) || {};
    const byMonth = {}; ids.filter((i) => i.startsWith("gy:")).forEach((i) => { const m = i.slice(3, 10); byMonth[m] = (byMonth[m] || 0) + 1; });
    const er = ids.filter((i) => i.startsWith("er:")).map((i) => i.slice(3)).sort();
    const early5 = er.some((k, i) => i >= 4 && (Date.parse(k) - Date.parse(er[i - 4])) / 864e5 <= 6);
    const ok = {
      night: n("nw") > 0,
      steps15: Object.entries(HL.days || {}).some(([k, d]) => k >= START && d.steps >= 15000),
      journal10: n("jr") >= 10,
      hands2000: Object.entries(PK.days || {}).some(([k, d]) => k >= START && d.hands >= 2000),
      perfect7: n("pd") >= 7,
      gym8: Object.values(byMonth).some((c) => c >= 8),
      early5,
      year365: ids.some((i) => /^vm:[^:]+:365:/.test(i))
    };
    return relics().filter((r) => r.secret && ok[r.secret] && !G.own[r.id]).map((r) => r.id);
  }

  /* ----------------------------------------------------------- щоденний обхід */
  const reveals = [];
  function process() {
    const Dy = DAY(); if (!Dy || !Dy._state || !relics().length) return false;
    const { Q } = Dy._state(); let ch = false;
    if (!G.starter) { G.starter = 1; const r = grant("ring", "посвята"); if (r) reveals.push(Object.assign(r, { why: "Дар Магістра Аврелія — на початок шляху з реліквіями" })); ch = true; }
    ledger().forEach((x) => {
      if (G.proc[x.id]) return;
      G.proc[x.id] = 1; ch = true;
      const cat = CAT[x.id.split(":")[0]], pct = bonusOf("gold", cat);
      if (pct > 0) G.bon["rb:" + x.id] = Math.round(x.g * pct);                                     // бонус активних реліквій
      if ((cat === "day" && x.id.startsWith("pd:")) || cat === "quest") {
        if (roll("bless" + x.id) < BLESS + bonusOf("luck")) { G.bon["bl:" + x.id] = x.g; reveals.push({ bless: true, g: x.g, why: x.why }); }   // благословення: золото ×2
      }
      if (cat === "quest") {
        const q = Q.list.find((y) => "q:" + y.id === x.id);
        if (q && q.st === "done" && roll("relic" + x.id) < (DROP[q.rar] || 0)) { const id = randomRelic(q.rar, "pick" + x.id); if (id) { const r = grant(id, `квест «${q.t}»`); if (r) reveals.push(Object.assign(r, { why: `За квест «${q.t}»` })); } }
      }
    });
    secrets().forEach((id) => { const r = grant(id, "таємний подвиг"); if (r) reveals.push(Object.assign(r, { why: relic(id).hint })); ch = true; });
    /* церемонія рівня: за кожен новий рівень — золото (50 + 10 × рівень), за нове звання — ще й реліквія */
    const lv = Dy.levelOf ? Dy.levelOf() : null;
    if (lv) {
      if (G.lv == null) { G.lv = lv.L; G.ri = lv.ri; ch = true; }
      else if (lv.L > G.lv) {
        for (let L = G.lv + 1; L <= lv.L; L++) {
          const g = 50 + 10 * L; G.inc["lv:" + L] = { at: Date.now(), amt: g, why: `рівень ${L}` };
          const up = { level: L, rank: L === lv.L ? lv.rank.name : "", g, newRank: L === lv.L && lv.ri > (G.ri || 0) };
          if (up.newRank) { const id = randomRelic(lv.ri >= 6 ? "legend" : "rare", "rank" + lv.ri); if (id) { const r = grant(id, `звання «${lv.rank.name}»`); if (r && !r.dup) up.relic = id; } }
          reveals.push(up);
        }
        G.lv = lv.L; G.ri = lv.ri; ch = true;
      }
    }
    /* недільна скриня: 5+ ідеальних днів за тиждень (пн–нд) — відкривається в неділю або пізніше */
    const pds = ledger().filter((x) => x.id.startsWith("pd:")).map((x) => x.d);
    G.wk = G.wk || {};
    for (let i = 0; i < 3; i++) {
      const sun = new Date(); sun.setDate(sun.getDate() - ((sun.getDay() + 7) % 7) - 7 * i); const sk = `${sun.getFullYear()}-${p2(sun.getMonth() + 1)}-${p2(sun.getDate())}`;
      const mon = new Date(sun); mon.setDate(sun.getDate() - 6); const mk = `${mon.getFullYear()}-${p2(mon.getMonth() + 1)}-${p2(mon.getDate())}`;
      if (sk > today() || sk < START || G.wk[sk]) continue;
      const n = pds.filter((d) => d >= mk && d <= sk).length; if (n < 5) continue;
      G.wk[sk] = 1; ch = true;
      const x = roll("wk" + sk), g = 100 + Math.round(roll("wkg" + sk) * 200 + (n - 5) * 50);
      G.inc["wk:" + sk] = { at: Date.now(), amt: g, why: `недільна скриня · ${n} ідеальних днів` };
      const loot = { weekChest: true, n, g };
      if (x < 0.4) { const rr = roll("wkr" + sk), id = randomRelic(rr < 0.03 ? "myth" : rr < 0.2 ? "legend" : rr < 0.55 ? "rare" : "common", "wkp" + sk); if (id) { const r = grant(id, "недільна скриня"); if (r && !r.dup) loot.relic = id; } }
      else if (x < 0.7) { const t = roll("wkt" + sk) < 0.5 ? "reroll" : "extend"; G.tk["wk:" + sk] = { kind: t, d: 1, at: Date.now() }; loot.token = t; }
      reveals.push(loot);
    }
    if (ch) save();
    return ch;
  }

  /* --------------------------------------------------- біла картка: звірка з банком */
  function reconcile() {
    const W = T() && T().white && T().white(); if (!W) return false;
    let ch = false;
    const linked = new Set(Object.values(G.out).map((o) => o.tx).filter(Boolean));
    (W.in || []).filter((t) => t.t >= START_T && !linked.has(t.id)).sort((a, b) => a.t - b.t).forEach((t) => {
      const amt = Math.round(t.a / 100);
      const p = pending().sort((a, b) => (a.amt === amt ? -1 : 0) - (b.amt === amt ? -1 : 0) || a.at - b.at)[0];
      if (p) Object.assign(p, { st: "done", amt, tx: t.id, done: t.t * 1000 });                       // очікуване виведення прийшло (можна й іншою сумою)
      else G.out["w" + t.id] = { at: t.t * 1000, amt, kind: "white", st: "done", tx: t.id, auto: 1 };  // поповнив сам, без кнопки — теж виведення
      ch = true;
    });
    pending().forEach((p) => { if (Date.now() - p.at > 24 * 3600e3) { p.st = "cancel"; ch = true; } });   // доба без поповнення — золото повертається
    if (ch) save();
    return ch;
  }

  /* ------------------------------------------------- жетони й бонуси квестів */
  const tokens = (kind) => Object.values(G.tk).filter((t) => t.kind === kind).reduce((a, t) => a + t.d, 0);
  const relicLeft = (kind) => {                                 // скільки разів ще можна цього тижня (перекидання) чи місяця (відстрочка)
    const per = kind === "reroll" ? weekKey(today()) : today().slice(0, 7), cap = bonusOf(kind);
    const used = Object.values(G.use).filter((u) => u.kind === kind && u.per === per).length;
    return Math.max(0, cap - used);
  };
  const can = (kind) => relicLeft(kind) > 0 || tokens(kind) > 0;
  function use(kind) {
    if (relicLeft(kind) > 0) G.use["u" + Date.now().toString(36)] = { kind, per: kind === "reroll" ? weekKey(today()) : today().slice(0, 7), at: Date.now() };
    else if (tokens(kind) > 0) G.tk["t" + Date.now().toString(36)] = { kind, d: -1, at: Date.now() };
    else return false;
    save(); return true;
  }

  /* ----------------------------------------------------------------- відгук */
  function toast(html) { const el = $("dyToast"); if (!el) return; el.className = "dy-toast dy-toast--gold"; el.innerHTML = html; void el.offsetWidth; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2600); }
  /* після дій «Дня»: обробити нове (бонуси, благословення, реліквії), показати приріст золота й відкриття */
  function tick() {
    process();
    const e = earned(), seen = LS.get("ordo.k.goldSeen", null);
    if (seen === null) LS.set("ordo.k.goldSeen", e);
    else if (e > seen) { LS.set("ordo.k.goldSeen", e); setTimeout(() => toast(`${coin()}<b>+${fmtN(e - seen)}</b> золота`), 1900); }
    else if (e < seen) LS.set("ordo.k.goldSeen", e);
    if (reveals.length) setTimeout(nextReveal, 3200);
  }

  /* ------------------------------------------------------------------ вигляд */
  const chip = () => `<span class="gd-chip">${coin()}<b>${fmtN(balance())}</b></span>`;
  const bonusText = (b) => !b ? "" : b.type === "gold" ? `+${Math.round(b.v * 100)}% золота ${({ all: "за все", day: "за дні й сповіді", body: "за зал, кроки й ранні підйоми", quest: "за квести", vow: "за віхи обітниць" })[b.src] || ""}`
    : b.type === "luck" ? `+${Math.round(b.v * 100)}% до шансу благословення` : b.type === "reroll" ? `перекинути квест ${b.v > 1 ? b.v + " рази" : "раз"} на тиждень` : b.type === "extend" ? `+1 день до квесту ${b.v > 1 ? b.v + " рази" : "раз"} на місяць` : "";
  /* арти реліквій: art/sealed/<хеш>.json (зашифровані, з непрозорими назвами — щоб і список файлів нічого не підказував);
     розшифровані кешуються на пристрої (Cache Storage), відсутні — не питаємо частіше ніж раз на 6 год */
  const ART = {};
  const artName = (kind, id) => { let h = 2166136261; const s = kind + ":" + id; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };
  let artBusy = false;
  const SCENES = ["chest", "shop", "treasury", "levelup", "night", "weekchest"];
  const scene = (n) => ART["scene:" + n] || null;
  async function loadArts() {
    const V = window.ORDO_VAULT; if (artBusy || !V || !V.readSealedBlob) return;
    const want = Object.keys(G.own).filter((id) => !ART[id] && relic(id)).map((id) => ["relic", id]).concat(SCENES.filter((x) => !ART["scene:" + x]).map((x) => ["scene", x]));
    if (!want.length) return;
    artBusy = true; let ch = false;
    try {
      let cache = null; try { cache = await caches.open("ordo-art"); } catch (e) {}
      const miss = LS.get("ordo.k.artMiss", {});
      for (const [kind, id0] of want) {
        const id = kind === "scene" ? "scene:" + id0 : id0, n = artName(kind, id0), key = new Request(`${location.origin}/__art/${n}`);
        let blob = null;
        if (cache) { const r = await cache.match(key); if (r) blob = await r.blob(); }
        if (!blob && !(miss[n] && Date.now() - miss[n] < 6 * 3600e3)) {
          try { blob = await V.readSealedBlob(`art/sealed/${n}.json`); } catch (e) {}
          if (blob) { delete miss[n]; if (cache) await cache.put(key, new Response(blob, { headers: { "Content-Type": blob.type } })); } else miss[n] = Date.now();
        }
        if (blob) { ART[id] = URL.createObjectURL(blob); ch = true; }
      }
      LS.set("ordo.k.artMiss", miss);
    } finally { artBusy = false; }
    if (ch) { refreshViews(); if (el && el.classList.contains("open") && mode === "relic") { const t = el.querySelector("[data-rleq]"); if (t) render("relic", t.dataset.rleq); } }
  }
  const face = (r, cls) => ART[r.id] ? `<img class="rl-img${cls ? " " + cls : ""}" src="${ART[r.id]}" alt="">` : gem(r.rar, cls);
  function html() {
    reconcile(); process(); setTimeout(loadArts, 50);
    const b = balance(), L = ledger(), mk = today().slice(0, 7);
    const month = L.filter((x) => x.d.startsWith(mk)).reduce((a, x) => a + x.g, 0) + Object.entries(G.bon).filter(([k]) => { const id = k.replace(/^(rb|bl):/, ""); const x = L.find((y) => y.id === id); return x && x.d.startsWith(mk); }).reduce((a, [, v]) => a + v, 0);
    const W = T() && T().white && T().white(), pd = pending();
    const full = L.map((x) => ({ d: x.d, t: x.why, g: x.g + (G.bon["rb:" + x.id] || 0) + (G.bon["bl:" + x.id] || 0), bl: !!G.bon["bl:" + x.id] }));
    const small = {}; full.filter((x) => x.g < 10 && !x.bl).forEach((x) => { const o = small[x.d] = small[x.d] || { d: x.d, t: "справи й обітниці дня", g: 0, n: 0 }; o.g += x.g; o.n++; });
    const feed = full.filter((x) => x.g >= 10 || x.bl).concat(Object.values(small))
      .concat(Object.entries(G.inc).map(([, v]) => ({ d: new Date(v.at).toISOString().slice(0, 10), t: v.why, g: v.amt })))
      .sort((a, c) => (c.d > a.d ? 1 : c.d < a.d ? -1 : 0)).slice(0, 5);
    const outs = Object.values(G.out).filter((o) => o.st !== "cancel").sort((a, c) => c.at - a.at).slice(0, 4);
    const tkR = tokens("reroll"), tkE = tokens("extend");
    let h = `<section class="st-sec gd"><div class="st-h">Золото Ордену</div>${scene("treasury") ? `<img class="gd-scene" src="${scene("treasury")}" alt="">` : ""}
      <div class="gd-big">${coin("gd-coin--big")}<b>${fmtN(b)}</b><span>золота</span></div>
      <div class="tr-row"><span>цього місяця зароблено <b>${fmtN(month)}</b></span>${W && W.bal != null ? `<span>біла картка <b>${fmtN(W.bal / 100)} ₴</b></span>` : ""}</div>
      ${pd.length ? `<p class="gd-wait">в дорозі на білу картку — <b>${fmtN(pd.reduce((a, p) => a + p.amt, 0))} ₴</b> · чекаю на поповнення у виписці</p>` : ""}
      ${tkR || tkE ? `<p class="gd-wait">жетони: ${tkR ? `перекидання <b>${tkR}</b>` : ""}${tkR && tkE ? " · " : ""}${tkE ? `відстрочки <b>${tkE}</b>` : ""}</p>` : ""}
      <div class="dy-acts gd-acts"><button type="button" class="btn btn--gold" data-gd="shop">Крамниця Сенешаля</button><button type="button" class="btn btn--line" data-gd="out" ${b > 0 ? "" : "disabled"}>На білу картку</button></div>
      <button type="button" class="gd-sync" data-gd="sync" ${syncing ? "disabled" : ""}>${syncing ? "оновлюю виписку… (до хвилини)" : `↻ оновити виписку${T() && T().at ? ` · ${(() => { const B = LS.get("ordo.k.bank", {}); return B && B.at ? new Date(B.at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : ""; })()}` : ""}`}</button>
      ${feed.length ? `<div class="st-h st-h--sub">Нещодавно</div><ul class="tr-top gd-list">${feed.map((x) => `<li><span>${x.bl ? "✦ " : ""}${esc(x.t)}</span><b>+${fmtN(x.g)}</b></li>`).join("")}</ul>` : ""}
      ${outs.length ? `<div class="st-h st-h--sub">Виведено й витрачено</div><ul class="tr-top gd-list">${outs.map((o) => `<li><span>${o.kind === "white" ? (o.st === "pending" ? "на білу картку · чекаю" : "на білу картку") : esc(o.item || "крамниця")}</span><b>−${fmtN(o.amt)}</b></li>`).join("")}</ul>` : ""}
      <p class="tr-at">золото — за ідеальні дні, квести, віхи обітниць, цілі, зал. 1 золото = 1 ₴ на білій картці</p></section>`;
    if (relics().length) {
      const own = relics().filter((r) => G.own[r.id]);
      h += `<section class="st-sec rl"><div class="st-h">Реліквії <em class="rl-n">${own.length} / ${relics().length}</em></div>
        <div class="rl-slots">${[0, 1, 2].map((i) => { const r = relic(G.eq[i]); return r ? `<button type="button" class="rl-slot is-on rl--${r.rar}" data-rl="${r.id}">${face(r)}<b>${esc(r.n)}</b><span>${esc(bonusText(r.bonus))}</span></button>` : `<div class="rl-slot"><i>порожньо</i></div>`; }).join("")}</div>
        <div class="rl-grid">${relics().map((r) => G.own[r.id] ? `<button type="button" class="rl-cell rl--${r.rar}${G.eq.includes(r.id) ? " is-eq" : ""}" data-rl="${r.id}" title="${esc(r.n)}">${face(r)}</button>`
          : `<button type="button" class="rl-cell is-locked rl--${r.rar}" data-rlx="${r.id}" title="${r.secret ? "таємна" : "ще не знайдена"}"><span>${r.secret ? "?" : ""}</span></button>`).join("")}</div>
        <p class="tr-at">реліквії випадають за квести, зі скринь і за таємні подвиги. Активних — три</p></section>`;
    }
    return h;
  }

  /* ------------------------------------------------------------- аркуші */
  let el = null, amt = 0, polls = [], mode = "";
  function sheet() {
    if (el) return el;
    el = document.createElement("div"); el.className = "sheet dsheet gd-sheet"; el.id = "gdSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", onSheet);
    el.addEventListener("input", (e) => { if (e.target.id === "gdAmt") { amt = Math.max(0, Math.floor(+e.target.value.replace(/\D/g, "") || 0)); const ok = $("gdOk"); if (ok) ok.disabled = !(amt > 0 && amt <= balance()); } });
    const A = API(); if (A.dragDismiss) A.dragDismiss(el, { target: () => el, close, follow: A.scrimFollow, scroller: () => el, can: (e) => e.target.tagName !== "INPUT" });
    return el;
  }
  function show(m, arg) {
    sheet(); mode = m; render(m, arg);
    const sc = $("scrim"); if (sc) { sc.classList.add("open"); sc.onclick = () => { close(); sc.onclick = null; }; }
    requestAnimationFrame(() => el.classList.add("open"));
    fx("open");
  }
  function close() { if (!el) return; el.classList.remove("open"); const sc = $("scrim"); if (sc && !document.querySelector(".sheet.open")) sc.classList.remove("open"); refreshViews(); if (reveals.length) setTimeout(nextReveal, 600); }
  const grip = `<div class="sheet__grip"></div>`;
  function render(m, arg) {
    const b = balance();
    if (m === "sent") {
      el.innerHTML = `${grip}<div class="gs-kicker">Золото Ордену</div><div class="sheet__title dy-sht">Переведи ${fmtN(amt)} ₴ на білу картку</div>
        <p class="dy-note dy-note--t">У монобанку: з чорної картки на білу <b>…9467</b>. Золото вже відкладено; щойно поповнення зʼявиться у виписці (зазвичай 1–2 хв), Сенешаль закриє виведення. Не прийде за добу — золото повернеться.</p>
        <a class="btn btn--gold" href="https://send.monobank.ua/">Відкрити монобанк</a><button type="button" class="btn btn--ghost" data-gd="close">Готово</button>`;
    } else if (m === "out") {
      amt = Math.min(b, amt || Math.min(b, 500));
      el.innerHTML = `${grip}<div class="gs-kicker">Золото Ордену</div><div class="sheet__title dy-sht">Вивести на білу картку</div>
        <p class="dy-note">Є ${coin()}<b>${fmtN(b)}</b>. 1 золото = 1 ₴.</p>
        <div class="dy-f dy-f--row"><label>Скільки</label><input class="dy-in dy-in--n" id="gdAmt" inputmode="numeric" value="${amt}"><span class="dy-unit">₴</span></div>
        <div class="dy-chips">${[100, 300, 500].filter((v) => v < b).map((v) => `<button type="button" data-gdv="${v}">${v}</button>`).join("")}<button type="button" data-gdv="${b}">усе · ${fmtN(b)}</button></div>
        <button type="button" class="btn btn--gold" id="gdOk" data-gd="ok" ${amt > 0 ? "" : "disabled"}>Вивести ${coin()}</button><button type="button" class="btn btn--ghost" data-gd="close">Скасувати</button>`;
    } else if (m === "shop") {
      el.innerHTML = `${grip}<div class="gs-kicker">Крамниця Сенешаля</div>${ART["scene:shop"] ? `<img class="gd-scene" src="${ART["scene:shop"]}" alt="">` : ""}<div class="sheet__title dy-sht">«Чесно зароблене — чесно й витрачай»</div>
        <p class="dy-note">У тебе ${coin()}<b>${fmtN(b)}</b></p>
        <ul class="gd-shop">${SHOP.map((it) => `<li><div><b>${esc(it.n)}</b><span>${esc(it.d)}</span></div><button type="button" class="btn btn--line" data-gdbuy="${it.id}" ${b >= it.p ? "" : "disabled"}>${coin()} ${it.p}</button></li>`).join("")}</ul>
        <button type="button" class="btn btn--ghost" data-gd="close">Закрити</button>`;
    } else if (m === "chest") {
      el.innerHTML = `${grip}<div class="gs-kicker">Скриня Сенешаля</div><div class="gd-chest is-shake">${ART["scene:chest"] ? `<img src="${ART["scene:chest"]}" alt="">` : ""}<svg viewBox="0 0 64 64" aria-hidden="true"><path class="ch-b" d="M8 30h48v24H8z"/><path class="ch-l" d="M8 30c0-12 10-18 24-18s24 6 24 18z"/><path class="ch-s" d="M8 30h48M30 26h4v10h-4z"/></svg></div><p class="dy-note gd-c">Сенешаль повертає ключ…</p>`;
    } else if (m === "loot") {
      el.innerHTML = `${grip}<div class="gs-kicker">Скриня Сенешаля</div>${lootHTML(arg)}<button type="button" class="btn btn--gold" data-gd="close">Забрати</button>`;
    } else if (m === "relic") {
      const r = relic(arg), on = G.eq.includes(r.id);
      el.innerHTML = `${grip}<div class="gs-kicker rl-k--${r.rar}">${RN[r.rar]} реліквія</div><div class="rl-big rl--${r.rar}">${face(r, "rl-face")}</div>
        <div class="sheet__title dy-sht">${esc(r.n)}</div><p class="rl-bonus">${esc(bonusText(r.bonus))}</p><p class="dy-note dy-note--t rl-lore">${esc(r.lore)}</p>
        ${on ? `<button type="button" class="btn btn--line" data-rleq="${r.id}">Зняти</button>` : G.eq.length < SLOTS ? `<button type="button" class="btn btn--gold" data-rleq="${r.id}">Носити</button>`
          : `<p class="dy-note">Усі три місця зайняті — обери, що зняти:</p><div class="dy-chips dy-chips--wrap">${G.eq.map((x) => `<button type="button" data-rlswap="${r.id}|${x}">${esc(relic(x).n)}</button>`).join("")}</div>`}
        <button type="button" class="btn btn--ghost" data-gd="close">Закрити</button>`;
    } else if (m === "locked") {
      const r = relic(arg);
      el.innerHTML = `${grip}<div class="gs-kicker rl-k--${r.rar}">${RN[r.rar]} реліквія</div><div class="rl-big is-locked rl--${r.rar}"><span>?</span></div>
        <div class="sheet__title dy-sht">${r.secret ? "Таємна реліквія" : "Ще не знайдена"}</div><p class="dy-note dy-note--t">${r.secret ? esc(r.hint) : "Випадає за квести або зі скрині Сенешаля."}</p>
        <button type="button" class="btn btn--ghost" data-gd="close">Закрити</button>`;
    } else if (m === "reveal") {
      if (arg.level) { el.innerHTML = `${grip}<div class="gs-kicker">Церемонія Ордену</div>${scene("levelup") ? `<img class="gd-scene gd-scene--tall" src="${scene("levelup")}" alt="">` : ""}
        <div class="lv-big">${arg.level}</div><div class="sheet__title dy-sht">${arg.newRank ? `Нове звання — «${esc(arg.rank)}»` : `Рівень ${arg.level}`}</div>
        <p class="dy-note dy-note--t">${arg.newRank ? "Капітул вписує нове звання в книгу Ордену. Слово тримав — і слово тримає тебе." : "Орден відзначає ще одну сходинку."}</p>
        <div class="gd-big">${coin("gd-coin--big")}<b>+${fmtN(arg.g)}</b></div>${arg.relic ? `<p class="rl-bonus">і реліквія — «${esc(relic(arg.relic).n)}»</p>` : ""}
        <button type="button" class="btn btn--gold" data-gd="close">${arg.relic ? "Подивитися реліквію" : "Прийняти"}</button>`;
        if (arg.relic) reveals.unshift({ id: arg.relic, why: `За звання «${arg.rank}»` });
        return; }
      if (arg.weekChest) { el.innerHTML = `${grip}<div class="gs-kicker">Недільна скриня</div>${scene("weekchest") ? `<img class="gd-scene gd-scene--tall" src="${scene("weekchest")}" alt="">` : ""}
        <div class="sheet__title dy-sht">${arg.n} ідеальних днів за тиждень</div><p class="dy-note dy-note--t">Сенешаль сам приносить скриню: «За такий тиждень — заслужено».</p>
        <div class="gd-big">${coin("gd-coin--big")}<b>+${fmtN(arg.g)}</b></div>${arg.relic ? `<p class="rl-bonus">і реліквія — «${esc(relic(arg.relic).n)}»</p>` : arg.token ? `<p class="rl-bonus">і жетон ${arg.token === "reroll" ? "перекидання" : "відстрочки"}</p>` : ""}
        <button type="button" class="btn btn--gold" data-gd="close">${arg.relic ? "Подивитися реліквію" : "Забрати"}</button>`;
        if (arg.relic) reveals.unshift({ id: arg.relic, why: "З недільної скрині" });
        return; }
      if (arg.bless) el.innerHTML = `${grip}<div class="gs-kicker">Благословення</div><div class="gd-bless">✦</div><div class="sheet__title dy-sht">Золото ×2</div><p class="dy-note dy-note--t">«${esc(arg.why)}» — Орден подвоїв нагороду: <b>+${fmtN(arg.g)}</b> золота понад звичне.</p><button type="button" class="btn btn--gold" data-gd="close">Дякую</button>`;
      else if (arg.dup) el.innerHTML = `${grip}<div class="gs-kicker">Реліквія</div><div class="sheet__title dy-sht">${esc(relic(arg.id).n)} — уже є</div><p class="dy-note dy-note--t">Сенешаль переплавив дублікат: <b>+${fmtN(arg.g)}</b> золота.</p><button type="button" class="btn btn--gold" data-gd="close">Добре</button>`;
      else { const r = relic(arg.id); el.innerHTML = `${grip}<div class="gs-kicker rl-k--${r.rar}">нова ${RN[r.rar]} реліквія</div><div class="rl-big rl--${r.rar} is-new">${face(r, "rl-face")}</div>
        <div class="sheet__title dy-sht">${esc(r.n)}</div><p class="rl-bonus">${esc(bonusText(r.bonus))}</p><p class="dy-note dy-note--t rl-lore">${esc(r.lore)}</p>${arg.why ? `<p class="tr-at">${esc(arg.why)}</p>` : ""}
        <p class="dy-note">${G.eq.includes(r.id) ? "Уже на тобі — одне з трьох місць." : "Усі три місця зайняті — можна замінити в колекції."}</p><button type="button" class="btn btn--gold" data-gd="close">Прийняти</button>`; }
    }
  }
  function lootHTML(L) {
    if (L.kind === "relic") { const r = relic(L.id); return `<div class="rl-big rl--${r.rar} is-new">${face(r, "rl-face")}</div><div class="sheet__title dy-sht">${esc(r.n)}</div><p class="rl-bonus">${RN[r.rar]} реліквія · ${esc(bonusText(r.bonus))}</p><p class="dy-note dy-note--t rl-lore">${esc(r.lore)}</p>`; }
    if (L.kind === "token") return `<div class="gd-bless">${L.t === "reroll" ? "🎲" : "⏳"}</div><div class="sheet__title dy-sht">Жетон ${L.t === "reroll" ? "перекидання" : "відстрочки"}</div><p class="dy-note dy-note--t">${L.t === "reroll" ? "Наступне непотрібне доручення можна буде замінити." : "Будь-який активний квест — на день довше."}</p>`;
    return `<div class="gd-big">${coin("gd-coin--big")}<b>+${fmtN(L.g)}</b></div><div class="sheet__title dy-sht">${L.jack ? "СКАРБ!" : L.g >= 250 ? "Щедра скриня" : "Золото"}</div><p class="dy-note dy-note--t">${L.jack ? "Сенешаль мовчки дивиться на скриню. Таке трапляється раз на сотню." : "Сенешаль перелічує монети й киває."}</p>`;
  }
  /* скриня: звичайний випадок (Math.random) — здобич записується в синхронізовану книгу */
  function openChest() {
    const x = Math.random(), id = "c" + Date.now().toString(36);
    let L;
    if (x < 0.01) L = { kind: "gold", g: 1500, jack: true };
    else if (x < 0.10) L = { kind: "gold", g: 250 + Math.floor(Math.random() * 251) };
    else if (x < 0.35) { const rr = Math.random(), R = rr < 0.01 ? "myth" : rr < 0.1 ? "legend" : rr < 0.4 ? "rare" : "common", rid = randomRelic(R); L = rid ? { kind: "relic", id: rid } : { kind: "gold", g: 150 }; }
    else if (x < 0.50) L = { kind: "token", t: "reroll" };
    else if (x < 0.60) L = { kind: "token", t: "extend" };
    else L = { kind: "gold", g: 60 + Math.floor(Math.random() * 141) };
    if (L.kind === "gold") G.inc[id] = { at: Date.now(), amt: L.g, why: L.jack ? "скарб зі скрині" : "зі скрині Сенешаля" };
    if (L.kind === "token") G.tk[id] = { kind: L.t, d: 1, at: Date.now() };
    if (L.kind === "relic") { const r = grant(L.id, "скриня Сенешаля"); if (r && r.dup) L = { kind: "gold", g: r.g }; }
    save(); return L;
  }
  function onSheet(e) {
    const v = e.target.closest("[data-gdv]"); if (v) { amt = +v.dataset.gdv; render("out"); return; }
    const buy = e.target.closest("[data-gdbuy]");
    if (buy) {
      const it = SHOP.find((s) => s.id === buy.dataset.gdbuy); if (!it || balance() < it.p) return;
      G.out["s" + Date.now().toString(36)] = { at: Date.now(), amt: it.p, kind: "shop", st: "done", item: it.n };
      if (it.id === "chest") { save(); render("chest"); fx("open"); setTimeout(() => { const L = openChest(); render("loot", L); fx(L.kind === "relic" || L.jack ? "date" : "yes"); }, 1600); return; }
      G.tk["t" + Date.now().toString(36)] = { kind: it.id, d: 1, at: Date.now() }; save(); fx("yes"); render("shop"); return;
    }
    const eq = e.target.closest("[data-rleq]");
    if (eq) { const id = eq.dataset.rleq; G.eq = G.eq.includes(id) ? G.eq.filter((x) => x !== id) : G.eq.concat(id).slice(0, SLOTS); G.eqAt = Date.now(); save(); fx("yes"); render("relic", id); return; }
    const sw = e.target.closest("[data-rlswap]");
    if (sw) { const [nid, old] = sw.dataset.rlswap.split("|"); G.eq = G.eq.map((x) => (x === old ? nid : x)); G.eqAt = Date.now(); save(); fx("yes"); render("relic", nid); return; }
    const b = e.target.closest("[data-gd]"); if (!b) return;
    const a = b.dataset.gd;
    if (a === "close") { close(); return; }
    if (a === "ok") {
      if (!(amt > 0 && amt <= balance())) return;
      G.out["o" + Date.now().toString(36)] = { at: Date.now(), amt, kind: "white", st: "pending" }; save();
      fx("yes"); render("sent"); refreshViews(); watchBank();
    }
  }
  /* відкриття реліквії чи благословення — коли екран вільний (не посеред сцени, ритуалу чи іншого аркуша); інакше — пізніше */
  let revealT = 0;
  function nextReveal() {
    clearTimeout(revealT); if (!reveals.length) return;
    const intro = $("intro");
    if (document.hidden || document.querySelector(".sheet.open, .hall.open, .rite.open, .confirm.open") || (intro && !intro.hasAttribute("hidden"))) { revealT = setTimeout(nextReveal, 4000); return; }
    const nx = reveals[0];
    if (nx && nx.id && !nx.dup && !ART[nx.id] && !nx.waited) { nx.waited = 1; loadArts(); revealT = setTimeout(nextReveal, 2500); return; }   // спершу — справжній арт
    show("reveal", reveals.shift()); fx("date");
  }
  /* швидка звірка з банком. Орден не бачить переказу, доки GitHub не стягне свіжу виписку з монобанку (~40–60 с на запит),
     тож поки є виведення в дорозі — просимо виписку кілька разів (не частіше ніж раз на ~90 с: ліміт API банку) і перечитуємо її між запитами.
     Також — одразу, щойно повертаєшся в Орден після монобанку, і кнопкою «Оновити». */
  let lastAsk = 0, syncing = false;
  function askBank() { const V = window.ORDO_VAULT; if (!V || !V.dispatch || Date.now() - lastAsk < 85e3) return; lastAsk = Date.now(); LS.set("ordo.k.bankAsk", Date.now()); V.dispatch("bank"); }
  async function readBank() {
    if (T() && T().load) await T().load(true);
    if (reconcile()) { refreshViews(); const d = Object.values(G.out).filter((o) => o.done && Date.now() - o.done < 60 * 60e3).sort((a, b) => b.done - a.done); if (d.length) toast(`${coin()}<b>${fmtN(d[0].amt)} ₴</b> на білій картці`); }
    else if (syncing) refreshViews();
  }
  function watchBank(manual) {
    polls.forEach(clearTimeout); polls = [];
    syncing = true; refreshViews(); askBank();
    const asks = [100, 220, 400], reads = [45, 65, 85, 150, 170, 270, 290, 450, 470, 600];
    asks.forEach((s) => polls.push(setTimeout(() => { if (manual && s > 100 && !pending().length) return; if (pending().length || manual) askBank(); }, s * 1000)));
    reads.forEach((s, i) => polls.push(setTimeout(async () => { if (!pending().length && !manual && i > 2) return; await readBank(); if (i === reads.length - 1 || (manual && i >= 2 && !pending().length)) { syncing = false; refreshViews(); } }, s * 1000)));
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && pending().length) { if (Date.now() - lastAsk > 30e3) lastAsk = 0; watchBank(); } });     // повернувся з монобанку — одразу питаємо банк
  function refreshViews() { const A = API(); if (A.renderTreasury && A.tab && A.tab() === "treasury") A.renderTreasury(); if (DAY() && DAY().render) DAY().render(); }

  document.addEventListener("click", (e) => {
    if (!e.target.closest || e.target.closest("#gdSheet")) return;
    const sy = e.target.closest("[data-gd='sync']"); if (sy) { lastAsk = 0; watchBank(true); return; }
    const b = e.target.closest("[data-gd='out'], [data-gd='shop']"); if (b) { amt = 0; show(b.dataset.gd); return; }
    const r = e.target.closest("[data-rl]"); if (r) { show("relic", r.dataset.rl); return; }
    const x = e.target.closest("[data-rlx]"); if (x) show("locked", x.dataset.rlx);
  });
  setTimeout(() => { if (pending().length) watchBank(); }, 6000);       // виведення в дорозі, а додаток перезапустили — стежимо далі

  /* подарунок у події писаря: { gift: "id реліквії" } — один раз на подію */
  function gift(id, ev) {
    if (!relic(id) || G.proc["ev:" + ev]) return;
    G.proc["ev:" + ev] = 1; const r = grant(id, "подія"); save();
    if (r) { reveals.push(Object.assign(r, { why: "Дар храмовника" })); setTimeout(nextReveal, 800); }
  }
  setTimeout(loadArts, 5000);
  /* золото за конкретний запис книги досвіду (з бонусом реліквій і благословенням) — для розшифровки дня */
  const goldFor = (id) => { const x = ledger().find((y) => y.id === id); return x ? x.g + (G.bon["rb:" + id] || 0) + (G.bon["bl:" + id] || 0) : 0; };
  window.ORDO_GOLD = { html, chip, tick, balance, earned, reconcile, coin, can, use, tokens, artName, gift, scene, goldFor };
})();
