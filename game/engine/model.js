/* FRACTURA — validators. The contract every rendering engine (DOM today,
   Godot/Unity later) must satisfy. Messages may contain {a}/{b} placeholders
   that the renderer replaces with game or exam names. Port 1:1 to the server. */
(function (global) {
  "use strict";

  // Bar-model builder: rows of equal units (+ optional "extra" piece) and known values placed on targets.
  function validateBuilder(rift, st) {
    const problems = [];
    const rows = rift.rows;
    const allBuilt = rows.every((row) => st.rows[row.key].units > 0);
    let scaled = false;
    if (allBuilt) {
      const f = st.rows[rows[0].key].units / rows[0].units;
      scaled = Number.isInteger(f) && f > 1 && rows.every((row) => st.rows[row.key].units === row.units * f);
    }
    if (scaled) problems.push("The ratio is right — but use the SMALLEST number of blocks: the smaller one gets exactly 1 unit.");
    rows.forEach((row) => {
      const s = st.rows[row.key];
      if (!scaled && s.units !== row.units) {
        problems.push(row.units === 1 ? `{${row.key}} needs exactly 1 block (that is 1 unit).` : `{${row.key}} should have ${row.units} equal blocks — ${row.units} times the other.`);
      }
      if (!!s.extra !== !!row.extra) {
        problems.push(row.extra ? `{${row.key}} has MORE — add an extra piece to its bar.` : `{${row.key}} should not have an extra piece.`);
      }
    });
    rift.knowns.forEach((k) => {
      if (st.placed[k.id] !== k.target) {
        const where = k.target === "total" ? "the 'altogether' bracket" : `the extra piece of {${k.target.split(":")[1]}}`;
        problems.push(`Place "${k.label}" on ${where}.`);
      }
    });
    return { ok: problems.length === 0, problems };
  }

  // Split Chisel: whole → b parts, a shaded; each remaining part → d parts, c of each shaded.
  function validateSplit(rift, sp) {
    const { b, a, d, c } = rift.split;
    const problems = [];
    if (sp.n !== b) problems.push(`${a}/${b} means the whole is split into ${b} equal parts first.`);
    else if (sp.shaded.size !== a) problems.push(`${a}/${b} spent means shade ${a} of the ${b} parts.`);
    else if (sp.m !== d) problems.push(`${c}/${d} of the REMAINDER: split each remaining part into ${d}.`);
    else if (sp.sub.size !== c * (b - a)) problems.push(`Shade ${c} of every ${d} small parts in the remainder — that is ${c * (b - a)} small parts in total.`);
    return { ok: problems.length === 0, problems };
  }

  // Forge Bench: ingredients as a multiset.
  function validateRecipe(recipe, slots) {
    const want = recipe.need.slice().sort().join("|"), got = slots.slice().sort().join("|");
    if (want === got) return { ok: true, problems: [] };
    const missing = recipe.need.filter((t) => !slots.includes(t));
    const wrong = slots.filter((t) => !recipe.need.includes(t));
    const msg = wrong.length ? `"${wrong[0]}" does not belong in ${recipe.name.toLowerCase()}.` : missing.length ? `Something is missing from the recipe (it has ${recipe.need.length} ingredients).` : "Check the quantities of each ingredient.";
    return { ok: false, problems: [msg] };
  }

  global.FracturaModel = { validateBuilder, validateSplit, validateRecipe };
})(typeof window !== "undefined" ? window : globalThis);
