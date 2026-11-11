const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token || token == 'null') {
        return res.status(401).json({
            success: false,
            message: 'Not authorize to access this route'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id);

        // Token can outlive its user
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }

        next();
    } catch (err) {
        console.log(err.stack);
        return res.status(401).json({
            success: false,
            message: 'Not authorize to access this route'
        });
    }
}

// Accept only callbacks signed by QStash: a JWT whose subject is the exact URL it was sent to
// shortcut: only the current signing key is tried, so callbacks get 401 after a key roll until config.env is updated; also try QSTASH_NEXT_SIGNING_KEY if keys get rolled
exports.verifyQstash = (req, res, next) => {
    try {
        jwt.verify(req.headers['upstash-signature'], process.env.QSTASH_CURRENT_SIGNING_KEY, {
            algorithms: ['HS256'],
            issuer: 'Upstash',
            subject: `${process.env.PUBLIC_URL}${req.originalUrl}`
        });
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Missing or invalid QStash signature'
        });
    }

    next();
}

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }

        next();
    }
}
