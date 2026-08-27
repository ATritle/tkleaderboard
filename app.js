const state = {
  incidents: [],
  filtered: []
};

const $ = id => document.getElementById(id);

const norm = s =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const display = s =>
  String(s ?? '').trim().replace(/\s+/g, ' ');

async function loadData() {
  try {
    const r = await fetch(`data/teamkills.json?v=${Date.now()}`);

    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }

    const data = await r.json();

    state.incidents = Array.isArray(data) ? data : [];

    updateTime();
  } catch (e) {
    console.error('Failed to load teamkill data:', e);
    state.incidents = [];

    if ($('lastUpdated')) {
      $('lastUpdated').textContent = 'DATA UPDATE FAILED';
    }
  }

  state.filtered = [...state.incidents];

  populate();
  render();
}

function updateTime() {
  const now = new Date();

  const date = now.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });

  $('lastUpdated').textContent =
    `DATA UPDATED — ${date.toUpperCase()} ${time}`;
}

function populate() {
  const maps = [
    ...new Set(
      state.incidents
        .map(i => i.map)
        .filter(Boolean)
    )
  ].sort();

  /*
   * The player filter is based only on killers.
   * Victims do not need to be on the player roster.
   */
  const players = [
    ...new Map(
      state.incidents
        .map(i => i.killer)
        .filter(Boolean)
        .map(p => [norm(p), display(p)])
    ).values()
  ].sort((a, b) => a.localeCompare(b));

  $('mapFilter').innerHTML =
    '<option value="">All Maps</option>' +
    maps.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

  $('playerFilter').innerHTML =
    '<option value="">All Players</option>' +
    players.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
}

function apply() {
  const q = norm($('searchInput').value);
  const map = $('mapFilter').value;
  const player = norm($('playerFilter').value);

  state.filtered = state.incidents
    .filter(i => {
      const text = [
        i.id,
        i.killer,
        i.victim,
        i.date,
        i.map,
        i.notes
      ].join(' ').toLowerCase();

      return (
        (!q || text.includes(q)) &&
        (!map || i.map === map) &&
        (
          !player ||
          norm(i.killer) === player ||
          norm(i.victim) === player
        )
      );
    })
    .sort(sortIncidents);

  renderIncidentTable();
}

function sortIncidents(a, b) {
  return (
    String(b.date).localeCompare(String(a.date)) ||
    String(b.id).localeCompare(String(a.id))
  );
}

function countBy(fn) {
  return state.incidents.reduce((counts, incident) => {
    const key = fn(incident);

    if (key) {
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }, {});
}

/*
 * Find the original stored name so capitalization is preserved.
 *
 * Example:
 *   Triple_G stays Triple_G
 *   ThePoolshark stays ThePoolshark
 */
function storedName(key, field) {
  const incident = state.incidents.find(
    i => norm(i[field]) === key
  );

  return incident ? display(incident[field]) : key;
}

function mostFrequentMap() {
  const counts = countBy(i => norm(i.map));
  const result = Object.entries(counts)
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0])
    )[0];

  if (!result) return '—';

  const original = state.incidents.find(
    i => norm(i.map) === result[0]
  );

  return original?.map || result[0];
}

function topPlayer(counts, field) {
  const result = Object.entries(counts)
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0])
    )[0];

  return result
    ? storedName(result[0], field)
    : '—';
}

function render() {
  const incidents = state.incidents;

  const killerCounts =
    countBy(i => norm(i.killer));

  const victimCounts =
    countBy(i => norm(i.victim));

  $('totalKills').textContent =
    incidents.length;

  $('recordCount').textContent =
    `${incidents.length} ${
      incidents.length === 1
        ? 'INCIDENT'
        : 'INCIDENTS'
    }`;

  /*
   * Only players who have TK'd someone
   * count as leaderboard players.
   */
  $('playerCount').textContent =
    Object.keys(killerCounts).length;

  $('mapCount').textContent =
    mostFrequentMap();

  $('topKiller').textContent =
    topPlayer(killerCounts, 'killer');

  $('topVictim').textContent =
    topPlayer(victimCounts, 'victim');

  renderLeaderboard();
  renderIncidentTable();
  renderRecent();
}

