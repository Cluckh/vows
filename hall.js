/* ============================================================================
   ORDO — Зала храмовників: сцени-новели з Верховним і хранителями обітниць.
   Храмовники малюються кодом (золота гравюра, промальовується лініями).
   Тексти — у зашифрованому вмісті (D.KEEPERS, D.PANIC, D.SUPREME_MORNING).
   Двигун додатка дає доступ через window.ORDO_API (стріки, літопис, звук).
   ========================================================================== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const API = () => window.ORDO_API || {};
  const D = () => window.ORDO_DATA || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 200) : ms));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- памʼять «не повторюватись»: останні показані репліки ---------- */
  function fresh(key, list, keepN) {
    if (!list || !list.length) return null;
    let seen = []; try { seen = JSON.parse(localStorage.getItem("ordo.hall." + key) || "[]"); } catch (e) {}
    const free = list.map((_, i) => i).filter((i) => !seen.includes(i));
    const i = pick(free.length ? free : list.map((_, j) => j));
    seen.push(i); seen = seen.slice(-Math.min(keepN || 6, list.length - 1));
    try { localStorage.setItem("ordo.hall." + key, JSON.stringify(seen)); } catch (e) {}
    return { i, v: list[i] };
  }

  /* ============================================================ ГРАВЮРА ===
     figure({ kind: "bust" | "full", head: "helm" | "hood" | "plume", icon, supreme }) */
  const L = (d, k) => `<path class="tp-l${k ? " " + k : ""}" pathLength="1" d="${d}"/>`;
  const F = (d, k) => `<path class="tp-f${k ? " " + k : ""}" d="${d}"/>`;
  function helm(cx, top, w, supreme, plume) {
    const x0 = cx - w / 2, x1 = cx + w / 2, h = w * 1.18, bot = top + h;
    let s = F(`M${x0} ${top + 16} C${x0} ${top} ${x1} ${top} ${x1} ${top + 16} L${x1 + 2} ${bot - 14} C${x1 + 2} ${bot - 4} ${cx + w * .2} ${bot + 4} ${cx} ${bot + 5} C${cx - w * .2} ${bot + 4} ${x0 - 2} ${bot - 4} ${x0 - 2} ${bot - 14} Z`);
    s += L(`M${x0} ${top + 16} C${x0} ${top} ${x1} ${top} ${x1} ${top + 16} L${x1 + 2} ${bot - 14} C${x1 + 2} ${bot - 4} ${cx + w * .2} ${bot + 4} ${cx} ${bot + 5} C${cx - w * .2} ${bot + 4} ${x0 - 2} ${bot - 4} ${x0 - 2} ${bot - 14} Z`);
    s += L(`M${cx} ${top + 3} V${top + 24}`, "tp-thin");                                     // гребінь
    s += L(`M${x0 + 1} ${top + 24} H${x1 - 1}`, "tp-thin");                                   // обідок
    const ey = top + h * .4;
    s += L(`M${x0 + 6} ${ey} H${x1 - 6} M${cx} ${ey} V${bot - 6}`, "tp-slit");               // хрестоподібна проріз
    s += `<path class="tp-eye" d="M${x0 + 6} ${ey} H${x1 - 6} M${cx} ${ey} V${bot - 6}"/>`;  // світло з-під шолома
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) s += `<circle class="tp-dot" cx="${x1 - 9 - j * 5}" cy="${ey + 10 + i * 6}" r=".9"/>`;
    if (supreme) {
      const c = top + 2;
      s += F(`M${x0 - 1} ${c + 8} L${x0 + 4} ${c - 9} L${cx - w * .2} ${c + 2} L${cx} ${c - 14} L${cx + w * .2} ${c + 2} L${x1 - 4} ${c - 9} L${x1 + 1} ${c + 8} Z`, "tp-gold");
      s += L(`M${x0 - 1} ${c + 8} L${x0 + 4} ${c - 9} L${cx - w * .2} ${c + 2} L${cx} ${c - 14} L${cx + w * .2} ${c + 2} L${x1 - 4} ${c - 9} L${x1 + 1} ${c + 8} Z`);
      s += `<circle class="tp-gem" cx="${cx}" cy="${c - 3}" r="2.4"/>`;
    }
    if (plume) s += L(`M${cx} ${top + 3} C${cx + 6} ${top - 22} ${cx + 30} ${top - 26} ${cx + 44} ${top - 12} C${cx + 30} ${top - 16} ${cx + 16} ${top - 10} ${cx + 8} ${top + 4}`, "tp-plume");
    return s;
  }
  function hood(cx, top, w) {
    const x0 = cx - w / 2 - 6, x1 = cx + w / 2 + 6, bot = top + w * 1.25;
    let s = F(`M${cx} ${top - 6} C${x1 + 8} ${top + 4} ${x1 + 6} ${bot - 6} ${x1 + 12} ${bot + 8} L${x0 - 12} ${bot + 8} C${x0 - 6} ${bot - 6} ${x0 - 8} ${top + 4} ${cx} ${top - 6} Z`);
    s += L(`M${cx} ${top - 6} C${x1 + 8} ${top + 4} ${x1 + 6} ${bot - 6} ${x1 + 12} ${bot + 8} M${cx} ${top - 6} C${x0 - 8} ${top + 4} ${x0 - 6} ${bot - 6} ${x0 - 12} ${bot + 8}`);
    s += `<path class="tp-shade" d="M${cx} ${top + 12} C${cx + w * .42} ${top + 18} ${cx + w * .4} ${bot - 10} ${cx} ${bot - 2} C${cx - w * .4} ${bot - 10} ${cx - w * .42} ${top + 18} ${cx} ${top + 12} Z"/>`;
    s += L(`M${cx} ${top + 12} C${cx + w * .42} ${top + 18} ${cx + w * .4} ${bot - 10} ${cx} ${bot - 2} C${cx - w * .4} ${bot - 10} ${cx - w * .42} ${top + 18} ${cx} ${top + 12} Z`, "tp-thin");
    s += `<circle class="tp-eyes" cx="${cx - 7}" cy="${top + w * .62}" r="1.3"/><circle class="tp-eyes" cx="${cx + 7}" cy="${top + w * .62}" r="1.3"/>`;
    return s;
  }
  function chest(cx, y, icon, supreme) {
    if (supreme) return L(`M${cx} ${y - 18} V${y + 40} M${cx - 20} ${y} H${cx + 20}`, "tp-cross") + L(`M${cx - 30} ${y - 26} C${cx - 18} ${y - 8} ${cx - 14} ${y + 20} ${cx - 16} ${y + 50} M${cx + 30} ${y - 26} C${cx + 18} ${y - 8} ${cx + 14} ${y + 20} ${cx + 16} ${y + 50}`, "tp-thin");
    if (!icon) return L(`M${cx} ${y - 10} V${y + 26} M${cx - 13} ${y + 2} H${cx + 13}`, "tp-cross");
    return `<circle class="tp-medal" cx="${cx}" cy="${y + 6}" r="17"/>` + `<circle class="tp-l tp-thin" pathLength="1" cx="${cx}" cy="${y + 6}" r="17"/>` +
      `<svg class="tp-ic" x="${cx - 11}" y="${y - 5}" width="22" height="22" viewBox="0 0 24 24"><use href="#i-${icon}"/></svg>`;
  }
  function figure(o) {
    o = o || {};
    const head = o.head || "helm";
    if (o.kind === "full") {
      /* на весь зріст: на варті, меч вістрям донизу, руки на руківʼї, щит за плечем */
      const cape = "M60 104 C44 180 36 270 30 352 L170 352 C164 270 156 180 140 104 Z";
      let s = F(cape, "tp-cape") + L("M60 104 C44 180 36 270 30 352 M140 104 C156 180 164 270 170 352", "tp-thin");
      const sh = "M148 96 L182 106 V156 C182 182 166 198 148 208 C130 198 114 182 114 156 V106 Z";
      s += F(sh, "tp-shield") + L(sh) + L("M148 114 V192 M128 144 H168", "tp-thin");
      const coat = "M64 104 C72 96 128 96 136 104 L140 170 L148 256 L52 256 L60 170 Z";
      s += F(coat) + L(coat);
      s += L("M100 112 V160 M84 128 H116", "tp-cross");
      s += L("M60 168 C80 174 120 174 140 168", "tp-thin");                                   // пояс
      s += L("M100 196 V256 M76 210 L72 256 M124 210 L128 256", "tp-thin");                    // складки
      s += F("M70 256 L74 336 L64 346 H94 L96 256 Z M130 256 L126 336 L136 346 H106 L104 256 Z") + L("M70 256 L74 336 L64 346 H94 L96 256 M130 256 L126 336 L136 346 H106 L104 256");
      const pl = "M48 128 C46 108 60 98 80 98 L82 114 C68 114 58 120 56 132 Z", pr = "M152 128 C154 108 140 98 120 98 L118 114 C132 114 142 120 144 132 Z";
      s += F(pl, "tp-pauldron") + L(pl) + F(pr, "tp-pauldron") + L(pr);
      s += L("M52 130 C46 150 50 168 62 176 C72 182 82 182 90 180 M148 130 C154 150 150 168 138 176 C128 182 118 182 110 180");   // руки
      s += L("M100 186 V346", "tp-blade") + L("M80 190 H120", "tp-blade");
      s += F("M88 172 C88 168 112 168 112 172 V184 C112 188 88 188 88 184 Z", "tp-pauldron") + L("M88 172 C88 168 112 168 112 172 V184 C112 188 88 188 88 184 Z", "tp-thin");
      s += `<circle class="tp-gem" cx="100" cy="166" r="3.4"/>`;
      s += F("M84 88 C90 84 110 84 116 88 L118 100 C108 104 92 104 82 100 Z") + L("M84 88 C90 84 110 84 116 88 L118 100 C108 104 92 104 82 100 Z", "tp-thin");
      s += helm(100, 16, 56, o.supreme, false);
      return `<svg class="tp tp--full" viewBox="0 0 200 360" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${s}</svg>`;
    }
    /* погруддя */
    let s = F("M24 236 C30 168 58 132 100 126 C142 132 170 168 176 236 Z", "tp-cape") + L("M24 236 C30 168 58 132 100 126 C142 132 170 168 176 236", "tp-thin");
    s += F("M50 236 L56 160 C70 142 130 142 144 160 L150 236 Z") + L("M50 236 L56 160 C70 142 130 142 144 160 L150 236");
    s += F("M34 186 C34 160 54 140 82 138 L86 160 C66 162 52 172 46 190 Z", "tp-pauldron") + L("M34 186 C34 160 54 140 82 138 L86 160 C66 162 52 172 46 190 Z");
    s += F("M166 186 C166 160 146 140 118 138 L114 160 C134 162 148 172 154 190 Z", "tp-pauldron") + L("M166 186 C166 160 146 140 118 138 L114 160 C134 162 148 172 154 190 Z");
    s += L("M40 172 C52 160 68 154 84 152 M160 172 C148 160 132 154 116 152", "tp-thin");
    s += F("M82 132 C88 126 112 126 118 132 L120 146 C108 151 92 151 80 146 Z") + L("M82 132 C88 126 112 126 118 132 L120 146 C108 151 92 151 80 146 Z", "tp-thin");
    s += chest(100, 186, o.icon, o.supreme);
    if (o.supreme) s += `<circle class="tp-halo" cx="100" cy="86" r="72"/>`;
    s += head === "hood" ? hood(100, 48, 64) : helm(100, 42, 74, o.supreme, head === "plume");
    return `<svg class="tp tp--bust" viewBox="0 0 200 236" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${s}</svg>`;
  }

  /* ============================================================ СЦЕНА ===== */
  let hall = null, typing = null, onTap = null, curFig = "";
  function build() {
    if (hall) return hall;
    hall = document.createElement("div"); hall.className = "hall"; hall.id = "hall"; hall.setAttribute("role", "dialog"); hall.setAttribute("aria-modal", "true");
    hall.innerHTML = `<div class="hall__rays" aria-hidden="true"></div>
      <div class="hall__fig" id="hallFig"></div>
      <div class="hall__plate" id="hallPlate"></div>
      <div class="hall__box" id="hallBox"><p class="hall__say" id="hallSay"></p><div class="hall__acts" id="hallActs"></div><div class="hall__tap" id="hallTap">торкнись, щоб продовжити</div></div>
      <button class="hall__x" id="hallX" type="button" aria-label="Закрити"><svg><use href="#i-x"/></svg></button>`;
    document.body.appendChild(hall);
    hall.addEventListener("click", (e) => {
      if (e.target.closest("#hallX")) { close(); return; }
      if (e.target.closest(".hall__acts button")) return;
      if (typing) { typing(); return; }            // докрутити текст
      if (onTap) { const f = onTap; onTap = null; f(); }
    });
    return hall;
  }
  function show(who) {
    build();
    const k = (D().KEEPERS || {})[who.id] || {};
    const fig = figure({ kind: who.kind || "bust", icon: who.icon, supreme: who.id === "supreme", head: who.head });
    const f = $("hallFig");
    if (curFig !== fig) {
      f.innerHTML = fig; curFig = fig;
      f.classList.remove("drawn"); void f.offsetWidth; requestAnimationFrame(() => f.classList.add("drawn"));
    }
    $("hallPlate").innerHTML = `<b>${esc(who.name || k.name || "")}</b><span>${esc(who.title || k.title || "")}</span>${(who.bio || k.bio) ? `<em>${esc(who.bio || k.bio)}</em>` : ""}`;
    hall.classList.toggle("hall--supreme", who.id === "supreme");
    if (!hall.classList.contains("open")) {
      hall.classList.add("open"); document.body.classList.add("in-hall");
      const A = API(); if (A.FX) { A.FX.play(who.id === "supreme" ? "date" : "sign", true); A.FX.buzz("medium"); }
    }
  }
  let closeResolve = null;
  function close() {
    if (!hall) return;
    hall.classList.remove("open"); document.body.classList.remove("in-hall");
    onTap = null; if (typing) typing();
    $("hallActs").innerHTML = ""; $("hallSay").textContent = "";
    curFig = "";
    if (closeResolve) { const r = closeResolve; closeResolve = null; r("closed"); }
  }
  const isOpen = () => !!(hall && hall.classList.contains("open"));

  /* друкарський текст; торкання — докрутити */
  function type(text) {
    if (typing) typing();                            // попередній друк — дописати й відпустити
    const el = $("hallSay"); el.textContent = ""; $("hallBox").classList.remove("has-tap");
    return new Promise((res) => {
      if (reduce) { el.textContent = text; res(); return; }
      let i = 0; const step = () => { i++; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(t); typing = null; res(); } };
      const t = setInterval(step, 24);
      typing = () => { clearInterval(t); el.textContent = text; typing = null; res(); };
    });
  }
  /* сказати й дочекатися торкання */
  function say(text) {
    return new Promise(async (res) => {
      closeResolve = res; $("hallActs").innerHTML = "";
      await type(text);
      if (!isOpen()) return;
      $("hallBox").classList.add("has-tap");
      onTap = () => { $("hallBox").classList.remove("has-tap"); closeResolve = null; res("next"); };
    });
  }
  /* запитати з варіантами */
  function ask(text, options, cls) {
    return new Promise(async (res) => {
      closeResolve = res; $("hallActs").innerHTML = ""; onTap = null;
      await type(text);
      if (!isOpen()) return;
      const box = $("hallActs");
      box.className = "hall__acts" + (cls ? " " + cls : "");
      box.innerHTML = options.map((o, i) => `<button type="button" data-i="${i}" style="--d:${i * 70}ms">${esc(o)}</button>`).join("");
      const t0 = performance.now();                 // захист від випадкового «подвійного» тапу
      box.onclick = (e) => { const b = e.target.closest("button[data-i]"); if (!b || performance.now() - t0 < 450) return; box.onclick = null; closeResolve = null;
        const A = API(); if (A.FX) A.FX.buzz("light"); box.innerHTML = ""; res(+b.dataset.i); };
    });
  }
  /* пройти діалог { n: [{ s, c? }] } */
  async function runDialog(dlg) {
    for (const node of dlg.n) {
      if (!isOpen()) return false;
      if (node.c && node.c.length) {
        const i = await ask(node.s, node.c.map((c) => c.t)); if (i === "closed") return false;
        const r = await say(node.c[i].r); if (r === "closed") return false;
      } else { const r = await say(node.s); if (r === "closed") return false; }
    }
    return true;
  }

  /* =========================================================== ПАНІКА ===== */
  const SUPREME = { id: "supreme" };
  async function panic() {
    const P = D().PANIC; if (!P) return;
    show(SUPREME);
    const st = await ask(pick(P.intro), P.states.map((s) => s.t), "hall__acts--list");
    if (st === "closed") return;
    const state = P.states[st];
    const A = API(); if (A.logPush) A.logPush({ k: "call", v: "supreme", d: A.todayKey(), st: state.id });
    const pool = P.dialogs.filter((d) => d.st === state.id);
    const dlg = fresh("panic." + state.id, pool, 3);
    if (dlg && !(await runDialog(dlg.v))) return;
    await toolsLoop(P);
  }
  async function toolsLoop(P) {
    for (;;) {
      if (!isOpen()) return;
      const T = P.tools;
      const tales = ((D().KEEPERS || {}).supreme || {}).tales || [];
      const opts = [T.wait, T.breath, T.stake].concat(tales.length ? [T.tale || "Розкажи історію"] : []).concat([T.done]);
      const i = await ask(P.ask, opts, "hall__acts--tools");
      if (i === "closed") return;
      if (i === 0) { if ((await watch(P)) === "closed") return; }
      else if (i === 1) { if ((await breathe(P)) === "closed") return; }
      else if (i === 2) { if ((await stake(P)) === "closed") return; }
      else if (i === 3 && tales.length) { show(SUPREME); if (!(await runDialog(fresh("tale.supreme", tales, 4).v))) return; }
      else { show(SUPREME); await say(fresh("bye", P.bye, 2).v); close(); return; }
    }
  }

  /* варта: 20 хвилин, храмовник на весь зріст */
  const WATCH_MS = 20 * 60 * 1000;
  function watch(P) {
    show(Object.assign({}, SUPREME, { kind: "full" }));
    hall.classList.add("hall--watch");
    const box = $("hallActs");
    return new Promise((res) => {
      closeResolve = (v) => { stop(); res(v); };
      const t0 = Date.now(); let lineIdx = -1, timer = null;
      $("hallBox").classList.remove("has-tap");
      box.className = "hall__acts hall__acts--watch";
      box.innerHTML = `<div class="hw"><svg class="hw__ring" viewBox="0 0 120 120"><circle class="hw__bg" cx="60" cy="60" r="54"/><circle class="hw__fg" id="hwFg" cx="60" cy="60" r="54" pathLength="1"/></svg><b id="hwT">20:00</b></div>
        <button type="button" data-end>Хвиля минула</button>`;
      const tick = () => {
        const left = Math.max(0, WATCH_MS - (Date.now() - t0)), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
        const tt = $("hwT"); if (tt) tt.textContent = `${m}:${String(s).padStart(2, "0")}`;
        const fg = $("hwFg"); if (fg) fg.style.strokeDashoffset = String(left / WATCH_MS);
        const li = Math.min(P.watch.length - 1, Math.floor((Date.now() - t0) / (WATCH_MS / P.watch.length)));
        if (li !== lineIdx) { lineIdx = li; type(P.watch[li]); }
        if (left <= 0) finish();
      };
      const stop = () => { clearInterval(timer); hall.classList.remove("hall--watch"); box.onclick = null; };
      const finish = async () => {
        stop(); closeResolve = null; box.innerHTML = "";
        const A = API(); if (A.FX) A.FX.play("ms", true); if (A.logPush) A.logPush({ k: "call", v: "supreme", d: A.todayKey(), st: "held" });
        show(SUPREME); const r = await say(P.watchDone); res(r);
      };
      box.onclick = (e) => { if (e.target.closest("[data-end]")) finish(); };
      timer = setInterval(tick, 1000); tick();
    });
  }
  /* дихання: 5 кіл 4–4–6 */
  function breathe(P) {
    show(SUPREME);
    const B = P.breath;
    return new Promise(async (res) => {
      let stopped = false; closeResolve = (v) => { stopped = true; res(v); };
      $("hallActs").innerHTML = ""; await type(B.intro);
      const box = $("hallActs"); box.className = "hall__acts hall__acts--breath";
      box.innerHTML = `<div class="hb"><svg class="hb__shield" id="hbS"><use href="#sigil"/></svg><b id="hbW"></b><span id="hbN"></span></div>`;
      const S = $("hbS"), W = $("hbW"), N = $("hbN");
      for (let c = 0; c < 5 && !stopped; c++) {
        N.textContent = `${c + 1} / 5`;
        S.className.baseVal = "hb__shield in"; W.textContent = B.in; await wait(4000); if (stopped) return;
        S.className.baseVal = "hb__shield hold"; W.textContent = B.hold; await wait(4000); if (stopped) return;
        S.className.baseVal = "hb__shield out"; W.textContent = B.out; await wait(6000);
      }
      if (stopped) return;
      closeResolve = null; box.innerHTML = ""; res(await say(B.done));
    });
  }
  /* що на кону */
  async function stake(P) {
    show(SUPREME);
    const A = API(), vows = (D().VOWS || []).map((v) => {
      const s = A.streak(v), nm = A.nextMilestone(s);
      return `<li><span class="hs__n">${esc(v.name)}</span><b>${s}</b><em>${nm ? `до ${nm} — ${nm - s}` : "усі віхи"}</em></li>`;
    }).join("");
    $("hallActs").innerHTML = "";
    await type(P.stake);
    if (!isOpen()) return "closed";
    const box = $("hallActs"); box.className = "hall__acts hall__acts--stake";
    box.innerHTML = `<ul class="hs">${vows}</ul>`;
    $("hallBox").classList.add("has-tap");
    return new Promise((res) => { closeResolve = res; onTap = () => { closeResolve = null; res("next"); }; });
  }

  /* ========================================================= ХРАНИТЕЛІ ===== */
  /* хранитель: слово → меню (що дає стрік · історія · розмова · ще слово) */
  const MENU_Q = ["Щось іще, брате?", "Я поруч. Що далі?", "Слухаю тебе.", "Питай — маємо час."];
  async function callKeeper(vowId) {
    const v = (D().VOWS || []).find((x) => x.id === vowId), k = (D().KEEPERS || {})[vowId]; if (!v || !k) return;
    show({ id: vowId, icon: v.icon });
    let lead = null;
    if (k.talks && k.talks.length && Math.random() < 0.3) {                 // інколи хранитель сам заводить розмову
      const t = fresh("talk." + vowId, k.talks, 3); if (!(await runDialog(t.v))) return;
    } else lead = fresh("keeper." + vowId, k.lines, 6).v;
    for (;;) {
      const opts = [];
      if (k.gains && k.gains.length) opts.push(["gain", "Що мені дає цей стрік?"]);
      if (k.tales && k.tales.length) opts.push(["tale", "Розкажи історію"]);
      if (k.talks && k.talks.length) opts.push(["talk", "Поговорімо"]);
      opts.push(["line", "Ще слово, брате"], ["bye", "Дякую, брате"]);
      const i = await ask(lead || pick(MENU_Q), opts.map((o) => o[1]), "hall__acts--list"); lead = null;
      if (i === "closed") return;
      const what = opts[i][0];
      if (what === "bye") { close(); return; }
      if (what === "line") { lead = fresh("keeper." + vowId, k.lines, 6).v; continue; }
      let ok = true;
      if (what === "gain") ok = await tellGain(v, k);
      if (what === "tale") ok = await runDialog(fresh("tale." + vowId, k.tales, 3).v);
      if (what === "talk") ok = await runDialog(fresh("talk." + vowId, k.talks, 3).v);
      if (!ok) return;
    }
  }
  /* що дає стрік: де ти вже є і що попереду */
  function gainAt(k, s) {
    const g = (k.gains || []).slice().sort((a, b) => a.d - b.d);
    let now = null, next = null; g.forEach((x) => { if (x.d <= s) now = x; else if (!next) next = x; });
    return { now, next };
  }
  async function tellGain(v, k) {
    const A = API(), s = A.streak ? A.streak(v) : 0, dw = A.daysWord || ((n) => "днів");
    const { now, next } = gainAt(k, s);
    if (now) { if ((await say(`Ти на ${s}-му дні. ${now.t}`)) === "closed") return false; }
    else if ((await say(`Ти на старті — день ${s}. Найважче якраз зараз, і саме тому кожен день важить удвічі.`)) === "closed") return false;
    if (next) { const n = next.d - s; if ((await say(`Ще ${n} ${dw(n)} — і ${next.d}-й день: ${next.t.charAt(0).toLowerCase() + next.t.slice(1)}`)) === "closed") return false; }
    else if ((await say("Далі вже не про тіло. Далі — про те, ким ти став. Тримай.")) === "closed") return false;
    return true;
  }
  /* після зриву — хранитель проти каскаду */
  async function fall(vowId) {
    const v = (D().VOWS || []).find((x) => x.id === vowId), k = (D().KEEPERS || {})[vowId]; if (!v || !k || !k.fall) return;
    show({ id: vowId, icon: v.icon });
    const r = await say(fresh("fall." + vowId, k.fall, 2).v); if (r === "closed") return;
    const i = await ask("І памʼятай: одне падіння — не причина для другого. Решта обітниць стоять.", ["Покликати Верховного", "Зрозумів"], "hall__acts--row");
    if (i === 0) { const P = D().PANIC; show(SUPREME); const dlg = fresh("panic.cascade", P.dialogs.filter((d) => d.st === "cascade"), 3);
      const A = API(); if (A.logPush) A.logPush({ k: "call", v: "supreme", d: A.todayKey(), st: "cascade" });
      if (dlg && await runDialog(dlg.v)) await toolsLoop(P); return; }
    close();
  }
  /* Капітул: відкриття цілей і вердикт після ревю. Місяць веде сенешаль, рік — Верховний */
  const fillDeep = (x, o) => typeof x === "string" ? x.replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : "")
    : Array.isArray(x) ? x.map((y) => fillDeep(y, o)) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fillDeep(v, o)])) : x;
  const chair = (kind) => kind === "y" ? SUPREME : Object.assign({ id: "seneschal", head: "plume" }, D().SENESCHAL || {});
  async function scene(who, key, list, o) {
    if (!list || !list.length) return;
    show(who);
    const dlg = fresh(key, list, Math.min(3, list.length - 1));
    if (dlg) await runDialog(fillDeep(dlg.v, o || {}));
    if (isOpen()) close();
  }
  function council(kind, o) { const C = D().COUNCIL || {}; return scene(chair(kind), "council." + kind, (C.open || {})[kind], o); }
  function verdict(kind, tier, o) { const C = D().COUNCIL || {}; return scene(chair(kind), "verdict." + kind + "." + tier, ((C.verdict || {})[kind] || {})[tier], o); }

  /* ранок: легендарна поява Верховного (діалог з варіантами) */
  async function morningSupreme() {
    const M = D().SUPREME_MORNING; if (!M) return;
    show(SUPREME);
    const dlg = fresh("morning", M, 4);
    if (dlg) await runDialog(dlg.v);
    if (isOpen()) close();
  }

  window.ORDO_HALL = { figure, panic, callKeeper, fall, morningSupreme, council, verdict, isOpen, close, fresh, gainAt };
})();
