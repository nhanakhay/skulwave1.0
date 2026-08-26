const db = require("../db/database");
const {
  removeHotspotUser,
  disconnectHotspotUser,
} = require("../mikrotik/mikrotik");

// ─────────────────────────────────────────────
// Expiry Job
// Runs every 60 seconds (configurable)
// Checks SQLite for expired voucher sessions
// For each expired session:
//   1. Disconnect active hotspot session (kicks user off WiFi)
//   2. Remove hotspot user from MikroTik (prevents reconnect)
//   3. Mark session as expired in SQLite
//   4. Mark voucher as expired in SQLite
// ─────────────────────────────────────────────
async function expireVoucherSessions() {
  const now = new Date().toISOString();

  try {
    await db.waitForReady();
  } catch (err) {
    console.error(
      "[expiryJob] Database initialization failed:",
      err.message || err,
    );
    return;
  }

  let expiredSessions;
  const stmt =
    db.getPreparedStatement &&
    db.getPreparedStatement("getExpiredVoucherSessions");
  if (!stmt || typeof stmt.all !== "function") {
    console.warn(
      "[expiryJob] Prepared statement is not available yet — skipping expiry check",
    );
    return;
  }

  try {
    expiredSessions = await stmt.all(now);
  } catch (err) {
    console.error(
      "[expiryJob] Failed to fetch expired sessions:",
      err.message || err,
    );
    return;
  }

  if (expiredSessions.length)
    console.log(
      `[expiryJob] Found ${expiredSessions.length} expired voucher session(s) to process`,
    );

  for (const session of expiredSessions) {
    try {
      // Step 1 — Kick user off WiFi if currently connected
      await disconnectHotspotUser(session.hotspot_username);

      // Step 2 — Remove user from MikroTik so they can't reconnect
      await removeHotspotUser(session.hotspot_username);

      // Step 3 — Mark session as expired in SQLite
      await db
        .getPreparedStatement("expireVoucherSession")
        .run("expired", now, session.id);

      // Step 4 — Mark voucher itself as expired in SQLite
      await db
        .getPreparedStatement("updateVoucherStatus")
        .run("expired", now, session.voucher_id);

      console.log(
        `[expiryJob] ✓ Expired session ${session.id} — removed user: ${session.hotspot_username}`,
      );
    } catch (err) {
      // Log error but continue processing remaining sessions
      console.error(
        `[expiryJob] ✗ Failed to expire session ${session.id} (${session.hotspot_username}):`,
        err.message,
      );
    }
  }

  // Paid accounts use the same RouterOS lifecycle, but have their own session
  // records and individual data caps.
  const paidSessions = await db.allAsync(
    "SELECT s.*,u.hotspot_username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.status='active' AND s.expires_at<=?",
    [now],
  );
  for (const session of paidSessions) {
    try {
      await disconnectHotspotUser(session.hotspot_username);
      await removeHotspotUser(session.hotspot_username);
      await db.runAsync(
        "UPDATE sessions SET status='expired',end_time=? WHERE id=?",
        [now, session.id],
      );
      await db.runAsync("UPDATE users SET status='EXPIRED' WHERE id=?", [
        session.user_id,
      ]);
    } catch (err) {
      console.error("[expiryJob] paid session expiry failed:", err.message);
    }
  }
}

// ─────────────────────────────────────────────
// Schedule the expiry job
// Default: runs every 60 seconds
// Can be adjusted — e.g. scheduleExpiryJob(30)
// for 30 second checks
// ─────────────────────────────────────────────
function scheduleExpiryJob(intervalSeconds = 60) {
  console.log(
    `[expiryJob] Scheduled — checking every ${intervalSeconds} seconds`,
  );

  const runExpiryCheck = () => {
    expireVoucherSessions().catch((err) => {
      console.error("[expiryJob] Unhandled error:", err.message || err);
    });
  };

  // Run immediately on startup to catch any sessions
  // that expired while the server was offline
  runExpiryCheck();

  setInterval(runExpiryCheck, intervalSeconds * 1000);
}

module.exports = { scheduleExpiryJob, expireVoucherSessions };
