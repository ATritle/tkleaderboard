const OWNER='ATritle';
const REPO='tkleaderboard';
const BRANCH='main';
const INCIDENT_FILE='data/teamkills.json';
const PLAYER_FILE='data/players.json';
const API_BASE=`https://api.github.com/repos/${OWNER}/${REPO}`;

const $=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const titleCase=s=>String(s??'').trim().replace(/\s+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
let incidents=[],players=[];

function setStatus(id,message,type='show'){const el=$(id);el.textContent=message;el.className=`status show ${type}`}
function clearStatus(id){$(id).textContent='';$(id).className='status'}
function token(){return $('token').value.trim()}
function headers(auth=false){const h={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(auth)h.Authorization=`Bearer ${token()}`;return h}
function decode(content){const d=atob(content.replace(/\n/g,''));return JSON.parse(new TextDecoder().decode(Uint8Array.from(d,c=>c.charCodeAt(0))) )}
function encode(data){const bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+'\n');let b='';for(let i=0;i<bytes.length;i+=0x8000)b+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(b)}
async function readFile(path){const r=await fetch(`${API_BASE}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`,{headers:headers(false)});if(!r.ok)throw new Error(`Could not read ${path} (HTTP ${r.status}).`);const j=await r.json();return{sha:j.sha,data:decode(j.content)}}

async function loadData(){
  try{
    const [a,b]=await Promise.all([readFile(INCIDENT_FILE),readFile(PLAYER_FILE)]);
    incidents=Array.isArray(a.data)?a.data:[];players=Array.isArray(b.data)?b.data:[];
    players=[...new Set(players.map(titleCase).filter(Boolean))].sort((x,y)=>x.localeCompare(y));
    populateSelects();renderPlayers();renderRecent();
  }catch(e){setStatus('playerStatus',e.message,'error')}
}
function populateSelects(){
  const o='<option value="">Select player...</option>'+players.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  $('killer').innerHTML=o;$('victim').innerHTML=o;
}
function renderPlayers(){
  if(!players.length){$('playerList').innerHTML='<div class="player-empty">No players have been added yet.</div>';return}
  $('playerList').innerHTML=players.map((p,i)=>{
    const used=incidents.some(x=>norm(x.killer)===norm(p)||norm(x.victim)===norm(p));
    return `<div class="player-row"><span class="player-number">${String(i+1).padStart(2,'0')}</span><strong>${esc(p)}</strong><span class="player-usage">${used?'IN INCIDENT HISTORY':'NO INCIDENTS YET'}</span><button class="remove-player" type="button" data-player="${esc(p)}">REMOVE</button></div>`;
  }).join('');
  document.querySelectorAll('.remove-player').forEach(b=>b.addEventListener('click',()=>removePlayer(b.dataset.player)));
}
async function savePlayers(newPlayers,message){
  if(!token()){setStatus('playerStatus','Enter your GitHub Personal Access Token before changing the player roster.','error');$('token').focus();return false}
  const r=await fetch(`${API_BASE}/contents/${PLAYER_FILE}?ref=${BRANCH}&t=${Date.now()}`,{headers:headers(true)});
  if(!r.ok)throw new Error(`GitHub roster read failed (HTTP ${r.status}).`);
  const current=await r.json();
  const put=await fetch(`${API_BASE}/contents/${PLAYER_FILE}`,{method:'PUT',headers:{...headers(true),'Content-Type':'application/json'},body:JSON.stringify({message,content:encode(newPlayers),sha:current.sha,branch:BRANCH})});
  const result=await put.json();if(!put.ok)throw new Error(result.message||`GitHub roster write failed (HTTP ${put.status}).`);
  players=[...newPlayers].sort((a,b)=>a.localeCompare(b));populateSelects();renderPlayers();return true;
}
async function addPlayer(){
  clearStatus('playerStatus');const name=titleCase($('newPlayer').value);
  if(!name){setStatus('playerStatus','Enter a player name.','error');return}
  if(players.some(p=>norm(p)===norm(name))){setStatus('playerStatus',`${name} is already on the roster.`,'error');return}
  const b=$('addPlayer');b.disabled=true;setStatus('playerStatus',`Adding ${name} to GitHub...`,'working');
  try{const list=[...players,name].sort((a,b)=>a.localeCompare(b));if(await savePlayers(list,`Add player: ${name}`)){$('newPlayer').value='';setStatus('playerStatus',`${name} added successfully. The player is now available in both dropdowns.`,'success')}}catch(e){setStatus('playerStatus',e.message,'error')}finally{b.disabled=false}
}
async function removePlayer(name){
  if(!confirm(`Remove "${name}" from the player roster?\n\nExisting team-kill history will not be deleted.`))return;
  try{setStatus('playerStatus',`Removing ${name} from GitHub...`,'working');const list=players.filter(p=>norm(p)!==norm(name));if(await savePlayers(list,`Remove player: ${name}`))setStatus('playerStatus',`${name} removed from the roster. Existing incidents were not changed.`,'success')}catch(e){setStatus('playerStatus',e.message,'error')}
}
function nextId(data){const max=data.reduce((n,i)=>Math.max(n,Number(String(i.id||'').replace(/^TK-/i,''))||0),0);return`TK-${String(max+1).padStart(4,'0')}`}
function renderRecent(){
  const recent=[...incidents].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id))).slice(0,10);
  $('adminRecent').innerHTML=`<div class="table-head"><span>TK ID</span><span>KILLER</span><span>VICTIM</span><span>DATE</span><span>MAP</span><span>NOTES</span><span>CLIP</span></div>`+recent.map(i=>`<div class="incident-row"><span class="tkid">${esc(i.id)}</span><span class="killer">${esc(titleCase(i.killer))}</span><span class="victim">${esc(titleCase(i.victim))}</span><span class="date">${formatDate(i.date)}</span><span class="map">${esc(i.map)}</span><span class="notes" title="${esc(i.notes||'')}">${esc(i.notes||'No notes recorded.')}</span><span>${i.clip?`<a class="clip-icon" href="${esc(i.clip)}" target="_blank" rel="noopener">↗</a>`:''}</span></div>`).join('');
}
function validate(){const k=$('killer').value,v=$('victim').value,d=$('date').value,m=$('map').value,c=$('clip').value.trim();if(!k||!v)return'Select both players.';if(norm(k)===norm(v))return'The killer and victim cannot be the same player.';if(!d)return'Select a date.';if(!m)return'Select a map.';if(c){try{new URL(c)}catch{return'The video clip URL is not valid.'}}return''}
async function addKill(){
  clearStatus('status');const error=validate();if(error){setStatus('status',error,'error');return}
  if(!token()){setStatus('status','Enter your GitHub Personal Access Token before adding an incident.','error');$('token').focus();return}
  const b=$('addKill');b.disabled=true;setStatus('status','Adding team kill to GitHub...','working');
  try{
    const current=await readFile(INCIDENT_FILE),data=Array.isArray(current.data)?current.data:[];
    const incident={id:nextId(data),killer:$('killer').value,victim:$('victim').value,date:$('date').value,map:$('map').value,notes:$('notes').value.trim(),clip:$('clip').value.trim()};
    const put=await fetch(`${API_BASE}/contents/${INCIDENT_FILE}`,{method:'PUT',headers:{...headers(true),'Content-Type':'application/json'},body:JSON.stringify({message:`Add ${incident.id}: ${incident.killer} → ${incident.victim}`,content:encode([...data,incident]),sha:current.sha,branch:BRANCH})});
    const result=await put.json();if(!put.ok)throw new Error(result.message||`GitHub write failed (HTTP ${put.status}).`);
    incidents=[...data,incident];renderRecent();clearForm();renderPlayers();setStatus('status',`${incident.id} added successfully. GitHub has been updated.`,'success');
  }catch(e){setStatus('status',e.message,'error')}finally{b.disabled=false}
}
function clearForm(){$('killer').value='';$('victim').value='';$('date').value=new Date().toISOString().slice(0,10);$('map').value='';$('notes').value='';$('clip').value=''}
function formatDate(v){if(!v)return'Unknown';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

$('date').value=new Date().toISOString().slice(0,10);
$('addPlayer').addEventListener('click',addPlayer);
$('newPlayer').addEventListener('keydown',e=>{if(e.key==='Enter')addPlayer()});
$('addKill').addEventListener('click',addKill);
$('clearForm').addEventListener('click',()=>{clearForm();clearStatus('status')});
loadData();
