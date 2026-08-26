const bcrypt = require("bcryptjs");
const db = require("../db/database");
const vouchers = require("../routes/vouchers");
const resellerAuth = require("../middleware/resellerAuth");
const round = (value) => Math.round(Number(value) * 100) / 100;

exports.login = async (req, res) => {
  const body = req.body || {};
  const account = await db.getAsync(
    "SELECT * FROM resellers WHERE username = ?",
    [body.username],
  );
  if (
    !account ||
    !(await bcrypt.compare(body.password || "", account.password_hash))
  )
    return res.status(401).json({ error: "Invalid reseller credentials" });
  if (account.status !== "ACTIVE")
    return res
      .status(403)
      .json({ error: "This reseller account is suspended" });
  await db.runAsync(
    "UPDATE resellers SET last_login_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    [account.id],
  );
  res.json({
    token: resellerAuth.makeToken(account),
    reseller: {
      id: account.id,
      name: account.name,
      username: account.username,
    },
  });
};
exports.me = (req, res) => res.json({ reseller: req.reseller });
exports.packages = async (_req, res) =>
  res.json({
    packages: await db.allAsync(
      "SELECT id,name,speed,duration_days,data_cap,price,reseller_commission_percent FROM packages WHERE reseller_enabled=1 ORDER BY id",
    ),
  });
exports.generate = async (req, res) => {
  try {
    const packageId = Number((req.body || {}).package_id);
    const pkg = await db.getAsync(
      "SELECT id FROM packages WHERE id=? AND reseller_enabled=1",
      [packageId],
    );
    if (!pkg)
      return res
        .status(400)
        .json({ error: "Package is not available for resale" });
    const voucher = await vouchers.generateVoucher({
      packageId,
      createdBy: `reseller:${req.reseller.username}`,
      resellerId: req.reseller.id,
      status: "generated",
    });
    await db.runAsync(
      "INSERT INTO audit_log (actor_type,actor_id,event,entity_type,entity_id) VALUES (?,?,?,?,?)",
      ["reseller", req.reseller.id, "VOUCHER_GENERATED", "voucher", voucher.id],
    );
    res.status(201).json({ voucher });
  } catch (err) {
    res
      .status(400)
      .json({ error: err.message || "Unable to generate voucher" });
  }
};
exports.sell = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.runAsync("BEGIN IMMEDIATE");
    const voucher = await db.getAsync(
      "SELECT v.*,p.price,p.reseller_commission_percent,r.credit_balance FROM vouchers v JOIN packages p ON p.id=v.package_id JOIN resellers r ON r.id=v.reseller_id WHERE v.id=? AND v.reseller_id=?",
      [id, req.reseller.id],
    );
    if (!voucher || voucher.status !== "generated") {
      await db.runAsync("ROLLBACK");
      return res.status(409).json({ error: "Voucher cannot be sold" });
    }
    if (Number(voucher.credit_balance) < Number(voucher.price)) {
      await db.runAsync("ROLLBACK");
      return res
        .status(402)
        .json({
          error:
            "Insufficient credit. Ask an admin to top up your credit before selling this voucher.",
        });
    }
    const commission = round(
      (voucher.price * voucher.reseller_commission_percent) / 100,
    );
    // Commission is owed separately; it must never reduce the reseller's cash
    // outstanding balance to SkulWave.
    const share = round(voucher.price);
    const result = await db.runAsync(
      "UPDATE vouchers SET status='sold',sold_at=CURRENT_TIMESTAMP WHERE id=? AND status='generated'",
      [id],
    );
    if (result.changes !== 1) throw new Error("Voucher already processed");
    await db.runAsync(
      "UPDATE resellers SET credit_balance=credit_balance-?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [voucher.price, req.reseller.id],
    );
    await db.runAsync(
      "INSERT INTO reseller_sales (voucher_id,reseller_id,package_id,student_price,reseller_commission,skulwave_amount,sold_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)",
      [
        id,
        req.reseller.id,
        voucher.package_id,
        voucher.price,
        commission,
        share,
      ],
    );
    await db.runAsync("COMMIT");
    res.json({
      sale: {
        student_price: voucher.price,
        reseller_commission: commission,
        skulwave_amount: share,
      },
      credit_balance: round(voucher.credit_balance - voucher.price),
    });
  } catch (err) {
    await db.runAsync("ROLLBACK").catch(() => {});
    res.status(409).json({ error: err.message || "Unable to record sale" });
  }
};
exports.vouchers = async (req, res) =>
  res.json({
    vouchers: await db.allAsync(
      "SELECT v.id,v.hotspot_username,v.buyer_full_name,p.name package_name,p.price,v.status,v.created_at,v.sold_at FROM vouchers v JOIN packages p ON p.id=v.package_id WHERE v.reseller_id=? ORDER BY v.created_at DESC",
      [req.reseller.id],
    ),
  });
exports.sales = async (req, res) =>
  res.json({
    sales: await db.allAsync(
      "SELECT s.*,v.hotspot_username,p.name package_name FROM reseller_sales s JOIN vouchers v ON v.id=s.voucher_id JOIN packages p ON p.id=s.package_id WHERE s.reseller_id=? ORDER BY s.sold_at DESC",
      [req.reseller.id],
    ),
  });
exports.settlements = async (req, res) =>
  res.json({
    settlements: await db.allAsync(
      "SELECT * FROM reseller_settlements WHERE reseller_id=? ORDER BY created_at DESC",
      [req.reseller.id],
    ),
  });
exports.dashboard = async (req, res) => {
  const id = req.reseller.id;
  const summary = await db.getAsync(
    "SELECT COALESCE(SUM(CASE WHEN date(sold_at)=date('now') THEN student_price END),0) today_sales,COALESCE(SUM(CASE WHEN date(sold_at)=date('now') THEN reseller_commission END),0) today_commission,COUNT(*) vouchers_sold,COALESCE(SUM(skulwave_amount),0) due FROM reseller_sales WHERE reseller_id=?",
    [id],
  );
  const settled = await db.getAsync(
    "SELECT COALESCE(SUM(amount),0) total FROM reseller_settlements WHERE reseller_id=?",
    [id],
  );
  const account = await db.getAsync(
    "SELECT credit_balance FROM resellers WHERE id=?",
    [id],
  );
  res.json({
    summary: {
      ...summary,
      outstanding: round(summary.due - settled.total),
      credit_balance: round(account.credit_balance),
    },
  });
};
