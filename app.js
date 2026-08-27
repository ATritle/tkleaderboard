const state={incidents:[],players:[],mapImages:[],filtered:[]};
const $=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const display=s=>String(s??'').trim().replace(/\s+/g,' ');

function normalizePlayers(data){
  return [...new Map(
    (Array.isArray(data)?data:[])
      .map(x=>typeof x==='string'
        ? [norm(x),{name:display(x),image:''}]
        : [norm(x?.name),{name:display(x?.name),image:String(x?.image??'').trim()}])
      .filter(([k,p])=>k&&p.name)
  ).values()];
}

async function fetchJson(path){
  const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});
  if(!r.ok) throw Error(`${path} HTTP ${r.status}`);
  return r.json();
}

async function loadData(){
  try{
    const [incidentResult,playerResult,mapResult]=await Promise.allSettled([
      fetchJson('data/teamkills.json'),
      fetchJson('data/players.json'),
      fetchJson('data/map-images.json')
    ]);

    if(incidentResult.status!=='fulfilled'){
      throw incidentResult.reason;
    }

    state.incidents=Array.isArray(incidentResult.value)?incidentResult.value:[];
    state.players=playerResult.status==='fulfilled'
      ? normalizePlayers(playerResult.value)
      : [];
    state.mapImages=mapResult.status==='fulfilled' && Array.isArray(mapResult.value)
      ? mapResult.value.map(x=>String(x).trim()).filter(Boolean)
      : [];

    updateTime();
  }catch(e){
    console.error('TK Leaderboard data load failed:',e);
    state.incidents=[];
    state.players=[];
    state.mapImages=[];
    $('lastUpdated').textContent='DATA UPDATE FAILED';
  }

  state.filtered=[...state.incidents];
  populateFilters();
  render();
}

function updateTime(){
  const d=new Date();
  const ds=d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const ts=d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  $('lastUpdated').textContent=`DATA UPDATED — ${ds.toUpperCase()} ${ts}`;
}

function imagePath(filename){
  if(!filename)return '';
  const value=String(filename).trim();
  if(/^https?:\/\//i.test(value)||value.startsWith('//'))return value;
  if(value.startsWith('assets/'))return value;
  return `assets/${value.split('/').map(encodeURIComponent).join('/')}`;
}

function playerProfile(name){
  return state.players.find(p=>norm(p.name)===norm(name))||{
    name:display(name),
    image:''
  };
}

function playerNameHtml(name){
  const shown=display(name);
  const p=playerProfile(shown);

  if(!p.image)return esc(shown);

  return `<span class="player-hover" tabindex="0" data-player="${esc(shown)}">
    ${esc(shown)}
    <span class="player-hover-card">
      <img src="${esc(imagePath(p.image))}" alt="${esc(shown)}" loading="lazy"
        onerror="this.closest('.player-hover').classList.add('image-error')">
      <span class="player-hover-name">${esc(shown)}</span>
    </span>
  </span>`;
}

function mapImageFile(name){
  const target=norm(name);

  return state.mapImages.find(file=>{
    const stem=String(file).replace(/\.[^.]+$/,'');
    return norm(stem)===target;
  }) || '';
}

function mapNameHtml(name){
  const shown=display(name);
  const file=mapImageFile(shown);

  if(!file)return esc(shown);

  return `<span class="player-hover map-hover" tabindex="0" data-map="${esc(shown)}">
    ${esc(shown)}
    <span class="player-hover-card">
      <img src="${esc(`assets/maps/${file}`)}" alt="${esc(shown)} map" loading="lazy"
        onerror="this.closest('.player-hover').classList.add('image-error')">
      <span class="player-hover-name">${esc(shown)}</span>
    </span>
  </span>`;
}

function populateFilters(){
  const maps=[...new Set(state.incidents.map(i=>i.map).filter(Boolean))].sort();
  const players=[...new Map(
    state.incidents
      .map(i=>i.killer)
      .filter(Boolean)
      .map(p=>[norm(p),display(p)])
  ).values()].sort((a,b)=>a.localeCompare(b));

  $('mapFilter').innerHTML='<option value="">All Maps</option>'+
    maps.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');

  $('playerFilter').innerHTML='<option value="">All Players</option>'+
    players.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
}

function applyFilters(){
  const q=norm($('searchInput').value);
  const m=$('mapFilter').value;
  const p=norm($('playerFilter').value);

  state.filtered=state.incidents.filter(i=>{
    const t=[i.id,i.killer,i.victim,i.date,i.map,i.notes].join(' ').toLowerCase();
    return (!q||t.includes(q)) &&
           (!m||i.map===m) &&
           (!p||norm(i.killer)===p||norm(i.victim)===p);
  }).sort(sortIncidents);

  renderIncidentTable();
}

function sortIncidents(a,b){
  return String(b.date).localeCompare(String(a.date)) ||
         String(b.id).localeCompare(String(a.id));
}

function countBy(fn){
  return state.incidents.reduce((o,i)=>{
    const k=fn(i);
    if(k)o[k]=(o[k]||0)+1;
    return o;
  },{});
}

function storedName(key,field){
  const i=state.incidents.find(x=>norm(x[field])===key);
  return i?display(i[field]):key;
}

function mostFrequentMap(){
  const counts=countBy(i=>norm(i.map));
  const result=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];

  if(!result)return '—';

  const original=state.incidents.find(i=>norm(i.map)===result[0]);
  return original?.map||result[0];
}

