// Downloads one real food photo per dish from Unsplash search pages and saves
// them to ../public/dishes/<id>.jpg. Uses Playwright Chromium to bypass the
// Anubis anti-bot challenge (Unsplash blocks plain HTTP fetches).
//
// Usage (from the project root):
//   node scripts/fetch-dish-images.mjs
//
// Reads the dish metadata from src/data/dishes.ts and writes
// public/dishes/<dish-id>.jpg plus a mapping file mapping.json.

import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Allow the project root to be overridden via env var when the script is run
// from a different working directory (e.g. a shared node workspace).
const PROJECT_ROOT = process.env.DISHES_PROJECT_ROOT
  ? path.resolve(process.env.DISHES_PROJECT_ROOT)
  : path.resolve(__dirname, "..");
const DISHES_TS = path.join(PROJECT_ROOT, "src/data/dishes.ts");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public/dishes");
const MAPPING_FILE = path.join(PUBLIC_DIR, "mapping.json");

// Heuristic: pick dishes whose imageUrl still points to a hardcoded Unsplash
// photo-{id}?auto=format&fit=crop&w=1000&q=80 link. Local images or fallbacks
// are left untouched.
const IMG_RE = /https:\/\/images\.unsplash\.com\/([a-z0-9-]+)\?/;

function extractEnglishKeywords(name, description) {
  // Hand-mapped English search terms per dish. Falls back to generic
  // "chinese food" when a more specific term isn't available.
  const MAP = {
    "宫保鸡丁": "kung pao chicken",
    "番茄炒蛋": "tomato scrambled eggs",
    "红烧肉": "braised pork belly chinese",
    "麻婆豆腐": "mapo tofu",
    "可乐鸡翅": "cola chicken wings",
    "蒜蓉西兰花": "garlic broccoli",
    "鱼香茄子": "fish fragrant eggplant",
    "肥牛饭": "beef rice bowl japanese",
    "蒜蓉粉丝虾": "garlic vermicelli shrimp",
    "酸汤肥牛": "sour soup beef",
    "葱油拌面": "scallion oil noodles",
    "三杯鸡": "three cup chicken taiwanese",
    "土豆炖牛腩": "beef brisket potato stew",
    "虾仁滑蛋": "shrimp scrambled eggs",
    "菌菇鸡汤": "chicken mushroom soup",
    "凉拌黄瓜": "smashed cucumber salad",
    "咖喱鸡饭": "chicken curry rice",
    "回锅肉": "twice cooked pork sichuan",
    "莲藕排骨汤": "lotus root pork rib soup",
    "青椒肉丝": "green pepper pork",
    "酸辣土豆丝": "sour spicy potato stir fry",
    "干煸豆角": "dry fried green beans sichuan",
    "蒜苔炒肉": "garlic shoots pork",
    "韭菜炒鸡蛋": "chinese chives scrambled eggs",
    "木须肉": "moo shu pork",
    "西芹炒百合": "celery lily stir fry",
    "白菜炖粉条": "cabbage vermicelli stew",
    "番茄炖牛腩": "tomato beef stew",
    "小鸡炖蘑菇": "chicken mushroom stew",
    "排骨炖豆角": "pork rib green bean stew",
    "粉蒸肉": "steamed pork rice flour",
    "蒸蛋羹": "steamed egg custard chinese",
    "清蒸鲈鱼": "steamed sea bass chinese",
    "蒜蓉蒸茄子": "steamed garlic eggplant",
    "凉拌木耳": "wood ear mushroom salad",
    "皮蛋豆腐": "century egg tofu",
    "口水鸡": "mouth watering chicken sichuan",
    "番茄蛋花汤": "tomato egg drop soup",
    "冬瓜排骨汤": "winter melon pork rib soup",
    "紫菜蛋花汤": "seaweed egg drop soup",
  };
  return MAP[name] || `${name} chinese food`;
}

