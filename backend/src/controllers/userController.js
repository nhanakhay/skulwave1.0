// const bcrypt = require("bcryptjs");
// const db = require("../db/database");

// function nowISOString() {
//   return new Date().toISOString();
// }

// /**
//  * Login via voucher username/password
//  * POST /api/auth/login
//  */
// exports.login = async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     if (!username || !password) {
//       return res.status(400).json({ error: "Username and password are required" });
//     }

//     const voucher = await db.getPreparedStatement('getVoucherByUsername').get(username);
//     if (!voucher) {
//       return res.status(401).json({ error: "Invalid username or password" });
//     }

//     if (voucher.status !== 'active') {
//       return res.status(401).json({ error: "Voucher is not active" });
//     }

//     const now = new Date();
//     const validUntil = new Date(voucher.valid_until);
//     if (isNaN(validUntil.getTime()) || validUntil <= now) {
//       return res.status(401).json({ error: "Voucher has expired" });
//     }

//     const match = await bcrypt.compare(password, voucher.hotspot_password);
//     if (!match) {
//       return res.status(401).json({ error: "Invalid username or password" });
//     }

//     // Record a session tied to the voucher validity window.
//     await db.getPreparedStatement('insertVoucherSession').run(
//       voucher.id,
//       voucher.hotspot_username,
//       voucher.valid_until,
//       'active'
//     );

//     const packageDetails = await db.getPreparedStatement('getPackageById').get(voucher.package_id);

//     res.json({
//       message: "Login successful",
//       voucher: {
//         id: voucher.id,
//         username: voucher.hotspot_username,
//         package: packageDetails,
//         valid_until: voucher.valid_until,
//         status: voucher.status,
//       },
//     });
//   } catch (err) {
//     console.error("[auth/login]", err);
//     res.status(500).json({ error: err.message || "Internal server error" });
//   }
// };
