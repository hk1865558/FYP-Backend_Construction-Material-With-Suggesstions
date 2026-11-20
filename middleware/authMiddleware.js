
// Import JWT package
const jwt = require('jsonwebtoken');

// Verify the user's authentication token
const authenticateToken = (req, res, next) => {
    try {
        // Read the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is required.'
            });
        }

        // Extract the token
        const token = authHeader.split(' ')[1];

        // Verify the token using the private JWT secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach authenticated user information to the request
        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token.'
        });
    }
};

// Allow access only to specified roles
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource.'
            });
        }

        next();
    };
};

// Export authentication middleware
module.exports = {
    authenticateToken,
    authorizeRoles
};
