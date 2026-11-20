
const { sql, poolPromise } = require('../config/db');

// Get the logged-in architect's profile
const getArchitectProfile = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    ap.ArchitectID,
                    ap.Qualification,
                    ap.OfficeAddress
                FROM Users u
                INNER JOIN ArchitectProfiles ap
                    ON u.UserID = ap.UserID
                WHERE u.UserID = @UserID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Architect profile retrieved successfully.',
            profile: result.recordset[0]
        });

    } catch (error) {
        console.error('Get architect profile error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve architect profile.'
        });
    }
};


// Add or update the logged-in architect's profile

const saveArchitectProfile = async (req, res) => {
    try {
        const { qualification, officeAddress } = req.body;

        // Validate input data types
        if (
            (qualification !== undefined &&
                qualification !== null &&
                typeof qualification !== 'string') ||
            (officeAddress !== undefined &&
                officeAddress !== null &&
                typeof officeAddress !== 'string')
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid profile information.'
            });
        }

        // Validate input lengths
        if (
            (qualification && qualification.length > 150) ||
            (officeAddress && officeAddress.length > 300)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Qualification or office address exceeds the allowed length.'
            });
        }

        const pool = await poolPromise;

        // Find the existing architect profile
        const existingProfile = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT
                    ArchitectID,
                    Qualification,
                    OfficeAddress
                FROM ArchitectProfiles
                WHERE UserID = @UserID
            `);

        const existing = existingProfile.recordset[0];

        // Preserve omitted fields and allow explicit clearing
        const qualificationValue =
            qualification === undefined
                ? existing?.Qualification ?? null
                : qualification === null
                    ? null
                    : qualification.trim() || null;

        const addressValue =
            officeAddress === undefined
                ? existing?.OfficeAddress ?? null
                : officeAddress === null
                    ? null
                    : officeAddress.trim() || null;

        const request = pool.request()
            .input('Qualification', sql.NVarChar(150), qualificationValue)
            .input('OfficeAddress', sql.NVarChar(300), addressValue);

        if (existingProfile.recordset.length === 0) {

            // Create a new architect profile
            await request
                .input('UserID', sql.Int, req.user.userId)
                .execute('sp_AddArchitectProfile');

        } else {

            // Update the existing architect profile
            await request
                .input(
                    'ArchitectID',
                    sql.Int,
                    existing.ArchitectID
                )
                .execute('sp_UpdateArchitectProfile');
        }

        return res.status(200).json({
            success: true,
            message: 'Architect profile saved successfully.'
        });

    } catch (error) {
        console.error('Save architect profile error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to save architect profile.'
        });
    }
};


// Get the ArchitectID of the currently logged-in architect
const getArchitectId = async (userId) => {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('UserID', sql.Int, userId)
        .query(`
            SELECT ArchitectID
            FROM ArchitectProfiles
            WHERE UserID = @UserID
        `);

    return result.recordset[0]?.ArchitectID || null;
};


// Create a new house design
const addHouseDesign = async (req, res) => {
    try {
        const { dimensionId, designName, description } = req.body;

        if (!dimensionId || !designName?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Plot dimension and design name are required.'
            });
        }

        if (designName.trim().length > 150 ||
            (description && description.length > 500)) {
            return res.status(400).json({
                success: false,
                message: 'Design name or description exceeds the allowed length.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('DimensionID', sql.Int, dimensionId)
            .input('DesignName', sql.NVarChar(150), designName.trim())
            .input('Description', sql.NVarChar(500), description?.trim() || null)
            .execute('sp_AddHouseDesign');

        return res.status(201).json({
            success: true,
            message: 'House design created successfully.',
            design: result.recordset[0]
        });

    } catch (error) {
        console.error('Add house design error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to create house design.'
        });
    }
};


// Update an existing unpublished house design
const updateHouseDesign = async (req, res) => {
    try {
        const designId = Number(req.params.designId);
        const { dimensionId, designName, description } = req.body;

        if (!Number.isInteger(designId) || designId <= 0 ||
            !dimensionId || !designName?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Valid design ID, plot dimension and design name are required.'
            });
        }

        if (designName.trim().length > 150 ||
            (description && description.length > 500)) {
            return res.status(400).json({
                success: false,
                message: 'Design name or description exceeds the allowed length.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('DesignID', sql.Int, designId)
            .input('ArchitectID', sql.Int, architectId)
            .input('DimensionID', sql.Int, dimensionId)
            .input('DesignName', sql.NVarChar(150), designName.trim())
            .input('Description', sql.NVarChar(500), description?.trim() || null)
            .execute('sp_UpdateHouseDesign');

        return res.status(200).json({
            success: true,
            message: result.recordset[0]?.Message ||
                'House design updated successfully.'
        });

    } catch (error) {
        console.error('Update house design error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to update house design.'
        });
    }
};


// Get all designs belonging to the logged-in architect
const getArchitectDesigns = async (req, res) => {
    try {
        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .execute('sp_GetArchitectDesigns');

        return res.status(200).json({
            success: true,
            message: 'Architect designs retrieved successfully.',
            totalDesigns: result.recordset.length,
            designs: result.recordset
        });

    } catch (error) {
        console.error('Get architect designs error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve architect designs.'
        });
    }
};


// Get complete details of one house design
const getDesignDetails = async (req, res) => {
    try {
        const designId = Number(req.params.designId);

        if (!Number.isInteger(designId) || designId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid design ID.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('DesignID', sql.Int, designId)
            .execute('sp_GetDesignDetails');

        // The stored procedure returns seven separate result sets
        return res.status(200).json({
            success: true,
            message: 'House design details retrieved successfully.',
            design: result.recordsets[0]?.[0] || null,
            floors: result.recordsets[1] || [],
            rooms: result.recordsets[2] || [],
            walls: result.recordsets[3] || [],
            roomWalls: result.recordsets[4] || [],
            openings: result.recordsets[5] || [],
            files: result.recordsets[6] || []
        });

    } catch (error) {
        console.error('Get design details error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to retrieve design details.'
        });
    }
};


// Publish a house design
const publishHouseDesign = async (req, res) => {
    try {
        const designId = Number(req.params.designId);

        if (!Number.isInteger(designId) || designId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid design ID.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('DesignID', sql.Int, designId)
            .execute('sp_PublishHouseDesign');

        return res.status(200).json({
            success: true,
            message: result.recordset[0]?.Message ||
                'House design published successfully.',
            designId
        });

    } catch (error) {
    console.error('Publish house design error:', error);

    // Handle SQL Server business-rule validation errors
    if (error.number >= 50000 && error.number <= 59999) {
        return res.status(400).json({
            success: false,
            message: 'The design could not be published. Please check its current status and try again.'
        });
    }

    return res.status(500).json({
        success: false,
        message: 'Unable to publish house design. Please try again.'
    });
    }
};


// Delete an unpublished house design
const deleteHouseDesign = async (req, res) => {
    try {
        const designId = Number(req.params.designId);

        if (!Number.isInteger(designId) || designId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid design ID.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('DesignID', sql.Int, designId)
            .execute('sp_DeleteHouseDesign');

        return res.status(200).json({
            success: true,
            message: result.recordset[0]?.Message ||
                'House design deleted successfully.'
        });

    } catch (error) {
    console.error('Delete house design error:', error);

    if (error.number >= 50000 && error.number <= 59999) {
        return res.status(400).json({
            success: false,
            message: 'The design could not be deleted. It may be published or unavailable.'
        });
    }

    return res.status(500).json({
        success: false,
        message: 'Unable to delete house design. Please try again.'
    });
    }
};


// Add a floor to an architect's house design
const addDesignFloor = async (req, res) => {
    try {
        const designId = Number(req.params.designId);
        const { floorName, floorNumber } = req.body;

        // Validate design ID
        if (!Number.isInteger(designId) || designId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid design ID.'
            });
        }

        // Only Ground Floor (0) and First Floor (1) are allowed
        if (
            !floorName?.trim() ||
            ![0, 1].includes(Number(floorNumber))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Valid floor name and floor number (0 or 1) are required.'
            });
        }

        if (floorName.trim().length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Floor name cannot exceed 50 characters.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('DesignID', sql.Int, designId)
            .input('ArchitectID', sql.Int, architectId)
            .input('FloorName', sql.NVarChar(50), floorName.trim())
            .input('FloorNumber', sql.Int, Number(floorNumber))
            .execute('sp_AddDesignFloor');

        return res.status(201).json({
            success: true,
            message: 'Floor added successfully.',
            floor: result.recordset?.[0] || null
        });

    } catch (error) {
        console.error('Add design floor error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to add floor.'
        });
    }
};

// Add a room to an architect's design floor
const addDesignRoom = async (req, res) => {
    try {
        const floorId = parseInt(req.params.floorId, 10);
        const { roomName, length, width, roomType } = req.body;

        // Validate the floor ID
        if (!Number.isInteger(floorId) || floorId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid floor ID.'
            });
        }

        // Validate required room information
        if (
            !roomName ||
            !roomType ||
            length === undefined ||
            width === undefined ||
            roomName.trim() === '' ||
            roomType.trim() === ''
        ) {
            return res.status(400).json({
                success: false,
                message: 'Room name, length, width, and room type are required.'
            });
        }

        // Validate room dimensions
        const roomLength = Number(length);
        const roomWidth = Number(width);

        if (
            !Number.isFinite(roomLength) ||
            !Number.isFinite(roomWidth) ||
            roomLength <= 0 ||
            roomWidth <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Room length and width must be positive numbers.'
            });
        }

        if (roomName.trim().length > 100 || roomType.trim().length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Room name or room type exceeds the allowed length.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);
        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
        });
}
        const pool = await poolPromise;

        // Execute the room creation stored procedure
        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('FloorID', sql.Int, floorId)
            .input('RoomName', sql.NVarChar(100), roomName.trim())
            .input('Length', sql.Decimal(8, 2), roomLength)
            .input('Width', sql.Decimal(8, 2), roomWidth)
            .input('RoomType', sql.NVarChar(50), roomType.trim())
            .execute('sp_AddDesignRoom');

        return res.status(201).json({
            success: true,
            message: 'Room added successfully.',
            room: result.recordset?.[0] || null
        });

    } catch (error) {
        console.error('Add design room error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to add room.'
        });
    }
};


// Add a wall to an architect's design floor
const addDesignWall = async (req, res) => {
    try {
        const floorId = parseInt(req.params.floorId, 10);
        const { wallName, length, height, thickness } = req.body;

        // Validate floor ID
        if (!Number.isInteger(floorId) || floorId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid floor ID.'
            });
        }

        // Validate required dimensions
        if (
            length === undefined ||
            height === undefined ||
            thickness === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'Wall length, height, and thickness are required.'
            });
        }

        const wallLength = Number(length);
        const wallHeight = Number(height);
        const wallThickness = Number(thickness);

        if (
            !Number.isFinite(wallLength) || wallLength <= 0 ||
            !Number.isFinite(wallHeight) || wallHeight <= 0 ||
            !Number.isFinite(wallThickness) || wallThickness <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Wall dimensions must be positive numbers.'
            });
        }

        if (wallName && wallName.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Wall name cannot exceed 100 characters.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);
        if (!architectId) {
           return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
}
        const pool = await poolPromise;

        // Execute the wall creation stored procedure
        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('FloorID', sql.Int, floorId)
            .input('WallName', sql.NVarChar(100), wallName?.trim() || null)
            .input('Length', sql.Decimal(8, 2), wallLength)
            .input('Height', sql.Decimal(8, 2), wallHeight)
            .input('Thickness', sql.Decimal(5, 2), wallThickness)
            .execute('sp_AddDesignWall');

        return res.status(201).json({
            success: true,
            message: 'Wall added successfully.',
            wall: result.recordset?.[0] || null
        });

    } catch (error) {
        console.error('Add design wall error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to add wall.'
        });
    }
};


// Add a door or window to an architect's design wall
const addDesignOpening = async (req, res) => {
    try {
        const wallId = parseInt(req.params.wallId, 10);

        const {
            openingType,
            openingName,
            width,
            height,
            position
        } = req.body;

        // Validate wall ID
        if (!Number.isInteger(wallId) || wallId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid wall ID.'
            });
        }

        // Validate required fields
        if (
            !openingType ||
            width === undefined ||
            height === undefined ||
            position === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'Opening type, width, height, and position are required.'
            });
        }

        // Validate opening type
        const validType = ['Door', 'Window'];

        if (!validType.includes(openingType)) {
            return res.status(400).json({
                success: false,
                message: 'Opening type must be Door or Window.'
            });
        }

        // Validate dimensions
        const openingWidth = Number(width);
        const openingHeight = Number(height);
        const openingPosition = Number(position);

        if (
            !Number.isFinite(openingWidth) ||
            !Number.isFinite(openingHeight) ||
            !Number.isFinite(openingPosition) ||
            openingWidth <= 0 ||
            openingHeight <= 0 ||
            openingPosition < 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Opening dimensions or position are invalid.'
            });
        }

        if (openingName && openingName.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Opening name cannot exceed 100 characters.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);
        console.log('Logged-in UserID:', req.user.userId);
console.log('Resolved ArchitectID:', architectId);
console.log('Requested WallID:', wallId);
        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('WallID', sql.Int, wallId)
            .input('OpeningType', sql.NVarChar(30), openingType)
            .input('OpeningName', sql.NVarChar(100), openingName?.trim() || null)
            .input('Width', sql.Decimal(8, 2), openingWidth)
            .input('Height', sql.Decimal(8, 2), openingHeight)
            .input('Position', sql.Decimal(8, 2), openingPosition)
            .execute('sp_AddDesignOpening');

        return res.status(201).json({
            success: true,
            message: 'Door or window added successfully.',
            opening: result.recordset?.[0] || null
        });

    } catch (error) {
        console.error('Add design opening error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Unable to add opening.'
        });
    }
};


const linkRoomWall = async (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId, 10);
        const wallId = parseInt(req.params.wallId, 10);

        if (!Number.isInteger(roomId) || roomId <= 0 ||
            !Number.isInteger(wallId) || wallId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid RoomID and WallID are required.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('RoomID', sql.Int, roomId)
            .input('WallID', sql.Int, wallId)
            .execute('sp_LinkRoomWall');

        return res.status(201).json({
            success: true,
            message: result.recordset?.[0]?.Message ||
                'Room and wall linked successfully.'
        });

    } catch (error) {
        console.error('Link Room Wall Error:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to link room and wall.'
        });
    }
};


// Upload a design file for an architect's unpublished house design
const uploadDesignFile = async (req, res) => {
    try {
        const designId = Number(req.params.designId);

        if (!Number.isInteger(designId) || designId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid design ID.'
            });
        }

        // Check whether a file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please select a file to upload.'
            });
        }


        const buffer = req.file.buffer;
        const mimeType = req.file.mimetype;

        const isValidFile =
            (mimeType === 'image/jpeg' &&
                buffer[0] === 0xFF &&
                buffer[1] === 0xD8 &&
                buffer[2] === 0xFF) ||

            (mimeType === 'image/png' &&
                buffer.subarray(0, 8).equals(
                    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
                )) ||

            (mimeType === 'image/webp' &&
                buffer.toString('ascii', 0, 4) === 'RIFF' &&
                buffer.toString('ascii', 8, 12) === 'WEBP') ||

            (mimeType === 'application/pdf' &&
                buffer.toString('ascii', 0, 5) === '%PDF-');

        if (!isValidFile) {
            return res.status(400).json({
                success: false,
                message: 'The file content does not match its selected file type.'
            });
        }


        const fileName = req.file.originalname;
        const fileType = req.file.mimetype || 'application/octet-stream';
        const fileData = req.file.buffer;

        if (fileName.length > 255 || fileType.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'File name or file type exceeds the allowed length.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('ArchitectID', sql.Int, architectId)
            .input('DesignID', sql.Int, designId)
            .input('FileName', sql.NVarChar(255), fileName)
            .input('FileType', sql.NVarChar(50), fileType)
            .input('FileData', sql.VarBinary(sql.MAX), fileData)
            .execute('sp_UploadDesignFile');

        return res.status(201).json({
            success: true,
            message: result.recordset?.[0]?.Message ||
                'Design file uploaded successfully.',
            file: {
                FileID: result.recordset?.[0]?.FileID,
                FileName: fileName,
                FileType: fileType,
                DesignID: designId
            }
        });

    } catch (error) {
    console.error('Upload design file error:', error);

    return res.status(500).json({
        success: false,
        message: 'Unable to upload design file. Please try again.'
    });
    }
};


// Download an uploaded design file
const downloadDesignFile = async (req, res) => {
    try {
        const fileId = Number(req.params.fileId);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file ID.'
            });
        }

        const architectId = await getArchitectId(req.user.userId);

        if (!architectId) {
            return res.status(404).json({
                success: false,
                message: 'Architect profile not found.'
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('FileID', sql.Int, fileId)
            .input('ArchitectID', sql.Int, architectId)
            .query(`
                SELECT
                    df.FileID,
                    df.FileName,
                    df.FileType,
                    df.FileData
                FROM DesignFiles df
                INNER JOIN HouseDesigns hd
                    ON df.DesignID = hd.DesignID
                WHERE df.FileID = @FileID
                  AND hd.ArchitectID = @ArchitectID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found or you are not authorized to access it.'
            });
        }

        const file = result.recordset[0];

        res.setHeader('Content-Type', file.FileType);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        res.setHeader(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(file.FileName)}`
        );

        res.setHeader('Content-Length', file.FileData.length);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).send(file.FileData);

    } catch (error) {
        console.error('Download design file error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to download design file.'
        });
    }
};


module.exports = {
    getArchitectProfile,
    saveArchitectProfile,
    addHouseDesign,
    updateHouseDesign,
    getArchitectDesigns,
    getDesignDetails,
    publishHouseDesign,
    deleteHouseDesign,
    addDesignFloor,
    addDesignRoom,
    addDesignWall,
    addDesignOpening,
    linkRoomWall,
    uploadDesignFile,
    downloadDesignFile
};