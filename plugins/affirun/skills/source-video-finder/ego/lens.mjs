import { existsSync, mkdirSync } from 'node:fs'

import { abs, isMain, j, main, need, pageRef, spaceRef, stem } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node lens.mjs <space> <out dir> <image>...')
  const [space, outDir, ...images] = args
  for (const img of images) {
    if (!existsSync(img)) {
      console.error(`lens.mjs: '${img}' is not a file. Pass each image as its own argument.`)
      process.exit(1)
    }
  }
  mkdirSync(outDir, { recursive: true })
  const list = images.map((img) => ({ path: abs(img), name: stem(img) }))
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const images = ${j(list)};
const outDir = ${j(abs(outDir))};
const pages = [task.page(${pageRef()})];
while (pages.length < images.length) pages.push(await task.newPage());
const isVideo = (u) => /tiktok\.com\/@[^/]+\/video\/\d+|instagram\.com\/(reel|p)\/|facebook\.com\/.*(videos|reel|watch)|youtube\.com\/shorts\/|douyin\.com\/video\/|xiaohongshu\.com\/(explore|discovery)/.test(u);
const grab = (page) => page.evaluate(() => [...document.querySelectorAll("a[href^='http']")].filter(a => !/(^|\.)google\.|gstatic/.test(a.hostname) && a.innerText.trim()).map(a => ({ host: a.hostname.replace(/^www\./, ""), url: a.href.split("?")[0].slice(0, 160), text: a.innerText.trim().replace(/\s+/g, " ").slice(0, 80) })));
async function run(page, img, i) {
  await page.waitForTimeout(i * 700);
  const res = { image: img.path };
  try {
    await page.goto("https://www.google.com/?hl=en", { timeout: 30000 }).catch(() => {});
    await page.click("loc=role:button[name='Search by image']");
    await page.waitForSelector("text=upload a file", { timeout: 10000 });
    const fcP = page.waitForFileChooser({ timeout: 10000 });
    await page.click("text=upload a file");
    await (await fcP).setFiles([img.path]);
    await page.waitForURL(/\/search\?/, { timeout: 30000 });
    await page.waitForTimeout(5000);
    res.overview = await page.evaluate(() => { const h = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent.trim() === "AI Overview"); let n = h; for (let i = 0; i < 6 && n; i++) n = n.parentElement; return n ? n.innerText.replace(/\s+/g, " ").slice(0, 300) : null; });
    await page.screenshot({ path: outDir + "/" + img.name + "-all.png" });
    for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(800); }
    const all = await grab(page);
    await page.click("loc=role:link[name='Exact matches']").catch(() => page.click("text=Exact matches").catch(() => {}));
    await page.waitForTimeout(5000);
    const exact = await grab(page);
    await page.screenshot({ path: outDir + "/" + img.name + "-exact.png" });
    if (/unusual traffic|sorry\/index/i.test(await page.url() + (await page.evaluate(() => document.body.innerText.slice(0, 500))))) res.error = "unusual_traffic";
    const seen = new Set();
    res.videos = [...all, ...exact].filter(x => isVideo(x.url)).filter(x => !seen.has(x.url) && seen.add(x.url));
    res.all = all.filter(x => !isVideo(x.url)).slice(0, 25);
    res.exact = exact.filter(x => !isVideo(x.url)).slice(0, 15);
  } catch (e) { res.error = String(e.message || e).slice(0, 200); }
  return res;
}
const t0 = Date.now();
const results = await Promise.all(images.map((img, i) => run(pages[i], img, i)));
for (const p of pages.slice(1)) await p.close().catch(() => {});
console.log("# lens " + images.length + " images in " + Math.round((Date.now() - t0) / 1000) + "s");
console.log(JSON.stringify(results));
`
}

if (isMain(import.meta.url)) main(build)
