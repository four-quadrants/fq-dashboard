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

// Whitelisted resources -> table + exact fields + optional practice-link filter + sort.
const RES = {
  practices: {
    table: 'tblpbRJJH83aVrNW0',
    fields: ['fldAFjgH9h49Fem9x','fldDIczZcGe7994dp','fldExbHIOMSmNuQ0o','fldno1MWgUylqz81C',
             'fldUIyId0U9TNzQQM','fldWiJ8Hx1cLPc9rQ','fld8ghrOGS9UHq0mT','fldJUgl9j19XAKBJr',
             'fldzIv29NmW3SkJfV','fldDO0DQbwPi0dWZx','fldAsDcCvj9buY2kb','fldrTTzJPcCnGaTmu',
             'fldrUFlEllGgKOurv'],
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

async function fetchAll(table, fields, filterByFormula, sort, maxRecords) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN not set on the server');
  let records = [], offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${table}`);
    fields.forEach(f => url.searchParams.append('fields[]', f));
    url.searchParams.set('returnFieldsByFieldId', 'true');
    url.searchParams.set('pageSize', '100');
    if (filterByFormula) url.searchParams.set('filterByFormula', filterByFormula);
    if (sort) sort.forEach((s, i) => { url.searchParams.set(`sort[${i}][field]`, s.field); url.searchParams.set(`sort[${i}][direction]`, s.dir); });
    if (offset) url.searchParams.set('offset', offset);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Airtable ' + r.status);
    const data = await r.json();
    records = records.concat(data.records || []);
    offset = data.offset;
    if (maxRecords && records.length >= maxRecords) break;
  } while (offset);
  return records.map(r => ({ id: r.id, cellValuesByFieldId: r.fields || {} }));
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
    const records = await fetchAll(spec.table, spec.fields, filter, spec.sort, spec.maxRecords);
    res.status(200).json({ records });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
