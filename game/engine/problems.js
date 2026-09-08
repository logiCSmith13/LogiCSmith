/* FRACTURA — Rift generators.
   PSLE heuristics → procedurally generated puzzles.
   Every Rift carries BOTH the game-world framing (hook) and the exact exam-style
   word problem it is isomorphic to (word). The Decode card shows them side by
   side after the solve — that pairing is the learning-transfer mechanism.
   Plain script (no modules) so it runs from file:// and GitHub Pages alike. */
(function (global) {
  "use strict";

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

  // Heuristic registry: the tags the Ledger reads. Keep in sync with DESIGN.md §4.
  const HEURISTICS = {
    comparison:   { name: "Comparison model (× as many)",          gear: "Forge Gauntlet", isle: "Comparison Coast",   emoji: "⚖️", strand: "Numbers · Whole numbers & Ratio", psle: "Model drawing — comparison" },
    difference:   { name: "More-than / less-than model",          gear: "Gap Gauge",      isle: "Gap Gorge",          emoji: "📏", strand: "Numbers · Whole numbers",         psle: "Model drawing — difference" },
    before_after: { name: "Before–After (constant total)",        gear: "Time Shard",     isle: "Tidewell Harbour",   emoji: "⏳", strand: "Numbers · Ratio",                 psle: "Before–after, unchanged total" },
    remainder:    { name: "Units & Parts (fraction of remainder)", gear: "Split Chisel",   isle: "Splitshard Caverns", emoji: "🔪", strand: "Numbers · Fractions",             psle: "Fraction of a remainder" },
    guess_check:  { name: "Supposition (guess & check)",          gear: "Echo Scanner",   isle: "Echo Fields",        emoji: "📡", strand: "Numbers · Whole numbers",         psle: "Supposition / systematic listing" },
    backwards:    { name: "Working backwards",                    gear: "Rewind Lens",    isle: "Rewind Ruins",       emoji: "⏪", strand: "Numbers · Money",                 psle: "Working backwards" },
    recipe:       { name: "Formulas (area, perimeter, volume)",   gear: "Forge Bench",    isle: "The Great Forge",    emoji: "🔥", strand: "Measurement & Geometry",          psle: "Formula recall & application" },
  };
  const ORDER = Object.keys(HEURISTICS);

  const NAMES = ["Ali", "Ben", "Chen", "Devi", "Farah", "Hui Ling", "Kumar", "Mei", "Raj", "Siti", "Wei Jie", "Zara"];
  const ITEMS = ["stickers", "marbles", "trading cards", "seashells", "beads", "stamps", "erasers", "paper cranes"];
  const PAIRS = [
    { a: { name: "Gold chest",  emoji: "🟨" }, b: { name: "Silver chest", emoji: "⬜" }, thing: "gems",      fix: "the Skybridge" },
    { a: { name: "Ember golem", emoji: "🔥" }, b: { name: "Frost golem",  emoji: "🧊" }, thing: "crystals",  fix: "the Golem Gate" },
    { a: { name: "Red dragon",  emoji: "🐉" }, b: { name: "Blue dragon",  emoji: "🐲" }, thing: "scales",    fix: "the Dragon Roost" },
    { a: { name: "North tower", emoji: "🗼" }, b: { name: "South tower",  emoji: "🏰" }, thing: "lanterns",  fix: "the Watchlight" },
    { a: { name: "Sky whale",   emoji: "🐋" }, b: { name: "Cloud koi",    emoji: "🐟" }, thing: "star-fish", fix: "the Tide Engine" },
  ];
  const twoNames = () => { const s = shuffle(NAMES); return [s[0], s[1]]; };

  let seq = 0;
  function base(h, level, marks) {
    return Object.assign({ id: "rift-" + (++seq) + "-" + Date.now().toString(36), heuristic: h, level, marks }, HEURISTICS[h]);
  }
  // Step text may contain {a}/{b} placeholders → replaced by game or exam names at render time.

  // ---------- 1. Comparison: A = k × B, total known ----------
  function genComparison(level) {
    const k = level === 1 ? rnd(2, 4) : rnd(3, 7);
    const u = level === 3 ? rnd(11, 29) : rnd(3, 12);
    const total = (k + 1) * u;
    const P = pick(PAIRS), [A, B] = twoNames(), item = pick(ITEMS);
    const ask = level === 1 ? "a" : pick(["a", "b", "diff"]);
    const answer = ask === "a" ? k * u : ask === "b" ? u : (k - 1) * u;
    const r = base("comparison", level, level + 1);
    r.mode = "builder";
    const askGame = ask === "a" ? `the ${P.a.name}'s count` : ask === "b" ? `the ${P.b.name}'s count` : `how many MORE the ${P.a.name} holds`;
    const askWord = ask === "a" ? `How many ${item} does ${A} have?` : ask === "b" ? `How many ${item} does ${B} have?` : `How many more ${item} does ${A} have than ${B}?`;
    r.hook = `The ${P.a.name} holds ${k} times as many ${P.thing} as the ${P.b.name}. Together they hold ${total} ${P.thing}. To reforge ${P.fix}, the Forge needs ${askGame}.`;
    r.word = `${A} has ${k} times as many ${item} as ${B}. They have ${total} ${item} altogether. ${askWord}`;
    r.rows = [
      { key: "a", game: P.a.name, exam: A, emoji: P.a.emoji, units: k, extra: 0 },
      { key: "b", game: P.b.name, exam: B, emoji: P.b.emoji, units: 1, extra: 0 },
    ];
    r.knowns = [{ id: "total", label: `${total} altogether`, value: total, target: "total" }];
    r.steps = [
      { q: `${k} units + 1 unit = ${k + 1} units = ${total}. So 1 unit = ?`, a: u, hint: `Share ${total} equally among ${k + 1} blocks: ${total} ÷ ${k + 1}.` },
      ask === "a" ? { q: `{a} has ${k} units. ${k} units = ?`, a: answer, hint: `1 unit is ${u}. Multiply by ${k}.` }
        : ask === "b" ? { q: `{b} has 1 unit. So {b} holds ?`, a: answer, hint: `That is exactly 1 unit.` }
        : { q: `The difference is ${k} − 1 = ${k - 1} units. ${k - 1} units = ?`, a: answer, hint: `Multiply ${u} by ${k - 1}.` },
    ];
    r.answer = answer;
    r.working = [
      `${k} units + 1 unit = ${k + 1} units = ${total}`,
      `1 unit = ${total} ÷ ${k + 1} = ${u}`,
      ask === "a" ? `${k} units = ${k} × ${u} = ${answer}` : ask === "b" ? `1 unit = ${answer}` : `${k - 1} units = ${k - 1} × ${u} = ${answer}`,
    ];
    r.legend = [[P.a.name, A], [P.b.name, B], [P.thing, item]];
    return r;
  }

  // ---------- 2. Difference: A = B + d (or B = A + d), total known ----------
  function genDifference(level) {
    const u = level === 3 ? rnd(15, 40) : rnd(5, 20);
    const d = level === 1 ? rnd(2, 9) : rnd(6, 30);
    const total = 2 * u + d;
    const P = pick(PAIRS), [A, B] = twoNames(), item = pick(ITEMS);
    const less = level >= 2 && Math.random() < 0.5;   // "fewer than" wording, same model
    const bigIsA = !less;
    const ask = pick(["a", "b"]);
    const answer = ask === "a" ? (bigIsA ? u + d : u) : (bigIsA ? u : u + d);
    const r = base("difference", level, level + 1);
    r.mode = "builder";
    r.hook = `The ${P.a.name} holds ${d} ${less ? "fewer" : "more"} ${P.thing} than the ${P.b.name}. Together: ${total} ${P.thing}. ${P.fix} needs the ${ask === "a" ? P.a.name : P.b.name}'s count.`;
    r.word = `${A} has ${d} ${less ? "fewer" : "more"} ${item} than ${B}. They have ${total} ${item} altogether. How many ${item} does ${ask === "a" ? A : B} have?`;
    r.rows = [
      { key: "a", game: P.a.name, exam: A, emoji: P.a.emoji, units: 1, extra: bigIsA ? d : 0 },
      { key: "b", game: P.b.name, exam: B, emoji: P.b.emoji, units: 1, extra: bigIsA ? 0 : d },
    ];
    r.knowns = [
      { id: "total", label: `${total} altogether`, value: total, target: "total" },
      { id: "diff", label: `${d} ${less ? "fewer" : "more"}`, value: d, target: "extra:" + (bigIsA ? "a" : "b") },
    ];
    r.steps = [
      { q: `Take away the extra ${d}. 2 units = ?`, a: 2 * u, hint: `${total} − ${d}.` },
      { q: `1 unit = ?`, a: u, hint: `Halve ${2 * u}.` },
      { q: `{${ask}} = ?`, a: answer, hint: answer === u ? "That one is exactly 1 unit." : `1 unit + ${d}.` },
    ];
    r.answer = answer;
    r.working = [`2 units + ${d} = ${total}`, `2 units = ${total} − ${d} = ${2 * u}`, `1 unit = ${u}`, answer === u ? `${ask === "a" ? A : B} = 1 unit = ${u}` : `${ask === "a" ? A : B} = ${u} + ${d} = ${answer}`];
    r.legend = [[P.a.name, A], [P.b.name, B], [P.thing, item]];
    return r;
  }

  // ---------- 3. Before–After, constant total (transfer until equal) ----------
  function genBeforeAfter(level) {
    const k = level === 1 ? 3 : pick([3, 5]);
    const u = level === 3 ? rnd(8, 25) : rnd(3, 12);
    const moved = (k - 1) / 2;   // units moved
    const x = moved * u;
    const P = pick(PAIRS), [A, B] = twoNames(), item = pick(ITEMS);
    const r = base("before_after", level, level + 2);
    r.mode = "builder";
    r.hook = `At first the ${P.a.name} held ${k} times as many ${P.thing} as the ${P.b.name}. Then the ${P.a.name} passed ${x} ${P.thing} to the ${P.b.name} — now they hold the same. Build the BEFORE picture. ${P.fix} needs the ${P.a.name}'s count at first.`;
    r.word = `${A} had ${k} times as many ${item} as ${B}. After ${A} gave ${x} ${item} to ${B}, they had the same number of ${item}. How many ${item} did ${A} have at first?`;
    r.rows = [
      { key: "a", game: P.a.name, exam: A, emoji: P.a.emoji, units: k, extra: 0 },
      { key: "b", game: P.b.name, exam: B, emoji: P.b.emoji, units: 1, extra: 0 },
    ];
    r.knowns = [];
    r.steps = [
      { q: `Total units = ${k + 1}, and the total never changed. Equal at the end means each has ? units`, a: (k + 1) / 2, hint: `${k + 1} ÷ 2.` },
      { q: `So {a} gave away ? unit(s)`, a: moved, hint: `${k} − ${(k + 1) / 2}.` },
      { q: `${moved} unit${moved > 1 ? "s" : ""} = ${x}. 1 unit = ?`, a: u, hint: `${x} ÷ ${moved}.` },
      { q: `{a} at first = ${k} units = ?`, a: k * u, hint: `${k} × ${u}.` },
    ];
    r.answer = k * u;
    r.working = [`Before: ${A} ${k} units, ${B} 1 unit → ${k + 1} units (total unchanged)`, `After: equal → ${(k + 1) / 2} units each`, `${A} gave ${moved} unit(s) = ${x} → 1 unit = ${u}`, `${A} at first = ${k} × ${u} = ${k * u}`];
    r.legend = [[P.a.name, A], [P.b.name, B], [P.thing, item]];
    return r;
  }

  // ---------- 4. Units & Parts: fraction of a remainder ----------
  function genRemainder(level) {
    const b = level === 1 ? pick([2, 3, 4]) : pick([3, 4, 5]);
    const a = rnd(1, b - 1);
    const d = level === 1 ? 2 : pick([2, 3, 4]);
    const c = rnd(1, d - 1);
    const u = rnd(2, level === 3 ? 12 : 6);
    const leftParts = (b - a) * (d - c);
    const L = leftParts * u;
    const total = b * d * u;
    const [A] = twoNames();
    const r = base("remainder", level, level + 2);
    r.mode = "split";
    r.hook = `A Null devoured ${a}/${b} of the Great Crystal, then ${c}/${d} of what remained. Only ${L} shards are left. How many shards was the crystal at first? Use the Split Chisel.`;
    r.word = `${A} had some money. ${A} spent ${a}/${b} of it on a book and ${c}/${d} of the remainder on a pen. ${A} had $${L} left. How much money did ${A} have at first?`;
    r.rows = [];
    r.split = { b, a, d, c, L };
    r.steps = [
      { q: `How many small parts are left (unshaded)?`, a: leftParts, hint: `Count the unshaded small parts: ${b - a} big parts × ${d - c} each.` },
      { q: `${leftParts} small parts = ${L}. 1 small part = ?`, a: u, hint: `${L} ÷ ${leftParts}.` },
      { q: `At first = ${b} × ${d} = ${b * d} small parts = ?`, a: total, hint: `${b * d} × ${u}.` },
    ];
    r.answer = total;
    r.working = [`Split into ${b} parts; ${a} spent → ${b - a} parts remain`, `Each remaining part split into ${d}; ${c} of each spent → ${leftParts} small parts left`, `${leftParts} parts = ${L} → 1 part = ${u}`, `At first = ${b * d} parts = ${b * d} × ${u} = ${total}`];
    r.legend = [["the Great Crystal", A + "'s money"], ["shards", "dollars"], ["Null devoured", "spent"]];
    return r;
  }

  // ---------- 5. Supposition / guess & check ----------
  function genGuessCheck(level) {
    const n = level === 1 ? rnd(6, 10) : rnd(10, 24);
    const V = pick([
      { hiName: "Crawler bot", hi: 4, loName: "Hopper bot", lo: 2, unit: "legs", gameThing: "bots", examHi: "cars", examLo: "motorcycles", examUnit: "wheels", examThing: "vehicles", money: false },
      { hiName: "Ember gem", hi: 50, loName: "Frost gem", lo: 20, unit: "power", gameThing: "gems", examHi: "50-cent coins", examLo: "20-cent coins", examUnit: "cents", examThing: "coins", money: true },
    ]);
    const hiCount = rnd(1, n - 1);
    const total = hiCount * V.hi + (n - hiCount) * V.lo;
    const r = base("guess_check", level, level + 1);
    r.mode = "scanner";
    const totalWord = V.money ? `a total value of $${(total / 100).toFixed(2)}` : `${total} ${V.examUnit} altogether`;
    r.hook = `${n} ${V.gameThing} power the Echo Gate: ${V.hiName}s (${V.hi} ${V.unit} each) and ${V.loName}s (${V.lo} ${V.unit} each). The gate reads ${total} ${V.unit} in total. How many ${V.hiName}s are there? Tune the Echo Scanner.`;
    r.word = V.money
      ? `A bag contains ${n} coins. Some are ${V.examHi} and the rest are ${V.examLo}. The coins have ${totalWord}. How many ${V.examHi} are there?`
      : `There are ${n} ${V.examThing} in a car park. Some are ${V.examHi} (4 wheels) and the rest are ${V.examLo} (2 wheels). There are ${totalWord}. How many ${V.examHi} are there?`;
    r.rows = [];
    r.scan = { n, hi: V.hi, lo: V.lo, target: total, hiName: V.hiName, loName: V.loName, unit: V.unit };
    r.steps = [{ q: `Locked at ${hiCount} ${V.hiName}s. So ${V.loName}s = ?`, a: n - hiCount, hint: `${n} − ${hiCount}.` }];
    r.answer = hiCount;
    r.working = [
      `Suppose all ${n} are ${V.examLo}: ${n} × ${V.lo} = ${n * V.lo} ${V.examUnit}`,
      `Shortfall: ${total} − ${n * V.lo} = ${total - n * V.lo}`,
      `Each swap to a ${V.examHi.replace(/s$/, "")} adds ${V.hi} − ${V.lo} = ${V.hi - V.lo}`,
      `${V.examHi}: ${total - n * V.lo} ÷ ${V.hi - V.lo} = ${hiCount}`,
    ];
    r.legend = [[V.hiName + "s", V.examHi], [V.loName + "s", V.examLo], [V.unit, V.examUnit]];
    return r;
  }

  // ---------- 6. Working backwards ----------
  function genBackwards(level) {
    const [A, B] = twoNames();
    const plan = level === 1 ? ["half", "minus"] : level === 2 ? ["minus", "half", "minus"] : ["half", "plus", "half", "minus"];
    let chain, values;
    for (let tries = 0; tries < 60; tries++) {
      let v = rnd(10, 40) * 4;
      chain = []; values = [v];
      let ok = true;
      for (const kind of plan) {
        let step;
        if (kind === "half") step = { kind, game: "a Null halved it", exam: "spent half of it on lunch", undo: "double it", fwd: (x) => x / 2 };
        else if (kind === "minus") { const n = rnd(3, 25); step = { kind, n, game: `a Null stole ${n}`, exam: `spent $${n} on a book`, undo: `add ${n} back`, fwd: (x) => x - n }; }
        else { const n = rnd(4, 20); step = { kind, n, game: `${n} more were found`, exam: `received $${n} from ${B}`, undo: `take ${n} away`, fwd: (x) => x + n }; }
        v = step.fwd(v);
        if (!Number.isInteger(v) || v <= 2) { ok = false; break; }
        chain.push(step); values.push(v);
      }
      if (ok) break;
    }
    const end = values[values.length - 1];
    const r = base("backwards", level, level + 1);
    r.mode = "rewind";
    r.hook = `The Rewind Lens shows the crystal's story: ${chain.map((c) => c.game).join(", then ")}. Now ${end} shards remain. How many shards were there at first? Rewind one step at a time.`;
    r.word = `${A} had some money. ${A} ${chain.map((c) => c.exam).join(", then ")}. ${A} had $${end} left. How much money did ${A} have at first?`;
    r.rows = [];
    r.chain = chain.map((c) => ({ game: c.game, exam: c.exam, undo: c.undo }));
    r.values = values;
    r.steps = [];
    for (let i = chain.length - 1; i >= 0; i--) {
      r.steps.push({
        q: `Before "${chain[i].game}" there were ?`, qx: `Before "${chain[i].exam}" there was $?`,
        a: values[i], hint: `To undo "${chain[i].game}", ${chain[i].undo}: start from ${values[i + 1]}.`,
        hx: `To undo "${chain[i].exam}", ${chain[i].undo}: start from ${values[i + 1]}.`,
      });
    }
    r.answer = values[0];
    r.working = [`Work backwards from $${end}:`].concat(r.steps.map((s, i) => { const idx = chain.length - 1 - i; return `Undo "${chain[idx].exam}" → ${chain[idx].undo} → $${values[idx]}`; }));
    r.legend = [["the crystal's shards", A + "'s money"], ["Null halved / stole", "spent"]];
    return r;
  }

  // ---------- 7. Formulas as crafting recipes ----------
  const TOKENS = ["length", "breadth", "height", "base", "side", "½", "2", "π", "diameter", "radius", "(length + breadth)", "3"];
  const SHAPES = [
    { key: "rect_area", name: "Area of a rectangle", need: ["length", "breadth"], formula: "length × breadth", unit: "m²",
      make: () => { const l = rnd(6, 20), b = rnd(3, 12); return { dims: `${l} m by ${b} m`, game: `a rectangular Bridge Plate ${l} by ${b}`, ans: l * b }; } },
    { key: "rect_peri", name: "Perimeter of a rectangle", need: ["2", "(length + breadth)"], formula: "2 × (length + breadth)", unit: "m",
      make: () => { const l = rnd(6, 20), b = rnd(3, 12); return { dims: `${l} m by ${b} m`, game: `a rectangular Ward Fence ${l} by ${b}`, ans: 2 * (l + b) }; } },
    { key: "tri_area", name: "Area of a triangle", need: ["½", "base", "height"], formula: "½ × base × height", unit: "cm²",
      make: () => { const b = rnd(4, 20) * 2, h = rnd(3, 15); return { dims: `base ${b} cm, height ${h} cm`, game: `a triangular Sail with base ${b} and height ${h}`, ans: b * h / 2 }; } },
    { key: "cuboid_vol", name: "Volume of a cuboid", need: ["length", "breadth", "height"], formula: "length × breadth × height", unit: "cm³",
      make: () => { const l = rnd(3, 12), b = rnd(2, 9), h = rnd(2, 9); return { dims: `${l} cm by ${b} cm by ${h} cm`, game: `a Core Block ${l} by ${b} by ${h}`, ans: l * b * h }; } },
    { key: "circ", name: "Circumference of a circle", need: ["π", "diameter"], formula: "π × diameter (π = 22/7)", unit: "cm",
      make: () => { const d = rnd(1, 6) * 7; return { dims: `diameter ${d} cm (take π = 22/7)`, game: `a Ring Gear of diameter ${d} (π = 22/7)`, ans: 22 * d / 7 }; } },
    { key: "circ_area", name: "Area of a circle", need: ["π", "radius", "radius"], formula: "π × radius × radius (π = 22/7)", unit: "cm²",
      make: () => { const rr = rnd(1, 3) * 7; return { dims: `radius ${rr} cm (take π = 22/7)`, game: `a Sun Disc of radius ${rr} (π = 22/7)`, ans: 22 * rr * rr / 7 }; } },
  ];
  function genRecipe(level) {
    const pool = level === 1 ? SHAPES.slice(0, 3) : level === 2 ? SHAPES.slice(0, 5) : SHAPES;
    const S = pick(pool), m = S.make();
    const r = base("recipe", level, level);
    r.mode = "recipe";
    r.hook = `Craft ${m.game}. The Forge needs its ${S.name.toLowerCase().replace(/ of a .*/, "")}. Place the right ingredients on the Bench.`;
    r.word = `${S.name} — ${m.dims}. Find the ${S.name.toLowerCase().replace(/ of a .*/, "")}.`;
    r.rows = [];
    const distract = shuffle(TOKENS.filter((t) => !S.need.includes(t))).slice(0, 5);
    r.recipe = { name: S.name, need: S.need.slice(), formula: S.formula, tiles: shuffle(S.need.concat(distract)), unit: S.unit };
    r.steps = [{ q: `Blueprint: ${S.formula}. With ${m.dims}, the ${S.name.toLowerCase()} = ? (${S.unit})`, a: m.ans, hint: `Substitute the numbers into ${S.formula}.` }];
    r.answer = m.ans;
    r.working = [`${S.name} = ${S.formula}`, `= ${m.ans} ${S.unit}`];
    r.legend = [["the Forge Bench", "your formula sheet"], ["ingredients", "the quantities in the formula"]];
    return r;
  }

  const GEN = { comparison: genComparison, difference: genDifference, before_after: genBeforeAfter, remainder: genRemainder, guess_check: genGuessCheck, backwards: genBackwards, recipe: genRecipe };

  function generate(heuristic, level) {
    const lv = Math.max(1, Math.min(3, level || 1));
    return GEN[heuristic](lv);
  }

  global.FracturaProblems = { HEURISTICS, ORDER, generate };
})(typeof window !== "undefined" ? window : globalThis);
