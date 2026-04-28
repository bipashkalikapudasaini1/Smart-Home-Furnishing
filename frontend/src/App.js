import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FestivalProvider } from "./context/FestivalContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import AdminChats from "./pages/AdminChats";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import OrderHistory from "./pages/OrderHistory";
import AdminOrders from "./pages/AdminOrders";
import AdminUsers from "./pages/AdminUsers";
import AdminRewards from "./pages/AdminRewards";
import RewardStore from "./pages/RewardStore";
import FestivalSale from "./pages/FestivalSale";
import AdminFestival from "./pages/AdminFestival";
import FestivalBanner from "./components/FestivalBanner";

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <FestivalProvider>
        <div className="App">
          <Navbar />
          <FestivalBanner />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/chats" element={<AdminChats />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/failed" element={<PaymentFailed />} />
            <Route path="/orders" element={<OrderHistory />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/rewards" element={<AdminRewards />} />
            <Route path="/rewards" element={<RewardStore />} />
            <Route path="/festival-sale/:id" element={<FestivalSale />} />
            <Route path="/admin/festival" element={<AdminFestival />} />
          </Routes>
        </div>
        </FestivalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
