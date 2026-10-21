// Sign-in for the team dashboard: work email + the shared team password.
//   POST   {email, password} -> checks the password, matches the email to the Team table (the person's profile),
//          sets ps_auth (team password, as before) and ps_user (that person's Team id, signed), returns {teamId, name}.
//   DELETE -> signs out (clears both cookies).
// The raw password is never stored in a cookie (only a salted hash), and ps_user is HMAC-signed so it
// can't be edited by hand to impersonate someone else's profile.
import crypto from 'node:crypto';

const BASE = 'app6Ki6RiJWFcuifz', T_TEAM = 'tbl34umujZ5FY3oPM';
const F_EMAIL = 'fld224ky0IzRNmNx0', F_NAME = 'fldKHHsAQs1jg76il';
const MAX_AGE = 2592000; // 30 days

function authToken(pw) { return crypto.createHash('sha256').update('ps|' + pw).digest('hex'); }
export function signUser(teamId, pw) { return teamId + '.' + crypto.createHmac('sha256', 'fq-user|' + pw).update(teamId).digest('hex').slice(0, 32); }

async function findByEmail(email) {
  const q = new URLSearchParams({ returnFieldsByFieldId: 'true', maxRecords: '2',
    filterByFormula: `LOWER({Email})='${email.replace(/'/g, "\\'")}'` });
  q.append('fields[]', F_EMAIL); q.append('fields[]', F_NAME);
  const r = await fetch(`${process.env.AIRTABLE_API_ORIGIN || 'https://api.airtable.com'}/v0/${BASE}/${T_TEAM}?${q}`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` } });
  if (!r.ok) throw new Error('Airtable ' + r.status);
  const d = await r.json();
  return (d.records || []).length === 1 ? d.records[0] : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', ['ps_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', 'ps_user=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0']);
    res.status(200).json({ ok: true }); return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const expected = process.env.APP_PASSWORD;
  if (!expected) { res.status(400).json({ error: 'No APP_PASSWORD configured on the server' }); return; }
  const pw = String((req.body && req.body.password) || '');
  let email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (email && !email.includes('@')) email += '@4quadrant.com';
  if (pw !== expected) { res.status(401).json({ error: 'Incorrect password.' }); return; }
  if (!/^[^@\s']+@4quadrant\.com$/.test(email)) { res.status(401).json({ error: 'Use your @4quadrant.com work email.' }); return; }
  let rec;
  try { rec = await findByEmail(email); } catch (e) { res.status(502).json({ error: 'Could not reach Airtable. Try again.' }); return; }
  if (!rec) { res.status(401).json({ error: "That email isn't on the FQ team list. Ask Austin to add you." }); return; }
  res.setHeader('Set-Cookie', [
    `ps_auth=${authToken(pw)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
    `ps_user=${signUser(rec.id, pw)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`]);
  res.status(200).json({ ok: true, teamId: rec.id, name: (rec.fields || {})[F_NAME] || '' });
}
