#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log("  ✓", name);
  else {
    console.error("  ✗", name, detail);
    failed += 1;
  }
}

console.log("1. Files");
for (const f of [
  "index.html",
  "package.json",
  "vite.config.ts",
  "vercel.json",
  "public/manifest.json",
  "public/sw.js",
  "public/icons/icon-192.svg",
  "public/data/catalog.json",
  "src/App.tsx",
  "src/domain/tournament.ts",
  "README.md"
]) {
  ok(f, fs.existsSync(path.join(root, f)));
}

console.log("2. Catalog");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "public/data/catalog.json"), "utf8"));
ok("dishes >= 180", catalog.dishes.length >= 180, String(catalog.dishes.length));
ok("recipes match", catalog.recipes.length === catalog.dishes.length);
const ids = catalog.dishes.map((d) => d.id);
ok("unique ids", new Set(ids).size === ids.length);
ok(
  "russian names",
  catalog.dishes.every((d) => /[А-Яа-яЁё]/.test(d.canonicalName))
);
ok(
  "source fields",
  catalog.dishes.every((d) => d.source && d.sourceId && d.attribution && d.canonicalName)
);
ok(
  "no empty titles",
  catalog.dishes.every((d) => d.canonicalName.trim().length > 1)
);
const cuisines = new Set(catalog.dishes.map((d) => d.cuisine));
ok("cuisines >= 8", cuisines.size >= 8, String(cuisines.size));
ok(
  "style and protein",
  catalog.dishes.every((d) => d.style && d.protein)
);
const household = catalog.dishes.filter((d) => d.protein === "chicken" || d.protein === "pork").length;
ok("chicken/pork >= 40", household >= 40, String(household));
const thumbsDir = path.join(root, "public", "thumbs");
const thumbs = fs.existsSync(thumbsDir)
  ? fs.readdirSync(thumbsDir).filter((n) => n.endsWith("-md.jpg"))
  : [];
ok("local thumbs >= 80", thumbs.length >= 80, String(thumbs.length));

console.log("3. No secrets in frontend");
const src = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|html|json)$/.test(name)) src.push(p);
  }
}
walk(path.join(root, "src"));
walk(path.join(root, "public"));
const leaked = src.filter((p) => {
  const text = fs.readFileSync(p, "utf8");
  return /VITE_[A-Z0-9_]*KEY|sk-live|spoonacular.*apiKey/i.test(text);
});
ok("no api keys", leaked.length === 0, leaked.join(", "));

if (failed) {
  console.error(`Failed: ${failed}`);
  process.exit(1);
}
console.log("OK");