function renderLeaderboard() {
  const incidents = state.incidents;

  /*
   * IMPORTANT:
   * The leaderboard is built ONLY from killers.
   * A victim will not appear here unless they have
   * also TK'd someone in another incident.
   */
  const killerCounts =
    countBy(i => norm(i.killer));

  const names =
    Object.keys(killerCounts).sort(
      (a, b) =>
        killerCounts[b] - killerCounts[a] ||
        a.localeCompare(b)
    );

  if (!names.length) {
    $('leaderboard').innerHTML =
      '<div class="empty"><p>No team killers recorded yet.</p></div>';

    return;
  }

  $('leaderboard').innerHTML =
    `<div class="rank-card table-label">
      <div>#</div>
      <div>PLAYER</div>
      <div class="rank-count">TEAM KILLS</div>
      <div class="rank-count">VICTIMS</div>
      <div class="rank-count">VICTIMIZED</div>
      <div class="rank-count">TK RATIO</div>
    </div>` +

    names.map((name, index) => {
      const kills =
        killerCounts[name] || 0;

      const victims =
        new Set(
          incidents
            .filter(i => norm(i.killer) === name)
            .map(i => norm(i.victim))
        ).size;

      /*
       * A leaderboard player can also have been
       * victimized. This is counted separately.
       */
      const received =
        incidents.filter(
          i =>
            norm(i.killer) !== name &&
            norm(i.victim) === name
        ).length;

      const total =
        kills + received;

      const ratio =
        total
          ? Math.round((kills / total) * 100)
          : 100;

      return `
        <div class="rank-card">
          <div class="rank">${index + 1}</div>

          <div class="rank-name">
            ${esc(storedName(name, 'killer'))}
          </div>

          <div class="rank-count">
            <strong>${kills}</strong>
          </div>

          <div class="rank-count">
            <strong>${victims}</strong>
          </div>

          <div class="rank-count">
            <strong>${received}</strong>
          </div>

          <div class="rank-count">
            <strong>${ratio}%</strong>
          </div>
        </div>
      `;
    }).join('');
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

function incidentRow(i) {
  const clip = i.clip
    ? `
      <a
        class="clip-icon"
        href="${esc(i.clip)}"
        target="_blank"
        rel="noopener"
        title="View clip"
      >↗</a>
    `
    : '';

  return `
    <div class="incident-row">
      <span class="tkid">${esc(i.id)}</span>

      <span class="killer">
        ${esc(display(i.killer))}
      </span>

      <span class="victim">
        ${esc(display(i.victim))}
      </span>

      <span class="date">
        ${formatDate(i.date)}
      </span>

      <span class="map">
        ${esc(i.map || 'Unknown')}
      </span>

      <span
        class="notes"
        title="${esc(i.notes || '')}"
      >
        ${esc(i.notes || 'No notes recorded.')}
      </span>

      <span>${clip}</span>
    </div>
  `;
}

function renderIncidentTable() {
  $('incidentTable').innerHTML =
    tableHeader() +
    state.filtered.map(incidentRow).join('');

  $('empty').classList.toggle(
    'hidden',
    state.filtered.length !== 0
  );
}

function renderRecent() {
  const recent = [...state.incidents]
    .sort(sortIncidents)
    .slice(0, 5);

  $('dashboardRecent').innerHTML =
    recent.length
      ? tableHeader() +
        recent.map(incidentRow).join('')
      : '<div class="empty"><p>No incidents recorded yet.</p></div>';
}

function showView(view) {
  document
    .querySelectorAll('.view')
    .forEach(section => {
      section.classList.toggle(
        'active-view',
        section.id === `view-${view}`
      );
    });

  document
    .querySelectorAll('.nav-item')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.view === view
      );
    });

  window.history.replaceState(
    null,
    '',
    `#${view}`
  );
}

function formatDate(value) {
  if (!value) {
    return 'Unknown';
  }

  const date =
    new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return esc(value);
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );
}

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[character])
  );
}

document
  .querySelectorAll('.nav-item, .panel-link')
  .forEach(button => {
    button.addEventListener(
      'click',
      () => showView(button.dataset.view)
    );
  });

$('searchInput').addEventListener(
  'input',
  apply
);

$('mapFilter').addEventListener(
  'change',
  apply
);

$('playerFilter').addEventListener(
  'change',
  apply
);

$('resetFilters').addEventListener(
  'click',
  () => {
    $('searchInput').value = '';
    $('mapFilter').value = '';
    $('playerFilter').value = '';

    apply();
  }
);

const initialView =
  location.hash.replace('#', '');

showView(
  ['dashboard', 'leaderboard', 'incidents']
    .includes(initialView)
    ? initialView
    : 'dashboard'
);

loadData();
