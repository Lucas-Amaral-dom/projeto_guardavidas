import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useTimesheet } from "../context/TimesheetContext";
import api, { postoService, usuarioService } from "../services/api";
import "../app.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

const getPostoNumber = (posto) => {
  if (posto?.numero) return Number(posto.numero);
  const m = String(posto?.nome || "").match(/\d+/);
  return Number(m?.[0] || posto?.id || 0);
};

const getUsuarioLabel = (u) => u?.nome || u?.cpf || u?.email || "N/A";

const resolverUrlFoto = (url) => {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("http") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return API_BASE + url;
  return url;
};

const gerarUUID = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const normalizeRecord = (record, tipo) => {
  const posto = record.posto || {};
  const fotoUrl = resolverUrlFoto(record.fotoUrl || record.foto || "");
  return {
    ...record,
    id: record.id != null ? String(record.id) : gerarUUID(),
    tipo: record.tipo || tipo,
    postoId: posto.id ?? record.postoId ?? record.posto?.id,
    postoNome: posto.nome || record.postoNome || "Posto sem nome",
    createdAt: record.createdAt || new Date().toISOString(),
    fotoUrl,
    temFoto: Boolean(fotoUrl && !fotoUrl.startsWith("blob:")),
    nomeGuarda: record.nomeGuarda || "",
    companheiro: record.companheiro || "",
  };
};

const buildPostoRows = (postos, records) => {
  const apiPostos = Array.isArray(postos) ? postos : [];
  const postoPorId = new Map();
  apiPostos.forEach((p) => { if (!postoPorId.has(p.id)) postoPorId.set(p.id, p); });
  return Array.from(postoPorId.values())
    .sort((a, b) => getPostoNumber(a) - getPostoNumber(b))
    .map((posto) => {
      const numero = getPostoNumber(posto);
      const envios = records
        .filter((r) => getPostoNumber({ id: r.postoId, nome: r.postoNome }) === numero)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return {
        numero,
        posto,
        envios,
        checkinEnviado: envios.some((e) => e.tipo === "Check-in"),
        checkoutEnviado: envios.some((e) => e.tipo === "Check-out"),
      };
    });
};

const isFotoValida = (url) => url && !url.startsWith("blob:");

