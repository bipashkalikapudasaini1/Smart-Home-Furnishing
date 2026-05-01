import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminChatAPI } from "../utils/api";
import "./AdminChats.css";

// Resolve relative upload paths to full backend URLs
const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
  return `${base}${path}`;
};

const AdminChats = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "open" | "closed"
  const chatWindowMessagesRef = useRef(null);
  const prevAdminMsgCountRef = useRef(0);
  const pollChatsRef = useRef(null);
  const pollMsgsRef = useRef(null);

  // ── Confirm Custom Order modal state ──────────────────────────────────────
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPrice,     setConfirmPrice]     = useState("");
  const [confirmNote,      setConfirmNote]      = useState("");
  const [confirming,       setConfirming]       = useState(false);
  const [confirmError,     setConfirmError]     = useState("");

  // Redirect if not admin
  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) {
      navigate("/");
    }
  }, [isAdmin, authLoading, navigate]);

  // Scroll INSIDE the messages box only when new messages arrive — never scroll the page
  useEffect(() => {
    const newCount = selectedChat?.messages?.length || 0;
    if (newCount > prevAdminMsgCountRef.current && chatWindowMessagesRef.current) {
      chatWindowMessagesRef.current.scrollTop = chatWindowMessagesRef.current.scrollHeight;
    }
    prevAdminMsgCountRef.current = newCount;
  }, [selectedChat?.messages]);

  // ── Fetch all chats ──────────────────────────────────────────────────────
  const fetchAllChats = useCallback(async () => {
    try {
      const res = await adminChatAPI.getAll();
      setChats(res.data.data || []);
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchAllChats();
    // Poll chat list every 5 seconds for new chats
    pollChatsRef.current = setInterval(fetchAllChats, 5000);
    return () => clearInterval(pollChatsRef.current);
  }, [fetchAllChats]);

  // ── Poll selected chat for new messages ─────────────────────────────────
  const fetchSelectedChat = useCallback(async (chatId) => {
    try {
      const res = await adminChatAPI.getChat(chatId);
      const updatedChat = res.data.data;
      setSelectedChat(updatedChat);
      // Update in list too
      setChats((prev) =>
        prev.map((c) => (c._id === chatId ? updatedChat : c))
      );
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    clearInterval(pollMsgsRef.current);
    if (selectedChat?._id) {
      pollMsgsRef.current = setInterval(
        () => fetchSelectedChat(selectedChat._id),
        3000
      );
    }
    return () => clearInterval(pollMsgsRef.current);
  }, [selectedChat?._id, fetchSelectedChat]);

  // ── Select a chat ────────────────────────────────────────────────────────
  const handleSelectChat = async (chat) => {
    setLoadingMessages(true);
    setReplyText("");
    try {
      const res = await adminChatAPI.getChat(chat._id);
      setSelectedChat(res.data.data);
      // Mark as read in list
      setChats((prev) =>
        prev.map((c) =>
          c._id === chat._id ? { ...c, hasUnreadAdmin: false } : c
        )
      );
    } catch (err) {
      setError("Failed to load chat.");
    } finally {
      setLoadingMessages(false);
    }
  };

  // ── Confirm Custom Order ─────────────────────────────────────────────────
  const openConfirmModal = () => {
    setConfirmPrice("");
    setConfirmNote("");
    setConfirmError("");
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    const price = parseFloat(confirmPrice);
    if (!confirmPrice || isNaN(price) || price <= 0) {
      setConfirmError("Please enter a valid agreed price.");
      return;
    }
    setConfirming(true);
    setConfirmError("");
    try {
      const res = await adminChatAPI.confirmOrder(selectedChat._id, {
        agreedPrice: price,
        adminNote:   confirmNote.trim(),
      });
      const updated = res.data.data;
      setSelectedChat(updated);
      setChats((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setShowConfirmModal(false);
    } catch (err) {
      setConfirmError(err.response?.data?.message || "Failed to confirm order. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  // ── Delete entire chat ───────────────────────────────────────────────────
  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation(); // don't open the chat when clicking delete
    if (!window.confirm("Permanently delete this chat? This cannot be undone.")) return;
    try {
      console.log("Deleting chat, ID:", chatId, "URL will be: /chat/admin/" + chatId);
      await adminChatAPI.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (selectedChat?._id === chatId) setSelectedChat(null);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      setError(`Failed to delete chat (${status}): ${msg}`);
    }
  };

  // ── Send admin reply ─────────────────────────────────────────────────────
  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText("");
    try {
      const res = await adminChatAPI.reply(selectedChat._id, text);
      setSelectedChat(res.data.data);
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedChat._id ? res.data.data : c
        )
      );
    } catch (err) {
      setError("Failed to send reply. Please try again.");
      setReplyText(text);
    } finally {
      setSending(false);
    }
  };

  // ── Delete message ───────────────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    if (!selectedChat) return;
    if (!window.confirm("Delete this message?")) return;
    try {
      const res = await adminChatAPI.deleteMessage(selectedChat._id, messageId);
      setSelectedChat(res.data.data);
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedChat._id ? res.data.data : c
        )
      );
    } catch (err) {
      setError("Failed to delete message.");
    }
  };

  // ── Close chat ───────────────────────────────────────────────────────────
  const handleClose = async () => {
    if (!selectedChat) return;
    if (!window.confirm("Are you sure you want to close this chat?")) return;
    try {
      const res = await adminChatAPI.close(selectedChat._id);
      setSelectedChat(res.data.data);
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedChat._id ? res.data.data : c
        )
      );
    } catch (err) {
      setError("Failed to close chat.");
    }
  };

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatRelative = (timestamp) => {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return d.toLocaleDateString();
  };

  const filteredChats = chats.filter((c) => {
    if (filter === "open") return c.status === "open";
    if (filter === "closed") return c.status === "closed";
    return true;
  });

  const openCount = chats.filter((c) => c.status === "open").length;
  const unreadCount = chats.filter((c) => c.hasUnreadAdmin).length;

  return (
    <div className="admin-chats-page">
      {/* Page Header */}
      <div className="admin-chats-topbar">
        <div className="admin-chats-topbar-left">
          <Link to="/admin/orders" className="admin-back-link">
            ← Orders
          </Link>
          <h1>Live Chat Management</h1>
        </div>
        <div className="admin-chats-stats">
          <span className="stat-badge stat-open">{openCount} Open</span>
          {unreadCount > 0 && (
            <span className="stat-badge stat-unread">{unreadCount} Unread</span>
          )}
        </div>
      </div>

      {error && (
        <div className="admin-error-bar">
          {error}
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      <div className="admin-chats-layout">
        {/* ── Left: Chat List ─────────────────────────────────────────────── */}
        <div className="admin-chat-list-panel">
          {/* Filter tabs */}
          <div className="chat-filter-tabs">
            {["all", "open", "closed"].map((f) => (
              <button
                key={f}
                className={"filter-tab" + (filter === f ? " active" : "")}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loadingChats ? (
            <div className="chat-list-loading">Loading chats...</div>
          ) : filteredChats.length === 0 ? (
            <div className="chat-list-empty">
              <div className="empty-icon">💬</div>
              <p>No {filter !== "all" ? filter : ""} chats yet.</p>
            </div>
          ) : (
            <div className="chat-list">
              {filteredChats.map((chat) => {
                const lastMsg =
                  chat.messages && chat.messages.length > 0
                    ? chat.messages[chat.messages.length - 1]
                    : null;
                const isSelected = selectedChat?._id === chat._id;

                return (
                  <div
                    key={chat._id}
                    className={
                      "chat-list-item" +
                      (isSelected ? " selected" : "") +
                      (chat.hasUnreadAdmin ? " unread" : "")
                    }
                    onClick={() => handleSelectChat(chat)}
                  >
                    <div className="chat-list-item-header">
                      <div className="chat-user-avatar">
                        {chat.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="chat-list-item-info">
                        <div className="chat-item-name-row">
                          <span className="chat-user-name">{chat.userName}</span>
                          {chat.hasUnreadAdmin && (
                            <span className="unread-dot" title="New message" />
                          )}
                        </div>
                        <span className="chat-product-name">
                          {chat.productName}
                        </span>
                      </div>
                      <div className="chat-item-meta">
                        <span
                          className={
                            "chat-status-tag " +
                            (chat.status === "open" ? "tag-open" : "tag-closed")
                          }
                        >
                          {chat.status}
                        </span>
                        {lastMsg && (
                          <span className="chat-time">
                            {formatRelative(lastMsg.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="chat-delete-btn"
                      title="Delete chat"
                      onClick={(e) => handleDeleteChat(e, chat._id)}
                    >
                      🗑
                    </button>
                    {lastMsg && (
                      <p className="chat-last-message">
                        {lastMsg.sender === "admin" ? "You: " : ""}
                        {lastMsg.text.length > 60
                          ? lastMsg.text.substring(0, 60) + "..."
                          : lastMsg.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Chat Window ──────────────────────────────────────────── */}
        <div className="admin-chat-window">
          {!selectedChat ? (
            <div className="chat-window-placeholder">
              <div className="placeholder-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a customer chat from the left to view and reply.</p>
            </div>
          ) : (
            <>
              {/* ── Top bar: status + action buttons ── */}
              <div className="chat-window-topbar">
                <div className="chat-topbar-left">
                  <span className={"chat-status-tag " + (selectedChat.status === "open" ? "tag-open" : "tag-closed")}>
                    {selectedChat.status === "open" ? "● Open" : "● Closed"}
                  </span>
                  <span className="chat-topbar-time">
                    Started {formatRelative(selectedChat.createdAt)}
                  </span>
                  {/* Confirmed price badge */}
                  {selectedChat.confirmedPrice && (
                    <span className="confirmed-price-badge">
                      ✅ Confirmed — NPR {Number(selectedChat.confirmedPrice).toLocaleString()}
                    </span>
                  )}
                  {/* Linked order badge */}
                  {selectedChat.linkedOrderId && (
                    <span className="linked-order-badge">
                      📦 Order Placed
                    </span>
                  )}
                </div>
                <div className="chat-topbar-actions">
                  {/* Confirm Custom Order button — only for open customization chats not yet confirmed */}
                  {selectedChat.status === "open" &&
                   selectedChat.customizationDetails &&
                   !selectedChat.confirmedPrice && (
                    <button className="confirm-order-btn" onClick={openConfirmModal}>
                      ✅ Confirm Custom Order
                    </button>
                  )}
                  {selectedChat.status === "open" && (
                    <button className="close-chat-btn" onClick={handleClose}>
                      Close Chat
                    </button>
                  )}
                  {selectedChat.status === "closed" && (
                    <span className="chat-closed-badge">Chat Closed</span>
                  )}
                </div>
              </div>

              {/* ── Customization Request Card ── */}
              <div className="request-card">

                {/* Product column */}
                <div className="request-product-col">
                  <div className="request-product-image">
                    {selectedChat.productId?.images?.[0] ? (
                      <img src={getImageUrl(selectedChat.productId.images[0])} alt={selectedChat.productName} />
                    ) : (
                      <div className="request-no-image">No Image</div>
                    )}
                  </div>
                  <div className="request-product-info">
                    <div className="request-section-label">Product</div>
                    <div className="request-product-name">{selectedChat.productName}</div>
                    {selectedChat.productId?.category && (
                      <div className="request-product-meta">📂 {selectedChat.productId.category}</div>
                    )}
                    {selectedChat.productId?.brand && (
                      <div className="request-product-meta">🏷️ {selectedChat.productId.brand}</div>
                    )}
                    {selectedChat.productId?.price != null && (
                      <div className="request-product-price">
                        NPR {selectedChat.productId.discount > 0
                          ? Math.round(selectedChat.productId.price - (selectedChat.productId.price * selectedChat.productId.discount) / 100)
                          : selectedChat.productId.price}
                        {selectedChat.productId.discount > 0 && (
                          <span className="request-original-price"> NPR {selectedChat.productId.price}</span>
                        )}
                      </div>
                    )}
                    {selectedChat.productId?.description && (
                      <div className="request-product-desc">{selectedChat.productId.description}</div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="request-card-divider" />

                {/* Right column: customer + customization */}
                <div className="request-right-col">

                  {/* Customer info */}
                  <div className="request-section-label">Customer</div>
                  <div className="request-customer-info">
                    <div className="request-customer-avatar">
                      {selectedChat.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="request-customer-details">
                      <div className="request-customer-name">{selectedChat.userName}</div>
                      <div className="request-customer-row">📧 {selectedChat.userEmail}</div>
                      {selectedChat.userId?.phone && (
                        <div className="request-customer-row">📞 {selectedChat.userId.phone}</div>
                      )}
                      {selectedChat.userId?.address && (
                        (() => {
                          const a = selectedChat.userId.address;
                          const parts = [a.street, a.city, a.state, a.zipCode, a.country].filter(Boolean);
                          return parts.length > 0 ? (
                            <div className="request-customer-row">📍 {parts.join(", ")}</div>
                          ) : null;
                        })()
                      )}
                    </div>
                  </div>

                  {/* Customization details */}
                  {selectedChat.customizationDetails && (
                    <>
                      <div className="request-section-label" style={{ marginTop: "14px" }}>Customization Request</div>
                      <pre className="request-customization-pre">{selectedChat.customizationDetails}</pre>
                    </>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="chat-window-messages" ref={chatWindowMessagesRef}>
                {loadingMessages ? (
                  <div className="messages-loading">Loading messages...</div>
                ) : selectedChat.messages && selectedChat.messages.length === 0 ? (
                  <div className="messages-empty">
                    No messages yet. The customer hasn't sent anything.
                  </div>
                ) : (
                  selectedChat.messages?.map((msg, i) => {
                    const isReqMsg =
                      i === 0 &&
                      msg.sender === "user" &&
                      msg.text.startsWith("📋 Customization Request:");

                    // Skip the auto-generated customization request message —
                    // that info is already shown in the card above the chat.
                    if (isReqMsg) return null;

                    return (
                      <div
                        key={msg._id || i}
                        className={
                          "admin-message " +
                          (msg.sender === "admin"
                            ? "admin-message-sent"
                            : "admin-message-received")
                        }
                      >
                        {msg.sender === "user" && (
                          <div className="admin-msg-sender">{msg.senderName}</div>
                        )}
                        <div className="admin-msg-bubble-row">
                          <div className="admin-msg-bubble">
                            <span className="admin-msg-text">{msg.text}</span>
                            <span className="admin-msg-time">
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                          <button
                            className="msg-delete-btn"
                            title="Delete message"
                            onClick={() => handleDeleteMessage(msg._id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {selectedChat.status === "closed" && (
                  <div className="chat-closed-notice">
                    This chat has been closed.
                  </div>
                )}
              </div>

              {/* Reply Input */}
              {selectedChat.status === "open" && (
                <form className="chat-reply-form" onSubmit={handleReply}>
                  <textarea
                    className="chat-reply-input"
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={sending}
                    rows={2}
                    maxLength={500}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="chat-reply-btn"
                    disabled={!replyText.trim() || sending}
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Confirm Custom Order Modal ──────────────────────────────────── */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => !confirming && setShowConfirmModal(false)}>
          <div className="confirm-order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <span className="confirm-modal-icon">✅</span>
              <h3>Confirm Custom Order</h3>
            </div>
            <p className="confirm-modal-sub">
              Set the agreed price for <strong>{selectedChat?.productName}</strong> and notify the customer to pay.
            </p>
            <form onSubmit={handleConfirmOrder}>
              <div className="confirm-modal-field">
                <label>Agreed Price (NPR) <span className="req">*</span></label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 4800"
                  value={confirmPrice}
                  onChange={(e) => setConfirmPrice(e.target.value)}
                  disabled={confirming}
                  autoFocus
                />
                <span className="confirm-modal-hint">
                  Delivery charge (NPR 180) will be added automatically at checkout.
                </span>
              </div>
              <div className="confirm-modal-field">
                <label>Additional Note (optional)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Ready in 7 working days, stitching colour as discussed…"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  disabled={confirming}
                />
              </div>
              {confirmError && (
                <p className="confirm-modal-error">{confirmError}</p>
              )}
              <div className="confirm-modal-actions">
                <button type="submit" className="btn-confirm-submit" disabled={confirming}>
                  {confirming ? "Confirming…" : "✅ Confirm & Notify Customer"}
                </button>
                <button
                  type="button"
                  className="btn-confirm-cancel"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={confirming}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminChats;
