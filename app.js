const state = {
  incidents: [],
  filtered: []
};

const $ = id => document.getElementById(id);

const norm = s =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const display = s =>
  String(s ?? '').trim().replace(/\s+/g, ' ');


/* =========================
   LOAD DATA
========================= */

async function loadData() {
  try {
    const response = await fetch(
      `data/teamkills.json?v=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    state.incidents = Array.isArray(data) ? data : [];

    updateTime();

  } catch (error) {
    console.error('Failed to load teamkill data:', error);

    state.incidents = [];

    if ($('lastUpdated')) {
      $('lastUpdated').textContent =
        'DATA UPDATE FAILED';
    }
  }

  state.filtered = [...state.incidents];

  populateFilters();
  render();
}


/* =========================
   LAST UPDATED
========================= */

function updateTime() {

  const now = new Date();

  const date = now.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );

  const time = now.toLocaleTimeString(
    undefined,
    {
      hour: 'numeric',
      minute: '2-digit'
    }
  );

  $('lastUpdated').textContent =
    `DATA UPDATED — ${date.toUpperCase()} ${time}`;
}


/* =========================
   FILTERS
========================= */

function populateFilters() {

  const maps = [
    ...new Set(
      state.incidents
        .map(i => i.map)
        .filter(Boolean)
    )
  ].sort();


  /*
   * IMPORTANT:
   *
   * The player filter only contains
   * players who have actually TK'd someone.
   *
   * Victims do NOT get added to the
   * player roster.
   */

  const players = [
    ...new Map(
      state.incidents
        .map(i => i.killer)
        .filter(Boolean)
        .map(player => [
          norm(player),
          display(player)
        ])
    ).values()
  ].sort((a, b) =>
    a.localeCompare(b)
  );


  $('mapFilter').innerHTML =
    '<option value="">All Maps</option>' +
    maps
      .map(map =>
        `<option value="${esc(map)}">${esc(map)}</option>`
      )
      .join('');


  $('playerFilter').innerHTML =
    '<option value="">All Players</option>' +
    players
      .map(player =>
        `<option value="${esc(player)}">${esc(player)}</option>`
      )
      .join('');
}


/* =========================
   APPLY FILTERS
========================= */

function applyFilters() {

  const search =
    norm($('searchInput').value);

  const map =
    $('mapFilter').value;

  const player =
    norm($('playerFilter').value);


  state.filtered = state.incidents
    .filter(incident => {

      const searchableText = [
        incident.id,
        incident.killer,
        incident.victim,
        incident.date,
        incident.map,
        incident.notes
      ]
        .join(' ')
        .toLowerCase();


      return (
        (!search ||
          searchableText.includes(search)) &&

        (!map ||
          incident.map === map) &&

        (
          !player ||
          norm(incident.killer) === player ||
          norm(incident.victim) === player
        )
      );
    })
    .sort(sortIncidents);


  renderIncidentTable();
}


/* =========================
   SORT
========================= */

function sortIncidents(a, b) {

  return (
    String(b.date).localeCompare(
      String(a.date)
    ) ||

    String(b.id).localeCompare(
      String(a.id)
    )
  );
}


/* =========================
   COUNTING
========================= */

function countBy(callback) {

  return state.incidents.reduce(
    (counts, incident) => {

      const key = callback(incident);

      if (key) {
        counts[key] =
          (counts[key] || 0) + 1;
      }

      return counts;

    },
    {}
  );
}


/* =========================
   PRESERVE ORIGINAL NAME
========================= */

/*
 * Internally we use lowercase names
 * for comparisons.
 *
 * But we ALWAYS display the original
 * name exactly as it appears in the
 * JSON file.
 *
 * Example:
 *
 * Triple_G
 * ThePoolshark
 * AARON
 *
 * all retain their capitalization.
 */

function storedName(key, field) {

  const incident =
    state.incidents.find(
      incident =>
        norm(incident[field]) === key
    );

  return incident
    ? display(incident[field])
    : key;
}


/* =========================
   FIND TOP PLAYER
========================= */

function topPlayer(counts, field) {

  const result =
    Object.entries(counts)
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].localeCompare(b[0])
      )[0];


  if (!result) {
    return '—';
  }


  return storedName(
    result[0],
    field
  );
}


/* =========================
   MAIN RENDER
========================= */

function render() {

  const incidents =
    state.incidents;


  const killerCounts =
    countBy(
      incident =>
        norm(incident.killer)
    );


  const victimCounts =
    countBy(
      incident =>
        norm(incident.victim)
    );


  /*
   * Total incidents
   */

  $('totalKills').textContent =
    incidents.length;


  $('recordCount').textContent =
    `${incidents.length} ${
      incidents.length === 1
        ? 'INCIDENT'
        : 'INCIDENTS'
    }`;


  /*
   * IMPORTANT:
   *
   * Player count only counts people
   * who have TK'd someone.
   */

  $('playerCount').textContent =
    Object.keys(killerCounts).length;


  /*
   * Map count
   */

  $('mapCount').textContent =
    new Set(
      incidents
        .map(incident => incident.map)
        .filter(Boolean)
    ).size;


  /*
   * Top TK player
   */

  $('topKiller').textContent =
    topPlayer(
      killerCounts,
      'killer'
    );


  /*
   * Most victimized
   *
   * This is intentionally separate
   * from the player roster.
   */

  $('topVictim').textContent =
    topPlayer(
      victimCounts,
      'victim'
    );


  renderLeaderboard();

  renderIncidentTable();

  renderRecent();
}


/* =========================
   LEADERBOARD
========================= */

function renderLeaderboard() {

  const incidents =
    state.incidents;


  /*
   * ONLY KILLERS ARE USED HERE.
   *
   * A player who has only been killed
   * will NOT appear on the leaderboard.
   */

  const killerCounts =
    countBy(
      incident =>
        norm(incident.killer)
    );


  const names =
    Object.keys(killerCounts)
      .sort(
        (a, b) =>
          killerCounts[b] -
          killerCounts[a] ||

          a.localeCompare(b)
      );


  if (!names.length) {

    $('leaderboard').innerHTML =
      `
        <div class="empty">
          <p>No team killers recorded yet.</p>
        </div>
      `;

    return;
  }


  $('leaderboard').innerHTML =
    `
      <div class="rank-card table-label">
        <div>#</div>
        <div>PLAYER</div>
        <div class="rank-count">
          TEAM KILLS
        </div>
        <div class="rank-count">
          VICTIMS
        </div>
        <div class="rank-count">
          VICTIMIZED
        </div>
        <div class="rank-count">
          TK RATIO
        </div>
      </div>
    ` +

    names
      .map(
        (name, index) => {

          const kills =
            killerCounts[name] || 0;


          /*
           * Number of unique people
           * this player has TK'd.
           */

          const victims =
            new Set(
              incidents
                .filter(
                  incident =>
                    norm(
                      incident.killer
                    ) === name
                )
                .map(
                  incident =>
                    norm(
                      incident.victim
                    )
                )
            ).size;


          /*
           * Number of times this
           * leaderboard player was
           * victimized by someone else.
           */

          const received =
            incidents.filter(
              incident =>
                norm(
                  incident.killer
                ) !== name &&

                norm(
                  incident.victim
                ) === name
            ).length;


          const total =
            kills + received;


          const ratio =
            total
              ? Math.round(
                  (kills / total) * 100
                )
              : 100;


          const playerName =
            storedName(
              name,
              'killer'
            );


          return `
            <div class="rank-card">

              <div class="rank">
                ${index + 1}
              </div>

              <div class="rank-name">
                ${esc(playerName)}
              </div>

              <div class="rank-count">
                <strong>
                  ${kills}
                </strong>
              </div>

              <div class="rank-count">
                <strong>
                  ${victims}
                </strong>
              </div>

              <div class="rank-count">
                <strong>
                  ${received}
                </strong>
              </div>

              <div class="rank-count">
                <strong>
                  ${ratio}%
                </strong>
              </div>

            </div>
          `;
        }
      )
      .join('');
}


/* =========================
   INCIDENT TABLE
========================= */

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

  const clip =
    incident.clip
      ? `
        <a
          class="clip-icon"
          href="${esc(incident.clip)}"
          target="_blank"
          rel="noopener"
          title="View clip"
        >↗</a>
      `
      : '';


  return `
    <div class="incident-row">

      <span class="tkid">
        ${esc(incident.id)}
      </span>

      <span class="killer">
        ${esc(
          display(incident.killer)
        )}
      </span>

      <span class="victim">
        ${esc(
          display(incident.victim)
        )}
      </span>

      <span class="date">
        ${formatDate(
          incident.date
        )}
      </span>

      <span class="map">
        ${esc(
          incident.map ||
          'Unknown'
        )}
      </span>

      <span
        class="notes"
        title="${esc(
          incident.notes || ''
        )}"
      >
        ${esc(
          incident.notes ||
          'No notes recorded.'
        )}
      </span>

      <span>
        ${clip}
      </span>

    </div>
  `;
}


function renderIncidentTable() {

  $('incidentTable').innerHTML =
    tableHeader() +
    state.filtered
      .map(incidentRow)
      .join('');


  $('empty').classList.toggle(
    'hidden',
    state.filtered.length !== 0
  );
}


/* =========================
   RECENT INCIDENTS
========================= */

function renderRecent() {

  const recent =
    [...state.incidents]
      .sort(sortIncidents)
      .slice(0, 5);


  $('dashboardRecent').innerHTML =
    recent.length
      ? tableHeader() +
        recent
          .map(incidentRow)
          .join('')

      : `
        <div class="empty">
          <p>No incidents recorded yet.</p>
        </div>
      `;
}


/* =========================
   PAGE NAVIGATION
========================= */

function showView(view) {

  document
    .querySelectorAll('.view')
    .forEach(section => {

      section.classList.toggle(
        'active-view',
        section.id ===
          `view-${view}`
      );

    });


  document
    .querySelectorAll('.nav-item')
    .forEach(button => {

      button.classList.toggle(
        'active',
        button.dataset.view ===
          view
      );

    });


  window.history.replaceState(
    null,
    '',
    `#${view}`
  );
}


