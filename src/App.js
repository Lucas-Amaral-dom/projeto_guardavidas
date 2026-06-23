import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { TimesheetProvider } from "./context/TimesheetContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import History from "./components/History";
import AdminDashboard from "./components/Admindashboard";
import "./app.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <TimesheetProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<Login />} />

            {/* Dashboard do guarda */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Histórico (apenas admin) */}
            <Route
              path="/history"
              element={
                <ProtectedRoute adminOnly={true}>
                  <History />
                </ProtectedRoute>
              }
            />

            {/* Redirecionamentos de rotas antigas */}
            <Route path="/checkin"   element={<Navigate to="/dashboard" replace />} />
            <Route path="/checkout"  element={<Navigate to="/dashboard" replace />} />
            <Route path="/time-entry" element={<Navigate to="/dashboard" replace />} />
            <Route path="/report"    element={<Navigate to="/dashboard" replace />} />

            {/* Qualquer outra rota → login */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TimesheetProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;