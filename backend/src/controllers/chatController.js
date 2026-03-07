const Chat = require("../models/Chat");
const User = require("../models/User");

// ─── USER: Start or get existing chat for a product ──────────────────────────
exports.startOrGetChat = async (req, res) => {
  try {
    const { productId, productName, customizationDetails } = req.body;
    const userId = req.user.id;

    // Check if a chat already exists for this user + product
    let chat = await Chat.findOne({ userId, productId, status: "open" });

    if (!chat) {
      // Create a new chat
      const user = await User.findById(userId);
      chat = await Chat.create({
        userId,
        productId,
        userName: user.name,
        userEmail: user.email,
        productName,
        customizationDetails: customizationDetails || "",
        messages: [],
      });
    }

    res.status(200).json({ success: true, data: chat });
  } catch (err) {
    console.error("startOrGetChat error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── USER: Send a message ─────────────────────────────────────────────────────
exports.sendUserMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (chat.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const newMessage = {
      sender: "user",
      senderName: chat.userName,
      text,
      timestamp: new Date(),
    };

    chat.messages.push(newMessage);
    chat.hasUnreadAdmin = true; // admin has unread
    await chat.save();

    res.status(200).json({ success: true, data: chat });
  } catch (err) {
    console.error("sendUserMessage error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── USER: Get chat messages (polling) ───────────────────────────────────────
exports.getUserChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (chat.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Mark user's unread as read when they fetch
    if (chat.hasUnreadUser) {
      chat.hasUnreadUser = false;
      await chat.save();
    }

    res.status(200).json({ success: true, data: chat });
  } catch (err) {
    console.error("getUserChat error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN: Get all chats ────────────────────────────────────────────────────
exports.getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find({})
      .sort({ updatedAt: -1 })
      .select("-__v")
      .populate("productId", "name images price category brand description discount")
      .populate("userId", "name email phone address");

    res.status(200).json({ success: true, data: chats });
  } catch (err) {
    console.error("getAllChats error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN: Get a single chat ─────────────────────────────────────────────────
exports.getAdminChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate("productId", "name images price category brand description discount")
      .populate("userId", "name email phone address");

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // Mark admin's unread as read when admin fetches
    if (chat.hasUnreadAdmin) {
      chat.hasUnreadAdmin = false;
      await chat.save();
    }

    res.status(200).json({ success: true, data: chat });
  } catch (err) {
    console.error("getAdminChat error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN: Reply to a chat ───────────────────────────────────────────────────
exports.sendAdminMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const newMessage = {
      sender: "admin",
      senderName: "Admin",
      text,
      timestamp: new Date(),
    };

    chat.messages.push(newMessage);
    chat.hasUnreadUser = true;
    await chat.save();

    // Return populated chat so admin panel stays fully updated
    const populated = await Chat.findById(chatId)
      .populate("productId", "name images price category brand description discount")
      .populate("userId", "name email phone address");

    res.status(200).json({ success: true, data: populated });
  } catch (err) {
    console.error("sendAdminMessage error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN: Delete a message ─────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const msgIndex = chat.messages.findIndex(
      (m) => m._id.toString() === messageId
    );
    if (msgIndex === -1) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    chat.messages.splice(msgIndex, 1);
    await chat.save();

    const populated = await Chat.findById(chatId)
      .populate("productId", "name images price category brand description discount")
      .populate("userId", "name email phone address");

    res.status(200).json({ success: true, data: populated });
  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN: Delete entire chat ───────────────────────────────────────────────
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    console.log("deleteChat hit — chatId:", chatId);
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    await chat.deleteOne();
    res.status(200).json({ success: true, message: "Chat deleted successfully" });
  } catch (err) {
    console.error("deleteChat error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN: Close a chat ──────────────────────────────────────────────────────
exports.closeChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    await Chat.findByIdAndUpdate(chatId, { status: "closed" });

    const chat = await Chat.findById(chatId)
      .populate("productId", "name images price category brand description discount")
      .populate("userId", "name email phone address");

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    res.status(200).json({ success: true, data: chat });
  } catch (err) {
    console.error("closeChat error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
