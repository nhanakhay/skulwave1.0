const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databasePath = path.join(__dirname, 'skulwave.db');
if (!fs.existsSync(databasePath)) {
  throw new Error(`[db] Database file does not exist: ${databasePath}. Refusing to create a new database automatically.`);
}

const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) console.error('[db] Unable to open existing database:', err.message);
});
db.isReady = false;

let resolveReady;
let rejectReady;
const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
db.waitForReady = () => db.isReady ? Promise.resolve() : ready;

const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) {
  if (err) return reject(err);
  resolve({ lastID: this.lastID, changes: this.changes });
}));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const exec = (sql) => new Promise((resolve, reject) => db.exec(sql, (err) => err ? reject(err) : resolve()));
db.runAsync = run;
db.getAsync = get;
db.allAsync = all;

function prepareStatement(sql) {
  const statement = db.prepare(sql);
  return {
    all: (...params) => new Promise((resolve, reject) => statement.all(params, (err, rows) => err ? reject(err) : resolve(rows))),
    get: (...params) => new Promise((resolve, reject) => statement.get(params, (err, row) => err ? reject(err) : resolve(row))),
    run: (...params) => new Promise((resolve, reject) => statement.run(params, function (err) { err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes }); })),
  };
}

const migrations = [
  require('./migrations/001_initial_schema'),
  require('./migrations/002_additive_account_and_payment_fields'),
  require('./migrations/003_reseller_tables'),
  require('./migrations/004_school_manager_support'),
  require('./migrations/005_seed_default_packages'),
];

async function applyMigration(migration) {
  await run('BEGIN IMMEDIATE');
  try {
    await migration.up({ run, get, all, exec });
    await run('INSERT INTO schema_migrations(id, description) VALUES (?, ?)', [migration.id, migration.description]);
    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK').catch(() => {});
    throw new Error(`Migration ${migration.id} failed: ${error.message}`);
  }
}

async function runMigrations() {
  await run('PRAGMA foreign_keys = ON');
  await run('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, description TEXT NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const applied = new Set((await all('SELECT id FROM schema_migrations')).map((migration) => migration.id));
  const pending = migrations.filter((migration) => !applied.has(migration.id));
  if (pending.length) await createMigrationBackup();
  for (const migration of pending) await applyMigration(migration);
}

async function createMigrationBackup() {
  const backupDirectory = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `skulwave-before-migration-${stamp}.db`).replace(/\\/g, '/');
  await exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  console.log(`[db] Created pre-migration backup: ${backupPath}`);
}

