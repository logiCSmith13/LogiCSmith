/* FRACTURA — playable vertical slice of Forge Mode (DOM-based).
   Screens: title → map → rift → decode; plus ledger (parents) and codex.
   The 3D production build replaces the rendering here but must keep the
   same engine contract (engine/*.js). */
(function (global) {
  "use strict";
  const P = global.FracturaProblems, M = global.FracturaMastery, V = global.FracturaModel;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const button = (label, fn, cls) => { const b = el("button", cls || "btn-primary", label); b.type = "button"; b.onclick = fn; return b; };

  const S = { rift: null, exam: false, due: false, hints: 0, errors: 0, startedAt: 0, step: 0, queue: null, locked: false, build: null, split: null, scan: null, recipe: null, onStep: null };

  // ---------- navigation ----------
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== "screen-" + id));
    window.scrollTo(0, 0);
    renderHud();
    if (id === "map") renderMap();
    if (id === "ledger") renderLedger();
    if (id === "codex") renderCodex();
  }
  function renderHud() {
    const s = M.state();
    $("#hud-level").textContent = "Lv " + M.level(s.xp);
    $("#hud-xp").style.width = Math.round(M.levelProgress(s.xp) * 100) + "%";
    $("#hud-coins").textContent = s.coins;
    $("#hud-streak").textContent = s.streak;
  }

  // Names: game names in scene-first mode, exam names in Blueprint-first mode.
  const nameOf = (row) => (S.exam ? row.exam : row.game);
  function t(str) { let out = String(str); (S.rift.rows || []).forEach((row) => { out = out.split("{" + row.key + "}").join(nameOf(row)); }); return out; }
  const stepQ = (st) => (S.exam && st.qx ? st.qx : st.q);
  const stepHint = (st) => (S.exam && st.hx ? st.hx : st.hint);

  // ---------- map ----------
  function renderMap() {
    const wrap = $("#isles"); wrap.innerHTML = "";
    const s = M.state();
    P.ORDER.forEach((h) => {
      const H = P.HEURISTICS[h], hs = s.h[h] || { p: 0, attempts: 0 };
      const due = M.isDue(h), pct = Math.round(hs.p * 100);
      const card = el("button", "isle" + (due ? " due" : ""));
      card.type = "button";
      card.innerHTML = `<div class="isle-emoji">${H.emoji}</div><div class="isle-body"><div class="isle-name">${esc(H.isle)}</div><div class="isle-sub">${esc(H.name)}</div><div class="isle-gear">🧰 ${esc(H.gear)} · tier ${M.levelFor(h)}</div><div class="bar"><div style="width:${pct}%"></div></div><div class="isle-meta">Mastery ${pct}% · ${hs.attempts} Rift${hs.attempts === 1 ? "" : "s"}${due ? " · 🔁 forge is cooling — double coins" : ""}${hs.p >= 0.5 ? " · 📜 Blueprint-first unlocked" : ""}</div></div>`;
      card.onclick = () => { S.queue = null; startRift(h); };
      wrap.appendChild(card);
    });
    const al = M.predictedAL();
    $("#al-pill").textContent = al.score == null ? "Predicted band: play 3 isles to unlock" : `Predicted band ${al.band} (est.)`;
  }
  function startStorm() {
    const order = M.dueOrder(P.ORDER);
    S.queue = { items: order.slice(0, 5), i: 0 };
    nextInQueue();
  }
  function nextInQueue() {
    if (S.queue && S.queue.i < S.queue.items.length) startRift(S.queue.items[S.queue.i++]);
    else { S.queue = null; show("map"); }
  }

  // ---------- rift ----------
  function startRift(h) {
    const s = M.state(), hs = s.h[h] || { p: 0, attempts: 0 };
    S.due = M.isDue(h);
    S.rift = P.generate(h, M.levelFor(h));
    S.exam = hs.p >= 0.5 && hs.attempts % 3 === 2;   // transfer ladder rung 2
    renderRift();
    show("rift");
  }
  function renderRift() {
    const r = S.rift, H = P.HEURISTICS[r.heuristic];
    Object.assign(S, { locked: false, step: 0, hints: 0, errors: 0, startedAt: Date.now(), onStep: null });
    $("#rift-isle").textContent = `${H.emoji} ${H.isle}`;
    $("#rift-gear").textContent = `🧰 ${H.gear} · ${r.marks} mark${r.marks > 1 ? "s" : ""} · tier ${r.level}${S.due ? " · 🔁 review" : ""}`;
    $("#rift-badge").hidden = !S.exam;
    const brief = $("#rift-brief");
    brief.textContent = S.exam ? r.word : r.hook;
    brief.className = "brief " + (S.exam ? "exam" : "game");
    const area = $("#rift-area"); area.innerHTML = ""; area.className = "forge";
    const fb = $("#feedback"); fb.textContent = ""; fb.className = "feedback";
    $("#steps").innerHTML = ""; $("#steps").hidden = true;
    ({ builder: renderBuilder, split: renderSplit, scanner: renderScanner, rewind: renderRewind, recipe: renderRecipe })[r.mode](area);
  }
  function fail(msg) {
    S.errors++;
    const fb = $("#feedback"); fb.textContent = "Not yet — " + msg; fb.className = "feedback bad";
    const area = $("#rift-area"); area.classList.add("shake"); setTimeout(() => area.classList.remove("shake"), 450);
  }
  function lockAndSteps(msg) {
    S.locked = true;
    $("#rift-area").classList.add("locked");
    const fb = $("#feedback"); fb.textContent = "✨ " + msg; fb.className = "feedback ok";
    renderSteps();
  }

  // Builder: rows of unit blocks + extra pieces + known-value chips.
  function renderBuilder(area) {
    const r = S.rift;
    S.build = { rows: {}, placed: {}, selected: null };
    r.rows.forEach((row) => (S.build.rows[row.key] = { units: 0, extra: false }));
    area.appendChild(el("p", "tip", "Tap <b>+ block</b> to add equal units. <b>+ extra</b> adds a 'more than' piece. Then tap a known value, and tap where it belongs."));
    const rowsWrap = el("div", "rows"); area.appendChild(rowsWrap);
    const tray = el("div", "tray"); area.appendChild(tray);
    area.appendChild(button("⚒️ Reforge", () => {
      if (S.locked) return;
      const res = V.validateBuilder(r, S.build);
      res.ok ? lockAndSteps("The model holds. Now the numbers.") : fail(t(res.problems[0]));
    }));
    const placedLabel = (target) => { const id = Object.keys(S.build.placed).find((k) => S.build.placed[k] === target); return id ? r.knowns.find((k) => k.id === id).label : null; };
    const unplace = (target) => Object.keys(S.build.placed).forEach((id) => { if (S.build.placed[id] === target) delete S.build.placed[id]; });
    const dropOn = (target) => { if (S.locked) return; if (S.build.selected) { unplace(target); S.build.placed[S.build.selected] = target; S.build.selected = null; } else unplace(target); draw(); };
    function draw() {
      rowsWrap.innerHTML = "";
      r.rows.forEach((row) => {
        const st = S.build.rows[row.key];
        const line = el("div", "row");
        line.appendChild(el("div", "row-name", `${row.emoji} ${esc(nameOf(row))}`));
        const bar = el("div", "bar-blocks");
        for (let i = 0; i < st.units; i++) bar.appendChild(el("div", "blk unit", "1 unit"));
        if (st.extra) { const lab = placedLabel("extra:" + row.key); const x = el("div", "blk extra target", lab ? esc(lab) : "extra ?"); x.onclick = () => dropOn("extra:" + row.key); bar.appendChild(x); }
        if (!st.units && !st.extra) bar.appendChild(el("div", "blk ghost", "empty"));
        line.appendChild(bar);
        const ctl = el("div", "row-ctl");
        [["+ block", () => { if (st.units < 12) st.units++; }], ["− block", () => { if (st.units > 0) st.units--; }], [st.extra ? "− extra" : "+ extra", () => { st.extra = !st.extra; if (!st.extra) unplace("extra:" + row.key); }]]
          .forEach(([label, fn]) => ctl.appendChild(button(label, () => { if (S.locked) return; fn(); draw(); }, "btn-mini")));
        line.appendChild(ctl);
        rowsWrap.appendChild(line);
      });
      const tl = placedLabel("total");
      const tot = el("div", "bracket target" + (tl ? " filled" : ""), tl ? `⟵ altogether: ${esc(tl)}` : "⟵ altogether: (tap to place a known value)");
      tot.onclick = () => dropOn("total");
      rowsWrap.appendChild(tot);
      tray.innerHTML = "<span class='tray-title'>Known values:</span>";
      if (!r.knowns.length) tray.appendChild(el("span", "muted small", "none to place — just build the BEFORE picture, then Reforge"));
      r.knowns.forEach((k) => {
        if (S.build.placed[k.id]) return;
        const chip = button(esc(k.label), () => { if (S.locked) return; S.build.selected = S.build.selected === k.id ? null : k.id; draw(); }, "chip" + (S.build.selected === k.id ? " sel" : ""));
        tray.appendChild(chip);
      });
    }
    draw();
  }

  // Split Chisel: whole → parts → remainder split again.
  function renderSplit(area) {
    const r = S.rift;
    const sp = (S.split = { stage: 0, n: 0, shaded: new Set(), m: 0, sub: new Set() });
    area.appendChild(el("p", "tip", "Stage 1: split the whole and shade what was spent. Stage 2: split each REMAINING part again and shade what was spent from the remainder."));
    const barWrap = el("div", "split-bar"); area.appendChild(barWrap);
    const ctl = el("div", "split-ctl"); area.appendChild(ctl);
    const numInput = (min, max, onChange) => { const i = el("input"); i.type = "number"; i.min = min; i.max = max; i.placeholder = "?"; i.oninput = () => onChange(parseInt(i.value, 10) || 0); return i; };
    function draw() {
      barWrap.innerHTML = "";
      if (sp.stage === 0) barWrap.appendChild(el("div", "blk whole", "the whole, at first"));
      else for (let i = 0; i < sp.n; i++) {
        const part = el("div", "part" + (sp.shaded.has(i) ? " shaded" : ""));
        if (sp.stage >= 2 && !sp.shaded.has(i)) {
          for (let j = 0; j < sp.m; j++) {
            const key = i + ":" + j, sub = el("div", "sub" + (sp.sub.has(key) ? " shaded" : ""));
            sub.onclick = (e) => { e.stopPropagation(); if (S.locked) return; sp.sub.has(key) ? sp.sub.delete(key) : sp.sub.add(key); draw(); };
            part.appendChild(sub);
          }
        } else part.textContent = sp.shaded.has(i) ? "spent" : "";
        part.onclick = () => { if (S.locked || sp.stage !== 1) return; sp.shaded.has(i) ? sp.shaded.delete(i) : sp.shaded.add(i); draw(); };
        barWrap.appendChild(part);
      }
      ctl.innerHTML = "";
      if (sp.stage === 0) {
        ctl.append(el("span", "", "Split the whole into"), numInput(2, 8, (v) => (sp.n = v)), button("🔪 Split", () => { if (sp.n < 2 || sp.n > 8) return fail("choose 2 to 8 parts."); sp.stage = 1; draw(); }));
      } else if (sp.stage === 1) {
        ctl.append(el("span", "", `${sp.n} parts. Tap the parts that were spent, then`), button("Next: split the remainder ➜", () => {
          if (!sp.shaded.size || sp.shaded.size >= sp.n) return fail("shade the spent parts first (but not all of them).");
          sp.stage = 2; draw();
        }), button("↺ Start over", () => { Object.assign(sp, { stage: 0, n: 0, m: 0 }); sp.shaded.clear(); sp.sub.clear(); draw(); }, "btn-mini"));
      } else {
        ctl.append(el("span", "", "Split EACH remaining part into"), numInput(2, 6, (v) => { sp.m = v; sp.sub.clear(); draw(); }), el("span", "", "then tap the small parts spent, then"),
          button("⚒️ Reforge", () => { const res = V.validateSplit(r, sp); res.ok ? lockAndSteps("The split holds. Count the small parts.") : fail(res.problems[0]); }),
          button("↺ Start over", () => { Object.assign(sp, { stage: 0, n: 0, m: 0 }); sp.shaded.clear(); sp.sub.clear(); draw(); }, "btn-mini"));
      }
    }
    draw();
  }

  // Echo Scanner: guess & check with a scan log (= the exam's G&C table).
  function renderScanner(area) {
    const r = S.rift, sc = r.scan;
    S.scan = { log: [] };
    area.appendChild(el("p", "tip", `Slide to guess how many ${esc(sc.hiName)}s, press <b>Scan</b>, listen to the echo, adjust. Every scan becomes a row of your guess-and-check table.`));
    const row = el("div", "scan-row");
    const slider = el("input"); slider.type = "range"; slider.min = 0; slider.max = sc.n; slider.value = Math.floor(sc.n / 2);
    const readout = el("div", "readout");
    const table = el("table", "gc-table"); table.innerHTML = `<tr><th>${esc(sc.hiName)}s</th><th>${esc(sc.loName)}s</th><th>Total ${esc(sc.unit)}</th><th>Echo</th></tr>`;
    const lockBtn = button("🔒 Lock in", () => lockAndSteps("Echo locked. One more step."));
    lockBtn.hidden = true;
    const total = () => { const hi = +slider.value; return { hi, lo: sc.n - hi, total: hi * sc.hi + (sc.n - hi) * sc.lo }; };
    const drawReadout = () => { const x = total(); readout.innerHTML = `${x.hi} × ${esc(sc.hiName)} + ${x.lo} × ${esc(sc.loName)} → <b>?</b> (the gate needs ${sc.target} ${esc(sc.unit)})`; };
    slider.oninput = drawReadout;
    const scanBtn = button("📡 Scan", () => {
      if (S.locked) return;
      const x = total();
      const verdict = x.total === sc.target ? "✅ match" : x.total < sc.target ? "⬆️ too low" : "⬇️ too high";
      S.scan.log.push(Object.assign({ verdict }, x));
      const tr = el("tr", "", `<td>${x.hi}</td><td>${x.lo}</td><td>${x.total}</td><td>${verdict}</td>`); table.appendChild(tr);
      readout.innerHTML = `${x.hi} × ${esc(sc.hiName)} + ${x.lo} × ${esc(sc.loName)} → <b>${x.total}</b> ${esc(sc.unit)} · ${verdict}`;
      if (x.total === sc.target) { lockBtn.hidden = false; scanBtn.disabled = true; slider.disabled = true; }
      else if (S.scan.log.length > 4) S.errors++;   // more than 4 scans → counts against Flawless, not against progress
    });
    row.append(slider, scanBtn, lockBtn);
    area.append(readout, row, table);
    drawReadout();
  }

  // Rewind Lens: timeline boxes filled from the end backwards.
  function renderRewind(area) {
    const r = S.rift;
    area.appendChild(el("p", "tip", "Read the timeline left to right. You know the END. Rewind: undo the last change first, then the one before it."));
    const chain = el("div", "chain"); const boxes = [];
    r.values.forEach((v, i) => {
      const box = el("div", "cbox" + (i === r.values.length - 1 ? " filled" : ""), i === r.values.length - 1 ? String(v) : "?");
      boxes.push(box); chain.appendChild(box);
      if (i < r.chain.length) chain.appendChild(el("div", "cop", "➜ " + esc(S.exam ? r.chain[i].exam : r.chain[i].game) + " ➜"));
    });
    area.appendChild(chain);
    S.onStep = (i) => { const idx = r.values.length - 2 - i; boxes[idx].textContent = r.values[idx]; boxes[idx].classList.add("filled"); };
    lockAndSteps("Lens focused. Rewind step by step.");
  }

  // Forge Bench: pick the ingredients of a formula.
  function renderRecipe(area) {
    const r = S.rift, rc = r.recipe;
    S.recipe = { slots: [] };
    area.appendChild(el("p", "tip", `Tap ingredients to place them on the Bench. Tap a slot to remove. Craft <b>${esc(rc.name)}</b>.`));
    const slots = el("div", "slots"); const tiles = el("div", "tiles");
    const craft = button("🔥 Craft", () => { if (S.locked) return; const res = V.validateRecipe(rc, S.recipe.slots); res.ok ? lockAndSteps(`Blueprint learned: ${rc.name} = ${rc.formula}.`) : fail(res.problems[0]); });
    function draw() {
      slots.innerHTML = "";
      for (let i = 0; i < 4; i++) {
        const v = S.recipe.slots[i];
        const sl = el("div", "slot" + (v ? " filled" : ""), v ? esc(v) : "·");
        sl.onclick = () => { if (S.locked || !v) return; S.recipe.slots.splice(i, 1); draw(); };
        slots.appendChild(sl);
        if (i < 3) slots.appendChild(el("span", "muted", "×"));
      }
      slots.appendChild(el("span", "", `&nbsp;= <b>${esc(rc.name)}</b>`));
      tiles.innerHTML = "";
      rc.tiles.forEach((tk) => tiles.appendChild(button(esc(tk), () => { if (S.locked || S.recipe.slots.length >= 4) return; S.recipe.slots.push(tk); draw(); }, "tile")));
    }
    area.append(slots, tiles, craft);
    draw();
  }

  // Numeric steps after the structure holds.
  function renderSteps() {
    const r = S.rift, wrap = $("#steps"); wrap.hidden = false; wrap.innerHTML = "";
    r.steps.forEach((st, i) => {
      const line = el("div", "step" + (i < S.step ? " done" : i === S.step ? " active" : " todo"));
      line.appendChild(el("div", "step-q", esc(t(stepQ(st)))));
      if (i < S.step) line.appendChild(el("div", "step-a", "= " + st.a));
      else if (i === S.step) {
        const form = el("form", "step-form");
        const inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.placeholder = "?"; inp.autocomplete = "off";
        const go = el("button", "btn-primary", "Forge"); go.type = "submit";
        const hint = el("div", "hint"); hint.hidden = true;
        const hintBtn = button("💡 Hint", () => { if (hint.hidden) S.hints++; hint.hidden = false; hint.textContent = t(stepHint(st)); }, "btn-ghost small");
        form.onsubmit = (e) => {
          e.preventDefault();
          const v = parseFloat(inp.value.replace(/[^0-9.\-]/g, ""));
          if (isNaN(v)) return;
          if (Math.abs(v - st.a) < 0.011) {
            if (S.onStep) S.onStep(i);
            S.step++;
            const fb = $("#feedback"); fb.textContent = "✔ " + (S.step >= r.steps.length ? "Reforged!" : "Forged. Next."); fb.className = "feedback ok";
            S.step >= r.steps.length ? finishRift() : renderSteps();
          } else {
            S.errors++; inp.value = ""; inp.classList.add("shake"); setTimeout(() => inp.classList.remove("shake"), 400);
            const fb = $("#feedback"); fb.className = "feedback bad";
            fb.textContent = S.errors >= 2 ? "Not yet. " + t(stepHint(st)) : "Not yet — look at the picture again.";
          }
        };
        form.append(inp, go, hintBtn); line.append(form, hint);
        setTimeout(() => inp.focus(), 30);
      }
      wrap.appendChild(line);
    });
  }

  // ---------- decode ----------
  function finishRift() {
    const r = S.rift, secs = Math.round((Date.now() - S.startedAt) / 1000);
    const res = M.record(r, { hints: S.hints, errors: S.errors, seconds: secs, exam: S.exam, due: S.due });
    const legend = (r.legend || []).map(([g, x]) => `<span>${esc(g)} = ${esc(x)}</span>`).join("");
    $("#decode-game").innerHTML = `<p>${esc(r.hook)}</p><div class="legend">${legend}</div>`;
    $("#decode-exam").innerHTML = `<p><b>${esc(r.word)}</b></p><ol class="working">${r.working.map((w) => `<li>${esc(w)}</li>`).join("")}</ol><p><b>Answer: ${r.answer}</b></p><p class="small" style="opacity:.7">${esc(r.psle)} · ${esc(r.strand)} · ${r.marks} mark${r.marks > 1 ? "s" : ""}</p>`;
    const mp = (x) => Math.round(x * 100);
    $("#decode-reward").innerHTML = `+${res.xp} XP · +${res.coins} 🪙 · ${esc(r.isle)} mastery ${mp(res.before)}% ➜ ${mp(res.after)}%${res.perfect ? " · ✨ Flawless" : ` · ${S.hints} hint${S.hints === 1 ? "" : "s"}, ${S.errors} retr${S.errors === 1 ? "y" : "ies"}`}${S.exam ? " · 📜 exam-format solve" : ""}`;
    $("#btn-next").textContent = S.queue ? `Storm: Rift ${S.queue.i}/${S.queue.items.length} done — next ➜` : "Another Rift here ➜";
    show("decode");
  }

  // ---------- ledger ----------
  function renderLedger() {
    const s = M.state(), al = M.predictedAL(), wrap = $("#ledger");
    const total = s.history.length, clean = s.history.filter((e) => e.q === 1).length;
    const act = M.activity(14), max = Math.max(1, ...act.map((a) => a.n));
    const pts = act.map((a, i) => `${(i / 13) * 100},${60 - (a.n / max) * 55}`).join(" ");
    const rows = P.ORDER.map((h) => {
      const H = P.HEURISTICS[h], x = s.h[h] || { p: 0, attempts: 0, clean: 0, last: 0 };
      const exam = s.history.filter((e) => e.h === h && e.exam), examClean = exam.filter((e) => e.q === 1).length;
      return `<tr><td>${H.emoji} <b>${esc(H.name)}</b><br><span class="muted small">${esc(H.strand)}</span></td><td><div class="bar"><div style="width:${Math.round(x.p * 100)}%"></div></div>${Math.round(x.p * 100)}%</td><td>${x.attempts}</td><td>${x.attempts ? Math.round((x.clean / x.attempts) * 100) + "%" : "—"}</td><td>${exam.length ? `${examClean}/${exam.length}` : "—"}</td><td>${x.last ? new Date(x.last).toLocaleDateString() : "—"}${M.isDue(h) ? " 🔁" : ""}</td></tr>`;
    }).join("");
    wrap.innerHTML = `
      <div class="ledger-grid">
        <div class="stat"><div class="v">${al.band}</div><div class="l">Predicted PSLE band${al.score != null ? ` · score ${al.score} · coverage ${Math.round(al.coverage * 100)}%` : ""}</div></div>
        <div class="stat"><div class="v">${total ? Math.round((clean / total) * 100) + "%" : "—"}</div><div class="l">Independence (no hints, no retries) over ${total} Rift${total === 1 ? "" : "s"}</div></div>
        <div class="stat"><div class="v">${s.examSolves ? `${s.examClean}/${s.examSolves}` : "—"}</div><div class="l">Exam-wording solves done cleanly (Blueprint-first)</div></div>
        <div class="stat"><div class="v">🔥 ${s.streak}</div><div class="l">Day streak · ${act.reduce((a, b) => a + b.n, 0)} Rifts in the last 14 days</div></div>
      </div>
      <div class="stat"><div class="l">Rifts per day, last 14 days</div><svg class="spark" viewBox="0 0 100 64" preserveAspectRatio="none"><polyline fill="none" stroke="#00e5d4" stroke-width="1.5" points="${pts}"/></svg></div>
      <table class="ltable"><tr><th>Heuristic</th><th>Mastery</th><th>Rifts</th><th>Independent</th><th>Exam-format clean</th><th>Last</th></tr>${rows}</table>
      <div class="note"><b>How to read this.</b> ${esc(al.note)} Mastery moves with how independently each Rift was solved. 🔁 marks a heuristic that is due for review — the game pays double there. In production the band is calibrated against the weekly Paper Bridge exam sim; the prototype only shows the direction of travel.</div>
      <p style="margin-top:14px"><button class="btn-ghost small" id="btn-reset">Reset this device's save</button></p>`;
    $("#btn-reset").onclick = () => { if (confirm("Erase all progress on this device?")) { M.reset(); renderLedger(); renderHud(); } };
  }

  // ---------- codex ----------
  function renderCodex() {
    const s = M.state(), wrap = $("#codex");
    if (!s.codex.length) { wrap.innerHTML = "<p class='muted'>No cards yet. Reforge something.</p>"; return; }
    wrap.innerHTML = s.codex.map((c) => `<div class="codex-card"><div class="tag">${P.HEURISTICS[c.h].emoji} ${esc(P.HEURISTICS[c.h].name)} · ${new Date(c.t).toLocaleDateString()}${c.exam ? " · 📜 solved from exam wording" : ""}</div>${esc(c.word)}<div class="tag" style="margin-top:6px">Answer: ${c.answer}</div></div>`).join("");
  }

  // ---------- boot ----------
  function init() {
    document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => show(b.dataset.go)));
    $("#btn-start").onclick = () => show("map");
    $("#btn-parent").onclick = () => show("ledger");
    $("#btn-storm").onclick = startStorm;
    $("#btn-abandon").onclick = () => { S.queue = null; show("map"); };
    $("#btn-next").onclick = () => (S.queue ? nextInQueue() : startRift(S.rift.heuristic));
    if (M.state().history.length) $("#btn-start").textContent = "▶ Continue";
    show("title");
  }
  document.addEventListener("DOMContentLoaded", init);
  global.Fractura = { S, startRift, show };
})(window);
