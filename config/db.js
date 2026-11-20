
const sql = require('mssql/msnodesqlv8');

// Load environment variables
require('dotenv').config();

// SQL Server connection settings
const dbConfig = {
    server: 'localhost',
    database: process.env.DB_NAME,

    // Specify the installed Microsoft ODBC driver
    driver: 'ODBC Driver 18 for SQL Server',

    options: {
        trustedConnection: true,       // Use Windows Authentication
        instanceName: 'SQLEXPRESS',    // Your SQL Server instance
        trustServerCertificate: true,
        encrypt: false
    },

    // Reuse database connections
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Establish the SQL Server connection
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('SQL Server connected successfully!');
        console.log('Database: BuildMateDB');
        return pool;
    })
    .catch(error => {
        console.error('Database connection failed:', error.message);
        throw error;
    });

// Export connection pool for other backend files
module.exports = {
    sql,
    poolPromise
};
