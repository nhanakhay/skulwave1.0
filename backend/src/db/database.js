const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'skulwave.db'));

let isDatabaseReady = false;
let resolveDatabaseReady;
let rejectDatabaseReady;
const databaseReadyPromise = new Promise((resolve, reject) => {
  resolveDatabaseReady = resolve;
  rejectDatabaseReady = reject;
});

function markDatabaseReady() {
  isDatabaseReady = true;
  db.isReady = true;
  if (resolveDatabaseReady) resolveDatabaseReady();
}

function markDatabaseFailed(err) {
  isDatabaseReady = false;
  db.isReady = false;
  if (rejectDatabaseReady) rejectDatabaseReady(err);
}

db.waitForReady = () => {
  if (isDatabaseReady) return Promise.resolve();
  return databaseReadyPromise;
};

db.isReady = false;

function prepareStatement(sql) {
  const stmt = db.prepare(sql);
  return {
    all: (...params) => new Promise((resolve, reject) => {
      stmt.all(params, (err, rows) => err ? reject(err) : resolve(rows));
    }),
    get: (...params) => new Promise((resolve, reject) => {
      stmt.get(params, (err, row) => err ? reject(err) : resolve(row));
    }),
    run: (...params) => new Promise((resolve, reject) => {
      stmt.run(params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    }),
  };
}

const schema = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  speed TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  data_cap TEXT NOT NULL,
  data_cap_bytes INTEGER NOT NULL,
  price REAL NOT NULL,
  reseller_enabled INTEGER NOT NULL DEFAULT 1,
  reseller_commission_percent REAL NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  package_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  paystack_reference TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (package_id) REFERENCES packages(id)
);

CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hotspot_username TEXT UNIQUE NOT NULL,
  hotspot_password TEXT NOT NULL,
  package_id INTEGER NOT NULL,
  valid_until DATETIME,
  status TEXT NOT NULL DEFAULT 'unused',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  redeemed_at DATETIME,
  reseller_id INTEGER,
  sold_at DATETIME,
  FOREIGN KEY (package_id) REFERENCES packages(id)
);

