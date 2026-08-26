const state={incidents:[], filtered:[]};
const $=id=>document.getElementById(id);
const norm=s=>String(s??"").trim().replace(/\s+/g," ").toLowerCase();
const titleCase=s=>String(s??"").trim().replace(/\s+/g," ").replace(/\b\w/g,c=>c.toUpperCase());

async function loadData(){
  try{
    const res=await fetch(`data/teamkills.json?v=${Date.now()}`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    state.incidents=Array.isArray(data)?data:[];
  }catch(err){
    console.error(err);
    state.incidents=[];
  }
  state.filtered=[...state.incidents];
  populateFilters();
  render();
}
function populateFilters(){
  const maps=[...new Set(state.incidents.map(i=>i.map).filter(Boolean))].sort();
  const players=[...new Set(state.incidents.flatMap(i=>[titleCase(i.killer),titleCase(i.victim)]).filter(Boolean))].sort();
  $("mapFilter").innerHTML='<option value="">All Maps</option>'+maps.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("");
  $("playerFilter").innerHTML='<option value="">All Players</option>'+players.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
}
function applyFilters(){
  const q=norm($("searchInput").value),map=$("mapFilter").value,player=norm($("playerFilter").value);
  state.filtered=state.incidents.filter(i=>{
    const text=[i.id,i.killer,i.victim,i.date,i.map,i.notes].join(" ").toLowerCase();
    const playerMatch=!player||norm(i.killer)===player||norm(i.victim)===player;
    return (!q||text.includes(q))&&(!map||i.map===map)&&playerMatch;
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  render();
}
function render(){
  const incidents=state.incidents;
  $("totalKills").textContent=incidents.length;
  $("recordCount").textContent=`${incidents.length} ${incidents.length===1?"incident":"incidents"}`;
  const players=[...new Set(incidents.flatMap(i=>[norm(i.killer),norm(i.victim)]).filter(Boolean))];
  const maps=[...new Set(incidents.map(i=>i.map).filter(Boolean))];
  $("playerCount").textContent=players.length;
  $("mapCount").textContent=maps.length;

  const killerCounts=countBy(incidents,i=>norm(i.killer));
  const victimCounts=countBy(incidents,i=>norm(i.victim));
  $("topKiller").textContent=displayWinner(killerCounts);
  $("topVictim").textContent=displayWinner(victimCounts);

  const board=Object.entries(killerCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10);
  $("leaderboard").innerHTML=board.length?board.map(([name,count],idx)=>`
    <div class="rank-card">
      <div class="rank">#${idx+1}</div>
      <div class="rank-name">${esc(titleCase(name))}</div>
      <div class="rank-count"><strong>${count}</strong><span>TKs</span></div>
    </div>`).join(""):`<div class="empty"><p>No incidents recorded yet.</p></div>`;

  $("incidents").innerHTML=state.filtered.map(renderIncident).join("");
  $("empty").classList.toggle("hidden",state.filtered.length!==0);
}
function countBy(items,fn){
  return items.reduce((acc,item)=>{const k=fn(item);if(k)acc[k]=(acc[k]||0)+1;return acc;},{});
}
function displayWinner(counts){
  const row=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return row?`${titleCase(row[0])} (${row[1]})`:"—";
}
function renderIncident(i){
  const clip=i.clip?`<a class="clip" href="${esc(i.clip)}" target="_blank" rel="noopener">▶ View Video Clip ↗</a>`:"";
  return `<article class="incident">
    <div>
      <div class="incident-head"><span class="map">${esc(i.map||"Unknown Map")}</span><span>${formatDate(i.date)}</span><span class="tkid">${esc(i.id||"")}</span></div>
      <div class="kill-line"><strong class="killer">${esc(titleCase(i.killer))}</strong><span class="arrow">→</span><strong class="victim">${esc(titleCase(i.victim))}</strong></div>
      <div class="notes">${esc(i.notes||"No notes recorded.")}</div>
      ${clip}
    </div>
    <div class="incident-actions"></div>
  </article>`;
}
function formatDate(value){
  if(!value)return "Unknown date";
  const d=new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime())?esc(value):d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

$("searchInput").addEventListener("input",applyFilters);
$("mapFilter").addEventListener("change",applyFilters);
$("playerFilter").addEventListener("change",applyFilters);
$("resetFilters").addEventListener("click",()=>{
  $("searchInput").value="";$("mapFilter").value="";$("playerFilter").value="";
  applyFilters();
});
loadData();
