import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

/* ─── IndexedDB helpers (offline queue) ──────────────────────────────── */
const DB_NAME = "OfflineQueueDB";
const STORE_NAME = "pendingEntries";
let _db = null;

const openDB = () =>
  new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });

const addPendingEntry = async (entry) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const salvarOffline = async (dados, tipo, fotoFile) => {
  const buffer = await fotoFile.arrayBuffer();
  const entry = {
    id: "local-" + crypto.randomUUID(),
    ...dados,
    tipo,
    createdAt: new Date().toISOString(),
    fotoBuffer: buffer,
    fotoName: fotoFile.name,
  };
  try {
    await addPendingEntry(entry);
    toast.success(`${tipo} salvo offline. Será enviado quando houver internet.`);
  } catch (err) {
    console.error("Erro ao salvar offline:", err);
    toast.error("Falha ao salvar offline.");
  }
};

const limparNumero = (valor) => {
  if (valor === "" || valor === undefined) return "";
  return String(valor).replace(/^0+/, "");
};

/* ─── CameraCapture ──────────────────────────────────────────────────── */
const CameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [camError, setCamError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCamError("");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.muted = true;
        await new Promise((r) => setTimeout(r, 200));
        await videoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") setCamError("Não foi possível iniciar a câmera.");
        });
        setCameraReady(true);
      }
    } catch {
      setCamError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, [stopCamera]);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []); // eslint-disable-line

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCamera();
        onCapture(file);
      }
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md">
      {camError ? (
        <div className="p-4 text-sm text-red-700">{camError}</div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="w-full rounded-xl"
            style={{ maxHeight: "60vh", display: cameraReady ? "block" : "none" }} />
          {!cameraReady && (
            <div className="flex items-center justify-center p-4 text-sm text-slate-600">
              Iniciando câmera...
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={capturePhoto} disabled={!cameraReady}
              className="btn btn-emerald flex-1">
              Capturar foto
            </button>
            <button type="button" onClick={() => { stopCamera(); onCancel(); }}
              className="btn btn-outline flex-1">
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ─── CheckOut Component ─────────────────────────────────────────────── */
export default function CheckOut({ selectedPosto, onSuccess }) {
  const [prevMatutino, setPrevMatutino] = useState("");
  const [incMatutino, setIncMatutino] = useState("");
  const [prevVespertino, setPrevVespertino] = useState("");
  const [incVespertino, setIncVespertino] = useState("");
  const [lesoesAguaViva, setLesoesAguaViva] = useState("");
  const [relatorioMatutino, setRelatorioMatutino] = useState("");
  const [relatorioVespertino, setRelatorioVespertino] = useState("");
  const [relatorioTotal, setRelatorioTotal] = useState("");
  const [foto, setFoto] = useState(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // Blob URL
  useEffect(() => {
    if (foto) {
      const url = URL.createObjectURL(foto);
      setFotoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFotoPreviewUrl(null);
    }
  }, [foto]);

  // Relatórios automáticos
  useEffect(() => {
    const pM = Number(limparNumero(prevMatutino) || 0);
    const iM = Number(limparNumero(incMatutino) || 0);
    const pV = Number(limparNumero(prevVespertino) || 0);
    const iV = Number(limparNumero(incVespertino) || 0);
    const l = Number(limparNumero(lesoesAguaViva) || 0);
    const mat = pM + iM;
    const vesp = pV + iV + l;
    setRelatorioMatutino(String(mat));
    setRelatorioVespertino(String(vesp));
    setRelatorioTotal(String(mat + vesp));
  }, [prevMatutino, incMatutino, prevVespertino, incVespertino, lesoesAguaViva]);

  const handleNumero = (setter) => (e) => setter(limparNumero(e.target.value));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPosto) return setError("Selecione um posto primeiro.");
    if (!foto) return setError("Tire uma foto para o check-out.");

    setEnviando(true);
    setError("");

    const dados = {
      postoId: selectedPosto.id,
      postoNome: selectedPosto.nome,
      relatorioMatutino,
      relatorioVespertino,
      relatorio: relatorioTotal,
      prevencoesMatutino: limparNumero(prevMatutino) || "0",
      incidentesMatutino: limparNumero(incMatutino) || "0",
      prevencoesVespertino: limparNumero(prevVespertino) || "0",
      incidentesVespertino: limparNumero(incVespertino) || "0",
      lesoesPorAguaViva: limparNumero(lesoesAguaViva) || "0",
    };

    const formData = new FormData();
    Object.entries(dados).forEach(([k, v]) => formData.append(k, v));
    formData.append("foto", foto);

    try {
      await api.post("/checkout", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Check-out registrado com sucesso!");
    } catch {
      await salvarOffline(dados, "Check-out", foto);
    } finally {
      setEnviando(false);
      setPrevMatutino(""); setIncMatutino(""); setPrevVespertino(""); setIncVespertino(""); setLesoesAguaViva("");
      setRelatorioMatutino(""); setRelatorioVespertino(""); setRelatorioTotal("");
      setFoto(null); setShowCamera(false);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <section className="card max-w-xl mx-auto">
      <h2 className="text-xl font-extrabold text-slate-800 mb-1">Check‑out</h2>
      <p className="text-sm text-slate-500 mb-6">{selectedPosto?.nome}</p>

      {error && <div className="card-red mb-4 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Cartões Matutino e Vespertino ── */}
        <div className="relatorio-grid">
          {/* Matutino */}
          <div className="relatorio-card matutino">
            <h3 className="text-sm font-bold text-amber-700 mb-3">☀️ Turno Matutino</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="form-label">Prevenções</span>
                <input type="number" inputMode="numeric" value={prevMatutino}
                  onChange={handleNumero(setPrevMatutino)} className="form-input" placeholder="0" />
              </label>
              <label className="block">
                <span className="form-label">Incidentes</span>
                <input type="number" inputMode="numeric" value={incMatutino}
                  onChange={handleNumero(setIncMatutino)} className="form-input" placeholder="0" />
              </label>
            </div>
          </div>

          {/* Vespertino */}
          <div className="relatorio-card vespertino">
            <h3 className="text-sm font-bold text-indigo-700 mb-3">🌙 Turno Vespertino</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="form-label">Prevenções</span>
                <input type="number" inputMode="numeric" value={prevVespertino}
                  onChange={handleNumero(setPrevVespertino)} className="form-input" placeholder="0" />
              </label>
              <label className="block">
                <span className="form-label">Incidentes</span>
                <input type="number" inputMode="numeric" value={incVespertino}
                  onChange={handleNumero(setIncVespertino)} className="form-input" placeholder="0" />
              </label>
            </div>
          </div>

          {/* Lesões */}
          <div className="col-span-full">
            <label className="block">
              <span className="form-label">Lesões por água‑viva</span>
              <input type="number" inputMode="numeric" value={lesoesAguaViva}
                onChange={handleNumero(setLesoesAguaViva)} className="form-input" placeholder="0" />
            </label>
          </div>

          {/* Total */}
          <div className="relatorio-total">
            <p className="text-sm font-semibold opacity-90">Total geral</p>
            <p className="total-value">{relatorioTotal}</p>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <span>Matutino: {relatorioMatutino}</span>
              <span>Vespertino: {relatorioVespertino}</span>
            </div>
          </div>
        </div>

        {/* ── Foto ── */}
        <div>
          <span className="form-label">Foto obrigatória</span>
          {showCamera ? (
            <CameraCapture
              onCapture={(file) => { setFoto(file); setShowCamera(false); }}
              onCancel={() => setShowCamera(false)}
            />
          ) : foto ? (
            <div>
              <img src={fotoPreviewUrl} alt="Preview" className="h-40 w-full rounded-2xl object-cover shadow-md" />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setShowCamera(true)} className="btn btn-emerald flex-1">
                  Bater nova foto
                </button>
                <button type="button" onClick={() => setFoto(null)} className="btn btn-red flex-1">
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCamera(true)}
              className="btn btn-emerald w-full py-4 text-lg">
              📸 Bater foto
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando || !foto}
          className="btn btn-emerald w-full py-4 text-base"
        >
          {enviando ? "Enviando..." : "Registrar check‑out"}
        </button>
      </form>
    </section>
  );
}
