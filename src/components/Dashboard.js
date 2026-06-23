import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { postoService } from "../services/api";

import CheckIn from "./CheckIn";
import CheckOut from "./CheckOut";
import "../app.css";

const selectedPostoKey = "selectedPosto";
const demoPostos = [
  { id: 1, nome: "Posto Central", descricao: "Posto de teste para operação principal." },
  { id: 2, nome: "Posto Norte", descricao: "Posto de teste para guarda-vidas." },
  { id: 3, nome: "Posto Sul", descricao: "Posto de teste para troca de posto." },
];

export const getSavedPosto = () => {
  const saved = localStorage.getItem(selectedPostoKey);
  if (!saved) return null;
  try { return JSON.parse(saved); } catch {
    localStorage.removeItem(selectedPostoKey);
    return null;
  }
};

export const savePosto = (posto) =>
  localStorage.setItem(selectedPostoKey, JSON.stringify(posto));
export const clearPosto = () => localStorage.removeItem(selectedPostoKey);

/* ─── Dashboard ─────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [postos, setPostos] = useState([]);
  const [selectedPosto, setSelectedPosto] = useState(getSavedPosto());
  const [search, setSearch] = useState("");
  const [loadingPostos, setLoadingPostos] = useState(true);
  const [error, setError] = useState("");
  const [aba, setAba] = useState("selecao");

  // Carregar postos
  useEffect(() => {
    const loadPostos = async () => {
      setLoadingPostos(true);
      setError("");
      try {
        const response = await postoService.getAll();
        const data = response.data;
        if (Array.isArray(data) && data.length > 0) {
          setPostos(data);
        } else {
          setPostos(demoPostos);
          setError("Nenhum posto cadastrado. Exibindo postos de demonstração.");
        }
      } catch {
        setPostos(demoPostos);
        setError("Não foi possível carregar os postos da API. Usando postos de teste.");
      } finally {
        setLoadingPostos(false);
        const saved = getSavedPosto();
        if (saved) setSelectedPosto(saved);
      }
    };
    loadPostos();
  }, []);

  const filteredPostos = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return postos;
    return postos.filter(
      (p) => p.nome?.toLowerCase().includes(s) || p.descricao?.toLowerCase().includes(s)
    );
  }, [postos, search]);

  const handleSelectPosto = (posto) => {
    setSelectedPosto(posto);
    savePosto(posto);
    setAba("selecao");
  };

  const handleTrocarPosto = () => {
    clearPosto();
    setSelectedPosto(null);
    setAba("selecao");
  };

  const handleLogout = () => {
    clearPosto();
    logout();
    navigate("/");
  };

  return (
    <div className="page-bg">
      <header className="header-bar">
        <div className="header-inner">
          <div className="flex items-center gap-3">
            <img
              src="/logo-cbmsc.png"
              alt="CBMSC"
              className="h-12 w-12 shrink-0 object-contain drop-shadow-sm"
            />
            <div>
              <p className="header-label">Controle Operacional</p>
              <h1 className="header-title">Painel do Guarda‑vidas</h1>
              {selectedPosto && (
                <p className="text-sm text-slate-500 mt-0.5">Posto atual: {selectedPosto.nome}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-inner">
              {user?.name || user?.cpf || "Usuário"}
            </span>
            <button type="button" onClick={handleLogout} className="btn btn-red py-2 px-4 text-sm">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="page-center">
        {/* ── Navegação por abas ── */}
        <nav className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setAba("selecao")}
            className={aba === "selecao" ? "btn-nav-active-cyan" : "btn-nav-inactive"}
          >
            Selecionar posto
          </button>
          {selectedPosto && (
            <>
              <button
                onClick={() => setAba("checkin")}
                className={aba === "checkin" ? "btn-nav-active-cyan" : "btn-nav-inactive"}
              >
                Check‑in
              </button>
              <button
                onClick={() => setAba("checkout")}
                className={aba === "checkout" ? "btn-nav-active-cyan" : "btn-nav-inactive"}
              >
                Check‑out
              </button>
            </>
          )}
        </nav>

        {/* ── Aba Seleção ── */}
        {aba === "selecao" && (
          <section className="card">
            <div className="mb-4">
              <label className="form-label">Buscar posto</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                placeholder="Nome ou descrição"
              />
            </div>

            {error && (
              <div className="card-amber mb-4 text-sm font-medium text-amber-800">{error}</div>
            )}

            {loadingPostos ? (
              <div className="p-4 text-sm text-slate-600">Carregando postos...</div>
            ) : filteredPostos.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">Nenhum posto encontrado.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredPostos.map((posto) => {
                  const isActive = selectedPosto?.id === posto.id;
                  return (
                    <button
                      key={`posto-sel-${posto.id}`}
                      onClick={() => handleSelectPosto(posto)}
                      className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                        isActive
                          ? "border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-200/50 ring-2 ring-cyan-300"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-white shadow-md">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="font-bold text-slate-900">{posto.nome}</h2>
                          <p className="text-muted mt-1">{posto.descricao || "Sem descrição"}</p>
                          {isActive && (
                            <p className="mt-2 text-xs font-semibold text-cyan-700">⭐ Posto em uso</p>
                          )}
                        </div>
                        <span className={`badge ${isActive ? "badge-cyan" : "badge-slate"}`}>
                          {isActive ? "Selecionado" : `#${posto.id}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPosto && (
              <button onClick={handleTrocarPosto} className="btn btn-outline-cyan w-full mt-4">
                Trocar de posto
              </button>
            )}
          </section>
        )}

        {/* ── Aba Check-in (componente externo) ── */}
        {aba === "checkin" && selectedPosto && (
          <CheckIn
            selectedPosto={selectedPosto}
            onSuccess={() => setAba("selecao")}
          />
        )}

        {/* ── Aba Check-out (componente externo) ── */}
        {aba === "checkout" && selectedPosto && (
          <CheckOut
            selectedPosto={selectedPosto}
            onSuccess={() => setAba("selecao")}
          />
        )}
      </main>
    </div>
  );
}