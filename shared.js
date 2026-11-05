// Configuração padrão e lógica compartilhada entre popup e content script
const DEFAULT_CONFIG = {
  enabled: true,
  mode: "schedule", // "schedule" = por horário | "manual" = atendente fixo
  manualIndex: 0,
  groups: false, // usar também em grupos?
  attendants: [
    { name: "Atendente 1", start: "00:00", end: "23:59", enabled: true }
  ]
};

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Retorna o atendente ativo agora (ou null se nenhum)
function getActiveAttendant(cfg, date = new Date()) {
  if (!cfg || !cfg.enabled) return null;
  const list = cfg.attendants || [];

  if (cfg.mode === "manual") {
    return list[cfg.manualIndex] || null;
  }

  const now = date.getHours() * 60 + date.getMinutes();
  for (const a of list) {
    if (a.enabled === false || !a.name || !a.name.trim()) continue;
    const s = toMinutes(a.start);
    const e = toMinutes(a.end);
    if (s === e) return a; // 24h
    const inRange = s < e ? now >= s && now < e : now >= s || now < e; // vira a meia-noite
    if (inRange) return a;
  }
  return null;
}
