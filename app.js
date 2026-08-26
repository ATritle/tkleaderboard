const state={incidents:[],filtered:[]};
const $=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const displayName=s=>String(s??'').trim().replace(/\s+/g,' ');

async function loadData(){
  try{
    const res=await fetch(`data/teamkills.json?v=${Date.now()}`);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    state.incidents=Array.isArray(data)?data:[];
    updateLastUpdated();
  }catch(err){
    console.error(err);
    state.incidents=[];
    $('lastUpdated').textContent='DATA UPDATE FAILED';
  }
  state.filtered=[...state.incidents];
  populateFilters();
  render();
}

function updateLastUpdated(){
  const now=new Date();
  const date=now.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const time=now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  $('lastUpdated').textContent=`DATA UPDATED — ${date.toUpperCase()} ${time}`;
}

function populateFilters(){
  const maps=[...new Set(state.incidents.map(i=>i.map).filter(Boolean))].sort();
  const players=[...new Map(
    state.incidents
      .flatMap(i=>[i.killer,i.victim])
      .filter(Boolean)
      .map(p=>[norm(p),displayName(p)])
  ).values()].sort((a,b)=>a.localeCompare(b));

  $('mapFilter').innerHTML='<option value="">All Maps</option>'+
    maps.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
  $('playerFilter').innerHTML='<option value="">All Players</option>'+
    players.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
}

function applyFilters(){
  const q=norm($('searchInput').value);
  const map=$('mapFilter').value;
  const player=norm($('playerFilter').value);

  state.filtered=state.incidents.filter(i=>{
    const text=[i.id,i.killer,i.victim,i.date,i.map,i.notes].join(' ').toLowerCase();
    return(!q||text.includes(q)) &&
      (!map||i.map===map) &&
      (!player||norm(i.killer)===player||norm(i.victim)===player);
  }).sort(sortIncidents);

  renderIncidentTable();
}

function sortIncidents(a,b){
  return String(b.date).localeCompare(String(a.date))||
         String(b.id).localeCompare(String(a.id));
}

function countBy(items,fn){
  return items.reduce((a,x)=>{
    const k=fn(x);
    if(k)a[k]=(a[k]||0)+1;
    return a;
  },{});
}

/*
  Return the original stored player name instead of the normalized
  lowercase key. This keeps capitalization such as:
  Triple_g
  Thepoolshark
  AARON
*/
function displayNameForKey(key){
  const match=state.incidents.find(i=>
    norm(i.killer)===key || norm(i.victim)===key
  );

  if(!match)return key;

  if(norm(match.killer)===key)return displayName(match.killer);
  return displayName(match.victim);
}

function winner(counts){
  const row=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];

  return row ? displayNameForKey(row[0]) : '—';
}

function render(){
  const all=state.incidents;

  $('totalKills').textContent=all.length;
  $('recordCount').textContent=
    `${all.length} ${all.length===1?'INCIDENT':'INCIDENTS'}`;

  const players=[...new Set(
    all.flatMap(i=>[norm(i.killer),norm(i.victim)]).filter(Boolean)
  )];

  $('playerCount').textContent=players.length;
  $('mapCount').textContent=
    [...new Set(all.map(i=>i.map).filter(Boolean))].length;

  $('topKiller').textContent=winner(countBy(all,i=>norm(i.killer)));
  $('topVictim').textContent=winner(countBy(all,i=>norm(i.victim)));

  renderLeaderboard();
  renderIncidentTable();
  renderRecent();
}

function renderLeaderboard(){
  const all=state.incidents;
  const kc=countBy(all,i=>norm(i.killer));
  const vc=countBy(all,i=>norm(i.victim));

  const names=[...new Set([
    ...Object.keys(kc),
    ...Object.keys(vc)
  ])].sort((a,b)=>
    (kc[b]||0)-(kc[a]||0)||a.localeCompare(b)
  );

  $('leaderboard').innerHTML=names.length?
    `<div class="rank-card table-label">
      <div>#</div>
      <div>PLAYER</div>
      <div class="rank-count">TEAM KILLS</div>
      <div class="rank-count">VICTIMS</div>
      <div class="rank-count">VICTIMIZED</div>
      <div class="rank-count">TK RATIO</div>
    </div>`+
    names.map((name,idx)=>{
      const kills=kc[name]||0;
      const victims=new Set(
        all.filter(i=>norm(i.killer)===name)
           .map(i=>norm(i.victim))
      ).size;
      const received=vc[name]||0;
      const total=kills+received;
      const ratio=total?Math.round(kills/total*100):0;
      const shown=displayNameForKey(name);

      return `<div class="rank-card">
        <div class="rank">${idx+1}</div>
        <div class="rank-name">${esc(shown)}</div>
        <div class="rank-count"><strong>${kills}</strong></div>
        <div class="rank-count"><strong>${victims}</strong></div>
        <div class="rank-count"><strong>${received}</strong></div>
        <div class="rank-count"><strong>${ratio}%</strong></div>
      </div>`;
    }).join(''):
    '<div class="empty"><p>No incidents recorded yet.</p></div>';
}

function tableHeader(){
  return '<div class="table-head"><span>TK ID</span><span>KILLER</span><span>VICTIM</span><span>DATE</span><span>MAP</span><span>NOTES</span><span>CLIP</span></div>';
}

function incidentRow(i){
  const clip=i.clip?
    `<a class="clip-icon" href="${esc(i.clip)}" target="_blank" rel="noopener" title="View clip">↗</a>`:'';

  return `<div class="incident-row">
    <span class="tkid">${esc(i.id||'')}</span>
    <span class="killer">${esc(displayName(i.killer))}</span>
    <span class="victim">${esc(displayName(i.victim))}</span>
    <span class="date">${formatDate(i.date)}</span>
    <span class="map">${esc(i.map||'Unknown')}</span>
    <span class="notes" title="${esc(i.notes||'')}">${esc(i.notes||'No notes recorded.')}</span>
    <span>${clip}</span>
  </div>`;
}

function renderIncidentTable(){
  $('incidentTable').innerHTML=
    tableHeader()+state.filtered.map(incidentRow).join('');
  $('empty').classList.toggle('hidden',state.filtered.length!==0);
}

function renderRecent(){
  const recent=[...state.incidents]
    .sort(sortIncidents)
    .slice(0,5);

  $('dashboardRecent').innerHTML=recent.length?
    tableHeader()+recent.map(incidentRow).join(''):
    '<div class="empty"><p>No incidents recorded yet.</p></div>';
}

function showView(view){
  document.querySelectorAll('.view')
    .forEach(v=>v.classList.toggle('active-view',v.id===`view-${view}`));

  document.querySelectorAll('.nav-item')
    .forEach(b=>b.classList.toggle('active',b.dataset.view===view));

  window.history.replaceState(null,'',`#${view}`);
}

function formatDate(v){
  if(!v)return'Unknown';
  const d=new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime())?
    esc(v):
    d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

document.querySelectorAll('.nav-item,.panel-link')
  .forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

$('searchInput').addEventListener('input',applyFilters);
$('mapFilter').addEventListener('change',applyFilters);
$('playerFilter').addEventListener('change',applyFilters);

$('resetFilters').addEventListener('click',()=>{
  $('searchInput').value='';
  $('mapFilter').value='';
  $('playerFilter').value='';
  applyFilters();
});

const initial=location.hash.replace('#','');
showView(['dashboard','leaderboard','incidents'].includes(initial)?
  initial:'dashboard');

loadData();