/* =========================
   DATE FORMATTING
========================= */

function formatDate(value) {

  if (!value) {
    return 'Unknown';
  }


  const date =
    new Date(
      `${value}T12:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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


/* =========================
   HTML ESCAPE
========================= */

function esc(value) {

  return String(
    value ?? ''
  ).replace(
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


/* =========================
   EVENT HANDLERS
========================= */

document
  .querySelectorAll(
    '.nav-item, .panel-link'
  )
  .forEach(button => {

    button.addEventListener(
      'click',
      () =>
        showView(
          button.dataset.view
        )
    );

  });


$('searchInput')
  .addEventListener(
    'input',
    applyFilters
  );


$('mapFilter')
  .addEventListener(
    'change',
    applyFilters
  );


$('playerFilter')
  .addEventListener(
    'change',
    applyFilters
  );


$('resetFilters')
  .addEventListener(
    'click',
    () => {

      $('searchInput').value =
        '';

      $('mapFilter').value =
        '';

      $('playerFilter').value =
        '';

      applyFilters();
    }
  );


/* =========================
   INITIAL VIEW
========================= */

const initialView =
  location.hash.replace(
    '#',
    ''
  );


showView(
  [
    'dashboard',
    'leaderboard',
    'incidents'
  ].includes(initialView)

    ? initialView

    : 'dashboard'
);


/* =========================
   START
========================= */

loadData();
