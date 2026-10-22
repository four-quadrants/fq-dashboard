// Read-only Airtable proxy for the 4Q Practice Dashboard.
// The Airtable token lives here (server-side env var) and NEVER reaches the browser.
// Only the tables/fields the dashboard needs are exposed, read-only, with a fixed
// whitelist. Everything else is rejected. Returns the same {cellValuesByFieldId}
// shape the front-end already uses in Cowork, so the app code is identical in both.
import crypto from 'node:crypto';

const BASE = 'app6Ki6RiJWFcuifz';

const MD_FIELDS = [
  'fldDJyaIgXrGYxYel','fld6AyyVv2GvAh0Eh','fld8JIScPigMRgbo7',
  'fldOTIraAKAFUleOD','fldOjlOk0vU2q8bXV','flduzI96lzLTBfWHB','fldSe2ChcitVDOF8C','fld7vZYNHcrf9EiLx',
  'fldMTK0Xh3wageOf9','flddVZLB1It45H8zA','fldKt5x2D7ZnQUaIt',
  'fldTc1hp2DdupEgpo','fldLjdYgDDWp547g4','fldqsckDzofiLtaiv',
  'fldLpZj4XKYlBicFa','fldBGCM7UntlMkSBX','fldsv43wkOQvJ7xwR','fld3hhx3bLB09XaQ2',
  'fldbul0o6FBRsGDEC','fldswmNXf9rCbHaFw','fldnK6gAXn2X2CfPO','fldekkdWDhz5YJev9',
  'fldBu9xPLzXZ8N4ew','fldJvzltfI4Q9wkdq','fld6KnbwIsCDH7DcR',
  'fldHCZTLf6ndNGonS','fldnyu7Cj9xJG0tJi','flds1OagHAjjmLLRq',
  'fld36UNJrPWGkbWyk','fldPJaOYDrFGQKPR7','fldviqdX3tMUtjpVG','fldAg1sxi4TDb21s2'
];
const FC_FIELDS = [
  'fldbys0bquQ4Jv2B0','fldyE9KrygDs6klh2','fld4FciVakAswjCYQ','fldPVDwzpOYWyX358',
  'fldKP2EhVT3zpVPG0','fldKwumdJPy9SBmpq','fldVcUXN5EY5Qle33','fldelVnOTf6bVum2V',
  'fldpbIW4jaI6Iz1RI','flddQCPE3ZikanZOi','fldOjDsTUs0KQDLIe','fld8OKHKvfhQYWWo5',
  'fldB4kgyKb1aYgqKn','fldlOAPEEq4pUFhqz','fldJWXi9OphD8a8uJ'
];
const PORTFOLIO_FIELDS = [
  'fldDJyaIgXrGYxYel','fld8JIScPigMRgbo7','flduzI96lzLTBfWHB','fld7vZYNHcrf9EiLx',
  'fldOTIraAKAFUleOD','fldOjlOk0vU2q8bXV','fldHCZTLf6ndNGonS','fldnyu7Cj9xJG0tJi',
  'flds1OagHAjjmLLRq','fld6KnbwIsCDH7DcR','fld36UNJrPWGkbWyk','fldPJaOYDrFGQKPR7',
  // doctor-day columns — fallback for per-day when Practice Days Worked is blank
  'flddVZLB1It45H8zA','fldLjdYgDDWp547g4','fldBGCM7UntlMkSBX','fld3hhx3bLB09XaQ2',
  'fldswmNXf9rCbHaFw','fldekkdWDhz5YJev9','fldJvzltfI4Q9wkdq'
];
// MonthlyFinancials (v18): P&L category columns (monthly activity), balance-sheet columns
// (month-end), Basis, Load Notes, Account Detail, and the statement check totals.
const FIN_FIELDS = [
  'fldXig4JLOvu1RqIe','fldxt3lqqi4lQo2PS','fldrQEKd5wqyWBp0I','flduoRauXGPe9vcdR','fldNA3gi2gs4iRbRC',
  'fld1uAoF6nmEj4kc3','fldke51QOSLTmSFkA','fldWg9FXD5YL4YBK9',
  // P&L
  'fld2jzSkJo93mEmde','fldczZHIJk6U6J38S','fldEVEuJyTLthC7Eo',
  'fldP5YVNWD3bug5Xb','fldVWQYflwybJPY7G','fldyI4WGZByqIeIrF','fldRNEkJAfUaf8eLs','fldBbvejurDOLYHyk',
  'fldNDfU9hoQB8fxZ1','fldu6vHgS5SbXqH5T','fldqT7SUzXkvMFtmx','fldR5RHZrWhMpqQSA','fldkV6GbsphsXUwiO',
  'fldmKUSri3UYk4Pit','fldD94BzAsqK2sxth','fldeP865WCtNyBuB0',
  'fldsMV50VrFeEJU3R','fldJLcwppIjht6nvk','fldmN7OrNsdPLsmWa','fldAJQQ36KqEFXSsH',
  'fldGI0I7peFgOTYmg','fld3TgBDS4VriueY8','fldqy3X7MAwSEODWb','fldnpgZ0qTVT3Hvy6','fldzQIWZjbIW1mVwf',
  'fldOtP0Qx9nYvbfdn','fld24XZfLmJgkGQka','fldQpN5SxuZi5vow2','fld4QJmvZHWRnpCsx',
  'fld8eYZHpslV3JXAI','fldPIBXevQ6dSUqio','fld4qUfmn1Ikzev9i','fldSO6VHT6EZkpxMP','fld61YmT4O8L8lrBo','fldMVjJk8ILLoSo7y',
  'fldZO6vsjRN2peLfF','fldECml70miMoe3wr','flddxPtqwUl182fUI','fldgg4iLRUi3LJFk3','fldWT1k55kxn4hHNT',
  'fldlpUB5EsJdbdVQr',
  // One-offs (JSON, loader-owned) - powers the "Excluding one-offs" view
  'fldT8UB2YU9UtX4Np',
  // Balance sheet
  'fldckN81CtwCJsMqT','fldIQ2AJlwO22aemU','fldZC1blYmNy21F7S','fldxOI5Bl9bWImwra','fld8XozehUMSLjTRe',
  'fldKZkiunNf5rijIk','fldGDUFmm4uPnCzfX','fldQyKyTznpWeDCAN','fldGDETlSrTNEewZq','fldbKz1pZ9XiRS720',
  'fldEl2C8utZOaRn3X','fldvnAHYJSUjAhTIv','fldtLxaXtXveYIccc','fldKuMHLl1K59lcIz'
];

