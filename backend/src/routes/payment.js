const router = require("express").Router();
const axios = require("axios");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db/database");
const {
  addHotspotUser,
  removeHotspotUser,
  disconnectHotspotUser,
} = require("../mikrotik/mikrotik");
const PROFILE_MAP = {
  1: "research-daily",
  2: "research-weekly",
  3: "basic-3days",
  4: "basic-daily",
  5: "basic-weekly",
  6: "basic-monthly",
  7: "premium-daily",
  8: "premium-weekly",
  9: "premium-monthly",
  10: "vip-daily",
  11: "vip-weekly",
  12: "vip-monthly",
};
const baseUrl = () =>
  String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const emailHotspotUsername = (email, id) => {
  const localPart = String(email || "")
    .split("@", 1)[0]
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 24)
    .toLowerCase();
  return `${localPart || "user"}-${id}`;
};
const appSecret = () =>
  process.env.APP_ENCRYPTION_KEY ||
  process.env.ADMIN_API_KEY ||
  "change-this-before-production";
const key = () => crypto.createHash("sha256").update(appSecret()).digest();
const token = (id) =>
  `${id}.${crypto.createHmac("sha256", appSecret()).update(String(id)).digest("hex")}`;
function readToken(value) {
  const [id, sig] = String(value || "").split("."),
    valid = crypto
      .createHmac("sha256", appSecret())
      .update(String(id))
      .digest("hex");
  return id &&
    sig &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(valid))
    ? Number(id)
    : 0;
}
function encrypt(value) {
  const iv = crypto.randomBytes(12),
    c = crypto.createCipheriv("aes-256-gcm", key(), iv),
    body = Buffer.concat([c.update(value, "utf8"), c.final()]),
    tag = c.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${body.toString("base64")}`;
}
function decrypt(value) {
  const [iv, tag, body] = String(value || "")
      .split(".")
      .map((x) => Buffer.from(x, "base64")),
    d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
async function saveUserPassword(userId, password, mustChangePassword) {
  await db.runAsync(
    "UPDATE users SET password=?,hotspot_password_hash=?,must_change_password=?,password_reset_at=CURRENT_TIMESTAMP WHERE id=?",
    [await bcrypt.hash(password, 10), encrypt(password), mustChangePassword ? 1 : 0, userId],
  );
}
const isReady = () => Boolean(process.env.PAYSTACK_SECRET_KEY && baseUrl());
const voucherPassword = () => process.env.VOUCHER_SHARED_PASSWORD || "skulwave";
async function account(req) {
  const id = readToken(
    req.headers["x-account-token"] || req.body?.account_token,
  );
  return id ? db.getAsync("SELECT * FROM users WHERE id=?", [id]) : null;
}

async function authenticateAccount(req, res, registerOnly = false) {
  const { email, password, confirm_password: confirm } = req.body || {},
    mail = String(email || "")
      .trim()
      .toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(mail) || String(password || "").length < 6)
    return res
      .status(400)
      .json({
        error: "Enter a valid email and password of at least 6 characters.",
      });
  let user = await db.getAsync(
    "SELECT * FROM users WHERE email=? OR username=?",
    [mail, mail],
  );
  if (user) {
    if (registerOnly) return res.status(409).json({ error: "An account already exists for this email. Please sign in." });
    if (!(await bcrypt.compare(password, user.password).catch(() => false)))
      return res.status(401).json({ error: "Incorrect email or password." });
  } else {
    if (!registerOnly) return res.status(401).json({ error: "No account exists for this email. Please sign up first." });
    if (confirm !== password)
      return res
        .status(400)
        .json({ error: "Password confirmation does not match." });
    const x = await db.runAsync(
      "INSERT INTO users(username,password,email,hotspot_password_hash,status) VALUES(?,?,?,?,?)",
      [
        mail,
        await bcrypt.hash(password, 10),
        mail,
        encrypt(password),
        "INACTIVE",
      ],
    );
    user = await db.getAsync("SELECT * FROM users WHERE id=?", [x.lastID]);
  }
  res.json({
    account_token: token(user.id),
    user: { email: user.email || user.username, status: user.status, must_change_password: Boolean(user.must_change_password) },
  });
}
router.post("/login", (req, res) => authenticateAccount(req, res, false));
router.post("/signup", (req, res) => authenticateAccount(req, res, true));
router.post("/account", (req, res) => authenticateAccount(req, res, Boolean(req.body?.confirm_password)));
router.post("/password-change", async (req, res) => {
  const user = await account(req), password = String(req.body?.password || ""), confirm = String(req.body?.confirm_password || "");
  if (!user) return res.status(401).json({ error: "Please sign in again." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (password !== confirm) return res.status(400).json({ error: "Passwords do not match." });
  await saveUserPassword(user.id, password, false);
  res.json({ message: "Password changed successfully." });
});
router.get("/packages", async (_q, res) =>
  res.json({
    packages: await db.allAsync(
      "SELECT id,name,speed,duration_days,data_cap,data_cap_bytes,price FROM packages ORDER BY id",
    ),
  }),
);

router.post("/initialize", async (req, res) => {
  const user = await account(req),
    packageId = Number(req.body?.package_id);
  if (!user) return res.status(401).json({ error: "Please sign in again." });
  const pkg = await db.getAsync("SELECT * FROM packages WHERE id=?", [
    packageId,
  ]);
  if (!pkg || !PROFILE_MAP[pkg.id])
    return res.status(400).json({ error: "Selected package is unavailable." });
  if (!isReady())
    return res
      .status(503)
      .json({
        error:
          "Online payment is not configured yet. Please use a voucher for now.",
      });
  const reference = `SW-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`,
    callback = new URL(`${baseUrl()}/payment/callback`);
  if (req.body?.router_login)
    callback.searchParams.set("router-login", req.body.router_login);
  if (req.body?.dst) callback.searchParams.set("dst", req.body.dst);
  await db.runAsync(
    "INSERT INTO transactions(user_id,package_id,amount,paystack_reference,status,router_login) VALUES(?,?,?,?,?,?)",
    [user.id, pkg.id, pkg.price, reference, "pending", req.body?.router_login || ""],
  );
  try {
    const r = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email || user.username,
        amount: Math.round(Number(pkg.price) * 100),
        currency: "GHS",
        reference,
        callback_url: callback.toString(),
        channels: ["mobile_money"],
        metadata: { user_id: user.id, package_id: pkg.id },
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 20000,
      },
    );
    if (!r.data?.status || !r.data?.data?.authorization_url)
      throw new Error(
        r.data?.message || "Paystack could not initialize payment.",
      );
    res.json({ authorization_url: r.data.data.authorization_url, reference });
  } catch (e) {
    await db.runAsync(
      "UPDATE transactions SET status='initialize_failed' WHERE paystack_reference=?",
      [reference],
    );
    res
      .status(502)
      .json({
        error:
          e.response?.data?.message || e.message || "Unable to start payment.",
      });
  }
});

async function grant(reference) {
  const t = await db.getAsync(
    "SELECT t.*,u.email,u.hotspot_username,u.hotspot_password_hash,p.duration_days,p.data_cap_bytes,p.id package_id FROM transactions t JOIN users u ON u.id=t.user_id JOIN packages p ON p.id=t.package_id WHERE t.paystack_reference=?",
    [reference],
  );
  if (!t) throw new Error("Transaction not found.");
  if (t.status === "success" && t.access_granted_at) {
    const fallbackVoucher = !t.router_login;
    return {
      ...t,
      hotspot_username: t.hotspot_username,
      voucher_code: fallbackVoucher ? t.hotspot_username : null,
      fallback_voucher: fallbackVoucher,
      expires_at: t.package_expires_at,
      _password: fallbackVoucher ? voucherPassword() : decrypt(t.hotspot_password_hash),
    };
  }
  const check = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 20000,
      },
    ),
    paid = check.data?.data;
  if (
    !check.data?.status ||
    paid?.status !== "success" ||
    Number(paid.amount) !== Math.round(Number(t.amount) * 100)
  )
    throw new Error("Payment has not been confirmed yet.");
  const username = t.hotspot_username || emailHotspotUsername(t.email, t.user_id),
    fallbackVoucher = !t.router_login,
    password = fallbackVoucher ? voucherPassword() : decrypt(t.hotspot_password_hash),
    expiresAt = new Date(
      Date.now() + Number(t.duration_days) * 86400000,
    ).toISOString();
  try {
    await disconnectHotspotUser(username);
    await removeHotspotUser(username);
  } catch (_) {
    /* first purchase */
  }
  await addHotspotUser(
    username,
    password,
    PROFILE_MAP[t.package_id],
    t.data_cap_bytes,
    `${t.duration_days}d`,
  );
  await db.runAsync("BEGIN IMMEDIATE");
  try {
    await db.runAsync(
      "UPDATE transactions SET status='success',paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),payment_channel=?,access_granted_at=COALESCE(access_granted_at,CURRENT_TIMESTAMP) WHERE id=?",
      [paid.channel || "mobile_money", t.id],
    );
    await db.runAsync(
      "UPDATE users SET hotspot_username=?,active_package_id=?,package_expires_at=?,status='ACTIVE' WHERE id=?",
      [username, t.package_id, expiresAt, t.user_id],
    );
    if (fallbackVoucher) {
      await db.runAsync(
        "INSERT OR IGNORE INTO vouchers(hotspot_username,hotspot_password,package_id,valid_until,status,created_by) VALUES(?,?,?,?,?,?)",
        [username, await bcrypt.hash(voucherPassword(), 8), t.package_id, expiresAt, "active", "paystack"],
      );
    }
    await db.runAsync(
      "UPDATE sessions SET status='expired',end_time=CURRENT_TIMESTAMP WHERE user_id=? AND status='active'",
      [t.user_id],
    );
    await db.runAsync(
      "INSERT INTO sessions(user_id,hotspot_username,package_id,expires_at,status) VALUES(?,?,?,?, 'active')",
      [t.user_id, username, t.package_id, expiresAt],
    );
    await db.runAsync("COMMIT");
  } catch (e) {
    await db.runAsync("ROLLBACK");
    throw e;
  }
  return {
    ...t,
    hotspot_username: username,
    voucher_code: fallbackVoucher ? username : null,
    fallback_voucher: fallbackVoucher,
    expires_at: expiresAt,
    _password: password,
  };
}
router.post("/verify", async (req, res) => {
  if (!isReady())
    return res
      .status(503)
      .json({ error: "Online payment is not configured yet." });
  try {
    const r = await grant(req.body?.reference);
    res.json({
      message: "Payment confirmed. Connecting you now.",
      username: r.hotspot_username,
      password: r._password,
      expires_at: r.expires_at,
      voucher_code: r.voucher_code,
      fallback_voucher: Boolean(r.fallback_voucher),
    });
  } catch (e) {
    res.status(409).json({ error: e.message || "Unable to confirm payment." });
  }
});
router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"],
    expected = process.env.PAYSTACK_SECRET_KEY
      ? crypto
          .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
          .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
          .digest("hex")
      : "";
  if (
    !signature ||
    !expected ||
    String(signature).length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(String(signature)),
      Buffer.from(expected),
    )
  )
    return res.status(401).send("Invalid signature");
  if (req.body?.event !== "charge.success" || !req.body?.data?.reference)
    return res.sendStatus(200);
  try {
    await grant(req.body.data.reference);
    return res.sendStatus(200);
  } catch (e) {
    console.error("[paystack/webhook]", e.message);
    return res.status(500).json({ error: "Payment fulfillment failed; retry the webhook." });
  }
});
module.exports = router;
