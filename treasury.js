/* ============================================================================
   ORDO — Скарбниця: витрати з банку в паладинських термінах.
   Виписку тягне GitHub Action у приватному репозиторії (bank/summary.json,
   зашифровано ключем сховища). Тут — лише показ, коментарі храмовників,
   сторожа обітниць (розмова, не вирок) і дані для бюджетних квестів.
   Тексти — у зашифрованому вмісті (D.DAY.bank).
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
  const pick = (a) => a && a.length ? a[Math.floor(Math.random() * a.length)] : "";
  const fill = (s, o) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : "");
  const p2 = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const today = () => keyOf(new Date());
  const add = (k, n) => { const [y, m, d] = k.split("-").map(Number); const x = new Date(y, m - 1, d + n, 12); return keyOf(x); };
  const MN = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
  const ML = ["січні", "лютому", "березні", "квітні", "травні", "червні", "липні", "серпні", "вересні", "жовтні", "листопаді", "грудні"];
  const MG = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  const CUR = { 980: "₴", 840: "$", 978: "€" };
  const money = (k, cur) => `${Math.round(Math.abs(k) / 100).toLocaleString("uk-UA")} ${CUR[cur || 980] || ""}`.trim();

  let B = LS.get("ordo.k.bank", null);                      // зведення (лише на пристрої)
  let W = LS.get("ordo.bank", null) || {};                   // рішення сторожі (синхронізується)
  W.seen = W.seen || {}; W.ok = W.ok || []; W.week = W.week || "";
  const saveW = () => LS.set("ordo.bank", W);
  let view = 0;                                               // 0 — поточний місяць, -1 — попередній…

  /* ---------------------------------------------------------- завантаження */
  let loadedAt = 0;
  async function load(force) {
    const V = window.ORDO_VAULT; if (!V || !V.readSealed) return;
    if (!force && Date.now() - loadedAt < 10 * 60e3) return;
    loadedAt = Date.now();
    try {
      const s = await V.readSealed("bank/summary.json");
      if (s && s.at !== (B && B.at)) { B = s; LS.set("ordo.k.bank", s); const A = API(); if (A.tab && A.tab() === "stats" && A.renderStats) A.renderStats(); }
    } catch (e) {}
  }

  /* ------------------------------------------------------------ обчислення */
  const EXCL = ["home", "healer", "tithe"];                   // обовʼязкове — не рахуємо в «ощадливість»
  function spentIn(cats, from, to) {
    if (!B || !B.days) return null;
    let s = 0;
    for (let k = from; k <= to; k = add(k, 1)) {
      const d = B.days[k]; if (!d) continue;
      Object.keys(d).forEach((c) => { if (cats === "*" ? !EXCL.includes(c) : cats.includes(c)) s += d[c]; });
    }
    return s;
  }
  /* середні витрати за тиждень у категоріях — за останні три повні місяці */
  function avgWeek(cats) {
    if (!B || !B.months) return null;
    const cur = today().slice(0, 7), ms = Object.keys(B.months).filter((m) => m < cur).sort().slice(-3);
    if (!ms.length) return null;
    const tot = ms.reduce((a, m) => a + Object.entries(B.months[m].by || {}).reduce((x, [c, v]) => x + ((cats === "*" ? !EXCL.includes(c) : cats.includes(c)) ? v : 0), 0), 0);
    return tot / ms.length / 4.35;
  }
  /* скільки збережено завдяки обітницям: середнє «до» × місяці «після» − фактичне «після» */
  const BK = () => (D().DAY || {}).bank || {};               // привʼязки обітниць до категорій — у зашифрованому вмісті
  function savings() {
    const VOW_CATS = BK().vowCats || {};
    if (!B || !B.months) return [];
    const starts = LS.get("ordo.starts", {}), out = [];
    (D().VOWS || []).forEach((v) => {
      const cats = VOW_CATS[v.id]; if (!cats) return;
      const st = (starts[v.id] || v.start).slice(0, 7);
      const ms = Object.keys(B.months).sort(), pre = ms.filter((m) => m < st), post = ms.filter((m) => m >= st);
      if (pre.length < 2 || !post.length) return;
      const sumC = (m) => cats.reduce((a, c) => a + ((B.months[m].by || {})[c] || 0), 0);
      const avg = pre.reduce((a, m) => a + sumC(m), 0) / pre.length;
      const saved = Math.round(avg * post.length - post.reduce((a, m) => a + sumC(m), 0));
      if (avg > 0 && saved > 0) out.push({ v, saved, avg });
    });
    return out;
  }

  /* --------------------------------------------------------- Літопис ----- */
  function comment(M, P, mk) {
    const L = ((D().DAY || {}).bank || {}).comment || {};
    const top = Object.entries(M.by || {}).sort((a, b) => b[1] - a[1])[0];
    const o = { sum: money(M.spent), cat: top ? (B.cats[top[0]] || top[0]) : "", catsum: top ? money(top[1]) : "" };
    let sit = "steady";
    if (P && P.spent) {
      const day = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const pace = mk === today().slice(0, 7) ? M.spent / Math.max(1, day) * dim : M.spent;
      const d = (pace - P.spent) / P.spent; o.pct = Math.round(Math.abs(d) * 100) + "%";
      sit = d < -0.1 ? "less" : d > 0.15 ? "more" : "steady";
    }
    if ((M.by || {}).courier > 0.08 * M.spent) sit = sit === "more" ? "more" : "courier", o.cour = money(M.by.courier);
    const who = new Date().getDate() % 2 ? BK().giver || "supreme" : "supreme";
    return { who, text: fill(pick(L[sit]) || pick(L.steady) || "Скарбниця під наглядом.", o) };
  }
  function statsHTML() {
    if (!B || !B.months) return `<section class="st-sec tr"><div class="st-h">Скарбниця</div><p class="gl-empty">Книга скарбниці відкриється після першої виписки з банку.</p></section>`;
    const ms = Object.keys(B.months).sort(), cur = today().slice(0, 7);
    const idx = Math.max(0, Math.min(ms.length - 1, (ms.includes(cur) ? ms.indexOf(cur) : ms.length - 1) + view));
    const mk = ms[idx], M = B.months[mk], P = B.months[ms[idx - 1]];
    const cats = Object.entries(M.by || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const mx = cats.length ? cats[0][1] : 1;
    const c = comment(M, P, mk);
    const K = c.who === "supreme" ? (D().KEEPERS || {}).supreme : (D().KEEPERS || {})[c.who];
    let h = `<section class="st-sec tr"><div class="st-h">Скарбниця</div>
      <div class="tr-nav"><button type="button" data-tr="-1" ${idx <= 0 ? "disabled" : ""} aria-label="Попередній місяць">‹</button>
        <b>${MN[+mk.slice(5) - 1]} ${mk.slice(0, 4)}</b><button type="button" data-tr="1" ${idx >= ms.length - 1 ? "disabled" : ""} aria-label="Наступний місяць">›</button></div>
      <div class="tr-big"><span>витрачено</span><b>${money(M.spent)}</b>${P && P.spent ? `<em>у ${ML[+ms[idx - 1].slice(5) - 1]} — ${money(P.spent)}</em>` : ""}</div>
      <div class="tr-row"><span>надійшло <b>${money(M.income)}</b></span>${M.cb ? `<span>кешбек <b>${money(M.cb)}</b></span>` : ""}<span>покупок <b>${M.n}</b></span></div>`;
    const accs = B.accs || [];
    if (accs.length) {
      h += `<div class="tr-accs">${accs.filter((a) => a.kind === "card").map((a) => `<span class="tr-acc"><em>картка ${esc(a.label)}</em><b>${money(a.bal, a.cur)}</b></span>`).join("")}</div>`;
      accs.filter((a) => a.kind === "jar").forEach((a) => {
        const J = (B.jars || {})[a.label] || { months: {}, recent: [] }, JM = J.months[mk] || { in: 0, out: 0 };
        const p = a.goal ? Math.min(1, a.bal / a.goal) : 0;
        h += `<div class="tr-jar"><div class="tr-jar__h"><span>скарбничка</span><b>${esc(a.label)}</b><strong>${money(a.bal, a.cur)}</strong></div>
          ${a.goal ? `<div class="gl-bar"><i style="width:${Math.round(p * 100)}%"></i></div><em class="tr-jar__g">${Math.round(p * 100)}% від мети ${money(a.goal, a.cur)}</em>` : ""}
          <div class="tr-row"><span>цього місяця покладено <b>${money(JM.in, a.cur)}</b></span>${JM.out ? `<span>знято <b>${money(JM.out, a.cur)}</b></span>` : ""}</div>
          ${J.recent.length ? `<ul class="tr-top">${J.recent.slice(0, 4).map((t) => { const d = new Date(t.t * 1000); return `<li><span>${d.getDate()} ${MG[d.getMonth()]} · ${esc(t.d)}</span><b>${t.a > 0 ? "+" : "−"}${money(t.a, a.cur)}</b></li>`; }).join("")}</ul>` : ""}</div>`;
      });
    }
    if (K) h += `<div class="md md--voice tr-voice"><div class="md__fig"${K.art ? ` data-card="${c.who}"` : ""}>${K.art ? `<img class="md__img" src="${esc(K.art)}" alt="">` : ""}</div><div class="md__txt"><div class="md__who">${esc(K.name)}</div><p class="md__say">${esc(c.text)}</p></div></div>`;
    const risk = BK().risk || [];
    h += `<ul class="tr-cats">${cats.map(([k, v]) => `<li class="tr-c${risk.includes(k) ? " tr-c--risk" : k === BK().warm ? " tr-c--warm" : ""}"><span class="tr-c__n">${esc(B.cats[k] || k)}</span><span class="tr-c__v">${money(v)}</span><i style="width:${Math.max(2, Math.round(100 * v / mx))}%"></i></li>`).join("")}</ul>`;
    const top = (B.top || {})[mk] || [];
    if (top.length) h += `<div class="st-h st-h--sub">Найбільші витрати</div><ul class="tr-top">${top.slice(0, 5).map((t) => { const d = new Date(t.t * 1000); return `<li><span>${d.getDate()} ${MG[d.getMonth()]} · ${esc(t.d)}</span><b>${money(t.a)}</b></li>`; }).join("")}</ul>`;
    const sv = savings();
    if (sv.length) h += `<div class="st-h st-h--sub">Збережено обітницями</div><ul class="tr-save">${sv.map((x) => `<li><svg><use href="#i-${x.v.icon}"/></svg><span>${esc(x.v.name)}</span><b>≈ ${money(x.saved)}</b></li>`).join("")}<li class="tr-save__all"><span>Разом</span><b>≈ ${money(sv.reduce((a, x) => a + x.saved, 0))}</b></li></ul>`;
    const wl = (B.watch || []).slice(-6).reverse();
    if (wl.length) h += `<div class="st-h st-h--sub">Сторожа</div><ul class="tr-watch">${wl.map((t) => { const d = new Date(t.t * 1000), s = W.seen[t.id]; return `<li class="${s ? "is-" + s : "is-new"}"><span>${d.getDate()} ${MG[d.getMonth()]} · ${esc(t.d)}</span><b>${money(t.a)}</b><em>${s === "ok" ? "гідно" : s === "breach" ? "зрив" : s === "later" ? "відкладено" : "не розглянуто"}</em></li>`; }).join("")}</ul>`;
    const cards = accs.filter((a) => a.kind === "card").map((a) => a.label);
    if (cards.length) h += `<p class="tr-at">враховано ${cards.length > 1 ? "картки" : "картку"} ${cards.join(" і ")}; перекази між своїми рахунками й поповнення скарбничок — не витрати</p>`;
    return h + `<p class="tr-at">виписка від ${new Date(B.at).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p></section>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-tr]"); if (!b) return;
    view += +b.dataset.tr; const A = API(); if (A.renderStats) A.renderStats(); if (A.FX) A.FX.buzz("light");
  });

  /* --------------------------------------------------------------- сцени */
  async function watchScene(t) {
    const h = H(), A = API(); if (!h) return false;
    const L = (((D().DAY || {}).bank || {}).watch || {})[t.w] || {};
    const d = new Date(t.t * 1000);
    const o = { sum: money(t.a), what: t.d || "покупка", who: (t.cn || "невідомому").replace(/[.\s]+$/, ""), when: `${d.getDate()} ${MG[d.getMonth()]}` };
    h.stage(t.w);
    if ((await h.say(fill(L.ask || "Брате, бачу в книзі скарбниці: {when} — {what}, {sum}. Розкажеш?", o))) === "closed") return false;
    const opts = L.c || [{ t: "Усе гідно", v: "ok", r: "Добре. Вірю." }, { t: "Це був зрив", v: "breach", r: "Дякую за чесність. Відміть його — і починаємо знову." }, { t: "Не зараз", v: "later", r: "Гаразд. Повернемось до цього." }];
    const i = await h.choose(fill(L.q || "Що це було?", o), opts.map((x) => fill(x.t, o)), "hall__acts--list");
    if (i === "closed") return false;
    const ch = opts[i];
    W.seen[t.id] = ch.v === "family" ? "ok" : ch.v; if (ch.v === "family" && t.cn && !W.ok.includes(t.cn)) W.ok.push(t.cn);
    saveW();
    await h.say(fill(ch.r, o));
    if (ch.v === "breach" && A.openVow) { h.close(); setTimeout(() => A.openVow(t.w), 450); return false; }
    return true;
  }
  /* понеділок: тижневе зведення від хранителя гідності */
  async function weekScene() {
    const h = H(); if (!h || !B || !B.days) return false;
    const t0 = today(), wd = (new Date().getDay() + 6) % 7;
    const mon = add(t0, -wd), from = add(mon, -7), to = add(mon, -1);
    if (W.week === mon || wd > 2) return false;
    const s = spentIn("*", from, to), prev = spentIn("*", add(from, -7), add(to, -7));
    if (!s) { W.week = mon; saveW(); return false; }
    const by = {}; for (let k = from; k <= to; k = add(k, 1)) Object.entries(B.days[k] || {}).forEach(([c, v]) => { by[c] = (by[c] || 0) + v; });
    const top = Object.entries(by).filter(([c]) => !EXCL.includes(c)).sort((a, b) => b[1] - a[1])[0];
    const L = ((D().DAY || {}).bank || {}).week || {};
    const o = { sum: money(s), cat: top ? B.cats[top[0]] : "", catsum: top ? money(top[1]) : "", prev: prev ? money(prev) : "", pct: prev ? Math.round(Math.abs(s - prev) / prev * 100) + "%" : "" };
    W.week = mon; saveW();
    h.stage(BK().giver || "supreme");
    if ((await h.say(fill(pick(L.open) || "Брате, тиждень у скарбниці закрито: {sum}.", o))) === "closed") return false;
    if (prev && (await h.say(fill(pick(s <= prev ? L.less : L.more) || "", o))) === "closed") return false;
    return true;
  }
  async function scenes() {
    if (!B || !B.watch) return;
    const cutoff = Date.now() / 1000 - 3 * 86400;                  // питаємо лише про свіже; старше — у списку сторожі
    const ask = BK().ask || [], named = BK().named || [];
    const todo = B.watch.filter((t) => ask.includes(t.w) && !W.seen[t.id] && t.t >= cutoff && !(named.includes(t.w) && W.ok.includes(t.cn))).slice(0, 2);
    for (const t of todo) { if (!(await watchScene(t))) return; }
    await weekScene();
    const h = H(); if (h && h.isOpen()) h.close();
  }

  window.ORDO_TREASURY = { load, statsHTML, scenes, spentIn, avgWeek, savings, ready: () => !!(B && B.days), at: () => B && B.at ? B.at.slice(0, 10) : "", money, cats: () => (B && B.cats) || {} };
})();
