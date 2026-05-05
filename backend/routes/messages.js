import express from 'express';
import auth from '../middleware/auth.js';
import {
  getConversations, getUnreadCount, getMessages,
  sendMessage, blockUser, unblockUser,
} from '../controllers/messageController.js';

const router = express.Router();

router.get('/conversations',         auth, getConversations);
router.get('/unread-count',          auth, getUnreadCount);
router.get('/conversation/:userId',  auth, getMessages);
router.post('/send',                 auth, sendMessage);
router.post('/block/:userId',        auth, blockUser);
router.delete('/block/:userId',      auth, unblockUser);

export default router;
