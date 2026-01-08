const API_BASE = "http://localhost:5174";

let state = {
  days: 7,
  metric: "score", // score | lp | wr
  selected: new Set(), // player ids
  allIds: [],
  allNames: {},
  lastData: null,
};

function $(id) { return document.getElementById(id); }

function fmtTs(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function setActive(groupSelector, attr, value) {
  document.querySelectorAll(groupSelector).forEach(btn => {
    btn.classList.toggle("seg__btn--active", btn.getAttribute(attr) === value);
  });
}

function buildPicker(ids, names) {
  const root = $("picker");
  root.innerHTML = "";

  ids.forEach((id) => {
    const btn = document.createElement("button");
    btn.className = "pick";
    btn.type = "button";
    btn.textContent = names[id] || id;
    btn.dataset.id = id;

    btn.onclick = () => {
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);

      btn.classList.toggle("pick--active", state.selected.has(id));
      render();
    };

    root.appendChild(btn);
  });
}

function metricLabel() {
  if (state.metric === "lp") return "LP";
  if (state.metric === "wr") return "WR (%)";
  return "Score (rang+LP)";
}

// ------- Simple Canvas chart -------
function drawChart(payload) {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const tooltip = $("tooltip");

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  tooltip.style.display = "none";

  const series = payload.series || [];
  const shown = series.filter(s => state.selected.size === 0 ? true : state.selected.has(s.id));

  // empty state
  if (!shown.length) {
    ctx.font = "16px system-ui";
    ctx.fillText("Aucune donnée (ou aucun joueur sélectionné).", 20, 40);
    return;
  }

  // collect points
  const pointsAll = shown.flatMap(s => s.points || []).filter(p => Number.isFinite(p.value));
  if (!pointsAll.length) return;

  const pad = { l: 60, r: 20, t: 20, b: 40 };
  const W = canvas.width, H = canvas.height;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  let minX = Math.min(...pointsAll.map(p => p.ts));
  let maxX = Math.max(...pointsAll.map(p => p.ts));
  let minY = Math.min(...pointsAll.map(p => p.value));
  let maxY = Math.max(...pointsAll.map(p => p.value));

  // make nicer range
  if (minY === maxY) { minY -= 1; maxY += 1; }

  const xToPx = (x) => pad.l + ((x - minX) / (maxX - minX || 1)) * innerW;
  const yToPx = (y) => pad.t + (1 - ((y - minY) / (maxY - minY || 1))) * innerH;

  // axes
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(245,200,106,.25)";
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, H - pad.b);
  ctx.lineTo(W - pad.r, H - pad.b);
  ctx.stroke();

  // y labels (5)
  ctx.fillStyle = "rgba(232,237,247,.75)";
  ctx.font = "12px system-ui";
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const yVal = minY + (1 - t) * (maxY - minY);
    const y = pad.t + t * innerH;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "rgba(232,237,247,.08)";
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    const label = state.metric === "wr" ? `${Math.round(yVal)}%` : `${Math.round(yVal)}`;
    ctx.fillText(label, 10, y + 4);
  }

  // x labels (min/max)
  ctx.globalAlpha = 0.9;
  ctx.fillText(fmtTs(minX), pad.l, H - 12);
  const txtMax = fmtTs(maxX);
  const wMax = ctx.measureText(txtMax).width;
  ctx.fillText(txtMax, W - pad.r - wMax, H - 12);

  // draw lines (color per serie based on hash)
  function colorFor(id) {
    // deterministic hue
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return `hsl(${h} 70% 65%)`;
  }

  const hitPoints = []; // for tooltip

  shown.forEach(s => {
    const pts = (s.points || []).filter(p => Number.isFinite(p.value)).sort((a,b)=>a.ts-b.ts);
    if (pts.length < 2) return;

    const col = colorFor(s.id);

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;

    ctx.beginPath();
    pts.forEach((p, idx) => {
      const x = xToPx(p.ts);
      const y = yToPx(p.value);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      hitPoints.push({ x, y, s, p, col });
    });
    ctx.stroke();

    // points
    ctx.fillStyle = col;
    pts.forEach(p => {
      const x = xToPx(p.ts);
      const y = yToPx(p.value);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // label at end
    const last = pts[pts.length - 1];
    const lx = xToPx(last.ts) + 8;
    const ly = yToPx(last.value);
    ctx.font = "12px system-ui";
    ctx.fillStyle = col;
    ctx.fillText(s.name, Math.min(lx, W - pad.r - 80), ly + 4);
  });

  // tooltip interaction
  canvas.onmousemove = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const my = (ev.clientY - rect.top) * (canvas.height / rect.height);

    let best = null;
    let bestD = 999999;

    for (const hp of hitPoints) {
      const dx = hp.x - mx;
      const dy = hp.y - my;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; best = hp; }
    }

    if (!best || bestD > 16*16) {
      tooltip.style.display = "none";
      return;
    }

    const p = best.p;
    tooltip.style.display = "block";
    tooltip.style.left = `${ev.clientX - rect.left + 12}px`;
    tooltip.style.top = `${ev.clientY - rect.top + 12}px`;

    const line1 = `<div class="ttTitle">${best.s.name}</div>`;
    const line2 = `<div class="ttSub">${fmtTs(p.ts)}</div>`;
    const line3 =
      state.metric === "wr"
        ? `<div class="ttVal"><span>WR</span><b>${Math.round(p.value)}%</b></div>`
        : state.metric === "lp"
          ? `<div class="ttVal"><span>LP</span><b>${Math.round(p.value)}</b></div>`
          : `<div class="ttVal"><span>Rang</span><b>${p.tier} ${p.division} • ${p.lp} LP</b></div>`;
    const line4 = `<div class="ttSub">Games: ${p.games} • WR: ${Math.round(p.winRate)}%</div>`;

    tooltip.innerHTML = line1 + line2 + line3 + line4;
  };

  canvas.onmouseleave = () => {
    tooltip.style.display = "none";
  };
}

