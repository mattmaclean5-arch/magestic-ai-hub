/* Magestic AI Hub — app logic.
   Data comes from data/*.js (content, feed, feed-live, directory, companies). */

const POSTS = [...(typeof POSTS_LIVE !== "undefined" ? POSTS_LIVE : []), ...POSTS_CURATED];
let activeRole = "Everyone";
let feedFilter = "All";
const FEED_FILTERS = {
  "All": p=>true,
  "Industry News": p=>p.topic==="Industry AI"||p.topic==="Company Watch",
  "AI News": p=>["Models","Agents","Adoption"].includes(p.topic)&&!p.vid,
  "Developers": p=>(p.topic==="Tools"||p.tags.includes("Developers"))&&!p.vid,
  "Instructional": p=>!!p.vid&&(p.topic==="Tools"||p.tags.includes("Developers")),
  "Videos": p=>!!p.vid,
  "Regulatory": p=>p.topic==="Regulatory",
  "Saved": p=>!!(window.HUB&&HUB.isSaved(postKey(p)))
};
/* ---------- theme ---------- */
function setTheme(t){
  document.documentElement.setAttribute("data-theme",t);
  const b=document.getElementById("themeBtn");if(b)b.textContent=t==="dark"?"☀":"☾";
  try{localStorage.setItem("hubTheme",t);}catch(e){}
}
function toggleTheme(){setTheme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark");}
function initTheme(){
  let t=null;try{t=localStorage.getItem("hubTheme");}catch(e){}
  if(!t)t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
  setTheme(t);
}
function interleaveByAuthor(posts){
  const by={};posts.forEach(p=>{(by[p.a]=by[p.a]||[]).push(p);});
  const qs=Object.values(by),out=[];let added=true;
  while(added){added=false;for(const q of qs){if(q.length){out.push(q.shift());added=true;}}}
  return out;
}
function postKey(p){const s=p.link&&p.link.u?p.link.u:(p.a+"|"+p.d+"|"+(p.body||"").slice(0,80));let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return "k"+(h>>>0).toString(36);}

/* ---------- helpers ---------- */
const AV_PALETTE = ["#1264a3","#0b7285","#5f3dc4","#c2255c","#e8590c","#2f9e44","#875a2c","#3b5bdb","#b5540a","#087f5b"];
function hashColor(s){let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;return AV_PALETTE[h%AV_PALETTE.length];}
function initials(n){return n.replace(/\(.*?\)/g,"").split(/[\s/·]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function avFor(p){const a=AV[p.av];return a?{bg:a.bg,txt:a.txt}:{bg:hashColor(p.a),txt:initials(p.a)};}
function avatarStyle(key){const a=AV[key];return `style="background:${a.bg}"`;}
function badge(t){
  const map={official:["OFFICIAL","official"],industry:["INDUSTRY","industry"],
             voice:["THOUGHT LEADER","voice"],internal:["MAGESTIC","internal"]};
  const [label,cls]=map[t];return `<span class="badge ${cls}">${label}</span>`;
}
function matchesRole(tags){return activeRole==="Everyone"||tags.includes(activeRole)||tags.includes("Everyone");}
function liSearch(name){return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`;}
function newsLink(name){return `https://news.google.com/search?q=${encodeURIComponent('"'+name.replace(/\s*\(.*?\)/g,"")+'" AI')}`;}

/* ---------- roles ---------- */

/* ---------- feed ---------- */
function renderFeedPills(){
  document.getElementById("feedPills").innerHTML=Object.keys(FEED_FILTERS).map(f=>
    `<button class="pill ${f===feedFilter?'active':''}" onclick="feedFilter='${f}';renderFeedPills();renderFeed();">${f}</button>`).join("");
}
function renderFeed(){
  const q=document.getElementById("searchBox").value.trim().toLowerCase();
  const sort=document.getElementById("sortSel").value;
  let posts=POSTS.filter(p=>matchesRole(p.tags)).filter(FEED_FILTERS[feedFilter]);
  if(q)posts=posts.filter(p=>(p.a+" "+p.body+" "+p.topic+" "+p.tags.join(" ")).toLowerCase().includes(q));
  posts=[...posts].sort((x,y)=>sort==="topic"?x.topic.localeCompare(y.topic)||y.d.localeCompare(x.d):y.d.localeCompare(x.d)||(y.w||0)-(x.w||0));
  // per-pill differentiation: Instructional surfaces the best tutorials first; Videos rotates authors for variety
  if(sort!=="topic"){
    if(feedFilter==="Instructional")posts.sort((x,y)=>(y.w||0)-(x.w||0)||y.d.localeCompare(x.d));
    else if(feedFilter==="Videos")posts=interleaveByAuthor(posts);
  }
  // single unified feed, newest first; role/pill/search are pure filters
  document.getElementById("feedCount").textContent=
    `${posts.length} post${posts.length===1?"":"s"}`+(activeRole!=="Everyone"?` · filtered for ${activeRole}`:"")+(q?` · matching "${q}"`:"");
  const postHTML=p=>{const k=postKey(p);return `
    <article class="card post" data-key="${k}">
      <div class="post-head">
        <div class="avatar" style="background:${avFor(p).bg}">${avFor(p).txt}</div>
        <div class="post-who">
          <div class="name">${p.a}${badge(p.t)}</div>
          <div class="sub">${p.s}</div>
          <div class="when">${p.when} · 2026</div>
        </div>
      </div>
      <div class="post-body">${p.body}</div>
      ${p.img?`<a class="post-media" href="${p.link?p.link.u:"#"}" target="_blank" rel="noopener"><img src="${p.img}" loading="lazy" alt="">${p.vid?'<span class="play-badge">▶</span>':''}</a>`:""}
      ${p.link?`<a class="post-link" href="${p.link.u}" target="_blank" rel="noopener"><b>${p.link.b} ↗</b><span>${p.link.s}</span></a>`:""}
      <div class="tags">
        <span class="tag topic">${p.topic}</span>
        ${p.tags.filter(t=>t!=="Everyone").map(t=>`<span class="tag">${t}</span>`).join("")}
      </div>
      <div class="post-foot">
        ${p.link?`<a href="${p.link.u}" target="_blank" rel="noopener">Read source</a>`:""}
        <a href="#" class="act-save" data-key="${k}" onclick="return window.HUB?HUB.toggleSave('${k}',this):false;">☆ Save</a>
        <a href="#" class="act-share" data-key="${k}" onclick="return window.HUB?HUB.toggleShare('${k}'):false;">↗ Share with team</a>
        <a href="#" class="act-comment" data-key="${k}" onclick="return window.HUB?HUB.toggleComments('${k}'):false;">💬 Comment</a>
      </div>
      <div class="comments-panel" id="cp-${k}" hidden></div>
    </article>`;};
  document.getElementById("feedList").innerHTML=posts.length?posts.map(postHTML).join(""):
    `<div class="card empty">No posts match. Try clearing the search or switching the role filter.</div>`;
  if(window.HUB)HUB.decorate();
}

/* ---------- right rail ---------- */
function renderWire(){
  // live industry wire: newest company-watch and industry items; static wire as fallback
  const live=POSTS.filter(p=>p.topic==="Company Watch"||p.topic==="Industry AI")
    .sort((x,y)=>y.d.localeCompare(x.d)).slice(0,20)
    .map(p=>({b:(p.link?p.link.b:p.body.split("\n")[0]).slice(0,80),s:`${p.a} · ${p.when}`,u:p.link?p.link.u:null}));
  const items=live.length?live:NEWS_WIRE;
  document.getElementById("newsWire").innerHTML=items.map(n=>
    `<div class="news-item"><b>${n.u?`<a href="${n.u}" target="_blank" rel="noopener" style="color:inherit">${n.b}</a>`:n.b}</b><span>${n.s}</span></div>`).join("");
}
function renderExpertRail(){
  // one voice per category, rotating daily so no one is privileged
  const cats=[...new Set(DIRECTORY.map(d=>d.c))];
  const day=Math.floor(Date.now()/86400000);
  const picks=cats.slice(0,6).map((c,i)=>{const g=DIRECTORY.filter(d=>d.c===c);return g[(day+i)%g.length];});
  document.getElementById("expertRail").innerHTML=picks.map(e=>`
    <div class="expert-row">
      <div class="avatar-sm" style="background:${hashColor(e.n)}">${initials(e.n)}</div>
      <div class="who"><b>${e.n}</b><span>${e.r}</span></div>
      <a class="follow-btn" href="${e.u||liSearch(e.n)}" target="_blank" rel="noopener">Follow</a>
    </div>`).join("");
}

/* ---------- industry watch ---------- */
let coFilter="All";
function renderCoPills(){
  const cats=["All","Suppliers & competitors","Customers & markets",...new Set(COMPANIES.map(c=>c.cat))];
  document.getElementById("coPills").innerHTML=cats.map(c=>
    `<button class="pill ${c===coFilter?'active':''}" onclick="coFilter='${c.replace(/'/g,"\\'")}';renderCoPills();renderCompanies();">${c}</button>`).join("");
}
function renderPriority(){
  document.getElementById("prioGrid").innerHTML=COMPANIES.filter(c=>c.p).map(c=>`
    <div class="card prio-card">
      <div class="prio-tag">${c.side==="s"?"Competitor / supplier":"Customer / target market"}</div>
      <h3>${c.n}</h3>
      <div class="meta">${c.hq} · ${c.seg}${c.score!=null?` · <b>AI ${c.score}/10</b>`:""}${c.tier?` · ${c.tier}`:""}</div>
      <p>${c.note||""}</p>
      <div class="foot"><a href="${newsLink(c.n)}" target="_blank" rel="noopener">Latest AI news ↗</a>${c.src?` · <a href="${c.src}" target="_blank" rel="noopener">Source ↗</a>`:""}</div>
    </div>`).join("");
}
function renderCompanies(){
  const q=(document.getElementById("coSearch").value||"").trim().toLowerCase();
  let items=COMPANIES;
  if(coFilter==="Suppliers & competitors")items=items.filter(c=>c.side==="s");
  else if(coFilter==="Customers & markets")items=items.filter(c=>c.side==="d");
  else if(coFilter!=="All")items=items.filter(c=>c.cat===coFilter);
  if(q)items=items.filter(c=>(c.n+" "+c.hq+" "+c.seg+" "+c.cat+" "+(c.tier||"")).toLowerCase().includes(q));
  items=[...items].sort((x,y)=>(y.score??-1)-(x.score??-1));
  document.getElementById("coCount").textContent=`${items.length} of ${COMPANIES.length} companies`;
  document.getElementById("coGrid").innerHTML=items.length?items.map(c=>`
    <div class="card co-row">
      <span class="side-dot ${c.side==="s"?"supply":"demand"}" title="${c.side==="s"?"Supplier/competitor":"Customer/market"}"></span>
      <div class="who"><b>${c.n}</b><span>${c.hq} · ${c.seg}${c.score!=null?` · AI ${c.score}/10 ${c.tier}`:""}</span></div>
      <a class="go" href="${newsLink(c.n)}" target="_blank" rel="noopener">News ↗</a>
    </div>`).join("")
    :`<div class="card empty" style="grid-column:1/-1">No companies match this filter.</div>`;
}

/* ---------- learning ---------- */
let learnFilter="All";
function renderLearnPills(){
  const cats=["All",...new Set(LEARNING.map(l=>l.cat))];
  document.getElementById("learnPills").innerHTML=cats.map(c=>
    `<button class="pill ${c===learnFilter?'active':''}" onclick="learnFilter='${c}';renderLearnPills();renderLearning();">${c}</button>`).join("");
}
function renderLearning(){
  let items=LEARNING.filter(l=>learnFilter==="All"||l.cat===learnFilter);
  items=items.filter(l=>matchesRole(l.who));
  document.getElementById("learnGrid").innerHTML=items.length?items.map(l=>`
    <div class="card res-card">
      <div class="kicker">${l.cat}</div>
      <h3>${l.h}</h3>
      <p>${l.p}</p>
      <div class="tags" style="margin-bottom:9px">${l.who.filter(w=>w!=="Everyone").map(w=>`<span class="tag">${w}</span>`).join("")||'<span class="tag">All roles</span>'}</div>
      <div class="foot">${l.links.map(([t,u])=>u==="#experts"?`<a href="#" onclick="showView('experts');return false;">${t}</a>`:`<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join(" · ")}</div>
    </div>`).join("")
    :`<div class="card empty" style="grid-column:1/-1">Nothing in this category for the selected role. Switch the role filter on the Feed tab back to Everyone.</div>`;
}

/* ---------- tools ---------- */
function renderToolsGrid(){
  const items=TOOLS.filter(t=>matchesRole(t.who));
  document.getElementById("toolsGrid").innerHTML=items.map(t=>`
    <div class="card res-card">
      <h3>${t.h}</h3>
      <p>${t.p}</p>
      <div class="tags" style="margin-bottom:9px">${t.who.filter(w=>w!=="Everyone").map(w=>`<span class="tag">${w}</span>`).join("")||'<span class="tag">All roles</span>'}</div>
      <div class="foot">${t.links.map(([lbl,u])=>`<a href="${u}" target="_blank" rel="noopener">${lbl} ↗</a>`).join(" · ")}</div>
    </div>`).join("");
}

/* ---------- experts: featured + directory ---------- */
let dirFilter="All";
function renderDirPills(){
  const cats=["All",...Object.keys(DIR_CATS)];
  document.getElementById("dirPills").innerHTML=cats.map(c=>
    `<button class="pill ${c===dirFilter?'active':''}" onclick="dirFilter='${c.replace(/'/g,"\\'")}';renderDirPills();renderDirectory();">${c}</button>`).join("");
}
function renderDirectory(){
  const q=(document.getElementById("dirSearch").value||"").trim().toLowerCase();
  let items=DIRECTORY;
  if(dirFilter!=="All")items=items.filter(d=>d.c===dirFilter);
  if(activeRole!=="Everyone")items=items.filter(d=>{
    const roles=DIR_CATS[d.c]||["Everyone"];
    return roles.includes(activeRole)||roles.includes("Everyone");
  });
  if(q)items=items.filter(d=>(d.n+" "+d.r+" "+d.c).toLowerCase().includes(q));
  document.getElementById("dirCount").textContent=`${items.length} of ${DIRECTORY.length} voices, all equal`;
  document.getElementById("dirGrid").innerHTML=items.length?items.map(d=>`
    <div class="card dir-row">
      <div class="avatar-sm" style="background:${hashColor(d.n)}">${initials(d.n)}</div>
      <div class="who"><b>${d.n}</b><span>${d.r}</span></div>
      <a class="go" href="${d.u||liSearch(d.n)}" target="_blank" rel="noopener">${d.u?"Visit ↗":"Find ↗"}</a>
    </div>`).join("")
    :`<div class="card empty" style="grid-column:1/-1">No people match this filter.</div>`;
}

/* ---------- navigation ---------- */
function showView(v){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v));
  document.getElementById("view-feed").classList.toggle("hidden",v!=="feed");
  ["industry","learning","tools","experts"].forEach(p=>
    document.getElementById("view-"+p).classList.toggle("visible",v===p));
  window.scrollTo({top:0});
}

/* ---------- stats + init ---------- */
function renderUpdated(){
  const el=document.getElementById("lastUpdated");
  if(!el)return;
  let d=null;
  if(typeof FEED_GENERATED!=="undefined")d=new Date(FEED_GENERATED);
  else if(typeof POSTS_LIVE!=="undefined"&&POSTS_LIVE.length)d=new Date(POSTS_LIVE[0].d+"T12:00:00Z");
  if(!d||isNaN(d))return;
  const day=d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const time=(typeof FEED_GENERATED!=="undefined")?" · "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
  el.textContent="Updated "+day+time;
}
function renderStats(){
  document.getElementById("statPosts").textContent=POSTS.length;
  document.getElementById("statLearning").textContent=LEARNING.length;
  document.getElementById("statCompanies").textContent=COMPANIES.length;
  document.getElementById("statExperts").textContent=DIRECTORY.length;
}
initTheme();renderUpdated();renderFeedPills();renderFeed();renderWire();renderExpertRail();
renderPriority();renderCoPills();renderCompanies();
renderLearnPills();renderLearning();renderToolsGrid();
renderDirPills();renderDirectory();renderStats();
