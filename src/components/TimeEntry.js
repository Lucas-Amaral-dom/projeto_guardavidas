import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTimesheet } from "../context/TimesheetContext";
import { base64ToFile, checkService } from "../services/api";
import { getSavedPosto } from "./Dashboard";

const formatResponseDate = (v) =>
  v ? new Date(v).toLocaleString("pt-BR") : "";

const getDraftKey = (userId, postoId) =>
  `checkinDraft:${userId || "anon"}:${postoId || "sem-posto"}`;

// ─── TimeEntry (Check-in) ─────────────────────────────────────────────────────
const TimeEntry = () => {
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user }     = useAuth();
  const { addEntry } = useTimesheet();

  const posto = useMemo(
    () => location.state?.posto || getSavedPosto(),
    [location.state],
  );

  // nome do guarda-vidas (pré-preenche com o nome da conta logada)
  const [nomeGuarda, setNomeGuarda] = useState(user?.name || "");

  const [foto,    setFoto]    = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error,   setError]   = useState("");

  // câmera
  const fileInputRef = useRef(null);
  const [cameraMode, setCameraMode] = useState("environment");

  const draftKey = getDraftKey(user?.id, posto?.id);

  // restaurar foto de rascunho (pode ter sido salva pelo botão rápido do Dashboard)
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      setPreview(saved);
      setFoto(base64ToFile(saved, "checkin-rascunho.jpg"));
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  // ── foto ───────────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFoto(null);
      setPreview("");
      localStorage.removeItem(draftKey);
      return;
    }
    setFoto(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPreview(dataUrl);
      localStorage.setItem(draftKey, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFoto(null);
    setPreview("");
    localStorage.removeItem(draftKey);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCamera = (capture) => {
    setCameraMode(capture);
    setTimeout(() => fileInputRef.current?.click(), 30);
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!posto) {
      setError("Selecione um posto antes de fazer check-in.");
      return;
    }
    if (!nomeGuarda.trim()) {
      setError("Informe o nome do guarda-vidas.");
      return;
    }

    const isTest =
      user?.token?.startsWith("fake-") || user?.token?.endsWith("-cpf-token");

    if (isTest) {
      addEntry({
        userId:    user.id,
        userName:  user.name,
        nomeGuarda: nomeGuarda.trim(),
        posto:     posto.nome,
        postoId:   posto.id,
        photo:     preview,
      });
      localStorage.removeItem(draftKey);
      setMessage(
        `Check-in de teste registrado — ${nomeGuarda.trim()} em ${posto.nome}.`,
      );
      return;
    }

    const formData = new FormData();
    formData.append("postoId", posto.id);
    formData.append("nomeGuarda", nomeGuarda.trim());
    if (foto) formData.append("foto", foto);

    setLoading(true);
    try {
      const response = await checkService.checkin(formData);
      const horario = formatResponseDate(
        response.data.Horario || response.data.horario,
      );
      // também salva localmente para o histórico do guarda
      addEntry({
        userId:    user.id,
        userName:  user.name,
        nomeGuarda: nomeGuarda.trim(),
        posto:     response.data.posto || response.data.Posto || posto.nome,
        postoId:   posto.id,
        photo:     preview,
      });
      localStorage.removeItem(draftKey);
      setMessage(
        `Check-in registrado — ${nomeGuarda.trim()} em ${
          response.data.posto || response.data.Posto || posto.nome
        }${horario ? ` às ${horario}` : ""}.`,
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          (typeof err.response?.data === "string" ? err.response.data : null) ||
          "Erro ao registrar check-in.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950">
      <main className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
              Check-in
            </p>
            <h1 className="mt-1 text-2xl font-bold">Registrar entrada</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            ← Postos
          </button>
        </div>

        {/* Posto */}
        <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
            Posto escolhido
          </p>
          <p className="mt-1 text-lg font-bold">{posto?.nome || "Nenhum posto"}</p>
          {posto?.descricao && (
            <p className="mt-0.5 text-sm text-slate-600">{posto.descricao}</p>
          )}
        </div>

        {/* Alertas */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            ✓ {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">

          {/* ── Nome do guarda-vidas ─────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Nome do guarda-vidas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nomeGuarda}
              onChange={(e) => setNomeGuarda(e.target.value)}
              placeholder="Ex: João Silva"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Pré-preenchido com o nome da conta. Altere se necessário.
            </p>
          </div>

          {/* ── Foto da entrada ──────────────────────────────────────────── */}
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">
              Foto da entrada{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </p>

            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Prévia da entrada"
                  className="max-h-64 w-full rounded-xl object-cover shadow-sm"
                />
                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera("environment")}
                    className="flex-1 rounded-lg bg-black/60 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-black/75"
                  >
                    📷 Nova foto
                  </button>
                  <button
                    type="button"
                    onClick={() => openCamera(false)}
                    className="flex-1 rounded-lg bg-black/60 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-black/75"
                  >
                    🖼 Galeria
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="rounded-lg bg-red-600/80 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => openCamera("environment")}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-50 py-7 text-cyan-700 transition hover:bg-cyan-100"
                >
                  <CameraIcon size={30} />
                  <span className="text-sm font-bold">Abrir câmera</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCamera(false)}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-7 text-slate-500 transition hover:bg-slate-100"
                >
                  <GalleryIcon size={30} />
                  <span className="text-sm font-bold">Da galeria</span>
                </button>
              </div>
            )}

            {/* input oculto controlado por ref */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture={cameraMode || undefined}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Botões */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              disabled={loading || !posto}
              className="rounded-xl bg-cyan-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Registrando..." : "Confirmar check-in"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl border border-slate-300 px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

// ─── Ícones ───────────────────────────────────────────────────────────────────
const CameraIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const GalleryIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

export default TimeEntry;