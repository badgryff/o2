const cfg = window.O2_CONFIG || {};
const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
const TOKEN_KEY = 'o2_session_token';
const USER_KEY = 'o2_session_user';
const GROUP_KEY = 'o2_active_group';
const EVIDENCE_BUCKET = 'o2-evidence';
const MAX_FILES = 8;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const CATS = {
  choreography: ['Choreo Memorisation', 'c1'], cleaning: ['Details / Cleaning', 'c2'], dynamics: ['Dynamics', 'c3'],
  isolations: ['Isolations', 'c4'], expressions: ['Facial Expressions', 'c5'], stamina: ['Stamina', 'c6'],
  foundation: ['Foundation', 'c7'], formation: ['Formation Revision', 'c8'], extensions: ['Extensions', 'c9'],
  stability: ['Stability', 'c10']
};
const NAME_COLORS = {
  default:'#ffffff', o2blue:'#4d88ff', sky:'#73c7ff', cyan:'#4fe4ef', mint:'#6be0b3',
  lime:'#b8e85c', gold:'#ffd166', orange:'#ff9d5c', pink:'#ff7db7', lavender:'#b99cff', red:'#ff6b75'
};
const NAME_COLOR_LABELS = {default:'Default',o2blue:'O2 Blue',sky:'Sky',cyan:'Cyan',mint:'Mint',lime:'Lime',gold:'Gold',orange:'Orange',pink:'Pink',lavender:'Lavender',red:'Red'};
const NAME_FONTS = {
  default:'inherit', serif:'Georgia, Times New Roman, serif', mono:'ui-monospace, SFMono-Regular, Menlo, monospace',
  rounded:'Arial Rounded MT Bold, Avenir Next, Arial, sans-serif', condensed:'Arial Narrow, Helvetica Neue, sans-serif',
  elegant:'Didot, Bodoni 72, Georgia, serif'
};
const NAME_FONT_LABELS = {default:'Default',serif:'Classic Serif',mono:'Studio Mono',rounded:'Bubble Rounded',condensed:'Stage Condensed',elegant:'Editorial'};
const THEME_LABELS = {
  default:'Default', trainee_grid:'Trainee Grid', blue_pulse:'Blue Pulse', neon_stage:'Neon Stage',
  midnight_chrome:'Midnight Chrome', aurora:'Aurora', prism:'Prism', redline:'Redline', superstar_gold:'Superstar Gold'
};
const MEDAL_TIER_ICONS = {
  weekly:'🏆', passionate:'💙', avid:'⚡', zealous:'🔥', fanatical:'💥', infatuated:'💎', maniacal:'🌀',
  novice:'🎓', devoted:'💎', ace:'⭐', debut:'🎤', superstar:'🌟'
};
let state = { user: null, group: null, groups: [], role: 'member', entries: [], homework: [], members: [], notifications: [], tab: 'feed', profileUserId: null };
const demoEntries = [{
  id: 'd1', user_id: 'demo1', display_name: 'Hanny', duration_minutes: 150,
  description: 'Worked on the chorus and transition into the dance break. Repeated the formation change slowly, then brought it back to full speed.',
  improvements: 'Cleaner arm lines and much better timing in the second chorus.', challenges: 'Keep stamina consistent through the final section.',
  categories: ['choreography', 'cleaning', 'dynamics', 'formation'], created_at: new Date().toISOString(), homework_completed: true,
  reactions: 12, comments: 2, comment_items: [{id:'c1',display_name:'Jiwoo',body:'The formation change looked much cleaner today 🔥',created_at:new Date().toISOString()}], media: []
}];
const demoHW = [{ id: 'h1', title: 'Send practice video to teacher', due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), completed: false }];
function esc(s = '') { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function fmtMin(m) { return `${Math.floor(m / 60) ? Math.floor(m / 60) + 'h ' : ''}${m % 60 ? m % 60 + 'm' : ''}`.trim() || '0m'; }
function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2800); }
async function rpc(name, args = {}) { if (!sb) throw new Error('Supabase is not configured.'); const { data, error } = await sb.rpc(name, args); if (error) throw new Error(error.message.replace(/^.*?: /, '')); return data; }
function cachedUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
async function boot() { state.user = cachedUser(); await refresh(); }
async function refresh(groupId = localStorage.getItem(GROUP_KEY) || null) {
  if (!configured) { state.entries = demoEntries; state.homework = demoHW; state.members = []; state.groups = []; render(); return; }
  if (!getToken()) { state.user = null; state.group = null; state.groups = []; state.entries = []; state.homework = []; state.members = []; render(); return; }
  try {
    const d = await rpc('o2_dashboard_v8', { p_token: getToken(), p_group_id: groupId || null });
    if (!d?.authenticated) { clearSession(); render(); return; }
    state.user = d.user; localStorage.setItem(USER_KEY, JSON.stringify(d.user));
    state.groups = d.groups || [];
    state.group = d.group; state.role = d.group?.role || 'member'; state.entries = d.entries || []; state.homework = d.homework || []; state.members = d.members || []; state.notifications = d.notifications || [];
    const newlyEarned = d.new_medals || [];
    if (state.group?.id) localStorage.setItem(GROUP_KEY, state.group.id); else localStorage.removeItem(GROUP_KEY);
    if (!state.profileUserId && state.user) state.profileUserId = state.user.id;
    render();
    if (newlyEarned.length) setTimeout(()=>medalEarnedModal(newlyEarned), 80);
  } catch (e) { toast(e.message); render(); }
}
function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem(GROUP_KEY); state.user = null; state.group = null; state.groups = []; state.entries = []; state.homework = []; state.members = []; state.notifications = []; state.profileUserId = null; }
function render() {
  const app = $('#app');
  app.innerHTML = `<main class="shell"><aside class="sidebar"><div class="brand"><img src="assets/o2-logo.png"><span>Practice Journal</span></div>${state.user ? groupSwitcher() : ''}<nav>${nav('feed','🏠','Feed')}${nav('journal','📝','My Journal')}${nav('homework','✅','Homework')}${nav('stats','📊','Stats')}${nav('members','👥','Members')}${nav('notifications','🔔','Notifications', unreadCount())}${nav('profile','👤','Profile')}</nav><div class="sideBottom">${state.user ? `<button id="manageGroups" class="ghost">＋ Join / create group</button><button id="signout" class="ghost">↪ Sign out</button>` : `<button id="signin" class="login">Sign in</button>`}</div></aside><section class="content"><header class="topbar"><div><p class="eyebrow">O2 STUDIOS</p><h1>${title()}</h1></div>${state.group ? `<button id="newEntry" class="primary">＋ New Entry</button>` : ''}</header>${!configured ? `<div class="setupBanner"><b>Demo mode.</b> Add your Supabase URL + anon key to config.js.</div>` : ''}${configured && state.user && !state.group ? groupSetup() : configured && !state.user ? welcome() : view()}</section></main><div id="modal"></div>`;
  bind();
}
function groupSwitcher() { if (!state.groups?.length) return ''; const current=state.group?.name||'Choose group'; return `<div class="groupSwitchWrap"><label>GROUP</label><button id="groupSwitch" class="groupSwitchButton"><span>${esc(current)}</span><b>Switch</b></button></div>`; }
function unreadCount(){ return (state.notifications||[]).filter(n=>!n.read_at).length; }
function nav(k, i, t, badge=0) { return `<button class="nav ${state.tab === k ? 'active' : ''}" data-tab="${k}"><span class="navEmoji">${i}</span><label>${t}</label>${badge?`<b class="navBadge">${badge>99?'99+':badge}</b>`:''}</button>`; }
function title() { return ({ feed:'Practice Feed', journal:'My Journal', homework:'Homework', stats:'Stats', members:'Members', notifications:'Notifications', profile:'Profile' })[state.tab]; }
function welcome() { return `<section class="empty"><img src="assets/o2-logo.png"><h2>O2 Practice Journal</h2><p>Sign in with your O2 username. No email address is used.</p><button class="primary" id="signin2">Sign in / create account</button></section>`; }
function groupSetup() { return `<section class="empty"><h2>Join your O2 group</h2><p>Create a group for your team or enter an invite code from another member.</p><div class="joinGrid"><button class="primary" id="createGroup">Create group</button><button class="secondary" id="joinGroup">Join with code</button></div></section>`; }
function view() { if (state.tab === 'feed') return feed(); if (state.tab === 'journal') return journal(); if (state.tab === 'homework') return homeworkView(); if (state.tab === 'stats') return stats(); if (state.tab === 'notifications') return notificationsView(); if (state.tab === 'profile') return profileView(); return membersView(); }
function feed() { return `<div class="grid"><div class="feed">${state.entries.length ? state.entries.map(entryCard).join('') : '<div class="emptyCard">No practice entries yet. Be first 👀</div>'}</div><aside class="rightcol">${homeworkPanel()}${leader()}</aside></div>`; }
function profileAvatar(url, name, large = false) { return url ? `<div class="avatar ${large?'large':''} photo"><img src="${esc(url)}" alt="${esc(name)}"></div>` : `<div class="avatar ${large?'large':''}">${esc((name || 'M')[0])}</div>`; }
function roleBadge(role){ if(role==='admin') return '<span class="adminCrown" title="Admin">👑</span>'; if(role==='teacher') return '<span class="teacherBadge" title="Teacher">📚</span>'; return ''; }
function traineeBadges(perks={}){ const b=perks.rank_badges||[]; return `${b.includes('diamond')?'<span class="rankDiamond" title="Devoted Trainee">💎</span>':''}${b.includes('star')?'<span class="rankStar" title="Ace Trainee">⭐</span>':''}`; }
function memberName(name, role, person={}){ const ck=NAME_COLORS[person.name_color] ? person.name_color : 'default', fk=NAME_FONTS[person.name_font] ? person.name_font : 'default'; return `<span class="styledName" style="color:${NAME_COLORS[ck]};font-family:${NAME_FONTS[fk]}">${esc(name)}</span> ${roleBadge(role)} ${traineeBadges(person.perks||{})}`; }
function canSetHomework(){ return state.role==='admin' || state.role==='teacher'; }
function reactionEmoji(){ return state.user?.perks?.super_fire ? '❤️‍🔥' : '🔥'; }
function medalIcon(m){ if((m.medal_key||'').startsWith('weekly:')) return '🏆'; return MEDAL_TIER_ICONS[m.tier] || '🏅'; }
function medalDescription(m){
  if((m.medal_key||'').startsWith('weekly:')) return `Most practice time in ${esc(m.meta?.group_name||'the group')} · week of ${esc(m.meta?.week_start||'')}`;
  if(m.category) return `${esc(CATS[m.category]?.[0]||m.category)} · ${fmtMin(Number(m.meta?.minutes||0))} cumulative`;
  const mins=Number(m.meta?.minutes||0); return mins ? `${fmtMin(mins)} total practice` : '';
}
function themeUnlockForMedal(m){
  const map={passionate:'blue_pulse',avid:'neon_stage',zealous:'midnight_chrome',fanatical:'aurora',infatuated:'prism',maniacal:'redline',novice:'trainee_grid',superstar:'superstar_gold'};
  return map[m.tier] ? THEME_LABELS[map[m.tier]] : '';
}

