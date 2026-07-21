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
    if (!user) { saves = new Set(); counts = {}; decorate(); return; }
    const [sv, cm] = await Promise.all([
      sb.from("saves").select("post_key"),
      sb.from("comments").select("post_key")
    ]);
    saves = new Set((sv.data || []).map(r => r.post_key));
    counts = {};
    (cm.data || []).forEach(r => { counts[r.post_key] = (counts[r.post_key] || 0) + 1; });
    decorate();
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
