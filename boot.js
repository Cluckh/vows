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
  /* strict: якщо файл тим часом змінив інший пристрій — не перезаписувати, а повернути конфлікт (його спершу треба злити) */
  async function putFile(path, text, message, strict) {
    const body = { message, content: b64(enc.encode(text)), branch: BRANCH };
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(path in shas)) { const m = await gh(path); shas[path] = m && m.sha; }
      if (shas[path]) body.sha = shas[path]; else delete body.sha;
      try { const res = await gh(path, { method: "PUT", body }); shas[path] = res.content.sha; return; }
      catch (e) {
        if (e.status === 409 || e.status === 422) { delete shas[path]; if (strict) throw Object.assign(new Error("conflict"), { conflict: true }); if (attempt === 0) continue; }
        throw e;
      }
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
  /* лише налаштування пристрою; усе інше — спільний стан Ордену (зокрема ранковий вступ і черга цитат: відкрив на телефоні — комп уже знає) */
  const LOCAL_ONLY = ["ordo.statsMode", "ordo.ver", "ordo.sound", "ordo.music"];
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
    const del = [...new Set([].concat(P(R, "ordo.logdel", []), P(L, "ordo.logdel", [])))].slice(-1500), gone = new Set(del), seen = new Set(), log = [];
    [].concat(P(R, "ordo.log", []), P(L, "ordo.log", [])).forEach((e) => {
      const id = [e.k, e.v, e.d, e.ts, e.gid || ""].join("|"); if (!seen.has(id) && !gone.has(id)) { seen.add(id); log.push(e); }      // видалене на будь-якому пристрої не воскресає
    });
    out["ordo.logdel"] = JSON.stringify(del);
    log.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    out["ordo.log"] = JSON.stringify(log);
    const sL = P(L, "ordo.starts", {}), sR = P(R, "ordo.starts", {}), st = Object.assign({}, sR, sL);
    Object.keys(sR).forEach((k) => { if (sL[k] && sR[k] > sL[k]) st[k] = sR[k]; });     // зрив зсуває старт уперед — пізніша дата свіжіша
    out["ordo.starts"] = JSON.stringify(st);
    const bL = P(L, "ordo.best", {}), bR = P(R, "ordo.best", {}), be = Object.assign({}, bR, bL);
    Object.keys(bR).forEach((k) => { be[k] = Math.max(bL[k] || 0, bR[k] || 0); });
    out["ordo.best"] = JSON.stringify(be);
    const gL = P(L, "ordo.goals", { y: {}, m: {} }), gR = P(R, "ordo.goals", { y: {}, m: {} }), g = { y: {}, m: {}, gone: Object.assign({}, gR.gone, gL.gone) };
    ["y", "m"].forEach((kind) => {
      const A = gL[kind] || {}, B = gR[kind] || {};
      new Set(Object.keys(A).concat(Object.keys(B))).forEach((key) => {
        const a = A[key], b = B[key]; if (!a || !b) { g[kind][key] = a || b; return; }
        const items = (a.items || []).slice(), at = new Map(items.map((i, n) => [i.id, n]));
        (b.items || []).forEach((i) => { if (!at.has(i.id)) items.push(i); else if ((i.mt || 0) > (items[at.get(i.id)].mt || 0)) items[at.get(i.id)] = i; });      // та сама ціль — новіша правка
        g[kind][key] = Object.assign({}, b, a, { items, res: a.res || b.res, skip: !!(a.skip && b.skip) });
      });
      Object.values(g[kind]).forEach((P2) => { if (P2 && P2.items) P2.items = P2.items.filter((i) => !g.gone[i.id]); });     // видалене на одному пристрої не воскресає
    });
    out["ordo.goals"] = JSON.stringify(g);
    /* День: цілі — новіша правка; відмітки — новіша за часом; квести — новіший стан; досвід і нагороди — обʼєднання */
    if (L["ordo.day"] || R["ordo.day"]) {
      const a = P(L, "ordo.day", {}), b = P(R, "ordo.day", {}), tasks = Object.assign({}, b.tasks, a.tasks), log = {};
      Object.keys(b.tasks || {}).forEach((id) => { const x = (a.tasks || {})[id], y = b.tasks[id]; if (x && (y.mt || 0) > (x.mt || 0)) tasks[id] = y; });
      new Set(Object.keys(a.log || {}).concat(Object.keys(b.log || {}))).forEach((k) => {
        const A2 = (a.log || {})[k] || {}, B2 = (b.log || {})[k] || {}; log[k] = Object.assign({}, B2, A2);
        Object.keys(B2).forEach((id) => { if (A2[id] && (B2[id].at || 0) > (A2[id].at || 0)) log[k][id] = B2[id]; });
      });
      const wake = Object.assign({}, b.wake, a.wake); Object.keys(b.wake || {}).forEach((k) => { if (a.wake && a.wake[k] && b.wake[k] < a.wake[k]) wake[k] = b.wake[k]; });   // підйом — найраніше відкриття
      const journal = Object.assign({}, b.journal, a.journal); Object.keys(b.journal || {}).forEach((k) => { if (a.journal && a.journal[k] && (b.journal[k].at || 0) > (a.journal[k].at || 0)) journal[k] = b.journal[k]; });
      const sleep = Object.assign({}, b.sleep, a.sleep), sv = (x) => (x && !x.skip ? 1e15 : 0) + ((x && x.at) || 0);       // ранковий звіт: заповнений сильніший за «не зараз», далі — новіший
      Object.keys(b.sleep || {}).forEach((k) => { if (a.sleep && a.sleep[k] && sv(b.sleep[k]) > sv(a.sleep[k])) sleep[k] = b.sleep[k]; });
      const night = Object.assign({}, b.night, a.night); Object.keys(b.night || {}).forEach((k) => { if (a.night && a.night[k] && (b.night[k].ts || 0) > (a.night[k].ts || 0)) night[k] = b.night[k]; });
      out["ordo.day"] = JSON.stringify(Object.assign({}, b, a, { tasks, log, wake, night, journal, sleep, ev: Object.assign({}, b.ev, a.ev) }));
    }
    if (L["ordo.quests"] || R["ordo.quests"]) {
      const a = P(L, "ordo.quests", {}), b = P(R, "ordo.quests", {}), by = {};
      [].concat(b.list || [], a.list || []).forEach((q) => { const o = by[q.id]; if (!o || (q.at || 0) >= (o.at || 0)) by[q.id] = q; });
      const clock = Object.assign({}, b.clock, a.clock); Object.keys(b.clock || {}).forEach((k) => { if (String(b.clock[k]) > String(clock[k] || "")) clock[k] = b.clock[k]; });
      const taken = new Set(Object.values(by).filter((q) => q.st !== "offer" && q.offerOn).map((q) => `${q.offerOn}|${q.rar}`));
      const offers = {}, list = Object.values(by).filter((q) => {
        if (q.st !== "offer") return true;
        if (taken.has(`${q.offerOn}|${q.rar}`)) return false;           // того дня цієї рідкості вже є прийнятий чи відхилений квест
        const k = `${q.offerOn}|${q.rar}`; if (offers[k] && offers[k] < q.id) return false; offers[k] = q.id; return true;
      }).filter((q) => q.st !== "offer" || offers[`${q.offerOn}|${q.rar}`] === q.id);
      out["ordo.quests"] = JSON.stringify({ list, clock, trig: [...new Set([].concat(a.trig || [], b.trig || []))] });
    }
    if (L["ordo.gold"] || R["ordo.gold"]) {            // золото: виведення й покупки — обʼєднуємо; «прийшло» сильніше за «скасовано», а те — за «в дорозі»
      const a = P(L, "ordo.gold", {}), b = P(R, "ordo.gold", {}), go = Object.assign({}, b.out, a.out), rk = { done: 3, cancel: 2, pending: 1 };
      Object.keys(b.out || {}).forEach((k) => { if (a.out && a.out[k] && (rk[b.out[k].st] || 0) > (rk[a.out[k].st] || 0)) go[k] = b.out[k]; });
      const un = (k) => Object.assign({}, b[k], a[k]), own = un("own"); Object.keys(b.own || {}).forEach((k) => { if (a.own && a.own[k] && b.own[k].at < a.own[k].at) own[k] = b.own[k]; });
      const eqs = (b.eqAt || 0) > (a.eqAt || 0) ? { eq: b.eq, eqAt: b.eqAt } : { eq: a.eq || b.eq || [], eqAt: a.eqAt || b.eqAt };
      out["ordo.gold"] = JSON.stringify(Object.assign({}, b, a, { out: go, inc: un("inc"), bon: un("bon"), proc: un("proc"), tk: un("tk"), use: un("use"), wk: un("wk"), own, starter: a.starter || b.starter,
        lv: Math.max(a.lv || 0, b.lv || 0) || undefined, ri: Math.max(a.ri || 0, b.ri || 0) || undefined }, eqs));
    }
    if (L["ordo.books"] || R["ordo.books"]) {          // книжки: опис — новіша правка; сторінка дня — новіший запис; поточна — новіший вибір
      const a = P(L, "ordo.books", {}), b = P(R, "ordo.books", {}), list = Object.assign({}, b.list, a.list), log = {};
      Object.keys(b.list || {}).forEach((id) => { if (a.list && a.list[id] && (b.list[id].mt || 0) > (a.list[id].mt || 0)) list[id] = b.list[id]; });
      new Set(Object.keys(a.log || {}).concat(Object.keys(b.log || {}))).forEach((d) => {
        const A2 = (a.log || {})[d] || {}, B2 = (b.log || {})[d] || {}; log[d] = Object.assign({}, B2, A2);
        Object.keys(B2).forEach((id) => { if (A2[id] && ((B2[id] || {}).at || 0) > ((A2[id] || {}).at || 0)) log[d][id] = B2[id]; });
      });
      const cur = (b.curAt || 0) > (a.curAt || 0) ? { cur: b.cur, curAt: b.curAt } : { cur: a.cur !== undefined ? a.cur : b.cur, curAt: a.curAt || b.curAt };
      out["ordo.books"] = JSON.stringify(Object.assign({}, b, a, { list, log }, cur));
    }
    if (L["ordo.xp"] || R["ordo.xp"]) {
      const a = P(L, "ordo.xp", {}), b = P(R, "ordo.xp", {});
      out["ordo.xp"] = JSON.stringify(Object.assign({}, b, a, { e: Object.assign({}, b.e, a.e), knighted: a.knighted || b.knighted }));
    }
    if (L["ordo.ach"] || R["ordo.ach"]) {
      const a = P(L, "ordo.ach", {}), b = P(R, "ordo.ach", {}), m = Object.assign({}, b, a);
      Object.keys(b).forEach((k) => { if (a[k] && b[k] < a[k]) m[k] = b[k]; });
      out["ordo.ach"] = JSON.stringify(m);
    }
    /* ранковий вступ — пізніша дата; тренування — новіший запис; рішення сторожі, вичерпані вікна, латки — обʼєднання */
    { const a = P(L, "ordo.lastIntro", ""), b = P(R, "ordo.lastIntro", ""); if (a || b) out["ordo.lastIntro"] = JSON.stringify(a > b ? a : b); }
    if (L["ordo.gym"] || R["ordo.gym"]) {
      const a = P(L, "ordo.gym", {}), b = P(R, "ordo.gym", {}), newer = (x, y) => (!x ? y : !y ? x : (y.at || 0) > (x.at || 0) ? y : x);
      const log = {}, w = {};
      new Set(Object.keys(a.log || {}).concat(Object.keys(b.log || {}))).forEach((k) => { log[k] = newer((a.log || {})[k], (b.log || {})[k]); });
      new Set(Object.keys(a.w || {}).concat(Object.keys(b.w || {}))).forEach((k) => { w[k] = newer((a.w || {})[k], (b.w || {})[k]); });
      out["ordo.gym"] = JSON.stringify(Object.assign({}, b, a, { log, w }));
    }
    if (L["ordo.bank"] || R["ordo.bank"]) { const a = P(L, "ordo.bank", {}), b = P(R, "ordo.bank", {}); out["ordo.bank"] = JSON.stringify(Object.assign({}, b, a, { seen: Object.assign({}, b.seen, a.seen) })); }
    ["ordo.spent"].forEach((k) => { if (L[k] || R[k]) out[k] = JSON.stringify(Object.assign({}, P(R, k, {}), P(L, k, {}))); });
    ["ordo.patches", "ordo.gpatches"].forEach((k) => { if (L[k] || R[k]) out[k] = JSON.stringify([...new Set([].concat(P(R, k, []), P(L, k, [])))]); });
    { const a = P(L, "ordo.since", ""), b = P(R, "ordo.since", ""); if (a || b) out["ordo.since"] = JSON.stringify(!a ? b : !b ? a : a < b ? a : b); }
    Object.keys(out).forEach((k) => { if (out[k] == null) delete out[k]; });
    return out;
  }

  let busy = false;
  /* push: "now" — віддати, якщо є зміни; "force" — завжди; "pull" — лише підтягнути (перед стартом, щоб не чекати збереження) */
  async function syncNow(push) {
    if (busy || !token() || !LS.get(K.backup, null)) return { pulled: false };
    busy = true; status("saving");
    let pulled = false; const pullOnly = push === "pull";
    try {
      for (let round = 0; round < 3; round++) {
        const last = LS.get("ordo.bk.last", {});
        const dirty = snapHash() !== last.h;
        const remote = await gh("backups/latest.json", { raw: true });
        if (remote) {
          const meta = JSON.parse(remote);
          if (meta.dev && meta.dev !== devId() && meta.at && (!last.remoteAt || meta.at > last.remoteAt)) {
            const r = await readBackup(remote, null);
            /* ніколи не замінюємо цілком: свіжіше з іншого пристрою перемагає в суперечках, але те, чого там ще немає, лишається */
            applyData(dirty ? mergeData(snapshot(), r.data) : mergeData(r.data, snapshot()));
            pulled = true;
            const merged = snapHash() !== hash(JSON.stringify(Object.fromEntries(Object.keys(r.data).filter(DATA_KEY).sort().map((k) => [k, r.data[k]]))));
            LS.set("ordo.bk.last", { h: merged ? "" : snapHash(), at: last.at || 0, remoteAt: meta.at });
            if (merged && !pullOnly) push = "force";             // обʼєднане одразу віддаємо іншим пристроям (у режимі pull — наступним, фоновим синком)
          }
        }
        const cur = LS.get("ordo.bk.last", {}), changed = snapHash() !== cur.h;
        if (pullOnly || !(push === "force" || changed)) break;
        const b = await makeBackup();
        try { await putFile("backups/latest.json", b.file, "копія", true); }
        catch (e) { if (e.conflict) continue; throw e; }                      // інший пристрій щойно зберіг — спершу зливаємо його копію
        const dk = LS.get("ordo.bk.day", {});                                // копія дня — не частіше, ніж раз на 30 хв (історія, а не синхронізація)
        if (dk.d !== day() || Date.now() - (dk.at || 0) > 30 * 60e3) { await putFile(`backups/${day()}.json`, b.file, "копія дня"); LS.set("ordo.bk.day", { d: day(), at: Date.now() }); }
        LS.set("ordo.bk.last", { h: snapHash(), at: Date.now(), remoteAt: b.at });
        break;
      }
      LS.del("ordo.bk.err"); status("ok");
    } catch (e) {
      LS.set("ordo.bk.err", { at: Date.now(), code: e.status || 0 }); status("err");
    } finally { busy = false; }
    if (pulled && window.__ordoStarted) reloadWhenCalm();          // зокрема передстартовий pull, що не встиг до старту
    return { pulled };
  }
  const backupNow = () => syncNow("force");
  /* підтягнуті дані показуємо перезапуском — але не посеред дії */
  let reloadPending = false;
  function reloadWhenCalm() { if (document.hidden) location.reload(); else { reloadPending = true; guardWrites(); } }      // на очах не перезавантажуємо — коли згорнеш
  /* до перезапуску модулі тримають у памʼяті старий стан: кожен їхній запис зливаємо з щойно підтягнутим, а не затираємо його */
  let guarded = false;
  function guardWrites() {
    if (guarded) return; guarded = true;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === localStorage && reloadPending && DATA_KEY(k) && k !== "ordo.logdel") {
        const cur = localStorage.getItem(k), del = localStorage.getItem("ordo.logdel");
        if (cur != null && cur !== v) { try { const m = mergeData({ [k]: v, "ordo.logdel": del }, { [k]: cur, "ordo.logdel": del }); if (m[k] != null) v = m[k]; } catch (e) {} }
      }
      return set.call(this, k, v);
    };
  }

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
  /* діагностика для відправника: версія service worker, додатка й останній виклик */
  async function diag() {
    let sw = ""; try { sw = (await caches.keys()).filter((k) => /^ordo-v\d+$/.test(k)).join(","); } catch (e) {}
    /* для глашатая: дати найближчих віх (сьогоднішня теж) і чи є цілі місяця — без літопису */
    const A = window.ORDO_API, next = [], ky = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try { const t = new Date();
      A.D.VOWS.forEach((v) => { const st = A.streak(v), m = (A.D.MILESTONES || []).find((x) => x >= st); if (m) next.push({ v: v.id, n: m, d: ky(new Date(t.getFullYear(), t.getMonth(), t.getDate() + m - st)) }); }); } catch (e) {}
    const G = LS.get("ordo.goals", {}), P = G.m && G.m[ky(new Date()).slice(0, 7)];
    return { sw, app: LS.get("ordo.ver", ""), call: LS.get("ordo.k.call", null), trace: LS.get("ordo.k.trace", []), errs: LS.get("ordo.k.errs", []), next, gm: P ? { n: P.items.length, done: !!P.res } : null };
  }
  async function pushSave(sub) {
    const j = sub.toJSON(), dg = await diag();
    await putFile(pushFile(), JSON.stringify({ sub: j, ua: navigator.userAgent.slice(0, 160), at: new Date().toISOString(), diag: dg }, null, 1), "вісті: адреса пристрою");
    LS.set("ordo.k.push", { ep: j.endpoint, at: Date.now(), dg: JSON.stringify(dg) });
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
      if (sub && (sub.endpoint !== was.ep || JSON.stringify(await diag()) !== was.dg)) await pushSave(sub); } catch (e) {}
  }
  /* скринька вістей: глашатай кладе кожну вість у push/inbox.json — Орден сам її забирає при відкритті.
     Не залежить від того, чи iOS передав виклик зі сповіщення */
  let inboxAt = 0;
  async function checkInbox() {
    if (!token() || Date.now() - inboxAt < 15000) return; inboxAt = Date.now();
    try {
      const box = JSON.parse((await gh("push/inbox.json", { raw: true })) || "{}"), seen = LS.get("ordo.k.inbox", 0);
      const it = (box.items || []).filter((x) => x.url && x.url.includes("call=") && x.at > seen && Date.now() - x.at < 12 * 3600e3).sort((a, b) => b.at - a.at)[0];
      if (!it) return;
      LS.set("ordo.k.inbox", it.at);
      const url = new URL(it.url, location.href).href;
      LS.set("ordo.k.pending", { url, at: it.at, via: "inbox" });
      if (window.ORDO_API && window.ORDO_API.pendingCall) window.ORDO_API.pendingCall();
    } catch (e) {}
  }
  /* пульс: коли востаннє відпрацювала кожна ланка (писар, скарбниця, глашатай, здоровʼя, покер) */
  let herald = null, heraldAt = 0;
  function pulseHTML() {
    const now = Date.now(), t = day(), y = day(new Date(now - 864e5)), hr = new Date().getHours() * 60 + new Date().getMinutes();
    const ago = (iso) => { if (!iso) return null; const m = Math.round((now - Date.parse(iso)) / 6e4); return m < 60 ? `${m} хв тому` : m < 48 * 60 ? `${Math.round(m / 60)} год тому` : `${Math.round(m / 1440)} дн. тому`; };
    const age = (iso) => iso ? (now - Date.parse(iso)) / 36e5 : Infinity;
    const row = (name, ok, txt, warn) => `<li class="vt-p ${ok ? "is-ok" : warn ? "is-warn" : "is-err"}"><b>${name}</b><span>${txt}</span></li>`;
    const drop = LS.get("ordo.k.drop", null), bank = LS.get("ordo.k.bank", null), hl = LS.get("ordo.k.health", null), pk = LS.get("ordo.k.poker", null);
    const d = herald && herald.done ? herald.done : null;
    const mDue = hr >= 13 * 60, eDue = hr >= 22 * 60 + 30;
    const hOk = d && (!mDue || d[`${t}:morning`]) && (eDue ? d[`${t}:evening`] : d[`${y}:evening`]);
    return `<div class="vt-h">Пульс Ордену</div><ul class="vt-pulse">
      ${row("Писар", age(drop && drop.at) < 30, drop && drop.at ? `останній запис ${ago(drop.at)}` : "ще не писав", age(drop && drop.at) < 54)}
      ${row("Скарбниця", age(bank && bank.at) < 8, bank && bank.at ? `виписка ${ago(bank.at)}` : "виписки ще немає", age(bank && bank.at) < 26)}
      ${row("Глашатай", !!hOk, !d ? "перевіряю…" : `ранок ${d[`${t}:morning`] ? "✓" : mDue ? "✗" : "—"} · вечір ${eDue ? (d[`${t}:evening`] ? "✓" : "✗") : (d[`${y}:evening`] ? "✓ учора" : "✗ учора")}`, !d)}
      ${row("Здоровʼя", age(hl && hl.at) < 30, hl && hl.at ? `дані ${ago(hl.at)}` : "даних ще немає", age(hl && hl.at) < 54)}
      ${row("Покер", true, pk && pk.at ? `дані ${ago(pk.at)}` : "даних ще немає")}
    </ul>`;
  }
  async function loadHerald() {
    if (Date.now() - heraldAt < 10 * 60e3) return; heraldAt = Date.now();
    try { const txt = await gh("push/state.json", { raw: true }); herald = txt ? JSON.parse(txt) : null; if (statusEl) renderVault(); } catch (e) {}
  }
  function renderVault() {
    const box = $("vaultBody"); if (!box) return; loadHerald();
    const last = LS.get("ordo.bk.last", {}), err = LS.get("ordo.bk.err", null);
    const line = busy ? `<span class="vt-st">зберігаю…</span>`
      : err ? `<span class="vt-st is-err">${err.code === 401 ? "токен не підходить — онови його" : "не вдалося зберегти — спробую пізніше"}</span>`
      : last.at ? `<span class="vt-st is-ok">синхронізовано ${when(last.at)}</span>` : `<span class="vt-st">копій ще не було</span>`;
    box.innerHTML = `<p class="vt-lead">Твої дані автоматично синхронізуються між пристроями через приватне сховище — зашифровані твоїм ключем Ордену.</p>
      <div class="vt-row">${line}</div>
      ${pulseHTML()}
      <button class="btn btn--gold" type="button" data-vt="now">Синхронізувати зараз</button>
      <button class="btn btn--line" type="button" data-vt="list">Відновити з копії…</button>
      <div id="vtList"></div>
      <button class="btn btn--line" type="button" data-vt="file">Зберегти копію у файл</button>
      <label class="btn btn--ghost vt-file">Відновити з файлу<input type="file" accept=".json,application/json" id="vtImport" hidden></label>
      <div class="vt-push"><span class="vt-st ${pushOn() ? "is-ok" : ""}">${pushOn() ? "вісті від храмовників увімкнено" : "вісті від храмовників вимкнено"}</span>
        <button class="btn ${pushOn() ? "btn--ghost" : "btn--line"}" type="button" data-vt="${pushOn() ? "pushoff" : "push"}">${pushOn() ? "Вимкнути вісті" : "Увімкнути вісті від храмовників"}</button></div>
      <button class="btn btn--ghost" type="button" data-vt="token">Оновити токен</button>
      ${token() ? `<button class="btn btn--ghost" type="button" data-vt="copytok">Токен для «Швидких команд»</button>` : ""}
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
      if (act === "copytok") {
        try { await navigator.clipboard.writeText(token()); a.textContent = "Скопійовано — встав у команду після «Bearer »"; }
        catch (err) { prompt("Скопіюй токен:", token()); }
        return;
      }
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
    wireVault(); status(); setTimeout(pushRefresh, 4000); setTimeout(checkInbox, 1200);
    setInterval(() => { if (!document.hidden) syncNow("now"); }, SYNC_EVERY);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) setTimeout(checkInbox, 600);
      if (document.hidden) { if (reloadPending) location.reload(); else syncNow("now"); }
      else syncNow("now");
    });
  }
  /* зашифровані ключем сховища файли приватного репозиторію (скарбниця, писар): прочитати / записати */
  async function readSealed(path) {
    const raw = LS.get(K.content, null); if (!raw || !token()) return null;
    const txt = await gh(path, { raw: true }); if (!txt) return null;
    return JSON.parse(await open(unb64(raw), JSON.parse(txt)));
  }
  /* зашифрована картинка (арти реліквій, сцен): { mime, iv, ct } → Blob; null, якщо файлу нема */
  async function readSealedBlob(path) {
    const raw = LS.get(K.content, null); if (!raw || !token()) return null;
    const txt = await gh(path, { raw: true }); if (!txt) return null;
    const f = JSON.parse(txt), pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(f.iv) }, await aesKey(unb64(raw)), unb64(f.ct));
    return new Blob([pt], { type: f.mime || "image/jpeg" });
  }
  async function writeSealed(path, obj, message) {
    const raw = LS.get(K.content, null); if (!raw || !token()) return false;
    const box = await seal(unb64(raw), JSON.stringify(obj));
    await putFile(path, JSON.stringify({ v: 1, alg: "AES-256-GCM", iv: box.iv, ct: box.ct }) + "\n", message || "дані");
    return true;
  }
  /* попросити сховище оновитися (repository_dispatch): напр. свіжу виписку банку, коли Орден відкрито */
  async function dispatch(type, payload) {
    if (!token()) return false;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, { method: "POST",
        headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: JSON.stringify(payload ? { event_type: type, client_payload: payload } : { event_type: type }) });
      return r.status === 204;
    } catch (e) { return false; }
  }
  window.ORDO_VAULT = { backupNow, syncNow, open: openVault, pushDiag: () => setTimeout(pushRefresh, 1500), readSealed, readSealedBlob, writeSealed, dispatch };

  async function boot() {
    let vault;
    try { vault = await loadVault(); }
    catch (e) { gate(`<p class="gate__lead">Не вдалося завантажити Орден. Перевір зʼєднання і відкрий знову.</p>`); return; }
    const data = await unlockContent(vault);
    if (data) {
      /* перед стартом — лише підтягнути зміни з інших пристроїв (один запит, не довше 3,5 с): вступ, квести й цитати вже будуть спільні */
      if (token() && LS.get(K.backup, null) && navigator.onLine !== false) await Promise.race([syncNow("pull"), new Promise((r) => setTimeout(r, 3500))]);
      start(data); setTimeout(() => syncNow("now"), 2500);      // збереження — уже у фоні, коли Орден відкритий
      return;
    }
    stepToken(vault);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