async function loadData() {
  const players = state.selected.size ? Array.from(state.selected).join(",") : "all";
  const url = `${API_BASE}/api/elo-history?days=${state.days}&metric=${encodeURIComponent(state.metric)}&players=${encodeURIComponent(players)}`;
  return fetchJson(url);
}

async function render() {
  const meta = $("metaGraph");
  meta.textContent = "Chargement…";

  try {
    const data = await loadData();
    state.lastData = data;

    $("queuePill").textContent = (data.queueId === 440) ? "Flex" : "SoloQ";
    meta.textContent = `maj: ${new Date(data.generatedAt).toLocaleString("fr-FR")} • ${metricLabel()} • ${state.days}j`;

    drawChart(data);
  } catch (e) {
    meta.textContent = `Erreur: ${e.message}`;
    console.error(e);
  }
}

async function init() {
  // boutons days
  document.querySelectorAll("[data-days]").forEach(btn => {
    btn.onclick = () => {
      state.days = Number(btn.dataset.days);
      setActive("[data-days]", "data-days", String(state.days));
      render();
    };
  });

  // boutons metric
  document.querySelectorAll("[data-metric]").forEach(btn => {
    btn.onclick = () => {
      state.metric = String(btn.dataset.metric);
      setActive("[data-metric]", "data-metric", state.metric);
      render();
    };
  });

  $("btnAll").onclick = () => {
    state.selected.clear(); // empty => show all
    document.querySelectorAll(".pick").forEach(b => b.classList.remove("pick--active"));
    render();
  };

  $("btnClear").onclick = () => {
    state.selected.clear();
    document.querySelectorAll(".pick").forEach(b => b.classList.remove("pick--active"));
    render();
  };

  // On récupère la liste joueurs depuis /api/elo (cache OK)
  try {
    const elo = await fetchJson(`${API_BASE}/api/elo`);
    state.allIds = (elo.players || []).map(p => p.id);
    state.allNames = Object.fromEntries((elo.players || []).map(p => [p.id, p.name]));
    buildPicker(state.allIds, state.allNames);
  } catch {
    // fallback (pas bloquant)
    buildPicker([], {});
  }

  render();
}

init();
