/* ============================================================================
   ORDO — двигун. Логіку правити не обовʼязково; контент живе в data.js.
   ========================================================================== */
(function () {
  "use strict";
  const D = window.ORDO_DATA;
  const $ = (id) => document.getElementById(id);
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
    $("crestTitle").textContent = D.APP_CONFIG.title;
    $("crestSub").textContent = D.APP_CONFIG.subtitle;
    $("footDate").textContent = fmtShort(new Date());
    const ul = $("oaths"); ul.innerHTML = "";
    D.VOWS.forEach((v) => {
      const s = streakOf(STARTS[v.id]);
      const nm = nextMilestone(s), pm = prevMilestone(s);
      const sub = nm ? `ціль ${nm} · лишилось ${nm - s} ${daysWord(nm - s)}` : "усі віхи взято";
      const prog = nm ? Math.min(100, ((s - pm) / (nm - pm)) * 100) : 100;
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
    $("shTitle").textContent = v.name;
    $("shStat").textContent = `${s} ${daysWord(s)} стійко`;
    $("shIcon").innerHTML = `<use href="#i-${v.icon}"></use>`;
    $("shNext").textContent = nm ? `${nm} (через ${nm - s} ${daysWord(nm - s)})` : "усі взято";
    const di = $("shDate"); di.value = STARTS[id]; di.max = todayKey();
    $("scrim").classList.add("open"); $("sheet").classList.add("open");
  }
  const closeSheet = () => { $("scrim").classList.remove("open"); $("sheet").classList.remove("open"); };
  function refreshSheet() {
    const s = streakOf(STARTS[sheetVow]), nm = nextMilestone(s);
    $("shStat").textContent = `${s} ${daysWord(s)} стійко`;
    $("shNext").textContent = nm ? `${nm} (через ${nm - s} ${daysWord(nm - s)})` : "усі взято";
  }
  $("shClose").onclick = closeSheet;
  $("scrim").onclick = () => { closeSheet(); closeConfirm(); closeFeast(); };
  $("shDate").addEventListener("change", (e) => {
    if (!e.target.value) return;
    setStart(sheetVow, e.target.value); refreshSheet(); renderBoard();
  });

  /* ---- підтвердження зриву ---- */
  $("shReset").onclick = () => { $("cfName").textContent = D.VOWS.find((x) => x.id === sheetVow).name; $("confirm").classList.add("open"); };
  const closeConfirm = () => $("confirm").classList.remove("open");
  $("cfNo").onclick = closeConfirm;
  $("cfYes").onclick = () => { setStart(sheetVow, todayKey()); closeConfirm(); closeSheet(); renderBoard(); };

  /* ---- Трапези (місячний лічильник) ---- */
  const F = D.FEASTS || { label: "Трапези", total: 4 };
  function loadFeast() {
    const s = LS.get("ordo.feast", null), mk = monthKey();
    if (!s || s.month !== mk) { const f = { month: mk, left: F.total }; LS.set("ordo.feast", f); return f; }
    if (typeof s.left !== "number") s.left = F.total;
    return s;
  }
  let FEAST = loadFeast();
  const clampFeast = (n) => Math.max(0, Math.min(F.total, n));
  function renderFeast() {
    const num = $("feastNum"); if (num) num.textContent = FEAST.left;
    const val = $("feastVal"); if (val) val.textContent = FEAST.left;
    const lt = $("feastLeftTxt"); if (lt) lt.textContent = FEAST.left;
  }
  function openFeast() {
    $("feastTotalTxt").textContent = F.total;
    $("feastResetN").textContent = F.total;
    renderFeast();
    $("scrim").classList.add("open"); $("feastModal").classList.add("open");
  }
  const closeFeast = () => { $("scrim").classList.remove("open"); $("feastModal").classList.remove("open"); };
  function setFeast(n) { FEAST.left = clampFeast(n); LS.set("ordo.feast", FEAST); renderFeast(); }
  $("feast").onclick = openFeast;
  $("feastNo").onclick = closeFeast;
  $("feastMinus").onclick = () => setFeast(FEAST.left - 1);
  $("feastPlus").onclick = () => setFeast(FEAST.left + 1);
  $("feastReset").onclick = () => setFeast(F.total);

  /* ---- ритуал ---- */
  let timers = [], introDone = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function reveal() { introDone = true; clearTimers(); $("intro").setAttribute("hidden", ""); $("board").classList.add("reveal"); }

  function runIntro() {
    introDone = false;
    const intro = $("intro");
    intro.removeAttribute("hidden");
    ["stDate","stQuote","stMs"].forEach((id) => $(id).classList.remove("show","gone"));
    intro.classList.remove("drawing","drawn");
    intro.scrollTop = 0;

    const d = new Date();
    $("dWeekday").textContent = WEEK[d.getDay()];
    $("dMain").textContent = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    $("dYear").textContent = d.getFullYear();
    $("qText").textContent = nextQuote();

    const ms = [];
    D.VOWS.forEach((v) => { const s = streakOf(STARTS[v.id]); if (D.MILESTONES.includes(s)) ms.push({ name: v.name, num: s, msg: D.MILESTONE_MSGS[s] || "" }); });

    const P = reduce ? { date: 650, quote: 750, milestone: 850 } : D.APP_CONFIG.introPaceMs;
    let t = 0;

    timers.push(setTimeout(() => {
      $("stDate").classList.add("show");
      requestAnimationFrame(() => { intro.classList.add("drawing"); requestAnimationFrame(() => intro.classList.add("drawn")); });
    }, 140));
    t = P.date + 500;

    timers.push(setTimeout(() => $("stDate").classList.add("gone"), t - 300));
    timers.push(setTimeout(() => $("stQuote").classList.add("show"), t));
    t += P.quote + 550;

    ms.forEach((m, i) => {
      timers.push(setTimeout(() => {
        if (i === 0) $("stQuote").classList.add("gone");
        const st = $("stMs"); st.classList.remove("show"); void st.offsetWidth;
        $("msNum").textContent = m.num; $("msVow").textContent = m.name; $("msText").textContent = m.msg;
        st.classList.add("show");
      }, t));
      t += P.milestone + 650;
    });

    timers.push(setTimeout(reveal, t));
  }

  const onSkip = () => { if (!introDone) reveal(); };
  $("intro").addEventListener("pointerdown", onSkip);
  $("intro").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSkip(); } });
  $("replay").onclick = () => { $("board").classList.remove("reveal"); runIntro(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeConfirm(); closeSheet(); closeFeast(); } });

  /* ---- старт ---- */
  renderBoard();
  renderFeast();
  if (LS.get("ordo.lastIntro", "") !== todayKey()) {
    LS.set("ordo.lastIntro", todayKey());
    runIntro();
  } else {
    $("intro").setAttribute("hidden", "");
    $("board").classList.add("reveal");
  }

  /* офлайн */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
