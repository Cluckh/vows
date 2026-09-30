/* ============================================================================
   ORDO — двигун. Контент живе в data.js. Усі звернення до елементів захищені:
   якщо чогось нема — пропускаємо, додаток не падає (важливо під час кешу).
   ========================================================================== */
(function () {
  "use strict";
  const D = window.ORDO_DATA;
  const $ = (id) => document.getElementById(id);
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 250) : ms));

  /* ---- сховище ---- */
  const LS = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---- дати ---- */
  const MONTHS = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
  const MONTHS_NOM = ["січень","лютий","березень","квітень","травень","червень","липень","серпень","вересень","жовтень","листопад","грудень"];
  const MONTHS_LOC = ["січні","лютому","березні","квітні","травні","червні","липні","серпні","вересні","жовтні","листопаді","грудні"];
  const WEEK = ["неділя","понеділок","вівторок","середа","четвер","пʼятниця","субота"];
  const pad = (n) => String(n).padStart(2, "0");
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parseLocal = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => keyOf(new Date());
  const monthKey = (d) => { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
  const streakOf = (s) => Math.max(0, dayDiff(new Date(), parseLocal(s)));
  const daysIn = (mk) => { const [y, m] = mk.split("-").map(Number); return new Date(y, m, 0).getDate(); };
  const monthName = (mk) => MONTHS_NOM[Number(mk.split("-")[1]) - 1];
  const isLastDayOfMonth = () => { const d = new Date(); return d.getDate() === daysIn(monthKey(d)); };
  function pluralUk(n, f) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; }
  const daysWord = (n) => pluralUk(n, ["день", "дні", "днів"]);
  const fmtShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const fmtKey = (k) => fmtShort(parseLocal(k));

  /* ================================================================ ВІДГУК ==
     Тихі дзвони синтезуються на льоту. iPhone: звук після першого дотику,
     беззвучний режим поважається, музику не перебиває. Вібро: Android — API,
     iPhone (iOS 18+) — системний тактильний клік перемикача.               */
  const FX = (() => {
    let ac = null, enabled = LS.get("ordo.sound", true);
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
    function ctx() { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (e) { return null; } } return ac; }
    function unlock() { if (!enabled) return; const c = ctx(); if (c && c.state !== "running") c.resume().catch(() => {}); }
    function bell(f, when, dur, vol) {
      const c = ac, t = c.currentTime + (when || 0);
      const out = c.createGain(); out.gain.value = vol; out.connect(c.destination);
      [[1, 1], [2.01, .42], [2.76, .24], [4.07, .11], [5.43, .05]].forEach(([r, g], i) => {
        const o = c.createOscillator(), a = c.createGain();
        o.type = "sine"; o.frequency.value = f * r;
        a.gain.setValueAtTime(0.0001, t);
        a.gain.exponentialRampToValueAtTime(g, t + 0.006);
        a.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i * 0.6));
        o.connect(a); a.connect(out); o.start(t); o.stop(t + dur + 0.05);
      });
    }
    const S = {
      open: () => bell(784, 0, 1.1, .04),
      fold: () => bell(1047, 0, .55, .028),
      tab: () => bell(1175, 0, .45, .02),
      mark: () => { bell(1175, 0, .8, .045); bell(880, .09, 1.1, .04); },
      over: () => { bell(330, 0, 1.6, .05); bell(311, .07, 1.8, .035); },
      reset: () => { bell(196, 0, 2.6, .07); bell(147, .06, 3, .05); },
      toggle: () => bell(988, 0, .5, .03),
      date: () => bell(523.25, 0, 2.2, .035),
      quote: () => bell(659.25, 0, 2.4, .03),
      sign: () => bell(783.99, 0, 2, .03),
      add: () => { bell(880, 0, .7, .035); bell(1318.5, .08, .9, .025); },
      yes: () => { bell(783.99, 0, 1.4, .045); bell(1174.7, .1, 1.6, .03); },
      no: () => bell(220, 0, 1.4, .04),
      ms: () => { [523.25, 659.25, 783.99].forEach((f, i) => bell(f, i * .12, 2.8, .045)); bell(1046.5, .42, 3.2, .03); },
      medal: () => { [392, 523.25, 659.25, 783.99].forEach((f, i) => bell(f, i * .16, 3.4, .045)); bell(1568, .8, 3, .02); },
      year: () => { bell(130.81, 0, 6, .07); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, .3 + i * .2, 4.5, .045)); bell(1318.5, 1.3, 4, .025); }
    };
    function play(name, g) {
      if (!enabled || !S[name]) return;
      if (g) unlock();
      if (!ac || (ac.state !== "running" && !g)) return;
      try { S[name](); } catch (e) {}
    }
    const hxl = $("hxLabel");
    function buzz(kind) {
      if (!enabled) return;
      const pat = { light: 8, medium: 18, heavy: [24, 70, 24] }[kind] || 8;
      if (typeof navigator.vibrate === "function") { try { navigator.vibrate(pat); } catch (e) {} return; }
      if (hxl) { try { hxl.click(); } catch (e) {} }
    }
    return { unlock, play, buzz, get enabled() { return enabled; }, set(v) { enabled = v; LS.set("ordo.sound", v); } };
  })();
  ["pointerdown", "touchend", "keydown"].forEach((ev) => document.addEventListener(ev, FX.unlock, { passive: true }));

  /* ============================================================ СТАН ======= */
  if (!LS.get("ordo.since", null)) LS.set("ordo.since", todayKey());
  const SINCE = LS.get("ordo.since", todayKey());

  function loadStarts() {
    const stored = LS.get("ordo.starts", {}), out = Object.assign({}, stored);
    D.VOWS.forEach((v) => { if (!stored[v.id]) out[v.id] = v.start; });
    LS.set("ordo.starts", out);
    return out;
  }
  let STARTS = loadStarts();
  const setStart = (id, s) => { STARTS[id] = s; LS.set("ordo.starts", STARTS); };

  /* літопис подій: mark (вікно), breach (зрив), edit (зміна дати) */
  let LOG = LS.get("ordo.log", []);
  if (!Array.isArray(LOG)) LOG = [];
  const saveLog = () => { if (LOG.length > 3000) LOG = LOG.slice(-3000); LS.set("ordo.log", LOG); };
  const logPush = (e) => { e.ts = Date.now(); LOG.push(e); saveLog(); };

  let BEST = LS.get("ordo.best", {});
  const vowById = (id) => D.VOWS.find((v) => v.id === id);

  /* стрік: дні від старту мінус заморожені вікнами дні (до сьогодні) */
  function streak(v) {
    const s = STARTS[v.id], base = streakOf(s);
    if (!v.window) return base;
    const t = todayKey();
    const frozen = new Set(LOG.filter((e) => e.k === "mark" && e.v === v.id && e.d >= s && e.d < t).map((e) => e.d)).size;
    return Math.max(0, base - frozen);
  }
  function bestOf(v) {
    const cur = streak(v);
    if (!(BEST[v.id] >= cur)) { BEST[v.id] = cur; LS.set("ordo.best", BEST); }
    return BEST[v.id];
  }
  const monthEvents = (v, mk, k) => LOG.filter((e) => e.v === v.id && e.k === k && e.d.slice(0, 7) === mk);
  const windowsUsed = (v, mk) => monthEvents(v, mk || monthKey(), "mark").length;
  const oversIn = (v, mk) => monthEvents(v, mk || monthKey(), "breach").filter((e) => e.why !== "manual").length;
  const todayMark = (v) => LOG.find((e) => e.k === "mark" && e.v === v.id && e.d === todayKey());

  function breach(v, why, n) {
    const prev = streak(v), t = todayKey();
    if (prev > (BEST[v.id] || 0)) { BEST[v.id] = prev; LS.set("ordo.best", BEST); }
    /* сьогоднішня відмітка вікна більше не заморожує — день став днем зриву */
    LOG = LOG.filter((e) => !(e.k === "mark" && e.v === v.id && e.d === t));
    logPush({ k: "breach", v: v.id, d: t, why, n, prev });
    setStart(v.id, t);
  }

  /* ---- віхи ---- */
  const nextMilestone = (s) => D.MILESTONES.find((m) => m > s) || null;

  /* ---- цитати без повторів ---- */
  function nextQuote() {
    let q = LS.get("ordo.qQueue", []);
    const last = LS.get("ordo.qLast", -1);
    if (!Array.isArray(q) || q.length === 0 || q.some((i) => !(i >= 0 && i < D.QUOTES.length))) {
      q = [...Array(D.QUOTES.length).keys()];
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (q.length > 1 && q[0] === last) [q[0], q[1]] = [q[1], q[0]];
    }
    const idx = q.shift();
    LS.set("ordo.qQueue", q); LS.set("ordo.qLast", idx);
    return D.QUOTES[idx];
  }
  function hashDay(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  /* ---- рідкісні знаки дня ---- */
  function daySigns() {
    const signs = [], marks = [100, 50, 30, 10, 3, 1];
    D.VOWS.forEach((v) => {
      const s = streak(v), nm = nextMilestone(s);
      if (nm && nm >= 180 && marks.includes(nm - s)) {
        signs.push({ kicker: "Віха близько", num: nm - s, unit: daysWord(nm - s), vow: v.name,
          text: nm === 365 ? "Рік уже видно з цієї вежі. Тримай стрій." : `До віхи ${nm}. Тримай стрій.` });
      }
    });
    const total = D.VOWS.reduce((a, v) => a + streak(v), 0);
    if (total >= 50 && total % 50 < D.VOWS.length) {
      signs.push({ kicker: "Скарбниця Ордену", num: total, unit: daysWord(total) + " честі", vow: "усі обітниці разом", text: "Багато каменів — одна стіна." });
    }
    return signs;
  }

  /* ================================================================ ТАБЛО === */
  function winPill(v) {
    const L = v.window.limit, used = Math.min(L, windowsUsed(v)), over = oversIn(v);
    return '<span class="wd wd--on"></span>'.repeat(L - used) + '<span class="wd"></span>'.repeat(used) + '<span class="wd wd--over"></span>'.repeat(over);
  }
  function renderBoard() {
    const ct = $("crestTitle"); if (ct) ct.textContent = D.APP_CONFIG.title;
    const cs = $("crestSub"); if (cs) cs.textContent = D.APP_CONFIG.subtitle;
    const fd = $("footDate"); if (fd) fd.textContent = fmtShort(new Date());
    const ul = $("oaths"); if (!ul) return;
    ul.innerHTML = "";
    D.VOWS.forEach((v) => {
      const s = streak(v), nm = nextMilestone(s);
      const prog = nm ? Math.min(100, (s / nm) * 100) : 100;
      const frozen = !!(v.window && todayMark(v));
      let sub;
      if (v.window) {
        const tail = frozen ? `<span class="oath__frost">сьогодні заморожено</span>` : nm ? `ціль ${nm}` : "усі віхи";
        sub = `<span class="win" data-mark="${v.id}" role="button" aria-label="Відмітити вікно">${winPill(v)}</span><span class="oath__tail">${tail}</span>`;
      } else {
        sub = nm ? `ціль ${nm} · лишилось ${nm - s} ${daysWord(nm - s)}` : "усі віхи взято";
      }
      const li = document.createElement("li");
      const btn = document.createElement("div");
      btn.className = "oath" + (frozen ? " oath--frozen" : ""); btn.setAttribute("role", "button"); btn.tabIndex = 0; btn.dataset.id = v.id;
      btn.innerHTML =
        `<span class="oath__icon"><svg><use href="#i-${v.icon}"></use></svg></span>` +
        `<span class="oath__body"><span class="oath__name">${v.name}</span><span class="oath__sub">${sub}</span></span>` +
        `<span class="oath__count"><span class="oath__num" data-n="${s}">${s}</span><span class="oath__unit">${daysWord(s)}</span></span>` +
        `<span class="oath__ring" style="width:${prog}%"></span>`;
      btn.addEventListener("click", (e) => {
        const pill = e.target.closest && e.target.closest("[data-mark]");
        if (pill) { e.stopPropagation(); openMark(v.id); return; }
        openSheet(v.id);
      });
      btn.addEventListener("keydown", (e) => { if (e.key === "Enter") openSheet(v.id); });
      li.appendChild(btn); ul.appendChild(li);
    });
  }
  function flashRow(id, cls) {
    const row = document.querySelector(`.oath[data-id="${id}"]`);
    if (row) { row.classList.remove(cls); void row.offsetWidth; row.classList.add(cls); }
  }
  function countUp() {
    if (reduce) return;
    const els = document.querySelectorAll(".oath__num"), t0 = performance.now(), dur = 1400;
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    els.forEach((el) => { el.textContent = "0"; });
    (function frame(now) {
      const k = Math.min(1, (now - t0) / dur);
      els.forEach((el) => { el.textContent = Math.round(ease(k) * (+el.dataset.n || 0)); });
      if (k < 1) requestAnimationFrame(frame);
    })(t0);
  }

  /* ---- кодекс: плавне розгортання ---- */
  const setFold = (id, open) => { const f = $(id); if (f) f.classList.toggle("open", open); };
  const isOpen = (id) => { const f = $(id); return !!(f && f.classList.contains("open")); };

  /* ================================================================ ШТОРКА == */
  let sheetVow = null;
  function fillSheet() {
    const v = vowById(sheetVow); if (!v) return;
    const s = streak(v), nm = nextMilestone(s);
    const T = $("shTitle"); if (T) T.textContent = v.name;
    const St = $("shStat"); if (St) St.textContent = `${s} ${daysWord(s)} стійко` + (v.window && todayMark(v) ? " · сьогодні заморожено" : "");
    const Ic = $("shIcon"); if (Ic) Ic.innerHTML = `<use href="#i-${v.icon}"></use>`;
    const Nx = $("shNext"); if (Nx) Nx.textContent = nm ? `${nm} (через ${nm - s} ${daysWord(nm - s)})` : "усі взято";
    const B = $("shBest"); if (B) B.textContent = `${bestOf(v)} ${daysWord(bestOf(v))}`;
    const wr = $("shWinRow"), w = $("shWin"), mb = $("shMark");
    if (wr) wr.hidden = !v.window;
    if (mb) mb.hidden = !v.window;
    if (v.window && w) { const u = windowsUsed(v), o = oversIn(v); w.textContent = `${u} з ${v.window.limit}` + (o ? ` · зривів ${o}` : ""); }
    const di = $("shDate"); if (di) { di.value = STARTS[v.id]; di.max = todayKey(); }
  }
  function openSheet(id) {
    sheetVow = id; fillSheet();
    const has = !!(D.CODEX && D.CODEX[id]);
    const cx = $("shCodex"); if (cx) { cx.textContent = has ? D.CODEX[id] : ""; cx.scrollTop = 0; }
    setFold("shFold", false);
    const ch = $("shCodexChev"); if (ch) ch.textContent = "розгорнути";
    const cb = $("shCodexBtn"); if (cb) cb.hidden = !has;
    FX.play("open", true); FX.buzz("light");
    $("scrim") && $("scrim").classList.add("open");
    $("sheet") && $("sheet").classList.add("open");
  }
  const closeSheet = () => { $("scrim") && $("scrim").classList.remove("open"); $("sheet") && $("sheet").classList.remove("open"); };
  on("shClose", "click", closeSheet);
  on("scrim", "click", () => { closeSheet(); closeMark(); });
  on("shDate", "change", (e) => {
    if (!e.target.value) return;
    const v = vowById(sheetVow);
    logPush({ k: "edit", v: v.id, d: todayKey(), from: STARTS[v.id], to: e.target.value });
    setStart(v.id, e.target.value); fillSheet(); renderBoard();
  });
  on("shCodexBtn", "click", () => {
    const open = !isOpen("shFold"); setFold("shFold", open);
    const ch = $("shCodexChev"); if (ch) ch.textContent = open ? "згорнути" : "розгорнути";
    FX.play("fold", true); FX.buzz("light");
  });
  on("shMark", "click", () => { const id = sheetVow; closeSheet(); setTimeout(() => openMark(id), 320); });

  /* ---- ручний зрив ---- */
  const closeConfirm = () => { $("confirm") && $("confirm").classList.remove("open"); };
  on("shReset", "click", () => { const n = $("cfName"); if (n) n.textContent = vowById(sheetVow).name; FX.buzz("medium"); $("confirm") && $("confirm").classList.add("open"); });
  on("cfNo", "click", closeConfirm);
  on("cfYes", "click", () => {
    const v = vowById(sheetVow);
    breach(v, "manual");
    closeConfirm(); closeSheet(); renderBoard();
    FX.play("reset", true); FX.buzz("heavy"); flashRow(v.id, "oath--fall");
  });

  /* ======================================================= ВІДМІТКА ВІКНА === */
  let markVow = null, markN = 1;
  function markPlan(v, n) {
    const W = v.window, used = windowsUsed(v), ex = todayMark(v);
    if (W.perDay && n > W.perDay) return "breach-count";
    if (ex && W.perDay) return "update";
    return used >= W.limit ? "breach-limit" : "mark";
  }
  function renderMark() {
    const v = vowById(markVow); if (!v) return;
    const W = v.window, used = windowsUsed(v), ex = todayMark(v), plan = markPlan(v, markN);
    const t = $("mkText"), yes = $("mkYes");
    let txt;
    if (plan === "breach-count") txt = `Понад ${W.perDay} за день — це зрив. Стрік почнеться з нуля.`;
    else if (plan === "update") txt = `Сьогодні вже відмічено: <b>${ex.n}</b>. Онови кількість за день — вікно не витрачається вдруге.`;
    else if (plan === "breach-limit") txt = `Вікна ${MONTHS_LOC[new Date().getMonth()]} вичерпано (${W.limit} з ${W.limit}). Ця відмітка — зрив, стрік з нуля.`;
    else txt = `Використати вікно? Лишиться <b>${W.limit - used - 1} з ${W.limit}</b>. День заморожується — стрік не згорає.`;
    if (t) t.innerHTML = txt;
    const bad = plan.startsWith("breach");
    if (yes) { yes.textContent = bad ? "Відмітити — зрив" : plan === "update" ? "Оновити" : "Відмітити"; yes.className = bad ? "btn btn--reset" : "btn btn--gold"; }
    const row = $("mkCountRow");
    if (row) row.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", +b.dataset.n === markN));
  }
  function openMark(id) {
    const v = vowById(id); if (!v || !v.window) return;
    markVow = id;
    const ex = todayMark(v);
    markN = ex && ex.n ? ex.n : 1;
    const ic = $("mkIcon"); if (ic) ic.innerHTML = `<use href="#i-${v.icon}"></use>`;
    const tt = $("mkTitle"); if (tt) tt.textContent = v.name;
    const cc = $("mkCount"), row = $("mkCountRow");
    if (cc) cc.hidden = !v.window.perDay;
    if (row && v.window.perDay) {
      let h = "";
      for (let i = 1; i <= v.window.perDay; i++) h += `<button type="button" data-n="${i}">${i}</button>`;
      h += `<button type="button" class="mk-over" data-n="${v.window.perDay + 1}">${v.window.perDay + 1}+</button>`;
      row.innerHTML = h;
    }
    renderMark();
    FX.play("open", true); FX.buzz("light");
    $("scrim") && $("scrim").classList.add("open");
    $("markModal") && $("markModal").classList.add("open");
  }
  const closeMark = () => { $("markModal") && $("markModal").classList.remove("open"); if (!($("sheet") && $("sheet").classList.contains("open"))) $("scrim") && $("scrim").classList.remove("open"); };
  on("mkCountRow", "click", (e) => { const b = e.target.closest("button"); if (!b) return; markN = +b.dataset.n; FX.buzz("light"); renderMark(); });
  on("mkNo", "click", closeMark);
  on("markModal", "click", (e) => { if (e.target && e.target.id === "markModal") closeMark(); });
  on("mkYes", "click", () => {
    const v = vowById(markVow); if (!v) return;
    const plan = markPlan(v, markN), t = todayKey();
    if (plan === "update") { const ex = todayMark(v); ex.n = markN; ex.ts = Date.now(); saveLog(); }
    else if (plan === "mark") logPush({ k: "mark", v: v.id, d: t, n: v.window.perDay ? markN : undefined, w: windowsUsed(v) + 1 });
    else breach(v, plan === "breach-count" ? "count" : "limit", v.window.perDay ? markN : undefined);
    closeMark(); renderBoard();
    const bad = plan.startsWith("breach");
    FX.play(bad ? "over" : "mark", true); FX.buzz(bad ? "heavy" : "medium");
    flashRow(v.id, bad ? "oath--fall" : "oath--frost");
    if (!reduce) {
      const row = document.querySelector(`.oath[data-id="${v.id}"] .win`);
      if (row) { const kids = row.children, el = bad ? kids[kids.length - 1] : kids[v.window.limit - windowsUsed(v)]; if (el) el.classList.add(bad ? "wd--new" : "wd--spent"); }
    }
  });

  /* ---- протокол ---- */
  const closeProto = () => { $("protoModal") && $("protoModal").classList.remove("open"); };
  on("protoBtn", "click", () => {
    const t = $("protoText"); if (t) { t.textContent = (D.CODEX && D.CODEX.protocol) || ""; t.scrollTop = 0; }
    FX.play("fold", true); FX.buzz("light");
    $("protoModal") && $("protoModal").classList.add("open");
  });
  on("protoClose", "click", closeProto);
  on("protoModal", "click", (e) => { if (e.target && e.target.id === "protoModal") closeProto(); });

  /* ---- звук і вібро ---- */
  function renderSound() {
    const ic = $("sndIc"); if (ic) ic.innerHTML = `<use href="#i-${FX.enabled ? "bell" : "bell-off"}"></use>`;
    const b = $("sndBtn"); if (b) { b.classList.toggle("icobtn--off", !FX.enabled); b.setAttribute("aria-pressed", String(FX.enabled)); }
  }
  on("sndBtn", "click", () => { FX.set(!FX.enabled); renderSound(); if (FX.enabled) { FX.play("toggle", true); FX.buzz("light"); } });

  /* ================================================================ ВКЛАДКИ = */
  let TAB = "board";
  function showTab(name) {
    if (name === TAB) return;
    TAB = name;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-on", t.dataset.tab === name));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-on", v.dataset.view === name));
    if (name === "stats") renderStats();
    if (name === "goals") renderGoals();
    window.scrollTo(0, 0);
    FX.play("tab", true); FX.buzz("light");
  }
  on("tabs", "click", (e) => { const t = e.target.closest(".tab"); if (t) showTab(t.dataset.tab); });

  /* ================================================================ ЛІТОПИС = */
  let statsOffset = 0;   // 0 — поточний місяць, -1 — попередній…
  function statsMonth() { const d = new Date(); return monthKey(new Date(d.getFullYear(), d.getMonth() + statsOffset, 1)); }
  function dayState(v, dk) {
    const t = todayKey();
    if (dk > t) return "f";
    if (dk < SINCE) return "x";
    if (LOG.some((e) => e.k === "breach" && e.v === v.id && e.d === dk)) return "b";
    if (LOG.some((e) => e.k === "mark" && e.v === v.id && e.d === dk)) return "w";
    return "c";
  }
  function renderStats() {
    const box = $("statsBody"); if (!box) return;
    const mk = statsMonth(), N = daysIn(mk), isCur = statsOffset === 0;
    const sub = $("stSub"); if (sub) sub.textContent = `відтепер усе записується · з ${fmtKey(SINCE)}`;
    const honor = D.VOWS.reduce((a, v) => a + streak(v), 0);
    const wins = D.VOWS.filter((v) => v.window).reduce((a, v) => a + windowsUsed(v, mk), 0);
    const brs = LOG.filter((e) => e.k === "breach" && e.d.slice(0, 7) === mk).length;
    let h = `<div class="st-sum">
      <div><b>${honor}</b><span>днів честі зараз</span></div>
      <div><b>${wins}</b><span>вікон у ${MONTHS_LOC[+mk.slice(5) - 1]}</span></div>
      <div class="${brs ? "is-bad" : ""}"><b>${brs}</b><span>${pluralUk(brs, ["зрив", "зриви", "зривів"])} у ${MONTHS_LOC[+mk.slice(5) - 1]}</span></div>
    </div>
    <div class="st-month">
      <button class="st-nav" id="stPrev" type="button" aria-label="Попередній місяць">‹</button>
      <div class="st-month__name">${monthName(mk)} ${mk.slice(0, 4)}</div>
      <button class="st-nav" id="stNext" type="button" aria-label="Наступний місяць" ${isCur ? "disabled" : ""}>›</button>
    </div>`;
    D.VOWS.forEach((v) => {
      const s = streak(v), b = bestOf(v);
      const allBr = LOG.filter((e) => e.k === "breach" && e.v === v.id).length;
      let cells = "";
      for (let i = 1; i <= N; i++) cells += `<i class="c-${dayState(v, `${mk}-${pad(i)}`)}${isCur && i === new Date().getDate() ? " c-now" : ""}"></i>`;
      const winTxt = v.window ? `вікна ${windowsUsed(v, mk)}/${v.window.limit} · ` : "";
      h += `<div class="st-vow">
        <div class="st-vow__head"><svg><use href="#i-${v.icon}"/></svg><span class="st-vow__name">${v.name}</span>
          <span class="st-vow__nums"><b>${s}</b> <em>рекорд ${b}</em></span></div>
        <div class="st-cal" style="grid-template-columns:repeat(${N},1fr)">${cells}</div>
        <div class="st-vow__meta">${winTxt}зривів усього ${allBr}</div>
      </div>`;
    });
    h += `<div class="st-legend"><span><i class="c-c"></i>чистий</span><span><i class="c-w"></i>вікно</span><span><i class="c-b"></i>зрив</span><span><i class="c-x"></i>без запису</span></div>`;
    const ev = LOG.slice().reverse().slice(0, 30);
    h += `<div class="st-h">Записи</div>`;
    if (!ev.length) h += `<p class="st-empty">Поки що чисто. Кожна відмітка й зрив зʼявляться тут.</p>`;
    else {
      h += `<ul class="st-log">` + ev.map((e) => {
        const v = vowById(e.v); const nm = v ? v.name : e.v;
        let what = "", cls = "";
        if (e.k === "mark") { what = `вікно ${e.w || ""}${e.n ? ` · ${e.n}` : ""}`; cls = "w"; }
        else if (e.k === "breach") { what = { manual: "зрив", limit: "зрив: понад ліміт", count: `зрив: ${e.n || ""} за день` }[e.why] + (e.prev ? ` · було ${e.prev}` : ""); cls = "b"; }
        else if (e.k === "edit") { what = `старт → ${fmtKey(e.to)}`; cls = "e"; }
        return `<li class="ev-${cls}"><span class="lg-d">${fmtKey(e.d)}</span><span class="lg-v">${esc(nm)}</span><span class="lg-w">${what}</span></li>`;
      }).join("") + `</ul>`;
    }
    box.innerHTML = h;
    on("stPrev", "click", () => { statsOffset--; renderStats(); FX.buzz("light"); });
    on("stNext", "click", () => { if (statsOffset < 0) { statsOffset++; renderStats(); FX.buzz("light"); } });
  }

  /* ================================================================== ЦІЛІ == */
  let G = LS.get("ordo.goals", null);
  if (!G || typeof G !== "object") G = { y: {}, m: {} };
  G.y = G.y || {}; G.m = G.m || {};
  const saveG = () => LS.set("ordo.goals", G);
  const per = (kind, key) => { const box = G[kind]; if (!box[key]) box[key] = { items: [], res: null, skip: false }; return box[key]; };
  const peek = (kind, key) => G[kind][key] || null;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pctOf = (P) => { const n = P.items.length; if (!n || !P.res) return 0; return Math.round(100 * P.items.filter((i) => P.res[i.id]).length / n); };
  const tierFor = (list, pct) => list.find((x) => pct >= x.min) || list[list.length - 1];
  const periodLabel = (kind, key) => kind === "y" ? `${key} рік` : `${monthName(key)} ${key.slice(0, 4)}`;

  function pendingTasks() {
    const now = new Date(), Y = String(now.getFullYear()), M = monthKey(now), tasks = [];
    Object.keys(G.m).sort().forEach((k) => {
      const P = G.m[k];
      if (P.items.length && !P.res && (k < M || (k === M && isLastDayOfMonth()))) tasks.push({ t: "review", kind: "m", key: k });
    });
    Object.keys(G.y).sort().forEach((k) => {
      const P = G.y[k];
      if (P.items.length && !P.res && (k < Y || (k === Y && now.getMonth() === 11 && now.getDate() === 31))) tasks.push({ t: "review", kind: "y", key: k });
    });
    const py = peek("y", Y);
    if ((!py || (!py.items.length && !py.skip)) && now.getMonth() < 11) tasks.push({ t: "entry", kind: "y", key: Y });
    const pm = peek("m", M);
    if ((!pm || (!pm.items.length && !pm.skip)) && now.getDate() <= 20) tasks.push({ t: "entry", kind: "m", key: M });
    return tasks;
  }
  function updateGoalsDot() { const d = $("goalsDot"); if (d) d.hidden = !pendingTasks().some((t) => t.t === "review"); }

  function renderGoals() {
    const box = $("goalsBody"); if (!box) return;
    const now = new Date(), Y = String(now.getFullYear()), M = monthKey(now);
    const sub = $("glSub"); if (sub) sub.textContent = "ставляться 1-го, відмічаються останнього числа";
    const pend = pendingTasks();
    const section = (kind, key) => {
      const P = peek(kind, key), reviewed = !!(P && P.res), items = P ? P.items : [];
      const due = pend.find((t) => t.t === "review" && t.kind === kind && t.key === key);
      const pct = reviewed ? pctOf(P) : 0;
      const award = reviewed ? tierFor(kind === "y" ? D.TITLES : D.MEDALS, pct) : null;
      const when = kind === "y" ? "ревю 31 грудня" : `ревю ${daysIn(key)} ${MONTHS[+key.slice(5) - 1]}`;
      let h = `<section class="gl-sec">
        <div class="gl-sec__head"><span class="gl-sec__kind">${kind === "y" ? "Цілі року" : "Цілі місяця"}</span><span class="gl-sec__name">${periodLabel(kind, key)}</span>
        <span class="gl-sec__meta">${reviewed ? `${pct}%` : items.length ? when : ""}</span></div>`;
      if (award) h += `<div class="gl-award tier-${award.tier}"><svg><use href="#medal"/></svg><div><b>${award.name}</b><span>${award.text}</span></div></div>`;
      if (items.length) {
        h += `<ul class="gl-list">` + items.map((it) => {
          const st = reviewed ? (P.res[it.id] ? "yes" : "no") : "open";
          return `<li class="gl-it gl-it--${st}"><span class="gl-mark"></span><span class="gl-t">${esc(it.t)}</span>` +
            (reviewed ? "" : `<button class="gl-del" type="button" data-del="${kind}|${key}|${it.id}" aria-label="Прибрати ціль"><svg><use href="#i-x"/></svg></button>`) + `</li>`;
        }).join("") + `</ul>`;
      } else if (!reviewed) {
        h += `<p class="gl-empty">${kind === "y" ? "Цілі року ще не задано." : "Цілі місяця ще не задано."}</p>`;
      }
      if (!reviewed) {
        h += `<div class="gl-add"><input type="text" maxlength="140" placeholder="Нова ціль" data-add="${kind}|${key}" enterkeyhint="done"><button class="gl-add__btn" type="button" data-addbtn="${kind}|${key}" aria-label="Додати"><svg><use href="#i-plus"/></svg></button></div>`;
        if (due) h += `<button class="btn btn--gold gl-review" type="button" data-review="${kind}|${key}">Провести ревю</button>`;
      }
      return h + `</section>`;
    };
    let h = section("y", Y) + section("m", M);
    /* минулі непроревʼюні місяці */
    pend.filter((t) => t.t === "review" && !(t.kind === "m" && t.key === M) && !(t.kind === "y" && t.key === Y)).forEach((t) => { h += section(t.kind, t.key); });

    /* зал нагород */
    const earned = Object.keys(G.m).sort().filter((k) => G.m[k].res && G.m[k].items.length);
    const titles = Object.keys(G.y).sort().filter((k) => G.y[k].res && G.y[k].items.length);
    h += `<section class="gl-sec"><div class="gl-sec__head"><span class="gl-sec__kind">Зал нагород</span></div>`;
    if (!earned.length && !titles.length) h += `<p class="gl-empty">Перша нагорода зʼявиться після першого ревю.</p>`;
    else {
      h += `<div class="gl-hall">` + earned.map((k) => { const p = pctOf(G.m[k]); const a = tierFor(D.MEDALS, p);
        return `<div class="gl-hall__it tier-${a.tier}"><svg><use href="#medal"/></svg><b>${monthName(k)}</b><span>${p}%</span></div>`; }).join("") +
        titles.map((k) => { const p = pctOf(G.y[k]); const a = tierFor(D.TITLES, p);
        return `<div class="gl-hall__it gl-hall__it--year tier-${a.tier}"><svg><use href="#medal"/></svg><b>${k}</b><span>${a.name}</span></div>`; }).join("") + `</div>`;
    }
    h += `</section>`;

    /* довідка */
    const tbl = (list) => list.map((x) => `<li class="tier-${x.tier}"><svg><use href="#medal"/></svg><span class="gl-ref__n">${x.name}</span><span class="gl-ref__p">${x.min === 100 ? "100%" : `від ${x.min}%`}</span></li>`).join("");
    h += `<section class="gl-sec"><div class="gl-sec__head"><span class="gl-sec__kind">Медалі місяця</span></div><ul class="gl-ref">${tbl(D.MEDALS)}</ul>
      <div class="gl-sec__head gl-sec__head--sub"><span class="gl-sec__kind">Звання року</span></div><ul class="gl-ref">${tbl(D.TITLES)}</ul>
      <p class="gl-note">Нагороду визначає відсоток виконаних цілей. Цілі можна правити до ревю; після ревю вони запечатуються.</p></section>`;
    box.innerHTML = h;
  }
  function addGoalFrom(kindKey, input) {
    const t = (input.value || "").trim(); if (!t) return;
    const [kind, key] = kindKey.split("|");
    per(kind, key).items.push({ id: uid(), t }); saveG();
    FX.play("add", true); FX.buzz("light");
    renderGoals(); updateGoalsDot();
    const again = document.querySelector(`[data-add="${kindKey}"]`); if (again) again.focus();
  }
  on("goalsBody", "click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) { const [kind, key, id] = del.dataset.del.split("|"); const P = peek(kind, key); if (P) { P.items = P.items.filter((i) => i.id !== id); saveG(); FX.buzz("light"); renderGoals(); updateGoalsDot(); } return; }
    const ab = e.target.closest("[data-addbtn]");
    if (ab) { const inp = document.querySelector(`[data-add="${ab.dataset.addbtn}"]`); if (inp) addGoalFrom(ab.dataset.addbtn, inp); return; }
    const rv = e.target.closest("[data-review]");
    if (rv) { const [kind, key] = rv.dataset.review.split("|"); runQueue([{ t: "review", kind, key }]); }
  });
  on("goalsBody", "keydown", (e) => { const inp = e.target.closest && e.target.closest("[data-add]"); if (inp && e.key === "Enter") { e.preventDefault(); addGoalFrom(inp.dataset.add, inp); } });

  /* ------------------------------------------- обряд: введення / ревю ------ */
  const RITE = ["riteEntry", "riteReview", "riteResult"];
  async function riteShow(id) {
    const r = $("rite"); if (!r) return;
    const cur = RITE.map($).find((el) => el && el.classList.contains("show"));
    if (cur && cur.id !== id) { cur.classList.remove("show"); await wait(900); }
    RITE.forEach((s) => { const el = $(s); if (el && s !== id) el.classList.remove("show"); });
    const el = $(id); if (el) { void el.offsetWidth; el.classList.add("show"); }
  }
  function entryTask(kind, key) {
    return new Promise((resolve) => {
      const P = per(kind, key);
      const ti = $("enTitle"); if (ti) ti.textContent = kind === "y" ? `Цілі на ${key} рік` : `Цілі на ${monthName(key)}`;
      const le = $("enLead"); if (le) le.textContent = kind === "y"
        ? (key === "2026" ? "До кінця 2026. По одній: коротко і вимірно. 31 грудня ти чесно відмітиш кожну, і рік отримає звання."
                          : "На весь рік. По одній: коротко і вимірно. 31 грудня ти чесно відмітиш кожну, і рік отримає звання.")
        : `Весь ${monthName(key)}. По одній: коротко і вимірно. Останнього числа — ревю й медаль.`;
      const list = $("enList"), inp = $("enInput"), done = $("enDone");
      const draw = (anim) => {
        if (list) list.innerHTML = P.items.map((it, i) => `<li class="${anim && i === P.items.length - 1 ? "is-new" : ""}">${esc(it.t)}</li>`).join("");
        if (done) done.hidden = !P.items.length;
      };
      draw(false);
      if (inp) inp.value = "";
      const add = () => {
        const t = (inp.value || "").trim(); if (!t) { inp.focus(); return; }
        P.items.push({ id: uid(), t }); saveG(); inp.value = ""; draw(true);
        FX.play("add", true); FX.buzz("medium"); inp.focus();
      };
      const finish = (skip) => {
        if (skip && !P.items.length) P.skip = true;
        saveG(); cleanup(); resolve();
      };
      const onAdd = () => add();
      const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
      const onDone = () => { FX.play("yes", true); FX.buzz("medium"); finish(false); };
      const onLater = () => { FX.buzz("light"); finish(true); };
      const cleanup = () => { $("enAdd").removeEventListener("click", onAdd); inp.removeEventListener("keydown", onKey); done.removeEventListener("click", onDone); $("enLater").removeEventListener("click", onLater); if (inp) inp.blur(); };
      $("enAdd").addEventListener("click", onAdd); inp.addEventListener("keydown", onKey);
      done.addEventListener("click", onDone); $("enLater").addEventListener("click", onLater);
      riteShow("riteEntry");
    });
  }
  function reviewTask(kind, key) {
    return new Promise(async (resolve) => {
      const P = per(kind, key), res = {};
      const k = $("rvKicker"); if (k) k.textContent = kind === "y" ? `Ревю року · ${key}` : `Ревю · ${monthName(key)}`;
      const card = $("rvCard"), txt = $("rvText"), stamp = $("rvStamp"), cnt = $("rvCount"), yes = $("rvYes"), no = $("rvNo");
      await riteShow("riteReview");
      for (let i = 0; i < P.items.length; i++) {
        const it = P.items[i];
        if (cnt) cnt.textContent = `${i + 1} з ${P.items.length}`;
        if (txt) txt.textContent = it.t;
        if (stamp) { stamp.className = "rv__stamp"; stamp.textContent = ""; }
        if (card) { card.classList.remove("out"); void card.offsetWidth; card.classList.add("in"); }
        [yes, no].forEach((b) => { if (b) b.disabled = false; });
        const ok = await new Promise((r) => {
          const y = () => { cl(); r(true); }, n = () => { cl(); r(false); };
          const cl = () => { yes.removeEventListener("click", y); no.removeEventListener("click", n); };
          yes.addEventListener("click", y); no.addEventListener("click", n);
        });
        [yes, no].forEach((b) => { if (b) b.disabled = true; });
        res[it.id] = ok;
        if (stamp) { stamp.textContent = ok ? "Виконано" : "Ні"; stamp.className = "rv__stamp " + (ok ? "is-yes" : "is-no"); }
        FX.play(ok ? "yes" : "no", true); FX.buzz(ok ? "medium" : "light");
        await wait(1600);
        if (card) { card.classList.remove("in"); card.classList.add("out"); }
        await wait(800);
      }
      P.res = res; P.at = todayKey(); saveG();
      await resultScene(kind, key);
      resolve();
    });
  }
  function resultScene(kind, key) {
    return new Promise(async (resolve) => {
      const P = peek(kind, key), pct = pctOf(P), aw = tierFor(kind === "y" ? D.TITLES : D.MEDALS, pct);
      const k = $("rsKicker"); if (k) k.textContent = kind === "y" ? `${key} рік · звання` : `${monthName(key)} · підсумок`;
      const fill = $("rsFill"), num = $("rsPct"), med = $("rsMedal"), nm = $("rsName"), tx = $("rsText"), okb = $("rsOk");
      const R = $("riteResult");
      if (R) R.classList.remove("s2", "s3", "s4");
      if (fill) { fill.style.transition = "none"; fill.style.strokeDashoffset = "1"; }
      if (num) num.textContent = "0%";
      if (med) med.className = `rs__medal tier-${aw.tier}`;
      if (nm) nm.textContent = aw.name;
      if (tx) tx.textContent = aw.text;
      if (okb) okb.disabled = true;
      await riteShow("riteResult");
      await wait(900);
      /* кільце наповнюється і число набігає */
      if (fill) { void fill.getBoundingClientRect(); fill.style.transition = "stroke-dashoffset 2.8s cubic-bezier(.22,.61,.36,1)"; fill.style.strokeDashoffset = String(1 - pct / 100); }
      const t0 = performance.now(), dur = reduce ? 10 : 2800;
      await new Promise((r) => { (function f(now) { const x = Math.min(1, (now - t0) / dur); if (num) num.textContent = Math.round((1 - Math.pow(1 - x, 3)) * pct) + "%"; if (x < 1) requestAnimationFrame(f); else r(); })(t0); });
      await wait(500);
      if (R) R.classList.add("s2");            /* медаль */
      FX.play(pct >= 50 ? "medal" : "sign", true); FX.buzz("heavy");
      if (pct >= 50) sparks("rsSparks", 22);
      await wait(1600);
      if (R) R.classList.add("s3");            /* назва і текст */
      await wait(1800);
      if (R) R.classList.add("s4");            /* кнопка */
      if (okb) okb.disabled = false;
      const done = () => { okb.removeEventListener("click", done); FX.buzz("light"); resolve(); };
      okb.addEventListener("click", done);
    });
  }
  let queueBusy = false;
  async function runQueue(tasks) {
    if (queueBusy || !tasks.length) return;
    queueBusy = true;
    const r = $("rite"); if (r) { r.removeAttribute("hidden"); void r.offsetWidth; r.classList.add("open"); }
    for (const t of tasks) {
      if (t.t === "entry") await entryTask(t.kind, t.key);
      else await reviewTask(t.kind, t.key);
    }
    RITE.forEach((s) => { const el = $(s); if (el) el.classList.remove("show"); });
    if (r) { r.classList.remove("open"); await wait(900); r.setAttribute("hidden", ""); }
    queueBusy = false;
    renderBoard(); updateGoalsDot();
    if (TAB === "goals") renderGoals();
  }

  /* ---- іскри ---- */
  function sparks(id, n) {
    const box = $(id); if (!box || reduce) return;
    box.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i"); s.className = "spark";
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 70 + Math.random() * 70;
      s.style.setProperty("--x", `${Math.cos(a) * r}px`); s.style.setProperty("--y", `${Math.sin(a) * r}px`);
      s.style.animationDelay = `${Math.random() * 0.35}s`;
      box.appendChild(s);
    }
  }

  /* ---- запечатаний сувій: не розпечатувати до строку ---- */
  const SEALED = "eyJzZWFsIjogeyJ0ZXh0IjogItCh0YzQvtCz0L7QtNC90ZYg0L3QsNGB0YLQsNCyINGB0YLRgNC+0Log0YHRg9Cy0L7Rjiwg0YnQviDRh9C10LrQsNCyINGG0ZbQu9C40Lkg0YDRltC6LiIsICJoaW50IjogItGC0L7RgNC60L3QuNGB0YwsINGJ0L7QsSDQt9C70LDQvNCw0YLQuCDQv9C10YfQsNGC0LrRgyJ9LCAic29icmlldHkiOiB7ImtpY2tlciI6ICLQn9C10YDRiNC40Lkg0YDRltC6IiwgInVuaXQiOiAi0LTQvdGW0LIg0YLQstC10YDQtdC30L7RgdGC0ZYiLCAibGluZXMiOiBbItCg0ZbQuiDRgtC+0LzRgyDRgtC4INC/0L7RgdGC0LDQstC40LIg0LrQtdC70LjRhS4iLCAi0JLRltC00YLQvtC00ZYg0LzQuNC90YPQu9C+IDM2NSDRgNCw0L3QutGW0LIg4oCUINGWINC60L7QttC10L0g0YLQuCDQt9GD0YHRgtGA0ZbQsiDRltC3INGP0YHQvdC+0Y4g0LPQvtC70L7QstC+0Y4uIiwgItCR0YPQu9C4INGC0YDQuNCy0L7Qs9C4LCDQsdC10LfRgdC+0L3QvdGWINC90L7Rh9GWINC5INCy0LXRgNC10YHQtdC90YwsINGJ0L4g0L/QvtGF0LjRgtC90YPQsiDRg9GB0LUg0ZbQvdGI0LUuINCm0Y4g0LvRltC90ZbRjiDQvdC1INC30LvQsNC80LDQsiDQvdGW0YXRgtC+LiIsICLQptC1INCy0LbQtSDQvdC1INC+0LHRltGC0L3QuNGG0Y8uINCm0LUg0YLQuC4iLCAi0J7RgNC00LXQvSDQv9Cw0LzKvNGP0YLQsNGUINGG0LXQuSDQtNC10L3RjC4iXX0sICJnZW5lcmljIjogeyJraWNrZXIiOiAi0KDRltC6INC90LAg0LLQsNGA0YLRliIsICJ1bml0IjogItC00L3RltCyIiwgImxpbmVzIjogWyLQoNGW0Log0YLQvtC80YMg0YLQuCDQtNCw0LIg0YbQtSDRgdC70L7QstC+LiIsICIzNjUg0LTQvdGW0LIg0LLQvtC90L4g0YLRgNC40LzQsNC70L7RgdGMIOKAlCDRgyDRgtC40YXRliDQvdC+0YfRliDQuSDRgyDRgtGA0LjQstC+0LbQvdGWLiIsICLQntCx0ZbRgtC90LjRhtGPLCDRidC+INC/0YDQvtC20LjQu9CwINGA0ZbQuiwg0YHRgtCw0ZQg0YfQsNGB0YLQuNC90L7RjiDRgtC10LHQtS4iLCAi0J7RgNC00LXQvSDQv9Cw0LzKvNGP0YLQsNGUINGG0LXQuSDQtNC10L3RjC4iXX19";
  const unseal = () => { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(SEALED), (c) => c.charCodeAt(0)))); } catch (e) { return null; } };
  const yearVow = () => D.VOWS.find((v) => v.id === "sobriety" && streak(v) === 365) || D.VOWS.find((v) => streak(v) === 365) || null;

  /* ================================================================ РИТУАЛ == */
  let timers = [], introDone = false, sealWait = null, guardUntil = 0, afterRitual = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const STAGES = ["stDate", "stQuote", "stMs", "stSign", "stSeal", "stYear"];
  function reveal() {
    introDone = true; sealWait = null; clearTimers();
    const intro = $("intro"); if (intro) { intro.setAttribute("hidden", ""); intro.classList.remove("sealed"); }
    const b = $("board"); if (b) { b.classList.remove("reveal"); void b.offsetWidth; b.classList.add("reveal"); }
    document.body.classList.remove("in-rite");
    countUp();
    if (afterRitual) { afterRitual = false; const tasks = pendingTasks(); if (tasks.length) setTimeout(() => runQueue(tasks), reduce ? 50 : 1800); }
  }
  function runIntro() {
    introDone = false; sealWait = null; clearTimers(); afterRitual = true;
    const intro = $("intro"); if (!intro) { reveal(); return; }
    if (TAB !== "board") showTab("board");
    document.body.classList.add("in-rite");
    intro.removeAttribute("hidden");
    STAGES.forEach((id) => { const el = $(id); if (el) el.classList.remove("show", "gone", "cracked"); });
    intro.classList.remove("drawing", "drawn", "sealed");
    const yv = yearVow(), S = yv ? unseal() : null;
    if (yv && S) {
      const st = $("stSeal");
      const tx = $("sealText"); if (tx) tx.textContent = S.seal.text;
      const hi = $("sealHint"); if (hi) hi.textContent = S.seal.hint;
      intro.classList.add("sealed");
      timers.push(setTimeout(() => { if (st) st.classList.add("show"); }, 200));
      sealWait = () => {
        sealWait = null; guardUntil = performance.now() + 1800;
        FX.play("year", true); FX.buzz("heavy");
        if (st) st.classList.add("cracked");
        timers.push(setTimeout(() => { if (st) st.classList.add("gone"); intro.classList.remove("sealed"); }, 700));
        const part = S[yv.id] || S.generic;
        const k = $("yrKicker"); if (k) k.textContent = part.kicker;
        const n = $("yrNum"); if (n) n.textContent = "365";
        const u = $("yrUnit"); if (u) u.textContent = yv.id === "sobriety" ? part.unit : `${part.unit} · ${yv.name}`;
        const box = $("yrLines");
        if (box) box.innerHTML = part.lines.map((l, i) => `<p class="${i === part.lines.length - 1 ? "yr-sign" : ""}">${l}</p>`).join("");
        let t = 1000;
        timers.push(setTimeout(() => { const y = $("stYear"); if (y) y.classList.add("show"); sparks("yrSparks", 26); }, t));
        const lines = box ? box.children : [];
        for (let i = 0; i < lines.length; i++) { t += i === 0 ? 1800 : 2600; const el = lines[i]; timers.push(setTimeout(() => el.classList.add("on"), t)); }
        t += 4200;
        timers.push(setTimeout(() => { const y = $("stYear"); if (y) y.classList.add("gone"); }, t));
        playMain(t + 900, yv);
      };
      return;
    }
    playMain(0, null);
  }
  function playMain(t0, skipYear) {
    const intro = $("intro"); if (!intro) return;
    const d = new Date();
    const dw = $("dWeekday"); if (dw) dw.textContent = WEEK[d.getDay()];
    const dm = $("dMain"); if (dm) dm.textContent = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    const dy = $("dYear"); if (dy) dy.textContent = d.getFullYear();
    const dn = $("dNote");
    if (dn) {
      const P = peek("m", monthKey(d));
      const txt = d.getDate() === 1 ? `новий місяць — нові цілі` : isLastDayOfMonth() && P && P.items.length && !P.res ? "сьогодні ревю місяця" : "";
      dn.hidden = !txt; dn.textContent = txt;
    }
    const LQ = D.LEGENDARY_QUOTES || [], h = hashDay(todayKey());
    const legendary = LQ.length > 0 && (h % 100) < 8;
    const ql = $("qLegend"); if (ql) ql.hidden = !legendary;
    const sq0 = $("stQuote"); if (sq0) sq0.classList.toggle("legendary", legendary);
    const qt = $("qText"); if (qt) qt.textContent = legendary ? LQ[h % LQ.length] : nextQuote();

    const ms = [];
    D.VOWS.forEach((v) => {
      const s = streak(v);
      if (skipYear && v.id === skipYear.id) return;
      if (D.MILESTONES.includes(s)) ms.push({ name: v.name, num: s, msg: D.MILESTONE_MSGS[s] || "" });
    });
    const signs = daySigns();
    const P = reduce ? { date: 900, quote: 1000, milestone: 1000 } : D.APP_CONFIG.introPaceMs;
    let t = t0;
    timers.push(setTimeout(() => {
      const sd = $("stDate"); if (sd) sd.classList.add("show");
      FX.play("date");
      requestAnimationFrame(() => { intro.classList.add("drawing"); requestAnimationFrame(() => intro.classList.add("drawn")); });
    }, t + 200));
    t += P.date + 600;
    timers.push(setTimeout(() => { const sd = $("stDate"); if (sd) sd.classList.add("gone"); }, t - 500));
    timers.push(setTimeout(() => { const sq = $("stQuote"); if (sq) sq.classList.add("show"); FX.play("quote"); }, t + 400));
    t += P.quote + 900 + (legendary ? 1200 : 0);
    ms.forEach((m, i) => {
      timers.push(setTimeout(() => {
        if (i === 0) { const sq = $("stQuote"); if (sq) sq.classList.add("gone"); }
        const st = $("stMs"); if (!st) return;
        st.classList.remove("show"); void st.offsetWidth;
        const mn = $("msNum"); if (mn) mn.textContent = m.num;
        const mv = $("msVow"); if (mv) mv.textContent = m.name;
        const mt = $("msText"); if (mt) mt.textContent = m.msg;
        setTimeout(() => { st.classList.add("show"); sparks("msSparks", 16); FX.play("ms"); }, i === 0 ? 600 : 0);
      }, t));
      t += P.milestone + 900;
    });
    signs.forEach((g, i) => {
      timers.push(setTimeout(() => {
        if (i === 0) { const prev = $(ms.length ? "stMs" : "stQuote"); if (prev) prev.classList.add("gone"); }
        const st = $("stSign"); if (!st) return;
        st.classList.remove("show"); void st.offsetWidth;
        const k = $("signKicker"); if (k) k.textContent = g.kicker;
        const n = $("signNum"); if (n) n.textContent = g.num;
        const u = $("signUnit"); if (u) u.textContent = g.unit;
        const v = $("signVow"); if (v) v.textContent = g.vow;
        const x = $("signText"); if (x) x.textContent = g.text;
        setTimeout(() => { st.classList.add("show"); FX.play("sign"); }, i === 0 ? 600 : 0);
      }, t));
      t += P.milestone + 900;
    });
    timers.push(setTimeout(reveal, t));
  }
  const onSkip = () => {
    if (sealWait) { sealWait(); return; }
    if (performance.now() < guardUntil) return;
    if (!introDone) reveal();
  };
  on("intro", "pointerdown", onSkip);
  on("intro", "keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSkip(); } });
  on("replay", "click", () => { FX.unlock(); FX.buzz("light"); $("board") && $("board").classList.remove("reveal"); runIntro(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeConfirm(); closeSheet(); closeMark(); closeProto(); } });

  /* ---- старт + щоденна синхронізація ---- */
  let shownDay = null;
  function sync() {
    const today = todayKey(), dayChanged = shownDay !== today;
    if (dayChanged) { STARTS = loadStarts(); renderBoard(); updateGoalsDot(); if (TAB === "stats") renderStats(); if (TAB === "goals") renderGoals(); }
    if (LS.get("ordo.lastIntro", "") !== today) { LS.set("ordo.lastIntro", today); runIntro(); }
    else if (dayChanged) { $("intro") && $("intro").setAttribute("hidden", ""); $("board") && $("board").classList.add("reveal"); }
    shownDay = today;
  }
  renderSound();
  sync();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) sync(); });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
