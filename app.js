/* ============================================================================
   ORDO — двигун. Логіку правити не обовʼязково; контент живе в data.js.
   Усі звернення до елементів захищені: якщо чогось нема — пропускаємо,
   додаток не падає (важливо під час оновлення/кешу).
   ========================================================================== */
(function () {
  "use strict";
  const D = window.ORDO_DATA;
  const $ = (id) => document.getElementById(id);
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- сховище (localStorage) ---- */
  const LS = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---- дати / стрік ---- */
  const MONTHS = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
  const WEEK   = ["неділя","понеділок","вівторок","середа","четвер","пʼятниця","субота"];
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parseLocal = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
  function todayKey() { const d = new Date(), p = (n) => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
  function monthKey() { const d = new Date(), p = (n) => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}`; }
  function streakOf(s) { return Math.max(0, Math.round((startOfDay(new Date()) - startOfDay(parseLocal(s))) / 86400000)); }
  function pluralUk(n, f) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; }
  const daysWord = (n) => pluralUk(n, ["день","дні","днів"]);
  const fmtShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

  /* ---- стартові дати обітниць ---- */
  function loadStarts() {
    const stored = LS.get("ordo.starts", {}), out = {};
    D.VOWS.forEach((v) => { out[v.id] = stored[v.id] || v.start; });
    LS.set("ordo.starts", out);
    return out;
  }
  let STARTS = loadStarts();
  const setStart = (id, s) => { STARTS[id] = s; LS.set("ordo.starts", STARTS); };

  /* ---- віхи ---- */
  const nextMilestone = (s) => D.MILESTONES.find((m) => m > s) || null;
  const prevMilestone = (s) => { let p = 0; for (const m of D.MILESTONES) if (m <= s) p = m; return p; };

  /* ---- цитати без повторів ---- */
  function nextQuote() {
    let q = LS.get("ordo.qQueue", []);
    const last = LS.get("ordo.qLast", -1);
    if (!Array.isArray(q) || q.length === 0) {
      q = [...Array(D.QUOTES.length).keys()];
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (q.length > 1 && q[0] === last) [q[0], q[1]] = [q[1], q[0]];
    }
    const idx = q.shift();
    LS.set("ordo.qQueue", q); LS.set("ordo.qLast", idx);
    return D.QUOTES[idx];
  }

  /* ---- табло ---- */
  function renderBoard() {
    const ct = $("crestTitle"); if (ct) ct.textContent = D.APP_CONFIG.title;
    const cs = $("crestSub"); if (cs) cs.textContent = D.APP_CONFIG.subtitle;
    const fd = $("footDate"); if (fd) fd.textContent = fmtShort(new Date());
    const ul = $("oaths"); if (!ul) return;
    ul.innerHTML = "";
    D.VOWS.forEach((v) => {
      const s = streakOf(STARTS[v.id]);
      const nm = nextMilestone(s);
      const sub = nm ? `ціль ${nm} · лишилось ${nm - s} ${daysWord(nm - s)}` : "усі віхи взято";
      const prog = nm ? Math.min(100, (s / nm) * 100) : 100;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "oath"; btn.type = "button";
      btn.innerHTML =
        `<span class="oath__icon"><svg><use href="#i-${v.icon}"></use></svg></span>` +
        `<span class="oath__body"><span class="oath__name">${v.name}</span><span class="oath__sub">${sub}</span></span>` +
        `<span class="oath__count"><span class="oath__num">${s}</span><span class="oath__unit">${daysWord(s)}</span></span>` +
        `<span class="oath__ring" style="width:${prog}%"></span>`;
      btn.addEventListener("click", () => openSheet(v.id));
      li.appendChild(btn); ul.appendChild(li);
    });
  }

  /* ---- шторка обітниці ---- */
  let sheetVow = null;
  function openSheet(id) {
    sheetVow = id;
    const v = D.VOWS.find((x) => x.id === id), s = streakOf(STARTS[id]), nm = nextMilestone(s);
    const T = $("shTitle"); if (T) T.textContent = v.name;
    const St = $("shStat"); if (St) St.textContent = `${s} ${daysWord(s)} стійко`;
    const Ic = $("shIcon"); if (Ic) Ic.innerHTML = `<use href="#i-${v.icon}"></use>`;
    const Nx = $("shNext"); if (Nx) Nx.textContent = nm ? `${nm} (через ${nm - s} ${daysWord(nm - s)})` : "усі взято";
    const di = $("shDate"); if (di) { di.value = STARTS[id]; di.max = todayKey(); }
    $("scrim") && $("scrim").classList.add("open");
    $("sheet") && $("sheet").classList.add("open");
  }
  const closeSheet = () => { $("scrim") && $("scrim").classList.remove("open"); $("sheet") && $("sheet").classList.remove("open"); };
  function refreshSheet() {
    const s = streakOf(STARTS[sheetVow]), nm = nextMilestone(s);
    const St = $("shStat"); if (St) St.textContent = `${s} ${daysWord(s)} стійко`;
    const Nx = $("shNext"); if (Nx) Nx.textContent = nm ? `${nm} (через ${nm - s} ${daysWord(nm - s)})` : "усі взято";
  }
  on("shClose", "click", closeSheet);
  on("shDate", "change", (e) => { if (!e.target.value) return; setStart(sheetVow, e.target.value); refreshSheet(); renderBoard(); });

  /* ---- підтвердження зриву ---- */
  const closeConfirm = () => { $("confirm") && $("confirm").classList.remove("open"); };
  on("shReset", "click", () => { const n = $("cfName"); if (n) n.textContent = D.VOWS.find((x) => x.id === sheetVow).name; $("confirm") && $("confirm").classList.add("open"); });
  on("cfNo", "click", closeConfirm);
  on("cfYes", "click", () => { setStart(sheetVow, todayKey()); closeConfirm(); closeSheet(); renderBoard(); });

  /* ---- Трапези (місячний лічильник; залишок — кружечки) ---- */
  const F = D.FEASTS || { label: "Трапези", total: 4 };
  function loadFeast() {
    const s = LS.get("ordo.feast", null), mk = monthKey();
    if (!s || s.month !== mk) { const f = { month: mk, left: F.total }; LS.set("ordo.feast", f); return f; }
    if (typeof s.left !== "number") s.left = F.total;
    if (s.left > F.total) s.left = F.total;
    if (s.left < 0) s.left = 0;
    return s;
  }
  let FEAST = loadFeast();
  function renderFeast() {
    const box = $("feastDots");
    if (box) box.textContent = "●".repeat(FEAST.left) + "○".repeat(Math.max(0, F.total - FEAST.left));
  }
  function openFeast() {
    const t = $("feastText"), yes = $("feastYes"), no = $("feastNo");
    if (FEAST.left > 0) {
      if (t) t.innerHTML = `Відмітити трапезу? Залишиться <b>${FEAST.left - 1} з ${F.total}</b>.`;
      if (yes) yes.style.display = "";
      if (no) no.textContent = "Скасувати";
    } else {
      if (t) t.textContent = `Усі ${F.total} цього місяця відмічені. Поновляться 1-го числа.`;
      if (yes) yes.style.display = "none";
      if (no) no.textContent = "Закрити";
    }
    $("scrim") && $("scrim").classList.add("open");
    $("feastModal") && $("feastModal").classList.add("open");
  }
  const closeFeast = () => { $("scrim") && $("scrim").classList.remove("open"); $("feastModal") && $("feastModal").classList.remove("open"); };
  on("feast", "click", openFeast);
  on("feastNo", "click", closeFeast);
  on("feastYes", "click", () => { FEAST.left = Math.max(0, FEAST.left - 1); LS.set("ordo.feast", FEAST); renderFeast(); closeFeast(); });

  /* ---- ритуал ---- */
  let timers = [], introDone = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function reveal() { introDone = true; clearTimers(); $("intro") && $("intro").setAttribute("hidden", ""); $("board") && $("board").classList.add("reveal"); }

  function runIntro() {
    introDone = false;
    const intro = $("intro");
    if (!intro) { reveal(); return; }
    intro.removeAttribute("hidden");
    ["stDate","stQuote","stMs"].forEach((id) => { const el = $(id); if (el) el.classList.remove("show","gone"); });
    intro.classList.remove("drawing","drawn");
    intro.scrollTop = 0;

    const d = new Date();
    const dw = $("dWeekday"); if (dw) dw.textContent = WEEK[d.getDay()];
    const dm = $("dMain"); if (dm) dm.textContent = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    const dy = $("dYear"); if (dy) dy.textContent = d.getFullYear();
    const qt = $("qText"); if (qt) qt.textContent = nextQuote();

    const ms = [];
    D.VOWS.forEach((v) => { const s = streakOf(STARTS[v.id]); if (D.MILESTONES.includes(s)) ms.push({ name: v.name, num: s, msg: D.MILESTONE_MSGS[s] || "" }); });

    const P = reduce ? { date: 650, quote: 750, milestone: 850 } : D.APP_CONFIG.introPaceMs;
    let t = 0;

    timers.push(setTimeout(() => {
      const sd = $("stDate"); if (sd) sd.classList.add("show");
      requestAnimationFrame(() => { intro.classList.add("drawing"); requestAnimationFrame(() => intro.classList.add("drawn")); });
    }, 140));
    t = P.date + 500;

    timers.push(setTimeout(() => { const sd = $("stDate"); if (sd) sd.classList.add("gone"); }, t - 300));
    timers.push(setTimeout(() => { const sq = $("stQuote"); if (sq) sq.classList.add("show"); }, t));
    t += P.quote + 550;

    ms.forEach((m, i) => {
      timers.push(setTimeout(() => {
        if (i === 0) { const sq = $("stQuote"); if (sq) sq.classList.add("gone"); }
        const st = $("stMs"); if (!st) return;
        st.classList.remove("show"); void st.offsetWidth;
        const mn = $("msNum"); if (mn) mn.textContent = m.num;
        const mv = $("msVow"); if (mv) mv.textContent = m.name;
        const mt = $("msText"); if (mt) mt.textContent = m.msg;
        st.classList.add("show");
      }, t));
      t += P.milestone + 650;
    });

    timers.push(setTimeout(reveal, t));
  }

  const onSkip = () => { if (!introDone) reveal(); };
  on("intro", "pointerdown", onSkip);
  on("intro", "keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSkip(); } });
  on("replay", "click", () => { $("board") && $("board").classList.remove("reveal"); runIntro(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeConfirm(); closeSheet(); closeFeast(); } });

  /* ---- старт + щоденна синхронізація ---- */
  let shownDay = null;
  function sync() {
    const today = todayKey();
    const dayChanged = shownDay !== today;
    if (dayChanged) {             // перемальовуємо табло ЛИШЕ коли змінився день,
      FEAST = loadFeast();        // інакше бари рестартували б пульс при кожному відкритті
      renderBoard();
      renderFeast();
    }
    if (LS.get("ordo.lastIntro", "") !== today) {
      LS.set("ordo.lastIntro", today);
      runIntro();                 // перший запуск за день → ритуал
    } else if (dayChanged) {
      $("intro") && $("intro").setAttribute("hidden", "");
      $("board") && $("board").classList.add("reveal");
    }
    shownDay = today;
  }

  sync();

  /* iOS часто «заморожує» PWA і не перезапускає скрипт при поверненні —
     тож пересинхронізуємо дату/ритуал, коли застосунок знову стає видимим. */
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) sync(); });

  /* офлайн */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