function topPlayer(counts,field){
  const x=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];

  return x?playerNameHtml(storedName(x[0],field)):'—';
}

function render(){
  const a=state.incidents;
  const k=countBy(i=>norm(i.killer));
  const v=countBy(i=>norm(i.victim));
  const frequentMap=mostFrequentMap();

  $('totalKills').textContent=a.length;
  $('recordCount').textContent=`${a.length} ${a.length===1?'INCIDENT':'INCIDENTS'}`;
  $('playerCount').textContent=Object.keys(k).length;
  $('mapCount').innerHTML=mapNameHtml(frequentMap);
  $('topKiller').innerHTML=topPlayer(k,'killer');
  $('topVictim').innerHTML=topPlayer(v,'victim');

  renderLeaderboard();
  renderIncidentTable();
  renderRecent();
}

function renderLeaderboard(){
  const a=state.incidents;
  const k=countBy(i=>norm(i.killer));
  const names=Object.keys(k).sort((x,y)=>k[y]-k[x]||x.localeCompare(y));

  $('leaderboard').innerHTML=names.length
    ? '<div class="rank-card table-label"><div>#</div><div>PLAYER</div><div class="rank-count">TEAM KILLS</div><div class="rank-count">VICTIMS</div><div class="rank-count">VICTIMIZED</div><div class="rank-count">TK RATIO</div></div>'+
      names.map((n,i)=>{
        const kills=k[n];
        const victims=new Set(
          a.filter(x=>norm(x.killer)===n).map(x=>norm(x.victim))
        ).size;
        const received=a.filter(
          x=>norm(x.killer)!==n&&norm(x.victim)===n
        ).length;
        const total=kills+received;
        const ratio=total?Math.round(kills/total*100):100;

        return `<div class="rank-card">
          <div class="rank">${i+1}</div>
          <div class="rank-name">${playerNameHtml(storedName(n,'killer'))}</div>
          <div class="rank-count"><strong>${kills}</strong></div>
          <div class="rank-count"><strong>${victims}</strong></div>
          <div class="rank-count"><strong>${received}</strong></div>
          <div class="rank-count"><strong>${ratio}%</strong></div>
        </div>`;
      }).join('')
    : '<div class="empty"><p>No team killers recorded yet.</p></div>';
}

function tableHeader(){
  return '<div class="table-head"><span>TK ID</span><span>KILLER</span><span>VICTIM</span><span>DATE</span><span>MAP</span><span>NOTES</span><span>CLIP</span></div>';
}

function row(i){
  return `<div class="incident-row">
    <span class="tkid">${esc(i.id)}</span>
    <span class="killer">${playerNameHtml(i.killer)}</span>
    <span class="victim">${playerNameHtml(i.victim)}</span>
    <span class="date">${date(i.date)}</span>
    <span class="map">${mapNameHtml(i.map)}</span>
    <span class="notes">${esc(i.notes||'No notes recorded.')}</span>
    <span>${i.clip?`<a class="clip-icon" href="${esc(i.clip)}" target="_blank" rel="noopener">↗</a>`:''}</span>
  </div>`;
}

function renderIncidentTable(){
  $('incidentTable').innerHTML=tableHeader()+state.filtered.map(row).join('');
  $('empty').classList.toggle('hidden',state.filtered.length!==0);
}

