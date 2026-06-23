import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
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
              className="btn btn-cyan flex-1">
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

/* ─── CheckIn Component ──────────────────────────────────────────────── */
export default function CheckIn({ selectedPosto, onSuccess }) {
  const { user } = useAuth();

  const [nomeGuarda, setNomeGuarda] = useState(user?.name || user?.nome || "");
  const [companheiro, setCompanheiro] = useState("");
  const [foto, setFoto] = useState(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (foto) {
      const url = URL.createObjectURL(foto);
      setFotoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFotoPreviewUrl(null);
    }
  }, [foto]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPosto) return setError("Selecione um posto primeiro.");
    if (!nomeGuarda.trim()) return setError("Informe o nome do guarda-vidas.");
    if (!foto) return setError("Tire uma foto para o check-in.");

    setEnviando(true);
    setError("");

    const dados = {
      postoId: selectedPosto.id,
      postoNome: selectedPosto.nome,
      nomeGuarda: nomeGuarda.trim(),
      companheiro: companheiro.trim(),
    };

    const formData = new FormData();
    formData.append("postoId", selectedPosto.id);
    formData.append("postoNome", selectedPosto.nome);
    formData.append("nomeGuarda", nomeGuarda.trim());
    if (companheiro.trim()) formData.append("companheiro", companheiro.trim());
    formData.append("foto", foto);

    try {
      await api.post("/checkin", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Check-in registrado com sucesso!");
    } catch {
      await salvarOffline(dados, "Check-in", foto);
    } finally {
      setEnviando(false);
      setNomeGuarda(user?.name || user?.nome || "");
      setCompanheiro("");
      setFoto(null);
      setShowCamera(false);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <section className="card max-w-xl mx-auto">
      <h2 className="text-xl font-extrabold text-slate-800 mb-1">Check‑in</h2>
      <p className="text-sm text-slate-500 mb-6">{selectedPosto?.nome}</p>

      {error && <div className="card-red mb-4 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="form-label">Nome do guarda‑vidas</span>
          <input
            type="text"
            value={nomeGuarda}
            onChange={(e) => setNomeGuarda(e.target.value)}
            className="form-input"
            placeholder="Seu nome completo"
            required
          />
        </label>

        <label className="block">
          <span className="form-label">Nome do colega de posto (opcional)</span>
          <input
            type="text"
            value={companheiro}
            onChange={(e) => setCompanheiro(e.target.value)}
            className="form-input"
            placeholder="Ex: João Silva"
          />
        </label>

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
                <button type="button" onClick={() => setShowCamera(true)} className="btn btn-cyan flex-1">
                  Bater nova foto
                </button>
                <button type="button" onClick={() => setFoto(null)} className="btn btn-red flex-1">
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCamera(true)}
              className="btn btn-cyan w-full py-4 text-lg">
              📸 Bater foto
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando || !foto || !nomeGuarda.trim()}
          className="btn btn-cyan w-full py-4 text-base"
        >
          {enviando ? "Enviando..." : "Registrar check‑in"}
        </button>
      </form>
    </section>
  );
}
