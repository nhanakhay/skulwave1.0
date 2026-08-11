require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express =  require("express");
const cors = require("cors");
const path = require("path");
const compression = require("compression");

// const authRoutes = require("./routes/auth");
const voucherRoutes = require("./routes/vouchers");
const adminRoutes = require("./routes/admin");
const resellerRoutes = require('./routes/resellers');
const { scheduleExpiryJob } = require("./jobs/expiryJob");
const adminAuth = require('./middleware/adminAuth')

const db = require("./db/database");
const app = express()

//app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve static files from the frontend directory with caching
app.use(express.static(path.join(__dirname, "../../frontend")));
// app.use(express.static(path.join(__dirname, "../../frontend"), { maxAge: '1h' }));
// API routes
// app.use("/api/auth", authRoutes);
// Mount admin routes without global adminAuth so the login endpoint remains accessible.
console.log('[server] adminRoutes loaded?', !!adminRoutes, 'stack size', adminRoutes.stack ? adminRoutes.stack.length : 0);
app.use("/api/admin", adminRoutes);
app.use('/api/resellers', resellerRoutes);
console.log('[server] app._router after admin mount?', !!app._router, 'stack size', app._router ? app._router.stack.length : 'none');
// Protect voucher generation specifically
app.use("/api/vouchers/generate", adminAuth);
app.use("/api/vouchers", voucherRoutes);

// Many hotspot portals post credentials to `/login`.
// Reuse the voucher redeem handler so entering voucher codes activates the voucher.
if (voucherRoutes && voucherRoutes.redeemVoucher) {
  app.post('/', (req, res) => 
    voucherRoutes.redeemVoucher(req, res));
}

// Debug note: app._router may be undefined early in startup.
// Use a request logger instead to verify incoming requests at runtime.

// Schedule expiry checks
scheduleExpiryJob(60);

// Serve login page as default
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/login.html"));
});

app.listen(3000, "0.0.0.0", () => {
    console.log("Skulwave backend running on port 3000")
});
