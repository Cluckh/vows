/* ============================================================================
   ORDO — двигун. Вміст (обітниці, Кодекс, цитати) зашифрований у vault.json;
   boot.js розшифровує його і запускає ORDO_START(). Усі звернення до елементів
   захищені: якщо чогось нема — пропускаємо, додаток не падає.
   ========================================================================== */
window.ORDO_START = function () {
  "use strict";
  if (window.__ordoStarted) return; window.__ordoStarted = true;
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

  /* ---- версія збірки: з ?v= у тезі скрипта ---- */
  const VER = (() => { try { const m = ((document.currentScript && document.currentScript.src) || "").match(/[?&]v=(\d+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();
  /* нова версія для того, хто вже користувався додатком → покажемо знак оновлення */
  let verNews = false;
  if (VER) { const seen = LS.get("ordo.ver", null); if (seen !== VER) { verNews = !!(seen || LS.get("ordo.since", null)); LS.set("ordo.ver", VER); } }

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
     Усе звучання синтезується на льоту — жодного аудіофайлу.
     Мікшер: мʼякий компресор + «склепіння» (згенерована луна собору).
     Інструменти: мʼякий тон (кнопки), дзвін (церковні обертони), арфа,
     печатка, валторна, хор (два розстроєні голоси через форманти «а»).
     Музика: генеративний собор — бурдон D, повільні хорові акорди в
     натуральному мінорі, рідкісні далекі дзвони; уночі нижче й повільніше.
     iPhone: звук після першого дотику, беззвучний режим поважається, чужу
     музику не перебиває; згорнутий додаток мовчить.
     Вібро: Android — API, iPhone (iOS 18+) — системний тактильний клік.    */
  const FX = (() => {
    let ac = null, enabled = LS.get("ordo.sound", true), music = LS.get("ordo.music", true), night = false;
    let master = null, verb = null, noise = null;
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}

    function ctx() {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (e) { return null; } }
      if (!master) build(ac);
      return ac;
    }
    function build(c) {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .008; comp.release.value = .35;
      master = c.createGain(); master.gain.value = 1; master.connect(comp); comp.connect(c.destination);
      verb = c.createConvolver(); verb.buffer = hall(c, 3.6);
      const wet = c.createGain(); wet.gain.value = .8; verb.connect(wet); wet.connect(master);
      noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    /* імпульс зали: шум, що згасає, з мʼякою атакою; стерео — два різні шуми */
    function hall(c, sec) {
      const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate), att = c.sampleRate * .015;
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * (i < att ? i / att : 1) * .5;
      }
      return b;
    }
    const now = () => ac.currentTime;
    /* вихідна шина звуку: сухий сигнал у майстер + посил у луну; сама відʼєднується */
    function bus(vol, wet, life) {
      const g = ac.createGain(); g.gain.value = vol; g.connect(master);
      let s = null; if (wet) { s = ac.createGain(); s.gain.value = wet; g.connect(s); s.connect(verb); }
      setTimeout(() => { try { g.disconnect(); s && s.disconnect(); } catch (e) {} }, (life + 5) * 1000);
      return g;
    }
    function env(p, t, a, peak, end) { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(0.0001, t + end); }
    function osc(type, f, t, end, out, gain, a) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f; env(g.gain, t, a || .004, gain, end);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + end + .05); return o;
    }
    /* шум через смугу; to — ковзання частоти */
    function hiss(t, dur, vol, f, q, out, to) {
      const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; bp.type = "bandpass"; bp.Q.value = q;
      bp.frequency.setValueAtTime(f, t); if (to) bp.frequency.exponentialRampToValueAtTime(to, t + dur);
      env(g.gain, t, Math.min(.012, dur / 3), vol, dur);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
    }

    /* ---- інструменти ---- */
    function bell(f, w, dur, vol, wet) {
      const t = now() + (w || 0), o = bus(vol, wet == null ? .45 : wet, (w || 0) + dur);
      [[.5, .3], [1, 1], [1.19, .3], [1.5, .16], [2, .16], [2.52, .06], [3.01, .03]].forEach(([r, g], i) =>
        osc("sine", f * r * (1 + (Math.random() - .5) * .003), t, dur / (1 + i * .42), o, g, .01));
    }
    function harp(f, w, vol, dur) {
      dur = dur || 2.2; const t = now() + (w || 0), o = bus(vol, .55, (w || 0) + dur), lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 2200; lp.Q.value = .3; lp.connect(o);
      osc("sine", f, t, dur, lp, 1, .009); osc("triangle", f, t, dur * .6, lp, .25, .009); osc("sine", f * 2, t, dur * .4, lp, .15, .009);
    }
    /* мʼякий тон для кнопок: синус з плавною атакою, тиха октава, приглушено */
    function soft(f, w, dur, vol, wet) {
      const t = now() + (w || 0), o = bus(vol, wet == null ? .5 : wet, (w || 0) + dur), lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = Math.min(3200, f * 2.5); lp.Q.value = .3; lp.connect(o);
      osc("sine", f, t, dur, lp, 1, .014); osc("sine", f * 2, t, dur * .35, lp, .12, .014); osc("sine", f / 2, t, dur * .5, lp, .14, .03);
    }
    /* шелест сувою: шум у середніх частотах з плавним наростанням і згасанням,
       кілька тихих «волокон» паперу; без різких країв і без високого шипіння */
    function swell(t, dur, vol, f, q, out, to) {
      const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; bp.type = "bandpass"; bp.Q.value = q;
      bp.frequency.setValueAtTime(f, t); if (to) bp.frequency.linearRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
    }
    function scroll(w, vol, len, up) {
      const t = now() + (w || 0), o = bus(vol, .3, (w || 0) + len + 1), lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1900; lp.Q.value = .3; lp.connect(o);
      swell(t, len, 1, up ? 700 : 1300, .7, lp, up ? 1300 : 700);
      for (let i = 0; i < 3; i++) swell(t + Math.random() * len * .6, .1 + Math.random() * .08, .3, 1100 + Math.random() * 600, 1.4, lp);
    }
    function thud(w, vol) {
      const t = now() + (w || 0), o = bus(vol, .3, (w || 0) + 1), x = ac.createOscillator(), g = ac.createGain();
      x.type = "sine"; x.frequency.setValueAtTime(150, t); x.frequency.exponentialRampToValueAtTime(46, t + .32);
      env(g.gain, t, .004, 1, .5); x.connect(g); g.connect(o); x.start(t); x.stop(t + .55);
      hiss(t, .07, .6, 700, .7, o);
    }
    function horn(f, w, dur, vol) {
      const t = now() + (w || 0), o = bus(vol, .6, (w || 0) + dur), lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = "lowpass"; lp.Q.value = 1.2; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2000, t + .18); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + .12); g.gain.setValueAtTime(1, t + dur * .55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      [-4, 4].forEach((d) => { const x = ac.createOscillator(); x.type = "sawtooth"; x.frequency.value = f; x.detune.value = d; x.connect(lp); x.start(t); x.stop(t + dur + .05); });
      lp.connect(g); g.connect(o);
    }
    /* хоровий голос: два розстроєні пили → форманти «а» (730 / 1090 Гц) + тіло */
    function voice(f, t, dur, vol, out, att, rel) {
      const lp = ac.createBiquadFilter(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), body = ac.createGain(), g = ac.createGain();
      lp.type = "lowpass"; lp.frequency.value = 2400; lp.Q.value = .4;
      f1.type = "bandpass"; f1.frequency.value = 730; f1.Q.value = 5;
      f2.type = "bandpass"; f2.frequency.value = 1090; f2.Q.value = 7;
      body.gain.value = .22;
      const hold = Math.max(att, dur - rel);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.setValueAtTime(vol, t + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const vib = ac.createOscillator(), vd = ac.createGain(); vib.frequency.value = 4.6 + Math.random() * .8; vd.gain.value = 5;
      vib.connect(vd); vib.start(t); vib.stop(t + dur + .1);
      [-8, 8].forEach((c) => { const x = ac.createOscillator(); x.type = "sawtooth"; x.frequency.value = f; x.detune.value = c + (Math.random() - .5) * 6; vd.connect(x.detune); x.connect(lp); x.start(t); x.stop(t + dur + .1); });
      lp.connect(f1); lp.connect(f2); lp.connect(body); f1.connect(g); f2.connect(g); body.connect(g); g.connect(out);
    }
    function choir(notes, w, dur, vol) {
      const t = now() + (w || 0), o = bus(1, .9, (w || 0) + dur);
      notes.forEach((f) => voice(f, t, dur, vol, o, .5, dur * .7));
    }

    const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const S = {
      /* звичайні кліки (вкладки, перемикачі, додавання, вікно) — без звуку: відгук дає вібрація */
      open:   () => scroll(0, .032, .42, true),    // сувій розгортається
      fold:   () => scroll(0, .026, .28, false),   // і згортається
      over:   () => { bell(N(52), 0, 2.2, .035, .5); bell(N(51), .08, 2.4, .025, .5); },
      reset:  () => { thud(0, .07); bell(N(43), .05, 4.5, .05, .6); },
      date:   () => { bell(N(50), 0, 5.5, .06, .7); bell(N(62), .02, 4, .02, .7); },
      quote:  () => [62, 65, 69, 74].forEach((m, i) => harp(N(m), i * .16, .04, 3)),
      sign:   () => { bell(N(79), 0, 2.6, .03); harp(N(74), .2, .04, 2.4); },
      yes:    () => { harp(N(74), 0, .021); harp(N(78), .1, .017); soft(N(86), .2, 1.8, .01); },
      no:     () => soft(N(57), 0, 1.3, .026),
      ms:     () => { choir([N(62), N(66), N(69), N(74)], 0, 4.5, .05); [74, 78, 81, 86].forEach((m, i) => bell(N(m), .25 + i * .14, 3.2, .028)); },
      medal:  () => { horn(N(55), 0, .5, .045); horn(N(60), .42, .5, .045); horn(N(64), .84, 1.6, .05); choir([N(48), N(55), N(64)], .84, 3.5, .04); bell(N(88), 1.2, 3, .02); },
      year:   () => { thud(0, .12); bell(N(38), 0, 7, .08, .8); horn(N(50), .5, 1.2, .045); horn(N(57), 1.1, 2.2, .05); choir([N(50), N(57), N(62), N(66)], .9, 6, .05); [74, 78, 81, 86, 90].forEach((m, i) => bell(N(m), 1.4 + i * .22, 4, .025)); }
    };
    function play(name, g) {
      if (!enabled || !S[name]) return;
      if (g) unlock();
      if (!ac || !master || (ac.state !== "running" && !g)) return;
      try { S[name](); } catch (e) {}
    }

    /* ---- музика ---- */
    const CH = { i: [50, 53, 57], III: [53, 57, 60], iv: [55, 58, 62], v: [57, 60, 64], VI: [58, 62, 65], VII: [55, 60, 64] };
    const NEXT = { i: ["III", "VI", "VII", "iv", "v"], III: ["VII", "VI", "i"], iv: ["i", "VI", "v"], v: ["VI", "i", "III"], VI: ["VII", "III", "iv"], VII: ["i", "III", "v"] };
    const BELLS = [74, 77, 79, 81, 84, 86];
    const MUSIC_VOL = .15;   // фон: ~на 8–10 дБ тихіше за звуки дій
    let M = null;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    function chordAt(t) {
      const len = night ? 15 + Math.random() * 4 : 10 + Math.random() * 3;
      const notes = CH[M.ch].slice(); if (Math.random() < .45) notes.push(notes[0] + 12);
      notes.forEach((m) => voice(N(m), t, len + 5, night ? .03 : .036, M.pad, 3.5, 5));
      if (Math.random() < (night ? .35 : .7)) {
        const k = 1 + Math.floor(Math.random() * (night ? 1 : 3));
        for (let i = 0; i < k; i++) bellAt(N(pick(BELLS)), t + 2 + Math.random() * (len - 3));
      }
      M.ch = pick(NEXT[M.ch]);
      return len;
    }
    function bellAt(f, t) {
      [[1, 1], [2.01, .32], [2.76, .14], [4.1, .05]].forEach(([r, g], i) => {
        const o = ac.createOscillator(), a = ac.createGain(); o.frequency.value = f * r;
        env(a.gain, t, .004, g * .022, 5.5 / (1 + i * .6)); o.connect(a); a.connect(M.bells); o.start(t); o.stop(t + 6);
      });
    }
    function tick() {
      if (!M) return;
      while (M.next < now() + 3) M.next += chordAt(M.next);
      M.timer = setTimeout(tick, 1500);
    }
    function musicStart(force) {
      if (M || (!force && (!enabled || !music || !ac || !master || ac.state !== "running" || document.hidden))) return;
      const c = ac, t = now();
      const out = c.createGain(), lp = c.createBiquadFilter(), send = c.createGain(), pad = c.createGain(), bells = c.createGain();
      lp.type = "lowpass"; lp.frequency.value = night ? 1300 : 2200; lp.Q.value = .3;
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(MUSIC_VOL, t + 6);
      pad.connect(lp); bells.connect(lp); lp.connect(out); out.connect(master); out.connect(send); send.gain.value = 1.1; send.connect(verb);
      /* бурдон: D2 + A2 + тихе D3; повільне дихання гучності */
      const drone = c.createGain(), dl = c.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 380;
      drone.gain.value = .05; dl.connect(drone); drone.connect(out);
      const breath = c.createOscillator(), bd = c.createGain(); breath.frequency.value = .045; bd.gain.value = .02; breath.connect(bd); bd.connect(drone.gain); breath.start(t);
      const srcs = [breath];
      [[38, "sine", 1], [45, "sine", .55], [50, "triangle", .3]].forEach(([m, ty, g]) => {
        const o = c.createOscillator(), a = c.createGain(); o.type = ty; o.frequency.value = N(m); o.detune.value = (Math.random() - .5) * 6; a.gain.value = g;
        o.connect(a); a.connect(dl); o.start(t); srcs.push(o);
      });
      M = { out, lp, pad, bells, srcs, ch: "i", next: t + .5, timer: null };
      if (!force) tick();
    }
    function musicStop() {
      if (!M) return;
      const m = M; M = null; clearTimeout(m.timer);
      const t = now(); m.out.gain.cancelScheduledValues(t); m.out.gain.setValueAtTime(Math.max(.0001, m.out.gain.value), t); m.out.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      setTimeout(() => { m.srcs.forEach((o) => { try { o.stop(); } catch (e) {} }); try { m.out.disconnect(); } catch (e) {} }, 2800);
    }
    function setNight(v) { night = v; if (M) M.lp.frequency.setTargetAtTime(v ? 1300 : 2200, now(), 3); }

    function unlock() {
      if (!enabled) return;
      const c = ctx(); if (!c) return;
      if (c.state !== "running") c.resume().then(musicStart).catch(() => {}); else musicStart();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) musicStop();
      else if (ac && ac.state === "running") musicStart();
    });

    /* ---- тактильний відгук ----
       Android — Vibration API. iPhone вібрує лише від справжнього дотику до
       системного перемикача, тож там відгук дають невидимі перемикачі поверх
       кнопок (див. «Тактильні накладки» нижче), а buzz() нічого не робить. */
    function buzz(kind) {
      if (typeof navigator.vibrate !== "function") return;
      try { navigator.vibrate({ light: 8, medium: 16, heavy: [22, 90, 22] }[kind] || 8); } catch (e) {}
    }
    return {
      unlock, play, buzz, setNight,
      get enabled() { return enabled; }, get music() { return music; },
      set(v) { enabled = v; LS.set("ordo.sound", v); if (v) unlock(); else musicStop(); },
      setMusic(v) { music = v; LS.set("ordo.music", v); if (v) unlock(); else musicStop(); },
      _test: { build: (c) => { ac = c; M = null; build(c); }, S, music: (dur) => { musicStart(true); while (M.next < dur) M.next += chordAt(M.next); } }
    };
  })();
  ["pointerdown", "touchend", "keydown"].forEach((ev) => document.addEventListener(ev, FX.unlock, { passive: true }));

  /* ======================================================= ТАКТИЛЬНІ НАКЛАДКИ ==
     iPhone дає системний «тап» лише коли палець справді натискає перемикач
     <input switch>. Тож кожна кнопка отримує повністю прозорий перемикач
     поверх себе: палець влучає в нього (вібрація), а клік спливає до кнопки
     й спрацьовує як завжди. Вкладені кнопки — вищий шар. Нові елементи
     (шторки, цілі, календар) підхоплюються спостерігачем.                   */
  (function hapticOverlays() {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!touch || typeof navigator.vibrate === "function") return;
    const SEL = 'button, [role="button"], .tab, .oath, [data-open], [data-part], [data-mark], .ym[data-mk]';
    /* Перемикач на iPhone забирає собі весь дотик: свайп, що почався на ньому, не стає
       прокруткою, а зараховується як натискання. Тож у всьому, що гортається
       (списки обітниць, цілей, Літопис, шторки, введення цілей), накладок немає —
       вібрація лишається на нерухомих кнопках: вкладки, кнопки під табло, вікна
       підтвердження, ревю «Виконав / Не виконав». */
    const SCROLLS = "#oaths, #goalsBody, #statsBody, .sheet, #riteEntry";
    const skip = (el) => /^(INPUT|TEXTAREA|SELECT|LABEL)$/.test(el.tagName) || el.classList.contains("hx-ovl") || !!el.closest(SCROLLS);
    function dress(el) {
      if (skip(el) || el.querySelector(":scope > .hx-ovl")) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      let depth = 0; for (let a = el.parentElement; a; a = a.parentElement) if (a.matches(SEL)) depth++;
      const o = document.createElement("input");
      o.type = "checkbox"; o.setAttribute("switch", ""); o.className = "hx-ovl"; o.tabIndex = -1; o.setAttribute("aria-hidden", "true");
      o.style.zIndex = String(20 + depth);
      el.appendChild(o);
    }
    let queued = false;
    const scan = () => { queued = false; document.querySelectorAll(SEL).forEach(dress); };
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(scan); } })
      .observe(document.body, { childList: true, subtree: true });
    /* свайп ≠ тап: перемикач у Safari можна «тягнути», тож свайп по ньому міг
       зараховуватись як натискання. Якщо палець зсунувся (>8 px) або тап зупиняв
       інерційну прокрутку — клік скасовуємо, нічого не відкривається. */
    let sx = 0, sy = 0, moved = false, lastScroll = 0;
    const opt = { passive: true, capture: true };
    document.addEventListener("scroll", () => { lastScroll = performance.now(); }, opt);
    document.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      moved = performance.now() - lastScroll < 140;   // палець зупиняє прокрутку, а не тисне
    }, opt);
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0]; if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) moved = true;
    }, opt);
    document.addEventListener("click", (e) => {
      if (!e.target.classList || !e.target.classList.contains("hx-ovl")) return;
      e.target.blur();   // перемикач не має тримати фокус (інакше «набір тексту» відкладає оновлення)
      if (moved) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    scan();
  })();

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

  /* одноразові виправлення літопису (приходять у зашифрованому вмісті, D.PATCHES):
     застосовуються один раз; час запису детермінований, тож на різних пристроях
     це той самий запис і синхронізація його не подвоїть */
  (function applyPatches() {
    const done = LS.get("ordo.patches", []); let changed = false;
    (D.PATCHES || []).forEach((p) => {
      if (done.includes(p.id)) return;
      /* drop: прибрати записи (обітниця + дата, за потреби — вид) */
      (p.drop || []).forEach((q) => {
        const n = LOG.length; LOG = LOG.filter((x) => !(x.v === q.v && x.d === q.d && (!q.k || x.k === q.k))); if (LOG.length !== n) changed = true;
      });
      /* starts: перенести старт обітниці */
      if (p.starts) { Object.keys(p.starts).forEach((id) => { STARTS[id] = p.starts[id]; }); LS.set("ordo.starts", STARTS); }
      /* spent: вікна місяця вичерпано */
      if (p.spent) { const sp = LS.get("ordo.spent", {}); p.spent.forEach((x) => { sp[`${x.v}|${x.m}`] = true; }); LS.set("ordo.spent", sp); }
      (p.log || []).forEach((e) => {
        if (LOG.some((x) => x.k === e.k && x.v === e.v && x.d === e.d)) return;
        LOG.push(Object.assign({ ts: new Date(e.d + "T12:00:00").getTime() }, e)); changed = true;
      });
      done.push(p.id);
    });
    if (changed) { LOG.sort((a, b) => (a.ts || 0) - (b.ts || 0)); saveLog(); }
    if ((D.PATCHES || []).length) LS.set("ordo.patches", done);
  })();
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
    const fromLog = LOG.reduce((m, e) => (e.k === "breach" && e.v === v.id && e.prev > m ? e.prev : m), 0);
    const b = Math.max(streak(v), fromLog, BEST[v.id] || 0);
    if (BEST[v.id] !== b) { BEST[v.id] = b; LS.set("ordo.best", BEST); }
    return b;
  }
  const monthEvents = (v, mk, k) => LOG.filter((e) => e.v === v.id && e.k === k && e.d.slice(0, 7) === mk);
  /* вікна місяця: відмітки; якщо місяць позначено «вичерпано» — усі використані */
  const windowsUsed = (v, mk) => { mk = mk || monthKey(); if ((LS.get("ordo.spent", {}))[`${v.id}|${mk}`]) return v.window ? v.window.limit : 0; return monthEvents(v, mk, "mark").length; };
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
    const fd = $("footDate"); if (fd) fd.innerHTML = fmtShort(new Date()) + (VER ? `<span class="board__ver">v${VER}</span>` : "");
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
    { const kb = $("shKeeper"), K = D.KEEPERS && D.KEEPERS[id]; if (kb) { kb.hidden = !K; if (K) kb.textContent = `Покликати: ${K.name}`; } }
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
  on("scrim", "click", () => { closeSheet(); closeMark(); closeGoalSheet(); });
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
    if (window.ORDO_HALL) setTimeout(() => window.ORDO_HALL.fall(v.id), 1500);
  });
  /* хранитель обітниці — з шторки */
  on("shKeeper", "click", () => { const id = sheetVow; closeSheet(); if (window.ORDO_HALL) setTimeout(() => window.ORDO_HALL.callKeeper(id), 320); });
  /* щит на табло — поклик Верховного храмовника */
  on("crestBtn", "click", () => { if (window.ORDO_HALL) window.ORDO_HALL.panic(); });

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
    if (bad && window.ORDO_HALL) setTimeout(() => window.ORDO_HALL.fall(v.id), 1500);
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
    const m = $("musBtn"), mOn = FX.enabled && FX.music;
    if (m) { m.classList.toggle("icobtn--off", !mOn); m.classList.toggle("is-playing", mOn); m.setAttribute("aria-pressed", String(mOn)); m.disabled = !FX.enabled; }
  }
  on("musBtn", "click", () => { FX.setMusic(!FX.music); renderSound(); FX.buzz("light"); if (FX.music) FX.play("toggle", true); });
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
  let statsMode = LS.get("ordo.statsMode", "month");   // month | year
  let statsYearOff = 0;
  const MON3 = ["січ","лют","бер","кві","тра","чер","лип","сер","вер","жов","лис","гру"];
  const brWord = (n) => pluralUk(n, ["зрив", "зриви", "зривів"]);

  function renderLog() {
    const ev = LOG.slice().reverse().slice(0, 30);
    let h = `<div class="st-h">Записи</div>`;
    if (!ev.length) return h + `<p class="st-empty">Поки що чисто. Кожна відмітка, зрив і виконана ціль зʼявляться тут.</p>`;
    return h + `<ul class="st-log">` + ev.map((e) => {
      let nm = "", what = "", cls = "";
      if (e.k === "call") { nm = "Верховний храмовник"; const st = (D.PANIC && D.PANIC.states.find((x) => x.id === e.st)) || null;
        what = e.st === "held" ? "хвиля минула — встояв" : `покликав${st ? " · " + st.t.toLowerCase() : ""}`; cls = "c"; }
      else if (e.k === "goal") { nm = e.kind === "y" ? "Ціль року" : "Ціль місяця"; what = esc(e.t.length > 34 ? e.t.slice(0, 33) + "…" : e.t); cls = "g"; }
      else {
        const v = vowById(e.v); nm = v ? v.name : e.v;
        if (e.k === "mark") { what = `вікно ${e.w || ""}${e.n ? ` · ${e.n}` : ""}`; cls = "w"; }
        else if (e.k === "breach") { what = { manual: "зрив", limit: "зрив: понад ліміт", count: `зрив: ${e.n || ""} за день` }[e.why] + (e.prev ? ` · було ${e.prev}` : ""); cls = "b"; }
        else if (e.k === "edit") { what = `старт → ${fmtKey(e.to)}`; cls = "e"; }
      }
      return `<li class="ev-${cls}"><span class="lg-d">${fmtKey(e.d)}</span><span class="lg-v">${esc(nm)}</span><span class="lg-w">${what}</span></li>`;
    }).join("") + `</ul>`;
  }

  /* медальйон храмовника з реплікою (Літописець, Сенешаль) */
  const medallion = (who, head, text) => window.ORDO_HALL && who ? `<div class="md"><div class="md__fig">${window.ORDO_HALL.figure({ head })}</div>
    <div class="md__txt"><div class="md__who">${esc(who.name)} · ${esc(who.title)}</div><p class="md__say">${esc(text)}</p></div></div>` : "";
  const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : "");
  function chronicler() {
    const C = D.CHRONICLER; if (!C) return "";
    const mk = monthKey(), falls = LOG.filter((e) => e.k === "breach" && e.d.slice(0, 7) === mk).length;
    const held = LOG.filter((e) => e.k === "call" && e.st === "held" && e.d.slice(0, 7) === mk).length;
    const best = D.VOWS.slice().sort((a, b) => streak(b) - streak(a))[0];
    let t = falls ? fill(C.falls, { n: falls }) : C.clean;
    t += " " + (held ? fill(C.calls, { n: `${held} ${pluralUk(held, ["раз", "рази", "разів"])}` }) : fill(C.best, { vow: best.name, days: `${streak(best)} ${daysWord(streak(best))}` }));
    return medallion(C, "hood", t);
  }
  function seneschal() {
    const S = D.SENESCHAL; if (!S) return "";
    const M = monthKey(), P = G.m[M], left = daysIn(M) - new Date().getDate();
    let t;
    if (!P || !P.items.length) t = S.none;
    else if (P.items.every((it) => complete(it))) t = S.all;
    else if (left === 0) t = S.review;
    else t = fill(S.progress, { done: P.items.filter((it) => complete(it)).length, total: P.items.length, days: `${left} ${daysWord(left)}` });
    return medallion(S, "plume", t);
  }

  function renderStats() {
    const box = $("statsBody"); if (!box) return;
    const sub = $("stSub"); if (sub) sub.textContent = `усе записується з ${fmtKey(SINCE)}`;
    const seg = `<div class="st-seg" role="tablist">
      <button type="button" data-mode="month" class="${statsMode === "month" ? "is-on" : ""}">Місяць</button>
      <button type="button" data-mode="year" class="${statsMode === "year" ? "is-on" : ""}">Рік</button></div>`;
    box.innerHTML = chronicler() + seg + (statsMode === "year" ? yearHTML() : monthHTML()) + renderLog();
    on("stPrev", "click", () => { if (statsMode === "year") statsYearOff--; else statsOffset--; renderStats(); FX.buzz("light"); });
    on("stNext", "click", () => {
      if (statsMode === "year") { if (statsYearOff < 0) statsYearOff++; } else if (statsOffset < 0) statsOffset++;
      renderStats(); FX.buzz("light");
    });
  }

  function monthHTML() {
    const mk = statsMonth(), N = daysIn(mk), isCur = statsOffset === 0, loc = MONTHS_LOC[+mk.slice(5) - 1];
    const honor = D.VOWS.reduce((a, v) => a + streak(v), 0);
    const wins = D.VOWS.filter((v) => v.window).reduce((a, v) => a + windowsUsed(v, mk), 0);
    const brs = LOG.filter((e) => e.k === "breach" && e.d.slice(0, 7) === mk).length;
    let h = `<div class="st-sum">
      <div><b>${honor}</b><span>днів честі зараз</span></div>
      <div><b>${wins}</b><span>вікон у ${loc}</span></div>
      <div class="${brs ? "is-bad" : ""}"><b>${brs}</b><span>${brWord(brs)} у ${loc}</span></div>
    </div>
    <div class="st-month">
      <button class="st-nav" id="stPrev" type="button" aria-label="Попередній місяць">‹</button>
      <div class="st-month__name">${monthName(mk)} ${mk.slice(0, 4)}</div>
      <button class="st-nav" id="stNext" type="button" aria-label="Наступний місяць" ${isCur ? "disabled" : ""}>›</button>
    </div>`;
    D.VOWS.forEach((v) => {
      const s = streak(v), b = bestOf(v);
      const mBr = LOG.filter((e) => e.k === "breach" && e.v === v.id && e.d.slice(0, 7) === mk).length;
      let cells = "";
      for (let i = 1; i <= N; i++) cells += `<i class="c-${dayState(v, `${mk}-${pad(i)}`)}${isCur && i === new Date().getDate() ? " c-now" : ""}"></i>`;
      const winTxt = v.window ? `вікна ${windowsUsed(v, mk)}/${v.window.limit} · ` : "";
      h += `<div class="st-vow">
        <div class="st-vow__head"><svg><use href="#i-${v.icon}"/></svg><span class="st-vow__name">${v.name}</span>
          <span class="st-vow__nums"><b>${s}</b> <em>рекорд ${b}</em></span></div>
        <div class="st-cal" style="grid-template-columns:repeat(${N},1fr)">${cells}</div>
        <div class="st-vow__meta">${winTxt}${mBr} ${brWord(mBr)} у ${loc}</div>
      </div>`;
    });
    return h + `<div class="st-legend"><span><i class="c-c"></i>чистий</span><span><i class="c-w"></i>вікно</span><span><i class="c-b"></i>зрив</span><span><i class="c-x"></i>без запису</span></div>` +
      goalsMonthHTML(mk, N, isCur);
  }

  /* ---- цілі в Літописі: дні з дією, прогрес, медаль ---- */
  const GL_ICON = { once: "i-medal", count: "i-plus", measure: "i-scroll", stages: "i-banner", vows: "i-shield" };
  function goalDays(it) {                       // { "РРРР-ММ-ДД": "a" — була дія | "d" — виконано }
    const m = {};
    (it.hist || []).forEach((h) => { m[h.d] = "a"; });
    (it.parts || []).forEach((p) => { if (p.done) m[p.done] = "a"; });
    if (it.done) m[it.done] = "d";
    return m;
  }
  function goalStatus(it, P) {
    const t = tyOf(it);
    if (P.res) return P.res[it.id] ? `<b class="gs-ok">виконано</b>` : `<b class="gs-no">не виконано</b>`;
    if (complete(it)) return `<b class="gs-ok">виконано</b>${it.done ? ` <em>${fmtKey(it.done)}</em>` : ""}`;
    if (t === "count") return `<b>${fmtN(it.cur || 0)}</b> <em>/ ${fmtN(it.target)}</em>`;
    if (t === "measure") { const lv = lastVal(it); return lv ? `<b class="${msState(it) === "ok" ? "gs-ok" : "gs-off"}">${fmtN(lv.v)}</b> <em>${OPS[it.op]} ${fmtN(it.target)}</em>` : `<em>значень нема</em>`; }
    if (t === "stages") { const ps = it.parts || []; return `<b>${ps.filter(partDone).length}</b> <em>/ ${ps.length}</em>`; }
    if (t === "vows") return `<b>${minVow(it)}</b> <em>/ ${fmtN(it.target)}</em>`;
    return `<em>ще ні</em>`;
  }
  function goalsMonthHTML(mk, N, isCur) {
    const P = G.m[mk], head = (x) => `<div class="st-h st-h--goals"><span>Цілі місяця</span>${x || ""}</div>`;
    if (!P || !P.items.length) return head() + `<p class="st-empty">Цілей на ${monthName(mk)} не ставилось.</p>`;
    const done = P.items.filter((it) => P.res ? P.res[it.id] : complete(it)).length, today = todayKey();
    let h = head(`<em>${done} з ${P.items.length}</em>`);
    if (P.res) { const a = tierFor(D.MEDALS, pctOf(P)); h += `<div class="gl-award tier-${a.tier} st-award"><svg><use href="#medal"/></svg><div><b>${a.name}</b><span>${pctOf(P)}% цілей місяця</span></div></div>`; }
    h += P.items.map((it) => {
      const days = goalDays(it), t = tyOf(it); let cells = "";
      for (let i = 1; i <= N; i++) {
        const dk = `${mk}-${pad(i)}`, st = days[dk];
        cells += `<i class="${st === "d" ? "g-d" : st === "a" ? "g-a" : dk > today ? "c-f" : "g-0"}${isCur && i === new Date().getDate() ? " c-now" : ""}"></i>`;
      }
      const act = Object.keys(days).filter((d) => d.slice(0, 7) === mk).length;
      return `<div class="st-vow st-goal"><div class="st-vow__head"><svg><use href="#${GL_ICON[t] || "i-medal"}"/></svg><span class="st-vow__name">${esc(it.t)}</span><span class="st-vow__nums">${goalStatus(it, P)}</span></div>
        <div class="st-cal" style="grid-template-columns:repeat(${N},1fr)">${cells}</div>
        <div class="st-vow__meta">${GT[t].name} · ${act ? `${act} ${pluralUk(act, ["день", "дні", "днів"])} з дією` : "ще без дій"}${t !== "measure" && !P.res ? ` · ${Math.round(progressOf(it) * 100)}%` : ""}</div></div>`;
    }).join("");
    return h + `<div class="st-legend"><span><i class="g-a"></i>була дія</span><span><i class="g-d"></i>виконано</span></div>`;
  }
  function goalsYearHTML(Y, curMk) {
    let cells = "";
    for (let m = 1; m <= 12; m++) {
      const mk = `${Y}-${pad(m)}`, P = G.m[mk];
      if (mk > curMk || !P || !P.items.length) { cells += `<i class="ym ym-f"></i>`; continue; }
      const done = P.items.filter((it) => P.res ? P.res[it.id] : complete(it)).length;
      const tier = P.res ? tierFor(D.MEDALS, pctOf(P)).tier : "";
      cells += `<i class="ym ${tier ? `ym-t tier-${tier}` : "ym-p"}${mk === curMk ? " ym-now" : ""}" data-mk="${mk}">${done}/${P.items.length}</i>`;
    }
    let h = `<div class="st-h st-h--goals"><span>Цілі</span></div>
      <div class="st-vow st-vow--y"><div class="st-vow__head"><svg><use href="#i-medal"/></svg><span class="st-vow__name">Цілі місяця</span></div>
      <div class="st-year">${cells}</div><div class="st-vow__meta">число — виконано з поставлених; колір — медаль місяця після ревю</div></div>`;
    const YP = G.y[String(Y)];
    if (YP && YP.items.length) h += YP.items.map((it) => `<div class="st-vow st-goal"><div class="st-vow__head"><svg><use href="#${GL_ICON[tyOf(it)] || "i-medal"}"/></svg>
      <span class="st-vow__name">${esc(it.t)}</span><span class="st-vow__nums">${goalStatus(it, YP)}</span></div>
      <div class="gl-bar"><i style="width:${Math.round(progressOf(it) * 100)}%"></i></div><div class="st-vow__meta">ціль ${Y} року · ${GT[tyOf(it)].name}</div></div>`).join("");
    return h;
  }

  function yearHTML() {
    const now = new Date(), Y = now.getFullYear() + statsYearOff, curMk = monthKey(now), isCurY = statsYearOff === 0;
    const yBr = LOG.filter((e) => e.k === "breach" && e.d.slice(0, 4) === String(Y));
    const yGoals = LOG.filter((e) => e.k === "goal" && e.d.slice(0, 4) === String(Y)).length;
    let clean = 0;
    const rows = D.VOWS.map((v) => {
      let cells = "", vClean = 0, vBr = 0;
      for (let m = 1; m <= 12; m++) {
        const mk = `${Y}-${pad(m)}`, N = daysIn(mk);
        if (mk > curMk) { cells += `<i class="ym ym-f"></i>`; continue; }
        if (`${mk}-${pad(N)}` < SINCE) { cells += `<i class="ym ym-x" data-mk="${mk}"></i>`; continue; }
        let c = 0, w = 0, b = 0;
        for (let d = 1; d <= N; d++) { const s = dayState(v, `${mk}-${pad(d)}`); if (s === "c") c++; else if (s === "w") w++; else if (s === "b") b++; }
        vClean += c; vBr += b;
        const cls = b ? "ym-b" : w ? "ym-w" : "ym-c";
        cells += `<i class="ym ${cls}${mk === curMk ? " ym-now" : ""}" data-mk="${mk}">${b ? b : w ? w : ""}</i>`;
      }
      clean += vClean;
      return `<div class="st-vow st-vow--y">
        <div class="st-vow__head"><svg><use href="#i-${v.icon}"/></svg><span class="st-vow__name">${v.name}</span>
          <span class="st-vow__nums"><em>рекорд</em> <b>${bestOf(v)}</b></span></div>
        <div class="st-year">${cells}</div>
        <div class="st-vow__meta">${vClean} чистих ${pluralUk(vClean, ["день", "дні", "днів"])} · ${vBr} ${brWord(vBr)} за рік</div>
      </div>`;
    }).join("");
    const bestAll = Math.max(0, ...D.VOWS.map((v) => bestOf(v)));
    return `<div class="st-sum">
      <div><b>${clean}</b><span>чистих днів обітниць</span></div>
      <div class="${yBr.length ? "is-bad" : ""}"><b>${yBr.length}</b><span>${brWord(yBr.length)} за рік</span></div>
      <div><b>${yGoals}</b><span>цілей достроково</span></div>
    </div>
    <div class="st-month">
      <button class="st-nav" id="stPrev" type="button" aria-label="Попередній рік">‹</button>
      <div class="st-month__name">${Y} рік</div>
      <button class="st-nav" id="stNext" type="button" aria-label="Наступний рік" ${isCurY ? "disabled" : ""}>›</button>
    </div>
    <div class="st-yhead">${MON3.map((m) => `<span>${m}</span>`).join("")}</div>
    ${rows}
    <div class="st-legend"><span><i class="c-c"></i>місяць без зривів</span><span><i class="c-w"></i>були вікна</span><span><i class="c-b"></i>були зриви</span></div>
    <p class="st-note">Число в клітинці — скільки зривів (або вікон) було того місяця. Тап по місяцю відкриває його детально. Найдовший стрік серед обітниць — ${bestAll} ${daysWord(bestAll)}.</p>` +
    goalsYearHTML(Y, curMk);
  }

  on("statsBody", "click", (e) => {
    const sg = e.target.closest("[data-mode]");
    if (sg) { statsMode = sg.dataset.mode; LS.set("ordo.statsMode", statsMode); renderStats(); FX.play("tab", true); FX.buzz("light"); return; }
    const cell = e.target.closest(".ym[data-mk]");
    if (cell) {
      const [y, m] = cell.dataset.mk.split("-").map(Number), now = new Date();
      statsOffset = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
      statsMode = "month"; LS.set("ordo.statsMode", statsMode); renderStats(); FX.buzz("light"); window.scrollTo(0, 0);
    }
  });

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

  /* ---------------------------------------------------------- типи цілей --
     once — звичайна; count — лічильник (вписуєш «зараз N», закривається сама);
     measure — мірило (оцінюється на кінець періоду, достроково не закривається);
     stages — етапи (частини-галочки або частини-лічильники); vows — найменший
     стрік серед обітниць ≥ N (закривається сама й назавжди).                */
  const GT = {
    once:    { name: "Звичайна",  hint: "Одна відмітка, коли зроблено." },
    count:   { name: "Лічильник", hint: "Накопичення до числа: «+» додає одиницю, у поле — скільки є зараз. Закриється сама." },
    measure: { name: "Мірило",    hint: "Оцінюється на кінець періоду: середнє, вага. Проміжні значення ціль не закривають." },
    stages:  { name: "Етапи",     hint: "Кілька частин; частина може мати своє число. Закрита, коли закриті всі." },
    vows:    { name: "Обітниці",  hint: "Стрік вибраних обітниць (якщо кілька — найменший серед них). Закриється сама, щойно дійде до числа." }
  };
  const OPS = { ">=": "≥", "<=": "≤", "<": "<", ">": ">" };
  const OPW = { ">=": "не менше", "<=": "не більше", "<": "менше", ">": "більше" };
  const tyOf = (it) => it.type || "once";
  const fmtN = (v) => (v == null || isNaN(v)) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: 2 });
  const numIn = (s) => { if (s == null) return null; const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isNaN(v) ? null : v; };
  const cmpOk = (v, op, t) => op === ">=" ? v >= t : op === "<=" ? v <= t : op === "<" ? v < t : v > t;
  /* ціль «Обітниці»: it.vows — вибрані id; немає поля — рахуються всі */
  const vowsOf = (it) => { const ids = it && Array.isArray(it.vows) ? it.vows : null; const vs = ids ? D.VOWS.filter((v) => ids.includes(v.id)) : D.VOWS; return vs.length ? vs : D.VOWS; };
  const minVow = (it) => Math.min(...vowsOf(it).map((v) => streak(v)));
  const vowChips = (sel, attr) => `<div class="cmp__vows">${D.VOWS.map((v) => `<button type="button" ${attr}="${v.id}" class="${!sel || sel.includes(v.id) ? "is-on" : ""}"><svg><use href="#i-${v.icon}"/></svg>${v.name}</button>`).join("")}</div>`;
  /* перемкнути обітницю у виборі: null — усі; false — не можна зняти останню */
  function toggleVow(sel, id) {
    const all = D.VOWS.map((v) => v.id);
    let s = sel ? sel.filter((x) => all.includes(x)) : all.slice();
    s = s.includes(id) ? s.filter((x) => x !== id) : s.concat(id);
    if (!s.length) return false;
    return s.length === all.length ? null : all.filter((x) => s.includes(x));
  }
  const lastVal = (it) => it.hist && it.hist.length ? it.hist[it.hist.length - 1] : null;
  const partDone = (p) => p.target ? (p.cur || 0) >= p.target : !!p.done;

  function parseNum(s) {
    const m = s.match(/(\d+(?:[.,]\d+)?)\s*(тис\S*|[кk](?![a-zа-яіїєґʼ'’]))?/i);
    if (!m) return null;
    let v = parseFloat(m[1].replace(",", ".")); if (m[2]) v *= 1000; return v;
  }
  function guess(t) {
    const s = t.toLowerCase();
    if (/обітниц/.test(s)) { const n = parseNum(s); if (n) return { type: "vows", target: n }; }
    if (t.includes("+")) {
      const parts = t.split("+").map((x) => x.trim()).filter(Boolean);
      if (parts.length > 1) return { type: "stages", parts: parts.map((p) => ({ t: p, target: /^\d/.test(p) ? parseNum(p.toLowerCase()) : null })) };
    }
    if (/серед|ваг/.test(s)) {
      const n = parseNum(s);
      if (n) {
        let op = /не менш|мінімум|≥/.test(s) ? ">=" : /менш|нижч|</.test(s) ? "<" : /більш|вищ|>/.test(s) ? ">" : /ваг/.test(s) ? "<" : ">=";
        return { type: "measure", target: n, op };
      }
    }
    const n = parseNum(s);
    return n ? { type: "count", target: n } : { type: "once" };
  }
  function complete(it) {
    const t = tyOf(it);
    if (t === "once") return !!it.done;
    if (t === "count") return it.target > 0 && (it.cur || 0) >= it.target;
    if (t === "stages") return !!(it.parts && it.parts.length && it.parts.every(partDone));
    if (t === "vows") return !!it.done || (it.target > 0 && minVow(it) >= it.target);
    return false;
  }
  function progressOf(it) {
    const t = tyOf(it);
    if (t === "count") return it.target ? Math.min(1, (it.cur || 0) / it.target) : 0;
    if (t === "stages") { const ps = it.parts || []; return ps.length ? ps.reduce((a, p) => a + (p.target ? Math.min(1, (p.cur || 0) / p.target) : p.done ? 1 : 0), 0) / ps.length : 0; }
    if (t === "vows") return it.done ? 1 : it.target ? Math.min(1, minVow(it) / it.target) : 0;
    return it.done ? 1 : 0;
  }
  /* автозакриття лічильників, етапів і обітниць (та відкат, якщо значення зменшили) */
  function settle(it, kind, key) {
    const t = tyOf(it);
    if (t === "once" || t === "measure") return false;
    const c = complete(it);
    if (c && !it.done) { it.done = todayKey(); logPush({ k: "goal", gid: it.id, kind, key, t: it.t, d: it.done }); return true; }
    if (!c && it.done && t !== "vows") { it.done = null; LOG = LOG.filter((x) => !(x.k === "goal" && x.gid === it.id)); saveLog(); }
    return false;
  }
  function settleAll() {
    let fresh = 0;
    ["y", "m"].forEach((kind) => Object.keys(G[kind]).forEach((key) => {
      const P = G[kind][key]; if (P.res) return;
      P.items.forEach((it) => { if (settle(it, kind, key)) fresh++; });
    }));
    saveG(); return fresh;
  }
  function blankFor(type, text, prev) {
    const g = guess(text || "");
    const it = { type };
    if (type === "count") { it.target = (prev && prev.target) || (g.type === "count" || g.type === "measure" ? g.target : null) || null; it.cur = prev && prev.cur || 0; it.hist = prev && prev.hist || []; }
    if (type === "measure") { it.target = (prev && prev.target) || (g.target || null); it.op = (prev && prev.op) || g.op || ">="; it.hist = prev && prev.hist || []; }
    if (type === "stages") { it.parts = (prev && prev.parts) || (g.type === "stages" ? g.parts.map((p) => ({ id: uid(), t: p.t, target: p.target || null, cur: 0 })) : [{ id: uid(), t: text || "", target: null }]); }
    if (type === "vows") { it.target = (prev && prev.target) || (g.type === "vows" ? g.target : 10); if (prev && prev.vows) it.vows = prev.vows; }
    return it;
  }

  /* ---------------------------------------------------- конструктор цілі --- */
  function composer(root) {
    let type = "once", touched = false, op = ">=", vsel = null;
    root.innerHTML = `
      <textarea class="cmp__t" rows="2" maxlength="140" enterkeyhint="next" placeholder="Одна ціль — коротко і вимірно"></textarea>
      <div class="cmp__types">${Object.keys(GT).map((k) => `<button type="button" data-ty="${k}">${GT[k].name}</button>`).join("")}</div>
      <p class="cmp__hint"></p>
      <div class="cmp__fields"></div>`;
    const ta = root.querySelector(".cmp__t"), fl = root.querySelector(".cmp__fields"), hint = root.querySelector(".cmp__hint");
    let parts = [];
    function drawFields(fill) {
      root.querySelectorAll("[data-ty]").forEach((b) => b.classList.toggle("is-on", b.dataset.ty === type));
      hint.textContent = GT[type].hint;
      const g = guess(ta.value || "");
      if (type === "count") fl.innerHTML = `<label class="cmp__f">Ціль<input type="text" inputmode="decimal" data-f="target" placeholder="напр. 40000"></label>`;
      else if (type === "vows") fl.innerHTML = `${vowChips(vsel, "data-cv")}<label class="cmp__f">Стрік ≥<input type="text" inputmode="numeric" data-f="target" placeholder="напр. 20"></label>`;
      else if (type === "measure") fl.innerHTML = `<div class="cmp__ops">${Object.keys(OPS).map((o) => `<button type="button" data-op="${o}" class="${o === op ? "is-on" : ""}">${OPS[o]} ${OPW[o]}</button>`).join("")}</div>
        <label class="cmp__f">Ціль<input type="text" inputmode="decimal" data-f="target" placeholder="напр. 7000"></label>`;
      else if (type === "stages") {
        if (fill || !parts.length) parts = g.type === "stages" ? g.parts.map((p) => ({ t: p.t, target: p.target })) : [{ t: "", target: null }, { t: "", target: null }];
        fl.innerHTML = `<div class="cmp__parts">${parts.map((p, i) => `<div class="cmp__part"><input type="text" data-pt="${i}" placeholder="Частина ${i + 1}" value="${esc(p.t || "")}">
          <input type="text" inputmode="decimal" data-pn="${i}" placeholder="число?" value="${p.target || ""}"><button type="button" data-rm="${i}" aria-label="Прибрати"><svg><use href="#i-x"/></svg></button></div>`).join("")}</div>
          <button type="button" class="cmp__more" data-addpart>+ частина</button>`;
      } else fl.innerHTML = "";
      const tf = fl.querySelector('[data-f="target"]');
      if (tf && fill && g.target) tf.value = g.target;
    }
    function syncParts() {
      fl.querySelectorAll("[data-pt]").forEach((el) => { parts[+el.dataset.pt].t = el.value; });
      fl.querySelectorAll("[data-pn]").forEach((el) => { parts[+el.dataset.pn].target = numIn(el.value); });
    }
    ta.addEventListener("input", () => { if (touched) return; const g = guess(ta.value); type = g.type; if (g.op) op = g.op; drawFields(true); });
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ty]");
      if (b) { type = b.dataset.ty; touched = true; const g = guess(ta.value); if (g.op) op = g.op; drawFields(true); FX.buzz("light"); return; }
      const cv = e.target.closest("[data-cv]");
      if (cv) {
        const r = toggleVow(vsel, cv.dataset.cv); if (r === false) { FX.buzz("medium"); return; }
        vsel = r; fl.querySelectorAll("[data-cv]").forEach((x) => x.classList.toggle("is-on", !vsel || vsel.includes(x.dataset.cv))); FX.buzz("light"); return;
      }
      const o = e.target.closest("[data-op]");
      if (o) { op = o.dataset.op; root.querySelectorAll("[data-op]").forEach((x) => x.classList.toggle("is-on", x === o)); FX.buzz("light"); return; }
      if (e.target.closest("[data-addpart]")) { syncParts(); parts.push({ t: "", target: null }); drawFields(false); const last = fl.querySelector(`[data-pt="${parts.length - 1}"]`); if (last) last.focus(); return; }
      const rm = e.target.closest("[data-rm]");
      if (rm) { syncParts(); parts.splice(+rm.dataset.rm, 1); drawFields(false); }
    });
    drawFields(false);
    return {
      focus() { ta.focus(); },
      reset() { ta.value = ""; type = "once"; touched = false; op = ">="; vsel = null; parts = []; drawFields(false); },
      read() {
        const t = (ta.value || "").trim();
        if (!t) { ta.focus(); return null; }
        const it = { id: uid(), t, type };
        const tf = fl.querySelector('[data-f="target"]'), tv = tf ? numIn(tf.value) : null;
        if (type === "count" || type === "measure" || type === "vows") {
          if (!(tv > 0)) { if (tf) { tf.focus(); tf.classList.add("is-bad"); } return null; }
          it.target = tv;
        }
        if (type === "count") { it.cur = 0; it.hist = []; }
        if (type === "measure") { it.op = op; it.hist = []; }
        if (type === "vows" && vsel) it.vows = vsel.slice();
        if (type === "stages") {
          syncParts();
          const ps = parts.filter((p) => (p.t || "").trim());
          if (!ps.length) return null;
          it.parts = ps.map((p) => ({ id: uid(), t: p.t.trim(), target: p.target > 0 ? p.target : null, cur: 0 }));
        }
        return it;
      }
    };
  }

  /* ------------------------------------------------------- вкладка «Цілі» -- */
  /* мірило: "ok" — останнє значення в нормі, "off" — поки ні, null — значень ще немає */
  const msState = (it) => { const lv = lastVal(it); return lv ? (cmpOk(lv.v, it.op, it.target) ? "ok" : "off") : null; };
  function sparkSVG(hist, target, state) {
    if (!hist || hist.length < 2) return "";
    const vs = hist.map((h) => h.v), lo = Math.min(...vs, target), hi = Math.max(...vs, target), W = 120, H = 28, pd = 3;
    const y = (v) => hi === lo ? H / 2 : H - pd - ((v - lo) / (hi - lo)) * (H - pd * 2);
    const x = (i) => pd + (i / (vs.length - 1)) * (W - pd * 2);
    return `<svg class="gl-spark${state ? ` gl-spark--${state}` : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${y(target)}" y2="${y(target)}" class="gl-spark__t"/>
      <polyline points="${vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/><circle cx="${x(vs.length - 1)}" cy="${y(vs[vs.length - 1])}" r="2.4"/></svg>`;
  }
  function detailHTML(it, kind, key, locked) {
    const t = tyOf(it), bar = (p) => `<div class="gl-bar"><i style="width:${Math.round(p * 100)}%"></i></div>`;
    if (t === "count") return `${bar(progressOf(it))}<span class="gl-num">${fmtN(it.cur || 0)} <em>/ ${fmtN(it.target)}</em>${it.done ? ` · виконано ${fmtKey(it.done)}` : ""}</span>`;
    if (t === "vows") {
      const m = minVow(it), vs = vowsOf(it);
      const who = vs.length === D.VOWS.length ? "найменший стрік" : vs.length === 1 ? esc(vs[0].name)
        : `<span class="gl-vis">${vs.map((v) => `<svg><use href="#i-${v.icon}"/></svg>`).join("")}</span>найменший`;
      return `${bar(progressOf(it))}<span class="gl-num">${it.done ? `досягнуто ${fmtKey(it.done)}` : `${who} ${m} <em>/ ${fmtN(it.target)}</em>`}</span>`;
    }
    if (t === "measure") {
      const lv = lastVal(it);
      if (!lv) return `<span class="gl-num">ціль ${OPS[it.op]} ${fmtN(it.target)} · значень ще немає</span>`;
      const st = msState(it), pill = st === "ok" ? "у нормі" : "поки ні";
      return `<span class="gl-num gl-num--${st}">зараз <b class="gl-cur">${fmtN(lv.v)}</b> <em>· ціль ${OPS[it.op]} ${fmtN(it.target)}</em> <span class="gl-status is-${st}">${pill}</span></span>${sparkSVG(it.hist, it.target, st)}`;
    }
    if (t === "stages") {
      return `<ul class="gl-parts">${(it.parts || []).map((p) => {
        const dn = partDone(p);
        const right = p.target ? `<span class="gl-part__n">${fmtN(p.cur || 0)}/${fmtN(p.target)}</span>` : "";
        const attr = !locked && !p.target ? `data-part="${kind}|${key}|${it.id}|${p.id}" role="button"` : "";
        return `<li class="gl-part ${dn ? "is-done" : ""}" ${attr}><span class="gl-part__m"></span><span class="gl-part__t">${esc(p.t)}</span>${right}</li>`;
      }).join("")}</ul>`;
    }
    return it.done ? `<span class="gl-when">виконано ${fmtKey(it.done)}</span>` : "";
  }

  function renderGoals() {
    const box = $("goalsBody"); if (!box) return;
    settleAll();
    const now = new Date(), Y = String(now.getFullYear()), M = monthKey(now);
    const sub = $("glSub"); if (sub) sub.textContent = "ставляться 1-го, відмічаються останнього числа";
    const pend = pendingTasks();
    const section = (kind, key) => {
      const P = peek(kind, key), reviewed = !!(P && P.res), items = P ? P.items : [];
      const due = pend.find((t) => t.t === "review" && t.kind === kind && t.key === key);
      const pct = reviewed ? pctOf(P) : 0;
      const award = reviewed ? tierFor(kind === "y" ? D.TITLES : D.MEDALS, pct) : null;
      const when = kind === "y" ? "ревю 31 грудня" : `ревю ${daysIn(key)} ${MONTHS[+key.slice(5) - 1]}`;
      const doneN = items.filter((it) => reviewed ? P.res[it.id] : complete(it)).length;
      let h = `<section class="gl-sec">
        <div class="gl-sec__head"><span class="gl-sec__kind">${kind === "y" ? "Цілі року" : "Цілі місяця"}</span><span class="gl-sec__name">${periodLabel(kind, key)}</span>
        <span class="gl-sec__meta">${reviewed ? `${pct}%` : items.length ? `${doneN}/${items.length} · ${when}` : ""}</span></div>`;
      if (award) h += `<div class="gl-award tier-${award.tier}"><svg><use href="#medal"/></svg><div><b>${award.name}</b><span>${award.text}</span></div></div>`;
      if (items.length) {
        h += `<ul class="gl-list">` + items.map((it) => {
          const t = tyOf(it);
          const st = reviewed ? (P.res[it.id] ? "yes" : "no") : complete(it) ? "early" : "open";
          const mark = !reviewed && t === "once"
            ? `<button class="gl-mark gl-mark--btn" type="button" data-done="${kind}|${key}|${it.id}" aria-label="${it.done ? "Зняти позначку" : "Виконано достроково"}"></button>`
            : `<span class="gl-mark gl-mark--btn gl-mark--${t}"></span>`;
          const ms = t === "measure" && !reviewed ? msState(it) : null;
          return `<li class="gl-it gl-it--${st} gl-ty-${t}${ms ? ` gl-ms-${ms}` : ""}" data-open="${kind}|${key}|${it.id}">${mark}
            <div class="gl-body"><span class="gl-t">${esc(it.t)}</span>${detailHTML(it, kind, key, reviewed)}</div>
            <span class="gl-ty">${GT[t].name}</span></li>`;
        }).join("") + `</ul>`;
      } else if (!reviewed) h += `<p class="gl-empty">${kind === "y" ? "Цілі року ще не задано." : "Цілі місяця ще не задано."}</p>`;
      if (!reviewed) {
        h += `<button class="gl-new" type="button" data-new="${kind}|${key}"><svg><use href="#i-plus"/></svg>Нова ціль</button>`;
        if (due) h += `<button class="btn btn--gold gl-review" type="button" data-review="${kind}|${key}">Провести ревю</button>`;
      }
      return h + `</section>`;
    };
    let h = seneschal() + section("m", M) + section("y", Y);
    pend.filter((t) => t.t === "review" && !(t.kind === "m" && t.key === M) && !(t.kind === "y" && t.key === Y)).forEach((t) => { h += section(t.kind, t.key); });

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
    const tbl = (list) => list.map((x) => `<li class="tier-${x.tier}"><svg><use href="#medal"/></svg><span class="gl-ref__n">${x.name}</span><span class="gl-ref__p">${x.min === 100 ? "100%" : `від ${x.min}%`}</span></li>`).join("");
    h += `<section class="gl-sec"><div class="gl-sec__head"><span class="gl-sec__kind">Медалі місяця</span></div><ul class="gl-ref">${tbl(D.MEDALS)}</ul>
      <div class="gl-sec__head gl-sec__head--sub"><span class="gl-sec__kind">Звання року</span></div><ul class="gl-ref">${tbl(D.TITLES)}</ul>
      <p class="gl-note">Нагороду визначає відсоток виконаних цілей. Тап по цілі — прогрес, значення й тип. Цілі можна правити до ревю; після — вони запечатуються.</p></section>`;
    box.innerHTML = h;
  }

  on("goalsBody", "click", (e) => {
    const dn = e.target.closest("[data-done]");
    if (dn) {
      const [kind, key, id] = dn.dataset.done.split("|"), P = peek(kind, key), it = P && P.items.find((i) => i.id === id);
      if (!it || P.res) return;
      if (it.done) { it.done = null; LOG = LOG.filter((x) => !(x.k === "goal" && x.gid === id)); saveLog(); FX.buzz("light"); }
      else { it.done = todayKey(); logPush({ k: "goal", gid: id, kind, key, t: it.t, d: it.done }); FX.play("yes", true); FX.buzz("medium"); }
      saveG(); renderGoals(); popGoal(id);
      return;
    }
    const pt = e.target.closest("[data-part]");
    if (pt) { const [kind, key, id, pid] = pt.dataset.part.split("|"); togglePart(kind, key, id, pid); return; }
    const nw = e.target.closest("[data-new]");
    if (nw) { const [kind, key] = nw.dataset.new.split("|"); openGoalSheet(kind, key, null); return; }
    const rv = e.target.closest("[data-review]");
    if (rv) { const [kind, key] = rv.dataset.review.split("|"); runQueue([{ t: "review", kind, key }]); return; }
    const op = e.target.closest("[data-open]");
    if (op) { const [kind, key, id] = op.dataset.open.split("|"); openGoalSheet(kind, key, id); }
  });
  function popGoal(id) {
    if (reduce) return;
    const li = document.querySelector(`.gl-it[data-open$="|${id}"]`);
    if (li && li.classList.contains("gl-it--early")) li.classList.add("gl-it--pop");
  }
  function togglePart(kind, key, id, pid) {
    const P = peek(kind, key), it = P && P.items.find((i) => i.id === id); if (!it || P.res) return;
    const p = (it.parts || []).find((x) => x.id === pid); if (!p || p.target) return;
    p.done = p.done ? null : todayKey();
    const closed = settle(it, kind, key); saveG();
    if (closed) FX.play("yes", true); FX.buzz(p.done ? "medium" : "light");
    renderGoals(); if (closed) popGoal(id);
    if (gsOpen) renderGoalSheet();
  }

  /* --------------------------------------------------------- шторка цілі -- */
  let gs = null, gsOpen = false, gsComposer = null;
  function openGoalSheet(kind, key, id) {
    gs = { kind, key, id }; gsOpen = true;
    renderGoalSheet();
    FX.play("open", true); FX.buzz("light");
    $("scrim") && $("scrim").classList.add("open");
    $("gSheet") && $("gSheet").classList.add("open");
  }
  function closeGoalSheet() {
    gsOpen = false; gsComposer = null;
    $("gSheet") && $("gSheet").classList.remove("open");
    if (!document.querySelector(".sheet.open, .confirm.open")) $("scrim") && $("scrim").classList.remove("open");
  }
  /* кругла кнопка «+1» для числових цілей */
  const plusBtn = (key, big) => `<button type="button" class="gs-plus${big ? " gs-plus--big" : ""}" data-step="1" data-sk="${key}" aria-label="Додати один">+</button>`;

  function renderGoalSheet() {
    const body = $("gsBody"); if (!body || !gs) return;
    const P = per(gs.kind, gs.key), lbl = periodLabel(gs.kind, gs.key);
    if (!gs.id) {
      body.innerHTML = `<div class="gs-kicker">Нова ціль · ${lbl}</div><div class="cmp" id="gsCmp"></div>
        <button class="btn btn--gold" type="button" data-gs="create">Додати ціль</button>
        <button class="btn btn--ghost" type="button" data-gs="close">Скасувати</button>`;
      gsComposer = composer($("gsCmp"));
      setTimeout(() => gsComposer && gsComposer.focus(), 350);
      return;
    }
    const it = P.items.find((i) => i.id === gs.id); if (!it) { closeGoalSheet(); return; }
    const t = tyOf(it), locked = !!P.res;
    let h = `<div class="gs-kicker">${locked ? "Запечатано · " : ""}${lbl}</div>
      <div class="gs-title">${esc(it.t)}</div>`;
    if (!locked) h += `<div class="cmp__types gs-types">${Object.keys(GT).map((k) => `<button type="button" data-gty="${k}" class="${k === t ? "is-on" : ""}">${GT[k].name}</button>`).join("")}</div>`;
    const withPlus = !locked && t === "count";
    h += `<p class="cmp__hint">${GT[t].hint}</p><div class="gs-detail${withPlus ? " gs-detail--plus" : ""}" data-stepbox="cur"><div>${detailHTML(it, gs.kind, gs.key, true)}</div>${withPlus ? plusBtn("cur", true) : ""}</div>`;
    if (!locked) {
      if (t === "once") h += `<button class="btn ${it.done ? "btn--ghost" : "btn--gold"}" type="button" data-gs="once">${it.done ? "Зняти позначку" : "Виконано"}</button>`;
      if (t === "count") h += `<div class="gs-row"><input type="text" inputmode="decimal" id="gsVal" placeholder="скільки є зараз"><button class="btn btn--gold" type="button" data-gs="setcur">Записати</button></div>
        <label class="gs-f">Ціль<input type="text" inputmode="decimal" id="gsTarget" value="${it.target || ""}"></label>`;
      if (t === "measure") h += `<div class="gs-row"><input type="text" inputmode="decimal" id="gsVal" placeholder="нове значення"><button class="btn btn--gold" type="button" data-gs="addval">Записати</button></div>
        <div class="cmp__ops">${Object.keys(OPS).map((o) => `<button type="button" data-gop="${o}" class="${o === it.op ? "is-on" : ""}">${OPS[o]} ${OPW[o]}</button>`).join("")}</div>
        <label class="gs-f">Ціль<input type="text" inputmode="decimal" id="gsTarget" value="${it.target || ""}"></label>`;
      if (t === "vows") h += `${vowChips(it.vows || null, "data-gvow")}<label class="gs-f">Стрік ≥<input type="text" inputmode="numeric" id="gsTarget" value="${it.target || ""}"></label>`;
      if (t === "stages") {
        h += `<ul class="gs-parts">${(it.parts || []).map((p) => `<li class="${partDone(p) ? "is-done" : ""}${p.target ? " is-num" : ""}" data-stepbox="${p.id}">
          ${p.target ? `<span class="gs-part__t">${esc(p.t)}</span><input type="text" inputmode="decimal" data-pcur="${p.id}" value="${p.cur || ""}" placeholder="0"><span class="gs-part__of">/ ${fmtN(p.target)}</span>${plusBtn(p.id)}`
                     : `<button type="button" class="gs-part__chk" data-ptog="${p.id}"></button><span class="gs-part__t">${esc(p.t)}</span>`}
          <button type="button" class="gs-x" data-prm="${p.id}" aria-label="Прибрати частину"><svg><use href="#i-x"/></svg></button></li>`).join("")}</ul>
          <div class="gs-row gs-row--part"><input type="text" id="gsPartT" placeholder="нова частина"><input type="text" inputmode="decimal" id="gsPartN" placeholder="число?"><button class="btn btn--line" type="button" data-gs="addpart">+</button></div>`;
      }
    }
    const hist = (it.hist || []).slice().reverse().slice(0, 8);
    if (hist.length) h += `<div class="gs-h">Записи</div><ul class="gs-hist">${hist.map((x) => `<li><span>${fmtKey(x.d)}</span><b>${fmtN(x.v)}</b></li>`).join("")}</ul>`;
    if (!locked) h += `<button class="btn btn--reset gs-del" type="button" data-gs="delete">Видалити ціль</button>`;
    h += `<button class="btn btn--ghost" type="button" data-gs="close">Закрити</button>`;
    body.innerHTML = h;
  }
  /* «Обітниці» закриваються назавжди, але зміна умов (вибір, число) — це вже інша ціль: перевіряємо наново */
  function unDone(it) { if (!it.done) return; it.done = null; LOG = LOG.filter((x) => !(x.k === "goal" && x.gid === it.id)); saveLog(); }
  /* змінити число лічильника (key = "cur") або числової частини етапу (key = id частини) */
  function stepApply(it, key, fn) {
    const td = todayKey();
    if (key === "cur") {
      it.cur = Math.max(0, fn(it.cur || 0)); it.hist = it.hist || [];
      const last = it.hist[it.hist.length - 1]; if (last && last.d === td) last.v = it.cur; else it.hist.push({ d: td, v: it.cur });
    } else {
      const p = (it.parts || []).find((x) => x.id === key); if (!p) return;
      p.cur = Math.max(0, fn(p.cur || 0)); p.done = partDone(p) ? (p.done || td) : null;
    }
    gsAfter(it);
    const box = document.querySelector(`#gSheet [data-stepbox="${key}"]`); if (box && !reduce) box.classList.add("pop");
  }
  function gsAfter(it, msg) {
    const closed = settle(it, gs.kind, gs.key); saveG();
    FX.play(closed ? "yes" : "add", true); FX.buzz(closed ? "heavy" : "medium");
    renderGoalSheet(); renderGoals(); if (closed) popGoal(it.id);
  }
  on("gSheet", "click", (e) => {
    if (!gs) return;
    const P = per(gs.kind, gs.key), it = gs.id ? P.items.find((i) => i.id === gs.id) : null;
    const a = e.target.closest("[data-gs]"), act = a && a.dataset.gs;
    if (act === "close") { closeGoalSheet(); return; }
    if (act === "create") {
      const n = gsComposer && gsComposer.read(); if (!n) { FX.buzz("light"); return; }
      P.items.push(n); settle(n, gs.kind, gs.key); saveG(); FX.play("add", true); FX.buzz("medium");
      closeGoalSheet(); renderGoals(); updateGoalsDot(); return;
    }
    if (!it || P.res) return;
    const stp = e.target.closest("[data-step]");
    if (stp) { const d = +stp.dataset.step; stepApply(it, stp.dataset.sk, (c) => c + d); return; }
    const gty = e.target.closest("[data-gty]");
    if (gty && gty.dataset.gty !== tyOf(it)) {
      const nt = gty.dataset.gty, keep = { id: it.id, t: it.t };
      if (it.done && nt === "once") keep.done = it.done;
      Object.keys(it).forEach((k) => delete it[k]); Object.assign(it, keep, blankFor(nt, keep.t, null));
      LOG = LOG.filter((x) => !(x.k === "goal" && x.gid === it.id && !it.done)); saveLog();
      gsAfter(it); return;
    }
    const gop = e.target.closest("[data-gop]");
    if (gop) { it.op = gop.dataset.gop; saveG(); renderGoalSheet(); renderGoals(); FX.buzz("light"); return; }
    const gv = e.target.closest("[data-gvow]");
    if (gv) {
      const r = toggleVow(it.vows || null, gv.dataset.gvow); if (r === false) { FX.buzz("medium"); return; }
      if (r) it.vows = r; else delete it.vows;
      unDone(it); gsAfter(it); return;
    }
    const ptog = e.target.closest("[data-ptog]");
    if (ptog) { togglePart(gs.kind, gs.key, it.id, ptog.dataset.ptog); return; }
    const prm = e.target.closest("[data-prm]");
    if (prm) { it.parts = it.parts.filter((p) => p.id !== prm.dataset.prm); gsAfter(it); return; }
    if (act === "once") {
      if (it.done) { it.done = null; LOG = LOG.filter((x) => !(x.k === "goal" && x.gid === it.id)); saveLog(); saveG(); FX.buzz("light"); renderGoalSheet(); renderGoals(); }
      else { it.done = todayKey(); logPush({ k: "goal", gid: it.id, kind: gs.kind, key: gs.key, t: it.t, d: it.done }); saveG(); FX.play("yes", true); FX.buzz("medium"); renderGoalSheet(); renderGoals(); popGoal(it.id); }
      return;
    }
    if (act === "setcur" || act === "addval") {
      const v = numIn($("gsVal") && $("gsVal").value); if (v == null) { $("gsVal") && $("gsVal").focus(); return; }
      it.hist = it.hist || []; const td = todayKey();
      const same = it.hist.length && it.hist[it.hist.length - 1].d === td;
      if (same) it.hist[it.hist.length - 1].v = v; else it.hist.push({ d: td, v });
      if (act === "setcur") it.cur = v;
      gsAfter(it); return;
    }
    if (act === "addpart") {
      const tt = ($("gsPartT").value || "").trim(); if (!tt) { $("gsPartT").focus(); return; }
      const n = numIn($("gsPartN").value);
      it.parts = it.parts || []; it.parts.push({ id: uid(), t: tt, target: n > 0 ? n : null, cur: 0 });
      gsAfter(it); return;
    }
    if (act === "delete") {
      if (!confirm("Видалити ціль «" + it.t + "»?")) return;
      P.items = P.items.filter((i) => i.id !== it.id); LOG = LOG.filter((x) => !(x.k === "goal" && x.gid === it.id)); saveLog(); saveG();
      FX.buzz("medium"); closeGoalSheet(); renderGoals(); updateGoalsDot();
    }
  });
  on("gSheet", "change", (e) => {
    if (!gs || !gs.id) return;
    const P = per(gs.kind, gs.key), it = P.items.find((i) => i.id === gs.id); if (!it || P.res) return;
    if (e.target.id === "gsTarget") { const v = numIn(e.target.value); if (v > 0) { it.target = v; if (tyOf(it) === "vows") unDone(it); gsAfter(it); } return; }
    const pc = e.target.closest("[data-pcur]");
    if (pc) { const p = it.parts.find((x) => x.id === pc.dataset.pcur); const v = numIn(pc.value); if (p) { p.cur = v || 0; p.done = partDone(p) ? (p.done || todayKey()) : null; gsAfter(it); } }
  });
  on("gSheet", "keydown", (e) => {
    if (e.key !== "Enter" || !gs) return;
    if (e.target.id === "gsVal") { e.preventDefault(); const b = document.querySelector('#gSheet [data-gs="setcur"], #gSheet [data-gs="addval"]'); if (b) b.click(); }
    if (e.target.id === "gsPartT" || e.target.id === "gsPartN") { e.preventDefault(); const b = document.querySelector('#gSheet [data-gs="addpart"]'); if (b) b.click(); }
    if (e.target.dataset && e.target.dataset.pcur != null) { e.preventDefault(); e.target.blur(); }
  });

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
        ? (key === "2026" ? "До кінця 2026. По одній; тип підкажу з тексту. 31 грудня ти чесно відмітиш кожну, і рік отримає звання."
                          : "На весь рік. По одній; тип підкажу з тексту. 31 грудня ти чесно відмітиш кожну, і рік отримає звання.")
        : `Весь ${monthName(key)}. По одній; тип підкажу з тексту. Останнього числа — ревю й медаль.`;
      const list = $("enList"), done = $("enDone"), cmpBox = $("enComposer");
      const cmp = composer(cmpBox);
      const draw = (anim) => {
        if (list) list.innerHTML = P.items.map((it, i) => `<li class="${anim && i === P.items.length - 1 ? "is-new" : ""}"><div><span>${esc(it.t)}</span><em>${GT[tyOf(it)].name}${tyOf(it) === "count" || tyOf(it) === "vows" ? ` · ${fmtN(it.target)}` : tyOf(it) === "measure" ? ` · ${OPS[it.op]} ${fmtN(it.target)}` : tyOf(it) === "stages" ? ` · ${it.parts.length} ${pluralUk(it.parts.length, ["частина", "частини", "частин"])}` : ""}</em></div></li>`).join("");
        if (done) done.hidden = !P.items.length;
      };
      draw(false);
      const add = () => {
        const it = cmp.read(); if (!it) { FX.buzz("light"); return; }
        P.items.push(it); settle(it, kind, key); saveG(); cmp.reset(); draw(true);
        FX.play("add", true); FX.buzz("medium"); cmp.focus();
      };
      const finish = (skip) => { if (skip && !P.items.length) P.skip = true; saveG(); cleanup(); resolve(); };
      const onAdd = () => add();
      const onDone = () => { FX.play("yes", true); FX.buzz("medium"); finish(false); };
      const onLater = () => { FX.buzz("light"); finish(true); };
      const cleanup = () => { $("enAdd").removeEventListener("click", onAdd); done.removeEventListener("click", onDone); $("enLater").removeEventListener("click", onLater); const a = document.activeElement; if (a && a.blur) a.blur(); };
      $("enAdd").addEventListener("click", onAdd); done.addEventListener("click", onDone); $("enLater").addEventListener("click", onLater);
      riteShow("riteEntry");
    });
  }
  function reviewTask(kind, key) {
    return new Promise(async (resolve) => {
      const P = per(kind, key), res = {};
      settleAll();
      const k = $("rvKicker"); if (k) k.textContent = kind === "y" ? `Ревю року · ${key}` : `Ревю · ${monthName(key)}`;
      const card = $("rvCard"), txt = $("rvText"), stamp = $("rvStamp"), cnt = $("rvCount"), yes = $("rvYes"), no = $("rvNo"), ex = $("rvExtra");
      const lastDay = kind === "y" ? `${key}-12-31` : `${key}-${pad(daysIn(key))}`;
      await riteShow("riteReview");
      for (let i = 0; i < P.items.length; i++) {
        const it = P.items[i], t = tyOf(it);
        if (cnt) cnt.textContent = `${i + 1} з ${P.items.length}`;
        if (txt) txt.textContent = it.t;
        if (ex) ex.innerHTML = "";
        [yes, no].forEach((b) => { if (b) b.classList.remove("is-suggest"); });
        if (stamp) { stamp.className = "rv__stamp"; stamp.textContent = ""; }
        if (card) { card.classList.remove("out"); void card.offsetWidth; card.classList.add("in"); }
        if (complete(it) && it.done) {
          [yes, no].forEach((b) => { if (b) b.disabled = true; });
          if (ex && t !== "once") ex.innerHTML = detailHTML(it, kind, key, true);
          res[it.id] = true;
          await wait(900);
          if (stamp) { stamp.textContent = it.done < lastDay ? `Достроково · ${fmtKey(it.done)}` : "Виконано"; stamp.className = "rv__stamp is-yes is-early"; }
          FX.play("yes", true); FX.buzz("light");
          await wait(2400);
          if (card) { card.classList.remove("in"); card.classList.add("out"); }
          await wait(800);
          continue;
        }
        let mInput = null;
        if (ex) {
          if (t === "measure") {
            const lv = lastVal(it);
            ex.innerHTML = `<div class="rv__m">ціль: ${OPW[it.op]} ${fmtN(it.target)}${lv ? ` · останнє ${fmtN(lv.v)} (${fmtKey(lv.d)})` : ""}</div>
              <label class="rv__f">Підсумкове значення<input type="text" inputmode="decimal" id="rvVal" value="${lv ? lv.v : ""}" placeholder="—"></label>`;
            mInput = $("rvVal");
            const suggest = () => { const v = numIn(mInput.value); const ok = v != null && cmpOk(v, it.op, it.target);
              yes.classList.toggle("is-suggest", v != null && ok); no.classList.toggle("is-suggest", v != null && !ok); };
            mInput.addEventListener("input", suggest); suggest();
          } else if (t !== "once") ex.innerHTML = detailHTML(it, kind, key, true);
        }
        [yes, no].forEach((b) => { if (b) b.disabled = false; });
        const ok = await new Promise((r) => {
          const y = () => { cl(); r(true); }, n = () => { cl(); r(false); };
          const cl = () => { yes.removeEventListener("click", y); no.removeEventListener("click", n); };
          yes.addEventListener("click", y); no.addEventListener("click", n);
        });
        if (mInput) { const v = numIn(mInput.value); const lv = lastVal(it); if (v != null && (!lv || lv.v !== v)) { it.hist = it.hist || []; it.hist.push({ d: todayKey(), v }); } }
        [yes, no].forEach((b) => { if (b) { b.disabled = true; b.classList.remove("is-suggest"); } });
        res[it.id] = ok;
        if (ok && !it.done) { it.done = todayKey(); logPush({ k: "goal", gid: it.id, kind, key, t: it.t, d: it.done }); }
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
    closeGoalSheet();
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
  const SEALED = D.SEALED || "";
  const unseal = () => { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(SEALED), (c) => c.charCodeAt(0)))); } catch (e) { return null; } };
  const PRIMARY = (D.APP_CONFIG && D.APP_CONFIG.primaryVow) || "";
  const yearVow = () => D.VOWS.find((v) => v.id === PRIMARY && streak(v) === 365) || D.VOWS.find((v) => streak(v) === 365) || null;

  /* ---- вітраж-розетка за ритуалом: генерується кодом, 12 пелюсток ---- */
  (function rosette() {
    const intro = $("intro"); if (!intro) return;
    const P = (d, k) => `<path pathLength="1" d="${d}"${k ? ` class="${k}"` : ""}/>`, C = (x, y, r, k) => `<circle pathLength="1" cx="${x}" cy="${y}" r="${r}"${k ? ` class="${k}"` : ""}/>`;
    const petal = P("M-7.5 -34 V-60 C-7.5 -76 -3 -84 0 -90 C3 -84 7.5 -76 7.5 -60 V-34 C5 -37 -5 -37 -7.5 -34 Z") +
      C(0, -72, 3.6) + P("M-4 -54 C-4 -60 -2 -63 0 -66 C2 -63 4 -60 4 -54", "r-in") + P("M0 -30 L0 -34", "r-in");
    const spoke = P("M0 -31 V-94", "r-thin") + C(0, -86, 2.6) + C(0, -63, 1.6, "r-in");
    const lobe = C(0, -20.5, 7.5) + C(0, -20.5, 3, "r-in");
    let g = "";
    for (let i = 0; i < 12; i++) g += `<g transform="rotate(${i * 30})">${petal}</g><g transform="rotate(${i * 30 + 15})">${spoke}</g>`;
    for (let i = 0; i < 6; i++) g += `<g transform="rotate(${i * 60})">${lobe}</g>`;
    const svg = `<svg class="rosette" viewBox="-100 -100 200 200" aria-hidden="true">${C(0, 0, 98)}${C(0, 0, 94.5, "r-thin")}${C(0, 0, 31)}${C(0, 0, 12.5)}${g}` +
      `${C(0, 0, 5.2)}${P("M0 -5.2 V5.2 M-5.2 0 H5.2", "r-in")}</svg>`;
    intro.insertAdjacentHTML("afterbegin", `<div class="rose-wrap" aria-hidden="true">${svg}</div><div class="godrays" aria-hidden="true"></div>`);
  })();

  /* ================================================================ РИТУАЛ == */
  let timers = [], introDone = false, sealWait = null, guardUntil = 0, afterRitual = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const STAGES = ["stDate", "stQuote", "stKeeper", "stMs", "stSign", "stSeal", "stYear"];
  function reveal() {
    introDone = true; sealWait = null; clearTimers();
    const intro = $("intro"); if (intro) { intro.setAttribute("hidden", ""); intro.classList.remove("sealed"); }
    const b = $("board"); if (b) { b.classList.remove("reveal"); void b.offsetWidth; b.classList.add("reveal"); }
    document.body.classList.remove("in-rite");
    countUp();
    setTimeout(verToast, reduce ? 50 : 1400);
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
        const u = $("yrUnit"); if (u) u.textContent = yv.id === PRIMARY ? part.unit : `${part.unit} · ${yv.name}`;
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
  /* хто говорить зранку: ~30% — свічка з цитатою; решта — хранителі обітниць
     (ближчі до віхи чи щойно після зриву — частіше); рідко — легендарна поява Верховного з діалогом */
  function morningVoice(legendary) {
    const H = window.ORDO_HALL;
    if (legendary || !H || !D.KEEPERS) return { mode: "candle" };
    const r = Math.random();
    if (r < 0.30) return { mode: "candle" };
    if (r < 0.36 && D.SUPREME_MORNING) return { mode: "supreme" };
    const since2 = keyOf(new Date(Date.now() - 2 * 86400000));
    const pool = D.VOWS.filter((v) => D.KEEPERS[v.id]).map((v) => {
      const s = streak(v), nm = nextMilestone(s); let w = 1;
      if (nm && nm - s <= 7) w *= 4;
      if (LOG.some((e) => e.k === "breach" && e.v === v.id && e.d >= since2)) w *= 3;
      return { v, w };
    });
    let x = Math.random() * pool.reduce((a, q) => a + q.w, 0);
    for (const q of pool) { x -= q.w; if (x <= 0) return { mode: "keeper", v: q.v }; }
    return { mode: "candle" };
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
    const voice = morningVoice(legendary);
    const ql = $("qLegend"); if (ql) ql.hidden = !legendary;
    const sq0 = $("stQuote"); if (sq0) sq0.classList.toggle("legendary", legendary);
    if (voice.mode === "candle") { const qt = $("qText"); if (qt) qt.textContent = legendary ? LQ[h % LQ.length] : nextQuote(); }
    if (voice.mode === "keeper") {
      const K = D.KEEPERS[voice.v.id];
      const f = $("kpFig"); if (f) { f.innerHTML = window.ORDO_HALL.figure({ icon: voice.v.icon }); f.classList.remove("drawn"); }
      const kn = $("kpName"); if (kn) kn.textContent = K.name;
      const kt = $("kpTitle"); if (kt) kt.textContent = K.title;
      const kl = $("kpLine"); if (kl) kl.textContent = window.ORDO_HALL.fresh("keeper." + voice.v.id, K.lines, 6).v;
    }
    const first = voice.mode === "keeper" ? "stKeeper" : voice.mode === "candle" ? "stQuote" : null;

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

    /* решта ритуалу (віхи, знаки, табло) — від моменту t */
    const rest = (t, prevId) => {
      ms.forEach((m, i) => {
        timers.push(setTimeout(() => {
          if (i === 0 && prevId) { const sq = $(prevId); if (sq) sq.classList.add("gone"); }
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
          if (i === 0) { const prev = $(ms.length ? "stMs" : prevId); if (prev) prev.classList.add("gone"); }
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
    };

    if (voice.mode === "supreme") {
      /* легендарна поява: ритуал чекає, поки триває розмова */
      timers.push(setTimeout(async () => {
        await window.ORDO_HALL.morningSupreme();
        if (!introDone) rest(400, null);
      }, t + 400));
      return;
    }
    timers.push(setTimeout(() => {
      const sq = $(first); if (sq) sq.classList.add("show");
      if (first === "stKeeper") { const f = $("kpFig"); if (f) requestAnimationFrame(() => f.classList.add("drawn")); FX.play("sign"); }
      else FX.play("quote");
    }, t + 400));
    t += P.quote + 900 + (legendary ? 1200 : 0) + (first === "stKeeper" ? 2200 : 0);
    rest(t, first);
  }
  const onSkip = () => {
    if (sealWait) { sealWait(); return; }
    if (performance.now() < guardUntil) return;
    if (!introDone) reveal();
  };
  on("intro", "pointerdown", onSkip);
  on("intro", "keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSkip(); } });
  on("replay", "click", () => { FX.unlock(); FX.buzz("light"); $("board") && $("board").classList.remove("reveal"); runIntro(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeConfirm(); closeSheet(); closeMark(); closeProto(); closeGoalSheet(); } });

  /* ---- старт + щоденна синхронізація ---- */
  let shownDay = null;
  function sync() {
    const today = todayKey(), dayChanged = shownDay !== today;
    if (dayChanged) { STARTS = loadStarts(); settleAll(); renderBoard(); updateGoalsDot(); if (TAB === "stats") renderStats(); if (TAB === "goals") renderGoals(); }
    if (LS.get("ordo.lastIntro", "") !== today) { LS.set("ordo.lastIntro", today); runIntro(); }
    else {
      if (dayChanged) { $("intro") && $("intro").setAttribute("hidden", ""); $("board") && $("board").classList.add("reveal"); }
      /* ритуал сьогодні вже був — але цілі чи ревю, що чекають, відкриваються при будь-якому вході */
      const intro = $("intro"), idle = !intro || intro.hasAttribute("hidden");
      if (idle && !queueBusy) { const tasks = pendingTasks(); if (tasks.length) setTimeout(() => { if (!queueBusy) runQueue(tasks); }, reduce ? 50 : 1200); }
    }
    shownDay = today;
    setTimeout(verToast, reduce ? 50 : 900);
    nightTick();
  }

  /* ---- знак оновлення: коротка печатка вгорі, коли приїхала нова версія ---- */
  function verToast() {
    if (!verNews) return;
    const intro = $("intro"); if (intro && !intro.hasAttribute("hidden")) return;   // покажемо після ритуалу
    verNews = false;
    const el = document.createElement("div"); el.className = "vtoast"; el.setAttribute("role", "status");
    el.innerHTML = `<svg><use href="#sigil"/></svg><span>Звід оновлено · v${VER}</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 1000); }, 3400);
  }

  /* ---- світляний пил над гербом; після 21:00 — повільні жарини свічки ---- */
  function nightTick() { const h = new Date().getHours(), n = h >= 21 || h < 5; document.body.classList.toggle("is-night", n); FX.setNight(n); }
  (function motes() {
    const crest = document.querySelector(".crest"); if (!crest || reduce) return;
    const box = document.createElement("div"); box.className = "motes"; box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 16; i++) {
      const m = document.createElement("i"), d = 9 + Math.random() * 8;
      m.className = "mote";
      m.style.cssText = `--x:${(8 + Math.random() * 84).toFixed(1)}%;--s:${(2 + Math.random() * 3).toFixed(1)}px;--d:${d.toFixed(1)}s;` +
        `--dl:${(-Math.random() * d).toFixed(1)}s;--dx:${(Math.random() * 36 - 18).toFixed(0)}px;--o:${(.35 + Math.random() * .5).toFixed(2)}`;
      box.appendChild(m);
    }
    crest.prepend(box);
    setInterval(nightTick, 60000);
  })();
  renderSound();
  sync();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) sync(); });
  /* ---- оновлення: нова версія на сервері → тихе перезавантаження, коли ніщо не відкрито ---- */
  if ("serviceWorker" in navigator) {
    const sw = navigator.serviceWorker;
    let hadCtl = !!sw.controller, reloadPending = false, reloading = false;
    const calm = () => {
      const intro = $("intro"), a = document.activeElement;
      return !queueBusy && (!intro || intro.hasAttribute("hidden")) && !document.querySelector(".sheet.open, .confirm.open, .rite.open")
        && !(a && /^(INPUT|TEXTAREA)$/.test(a.tagName));
    };
    const reloadNow = () => { if (reloading) return; reloading = true; location.reload(); };
    sw.addEventListener("controllerchange", () => {
      if (!hadCtl) { hadCtl = true; return; }   // перша установка — сторінка вже свіжа
      if (document.visibilityState === "hidden" || calm()) reloadNow(); else reloadPending = true;
    });
    document.addEventListener("visibilitychange", () => {
      if (reloadPending && (document.visibilityState === "hidden" || calm())) { reloadNow(); return; }
      if (document.visibilityState === "visible") sw.getRegistration().then((r) => r && r.update()).catch(() => {});
    });
    window.addEventListener("load", () => sw.register("sw.js", { updateViaCache: "none" }).catch(() => {}));
  }

  /* ---- для Зали храмовників (hall.js) ---- */
  window.ORDO_API = { D, FX, streak, nextMilestone, todayKey, logPush: (e) => { logPush(e); if (TAB === "stats") renderStats(); } };
};
