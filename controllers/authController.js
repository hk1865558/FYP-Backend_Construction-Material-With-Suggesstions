
// Import required packages
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/db');

// Check the required registration fields
const validateRegistration = (data, role) => {
    const { fullName, email, password } = data;

    if (!fullName || !email || !password) {
        return 'Full name, email, and password are required.';
    }

    if (fullName.trim().length > 100) {
        return 'Full name cannot exceed 100 characters.';
    }

    if (email.trim().length > 150) {
        return 'Email cannot exceed 150 characters.';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
        return 'Please enter a valid email address.';
    }

    if (password.length < 8) {
        return 'Password must contain at least 8 characters.';
    }

    const passwordPattern =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

    if (!passwordPattern.test(password)) {
        return 'Password must contain uppercase, lowercase, a number, and a special character.';
    }

    // Validate role-specific required fields
    if (role === 'Vendor' && !data.shopName?.trim()) {
        return 'Shop name is required for vendor registration.';
    }

    return null;
};

// Define profile insertion queries for each role
const profileQueries = {
    Customer: `
        INSERT INTO dbo.CustomerProfiles (UserID, City, Address)
        VALUES (@UserID, @City, @Address);
    `,

    Vendor: `
        INSERT INTO dbo.VendorProfiles
            (UserID, ShopName, ShopAddress, City, Description)
        VALUES
            (@UserID, @ShopName, @ShopAddress, @City, @Description);
    `,

    Architect: `
        INSERT INTO dbo.ArchitectProfiles
            (UserID, Qualification, OfficeAddress)
        VALUES
            (@UserID, @Qualification, @OfficeAddress);
    `
};

// Register a customer, vendor, or architect
const register = (role) => async (req, res) => {
    let transaction;
    let transactionStarted = false;

    try {
        const validationError = validateRegistration(req.body, role);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        // Get the connected SQL Server pool
        const pool = await poolPromise;

        // Start a transaction so both inserts succeed or fail together
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        transactionStarted = true;

        // Check whether the email already exists
        const emailCheck = await new sql.Request(transaction)
            .input('Email', sql.NVarChar(150), req.body.email.trim())
            .query(`
                SELECT UserID
                FROM dbo.Users
                WHERE Email = @Email;
            `);

        if (emailCheck.recordset.length > 0) {
            await transaction.rollback();
            transactionStarted = false;

            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists.'
            });
        }

        // Find the role by its actual database name
        const roleResult = await new sql.Request(transaction)
            .input('RoleName', sql.NVarChar(60), role)
            .query(`
                SELECT RoleID
                FROM dbo.Roles
                WHERE RoleName = @RoleName;
            `);

        if (roleResult.recordset.length === 0) {
            throw new Error(`Role '${role}' was not found in the database.`);
        }

        const roleID = roleResult.recordset[0].RoleID;

        // Hash the password before saving it
        const passwordHash = await argon2.hash(req.body.password);

        // Insert the main user account
        const userResult = await new sql.Request(transaction)
            .input('RoleID', sql.Int, roleID)
            .input('FullName', sql.NVarChar(100), req.body.fullName.trim())
            .input('Email', sql.NVarChar(150), req.body.email.trim())
            .input('PasswordHash', sql.NVarChar(255), passwordHash)
            .input('Phone', sql.NVarChar(20), req.body.phone?.trim() || null)
            .query(`
                INSERT INTO dbo.Users
                    (RoleID, FullName, Email, PasswordHash, Phone)
                OUTPUT INSERTED.UserID
                VALUES
                    (@RoleID, @FullName, @Email, @PasswordHash, @Phone);
            `);

        const userID = userResult.recordset[0].UserID;

        // Insert the matching role-specific profile
        const profileRequest = new sql.Request(transaction)
            .input('UserID', sql.Int, userID);

        if (role === 'Customer') {
            profileRequest
                .input('City', sql.NVarChar(100), req.body.city?.trim() || null)
                .input('Address', sql.NVarChar(300), req.body.address?.trim() || null);
        }

        if (role === 'Vendor') {
            profileRequest
                .input('ShopName', sql.NVarChar(150), req.body.shopName.trim())
                .input('ShopAddress', sql.NVarChar(300), req.body.shopAddress?.trim() || null)
                .input('City', sql.NVarChar(100), req.body.city?.trim() || null)
                .input('Description', sql.NVarChar(500), req.body.description?.trim() || null);
        }

        if (role === 'Architect') {
            profileRequest
                .input('Qualification', sql.NVarChar(150), req.body.qualification?.trim() || null)
                .input('OfficeAddress', sql.NVarChar(300), req.body.officeAddress?.trim() || null);
        }

        await profileRequest.query(profileQueries[role]);

        // Save both records permanently
        await transaction.commit();
        transactionStarted = false;

        // Create a login token
        const token = jwt.sign(
            {
                userId: userID,
                role: role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d'
            }
        );

        return res.status(201).json({
            success: true,
            message: `${role} account registered successfully.`,
            token,
            user: {
                userId: userID,
                fullName: req.body.fullName.trim(),
                email: req.body.email.trim(),
                role
            }
        });

    } catch (error) {
        // Roll back incomplete registration
        if (transactionStarted && transaction) {
            await transaction.rollback();
        }

        console.error('Registration error:', error.message);

        // Handle a duplicate email if another request inserted it first
        if (error.number === 2627 || error.number === 2601) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists.'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
};

// Export registration handlers

// Log in a customer, vendor, or architect
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate login fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        // Get the connected database pool
        const pool = await poolPromise;

        // Find the account and its role
        const result = await pool.request()
            .input('Email', sql.NVarChar(150), email.trim())
            .query(`
                SELECT
                    U.UserID,
                    U.FullName,
                    U.Email,
                    U.PasswordHash,
                    U.IsActive,
                    R.RoleName
                FROM dbo.Users AS U
                INNER JOIN dbo.Roles AS R
                    ON U.RoleID = R.RoleID
                WHERE U.Email = @Email;
            `);

        // Check whether the account exists
        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = result.recordset[0];

        // Prevent inactive accounts from logging in
        if (!user.IsActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact support.'
            });
        }

        // Verify the submitted password against its stored hash
        const passwordMatches = await argon2.verify(
            user.PasswordHash,
            password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Generate a signed authentication token
        const token = jwt.sign(
            {
                userId: user.UserID,
                role: user.RoleName
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d'
            }
        );

        // Return account details without exposing the password hash
        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                userId: user.UserID,
                fullName: user.FullName,
                email: user.Email,
                role: user.RoleName
            }
        });

    } catch (error) {
        console.error('Login error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
};

// Export all authentication handlers
module.exports = {
    registerCustomer: register('Customer'),
    registerVendor: register('Vendor'),
    registerArchitect: register('Architect'),
    login
};
