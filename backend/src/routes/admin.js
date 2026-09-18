const router = require("express").Router(),
  db = require("../db/database"),
  auth = require("../middleware/adminAuth"),
  bcrypt = require("bcryptjs");
const users = require("../controllers/userController"),
  sessions = require("../controllers/sessionController"),
  revenue = require("../controllers/revenueController"),
  analytics = require("../controllers/analyticsController");
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  )
    return res.json({ apiKey: process.env.ADMIN_API_KEY, role: "MAIN_ADMIN" });
  const account = await db.getAsync(
    "SELECT * FROM admin_accounts WHERE username=?",
    [username],
  );
  if (
    !account ||
    account.status !== "ACTIVE" ||
    !(await bcrypt.compare(password || "", account.password_hash))
  )
    return res.status(401).json({ error: "Invalid admin credentials" });
  await db.runAsync(
    "UPDATE admin_accounts SET last_login_at=CURRENT_TIMESTAMP WHERE id=?",
    [account.id],
  );
  res.json({ apiKey: auth.makeToken(account), role: account.role });
});

router.use(auth);
const mainOnly = (req, res, next) =>
  req.admin.role === "MAIN_ADMIN"
    ? next()
    : res
        .status(403)
        .json({ error: "This action is restricted to the main admin." });
const managerOrMain = (req, res, next) =>
  ['MAIN_ADMIN', 'SCHOOL_MANAGER'].includes(req.admin.role)
    ? next()
    : res.status(403).json({ error: 'This action is restricted.' });
