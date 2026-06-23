import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTimesheet } from "../context/TimesheetContext";
import api from "../services/api";
import "../app.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

const resolverUrlFoto = (url) => {
  if (!url) return null;
  if (url.startsWith("blob:") || url.startsWith("http") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return API_BASE + url;
  return url;
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("pt-BR");
};

export default function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entries, reports } = useTimesheet();

  const [checkins, setCheckins] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [postoFilter, setPostoFilter] = useState("todos");
  const [loading, setLoading] = useState(true);

  const isTestSession = user?.token?.startsWith("fake-") || user?.token?.endsWith("-cpf-token");

  useEffect(() => {
    carregarDados();
  }, []); // eslint-disable-line

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [insRes, outsRes] = await Promise.all([
        isTestSession ? Promise.resolve({ data: [] }) : api.get("/admin/checkins"),
        isTestSession ? Promise.resolve({ data: [] }) : api.get("/admin/checkouts"),
      ]);
      setCheckins(Array.isArray(insRes.data) ? insRes.data : []);
      setCheckouts(Array.isArray(outsRes.data) ? outsRes.data : []);
    } catch {
      // fallback para dados locais
      setCheckins(entries.filter((e) => e.tipo === "Check-in"));
      setCheckouts(reports.filter((r) => r.tipo === "Check-out"));
    } finally {
      setLoading(false);
    }
  };

  const allRecords = useMemo(() => {
    const ins = checkins.map((r) => ({
      ...r,
      tipo: "Check-in",
      postoNome: r.posto?.nome || r.postoNome || "Posto sem nome",
      nomeGuarda: r.nomeGuarda || r.userName || r.usuario?.nome || "",
      fotoUrl: resolverUrlFoto(r.fotoUrl || r.foto || r.photo),
      createdAt: r.createdAt || new Date().toISOString(),
    }));
    const outs = checkouts.map((r) => ({
      ...r,
      tipo: "Check-out",
      postoNome: r.posto?.nome || r.postoNome || "Posto sem nome",
      nomeGuarda: r.nomeGuarda || r.userName || r.usuario?.nome || "",
      fotoUrl: resolverUrlFoto(r.fotoUrl || r.foto || r.photo),
      createdAt: r.createdAt || new Date().toISOString(),
    }));
    return [...ins, ...outs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [checkins, checkouts]);

  const filtered = useMemo(() => {
    let data = allRecords;
    if (filter === "checkin") data = data.filter((r) => r.tipo === "Check-in");
    if (filter === "checkout") data = data.filter((r) => r.tipo === "Check-out");
    if (postoFilter !== "todos") data = data.filter((r) => r.postoNome === postoFilter);
    return data;
  }, [allRecords, filter, postoFilter]);

  const uniquePostos = useMemo(() => {
    const nomes = allRecords.map((r) => r.postoNome);
    return [...new Set(nomes)].sort();
  }, [allRecords]);

  return (
    <div className="page-bg">
      <header className="header-bar">
        <div className="header-inner">
          <div>
            <p className="header-label">Histórico</p>
            <h1 className="header-title">Registros de todos os postos</h1>
            {!loading && <p className="text-muted mt-1">{filtered.length} registro(s)</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline px-4 py-2 text-sm" onClick={() => navigate("/dashboard")}>
              Voltar
            </button>
          </div>
        </div>
      </header>

      <main className="page-center-7xl">
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setFilter("todos")} className={`btn-sm ${filter === "todos" ? "btn-cyan" : "btn-outline"}`}>
            Todos
          </button>
          <button onClick={() => setFilter("checkin")} className={`btn-sm ${filter === "checkin" ? "btn-cyan" : "btn-outline"}`}>
            Check‑ins
          </button>
          <button onClick={() => setFilter("checkout")} className={`btn-sm ${filter === "checkout" ? "btn-emerald" : "btn-outline"}`}>
            Check‑outs
          </button>
          <select value={postoFilter} onChange={(e) => setPostoFilter(e.target.value)} className="form-select text-sm">
            <option value="todos">Todos os postos</option>
            {uniquePostos.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="card-sm text-center text-slate-600">Carregando histórico...</div>
        ) : filtered.length === 0 ? (
          <div className="card-sm text-center text-slate-600">Nenhum registro encontrado.</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((record) => (
              <div key={record.id} className={`hist-card ${record.tipo === "Check-in" ? "hist-card-today-cyan" : "hist-card-today-emerald"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">{record.nomeGuarda || "Guarda não identificado"}</p>
                    <p className="text-muted text-xs mt-0.5">{formatDate(record.createdAt)}</p>
                    <p className="text-sm mt-1">
                      Posto: <strong>{record.postoNome}</strong>
                      <span className={`badge ml-2 ${record.tipo === "Check-in" ? "badge-cyan" : "badge-emerald"}`}>
                        {record.tipo}
                      </span>
                    </p>
                    {record.tipo === "Check-out" && (
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="mr-3">Relatório: {record.relatorio ?? 0}</span>
                        <span className="mr-3">Prev. mat: {record.prevencoesMatutino ?? 0}</span>
                        <span className="mr-3">Inc. mat: {record.incidentesMatutino ?? 0}</span>
                        <span className="mr-3">Prev. vesp: {record.prevencoesVespertino ?? 0}</span>
                        <span className="mr-3">Inc. vesp: {record.incidentesVespertino ?? 0}</span>
                        <span>Lesões: {record.lesoesPorAguaViva ?? 0}</span>
                      </div>
                    )}
                  </div>
                  {record.fotoUrl && (
                    <img src={record.fotoUrl} alt="Foto" className="h-16 w-16 rounded-lg object-cover" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}