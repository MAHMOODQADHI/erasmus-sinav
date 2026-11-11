// Validates extra.json (weekly TOEFL/IELTS questions) before it is uploaded.
// Usage: node validate-extra.js new.json [old.json]
// With old.json, also checks that the file only APPENDS (existing items keep their position,
// because the app identifies questions by their index).
const fs = require("fs");
const RULES = ["pres_simple","pres_cont","past_simple","past_cont","pp_since","pp_adv","ppc","past_perf","fut_will","fut_going","fut_cont","fut_perf","used_to","cond0","cond1","cond2","cond3","unless","wish","passive","causative","gerund","infinitive","bare_inf","prep_ing","purpose","stop_remember","rel_who","rel_whose","rel_nondef","must_have_to","should","deduction","ability","comparative","as_as","so_such","too_enough","adverbs","quant","some_any","articles","reported","reported_q","reported_cmd","prep_time","prep_place","linkers","tags","so_neither","would_rather","question_form","indirect_q","inversion","no_sooner","mixed_cond","cond_alt","cond_inv","if_only","passive_report","modal_perfect","participle","cleft","subjunctive","as_if","linkers_b2","rel_prep","future_past","verb_patterns_b2","would_habit"];
const FUNCS = ["mind","request","permission","suggestion","invitation","offer","thanks","apology","congrats","sympathy","advice","agree","disagree","opinion","phone","clarify","directions","shopping","restaurant","greeting","wishes","complaint","reassure","questions","formal","surprise","travel","hedge","interview","presenting","negotiate"];
const RTYPES = ["main","title","purpose","detail","vocab","ref","infer","not","true","attitude","tfng","complete","heading","gap"];
const PASS = { t_daily: "reading", t_acad: "reading", i_read: "reading", t_conv: "audio", t_ann: "audio", t_talk: "audio", i_l1: "audio", i_l4: "audio" };
const SPEAK = ["toefl_repeat","toefl_interview","ielts_p1","ielts_p2","ielts_p3"];
const TFNG = ["True","False","Not Given"];

const [, , newPath, oldPath] = process.argv;
const errors = [];
const err = (where, msg) => errors.push(where + ": " + msg);
let x;
try { x = JSON.parse(fs.readFileSync(newPath, "utf8")); } catch (e) { console.error("Not valid JSON: " + e.message); process.exit(1); }

const isStr = s => typeof s === "string" && s.trim().length > 0;
const opts = (o, where) => {
  if (!Array.isArray(o) || o.length < 3 || o.length > 4) return err(where, "options must be an array of 3-4 strings");
  if (!o.every(isStr)) return err(where, "every option must be a non-empty string");
  if (new Set(o.map(s => s.trim().toLowerCase())).size !== o.length) err(where, "options must all be different");
};
if (!Number.isInteger(x.version) || x.version < 1) err("version", "must be an integer >= 1");
if (!/^\d{4}-\d{2}-\d{2}$/.test(x.updated || "")) err("updated", "must be a date like 2026-11-20");

const seenQ = new Set(), seenT = new Set();
const dupQ = (q, where) => { const k = q.trim().toLowerCase(); if (seenQ.has(k)) err(where, "duplicate question text"); seenQ.add(k); };

(x.t_cw || []).forEach((a, i) => { const w = "t_cw[" + i + "]";
  if (!isStr(a.q) || !a.q.startsWith("Complete the word:\n") || !a.q.includes("___")) err(w, "q must start with 'Complete the word:\\n' and contain ___");
  opts(a.o, w); if (a.tk !== "complete") err(w, "tk must be 'complete'"); if (isStr(a.q)) dupQ(a.q, w); });
(x.t_resp || []).forEach((a, i) => { const w = "t_resp[" + i + "]";
  if (!isStr(a.audio)) err(w, "audio (the sentence that is read aloud) is required"); if (!isStr(a.q)) err(w, "q required");
  opts(a.o, w); if (!FUNCS.includes(a.fk)) err(w, "fk must be one of: " + FUNCS.join(", ")); if (isStr(a.audio)) dupQ("resp:" + a.audio, w); });
