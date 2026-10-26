/* ============================================================================
   ORDO — Зброярня (тренування) і Бібліотека (книжки, ігри).
   Зброярня: вправи з робочими вагами (останні / найкращі), план наступного залу від брата Северина
   (спліт A/B, графік нд · вт · пт, пауза плечей 5 днів, після 7+ днів — ваги −25%, поганий сон — без прогресії,
   ніч в укритті — без залу; одна прогресія на сесію), місяць проти мети, історія з червня.
   Бібліотека: що читаю (полиця Дня), прочитане, черга; пройдені ігри — статуетки (кинуте не заносимо).
   Стартові дані — у зашифрованому вмісті (D.ARMORY, D.LIBRARY); правки власника — ordo.arm / ordo.lib (синхронізуються).
   ========================================================================== */
(function () {
  "use strict";
  const LS = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const D = () => window.ORDO_DATA || {}, DY = () => window.ORDO_DAY, API = () => window.ORDO_API || {}, GD = () => window.ORDO_GOLD;
  const AR = () => D().ARMORY || { ex: [], hist: {}, goal: {}, days: [], split: {}, groups: {}, rules: [] };
  const p2 = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const dt = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => keyOf(new Date());
  const add = (k, n) => { const d = dt(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const diff = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
  const wd = (k) => (dt(k).getDay() + 6) % 7 + 1;
  const MG = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  const MN = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
  const WDN = ["", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота", "неділя"];
  const WDS = ["", "пн", "вт", "ср", "чт", "пт", "сб", "нд"];
  const human = (k) => { const d = dt(k); return `${d.getDate()} ${MG[d.getMonth()]}`; };
  const fmtN = (v) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: 1 });
  const fx = (s, b) => { const A = API(); if (A.FX) { if (s && A.FX.play) A.FX.play(s, true); if (A.FX.buzz) A.FX.buzz(b || "light"); } };
  const art = (key) => { const G = GD(); return G && G.art ? G.art(key) : null; };
  const want = (keys) => { const G = GD(); if (G && G.want) G.want(keys); };

  /* правки власника (синхронізуються): вправи — ручні ваги / прихована; ігри; книжки бібліотеки (прочитане до Ордену й черга) */
  let ARM = LS.get("ordo.arm", null) || {}; ARM.ex = ARM.ex || {};
  let LIB = LS.get("ordo.lib", null) || {}; LIB.games = LIB.games || {}; LIB.books = LIB.books || {};
  const saveA = () => LS.set("ordo.arm", ARM), saveL = () => LS.set("ordo.lib", LIB);
  function reload() { ARM = LS.get("ordo.arm", null) || {}; ARM.ex = ARM.ex || {}; LIB = LS.get("ordo.lib", null) || {}; LIB.games = LIB.games || {}; LIB.books = LIB.books || {}; }

  /* ============================================================= ЗБРОЯРНЯ == */
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, "");
  const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || (x.length >= 6 && y.length >= 6 && (x.includes(y) || y.includes(x)))); };
  function catalog() {
    return (AR().ex || []).map((e) => { const o = ARM.ex[e.id] || {}; return Object.assign({}, e, o.day ? { day: o.day } : {}, { manual: o.last || null, hide: !!o.hide }); }).filter((e) => !e.hide);
  }
  const findEx = (name) => catalog().find((e) => same(e.n, name)) || null;
  /* підходи з таблиць залу: [{ k, w, reps }] — w найбільша робоча вага, reps — повтори підходів із цією вагою (для компенсації — найменша) */
  function hist(e) {
    const Y = DY(); if (!Y || !Y.sessions) return [];
    const out = [];
    Y.sessions().forEach((s) => (s.ex || []).forEach((x) => {
      if (!same(x.n, e.n)) return;
      const sets = (x.sets || []).filter((z) => z.r > 0); if (!sets.length) return;
      const ws = sets.map((z) => +z.w || 0), w = e.inv ? Math.min(...ws) : Math.max(...ws);
      out.push({ k: s.k, w, reps: sets.filter((z) => (+z.w || 0) === w).map((z) => +z.r) });
    }));
    return out.sort((a, b) => (a.k < b.k ? -1 : 1));
  }
  const better = (e, a, b) => { if (!b) return true; if (a.w !== b.w) return e.inv ? a.w < b.w : a.w > b.w; return a.reps.reduce((s, r) => s + r, 0) > b.reps.reduce((s, r) => s + r, 0); };
  /* останнє й найкраще: таблиці залу новіші за стартові дані (з логу до 21.10); ручна правка — новіша за все до неї */
  function stats(e) {
    const H = hist(e), seedK = AR().seedTo || "2026-10-21";
    let last = e.last ? Object.assign({ k: seedK, seed: 1 }, e.last) : null;
    if (e.manual && (!last || e.manual.k >= last.k)) last = e.manual;
    H.forEach((h) => { if (!last || h.k >= last.k) last = h; });
    let best = e.best ? Object.assign({ k: seedK, seed: 1 }, e.best) : null, prs = 0;
    [e.manual].concat(H).filter(Boolean).forEach((h) => { if (better(e, h, best)) { if (best && !h.seed && h.k > seedK) prs++; best = h; } });
    return { last, best, prs, H };
  }
  const unit = (e) => (e.body ? "" : e.inv ? " кг компенс." : e.per ? " кг/стор" : " кг");
  const setsTxt = (x, e) => !x ? "—" : `${e.body ? "" : fmtN(x.w) + unit(e) + " · "}${x.reps.every((r) => r === x.reps[0]) ? `${x.reps.length}×${x.reps[0]}` : x.reps.join("+")}`;
  const typeOf = (exs) => { let a = 0, b = 0; (exs || []).forEach((x) => { const e = findEx(x.n); if (e && e.day === "A") a++; if (e && e.day === "B") b++; }); return a === b ? null : a > b ? "A" : "B"; };

  /* план наступного залу */
  function plan() {
    const Y = DY(), A = AR(), t0 = today(); if (!Y || !Y.trainDays) return null;
    const td = Y.trainDays(add(t0, -70), t0), gym = td.gym, ss = Y.sessions ? Y.sessions() : [];
    const typed = ss.filter((s) => s.ex && s.ex.length).map((s) => ({ k: s.k, type: typeOf(s.ex) })).filter((x) => x.type);
    const lastK = gym.length ? gym[gym.length - 1] : A.seedTo || null;
    const lastT = typed.length ? typed[typed.length - 1] : null, lastB = [...typed].reverse().find((x) => x.type === "B");
    const doneToday = gym.includes(t0);
    let type = ARM.next && ARM.next.from >= (lastK || "") && ARM.next.type ? ARM.next.type : lastT ? (lastT.type === "A" ? "B" : "A") : "A";
    const reasons = [], warn = [];
    if (ARM.next && ARM.next.type === type && ARM.next.from >= (lastK || "")) reasons.push("день обрано вручну");
    else if (lastT) reasons.push(`за чергою: минулого разу день ${lastT.type} (${human(lastT.k)})`);
    else reasons.push("минулий день A чи B не записано — почнемо з A (можна змінити)");
    let k = null, skipB = null;
    for (let i = doneToday ? 1 : 0; i <= 9 && !k; i++) {
      const c = add(t0, i);
      if (!(A.days || []).includes(wd(c))) continue;
      if (lastK && diff(lastK, c) < 2) continue;                                  // між залами — хоча б день відпочинку
      if (i === 0 && Y.nightKind && Y.nightKind(t0) === "siren") { warn.push("Ніч в укритті — сьогодні без залу. Відпочинь, тіло і так воювало."); continue; }
      if (type === "B" && lastB && diff(lastB.k, c) < 5) { if (!skipB) skipB = add(lastB.k, 5); continue; }
      k = c;
    }
    if (!k) k = add(t0, doneToday ? 1 : 0);
    if (skipB) reasons.push(`плечам і трицепсу — пауза 5 днів після ${human(lastB.k)}`);
    reasons.push(`графік: ${(A.days || []).map((d) => WDS[d]).join(" · ")}`);
    const pause = lastK ? diff(lastK, k) : 0, deload = pause >= 7, rough = k === t0 && Y.roughNight && Y.roughNight(t0);
    if (deload) warn.push(`Пауза ${pause} днів — ваги −25%, далі кроками вгору.`);
    if (rough) warn.push("Ніч була важкою — тільки закріплені ваги, без прогресії.");
    /* вправи дня: базові — завжди, далі ізоляція за чергою (давно не було — першою); усього 6, прес — фінішер */
    const day = catalog().filter((e) => e.day === type), withS = day.map((e) => ({ e, s: stats(e) }));
    /* ізоляція — по групах по черзі: група з найменшою кількістю вправ у плані (руки — не більше однієї), у групі — що давно не робив */
    const core = withS.filter((x) => x.e.core), pick = core.slice(), cnt = {}, CAP = { arms: 1 };
    const lk = (x) => (x.s.last && x.s.last.k) || "";
    let rest = withS.filter((x) => !x.e.core).sort((a, b) => (lk(a) < lk(b) ? -1 : lk(a) > lk(b) ? 1 : 0));
    core.forEach((x) => { cnt[x.e.g] = (cnt[x.e.g] || 0) + 1; });
    while (pick.length < 6 && rest.length) {
      const gs = [...new Set(rest.map((x) => x.e.g))].filter((g) => (cnt[g] || 0) < (CAP[g] || 9));
      if (!gs.length) break;
      gs.sort((a, b) => (cnt[a] || 0) - (cnt[b] || 0) || rest.filter((x) => x.e.g === b).length - rest.filter((x) => x.e.g === a).length);
      const nx = rest.find((x) => x.e.g === gs[0]); pick.push(nx); cnt[nx.e.g] = (cnt[nx.e.g] || 0) + 1; rest = rest.filter((x) => x !== nx);
    }
    const order = (A.ex || []).map((e) => e.id);
    pick.sort((a, b) => (a.e.core === b.e.core ? order.indexOf(a.e.id) - order.indexOf(b.e.id) : a.e.core ? -1 : 1));
    const abs = catalog().find((e) => e.day === "*"); if (abs) pick.push({ e: abs, s: stats(abs) });
    let prog = null;
    const ex = pick.map(({ e, s }) => {
      const L = s.last || { w: 0, reps: [10, 10, 10] }, n = Math.max(3, L.reps.length);
      let w = L.w, reps = Array.from({ length: n }, (_, i) => L.reps[i] || L.reps[L.reps.length - 1] || 10);
      if (deload && !e.body) { w = Math.max(0, Math.round((e.inv ? w * 1.25 : w * 0.75) / (e.step || 2.5)) * (e.step || 2.5)); reps = reps.map(() => 10); }
      return { id: e.id, n: e.n, e, last: s.last, best: s.best, w, reps, prog: null };
    });
    if (!deload && !rough) {
      const wcand = ex.find((x) => !x.e.body && x.reps.length >= 3 && x.reps.every((r) => r >= 12));
      if (wcand) { wcand.w = Math.max(0, wcand.w + (wcand.e.inv ? -1 : 1) * (wcand.e.step || 2.5)); wcand.reps = wcand.reps.map(() => 10); wcand.prog = "w"; prog = wcand; }
      else { const rc = ex.find((x) => !x.e.body && x.reps.some((r) => r < 12)); if (rc) { rc.reps = rc.reps.map((r) => Math.min(12, r + 1)); rc.prog = "r"; prog = rc; } }
    }
    return { k, type, label: (A.split || {})[type] || "", reasons, warn, ex, prog, deload, rough, lastK, today: k === t0, doneToday };
  }
  /* план → таблиця для аркуша залу: підходи з цільовими повторами й вагою */
  const planSets = (p) => p.ex.map((x) => ({ n: x.n, sets: x.reps.map((r) => ({ r, w: x.e.body ? null : x.w })) }));

  /* місяць: зали й кардіо (до 21.10 — з логу, далі — Орден) */
  function monthCount(key) {
    const Y = DY(), A = AR(), seedTo = A.seedTo || "2026-10-21", h = (A.hist || {})[key] || [0, 0, 0];
    const a = `${key}-01`, end = keyOf(new Date(+key.slice(0, 4), +key.slice(5, 7), 0)), from = a > seedTo ? a : add(seedTo, 1);
    const td = Y && Y.trainDays && from <= end ? Y.trainDays(from, end) : { gym: [], cardio: [] };
    return { gym: (key <= seedTo.slice(0, 7) ? h[0] + (h[2] || 0) : 0) + td.gym.length, cardio: (key <= seedTo.slice(0, 7) ? h[1] : 0) + td.cardio.length };
  }
  function months() {
    const A = AR(), out = [], t0 = today(); let k = (A.since || "2026-06-12").slice(0, 7);
    while (k <= t0.slice(0, 7)) { out.push(Object.assign({ key: k }, monthCount(k))); const d = new Date(+k.slice(0, 4), +k.slice(5, 7), 1); k = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; }
    return out;
  }
  /* для квестів «рекорд»: підхід ≥ w кг (компенсація ≤ w) і ≥ r повторів у вправі між датами */
  function liftHit(L, a, b) {
    const e = findEx(L.ex) || { n: L.ex, inv: /компенс|підтяг/i.test(L.ex) };
    const Y = DY(); if (!Y || !Y.sessions) return null;
    for (const s of Y.sessions()) { if (s.k < a || s.k > b) continue;
      for (const x of s.ex || []) { if (!same(x.n, e.n)) continue;
        if ((x.sets || []).some((z) => z.r >= (L.r || 1) && (e.inv ? (+z.w || 0) <= L.w : (+z.w || 0) >= L.w))) return s.k; } }
    return null;
  }

  /* ============================================================= БІБЛІОТЕКА == */
  function libBooks() {
    const Y = DY(), BK = Y && Y.books ? Y.books() : { list: {} }, seeds = (D().LIBRARY || {}).books || [];
    const bk = Object.values(BK.list || {}), out = [];
    seeds.forEach((s) => {
      const o = LIB.books[s.id] || {};
      if (s.match && bk.some((b) => new RegExp(s.match, "i").test(b.t || ""))) return;          // уже на полиці Дня
      const st = o.st || s.st; if (st === "drop") return;
      out.push(Object.assign({}, s, o, { st, src: "lib" }));
    });
    bk.forEach((b) => { const s = seeds.find((x) => x.match && new RegExp(x.match, "i").test(b.t || "")) || seeds.find((x) => norm(x.t) === norm(b.t)) || {};
      out.push({ id: b.id, t: b.t, a: s.a || "", art: b.art || s.art || null, st: b.end ? "done" : "read", end: b.end || null, pages: b.pages, src: "bk", knight: s.knight, take: s.take, note: s.note }); });
    Object.keys(LIB.books).filter((id) => !seeds.some((s) => s.id === id) && LIB.books[id].t).forEach((id) => { const o = LIB.books[id]; if (o.st !== "drop") out.push(Object.assign({ id, src: "lib" }, o)); });
    return out;
  }
  function libGames() {
    const seeds = (D().LIBRARY || {}).games || [], out = [];
    seeds.forEach((s) => { const o = LIB.games[s.id] || {}; const g = Object.assign({}, s, o); if (g.st !== "drop") out.push(g); });
    Object.keys(LIB.games).filter((id) => !seeds.some((s) => s.id === id) && LIB.games[id].t).forEach((id) => { const g = Object.assign({ id }, LIB.games[id]); if (g.st !== "drop") out.push(g); });
    return out;
  }
  /* для цілей: «Пройти Elden Ring…» — закривається, коли гру позначено пройденою */
  const gameDoneFor = (text) => { const s = norm(text); return libGames().find((g) => g.st === "done" && g.d && norm(g.t).length >= 4 && s.includes(norm(g.t))) || null; };

  /* лічильники для медалей і цілей */
  let cntAt = 0, cnt = null;
  function counts() {
    if (cnt && Date.now() - cntAt < 1500) return cnt;
    const ms = months(), books = libBooks(), games = libGames(), t0 = today();
    const byYear = {}; books.filter((b) => b.st === "done" && b.end).forEach((b) => { const y = b.end.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; });
    let prs = 0; catalog().forEach((e) => { prs += stats(e).prs; });
    cnt = { prs, gmon: ms.filter((m) => m.gym >= ((AR().goal || {}).gym || 8)).length,
      gymTotal: ms.reduce((a, m) => a + m.gym, 0), cardioTotal: ms.reduce((a, m) => a + m.cardio, 0),
      games: games.filter((g) => g.st === "done").length, books: books.filter((b) => b.st === "done").length,
      booksYear: Math.max(0, ...Object.values(byYear)), knight: books.filter((b) => b.st === "done" && b.knight).length };
    cntAt = Date.now(); return cnt;
  }
  /* для цілей: джерело «зали», «кардіо», «книжки», «ігри» за період */
  function count(src, a, b) {
    const Y = DY();
    if (src === "gym" || src === "cardio") { let n = 0; months().forEach((m) => { if (`${m.key}-01` > b || `${m.key}-31` < a) return; n += src === "gym" ? m.gym : m.cardio; }); return n; }
    if (src === "books") return libBooks().filter((x) => x.st === "done" && x.end && x.end >= a && x.end <= b).length;
    if (src === "games") return libGames().filter((x) => x.st === "done" && x.d && x.d.length === 10 && x.d >= a && x.d <= b).length;
    return null;
  }

  /* ========================================================== ЕКРАН ===== */
  const KEEPER = () => { const K = (D().KEEPERS || {}).sobriety || {}; return K; };
  const exArt = () => art("scene:armory");
  function renderArmory() {
    const box = $("armoryBody"); if (!box) return;
    want(["scene:armory"]);
    const P = plan(), A = AR(), K = KEEPER(), cur = monthCount(today().slice(0, 7)), G = A.goal || {};
    if (!P) { box.innerHTML = `<p class="dy-note">Зброярня відчиняється…</p>`; return; }
    const when = P.today ? "сьогодні" : diff(today(), P.k) === 1 ? "завтра" : WDN[wd(P.k)];
    const head = P.warn.length && P.today ? P.warn[0]
      : `${when.charAt(0).toUpperCase() + when.slice(1)} — плац. День ${P.type}: ${P.label}.${P.prog ? ` Одна прогресія: ${P.prog.n.toLowerCase()} — ${P.prog.prog === "w" ? fmtN(P.prog.w) + unit(P.prog.e) : "на повтор більше"}.` : P.rough ? " Без прогресії — тримай закріплене." : ""}`;
    let h = `${exArt() ? `<img class="ar-scene" src="${exArt()}" alt="">` : ""}
      <div class="md md--voice ar-voice"><div class="md__fig"${K.art ? ` data-card="sobriety"` : ""}>${K.art ? `<img class="md__img" src="${esc(K.art)}" alt="">` : ""}</div><div class="md__txt"><div class="md__who">${esc(K.name || "брат Северин")} · майстер плацу</div><p class="md__say">${esc(head)}</p></div></div>
      <section class="ar-next"><div class="ar-next__h"><span class="gs-kicker">Наступний зал</span><b>${esc(when)}${P.today ? "" : `, ${human(P.k)}`}</b>
        <div class="ar-ab" role="group">${["A", "B"].map((t) => `<button type="button" data-arab="${t}" class="${P.type === t ? "is-on" : ""}">День ${t}</button>`).join("")}</div></div>
        <p class="ar-split">${esc(P.label)}</p>
        ${P.warn.map((w) => `<p class="ar-warn">${esc(w)}</p>`).join("")}
        <ul class="ar-plan">${P.ex.map((x) => `<li class="${x.prog ? "is-prog" : ""}" data-arex="${x.id}"><span class="ar-plan__n">${esc(x.n)}</span>
          <span class="ar-plan__l">${x.last ? esc(setsTxt(x.last, x.e)) : "—"}</span><span class="ar-plan__t">${x.prog ? "↑ " : "→ "}${esc(setsTxt({ w: x.w, reps: x.reps }, x.e))}</span></li>`).join("")}</ul>
        <p class="ar-why">${P.reasons.map(esc).join(" · ")}</p>
        ${P.today && !P.doneToday ? `<button type="button" class="btn btn--gold" data-ar="start">Почати тренування — таблиця вже заповнена</button>` : P.doneToday ? `<p class="ar-done">Сьогодні зал уже є. Відпочивай — наступний ${human(P.k)}.</p>` : `<button type="button" class="btn btn--line" data-ar="start">Відкрити таблицю на сьогодні</button>`}
      </section>
      <section class="ar-month"><div class="st-h st-h--sub">${MN[+today().slice(5, 7) - 1]}</div>
        <div class="ar-bars"><div><span>Зали</span><div class="gl-bar"><i style="width:${Math.min(100, Math.round(cur.gym / (G.gym || 8) * 100))}%"></i></div><b>${cur.gym} / ${G.gym || 8}</b></div>
        <div><span>Кардіо</span><div class="gl-bar"><i style="width:${Math.min(100, Math.round(cur.cardio / (G.cardio || 4) * 100))}%"></i></div><b>${cur.cardio} / ${G.cardio || 4}</b></div></div>
        <div class="ar-hist">${months().map((m) => `<div title="${m.key}"><i style="height:${Math.round(6 + 44 * Math.min(1, m.gym / 13))}px" class="${m.gym >= (G.gym || 8) ? "is-ok" : ""}"></i><em>${m.gym}</em><span>${MN[+m.key.slice(5, 7) - 1].slice(0, 3)}</span></div>`).join("")}</div>
      </section>
      <section class="ar-table"><div class="st-h st-h--sub">Робочі ваги <em>останні · найкращі</em></div>`;
    const groups = A.groups || {};
    Object.keys(groups).forEach((g) => {
      const L = catalog().filter((e) => e.g === g); if (!L.length) return;
      h += `<div class="ar-g"><span>${esc(groups[g])}</span><em>${[...new Set(L.map((e) => e.day))].filter((d) => d !== "*").map((d) => "день " + d).join(", ")}</em></div><ul class="ar-ex">`;
      h += L.map((e) => { const s = stats(e); return `<li data-arex="${e.id}"><span class="ar-ex__n">${esc(e.n)}</span><span class="ar-ex__l">${esc(setsTxt(s.last, e))}</span><span class="ar-ex__b">${s.best && s.last && s.best.k === s.last.k && !s.best.seed ? "★ " : ""}${esc(setsTxt(s.best, e))}</span></li>`; }).join("") + `</ul>`;
    });
    h += `</section>
      <section class="ar-info"><div class="st-h st-h--sub">Кардіо</div><p class="dy-note">${esc(A.cardio || "")}</p>
      <div class="st-h st-h--sub">Правила плацу</div><ul class="ar-rules">${(A.rules || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      ${A.progress ? `<p class="tr-at">${esc(A.progress)}</p>` : ""}</section>`;
    box.innerHTML = h;
  }

  /* ------------------------------------------------------------ аркуші --- */
  let el = null, mode = null, sel = null;
  function sheet() {
    if (el) return el;
    el = document.createElement("div"); el.className = "sheet dsheet ar-sheet"; el.id = "arSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    document.body.appendChild(el); el.addEventListener("click", onSheet);
    const A = API(); if (A.dragDismiss) A.dragDismiss(el, { target: () => el, close, follow: A.scrimFollow, scroller: () => el, can: (e) => e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" });
    return el;
  }
  function show(m, arg) { sheet(); mode = m; sel = arg; render(); const sc = $("scrim"); if (sc) { sc.classList.add("open"); sc.onclick = () => { close(); sc.onclick = null; }; } requestAnimationFrame(() => el.classList.add("open")); fx("open"); }
  function close() { if (!el) return; el.classList.remove("open"); const sc = $("scrim"); if (sc && !document.querySelector(".sheet.open")) sc.classList.remove("open"); refresh(); }
  const grip = `<div class="sheet__grip"></div>`;
  function render() {
    if (!el) return;
    let h = grip;
    if (mode === "ex") {
      const e = catalog().find((x) => x.id === sel) || {}, s = stats(e), H = s.H.slice(-12);
      const mx = Math.max(1, ...H.map((x) => x.w), s.best ? s.best.w : 0);
      h += `<div class="gs-kicker">${esc((AR().groups || {})[e.g] || "")} · день ${esc(e.day === "*" ? "A і B" : e.day)}</div><div class="sheet__title dy-sht">${esc(e.n)}</div>
        <div class="ar-lb"><div><span>останнє</span><b>${esc(setsTxt(s.last, e))}</b><em>${s.last ? (s.last.seed ? "з логу" : human(s.last.k)) : ""}</em></div><div><span>найкраще</span><b>${esc(setsTxt(s.best, e))}</b><em>${s.best ? (s.best.seed ? "з логу" : human(s.best.k)) : ""}</em></div></div>
        ${H.length > 1 ? `<div class="ar-spark">${H.map((x) => `<i style="height:${Math.round(8 + 50 * (e.inv ? 1 - x.w / mx + 0.2 : x.w / mx))}px" title="${human(x.k)}: ${fmtN(x.w)}"></i>`).join("")}</div>` : `<p class="dy-note">Графік зʼявиться, коли буде 2+ таблиці залу з цією вправою.</p>`}
        ${e.inv ? `<p class="tr-at">компенсація: менше кілограмів — важче</p>` : ""}
        <div class="gs-h">Записати вручну (якщо робив без таблиці)</div>
        <div class="ar-man"><input class="dy-in" id="arW" inputmode="decimal" placeholder="кг" value="${s.last && !e.body ? s.last.w : ""}"><input class="dy-in" id="arR" inputmode="text" placeholder="повтори: 12 12 10" value="${s.last ? s.last.reps.join(" ") : ""}"></div>
        <button type="button" class="btn btn--line" data-ar="man">Зберегти як останнє</button>
        <div class="gs-h">День спліту</div><div class="ar-ab">${["A", "B"].map((t) => `<button type="button" data-arday="${t}" class="${e.day === t ? "is-on" : ""}">${t}</button>`).join("")}</div>
        <button type="button" class="btn btn--ghost" data-ar="close">Закрити</button>`;
    } else if (mode === "lib") {
      want(libBooks().map((b) => "book:" + (b.art || String(b.t || "").toLowerCase().trim())).concat(libGames().map((g) => "game:" + (g.art || g.t.toLowerCase()))));
      const B = libBooks(), G = libGames(), reading = B.filter((b) => b.st === "read"), done = B.filter((b) => b.st === "done").sort((a, b) => ((b.end || "") > (a.end || "") ? 1 : -1)), q = B.filter((b) => b.st === "queue");
      const gd = G.filter((g) => g.st === "done"), gp = G.filter((g) => g.st === "play");
      const cover = (b) => { const a = art("book:" + (b.art || String(b.t || "").toLowerCase().trim())); return `<span class="lb-cover${a ? " has-art" : ""}">${a ? `<img src="${a}" alt="">` : `<b>${esc((b.t || "?").slice(0, 1))}</b>`}</span>`; };
      const statue = (g) => { const a = art("game:" + (g.art || g.t.toLowerCase())); return `<span class="lb-statue${a ? " has-art" : ""}${g.st === "play" ? " is-play" : ""}">${a ? `<img src="${a}" alt="">` : `<svg viewBox="0 0 40 52"><path d="M20 4a6 6 0 1 1 0 12a6 6 0 0 1 0-12zM12 20h16l3 18H9zM6 42h28v6H6z"/></svg>`}</span>`; };
      h += `<div class="gs-kicker">Бібліотека Ордену</div><div class="sheet__title dy-sht">Прочитане й пройдене</div>
        <div class="st-h st-h--sub">Читаю</div>${reading.length ? `<ul class="lb-books">${reading.map((b) => `<li data-lbbook="${esc(b.id)}">${cover(b)}<div><b>${esc(b.t)}</b><span>${esc(b.a || "")}</span></div></li>`).join("")}</ul>` : `<p class="dy-note">Зараз нічого — візьми з черги.</p>`}
        <div class="st-h st-h--sub">Прочитано <em>${done.length}</em></div>${done.length ? `<ul class="lb-books">${done.map((b) => `<li data-lbbook="${esc(b.id)}">${cover(b)}<div><b>${esc(b.t)}</b><span>${esc(b.a || "")}${b.end ? ` · ${human(b.end)}` : ""}</span></div></li>`).join("")}</ul>` : ""}
        ${q.length ? `<div class="st-h st-h--sub">На черзі</div><ul class="lb-books lb-books--q">${q.map((b) => `<li data-lbbook="${esc(b.id)}">${cover(b)}<div><b>${esc(b.t)}</b><span>${esc(b.a || "")}</span></div></li>`).join("")}</ul>` : ""}
        <div class="st-h st-h--sub">Зал трофеїв <em>${gd.length} пройдено</em></div>
        <div class="lb-games">${gp.concat(gd).map((g) => `<button type="button" data-lbgame="${esc(g.id)}">${statue(g)}<b>${esc(g.t)}</b><span>${g.st === "play" ? "у процесі" : esc(g.d && g.d.length === 10 ? human(g.d) : g.d || "")}</span></button>`).join("")}</div>
        <div class="lb-add"><input class="dy-in" id="lbT" placeholder="Нова гра чи книжка в чергу"><div class="ar-ab"><button type="button" data-ar="addg">+ гра</button><button type="button" data-ar="addb">+ книжка</button></div></div>
        <button type="button" class="btn btn--ghost" data-ar="close">Закрити</button>`;
    } else if (mode === "game") {
      const g = libGames().find((x) => x.id === sel) || {}, a = art("game:" + (g.art || (g.t || "").toLowerCase()));
      h += `<div class="lb-big">${a ? `<img src="${a}" alt="">` : ""}</div><div class="gs-kicker">${g.st === "play" ? "у процесі" : "пройдено" + (g.d ? " · " + (g.d.length === 10 ? human(g.d) : g.d) : "")}</div>
        <div class="sheet__title dy-sht">${esc(g.t)}</div>${g.note ? `<p class="dy-note dy-note--t">${esc(g.note)}</p>` : ""}
        ${g.st === "play" ? `<button type="button" class="btn btn--gold" data-ar="gdone">Пройдено!</button><button type="button" class="btn btn--line" data-ar="gdrop">Кинув — прибрати</button>` : `<button type="button" class="btn btn--line" data-ar="gundo">Ще не пройдено</button>`}
        <button type="button" class="btn btn--ghost" data-ar="lib">До бібліотеки</button>`;
    } else if (mode === "book") {
      const b = libBooks().find((x) => x.id === sel) || {}, a = art("book:" + (b.art || String(b.t || "").toLowerCase().trim()));
      h += `<div class="lb-big lb-big--book">${a ? `<img src="${a}" alt="">` : ""}</div><div class="gs-kicker">${b.st === "done" ? "прочитано" + (b.end ? " · " + human(b.end) : "") : b.st === "read" ? "читаю" : "на черзі"}</div>
        <div class="sheet__title dy-sht">${esc(b.t)}</div>${b.a ? `<p class="dy-note">${esc(b.a)}</p>` : ""}${b.note ? `<p class="dy-note dy-note--t">${esc(b.note)}</p>` : ""}
        ${b.take && b.take.length ? `<div class="gs-h">Що забрав собі</div><ul class="ar-rules">${b.take.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${b.st === "queue" || (b.st === "read" && b.src === "lib") ? `<button type="button" class="btn btn--gold" data-ar="bstart">Почати читати — на полицю Дня</button><button type="button" class="btn btn--line" data-ar="bdrop">Прибрати з черги</button>` : ""}
        ${b.st === "read" && b.src === "bk" ? `<p class="dy-note">Сторінки й «дочитав» — на полиці в справі читання (День).</p>` : ""}
        <button type="button" class="btn btn--ghost" data-ar="lib">До бібліотеки</button>`;
    }
    el.innerHTML = h;
  }
  function onSheet(e) {
    const ab = e.target.closest("[data-arday]");
    if (ab) { const o = ARM.ex[sel] = ARM.ex[sel] || {}; o.day = ab.dataset.arday; o.mt = Date.now(); saveA(); fx(null); render(); return; }
    const lb = e.target.closest("[data-lbbook]"); if (lb) { mode = "book"; sel = lb.dataset.lbbook; render(); return; }
    const lg = e.target.closest("[data-lbgame]"); if (lg) { mode = "game"; sel = lg.dataset.lbgame; render(); return; }
    const b = e.target.closest("[data-ar]"); if (!b) return;
    const a = b.dataset.ar;
    if (a === "close") { close(); return; }
    if (a === "lib") { mode = "lib"; render(); return; }
    if (a === "man") {
      const w = parseFloat(($("arW").value || "0").replace(",", ".")) || 0, reps = ($("arR").value || "").split(/[^\d]+/).map(Number).filter((x) => x > 0);
      if (!reps.length) return;
      const o = ARM.ex[sel] = ARM.ex[sel] || {}; o.last = { k: today(), w, reps }; o.mt = Date.now(); saveA(); fx("yes", "medium"); render(); refresh(); return;
    }
    if (a === "gdone" || a === "gundo" || a === "gdrop") {
      const o = LIB.games[sel] = LIB.games[sel] || {}; o.st = a === "gdone" ? "done" : a === "gdrop" ? "drop" : "play"; o.d = a === "gdone" ? today() : o.d || null; o.mt = Date.now(); saveL();
      fx(a === "gdone" ? "date" : null, "medium"); if (a === "gdrop") { mode = "lib"; } render(); refresh(); return;
    }
    if (a === "bstart") { const bk = libBooks().find((x) => x.id === sel); const Y = DY(); if (bk && Y && Y.bookStart) { Y.bookStart(bk.t, null, bk.art || null); const o = LIB.books[sel] = LIB.books[sel] || {}; o.st = "drop"; o.moved = 1; o.mt = Date.now(); saveL(); fx("yes", "medium"); mode = "lib"; render(); } return; }
    if (a === "bdrop") { const o = LIB.books[sel] = LIB.books[sel] || {}; o.st = "drop"; o.mt = Date.now(); saveL(); mode = "lib"; render(); return; }
    if (a === "addg" || a === "addb") {
      const t = ($("lbT").value || "").trim(); if (!t) return;
      const id = (a === "addg" ? "g" : "b") + Date.now().toString(36);
      if (a === "addg") LIB.games[id] = { t, st: "play", mt: Date.now() }; else LIB.books[id] = { t, st: "queue", mt: Date.now() };
      saveL(); fx("yes"); render(); return;
    }
  }
  function refresh() { cnt = null; const A = API(); if (A.tab && A.tab() === "armory") renderArmory(); }

  /* кліки на екрані Зброярні */
  document.addEventListener("click", (e) => {
    if (!e.target.closest) return;
    if (e.target.closest("[data-lib]")) { show("lib"); return; }
    const v = e.target.closest("#armoryBody"); if (!v) return;
    const ab = e.target.closest("[data-arab]");
    if (ab) { ARM.next = { type: ab.dataset.arab, from: today(), at: Date.now() }; saveA(); fx(null); renderArmory(); return; }
    const ex = e.target.closest("[data-arex]"); if (ex) { show("ex", ex.dataset.arex); return; }
    const st = e.target.closest('[data-ar="start"]');
    if (st) { const P = plan(), Y = DY(); if (P && Y && Y.gymOpen) Y.gymOpen(planSets(P)); return; }
  });
  window.addEventListener("ordo-art", () => { refresh(); if (el && el.classList.contains("open")) render(); });

  /* для писаря: зведення Зброярні й бібліотеки */
  function writer() {
    const P = plan(), t0 = today();
    return { next: P ? { k: P.k, type: P.type, label: P.label, warn: P.warn, prog: P.prog ? { n: P.prog.n, kind: P.prog.prog, w: P.prog.w, reps: P.prog.reps } : null,
        ex: P.ex.map((x) => ({ n: x.n, last: x.last ? { w: x.last.w, reps: x.last.reps, d: x.last.seed ? "лог" : x.last.k } : null, target: { w: x.w, reps: x.reps } })) } : null,
      month: monthCount(t0.slice(0, 7)), goal: AR().goal, months: months().map((m) => [m.key, m.gym, m.cardio]),
      lifts: catalog().map((e) => { const s = stats(e); return { n: e.n, day: e.day, last: s.last ? [s.last.w, s.last.reps.join("/")] : null, best: s.best ? [s.best.w, s.best.reps.join("/")] : null }; }),
      counts: counts(),
      books: libBooks().map((b) => ({ t: b.t, st: b.st, end: b.end || null })), games: libGames().map((g) => ({ t: g.t, st: g.st, d: g.d || null })) };
  }
  window.ORDO_ARM = { renderArmory, plan, stats, catalog, counts, count, liftHit, gameDoneFor, libBooks, libGames, openLib: () => show("lib"), writer, reload };
})();
