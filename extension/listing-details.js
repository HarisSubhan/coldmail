// Self-contained functions: Chrome serializes these into the Maps tab, so they must not use outside variables.
export function readListingDetails(expectedKey = null) {
  if (/\/sorry\//.test(location.pathname) || document.querySelector('iframe[src*="recaptcha"], form[action*="consent"]')) throw new Error('Access check detected. Resolve it manually before resuming.');
  const href = location.href;
  const featureId = href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1]?.toLowerCase();
  // The detail tab is reused: never attribute the previous business's details to this listing.
  if (expectedKey && /^0x/.test(expectedKey) && featureId && featureId !== expectedKey) return null;
  const heading = document.querySelector('h1.DUwDvf, [role="main"] h1, h1');
  const name = heading?.textContent?.trim();
  if (!name) return null;
  const clean = (s) => (s || '').replace(/[\ue000-\uf8ff]/g, ' ').replace(/\s+/g, ' ').trim() || null;
  const text = (el) => el ? (el.innerText ?? el.textContent) : null;
  const value = (selector) => {
    const el = document.querySelector(selector);
    return clean(el?.querySelector('.Io6YTe')?.textContent) || clean(el?.textContent);
  };
  const phoneElement = document.querySelector('button[data-item-id^="phone"], a[href^="tel:"]');
  const rawPhone = phoneElement?.getAttribute('data-item-id')?.replace(/^phone:tel:/, '') || phoneElement?.getAttribute('href')?.replace(/^tel:/, '') || value('button[data-item-id^="phone"]');
  const phone = rawPhone && /\d/.test(rawPhone) ? rawPhone.replace(/[^\d+]/g, '') : null;
  const web = document.querySelector('a[data-item-id="authority"]')?.getAttribute('href');
  let website = null;
  try {
    const url = new URL(web || '');
    const target = url.hostname.endsWith('google.com') ? url.searchParams.get('q') || url.searchParams.get('url') : null;
    const resolved = target ? new URL(target) : url;
    if (['http:', 'https:'].includes(resolved.protocol)) website = resolved.href;
  } catch {}
  const mail = document.querySelector('a[href^="mailto:"]')?.getAttribute('href')?.slice(7).split('?')[0];
  const ratingText = document.querySelector('div.F7nice span[aria-hidden="true"]')?.textContent || document.querySelector('div.F7nice')?.textContent || '';
  const rating = parseFloat(ratingText.replace(',', '.'));
  let reviews = null;
  for (const el of document.querySelectorAll('div.F7nice [aria-label], button[aria-label*="review" i], span[aria-label*="review" i]')) {
    const m = el.getAttribute('aria-label').match(/([\d.,]+)\s+reviews?/i);
    if (m) { reviews = parseInt(m[1].replace(/[.,]/g, ''), 10); break; }
  }
  if (reviews === null) {
    const m = (document.querySelector('div.F7nice')?.textContent || '').match(/\(([\d.,]+)\)/);
    if (m) reviews = parseInt(m[1].replace(/[.,]/g, ''), 10);
  }
  const hoursButton = document.querySelector('[aria-label="Show open hours for the week"], [jsaction*="openhours"], [data-item-id="oh"]');
  const hours = [...document.querySelectorAll('table.eK4R0e tr, table.WgFkxc tr')].map((tr) => [...tr.children].map((td) => clean(text(td))).filter(Boolean).join(' ')).filter(Boolean);
  const coords = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  return {
    business_name: name,
    category: value('button[jsaction*="category"]'),
    address: value('button[data-item-id="address"]'),
    phone, website,
    email: mail && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) ? mail.toLowerCase() : null,
    maps_url: href,
    place_id: href.match(/!19s(ChIJ[A-Za-z0-9_-]+)/)?.[1] || null,
    rating: rating >= 0 && rating <= 5 ? rating : null,
    reviews_count: Number.isFinite(reviews) ? reviews : null,
    open_status: clean(text(hoursButton)),
    opening_hours: hours.length ? hours.join('; ') : null,
    latitude: coords ? Number(coords[1]) : null,
    longitude: coords ? Number(coords[2]) : null,
  };
}

