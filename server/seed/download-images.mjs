import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DATA_PATH = path.join(__dirname, 'seed-data.json');
const IMAGES_DIR = path.join(__dirname, 'images');
const URL_CACHE_PATH = path.join(__dirname, 'url-cache.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const WIKI_ARTICLES = {
  "1960s Levi's 501 Selvedge Jeans": "Jeans",
  "1970s Polaroid SX-70 Camera": "Polaroid SX-70",
  "1980s Casio G-Shock DW-5000C": "Casio F-91W",
  "Oil Painting – Parisian Street Scene": "Paris Street; Rainy Day",
  "1970s Pioneer SX-780 Receiver": "Stereo receiver",
  "Murano Glass Vase – Sommerso Technique": "Murano glass",
  "Sony Walkman TPS-L2 (1979)": "Walkman",
  "Vintage Persian Tabriz Rug": "Tabriz rug",
  "1950s Bakelite Bangle Set": "Bangle",
  "1970s Gucci Jackie Bag": "Gucci",
  "1980s Members Only Racer Jacket": "Bomber jacket",
  "1960s Rotary Telephone – Red": "Rotary dial",
  "Antique Silver Pocket Watch": "Pocket watch",
  "Art Nouveau Bronze Figurine": "Art Nouveau",
  "Chippendale Mahogany Side Table": "Chippendale furniture",
  "Vintage Turquoise and Silver Ring": "Turquoise",
  "1990s Gameboy Color – Teal": "Game Boy Color",
  "1930s Depression Glass Dessert Set": "Depression glass",
  "1950s Dior 'New Look' Skirt Suit": "Christian Dior",
  "1960s Omega Seamaster De Ville": "Omega Seamaster",
  "Leather-Bound Encyclopedia Britannica (1911)": "Encyclopædia Britannica",
  "1980s Versace Silk Shirt": "Gianni Versace",
  "1970s Technics SL-1200 Turntable": "Technics SL-1200",
  "1950s Fiesta Ware Pitcher – Red": "Fiesta (dinnerware)",
  "1940s Leather Bomber Jacket – Type A-2": "A-2 jacket",
  "Andy Warhol 'Flowers' Lithograph": "Andy Warhol",
  "Copper Moscow Mule Mug Set (1950s)": "Moscow mule",
  "Vintage 'Brave New World' First UK Edition": "Brave New World",
  "Antique Map – Mediterranean 1780": "Cartography",
  "Vintage Globe Bar Cabinet": "Globe",
  "Amber and Gold Victorian Brooch": "Brooch",
  "1960s Psychedelic Concert Poster": "Psychedelic art",
  "Victorian Brass Desk Lamp": "Oil lamp",
  "Art Deco Diamond Brooch": "Art Deco",
  "Mid-Century Teak Coffee Table": "Coffee table",
  "1940s Hermes Silk Scarf": "Hermès",
  "1930s Art Deco Cocktail Shaker": "Cocktail shaker",
  "1920s Flapper Beaded Evening Bag": "Handbag",
};

async function apiGet(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  return res.json();
}

async function getWikipediaOriginalImage(articleTitle) {
  try {
    const data = await apiGet(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&prop=pageimages&piprop=original&format=json`
    );
    const pages = Object.values(data.query.pages);
    for (const page of pages) {
      if (page.original?.source && !page.original.source.includes('.svg')) {
        return page.original.source;
      }
    }
  } catch (e) {
    console.error(`  Wiki API error: ${e.message}`);
  }
  return null;
}

async function searchCommonsImage(query) {
  try {
    const data = await apiGet(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent('File: ' + query)}&gsrlimit=10&prop=imageinfo&iiprop=url|mime&format=json`
    );
    if (!data.query?.pages) return null;
    const pages = Object.values(data.query.pages).sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = info.mime || '';
      if (mime.startsWith('image/') && !mime.includes('svg') && !mime.includes('tiff')) {
        return info.url;
      }
    }
  } catch (e) {
    console.error(`  Commons API error: ${e.message}`);
  }
  return null;
}

