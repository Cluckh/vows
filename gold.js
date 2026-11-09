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
  const addDay = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); const p2 = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const weekKey = (k) => { const d = new Date(k + "T12:00:00"); const t = new Date(d); t.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(t.getFullYear(), 0, 4);
    return `${t.getFullYear()}-W${p2(1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7))}`; };
  const fx = (s) => { const A = API(); if (A.FX) { if (A.FX.play) A.FX.play(s); if (A.FX.buzz) A.FX.buzz(s === "yes" ? "medium" : "light"); } };

  const START = "2026-11-08";                                  // нова економіка: золото, жетони й виведення до 8.11 обнулено (власник, 8.11)
  const START_T = Date.parse(START + "T00:00:00+02:00") / 1000;
  const RN = { common: "звичайна", rare: "рідкісна", legend: "легендарна", myth: "міфічна" };
  const DROP = { rare: 0.15, legend: 0.4, myth: 1 };          // шанс спорядження за виконаний квест
  const TOKEN_Q = { rare: 0.2, legend: 0.35, myth: 0.6 };      // шанс жетона (перекидання, відстрочка, друге дихання, печатка) чи еліксиру за виконаний квест
  const BLESS = 0.05;
  const CHEST_Q = 0.12;                                        // шанс несподіваної скрині за виконаний квест (писар може дати й напевно: chest: true)                                          // базовий шанс благословення
  /* місця для реліквій: 3, далі — за званням (D.PERKS.slots: Лицар Хреста — 4-те, Маршал — 5-те) */
  const rankIdx = () => { const Dy = DAY(), lv = Dy && Dy.levelOf ? Dy.levelOf() : null; return lv ? lv.ri : 0; };
  const slots = () => 5;                                                          // спорядження: 5 слотів (шолом, обладунок, меч, щит, реліквія)
  const rankName = (i) => { const Dy = DAY(), R = Dy && Dy.ranks ? Dy.ranks() : []; return (R[i] || {}).name || ""; };
  /* крамниця: базові товари + те, що відкриває звання (D.PERKS.shop) */
  const shopItems = () => SHOP.concat(((D().PERKS || {}).shop || []).map((x) => Object.assign({ perk: 1 }, x)));
  const SHOP = [
    /* золото = гривні білої картки: у крамниці — лише дешеві корисні дрібниці, ціна — частка того, що вони рятують. Скринь за гроші нема:
       скрині — тільки нагорода (рівень, недільна, від храмовників, зрідка за квест) */
    { id: "reroll", n: "Жетон перекидання", p: 60, d: "Не твоє доручення? Попроси в храмовника інше." },
    { id: "extend", n: "Жетон відстрочки", p: 120, d: "+1 день до активного квесту — щоб не втратити 300–2000 золота за день." },
    { id: "scroll", n: "Пергамент доручення", p: 200, d: "Верховний одразу пропонує легендарний квест (800 золота, якщо виконаєш). Раз на тиждень." }
  ];

  /* G синхронізується між пристроями (boot.js обʼєднує кожен розділ):
     out — виведення й покупки, inc — здобич зі скринь, bon — бонуси реліквій і благословення, proc — уже оброблені записи досвіду,
     own — реліквії, eq — активні (eqAt — коли змінено), tk — жетони (+1 куплено / −1 використано), use — використання бонусів реліквій */
  let G = LS.get("ordo.gold", null) || {};
  ["out", "inc", "bon", "proc", "own", "tk", "use", "uns"].forEach((k) => { G[k] = G[k] || {}; });
  const START_MS = Date.parse(START + "T00:00:00+02:00"), fresh = (x) => ((x && x.at) || 0) >= START_MS;      // запис нової економіки
  G.eq = G.eq || [];
  const save = () => LS.set("ordo.gold", G);
  /* 26.10: покупки в крамниці й здобич зі скринь під час тестів — не рахуються. Чиститься на кожному пристрої й при кожному злитті (boot.js), тож не воскресне */
  const TEST_CUT = 1793040399831;
  const REFUND_AT = 1793116200000;      // 27.10, 17:50 за Києвом: власник попросив повернути невикористані куплені жетони золотом
  function purge(g) {
    const old = (o) => !!o && (o.at || 0) < TEST_CUT; let n = 0;
    /* відкат 27.10: реліквія, бонуси й скриня за закритий квест «Не міняти Орден»; рівень і його нагороди, яких тепер нема */
    const Dy = DAY(), rw = Dy && Dy.rwAt ? Dy.rwAt() : 0;
    if (rw) {
      const st = Dy._state ? Dy._state() : null, QL = st && st.Q ? st.Q.list : [], ids = QL.filter((q) => q.pid === "w-m-no-change" && q.st === "void").map((q) => q.id);
      Object.keys(g.own || {}).forEach((k) => { const o = g.own[k]; if (/Не міняти Орден/.test(o.src || "") && (o.at || 0) < rw) { delete g.own[k]; n++; if (g.eq) g.eq = g.eq.filter((x) => x !== k); } });
      ids.forEach((id) => { ["proc", "bon"].forEach((b) => Object.keys(g[b] || {}).forEach((k) => { if (k.includes("q:" + id)) { delete g[b][k]; n++; } }));
        ["inc", "tk"].forEach((b) => Object.keys(g[b] || {}).forEach((k) => { if (k.includes("q:" + id) && (g[b][k].at || 0) < rw) { delete g[b][k]; n++; } })); });
      const rw2 = Dy.rwAt2 ? Dy.rwAt2() : 0;
      if (rw2) ["use", "tk"].forEach((b) => Object.keys(g[b] || {}).forEach((k) => { const o = g[b][k]; if (o.kind === "extend" && (o.at || 0) >= rw && (o.at || 0) < rw2 && (b === "use" || o.d < 0)) { delete g[b][k]; n++; } }));   // відстрочки на обітниці-квесті — назад
      const lv = Dy.levelOf ? Dy.levelOf() : null;
      if (lv && g.lv > lv.L) {
        for (let L = lv.L + 1; L <= g.lv; L++) {
          if (g.inc && g.inc["lv:" + L] && (g.inc["lv:" + L].at || 0) < rw) delete g.inc["lv:" + L];
          if (g.tk && g.tk["lv:" + L] && (g.tk["lv:" + L].at || 0) < rw) delete g.tk["lv:" + L];
          if (g.proc) delete g.proc["chest:lv:" + L];
          ["inc", "tk"].forEach((b) => { if (g[b] && g[b]["gc:lv:" + L] && (g[b]["gc:lv:" + L].at || 0) < rw) delete g[b]["gc:lv:" + L]; });
          Object.keys(g.own || {}).forEach((k) => { const o = g.own[k]; if (o.src === "дарована скриня" && (o.at || 0) < rw && (o.at || 0) > rw - 6 * 3600e3) { delete g.own[k]; if (g.eq) g.eq = g.eq.filter((x) => x !== k); } });
        }
        g.lv = lv.L; g.ri = lv.ri; n++;
      }
    }
    Object.keys(g.out || {}).forEach((k) => { if (g.out[k].kind === "shop" && old(g.out[k])) { delete g.out[k]; n++; } });
    /* повернення жетонів 27.10: куплені до REFUND_AT і не витрачені — покупку скасовано, золото назад.
       Витрачені рахуємо спершу з дарованих (рівні, скрині). Лише дані до REFUND_AT — тож на всіх пристроях і після злиття однаково */
    const kindOf = {}; shopItems().forEach((it) => { if (it.id !== "chest" && it.id !== "cmdchest") kindOf[it.n] = it.id; });
    const TK = g.tk || {}, OUT = g.out || {}, pre = (o) => (o.at || 0) < REFUND_AT && !old(o);
    [...new Set(Object.values(kindOf))].forEach((kind) => {
      const buys = Object.keys(OUT).filter((k) => OUT[k].kind === "shop" && kindOf[OUT[k].item] === kind && pre(OUT[k])).sort((x, y) => OUT[y].at - OUT[x].at);
      const got = Object.keys(TK).filter((k) => k[0] === "t" && TK[k].kind === kind && TK[k].d > 0 && pre(TK[k])).sort((x, y) => TK[y].at - TK[x].at);
      if (!buys.length || !got.length) return;
      const used = Object.values(TK).filter((o) => o.kind === kind && o.d < 0 && pre(o)).length;
      const free = Object.keys(TK).filter((k) => k[0] !== "t" && TK[k].kind === kind && TK[k].d > 0 && pre(TK[k])).length;
      const r = Math.min(buys.length, got.length) - Math.max(0, used - free);
      for (let i = 0; i < r; i++) { delete OUT[buys[i]]; delete TK[got[i]]; n++; }
    });
    /* одне поповнення білої — одне виведення: пристрій без кнопкового запиту (ще не синхронізований) записав його як «поповнив сам»,
       а інший — як виконаний запит; після злиття було два записи на ту саму транзакцію */
    const O = g.out || {};
    Object.keys(O).filter((k) => O[k].auto && O[k].tx).forEach((k) => {
      const w = O[k], j = Object.keys(O).find((x) => x !== k && !O[x].auto && O[x].kind === "white" &&
        ((O[x].tx === w.tx && O[x].st === "done") || (O[x].st === "pending" && !O[x].tx && O[x].amt === w.amt && O[x].at <= w.at + 60e3)));
      if (!j) return;
      if (!O[j].tx) Object.assign(O[j], { st: "done", tx: w.tx, done: w.at });
      delete O[k]; n++;
    });
    Object.keys(g.inc || {}).forEach((k) => { if (/^(c|dup:)/.test(k) && old(g.inc[k])) { delete g.inc[k]; n++; } });
    Object.keys(g.tk || {}).forEach((k) => { if (/^[tc]/.test(k) && old(g.tk[k])) { delete g.tk[k]; n++; } });
    const gone = Object.keys(g.own || {}).filter((k) => g.own[k].src === "скриня Сенешаля" && old(g.own[k]));
    gone.forEach((k) => { delete g.own[k]; n++; }); if (gone.length && g.eq) g.eq = g.eq.filter((x) => !gone.includes(x));
    return n;
  }
  if (purge(G)) save();

  /* жетони й скриня — іконками, не емодзі */
  const TKN = { reroll: "reroll", extend: "hourglass", chest: "chest", breath: "breath", rest: "moon", cmdchest: "chest", elixir: "breath", scroll: "scroll" };
  const tkIc = (kind, cls) => { const a = ART["shop:" + kind];                      // арт товару (якщо вже є), інакше — іконка
    return a ? `<span class="gd-tk gd-tk--art gd-tk--${kind}${cls ? " " + cls : ""}"><img src="${a}" alt=""></span>` : `<span class="gd-tk gd-tk--${kind}${cls ? " " + cls : ""}"><svg><use href="#i-${TKN[kind] || kind}"/></svg></span>`; };
  const coin = (cls) => `<svg class="gd-coin${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5"/><path d="M12 8.5v7M9.5 12h5"/></svg>`;
  const gem = (r, cls) => `<svg class="rl-gem rl-gem--${r}${cls ? " " + cls : ""}" viewBox="0 0 48 48" aria-hidden="true"><path class="rl-g1" d="M24 4 41 16 34 42H14L7 16Z"/><path class="rl-g2" d="M7 16h34M24 4l-7 12 7 26 7-26-7-12M14 42l3-26M34 42l-3-26"/></svg>`;
  const relics = () => D().RELICS || [];
  const MK = (h) => (window.ORDO_MARK ? window.ORDO_MARK(h) : h);                // слова рідкості — кольором
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
    if (E.day[p]) return Math.round(E.day[p][1] * (e.mul || 1));          // ×0,5 у день Lay on Hands, ×1,5 — Відродження                                           // ідеальний день, зал, сповідь, кроки, підйом
    if (p === "v") return E.vowDay[1];                                          // чистий день обітниці
    if (p === "a") return E.achGold ? E.achGold(e.xp0 || e.xp) : E.ach[1];              // нагорода: золото за складністю (досвід × 2, від 50)
    if (p === "mo") return e.gold || 0;                                           // нагорода за момент від писаря
    if (p === "g") return e.xp >= 400 ? 300 : 80;                               // старі записи цілей без ціни
    if (p === "gm") return Math.round(e.xp / 2);                                // ревю: відсоток виконаного
    if (p === "vm") { const m = +id.split(":")[2], v = E.milestone[m]; return v ? v[1] : Math.round(m * 1.5); }
    if (p === "q") { const q = Q.list.find((x) => "q:" + x.id === id), b = (E.quest[q && q.rar] || E.quest.rare)[1]; return q && q.st === "part" ? Math.round(b * Math.min(1, (q.cur || 0) / (q.target || 1)) * 0.6) : b; }     // частково — як і досвід: частка прогресу × 0.6
    return 0;
  }
  const CAT = { mo: "day", pd: "day", jr: "day", t: "day", gy: "body", st: "body", er: "body", q: "quest", vm: "vow", v: "vow" };
  function ledger() {
    const Dy = DAY(); if (!Dy || !Dy._state) return [];
    const { X, Q, S } = Dy._state();
    return Object.entries(X.e || {}).filter(([, e]) => e.d >= START).map(([id, e]) => ({ id, d: e.d, why: e.why, g: goldOf(id, e, Q, S) })).filter((x) => x.g > 0);
  }
  const sum = (o) => Object.values(o).reduce((a, x) => a + (typeof x === "number" ? x : x.amt || 0), 0);
  const earned = () => { const L = ledger(), ids = new Set(L.map((x) => x.id));
    const bon = Object.entries(G.bon).filter(([k]) => ids.has(k.replace(/^(rb|bl):/, ""))).reduce((a, [, v]) => a + (typeof v === "number" ? v : v.amt || 0), 0);
    return L.reduce((a, x) => a + x.g, 0) + bon + Object.values(G.inc).filter(fresh).reduce((a, x) => a + (x.amt || 0), 0); };
  const VOID = new Set(["Dgfr0npIMXPwnwND1g", "V3fxyJBNAJgM_mQqIg"]);   // тестові перекази 26.10 (3 ₴ і 1 ₴) — до старту золота, не рахуються
  const live = (o) => o.st !== "cancel" && !VOID.has(o.tx);
  const spent = () => Object.values(G.out).filter((o) => live(o) && fresh(o)).reduce((a, o) => a + o.amt, 0);
  const balance = () => earned() - spent();
  const pending = () => Object.values(G.out).filter((o) => o.kind === "white" && o.st === "pending");

  /* ---------------------------------------------------------------- реліквії */
  const equipped = () => G.eq.map(relic).filter(Boolean);
  /* спорядження (з 8.11): 5 слотів — у кожному один предмет; fx — список ефектів (старі записи — bonus) */
  const effects = (r) => (r && (r.fx || (r.bonus ? [r.bonus] : []))) || [];
  const SLOTS = () => D().SLOTS || [{ id: "helm", n: "Шолом" }, { id: "armor", n: "Обладунок" }, { id: "sword", n: "Меч" }, { id: "shield", n: "Щит" }, { id: "trinket", n: "Реліквія" }];
  const slotOf = (r) => (r && r.slot) || "trinket";
  const inSlot = (s) => equipped().find((r) => slotOf(r) === s) || null;
  const hasCd = (r) => effects(r).some((b) => b.type === "reroll" || b.type === "extend");
  /* на вдягненій реліквії перекидання / відстрочки — чи готова вона зараз (ліміт спільний для всіх вдягнених того ж типу) */
  const cdText = (r) => { const b = effects(r).find((x) => x.type === "reroll" || x.type === "extend"); return !b ? "" : relicLeft(b.type) > 0 ? " · готова" : ` · знову ${b.type === "reroll" ? "з понеділка" : "з 1-го числа"}`; };
  const bonusOf = (type, src) => equipped().reduce((a, r) => a + effects(r).filter((b) => b.type === type && (!src || b.src === "all" || b.src === src)).reduce((s, b) => s + (b.v || 0), 0), 0);
  function grant(id, src) {
    if (!relic(id)) return null;
    if (G.own[id]) {                                           // дублікат — переплавка в золото
      const g = { common: 100, rare: 250, legend: 600, myth: 1500 }[relic(id).rar];
      G.inc["dup:" + id + ":" + Date.now()] = { at: Date.now(), amt: g, why: `переплавлено: ${relic(id).n}` };
      return { dup: true, id, g };
    }
    G.own[id] = { at: Date.now(), src };
    if (!inSlot(slotOf(relic(id)))) { G.eq.push(id); G.eqAt = Date.now(); }       // слот порожній — вдягається сам
    return { id };
  }
  /* випадкова реліквія з тих, яких ще нема (без таємних — ті тільки за подвиги); рідкість не вища за maxR, частіше — саме maxR */
  function randomRelic(maxR, seed, minR) {
    const order = ["common", "rare", "legend", "myth"], top = order.indexOf(maxR), low = minR ? order.indexOf(minR) : 0;
    const pool = relics().filter((r) => !r.secret && !G.own[r.id] && order.indexOf(r.rar) <= top && order.indexOf(r.rar) >= low);
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
  /* ще тягнемо копію з іншого пристрою (або вона вже тут, а памʼять стара) — нагороди, подвиги й скрині не рахуємо: інакше видамо вдруге те, що вже видано там */
  const held = () => !!(window.ORDO_VAULT && window.ORDO_VAULT.hold && window.ORDO_VAULT.hold());
  let heldT = null;
  function process() {
    const Dy = DAY(); if (!Dy || !Dy._state || !relics().length) return false;
    if (held()) { clearTimeout(heldT); heldT = setTimeout(() => { if (process()) { save(); refreshViews(); setTimeout(nextReveal, 600); } }, 2000); return false; }
    const { Q } = Dy._state(); let ch = false;
    if (purge(G)) ch = true;                                     // відкат 27.10 — коли День уже порахував рівень
    if (!G.v2 && relics().some((r) => r.slot)) {                // 8.11: реліквії → спорядження тієї ж рідкості; усе знято — вдягаєш сам
      const MV = D().RELIC_MOVE || {};
      Object.keys(G.own).forEach((id) => { const to = MV[id]; if (to && relic(to)) { if (!G.own[to]) G.own[to] = { at: Date.now(), src: `перековано: ${id}` }; delete G.own[id]; } else if (!relic(id)) delete G.own[id]; });
      G.eq = []; G.eqAt = Date.now(); G.v2 = 1; G.starter = 1; ch = true;
    }
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
        if (q && q.st === "done" && (q.chest || roll("chest" + x.id) < CHEST_Q)) freeChest("q:" + q.id, `За квест «${q.t}»`, q.chest ? "Скриня за квест" : "Несподівана скриня");
        if (q && q.st === "done" && roll("tok" + x.id) < (TOKEN_Q[q.rar] || 0)) {        // зрідка — жетон чи еліксир (той самий на всіх пристроях)
          const y = roll("tokk" + x.id), t = y < 0.3 ? "reroll" : y < 0.6 ? "extend" : y < 0.75 ? "breath" : y < 0.9 ? "rest" : "elixir";
          if (t === "elixir") G.elix = Object.assign({}, G.elix, { [addDay(today(), 1)]: Date.now() }); else G.tk["qt:" + x.id] = { kind: t, d: 1, at: Date.now() };
          reveals.push({ loot: { kind: "token", t }, kicker: `За квест «${q.t}»` });
        }
        if (q && q.st === "done" && roll("relic" + x.id) < (DROP[q.rar] || 0)) { const id = randomRelic(q.rar, "pick" + x.id); if (id) { const r = grant(id, `квест «${q.t}»`); if (r) reveals.push(Object.assign(r, { why: `За квест «${q.t}»` })); } }
      }
    });
    secrets().forEach((id) => { const r = grant(id, "таємний подвиг"); if (r) reveals.push(Object.assign(r, { why: relic(id).hint })); ch = true; });
    /* церемонія рівня: за кожен новий рівень — золото (200 + 40 × рівень, шкала 8.11), за нове звання — ще й спорядження */
    const lv = Dy.levelOf ? Dy.levelOf() : null;
    if (lv) {
      if (G.lv == null) { G.lv = lv.L; G.ri = lv.ri; ch = true; }
      else if (lv.L > G.lv) {
        for (let L = G.lv + 1; L <= lv.L; L++) {
          const g = 200 + 40 * L; G.inc["lv:" + L] = { at: Date.now(), amt: g, why: `рівень ${L}` };
          const up = { level: L, rank: L === lv.L ? lv.rank.name : "", g, newRank: L === lv.L && lv.ri > (G.ri || 0), page: L <= 30 ? L : null };
          if (L % 2 === 1) { const kd = L % 4 === 1 ? "reroll" : "extend"; G.tk["lv:" + L] = { kind: kd, d: 1, at: Date.now() }; up.token = kd; } else up.lvChest = true;   // непарний — жетон, парний — скриня
          if (up.newRank) { const id = randomRelic(lv.ri >= 6 ? "legend" : "rare", "rank" + lv.ri); if (id) { const r = grant(id, `звання «${lv.rank.name}»`); if (r && !r.dup) up.relic = id; } }
          reveals.push(up);
          if (up.lvChest) freeChest("lv:" + L, `За ${L}-й рівень`, "Скриня рівня");
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
  const dayOf = (ms) => { const d = new Date(ms), p2 = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  /* поповнення білої, про які ще не спитали (не частіше ніж раз на 6 год, якщо відклав) */
  const unsealed = () => Object.entries(G.uns).filter(([, u]) => u.st === "ask" && Date.now() - (u.later || 0) > 6 * 3600e3).map(([id, u]) => Object.assign({ id }, u)).sort((a, b) => a.at - b.at);
  function setUnsealed(id, st) { const u = G.uns[id]; if (!u) return; if (st === "later") u.later = Date.now(); else { u.st = st; u.ans = Date.now(); } save(); }
  function reconcile() {
    const W = T() && T().white && T().white(); if (!W) return false;
    let ch = false;
    const linked = new Set(Object.values(G.out).map((o) => o.tx).filter(Boolean));
    (W.in || []).filter((t) => t.t >= START_T && !linked.has(t.id) && !G.uns[t.id]).sort((a, b) => a.t - b.t).forEach((t) => {
      const amt = Math.round(t.a / 100);
      const p = pending().sort((a, b) => (a.amt === amt ? -1 : 0) - (b.amt === amt ? -1 : 0) || a.at - b.at)[0];
      if (p) Object.assign(p, { st: "done", amt, tx: t.id, done: t.t * 1000 });                       // очікуване виведення прийшло (можна й іншою сумою)
      /* поповнення без виводу золота: 8.11 — стартові 10 000 (останні власні); далі — Скарбник спитає (кешаут покеру, повернення чи зрив Скарбниці) */
      else G.uns[t.id] = { at: t.t * 1000, amt, st: dayOf(t.t * 1000) === START ? "seed" : "ask" };
      ch = true;
    });
    pending().forEach((p) => { if (Date.now() - p.at > 24 * 3600e3) { p.st = "cancel"; ch = true; } });   // доба без поповнення — золото повертається
    if (ch) save();
    return ch;
  }

  /* ------------------------------------------------- жетони й бонуси квестів */
  const tokens = (kind) => Object.values(G.tk).filter((t) => t.kind === kind && fresh(t)).reduce((a, t) => a + t.d, 0);
  const relicLeft = (kind) => {                                 // скільки разів ще можна цього тижня (перекидання) чи місяця (відстрочка)
    const per = kind === "reroll" ? weekKey(today()) : today().slice(0, 7), cap = bonusOf(kind);
    const used = Object.values(G.use).filter((u) => u.kind === kind && u.per === per && fresh(u)).length;
    return Math.max(0, cap - used);
  };
  const can = (kind) => relicLeft(kind) > 0 || tokens(kind) > 0;
  /* звідки візьметься наступне перекидання / відстрочка — видно ще до натискання: реліквія (поки не вичерпано тижня / місяця), потім жетон */
  function srcInfo(kind) {
    const rs = equipped().filter((r) => effects(r).some((b) => b.type === kind)), left = relicLeft(kind), tk = tokens(kind);
    return { relics: rs.map((r) => r.n), cap: bonusOf(kind), left, tk, from: left > 0 ? "relic" : tk > 0 ? "token" : null,
      per: kind === "reroll" ? "цього тижня" : "цього місяця", renew: kind === "reroll" ? "з понеділка" : "з 1-го числа" };
  }
  const srcShort = (kind) => { const s = srcInfo(kind); return s.from === "relic" ? "спорядження" : s.from === "token" ? `жетон ×${s.tk}` : ""; };
  function srcLabel(kind) {
    const s = srcInfo(kind), nm = s.relics.map((n) => `«${n}»`).join(", ");
    if (s.from === "relic") return `Спорядження ${nm}: ще ${s.left} з ${s.cap} ${s.per}. Жетони не витрачаються.`;
    if (s.relics.length) return `Спорядження ${nm}: ${s.per} вже використано — знову ${s.renew}.${s.tk ? ` Зараз піде жетон (у тебе ${s.tk}).` : ""}`;
    return s.tk ? `Піде жетон (у тебе ${s.tk}).` : "";
  }
  /* повертає текст «чим заплачено» (truthy) або false; quiet — без власного тосту (викликач покаже його разом зі своїм) */
  function use(kind, quiet) {
    const w = kind === "reroll" ? "перекидання" : "відстрочку", s = srcInfo(kind); let m;
    if (s.left > 0) { G.use["u" + Date.now().toString(36)] = { kind, per: kind === "reroll" ? weekKey(today()) : today().slice(0, 7), at: Date.now() };
      m = `${s.relics.map((n) => `«${esc(n)}»`).join(", ")}: ${w} використано${s.left > 1 ? ` · ще ${s.left - 1} ${s.per}` : ` · знову ${s.renew}`}`; }
    else if (s.tk > 0) { G.tk["t" + Date.now().toString(36)] = { kind, d: -1, at: Date.now() }; m = `Жетон: ${w} використано · лишилось ${s.tk - 1}`; }
    else return false;
    save(); if (!quiet) toast(`${tkIc(kind)} ${m}`); return m;
  }

  /* ----------------------------------------------------------------- відгук */
  function toast(html) { let el = $("dyToast"); if (!el) { el = document.createElement("div"); el.id = "dyToast"; document.body.appendChild(el); } el.className = "dy-toast dy-toast--gold"; el.innerHTML = html; void el.offsetWidth; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2600); }
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
  const bonusText = (b) => !b ? "" : b.type === "gold" ? `+${Math.round(b.v * 100)}% золота ${({ all: "за все", day: "за справи, ідеальні дні й сповіді", body: "за зал, кроки й ранні підйоми", quest: "за квести", vow: "за дні й віхи обітниць" })[b.src] || ""}`
    : b.type === "luck" ? `+${Math.round(b.v * 100)}% до шансу благословення` : b.type === "reroll" ? `перекинути квест ${b.v > 1 ? b.v + " рази" : "раз"} на тиждень` : b.type === "extend" ? `+1 день до квесту ${b.v > 1 ? b.v + " рази" : "раз"} на місяць`
    : b.type === "nightGuard" ? "після тривожної ночі ідеальний день прощає одну справу" : b.type === "chainGuard" ? `пропуск не рве ланцюжок справи — ${b.v > 1 ? b.v + " рази" : "раз"} на тиждень`
    : b.type === "questUp" ? "раз на тиждень квест — на рідкість вищий" : b.type === "lohMul" ? `Lay on Hands платить ${Math.round((0.5 + b.v) * 100)}% навіть без зцілення`
    : b.type === "rebirth" ? `Відродження ×${String(1.5 + b.v).replace(".", ",")}` : b.type === "chest" ? "скрині щедріші: здобич частіше рідкісніша" : "";
  const fxText = (r) => effects(r).map(bonusText).filter(Boolean).join(" · ");
  /* арти реліквій: art/sealed/<хеш>.json (зашифровані, з непрозорими назвами — щоб і список файлів нічого не підказував);
     розшифровані кешуються на пристрої (Cache Storage), відсутні — не питаємо частіше ніж раз на 6 год */
  const ART = {};
  /* медалі-нагороди артом: Літопис просить ті, що на екрані; вантажаться у фоні й лягають у кеш (256 px — легкі) */
  /* будь-який арт за ключем «вид:id» (ach, rank, chron, shop, game, book, scene): екран просить — вантажиться у фоні, далі подія ordo-art */
  const WANT = new Set(); let wantT = null;
  const artKey = (key) => ART[key] || null;
  /* повторний запит — наверх черги: те, що екран показує зараз, вантажиться першим */
  function want(keys) { let n = 0; keys.forEach((k) => { if (k && !ART[k]) { if (WANT.has(k)) WANT.delete(k); else n++; WANT.add(k); } }); if (n) { clearTimeout(wantT); const go = () => { if (artBusy) wantT = setTimeout(go, 800); else loadArts(); }; wantT = setTimeout(go, 500); } }
  const achArt = (id) => ART["ach:" + id] || null;
  const wantAch = (ids) => want(ids.map((id) => "ach:" + id));
  const artName = (kind, id) => { let h = 2166136261; const s = kind + ":" + id; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };
  let artBusy = false;
  const SCENES = ["chest", "chestc", "shop", "treasury", "levelup", "night", "weekchest"];
  const scene = (n) => ART["scene:" + n] || null;
  /* арт за запитом (ілюстрації моментів писаря): той самий кеш «ordo-art», що й для реліквій */
  async function artFor(kind, id) {
    const k = kind + ":" + id; if (ART[k]) return ART[k];
    const V = window.ORDO_VAULT; if (!V || !V.readSealedBlob) return null;
    const n = artName(kind, id), req = new Request(`${location.origin}/__art/${n}`);
    let cache = null, blob = null; try { cache = await caches.open("ordo-art"); const r = await cache.match(req); if (r) blob = await r.blob(); } catch (e) {}
    if (!blob) { try { blob = await V.readSealedBlob(`art/sealed/${n}.json`); } catch (e) {} if (blob && cache) { try { await cache.put(req, new Response(blob, { headers: { "Content-Type": blob.type } })); } catch (e) {} } }
    return blob ? (ART[k] = URL.createObjectURL(blob)) : null;
  }
  async function loadArts() {
    const V = window.ORDO_VAULT; if (artBusy || !V || !V.readSealedBlob) return;
    const want = Object.keys(G.own).filter((id) => !ART[id] && relic(id)).map((id) => ["relic", id]).concat(SCENES.filter((x) => !ART["scene:" + x]).map((x) => ["scene", x]))
      .concat([...WANT].filter((k) => !ART[k]).map((k) => [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)]));
    if (!want.length) return;
    artBusy = true; let ch = false;
    const notify = () => {
      const A = API(); if (want.some(([k]) => k !== "relic" && k !== "scene") && A.tab && A.tab() === "stats" && A.renderStats) A.renderStats(); try { window.dispatchEvent(new Event("ordo-art")); } catch (e) {}
      if (el && el.classList.contains("open") && mode === "shop") render("shop");
      refreshViews(); if (el && el.classList.contains("open") && mode === "relic") { const t = el.querySelector("[data-rleq]"); if (t) render("relic", t.dataset.rleq); }
    };
    try {
      let cache = null; try { cache = await caches.open("ordo-art"); } catch (e) {}
      const miss = LS.get("ordo.k.artMiss", {}), reqOf = (n) => new Request(`${location.origin}/__art/${n}`);
      const items = want.map(([kind, id0]) => ({ id: kind === "relic" ? id0 : kind + ":" + id0, n: artName(kind, id0) }));
      /* 1) з кешу — усе разом і одразу на екран */
      const hits = await Promise.all(items.map(async (it) => { if (!cache) return null; try { const r = await cache.match(reqOf(it.n)); return r ? await r.blob() : null; } catch (e) { return null; } }));
      items.forEach((it, i) => { if (hits[i]) { ART[it.id] = URL.createObjectURL(hits[i]); ch = true; } });
      if (ch) notify();
      /* 2) чого нема — зі сховища, по чотири паралельно, і в кеш; що екран попросить тим часом — на початок черги */
      const net = items.filter((it, i) => !hits[i] && !(miss[it.n] && Date.now() - miss[it.n] < 1800e3));
      const seen = new Set(items.map((it) => it.id)); let got = false, shown = Date.now();
      /* наступна — реліквія, далі те, що екран попросив найостанніше (порядок WANT живий: want() піднімає ключ наверх) */
      const next = () => {
        [...WANT].filter((k) => !ART[k] && !seen.has(k)).forEach((k) => { seen.add(k); net.push({ id: k, n: artName(k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)), late: 1 }); });
        if (!net.length) return null;
        const order = [...WANT], rank = (it) => it.id.indexOf(":") < 0 ? 1e9 : order.indexOf(it.id);
        let bi = 0; net.forEach((it, j) => { if (rank(it) > rank(net[bi])) bi = j; }); return net.splice(bi, 1)[0];
      };
      const worker = async () => { for (let it = next(); it; it = next()) { let blob = null;
        if (it.late && cache) { try { const r = await cache.match(reqOf(it.n)); if (r) blob = await r.blob(); } catch (e) {} }
        if (!blob && !(it.late && miss[it.n] && Date.now() - miss[it.n] < 1800e3)) {
          try { blob = await V.readSealedBlob(`art/sealed/${it.n}.json`); } catch (e) {}
          if (blob) { delete miss[it.n]; if (cache) { try { await cache.put(reqOf(it.n), new Response(blob, { headers: { "Content-Type": blob.type } })); } catch (e) {} } } else miss[it.n] = Date.now();
        }
        if (blob) { ART[it.id] = URL.createObjectURL(blob); got = true; if (Date.now() - shown > 800) { shown = Date.now(); notify(); } }     // показуємо поступово, не чекаючи всієї черги
      } };
      await Promise.all([0, 1, 2, 3].map(worker));
      LS.set("ordo.k.artMiss", miss);
      if (got) { ch = true; notify(); }
    } finally { artBusy = false; }
    if (ch && Object.keys(G.own).some((id) => !ART[id] && relic(id))) setTimeout(loadArts, 300);     // реліквія, що зʼявилась посеред завантаження, — наступним колом
  }
  const face = (r, cls) => ART[r.id] ? `<img class="rl-img${cls ? " " + cls : ""}" src="${ART[r.id]}" alt="">` : gem(r.rar, cls);
  function html() {
    reconcile(); process(); setTimeout(loadArts, 50);
    const b = balance(), L = ledger(), mk = today().slice(0, 7);
    let month = L.filter((x) => x.d.startsWith(mk)).reduce((a, x) => a + x.g, 0) + Object.entries(G.bon).filter(([k]) => { const id = k.replace(/^(rb|bl):/, ""); const x = L.find((y) => y.id === id); return x && x.d.startsWith(mk); }).reduce((a, [, v]) => a + v, 0);
    const inMk = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === mk; };
    month += Object.values(G.inc).filter((v) => fresh(v) && inMk(v.at)).reduce((a, v) => a + (v.amt || 0), 0);   // рівні, скрині, недільна скриня, переплавлене — теж заробіток місяця
    const W = T() && T().white && T().white(), pd = pending();
    const full = L.map((x) => ({ d: x.d, t: x.why, g: x.g + (G.bon["rb:" + x.id] || 0) + (G.bon["bl:" + x.id] || 0), bl: !!G.bon["bl:" + x.id] }));
    const small = {}; full.filter((x) => x.g < 10 && !x.bl).forEach((x) => { const o = small[x.d] = small[x.d] || { d: x.d, t: "справи й обітниці дня", g: 0, n: 0 }; o.g += x.g; o.n++; });
    const feed = full.filter((x) => x.g >= 10 || x.bl).concat(Object.values(small))
      .concat(Object.entries(G.inc).map(([, v]) => ({ d: new Date(v.at).toISOString().slice(0, 10), t: v.why, g: v.amt })))
      .sort((a, c) => (c.d > a.d ? 1 : c.d < a.d ? -1 : 0)).slice(0, 5);
    const outs = Object.values(G.out).filter(live).sort((a, c) => c.at - a.at).slice(0, 4);
    const tkR = tokens("reroll"), tkE = tokens("extend");
    let h = `<section class="st-sec gd"><div class="st-h">Золото Ордену</div>${scene("treasury") ? `<img class="gd-scene" src="${scene("treasury")}" alt="">` : ""}
      <div class="gd-big">${coin("gd-coin--big")}<b>${fmtN(Math.abs(b))}</b><span>${b < 0 ? "золота боргу" : "золота"}</span></div>
      ${b < 0 ? `<p class="gd-wait">на білу картку прийшло більше, ніж зароблено, — борг закриється наступним золотом</p>` : ""}
      <div class="tr-row"><span>цього місяця зароблено <b>${fmtN(month)}</b></span>${W && W.bal != null ? `<span>біла картка <b>${fmtN(W.bal / 100)} ₴</b></span>` : ""}</div>
      ${pd.length ? `<p class="gd-wait">в дорозі на білу картку — <b>${fmtN(pd.reduce((a, p) => a + p.amt, 0))} ₴</b> · чекаю на поповнення у виписці</p>` : ""}
      ${tkR || tkE ? `<div class="gd-tks">${tkR ? `<span>${tkIc("reroll")}перекидання <b>${tkR}</b></span>` : ""}${tkE ? `<span>${tkIc("extend")}відстрочки <b>${tkE}</b></span>` : ""}</div>` : ""}
      <div class="dy-acts gd-acts"><button type="button" class="btn btn--gold" data-gd="shop">Крамниця Сенешаля</button><button type="button" class="btn btn--line" data-gd="out" ${b > 0 ? "" : "disabled"}>На білу картку</button></div>
      <button type="button" class="gd-sync" data-gd="sync" ${syncing ? "disabled" : ""}>${syncing ? "оновлюю виписку… (до хвилини)" : `↻ оновити виписку${T() && T().at ? ` · ${(() => { const B = LS.get("ordo.k.bank", {}); return B && B.at ? new Date(B.at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : ""; })()}` : ""}`}</button>
      ${feed.length ? `<div class="st-h st-h--sub">Нещодавно</div><ul class="tr-top gd-list">${feed.map((x) => `<li><span>${x.bl ? "✦ " : ""}${esc(x.t)}</span><b>+${fmtN(x.g)}</b></li>`).join("")}</ul>` : ""}
      ${outs.length ? `<div class="st-h st-h--sub">Виведено й витрачено</div><ul class="tr-top gd-list">${outs.map((o) => `<li><span>${o.kind === "white" ? (o.st === "pending" ? "на білу картку · чекаю" : "на білу картку") : esc(o.item || "крамниця")}</span><b>−${fmtN(o.amt)}</b></li>`).join("")}</ul>` : ""}
      <p class="tr-at">золото — за ідеальні дні, квести, віхи обітниць, цілі, зал. 1 золото = 1 ₴ на білій картці</p></section>`;
    if (relics().length) {
      const own = relics().filter((r) => G.own[r.id]);
      h += `<section class="st-sec rl"><div class="st-h">Спорядження <em class="rl-n">${own.length} / ${relics().length}</em></div>
        <div class="rl-slots rl-slots--5">${SLOTS().map((s) => { const r = inSlot(s.id); return r ? `<button type="button" class="rl-slot is-on rl--${r.rar}" data-rl="${r.id}"><em class="rl-sn">${esc(s.n)}</em>${face(r)}<b>${esc(r.n)}</b><span>${esc(fxText(r))}${cdText(r)}</span></button>` : `<div class="rl-slot"><em class="rl-sn">${esc(s.n)}</em><i>порожньо</i></div>`; }).join("")}</div>
        ${SLOTS().map((s) => { const L = relics().filter((r) => slotOf(r) === s.id); return `<div class="rl-gh">${esc(s.n)}</div><div class="rl-grid">${L.map((r) => G.own[r.id] ? `<button type="button" class="rl-cell rl--${r.rar}${G.eq.includes(r.id) ? " is-eq" : ""}" data-rl="${r.id}" title="${esc(r.n)}">${face(r)}</button>`
          : `<button type="button" class="rl-cell is-locked rl--${r.rar}" data-rlx="${r.id}" title="${r.secret ? "таємне" : "ще не знайдене"}"><span>${r.secret ? "?" : ""}</span></button>`).join("")}</div>`; }).join("")}
        <p class="tr-at">спорядження випадає за квести, зі скринь і за таємні подвиги. По одному предмету в кожному слоті</p></section>`;
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
  function close() { if (!el) return; armId = null; clearTimeout(armT); el.classList.remove("open"); const sc = $("scrim"); if (sc && !document.querySelector(".sheet.open")) sc.classList.remove("open"); refreshViews(); if (reveals.length) setTimeout(nextReveal, 600); }
  const grip = `<div class="sheet__grip"></div>`;
  function render(m, arg) {
    mode = m; const b = balance();
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
      want(shopItems().map((it) => "shop:" + it.id));
      el.innerHTML = `${grip}<div class="gs-kicker">Крамниця Сенешаля</div>${ART["scene:shop"] ? `<img class="gd-scene" src="${ART["scene:shop"]}" alt="">` : ""}<div class="sheet__title dy-sht">«Чесно зароблене — чесно й витрачай»</div>
        <p class="dy-note">У тебе ${coin()}<b>${fmtN(b)}</b></p>
        <ul class="gd-shop">${shopItems().map((it) => { const lock = (it.perk && rankIdx() < it.rank) || (it.id === "scroll" && G.scroll === weekKey(today()));
          return `<li class="${lock ? "is-lock" : ""}">${tkIc(it.id)}<div><b>${esc(it.n)}</b><span>${lock ? (it.id === "scroll" ? "цього тижня вже взято — знову з понеділка" : `відкриється зі званням «${esc(rankName(it.rank))}»`) : esc(it.d)}</span></div>${boughtId === it.id ? `<button type="button" class="btn btn--line" disabled>✓ куплено</button>`
            : armId === it.id ? `<button type="button" class="btn btn--gold gd-arm" data-gdbuy="${it.id}">Купити?</button>`
            : `<button type="button" class="btn btn--line${lock || b < it.p ? " is-off" : ""}" data-gdbuy="${it.id}">${lock ? `<svg class="gd-lock"><use href="#i-lock"/></svg>` : `${coin()} ${it.p}`}</button>`}</li>`; }).join("")}</ul>
        <button type="button" class="btn btn--ghost" data-gd="close">Закрити</button>`;
    } else if (m === "chest") {
      el.innerHTML = `${grip}<div class="gs-kicker">${esc((arg && arg.kicker) || "Скриня Сенешаля")}</div><div class="gd-chest${ART["scene:chestc"] ? " has-art" : ""}">${ART["scene:chestc"] ? `<img src="${ART["scene:chestc"]}" alt=""><i class="gd-chest__light"></i>` : ""}<svg viewBox="0 0 64 64" aria-hidden="true"><path class="ch-b" d="M8 30h48v24H8z"/><path class="ch-l" d="M8 30c0-12 10-18 24-18s24 6 24 18z"/><path class="ch-s" d="M8 30h48M30 26h4v10h-4z"/></svg></div><p class="dy-note dy-note--t gd-chest__why">${esc((arg && arg.why) || "Сенешаль відмикає замок…")}</p>`;
    } else if (m === "loot") {
      el.innerHTML = `${grip}<div class="gs-kicker">${esc(arg.kicker || "Скриня Сенешаля")}</div>${lootHTML(arg)}<button type="button" class="btn btn--gold" data-gd="close">Забрати</button>`;
    } else if (m === "relic") {
      const r = relic(arg), on = G.eq.includes(r.id), cur = inSlot(slotOf(r)), sn = (SLOTS().find((x) => x.id === slotOf(r)) || {}).n || "", cd = effects(r).find((x) => x.type === "reroll" || x.type === "extend");
      el.innerHTML = `${grip}<div class="gs-kicker rl-k--${r.rar}">${RN[r.rar]} · ${esc(sn.toLowerCase())}</div><div class="rl-big rl--${r.rar}">${face(r, "rl-face")}</div>
        <div class="sheet__title dy-sht">${esc(r.n)}</div>${effects(r).map((b) => `<p class="rl-bonus">${esc(bonusText(b))}</p>`).join("")}${cd ? `<p class="dy-note">${!on ? "Діє, лише коли вдягнене." : relicLeft(cd.type) > 0 ? `Готове: ще ${relicLeft(cd.type)} з ${bonusOf(cd.type)} ${srcInfo(cd.type).per}. Спершу витрачається воно, жетони — лише потім.` : `Уже використане ${srcInfo(cd.type).per} — знову ${srcInfo(cd.type).renew}.`}</p>` : ""}<p class="dy-note dy-note--t rl-lore">${esc(r.lore)}</p>
        ${on ? `<button type="button" class="btn btn--line" data-rleq="${r.id}">Зняти</button>` : `<button type="button" class="btn btn--gold" data-rleq="${r.id}">${cur ? `Вдягнути замість «${esc(cur.n)}»` : "Вдягнути"}</button>`}
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
        <div class="gd-big">${coin("gd-coin--big")}<b>+${fmtN(arg.g)}</b></div>${arg.relic ? `<p class="rl-bonus">і реліквія — <span class="rw rw--${relic(arg.relic).rar}">«${esc(relic(arg.relic).n)}»</span></p>` : ""}
        ${arg.token ? `<p class="rl-bonus">і ${tkIc(arg.token)} жетон ${arg.token === "reroll" ? "перекидання" : "відстрочки"}</p>` : arg.lvChest ? `<p class="rl-bonus">і ${tkIc("chest")} скриня — відкриється слідом</p>` : ""}
        ${arg.newRank ? perkLine(rankIdx()) : ""}
        ${arg.page ? `<button type="button" class="btn btn--line" data-gd="chron" data-l="${arg.page}">Нова сторінка хроніки Ордену</button>` : ""}
        <button type="button" class="btn btn--gold" data-gd="close">${arg.relic ? "Подивитися реліквію" : "Прийняти"}</button>`;
        if (arg.relic) reveals.unshift({ id: arg.relic, why: `За звання «${arg.rank}»` });
        return; }
      if (arg.weekChest) { el.innerHTML = `${grip}<div class="gs-kicker">Недільна скриня</div>${scene("weekchest") ? `<img class="gd-scene gd-scene--tall" src="${scene("weekchest")}" alt="">` : ""}
        <div class="sheet__title dy-sht">${arg.n} ідеальних днів за тиждень</div><p class="dy-note dy-note--t">Сенешаль сам приносить скриню: «За такий тиждень — заслужено».</p>
        <div class="gd-big">${coin("gd-coin--big")}<b>+${fmtN(arg.g)}</b></div>${arg.relic ? `<p class="rl-bonus">і реліквія — <span class="rw rw--${relic(arg.relic).rar}">«${esc(relic(arg.relic).n)}»</span></p>` : arg.token ? `<p class="rl-bonus">і ${tkIc(arg.token)} жетон ${arg.token === "reroll" ? "перекидання" : "відстрочки"}</p>` : ""}
        <button type="button" class="btn btn--gold" data-gd="close">${arg.relic ? "Подивитися реліквію" : "Забрати"}</button>`;
        if (arg.relic) reveals.unshift({ id: arg.relic, why: "З недільної скрині" });
        return; }
      if (arg.bless) el.innerHTML = `${grip}<div class="gs-kicker">Благословення</div><div class="gd-bless">✦</div><div class="sheet__title dy-sht">Золото ×2</div><p class="dy-note dy-note--t">«${esc(arg.why)}» — Орден подвоїв нагороду: <b>+${fmtN(arg.g)}</b> золота понад звичне.</p><button type="button" class="btn btn--gold" data-gd="close">Дякую</button>`;
      else if (arg.dup) el.innerHTML = `${grip}<div class="gs-kicker">Спорядження</div><div class="sheet__title dy-sht">${esc(relic(arg.id).n)} — уже є</div><p class="dy-note dy-note--t">Сенешаль переплавив дублікат: <b>+${fmtN(arg.g)}</b> золота.</p><button type="button" class="btn btn--gold" data-gd="close">Добре</button>`;
      else { const r = relic(arg.id); el.innerHTML = `${grip}<div class="gs-kicker rl-k--${r.rar}">нове спорядження · ${RN[r.rar]}</div><div class="rl-big rl--${r.rar} is-new">${face(r, "rl-face")}</div>
        <div class="sheet__title dy-sht">${esc(r.n)}</div>${effects(r).map((b) => `<p class="rl-bonus">${esc(bonusText(b))}</p>`).join("")}<p class="dy-note dy-note--t rl-lore">${esc(r.lore)}</p>${arg.why ? `<p class="tr-at">${esc(arg.why)}</p>` : ""}
        <p class="dy-note">${G.eq.includes(r.id) ? "Слот був порожній — уже на тобі." : `Слот «${esc(((SLOTS().find((x) => x.id === slotOf(r)) || {}).n || "").toLowerCase())}» зайнятий — замінити можна у Скарбниці.`}</p><button type="button" class="btn btn--gold" data-gd="close">Прийняти</button>`; }
    }
  }
  const LR = { common: "звичайна", rare: "рідкісна", legend: "легендарна", myth: "міфічна" };
  const lootRar = (L) => L.kind === "relic" ? (relic(L.id) || {}).rar || "rare" : L.jack ? "myth" : L.kind === "token" ? "rare" : L.g >= 250 ? "legend" : L.g >= 150 ? "rare" : "common";
  function lootHTML(L) { const r = lootRar(L); return `<div class="gd-loot rar-${r}"><p class="gd-loot__k">${MK(esc(LR[r] + " здобич"))}</p>${lootBody(L)}</div>`; }
  function lootBody(L) {
    if (L.kind === "relic") { const r = relic(L.id); return `<div class="rl-big rl--${r.rar} is-new">${face(r, "rl-face")}</div><div class="sheet__title dy-sht">${esc(r.n)}</div><p class="rl-bonus">${MK(RN[r.rar])} · ${esc(((SLOTS().find((x) => x.id === slotOf(r)) || {}).n || "").toLowerCase())} · ${esc(fxText(r))}</p><p class="dy-note dy-note--t rl-lore">${esc(r.lore)}</p>`; }
    if (L.kind === "token") { const TK = { reroll: ["Жетон перекидання", "Наступне непотрібне доручення можна буде замінити."], extend: ["Жетон відстрочки", "Будь-який активний квест — на день довше."],
        breath: ["Жетон «Друге дихання»", "Провалений квест — друга спроба: ще 2 дні, 85% мети."], rest: ["Печатка відпочинку", "Вчорашній пропуск повторюваної справи не порве ланцюжка."],
        elixir: ["Еліксир Відродження", "Уже діє: завтрашній ідеальний день — ×1,5 до нагороди."] }[L.t] || ["Жетон", ""];
      return `<div class="gd-tkbig">${tkIc(L.t, "gd-tk--big")}</div><div class="sheet__title dy-sht">${TK[0]}</div><p class="dy-note dy-note--t">${TK[1]}</p>`; }
    return `<div class="gd-big">${coin("gd-coin--big")}<b>+${fmtN(L.g)}</b></div><div class="sheet__title dy-sht">${L.jack ? "СКАРБ!" : L.g >= 250 ? "Щедра скриня" : "Золото"}</div><p class="dy-note dy-note--t">${L.jack ? "Сенешаль мовчки дивиться на скриню. Таке трапляється раз на сотню." : "Сенешаль перелічує монети й киває."}</p>`;
  }
  /* скриня: звичайний випадок (Math.random) — здобич записується в синхронізовану книгу */
  /* seed — для дарованих скринь (квест, сцена): та сама здобич на всіх пристроях; куплена — звичайний випадок */
  /* скрині (з 8.11): головне — спорядження, далі жетони; золото — лише переплавка дубліката чи дрібниця в дарованій.
     Жодних золотих джекпотів: золото — це гривні, а скриня не має бути рулеткою (Фортуна) */
  const CH_RAR = { paid: [0.45, 0.38, 0.14, 0.03], cmd: [0, 0.6, 0.32, 0.08], gift: [0.6, 0.3, 0.09, 0.01] }, RO = ["common", "rare", "legend", "myth"];
  function pickItem(R, rnd, tag) {
    const i = RO.indexOf(R), of = (r) => relics().filter((x) => !x.secret && !G.own[x.id] && x.rar === r);
    for (const j of [i, i + 1, i + 2, i + 3, i - 1, i - 2, i - 3]) { if (j < 0 || j > 3) continue; const P = of(RO[j]); if (P.length) return P[Math.floor(rnd(tag + j) * P.length) % P.length].id; }
    return null;
  }
  function openChest(seed, key, cmd) {
    const rnd = seed ? (s) => roll(seed + s) : () => Math.random(), x = rnd("x"), id = key || "c" + Date.now().toString(36);
    const kind = cmd ? "cmd" : seed ? "gift" : "paid", W = CH_RAR[kind].slice();
    for (let i = 0; i < bonusOf("chest"); i++) { W[0] *= 0.6; W[2] *= 1.5; W[3] *= 1.8; }       // щедріші скрині: здобич частіше рідкісніша
    let r = rnd("r") * W.reduce((a, v) => a + v, 0), R = "common"; for (let j = 0; j < 4; j++) { r -= W[j]; if (r <= 0) { R = RO[j]; break; } }
    let L = null;
    if (x < (kind === "cmd" ? 1 : kind === "paid" ? 0.85 : 0.6)) { const rid = pickItem(R, rnd, "p"); if (rid) L = { kind: "relic", id: rid }; }
    if (!L) { const y = rnd("y"); L = kind === "gift" && y < 0.35 ? { kind: "gold", g: 100 + Math.floor(rnd("g") * 201) } : { kind: "token", t: y < 0.55 ? "reroll" : y < 0.85 ? "extend" : "breath" }; }
    if (L.kind === "gold") G.inc[id] = { at: Date.now(), amt: L.g, why: L.jack ? "скарб зі скрині" : seed ? "дарована скриня" : "зі скрині Сенешаля" };
    if (L.kind === "token") G.tk[id] = { kind: L.t, d: 1, at: Date.now() };
    if (L.kind === "relic") { const r = grant(L.id, seed ? "дарована скриня" : "скриня Сенешаля"); if (r && r.dup) L = { kind: "gold", g: r.g }; }
    save(); return L;
  }
  /* анімація скрині: світиться білим і «розгоряється» до кольору здобичі (білий → жовтий → помаранчевий → фіолетовий) */
  let chestT = null, boughtAt = 0, boughtId = null, armId = null, armT = null;
  function chestPlay(L, o) {
    o = o || {}; clearTimeout(chestT);
    /* реліквія зі скрині — арт тягнемо одразу, поки скриня світиться; перед показом чекаємо його ще до ~8 с */
    const rid = L.kind === "relic" ? L.id : null; let waited = 0;
    if (rid && !ART[rid]) artFor("relic", rid).then((u) => { if (!u) return; ART[rid] = u;
      if (el && el.classList.contains("open") && mode === "loot" && el.querySelector(".rl-big svg")) render("loot", Object.assign({}, L, { kicker: o.kicker })); });
    const R = ["common", "rare", "legend", "myth"], top = Math.max(0, R.indexOf(lootRar(L))); let i = -1;
    const step = () => {
      const c = el && el.classList.contains("open") && el.querySelector(".gd-chest");
      if (!c) { reveals.unshift({ loot: L, kicker: o.kicker }); return; }                // закрили посеред відкриття — здобич покажемо пізніше
      if (i < top) { i++; R.forEach((x) => c.classList.remove("rar-" + x)); c.classList.add("is-glow", "rar-" + R[i]); c.style.animation = "none"; void c.offsetWidth; c.style.animation = "";
        const A = API(); if (A.FX && A.FX.buzz) A.FX.buzz(i >= 2 ? "medium" : "light"); chestT = setTimeout(step, i < top ? 1100 : 1700); return; }
      if (rid && !ART[rid] && waited++ < 8) { chestT = setTimeout(step, 1000); return; }
      render("loot", Object.assign({}, L, { kicker: o.kicker })); fx(top >= 2 ? "date" : "yes");
    };
    chestT = setTimeout(step, 900);
  }
  /* дарована скриня (квест, сцена писаря, випадкова розмова): один раз на ключ, на всіх пристроях */
  function freeChest(key, why, kicker) {
    if (G.proc["chest:" + key]) return false;
    G.proc["chest:" + key] = 1;
    const L = openChest("chest:" + key, "gc:" + key);
    reveals.push({ chest: L, why, kicker: kicker || "Дарована скриня" }); setTimeout(nextReveal, 900);
    return true;
  }
  /* що відкрило звання: місце для реліквії, товар у крамниці */
  function perkLine(ri) {
    const P = D().PERKS || {}, sl = (P.slots || []).find((x) => x.rank === ri), sh = (P.shop || []).filter((x) => x.rank === ri);
    const bits = [].concat(sl ? [`${sl.n}-те місце для реліквії`] : []).concat(sh.map((x) => `у крамниці — «${x.n}»`));
    return bits.length ? `<p class="rl-bonus">Звання відкрило: ${bits.map(esc).join(" · ")}</p>` : "";
  }
  function onSheet(e) {
    const v = e.target.closest("[data-gdv]"); if (v) { amt = +v.dataset.gdv; render("out"); return; }
    const buy = e.target.closest("[data-gdbuy]");
    if (buy) {
      const it = shopItems().find((s) => s.id === buy.dataset.gdbuy); if (!it || Date.now() - boughtAt < 1500) return;   // подвійний тап — не друга покупка
      if (it.perk && rankIdx() < it.rank) { toast(`Відкриється зі званням «${esc(rankName(it.rank))}»`); return; }
      if (balance() < it.p) { toast(`${coin()} Не вистачає <b>${fmtN(it.p - balance())}</b> золота`); return; }
      /* перший тап — «Купити?», другий (за 4 с) — покупка */
      clearTimeout(armT);
      if (armId !== it.id) { armId = it.id; render("shop"); armT = setTimeout(() => { armId = null; if (el && el.classList.contains("open") && mode === "shop") render("shop"); }, 4000); return; }
      armId = null; boughtAt = Date.now(); boughtId = it.id;
      G.out["s" + Date.now().toString(36)] = { at: Date.now(), amt: it.p, kind: "shop", st: "done", item: it.n };
      if (it.id === "chest" || it.id === "cmdchest") { boughtId = null; save(); const cmd = it.id === "cmdchest", L = openChest(null, null, cmd); render("chest", cmd ? { kicker: "Скриня Командора", why: "Орест знімає печатку з короною…" } : null); fx("open"); chestPlay(L, cmd ? { kicker: "Скриня Командора" } : null); return; }
      if (it.id === "elixir") { G.elix = Object.assign({}, G.elix, { [addDay(today(), 1)]: Date.now() }); save(); fx("yes"); render("shop"); toast(`${tkIc("elixir")} Завтра ідеальний день — ×1,5`); setTimeout(() => { boughtId = null; if (el && el.classList.contains("open") && mode === "shop") render("shop"); }, 1500); return; }
      if (it.id === "scroll") { G.scroll = weekKey(today()); save(); fx("yes"); render("shop"); const Dy = DAY(); if (Dy && Dy.trigger) Dy.trigger("legend"); toast(`${tkIc("scroll")} Верховний уже несе легендарне доручення — у «Дні»`); setTimeout(() => { boughtId = null; if (el && el.classList.contains("open") && mode === "shop") render("shop"); }, 1500); return; }
      G.tk["t" + Date.now().toString(36)] = { kind: it.id, d: 1, at: Date.now() }; save(); fx("yes"); render("shop");
      toast(`${tkIc(it.id)} <b>+1</b> ${esc(it.n.toLowerCase())} · тепер ${tokens(it.id)}`);
      setTimeout(() => { boughtId = null; if (el && el.classList.contains("open") && mode === "shop") render("shop"); }, 1500); return;
    }
    const eq = e.target.closest("[data-rleq]");
    if (eq) { const id = eq.dataset.rleq, sl = slotOf(relic(id)); G.eq = G.eq.includes(id) ? G.eq.filter((x) => x !== id) : G.eq.filter((x) => !relic(x) || slotOf(relic(x)) !== sl).concat(id); G.eqAt = Date.now(); save(); fx("yes"); render("relic", id); return; }
    const sw = e.target.closest("[data-rlswap]");
    if (sw) { const [nid, old] = sw.dataset.rlswap.split("|"); G.eq = G.eq.map((x) => (x === old ? nid : x)); G.eqAt = Date.now(); save(); fx("yes"); render("relic", nid); return; }
    const b = e.target.closest("[data-gd]"); if (!b) return;
    const a = b.dataset.gd;
    if (a === "close") { close(); return; }
    if (a === "chron") { const L = +b.dataset.l; close(); setTimeout(() => { const Dy = DAY(); if (Dy && Dy.openChron) Dy.openChron(L); }, 420); return; }
    if (a === "ok") {
      if (!(amt > 0 && amt <= balance())) return;
      G.out["o" + Date.now().toString(36)] = { at: Date.now(), amt, kind: "white", st: "pending" }; save();
      fx("yes"); render("sent"); refreshViews(); watchBank(false, true);
    }
  }
  /* відкриття реліквії чи благословення — коли екран вільний (не посеред сцени, ритуалу чи іншого аркуша); інакше — пізніше */
  let revealT = 0;
  function nextReveal() {
    clearTimeout(revealT); if (!reveals.length) return;
    const intro = $("intro");
    if (held()) { revealT = setTimeout(nextReveal, 2000); return; }
    if (document.hidden || document.querySelector(".sheet.open, .hall.open, .rite.open, .confirm.open") || (intro && !intro.hasAttribute("hidden"))) { revealT = setTimeout(nextReveal, 4000); return; }
    const nx = reveals[0];
    if (nx && nx.id && !nx.dup && !ART[nx.id] && (nx.waited || 0) < 8) { nx.waited = (nx.waited || 0) + 1; loadArts(); revealT = setTimeout(nextReveal, 1500); return; }   // спершу — справжній арт (до ~12 с, поки підвантажиться)
    if (nx.chest && typeof nx.chest === "object") { reveals.shift(); show("chest", { why: nx.why, kicker: nx.kicker }); chestPlay(nx.chest, { kicker: nx.kicker }); return; }
    if (nx.loot && typeof nx.loot === "object") { reveals.shift(); show("loot", Object.assign({}, nx.loot, { kicker: nx.kicker })); fx("yes"); return; }
    show("reveal", reveals.shift()); fx("date");
  }
  /* швидка звірка з банком. Орден не бачить переказу, доки GitHub не стягне свіжу виписку з монобанку (~40–60 с на запит),
     тож поки є виведення в дорозі — просимо виписку кілька разів (не частіше ніж раз на ~90 с: ліміт API банку) і перечитуємо її між запитами.
     Також — одразу, щойно повертаєшся в Орден після монобанку, і кнопкою «Оновити». */
  let lastAsk = 0, syncing = false;
  function askBank() { const V = window.ORDO_VAULT; if (!V || !V.dispatch || Date.now() - lastAsk < 85e3) return; lastAsk = Date.now(); LS.set("ordo.k.bankAsk", Date.now()); V.dispatch("bank", pending().length ? { white: 1 } : null); }      // чекаємо поповнення — банк тягне лише білу картку
  async function readBank() {
    if (T() && T().load) await T().load(true);
    if (reconcile()) { refreshViews(); const d = Object.values(G.out).filter((o) => o.done && Date.now() - o.done < 60 * 60e3).sort((a, b) => b.done - a.done); if (d.length) toast(`${coin()}<b>${fmtN(d[0].amt)} ₴</b> на білій картці`); }
    else if (syncing) refreshViews();
  }
  /* later — щойно натиснув «На білу картку»: переказу ще нема, банк питаємо, коли повернешся з монобанку (або за півтори хвилини) */
  function watchBank(manual, later) {
    polls.forEach(clearTimeout); polls = [];
    syncing = true; refreshViews(); if (!later) askBank();
    const asks = later ? [90, 300] : manual ? [] : [240], reads = [45, 65, 85, 150, 170, 270, 290, 330, 360, 450];     // ощадливо (хвилини GitHub): «Оновити» — один запит; виведення в дорозі — ще 1–2
    asks.forEach((s) => polls.push(setTimeout(() => { if (manual && s > 100 && !pending().length) return; if (pending().length || manual) askBank(); }, s * 1000)));
    reads.forEach((s, i) => polls.push(setTimeout(async () => { if (!pending().length && !manual && i > 2) return; await readBank(); if (i === reads.length - 1 || (manual && i >= 2 && !pending().length)) { syncing = false; refreshViews(); } }, s * 1000)));
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && pending().length && Date.now() - lastAsk > 5 * 60e3) watchBank(); });     // повернувся з монобанку — питаємо банк, але не частіше ніж раз на 5 хв     // повернувся з монобанку — одразу питаємо банк
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
    if (id === "chest") return freeChest("ev:" + ev, "Дар храмовника", "Скриня від храмовника");
    if (!relic(id) || G.proc["ev:" + ev]) return;
    G.proc["ev:" + ev] = 1; const r = grant(id, "подія"); save();
    if (r) { reveals.push(Object.assign(r, { why: "Дар храмовника" })); setTimeout(nextReveal, 800); }
  }
  setTimeout(loadArts, 600);                                   // з кешу — майже одразу
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}     // попросити браузер не викидати кеш артів
  /* золото за конкретний запис книги досвіду (з бонусом реліквій і благословенням) — для розшифровки дня */
  const goldFor = (id) => { const x = ledger().find((y) => y.id === id); return x ? x.g + (G.bon["rb:" + id] || 0) + (G.bon["bl:" + id] || 0) : 0; };
  window.ORDO_GOLD = { html, chip, tick, gear: (type) => bonusOf(type), elixir: (d) => !!(G.elix && G.elix[d]), balance, earned, reconcile, coin, can, use, tokens, unsealed, setUnsealed, srcLabel, srcShort, artName, artFor, gift, scene, goldFor, freeChest, chestUsed: (key) => !!G.proc["chest:" + key], purge, tkIc, achArt, wantAch, whiteDone: () => Object.values(G.out).filter((o) => o.kind === "white" && o.st === "done" && live(o)).length, art: artKey, want };
})();
