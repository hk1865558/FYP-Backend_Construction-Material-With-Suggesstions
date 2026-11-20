
// Load environment variables
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import SQL Server connection
const { poolPromise } = require('./config/db');

// Import authentication routes
const authRoutes = require('./routes/authRoutes');

// Import architect routes
const architectRoutes = require('./routes/architectRoutes');

// Create Express application
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Welcome API route
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to BuildMate API'
    });
});

// Connect authentication routes
app.use('/api/auth', authRoutes);

// Start server after database connection
const startServer = async () => {
    try {
        await poolPromise;

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log(`BuildMate API running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Unable to start BuildMate API:', error.message);
        process.exit(1);
    }
};

app.use('/api/architect', architectRoutes);

startServer();
