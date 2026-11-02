const crypto = require("crypto");
const db = require("../db/database");
const secret = () =>
  process.env.ADMIN_API_KEY || "change-this-before-production";
const makeToken = (account) =>
  `admin.${account.id}.${crypto.createHmac("sha256", secret()).update(`${account.id}.${account.role}`).digest("hex")}`;
async function adminAuth(req, res, next) {
  const value = req.headers["x-admin-key"];
  if (value === process.env.ADMIN_API_KEY) {
    req.admin = {
      role: "MAIN_ADMIN",
      name: process.env.ADMIN_USERNAME || "Admin",
    };
    return next();
  }
  const [kind, id, sig] = String(value || "").split(".");
  if (kind !== "admin" || !id || !sig)
    return res.status(401).json({ error: "Unauthorized" });
  const account = await db.getAsync("SELECT * FROM admin_accounts WHERE id=?", [
    id,
  ]);
  const expected =
    account &&
    crypto
      .createHmac("sha256", secret())
      .update(`${account.id}.${account.role}`)
      .digest("hex");
  if (
    !account ||
    account.status !== "ACTIVE" ||
    !expected ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return res.status(401).json({ error: "Unauthorized" });
  req.admin = account;
  next();
}

// Export both the middleware and the token helper. Assigning this after
// `exports.makeToken` previously replaced the helper and caused login to fail.
module.exports = adminAuth;
module.exports.makeToken = makeToken;