// Scrolls the Maps results panel from the first card to the actual end of the list.
// Returns { listings, endReached, reason }; never stops at a fixed card or scroll count.
export async function discoverListings(max, checkpoint = null, options = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const limit = max || Infinity;
  const settleMs = options.settleMs ?? 2500;     // how long to wait for new cards after each scroll
  const patienceMs = options.patienceMs ?? 30000; // how long the list may stay unchanged at the bottom before we conclude
  let feed;
  for (let attempt = 0; attempt < 30; attempt++) {
    feed = document.querySelector('[role="feed"]');
    if (feed) break;
    if (document.querySelector('h1.DUwDvf')) return { listings: [{ business_name: document.querySelector('h1.DUwDvf').textContent.trim(), maps_url: location.href }], endReached: true, reason: 'single-result' };
    await wait(1000);
  }
  if (!feed) throw new Error('No Maps results found. Check the search window for consent, blocked access or an empty search.');
  // Maps renders the list in its own scrollable panel; scroll that panel, not the page.
  let scroller = feed;
  for (let el = feed; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 4) { scroller = el; break; }
  }
  const keyOf = (url) => url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1]?.toLowerCase() || url.split('?')[0];
  const found = new Map((checkpoint?.listings || []).map((row) => [keyOf(row.maps_url), row]));
  const blocked = () => /\/sorry\//.test(location.pathname) || !!document.querySelector('iframe[src*="recaptcha"], form[action*="consent"]');
  const endMarker = () => /reached the end of the list|end of the list/i.test(feed.textContent);
  const cards = () => feed.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"]');
  // Virtualized list: capture every card while it is rendered.
  const collect = () => {
    for (const anchor of cards()) {
      const name = (anchor.getAttribute('aria-label') || anchor.textContent || '').trim();
      if (!name || !anchor.href) continue;
      const key = keyOf(anchor.href);
      if (!found.has(key)) found.set(key, { business_name: name, maps_url: anchor.href });
    }
  };
  const report = async (state = {}) => {
    if (!checkpoint) return;
    const response = await chrome.runtime.sendMessage({ type: 'discovery-checkpoint', jobId: checkpoint.jobId, areaIndex: checkpoint.areaIndex, listings: [...found.values()], ...state });
    if (response?.paused) throw new Error('Extraction paused');
  };
  scroller.scrollTop = 0;
  collect();
  let idleSince = null, endReached = false;
  while (found.size < limit) {
    if (blocked()) throw new Error('Access check detected. Open Google Maps manually and resolve it before resuming.');
    if (document.visibilityState === 'hidden') {
      // Maps does not load more results in a hidden window; wait instead of concluding early,
      // and restart the idle clock so time spent hidden never counts as "no more results".
      idleSince = null;
      await report({ hidden: true });
      await wait(1000);
      continue;
    }
    const before = found.size, beforeHeight = scroller.scrollHeight;
    scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + Math.max(200, scroller.clientHeight * 0.75));
    const deadline = Date.now() + settleMs;
    do { await wait(300); collect(); } while (Date.now() < deadline && found.size === before && scroller.scrollHeight === beforeHeight);
    if (endMarker()) { collect(); endReached = true; await report(); break; }
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;
    if (found.size > before || scroller.scrollHeight > beforeHeight || !atBottom) idleSince = null;
    else {
      idleSince ??= Date.now();
      if (Date.now() - idleSince >= patienceMs) break;
      // Ask the extension to bring the search window to the front: Maps may pause loading when it is covered.
      await report({ stuck: true });
      // Re-trigger the loader: step back up, then bring the last card into view.
      scroller.scrollTop = Math.max(0, scroller.scrollTop - scroller.clientHeight);
      await wait(500);
      const all = cards();
      all[all.length - 1]?.scrollIntoView?.({ block: 'end' });
      scroller.scrollTop = scroller.scrollHeight;
    }
    await report();
  }
  const listings = [...found.values()].slice(0, limit);
  return { listings, endReached, reason: endReached ? 'end' : listings.length >= limit ? 'limit' : 'no-more-loading' };
}