// Whitelisted resources -> table + exact fields + optional practice-link filter + sort.
const RES = {
  practices: {
    table: 'tblpbRJJH83aVrNW0',
    fields: ['fldAFjgH9h49Fem9x','fldDIczZcGe7994dp','fldExbHIOMSmNuQ0o','fldno1MWgUylqz81C',
             'fldUIyId0U9TNzQQM','fldWiJ8Hx1cLPc9rQ','fld8ghrOGS9UHq0mT','fldJUgl9j19XAKBJr',
             'fldzIv29NmW3SkJfV','fldDO0DQbwPi0dWZx','fldAsDcCvj9buY2kb','fldrTTzJPcCnGaTmu',
             'fldrUFlEllGgKOurv','fldCHZ3HSoHwPSRsH',
             // v18 financials: Accountant, Financials Client, Target/Historical Overhead,
             // Ideal Cash Balance, Latest Financials Month
             'fldc33uOdw3uKK89P','fldJhvvtIPMyM2fRE','fldQFJeY45kRJE3oX','fldReDkA6dMjH60Kf',
             'fldjpgU6elK2abfHr','fldYQ0vm1QsXWN1TC','fldnVrz5hA17oY2bu','fldgvSiqZE0jrrUZ5','fldMrujppN7v2B03I','fldHWBE5ZtqDOtAw4','fldKnPMfSXwuGdXfW',
             // v18.7 Financials Only (No Production)
             'fldjtYNGc0D0gMnp1'],
    sort: [{ field: 'fldAFjgH9h49Fem9x', dir: 'asc' }]
  },
  monthly: {
    table: 'tblqHbZTnY6WG8Bp8',
    fields: MD_FIELDS,
    linkFieldName: 'Practice UID',
    sort: [{ field: 'fldDJyaIgXrGYxYel', dir: 'desc' }],
    requiresPractice: true
  },
  forecasts: {
    table: 'tblVh9PfDQKEyBrFJ',
    fields: FC_FIELDS,
    linkFieldName: 'Practice UID',
    sort: [{ field: 'fldbys0bquQ4Jv2B0', dir: 'asc' }],
    requiresPractice: true
  },
  doctors: {
    table: 'tblVKhoeigxxBR6x3',
    fields: ['fldFQ9utJUs1i2cjb','fldwbKiIfMg691cxa','fldhlpqaHellsHnzf','fldxSnUuARGXuIm7V','fldQdubWKbVGhlnjL'],
    linkFieldName: 'Practice UID',
    sort: [{ field: 'fldwbKiIfMg691cxa', dir: 'asc' }],
    requiresPractice: true
  },
  // v18: one practice's monthly P&L + balance sheet rows, oldest first.
  financials: {
    table: 'tblBELWpdR1EiowD4',
    fields: FIN_FIELDS,
    linkFieldName: 'Practice UID',
    sort: [{ field: 'fldXig4JLOvu1RqIe', dir: 'asc' }],
    requiresPractice: true
  },
  // v18: staff list (names/initials for the Accountant link and the "My clients" picker).
  team: {
    table: 'tbl34umujZ5FY3oPM',
    fields: ['fldKHHsAQs1jg76il','fldf98AlwbiO75IzB','fldlv92zvcktMyqt6','fld224ky0IzRNmNx0','fldoe79CXo7KVvymt',
             'fld5m0aNHoF8U645q'],   // My Clients (v18.3)
    sort: [{ field: 'fldKHHsAQs1jg76il', dir: 'asc' }]
  },
  // Book-wide: recent monthly rows across all practices (the app keeps each practice's
  // latest month). Capped so the serverless call stays fast and well under the timeout.
  portfolio: {
    table: 'tblqHbZTnY6WG8Bp8',
    fields: PORTFOLIO_FIELDS,
    sort: [{ field: 'fldDJyaIgXrGYxYel', dir: 'desc' }],
    maxRecords: 1800
  }
};

