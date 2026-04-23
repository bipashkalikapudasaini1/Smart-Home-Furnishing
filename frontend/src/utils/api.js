import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  // No default Content-Type here — we set it per-request in the interceptor
  // so FormData uploads get the correct multipart/form-data boundary
});

// Add token + correct Content-Type to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // For FormData (file uploads): let the browser set Content-Type automatically
    // so it includes the required multipart boundary string.
    // For everything else: use JSON.
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (data) => api.post("/auth/reset-password", data),
};

// Product API
export const productAPI = {
  getAll: (params) => api.get("/products", { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getFilterOptions: () => api.get("/products/filters/options"),
};

// Cart API
export const cartAPI = {
  get: () => api.get("/cart"),
  add: (data) => api.post("/cart/add", data),
  update: (cartItemId, quantity) =>
    api.put("/cart/update", { cartItemId, quantity }),
  remove: (cartItemId) => api.delete(`/cart/remove/${cartItemId}`),
  clear: () => api.delete("/cart/clear"),
};

// Chat API (User)
export const chatAPI = {
  // Start or get existing chat for a product
  startOrGet: (data) => api.post("/chat/start", data),
  // Poll for latest messages — _t busts the browser cache so 304s don't hide new data
  getChat: (chatId) => api.get(`/chat/${chatId}?_t=${Date.now()}`),
  // Send a message
  sendMessage: (chatId, text) =>
    api.post(`/chat/${chatId}/message`, { text }),
};

// Chat API (Admin)
export const adminChatAPI = {
  // Get all chats — cache-busted so unread badges and new chats appear instantly
  getAll: () => api.get(`/chat/admin/all?_t=${Date.now()}`),
  // Get single chat — cache-busted so new messages appear without delay
  getChat: (chatId) => api.get(`/chat/admin/${chatId}?_t=${Date.now()}`),
  // Admin replies
  reply: (chatId, text) =>
    api.post(`/chat/admin/${chatId}/reply`, { text }),
  // Close a chat
  close: (chatId) => api.put(`/chat/admin/${chatId}/close`),
  // Delete a message
  deleteMessage: (chatId, messageId) =>
    api.delete(`/chat/admin/${chatId}/messages/${messageId}`),
  // Delete entire chat
  deleteChat: (chatId) => api.delete(`/chat/admin/delete/${chatId}`),
  // Confirm custom order — set agreed price and notify user
  confirmOrder: (chatId, data) => api.post(`/chat/admin/${chatId}/confirm-order`, data),
};

// Order API (User)
export const orderAPI = {
  create:      (data) => api.post('/orders', data),
  verify:      (data) => api.post('/orders/verify', data),
  getMyOrders: ()     => api.get('/orders/my'),
  getById:     (id)   => api.get(`/orders/${id}`)
};

// Order & User API (Admin)
export const adminOrderAPI = {
  getAll:          (params) => api.get('/orders/admin/all', { params }),
  updateDelivery:  (id, data) => api.put(`/orders/admin/${id}/delivery`, data),
  getTransactions: (params) => api.get('/orders/admin/transactions', { params }),
  getAllUsers:      (params) => api.get('/orders/admin/users', { params }),
  getUserDetails:  (userId) => api.get(`/orders/admin/users/${userId}`)
};

// Recommendation API
export const recommendationAPI = {
  getTrending:        (limit = 8)   => api.get(`/recommendations/trending?limit=${limit}`),
  getMostSearched:    (limit = 8)   => api.get(`/recommendations/most-searched?limit=${limit}`),
  getMostBought:      (limit = 8)   => api.get(`/recommendations/most-bought?limit=${limit}`),
  getAutocomplete:    (q)           => api.get(`/recommendations/autocomplete?q=${encodeURIComponent(q)}`),
  getForYou:          (limit = 12)  => api.get(`/recommendations/for-you?limit=${limit}`),
  // Item-Item AI similarity: content cosine sim + co-purchase frequency
  getSimilarProducts: (productId, limit = 8) =>
    api.get(`/recommendations/similar/${productId}?limit=${limit}`),
  logView:     (productId) => api.post('/recommendations/log-view',     { productId }).catch(() => {}),
  logCartAdd:  (productId) => api.post('/recommendations/log-cart-add', { productId }).catch(() => {}),
};

export default api;
