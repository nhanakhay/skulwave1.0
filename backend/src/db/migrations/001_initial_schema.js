module.exports = {
  id: '001_initial_schema',
  description: 'Create the baseline tables and indexes when they do not already exist',
  up: async ({ exec }) => exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS admin_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'SCHOOL_MANAGER', status TEXT NOT NULL DEFAULT 'ACTIVE', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login_at DATETIME);
    CREATE TABLE IF NOT EXISTS packages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, speed TEXT NOT NULL, duration_days INTEGER NOT NULL, data_cap TEXT NOT NULL, data_cap_bytes INTEGER NOT NULL, price REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, package_id INTEGER NOT NULL, amount REAL NOT NULL, paystack_reference TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (package_id) REFERENCES packages(id));
    CREATE TABLE IF NOT EXISTS vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, hotspot_username TEXT UNIQUE NOT NULL, hotspot_password TEXT NOT NULL, package_id INTEGER NOT NULL, valid_until DATETIME, status TEXT NOT NULL DEFAULT 'unused', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, redeemed_at DATETIME, FOREIGN KEY (package_id) REFERENCES packages(id));
    CREATE TABLE IF NOT EXISTS voucher_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_id INTEGER NOT NULL, hotspot_username TEXT NOT NULL, start_time DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL, end_time DATETIME, status TEXT NOT NULL DEFAULT 'active', FOREIGN KEY (voucher_id) REFERENCES vouchers(id));
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, mac_address TEXT, ip_address TEXT, package_id INTEGER NOT NULL, start_time DATETIME DEFAULT CURRENT_TIMESTAMP, end_time DATETIME, status TEXT DEFAULT 'active', FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (package_id) REFERENCES packages(id));
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_type TEXT, actor_id INTEGER, event TEXT NOT NULL, entity_type TEXT, entity_id INTEGER, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_package_id ON transactions(package_id);
    CREATE INDEX IF NOT EXISTS idx_vouchers_username ON vouchers(hotspot_username);
    CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
    CREATE INDEX IF NOT EXISTS idx_voucher_sessions_status ON voucher_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_voucher_sessions_expires_at ON voucher_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(paystack_reference);
  `),
};