CREATE TABLE IF NOT EXISTS resellers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, phone TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login_at DATETIME);
CREATE TABLE IF NOT EXISTS reseller_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_id INTEGER UNIQUE NOT NULL, reseller_id INTEGER NOT NULL, package_id INTEGER NOT NULL, student_price REAL NOT NULL, reseller_commission REAL NOT NULL, skulwave_amount REAL NOT NULL, sold_at DATETIME NOT NULL, redeemed_at DATETIME, settlement_status TEXT NOT NULL DEFAULT 'UNSETTLED', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reseller_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, reseller_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL, reference TEXT, notes TEXT, recorded_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_type TEXT, actor_id INTEGER, event TEXT NOT NULL, entity_type TEXT, entity_id INTEGER, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS voucher_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL,
  hotspot_username TEXT NOT NULL,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  end_time DATETIME,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mac_address TEXT,
  ip_address TEXT,
  package_id INTEGER NOT NULL,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (package_id) REFERENCES packages(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_package_id ON transactions(package_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_username ON vouchers(hotspot_username);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_voucher_sessions_status ON voucher_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voucher_sessions_expires_at ON voucher_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
`;

// ─────────────────────────────────────────────
// Packages seed data
// Prices included for record keeping and
// future Paystack integration
// ─────────────────────────────────────────────




const packages = [
  [1, 'Research Daily', '350 kbps', 1, '300 MB', 322122547, 1],
  [2, 'Research Weekly', '350 kbps', 7, '2.5 GB', 2684354560, 7],
  [3, 'Research Monthly', '350 kbps', 30, '15 GB', 16106127360, 29],
  [4, 'Basic Daily', '1 Mbps', 1, '1 GB', 1073741824, 2],
  [5, 'Basic Weekly', '1 Mbps', 7, '8 GB', 8589934592, 12],
  [6, 'Basic Monthly', '1 Mbps', 30, 'Unlimited', 0, 49],
  [7, 'Premium Daily', '4 Mbps', 1, '5 GB', 5368709120, 5],
  [8, 'Premium Weekly', '4 Mbps', 7, '20 GB', 21474836480, 25],
  [9, 'Premium Monthly', '4 Mbps', 30, 'Unlimited', 0, 79],
  [10, 'VIP Daily', '8 Mbps', 1, '20 GB', 21474836480, 10],
  [11, 'VIP Weekly', '8 Mbps', 7, 'Unlimited', 0, 40],
  [12, 'VIP Monthly', '8 Mbps', 30, 'Unlimited', 0, 120],
];


const preparedStatements = {};

function prepareStatements() {
  // ── Users ──────────────────────────────────
  preparedStatements.getUserByUsername = prepareStatement(
    'SELECT * FROM users WHERE username = ?'
  );
  preparedStatements.getUserById = prepareStatement(
    'SELECT * FROM users WHERE id = ?'
  );
  preparedStatements.insertUser = prepareStatement(
    'INSERT INTO users (username, password) VALUES (?, ?)'
  );

  // ── Packages ───────────────────────────────
  preparedStatements.getAllPackages = prepareStatement(
    'SELECT * FROM packages'
  );
  preparedStatements.getPackageById = prepareStatement(
    'SELECT * FROM packages WHERE id = ?'
  );
  preparedStatements.getAdminUsers = prepareStatement(`SELECT v.id,v.hotspot_username AS username,p.name AS package_name,v.status,v.created_at,v.redeemed_at,v.valid_until FROM vouchers v LEFT JOIN packages p ON p.id=v.package_id ORDER BY v.created_at DESC`);
  preparedStatements.getAdminSessions = prepareStatement(`SELECT vs.id,vs.hotspot_username,p.name AS package_name,vs.start_time,vs.expires_at,vs.end_time,vs.status FROM voucher_sessions vs LEFT JOIN vouchers v ON v.id=vs.voucher_id LEFT JOIN packages p ON p.id=v.package_id ORDER BY vs.start_time DESC`);
  preparedStatements.getDashboardSummary = prepareStatement(`SELECT (SELECT COUNT(*) FROM vouchers) total_vouchers,(SELECT COUNT(*) FROM vouchers WHERE status IN ('active','redeemed')) active_vouchers,(SELECT COUNT(*) FROM voucher_sessions WHERE status='active') active_sessions,(SELECT COUNT(*) FROM vouchers WHERE status IN ('unused','generated')) unused_vouchers,(SELECT COALESCE(SUM(p.price),0) FROM vouchers v JOIN packages p ON p.id=v.package_id WHERE v.status IN ('active','expired','sold','redeemed')) voucher_revenue,(SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='success') payment_revenue`);
  preparedStatements.getPackageAnalytics = prepareStatement(`SELECT p.name,p.speed,p.price,COUNT(v.id) vouchers_issued,SUM(CASE WHEN v.status IN ('active','redeemed') THEN 1 ELSE 0 END) active_vouchers FROM packages p LEFT JOIN vouchers v ON v.package_id=p.id GROUP BY p.id ORDER BY vouchers_issued DESC,p.id`);
  preparedStatements.getRecentVouchers = prepareStatement(`SELECT v.hotspot_username,p.name AS package_name,v.status,v.created_at FROM vouchers v LEFT JOIN packages p ON p.id=v.package_id ORDER BY v.created_at DESC LIMIT ?`);
  preparedStatements.getRevenueTransactions = prepareStatement(`SELECT t.id,u.username,p.name AS package_name,t.amount,t.paystack_reference,t.status,t.created_at FROM transactions t LEFT JOIN users u ON u.id=t.user_id LEFT JOIN packages p ON p.id=t.package_id ORDER BY t.created_at DESC`);

  // ── Transactions ───────────────────────────
  preparedStatements.insertTransaction = prepareStatement(
    'INSERT INTO transactions (user_id, package_id, amount, paystack_reference, status) VALUES (?, ?, ?, ?, ?)'
  );
  preparedStatements.getTransactionByReference = prepareStatement(
    'SELECT * FROM transactions WHERE paystack_reference = ?'
  );
  preparedStatements.updateTransactionStatus = prepareStatement(
    'UPDATE transactions SET status = ? WHERE id = ?'
  );

  // ── Vouchers ───────────────────────────────
  preparedStatements.insertVoucher = prepareStatement(
    // Use COALESCE for valid_until to handle older DBs where the column is NOT NULL
    'INSERT INTO vouchers (hotspot_username, hotspot_password, package_id, valid_until, status, created_by, reseller_id) VALUES (?, ?, ?, COALESCE(?, datetime("now")), ?, ?, ?)'
  );
  preparedStatements.getActiveVoucherSession = prepareStatement(
    'SELECT * FROM voucher_sessions WHERE voucher_id = ? AND status = "active" LIMIT 1'
  );

  preparedStatements.getVoucherByUsername = prepareStatement(
    'SELECT * FROM vouchers WHERE hotspot_username = ?'
  );
  preparedStatements.getVoucherById = prepareStatement(
    'SELECT * FROM vouchers WHERE id = ?'
  );
  preparedStatements.getAllVouchers = prepareStatement(
    `SELECT
      v.id,
      v.hotspot_username,
      v.package_id,
      p.name AS package_name,
      p.speed,
      p.duration_days,
      p.price,
      v.valid_until,
      v.status,
      v.created_by,
      v.created_at,
      v.redeemed_at
    FROM vouchers v
    LEFT JOIN packages p ON v.package_id = p.id
    ORDER BY v.created_at DESC`
  );

  // Update voucher status and redeemed_at timestamp
  preparedStatements.updateVoucherStatus = prepareStatement(
    'UPDATE vouchers SET status = ?, redeemed_at = ? WHERE id = ?'
  );

  // CHANGED: Set valid_until at first redeem (wall clock expiry from first auth)
  preparedStatements.updateVoucherValidUntil = prepareStatement(
    'UPDATE vouchers SET valid_until = ? WHERE id = ?'
  );

  // ── Voucher Sessions ───────────────────────
  preparedStatements.insertVoucherSession = prepareStatement(
    'INSERT INTO voucher_sessions (voucher_id, hotspot_username, expires_at, status) VALUES (?, ?, ?, ?)'
  );

  // Fetch expired active sessions for the expiry job
  preparedStatements.getExpiredVoucherSessions = prepareStatement(
    'SELECT * FROM voucher_sessions WHERE status = "active" AND expires_at <= ?'
  );

  // Mark a session as expired with end time
  preparedStatements.expireVoucherSession = prepareStatement(
    'UPDATE voucher_sessions SET status = ?, end_time = ? WHERE id = ?'
  );

  // ── Sessions (Paystack users — future use) ─
  preparedStatements.insertSession = prepareStatement(
    'INSERT INTO sessions (user_id, mac_address, ip_address, package_id) VALUES (?, ?, ?, ?)'
  );
  preparedStatements.getActiveSession = prepareStatement(
    'SELECT * FROM sessions WHERE user_id = ? AND status = "active" ORDER BY start_time DESC LIMIT 1'
  );
  preparedStatements.expireSession = prepareStatement(
    'UPDATE sessions SET status = "expired", end_time = ? WHERE id = ?'
  );
}

// Attach lookup helper so route files can call db.getPreparedStatement()
db.getPreparedStatement = (name) => preparedStatements[name];
db.allAsync = (sql, params=[]) => new Promise((resolve,reject)=>db.all(sql,params,(err,rows)=>err?reject(err):resolve(rows)));
db.getAsync = (sql, params=[]) => new Promise((resolve,reject)=>db.get(sql,params,(err,row)=>err?reject(err):resolve(row)));
db.runAsync = (sql, params=[]) => new Promise((resolve,reject)=>db.run(sql,params,function(err){err?reject(err):resolve({lastID:this.lastID,changes:this.changes});}));

// ─────────────────────────────────────────────
// Drop legacy tables if schema has changed
// Detects old schema by checking users table
// for the username column
// ─────────────────────────────────────────────
function dropLegacyTablesIfNeeded(callback) {
  db.all(`SELECT name, sql FROM sqlite_master WHERE type='table'`, (err, rows) => {
    if (err) return callback(err);

    const usersTable = rows.find((row) => row.name === 'users');
    const needsDrop = usersTable && !/username\s+TEXT/i.test(usersTable.sql);

    if (!needsDrop) return callback();

    console.log('[db] Dropping legacy tables to rebuild schema...');
    const legacyTables = [
      'users', 'packages', 'transactions',
      'vouchers', 'voucher_sessions', 'sessions',
    ];

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      for (const table of legacyTables) {
        db.run(`DROP TABLE IF EXISTS ${table}`);
      }
      db.run('COMMIT', callback);
    });
  });
}

function seedPackages(callback) {
  const seedPackagesStmt = db.prepare(`
    INSERT OR IGNORE INTO packages
      (id, name, speed, duration_days, data_cap, data_cap_bytes, price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION', (beginErr) => {
    if (beginErr) {
      seedPackagesStmt.finalize(() => callback(beginErr));
      return;
    }

    const runNextPackage = (index) => {
      if (index >= packages.length) {
        db.run('COMMIT', (commitErr) => {
          seedPackagesStmt.finalize(() => callback(commitErr));
        });
        return;
      }

      seedPackagesStmt.run(...packages[index], (insertErr) => {
        if (insertErr) {
          db.run('ROLLBACK', () => {
            seedPackagesStmt.finalize(() => callback(insertErr));
          });
          return;
        }

        runNextPackage(index + 1);
      });
    };

    runNextPackage(0);
  });
}

