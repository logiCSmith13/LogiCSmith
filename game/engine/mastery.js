/* FRACTURA — mastery, spaced repetition, XP and the parent Ledger numbers.
   Stored in localStorage for the prototype; production keeps this server-side,
   fed only by server-validated solves. */
(function (global) {
  "use strict";
  const KEY = "fractura.save.v1";
  const LR = 0.3;   // how fast mastery moves toward the latest solve quality

  const fresh = () => ({ xp: 0, coins: 0, streak: 0, lastDay: null, h: {}, history: [], codex: [], examSolves: 0, examClean: 0, created: Date.now() });
  let s = load();

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* private mode etc. */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

  function touchStreak() {
    const today = dayKey(Date.now());
    if (s.lastDay === today) return;
    const yesterday = dayKey(Date.now() - 864e5);
    s.streak = s.lastDay === yesterday ? s.streak + 1 : 1;
    s.lastDay = today;
  }
  function hs(h) { return s.h[h] || (s.h[h] = { p: 0, attempts: 0, clean: 0, last: 0 }); }

  // Difficulty tier follows mastery, not time played.
  function levelFor(h) { const x = hs(h); return x.p < 0.4 ? 1 : x.p < 0.75 ? 2 : 3; }

  // A Rift is always solved eventually; "quality" measures independence.
  function record(rift, r) {
    const x = hs(rift.heuristic);
    const before = x.p;
    const slips = (r.hints || 0) + (r.errors || 0);
    const clean = slips === 0;
    const quality = clean ? 1 : slips <= 2 ? 0.7 : 0.4;
    x.p = Math.max(0, Math.min(1, x.p + LR * (quality - x.p)));
    x.attempts++; if (clean) x.clean++; x.last = Date.now();
    const xp = Math.round(rift.marks * 10 * quality) + (r.seconds < 90 ? 5 : 0) + (r.exam ? 10 : 0) + (r.due ? 10 : 0);
    const coins = Math.round(xp / 2);
    s.xp += xp; s.coins += coins; touchStreak();
    if (r.exam) { s.examSolves++; if (clean) s.examClean++; }
    s.history.push({ t: Date.now(), h: rift.heuristic, q: quality, exam: !!r.exam, marks: rift.marks, secs: r.seconds });
    if (s.history.length > 600) s.history.shift();
    s.codex.unshift({ t: Date.now(), h: rift.heuristic, word: rift.word, answer: rift.answer, exam: !!r.exam });
    if (s.codex.length > 40) s.codex.pop();
    save();
    return { xp, coins, before, after: x.p, perfect: clean };
  }

  function level(xp) { return Math.floor(Math.sqrt(xp / 50)) + 1; }
  function levelProgress(xp) { const l = level(xp), lo = (l - 1) * (l - 1) * 50, hi = l * l * 50; return (xp - lo) / (hi - lo); }

  // Spaced repetition: 1 → 3 → 7 days by mastery ("keep the forge hot").
  function isDue(h) {
    const x = s.h[h]; if (!x || !x.attempts) return false;
    const days = (Date.now() - x.last) / 864e5;
    const interval = x.p >= 0.75 ? 7 : x.p >= 0.5 ? 3 : 1;
    return days >= interval;
  }
  function dueOrder(keys) { return keys.slice().sort((a, b) => (isDue(b) - isDue(a)) || (hs(a).p - hs(b).p)); }

  // Predicted PSLE Achievement Level. PLACEHOLDER: maps mean heuristic mastery straight onto the MOE AL table.
  // Production calibrates this against Paper Bridge exam sims and (with consent) real test scores. Say so in the UI.
  function predictedAL() {
    const keys = Object.keys(global.FracturaProblems.HEURISTICS);
    const attempted = keys.filter((k) => s.h[k] && s.h[k].attempts > 0);
    if (attempted.length < 3) return { band: "—", score: null, coverage: attempted.length / keys.length, note: `Play at least 3 different isles to unlock an estimate (${attempted.length}/3).` };
    const mean = keys.reduce((acc, k) => acc + (s.h[k] ? s.h[k].p : 0), 0) / keys.length;   // unplayed isles count as 0 → conservative
    const score = Math.round(mean * 100);
    const band = score >= 90 ? "AL1" : score >= 85 ? "AL2" : score >= 80 ? "AL3" : score >= 75 ? "AL4" : score >= 65 ? "AL5" : score >= 45 ? "AL6" : score >= 20 ? "AL7" : "AL8";
    return { band, score, coverage: attempted.length / keys.length, note: "Uncalibrated estimate from in-game mastery. Unplayed isles count as zero, so this rises as coverage grows." };
  }

  function activity(days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(Date.now() - i * 864e5);
      out.push({ day: key, n: s.history.filter((e) => dayKey(e.t) === key).length });
    }
    return out;
  }
  function reset() { s = fresh(); save(); }

  global.FracturaMastery = { state: () => s, record, levelFor, level, levelProgress, isDue, dueOrder, predictedAL, activity, reset, save };
})(typeof window !== "undefined" ? window : globalThis);
