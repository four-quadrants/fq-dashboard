// Exchanges the shared team password for an HttpOnly session cookie.
// The raw password is never stored in the cookie (only a salted hash).
import crypto from 'node:crypto';

function authToken(pw) { return crypto.createHash('sha256').update('ps|' + pw).digest('hex'); }

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const expected = process.env.APP_PASSWORD;
  if (!expected) { res.status(400).json({ error: 'No APP_PASSWORD configured on the server' }); return; }
  const pw = (req.body && req.body.password) || '';
  if (pw !== expected) { res.status(401).json({ error: 'Wrong password' }); return; }
  const tok = authToken(pw);
  res.setHeader('Set-Cookie', `ps_auth=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  res.status(200).json({ ok: true });
}
