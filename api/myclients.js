// Saves ONE person's "My Clients" list (Team -> My Clients) for the team dashboard.
// This is the app's only write to Airtable, and it is deliberately narrow:
//   - POST only, behind the same team-password cookie as /api/data;
//   - writes exactly one field (fld5m0aNHoF8U645q) on exactly one Team record;
//   - every id must be a real Team / Practices record; nothing else can be changed,
//     so no practice, production, forecast or financial data is ever touched.
//   - the person is whoever signed in (ps_user cookie, HMAC-signed at login), so you can only save your own list.
import crypto from 'node:crypto';
import { signUser } from './login.js';

const BASE = 'app6Ki6RiJWFcuifz';
const T_TEAM = 'tbl34umujZ5FY3oPM', T_PRACTICES = 'tblpbRJJH83aVrNW0';
const F_MY_CLIENTS = 'fld5m0aNHoF8U645q';
const REC = /^rec[A-Za-z0-9]{14}$/;

function authToken(pw) { return crypto.createHash('sha256').update('ps|' + pw).digest('hex'); }
function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function isAuthed(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return true;
  return parseCookies(req.headers.cookie)['ps_auth'] === authToken(pw);
}
const origin = () => process.env.AIRTABLE_API_ORIGIN || 'https://api.airtable.com';
// A token with records:write on this base. Falls back to AIRTABLE_TOKEN if that one has write scope.
const token = () => process.env.AIRTABLE_WRITE_TOKEN || process.env.AIRTABLE_TOKEN;
async function at(path, init) {
  const r = await fetch(`${origin()}/v0/${BASE}/${path}`, { ...init, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' } });
  if (!r.ok) throw Object.assign(new Error('Airtable ' + r.status), { status: r.status });
  return r.json();
}
async function practiceIds() {           // every real Practices record id (one small field, paged)
  const ids = new Set(); let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100', 'fields[]': 'fldDIczZcGe7994dp' });
    if (offset) q.set('offset', offset);
    const d = await at(`${T_PRACTICES}?${q}`);
    (d.records || []).forEach(r => ids.add(r.id)); offset = d.offset;
  } while (offset);
  return ids;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: 'Not signed in' }); return; }
  if (!token()) { res.status(500).json({ error: 'No Airtable token configured on the server' }); return; }
  const b = req.body || {};
  const signed = parseCookies(req.headers.cookie)['ps_user'] || '';
  const teamId = signed.split('.')[0];
  if (!REC.test(teamId) || signUser(teamId, process.env.APP_PASSWORD || '') !== signed) { res.status(401).json({ error: 'Sign in again to save your list' }); return; }
  if (b.teamId && b.teamId !== teamId) { res.status(403).json({ error: 'You can only change your own list' }); return; }
  const list = Array.isArray(b.practiceIds) ? [...new Set(b.practiceIds.map(String))] : null;
  if (!REC.test(teamId)) { res.status(400).json({ error: 'Invalid person' }); return; }
  if (!list || list.length > 200 || !list.every(id => REC.test(id))) { res.status(400).json({ error: 'Invalid client list' }); return; }
  try {
    await at(`${T_TEAM}/${teamId}`);                       // must be a real Team record (404 otherwise)
    const valid = await practiceIds();
    const bad = list.filter(id => !valid.has(id));
    if (bad.length) { res.status(400).json({ error: 'Unknown practice(s): ' + bad.join(', ') }); return; }
    const d = await at(`${T_TEAM}/${teamId}?returnFieldsByFieldId=true`, {
      method: 'PATCH', body: JSON.stringify({ fields: { [F_MY_CLIENTS]: list } })
    });
    res.status(200).json({ ok: true, myClients: (d.fields && d.fields[F_MY_CLIENTS]) || [] });
  } catch (e) {
    res.status(e.status === 404 ? 404 : 502).json({ error: e.status === 404 ? 'Person not found' : String(e.message || e) });
  }
}
