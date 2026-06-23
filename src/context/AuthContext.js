import React, { createContext, useState, useContext, useEffect } from "react";
import { auth } from "../services/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const normalizeRole = (value) => {
  if (!value) return "GUARDA_VIDAS";
  return String(value).toUpperCase() === "ADMIN" ? "ADMIN" : "GUARDA_VIDAS";
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role  = localStorage.getItem("role");
    const name  = localStorage.getItem("userName");
    const id    = localStorage.getItem("userId");
    if (token) {
      setUser({ token, role: normalizeRole(role), name, id: id ? Number(id) : undefined });
    }
    setLoading(false);
  }, []);

  const login = async (identificador, senha) => {
    let payload = {};

    if (typeof identificador === "object" && identificador !== null) {
      const { email, cpf, password } = identificador;
      if (email)     payload = { email, senha: password };
      else if (cpf)  payload = { cpf: cpf.replace(/\D/g, ""), senha: password };
      else throw new Error("Identificador inválido");
    } else if (typeof identificador === "string") {
      if (identificador.includes("@")) {
        payload = { email: identificador.trim(), senha };
      } else {
        // 6 dígitos do CPF — remove não-dígitos antes de enviar
        payload = { cpf: identificador.replace(/\D/g, ""), senha };
      }
    } else {
      throw new Error("Formato de identificador inválido.");
    }

    const response = await auth.login(payload);
    const { token, tipo, usuario } = response.data;
    const role = normalizeRole(tipo);
    const name = usuario?.nome || usuario?.cpf || String(identificador);

    localStorage.setItem("token",    token);
    localStorage.setItem("role",     role);
    localStorage.setItem("userName", name);
    if (usuario?.id) localStorage.setItem("userId", String(usuario.id));

    setUser({ token, role, name, id: usuario?.id });
    return { ...response.data, tipo: role };
  };

  const loginWithTestUser = (testUser) => {
    const role = normalizeRole(testUser.tipo);
    localStorage.setItem("token",    testUser.token);
    localStorage.setItem("role",     role);
    localStorage.setItem("userName", testUser.nome);
    localStorage.setItem("userId",   String(testUser.id));
    setUser({ token: testUser.token, role, name: testUser.nome, id: testUser.id });
    return {
      token:   testUser.token,
      tipo:    role,
      usuario: { id: testUser.id, nome: testUser.nome, cpf: testUser.cpf },
    };
  };

  const logout = () => { localStorage.clear(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, login, loginWithTestUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};