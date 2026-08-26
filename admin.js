const OWNER='ATritle';
const REPO='tkleaderboard';
const BRANCH='main';
const FILE_PATH='data/teamkills.json';
const API_BASE=`https://api.github.com/repos/${OWNER}/${REPO}`;
const MAPS=['Customs','Factory','Interchange','Reserve','Shoreline','Woods','Labs','Lighthouse','Streets of Tarkov','Ground Zero','Terminal','Other'];
const $=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const titleCase=s=>String(s??'').trim().replace(/\s+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
let incidents=[];
let loadedSha='';

function setStatus(message,type='show'){$('status').textContent=message;$('status').className=`status show ${type}`}
function clearStatus(){$('status').textContent='';$('status').className='status'}
function token(){return $('token').value.trim()}
function headers(withAuth=false){const h={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(withAuth)h.Authorization=`Bearer ${token()}`;return h}

async function loadData(){
  try{
    const res=await fetch(`${API_BASE}/contents/${FILE_PATH}?ref=${BRANCH}&t=${Date.now()}`,{headers:headers(false)});
    if(!res.ok)throw new Error(`Could not read teamkills.json (HTTP ${res.status})`);
    const data=await res.json();
    loadedSha=data.sha;
    const decoded=atob(data.content.replace(/\n/g,''));
    incidents=JSON.parse(new TextDecoder().decode(Uint8Array.from(decoded,c=>c.charCodeAt(0))));
    if(!Array.isArray(incidents))incidents=[];
    populatePlayers();renderRecent();
  }catch(err){setStatus(err.message,'error')}
}
function populatePlayers(){
  const players=[...new Set(incidents.flatMap(i=>[titleCase(i.killer),titleCase(i.victim)]).filter(Boolean))].sort();
  $('playerNames').innerHTML=players.map(p=>`<option value="${esc(p)}"></option>`).join('');
}
function nextId(){
  const max=incidents.reduce((n,i)=>Math.max(n,Number(String(i.id||'').replace(/^TK-/i,''))||0),0);
  return `TK-${String(max+1).padStart(4,'0')}`;
}
function renderRecent(){
  const recent=[...incidents].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id))).slice(0,10);
  $('adminRecent').innerHTML=`<div class="table-head"><span>TK ID</span><span>KILLER</span><span>VICTIM</span><span>DATE</span><span>MAP</span><span>NOTES</span><span>CLIP</span></div>`+recent.map(i=>{const clip=i.clip?`<a class="clip-icon" href="${esc(i.clip)}" target="_blank" rel="noopener">↗</a>`:'';return `<div class="incident-row"><span class="tkid">${esc(i.id)}</span><span class="killer">${esc(titleCase(i.killer))}</span><span class="victim">${esc(titleCase(i.victim))}</span><span class="date">${formatDate(i.date)}</span><span class="map">${esc(i.map)}</span><span class="notes" title="${esc(i.notes||'')}">${esc(i.notes||'No notes recorded.')}</span><span>${clip}</span></div>`}).join('');
}
function validate(){
  const killer=titleCase($('killer').value),victim=titleCase($('victim').value),date=$('date').value,map=$('map').value,clip=$('clip').value.trim();
  if(!killer||!victim)return 'Enter both player names.';
  if(norm(killer)===norm(victim))return 'The killer and victim cannot be the same player.';
  if(!date)return 'Select a date.';
  if(!map)return 'Select a map.';
  if(clip){try{new URL(clip)}catch{return 'The video clip URL is not valid.'}}
  return '';
}
async function addKill(){
  clearStatus();
  const error=validate();if(error){setStatus(error,'error');return}
  if(!token()){setStatus('Enter your GitHub Personal Access Token before adding an incident.','error');$('token').focus();return}
  const incident={id:nextId(),killer:titleCase($('killer').value),victim:titleCase($('victim').value),date:$('date').value,map:$('map').value,notes:$('notes').value.trim(),clip:$('clip').value.trim()};
  const button=$('addKill');button.disabled=true;setStatus(`Adding ${incident.id} to GitHub...`,'working');
  try{
    // Re-read immediately before writing so we don't overwrite a newer commit.
    const get=await fetch(`${API_BASE}/contents/${FILE_PATH}?ref=${BRANCH}&t=${Date.now()}`,{headers:headers(true)});
    if(!get.ok)throw new Error(`GitHub read failed (HTTP ${get.status}).`);
    const current=await get.json();
    const decoded=atob(current.content.replace(/\n/g,''));
    const currentData=JSON.parse(new TextDecoder().decode(Uint8Array.from(decoded,c=>c.charCodeAt(0))));
    const data=Array.isArray(currentData)?currentData:[];
    const max=data.reduce((n,i)=>Math.max(n,Number(String(i.id||'').replace(/^TK-/i,''))||0),0);
    incident.id=`TK-${String(max+1).padStart(4,'0')}`;
    data.push(incident);
    const json=JSON.stringify(data,null,2)+'\n';
    const bytes=new TextEncoder().encode(json);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    const body={message:`Add ${incident.id}: ${incident.killer} → ${incident.victim}`,content:btoa(binary),sha:current.sha,branch:BRANCH};
    const put=await fetch(`${API_BASE}/contents/${FILE_PATH}`,{method:'PUT',headers:{...headers(true),'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await put.json();
    if(!put.ok)throw new Error(result.message||`GitHub write failed (HTTP ${put.status}).`);
    incidents=data;loadedSha=result.content?.sha||current.sha;populatePlayers();renderRecent();clearForm();setStatus(`${incident.id} added successfully. GitHub has been updated.`,'success');
  }catch(err){setStatus(err.message,'error')}
  finally{button.disabled=false}
}
function clearForm(){$('killer').value='';$('victim').value='';$('date').value=new Date().toISOString().slice(0,10);$('map').value='';$('notes').value='';$('clip').value='';$('killer').focus()}
function formatDate(v){if(!v)return'Unknown';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
$('date').value=new Date().toISOString().slice(0,10);
$('addKill').addEventListener('click',addKill);$('clearForm').addEventListener('click',()=>{clearForm();clearStatus()});
loadData();
