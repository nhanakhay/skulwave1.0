module.exports = function adminAuth(req,res, next) {
    const apiKey = req.headers['x-admin-key'];

    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({error: 'Unauthorized'})
    }
    next();
};