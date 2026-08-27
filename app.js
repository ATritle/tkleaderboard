(() => {
  "use strict";

  const state = {
    incidents: [],
    players: [],
    mapImages: [],
    filtered: []
  };

  const $ = id => document.getElementById(id);

  function norm(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function display(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[ch]));
  }

  async function fetchJson(path) {
    const url = new URL(path, document.baseURI);
    url.searchParams.set("v", Date.now().toString());

    const response = await fetch(url.href, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`${path} HTTP ${response.status}`);
    }

    return response.json();
  }

  function normalizePlayers(data) {
    const list = Array.isArray(data) ? data : [];

    return [
      ...new Map(
        list.map(item => {
          const name = typeof item === "string"
            ? display(item)
            : display(item?.name);

          const image = typeof item === "string"
            ? ""
            : display(item?.image);

          return [norm(name), { name, image }];
        }).filter(([key, player]) => key && player.name)
      ).values()
    ];
  }

  /*
   * Resolve an image relative to the current GitHub Pages site.
   * This is important because tkleaderboard is a project site, not the
   * root of the github.io domain.
   */
  function siteAsset(path) {
    const clean = String(path ?? "").trim().replace(/^\/+/, "");

    if (!clean) return "";

    if (/^(https?:)?\/\//i.test(clean)) {
      return clean;
    }

    return new URL(clean, document.baseURI).href;
  }

  function playerImageFile(name) {
    const player = state.players.find(
      p => norm(p.name) === norm(name)
    );

    return player?.image || "";
  }

  function playerNameHtml(name) {
    const shown = display(name);
    const image = playerImageFile(shown);

    if (!image) {
      return esc(shown);
    }

    const src = siteAsset(
      image.startsWith("assets/") ? image : `assets/${image}`
    );

    return `
      <span class="hover-target player-hover" tabindex="0">
        <span class="hover-label">${esc(shown)}</span>
        <span class="hover-card" role="tooltip">
          <img
            class="hover-image"
            src="${esc(src)}"
            alt="${esc(shown)}"
            loading="eager"
            decoding="async"
          >
          <span class="hover-card-name">${esc(shown)}</span>
        </span>
      </span>
    `;
  }

  function mapImageFile(mapName) {
    const wanted = norm(mapName);

    return state.mapImages.find(file => {
      const filename = display(file);
      const stem = filename.replace(/\.[^.]+$/, "");
      return norm(stem) === wanted;
    }) || "";
  }

  function mapNameHtml(mapName) {
    const shown = display(mapName);
    const file = mapImageFile(shown);

    if (!file) {
      return esc(shown);
    }

    const src = siteAsset(`assets/maps/${file}`);

    return `
      <span class="hover-target map-hover" tabindex="0">
        <span class="hover-label">${esc(shown)}</span>
        <span class="hover-card" role="tooltip">
          <img
            class="hover-image"
            src="${esc(src)}"
            alt="${esc(shown)} map"
            loading="eager"
            decoding="async"
          >
          <span class="hover-card-name">${esc(shown)}</span>
        </span>
      </span>
    `;
  }

  function countBy(selector) {
    return state.incidents.reduce((counts, incident) => {
      const key = selector(incident);
      if (key) counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function originalValue(key, field) {
    const incident = state.incidents.find(
      item => norm(item[field]) === key
    );

    return incident ? display(incident[field]) : key;
  }

  function mostFrequentMap() {
    const counts = countBy(item => norm(item.map));

    const result = Object.entries(counts)
      .sort((a, b) =>
        b[1] - a[1] || a[0].localeCompare(b[0])
      )[0];

    if (!result) return "";

    return originalValue(result[0], "map");
  }

  function topPlayer(counts, field) {
    const result = Object.entries(counts)
      .sort((a, b) =>
        b[1] - a[1] || a[0].localeCompare(b[0])
      )[0];

    return result
      ? playerNameHtml(originalValue(result[0], field))
      : "—";
  }

  function sortIncidents(a, b) {
    return String(b.date).localeCompare(String(a.date)) ||
           String(b.id).localeCompare(String(a.id));
  }

  function formatDate(value) {
    const date = new Date(`${value}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return esc(value);
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function tableHeader() {
    return `
      <div class="table-head">
        <span>TK ID</span>
        <span>KILLER</span>
        <span>VICTIM</span>
        <span>DATE</span>
        <span>MAP</span>
        <span>NOTES</span>
        <span>CLIP</span>
      </div>
    `;
  }

  function incidentRow(incident) {
    return `
      <div class="incident-row">
        <span class="tkid">${esc(incident.id)}</span>
        <span class="killer">${playerNameHtml(incident.killer)}</span>
        <span class="victim">${playerNameHtml(incident.victim)}</span>
        <span class="date">${formatDate(incident.date)}</span>
        <span class="map">${mapNameHtml(incident.map)}</span>
        <span class="notes">${esc(incident.notes || "No notes recorded.")}</span>
        <span>
          ${incident.clip
            ? `<a class="clip-icon" href="${esc(incident.clip)}" target="_blank" rel="noopener" aria-label="Open clip">↗</a>`
            : ""}
        </span>
      </div>
    `;
  }

  function populateFilters() {
    const maps = [
      ...new Set(
        state.incidents
          .map(item => display(item.map))
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b));

    const players = [
      ...new Map(
        state.incidents
          .map(item => display(item.killer))
          .filter(Boolean)
          .map(name => [norm(name), name])
      ).values()
    ].sort((a, b) => a.localeCompare(b));

    $("mapFilter").innerHTML =
      `<option value="">All Maps</option>` +
      maps.map(map => `<option value="${esc(map)}">${esc(map)}</option>`).join("");

    $("playerFilter").innerHTML =
      `<option value="">All Players</option>` +
      players.map(player => `<option value="${esc(player)}">${esc(player)}</option>`).join("");
  }

  function applyFilters() {
    const search = norm($("searchInput").value);
    const map = $("mapFilter").value;
    const player = norm($("playerFilter").value);

    state.filtered = state.incidents
      .filter(incident => {
        const text = [
          incident.id,
          incident.killer,
          incident.victim,
          incident.date,
          incident.map,
          incident.notes
        ].join(" ").toLowerCase();

        return (
          (!search || text.includes(search)) &&
          (!map || incident.map === map) &&
          (!player ||
            norm(incident.killer) === player ||
            norm(incident.victim) === player)
        );
      })
      .sort(sortIncidents);

    renderIncidentTable();
  }

  function renderIncidentTable() {
    $("incidentTable").innerHTML =
      tableHeader() +
      state.filtered.map(incidentRow).join("");

    $("empty").classList.toggle(
      "hidden",
      state.filtered.length !== 0
    );
  }

  function renderRecent() {
    const recent = [...state.incidents]
      .sort(sortIncidents)
      .slice(0, 5);

    $("dashboardRecent").innerHTML = recent.length
      ? tableHeader() + recent.map(incidentRow).join("")
      : `<div class="empty"><p>No incidents recorded yet.</p></div>`;
  }

  function renderLeaderboard() {
    const killerCounts = countBy(item => norm(item.killer));

    const names = Object.keys(killerCounts)
      .sort((a, b) =>
        killerCounts[b] - killerCounts[a] ||
        a.localeCompare(b)
      );

    $("leaderboard").innerHTML = names.length
      ? `
        <div class="rank-card table-label">
          <div>#</div>
          <div>PLAYER</div>
          <div class="rank-count">TEAM KILLS</div>
          <div class="rank-count">VICTIMS</div>
          <div class="rank-count">VICTIMIZED</div>
          <div class="rank-count">TK RATIO</div>
        </div>
        ${names.map((key, index) => {
          const kills = killerCounts[key];

          const uniqueVictims = new Set(
            state.incidents
              .filter(item => norm(item.killer) === key)
              .map(item => norm(item.victim))
          ).size;

          const received = state.incidents.filter(item =>
            norm(item.killer) !== key &&
            norm(item.victim) === key
          ).length;

          const total = kills + received;
          const ratio = total
            ? Math.round(kills / total * 100)
            : 100;

          return `
            <div class="rank-card">
              <div class="rank">${index + 1}</div>
              <div class="rank-name">
                ${playerNameHtml(originalValue(key, "killer"))}
              </div>
              <div class="rank-count"><strong>${kills}</strong></div>
              <div class="rank-count"><strong>${uniqueVictims}</strong></div>
              <div class="rank-count"><strong>${received}</strong></div>
              <div class="rank-count"><strong>${ratio}%</strong></div>
            </div>
          `;
        }).join("")}
      `
      : `<div class="empty"><p>No team killers recorded yet.</p></div>`;
  }

  function render() {
    const kills = state.incidents.length;
    const killerCounts = countBy(item => norm(item.killer));
    const victimCounts = countBy(item => norm(item.victim));
    const map = mostFrequentMap();

    $("totalKills").textContent = kills;

    $("recordCount").textContent =
      `${kills} ${kills === 1 ? "INCIDENT" : "INCIDENTS"}`;

    /*
     * The leaderboard only counts players who have TK'd.
     * Victims are intentionally not added to the player count.
     */
    $("playerCount").textContent =
      Object.keys(killerCounts).length;

    $("mapCount").innerHTML =
      map ? mapNameHtml(map) : "—";

    $("topKiller").innerHTML =
      topPlayer(killerCounts, "killer");

    $("topVictim").innerHTML =
      topPlayer(victimCounts, "victim");

    renderLeaderboard();
    renderIncidentTable();
    renderRecent();
  }

  function updateTimestamp() {
    const now = new Date();

    const date = now.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).toUpperCase();

    const time = now.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });

    $("lastUpdated").textContent =
      `DATA UPDATED — ${date} ${time}`;
  }

  async function loadData() {
    try {
      const [incidents, players, maps] = await Promise.all([
        fetchJson("data/teamkills.json"),
        fetchJson("data/players.json"),
        fetchJson("data/map-images.json")
      ]);

      state.incidents = Array.isArray(incidents)
        ? incidents
        : [];

      state.players = normalizePlayers(players);

      state.mapImages = Array.isArray(maps)
        ? maps.map(display).filter(Boolean)
        : [];

      state.filtered = [...state.incidents];

      updateTimestamp();
      populateFilters();
      render();
    } catch (error) {
      console.error("TK Leaderboard failed to load data:", error);

      state.incidents = [];
      state.players = [];
      state.mapImages = [];
      state.filtered = [];

      $("recordCount").textContent = "DATA ERROR";
      $("lastUpdated").textContent = "UNABLE TO LOAD DATA";
      render();
    }
  }

  function showView(view) {
    document.querySelectorAll(".view").forEach(section => {
      section.classList.toggle(
        "active-view",
        section.id === `view-${view}`
      );
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

    history.replaceState(null, "", `#${view}`);
  }

  document.querySelectorAll(".nav-item, .panel-link").forEach(button => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

  $("searchInput").addEventListener("input", applyFilters);
  $("mapFilter").addEventListener("change", applyFilters);
  $("playerFilter").addEventListener("change", applyFilters);

  $("resetFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("mapFilter").value = "";
    $("playerFilter").value = "";
    applyFilters();
  });

  const initialView = location.hash.slice(1);

  showView(
    ["dashboard", "leaderboard", "incidents"].includes(initialView)
      ? initialView
      : "dashboard"
  );

  loadData();
})();
