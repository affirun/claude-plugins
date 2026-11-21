import { isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

const DEFAULT_MAX_SEC = 180
const STALL_SEC = 90
const START_SEC = 30
const POLL_MS = 10000

export function decide(cards, notice, memo, nowSec, limits) {
  const count = (state) => cards.filter((c) => c.state === state).length
  const open = count('pending') + count('fetching')
  const signature = cards.map((c) => c.state).join(',')
  if (signature !== memo.signature) {
    memo.signature = signature
    memo.changedAt = nowSec
  }
  if (cards.some((c) => c.state !== 'pending')) memo.moved = true
  if (notice) return { action: 'stop', reason: notice }
  if (cards.length === 0) return { action: 'stop', reason: 'no_videos' }
  if (open === 0) {
    if (count('failed') > 0 && !memo.retried) return { action: 'retry' }
    return { action: 'stop', reason: 'done' }
  }
  if (nowSec >= limits.maxSec) return { action: 'stop', reason: 'timed_out' }
  if (!memo.moved && nowSec >= limits.startSec) return { action: 'stop', reason: 'not_started' }
  if (nowSec - memo.changedAt >= limits.stallSec) return { action: 'stop', reason: 'stalled' }
  return { action: 'wait' }
}

export function build(args) {
  need(args, 2, 'node session-wait.mjs <space> <session url> [max seconds=180]')
  const [space, url, max] = args
  const maxSec = Number(max) > 0 ? Number(max) : DEFAULT_MAX_SEC
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const decide = ${decide.toString()};
const limits = { maxSec: ${maxSec}, stallSec: ${STALL_SEC}, startSec: ${START_SEC} };
const read = () => page.evaluate(() => {
  const hosts = { tiktok: "tiktok.com", douyin: "douyin.com", rednote: "rednote.com", xiaohongshu: "xiaohongshu.com", instagram: "instagram.com" };
  const cards = [...document.querySelectorAll('[data-testid="source-find-candidate"]')].map((card) => {
    const link = [...card.querySelectorAll("a[href]")].map((a) => a.href).find((h) => Object.values(hosts).some((x) => h.includes(x))) || "";
    const platform = (Object.entries(hosts).find(([, x]) => link.includes(x)) || [""])[0];
    const id = (link.split("?")[0].replace(/\/$/, "").split("/").pop() || "").slice(0, 32);
    const text = card.innerText;
    const state = card.querySelector("video") ? "ready" : /영상을 받는 중/.test(text) ? "fetching" : /받을 차례/.test(text) ? "pending" : /받지 못했어요/.test(text) ? "failed" : "unknown";
    const quality = card.querySelector('[data-testid="source-find-quality"]')?.innerText.trim();
    const error = state === "failed" ? (text.split("\n").map((s) => s.trim()).filter(Boolean).find((s, i, all) => all[i - 1] === "영상을 받지 못했어요" && s !== "다시 받기") || "").slice(0, 80) : undefined;
    return { platform, id, state, quality, error };
  });
  const needs = document.querySelector('[data-testid="source-find-needs-extension"]')?.innerText || "";
  const notice = location.pathname.startsWith("/login") ? "signed_out" : /업데이트/.test(needs) ? "downloader_outdated" : /설치/.test(needs) ? "downloader_missing" : needs ? "downloader_unsupported" : null;
  return { cards, notice, path: location.pathname };
});
await page.goto(${j(url)}, { timeout: 30000 }).catch(() => {});
await page.waitForFunction(() => location.pathname.startsWith("/login") || document.querySelector('[data-testid="source-find-candidate"]'), undefined, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(3000);
const started = Date.now();
const memo = { signature: null, changedAt: 0, retried: 0, moved: false };
let state = await read();
let step = { action: "wait" };
for (;;) {
  const nowSec = Math.round((Date.now() - started) / 1000);
  step = decide(state.cards, state.notice, memo, nowSec, limits);
  if (step.action === "stop") break;
  if (step.action === "retry") {
    memo.retried = await page.evaluate(async () => {
      const buttons = [...document.querySelectorAll('[data-testid="source-find-candidate"] button')].filter((b) => b.innerText.includes("다시 받기"));
      for (const b of buttons) { b.click(); await new Promise((r) => setTimeout(r, 800)); }
      return buttons.length;
    });
    memo.changedAt = nowSec;
  }
  await page.waitForTimeout(${POLL_MS});
  state = await read();
}
const count = (s) => state.cards.filter((c) => c.state === s).length;
console.log(JSON.stringify({
  result: step.reason,
  waitedSec: Math.round((Date.now() - started) / 1000),
  retried: memo.retried,
  counts: { ready: count("ready"), fetching: count("fetching"), pending: count("pending"), failed: count("failed") },
  cards: state.cards.map((c) => [c.platform, c.id, c.state, c.quality || c.error || ""].join(" ").trim()),
}));
`
}

if (isMain(import.meta.url)) main(build)
