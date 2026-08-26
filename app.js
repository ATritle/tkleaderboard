const state={incidents:[],filtered:[]};
const $=id=>document.getElementById(id);
const norm=s=>String(s??"").trim().replace(/\s+/g," ").toLowerCase();
const titleCase=s=>String(s??"").trim().replace(/\s+/g," ").replace(/\b\w/g,c=>c.toUpperCase());

async function loadData(){
  try{
    const res=await fetch(`data/teamkills.json?v=${Date.now()}`);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    state.incidents=Array.isArray(data)?data:[];
  }catch(err){console.error(err);state.incidents=[]}
  state.filtered=[...state.incidents];
  populateFilters();render();
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
    return (!q||text.includes(q))&&(!map||i.map===map)&&(!player||norm(i.killer)===player||norm(i.victim)===player);
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  render();
}
function countBy(items,fn){return items.reduce((a,x)=>{const k=fn(x);if(k)a[k]=(a[k]||0)+1;return a},{});}
function winner(counts){const row=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return row?`${titleCase(row[0])}`:"—";}
function render(){
  const all=state.incidents;
  $("totalKills").textContent=all.length;
  $("recordCount").textContent=`${all.length} ${all.length===1?"INCIDENT":"INCIDENTS"}`;
  const players=[...new Set(all.flatMap(i=>[norm(i.killer),norm(i.victim)]).filter(Boolean))];
  const maps=[...new Set(all.map(i=>i.map).filter(Boolean))];
  $("playerCount").textContent=players.length;
  $("mapCount").textContent=maps.length;
  $("topKiller").textContent=winner(countBy(all,i=>norm(i.killer)));
  $("topVictim").textContent=winner(countBy(all,i=>norm(i.victim)));

  const kc=countBy(all,i=>norm(i.killer));
  const vc=countBy(all,i=>norm(i.victim));
  const names=[...new Set([...Object.keys(kc),...Object.keys(vc)])].sort((a,b)=>(kc[b]||0)-(kc[a]||0)||a.localeCompare(b));
  $("leaderboard").innerHTML=names.length?`
    <div class="rank-card" style="border-top:0;color:#8f999c;font-size:11px;text-transform:uppercase">
      <div>#</div><div>PLAYER</div><div class="rank-count">TEAM KILLS</div><div class="rank-count">VICTIMS</div><div class="rank-count">VICTIMIZED</div><div class="rank-count">TK RATIO</div>
    </div>
    ${names.map((name,idx)=>{
      const kills=kc[name]||0,victims=new Set(all.filter(i=>norm(i.killer)===name).map(i=>norm(i.victim))).size,received=vc[name]||0,total=kills+received,ratio=total?Math.round(kills/total*100):0;
      return `<div class="rank-card"><div class="rank">${idx+1}</div><div class="rank-name">${esc(titleCase(name))}</div><div class="rank-count"><strong>${kills}</strong></div><div class="rank-count"><strong>${victims}</strong></div><div class="rank-count"><strong>${received}</strong></div><div class="rank-count"><strong>${ratio}%</strong></div></div>`;
    }).join("")}`:"<div class='empty'><p>No incidents recorded yet.</p></div>";

  $("incidents").innerHTML=state.filtered.map(i=>{
    const clip=i.clip?`<a class="clip-icon" href="${esc(i.clip)}" target="_blank" rel="noopener" title="View clip">↗</a>`:"";
    return `<div class="incident-row">
      <span class="tkid">${esc(i.id||"")}</span>
      <span class="killer">${esc(titleCase(i.killer))}</span>
      <span class="victim">${esc(titleCase(i.victim))}</span>
      <span class="date">${formatDate(i.date)}</span>
      <span class="map">${esc(i.map||"Unknown")}</span>
      <span class="notes" title="${esc(i.notes||"")}">${esc(i.notes||"No notes recorded.")}</span>
      <span>${clip}</span>
    </div>`;
  }).join("");
  $("empty").classList.toggle("hidden",state.filtered.length!==0);
}
function formatDate(v){if(!v)return"Unknown";const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
$("searchInput").addEventListener("input",applyFilters);
$("mapFilter").addEventListener("change",applyFilters);
$("playerFilter").addEventListener("change",applyFilters);
$("resetFilters").addEventListener("click",()=>{$("searchInput").value="";$("mapFilter").value="";$("playerFilter").value="";applyFilters()});
loadData();
