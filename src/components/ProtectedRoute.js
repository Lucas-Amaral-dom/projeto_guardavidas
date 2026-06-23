import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  // Enquanto verifica a autenticação, não renderiza nada (ou um spinner)
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        Carregando...
      </div>
    );
  }

  // Não autenticado → vai para o login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Autenticado, mas rota exige admin → redireciona para dashboard
  if (adminOnly && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  // Tudo ok → renderiza o conteúdo da rota
  return children;
};

export default ProtectedRoute;