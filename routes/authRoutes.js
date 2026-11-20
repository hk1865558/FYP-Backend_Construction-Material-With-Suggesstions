
const express = require('express');

// Import registration and login controllers
const {
    registerCustomer,
    registerVendor,
    registerArchitect,
    login
} = require('../controllers/authController');

// Import authentication middleware from the correct file
const {
    authenticateToken
} = require('../middleware/authMiddleware');

// Create Express router
const router = express.Router();

// Customer registration
router.post('/register/customer', registerCustomer);

// Vendor registration
router.post('/register/vendor', registerVendor);

// Architect registration
router.post('/register/architect', registerArchitect);

// Login
router.post('/login', login);

// Get currently authenticated user
router.get('/me', authenticateToken, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user
    });
});

// Export router
module.exports = router;