router.get("/packages", mainOnly, async (_q, res) =>
  res.json({ packages: await db.getPreparedStatement("getAllPackages").all() }),
);
router.patch("/packages/:id", mainOnly, async (req, res) => {
  const b = req.body || {},
    price = Number(b.price),
    commission = Number(b.reseller_commission_percent),
    cap = Number(b.data_cap_bytes);
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(commission) ||
    commission < 0 ||
    commission > 100 ||
    !Number.isFinite(cap) ||
    cap < 0
  )
    return res.status(400).json({ error: "Invalid package values" });
  await db.runAsync(
    "UPDATE packages SET price=?,data_cap=?,data_cap_bytes=?,reseller_commission_percent=?,reseller_enabled=? WHERE id=?",
    [
      price,
      b.data_cap || "",
      cap,
      commission,
      b.reseller_enabled ? 1 : 0,
      req.params.id,
    ],
  );
  res.json({ message: "Package updated" });
});
router.get("/users", managerOrMain, users.list);
router.get("/sessions", mainOnly, sessions.list);
router.get("/revenue", managerOrMain, revenue.list);
router.get("/analytics", mainOnly, analytics.overview);
router.get("/dashboard", mainOnly, analytics.overview);
router.get('/school-managers', mainOnly, async (_req, res) => {
  const managers = await db.allAsync(`SELECT a.id,a.name,a.school_name,a.username,a.status,a.created_at,a.last_login_at,COUNT(DISTINCT r.id) reseller_count,COALESCE(SUM(s.student_price),0) total_sales,COALESCE(SUM(s.skulwave_amount),0) skulwave_due,COALESCE((SELECT SUM(amount) FROM school_manager_settlements x WHERE x.school_manager_id=a.id),0) remitted FROM admin_accounts a LEFT JOIN resellers r ON r.school_manager_id=a.id LEFT JOIN reseller_sales s ON s.reseller_id=r.id WHERE a.role='SCHOOL_MANAGER' GROUP BY a.id ORDER BY a.created_at DESC`);
  res.json({ schoolManagers: managers.map((manager) => ({ ...manager, outstanding: Number(manager.skulwave_due || 0) - Number(manager.remitted || 0) })) });
});
router.post("/school-managers", mainOnly, async (req, res) => {
  const b = req.body || {};
  if (
    !b.name ||
    !b.school_name || !b.username ||
    !b.password ||
    b.password !== b.confirm_password
  )
    return res
      .status(400)
      .json({ error: "Name, username, and matching password are required." });
  try {
    const x = await db.runAsync(
      "INSERT INTO admin_accounts(name,school_name,username,password_hash,role) VALUES(?,?,?,?,?,'SCHOOL_MANAGER')",
      [b.name, b.school_name, b.username, await bcrypt.hash(b.password, 10)],
    );
    res.status(201).json({ id: x.lastID });
  } catch (_) {
    res.status(409).json({ error: "Username already exists" });
  }
});
router.patch('/school-managers/:id', mainOnly, async (req, res) => {
  const b=req.body||{}, id=Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid school manager.' });
  if (b.status) {
    if (!['ACTIVE','SUSPENDED'].includes(b.status)) return res.status(400).json({ error: 'Invalid status.' });
    await db.runAsync("UPDATE admin_accounts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='SCHOOL_MANAGER'",[b.status,id]);
  } else await db.runAsync("UPDATE admin_accounts SET name=COALESCE(?,name),username=COALESCE(?,username),updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='SCHOOL_MANAGER'",[b.name||null,b.username||null,id]);
  res.json({ message: 'School manager updated' });
});
router.post('/school-managers/:id/settlements', mainOnly, async (req, res) => {
  const b=req.body||{}, amount=Number(b.amount), id=Number(req.params.id);
  if (!Number.isFinite(amount) || amount<=0 || !b.payment_method) return res.status(400).json({ error: 'Amount and payment method are required.' });
  await db.runAsync('INSERT INTO school_manager_settlements(school_manager_id,amount,payment_method,reference,notes,recorded_by) VALUES(?,?,?,?,?,?)',[id,amount,b.payment_method,String(b.reference||''),String(b.notes||''),req.admin.name||'Main admin']);
  res.status(201).json({ message: 'Remittance recorded' });
});
router.get("/resellers", managerOrMain, async (req, res) => {
  const date = String(req.query.date || "");
  const managerId = req.admin.role === 'SCHOOL_MANAGER' ? req.admin.id : null;
  res.json({
    resellers: await db.allAsync(
      `SELECT r.id,r.name,r.username,r.phone,r.status,r.credit_balance,r.school_manager_id,r.created_at,r.last_login_at,COALESCE(SUM(CASE WHEN (?='' OR date(s.sold_at)=date(?)) THEN s.student_price END),0) total_sales,COALESCE(SUM(CASE WHEN (?='' OR date(s.sold_at)=date(?)) THEN s.reseller_commission END),0) commission,COALESCE(SUM(CASE WHEN (?='' OR date(s.sold_at)=date(?)) THEN s.student_price END),0)-COALESCE((SELECT SUM(amount) FROM reseller_settlements x WHERE x.reseller_id=r.id AND (?='' OR date(x.created_at)=date(?))),0) outstanding FROM resellers r LEFT JOIN reseller_sales s ON s.reseller_id=r.id WHERE (? IS NULL OR r.school_manager_id=?) GROUP BY r.id ORDER BY r.created_at DESC`,
      [date, date, date, date, date, date, date, date, managerId, managerId],
    ),
  });
});
router.post("/resellers", managerOrMain, async (req, res) => {
  const b = req.body || {},
    credit = req.admin.role === 'MAIN_ADMIN' ? Number(b.credit_balance || 0) : 0;
  if (
    !b.name ||
    !b.username ||
    !b.password ||
    b.password !== b.confirm_password ||
    b.password.length < 6 ||
    !Number.isFinite(credit) ||
    credit < 0
  )
    return res
      .status(400)
      .json({
        error:
          "Name, username, matching password, and valid credit are required",
      });
  try {
    const x = await db.runAsync(
      "INSERT INTO resellers(name,username,password_hash,phone,credit_balance,school_manager_id) VALUES(?,?,?,?,?,?)",
      [
        b.name,
        b.username,
        await bcrypt.hash(b.password, 10),
        b.phone || "",
        credit, req.admin.role === 'SCHOOL_MANAGER' ? req.admin.id : (b.school_manager_id || null),
      ],
    );
    res.status(201).json({ id: x.lastID });
  } catch (_) {
    res.status(409).json({ error: "Username already exists" });
  }
});
router.patch("/resellers/:id", managerOrMain, async (req, res) => {
  const b = req.body || {},
    credit = b.credit_balance === undefined ? null : Number(b.credit_balance);
  const reseller = await db.getAsync('SELECT school_manager_id FROM resellers WHERE id=?', [req.params.id]);
  if (!reseller || (req.admin.role === 'SCHOOL_MANAGER' && reseller.school_manager_id !== req.admin.id)) return res.status(404).json({ error: 'Not found' });
  if (req.admin.role === 'SCHOOL_MANAGER' && credit !== null) return res.status(403).json({ error: 'Only the main admin can change reseller credit.' });
  if (b.status && !["ACTIVE", "SUSPENDED"].includes(b.status))
    return res.status(400).json({ error: "Invalid status" });
  if (credit !== null && (!Number.isFinite(credit) || credit < 0))
    return res.status(400).json({ error: "Invalid credit" });
  if (credit !== null)
    await db.runAsync(
      "UPDATE resellers SET credit_balance=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [credit, req.params.id],
    );
  if (b.status)
    await db.runAsync(
      "UPDATE resellers SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [b.status, req.params.id],
    );
  if (b.name || b.username || b.phone !== undefined)
    await db.runAsync(
      "UPDATE resellers SET name=COALESCE(?,name),username=COALESCE(?,username),phone=COALESCE(?,phone),updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [b.name || null, b.username || null, b.phone ?? null, req.params.id],
    );
  if (b.password) {
    if (b.password !== b.confirm_password)
      return res.status(400).json({ error: "Passwords do not match" });
    await db.runAsync("UPDATE resellers SET password_hash=? WHERE id=?", [
      await bcrypt.hash(b.password, 10),
      req.params.id,
    ]);
  }
  res.json({ message: "Updated" });
});