(x.t_build || []).forEach((a, i) => { const w = "t_build[" + i + "]";
  if (!isStr(a.q) || !a.q.startsWith("Build a sentence: choose the correct word order.\n")) err(w, "q must start with 'Build a sentence: choose the correct word order.\\n'");
  opts(a.o, w); if (!RULES.includes(a.rk)) err(w, "rk must be one of the grammar rule keys"); if (isStr(a.q)) dupQ(a.q, w); });
for (const [pool, kind] of Object.entries(PASS)) (x[pool] || []).forEach((p, i) => { const w = pool + "[" + i + "]";
  if (!isStr(p.t)) err(w, "t (title) required"); else { const k = p.t.trim().toLowerCase(); if (seenT.has(k)) err(w, "duplicate title"); seenT.add(k); }
  if (!Array.isArray(p.x) || !p.x.length || !p.x.every(isStr)) err(w, "x must be an array of paragraphs / script lines");
  const words = (p.x || []).join(" ").split(/\s+/).length;
  if (kind === "reading" && words < 90) err(w, "reading text is too short (" + words + " words)");
  if (!Array.isArray(p.q) || p.q.length < 3) return err(w, "q must contain at least 3 questions");
  p.q.forEach((a, j) => { const wq = w + ".q[" + j + "]";
    if (!Array.isArray(a) || a.length < 4) return err(wq, "must be [question, options, type, evidence(, fixed)]");
    if (!isStr(a[0])) err(wq, "question text required"); opts(a[1], wq);
    if (!RTYPES.includes(a[2])) err(wq, "type must be one of: " + RTYPES.join(", "));
    if (typeof a[3] !== "string") err(wq, "evidence must be a string ('' allowed only for main/title/purpose/not)");
    else if (!a[3].trim() && !["main","title","purpose","not"].includes(a[2])) err(wq, "evidence quote required for type " + a[2]);
    if (a[2] === "tfng") { if (a[4] !== true) err(wq, "tfng questions need fixed=true as 5th item");
      if (!Array.isArray(a[1]) || a[1].length !== 3 || !TFNG.every(t => a[1].includes(t))) err(wq, "tfng options must be True, False, Not Given (correct one first)"); }
    if (["t_daily","t_acad","t_conv","t_ann","t_talk"].includes(pool) && a[2] === "tfng") err(wq, "tfng is only for IELTS (i_read)");
    if (isStr(a[0])) dupQ(p.t + "|" + a[0], wq); }); });
const sp = x.speak || {};
for (const k of Object.keys(sp)) { if (!SPEAK.includes(k)) err("speak." + k, "unknown speaking task"); else if (!Array.isArray(sp[k]) || !sp[k].every(isStr)) err("speak." + k, "must be an array of strings"); }
for (const k of Object.keys(x)) if (!["version","updated","t_cw","t_resp","t_build","speak",...Object.keys(PASS)].includes(k)) err(k, "unknown top-level key");

if (oldPath) {
  try {
    const o = JSON.parse(fs.readFileSync(oldPath, "utf8"));
    if (!(x.version > (o.version || 0))) err("version", "must be greater than the old version (" + o.version + ")");
    for (const k of ["t_cw","t_resp","t_build",...Object.keys(PASS)]) {
      const a = o[k] || [], b = x[k] || [];
      if (b.length < a.length) err(k, "items were removed (old " + a.length + ", new " + b.length + ")");
      a.forEach((it, i) => { if (JSON.stringify(it) !== JSON.stringify(b[i])) err(k + "[" + i + "]", "existing item was changed or moved; only append new items at the END"); });
    }
    for (const k of SPEAK) { const a = (o.speak || {})[k] || [], b = (x.speak || {})[k] || []; a.forEach((s, i) => { if (b[i] !== s) err("speak." + k + "[" + i + "]", "existing prompt changed; only append"); }); }
  } catch (e) { err("old", "could not read old file: " + e.message); }
}

const count = k => (x[k] || []).length;
console.log("version " + x.version + " (" + x.updated + ") | singles: cw " + count("t_cw") + ", resp " + count("t_resp") + ", build " + count("t_build") +
  " | passages: " + Object.keys(PASS).map(k => k + " " + count(k)).join(", ") + " | speak: " + SPEAK.map(k => k + " " + ((x.speak || {})[k] || []).length).join(", "));
if (errors.length) { console.error("\n" + errors.length + " problem(s):\n- " + errors.join("\n- ")); process.exit(1); }
console.log("OK: extra.json is valid.");
