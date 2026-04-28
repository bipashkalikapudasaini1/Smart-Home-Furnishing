import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { productAPI, recommendationAPI } from "../utils/api";
import { Package, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFestival } from "../context/FestivalContext";
import LiveChat from "../components/LiveChat";
import SimilarProducts from "../components/SimilarProducts";
import "./ProductDetail.css";

const ProductDetail = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user, isAdmin } = useAuth();
  const { getFestivalDiscount } = useFestival();

  const [product,  setProduct]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [quantity, setQuantity] = useState(1);

  // ── Customization form state ──────────────────────────────────────────────
  const [showCustomize,   setShowCustomize]   = useState(false);
  const [selectedSize,    setSelectedSize]    = useState("");
  const [selectedColour,  setSelectedColour]  = useState("");
  const [selectedFabric,  setSelectedFabric]  = useState("");
  const [customWidth,     setCustomWidth]     = useState("");
  const [customHeight,    setCustomHeight]    = useState("");
  const [selectedUnit,    setSelectedUnit]    = useState("Inch");
  const [notes,           setNotes]           = useState("");

  // ── Chat trigger state ────────────────────────────────────────────────────
  const [chatDetails,      setChatDetails]      = useState("");
  const [triggerChatStart, setTriggerChatStart] = useState(false);
  const [requestKey,       setRequestKey]       = useState(0);
  const [requestSent,      setRequestSent]      = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await productAPI.getOne(id);
        setProduct(res.data.data);
        setError("");
        // Fire-and-forget: track product view for recommendation engine
        recommendationAPI.logView(id);
      } catch (err) {
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="product-detail-loading">Loading...</div>;
  if (error)   return <div className="product-detail-error">{error}</div>;
  if (!product) return null;

  // Apply festival discount if this product is in the active festival, else use product's own discount
  const festDiscount    = getFestivalDiscount(product._id);
  const isFestival      = festDiscount > 0;
  const appliedDiscount = isFestival ? festDiscount : (product.discount || 0);
  const finalPrice      = appliedDiscount
    ? Math.round(product.price - (product.price * appliedDiscount) / 100)
    : product.price;

  const decrement = () => quantity > 1 && setQuantity(q => q - 1);
  const increment = () => setQuantity(q => q + 1);

  const handleAddToCart = async () => {
    if (!user) { navigate("/login"); return; }
    try {
      await api.post("/cart/add", { productId: product._id, quantity, selectedColor: "", selectedSize: "", selectedFabric: "" });
      // Track cart-add for recommendation engine (non-blocking)
      recommendationAPI.logCartAdd(product._id);
      navigate("/cart");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add to cart");
    }
  };

  const handleBuyNow = () => {
    if (!user) { navigate("/login"); return; }
    navigate("/checkout", {
      state: {
        buyNow: { productId: product._id, name: product.name, price: finalPrice, quantity, image: product.images?.[0] || "" }
      }
    });
  };

  // ── Smart size detection (same logic as Customize.js) ────────────────────
  const cat         = (product.category || "").toLowerCase().trim();
  const productName = (product.name     || "").toLowerCase().trim();

  let isDimensionProduct = false;
  let isBedProduct       = false;

  if (["carpet", "curtain", "curtains", "pillow cover", "rug", "rugs"].some(k => productName.includes(k) || cat.includes(k))) {
    isDimensionProduct = true;
  } else if (["bed sheet", "bed sheets", "blanket", "quilt", "doona", "pillow", "bedding"].some(k => productName.includes(k) || cat.includes(k))) {
    isBedProduct = true;
  }

  const bedSizeOptions = ["Single Bed", "Double Bed", "King Size"];
  const unitOptions    = ["Inch", "Meter"];
  const colours = product.availableColours?.length > 0 ? product.availableColours : ["Red", "Blue", "Green", "Black", "White"];
  const fabrics = product.availableFabrics?.length > 0 ? product.availableFabrics : ["Cotton", "Polyester", "Silk", "Wool", "Linen"];

  // ── Send customization request through live chat ──────────────────────────
  const sendRequest = () => {
    if (!user) { navigate("/login"); return; }

    let sizeText = "";
    if (isBedProduct) {
      sizeText = selectedSize || "Not selected";
    } else if (isDimensionProduct) {
      if (!customWidth) { alert("Please enter at least the width."); return; }
      sizeText = "Width: " + customWidth + " " + selectedUnit;
      if (customHeight) sizeText += ", Height: " + customHeight + " " + selectedUnit;
    } else {
      sizeText = "Standard / Not specified";
    }

    const details =
      "Product: " + product.name + "\n" +
      "Category: " + product.category + "\n" +
      "Size: " + sizeText + "\n" +
      "Colour: " + (selectedColour || "Not selected") + "\n" +
      "Fabric: " + (selectedFabric || "Not selected") + "\n" +
      "Notes: " + (notes || "None");

    setChatDetails(details);
    setRequestKey(prev => prev + 1);
    setTriggerChatStart(false);
    setRequestSent(false);

    setTimeout(() => {
      setTriggerChatStart(true);
      setRequestSent(true);
      if (chatRef.current) {
        chatRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  return (
    <div className="product-detail-container">

      {/* ── Product card ──────────────────────────────────────────── */}
      <div className="product-detail-card">

        {/* Image */}
        <div className="product-detail-image">
          {product.images?.length > 0
            ? <img src={product.images[0]} alt={product.name} />
            : <div className="product-image-placeholder"><Package size={64} /></div>
          }
        </div>

        {/* Info */}
        <div className="product-detail-info">
          <h1 className="product-title">{product.name}</h1>
          <p className="product-category">{product.category}</p>
          <p className="product-brand">{product.brand}</p>

          <div className="product-price">
            {appliedDiscount > 0 && (
              <span className="original-price">NPR {product.price?.toLocaleString()}</span>
            )}
            {isFestival && (
              <span className="festival-discount-tag">🎉 {appliedDiscount}% Festival OFF</span>
            )}
            <span className="final-price">NPR {finalPrice?.toLocaleString()}</span>
          </div>

          <p className="product-description">{product.description}</p>

          {/* Quantity + Buy buttons */}
          {!isAdmin() && (
            <div className="product-actions">
              <div className="quantity-selector">
                <button className="quantity-btn" onClick={decrement}>–</button>
                <span className="quantity-display">{quantity}</span>
                <button className="quantity-btn" onClick={increment}>+</button>
              </div>
              <div className="action-buttons">
                <button className="btn btn-secondary" onClick={handleAddToCart}>Add to Cart</button>
                <button className="btn btn-primary btn-buy-now" onClick={handleBuyNow}>⚡ Buy Now</button>
              </div>
            </div>
          )}

          {/* Customize toggle button */}
          {product.isCustomizable && !isAdmin() && (
            <button
              className="btn-customize-toggle"
              onClick={() => setShowCustomize(prev => !prev)}
            >
              <Pencil size={17} />
              {showCustomize ? "Hide Customization" : "Customize This Product"}
              {showCustomize ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Similar Products — AI Item-Item Similarity ────────────── */}
      <SimilarProducts productId={product._id} />

      {/* ── Inline Customization + Live Chat Section ──────────────── */}
      {product.isCustomizable && !isAdmin() && showCustomize && (
        <div className="product-customize-inline">

          <div className="pci-header">
            <h2>Send a Customization Request</h2>
            <p>Fill in your requirements below and send them directly to our team via live chat. You'll see the message — with your product image and details — confirmed in the chat instantly.</p>
          </div>

          <div className="pci-body">

            {/* ── Left: Form ── */}
            <div className="pci-form">

              {/* Size */}
              {(isBedProduct || isDimensionProduct) && (
                <div className="pci-field">
                  <label>Size</label>
                  {isBedProduct ? (
                    <select value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
                      <option value="">-- Select Size --</option>
                      {bedSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div className="pci-dimension-row">
                      <div className="pci-dim-field">
                        <label>Width</label>
                        <input type="number" min="1" step="0.5" placeholder="e.g. 60"
                          value={customWidth} onChange={e => setCustomWidth(e.target.value)} />
                      </div>
                      <select className="pci-unit-select" value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <div className="pci-dim-field">
                        <label>Height (optional)</label>
                        <input type="number" min="1" step="0.5" placeholder="e.g. 90"
                          value={customHeight} onChange={e => setCustomHeight(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Colour */}
              <div className="pci-field">
                <label>Colour</label>
                <select value={selectedColour} onChange={e => setSelectedColour(e.target.value)}>
                  <option value="">-- Select Colour --</option>
                  {colours.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Fabric */}
              <div className="pci-field">
                <label>Fabric</label>
                <select value={selectedFabric} onChange={e => setSelectedFabric(e.target.value)}>
                  <option value="">-- Select Fabric --</option>
                  {fabrics.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div className="pci-field">
                <label>Special Notes</label>
                <textarea
                  rows={4}
                  placeholder="Any special design, pattern, border, or other requirement?"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button className="pci-send-btn" onClick={sendRequest}>
                📤 Send Request via Live Chat
              </button>

              {requestSent && (
                <p className="pci-sent-hint">✅ Your request has been sent to the chat below!</p>
              )}
            </div>

            {/* ── Right: Live Chat ── */}
            <div className="pci-chat" ref={chatRef}>
              <div className="pci-chat-label">
                <span>💬 Live Chat — your request appears here as a message</span>
              </div>
              <LiveChat
                key={requestKey}
                product={product}
                customizationDetails={chatDetails}
                autoStart={triggerChatStart}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
