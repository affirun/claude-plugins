import { absJ, isMain, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node 1688-img.mjs <space> <image> <out.png>')
  const [space, img, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
for (const t of await task.tabs()) if (t.label && t.label !== "p1") await task.page(t.label).close().catch(() => {});
const page = task.page(${pageRef()});
await page.goto("https://www.1688.com/", { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.setInputFiles("input[type=file] >> nth=0", [${absJ(img)}]);
await page.waitForTimeout(2500);
const popupP = page.waitForEvent("popup", { timeout: 30000 }).catch(() => null);
await page.click("text=搜索 >> nth=-1").catch(() => page.mouse.click(1060, 392));
const p = (await popupP) || page;
await p.waitForTimeout(9000);
const chips = await p.evaluate(() => { const all = [...document.querySelectorAll("span, div, a")].filter((e) => e.children.length === 0); const k = all.findIndex((e) => e.textContent.trim() === "找相似"); return all.slice(k + 1, k + 4).map((e) => e.textContent.trim()); });
const titles = await p.evaluate(() => [...document.querySelectorAll("div, a")].filter((e) => e.children.length === 0 && /[一-龥]{6,}/.test(e.textContent) && e.textContent.length < 40).map((e) => e.textContent.trim()).slice(0, 30));
console.log(JSON.stringify({ chips, titles }));
await p.screenshot({ path: ${absJ(out)} });
`
}

if (isMain(import.meta.url)) main(build)
