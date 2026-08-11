const crypto = require('crypto');
const db = require('../db/database');
const secret = () => process.env.RESELLER_TOKEN_SECRET || process.env.ADMIN_API_KEY || 'change-this-secret';
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('hex');
const authenticate = async (req, res, next) => { try { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const [payload, signature] = token.split('.'); if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return res.status(401).json({ error: 'Unauthorised' }); const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); if (data.exp < Date.now()) return res.status(401).json({ error: 'Session expired' }); const reseller = await db.getAsync('SELECT id,name,username,phone,status FROM resellers WHERE id = ?', [data.id]); if (!reseller || reseller.status !== 'ACTIVE') return res.status(403).json({ error: 'Reseller account is unavailable' }); req.reseller = reseller; next(); } catch (_) { res.status(401).json({ error: 'Unauthorised' }); } };
authenticate.makeToken = (reseller) => { const payload = Buffer.from(JSON.stringify({ id: reseller.id, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url'); return `${payload}.${sign(payload)}`; };
module.exports = authenticate;
