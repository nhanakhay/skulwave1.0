const RouterOSAPI = require('node-routeros').RouterOSAPI;

function normalizeRouterReply(reply) {
  if (reply === null || reply === undefined) {
    return [];
  }

  if (typeof reply === 'string') {
    return reply.trim() === '' ? [] : reply;
  }

  if (Array.isArray(reply)) {
    return reply;
  }

  if (typeof reply === 'object') {
    return reply;
  }

  return [reply];
}

// ─────────────────────────────────────────────
// MikroTik Connection Pool
// Reuses connections instead of opening a new
// one on every request — efficient for Pi 3B+
// ─────────────────────────────────────────────
class MikroTikConnectionPool {
  constructor(maxConnections = 3) {
    this.maxConnections = maxConnections;
    this.connections = [];
    this.activeCount = 0;
    this.waitQueue = [];
  }

  async getConnection() {
    // Reuse available connection
    if (this.connections.length > 0) {
      return this.connections.pop();
    }

    // Create new connection if under limit
    if (this.activeCount < this.maxConnections) {
      this.activeCount++;
      const conn = new RouterOSAPI({
        host: process.env.MIKROTIK_HOST,
        user: process.env.MIKROTIK_USER,
        password: process.env.MIKROTIK_PASSWORD,
        port: 8728,
        // timeout in milliseconds (10s)
        timeout: 10000,
      });

      conn.on('connect', () => {
        console.log(`[mikrotik] Connected to RouterOS at ${process.env.MIKROTIK_HOST}`);
      });

      // Prevent unhandled 'error' events from crashing the process
      conn.on('error', (err) => {
        console.error('[mikrotik] RouterOS connection error:', err && err.message ? err.message : err);
        try { conn.close(); } catch (e) { /* ignore */ }
      });

      try {
        await conn.connect();
      } catch (err) {
        this.activeCount = Math.max(0, this.activeCount - 1);
        console.error('[mikrotik] Failed to connect to RouterOS:', {
          host: process.env.MIKROTIK_HOST,
          port: 8728,
          message: err && err.message ? err.message : err,
          errno: err && err.errno ? err.errno : undefined,
        });
        throw err;
      }
      return conn;
    }

    // Wait for a connection to free up
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  releaseConnection(conn) {
    if (!conn) return;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      resolve(conn);
    } else {
      this.connections.push(conn);
    }
  }

  async closeAll() {
    for (const conn of this.connections) {
      try {
        conn.close();
      } catch (err) {
        console.warn('[mikrotik] Error closing connection:', err.message);
      }
    }
    this.connections = [];
    this.activeCount = 0;
  }
}

const pool = new MikroTikConnectionPool(3);

// ─────────────────────────────────────────────
// Add a hotspot user on MikroTik
// Called at first redeem — NOT at voucher generation
// Pi handles expiry tracking via valid_until in SQLite
// MikroTik only enforces speed via the profile
// ─────────────────────────────────────────────
async function addHotspotUser(username, password, profile = 'default', dataCapBytes = 0, limitUptime = '') {
  const conn = await pool.getConnection();
  try {
    const params = [
      `=name=${username}`,
      `=password=${password}`,
      `=profile=${profile}`,
    ];
    // RouterOS applies byte limits to an individual hotspot user.  Profiles are
    // deliberately only used for speed/traffic shaping.
    if (Number(dataCapBytes) > 0) params.push(`=limit-bytes-total=${Math.floor(Number(dataCapBytes))}`);
    if (limitUptime) params.push(`=limit-uptime=${limitUptime}`);
    const result = await conn.write('/ip/hotspot/user/add', params).catch((err) => {
      if (err && err.message && err.message.includes('UNKNOWNREPLY')) {
        return [];
      }
      throw err;
    });
    const normalizedResult = normalizeRouterReply(result);
    console.log(`[mikrotik] Added hotspot user: ${username} on profile: ${profile}`);
    return { message: 'User created successfully', data: normalizedResult };
  } catch (err) {
    throw new Error(`[mikrotik/addHotspotUser] ${err?.message || String(err)}`);
  } finally {
    pool.releaseConnection(conn);
  }
}

// ─────────────────────────────────────────────
// Remove a hotspot user from MikroTik
// Called by expiry job when valid_until has passed
// ─────────────────────────────────────────────
async function removeHotspotUser(username) {
  const conn = await pool.getConnection();
  try {
    const users = await conn.write('/ip/hotspot/user/print', [
      `?name=${username}`,
    ]).catch((err) => {
      if (err && err.message && err.message.includes('UNKNOWNREPLY')) {
        return [];
      }
      throw err;
    });
    const normalizedUsers = normalizeRouterReply(users);

    if (!Array.isArray(normalizedUsers) || normalizedUsers.length === 0) {
      console.warn(`[mikrotik] User not found on router: ${username}`);
      return { message: 'Hotspot user not found', removed: false };
    }

    const user = normalizedUsers[0];
    await conn.write('/ip/hotspot/user/remove', [`=.id=${user['.id']}`]);
    console.log(`[mikrotik] Removed hotspot user: ${username}`);
    return { message: 'User removed successfully', removed: true };
  } catch (err) {
    throw new Error(`[mikrotik/removeHotspotUser] ${err?.message || String(err)}`);
  } finally {
    pool.releaseConnection(conn);
  }
}

// ─────────────────────────────────────────────
// Disconnect active hotspot session
// Kicks user off WiFi immediately if connected
// Called alongside removeHotspotUser on expiry
// ─────────────────────────────────────────────
async function disconnectHotspotUser(username) {
  const conn = await pool.getConnection();
  try {
    const activeSessions = await conn.write('/ip/hotspot/active/print', [
      `?user=${username}`,
    ]).catch((err) => {
      if (err && err.message && err.message.includes('UNKNOWNREPLY')) {
        return [];
      }
      throw err;
    });
    const normalizedSessions = normalizeRouterReply(activeSessions);

    if (!Array.isArray(normalizedSessions) || normalizedSessions.length === 0) {
      console.log(`[mikrotik] No active session for: ${username}`);
      return { message: 'No active session found', disconnected: false };
    }

    for (const session of normalizedSessions) {
      await conn.write('/ip/hotspot/active/remove', [`=.id=${session['.id']}`]);
    }

    console.log(`[mikrotik] Disconnected active session for: ${username}`);
    return { message: 'User disconnected successfully', disconnected: true };
  } catch (err) {
    throw new Error(`[mikrotik/disconnectHotspotUser] ${err?.message || String(err)}`);
  } finally {
    pool.releaseConnection(conn);
  }
}

module.exports = { addHotspotUser, removeHotspotUser, disconnectHotspotUser };
