
const express = require('express');

const {
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
} = require('../controllers/architectController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');


const multer = require('multer');

const allowedFileTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
};

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const extension = require('path')
            .extname(file.originalname)
            .toLowerCase();

        const expectedMimeType = allowedFileTypes[extension];

        if (!expectedMimeType || file.mimetype !== expectedMimeType) {
            return cb(new Error(
                'Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.'
            ));
        }

        cb(null, true);
    }
});


const handleDesignUpload = (req, res, next) => {
    upload.single('file')(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'File size cannot exceed 10 MB.'
                });
            }

            return res.status(400).json({
                success: false,
                message: 'File upload failed. Please check the selected file.'
            });
        }

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        next();
    });
};


const router = express.Router();

// Protect all architect routes
router.use(authenticateToken, authorizeRoles('Architect'));

// Architect profile
router.get('/profile', getArchitectProfile);
router.put('/profile', saveArchitectProfile);

// House designs
router.post('/designs', addHouseDesign);
router.get('/designs', getArchitectDesigns);
router.get('/designs/:designId', getDesignDetails);
router.put('/designs/:designId', updateHouseDesign);
router.patch('/designs/:designId/publish', publishHouseDesign);
router.delete('/designs/:designId', deleteHouseDesign);

// Add a floor to a house design
router.post('/designs/:designId/floors', addDesignFloor);

// Add a room to a design floor
router.post('/designs/floors/:floorId/rooms', addDesignRoom);

// Add a wall to a design floor
router.post('/designs/floors/:floorId/walls', addDesignWall);

// Add a door or window to a design wall
router.post('/designs/walls/:wallId/openings', addDesignOpening);

router.post(
    '/designs/rooms/:roomId/walls/:wallId',
        linkRoomWall);

// Upload a file to an architect's unpublished design
router.post(
    '/designs/:designId/files',
    handleDesignUpload,
    uploadDesignFile
);

//Download Design File
router.get(
    '/files/:fileId/download',
    downloadDesignFile
);

module.exports = router;
