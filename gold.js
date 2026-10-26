/* ============================================================================
   ORDO — золото Ордену. Нараховується з книги досвіду (ідеальні дні, квести, віхи, цілі, зал…),
   тож рахується саме й однаково на всіх пристроях. Витрачається двома шляхами:
   у крамниці Сенешаля (внутрішні бонуси) або виводиться 1:1 на білу картку — Орден бачить
   поповнення у виписці банку й закриває виведення сам. Біла картка — гаманець нагород.
   ========================================================================== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtN = (n) => Math.round(n).toLocaleString("uk-UA");
  const DAY = () => window.ORDO_DAY, T = () => window.ORDO_TREASURY, API = () => window.ORDO_API || {};
  const START = "2026-10-26";                                  // з цього дня Орден платить золотом
  const START_T = Date.parse(START + "T00:00:00+02:00") / 1000;
  const VM = { 7: 20, 14: 30, 30: 100, 60: 150, 90: 200, 100: 300, 180: 400, 365: 1000 };      // віхи обітниць
  const QG = { rare: 30, legend: 120, myth: 400 };

  let G = LS.get("ordo.gold", null) || {};                     // { out: { id: { at, amt, kind: white|shop, st: pending|done|cancel, tx, item } } } — синхронізується
  G.out = G.out || {};
  const save = () => LS.set("ordo.gold", G);
  const coin = (cls) => `<svg class="gd-coin${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5"/><path d="M12 8.5v7M9.5 12h5"/></svg>`;

  /* ------------------------------------------------------------- нарахування */
  function goldOf(id, e, Q) {
    const p = id.split(":")[0];
    if (p === "pd") return 20;                                 // ідеальний день
    if (p === "gy") return 10;                                 // запис тренування
    if (p === "st") return 5;                                  // 10 000 кроків
    if (p === "jr") return 5;                                  // сповідь
    if (p === "er") return 3;                                  // ранній підйом
    if (p === "a") return 50;                                  // нагорода
    if (p === "g") return e.xp >= 400 ? 250 : 60;              // ціль року / місяця
    if (p === "gm") return Math.round(e.xp / 2);               // ревю: відсоток виконаного
    if (p === "vm") { const m = +id.split(":")[2]; return VM[m] || Math.round(m * 1.5); }
    if (p === "q") { const q = Q.list.find((x) => "q:" + x.id === id), b = QG[q && q.rar] || 30; return q && q.st === "part" ? Math.round(b * 0.4) : b; }
    return 0;
  }
  function ledger() {
    const D = DAY(); if (!D || !D._state) return [];
    const { X, Q } = D._state();
    return Object.entries(X.e || {}).filter(([, e]) => e.d >= START).map(([id, e]) => ({ id, d: e.d, why: e.why, g: goldOf(id, e, Q) })).filter((x) => x.g > 0);
  }
  const earned = () => ledger().reduce((a, x) => a + x.g, 0);
  const spent = () => Object.values(G.out).filter((o) => o.st !== "cancel").reduce((a, o) => a + o.amt, 0);
  const balance = () => earned() - spent();
  const pending = () => Object.values(G.out).filter((o) => o.kind === "white" && o.st === "pending");

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

  /* ----------------------------------------------------------------- відгук */
  function toast(html) { const el = $("dyToast"); if (!el) return; el.className = "dy-toast dy-toast--gold"; el.innerHTML = html; void el.offsetWidth; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2400); }
  /* після дій «Дня»: якщо золота прибуло — показати (після тосту досвіду) */
  function tick() {
    const e = earned(), seen = LS.get("ordo.k.goldSeen", null);
    if (seen === null) { LS.set("ordo.k.goldSeen", e); return; }
    if (e > seen) { LS.set("ordo.k.goldSeen", e); setTimeout(() => toast(`${coin()}<b>+${fmtN(e - seen)}</b> золота`), 1900); }
    else if (e < seen) LS.set("ordo.k.goldSeen", e);
  }

  /* ------------------------------------------------------------------ вигляд */
  const chip = () => `<span class="gd-chip">${coin()}<b>${fmtN(balance())}</b></span>`;
  function html() {
    reconcile();
    const b = balance(), L = ledger(), mk = new Date().toISOString().slice(0, 7);
    const month = L.filter((x) => x.d.startsWith(mk)).reduce((a, x) => a + x.g, 0);
    const W = T() && T().white && T().white(), pd = pending();
    const recent = L.sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : 0)).slice(0, 5);
    const outs = Object.values(G.out).filter((o) => o.st !== "cancel").sort((a, b) => b.at - a.at).slice(0, 4);
    return `<section class="st-sec gd"><div class="st-h">Золото Ордену</div>
      <div class="gd-big">${coin("gd-coin--big")}<b>${fmtN(b)}</b><span>золота</span></div>
      <div class="tr-row"><span>цього місяця зароблено <b>${fmtN(month)}</b></span>${W && W.bal != null ? `<span>біла картка <b>${fmtN(W.bal / 100)} ₴</b></span>` : ""}</div>
      ${pd.length ? `<p class="gd-wait">в дорозі на білу картку — <b>${fmtN(pd.reduce((a, p) => a + p.amt, 0))} ₴</b> · чекаю на поповнення у виписці</p>` : ""}
      <div class="dy-acts"><button type="button" class="btn btn--gold" data-gd="out" ${b > 0 ? "" : "disabled"}>Вивести на білу картку</button></div>
      ${recent.length ? `<div class="st-h st-h--sub">Нещодавно</div><ul class="tr-top gd-list">${recent.map((x) => `<li><span>${esc(x.why)}</span><b>+${fmtN(x.g)}</b></li>`).join("")}</ul>` : ""}
      ${outs.length ? `<div class="st-h st-h--sub">Виведено й витрачено</div><ul class="tr-top gd-list">${outs.map((o) => `<li><span>${o.kind === "white" ? (o.st === "pending" ? "на білу картку · чекаю" : "на білу картку") : esc(o.item || "крамниця")}</span><b>−${fmtN(o.amt)}</b></li>`).join("")}</ul>` : ""}
      <p class="tr-at">золото — за ідеальні дні, квести, віхи обітниць, цілі, зал. 1 золото = 1 ₴ на білій картці</p></section>`;
  }

  /* --------------------------------------------------------- виведення (лист) */
  let el = null, amt = 0, polls = [];
  function sheet() {
    if (el) return el;
    el = document.createElement("div"); el.className = "sheet dsheet gd-sheet"; el.id = "gdSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", onSheet);
    el.addEventListener("input", (e) => { if (e.target.id === "gdAmt") { amt = Math.max(0, Math.floor(+e.target.value.replace(/\D/g, "") || 0)); const ok = $("gdOk"); if (ok) ok.disabled = !(amt > 0 && amt <= balance()); } });
    const A = API(); if (A.dragDismiss) A.dragDismiss(el, { target: () => el, close, follow: A.scrimFollow, scroller: () => el, can: (e) => e.target.tagName !== "INPUT" });
    return el;
  }
  function render(step) {
    const b = balance();
    if (step === "sent") {
      el.innerHTML = `<div class="sheet__grip"></div><div class="gs-kicker">Золото Ордену</div><div class="sheet__title dy-sht">Переведи ${fmtN(amt)} ₴ на білу картку</div>
        <p class="dy-note dy-note--t">У монобанку: з чорної картки на білу <b>…9467</b>. Золото вже відкладено; щойно поповнення зʼявиться у виписці (зазвичай 1–2 хв), Сенешаль закриє виведення. Не прийде за добу — золото повернеться.</p>
        <a class="btn btn--gold" href="monobank://" data-gd="mono">Відкрити монобанк</a>
        <button type="button" class="btn btn--ghost" data-gd="close">Готово</button>`;
      return;
    }
    amt = Math.min(b, amt || Math.min(b, 500));
    el.innerHTML = `<div class="sheet__grip"></div><div class="gs-kicker">Золото Ордену</div><div class="sheet__title dy-sht">Вивести на білу картку</div>
      <p class="dy-note">Є ${coin()}<b>${fmtN(b)}</b>. 1 золото = 1 ₴.</p>
      <div class="dy-f dy-f--row"><label>Скільки</label><input class="dy-in dy-in--n" id="gdAmt" inputmode="numeric" value="${amt}"><span class="dy-unit">₴</span></div>
      <div class="dy-chips">${[100, 300, 500].filter((v) => v <= b).map((v) => `<button type="button" data-gdv="${v}">${v}</button>`).join("")}<button type="button" data-gdv="${b}">усе · ${fmtN(b)}</button></div>
      <button type="button" class="btn btn--gold" id="gdOk" data-gd="ok" ${amt > 0 ? "" : "disabled"}>Вивести ${coin()}</button>
      <button type="button" class="btn btn--ghost" data-gd="close">Скасувати</button>`;
  }
  function open() {
    sheet(); amt = 0; render();
    const sc = $("scrim"); if (sc) { sc.classList.add("open"); sc.addEventListener("click", close, { once: true }); }
    requestAnimationFrame(() => el.classList.add("open"));
    const A = API(); if (A.FX) A.FX.play && A.FX.play("open");
  }
  function close() { if (!el) return; el.classList.remove("open"); const sc = $("scrim"); if (sc && !document.querySelector(".sheet.open")) sc.classList.remove("open"); }
  function onSheet(e) {
    const v = e.target.closest("[data-gdv]"); if (v) { amt = +v.dataset.gdv; render(); return; }
    const b = e.target.closest("[data-gd]"); if (!b) return;
    const a = b.dataset.gd;
    if (a === "close") { close(); return; }
    if (a === "ok") {
      if (!(amt > 0 && amt <= balance())) return;
      const id = "o" + Date.now().toString(36);
      G.out[id] = { at: Date.now(), amt, kind: "white", st: "pending" }; save();
      const A = API(); if (A.FX) { A.FX.play && A.FX.play("yes"); A.FX.buzz && A.FX.buzz("medium"); }
      render("sent"); refreshViews(); watchBank();
    }
  }
  /* швидка звірка: попросити свіжу виписку одразу й перечитувати її кілька хвилин, поки поповнення не зʼявиться */
  function watchBank() {
    const V = window.ORDO_VAULT; polls.forEach(clearTimeout); polls = [];
    if (V && V.dispatch) V.dispatch("bank");
    [45, 75, 105, 140, 180, 240, 300, 420].forEach((s) => polls.push(setTimeout(async () => {
      if (!pending().length) return;
      if (T() && T().load) await T().load(true);
      if (reconcile()) { refreshViews(); const d = Object.values(G.out).filter((o) => o.done && Date.now() - o.done < 30 * 60e3); if (d.length) toast(`${coin()}<b>${fmtN(d[d.length - 1].amt)} ₴</b> на білій картці`); }
    }, s * 1000)));
  }
  function refreshViews() { const A = API(); if (A.renderStats && A.tab && A.tab() === "stats") A.renderStats(); if (DAY() && DAY().render) DAY().render(); }

  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-gd='out']"); if (b && !b.closest("#gdSheet")) open(); });
  /* виведення в дорозі, а додаток перезапустили — продовжуємо стежити */
  setTimeout(() => { if (pending().length) watchBank(); }, 6000);

  window.ORDO_GOLD = { html, chip, tick, balance, earned, reconcile, coin };
})();