function curlDownload(url, destPath) {
  try {
    execSync(
      `curl -sL -o "${destPath}" -w "%{http_code}" -H "User-Agent: ${UA}" --connect-timeout 15 --max-time 60 "${url}"`,
      { encoding: 'utf-8', timeout: 70000 }
    );
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 5000) {
      return true;
    }
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  } catch (e) {
    console.error(`  curl error: ${e.message}`);
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  }
  return false;
}

function getExtFromUrl(url) {
  try {
    const ext = path.extname(new URL(url).pathname).split('?')[0].toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext;
  } catch {}
  return '.jpg';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(SEED_DATA_PATH, 'utf-8'));
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  let urlCache = {};
  if (fs.existsSync(URL_CACHE_PATH)) {
    urlCache = JSON.parse(fs.readFileSync(URL_CACHE_PATH, 'utf-8'));
  }

  const postsToProcess = data.posts.filter(p => p.images.length === 0);
  console.log(`Need images for ${postsToProcess.length} posts\n`);

  // Phase 1: Collect all image URLs via APIs (fast, not rate limited)
  console.log('=== Phase 1: Collecting image URLs ===\n');
  for (const post of postsToProcess) {
    if (urlCache[post.title]) {
      console.log(`[${post.title}] cached: ${urlCache[post.title].substring(0, 80)}...`);
      continue;
    }

    console.log(`[${post.title}]`);
    let imageUrl = null;

    if (WIKI_ARTICLES[post.title]) {
      console.log(`  Wiki: "${WIKI_ARTICLES[post.title]}"`);
      imageUrl = await getWikipediaOriginalImage(WIKI_ARTICLES[post.title]);
    }

    if (!imageUrl) {
      const query = `${post.title} ${post.brand}`.trim();
      console.log(`  Commons: "${query}"`);
      imageUrl = await searchCommonsImage(query);
    }

    if (imageUrl) {
      urlCache[post.title] = imageUrl;
      console.log(`  Found: ${imageUrl.substring(0, 80)}...`);
    } else {
      console.log(`  No image found`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  fs.writeFileSync(URL_CACHE_PATH, JSON.stringify(urlCache, null, 2));
  const foundCount = postsToProcess.filter(p => urlCache[p.title]).length;
  console.log(`\nFound URLs for ${foundCount}/${postsToProcess.length} posts\n`);

  // Phase 2: Download images with curl, long delays to avoid 429
  console.log('=== Phase 2: Downloading images (8s delay between each) ===\n');
  let updated = 0;
  let failed = 0;

  for (const post of postsToProcess) {
    const imageUrl = urlCache[post.title];
    if (!imageUrl) {
      failed++;
      continue;
    }

    const ext = getExtFromUrl(imageUrl);
    const uuid = crypto.randomUUID();
    const prefix = 'seed0000000000000000000000';
    const filename = `${prefix}_${uuid}${ext}`;
    const destPath = path.join(IMAGES_DIR, filename);

    console.log(`[${post.title}]`);
    console.log(`  Downloading...`);

    const ok = curlDownload(imageUrl, destPath);
    if (ok) {
      post.images = [filename];
      updated++;
      const sizeKb = Math.round(fs.statSync(destPath).size / 1024);
      console.log(`  OK: ${filename} (${sizeKb}KB)`);
    } else {
      console.log(`  FAILED`);
      failed++;
    }

    // Save progress after each download
    fs.writeFileSync(SEED_DATA_PATH, JSON.stringify(data, null, 2));

    // 8 second delay to respect rate limits
    if (post !== postsToProcess[postsToProcess.length - 1]) {
      console.log(`  Waiting 8s...`);
      await new Promise(r => setTimeout(r, 8000));
    }
  }

  console.log(`\n=============================`);
  console.log(`Done! Updated: ${updated}, Failed: ${failed}`);
  console.log(`=============================`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