function authToken(pw) { return crypto.createHash('sha256').update('ps|' + pw).digest('hex'); }
function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function isAuthed(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return true; // no password configured => open (e.g. when fronted by SSO)
  return parseCookies(req.headers.cookie)['ps_auth'] === authToken(pw);
}

// ---- Capacity protection (v18) ----------------------------------------------
// Airtable allows 5 requests/second per base; going over locks the base's API out for
// 30 s, for everyone (including the loaders). The Team plan also caps the workspace at
// 100,000 API calls a month. So the proxy:
//   1. caches each answer in memory for a few minutes (one fetch serves everyone);
//   2. shares in-flight fetches (two people opening the same practice = one fetch);
//   3. paces its own Airtable calls to <= ~4/s;
//   4. on a 429, waits 30 s once and retries instead of failing.
// The cache lives inside this function, behind the password check (never Vercel's
// shared CDN cache, which would sit in front of the login).
const TTL_MS = { portfolio: 5 * 60e3, practices: 60e3, team: 30 * 60e3, default: 60e3 };
const cache = new Map();      // key -> { at, records }
const inflight = new Map();   // key -> Promise
let nextSlot = 0;             // pacing: earliest time the next Airtable call may start
const GAP_MS = 250;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function paced() {
  const now = Date.now(), at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await sleep(at - now);
}

async function fetchAll(table, fields, filterByFormula, sort, maxRecords) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN not set on the server');
  let records = [], offset;
  do {
    const url = new URL(`${process.env.AIRTABLE_API_ORIGIN || 'https://api.airtable.com'}/v0/${BASE}/${table}`);
    fields.forEach(f => url.searchParams.append('fields[]', f));
    url.searchParams.set('returnFieldsByFieldId', 'true');
    url.searchParams.set('pageSize', '100');
    if (filterByFormula) url.searchParams.set('filterByFormula', filterByFormula);
    if (sort) sort.forEach((s, i) => { url.searchParams.set(`sort[${i}][field]`, s.field); url.searchParams.set(`sort[${i}][direction]`, s.dir); });
    if (offset) url.searchParams.set('offset', offset);
    await paced();
    let r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429) { await sleep(30e3); await paced(); r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
    if (!r.ok) throw new Error('Airtable ' + r.status);
    const data = await r.json();
    records = records.concat(data.records || []);
    offset = data.offset;
    if (maxRecords && records.length >= maxRecords) break;
  } while (offset);
  return records.map(r => ({ id: r.id, cellValuesByFieldId: r.fields || {} }));
}

async function cachedFetch(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.records;
  if (inflight.has(key)) return inflight.get(key);
  const p = fn().then(records => { cache.set(key, { at: Date.now(), records }); return records; })
                .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthed(req)) { res.status(401).json({ error: 'Not signed in' }); return; }

  const spec = RES[String(req.query.resource || '')];
  if (!spec) { res.status(400).json({ error: 'Unknown resource' }); return; }

  let filter = null;
  if (spec.requiresPractice) {
    const uid = String(req.query.practice || '');
    if (!/^[A-Za-z0-9-]{1,20}$/.test(uid)) { res.status(400).json({ error: 'Invalid practice id' }); return; }
    filter = `ARRAYJOIN({${spec.linkFieldName}})='${uid}'`;   // exact match on linked practice's UID
  }

  try {
    const resName = String(req.query.resource);
    const key = resName + '|' + (spec.requiresPractice ? String(req.query.practice) : '');
    const fresh = req.query.fresh === '1';       // "Refresh" button: bypass the cache once
    if (fresh) cache.delete(key);
    const records = await cachedFetch(key, TTL_MS[resName] || TTL_MS.default,
      () => fetchAll(spec.table, spec.fields, filter, spec.sort, spec.maxRecords));
    res.status(200).json({ records });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