async function extractDishesFromTs() {
  const text = await fs.readFile(DISHES_TS, "utf8");
  // Walk the file linearly; each dish begins at a line like "  {" and we
  // capture id / name / imageUrl whenever we see them until the next "  {".
  const dishes = [];
  let inBlock = false;
  let current = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw;
    if (/^\s*\{\s*$/.test(line)) {
      // Start of a new dish block. If we had one, push it.
      if (inBlock && current.id) dishes.push(current);
      inBlock = true;
      current = {};
      continue;
    }
    if (inBlock) {
      const idM = line.match(/^\s*id:\s*"([^"]+)",?\s*$/);
      if (idM) current.id = idM[1];
      const nameM = line.match(/^\s*name:\s*"([^"]+)",?\s*$/);
      if (nameM) current.name = nameM[1];
      const imgM = line.match(/^\s*imageUrl:\s*img\("([^"]+)"\)/);
      if (imgM) current.oldPhotoId = imgM[1];
    }
  }
  if (inBlock && current.id) dishes.push(current);
  return dishes;
}

async function findFirstFoodImage(page, query) {
  // Navigate to the search results page and let Anubis / SPA load.
  await page.goto(`https://unsplash.com/s/photos/${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  // Wait for at least one image to render.
  await page.waitForSelector("figure img", { timeout: 30000 }).catch(() => null);
  // Find the first image whose src is a real photo (skip avatars, logos).
  const photoUrl = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("figure img"));
    for (const img of imgs) {
      const src = img.currentSrc || img.src;
      if (!src) continue;
      const m = src.match(/images\.unsplash\.com\/photo-([a-z0-9-]+)\?/);
      if (m) return `https://images.unsplash.com/photo-${m[1]}?auto=format&fit=crop&w=1000&q=80`;
    }
    return null;
  });
  return photoUrl;
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.ok} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  const dishes = await extractDishesFromTs();
  console.log(`Found ${dishes.length} dishes.`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  const page = await context.newPage();
  const used = new Map(); // photo id → count, to detect duplicates
  const mapping = {};

  for (const dish of dishes) {
    const dest = path.join(PUBLIC_DIR, `${dish.id}.jpg`);
    const query = extractEnglishKeywords(dish.name);
    try {
      const url = await findFirstFoodImage(page, query);
      if (!url) {
        console.warn(`[MISS] ${dish.id} (${dish.name}) — no image for "${query}"`);
        continue;
      }
      const m = url.match(/photo-([a-z0-9-]+)\?/);
      const photoId = m ? m[1] : "unknown";
      // Reject if this photo id is already used (we want unique per dish).
      if (used.has(photoId) && used.get(photoId) >= 1) {
        // Try a few more results by scrolling a bit, in case the first hit
        // collides. We re-run the search and skip the previously-used one.
        const altUrl = await page.evaluate((skipId) => {
          const imgs = Array.from(document.querySelectorAll("figure img"));
          for (const img of imgs) {
            const src = img.currentSrc || img.src;
            if (!src) continue;
            const m = src.match(/images\.unsplash\.com\/(photo-[a-z0-9-]+)\?/);
            if (m && m[1] !== skipId) {
              return `https://images.unsplash.com/${m[1]}?auto=format&fit=crop&w=1000&q=80`;
            }
          }
          return null;
        }, photoId);
        if (altUrl) {
          const m2 = altUrl.match(/photo-([a-z0-9-]+)\?/);
          await downloadImage(altUrl, dest);
          used.set(m2[1], (used.get(m2[1]) || 0) + 1);
          mapping[dish.id] = m2[1];
          console.log(`[OK ] ${dish.id} → ${m2[1]} (replaced duplicate)`);
        } else {
          await downloadImage(url, dest);
          used.set(photoId, (used.get(photoId) || 0) + 1);
          mapping[dish.id] = photoId;
          console.warn(`[DUP] ${dish.id} → ${photoId} (could not avoid, kept anyway)`);
        }
      } else {
        await downloadImage(url, dest);
        used.set(photoId, (used.get(photoId) || 0) + 1);
        mapping[dish.id] = photoId;
        console.log(`[OK ] ${dish.id} → ${photoId}`);
      }
    } catch (err) {
      console.error(`[ERR] ${dish.id} (${dish.name}):`, err.message);
    }
  }

  await browser.close();
  await fs.writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  console.log(`\nMapping written to ${MAPPING_FILE}`);
  console.log(`Unique photos: ${used.size} / ${dishes.length}`);
  for (const [id, count] of [...used.entries()].filter(([, c]) => c > 1)) {
    console.log(`  duplicate: ${id} used ${count} times`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