/* ─── Gerador de Relatório HTML ─────────────────────────────────────────── */
const gerarRelatorioHTML = (postoRows, allRecords, postos) => {
  const agora = new Date().toLocaleString("pt-BR");
  const totalCI = allRecords.filter((r) => r.tipo === "Check-in").length;
  const totalCO = allRecords.filter((r) => r.tipo === "Check-out").length;
  const checkoutsAll = allRecords.filter((r) => r.tipo === "Check-out");
  const totalPrev = checkoutsAll.reduce(
    (s, e) => s + Number(e.prevencoesMatutino || 0) + Number(e.prevencoesVespertino || 0), 0
  );
  const totalInc = checkoutsAll.reduce(
    (s, e) => s + Number(e.incidentesMatutino || 0) + Number(e.incidentesVespertino || 0), 0
  );
  const totalAV = checkoutsAll.reduce((s, e) => s + Number(e.lesoesPorAguaViva || 0), 0);

  // Dados para os gráficos
  const postoLabels = postoRows.map((r) => `P${String(r.numero).padStart(2, "0")}`);
  const postoCI = postoRows.map((r) => r.envios.filter((e) => e.tipo === "Check-in").length);
  const postoCO = postoRows.map((r) => r.envios.filter((e) => e.tipo === "Check-out").length);
  const postoPrev = postoRows.map((r) =>
    r.envios.filter((e) => e.tipo === "Check-out").reduce(
      (s, e) => s + Number(e.prevencoesMatutino || 0) + Number(e.prevencoesVespertino || 0), 0
    )
  );
  const postoInc = postoRows.map((r) =>
    r.envios.filter((e) => e.tipo === "Check-out").reduce(
      (s, e) => s + Number(e.incidentesMatutino || 0) + Number(e.incidentesVespertino || 0), 0
    )
  );
  const postoAV = postoRows.map((r) =>
    r.envios.filter((e) => e.tipo === "Check-out").reduce((s, e) => s + Number(e.lesoesPorAguaViva || 0), 0)
  );

  // Últimos 7 dias para gráfico de linha
  const hoje = new Date();
  const dias7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - (6 - i));
    return d;
  });
  const linhaLabels = dias7.map((d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
  const linhaCI = dias7.map((d) =>
    allRecords.filter((r) => r.tipo === "Check-in" && new Date(r.createdAt).toDateString() === d.toDateString()).length
  );
  const linhaCO = dias7.map((d) =>
    allRecords.filter((r) => r.tipo === "Check-out" && new Date(r.createdAt).toDateString() === d.toDateString()).length
  );

  // Pizza: top 8 postos por volume
  const pizzaData = postoRows
    .map((r) => ({ label: `P${String(r.numero).padStart(2, "0")}`, value: r.envios.length }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const pizzaColors = ["#06b6d4", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"];

  // HTML das linhas de postos
  const postoHTMLRows = postoRows
    .sort((a, b) => a.numero - b.numero)
    .map((row) => {
      const checkins = row.envios.filter((e) => e.tipo === "Check-in");
      const checkouts = row.envios.filter((e) => e.tipo === "Check-out");
      const fotos = row.envios.filter((e) => isFotoValida(e.fotoUrl));
      const totalRelatorio = checkouts.reduce((s, e) => s + Number(e.relatorio || 0), 0);

      const fotosHTML = fotos.slice(0, 8).map((envio) => {
        const nome = envio.nomeGuarda || envio.userName || "Guarda";
        const isCin = envio.tipo === "Check-in";
        const hora = envio.createdAt ? new Date(envio.createdAt).toLocaleString("pt-BR") : "";
        return `
          <div class="foto-card">
            <img src="${envio.fotoUrl}" alt="${nome}" onerror="this.parentElement.style.display='none'" />
            <div class="foto-info">
              <span class="foto-badge ${isCin ? "badge-in" : "badge-out"}">${isCin ? "IN" : "OUT"}</span>
              <p class="foto-nome">${nome}</p>
              <p class="foto-hora">${hora}</p>
            </div>
          </div>`;
      }).join("");

      const guardasCI = checkins.map((e) => {
        const nome = e.nomeGuarda || e.userName || "Guarda";
        const colegaHtml = e.companheiro
          ? `<br/><span class="colega-badge">👤 Colega: ${e.companheiro}</span>`
          : "";
        const hora = e.createdAt ? new Date(e.createdAt).toLocaleString("pt-BR") : "";
        return `<tr><td>${nome}${colegaHtml}</td><td>${hora}</td><td><span class="badge-in-sm">Check-in</span></td></tr>`;
      }).join("");

      const guardasCO = checkouts.map((e) => {
        const nome = e.nomeGuarda || e.userName || "Guarda";
        const hora = e.createdAt ? new Date(e.createdAt).toLocaleString("pt-BR") : "";
        const prev = Number(e.prevencoesMatutino || 0) + Number(e.prevencoesVespertino || 0);
        const inc = Number(e.incidentesMatutino || 0) + Number(e.incidentesVespertino || 0);
        const av = Number(e.lesoesPorAguaViva || 0);
        const total = Number(e.relatorio || 0);
        return `<tr><td>${nome}</td><td>${hora}</td><td>${prev}</td><td>${inc}</td><td>${av}</td><td><strong>${total}</strong></td></tr>`;
      }).join("");

      return `
        <div class="posto-card">
          <div class="posto-header">
            <div class="posto-num">${String(row.numero).padStart(2, "0")}</div>
            <div class="posto-info">
              <h3>${row.posto.nome}</h3>
              <p>${row.posto.descricao || "Sem descrição"}</p>
            </div>
            <div class="posto-badges">
              <span class="pill-cyan">${checkins.length} check-in</span>
              <span class="pill-emerald">${checkouts.length} check-out</span>
              ${totalRelatorio > 0 ? `<span class="pill-amber">Total: ${totalRelatorio}</span>` : ""}
            </div>
          </div>

          ${fotos.length > 0 ? `
          <div class="section-title">📸 Fotos dos guarda-vidas</div>
          <div class="fotos-grid">${fotosHTML}</div>
          ` : ""}

          ${checkins.length > 0 ? `
          <div class="section-title">🟢 Check-ins</div>
          <table class="data-table">
            <thead><tr><th>Guarda-vidas</th><th>Horário</th><th>Tipo</th></tr></thead>
            <tbody>${guardasCI}</tbody>
          </table>
          ` : ""}

          ${checkouts.length > 0 ? `
          <div class="section-title">🔴 Check-outs e Relatórios</div>
          <table class="data-table">
            <thead><tr><th>Guarda-vidas</th><th>Horário</th><th>Prevenções</th><th>Incidentes</th><th>Água-viva</th><th>Total</th></tr></thead>
            <tbody>${guardasCO}</tbody>
          </table>
          ` : ""}

          ${!row.checkinEnviado && !row.checkoutEnviado ? `
          <p class="sem-dados">Nenhum registro neste posto.</p>
          ` : ""}
        </div>`;
    }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório Lifeguard — ${agora}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f1f5f9; color: #1e293b; }

    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: white; padding: 32px 40px;
    }
    .header h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { color: #94a3b8; margin-top: 6px; font-size: 14px; }

    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

    /* Stat cards */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card {
      background: white; border-radius: 16px; padding: 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08); text-align: center;
    }
    .stat-card.cyan { border-top: 4px solid #06b6d4; }
    .stat-card.emerald { border-top: 4px solid #10b981; }
    .stat-card.amber { border-top: 4px solid #f59e0b; }
    .stat-card.red { border-top: 4px solid #ef4444; }
    .stat-card.purple { border-top: 4px solid #8b5cf6; }
    .stat-card.slate { border-top: 4px solid #64748b; }
    .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
    .stat-value { font-size: 36px; font-weight: 900; margin-top: 6px; color: #0f172a; }

    /* Gráficos */
    .charts-section { margin-bottom: 36px; }
    .charts-section h2 { font-size: 20px; font-weight: 800; margin-bottom: 20px; color: #0f172a; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .chart-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .chart-card h3 { font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 16px; }
    .chart-full { grid-column: 1 / -1; }
    canvas { max-height: 280px; }

    /* Postos */
    .postos-section h2 { font-size: 20px; font-weight: 800; margin-bottom: 20px; color: #0f172a; }
    .posto-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 20px;
    }
    .posto-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .posto-num {
      min-width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      color: white; font-size: 18px; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
    }
    .posto-info { flex: 1; }
    .posto-info h3 { font-size: 16px; font-weight: 800; color: #0f172a; }
    .posto-info p { font-size: 13px; color: #64748b; margin-top: 2px; }
    .posto-badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill-cyan { background: #e0f2fe; color: #0284c7; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
    .pill-emerald { background: #d1fae5; color: #065f46; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
    .pill-amber { background: #fef3c7; color: #92400e; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 700; }

    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin: 16px 0 10px; }

    /* Fotos */
    .fotos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 8px; }
    .foto-card { border-radius: 12px; overflow: hidden; border: 2px solid #e2e8f0; }
    .foto-card img { width: 100%; height: 130px; object-fit: cover; display: block; }
    .foto-info { padding: 8px; background: #f8fafc; }
    .foto-badge { border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 800; display: inline-block; margin-bottom: 4px; }
    .badge-in { background: #e0f2fe; color: #0284c7; }
    .badge-out { background: #d1fae5; color: #065f46; }
    .foto-nome { font-size: 11px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .foto-hora { font-size: 10px; color: #94a3b8; margin-top: 2px; }

    /* Tabela */
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 4px; }
    .data-table th { background: #f8fafc; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #e2e8f0; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #374151; }
    .data-table tr:last-child td { border-bottom: none; }
    .badge-in-sm { background: #e0f2fe; color: #0284c7; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; }
    .colega-badge { display: inline-block; background: #f1f5f9; color: #475569; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 600; margin-top: 3px; }
    .sem-dados { color: #94a3b8; font-size: 13px; font-style: italic; margin-top: 8px; }

    .footer { text-align: center; padding: 32px; color: #94a3b8; font-size: 12px; }
    @media (max-width: 700px) { .charts-grid { grid-template-columns: 1fr; } .fotos-grid { grid-template-columns: repeat(2, 1fr); } }
    @media print { body { background: white; } .chart-card, .posto-card, .stat-card { box-shadow: none; border: 1px solid #e2e8f0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏖️ Relatório Operacional — Guarda-vidas</h1>
    <p>Gerado em ${agora} &nbsp;|&nbsp; ${postos.length} postos &nbsp;|&nbsp; ${allRecords.length} registros totais</p>
  </div>

  <div class="container">

    <!-- Estatísticas -->
    <div class="stats-grid">
      <div class="stat-card cyan"><p class="stat-label">Check-ins</p><p class="stat-value">${totalCI}</p></div>
      <div class="stat-card emerald"><p class="stat-label">Check-outs</p><p class="stat-value">${totalCO}</p></div>
      <div class="stat-card amber"><p class="stat-label">Prevenções</p><p class="stat-value">${totalPrev}</p></div>
      <div class="stat-card red"><p class="stat-label">Incidentes</p><p class="stat-value">${totalInc}</p></div>
      <div class="stat-card purple"><p class="stat-label">Água-viva</p><p class="stat-value">${totalAV}</p></div>
      <div class="stat-card slate"><p class="stat-label">Postos</p><p class="stat-value">${postos.length}</p></div>
    </div>

    <!-- Gráficos -->
    <div class="charts-section">
      <h2>📊 Gráficos e Análises</h2>
      <div class="charts-grid">
        <div class="chart-card chart-full">
          <h3>Registros por Posto</h3>
          <canvas id="chartPostos"></canvas>
        </div>
        <div class="chart-card">
          <h3>Atividade — Últimos 7 dias</h3>
          <canvas id="chartLinha"></canvas>
        </div>
        <div class="chart-card">
          <h3>Distribuição por Posto</h3>
          <canvas id="chartPizza"></canvas>
        </div>
        <div class="chart-card chart-full">
          <h3>Prevenções, Incidentes e Lesões por Posto</h3>
          <canvas id="chartOcorrencias"></canvas>
        </div>
      </div>
    </div>

    <!-- Lista de postos -->
    <div class="postos-section">
      <h2>📋 Registros por Posto — Ordenados</h2>
      ${postoHTMLRows}
    </div>

  </div>

  <div class="footer">Relatório gerado automaticamente pelo sistema Lifeguard &nbsp;|&nbsp; ${agora}</div>

  <script>
    const defaults = { font: { family: "'Segoe UI', system-ui, sans-serif", size: 12 } };
    Chart.defaults.font.family = defaults.font.family;
    Chart.defaults.font.size = defaults.font.size;
    Chart.defaults.color = '#64748b';

    const gridColor = 'rgba(148,163,184,.15)';

    // ── Barras: registros por posto ──
    new Chart(document.getElementById('chartPostos'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(postoLabels)},
        datasets: [
          { label: 'Check-ins', data: ${JSON.stringify(postoCI)}, backgroundColor: '#06b6d4', borderRadius: 6 },
          { label: 'Check-outs', data: ${JSON.stringify(postoCO)}, backgroundColor: '#10b981', borderRadius: 6 },
        ]
      },
      options: {
        responsive: true, plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { color: gridColor } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: gridColor } }
        }
      }
    });

    // ── Linha: últimos 7 dias ──
    new Chart(document.getElementById('chartLinha'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(linhaLabels)},
        datasets: [
          { label: 'Check-ins', data: ${JSON.stringify(linhaCI)}, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,.1)', tension: .4, fill: true, pointRadius: 5 },
          { label: 'Check-outs', data: ${JSON.stringify(linhaCO)}, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', tension: .4, fill: true, pointRadius: 5 },
        ]
      },
      options: {
        responsive: true, plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { color: gridColor } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: gridColor } }
        }
      }
    });

    // ── Pizza: distribuição ──
    new Chart(document.getElementById('chartPizza'), {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(pizzaData.map((d) => d.label))},
        datasets: [{
          data: ${JSON.stringify(pizzaData.map((d) => d.value))},
          backgroundColor: ${JSON.stringify(pizzaColors.slice(0, pizzaData.length))},
          borderWidth: 2, borderColor: '#fff',
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });

    // ── Barras: ocorrências ──
    new Chart(document.getElementById('chartOcorrencias'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(postoLabels)},
        datasets: [
          { label: 'Prevenções', data: ${JSON.stringify(postoPrev)}, backgroundColor: '#f59e0b', borderRadius: 6 },
          { label: 'Incidentes', data: ${JSON.stringify(postoInc)}, backgroundColor: '#ef4444', borderRadius: 6 },
          { label: 'Água-viva', data: ${JSON.stringify(postoAV)}, backgroundColor: '#8b5cf6', borderRadius: 6 },
        ]
      },
      options: {
        responsive: true, plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { color: gridColor } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: gridColor } }
        }
      }
    });
  <\/script>
</body>
</html>`;
};

/* ─── Lightbox ─────────────────────────────────────────────────────────── */
const PhotoLightbox = ({ src, onClose }) => (
  <div className="lightbox-bg" onClick={onClose}>
    <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    <img src={src} alt="Foto ampliada" className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
  </div>
);

/* ─── Modal de detalhes ─────────────────────────────────────────────────── */
const CheckDetailModal = ({ row, tipoFiltro, onClose }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState(tipoFiltro === "Check-out" ? "Check-out" : "Check-in");

  const checkins = row.envios.filter((e) => e.tipo === "Check-in");
  const checkouts = row.envios.filter((e) => e.tipo === "Check-out");
  const visíveis = abaAtiva === "Check-in" ? checkins : checkouts;

  return (
    <>
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-box" style={{ maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <p className="section-label">Detalhes do posto</p>
              <h2 className="mt-0.5 text-xl font-bold">{String(row.numero).padStart(2, "0")} — {row.posto.nome}</h2>
              {row.posto.descricao && <p className="text-muted mt-0.5">{row.posto.descricao}</p>}
            </div>
            <button onClick={onClose} className="btn-sm-outline">Fechar</button>
          </div>
          <div className="aba-bar">
            <AbaBtn active={abaAtiva === "Check-in"} onClick={() => setAbaAtiva("Check-in")} count={checkins.length} color="cyan">Check-in</AbaBtn>
            <AbaBtn active={abaAtiva === "Check-out"} onClick={() => setAbaAtiva("Check-out")} count={checkouts.length} color="emerald">Check-out</AbaBtn>
          </div>
          <div className="modal-body">
            {visíveis.length === 0 ? (
              <div className="card-dashed flex flex-col items-center justify-center py-10 text-center">
                <p className="font-semibold text-slate-600">Nenhum {abaAtiva.toLowerCase()} neste posto.</p>
              </div>
            ) : (
              visíveis.map((envio, idx) => {
                const isCin = envio.tipo === "Check-in";
                const nome = envio.nomeGuarda || envio.userName || getUsuarioLabel(envio.usuario);
                const comp = envio.companheiro;
                const hora = envio.createdAt ? new Date(envio.createdAt).toLocaleString("pt-BR") : "N/A";
                return (
                  <div key={`envio-${envio.tipo}-${envio.id}-${idx}`} className={`overflow-hidden rounded-xl border ${isCin ? "border-cyan-200 bg-cyan-50" : "border-emerald-200 bg-emerald-50"}`}>
                    {envio.fotoUrl && isFotoValida(envio.fotoUrl) ? (
                      <button type="button" className="group relative block w-full" onClick={() => setLightboxSrc(envio.fotoUrl)}>
                        <img src={envio.fotoUrl} alt="" className="h-52 w-full object-cover transition group-hover:brightness-90 sm:h-64" onError={(e) => { e.target.style.display = "none"; }} />
                        <span className={`absolute left-3 top-3 badge ${isCin ? "badge-cyan" : "badge-emerald"} shadow-lg`}>{envio.tipo}</span>
                        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold text-white">🔍 Ver foto</span>
                      </button>
                    ) : (
                      <div className={`flex h-20 items-center justify-center gap-2 text-sm font-semibold ${isCin ? "bg-cyan-100 text-cyan-600" : "bg-emerald-100 text-emerald-600"}`}>
                        Sem foto registrada
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-bold text-slate-900">{nome}</p>
                      {comp && (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          Colega: {comp}
                        </span>
                      )}
                      <p className="text-muted mt-0.5">{hora}</p>
                      {!isCin && (
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/80 p-3 sm:grid-cols-4">
                          <MiniStat label="Prev. mat." value={envio.prevencoesMatutino ?? 0} />
                          <MiniStat label="Inc. mat." value={envio.incidentesMatutino ?? 0} />
                          <MiniStat label="Prev. vesp." value={envio.prevencoesVespertino ?? 0} />
                          <MiniStat label="Inc. vesp." value={envio.incidentesVespertino ?? 0} />
                          <MiniStat label="Água-viva" value={envio.lesoesPorAguaViva ?? 0} />
                          <MiniStat label="Rel. mat." value={envio.relatorioMatutino ?? 0} />
                          <MiniStat label="Rel. vesp." value={envio.relatorioVespertino ?? 0} />
                          <MiniStat label="Total" value={envio.relatorio ?? 0} highlight />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="modal-footer">
            <div className="flex items-center gap-4 text-sm">
              <span className={`flex items-center gap-1.5 font-semibold ${row.checkinEnviado ? "text-cyan-700" : "text-slate-400"}`}>
                <span className={`h-2 w-2 rounded-full ${row.checkinEnviado ? "bg-cyan-500" : "bg-slate-300"}`} />
                Check-in {row.checkinEnviado ? `(${checkins.length})` : "pendente"}
              </span>
              <span className={`flex items-center gap-1.5 font-semibold ${row.checkoutEnviado ? "text-emerald-700" : "text-slate-400"}`}>
                <span className={`h-2 w-2 rounded-full ${row.checkoutEnviado ? "bg-emerald-500" : "bg-slate-300"}`} />
                Check-out {row.checkoutEnviado ? `(${checkouts.length})` : "pendente"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ─── Lista de postos com fotos ─────────────────────────────────────────── */
const PostosListView = ({ postoRows, onOpenModal, onEditPosto, onDeletePosto }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const postosOrdenados = [...postoRows].sort((a, b) => a.numero - b.numero);

  return (
    <>
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div className="mt-3 grid gap-3">
        {postosOrdenados.map((row) => {
          const fotos = row.envios.filter((e) => isFotoValida(e.fotoUrl));
          const temDados = row.checkinEnviado || row.checkoutEnviado;
          const guardas = [...new Map(
            row.envios
              .filter((e) => e.tipo === "Check-in" && (e.nomeGuarda || e.userName))
              .map((e) => [e.nomeGuarda || e.userName, e])
          ).values()];

          return (
            <article
              key={`posto-${row.posto.id}`}
              className={`rounded-xl border p-4 transition ${temDados ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 ${temDados ? "posto-num-active" : "posto-num-idle"}`}>
                    {String(row.numero).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{row.posto.nome}</h3>
                    <p className="text-muted text-xs">{row.posto.descricao || "Sem descrição"}</p>
                    <div className="mt-1.5 flex gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${row.checkinEnviado ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${row.checkinEnviado ? "bg-cyan-500" : "bg-slate-300"}`} />
                        {row.envios.filter((e) => e.tipo === "Check-in").length} check-in
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${row.checkoutEnviado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${row.checkoutEnviado ? "bg-emerald-500" : "bg-slate-300"}`} />
                        {row.envios.filter((e) => e.tipo === "Check-out").length} check-out
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  <button type="button" onClick={() => onOpenModal(row, "Check-in")} className="btn-sm-outline">Ver check-in</button>
                  <button type="button" onClick={() => onOpenModal(row, "Check-out")} className="btn-sm-outline">Ver check-out</button>
                  <button type="button" onClick={() => onEditPosto(row)} className="btn-sm-outline">Editar</button>
                  <button type="button" onClick={() => onDeletePosto(row)} className="btn-sm-red">Excluir</button>
                </div>
              </div>

              {fotos.length > 0 && (
                <div className="mt-4">
                  <p className="text-muted-xs mb-2 font-bold uppercase tracking-wide">📸 Fotos dos guarda-vidas</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {fotos.slice(0, 6).map((envio, idx) => {
                      const nome = envio.nomeGuarda || envio.userName || "Guarda";
                      const isCin = envio.tipo === "Check-in";
                      return (
                        <button
                          key={`foto-${envio.tipo}-${envio.id}-${idx}`}
                          type="button"
                          className="group relative overflow-hidden rounded-xl border-2 border-slate-200 hover:border-cyan-400 transition-all duration-200 hover:shadow-md"
                          onClick={() => setLightboxSrc(envio.fotoUrl)}
                        >
                          <img src={envio.fotoUrl} alt={nome} className="aspect-square w-full object-cover transition group-hover:brightness-75" onError={(e) => { e.target.style.display = "none"; }} />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                            <p className="truncate text-[9px] font-bold text-white leading-tight">{nome}</p>
                            <span className={`inline-block rounded-full px-1 text-[8px] font-black ${isCin ? "bg-cyan-500 text-white" : "bg-emerald-500 text-white"}`}>
                              {isCin ? "IN" : "OUT"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {fotos.length > 6 && (
                      <button type="button" onClick={() => onOpenModal(row, "todos")}
                        className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:border-slate-400 hover:bg-slate-50 transition">
                        +{fotos.length - 6}<br />mais
                      </button>
                    )}
                  </div>
                </div>
              )}

              {fotos.length === 0 && guardas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {guardas.slice(0, 4).map((e, idx) => (
                    <span key={`guard-${e.id}-${idx}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      <span className="h-5 w-5 flex items-center justify-center rounded-full bg-slate-300 text-[10px] font-black text-slate-600">
                        {(e.nomeGuarda || e.userName || "?")[0]?.toUpperCase()}
                      </span>
                      {e.nomeGuarda || e.userName}
                    </span>
                  ))}
                  {guardas.length > 4 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">+{guardas.length - 4} mais</span>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {postosOrdenados.length === 0 && (
          <div className="card-dashed py-12 text-center">
            <p className="text-slate-500 font-medium">Nenhum posto cadastrado ainda.</p>
          </div>
        )}
      </div>
    </>
  );
};

/* ─── AdminDashboard ────────────────────────────────────────────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { entries, reports } = useTimesheet();

  const [checkins, setCheckins] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [postos, setPostos] = useState([]);
  const [guards, setGuards] = useState([]);
  const [loadingGuards, setLoadingGuards] = useState(false);
  const [activeTab, setActiveTab] = useState("envios");
  const [recordFilter, setRecordFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [postoForm, setPostoForm] = useState({ numero: "", nome: "", descricao: "" });
  const [editingPostoId, setEditingPostoId] = useState(null);

  const [guardForm, setGuardForm] = useState({ nome: "", cpf: "", senha: "" });
  const [editingGuardId, setEditingGuardId] = useState(null);

  const [modalRow, setModalRow] = useState(null);
  const [modalTipo, setModalTipo] = useState("todos");

  const isTestSession = user?.token?.startsWith("fake-") || user?.token?.endsWith("-cpf-token");

  useEffect(() => {
    if (!user || user.role !== "ADMIN") { navigate("/dashboard"); return; }
    try {
      localStorage.removeItem("entries");
      localStorage.removeItem("reports");
      indexedDB.deleteDatabase("OfflineQueueDB");
    } catch {}
    carregarDados();
  }, [user, navigate]); // eslint-disable-line

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [postosRes, insRes, outsRes] = await Promise.all([
        postoService.getAll(),
        isTestSession ? Promise.resolve({ data: [] }) : api.get("/admin/checkins"),
        isTestSession ? Promise.resolve({ data: [] }) : api.get("/admin/checkouts"),
      ]);
      setPostos(Array.isArray(postosRes.data) ? postosRes.data : []);
      setCheckins(Array.isArray(insRes.data) ? insRes.data : []);
      setCheckouts(Array.isArray(outsRes.data) ? outsRes.data : []);
    } catch {
      toast.error("Não foi possível carregar dados da API.");
      setPostos([]); setCheckins([]); setCheckouts([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "guardas") carregarGuardas();
  }, [activeTab]); // eslint-disable-line

  const carregarGuardas = async () => {
    setLoadingGuards(true);
    try {
      const res = await usuarioService.getAll();
      setGuards(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Erro ao carregar guardas.");
      setGuards([]);
    } finally { setLoadingGuards(false); }
  };

  const allRecords = useMemo(() => {
    return [
      ...checkins.map((r) => normalizeRecord(r, "Check-in")),
      ...checkouts.map((r) => normalizeRecord(r, "Check-out")),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [checkins, checkouts]);

  const filteredRecords = useMemo(() => {
    if (recordFilter === "checkin") return allRecords.filter((r) => r.tipo === "Check-in");
    if (recordFilter === "checkout") return allRecords.filter((r) => r.tipo === "Check-out");
    return allRecords;
  }, [allRecords, recordFilter]);

  const postoRows = useMemo(() => {
    const rows = buildPostoRows(postos, filteredRecords);
    const unique = [];
    const seenIds = new Set();
    for (const row of rows) {
      if (!seenIds.has(row.posto.id)) { seenIds.add(row.posto.id); unique.push(row); }
    }
    return unique.sort((a, b) => a.numero - b.numero);
  }, [postos, filteredRecords]);

  // postoRows com TODOS os registros (para relatório completo)
  const postoRowsAll = useMemo(() => {
    const rows = buildPostoRows(postos, allRecords);
    const unique = [];
    const seenIds = new Set();
    for (const row of rows) {
      if (!seenIds.has(row.posto.id)) { seenIds.add(row.posto.id); unique.push(row); }
    }
    return unique.sort((a, b) => a.numero - b.numero);
  }, [postos, allRecords]);

  /* ── Exportar Relatório HTML ── */
  const exportarRelatorio = () => {
    setExportando(true);
    try {
      const html = gerarRelatorioHTML(postoRowsAll, allRecords, postos);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_lifeguard_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
      toast.success("Relatório HTML exportado! Abra o arquivo no navegador para ver os gráficos.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar relatório.");
    } finally {
      setExportando(false);
    }
  };

  const handleCreatePosto = async (e) => {
    e.preventDefault();
    const numero = Number(postoForm.numero);
    if (isNaN(numero) || numero < 1) { toast.error("Informe um número de posto maior que zero."); return; }
    const prefix = `Posto ${String(numero).padStart(2, "0")}`;
    const nome = postoForm.nome.trim() ? `${prefix} - ${postoForm.nome.trim()}` : prefix;
    const data = { nome, descricao: postoForm.descricao.trim() };
    try {
      if (editingPostoId) {
        const r = await postoService.update(editingPostoId, data);
        setPostos((c) => c.map((p) => (p.id === editingPostoId ? { ...r.data, numero } : p)));
        toast.success("Posto atualizado.");
      } else {
        const r = await postoService.create(data);
        setPostos((c) => [...c.filter((p) => getPostoNumber(p) !== numero), { ...r.data, numero }].sort((a, b) => getPostoNumber(a) - getPostoNumber(b)));
        toast.success("Posto cadastrado.");
      }
    } catch {
      const local = { id: editingPostoId || numero, numero, ...data };
      setPostos((c) => [...c.filter((p) => getPostoNumber(p) !== numero), local].sort((a, b) => getPostoNumber(a) - getPostoNumber(b)));
      toast.success(editingPostoId ? "Posto atualizado localmente." : "Posto salvo localmente.");
    }
    setPostoForm({ numero: "", nome: "", descricao: "" });
    setEditingPostoId(null);
  };

  const handleEditPosto = (row) => {
    const base = row.posto.nome.replace(/^Posto \d+ - ?/, "").replace(/^Posto \d+$/, "");
    setPostoForm({ numero: String(row.numero), nome: base, descricao: row.posto.descricao || "" });
    setEditingPostoId(row.posto.id || row.numero);
    setActiveTab("postos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeletePosto = async (row) => {
    if (!window.confirm(`Remover "${row.posto.nome}"?`)) return;
    try {
      await postoService.delete(row.posto.id);
      setPostos((c) => c.filter((p) => p.id !== row.posto.id));
      toast.success("Posto removido.");
    } catch {
      setPostos((c) => c.filter((p) => getPostoNumber(p) !== row.numero));
      toast.success("Posto removido localmente.");
    }
  };

  const handleGuardSubmit = async (e) => {
    e.preventDefault();
    const nome = guardForm.nome.trim();
    const cpf = guardForm.cpf.replace(/\D/g, "").slice(0, 11);
    const senha = guardForm.senha;
    if (!nome || cpf.length < 3 || !senha) { toast.error("Preencha todos os campos corretamente."); return; }

    // Detecta se estamos editando a própria conta do admin logado
    const isEditandoProprioAdmin = editingGuardId && Number(editingGuardId) === Number(user?.id);

    const payload = { nome, cpf, senha, email: `${cpf}@guarda.local` };

    // Se for o próprio admin, incluir role para garantir que o backend preserve
    if (isEditandoProprioAdmin) {
      payload.role = "ADMIN";
      payload.nivelAcesso = "ADMIN";
    }

    try {
      if (editingGuardId) {
        await usuarioService.update(editingGuardId, payload);
        if (isEditandoProprioAdmin) {
          // Atualizar o nome no localStorage/contexto sem alterar role/id
          localStorage.setItem("userName", nome);
          toast.success("Sua conta foi atualizada! Role ADMIN preservado.");
        } else {
          toast.success("Guarda atualizado com sucesso!");
        }
      } else {
        await usuarioService.create(payload);
        toast.success("Guarda criado com sucesso!");
      }
      carregarGuardas();
      setGuardForm({ nome: "", cpf: "", senha: "" });
      setEditingGuardId(null);
    } catch (err) {
      toast.error("Erro ao salvar guarda. Tente novamente.");
      console.error(err);
    }
  };

  const handleEditGuard = (guard) => {
    setGuardForm({ nome: guard.nome || "", cpf: guard.cpf || "", senha: "" });
    setEditingGuardId(guard.id);
    setActiveTab("guardas");
  };

  const handleDeleteGuard = async (id) => {
    // Bloquear exclusão da própria conta admin
    if (Number(id) === Number(user?.id)) {
      toast.error("Você não pode remover a sua própria conta de administrador.");
      return;
    }
    if (!window.confirm("Remover este guarda?")) return;
    try {
      await usuarioService.delete(id);
      toast.success("Guarda removido.");
      carregarGuardas();
    } catch (err) {
      toast.error("Erro ao remover guarda.");
      console.error(err);
    }
  };

  const handleClearCheckins = async () => {
    if (isTestSession) { toast.success("Sessão de teste."); return; }
    if (!window.confirm("Remover todos os check-ins?")) return;
    try { await api.delete("/admin/checkins"); setCheckins([]); toast.success("Check-ins removidos."); carregarDados(); }
    catch { toast.error("Erro ao limpar check-ins."); }
  };

  const handleClearCheckouts = async () => {
    if (isTestSession) { toast.success("Sessão de teste."); return; }
    if (!window.confirm("Remover todos os check-outs?")) return;
    try { await api.delete("/admin/checkouts"); setCheckouts([]); toast.success("Check-outs removidos."); carregarDados(); }
    catch { toast.error("Erro ao limpar check-outs."); }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="mt-4 text-slate-600 font-medium">Carregando dados...</p>
      </div>
    </div>
  );

  return (
    <div className="page-bg">
      {modalRow && <CheckDetailModal row={modalRow} tipoFiltro={modalTipo} onClose={() => setModalRow(null)} />}

      <header className="header-bar">
        <div className="header-inner">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src="/logo-centenario.png"
              alt="CBMSC 100 anos"
              className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 object-contain drop-shadow-md"
            />
            <div className="min-w-0">
              <p className="header-label">Administração</p>
              <h1 className="header-title truncate">Painel do Administrador</h1>
              <p className="header-time">{currentTime.toLocaleString("pt-BR")}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button className="btn-sm-outline" onClick={() => navigate("/dashboard")}>Operacional</button>
            <button className="btn-sm-red" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>

      <main className="page-center-7xl">
        {isTestSession && (
          <div className="card-amber mb-4 text-sm font-semibold text-amber-800">
            Sessão de teste ativa. Dados reais da API podem não ser carregados.
          </div>
        )}

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatCard label="Check-ins" value={allRecords.filter((r) => r.tipo === "Check-in").length} />
          <StatCard label="Check-outs" value={allRecords.filter((r) => r.tipo === "Check-out").length} />
          <StatCard label="Postos" value={postos.length} />
        </section>

        <nav className="mt-4 -mx-4 sm:mx-0 flex gap-2 overflow-x-auto px-4 sm:px-0 pb-1 scrollbar-hide">
          {[["envios", "📋 Registros"], ["postos", "📍 Postos"], ["guardas", "👤 Guardas"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setActiveTab(v)}
              className={`shrink-0 ${activeTab === v ? "btn-nav-active-cyan" : "btn-nav-inactive"}`}>
              {l}
            </button>
          ))}
        </nav>

        {/* ── ABA ENVIOS ── */}
        {activeTab === "envios" && (
          <section className="mt-4 card-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Registros por posto</h2>
                <p className="text-muted">Postos ordenados por número. Clique nas fotos para ampliar.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterBtn active={recordFilter === "todos"} onClick={() => setRecordFilter("todos")}>Todos</FilterBtn>
                <FilterBtn active={recordFilter === "checkin"} onClick={() => setRecordFilter("checkin")}>Check-in</FilterBtn>
                <FilterBtn active={recordFilter === "checkout"} onClick={() => setRecordFilter("checkout")}>Check-out</FilterBtn>
                {/* Botão de exportação */}
                <button
                  type="button"
                  onClick={exportarRelatorio}
                  disabled={exportando}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                >
                  {exportando ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  {exportando ? "Gerando..." : "Exportar Relatório"}
                </button>
              </div>
            </div>

            <PostosListView
              postoRows={postoRows}
              onOpenModal={(row, tipo) => { setModalRow(row); setModalTipo(tipo); }}
              onEditPosto={handleEditPosto}
              onDeletePosto={handleDeletePosto}
            />

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button className="btn-sm-red" onClick={handleClearCheckins}>Limpar check-ins</button>
              <button className="btn-sm-outline" onClick={handleClearCheckouts}>Limpar check-outs</button>
            </div>
          </section>
        )}

        {/* ── ABA POSTOS ── */}
        {activeTab === "postos" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={handleCreatePosto} className="card-sm">
              <h2 className="text-lg font-bold">{editingPostoId ? "Editar posto" : "Adicionar posto"}</h2>
              {editingPostoId && <p className="text-xs text-amber-700 mt-1">Editando posto #{editingPostoId}.</p>}
              <div className="mt-3 grid gap-3">
                <Field label="Número do posto" htmlFor="postoNumero">
                  <input id="postoNumero" name="postoNumero" type="number" min="1"
                    value={postoForm.numero} onChange={(e) => setPostoForm({ ...postoForm, numero: e.target.value })}
                    className="form-input text-sm" required disabled={!!editingPostoId} />
                  <p className="text-muted-xs mt-1">Digite um número (ex: 1, 2, 100...)</p>
                </Field>
                <Field label="Nome" htmlFor="postoNome">
                  <input id="postoNome" name="postoNome" value={postoForm.nome}
                    onChange={(e) => setPostoForm({ ...postoForm, nome: e.target.value })}
                    className="form-input text-sm" placeholder="Ex: Praia Central" />
                </Field>
                <Field label="Descrição" htmlFor="postoDescricao">
                  <textarea id="postoDescricao" name="postoDescricao" value={postoForm.descricao}
                    onChange={(e) => setPostoForm({ ...postoForm, descricao: e.target.value })}
                    className="form-textarea text-sm" rows={2} />
                </Field>
                <div className="flex gap-2">
                  <button className="btn-cyan flex-1" type="submit">
                    {editingPostoId ? "Salvar alterações" : "Salvar posto"}
                  </button>
                  {editingPostoId && (
                    <button type="button" className="btn-sm-outline"
                      onClick={() => { setPostoForm({ numero: "", nome: "", descricao: "" }); setEditingPostoId(null); }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="card-sm">
              <h2 className="text-lg font-bold">Postos cadastrados</h2>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {buildPostoRows(postos, [])
                  .sort((a, b) => a.numero - b.numero)
                  .map((row) => (
                    <div key={`posto-list-${row.posto.id}`} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate-label text-xs">{String(row.numero).padStart(2, "0")} — {row.posto.nome}</p>
                        <p className="text-muted-xs truncate">{row.posto.descricao}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => handleEditPosto(row)} className="btn-sm-outline text-[11px]">Editar</button>
                        <button type="button" onClick={() => handleDeletePosto(row)} className="btn-sm-red text-[11px]">Excluir</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* ── ABA GUARDAS ── */}
        {activeTab === "guardas" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={handleGuardSubmit} className="card-sm">
              <h2 className="text-lg font-bold">{editingGuardId ? "Editar guarda" : "Criar conta de guarda-vidas"}</h2>
              <div className="mt-3 grid gap-3">
                <Field label="Nome" htmlFor="guardNome">
                  <input id="guardNome" name="guardNome" value={guardForm.nome}
                    onChange={(e) => setGuardForm({ ...guardForm, nome: e.target.value })}
                    className="form-input text-sm" required />
                </Field>
                <Field label="CPF" htmlFor="guardCpf">
                  <input id="guardCpf" name="guardCpf" inputMode="numeric" value={guardForm.cpf}
                    onChange={(e) => setGuardForm({ ...guardForm, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                    className="form-input text-sm" placeholder="Somente números" required />
                </Field>
                <Field label="Senha" htmlFor="guardSenha">
                  <input id="guardSenha" name="guardSenha" type="password" value={guardForm.senha}
                    onChange={(e) => setGuardForm({ ...guardForm, senha: e.target.value })}
                    className="form-input text-sm" required />
                </Field>
                <div className="flex gap-2">
                  <button className="btn-emerald flex-1" type="submit">
                    {editingGuardId ? "Salvar alterações" : "Criar conta"}
                  </button>
                  {editingGuardId && (
                    <button type="button" className="btn-sm-outline"
                      onClick={() => { setGuardForm({ nome: "", cpf: "", senha: "" }); setEditingGuardId(null); }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="card-sm">
              <h2 className="text-lg font-bold">Todos os guardas</h2>
              <p className="text-muted mt-1">
                {loadingGuards ? "Carregando..." : `${guards.length} guarda(s) encontrado(s).`}
              </p>
              <div className="mt-3 grid gap-1.5">
                {guards.length === 0 && !loadingGuards && (
                  <div className="card-dashed text-sm text-slate-500">Nenhum guarda cadastrado.</div>
                )}
                {guards.map((g) => {
                  const isSelf = Number(g.id) === Number(user?.id);
                  const isAdmin = g.role === "ADMIN" || g.nivelAcesso === "ADMIN" || isSelf;
                  return (
                    <div
                      key={`guard-${g.id}`}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${
                        isSelf
                          ? "border-cyan-300 bg-cyan-50 ring-1 ring-cyan-200"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isSelf ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600"
                        }`}>
                          {(g.nome || "?")[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold text-sm">{g.nome}</p>
                            {isSelf && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-700">
                                🔐 Você (Admin)
                              </span>
                            )}
                            {!isSelf && isAdmin && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-xs">CPF: {g.cpf}</p>
                          {g.email && <p className="text-muted-xs">{g.email}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditGuard(g)}
                          className="btn-sm-outline text-[11px]"
                        >
                          {isSelf ? "Editar minha conta" : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuard(g.id)}
                          disabled={isSelf}
                          title={isSelf ? "Não é possível remover sua própria conta" : "Remover guarda"}
                          className={`text-[11px] ${
                            isSelf
                              ? "btn-sm cursor-not-allowed border border-slate-200 text-slate-300"
                              : "btn-sm-red"
                          }`}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

/* ─── Componentes auxiliares ─────────────────────────────────────────────── */
const StatCard = ({ label, value }) => (
  <div className="stat-card">
    <p className="stat-label">{label}</p>
    <p className="stat-value">{value}</p>
  </div>
);

const FilterBtn = ({ active, children, onClick }) => (
  <button type="button" onClick={onClick}
    className={`btn-sm ${active ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
    {children}
  </button>
);

const MiniStat = ({ label, value, highlight }) => (
  <div className={highlight ? "mini-stat-hl" : "mini-stat"}>
    <p className="mini-stat-label">{label}</p>
    <p className={highlight ? "mini-stat-value-hl" : "mini-stat-value"}>{value}</p>
  </div>
);

const AbaBtn = ({ active, onClick, count, color, children }) => (
  <button type="button" onClick={onClick}
    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${active ? (color === "emerald" ? "bg-emerald-600 text-white shadow-sm" : "bg-cyan-600 text-white shadow-sm") : "text-slate-500 hover:text-slate-800"}`}>
    {children}
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"}`}>
      {count}
    </span>
  </button>
);

const Field = ({ label, htmlFor, children }) => (
  <label className="block" htmlFor={htmlFor}>
    <span className="form-label">{label}</span>
    {children}
  </label>
);

export default AdminDashboard;