const API_BASE = "http://localhost:5174";
const API_STATS = `${API_BASE}/api/stats`;

const METRICS = [
  { key: "kills",   label: "KILLS",   fmt: (v) => fmtInt(v) },
  { key: "deaths",  label: "DEATHS",  fmt: (v) => fmtInt(v) },
  { key: "assists", label: "ASSISTS", fmt: (v) => fmtInt(v) },
  { key: "csMin",   label: "CS/MIN",  fmt: (v) => Number(v || 0).toFixed(2).replace(".", ",") },
];

function fmtInt(n){ return new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)); }
function avatarSrc(playerId){ return `./Image/${playerId}.png`; }

async function fetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function imgFallback(img){
  img.onerror = () => { img.src = "./Image/default.png"; };
}

function renderKdaTop(kdaList, sampleGames){
  const root = document.getElementById("kdaTop");
  root.innerHTML = "";

  (kdaList || []).slice(0,5).forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "kdaItem";

    const val = Number(p.kda || 0).toFixed(2).replace(".", ",");
    const gamesTxt = `${p.sampleGames ?? sampleGames ?? 0} games`;

    item.innerHTML = `
      <div class="kdaRank">${i+1}</div>
      <div class="avatarRing">
        <img class="avatarImg" src="${avatarSrc(p.id)}" alt="">
      </div>
      <div class="kdaVal">${val}</div>
      <div class="kdaName">${p.name}</div>
      <div class="kdaGames">${gamesTxt}</div>
    `;

    imgFallback(item.querySelector("img"));
    root.appendChild(item);
  });
}

function renderMetricColumn(metricKey, label, fmt, list, sampleGames){
  const col = document.createElement("div");
  col.className = "col";

  const top = (list && list[0]) ? list[0] : null;
  const topVal = top ? fmt(top[metricKey]) : fmt(0);
  const topName = top ? top.name : "—";
  const topGames = `${top?.sampleGames ?? sampleGames ?? 0} games`;

  col.innerHTML = `
    <div class="colTitle">${label}</div>

    <div class="winner">
      <div class="winnerLeft">
        <div class="avatarRing bigRing">
          <img class="avatarImg" src="${avatarSrc(top?.id || "default")}" alt="">
        </div>
      </div>

      <div class="winnerRight">
        <div class="winnerVal">${topVal}</div>
        <div class="winnerName">${topName}</div>
        <div class="winnerGames">${topGames}</div>
      </div>
    </div>

    <div class="miniList"></div>
  `;

  const img = col.querySelector(".winner img");
  imgFallback(img);

  const mini = col.querySelector(".miniList");

  // on affiche les suivants (2..5)
  (list || []).slice(1,5).forEach(p => {
    const row = document.createElement("div");
    row.className = "miniRow";

    const v = fmt(p[metricKey]);
    const gamesTxt = `${p.sampleGames ?? sampleGames ?? 0} games`;

    row.innerHTML = `
      <div class="miniLeft">
        <div class="miniAvatar">
          <img src="${avatarSrc(p.id)}" alt="">
        </div>
        <div class="miniName">${p.name}</div>
      </div>
      <div class="miniRight">
        <div class="miniVal">${v}</div>
        <div class="miniGames">${gamesTxt}</div>
      </div>
    `;

    imgFallback(row.querySelector("img"));
    mini.appendChild(row);
  });

  return col;
}

function renderAll(data){
  const meta = document.getElementById("meta");
  const sampleGames = data.sampleSoloQPerPlayer;

  renderKdaTop(data.leaderboards?.kda, sampleGames);

  const cols = document.getElementById("cols");
  cols.innerHTML = "";

  for (const m of METRICS){
    const list = data.leaderboards?.[m.key] || [];
    cols.appendChild(renderMetricColumn(m.key, m.label, m.fmt, list, sampleGames));
  }

  const cached = data.cached ? " • cache" : "";
  meta.textContent = `maj: ${new Date(data.generatedAt).toLocaleString()}${cached} • sample: ${sampleGames} SoloQ/joueur`;
}

async function init(){
  const meta = document.getElementById("meta");
  meta.textContent = "Chargement…";

  try{
    const data = await fetchJson(API_STATS);
    renderAll(data);
  }catch(e){
    meta.textContent = `Erreur API: ${e.message}`;
  }
}

init();
