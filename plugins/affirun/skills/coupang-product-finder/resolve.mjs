#!/usr/bin/env node
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const TIMEOUT_MS = 15000
const LIST_LIMIT = 60
const QUERY_LIMIT = 15
const AUTO_RESOLVE = 3
const STOREFRONT_PAGE = 30
const STOREFRONT_MAX_CALLS = 60
const MONEYING_PAGE = 100
const MONEYING_MAX_CALLS = 30

async function get(url, { redirect = 'follow', accept } = {}) {
  const res = await fetch(url, {
    redirect,
    headers: { 'user-agent': UA, ...(accept ? { accept } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  return res
}

async function getJson(url) {
  const res = await get(url, { accept: 'application/json' })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}

export function leadingNumber(title) {
  if (!title) return null
  const t = title.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^(?:no|상품\s*번호)\.?\s*/iu, '')
  const m = t.match(/^(\d{1,5})(?!\d)/)
  if (!m) return null
  const after = t.slice(m[1].length)
  if (/^(?:단|개|종|인용|인|평|색|구|매|장|세트|%|(?:kg|g|ml|l|cm|mm|m|in|x)(?![a-z]))/iu.test(after)) return null
  return Number(m[1])
}

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '')

export function queryWords(query) {
  return [...new Set(query.toLowerCase().split(/[\s,/]+/).filter((w) => w.length >= 2 || /^[가-힣]$/.test(w)))]
}

export function overlap(title, query) {
  const t = (title || '').toLowerCase().replace(/\s+/g, ' ')
  return queryWords(query).filter((w) => t.includes(w)).length
}

export function parseCoupangProduct(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const m = u.pathname.match(/\/vp\/products\/(\d+)/)
  const productId = m?.[1] ?? u.searchParams.get('pageKey')
  if (!productId || !/coupang\.com$/.test(u.hostname)) return null
  const itemId = u.searchParams.get('itemId')
  const vendorItemId = u.searchParams.get('vendorItemId')
  const clean = new URL(`https://www.coupang.com/vp/products/${productId}`)
  if (itemId) clean.searchParams.set('itemId', itemId)
  if (vendorItemId) clean.searchParams.set('vendorItemId', vendorItemId)
  return { productId, itemId, vendorItemId, productUrl: clean.toString() }
}

export async function resolveLink(url) {
  let current = url
  const hops = []
  for (let i = 0; i < 4; i++) {
    const product = parseCoupangProduct(current)
    if (product) return { ...product, hops }
    const host = new URL(current).hostname
    const searchWords = /coupang\.com$/.test(host) && new URL(current).pathname.includes('/search') ? new URL(current).searchParams.get('q') : null
    if (searchWords) return { coupangSearch: searchWords, hops }
    if (/(^|\.)influencers\.coupang\.com$/.test(host)) {
      const [address, fragment] = current.split('#')
      const words = fragment?.match(/:~:text=([^&]+)/)?.[1]
      return { storefront: address.split('?')[0], words: words ? decodeURIComponent(words) : null, hops }
    }
    if (!/(^|\.)(link\.coupang\.com|coupa\.ng|moneying\.biz|inpk\.link|affirun\.com)$/.test(host)) {
      return { other: current.split('?')[0], hops }
    }
    const res = await get(current, { redirect: 'manual' })
    let next = res.headers.get('location')
    if (!next && /moneying\.biz$/.test(host) && res.status === 200) {
      const m = (await res.text()).match(/https:\/\/influencers\.coupang\.com\/s\/[\w.-]+(?:#:~:text=([^"'<\s]+))?/)
      if (m) {
        const words = m[1] ? decodeURIComponent(m[1]).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) : null
        return { storefront: m[0].split('#')[0], words, hops }
      }
    }
    if (!next) return { other: current.split('?')[0], status: res.status, hops }
    current = new URL(next, current).toString()
    hops.push(new URL(current).hostname)
  }
  return { other: current.split('?')[0], hops }
}

async function inpock(url) {
  const html = await (await get(url)).text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
  if (!m) throw new Error('inpock page has no data (private or changed)')
  const blocks = JSON.parse(m[1]).props?.pageProps?.blocks ?? []
  return blocks
    .flatMap((b) => (Array.isArray(b.links) ? b.links : [b]))
    .filter((b) => b.is_open !== false && b.url)
    .map((b) => ({
      title: (b.title ?? '').replace(/\s+/g, ' ').trim(),
      url: b.url,
      image: b.image ? `https://d13k46lqgoj3d6.cloudfront.net/${b.image.replace(/^images\//, '')}?w=600&f=png` : null,
    }))
}

function moneyingItem(l) {
  return {
    title: l.title,
    url: l.has_url ? `https://moneying.biz/l/${l.id}` : null,
    image: l.thumbnail ? new URL(l.thumbnail, 'https://moneying.biz').toString() : null,
    price: l.show_price && l.price ? l.price : null,
  }
}

async function moneying(url, { number, query }) {
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop()
  const base = `https://moneying.biz/api/link/${encodeURIComponent(slug)}`
  const search = async (q) => (await getJson(`${base}/search?q=${encodeURIComponent(q)}`)).links ?? []
  let links = []
  if (number != null) links = await search(String(number))
  else if (query) {
    const seen = new Set()
    for (const w of queryWords(query).slice(0, 6)) {
      for (const l of await search(w)) if (!seen.has(l.id)) (seen.add(l.id), links.push(l))
    }
  } else {
    for (let i = 0; i < MONEYING_MAX_CALLS && links.length < LIST_LIMIT; i++) {
      const page = await getJson(`${base}/more?limit=${MONEYING_PAGE}&offset=${i * MONEYING_PAGE}`)
      links.push(...(page.links ?? []))
      if (!page.has_more) break
    }
  }
  return links.filter((l) => l.block_type === 'link').map(moneyingItem)
}

function storefrontRange(title) {
  const m = title.match(/(\d{1,5})\s*[~\-–]\s*(\d{1,5})/)
  return m ? [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])] : null
}

function storefrontItem(p, collection) {
  return {
    title: p.title ?? p.customName ?? p.productName ?? '',
    collection,
    image: p.image ? p.image.replace(/\/\d+x\d+ex\//, '/492x492ex/') : null,
    price: p.salesPrice?.units ?? null,
    soldOut: p.isSoldOut ?? false,
    product: parseCoupangProduct(
      `https://www.coupang.com/vp/products/${p.productId}?itemId=${p.itemId ?? ''}&vendorItemId=${p.vendorItemId ?? ''}`,
    ),
  }
}

const unescapeHtml = (t) => t.replace(/\\u0026/g, '&').replace(/&amp;/g, '&')

async function storefront(url, { number, query }) {
  const name = new URL(url).pathname.split('/').filter(Boolean)[1]
  if (!name) throw new Error('storefront address has no name')
  const api = 'https://influencers.coupang.com/api/v1/storefronts/rendering/landing'
  const search = async (q) =>
    ((await getJson(`${api}/search?storefrontName=${encodeURIComponent(name)}&query=${encodeURIComponent(q)}`)).data ?? []).flatMap(
      (d) => (d.elements?.list ?? []).map((p) => storefrontItem(p, null)),
    )
  const dedupe = (items) => {
    const seen = new Set()
    return items.filter((i) => {
      const key = `${i.product?.productId}|${i.title}`
      return seen.has(key) ? false : (seen.add(key), true)
    })
  }
  if (number != null) return { items: dedupe(await search(String(number))) }
  if (query) {
    const found = []
    for (const w of queryWords(query).slice(0, 6)) found.push(...(await search(w)))
    return { items: dedupe(found) }
  }

  const html = (await (await get(`https://influencers.coupang.com/s/${name}`)).text()).replace(/\\"/g, '"')
  const collections = []
  for (const m of html.matchAll(/\{"id":"(\d+)","title":"([^"]*)","templateType":"COLLECTION[^}]*?"productCount":(\d+)/g)) {
    if (!collections.some((c) => c.id === m[1])) collections.push({ id: m[1], title: unescapeHtml(m[2]), count: Number(m[3]) })
  }
  if (!collections.length) throw new Error('storefront has no collections (private or changed)')
  const perCollection = Math.max(8, Math.ceil(LIST_LIMIT / collections.length))
  const items = []
  for (const c of collections.slice(0, STOREFRONT_MAX_CALLS)) {
    const j = await getJson(
      `${api}/collection?storefrontName=${encodeURIComponent(name)}&collectionId=${c.id}&offset=0&limit=${Math.min(perCollection, STOREFRONT_PAGE)}`,
    )
    items.push(...(j.data?.elements?.list ?? []).map((p) => storefrontItem(p, c.title)))
  }
  return { items: dedupe(items), collections: collections.map((c) => ({ title: c.title, count: c.count })) }
}

async function affirun(url, { number, query }) {
  const handle = new URL(url).pathname.split('/').filter(Boolean)[0]
  const base = `https://api.affirun.com/public/pages/${encodeURIComponent(handle)}/links`
  const flat = (rows) => rows.flatMap((r) => [r, ...(r.items ?? [])]).filter((r) => r.url && !/about:blank|about\.blank/.test(r.url))
  let rows = []
  if (number != null) rows = flat((await getJson(`${base}?q=${number}`)).items ?? [])
  else if (query) {
    const seen = new Set()
    for (const w of queryWords(query).slice(0, 6)) {
      for (const r of flat((await getJson(`${base}?q=${encodeURIComponent(w)}`)).items ?? [])) {
        if (!seen.has(r.id)) (seen.add(r.id), rows.push(r))
      }
    }
  } else rows = flat((await getJson(base)).items ?? [])
  return rows.map((r) => ({ title: r.title, url: r.url, image: r.thumbnailUrl ?? null }))
}

function kindOf(url) {
  const host = new URL(url).hostname.replace(/^www\./, '')
  if (host === 'link.inpock.co.kr' || host === 'inpk.link') return 'inpock'
  if (host === 'moneying.biz') return 'moneying'
  if (host === 'influencers.coupang.com') return 'coupang-storefront'
  if (host === 'affirun.com') return 'affirun'
  return 'unknown'
}

async function readPage(url, opts) {
  const kind = kindOf(url)
  if (kind === 'inpock') return { kind, items: await inpock(url) }
  if (kind === 'moneying') return { kind, items: await moneying(url, opts) }
  if (kind === 'coupang-storefront') return { kind, ...(await storefront(url, opts)) }
  if (kind === 'affirun') return { kind, items: await affirun(url, opts) }
  return { kind, items: [] }
}

function pick(items, { number, query }) {
  if (number != null) return items.filter((i) => leadingNumber(i.title) === number)
  if (query) {
    return items
      .map((i) => ({ ...i, score: overlap(i.title, query) }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, QUERY_LIMIT)
  }
  return items.slice(0, LIST_LIMIT)
}

async function main() {
  const args = process.argv.slice(2)
  const flag = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  if (flag('--link')) {
    console.log(JSON.stringify(await resolveLink(flag('--link')), null, 2))
    return
  }
  const url = args.find((a) => /^https?:\/\//.test(a))
  if (!url) {
    console.error('usage: resolve.mjs <bio url> [--number N | --query "words"]  |  resolve.mjs --link <url>')
    process.exit(2)
  }
  const number = flag('--number') != null ? Number(flag('--number')) : null
  const query = flag('--query') ?? null
  const opts = { number, query }

  const page = await readPage(url, opts)
  let matches = pick(page.items, opts)
  const out = { site: { url, kind: page.kind }, blocks: page.items.length, mode: number != null ? 'number' : query ? 'query' : 'list' }
  if (page.kind === 'unknown') out.note = 'This page type is not supported. Read it in the browser (get_page_text lists the titles).'
  if (page.collections) out.collections = page.collections
  const hitsOnly = page.kind === 'moneying' ? number != null || !!query : page.kind === 'coupang-storefront' && (number != null || !!query)
  if (hitsOnly) out.blocksAre = 'search hits, not the page size'
  let sample = page.items
  if (hitsOnly && number != null) sample = (await readPage(url, { number: null, query: null })).items
  const numbers = sample.map((i) => leadingNumber(i.title)).filter((n) => n != null)
  if (numbers.length >= Math.max(5, sample.length * 0.3)) out.highestNumber = Math.max(...numbers)

  if (number != null) {
    const resolved = []
    for (const m of matches.slice(0, AUTO_RESOLVE)) {
      if (m.product || !m.url) {
        resolved.push(m)
        continue
      }
      const r = await resolveLink(m.url)
      if (r.storefront) {
        const page2 = (await readPage(r.storefront, opts)).items
        let inside = pick(page2, opts)
        if (!inside.length && r.words && r.words !== String(number)) {
          inside = (await readPage(r.storefront, { number: null, query: r.words })).items.filter((i) => norm(i.title).includes(norm(r.words)))
        }
        resolved.push(
          ...(inside.length
            ? inside.map((i) => ({ ...i, via: m.title, storefront: r.storefront }))
            : [{ ...m, resolved: { ...r, lookup: `not on the storefront (searched ${number}${r.words ? ` and "${r.words}"` : ''})` } }]),
        )
      } else resolved.push({ ...m, product: r.productId ? r : undefined, resolved: r.productId ? undefined : r })
    }
    matches = [...resolved, ...matches.slice(AUTO_RESOLVE)]
  }
  out.matches = matches
  console.log(JSON.stringify(out, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(JSON.stringify({ error: String(err?.message ?? err) }))
    process.exit(1)
  })
}
