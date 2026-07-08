// Re-fetch only the dishes that the first pass missed. Uses broader search
// queries so Anubis's empty-result set doesn't kill us. Falls back to
// "chinese food bowl" if the targeted query still yields nothing.

import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.env.DISHES_PROJECT_ROOT;
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public/dishes");
const MAPPING_FILE = path.join(PUBLIC_DIR, "mapping.json");

const MISSING = [
  { id: "sour-soup-beef",     q: "hot sour soup bowl" },
  { id: "lotus-root-soup",    q: "chinese soup bowl pork" },
  { id: "muxu-rou",           q: "chinese stir fry egg meat" },
  { id: "celery-lily",        q: "stir fry vegetables bowl" },
  { id: "century-egg-tofu",   q: "tofu dish chinese" },
];

const FALLBACK_QS = ["chinese food bowl", "chinese cuisine dish", "asian food plate"];

async function findAnyFoodImage(page) {
  for (const q of FALLBACK_QS) {
    await page.goto(`https://unsplash.com/s/photos/${encodeURIComponent(q)}`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForSelector("figure img", { timeout: 30000 }).catch(() => null);
    const url = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("figure img"));
      for (const img of imgs) {
        const src = img.currentSrc || img.src;
        if (!src) continue;
        const m = src.match(/images\.unsplash\.com\/(photo-[a-z0-9-]+)\?/);
        if (m) return `https://images.unsplash.com/${m[1]}?auto=format&fit=crop&w=1000&q=80`;
      }
      return null;
    });
    if (url) return url;
  }
  return null;
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.ok} for ${url}`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

const browser = await chromium.launch();
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
});
const page = await context.newPage();

const mapping = JSON.parse(await fs.readFile(MAPPING_FILE, "utf8"));

for (const dish of MISSING) {
  const dest = path.join(PUBLIC_DIR, `${dish.id}.jpg`);
  try {
    await page.goto(`https://unsplash.com/s/photos/${encodeURIComponent(dish.q)}`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForSelector("figure img", { timeout: 30000 }).catch(() => null);
    let url = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("figure img"));
      for (const img of imgs) {
        const src = img.currentSrc || img.src;
        if (!src) continue;
        const m = src.match(/images\.unsplash\.com\/(photo-[a-z0-9-]+)\?/);
        if (m) return `https://images.unsplash.com/${m[1]}?auto=format&fit=crop&w=1000&q=80`;
      }
      return null;
    });
    if (!url) {
      console.warn(`[FALLBACK] ${dish.id} — ${dish.q} returned nothing, trying generic`);
      url = await findAnyFoodImage(page);
    }
    if (!url) {
      console.error(`[STILL-MISS] ${dish.id}`);
      continue;
    }
    const m = url.match(/photo-([a-z0-9-]+)\?/);
    await downloadImage(url, dest);
    mapping[dish.id] = m[1];
    console.log(`[OK ] ${dish.id} → ${m[1]}`);
  } catch (err) {
    console.error(`[ERR] ${dish.id}:`, err.message);
  }
}

await browser.close();
await fs.writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
console.log("Mapping updated. Total entries:", Object.keys(mapping).length);
