import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import "../app.css";

const LAST_IDENTIFIER_KEY = "lastIdentifier";

// O nome é lido do localStorage do AuthContext (userName) para evitar duplicação
const salvarSessao = (identifier) => {
  localStorage.setItem(LAST_IDENTIFIER_KEY, identifier);
};

const obterSessao = () => ({
  identifier: localStorage.getItem(LAST_IDENTIFIER_KEY) || null,
  // Reutiliza o userName que o AuthContext já persiste
  nome: localStorage.getItem("userName") || null,
});

const removerSessao = () => {
  localStorage.removeItem(LAST_IDENTIFIER_KEY);
};

const mascararIdentificador = (id) => {
  if (!id) return "";
  if (id.includes("@")) {
    const [local, dominio] = id.split("@");
    const parte = local.length <= 4 ? local : local.slice(0, 2) + "***" + local.slice(-1);
    return `${parte}@${dominio}`;
  }
  const digitos = id.replace(/\D/g, "");
  if (digitos.length < 6) return id;
  return digitos.slice(0, 3) + " ***";
};

const getInitials = (nome, identifier) => {
  if (nome) {
    const parts = nome.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (identifier) return identifier.slice(0, 2).toUpperCase();
  return "??";
};

// ── Login ─────────────────────────────────────────────────────────────────────
const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [showQuickPass, setShowQuickPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const quickInputRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [sessao, setSessao] = useState(obterSessao);

  // Focar campo de senha rápida ao aparecer
  useEffect(() => {
    if (sessao.identifier && quickInputRef.current) {
      quickInputRef.current.focus();
    }
  }, [sessao.identifier]);

  const handleIdentifierChange = (value) => {
    setIdentifier(value.trim());
  };

  // Login principal
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(identifier, password);
      salvarSessao(identifier);
      // userName já salvo pelo AuthContext — lemos direto
      const nomeAtualizado = localStorage.getItem("userName") || null;
      setSessao({ identifier, nome: nomeAtualizado });
      navigate(data.tipo === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data ||
        err.message ||
        "Erro ao autenticar";
      setError(typeof message === "string" ? message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  // Login rápido
  const handleQuickLogin = async (e) => {
    e.preventDefault();
    if (!sessao.identifier || !quickPassword) return;
    setError("");
    setQuickLoading(true);
    try {
      const data = await login(sessao.identifier, quickPassword);
      navigate(data.tipo === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data ||
        err.message ||
        "Senha incorreta";
      setError(typeof message === "string" ? message : "Senha incorreta");
      setQuickPassword("");
      if (quickInputRef.current) quickInputRef.current.focus();
    } finally {
      setQuickLoading(false);
    }
  };

  const handleRemoveQuickAccess = () => {
    removerSessao();
    setSessao({ identifier: null, nome: null });
    setQuickPassword("");
    setError("");
  };

  const isEmail = identifier.includes("@");
  const initials = getInitials(sessao.nome, sessao.identifier);

  return (
    <div className="login-bg">
      <main className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">

        {/* ── Coluna de apresentação ── */}
        <section className="hidden lg:block">
          {/* Logo CBMSC */}
          <div className="mb-8 flex items-center gap-4">
            <img
              src="/logo-cbmsc.png"
              alt="Corpo de Bombeiros Militar de Santa Catarina"
              className="h-20 w-20 object-contain drop-shadow-lg"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Corpo de Bombeiros</p>
              <p className="text-lg font-black text-white leading-tight">Militar de Santa Catarina</p>
            </div>
          </div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Sistema de Controle Operacional
          </p>
          <h1 className="text-5xl font-black leading-tight text-white">
            Operação<br />
            <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
              Veraneio
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Acesse com os 6 primeiros dígitos do CPF ou e-mail, selecione o posto
            correto e registre sua entrada ou saída.
          </p>

          {/* Destaques */}
          <div className="mt-10 space-y-3">
            {[
              { icon: "🏖️", title: "Controle por posto", desc: "Registre presença em postos de praia" },
              { icon: "📸", title: "Foto obrigatória", desc: "Segurança com registro fotográfico" },
              { icon: "📊", title: "Relatórios automáticos", desc: "Prevenções e incidentes por turno" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 backdrop-blur-sm">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-sm">{item.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Card de login ── */}
        <div className="login-card">
          <div className="mb-6">
            {/* Logo no card */}
            <div className="mb-4 flex items-center gap-3">
              <img
                src="/logo-cbmsc.png"
                alt="CBMSC"
                className="h-14 w-14 object-contain drop-shadow-sm"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">CBMSC</p>
                <p className="text-xs font-semibold text-slate-500 leading-tight">Corpo de Bombeiros Militar de SC</p>
              </div>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Acesso Restrito</h2>
            <p className="mt-1 text-sm text-slate-500">
              Entre com CPF (6 dígitos) ou e-mail e sua senha.
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="card-red mb-5 flex items-center gap-2 text-sm font-medium text-red-800">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Acesso Rápido ── */}
          {sessao.identifier ? (
            <div className="mb-6">
              {/* Card do usuário */}
              <div className="relative overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-5 shadow-sm">
                {/* Decoração de fundo */}
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-400/10" />
                <div className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-blue-400/10" />

                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
                    ⚡ Acesso rápido
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveQuickAccess}
                    title="Remover acesso rápido"
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Avatar + info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 text-white font-black text-base shadow-md shadow-cyan-500/30">
                    {initials}
                  </div>
                  <div>
                    {sessao.nome && (
                      <p className="font-bold text-slate-900 text-sm leading-tight">{sessao.nome}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-0.5 font-mono">
                      {mascararIdentificador(sessao.identifier)}
                    </p>
                  </div>
                </div>

                {/* Campo senha rápida */}
                <form onSubmit={handleQuickLogin} className="space-y-3">
                  <div className="relative">
                    <input
                      ref={quickInputRef}
                      id="quick-password"
                      className="form-input pr-12 text-sm"
                      type={showQuickPass ? "text" : "password"}
                      value={quickPassword}
                      onChange={(e) => setQuickPassword(e.target.value)}
                      placeholder="Digite sua senha..."
                      required
                      disabled={quickLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowQuickPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showQuickPass ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <button
                    type="submit"
                    id="quick-login-btn"
                    className="btn btn-cyan w-full py-3 text-sm"
                    disabled={quickLoading || !quickPassword}
                  >
                    {quickLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Entrando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        Entrar
                      </span>
                    )}
                  </button>
                </form>
              </div>

              {/* Separador */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400">ou entre com outra conta</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          ) : null}

          {/* ── Formulário completo ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="form-label">CPF (6 dígitos) ou E-mail</label>
              <input
                id="identifier"
                className="form-input"
                type="text"
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                placeholder={isEmail ? "seu@email.com" : "Ex: 123456"}
                required
                disabled={loading}
                autoComplete="username"
              />
              {identifier.length > 0 && (
                <p className="text-muted-xs mt-1.5 text-slate-500">
                  {isEmail
                    ? "Login por e-mail detectado."
                    : identifier.length < 6
                    ? `${6 - identifier.length} dígito(s) restante(s)`
                    : "✓ Identificador válido"}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="form-label">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  className="form-input pr-12"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="btn btn-cyan btn-full py-3.5"
              disabled={loading || (!isEmail && identifier.length < 6)}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Validando...
                </span>
              ) : (
                sessao.identifier ? "Entrar com outra conta" : "Acessar Sistema"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            CBMSC — Sistema de Operação Veraneio
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;