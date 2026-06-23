import React, { createContext, useState, useContext, useEffect } from "react";

const TimesheetContext = createContext();

const ENTRIES_KEY  = "timesheetEntries";
const REPORTS_KEY  = "timesheetReports";
const SEQ_IN_KEY   = "seq_checkin";   // contador de check-ins
const SEQ_OUT_KEY  = "seq_checkout";  // contador de check-outs

// ── Gerador de ID único por tipo ──────────────────────────────────────────────
// Check-in  → 1_XXXXXXXX  (prefixo "1")
// Check-out → 2_XXXXXXXX  (prefixo "2")
// O sufixo é um contador inteiro crescente gravado no localStorage,
// garantindo que IDs nunca se repitam mesmo após recarregar a página.
const nextId = (tipo) => {
  const key = tipo === "entry" ? SEQ_IN_KEY : SEQ_OUT_KEY;
  const prefix = tipo === "entry" ? "1" : "2";
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  // Ex.: "1_000001" ou "2_000042"
  return `${prefix}_${String(next).padStart(6, "0")}`;
};

const readStoredArray = (key) => {
  try {
    const value = localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
};

export const TimesheetProvider = ({ children }) => {
  const [entries, setEntries] = useState(() => readStoredArray(ENTRIES_KEY));
  const [reports, setReports] = useState(() => readStoredArray(REPORTS_KEY));

  // Persiste no localStorage toda vez que o estado muda
  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  }, [reports]);

  // ── Check-in ───────────────────────────────────────────────────────────────
  const addEntry = (entry) => {
    const newEntry = {
      id:          nextId("entry"),          // ex.: "1_000001"
      userId:      entry.userId,
      userName:    entry.userName,
      nomeGuarda:  entry.nomeGuarda  || entry.userName || "",
      posto:       entry.posto       || entry.postoNome || "",
      postoId:     entry.postoId     || null,
      postoNome:   entry.postoNome   || entry.posto || "",
      photo:       entry.photo       || entry.fotoUrl || "",
      fotoUrl:     entry.fotoUrl     || entry.photo || "",
      createdAt:   new Date().toISOString(),
      tipo:        "Check-in",
      type:        "entry",
    };
    setEntries((prev) => [...prev, newEntry]);
    return newEntry;
  };

  // ── Check-out ──────────────────────────────────────────────────────────────
  const addReport = (report) => {
    const newReport = {
      id:                   nextId("report"),  // ex.: "2_000001"
      userId:               report.userId,
      userName:             report.userName,
      nomeGuarda:           report.nomeGuarda           || report.userName || "",
      posto:                report.posto                || report.postoNome || "",
      postoId:              report.postoId              || null,
      postoNome:            report.postoNome            || report.posto || "",
      photo:                report.photo                || report.fotoUrl || "",
      fotoUrl:              report.fotoUrl              || report.photo || "",
      // Campos numéricos — explícitos para nunca perder dados
      relatorio:            Number(report.relatorio)            || 0,
      incidentesMatutino:   Number(report.incidentesMatutino)   || 0,
      incidentesVespertino: Number(report.incidentesVespertino) || 0,
      lesoesPorAguaViva:    Number(report.lesoesPorAguaViva)    || 0,
      createdAt:            new Date().toISOString(),
      tipo:                 "Check-out",
      type:                 "report",
    };
    setReports((prev) => [...prev, newReport]);
    return newReport;
  };

  const updateEntryPhoto = (entryId, newPhoto) =>
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, photo: newPhoto, fotoUrl: newPhoto } : e)),
    );

  const getUserEntries = (userId) => entries.filter((e) => e.userId === userId);
  const getUserReports = (userId) => reports.filter((r) => r.userId === userId);

  const getTodayEntry = (userId) => {
    const today = new Date().toDateString();
    return entries.find(
      (e) => e.userId === userId && new Date(e.createdAt).toDateString() === today,
    );
  };

  const getTodayReport = (userId) => {
    const today = new Date().toDateString();
    return reports.find(
      (r) => r.userId === userId && new Date(r.createdAt).toDateString() === today,
    );
  };

  const clearAllEntries = () => setEntries([]);
  const clearAllReports = () => setReports([]);

  const clearAllPhotos = () => {
    setEntries((prev) => prev.map((e) => ({ ...e, photo: "", fotoUrl: "" })));
    setReports((prev) => prev.map((r) => ({ ...r, photo: "", fotoUrl: "" })));
  };

  const deleteLastRecord = () => {
    const all = [
      ...entries.map((e) => ({ ...e, recordType: "entry" })),
      ...reports.map((r) => ({ ...r, recordType: "report" })),
    ];
    if (!all.length) return null;
    const last = all.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b,
    );
    if (last.recordType === "entry")
      setEntries((prev) => prev.filter((e) => e.id !== last.id));
    else
      setReports((prev) => prev.filter((r) => r.id !== last.id));
    return last;
  };

  const deleteEntry  = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));
  const deleteReport = (id) => setReports((prev) => prev.filter((r) => r.id !== id));

  const exportData = () => ({
    entries,
    reports,
    exportedAt: new Date().toISOString(),
  });

  return (
    <TimesheetContext.Provider
      value={{
        entries,
        reports,
        addEntry,
        addReport,
        getUserEntries,
        getUserReports,
        getTodayEntry,
        getTodayReport,
        clearAllEntries,
        clearAllReports,
        clearAllPhotos,
        updateEntryPhoto,
        deleteLastRecord,
        deleteEntry,
        deleteReport,
        exportData,
      }}
    >
      {children}
    </TimesheetContext.Provider>
  );
};

export const useTimesheet = () => {
  const context = useContext(TimesheetContext);
  if (!context)
    throw new Error("useTimesheet must be used within TimesheetProvider");
  return context;
};