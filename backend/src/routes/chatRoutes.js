const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  startOrGetChat,
  sendUserMessage,
  getUserChat,
  getAllChats,
  getAdminChat,
  sendAdminMessage,
  closeChat,
  deleteMessage,
  deleteChat,
} = require("../controllers/chatController");

// ── User routes (requires login) ──────────────────────────────────────────────

// POST /api/chat/start  → start or get existing chat for a product
router.post("/start", protect, startOrGetChat);

// GET  /api/chat/:chatId       → get chat messages (polling)
router.get("/:chatId", protect, getUserChat);

// POST /api/chat/:chatId/message  → user sends a message
router.post("/:chatId/message", protect, sendUserMessage);

// ── Admin routes (requires admin role) ───────────────────────────────────────

// GET  /api/chat/admin/all          → get all chats
router.get("/admin/all", protect, adminOnly, getAllChats);

// GET  /api/chat/admin/:chatId      → get single chat (admin view)
router.get("/admin/:chatId", protect, adminOnly, getAdminChat);

// POST /api/chat/admin/:chatId/reply → admin replies
router.post("/admin/:chatId/reply", protect, adminOnly, sendAdminMessage);

// PUT  /api/chat/admin/:chatId/close → admin closes chat
router.put("/admin/:chatId/close", protect, adminOnly, closeChat);

// DELETE /api/chat/admin/:chatId/messages/:messageId → admin deletes a message
router.delete("/admin/:chatId/messages/:messageId", protect, adminOnly, deleteMessage);

// DELETE /api/chat/admin/delete/:chatId → admin deletes entire chat
router.delete("/admin/delete/:chatId", protect, adminOnly, deleteChat);

module.exports = router;
