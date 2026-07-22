import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Ledger from "@/pages/Ledger";
import VendorDetail from "@/pages/VendorDetail";
import Queue from "@/pages/Queue";
import Monitor from "@/pages/Monitor";
import Directory from "@/pages/Directory";
import Insights from "@/pages/Insights";
import AdminUsers from "@/pages/AdminUsers";
import AuditLog from "@/pages/AuditLog";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="vendors/:id" element={<VendorDetail />} />
        <Route path="queue" element={<Queue />} />
        <Route path="monitor" element={<Monitor />} />
        <Route path="directory" element={<Directory />} />
        <Route path="insights" element={<Insights />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="admin/users"
          element={<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>}
        />
        <Route
          path="admin/audit"
          element={<ProtectedRoute roles={["admin"]}><AuditLog /></ProtectedRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
