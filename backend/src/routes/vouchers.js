const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { addHotspotUser } = require('../mikrotik/mikrotik');
const router = express.Router();

const DEFAULT_VOUCHER_PASSWORD = 'skulwave';

function generateHotspotUsername(profileName = '', length = 8) {
  const prefix = profileName
    .split(/[-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLowerCase())
    .join('');

  const safePrefix = prefix || 'vu';
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${safePrefix.toUpperCase()+result}`;
}

function resolveSharedPassword() {
  return process.env.VOUCHER_SHARED_PASSWORD || DEFAULT_VOUCHER_PASSWORD;
}

// ─────────────────────────────────────────────
// Map package_id to MikroTik hotspot profile name
// Must match exactly what's configured on the RB5009
// ─────────────────────────────────────────────
const PROFILE_MAP = {
  1:  'research-daily',
  2:  'research-weekly',
  3:  'research-monthly',
  4:  'basic-daily',
  5:  'basic-weekly',
  6:  'basic-monthly',
  7:  'premium-daily',
  8:  'premium-weekly',
  9:  'premium-monthly',
  10: 'vip-daily',
  11: 'vip-weekly',
  12: 'vip-monthly',
};

async function generateVoucher({ packageId, createdBy = 'admin', resellerId = null, status = 'unused' }) {
  const pkg = await db.getPreparedStatement('getPackageById').get(packageId);
  if (!pkg || !PROFILE_MAP[packageId]) throw new Error('Invalid package');
  let username; do { username = generateHotspotUsername(PROFILE_MAP[packageId]); } while (await db.getPreparedStatement('getVoucherByUsername').get(username));
  const password = resolveSharedPassword();
  const result = await db.getPreparedStatement('insertVoucher').run(username, await bcrypt.hash(password, 8), packageId, null, status, createdBy, resellerId);
  return { id: result.lastID, hotspot_username: username, package_id: packageId, package_name: pkg.name, status, shared_password: password, price: pkg.price };
}

// ─────────────────────────────────────────────
// POST /api/vouchers/generate
// Admin generates a voucher — saves to SQLite only.
// MikroTik user is NOT created yet.
// valid_until is set at first redeem (first auth).
// ─────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    // Ensure DB prepared statements are ready
    const getPkgStmt = db.getPreparedStatement && db.getPreparedStatement('getPackageById');
    const getVoucherStmt = db.getPreparedStatement && db.getPreparedStatement('getVoucherByUsername');
    const insertVoucherStmt = db.getPreparedStatement && db.getPreparedStatement('insertVoucher');

    if (!getPkgStmt || !getVoucherStmt || !insertVoucherStmt) {
      return res.status(503).json({ error: 'Database not ready. Try again shortly.' });
    }

    const {
      package_id,
      created_by = 'admin',
    } = req.body;

    if (!package_id) {
      return res.status(400).json({
        error: 'package_id is required',
      });
    }

    const pkg = await getPkgStmt.get(package_id);
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package_id' });
    }

    const profile = PROFILE_MAP[package_id];
    if (!profile) {
      return res.status(400).json({ error: 'No MikroTik profile mapped for this package' });
    }

    const sharedPassword = resolveSharedPassword();
    const hotspot_username = generateHotspotUsername(profile);
    const existing = await getVoucherStmt.get(hotspot_username);
    if (existing) {
      return res.status(400).json({ error: 'Generated hotspot username already exists. Please try again.' });
    }

    // Hash password — cost factor 8 for Pi 3B+ performance
    const hashedPassword = await bcrypt.hash(sharedPassword, 8);

    // Save voucher to SQLite
    // valid_until is NULL — will be set at first redeem
    const result = await insertVoucherStmt.run(
      hotspot_username,
      hashedPassword,
      package_id,
      null, // valid_until — set at first auth
      'unused', // status — not yet redeemed
      created_by,
      null
    );

    res.json({
      message: 'Voucher generated successfully',
      voucher: {
        id: result.lastID,
        hotspot_username,
        package_id,
        package_name: pkg.name,
        profile,
        valid_until: null,
        status: 'unused',
        created_by,
        shared_password: sharedPassword,
      },
    });
  } catch (err) {
    console.error('[voucher/generate]', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message || 'Unable to generate voucher' });
  }
});


// ─────────────────────────────────────────────
// POST /api/vouchers/redeem
// Called when student enters voucher on hotspot portal.
// - Validates password
// - Attempts MikroTik user creation FIRST
// - Only updates SQLite after MikroTik confirms success
// - Only inserts a new session if one doesn't already exist
// ─────────────────────────────────────────────
async function redeemVoucher(req, res) {
  try {
    const { hotspot_username, vFullname, buyer_full_name } = req.body;
    const sharedPassword = resolveSharedPassword();
    const buyerFullName = String(vFullname || buyer_full_name || '').trim();

    if (!hotspot_username) {
      return res.status(400).json({
        error: 'hotspot_username is required',
      });
    }

    // Look up voucher
    const voucher = await db.getPreparedStatement('getVoucherByUsername').get(hotspot_username);
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    // Only unused or active vouchers can be redeemed
    if (voucher.status === 'expired') {
      return res.status(400).json({ error: 'Voucher has expired' });
    }
    if (voucher.status === 'generated') return res.status(400).json({ error: 'Voucher must be marked sold before redemption' });

    // If already active, check if still valid
    if (voucher.status === 'active') {
      const now = new Date();
      const validUntil = new Date(voucher.valid_until);
      if (validUntil <= now) {
        return res.status(400).json({ error: 'Voucher has expired' });
      }
    }

    // Validate password against stored hash
    const match = await bcrypt.compare(sharedPassword, voucher.hotspot_password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Get package details for duration and profile
    const pkg = await db.getPreparedStatement('getPackageById').get(voucher.package_id);
    if (!pkg) {
      return res.status(500).json({ error: 'Package not found for this voucher' });
    }

    const profile = PROFILE_MAP[voucher.package_id];
    if (!profile) {
      return res.status(500).json({ error: 'No MikroTik profile mapped for this package' });
    }

    const now = new Date();
    let validUntil;
    let isFirstRedeem = false;

    if (voucher.status === 'unused' || voucher.status === 'sold') {
      isFirstRedeem = true;
      validUntil = new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000);

      // ─────────────────────────────────────────
      // Step 1 — Try MikroTik FIRST
      // If this fails, SQLite is NOT updated
      // Voucher stays 'unused' and can be retried
      // ─────────────────────────────────────────
      try {
        await addHotspotUser(hotspot_username, sharedPassword, profile);
      } catch (mikrotikErr) {
        console.error('[voucher/redeem] MikroTik error:', mikrotikErr && mikrotikErr.message ? mikrotikErr.message : mikrotikErr);
        return res.status(500).json({
          error: 'Failed to activate on router. Please verify the MikroTik connection and try again.',
        });
      }

      // ─────────────────────────────────────────
      // Step 2 — MikroTik confirmed success
      // Now safe to update SQLite
      // ─────────────────────────────────────────
      await db.getPreparedStatement('updateVoucherStatus').run(
        voucher.reseller_id ? 'redeemed' : 'active',
        now.toISOString(),
        voucher.id
      );

      await db.getPreparedStatement('updateVoucherValidUntil').run(
        validUntil.toISOString(),
        voucher.id
      );
      if (buyerFullName) {
        await db.getPreparedStatement('updateVoucherBuyerFullName').run(buyerFullName, voucher.id);
      }
      if (voucher.reseller_id) await db.runAsync('UPDATE reseller_sales SET redeemed_at=? WHERE voucher_id=?', [now.toISOString(), voucher.id]);

    } else {
      // Already active — use existing valid_until
      validUntil = new Date(voucher.valid_until);
    }

    if (buyerFullName) {
      await db.getPreparedStatement('updateVoucherBuyerFullName').run(buyerFullName, voucher.id);
    }

    // ─────────────────────────────────────────
    // Step 3 — Only insert session if one
    // doesn't already exist for this voucher.
    // Prevents duplicate sessions when a student
    // logs in multiple times on the same voucher.
    // ─────────────────────────────────────────
    const existingSession = await db.getPreparedStatement('getActiveVoucherSession').get(voucher.id);
    if (!existingSession) {
      await db.getPreparedStatement('insertVoucherSession').run(
        voucher.id,
        hotspot_username,
        validUntil.toISOString(),
        'active'
      );
    }

    res.json({
      message: isFirstRedeem ? 'Voucher redeemed successfully' : 'Login successful',
      voucher: {
        id: voucher.id,
        username: hotspot_username,
        password: sharedPassword,
        buyer_full_name: buyerFullName || voucher.buyer_full_name || null,
        package: pkg,
        valid_until: validUntil.toISOString(),
        status: 'active',
      },
    });
  } catch (err) {
    console.error('[voucher/redeem]', err);
    res.status(500).json({ error: err.message || 'Unable to redeem voucher' });
  }
}

// Ensure required DB statements exist before running redeem
router.post('/redeem', async (req, res, next) => {
  const required = [
    'getVoucherByUsername',
    'getPackageById',
    'updateVoucherStatus',
    'updateVoucherBuyerFullName',
    'updateVoucherValidUntil',
    'getActiveVoucherSession',
    'insertVoucherSession',
  ];
  const missing = required.filter((name) => !(db.getPreparedStatement && db.getPreparedStatement(name)));
  if (missing.length) return res.status(503).json({ error: 'Database not ready', missing });
  return redeemVoucher(req, res, next);
});


// ─────────────────────────────────────────────
// GET /api/vouchers
// List all vouchers — admin use
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const vouchers = await db.getPreparedStatement('getAllVouchers').all();
    res.json({ vouchers });
  } catch (err) {
    console.error('[voucher/list]', err);
    res.status(500).json({ error: err.message || 'Unable to fetch vouchers' });
  }
});


// ─────────────────────────────────────────────
// GET /api/vouchers/:username
// Check a single voucher status — admin use
// ─────────────────────────────────────────────
router.get('/:username', async (req, res) => {
  try {
    const voucher = await db.getPreparedStatement('getVoucherByUsername').get(req.params.username);
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const pkg = await db.getPreparedStatement('getPackageById').get(voucher.package_id);
    const now = new Date();
    const validUntil = voucher.valid_until ? new Date(voucher.valid_until) : null;
    const remainingMs = validUntil ? Math.max(0, validUntil - now) : null;
    const remainingHours = remainingMs ? (remainingMs / (1000 * 60 * 60)).toFixed(1) : null;

    res.json({
      voucher: {
        ...voucher,
        package: pkg,
        remaining_hours: remainingHours,
      },
    });
  } catch (err) {
    console.error('[voucher/status]', err);
    res.status(500).json({ error: err.message || 'Unable to fetch voucher' });
  }
});


// Expose the handler so other routes (eg. POST /login) can reuse the same logic
router.redeemVoucher = redeemVoucher;
router.generateVoucher = generateVoucher;

module.exports = router;
