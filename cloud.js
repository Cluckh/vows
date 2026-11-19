/* ============================================================================
   ORDO_CLOUD — синхронізація через базу Supabase (з 19.11.2026).
   Модулі Ордену й далі працюють із localStorage; тут кожен ключ даних розкладається на дрібні записи
   (справа дня, запис книги досвіду, квест, ціль, рух золота…) і кожен змінений запис за ~0,5 с їде в таблицю docs.
   Інші пристрої отримують його живою підпискою (realtime) — без опитувань і без злиття цілих знімків.
   «Один показ»: claim(key) — атомарний запис у таблицю claims; перший пристрій виграє, решта бачить «уже показано».
   Приватність — гібрид: числа й стани відкрито під акаунтом власника (захист рядків RLS), а тексти сповідей,
   нічної варти, імена Вигнаних і коментарі шифруються ключем Ордену (той самий, що й увесь вміст) ще на пристрої.
   ========================================================================== */
(function () {
  "use strict";
  const URL0 = "https://auqvqwgmywrlnrqjgpht.supabase.co";
  const KEY0 = "sb_publishable_KQnzz5cbLPRjNGg3lmkntA_e-MGXtzL";
  const rawSet = Storage.prototype.setItem, rawGet = Storage.prototype.getItem, rawDel = Storage.prototype.removeItem;   // до перехоплень boot.js
  const get = (k, f) => { try { const v = rawGet.call(localStorage, k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } };
  const put = (k, v) => { try { rawSet.call(localStorage, k, JSON.stringify(v)); } catch (e) {} };
  const LOCAL_ONLY = ["ordo.statsMode", "ordo.ver", "ordo.sound", "ordo.music"];
  const DATA_KEY = (k) => k.startsWith("ordo.") && !k.startsWith("ordo.k.") && !k.startsWith("ordo.bk.") && !LOCAL_ONLY.includes(k);
  const dev = () => { let d = get("ordo.k.dev", ""); if (!d) { d = Math.random().toString(36).slice(2, 12); put("ordo.k.dev", d); } return d; };

  /* ----------------------------------------------------- розкладання на записи
     число — скільки рівнів словника розкладати в окремі записи; "id" — масив обʼєктів за полем id (порядок у _o);
     "period" — цілі: період → метадані + кожна ціль окремо. Усе, чого нема в схемі, — один запис на поле */
  const SPLIT = {
    "ordo.day": { tasks: 1, log: 2, wake: 1, sleep: 1, night: 1, journal: 1, ev: 1, mom: 1, lt: 1, heard: 1, arch: 1, pick: 1, loh: 1, ban: 1 },
    "ordo.quests": { list: "id", clock: 1, tdone: 1 },
    "ordo.xp": { e: 1 },
    "ordo.gold": { out: 1, inc: 1, bon: 1, proc: 1, tk: 1, use: 1, wk: 1, uns: 1, own: 1, elix: 1 },
    "ordo.goals": { y: "period", m: "period", gone: 1 },
    "ordo.exiles": { list: 1 },
    "ordo.books": { list: 1, log: 2 },
    "ordo.lib": { games: 1, books: 1 },
    "ordo.arm": { ex: 1 },
    "ordo.gym": { log: 1, w: 1, cd: 1 },
    "ordo.bank": { seen: 1 },
    "ordo.log": "list", "ordo.logdel": "set",
    "ordo.calls": 1, "ordo.starts": 1, "ordo.best": 1, "ordo.ach": 1, "ordo.spent": 1
  };
  const enc = (s) => encodeURIComponent(String(s)).replace(/\./g, "%2E");
  const dec = (s) => decodeURIComponent(s);
  const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
  const logId = (e) => [e.k, e.v, e.d, e.ts, e.gid || ""].join("|");
  function flatten(key, str) {
    const out = new Map(); let v; try { v = JSON.parse(str); } catch (e) { out.set(key, { $raw: str }); return out; }     // не JSON — як є
    const sp = SPLIT[key];
    const down = (p, val, n) => { if (n <= 0 || !plain(val)) { out.set(p, val); return; } out.set(p + "/~", 1); for (const k in val) down(p + "/" + enc(k), val[k], n - 1); };
    if (sp === "list" && Array.isArray(v)) { out.set(key + "/~", "list"); v.forEach((x, i) => out.set(key + "/" + enc(plain(x) ? logId(x) : String(x)), plain(x) ? Object.assign({}, x, { _o: i }) : x)); return out; }
    if (sp === "set" && Array.isArray(v)) { out.set(key + "/~", "set"); v.forEach((x) => out.set(key + "/" + enc(x), 1)); return out; }
    if (typeof sp === "number") { down(key, v, sp); return out; }
    if (!plain(sp) || !plain(v)) { out.set(key, v); return out; }
    out.set(key + "/~", 1);
    for (const f in v) {
      const r = sp[f], p = key + "/" + enc(f), val = v[f];
      if (r === "id" && Array.isArray(val)) { out.set(p + "/~", "id"); val.forEach((x, i) => { if (plain(x) && x.id != null) out.set(p + "/" + enc(x.id), Object.assign({}, x, { _o: i })); }); }
      else if (r === "period" && plain(val)) {
        out.set(p + "/~", 1);
        for (const per in val) { const P = val[per], pp = p + "/" + enc(per);
          if (!plain(P)) { out.set(pp, P); continue; }
          const meta = Object.assign({}, P); delete meta.items; out.set(pp + "/meta", meta);
          (Array.isArray(P.items) ? P.items : []).forEach((x, i) => { if (plain(x) && x.id != null) out.set(pp + "/i/" + enc(x.id), Object.assign({}, x, { _o: i })); }); }
      }
      else if (typeof r === "number") down(p, val, r);
      else out.set(p, val);
    }
    return out;
  }
  function unflatten(key, map) {
    if (map.has(key)) { const v = map.get(key); return plain(v) && typeof v.$raw === "string" ? v.$raw : JSON.stringify(v); }
    const sp = SPLIT[key], rows = [...map.entries()].filter(([p]) => p.startsWith(key + "/")).map(([p, v]) => [p.slice(key.length + 1).split("/").map(dec), v]);
    if (!rows.length) return null;
    const marker = map.get(key + "/~");
    if (marker === "list") return JSON.stringify(rows.filter(([s]) => s[0] !== "~").map(([, v]) => v).sort((a, b) => (a && a._o) - (b && b._o) || (a.ts || 0) - (b.ts || 0)).map((x) => { if (plain(x)) { const y = Object.assign({}, x); delete y._o; return y; } return x; }));
    if (marker === "set") return JSON.stringify(rows.filter(([s]) => s[0] !== "~").map(([s]) => s[0]));
    const root = {};
    const setAt = (o, segs, v) => { let c = o; for (let i = 0; i < segs.length - 1; i++) { if (!plain(c[segs[i]])) c[segs[i]] = {}; c = c[segs[i]]; } c[segs[segs.length - 1]] = v; };
    const ensure = (o, segs) => { let c = o; for (const s of segs) { if (!plain(c[s])) c[s] = {}; c = c[s]; } };
    const lists = {}, periods = {};
    for (const [s, v] of rows) {
      if (s[s.length - 1] === "~") { if (s.length > 1) { const f = s[0], r = plain(sp) ? sp[f] : null; if (r === "id") lists[f] = lists[f] || []; else ensure(root, s.slice(0, -1)); } continue; }
      const f = s[0], r = plain(sp) ? sp[f] : null;
      if (r === "id") { (lists[f] = lists[f] || []).push(v); continue; }
      if (r === "period" && s.length >= 3) { const per = s[1], P = (periods[f] = periods[f] || {})[per] = periods[f][per] || { meta: null, items: [] }; if (s[2] === "meta") P.meta = v; else if (s[2] === "i") P.items.push(v); continue; }
      setAt(root, s, v);
    }
    for (const f in lists) root[f] = lists[f].filter(plain).sort((a, b) => (a._o || 0) - (b._o || 0)).map((x) => { const y = Object.assign({}, x); delete y._o; return y; });
    for (const f in periods) { root[f] = root[f] && plain(root[f]) ? root[f] : {}; for (const per in periods[f]) { const P = periods[f][per];
      root[f][per] = Object.assign({}, P.meta || {}, { items: P.items.filter(plain).sort((a, b) => (a._o || 0) - (b._o || 0)).map((x) => { const y = Object.assign({}, x); delete y._o; return y; }) }); } }
    return JSON.stringify(root);
  }

  /* ----------------------------------------------------- шифрування текстів (гібрид) */
  const SENS = [[/^ordo\.day\/journal\/[^/]+$/, ["text"]], [/^ordo\.day\/night\/[^/]+$/, ["text", "topic", "dealt"]], [/^ordo\.exiles\/list\/[^/]+$/, ["n"]],
    [/^ordo\.lib\/(games|books)\/[^/]+$/, ["cm"]], [/^ordo\.books\/list\/[^/]+$/, ["cm"]]];
  let ckey = null;
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function key() { if (ckey) return ckey; const raw = get("ordo.k.content", null); if (!raw) return null; ckey = await crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]); return ckey; }
  async function sealVal(path, v) {
    const r = SENS.find(([re]) => re.test(path)); if (!r || !plain(v)) return v; const k = await key(); if (!k) return v;
    const o = Object.assign({}, v);
    for (const f of r[1]) if (typeof o[f] === "string" && o[f]) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(o[f]))); o[f] = { $e: b64(iv) + "." + b64(ct) }; }
    return o;
  }
  async function openVal(v) {
    if (!plain(v)) return v; let k = null, o = v;
    for (const f in v) if (plain(v[f]) && typeof v[f].$e === "string") {
      k = k || await key(); if (!k) continue; if (o === v) o = Object.assign({}, v);
      try { const [iv, ct] = v[f].$e.split("."); o[f] = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, k, unb64(ct))); } catch (e) { o[f] = ""; }
    }
    return o;
  }

  /* ----------------------------------------------------- стан синку */
  let sb = null, user = null, active = false, chan = null, status = "off", lastErr = "";
  const cache = {};                                  // ключ → Map(шлях → значення), яке вже є на сервері (чи щойно туди поїхало)
  const pend = new Map(get("ordo.k.cloud.pend", []));        // шлях → { v, del } — ще не дійшло (офлайн, помилка)
  const savePend = () => put("ordo.k.cloud.pend", [...pend.entries()]);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let lastTs = get("ordo.k.cloud.ts", "");
  const keyOf = (p) => p.split("/")[0];
  const emit = (keys) => { try { window.dispatchEvent(new CustomEvent("ordo-cloud", { detail: { keys } })); } catch (e) {} };

  function client() {
    if (sb) return sb; if (!window.supabase || !window.supabase.createClient) return null;
    sb = window.supabase.createClient(URL0, KEY0, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "ordo.k.sbauth", detectSessionInUrl: true }, realtime: { params: { eventsPerSecond: 20 } } });
    return sb;
  }
  function localKeys() { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (DATA_KEY(k)) ks.push(k); } return ks; }

  /* локальна зміна ключа → різниця з тим, що вже на сервері → черга відправки */
  const dirty = new Set(); let dirtyT = 0, sending = false;
  function onSet(k) { if (!active || !DATA_KEY(k)) return; dirty.add(k); clearTimeout(dirtyT); dirtyT = setTimeout(sendDirty, 350); }
  function diffKey(k) {
    const str = rawGet.call(localStorage, k), now = str == null ? new Map() : flatten(k, str), old = cache[k] || new Map();
    for (const [p, v] of now) if (!old.has(p) || !eq(old.get(p), v)) pend.set(p, { v });
    for (const [p] of old) if (!now.has(p)) pend.set(p, { del: true });
    cache[k] = now;
  }
  async function sendDirty() {
    if (!active) return;
    if (sending) { clearTimeout(dirtyT); dirtyT = setTimeout(sendDirty, 300); return; }
    [...dirty].forEach((k) => diffKey(k)); dirty.clear(); savePend();
    if (!pend.size) return;
    sending = true; status = "saving"; emit([]);
    try {
      const items = [...pend.entries()], d = dev();
      for (let i = 0; i < items.length; i += 400) {
        const part = items.slice(i, i + 400);
        const rows = await Promise.all(part.map(async ([p, x]) => ({ user_id: user.id, path: p, val: x.del ? null : await sealVal(p, x.v), del: !!x.del, dev: d })));
        const { error } = await sb.from("docs").upsert(rows, { onConflict: "user_id,path", returning: "minimal" });
        if (error) throw error;
        part.forEach(([p, x]) => { if (pend.get(p) === x) pend.delete(p); });
      }
      savePend(); status = "ok"; lastErr = "";
    } catch (e) { status = "err"; lastErr = (e && e.message) || String(e); setTimeout(() => onSet("ordo.day"), 15000); }
    finally { sending = false; emit([]); }
  }

  /* записи з сервера → localStorage (без перехоплень) → подія для застосунку */
  const canon = (x) => JSON.stringify(x, (k, v) => (plain(v) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v));
  async function applyRows(rows) {
    const touched = new Set(), d = dev();
    for (const r of rows) {
      if (r.ts && r.ts > lastTs) lastTs = r.ts;
      if (r.dev === d) continue;                               // власний запис, що повернувся з бази: він уже тут
      if (pend.has(r.path)) continue;                          // своя ще не відправлена зміна сильніша
      const k = keyOf(r.path); if (!DATA_KEY(k)) continue;
      const m = cache[k] || (cache[k] = new Map());
      if (r.del) { if (m.has(r.path)) { m.delete(r.path); touched.add(k); } continue; }
      const v = await openVal(r.val);
      if (!m.has(r.path) || !eq(m.get(r.path), v)) { m.set(r.path, v); touched.add(k); }
    }
    put("ordo.k.cloud.ts", lastTs);
    const changed = [];
    for (const k of touched) {
      const s = unflatten(k, cache[k]), cur = rawGet.call(localStorage, k);
      if (s == null) { if (cur != null) { rawDel.call(localStorage, k); changed.push(k); } continue; }
      let same = s === cur; if (!same && cur != null) { try { same = canon(JSON.parse(s)) === canon(JSON.parse(cur)); } catch (e) {} }     // той самий зміст в іншому порядку полів — не зміна
      if (!same) { rawSet.call(localStorage, k, s); changed.push(k); }
    }
    if (changed.length) emit(changed);
    return changed;
  }
  async function pullSince(ts) {
    const all = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from("docs").select("path,val,del,ts,dev").order("ts", { ascending: true }).range(from, from + 999);
      if (ts) q = q.gt("ts", ts);
      const { data, error } = await q; if (error) throw error;
      all.push(...data); if (data.length < 1000) break;
    }
    return all;
  }
  let catching = null, caughtAt = 0;
  function catchUp() {
    if (!active) return Promise.resolve([]);
    if (catching) return catching;
    catching = pullSince(lastTs).then(applyRows).catch(() => []).finally(() => { catching = null; caughtAt = Date.now(); });
    return catching;
  }

  /* перший вхід пристрою: що на сервері + що тут → злиття за правилами boot.js (mergeData) → обидва боки однакові */
  async function firstSync(mergeData) {
    const rows = await pullSince(""), byKey = {};
    for (const r of rows) { if (r.ts > lastTs) lastTs = r.ts; if (r.del) continue; const k = keyOf(r.path); (byKey[k] = byKey[k] || new Map()).set(r.path, await openVal(r.val)); }
    const server = {}; for (const k in byKey) { const s = unflatten(k, byKey[k]); if (s != null) server[k] = s; }
    const local = {}; localKeys().forEach((k) => { local[k] = rawGet.call(localStorage, k); });
    const merged = Object.keys(server).length ? (mergeData ? mergeData(server, local) : Object.assign({}, local, server)) : local;
    for (const k in byKey) cache[k] = byKey[k];
    const changed = [];
    for (const k of new Set(Object.keys(merged).concat(Object.keys(local)))) {
      if (!DATA_KEY(k)) continue;
      const v = merged[k]; if (v == null) continue;
      if (v !== local[k]) { rawSet.call(localStorage, k, v); changed.push(k); }
      dirty.add(k);
    }
    put("ordo.k.cloud.ts", lastTs); put("ordo.k.cloud.init", Date.now());
    await sendDirty();
    return changed;
  }

  function subscribe() {
    if (chan) { try { sb.removeChannel(chan); } catch (e) {} chan = null; }
    chan = sb.channel("docs-" + user.id).on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: `user_id=eq.${user.id}` }, (m) => {
      const r = m.new && m.new.path ? m.new : null; if (r) applyRows([r]);
    }).on("postgres_changes", { event: "*", schema: "public", table: "srv", filter: `user_id=eq.${user.id}` }, (m) => {
      const r = m.new && m.new.k ? m.new : null; if (r) srvEmit(r.k, r.val, r.ts);
    }).subscribe((st) => { if (st === "SUBSCRIBED") { catchUp(); Object.keys(srvL).forEach((k) => srvGet(k).then((v) => { if (v != null) srvEmit(k, v, null); })); } });
  }

  /* ----------------------------------------------------- вхід */
  async function session() { const c = client(); if (!c) return null; try { const { data } = await c.auth.getSession(); return data && data.session; } catch (e) { return null; } }
  async function init(mergeData) {
    const s = await session(); if (!s) { status = "out"; return { active: false }; }
    user = s.user; active = true; status = "sync";
    let changed = [];
    try {
      if (!get("ordo.k.cloud.init", 0)) changed = await firstSync(mergeData);
      else { localKeys().forEach((k) => { cache[k] = flatten(k, rawGet.call(localStorage, k)); }); changed = await applyRows(await pullSince(lastTs)); [...pend.keys()].forEach((p) => dirty.add(keyOf(p))); if (pend.size) sendDirty(); }
      status = "ok";
    } catch (e) { status = "err"; lastErr = (e && e.message) || String(e); }
    subscribe();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) catchUp(); else sendDirty(); });
    window.addEventListener("online", () => { catchUp(); sendDirty(); });
    return { active: true, changed };
  }
  async function signIn(email, password) {
    const c = client(); if (!c) throw new Error("бібліотека бази не завантажилась");
    const { error } = await c.auth.signInWithPassword({ email, password }); if (error) throw error; return true;
  }
  async function signUp(email, password) {
    const c = client(); if (!c) throw new Error("бібліотека бази не завантажилась");
    const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: "https://cluckh.github.io/vows/" } }); if (error) throw error;
    return !!(data && data.session);                      // false — чекаємо підтвердження з пошти
  }
  async function signOut() { const c = client(); if (c) await c.auth.signOut(); active = false; status = "out"; put("ordo.k.cloud.init", 0); }

  /* ----------------------------------------------------- один показ */
  const won = get("ordo.k.claims", {});
  async function claim(k) {
    if (!active) return true;
    if (won[k] != null) return won[k];
    try {
      const r = await Promise.race([sb.rpc("claim", { k, d: dev() }), new Promise((res) => setTimeout(() => res({ timeout: 1 }), 2500))]);
      if (r.timeout || r.error) return true;                   // база не відповіла — показуємо (краще двічі, ніж ніколи)
      won[k] = !!r.data; const ks = Object.keys(won); if (ks.length > 600) ks.slice(0, ks.length - 600).forEach((x) => delete won[x]); put("ordo.k.claims", won);
      return won[k];
    } catch (e) { return true; }
  }

  /* ------------------------------------- серверні дані (19.11.2026: замість файлів на GitHub)
     srv — те, що пишуть функції бази: health (журнал здоровʼя з iPhone), inbox (скринька вістей), push_state (що надіслав глашатай).
     Читати може лише власник; змінюються наживо (realtime) — srvOn(k, cb) кличе cb(val) щоразу. */
  const srvL = {};
  function srvEmit(k, val) { (srvL[k] || []).forEach((cb) => { try { cb(val); } catch (e) {} }); }
  async function srvGet(k) {
    if (!active) return null;
    try { const { data, error } = await sb.from("srv").select("val").eq("user_id", user.id).eq("k", k).maybeSingle(); return error || !data ? null : data.val; } catch (e) { return null; }
  }
  function srvOn(k, cb) { (srvL[k] = srvL[k] || []).push(cb); }
  /* функції бази (herald) — від імені власника */
  async function call(fn, body) {
    if (!active) return false;
    try { const { error } = await sb.functions.invoke(fn, { body: body || {} }); return !error; } catch (e) { return false; }
  }
  /* «Швидкі команди»: адреса й токен для подій з iPhone */
  async function ingestKey() {
    if (!active) return null;
    try { const { data } = await sb.from("ingest_keys").select("token").eq("user_id", user.id).maybeSingle(); return data ? { url: URL0 + "/functions/v1/ingest", token: data.token } : null; } catch (e) { return null; }
  }
  /* адреса пушів пристрою (глашатай бази читає звідси) */
  async function pushSub(dev, row) {
    if (!active) return false;
    try { const { error } = await sb.from("push_subs").upsert(Object.assign({ user_id: user.id, dev, at: new Date().toISOString() }, row), { onConflict: "user_id,dev" }); return !error; } catch (e) { return false; }
  }

  /* арти (з 20.11.2026): Storage, бакет art, <user_id>/<name>; читає лише власник. null — такої картинки ще нема */
  async function artBlob(n) {
    if (!active) return null;
    try { const { data, error } = await sb.storage.from("art").download(`${user.id}/${n}`); return error || !data || !data.size ? null : data; } catch (e) { return null; }
  }

  window.ORDO_CLOUD = {
    artBlob, srvGet, srvOn, call, ingestKey, pushSub,
    init, signIn, signUp, signOut, claim, catchUp, onSet, flush: sendDirty,
    active: () => active, user: () => user && user.email, status: () => ({ status, err: lastErr, pend: pend.size, ts: lastTs, caughtAt }),
    _t: { flatten, unflatten }
  };
})();
