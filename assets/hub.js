/* Magestic AI Hub — team accounts, saved posts, comments.
   Backed by Supabase (project: magestic-ai-hub). Sign-up is restricted to
   @magestictech.com addresses at the database level; new accounts must confirm
   their email before they can sign in. */
(function(){
  const SUPABASE_URL = "https://hrcjcyqocyjrrxevdkyx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_InMVK8A61MlW0BgEmrFO7w_3NECV1TA";
  const TEAM_DOMAIN = "magestictech.com";
  if (typeof supabase === "undefined") { console.warn("supabase-js not loaded; team features disabled"); return; }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let user = null;
  let saves = new Set();
  let counts = {};           // post_key -> comment count
  let profiles = [];         // team members
  let shares = [];           // recent team shares
  let myShares = new Set();

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const nameFromEmail = e => e.split("@")[0].split(/[._-]+/).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const initialsOf = n => n.split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();

  /* ---------- auth box in the header ---------- */
  function renderAuthBox(){
    const box = document.getElementById("authBox");
    if (!box) return;
    if (user) {
      const n = nameFromEmail(user.email);
      box.innerHTML = `<span class="auth-user"><span class="avatar-xs">${initialsOf(n)}</span>${esc(n)}</span>
        <a href="#" class="auth-link" onclick="HUB.signOut();return false;">Sign out</a>`;
    } else {
      box.innerHTML = `<button class="auth-btn" onclick="HUB.openModal()">Team sign in</button>`;
    }
  }

  /* ---------- modal ---------- */
  function ensureModal(){
    if (document.getElementById("hubModal")) return;
    const div = document.createElement("div");
    div.id = "hubModal"; div.className = "hub-modal"; div.hidden = true;
    div.innerHTML = `
      <div class="hub-modal-card">
        <h3>Magestic team sign in</h3>
        <p class="hub-modal-sub">Use your @${TEAM_DOMAIN} email and the team password. First time here? The same form creates your account and sends a confirmation email.</p>
        <input id="hubEmail" type="email" placeholder="you@${TEAM_DOMAIN}" autocomplete="email">
        <input id="hubPass" type="password" placeholder="Team password" autocomplete="current-password">
        <div id="hubMsg" class="hub-msg"></div>
        <div class="hub-modal-actions">
          <button class="auth-btn" onclick="HUB.submit()">Sign in / create account</button>
          <a href="#" class="auth-link" onclick="HUB.closeModal();return false;">Cancel</a>
        </div>
      </div>`;
    div.addEventListener("click", e => { if (e.target === div) HUB.closeModal(); });
    document.body.appendChild(div);
  }
  function msg(t, ok){ const m = document.getElementById("hubMsg"); m.textContent = t; m.className = "hub-msg" + (ok ? " ok" : " err"); }

  /* ---------- data ---------- */
  async function refreshData(){
    if (!user) { saves = new Set(); counts = {}; profiles = []; shares = []; myShares = new Set(); decorate(); renderTeam(); return; }
    const [sv, cm, pf, sh] = await Promise.all([
      sb.from("saves").select("post_key"),
      sb.from("comments").select("post_key"),
      sb.from("profiles").select("id,display_name,email").order("display_name"),
      sb.from("shares").select("user_id,author_name,post_key,post_title,post_url,created_at").order("created_at", { ascending: false }).limit(15)
    ]);
    saves = new Set((sv.data || []).map(r => r.post_key));
    counts = {};
    (cm.data || []).forEach(r => { counts[r.post_key] = (counts[r.post_key] || 0) + 1; });
    profiles = pf.data || [];
    shares = sh.data || [];
    myShares = new Set(shares.filter(s => s.user_id === user.id).map(s => s.post_key));
    decorate();
    renderTeam();
  }

  function renderTeam(){
    const list = document.getElementById("teamList");
    const shr = document.getElementById("teamShares");
    if (list) {
      if (!user) list.innerHTML = `<div class="comment-hint">Sign in to see who's on the hub.</div>`;
      else if (!profiles.length) list.innerHTML = `<div class="comment-hint">No members yet.</div>`;
      else list.innerHTML = profiles.map(m => `
        <div class="team-row">
          <span class="avatar-xs">${initialsOf(m.display_name)}</span>
          <span class="team-name">${esc(m.display_name)}${user && m.id === user.id ? ' <span class="team-you">· you</span>' : ""}</span>
        </div>`).join("");
    }
    if (shr) {
      if (!user) shr.innerHTML = `<div class="comment-hint">Articles teammates share appear here.</div>`;
      else if (!shares.length) shr.innerHTML = `<div class="comment-hint">Nothing shared yet — use "Share with team" on any post.</div>`;
      else shr.innerHTML = shares.map(s => `
        <div class="share-row">
          <b>${esc(s.author_name)}</b> shared
          <div>${s.post_url ? `<a href="${esc(s.post_url)}" target="_blank" rel="noopener">${esc(s.post_title)}</a>` : esc(s.post_title)}</div>
          <span class="comment-when">${new Date(s.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
        </div>`).join("");
    }
  }

  function decorate(){
    document.querySelectorAll(".act-save").forEach(el => {
      const k = el.dataset.key;
      const on = saves.has(k);
      el.textContent = on ? "★ Saved" : "☆ Save";
      el.classList.toggle("saved", on);
    });
    document.querySelectorAll(".act-comment").forEach(el => {
      const c = counts[el.dataset.key] || 0;
      el.textContent = c ? `💬 ${c} comment${c === 1 ? "" : "s"}` : "💬 Comment";
    });
    document.querySelectorAll(".act-share").forEach(el => {
      const on = myShares.has(el.dataset.key);
      el.textContent = on ? "✓ Shared" : "↗ Share with team";
      el.classList.toggle("saved", on);
    });
  }

  /* ---------- comments ---------- */
  async function renderComments(k){
    const panel = document.getElementById("cp-" + k);
    if (!panel) return;
    if (!user) { panel.innerHTML = `<div class="comment-hint">Sign in with your @${TEAM_DOMAIN} email to comment.</div>`; return; }
    panel.innerHTML = `<div class="comment-hint">Loading…</div>`;
    const { data, error } = await sb.from("comments").select("id,author_name,body,created_at,user_id").eq("post_key", k).order("created_at");
    if (error) { panel.innerHTML = `<div class="comment-hint">Could not load comments.</div>`; return; }
    const rows = (data || []).map(c => `
      <div class="comment-row">
        <span class="avatar-xs">${initialsOf(c.author_name)}</span>
        <div class="comment-body"><b>${esc(c.author_name)}</b> <span class="comment-when">${new Date(c.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span><br>${esc(c.body)}
        ${c.user_id === user.id ? ` <a href="#" class="auth-link" onclick="HUB.deleteComment(${c.id},'${k}');return false;">delete</a>` : ""}</div>
      </div>`).join("");
    panel.innerHTML = rows + `
      <div class="comment-form">
        <input id="ci-${k}" type="text" maxlength="2000" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')HUB.postComment('${k}')">
        <button class="auth-btn" onclick="HUB.postComment('${k}')">Post</button>
      </div>`;
  }

  /* ---------- public API ---------- */
  window.HUB = {
    isSaved: k => saves.has(k),
    decorate,
    openModal(){ ensureModal(); document.getElementById("hubModal").hidden = false; msg("", true); },
    closeModal(){ const m = document.getElementById("hubModal"); if (m) m.hidden = true; },
    async submit(){
      const email = document.getElementById("hubEmail").value.trim().toLowerCase();
      const pass = document.getElementById("hubPass").value;
      if (!email.endsWith("@" + TEAM_DOMAIN)) return msg(`Use your @${TEAM_DOMAIN} email address.`);
      if (!pass) return msg("Enter the team password.");
      msg("Signing in…", true);
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (!error) { HUB.closeModal(); return; }
      if (/email not confirmed/i.test(error.message)) return msg("Your email isn't confirmed yet — check your inbox for the confirmation link, then sign in again.");
      if (/invalid login credentials/i.test(error.message)) {
        // No confirmed account with these credentials — try to create one.
        const { data, error: e2 } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } });
        if (e2) return msg(/restricted to @/i.test(e2.message) ? `Signups are restricted to @${TEAM_DOMAIN} addresses.` : e2.message);
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
          return msg("An account already exists for this email — check the password, or look for an earlier confirmation email.");
        return msg("Account created. Check your inbox and click the confirmation link, then sign in.", true);
      }
      msg(error.message);
    },
    async signOut(){ await sb.auth.signOut(); },
    toggleSave(k, el){
      if (!user) { HUB.openModal(); return false; }
      const on = saves.has(k);
      if (on) { saves.delete(k); sb.from("saves").delete().eq("post_key", k).then(()=>{}); }
      else { saves.add(k); sb.from("saves").insert({ user_id: user.id, post_key: k }).then(()=>{}); }
      decorate();
      if (typeof feedFilter !== "undefined" && feedFilter === "Saved") renderFeed();
      return false;
    },
    async toggleShare(k){
      if (!user) { HUB.openModal(); return false; }
      if (myShares.has(k)) {
        myShares.delete(k);
        shares = shares.filter(s => !(s.user_id === user.id && s.post_key === k));
        decorate(); renderTeam();
        await sb.from("shares").delete().eq("post_key", k).eq("user_id", user.id);
      } else {
        const p = (typeof POSTS !== "undefined" ? POSTS : []).find(x => postKey(x) === k);
        const title = p ? (p.link && p.link.b ? p.link.b : (p.body || "").split("\n")[0].slice(0, 120)) : "a post";
        const url = p && p.link ? p.link.u : null;
        const row = { user_id: user.id, author_name: nameFromEmail(user.email), post_key: k, post_title: title, post_url: url, created_at: new Date().toISOString() };
        myShares.add(k);
        shares.unshift(row);
        decorate(); renderTeam();
        await sb.from("shares").insert({ user_id: row.user_id, author_name: row.author_name, post_key: k, post_title: title, post_url: url });
      }
      return false;
    },
    toggleComments(k){
      const panel = document.getElementById("cp-" + k);
      if (!panel) return false;
      if (panel.hidden) { panel.hidden = false; renderComments(k); } else panel.hidden = true;
      return false;
    },
    async postComment(k){
      const input = document.getElementById("ci-" + k);
      const body = input && input.value.trim();
      if (!body || !user) return;
      input.value = "";
      const { error } = await sb.from("comments").insert({ user_id: user.id, author_email: user.email, author_name: nameFromEmail(user.email), post_key: k, body });
      if (!error) { counts[k] = (counts[k] || 0) + 1; decorate(); }
      renderComments(k);
    },
    async deleteComment(id, k){
      await sb.from("comments").delete().eq("id", id);
      counts[k] = Math.max(0, (counts[k] || 1) - 1);
      decorate(); renderComments(k);
    }
  };

  /* ---------- init ---------- */
  sb.auth.onAuthStateChange((_evt, session) => {
    user = session ? session.user : null;
    renderAuthBox();
    refreshData();
  });
  sb.auth.getSession().then(({ data }) => {
    user = data.session ? data.session.user : null;
    renderAuthBox();
    refreshData();
  });
  renderAuthBox();
})();