// ─────────────────────────────────────────────
// Initialize database
// Creates tables, prepares statements, seeds packages
// ─────────────────────────────────────────────
function initializeDatabase(callback) {
  db.serialize(() => {
    dropLegacyTablesIfNeeded((dropErr) => {
      if (dropErr) {
        console.error('[db] Error dropping legacy tables:', dropErr);
        markDatabaseFailed(dropErr);
        if (callback) callback(dropErr);
        return;
      }

      db.exec(schema, (err) => {
        if (err) {
          console.error('[db] Failed to initialize schema:', err);
          markDatabaseFailed(err);
          if (callback) callback(err);
          return;
        }

        const migrations=['ALTER TABLE packages ADD COLUMN reseller_enabled INTEGER NOT NULL DEFAULT 1','ALTER TABLE packages ADD COLUMN reseller_commission_percent REAL NOT NULL DEFAULT 1','ALTER TABLE vouchers ADD COLUMN reseller_id INTEGER','ALTER TABLE vouchers ADD COLUMN sold_at DATETIME']; let migrationIndex=0;
        const migrate=()=>{ if(migrationIndex<migrations.length) return db.run(migrations[migrationIndex++],migrate); prepareStatements();
        seedPackages((seedErr) => {
          if (seedErr) {
            console.error('[db] Failed to seed packages:', seedErr);
            markDatabaseFailed(seedErr);
          } else {
            console.log('[db] Database initialized and packages seeded');
            markDatabaseReady();
          }
          if (callback) callback(seedErr);
        }); }; migrate();
      });
    });
  });
}

initializeDatabase((err) => {
  if (err) {
    console.error('[db] Initialization error:', err);
  }
});

module.exports = db;