function renderRecent(){
  const a=[...state.incidents].sort(sortIncidents).slice(0,5);
  $('dashboardRecent').innerHTML=a.length
    ? tableHeader()+a.map(row).join('')
    : '<div class="empty"><p>No incidents recorded yet.</p></div>';
}

function showView(v){
  document.querySelectorAll('.view').forEach(x=>
    x.classList.toggle('active-view',x.id===`view-${v}`)
  );
  document.querySelectorAll('.nav-item').forEach(x=>
    x.classList.toggle('active',x.dataset.view===v)
  );
  history.replaceState(null,'',`#${v}`);
}

function date(v){
  const d=new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? esc(v)
    : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
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

document.querySelectorAll('.nav-item,.panel-link').forEach(b=>
  b.onclick=()=>showView(b.dataset.view)
);

$('searchInput').oninput=applyFilters;
$('mapFilter').onchange=applyFilters;
$('playerFilter').onchange=applyFilters;

$('resetFilters').onclick=()=>{
  $('searchInput').value='';
  $('mapFilter').value='';
  $('playerFilter').value='';
  applyFilters();
};

showView(
  ['dashboard','leaderboard','incidents'].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'dashboard'
);

loadData();

/* Hover styling is kept here so the working styles.css does not need to change. */
const hoverStyle=document.createElement('style');
hoverStyle.textContent=`
  .stat-card,
  .panel,
  .incident-table,
  .rank-card{
    overflow:visible;
  }

  .player-hover{
    position:relative;
    display:inline-block;
    cursor:help;
    outline:none;
    color:inherit;
  }

  .player-hover-card{
    position:absolute;
    left:0;
    bottom:calc(100% + 12px);
    width:190px;
    padding:8px;
    background:#0b0e0f;
    border:1px solid #ff7a00;
    border-radius:8px;
    box-shadow:0 12px 30px rgba(0,0,0,.65);
    opacity:0;
    visibility:hidden;
    pointer-events:none;
    transform:translateY(6px);
    transition:opacity .16s ease,transform .16s ease,visibility .16s ease;
    z-index:99999;
  }

  .player-hover-card img{
    display:block;
    width:174px;
    height:174px;
    object-fit:cover;
    border-radius:5px;
    background:#111516;
  }

  .player-hover-name{
    display:block;
    margin-top:7px;
    color:#f1f3f4;
    font-size:12px;
    font-weight:700;
    text-align:center;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .player-hover:hover .player-hover-card,
  .player-hover:focus .player-hover-card{
    opacity:1;
    visibility:visible;
    transform:translateY(0);
  }

  /* Top TK / Most Victimized must retain the stat-card appearance. */
  #topKiller .player-hover,
  #topVictim .player-hover{
    color:#ff7a00!important;
    font-family:inherit!important;
    font-size:inherit!important;
    font-weight:inherit!important;
    line-height:inherit!important;
    letter-spacing:inherit!important;
    text-transform:none!important;
  }

  #topKiller .player-hover-card,
  #topVictim .player-hover-card{
    left:50%;
    transform:translateX(-50%) translateY(6px);
  }

  #topKiller .player-hover:hover .player-hover-card,
  #topKiller .player-hover:focus .player-hover-card,
  #topVictim .player-hover:hover .player-hover-card,
  #topVictim .player-hover:focus .player-hover-card{
    transform:translateX(-50%) translateY(0);
  }

  /* Most Frequent Map uses the same stat-card value styling and hover behavior. */
  #mapCount .player-hover{
    color:#ff7a00!important;
    font-family:inherit!important;
    font-size:inherit!important;
    font-weight:inherit!important;
    line-height:inherit!important;
    text-transform:none!important;
  }

  #mapCount .map-hover-card{
    left:50%;
    transform:translateX(-50%) translateY(6px);
  }

  #mapCount .map-hover:hover .map-hover-card,
  #mapCount .map-hover:focus .map-hover-card{
    transform:translateX(-50%) translateY(0);
  }

  .rank-name .player-hover-card,
  .map-hover .player-hover-card{
    left:0;
  }

  .player-hover.image-error .player-hover-card{
    display:none;
  }

  @media(max-width:700px){
    .player-hover-card{
      width:150px;
    }
    .player-hover-card img{
      width:134px;
      height:134px;
    }
  }
`;
document.head.appendChild(hoverStyle);
