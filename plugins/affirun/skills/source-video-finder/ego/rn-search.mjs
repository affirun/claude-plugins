import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node rn-search.mjs "<query>" <space> <out.png>')
  const [q, space, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const out = ${absJ(out)};
if (!(await page.url()).includes("rednote.com")) { await page.goto("https://www.rednote.com/explore", { timeout: 30000 }); }
await page.waitForSelector("#search-input", { timeout: 20000 });
await page.click("#search-input");
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.insertText(${j(q)});
await page.keyboard.press("Enter");
await page.waitForSelector("section.note-item", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.click("text=Videos").catch(() => page.click("text=视频").catch(() => {}));
await page.waitForTimeout(3000);
const rows = await page.evaluate(() => [...document.querySelectorAll("section.note-item")].map((s) => {
  const a = s.querySelector("a.cover") || s.querySelector("a[href*='/explore/'], a[href*='/search_result/']");
  const href = a?.getAttribute("href") || "";
  const id = (href.match(/([0-9a-f]{24})/) || [])[1];
  const tok = (href.match(/xsec_token=([^&]+)/) || [])[1];
  return { id, tok, title: s.querySelector(".title")?.innerText?.slice(0, 60), author: s.querySelector(".author .name, .name")?.innerText, video: !!s.querySelector(".play-icon, svg.play-icon, [class*=play]") };
}).filter((r) => r.id));
console.log(JSON.stringify(rows.map((r, i) => ({ i, ...r }))));
await (await import("node:fs/promises")).writeFile(out + ".json", JSON.stringify(rows));
await page.screenshot({ path: out });
`
}

if (isMain(import.meta.url)) main(build)
