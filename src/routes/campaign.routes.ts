import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { verifyToken } from '../middleware/auth.middleware';
import {
  createCampaign,
  uploadExcel,
  getCampaigns,
  getCampaignById,
  getCampaignRecipients,
  updateRecipient,
  deleteRecipient,
  addRecipient,
  deleteCampaign,
  triggerEmailNow,
  recalculateCounts
} from '../controllers/campaign.controller';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'campaign-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// All routes require authentication
router.use(verifyToken);

// Campaign routes
router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.delete('/:id', deleteCampaign);
router.post('/:id/recalculate', recalculateCounts);

// Excel upload
router.post('/:id/upload', upload.single('file'), uploadExcel);

// Recipient routes
router.get('/:campaignId/recipients', getCampaignRecipients);
router.post('/:campaignId/recipients', addRecipient);
router.put('/:campaignId/recipients/:recipientId', updateRecipient);
router.delete('/:campaignId/recipients/:recipientId', deleteRecipient);
router.post('/:campaignId/recipients/:recipientId/trigger', triggerEmailNow);

export default router;
