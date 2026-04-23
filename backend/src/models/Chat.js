const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    customizationDetails: {
      type: String,
      default: "",
    },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    hasUnreadAdmin: {
      type: Boolean,
      default: true, // admin has unread messages by default when user starts chat
    },
    hasUnreadUser: {
      type: Boolean,
      default: false,
    },

    // ── Custom Order Confirmation ─────────────────────────────────────────
    // Set by admin when they agree to fulfill the customization request.
    confirmedPrice: {
      type: Number,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    // Linked after the user pays — references the Order document
    linkedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chat", chatSchema);