router.get("/resellers/:id", managerOrMain, async (req, res) => {
  const id = req.params.id,
    date = String(req.query.date || ""),
    reseller = await db.getAsync(
      "SELECT id,name,username,phone,status,credit_balance,school_manager_id,created_at,last_login_at FROM resellers WHERE id=?",
      [id],
    );
  if (!reseller || (req.admin.role === 'SCHOOL_MANAGER' && reseller.school_manager_id !== req.admin.id)) return res.status(404).json({ error: "Not found" });
  const [vouchers, sales, settlements] = await Promise.all([
    db.allAsync(
      "SELECT v.*,p.name package_name,p.price FROM vouchers v JOIN packages p ON p.id=v.package_id WHERE reseller_id=? ORDER BY created_at DESC",
      [id],
    ),
    db.allAsync(
      "SELECT s.*,v.hotspot_username,p.name package_name FROM reseller_sales s JOIN vouchers v ON v.id=s.voucher_id JOIN packages p ON p.id=s.package_id WHERE s.reseller_id=? AND (?='' OR date(s.sold_at)=date(?)) ORDER BY sold_at DESC",
      [id, date, date],
    ),
    db.allAsync(
      "SELECT * FROM reseller_settlements WHERE reseller_id=? AND (?='' OR date(created_at)=date(?)) ORDER BY created_at DESC",
      [id, date, date],
    ),
  ]);
  res.json({ reseller, vouchers, sales, settlements });
});
router.post("/resellers/:id/settlements", mainOnly, async (req, res) => {
  const b = req.body || {};
  if (
    !Number.isFinite(Number(b.amount)) ||
    Number(b.amount) <= 0 ||
    !["CASH", "MOMO", "OTHER"].includes(b.payment_method)
  )
    return res.status(400).json({ error: "Invalid settlement" });
  const x = await db.runAsync(
    "INSERT INTO reseller_settlements(reseller_id,amount,payment_method,reference,notes,recorded_by) VALUES(?,?,?,?,?,?)",
    [
      req.params.id,
      Number(b.amount),
      b.payment_method,
      b.reference || "",
      b.notes || "",
      "admin",
    ],
  );
  res.status(201).json({ id: x.lastID });
});
module.exports = router;
