/* ============================================================================
   ORDO — ворота і сховище.
   1) Вміст Ордену (обітниці, Кодекс, цитати, запечатаний сувій) лежить у
      публічному репозиторії лише як шифр — vault.json (AES-256-GCM).
      Ключ вмісту зберігається в приватному репозиторії; телефон отримує його
      один раз за токеном доступу GitHub і далі тримає в себе.
   2) Твої дані (літопис, цілі, рекорди) автоматично копіюються в приватний
      репозиторій, зашифровані ТВОЇМ ключем Ордену (PBKDF2-SHA256, 600 000
      ітерацій → AES-256-GCM). Ключ Ордену не покидає телефон: ні GitHub,
      ні будь-хто інший копію не прочитає.
   ========================================================================== */
(function () {
  "use strict";
  const REPO = "Cluckh/vows-private";
  const API = `https://api.github.com/repos/${REPO}/contents/`;
  const BRANCH = "main";                        // явно: основною в репозиторії може бути інша гілка
  const KDF_IT = 600000;
  const SYNC_EVERY = 20 * 1000;                 // поки додаток відкритий: що 20 с забрати чуже й віддати своє (лише якщо щось змінилось)

  const LS = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const K = { content: "ordo.k.content", backup: "ordo.k.backup", salt: "ordo.k.salt", token: "ordo.k.gh" };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------------------------------------------------------- крипто */
  const aesKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  async function seal(raw, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(raw), enc.encode(text));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function open(raw, box) {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, await aesKey(raw), unb64(box.ct));
    return dec.decode(pt);
  }
  async function derive(pass, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: KDF_IT }, base, 256));
  }

  /* ---------------------------------------------------------------- GitHub */
  const token = () => LS.get(K.token, "");
  async function gh(path, opt) {
    opt = opt || {};
    const r = await fetch(API + path + (opt.method === "PUT" ? "" : `?ref=${BRANCH}`), {
      method: opt.method || "GET", cache: "no-store",
      headers: Object.assign({ Authorization: `Bearer ${opt.token || token()}`, "X-GitHub-Api-Version": "2022-11-28",
        Accept: opt.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" }, opt.body ? { "Content-Type": "application/json" } : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
    if (r.status === 404) return null;
    if (!r.ok) { const e = new Error("gh " + r.status); e.status = r.status; throw e; }
    return opt.raw ? r.text() : r.json();
  }
  const shas = {};
  async function putFile(path, text, message) {
    const body = { message, content: b64(enc.encode(text)), branch: BRANCH };
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(path in shas)) { const m = await gh(path); shas[path] = m && m.sha; }
      if (shas[path]) body.sha = shas[path]; else delete body.sha;
      try { const res = await gh(path, { method: "PUT", body }); shas[path] = res.content.sha; return; }
      catch (e) { if ((e.status === 409 || e.status === 422) && attempt === 0) { delete shas[path]; continue; } throw e; }
    }
  }

  /* -------------------------------------------------------------- вміст */
  async function loadVault() {
    const r = await fetch("vault.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("vault " + r.status);
    return r.json();
  }
  async function unlockContent(vault) {
    const raw = LS.get(K.content, null); if (!raw) return null;
    try { return JSON.parse(await open(unb64(raw), vault)); } catch (e) { return null; }
  }

  /* ------------------------------------------- копії й синхронізація ----
     Кожен пристрій має свій підпис. Відкрив додаток → якщо в сховищі є свіжіша
     копія з ІНШОГО пристрою, вона підтягується (якщо тут теж були зміни —
     обʼєднується: літопис складається, цілі зливаються, рекорди — максимум).
     Змінив щось → копія відправляється за ~20 с (або одразу, коли згортаєш).
     Налаштування пристрою (звук, музика, сьогоднішній ритуал) не синхронізуються. */
  const LOCAL_ONLY = ["ordo.lastIntro", "ordo.qQueue", "ordo.qLast", "ordo.statsMode", "ordo.ver", "ordo.sound", "ordo.music"];
  const DATA_KEY = (k) => k.startsWith("ordo.") && !k.startsWith("ordo.k.") && !k.startsWith("ordo.bk.") && !LOCAL_ONLY.includes(k);
  function snapshot() {
    const o = {}, keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (DATA_KEY(k)) keys.push(k); }
    keys.sort().forEach((k) => { o[k] = localStorage.getItem(k); });
    return o;
  }
  const hasLocalData = () => !!(localStorage.getItem("ordo.log") || localStorage.getItem("ordo.goals") || localStorage.getItem("ordo.best"));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  const snapHash = () => hash(JSON.stringify(snapshot()));
  const day = (d) => { d = d || new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  function devId() { let d = LS.get("ordo.k.dev", ""); if (!d) { d = b64(crypto.getRandomValues(new Uint8Array(9))); LS.set("ordo.k.dev", d); } return d; }

  async function makeBackup() {
    const raw = LS.get(K.backup, null), salt = LS.get(K.salt, null);
    if (!raw || !salt) throw new Error("no backup key");
    const box = await seal(unb64(raw), JSON.stringify(snapshot())), at = new Date().toISOString();
    return { at, file: JSON.stringify({ ordo: "backup", v: 2, kdf: "PBKDF2-SHA256", it: KDF_IT, salt, iv: box.iv, ct: box.ct, at, dev: devId() }) };
  }
  async function readBackup(fileText, pass) {
    const f = JSON.parse(fileText);
    if (f.ordo !== "backup") throw new Error("not a backup");
    const raw = pass ? await derive(pass, unb64(f.salt)) : unb64(LS.get(K.backup, ""));
    const data = JSON.parse(await open(raw, f));
    return { data, raw, salt: f.salt, at: f.at, dev: f.dev };
  }
  function applyData(data) {
    const drop = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (DATA_KEY(k)) drop.push(k); }
    drop.forEach((k) => localStorage.removeItem(k));
    Object.keys(data).forEach((k) => { if (DATA_KEY(k)) localStorage.setItem(k, data[k]); });
  }
  /* обʼєднання, коли зміни були на обох пристроях: нічого не губимо */
  function mergeData(L, R) {
    const P = (o, k, f) => { try { return o[k] != null ? JSON.parse(o[k]) : f; } catch (e) { return f; } };
    const out = Object.assign({}, R, L);
    const seen = new Set(), log = [];
    [].concat(P(R, "ordo.log", []), P(L, "ordo.log", [])).forEach((e) => {
      const id = [e.k, e.v, e.d, e.ts, e.gid || ""].join("|"); if (!seen.has(id)) { seen.add(id); log.push(e); }
    });
    log.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    out["ordo.log"] = JSON.stringify(log);
    const sL = P(L, "ordo.starts", {}), sR = P(R, "ordo.starts", {}), st = Object.assign({}, sR, sL);
    Object.keys(sR).forEach((k) => { if (sL[k] && sR[k] > sL[k]) st[k] = sR[k]; });     // зрив зсуває старт уперед — пізніша дата свіжіша
    out["ordo.starts"] = JSON.stringify(st);
    const bL = P(L, "ordo.best", {}), bR = P(R, "ordo.best", {}), be = Object.assign({}, bR, bL);
    Object.keys(bR).forEach((k) => { be[k] = Math.max(bL[k] || 0, bR[k] || 0); });
    out["ordo.best"] = JSON.stringify(be);
    const gL = P(L, "ordo.goals", { y: {}, m: {} }), gR = P(R, "ordo.goals", { y: {}, m: {} }), g = { y: {}, m: {} };
    ["y", "m"].forEach((kind) => {
      const A = gL[kind] || {}, B = gR[kind] || {};
      new Set(Object.keys(A).concat(Object.keys(B))).forEach((key) => {
        const a = A[key], b = B[key]; if (!a || !b) { g[kind][key] = a || b; return; }
        const items = (a.items || []).slice(), ids = new Set(items.map((i) => i.id));
        (b.items || []).forEach((i) => { if (!ids.has(i.id)) items.push(i); });
        g[kind][key] = Object.assign({}, b, a, { items, res: a.res || b.res, skip: !!(a.skip && b.skip) });
      });
    });
    out["ordo.goals"] = JSON.stringify(g);
    Object.keys(out).forEach((k) => { if (out[k] == null) delete out[k]; });
    return out;
  }

  let busy = false;
  /* push: "now" — віддати, якщо є зміни; "force" — завжди */
  async function syncNow(push) {
    if (busy || !token() || !LS.get(K.backup, null)) return { pulled: false };
    busy = true; status("saving");
    let pulled = false;
    try {
      const last = LS.get("ordo.bk.last", {});
      const dirty = snapHash() !== last.h;
      const remote = await gh("backups/latest.json", { raw: true });
      if (remote) {
        const meta = JSON.parse(remote);
        if (meta.dev && meta.dev !== devId() && meta.at && (!last.remoteAt || meta.at > last.remoteAt)) {
          const r = await readBackup(remote, null);
          applyData(dirty ? mergeData(snapshot(), r.data) : r.data);
          pulled = true;
          LS.set("ordo.bk.last", { h: dirty ? "" : snapHash(), at: last.at || 0, remoteAt: meta.at });
          if (dirty) push = "force";                // обʼєднане одразу віддаємо іншим пристроям
        }
      }
      const cur = LS.get("ordo.bk.last", {}), changed = snapHash() !== cur.h;
      const due = push === "force" || changed;
      if (due) {
        const b = await makeBackup();
        await putFile("backups/latest.json", b.file, "копія");
        await putFile(`backups/${day()}.json`, b.file, "копія дня");
        LS.set("ordo.bk.last", { h: snapHash(), at: Date.now(), remoteAt: b.at });
      }
      LS.del("ordo.bk.err"); status("ok");
    } catch (e) {
      LS.set("ordo.bk.err", { at: Date.now(), code: e.status || 0 }); status("err");
    } finally { busy = false; }
    if (pulled && window.__ordoStarted) reloadWhenCalm();
    return { pulled };
  }
  const backupNow = () => syncNow("force");
  /* підтягнуті дані показуємо перезапуском — але не посеред дії */
  let reloadPending = false;
  const calm = () => { const a = document.activeElement, intro = $("intro");
    return (!intro || intro.hasAttribute("hidden")) && !document.querySelector(".sheet.open, .confirm.open, .rite.open") && !(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !a.classList.contains("hx-ovl")); };
  function reloadWhenCalm() { if (document.hidden || calm()) location.reload(); else reloadPending = true; }

  /* ---------------------------------------------------------------- ворота */
  function gate(html) {
    let g = $("gate");
    if (!g) { g = document.createElement("div"); g.id = "gate"; g.className = "gate"; document.body.appendChild(g); }
    g.innerHTML = `<div class="gate__in"><svg class="gate__sigil"><use href="#sigil"/></svg><div class="gate__title">Ворота Ордену</div>${html}</div>`;
    g.removeAttribute("hidden");
    return g;
  }
  const closeGate = () => { const g = $("gate"); if (g) g.remove(); };
  const msg = (t) => { const m = $("gtMsg"); if (m) { m.textContent = t || ""; m.hidden = !t; } };
  const btnBusy = (b, on, label) => { if (!b) return; b.disabled = on; if (label) b.textContent = label; };

  function stepToken(vault) {
    gate(`<p class="gate__lead">Вміст Ордену зашифровано. Щоб відчинити його на цьому телефоні й увімкнути автоматичні копії, встав токен доступу GitHub — один раз.</p>
      <label class="gate__f"><span>Токен доступу</span><input id="gtToken" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
      <p class="gate__msg" id="gtMsg" hidden></p>
      <button class="btn btn--gold" id="gtNext" type="button">Далі</button>`);
    const go = async () => {
      const t = ($("gtToken").value || "").trim(); if (!t) { $("gtToken").focus(); return; }
      const b = $("gtNext"); btnBusy(b, true, "Перевіряю…"); msg("");
      try {
        const key = await gh("vault.key", { raw: true, token: t });
        if (!key) throw Object.assign(new Error("nokey"), { status: 404 });
        const raw = unb64(key.trim());
        const data = JSON.parse(await open(raw, vault));
        LS.set(K.token, t); LS.set(K.content, b64(raw));
        const latest = await gh("backups/latest.json", { raw: true });
        stepPass(data, latest);
      } catch (e) {
        btnBusy(b, false, "Далі");
        msg(e.status === 401 ? "Токен не підходить або протермінований."
          : e.status === 404 || e.status === 403 ? "Немає доступу до сховища vows-private. Перевір, що токен має доступ саме до нього (Contents: Read and write)."
          : e instanceof TypeError ? "Немає зв'язку. Для першого входу потрібен інтернет." : "Не вдалося відчинити. Спробуй ще раз.");
      }
    };
    $("gtNext").addEventListener("click", go);
    $("gtToken").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }

  function stepPass(data, latest) {
    const exists = !!latest;
    let at = ""; try { at = exists ? new Date(JSON.parse(latest).at).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""; } catch (e) {}
    gate(exists
      ? `<p class="gate__lead">Знайдено зашифровану копію твоїх даних від <b>${esc(at)}</b>. Введи свій ключ Ордену.</p>
         <label class="gate__f"><span>Ключ Ордену</span><input id="gtPass" type="password" autocomplete="current-password"></label>`
      : `<p class="gate__lead">Придумай <b>ключ Ордену</b> — ним шифруються копії твоїх даних. Він лишається тільки на цьому телефоні. Запиши його в Паролі чи Нотатки: без нього копію не відкрити нікому, навіть тобі.</p>
         <label class="gate__f"><span>Ключ Ордену</span><input id="gtPass" type="password" autocomplete="new-password"></label>
         <label class="gate__f"><span>Ще раз</span><input id="gtPass2" type="password" autocomplete="new-password"></label>`) ;
    $("gate").querySelector(".gate__in").insertAdjacentHTML("beforeend", `<p class="gate__msg" id="gtMsg" hidden></p><button class="btn btn--gold" id="gtOpen" type="button">Відчинити</button>`);
    const go = async () => {
      const p = $("gtPass").value || "";
      if (!exists) {
        if (p.length < 8) { msg("Щонайменше 8 символів — краще кілька слів."); return; }
        if (p !== ($("gtPass2").value || "")) { msg("Ключі не збігаються."); return; }
      }
      const b = $("gtOpen"); btnBusy(b, true, "Відчиняю…"); msg("");
      try {
        if (exists) {
          const r = await readBackup(latest, p);
          LS.set(K.backup, b64(r.raw)); LS.set(K.salt, r.salt);
          applyData(hasLocalData() ? mergeData(snapshot(), r.data) : r.data);   // новий пристрій — усе з копії; є свої дані — обʼєднуємо
          LS.set("ordo.bk.last", { h: "", at: 0, remoteAt: r.at });
        } else {
          const salt = crypto.getRandomValues(new Uint8Array(16));
          LS.set(K.backup, b64(await derive(p, salt))); LS.set(K.salt, b64(salt));
        }
        closeGate(); start(data); syncNow("force");
      } catch (e) {
        btnBusy(b, false, "Відчинити");
        msg(exists ? "Ключ не підходить до цієї копії." : "Не вдалося. Спробуй ще раз.");
      }
    };
    $("gtOpen").addEventListener("click", go);
    $("gate").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") go(); });
  }

  /* ------------------------------------------------------------- сховище */
  let statusEl = null;
  function status(s) { if (statusEl) renderVault(); const ic = $("vaultBtn"); if (ic) ic.classList.toggle("is-err", s === "err" || !!LS.get("ordo.bk.err", null)); }
  const when = (ms) => { const d = new Date(ms), now = new Date(); const t = d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    return day(d) === day(now) ? `сьогодні о ${t}` : `${d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })} о ${t}`; };
  /* ------------------------------------------- вісті від храмовників (Web Push) --
     Телефон дає адресу для пушів; вона лягає в приватне сховище (push/<пристрій>.json),
     звідки храмовники за розкладом надсилають вісті. Ключ VAPID — публічний. */
  const VAPID = "BDgQcIZGuPq3BAL1TPuHIn1D1qvNMQqS1aID5slOlJ9pXEwg7-nJoTuCe-Ig8F6M7_XQxm5ab4OLdBbpaI2XXXQ";
  const unb64u = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const pushCan = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const pushFile = () => `push/${devId().replace(/[^a-z0-9]/gi, "")}.json`;
  const pushOn = () => pushCan() && Notification.permission === "granted" && !!LS.get("ordo.k.push", null);
  async function pushSave(sub) {
    const j = sub.toJSON();
    await putFile(pushFile(), JSON.stringify({ sub: j, ua: navigator.userAgent.slice(0, 160), at: new Date().toISOString() }, null, 1), "вісті: адреса пристрою");
    LS.set("ordo.k.push", { ep: j.endpoint, at: Date.now() });
  }
  async function pushEnable() {
    if (!pushCan()) { alert(standalone() ? "Цей пристрій не вміє приймати вісті." : "Вісті працюють лише в Ордені, відкритому з іконки на головному екрані."); return; }
    const perm = await Notification.requestPermission();      // має бути першим кроком після тапу
    if (perm !== "granted") { alert("Сповіщення не дозволені. Їх можна ввімкнути в Параметрах → Сповіщення → Vows."); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(VAPID) });
    await pushSave(sub);
  }
  async function pushDisable() {
    try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
    try { await putFile(pushFile(), JSON.stringify({ off: true, at: new Date().toISOString() }) + "\n", "вісті: вимкнено"); } catch (e) {}
    LS.del("ordo.k.push");
  }
  /* адреса пушів інколи змінюється — тихо оновлюємо її в сховищі */
  async function pushRefresh() {
    if (!pushOn() || !token()) return;
    try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); const was = LS.get("ordo.k.push", {});
      if (sub && sub.endpoint !== was.ep) await pushSave(sub); } catch (e) {}
  }
  function renderVault() {
    const box = $("vaultBody"); if (!box) return;
    const last = LS.get("ordo.bk.last", {}), err = LS.get("ordo.bk.err", null);
    const line = busy ? `<span class="vt-st">зберігаю…</span>`
      : err ? `<span class="vt-st is-err">${err.code === 401 ? "токен не підходить — онови його" : "не вдалося зберегти — спробую пізніше"}</span>`
      : last.at ? `<span class="vt-st is-ok">синхронізовано ${when(last.at)}</span>` : `<span class="vt-st">копій ще не було</span>`;
    box.innerHTML = `<p class="vt-lead">Твої дані автоматично синхронізуються між пристроями через приватне сховище — зашифровані твоїм ключем Ордену.</p>
      <div class="vt-row">${line}</div>
      <button class="btn btn--gold" type="button" data-vt="now">Синхронізувати зараз</button>
      <button class="btn btn--line" type="button" data-vt="list">Відновити з копії…</button>
      <div id="vtList"></div>
      <button class="btn btn--line" type="button" data-vt="file">Зберегти копію у файл</button>
      <label class="btn btn--ghost vt-file">Відновити з файлу<input type="file" accept=".json,application/json" id="vtImport" hidden></label>
      <div class="vt-push"><span class="vt-st ${pushOn() ? "is-ok" : ""}">${pushOn() ? "вісті від храмовників увімкнено" : "вісті від храмовників вимкнено"}</span>
        <button class="btn ${pushOn() ? "btn--ghost" : "btn--line"}" type="button" data-vt="${pushOn() ? "pushoff" : "push"}">${pushOn() ? "Вимкнути вісті" : "Увімкнути вісті від храмовників"}</button></div>
      <button class="btn btn--ghost" type="button" data-vt="token">Оновити токен</button>
      <button class="btn btn--ghost" type="button" data-vt="close">Закрити</button>`;
  }
  function openVault() {
    const m = $("vaultModal"); if (!m) return;
    statusEl = m; renderVault(); m.classList.add("open");
  }
  function closeVault() {
    const m = $("vaultModal"); if (m) m.classList.remove("open"); statusEl = null;
  }
  async function restoreFrom(text, label) {
    const r = await readBackup(text, null);
    if (!confirm(`Відновити дані з копії ${label}? Поточні дані на телефоні буде замінено.`)) return;
    applyData(r.data); location.reload();
  }
  function wireVault() {
    const m = $("vaultModal"); if (!m) return;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeVault(); });
    m.addEventListener("click", async (e) => {
      if (e.target === m) return closeVault();
      const a = e.target.closest("[data-vt]"), act = a && a.dataset.vt;
      if (act === "close") return closeVault();
      if (act === "now") { await syncNow("force"); return; }
      if (act === "push") { a.disabled = true; try { await pushEnable(); } catch (err) { alert("Не вдалося ввімкнути вісті: " + (err && err.message || err)); } renderVault(); return; }
      if (act === "pushoff") { a.disabled = true; await pushDisable(); renderVault(); return; }
      if (act === "token") {
        const t = prompt("Новий токен доступу GitHub:"); if (!t) return;
        try { await gh("vault.key", { raw: true, token: t.trim() }); LS.set(K.token, t.trim()); LS.del("ordo.bk.err"); await syncNow("force"); }
        catch (err) { alert("Токен не підходить."); }
        return;
      }
      if (act === "file") {
        const b = await makeBackup(), name = `orden-${day()}.json`;
        const file = new File([b.file], name, { type: "application/json" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "Копія Ордену" }); } catch (err) {} }
        else { const u = URL.createObjectURL(file), l = document.createElement("a"); l.href = u; l.download = name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
        return;
      }
      if (act === "list") {
        const box = $("vtList"); box.innerHTML = `<p class="vt-lead">Завантажую…</p>`;
        try {
          const ls = (await gh("backups")) || [];
          const days = ls.map((f) => f.name).filter((n) => /^\d{4}-\d\d-\d\d\.json$/.test(n)).sort().reverse().slice(0, 30);
          box.innerHTML = days.length ? `<ul class="vt-days">${days.map((n) => `<li><button type="button" data-day="${n}">${new Date(n.slice(0, 10) + "T12:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}</button></li>`).join("")}</ul>`
            : `<p class="vt-lead">Копій ще немає.</p>`;
        } catch (err) { box.innerHTML = `<p class="vt-lead">Не вдалося отримати список.</p>`; }
        return;
      }
      const d = e.target.closest("[data-day]");
      if (d) { try { const t = await gh("backups/" + d.dataset.day, { raw: true }); await restoreFrom(t, `від ${d.textContent}`); } catch (err) { alert("Не вдалося відкрити копію."); } }
    });
    m.addEventListener("change", async (e) => {
      if (e.target.id !== "vtImport" || !e.target.files[0]) return;
      try { await restoreFrom(await e.target.files[0].text(), "з файлу"); } catch (err) { alert("Цей файл не відкривається твоїм ключем Ордену."); }
      e.target.value = "";
    });
  }

  /* ---------------------------------------------------------------- старт */
  function start(data) {
    window.ORDO_DATA = data;
    if (typeof window.ORDO_START === "function") window.ORDO_START();
    const vb = $("vaultBtn"); if (vb) vb.addEventListener("click", openVault);
    wireVault(); status(); setTimeout(pushRefresh, 4000);
    setInterval(() => { if (!document.hidden) syncNow("now"); }, SYNC_EVERY);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (reloadPending) location.reload(); else syncNow("now"); }
      else if (reloadPending && calm()) location.reload();
      else syncNow("now");
    });
  }
  window.ORDO_VAULT = { backupNow, syncNow, open: openVault };

  async function boot() {
    let vault;
    try { vault = await loadVault(); }
    catch (e) { gate(`<p class="gate__lead">Не вдалося завантажити Орден. Перевір зʼєднання і відкрий знову.</p>`); return; }
    const data = await unlockContent(vault);
    if (data) {
      /* перед стартом — коротко підтягнути зміни з інших пристроїв (не довше 3 с) */
      if (token() && LS.get(K.backup, null) && navigator.onLine !== false) await Promise.race([syncNow("now"), new Promise((r) => setTimeout(r, 3000))]);
      start(data); return;
    }
    stepToken(vault);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
