import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTimesheet } from "../context/TimesheetContext";
import { base64ToFile, checkService } from "../services/api";
import { getSavedPosto } from "./Dashboard";

// Chave de rascunho por usuario+posto
const getDraftKey = (userId, postoId) =>
  `checkoutDraft:${userId || "anon"}:${postoId || "sem-posto"}`;

const DailyReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addReport } = useTimesheet();
  const posto = useMemo(
    () => location.state?.posto || getSavedPosto(),
    [location.state],
  );

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState("");


  const [incidentesMatutino, setIncidentesMatutino] = useState(0);
  const [incidentesVespertino, setIncidentesVespertino] = useState(0);
  const [lesoesPorAguaViva, setLesoesPorAguaViva] = useState(0);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const draftKey = getDraftKey(user?.id, posto?.id);

  // Restaurar foto salva como rascunho
  useEffect(() => {
    const savedPhoto = localStorage.getItem(draftKey);
    if (!savedPhoto) return;
    try {
      setPreview(savedPhoto);
      setFoto(base64ToFile(savedPhoto, "checkout-rascunho.jpg"));
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setFoto(file || null);
    if (!file) {
      setPreview("");
      localStorage.removeItem(draftKey);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPreview(dataUrl);
      localStorage.setItem(draftKey, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // relatorio = soma dos três campos, conforme campo relatorio_numerico na entidade
  const relatorioNumerico =
    Number(incidentesMatutino) +
    Number(incidentesVespertino) +
    Number(lesoesPorAguaViva);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!posto) {
      setError("Selecione um posto antes de fazer check-out.");
      return;
    }

    // Modo de teste (token fake-)
    if (user?.token?.startsWith("fake-") || user?.token?.endsWith("-cpf-token")) {
      addReport({
        userId: user.id,
        userName: user.name,
        posto: posto.nome,
        postoId: posto.id,
        relatorio: relatorioNumerico,
        incidentesMatutino: Number(incidentesMatutino),
        incidentesVespertino: Number(incidentesVespertino),
        lesoesPorAguaViva: Number(lesoesPorAguaViva),
        photo: preview,
      });
      localStorage.removeItem(draftKey);
      setMessage(
        `Check-out de teste registrado em ${posto.nome}. Relatório numérico: ${relatorioNumerico}.`,
      );
      return;
    }

    // Requisição real — campos exatamente como o backend espera
    const formData = new FormData();
    formData.append("postoId", posto.id);
    formData.append("relatorio", String(relatorioNumerico));
    formData.append("incidentesMatutino", Number(incidentesMatutino));
    formData.append("incidentesVespertino", Number(incidentesVespertino));
    formData.append("lesoesPorAguaViva", Number(lesoesPorAguaViva));
    if (foto) formData.append("foto", foto);

    setLoading(true);
    try {
      const response = await checkService.checkout(formData);
      localStorage.removeItem(draftKey);
      setMessage(
        `Check-out registrado em ${response.data.posto || posto.nome}. ` +
          `Relatório numérico: ${response.data.relatorio ?? relatorioNumerico}. ` +
          `Incidentes matutino: ${response.data.incidentesMatutino ?? incidentesMatutino}. ` +
          `Incidentes vespertino: ${response.data.incidentesVespertino ?? incidentesVespertino}. ` +
          `Lesões por água-viva: ${response.data.lesoesPorAguaViva ?? lesoesPorAguaViva}.`,
      );
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === "string" ? err.response.data : null) ||
        "Erro ao registrar check-out.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-5 py-6 text-slate-950">
      <main className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
              Check-out
            </p>
            <h1 className="mt-2 text-2xl font-bold">Encerrar plantão</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Trocar posto
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Posto escolhido</p>
          <p className="mt-1 text-lg font-bold">{posto?.nome || "Nenhum posto"}</p>
          {posto?.descricao && (
            <p className="mt-1 text-sm leading-6 text-slate-700">{posto.descricao}</p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Contador calculado */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Relatório numérico (calculado automaticamente)
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-800">
              {relatorioNumerico}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Soma de incidentes matutino + vespertino + lesões por água-viva.
            </p>
          </div>

          {/* Campos alinhados com CheckOut.java */}
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Incidentes matutino"
              value={incidentesMatutino}
              onChange={setIncidentesMatutino}
            />
            <NumberField
              label="Incidentes vespertino"
              value={incidentesVespertino}
              onChange={setIncidentesVespertino}
            />
            <NumberField
              label="Lesões por água-viva"
              value={lesoesPorAguaViva}
              onChange={setLesoesPorAguaViva}
            />
          </div>

          {/* Foto */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Foto da saída
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              Tire a foto diretamente pela câmera ou selecione da galeria.
            </p>
          </div>

          {preview && (
            <img
              src={preview}
              alt="Prévia da saída"
              className="max-h-80 w-full rounded-lg object-cover"
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              disabled={loading || !posto}
              className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Registrando..." : "Confirmar check-out"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

const NumberField = ({ label, value, onChange }) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {label}
    </label>
    <input
      type="number"
      min="0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

export default DailyReport;