function entryCard(e) {
  const own = !!state.user && e.user_id === state.user.id;
  const canDelete = own || state.role === 'admin';
  const comments = e.comment_items || [];
  const media = e.media || [];
  return `<article class="entryCard" data-entry="${e.id}"><div class="entryHead">${profileAvatar(e.avatar_url,e.display_name)}<button class="profileLink" data-profile="${e.user_id}"><strong>${(()=>{const a=state.members.find(m=>m.user_id===e.user_id)||(e.user_id===state.user?.id?state.user:{});return memberName(e.display_name,a.role||'',a)})()}</strong><span>${new Date(e.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></button><div class="entryActions"><div class="duration">◷ ${fmtMin(e.duration_minutes)}</div>${(own || state.role==='admin') ? `<button class="deleteEntry" data-id="${e.id}" title="${own?'Delete your entry':'Admin: delete entry'}">×</button>` : ''}</div></div><div class="flairs">${(e.categories || []).map(c => `<span class="flair ${CATS[c]?.[1] || ''}">${esc(CATS[c]?.[0] || c)}</span>`).join('')}</div><p class="desc">${esc(e.description)}</p>${mediaGallery(media)}<div class="split"><div><small>IMPROVEMENTS</small><p>${esc(e.improvements || '—')}</p></div><div><small>CHALLENGES</small><p>${esc(e.challenges || '—')}</p></div></div><div class="entryFoot"><span class="${e.homework_completed ? 'done' : 'pending'}">✓ Homework ${e.homework_completed ? 'completed' : 'pending'}</span><div class="social"><button class="react socialAction ${state.user?.perks?.super_fire?'superFire':''}" data-id="${e.id}" title="${state.user?.perks?.super_fire?'Super Fire unlocked by Superstar':'React'}"><span>${reactionEmoji()}</span><b>${e.reactions || 0}</b><em>${state.user?.perks?.super_fire?'Super Fire':'React'}</em></button><button class="comment socialAction" data-id="${e.id}"><span>💬</span><b>${e.comments || 0}</b><em>Comment</em></button></div></div>${comments.length ? `<div class="commentsPreview">${comments.slice(0,3).map(commentRow).join('')}${comments.length > 3 ? `<button class="comment moreComments" data-id="${e.id}">View all ${comments.length} comments</button>` : ''}</div>` : ''}</article>`;
}
function mediaGallery(media) {
  if (!media?.length) return '';
  return `<div class="evidenceGrid">${media.map(m => m.media_type === 'video' ? `<button class="evidence videoEvidence" data-media="${esc(m.url)}"><video src="${esc(m.url)}" preload="metadata"></video><span>▶</span></button>` : `<button class="evidence imageEvidence" data-media="${esc(m.url)}"><img src="${esc(m.url)}" alt="Practice evidence"></button>`).join('')}</div>`;
}
function commentRow(c) { return `<div class="commentRow">${profileAvatar(c.avatar_url,c.display_name)}<div><b>${esc(c.display_name)}</b><p>${esc(c.body)}</p><small>${new Date(c.created_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div></div>`; }
function homeworkPanel() { return `<section class="panel"><div class="panelTitle"><b>Homework</b>${canSetHomework() ? '<button id="addHomework">+ Add</button>' : ''}</div>${state.homework.length ? state.homework.slice(0,4).map(h => `<div class="hw"><input class="hwcheck" data-id="${h.id}" type="checkbox" ${h.completed ? 'checked' : ''}><span><strong>${esc(h.title)}</strong><small>Due ${new Date(h.due_date+'T00:00:00').toLocaleDateString()}</small></span><button class="deleteHomework miniDelete" data-id="${h.id}" title="Delete homework">×</button></div>`).join('') : '<p class="muted">Nothing due.</p>'}</section>`; }
function leader() { const s = {}; state.entries.forEach(e => s[e.display_name] = (s[e.display_name] || 0) + e.duration_minutes); return `<section class="panel"><div class="panelTitle"><b>Practice ranking</b></div>${Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,m],i)=>`<div class="rank"><span>${i+1}</span><b>${esc(n)}</b><em>${(m/60).toFixed(1)}h</em></div>`).join('') || '<p class="muted">No practice logged yet.</p>'}</section>`; }
function journal() { const mine = state.entries.filter(e => e.user_id === state.user?.id); const mins = mine.reduce((a,b)=>a+b.duration_minutes,0); return `<div class="single"><div class="metricRow">${metric('Entries',mine.length)}${metric('Practice time',(mins/60).toFixed(1)+'h')}${metric('Current streak',streak(mine)+' days')}</div><div class="feed">${mine.map(entryCard).join('') || '<div class="emptyCard">Your journal is empty.</div>'}</div></div>`; }
function homeworkView() { return `<div class="single"><div class="sectionHead"><h2>Weekly Homework</h2>${canSetHomework()?'<button class="secondary" id="addHomework">＋ Add homework</button>':''}</div>${state.homework.map(h => `<div class="homeworkRow"><input class="hwcheck" data-id="${h.id}" type="checkbox" ${h.completed?'checked':''}><div><b>${esc(h.title)}</b><span>Due ${new Date(h.due_date+'T00:00:00').toLocaleDateString()}</span></div><em>${h.completed?'Complete':'To do'}</em><button class="deleteHomework miniDelete" data-id="${h.id}" title="Delete homework">×</button></div>`).join('') || '<div class="emptyCard">No homework has been added.</div>'}</div>`; }

