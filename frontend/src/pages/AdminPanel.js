import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { productAPI } from "../utils/api";
import { Plus, Edit, Trash2, X, MessageSquare, Upload, Sparkles } from "lucide-react";
import "./AdminPanel.css";

// Build a displayable URL for stored image paths like /uploads/products/...
const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base =
    (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(
      /\/api$/,
      ""
    );
  return `${base}${path}`;
};

const MAX_IMAGES = 5;

const AdminPanel = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── Products state ────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Text / select fields
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "Sofa",
    brand: "",
    material: "Wood",
    stock: "",
    availableColors: "",
    availableFabrics: "",
    availableSizes: "",
    isCustomizable: false,
    discount: 0,
  });

  // Image state
  const [existingImages, setExistingImages] = useState([]); // URLs already in DB
  const [imageFiles, setImageFiles] = useState([]);          // new File objects
  const [imagePreviews, setImagePreviews] = useState([]);    // object URLs for preview

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) {
      navigate("/");
      return;
    }
    fetchProducts();
  }, [isAdmin, authLoading, navigate]);

  // Cleanup object URLs when component unmounts or modal closes
  const revokeAllPreviews = useCallback(() => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [imagePreviews]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setFetchError("");
      const response = await productAPI.getAll({});
      setProducts(response.data.data);
    } catch (err) {
      setFetchError(err.response?.data?.message || "Failed to load products. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // ── Image handling ────────────────────────────────────────────────────────
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const totalAfter = existingImages.length + imageFiles.length + files.length;
    if (totalAfter > MAX_IMAGES) {
      alert(`You can upload a maximum of ${MAX_IMAGES} images in total.`);
      e.target.value = "";
      return;
    }
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = ""; // reset so the same file can be re-selected
  };

  const removeNewImage = (idx) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExistingImage = (idx) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("description", formData.description);
    fd.append("price", formData.price);
    fd.append("category", formData.category);
    fd.append("brand", formData.brand);
    fd.append("material", formData.material);
    fd.append("stock", formData.stock);
    fd.append("discount", formData.discount);
    fd.append("isCustomizable", formData.isCustomizable);
    fd.append("availableColors", formData.availableColors);
    fd.append("availableFabrics", formData.availableFabrics);
    fd.append("availableSizes", formData.availableSizes);

    // When editing, tell the server which existing images to keep
    existingImages.forEach((url) => fd.append("existingImages", url));

    // Attach newly chosen files
    imageFiles.forEach((file) => fd.append("images", file));

    try {
      if (editingProduct) {
        await productAPI.update(editingProduct._id, fd);
      } else {
        await productAPI.create(fd);
      }
      revokeAllPreviews();
      await fetchProducts();
      resetForm();
      setShowModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save product");
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      brand: product.brand || "",
      material: product.material,
      stock: product.stock,
      availableColors: product.availableColors?.join(", ") || "",
      availableFabrics: product.availableFabrics?.join(", ") || "",
      availableSizes: product.availableSizes?.join(", ") || "",
      isCustomizable: product.isCustomizable || false,
      discount: product.discount || 0,
    });
    setExistingImages(product.images || []);
    setImageFiles([]);
    setImagePreviews([]);
    setShowModal(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await productAPI.delete(id);
        await fetchProducts();
      } catch (err) {
        alert(err.response?.data?.message || "Failed to delete product");
      }
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "Sofa",
      brand: "",
      material: "Wood",
      stock: "",
      availableColors: "",
      availableFabrics: "",
      availableSizes: "",
      isCustomizable: false,
      discount: 0,
    });
    revokeAllPreviews();
    setExistingImages([]);
    setImageFiles([]);
    setImagePreviews([]);
    setEditingProduct(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    revokeAllPreviews();
    setShowModal(false);
  };

  if (!isAdmin()) {
    return null;
  }

  const totalImages = existingImages.length + imageFiles.length;

  return (
    <div className="admin-container">
      <div className="container">
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <div className="admin-header-actions">
            <Link to="/admin/chats" className="btn btn-chat">
              <MessageSquare size={20} />
              Manage Live Chats
            </Link>
            <Link to="/admin/festival" className="btn btn-festival">
              <Sparkles size={20} />
             Add Festival Products
            </Link>
            <button onClick={openAddModal} className="btn btn-primary">
              <Plus size={20} />
              Add New Product
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="alert alert-error" style={{ margin: '16px 0' }}>
            {fetchError}
            <button style={{ marginLeft: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }} onClick={fetchProducts}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading products...</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Price (NPR)</th>
                  <th>Stock</th>
                  <th>Customizable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="table-image">
                        {product.images[0] ? (
                          <img
                            src={getImageUrl(product.images[0])}
                            alt={product.name}
                          />
                        ) : (
                          <div className="image-placeholder">No Image</div>
                        )}
                      </div>
                    </td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.brand}</td>
                    <td>{product.price}</td>
                    <td>{product.stock}</td>
                    <td>
                      <span
                        className={`badge ${
                          product.isCustomizable ? "badge-yes" : "badge-no"
                        }`}
                      >
                        {product.isCustomizable ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEdit(product)}
                          className="btn-icon btn-edit"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="btn-icon btn-delete"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <div className="no-products">
                <p>No products found. Add your first product to get started!</p>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingProduct ? "Edit Product" : "Add New Product"}</h2>
                <button onClick={closeModal} className="modal-close">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="product-form">

                {/* Name & Brand */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Brand (Optional)</label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="form-control"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="form-control"
                    rows="3"
                    required
                  ></textarea>
                </div>

                {/* Category & Material */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={(e) => {
                        handleInputChange(e);
                        if (e.target.value === "Decor") {
                          setFormData((prev) => ({
                            ...prev,
                            isCustomizable: true,
                          }));
                        }
                      }}
                      className="form-control"
                      required
                    >
                      <option value="Sofa">Sofa</option>
                      <option value="Chair">Chair</option>
                      <option value="Table">Table</option>
                      <option value="Bed">Bed</option>
                      <option value="Cabinet">Cabinet</option>
                      <option value="Desk">Desk</option>
                      <option value="Wardrobe">Wardrobe</option>
                      <option value="Shelf">Shelf</option>
                      <option value="Dining Set">Dining Set</option>
                      <option value="Decor">Decor</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>
                      {formData.category === "Decor" ? "Main Fabric" : "Material"}
                    </label>
                    <input
                      type="text"
                      name="material"
                      value={formData.material}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder={
                        formData.category === "Decor"
                          ? "e.g., Cotton, Silk, Fatteel"
                          : "e.g., Wood, Metal, Bamboo, Teak"
                      }
                      required
                    />
                  </div>
                </div>

                {/* Price, Stock, Discount */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Price (NPR)</label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="form-control"
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Stock</label>
                    <input
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={handleInputChange}
                      className="form-control"
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Discount (%)</label>
                    <input
                      type="number"
                      name="discount"
                      value={formData.discount}
                      onChange={handleInputChange}
                      className="form-control"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                {/* ── Image Upload ── */}
                <div className="form-group">
                  <label>
                    Product Images{" "}
                    <span className="image-count-hint">
                      ({totalImages}/{MAX_IMAGES} selected)
                    </span>
                  </label>

                  {/* Existing images (editing) */}
                  {existingImages.length > 0 && (
                    <div className="image-preview-grid">
                      {existingImages.map((url, idx) => (
                        <div key={`existing-${idx}`} className="image-preview-item">
                          <img src={getImageUrl(url)} alt={`saved ${idx + 1}`} />
                          <button
                            type="button"
                            className="image-remove-btn"
                            onClick={() => removeExistingImage(idx)}
                            title="Remove image"
                          >
                            <X size={12} />
                          </button>
                          <span className="image-tag saved">Saved</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New image previews */}
                  {imagePreviews.length > 0 && (
                    <div className="image-preview-grid">
                      {imagePreviews.map((url, idx) => (
                        <div key={`new-${idx}`} className="image-preview-item">
                          <img src={url} alt={`new ${idx + 1}`} />
                          <button
                            type="button"
                            className="image-remove-btn"
                            onClick={() => removeNewImage(idx)}
                            title="Remove image"
                          >
                            <X size={12} />
                          </button>
                          <span className="image-tag new">New</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  {totalImages < MAX_IMAGES && (
                    <label className="image-upload-label">
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        onChange={handleImageChange}
                        style={{ display: "none" }}
                      />
                      <Upload size={16} />
                      <span>
                        {totalImages === 0 ? "Choose Images" : "Add More Images"}
                      </span>
                    </label>
                  )}

                  <small className="form-hint">
                    Upload up to {MAX_IMAGES} images (JPG, PNG, WebP, GIF — max 5 MB each)
                  </small>
                </div>

                {/* Customization Options */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Available Colors (comma-separated)</label>
                    <input
                      type="text"
                      name="availableColors"
                      value={formData.availableColors}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Red, Blue, Green, Black, White"
                    />
                  </div>
                  <div className="form-group">
                    <label>Available Fabrics (comma-separated)</label>
                    <input
                      type="text"
                      name="availableFabrics"
                      value={formData.availableFabrics}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Cotton, Silk, Polyester, Wool"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Available Sizes (comma-separated)</label>
                  <input
                    type="text"
                    name="availableSizes"
                    value={formData.availableSizes}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Single, Double, Queen, King"
                  />
                  <small className="form-hint">e.g., Single, Queen, King</small>
                </div>

                {/* Customizable Checkbox */}
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isCustomizable"
                      checked={formData.isCustomizable}
                      onChange={handleInputChange}
                    />
                    <span>
                      Product is Customizable (allows color, fabric, size, message)
                    </span>
                  </label>
                </div>

                {/* Actions */}
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success">
                    {editingProduct ? "Update Product" : "Add Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
