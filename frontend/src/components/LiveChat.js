import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { chatAPI } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import "./LiveChat.css";

const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
  return `${base}${path}`;
};

const LiveChat = ({ product, customizationDetails, autoStart }) => {
  const { user } = useAuth();
  const navigate   = useNavigate();
  const isLoggedIn = !!user;
  const [chatId, setChatId]           = useState(null);
  const [chatData, setChatData]       = useState(null);   // full chat object (for confirmedPrice etc.)
  const [messages, setMessages]       = useState([]);
  const [inputText, setInputText]     = useState("");
  const [loading, setLoading]         = useState(false);
  const [starting, setStarting]       = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [error, setError]             = useState("");
  const [chatClosed, setChatClosed]   = useState(false);
  const [payingNow, setPayingNow]     = useState(false);
  const chatBodyRef             = useRef(null);
  const prevMessageCountRef     = useRef(0);
  const pollRef                 = useRef(null);
  // Always hold the latest customizationDetails without stale-closure risk
  const detailsRef = useRef(customizationDetails);
  useEffect(() => { detailsRef.current = customizationDetails; }, [customizationDetails]);

  // Scroll INSIDE the chat box only when new messages arrive — never scroll the page
  useEffect(() => {
    const newCount = messages.length;
    if (newCount > prevMessageCountRef.current && chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
    prevMessageCountRef.current = newCount;
  }, [messages]);

  // Poll for new messages every 3 seconds
  const pollMessages = useCallback(async (id) => {
    try {
      const res = await chatAPI.getChat(id);
      const chat = res.data.data;
      setChatData(chat);
      setMessages(chat.messages || []);
      if (chat.status === "closed") {
        setChatClosed(true);
        clearInterval(pollRef.current);
      }
    } catch (err) {
      // silently ignore poll errors
    }
  }, []);

  useEffect(() => {
    if (chatId) {
      pollMessages(chatId);
      pollRef.current = setInterval(() => pollMessages(chatId), 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [chatId, pollMessages]);

  // When the user clicks "Send Request & Start Live Chat", autoStart toggles.
  // We reset all chat state first so a BRAND-NEW chat session is always opened.
  useEffect(() => {
    if (!autoStart || !isLoggedIn || starting) return;

    // Tear down any previous chat session before opening a new one
    clearInterval(pollRef.current);
    setChatId(null);
    setMessages([]);
    setChatStarted(false);
    setChatClosed(false);
    setError("");

    startChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const startChat = async () => {
    if (!isLoggedIn) return;
    setStarting(true);
    setError("");
    try {
      const res = await chatAPI.startOrGet({
        productId:            product._id,
        productName:          product.name,
        customizationDetails: detailsRef.current || "",
      });
      const chat = res.data.data;
      setChatId(chat._id);
      setChatData(chat);
      setChatStarted(true);
      setMessages(chat.messages || []);
      if (chat.status === "closed") setChatClosed(true);
    } catch (err) {
      setError("Could not start chat. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  // ── Pay Now: navigate to checkout with custom order data ─────────────────
  const handlePayNow = () => {
    if (!chatData) return;
    setPayingNow(true);
    navigate("/checkout", {
      state: {
        customOrderData: {
          chatId:             chatData._id,
          productId:          product._id,
          productName:        chatData.productName || product.name,
          confirmedPrice:     chatData.confirmedPrice,
          customizationNote:  chatData.customizationDetails || "",
          image:              product.images?.[0] || "",
        }
      }
    });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !chatId || loading) return;
    setLoading(true);
    const text = inputText.trim();
    setInputText("");
    try {
      const res = await chatAPI.sendMessage(chatId, text);
      setMessages(res.data.data.messages || []);
    } catch (err) {
      setError("Failed to send message. Please try again.");
      setInputText(text);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp) => {
    const d      = new Date(timestamp);
    const today  = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  };

  // A message is a "customization request" if it was auto-sent (first message
  // in the thread, contains the sentinel prefix we add in the backend).
  const isRequestMessage = (msg, index) =>
    index === 0 &&
    msg.sender === "user" &&
    msg.text.startsWith("📋 Customization Request:");

  // Group messages by date
  const groupedMessages = () => {
    const groups = {};
    messages.forEach((msg) => {
      const date = formatDate(msg.timestamp);
      if (!groups[date]) groups[date] = [];
      groups[date].push({ ...msg, _originalIndex: messages.indexOf(msg) });
    });
    return groups;
  };

  if (!isLoggedIn) {
    return (
      <div className="livechat-panel">
        <div className="livechat-header">
          <span className="livechat-icon">💬</span>
          <div>
            <h3>Live Chat Support</h3>
            <span className="livechat-subtitle">Chat with our team</span>
          </div>
        </div>
        <div className="livechat-login-prompt">
          <p>Please log in to use live chat support for your customization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="livechat-panel">
      {/* Header */}
      <div className="livechat-header">
        <span className="livechat-icon">💬</span>
        <div>
          <h3>Live Chat Support</h3>
          <span className="livechat-subtitle">
            {chatClosed
              ? "Chat closed"
              : chatStarted
              ? "● Online"
              : "Ask about your customization"}
          </span>
        </div>
      </div>

      {/* ── Pay Now Banner — shown when admin has confirmed the price ── */}
      {chatStarted && chatData?.confirmedPrice && !chatData?.linkedOrderId && (
        <div className="livechat-paynow-banner">
          <div className="paynow-banner-left">
            <span className="paynow-banner-icon">🎉</span>
            <div>
              <div className="paynow-banner-title">Your custom order is confirmed!</div>
              <div className="paynow-banner-price">
                NPR {Number(chatData.confirmedPrice).toLocaleString()}
                <span className="paynow-banner-note"> + NPR 180 delivery</span>
              </div>
            </div>
          </div>
          <button
            className="paynow-btn"
            onClick={handlePayNow}
            disabled={payingNow}
          >
            {payingNow ? "Redirecting…" : "💳 Pay Now"}
          </button>
        </div>
      )}

      {/* Linked order confirmation banner */}
      {chatStarted && chatData?.linkedOrderId && (
        <div className="livechat-order-placed-banner">
          ✅ Order placed successfully! Track it in{" "}
          <span
            className="order-history-link"
            onClick={() => navigate("/orders")}
          >
            My Orders
          </span>.
        </div>
      )}

      {/* Body */}
      <div className="livechat-body" ref={chatBodyRef}>
        {!chatStarted ? (
          <div className="livechat-start-screen">
            <div className="livechat-welcome-icon">🛋️</div>
            <h4>Need help customizing?</h4>
            <p>
              Chat live with our team about your{" "}
              <strong>{product?.name}</strong> customization. We'll help you
              choose the perfect size, colour, and fabric!
            </p>
            <button
              className="livechat-start-btn"
              onClick={startChat}
              disabled={starting}
            >
              {starting ? "Connecting..." : "Start Live Chat"}
            </button>
            {error && <p className="livechat-error">{error}</p>}
          </div>
        ) : (
          <div className="livechat-messages">
            {messages.length === 0 && (
              <div className="livechat-empty">
                <p>
                  Chat started! Say hello and describe what you need for your
                  <strong> {product?.name}</strong>.
                </p>
              </div>
            )}
            {Object.entries(groupedMessages()).map(([date, msgs]) => (
              <div key={date}>
                <div className="livechat-date-divider">
                  <span>{date}</span>
                </div>
                {msgs.map((msg, i) => {
                  const isReqMsg = isRequestMessage(msg, msg._originalIndex);
                  return (
                    <div
                      key={msg._id || i}
                      className={`livechat-message ${
                        msg.sender === "user" ? "message-user" : "message-admin"
                      }${isReqMsg ? " message-request" : ""}`}
                    >
                      {msg.sender === "admin" && (
                        <div className="message-sender-name">Admin</div>
                      )}
                      <div className={`message-bubble${isReqMsg ? " bubble-request" : ""}`}>
                        {isReqMsg ? (
                          <>
                            <div className="request-bubble-header">
                              <span className="request-bubble-label">
                                ✅ Request Sent
                              </span>
                            </div>
                            {msg.imageUrl && (
                              <img
                                src={getImageUrl(msg.imageUrl)}
                                alt="Product"
                                className="request-bubble-image"
                              />
                            )}
                            <div className="request-bubble-body">
                              {msg.text
                                .replace("📋 Customization Request:\n\n", "")
                                .trim()
                                .split("\n")
                                .map((line, idx) => {
                                  const colonIdx = line.indexOf(":");
                                  if (colonIdx === -1) return <div key={idx}>{line}</div>;
                                  const key = line.substring(0, colonIdx).trim();
                                  const val = line.substring(colonIdx + 1).trim();
                                  return (
                                    <div key={idx} className="request-detail-row">
                                      <span className="request-detail-key">{key}</span>
                                      <span className="request-detail-val">{val}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </>
                        ) : (
                          <span className="message-text">{msg.text}</span>
                        )}
                        <span className="message-time">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {chatClosed && (
              <div className="livechat-closed-notice">
                This chat has been closed by the admin.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      {chatStarted && !chatClosed && (
        <form className="livechat-input-area" onSubmit={sendMessage}>
          <input
            type="text"
            className="livechat-input"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            maxLength={500}
          />
          <button
            type="submit"
            className="livechat-send-btn"
            disabled={!inputText.trim() || loading}
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      )}
      {error && chatStarted && (
        <div className="livechat-error-bar">{error}</div>
      )}
    </div>
  );
};

export default LiveChat;