function notificationIcon(kind){ return kind==='reaction'?'🔥':kind==='comment'?'💬':kind==='homework'?'📚':'🔔'; }
function notificationText(n){
  if(n.kind==='reaction') return `${esc(n.actor_name||'Someone')} reacted to your practice entry.`;
  if(n.kind==='comment') return `${esc(n.actor_name||'Someone')} commented on your practice entry${n.body?`: “${esc(n.body)}”`:'.'}`;
  if(n.kind==='homework') return `New homework: ${esc(n.body||'A new task was assigned.')}`;
  return esc(n.body||'New notification');
}
function notificationsView(){
  const items=state.notifications||[];
  return `<div class="single"><div class="sectionHead"><div><h2>Notifications</h2><p class="muted">${unreadCount()} unread</p></div>${unreadCount()?'<button id="markNotificationsRead" class="secondary">Mark all read</button>':''}</div><div class="notificationList">${items.length?items.map(n=>`<article class="notificationItem ${n.read_at?'':'unread'}"><span class="notificationIcon">${notificationIcon(n.kind)}</span><div><p>${notificationText(n)}</p><small>${esc(n.group_name||'')} · ${new Date(n.created_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div>${n.read_at?'':'<i></i>'}</article>`).join(''):'<div class="emptyCard">No notifications yet.</div>'}</div></div>`;
}
function metric(l,v) { return `<div class="metric"><span>${l}</span><strong>${v}</strong></div>`; }
function streak(entries) { const days = new Set(entries.map(e => new Date(e.created_at).toDateString())); let n = 0, d = new Date(); while (days.has(d.toDateString())) { n++; d.setDate(d.getDate()-1); } return n; }
function lineChart(entries){
  const recent=[...entries].slice(0,14).reverse();
  if(!recent.length) return '<div class="lineEmpty">No practice data yet.</div>';
  const W=700,H=210,padX=30,padY=24,max=Math.max(60,...recent.map(e=>Number(e.duration_minutes)||0));
  const pts=recent.map((e,i)=>{const x=recent.length===1?W/2:padX+i*(W-padX*2)/(recent.length-1),y=H-padY-(Number(e.duration_minutes)||0)/(max)*(H-padY*2);return {x,y,e};});
  const poly=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return `<div class="lineChartWrap"><svg class="lineChart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Practice time line graph"><line x1="${padX}" y1="${H-padY}" x2="${W-padX}" y2="${H-padY}" class="axisLine"/><line x1="${padX}" y1="${padY}" x2="${padX}" y2="${H-padY}" class="axisLine"/><polyline points="${poly}" class="practiceLine"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" class="practicePoint"><title>${new Date(p.e.created_at).toLocaleDateString()}: ${fmtMin(p.e.duration_minutes)}</title></circle>`).join('')}</svg><div class="lineLabels">${recent.map(e=>`<span>${new Date(e.created_at).toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}</span>`).join('')}</div></div>`;
}
function stats() {
  const mine=state.entries.filter(e=>e.user_id===state.user?.id), mins=mine.reduce((a,b)=>a+b.duration_minutes,0), done=state.homework.filter(h=>h.completed).length, comp=state.homework.length?Math.round(done/state.homework.length*100):0;
  return `<div class="single"><div class="metricRow">${metric('Total practice',(mins/60).toFixed(1)+'h')}${metric('Homework',comp+'%')}${metric('Practice streak',streak(mine)+' days')}</div><section class="chartCard"><p class="eyebrow">PRACTICE TIME</p><h2>Recent sessions</h2>${lineChart(mine)}</section><section class="chartCard"><p class="eyebrow">CATEGORY FOCUS</p><div class="categoryStats">${Object.entries(CATS).map(([k,v])=>{const n=mine.filter(e=>(e.categories||[]).includes(k)).length; return `<div><span>${v[0]}</span><div><i style="width:${mine.length?Math.round(n/mine.length*100):0}%"></i></div><b>${n}</b></div>`;}).join('')}</div></section></div>`;
}
function memberById(id) { if (id === state.user?.id) return {...state.user, user_id: state.user.id, role: state.role}; return state.members.find(m => m.user_id === id) || null; }
function profileView() {
  const id = state.profileUserId || state.user?.id;
  const p = memberById(id);
  if (!p) return `<div class="emptyCard">Profile not found.</div>`;
  const entries = state.entries.filter(e=>e.user_id===id), mins=entries.reduce((a,b)=>a+b.duration_minutes,0), recent=[...entries].slice(0,10).reverse(), max=Math.max(1,...recent.map(e=>e.duration_minutes)), own=id===state.user?.id;
  const medals=p.medals||[], theme=THEME_LABELS[p.profile_theme]?p.profile_theme:'default';
  return `<div class="single profilePage"><section class="profileHero theme-${theme}">${profileAvatar(p.avatar_url,p.display_name,true)}<div class="profileIdentity"><p class="eyebrow">${esc((p.role||'member').toUpperCase())}</p><h2>${memberName(p.display_name,p.role,p)}</h2><span>@${esc(p.username)}</span><p class="bio">${esc(p.bio || (own ? 'Add a bio to your O2 profile.' : 'No bio yet.'))}</p></div>${own?`<button id="editProfile" class="secondary">Edit profile</button>`:''}</section><div class="metricRow">${metric('Practice time',fmtMin(Number(p.perks?.total_minutes||mins)))}${metric('Entries',entries.length)}${metric('Medals',medals.length)}</div><section class="medalSection"><div class="sectionHead"><div><p class="eyebrow">MEDALS</p><h2>Achievements & perks</h2></div></div>${medals.length?`<div class="medalGrid">${medals.map(medalCard).join('')}</div>`:'<div class="emptyCard">No medals yet. Your first unlock is Novice Trainee after more than 5 hours of practice.</div>'}</section><section class="chartCard"><p class="eyebrow">PRACTICE HISTORY</p><h2>Recent sessions</h2><div class="bars profileBars">${recent.map((e,i)=>`<div><span style="height:${Math.max(8,e.duration_minutes/max*100)}%"></span><small>${new Date(e.created_at).toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}</small></div>`).join('')}</div></section><div class="feed">${entries.map(entryCard).join('') || '<div class="emptyCard">No practice entries yet.</div>'}</div></div>`;
}
function medalCard(m){
  const unlock=themeUnlockForMedal(m);
  return `<article class="medalCard tier-${esc(m.tier||'')}"><div class="medalIcon">${medalIcon(m)}</div><div><h3>${esc(m.medal_name||'Medal')}</h3><p>${medalDescription(m)}</p>${unlock?`<small>Unlocks ${esc(unlock)} profile theme</small>`:''}</div></article>`;
}
function medalEarnedModal(medals){
  const shown=medals.slice(0,8);
  modal(`<button class="close">×</button><div class="medalEarned"><div class="medalBurst">🏅</div><p class="eyebrow">MEDAL EARNED</p><h2>${medals.length===1?'New achievement unlocked!':`${medals.length} achievements unlocked!`}</h2><div class="earnedList">${shown.map(m=>`<div>${medalIcon(m)} <span><b>${esc(m.medal_name)}</b><small>${medalDescription(m)}</small></span></div>`).join('')}${medals.length>shown.length?`<p class="muted">+ ${medals.length-shown.length} more — view your profile for all medals.</p>`:''}</div><button id="medalProfile" class="primary wide">View medals</button></div>`);
  $('#medalProfile').onclick=()=>{state.profileUserId=state.user?.id;state.tab='profile';$('#modal').innerHTML='';render();};
}
function bind() {
  $$('.nav').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab; if(state.tab==='profile')state.profileUserId=state.user?.id; render();});
  $('#signin')?.addEventListener('click',authModal); $('#signin2')?.addEventListener('click',authModal);
  $('#signout')?.addEventListener('click',async()=>{try{if(getToken())await rpc('o2_logout',{p_token:getToken()});}catch{} clearSession(); render();});
  $('#newEntry')?.addEventListener('click',entryModal); $('#createGroup')?.addEventListener('click',createGroupModal); $('#joinGroup')?.addEventListener('click',joinGroupModal); $('#joinAnother')?.addEventListener('click',joinGroupModal); $('#createAnother')?.addEventListener('click',createGroupModal); $('#groupSwitch')?.addEventListener('click',groupSwitchModal); $('#manageGroups')?.addEventListener('click',groupManagerModal);
  $$('#addHomework').forEach(b=>b.addEventListener('click',homeworkModal)); $$('.hwcheck').forEach(x=>x.onchange=()=>toggleHW(x.dataset.id,x.checked)); $$('.deleteHomework').forEach(b=>b.onclick=()=>deleteHomework(b.dataset.id));
  $$('.react').forEach(b=>b.onclick=()=>react(b.dataset.id)); $$('.comment').forEach(b=>b.onclick=()=>commentModal(b.dataset.id));
  $$('.deleteEntry').forEach(b=>b.onclick=()=>deleteEntry(b.dataset.id));
  $$('.deleteHomework').forEach(b=>b.onclick=()=>deleteHomework(b.dataset.id));
  $$('.viewProfile,.profileLink').forEach(b=>b.onclick=()=>{state.profileUserId=b.dataset.profile; state.tab='profile'; render();});
  $$('.evidence').forEach(b=>b.onclick=()=>mediaModal(b.dataset.media));
  $('#editProfile')?.addEventListener('click',editProfileModal);
  $('#copyCode')?.addEventListener('click',()=>{navigator.clipboard.writeText(state.group.invite_code); toast('Invite code copied');});
  $$('.memberManage').forEach(b=>b.onclick=()=>memberManageModal(b.dataset.user,b.dataset.name,b.dataset.role));
  $('#markNotificationsRead')?.addEventListener('click',markNotificationsRead);
}
function modal(html) { $('#modal').innerHTML=`<div class="overlay"><div class="modal">${html}</div></div>`; $('.close')?.addEventListener('click',()=>$('#modal').innerHTML=''); }
function cleanUsername(v='') { return v.trim().toLowerCase().replace(/\s+/g,''); }
function validUsername(u) { return /^[a-z0-9._-]{3,24}$/.test(cleanUsername(u)); }
function authModal() {
  modal(`<button class="close">×</button><p class="eyebrow">O2 ACCOUNT</p><div class="authTabs"><button id="tabLogin" class="authTab active">Sign in</button><button id="tabSignup" class="authTab">Create account</button></div><div id="signupName" style="display:none"><label>Display name<input id="aname" autocomplete="name" placeholder="Jeremy"></label></div><label>Username<input id="auser" autocomplete="username" placeholder="jeremy" maxlength="24"></label><label>Password<input id="apass" type="password" autocomplete="current-password" minlength="6"></label><button id="authGo" class="primary wide">Sign in</button><p class="muted authHint">No email is used. Usernames use 3–24 letters, numbers, dots, underscores or hyphens.</p><p id="amsg" class="muted"></p>`);
  let mode='login'; const msg=$('#amsg'), go=$('#authGo');
  const setMode=m=>{mode=m;$('#tabLogin').classList.toggle('active',m==='login');$('#tabSignup').classList.toggle('active',m==='signup');$('#signupName').style.display=m==='signup'?'block':'none';go.textContent=m==='signup'?'Create account':'Sign in';msg.textContent='';};
  $('#tabLogin').onclick=()=>setMode('login'); $('#tabSignup').onclick=()=>setMode('signup');
  go.onclick=async()=>{const username=cleanUsername($('#auser').value),password=$('#apass').value,displayName=$('#aname')?.value.trim()||username;if(!validUsername(username)){msg.textContent='Username must be 3–24 characters using letters, numbers, ., _ or -.';return;}if(password.length<6){msg.textContent='Password must be at least 6 characters.';return;}go.disabled=true;msg.textContent=mode==='signup'?'Creating account…':'Signing in…';try{const d=mode==='signup'?await rpc('o2_register',{p_username:username,p_password:password,p_display_name:displayName}):await rpc('o2_login',{p_username:username,p_password:password});localStorage.setItem(TOKEN_KEY,d.token);localStorage.setItem(USER_KEY,JSON.stringify(d.user));state.user=d.user;state.profileUserId=d.user.id;$('#modal').innerHTML='';toast(mode==='signup'?'Account created':'Signed in');await refresh();}catch(e){msg.textContent=e.message;}finally{go.disabled=false;}};
}
function groupManagerModal() { modal(`<button class="close">×</button><p class="eyebrow">GROUPS</p><h2>Your O2 groups</h2><div class="groupManagerList">${state.groups.map(g=>`<button class="groupChoice" data-group="${g.id}"><span>${esc(g.name)}</span><small>${esc(g.role)}</small></button>`).join('')||'<p class="muted">No groups yet.</p>'}</div><div class="joinGrid"><button id="gmCreate" class="primary">Create group</button><button id="gmJoin" class="secondary">Join with code</button></div>`); $$('.groupChoice').forEach(b=>b.onclick=async()=>{localStorage.setItem(GROUP_KEY,b.dataset.group);$('#modal').innerHTML='';await refresh(b.dataset.group);}); $('#gmCreate').onclick=createGroupModal; $('#gmJoin').onclick=joinGroupModal; }
function createGroupModal() { modal(`<button class="close">×</button><p class="eyebrow">NEW GROUP</p><h2>Create your team</h2><label>Group name<input id="gname" placeholder="O2 Team A"></label><button id="gcreate" class="primary wide">Create group</button>`); $('#gcreate').onclick=async()=>{try{const g=await rpc('o2_create_group',{p_token:getToken(),p_name:$('#gname').value});localStorage.setItem(GROUP_KEY,g.id);$('#modal').innerHTML='';toast('Group created');await refresh(g.id);}catch(e){toast(e.message);}}; }
function joinGroupModal() { modal(`<button class="close">×</button><p class="eyebrow">JOIN GROUP</p><h2>Enter invite code</h2><label>Invite code<input id="gcode" placeholder="ABC123" autocomplete="off"></label><button id="gjoin" class="primary wide">Join group</button>`); $('#gjoin').onclick=async()=>{try{const g=await rpc('o2_join_group',{p_token:getToken(),p_invite_code:$('#gcode').value});localStorage.setItem(GROUP_KEY,g.id);$('#modal').innerHTML='';toast('Joined group');await refresh(g.id);}catch(e){toast(e.message);}}; }
async function uploadEvidenceFiles(files, entryId) {
  if (!files?.length) return [];
  if (files.length > MAX_FILES) throw new Error(`You can add up to ${MAX_FILES} files per entry.`);
  const uploaded=[];
  for (const file of files) {
    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) throw new Error(`${file.name} is not an image or video.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 50 MB.`);
    const ext=(file.name.split('.').pop()||'file').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const path=`entries/${state.user.id}/${entryId}/${crypto.randomUUID()}.${ext}`;
    const {error}=await sb.storage.from(EVIDENCE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(error) throw new Error(`Upload failed: ${error.message}`);
    const {data}=sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
    const type=file.type.startsWith('video/')?'video':'image';
    await rpc('o2_add_entry_media',{p_token:getToken(),p_entry_id:entryId,p_url:data.publicUrl,p_media_type:type,p_file_name:file.name});
    uploaded.push(data.publicUrl);
  }
  return uploaded;
}
function entryModal() {
  modal(`<button class="close">×</button><p class="eyebrow">NEW PRACTICE ENTRY</p><h2>Log today’s practice</h2><label>Practice duration <span id="durationValue" class="durationValue">1h</span><div class="durationSliderRow"><span>5m</span><input id="duration" type="range" min="5" max="360" step="5" value="60"><span>6h</span></div></label><label>What did you work on?</label><div class="selectFlairs">${Object.entries(CATS).map(([k,v])=>`<button class="flair ${v[1]}" data-cat="${k}">${v[0]}</button>`).join('')}</div><label>What did you actually work on?<textarea id="description" placeholder="Describe the session…"></textarea></label><div class="two"><label>Improvements<textarea id="improvements"></textarea></label><label>Challenges to overcome<textarea id="challenges"></textarea></label></div><label>Practice evidence <span class="fieldHint">Images/videos · up to 8 files · 50 MB each</span><input id="evidenceFiles" class="fileInput" type="file" accept="image/*,video/*" multiple></label><div id="filePreview" class="filePreview"></div><label class="check"><input id="hwdone" type="checkbox"> I completed this week’s homework</label><button id="publish" class="primary wide">Publish entry</button>`);
  const durationLabel=()=>{const m=+$('#duration').value; $('#durationValue').textContent=m<60?`${m}m`:(m%60?`${Math.floor(m/60)}h ${m%60}m`:`${m/60}h`);}; $('#duration').oninput=durationLabel; durationLabel();
  let selected=[]; $$('.selectFlairs .flair').forEach(b=>b.onclick=()=>{const c=b.dataset.cat;b.classList.toggle('selected');selected=selected.includes(c)?selected.filter(x=>x!==c):[...selected,c];});
  $('#evidenceFiles').onchange=()=>{const files=[...$('#evidenceFiles').files];$('#filePreview').innerHTML=files.map(f=>`<span>${esc(f.name)} <small>${(f.size/1024/1024).toFixed(1)} MB</small></span>`).join('');};
  $('#publish').onclick=async()=>{const btn=$('#publish'),files=[...$('#evidenceFiles').files];try{btn.disabled=true;btn.textContent='Publishing…';const eid=await rpc('o2_add_entry_v5',{p_token:getToken(),p_group_id:state.group.id,p_duration:+$('#duration').value||0,p_description:$('#description').value,p_improvements:$('#improvements').value,p_challenges:$('#challenges').value,p_categories:selected,p_homework_completed:$('#hwdone').checked});if(files.length){btn.textContent='Uploading evidence…';await uploadEvidenceFiles(files,eid);}$('#modal').innerHTML='';toast('Practice entry published');await refresh();}catch(e){toast(e.message);btn.disabled=false;btn.textContent='Publish entry';}};
}
function homeworkModal() { modal(`<button class="close">×</button><p class="eyebrow">GROUP HOMEWORK</p><h2>Add homework</h2><label>Task<input id="htitle" placeholder="Send practice video to teacher"></label><label>Due date<input id="hdate" type="date"></label><button id="hadd" class="primary wide">Add for everyone</button>`); $('#hadd').onclick=async()=>{try{await rpc('o2_add_homework_v7',{p_token:getToken(),p_group_id:state.group.id,p_title:$('#htitle').value,p_due_date:$('#hdate').value||null});$('#modal').innerHTML='';toast('Homework added');await refresh();}catch(e){toast(e.message);}}; }
async function toggleHW(id,done){try{await rpc('o2_set_homework',{p_token:getToken(),p_homework_id:id,p_completed:done});await refresh();}catch(e){toast(e.message);}}
async function deleteHomework(id){if(!confirm('Delete this homework for everyone?'))return;try{await rpc('o2_delete_homework',{p_token:getToken(),p_homework_id:id});toast('Homework deleted');await refresh();}catch(e){toast(e.message);}}
async function setMemberRole(userId,role){const label=role==='admin'?'make this member an admin':'remove admin access';if(!confirm(`Are you sure you want to ${label}?`))return;try{await rpc('o2_set_member_role',{p_token:getToken(),p_group_id:state.group.id,p_user_id:userId,p_role:role});toast(role==='admin'?'Admin added':'Admin access removed');await refresh();}catch(e){toast(e.message);}}
async function react(id){try{await rpc('o2_toggle_reaction',{p_token:getToken(),p_entry_id:id,p_emoji:reactionEmoji()});await refresh();}catch(e){toast(e.message);}}
function commentModal(id) {
  const entry=state.entries.find(e=>e.id===id), comments=entry?.comment_items||[];
  modal(`<button class="close">×</button><p class="eyebrow">COMMENTS</p><h2>${comments.length} comment${comments.length===1?'':'s'}</h2><div class="commentsModal">${comments.map(commentRow).join('')||'<p class="muted">No comments yet.</p>'}</div><label>Add a comment<textarea id="commentBody" placeholder="Write something supportive…"></textarea></label><button id="commentGo" class="primary wide">Post comment</button>`);
  $('#commentGo').onclick=async()=>{try{await rpc('o2_add_comment',{p_token:getToken(),p_entry_id:id,p_body:$('#commentBody').value});$('#modal').innerHTML='';toast('Comment posted');await refresh();}catch(e){toast(e.message);}};
}
async function deleteEntry(id) {
  if (!confirm('Delete this practice entry? This cannot be undone.')) return;
  try { await rpc('o2_delete_entry',{p_token:getToken(),p_entry_id:id}); toast('Entry deleted'); await refresh(); } catch(e){ toast(e.message); }
}
function mediaModal(url) {
  const entry=state.entries.flatMap(e=>e.media||[]).find(m=>m.url===url);
  const isVideo=entry?.media_type==='video' || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
  modal(`<button class="close">×</button><div class="mediaViewer">${isVideo?`<video src="${esc(url)}" controls autoplay playsinline></video>`:`<img src="${esc(url)}" alt="Practice evidence">`}</div>`);
}
async function uploadProfilePhoto(file) {
  if(!file) return state.user.avatar_url||'';
  if(!file.type.startsWith('image/')) throw new Error('Profile picture must be an image.');
  if(file.size>10*1024*1024) throw new Error('Profile picture must be under 10 MB.');
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const path=`profiles/${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from(EVIDENCE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if(error) throw new Error(`Upload failed: ${error.message}`);
  return sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(path).data.publicUrl;
}
function editProfileModal() {
  const p=memberById(state.user?.id)||state.user, perks=p?.perks||{}, unlocked=perks.unlocked_themes||['default'];
  const colorOptions=(perks.allow_name_color?Object.keys(NAME_COLORS):['default']).map(k=>`<option value="${k}" ${p.name_color===k?'selected':''}>${NAME_COLOR_LABELS[k]}</option>`).join('');
  const fontOptions=(perks.allow_name_font?Object.keys(NAME_FONTS):['default']).map(k=>`<option value="${k}" ${p.name_font===k?'selected':''}>${NAME_FONT_LABELS[k]}</option>`).join('');
  const themeOptions=unlocked.map(k=>`<option value="${k}" ${p.profile_theme===k?'selected':''}>${THEME_LABELS[k]||k}</option>`).join('');
  modal(`<button class="close">×</button><p class="eyebrow">PROFILE</p><h2>Edit profile</h2><label>Display name<input id="pname" maxlength="50" value="${esc(state.user.display_name||'')}"></label><label>Bio<textarea id="pbio" maxlength="300" placeholder="Dance style, goals, role in the group…">${esc(state.user.bio||'')}</textarea></label><label>Profile picture<input id="pavatar" class="fileInput" type="file" accept="image/*"></label><div class="profilePerkFields"><label>Name colour ${perks.allow_name_color?'':'<span class="locked">🔒 Novice Trainee</span>'}<select id="pcolor">${colorOptions}</select></label><label>Name font ${perks.allow_name_font?'':'<span class="locked">🔒 Debut Lineup</span>'}<select id="pfont">${fontOptions}</select></label><label>Profile decoration theme<select id="ptheme">${themeOptions}</select></label></div><button id="profileSave" class="primary wide">Save profile</button>`);
  $('#profileSave').onclick=async()=>{const btn=$('#profileSave');try{btn.disabled=true;btn.textContent='Saving…';const avatar=await uploadProfilePhoto($('#pavatar').files[0]);await rpc('o2_update_profile_v8',{p_token:getToken(),p_display_name:$('#pname').value,p_bio:$('#pbio').value,p_avatar_url:avatar,p_name_color:$('#pcolor').value,p_name_font:$('#pfont').value,p_profile_theme:$('#ptheme').value});$('#modal').innerHTML='';toast('Profile updated');await refresh();}catch(e){toast(e.message);btn.disabled=false;btn.textContent='Save profile';}};
}

function groupSwitchModal() {
  modal(`<button class="close">×</button><p class="eyebrow">YOUR GROUPS</p><h2>Switch group</h2><div class="groupList">${(state.groups||[]).map(g=>`<button class="groupChoice ${g.id===state.group?.id?'active':''}" data-group="${g.id}"><span><b>${esc(g.name)}</b><small>${esc(g.role)}</small></span>${g.id===state.group?.id?'<em>Current</em>':'<em>Open</em>'}</button>`).join('')||'<p class="muted">No groups yet.</p>'}</div><div class="joinGrid"><button id="switchJoin" class="secondary">＋ Join another</button><button id="switchCreate" class="primary">＋ Create group</button></div>`);
  $$('.groupChoice').forEach(b=>b.onclick=async()=>{localStorage.setItem(GROUP_KEY,b.dataset.group); state.profileUserId=state.user?.id; $('#modal').innerHTML=''; await refresh();});
  $('#switchJoin')?.addEventListener('click',joinGroupModal); $('#switchCreate')?.addEventListener('click',createGroupModal);
}
async function deleteHomework(id) {
  if (!confirm('Delete this homework for everyone?')) return;
  try { await rpc('o2_delete_homework',{p_token:getToken(),p_homework_id:id}); toast('Homework deleted'); await refresh(); } catch(e){ toast(e.message); }
}
async function setMemberRole(userId, role) {
  const action = role==='admin' ? 'make this member an admin' : 'remove admin access from this member';
  if (!confirm(`Are you sure you want to ${action}?`)) return;
  try { await rpc('o2_set_member_role',{p_token:getToken(),p_group_id:state.group.id,p_user_id:userId,p_role:role}); toast(role==='admin'?'Admin added':'Admin removed'); await refresh(); } catch(e){ toast(e.message); }
}

function memberManageModal(userId,name,currentRole){
  modal(`<button class="close">×</button><p class="eyebrow">ADMIN CONTROLS</p><h2>${esc(name)}</h2><p class="muted">Current role: <b>${esc(currentRole)}</b></p><div class="adminActionStack"><button class="roleSet ${currentRole==='teacher'?'active':''}" data-role="teacher">📚 Make teacher</button><button class="roleSet ${currentRole==='admin'?'active':''}" data-role="admin">👑 Make admin</button><button class="roleSet ${currentRole==='member'?'active':''}" data-role="member">👤 Make member</button><button id="removeMember" class="dangerButton">Remove from group</button></div>`);
  $$('.roleSet').forEach(b=>b.onclick=async()=>{if(b.dataset.role===currentRole){$('#modal').innerHTML='';return;} await setMemberRole(userId,b.dataset.role); $('#modal').innerHTML='';});
  $('#removeMember').onclick=async()=>{if(!confirm(`Remove ${name} from ${state.group.name}? Their account and past posts will stay, but they will lose access to this group.`))return;try{await rpc('o2_remove_member',{p_token:getToken(),p_group_id:state.group.id,p_user_id:userId});$('#modal').innerHTML='';toast('Member removed from group');await refresh();}catch(e){toast(e.message);}};
}
async function setMemberRole(userId,role){
  const labels={member:'member',teacher:'teacher',admin:'admin'};
  if(!confirm(`Change this member to ${labels[role]}?`))return;
  try{await rpc('o2_set_member_role_v7',{p_token:getToken(),p_group_id:state.group.id,p_user_id:userId,p_role:role});toast(`Role changed to ${labels[role]}`);await refresh();}catch(e){toast(e.message);}
}
async function markNotificationsRead(){
  try{await rpc('o2_mark_notifications_read',{p_token:getToken()});await refresh();}catch(e){toast(e.message);}
}

boot();