function prepareStatements() {
  const statements = {
    getUserByUsername: 'SELECT * FROM users WHERE username = ?',
    getUserById: 'SELECT * FROM users WHERE id = ?',
    insertUser: 'INSERT INTO users (username, password) VALUES (?, ?)',
    getAllPackages: 'SELECT * FROM packages',
    getPackageById: 'SELECT * FROM packages WHERE id = ?',
    getAdminUsers: 'SELECT v.id,v.hotspot_username AS username,p.name AS package_name,v.buyer_full_name,v.status,v.created_at,v.redeemed_at,v.valid_until FROM vouchers v LEFT JOIN packages p ON p.id=v.package_id ORDER BY v.created_at DESC',
    getAdminSessions: 'SELECT vs.id,vs.hotspot_username,p.name AS package_name,vs.start_time,vs.expires_at,vs.end_time,vs.status FROM voucher_sessions vs LEFT JOIN vouchers v ON v.id=vs.voucher_id LEFT JOIN packages p ON p.id=v.package_id ORDER BY vs.start_time DESC',
    getDashboardSummary: "SELECT (SELECT COUNT(*) FROM vouchers) total_vouchers,(SELECT COUNT(*) FROM vouchers WHERE status IN ('active','redeemed')) active_vouchers,(SELECT COUNT(*) FROM voucher_sessions WHERE status='active') active_sessions,(SELECT COUNT(*) FROM vouchers WHERE status IN ('unused','generated')) unused_vouchers,(SELECT COALESCE(SUM(student_price),0) FROM reseller_sales) cash_revenue,(SELECT COALESCE(SUM(reseller_commission),0) FROM reseller_sales) reseller_commission,(SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='success') payment_revenue",
    getPackageAnalytics: "SELECT p.name,p.speed,p.price,COUNT(v.id) vouchers_issued,SUM(CASE WHEN v.status IN ('active','redeemed') THEN 1 ELSE 0 END) active_vouchers FROM packages p LEFT JOIN vouchers v ON v.package_id=p.id GROUP BY p.id ORDER BY vouchers_issued DESC,p.id",
    getRecentVouchers: 'SELECT v.hotspot_username,p.name AS package_name,v.buyer_full_name,v.status,v.created_at FROM vouchers v LEFT JOIN packages p ON p.id=v.package_id ORDER BY v.created_at DESC LIMIT ?',
    getRevenueTransactions: 'SELECT t.id,u.username,p.name AS package_name,t.amount,t.paystack_reference,t.status,t.created_at FROM transactions t LEFT JOIN users u ON u.id=t.user_id LEFT JOIN packages p ON p.id=t.package_id ORDER BY t.created_at DESC',
    insertTransaction: 'INSERT INTO transactions (user_id, package_id, amount, paystack_reference, status) VALUES (?, ?, ?, ?, ?)',
    getTransactionByReference: 'SELECT * FROM transactions WHERE paystack_reference = ?',
    updateTransactionStatus: 'UPDATE transactions SET status = ? WHERE id = ?',
    insertVoucher: 'INSERT INTO vouchers (hotspot_username, hotspot_password, package_id, valid_until, status, created_by, reseller_id) VALUES (?, ?, ?, COALESCE(?, datetime("now")), ?, ?, ?)',
    getActiveVoucherSession: 'SELECT * FROM voucher_sessions WHERE voucher_id = ? AND status = "active" LIMIT 1',
    getVoucherByUsername: 'SELECT * FROM vouchers WHERE hotspot_username = ?',
    getVoucherById: 'SELECT * FROM vouchers WHERE id = ?',
    getAllVouchers: 'SELECT v.id,v.hotspot_username,v.package_id,p.name AS package_name,p.speed,p.duration_days,p.price,v.valid_until,v.status,v.created_by,v.created_at,v.redeemed_at,v.buyer_full_name FROM vouchers v LEFT JOIN packages p ON p.id=v.package_id ORDER BY v.created_at DESC',
    updateVoucherStatus: 'UPDATE vouchers SET status = ?, redeemed_at = ? WHERE id = ?',
    updateVoucherBuyerFullName: 'UPDATE vouchers SET buyer_full_name = ? WHERE id = ? AND (COALESCE(buyer_full_name, "") = "")',
    updateVoucherValidUntil: 'UPDATE vouchers SET valid_until = ? WHERE id = ?',
    insertVoucherSession: 'INSERT INTO voucher_sessions (voucher_id, hotspot_username, expires_at, status) VALUES (?, ?, ?, ?)',
    getExpiredVoucherSessions: 'SELECT * FROM voucher_sessions WHERE status = "active" AND expires_at <= ?',
    expireVoucherSession: 'UPDATE voucher_sessions SET status = ?, end_time = ? WHERE id = ?',
    insertSession: 'INSERT INTO sessions (user_id, mac_address, ip_address, package_id) VALUES (?, ?, ?, ?)',
    getActiveSession: 'SELECT * FROM sessions WHERE user_id = ? AND status = "active" ORDER BY start_time DESC LIMIT 1',
    expireSession: 'UPDATE sessions SET status = "expired", end_time = ? WHERE id = ?',
  };
  const prepared = Object.fromEntries(Object.entries(statements).map(([name, sql]) => [name, prepareStatement(sql)]));
  db.getPreparedStatement = (name) => prepared[name];
}

runMigrations().then(() => {
  prepareStatements();
  db.isReady = true;
  resolveReady();
  console.log('[db] Existing database opened and pending migrations completed.');
}).catch((error) => {
  db.isReady = false;
  rejectReady(error);
  console.error('[db] Startup aborted; database was not changed after the failed migration:', error.message);
});

module.exports = db;
