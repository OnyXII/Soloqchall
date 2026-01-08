const API_BASE = "https://soloqchall.onrender.com";
const API_STATS = `${API_BASE}/api/stats`;

function avatarSrc(playerId) {
  return `./Image/${playerId}.png`;
}

function fmtInt(n) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
}

function fmtDec2(n) {
  return Number(n || 0).toFixed(2).replace(".", ",");
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Réponse non-JSON depuis ${url} (status ${res.status}, content-type: ${ct}). Début: ${text.slice(0, 120)}`
    );
  }

  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function attachFallback(img) {
  if (!img) return;
  img.onerror = () => {
    img.src = "./Image/default.png";
  };
}

function renderKdaTop(kdaList, sampleGames) {
  const root = document.getElementById("kda");
  root.innerHTML = "";

  safeArr(kdaList).slice(0, 5).forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "kda__item";

    el.innerHTML = `
      <div class="kda__rank">${i + 1}</div>
      <div class="kda__avatar">
        <img src="${avatarSrc(p.id)}" alt="">
      </div>
      <div class="kda__text">
        <div class="kda__line">
          <div class="kda__value">${fmtDec2(p.kda)}</div>
          <div class="kda__name">${p.name}</div>
        </div>
        <div class="kda__games">${p.games ?? sampleGames ?? 0} games</div>
      </div>
    `;

    attachFallback(el.querySelector("img"));
    root.appendChild(el);
  });
}

function metricConfig(key) {
  switch (key) {
    case "kills": return { label: "KILLS", value: (p) => fmtInt(p.kills) };
    case "deaths": return { label: "DEATHS", value: (p) => fmtInt(p.deaths) };
    case "assists": return { label: "ASSISTS", value: (p) => fmtInt(p.assists) };
    case "csMin": return { label: "CS/MIN", value: (p) => fmtDec2(p.csMin) };
    default: return { label: String(key).toUpperCase(), value: () => "0" };
  }
}

function renderMetricSection(key, list, sampleGames) {
  const cfg = metricConfig(key);
  const arr = safeArr(list);
  const top = arr[0];

  const section = document.createElement("div");
  section.className = "section";

  section.innerHTML = `
    <div class="section__title">${cfg.label}</div>

    <div class="winner">
      <div class="winner__avatar">
        <img src="${avatarSrc(top?.id || "default")}" alt="">
      </div>
      <div class="winner__value">${top ? cfg.value(top) : "0"}</div>
      <div class="winner__name">${top?.name || "—"}</div>
      <div class="winner__games">${top?.games ?? sampleGames ?? 0} games</div>
    </div>

    <div class="mini"></div>
  `;

  attachFallback(section.querySelector(".winner img"));

  const mini = section.querySelector(".mini");
  arr.slice(1, 5).forEach((p) => {
    const row = document.createElement("div");
    row.className = "mini__row";
    row.innerHTML = `
      <div class="mini__left">
        <div class="mini__avatar"><img src="${avatarSrc(p.id)}" alt=""></div>
        <div class="mini__name">${p.name}</div>
      </div>
      <div class="mini__right">
        <div class="mini__value">${cfg.value(p)}</div>
        <div class="mini__games">${p.games ?? sampleGames ?? 0} games</div>
      </div>
    `;
    attachFallback(row.querySelector("img"));
    mini.appendChild(row);
  });

  return section;
}

function renderAll(data) {
  const sampleGames = Number(data?.sampleSoloQPerPlayer ?? 0);

  const pill = document.getElementById("pill");
  if (pill) pill.textContent = "Solo/Duo uniquement";

  renderKdaTop(data?.leaderboards?.kda, sampleGames);

  const sectionsRoot = document.getElementById("sections");
  sectionsRoot.innerHTML = "";
  ["kills", "deaths", "assists", "csMin"].forEach((k) => {
    sectionsRoot.appendChild(renderMetricSection(k, data?.leaderboards?.[k], sampleGames));
  });

  const meta = document.getElementById("meta");
  meta.textContent = `sample: ${sampleGames} SoloQ/joueur (source: ${API_STATS})`;
}

async function init() {
  const meta = document.getElementById("meta");
  meta.textContent = "Chargement…";

  try {
    const data = await fetchJson(API_STATS);
    renderAll(data);
  } catch (e) {
    console.error(e);
    meta.textContent = `Erreur API: ${e.message}`;
  }
}

document.addEventListener("DOMContentLoaded", init);

