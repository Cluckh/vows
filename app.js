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
  const MONTHS_NOM = ["січень","лютий","березень","квітень","травень","червень","липень","серпень","вересень","жовтень","листопад","грудень"];
  const WEEK   = ["неділя","понеділок","вівторок","середа","четвер","пʼятниця","субота"];
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parseLocal = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
  const pad = (n) => String(n).padStart(2,"0");
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function monthKey() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
  const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
  function streakOf(s) { return Math.max(0, dayDiff(new Date(), parseLocal(s))); }
  function pluralUk(n, f) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; }
  const daysWord = (n) => pluralUk(n, ["день","дні","днів"]);
  const fmtShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

  /* ================================================================ ВІДГУК ==
     Звук синтезується на льоту (без файлів) — тихі дзвони в тон Ордену.
     iOS: звук стартує лише після дотику; з беззвучним режимом — мовчить;
     музику/подкаст не перебиває. Вібро: Android — Vibration API,
     iPhone (iOS 18+) — системний тактильний «клік» перемикача.            */
  const FX = (() => {
    let ac = null, enabled = LS.get("ordo.sound", true);
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
    function ctx() {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (e) { return null; } }
      return ac;
    }
    function unlock() { if (!enabled) return; const c = ctx(); if (c && c.state !== "running") c.resume().catch(() => {}); }
    function bell(f, when, dur, vol) {
      const c = ac, t = c.currentTime + (when || 0);
      const out = c.createGain(); out.gain.value = vol; out.connect(c.destination);
      [[1,1],[2.01,.42],[2.76,.24],[4.07,.11],[5.43,.05]].forEach(([r, g], i) => {
        const o = c.createOscillator(), a = c.createGain();
        o.type = "sine"; o.frequency.value = f * r;
        a.gain.setValueAtTime(0.0001, t);
        a.gain.exponentialRampToValueAtTime(g, t + 0.006);
        a.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i * 0.6));
        o.connect(a); a.connect(out); o.start(t); o.stop(t + dur + 0.05);
      });
    }
    const S = {
      open:   () => bell(784, 0, 1.1, .04),
      fold:   () => bell(1047, 0, .55, .028),
      feast:  () => { bell(1175, 0, .8, .045); bell(880, .09, 1.1, .04); },
      over:   () => { bell(330, 0, 1.6, .05); bell(311, .07, 1.8, .035); },
      reset:  () => { bell(196, 0, 2.6, .07); bell(147, .06, 3, .05); },
      toggle: () => bell(988, 0, .5, .03),
      date:   () => bell(523.25, 0, 2.2, .035),
      quote:  () => bell(659.25, 0, 2.4, .03),
      sign:   () => bell(783.99, 0, 2, .03),
      ms:     () => { [523.25, 659.25, 783.99].forEach((f, i) => bell(f, i * .12, 2.8, .045)); bell(1046.5, .42, 3.2, .03); },
      year:   () => { bell(130.81, 0, 6, .07); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, .3 + i * .2, 4.5, .045)); bell(1318.5, 1.3, 4, .025); }
    };
    /* g = викликано з дотику (можна будити звук); інакше граємо лише якщо вже прокинувся */
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
    return {
      unlock, play, buzz,
      get enabled() { return enabled; },
      set(v) { enabled = v; LS.set("ordo.sound", v); }
    };
  })();
  ["pointerdown", "touchend", "keydown"].forEach((ev) => document.addEventListener(ev, FX.unlock, { passive: true }));

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

  /* ========================================================= ХРЕСТОВИЙ ПОХІД == */
  const C = D.CRUSADE || null;
  const crusadeDay = () => C ? dayDiff(new Date(), parseLocal(C.start)) + 1 : null;   // 1 = день старту
  function crusadeOrder(day) {
    if (!C) return "";
    if (day < 1) return `До виступу ${1 - day} ${daysWord(1 - day)}. Готуй обладунок.`;
    if (day > C.days) return "Похід завершено. Сто днів — твої назавжди.";
    if (C.special && C.special[day]) return C.special[day];
    const o = C.orders || [];
    return o.length ? o[(day - 1) % o.length] : "";
  }
  function renderCrusade() {
    const el = $("crusade"); if (!el) return;
    if (!C) { el.hidden = true; return; }
    el.hidden = false;
    const day = crusadeDay(), N = C.days;
    const nm = $("cruName"); if (nm) nm.textContent = C.name;
    const dd = $("cruDay");
    if (dd) dd.innerHTML = day < 1 ? `<em>за</em> <b>${1 - day}</b>`
                        : day > N ? `<b>${N}</b><i>/${N}</i>`
                        : `<em>день</em> <b>${day}</b><i>/${N}</i>`;
    const tr = $("cruTrack");
    if (tr) {
      const marks = new Set(Object.keys(C.special || {}).map(Number));
      let html = "";
      for (let i = 1; i <= N; i++) {
        const cls = [i < day ? "p" : i === day ? "n" : "", marks.has(i) ? "m" : ""].filter(Boolean).join(" ");
        html += cls ? `<span class="${cls}"></span>` : "<span></span>";
      }
      tr.innerHTML = html;
    }
    const or = $("cruOrder"); if (or) or.textContent = crusadeOrder(day);
  }
  function openCrusade() {
    if (!C) return;
    const day = crusadeDay(), N = C.days;
    const st = $("cruStat");
    if (st) st.textContent = day < 1 ? `старт ${fmtShort(parseLocal(C.start))}`
                          : day > N ? "сто днів пройдено"
                          : `день ${day} з ${N}, лишилось ${N - day} ${daysWord(N - day)}`;
    const of = $("cruOrderFull"); if (of) of.textContent = crusadeOrder(day);
    const ru = $("cruRules"); if (ru) { ru.textContent = C.rules || ""; ru.scrollTop = 0; }
    FX.play("open", true); FX.buzz("light");
    $("cruModal") && $("cruModal").classList.add("open");
  }
  const closeCrusade = () => { $("cruModal") && $("cruModal").classList.remove("open"); };
  on("crusade", "click", openCrusade);
  on("cruClose", "click", closeCrusade);
  on("cruModal", "click", (e) => { if (e.target && e.target.id === "cruModal") closeCrusade(); });

  /* ---- рідкісні знаки дня (детерміновані від дати — повторний ритуал нічого не змінює) ---- */
  function hashDay(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function daySigns() {
    const signs = [];
    const cd = crusadeDay();
    if (C && C.special && C.special[cd]) {
      signs.push({ kicker: C.name, num: cd, unit: "день походу", vow: cd === C.days ? "фініш" : `із ${C.days}`, text: C.special[cd] });
    }
    const marks = [100, 50, 30, 10, 3, 1];          // відлік лише до великих віх (від 180)
    D.VOWS.forEach((v) => {
      const s = streakOf(STARTS[v.id]);
      const nm = nextMilestone(s);
      if (nm && nm >= 180 && marks.includes(nm - s)) {
        signs.push({
          kicker: "Віха близько", num: nm - s, unit: daysWord(nm - s), vow: v.name,
          text: nm === 365 ? "Рік уже видно з цієї вежі. Тримай стрій." : `До віхи ${nm}. Тримай стрій.`
        });
      }
    });
    const total = D.VOWS.reduce((a, v) => a + streakOf(STARTS[v.id]), 0);
    if (total >= 50 && total % 50 < D.VOWS.length) {  // сума перетнула чергові 50
      signs.push({ kicker: "Скарбниця Ордену", num: total, unit: daysWord(total) + " честі", vow: "усі обітниці разом", text: "Багато каменів — одна стіна." });
    }
    return signs;
  }

  /* ================================================================ ТАБЛО === */
  function renderBoard() {
    const ct = $("crestTitle"); if (ct) ct.textContent = D.APP_CONFIG.title;
    const cs = $("crestSub"); if (cs) cs.textContent = D.APP_CONFIG.subtitle;
    const fd = $("footDate"); if (fd) fd.textContent = fmtShort(new Date());
    renderCrusade();
    const ul = $("oaths"); if (!ul) return;
    ul.innerHTML = "";
    D.VOWS.forEach((v) => {
      const s = streakOf(STARTS[v.id]);
      const nm = nextMilestone(s);
      const sub = nm ? `ціль ${nm} · лишилось ${nm - s} ${daysWord(nm - s)}` : "усі віхи взято";
      const prog = nm ? Math.min(100, (s / nm) * 100) : 100;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "oath"; btn.type = "button"; btn.dataset.id = v.id;
      btn.innerHTML =
        `<span class="oath__icon"><svg><use href="#i-${v.icon}"></use></svg></span>` +
        `<span class="oath__body"><span class="oath__name">${v.name}</span><span class="oath__sub">${sub}</span></span>` +
        `<span class="oath__count"><span class="oath__num" data-n="${s}">${s}</span><span class="oath__unit">${daysWord(s)}</span></span>` +
        `<span class="oath__ring" style="width:${prog}%"></span>`;
      btn.addEventListener("click", () => openSheet(v.id));
      li.appendChild(btn); ul.appendChild(li);
    });
  }

  /* числа набігають від нуля — лише коли табло зʼявляється після ритуалу */
  function countUp() {
    if (reduce) return;
    const els = document.querySelectorAll(".oath__num");
    const t0 = performance.now(), dur = 950;
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    els.forEach((el) => { el.textContent = "0"; });
    (function frame(now) {
      const k = Math.min(1, (now - t0) / dur);
      els.forEach((el) => { el.textContent = Math.round(ease(k) * (+el.dataset.n || 0)); });
      if (k < 1) requestAnimationFrame(frame);
    })(t0);
  }

  /* ---- кодекс: плавне розгортання ---- */
  function setFold(id, open) { const f = $(id); if (f) f.classList.toggle("open", open); }
  const isOpen = (id) => { const f = $(id); return !!(f && f.classList.contains("open")); };

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
  function refreshSheet() {
    const s = streakOf(STARTS[sheetVow]), nm = nextMilestone(s);
    const St = $("shStat"); if (St) St.textContent = `${s} ${daysWord(s)} стійко`;
    const Nx = $("shNext"); if (Nx) Nx.textContent = nm ? `${nm} (через ${nm - s} ${daysWord(nm - s)})` : "усі взято";
  }
  on("shClose", "click", closeSheet);
  on("scrim", "click", () => { closeSheet(); closeFeast(); });
  on("shDate", "change", (e) => { if (!e.target.value) return; setStart(sheetVow, e.target.value); refreshSheet(); renderBoard(); });
  on("shCodexBtn", "click", () => {
    const open = !isOpen("shFold");
    setFold("shFold", open);
    const ch = $("shCodexChev"); if (ch) ch.textContent = open ? "згорнути" : "розгорнути";
    const cx = $("shCodex"); if (cx && open) cx.scrollTop = 0;
    FX.play("fold", true); FX.buzz("light");
  });

  /* ---- підтвердження зриву ---- */
  const closeConfirm = () => { $("confirm") && $("confirm").classList.remove("open"); };
  on("shReset", "click", () => {
    const n = $("cfName"); if (n) n.textContent = D.VOWS.find((x) => x.id === sheetVow).name;
    FX.buzz("medium");
    $("confirm") && $("confirm").classList.add("open");
  });
  on("cfNo", "click", closeConfirm);
  on("cfYes", "click", () => {
    const id = sheetVow;
    setStart(id, todayKey()); closeConfirm(); closeSheet(); renderBoard();
    FX.play("reset", true); FX.buzz("heavy");
    const row = document.querySelector(`.oath[data-id="${id}"]`);
    if (row) { row.classList.remove("oath--fall"); void row.offsetWidth; row.classList.add("oath--fall"); }
  });

  /* ============================================ ТРАПЕЗИ (ліміт місяця + борг) ==
     Перевитрата не зникає: вона переходить боргом на наступний місяць
     (не більше FEASTS.debtCap). Ліміти по місяцях — FEASTS.byMonth.       */
  const F = D.FEASTS || { label: "Трапези", total: 4 };
  const CAP = typeof F.debtCap === "number" ? F.debtCap : 4;
  const limitFor = (mk) => (F.byMonth && Object.prototype.hasOwnProperty.call(F.byMonth, mk)) ? F.byMonth[mk] : F.total;
  function loadFeast() {
    const s = LS.get("ordo.feast", null), mk = monthKey(), T = limitFor(mk);
    if (!s || s.month !== mk) {
      const prevLeft = s && typeof s.left === "number" ? s.left : 0;
      const debt = Math.min(CAP, Math.max(0, -prevLeft));
      const f = { month: mk, left: T - debt, debt };
      LS.set("ordo.feast", f); return f;
    }
    if (typeof s.left !== "number") s.left = T;
    if (s.left > T) s.left = T;
    if (typeof s.debt !== "number") s.debt = 0;
    return s;
  }
  let FEAST = loadFeast();
  const nextMonthNom = () => MONTHS_NOM[(new Date().getMonth() + 1) % 12];
  const prevMonthGen = () => MONTHS[(new Date().getMonth() + 11) % 12];
  function renderFeast(anim) {
    const T = limitFor(FEAST.month), L = FEAST.left;
    const box = $("feastDots");
    if (box) {
      if (T === 0 && L === 0) box.innerHTML = `<span class="feast__fast">піст</span>`;
      else {
        const filled = Math.max(0, L), empty = Math.max(0, T - filled), over = Math.max(0, -L);
        box.innerHTML = '<span class="fd fd--on"></span>'.repeat(filled) + '<span class="fd"></span>'.repeat(empty) + '<span class="fd fd--over"></span>'.repeat(over);
        if (anim && !reduce) {
          const el = L >= 0 ? box.children[L] : box.children[box.children.length - 1];
          if (el) el.classList.add(L >= 0 ? "fd--spent" : "fd--new");
        }
      }
    }
    const sub = $("feastSub");
    if (sub) {
      sub.textContent = L < 0 ? `борг ${-L} → ${nextMonthNom()}`
                      : FEAST.debt > 0 ? `борг ${FEAST.debt} з ${prevMonthGen()}`
                      : T === 0 ? "піст місяця · лише домашня їжа"
                      : "тап — відмітити";
      sub.classList.toggle("oath__sub--warn", L < 0);
    }
  }
  function openFeast() {
    const T = limitFor(FEAST.month), L = FEAST.left;
    const t = $("feastText"), yes = $("feastYes");
    if (L > 0) {
      if (t) t.innerHTML = `Відмітити трапезу? Залишиться <b>${L - 1} з ${T}</b>.`;
      if (yes) { yes.textContent = "Відмітити (−1)"; yes.className = "btn btn--gold"; }
    } else {
      const nl = limitFor(nextMonthKey()) - Math.min(CAP, 1 - L);
      if (t) t.innerHTML = (T === 0 ? "Цього місяця — піст." : `Усі ${T} цього місяця відмічені.`) +
        ` Якщо трапеза була — відміть чесно: перевитрата перейде боргом на ${nextMonthNom()}` +
        (nl >= 0 ? ` (там лишиться <b>${nl}</b>).` : ` (і він почнеться з боргу).`);
      if (yes) { yes.textContent = "Відмітити понад ліміт"; yes.className = "btn btn--reset"; }
    }
    setFold("feastFold", false);
    const fc = $("feastCodex"); if (fc) { fc.textContent = (D.CODEX && D.CODEX.feast) || ""; fc.scrollTop = 0; }
    const fb = $("feastCodexBtn"); if (fb) fb.hidden = !(D.CODEX && D.CODEX.feast);
    FX.play("open", true); FX.buzz("light");
    $("scrim") && $("scrim").classList.add("open");
    $("feastModal") && $("feastModal").classList.add("open");
  }
  function nextMonthKey() { const d = new Date(); const n = new Date(d.getFullYear(), d.getMonth() + 1, 1); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`; }
  function closeFeast() { $("scrim") && $("scrim").classList.remove("open"); $("feastModal") && $("feastModal").classList.remove("open"); }
  on("feast", "click", openFeast);
  on("feastNo", "click", closeFeast);
  on("feastCodexBtn", "click", () => { setFold("feastFold", !isOpen("feastFold")); FX.play("fold", true); FX.buzz("light"); });
  on("feastYes", "click", () => {
    const wasOver = FEAST.left <= 0;
    FEAST.left -= 1; LS.set("ordo.feast", FEAST);
    closeFeast(); renderFeast(true);
    FX.play(wasOver ? "over" : "feast", true); FX.buzz(wasOver ? "heavy" : "medium");
  });

  /* ---- протокол тривог ---- */
  const closeProto = () => { $("protoModal") && $("protoModal").classList.remove("open"); };
  on("protoBtn", "click", () => {
    const t = $("protoText"); if (t) { t.textContent = (D.CODEX && D.CODEX.protocol) || ""; t.scrollTop = 0; }
    FX.play("fold", true); FX.buzz("light");
    $("protoModal") && $("protoModal").classList.add("open");
  });
  on("protoClose", "click", closeProto);
  on("protoModal", "click", (e) => { if (e.target && e.target.id === "protoModal") closeProto(); });

  /* ---- звук і вібро: перемикач ---- */
  function renderSound() {
    const ic = $("sndIc"); if (ic) ic.innerHTML = `<use href="#i-${FX.enabled ? "bell" : "bell-off"}"></use>`;
    const b = $("sndBtn"); if (b) { b.classList.toggle("icobtn--off", !FX.enabled); b.setAttribute("aria-pressed", String(FX.enabled)); }
  }
  on("sndBtn", "click", () => { FX.set(!FX.enabled); renderSound(); if (FX.enabled) { FX.play("toggle", true); FX.buzz("light"); } });

  /* ---- іскри навколо сигіла ---- */
  function sparks(id, n) {
    const box = $(id); if (!box || reduce) return;
    box.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i"); s.className = "spark";
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 70 + Math.random() * 70;
      s.style.setProperty("--x", `${Math.cos(a) * r}px`);
      s.style.setProperty("--y", `${Math.sin(a) * r}px`);
      s.style.animationDelay = `${Math.random() * 0.35}s`;
      box.appendChild(s);
    }
  }

  /* ---- запечатаний сувій: не розпечатувати до строку ---- */
  const SEALED = "eyJzZWFsIjogeyJ0ZXh0IjogItCh0YzQvtCz0L7QtNC90ZYg0L3QsNGB0YLQsNCyINGB0YLRgNC+0Log0YHRg9Cy0L7Rjiwg0YnQviDRh9C10LrQsNCyINGG0ZbQu9C40Lkg0YDRltC6LiIsICJoaW50IjogItGC0L7RgNC60L3QuNGB0YwsINGJ0L7QsSDQt9C70LDQvNCw0YLQuCDQv9C10YfQsNGC0LrRgyJ9LCAic29icmlldHkiOiB7ImtpY2tlciI6ICLQn9C10YDRiNC40Lkg0YDRltC6IiwgInVuaXQiOiAi0LTQvdGW0LIg0YLQstC10YDQtdC30L7RgdGC0ZYiLCAibGluZXMiOiBbItCg0ZbQuiDRgtC+0LzRgyDRgtC4INC/0L7RgdGC0LDQstC40LIg0LrQtdC70LjRhS4iLCAi0JLRltC00YLQvtC00ZYg0LzQuNC90YPQu9C+IDM2NSDRgNCw0L3QutGW0LIg4oCUINGWINC60L7QttC10L0g0YLQuCDQt9GD0YHRgtGA0ZbQsiDRltC3INGP0YHQvdC+0Y4g0LPQvtC70L7QstC+0Y4uIiwgItCR0YPQu9C4INGC0YDQuNCy0L7Qs9C4LCDQsdC10LfRgdC+0L3QvdGWINC90L7Rh9GWINC5INCy0LXRgNC10YHQtdC90YwsINGJ0L4g0L/QvtGF0LjRgtC90YPQsiDRg9GB0LUg0ZbQvdGI0LUuINCm0Y4g0LvRltC90ZbRjiDQvdC1INC30LvQsNC80LDQsiDQvdGW0YXRgtC+LiIsICLQptC1INCy0LbQtSDQvdC1INC+0LHRltGC0L3QuNGG0Y8uINCm0LUg0YLQuC4iLCAi0J7RgNC00LXQvSDQv9Cw0LzKvNGP0YLQsNGUINGG0LXQuSDQtNC10L3RjC4iXX0sICJnZW5lcmljIjogeyJraWNrZXIiOiAi0KDRltC6INC90LAg0LLQsNGA0YLRliIsICJ1bml0IjogItC00L3RltCyIiwgImxpbmVzIjogWyLQoNGW0Log0YLQvtC80YMg0YLQuCDQtNCw0LIg0YbQtSDRgdC70L7QstC+LiIsICIzNjUg0LTQvdGW0LIg0LLQvtC90L4g0YLRgNC40LzQsNC70L7RgdGMIOKAlCDRgyDRgtC40YXRliDQvdC+0YfRliDQuSDRgyDRgtGA0LjQstC+0LbQvdGWLiIsICLQntCx0ZbRgtC90LjRhtGPLCDRidC+INC/0YDQvtC20LjQu9CwINGA0ZbQuiwg0YHRgtCw0ZQg0YfQsNGB0YLQuNC90L7RjiDRgtC10LHQtS4iLCAi0J7RgNC00LXQvSDQv9Cw0LzKvNGP0YLQsNGUINGG0LXQuSDQtNC10L3RjC4iXX19";
  const unseal = () => { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(SEALED), (c) => c.charCodeAt(0)))); } catch (e) { return null; } };
  const yearVow = () => D.VOWS.find((v) => v.id === "sobriety" && streakOf(STARTS[v.id]) === 365)
                     || D.VOWS.find((v) => streakOf(STARTS[v.id]) === 365) || null;

  /* ================================================================ РИТУАЛ == */
  let timers = [], introDone = false, sealWait = null, guardUntil = 0;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const STAGES = ["stDate","stQuote","stMs","stSign","stSeal","stYear"];
  function reveal() {
    introDone = true; sealWait = null; clearTimers();
    const intro = $("intro"); if (intro) { intro.setAttribute("hidden", ""); intro.classList.remove("sealed"); }
    const b = $("board"); if (b) { b.classList.remove("reveal"); void b.offsetWidth; b.classList.add("reveal"); }
    countUp();
  }

  function runIntro() {
    introDone = false; sealWait = null; clearTimers();
    const intro = $("intro");
    if (!intro) { reveal(); return; }
    intro.removeAttribute("hidden");
    STAGES.forEach((id) => { const el = $(id); if (el) el.classList.remove("show","gone","cracked"); });
    intro.classList.remove("drawing","drawn","sealed");
    intro.scrollTop = 0;

    const yv = yearVow(), S = yv ? unseal() : null;
    if (yv && S) {
      /* рік: спершу печатка — чекає дотику (дотик же будить звук) */
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
        for (let i = 0; i < lines.length; i++) { t += i === 0 ? 1500 : 2300; const el = lines[i]; timers.push(setTimeout(() => el.classList.add("on"), t)); }
        t += 3600;
        timers.push(setTimeout(() => { const y = $("stYear"); if (y) y.classList.add("gone"); }, t));
        playMain(t + 700, yv);
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
    const dc = $("dCrusade");
    if (dc) { const cd = crusadeDay(); const inRun = C && cd >= 1 && cd <= C.days; dc.hidden = !inRun; if (inRun) dc.textContent = `${C.name}, день ${cd} із ${C.days}`; }

    /* цитата дня; зрідка замість неї випадає легендарний сувій */
    const LQ = D.LEGENDARY_QUOTES || [];
    const h = hashDay(todayKey());
    const legendary = LQ.length > 0 && (h % 100) < 8;
    const ql = $("qLegend"); if (ql) ql.hidden = !legendary;
    const sq0 = $("stQuote"); if (sq0) sq0.classList.toggle("legendary", legendary);
    const qt = $("qText"); if (qt) qt.textContent = legendary ? LQ[h % LQ.length] : nextQuote();

    const ms = [];
    D.VOWS.forEach((v) => {
      const s = streakOf(STARTS[v.id]);
      if (skipYear && v.id === skipYear.id) return;          // рік уже вшановано печаткою
      if (D.MILESTONES.includes(s)) ms.push({ name: v.name, num: s, msg: D.MILESTONE_MSGS[s] || "" });
    });
    const signs = daySigns();

    const P = reduce ? { date: 650, quote: 750, milestone: 850 } : D.APP_CONFIG.introPaceMs;
    let t = t0;

    timers.push(setTimeout(() => {
      const sd = $("stDate"); if (sd) sd.classList.add("show");
      FX.play("date");
      requestAnimationFrame(() => { intro.classList.add("drawing"); requestAnimationFrame(() => intro.classList.add("drawn")); });
    }, t + 140));
    t += P.date + 500;

    timers.push(setTimeout(() => { const sd = $("stDate"); if (sd) sd.classList.add("gone"); }, t - 300));
    timers.push(setTimeout(() => { const sq = $("stQuote"); if (sq) sq.classList.add("show"); FX.play("quote"); }, t));
    t += P.quote + 550 + (legendary ? 900 : 0);   // легендарному — трохи більше часу

    ms.forEach((m, i) => {
      timers.push(setTimeout(() => {
        if (i === 0) { const sq = $("stQuote"); if (sq) sq.classList.add("gone"); }
        const st = $("stMs"); if (!st) return;
        st.classList.remove("show"); void st.offsetWidth;
        const mn = $("msNum"); if (mn) mn.textContent = m.num;
        const mv = $("msVow"); if (mv) mv.textContent = m.name;
        const mt = $("msText"); if (mt) mt.textContent = m.msg;
        st.classList.add("show"); sparks("msSparks", 16); FX.play("ms");
      }, t));
      t += P.milestone + 650;
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
        st.classList.add("show"); FX.play("sign");
      }, t));
      t += P.milestone + 650;
    });

    timers.push(setTimeout(reveal, t));
  }

  const onSkip = () => {
    if (sealWait) { sealWait(); return; }
    if (performance.now() < guardUntil) return;          // не проскочити церемонію випадковим подвійним дотиком
    if (!introDone) reveal();
  };
  on("intro", "pointerdown", onSkip);
  on("intro", "keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSkip(); } });
  on("replay", "click", () => { FX.unlock(); FX.buzz("light"); $("board") && $("board").classList.remove("reveal"); runIntro(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeConfirm(); closeSheet(); closeFeast(); closeProto(); closeCrusade(); } });

  /* ---- старт + щоденна синхронізація ---- */
  let shownDay = null;
  function sync() {
    const today = todayKey();
    const dayChanged = shownDay !== today;
    if (dayChanged) {             // перемальовуємо табло ЛИШЕ коли змінився день,
      STARTS = loadStarts();
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

  renderSound();
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
