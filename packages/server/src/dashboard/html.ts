export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NullSec Admin Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #090d16;
      --bg-card: rgba(18, 24, 38, 0.7);
      --bg-card-hover: rgba(26, 35, 55, 0.85);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(99, 102, 241, 0.3);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.25);
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --radius-lg: 16px;
      --radius-md: 10px;
      --radius-sm: 6px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(6, 182, 212, 0.1) 0%, transparent 40%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    code, pre {
      font-family: 'JetBrains Mono', monospace;
    }

    /* Top Navigation */
    header {
      border-bottom: 1px solid var(--border-color);
      background: rgba(9, 13, 22, 0.8);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text-main);
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 1.1rem;
      box-shadow: 0 0 16px var(--primary-glow);
    }

    .brand-title {
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }

    .brand-badge {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-weight: 600;
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      font-size: 0.875rem;
    }

    .user-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
    }

    /* Layout */
    .dashboard-container {
      display: flex;
      flex: 1;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
      gap: 2rem;
    }

    /* Sidebar */
    .sidebar {
      width: 240px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .nav-btn:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    .nav-btn.active {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      font-weight: 600;
    }

    .nav-btn svg {
      width: 18px;
      height: 18px;
      stroke-width: 2;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .panel {
      display: none;
      flex-direction: column;
      gap: 1.5rem;
      animation: fadeIn 0.25s ease forwards;
    }

    .panel.active {
      display: flex;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards */
    .card {
      background: var(--bg-card);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }

    .stat-card:hover {
      border-color: var(--border-accent);
      transform: translateY(-2px);
    }

    .stat-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    /* Banners */
    .zk-banner {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(6, 182, 212, 0.08));
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
      color: #cbd5e1;
    }

    .zk-badge {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-sm);
      font-weight: 700;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    /* Action bar */
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-title {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.6rem 1.2rem;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 0 14px var(--primary-glow);
    }

    .btn:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      box-shadow: none;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-danger {
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
      box-shadow: none;
    }

    .btn-danger:hover {
      background: rgba(244, 63, 94, 0.25);
    }

    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    th {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-dim);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .tag-admin {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.75rem;
    }

    .tag-member {
      background: rgba(148, 163, 184, 0.12);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.2);
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.75rem;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal {
      background: #0f1523;
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-lg);
      padding: 2rem;
      width: 100%;
      max-width: 520px;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .form-input, .form-select {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: all 0.2s ease;
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 12px var(--primary-glow);
    }

    /* Code Snippet Box */
    .snippet-box {
      background: #080c14;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-md);
      padding: 0.85rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .snippet-text {
      font-size: 0.85rem;
      color: var(--accent-cyan);
      word-break: break-all;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #1e293b;
      border: 1px solid var(--primary);
      color: var(--text-main);
      padding: 0.85rem 1.4rem;
      border-radius: var(--radius-md);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 200;
      font-size: 0.875rem;
      display: none;
      animation: slideUp 0.25s ease forwards;
    }

    @keyframes slideUp {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Login Screen */
    .login-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 2rem;
      text-align: center;
      gap: 1.5rem;
    }

    .login-box {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 2.5rem;
      max-width: 480px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
    }
  </style>
</head>
<body>

  <header>
    <a href="/dashboard" class="brand">
      <div class="brand-logo">N</div>
      <div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="brand-title">NullSec Vault</span>
          <span class="brand-badge">ADMIN</span>
        </div>
      </div>
    </a>

    <div id="headerUser" style="display: none; align-items: center; gap: 1rem;">
      <div class="user-pill">
        <div class="user-avatar" id="userAvatar">A</div>
        <span id="userEmail">admin@...</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="logout()">Logout</button>
    </div>
  </header>

  <!-- Login view (when unauthenticated) -->
  <div id="loginView" class="login-screen" style="display: none;">
    <div class="login-box">
      <div style="font-size: 2.5rem;">🔐</div>
      <h2 style="font-size: 1.4rem; font-weight: 700;">Zero-Knowledge Admin Login</h2>
      <p style="color: var(--text-muted); font-size: 0.9rem;">
        NullSec uses zero-knowledge cryptographic signature handoff instead of passwords.
      </p>

      <div style="text-align: left; display: flex; flex-direction: column; gap: 0.5rem;">
        <span style="font-size: 0.8rem; color: var(--text-dim); font-weight: 600;">RUN THIS IN YOUR TERMINAL:</span>
        <div class="snippet-box">
          <code class="snippet-text" id="loginCliCmd">nsec dashboard</code>
          <button class="btn btn-secondary btn-sm" onclick="copyText(document.getElementById('loginCliCmd').innerText)">Copy</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Authenticated Dashboard container -->
  <div id="dashboardView" class="dashboard-container" style="display: none;">
    <aside class="sidebar">
      <button class="nav-btn active" onclick="switchTab('overview')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        Overview
      </button>
      <button class="nav-btn" onclick="switchTab('users')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Users
      </button>
      <button class="nav-btn" onclick="switchTab('invites')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        Invites
      </button>
      <button class="nav-btn" onclick="switchTab('projects')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        Projects
      </button>
    </aside>

    <main class="main-content">
      <!-- Tab 1: Overview -->
      <section id="panel-overview" class="panel active">
        <div class="zk-banner">
          <span class="zk-badge">ZERO-KNOWLEDGE</span>
          <span>Encrypted secrets and project decryption keys are never processed in this browser plane. All sensitive secret operations remain protected in the local CLI.</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Registered Users</span>
            <span class="stat-value" id="statUsers">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Server Administrators</span>
            <span class="stat-value" id="statAdmins" style="color: var(--accent-amber);">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Pending Invites</span>
            <span class="stat-value" id="statInvites" style="color: var(--accent-cyan);">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Projects</span>
            <span class="stat-value" id="statProjects" style="color: var(--accent-emerald);">0</span>
          </div>
        </div>

        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem;">Invite a New Team Member</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Generate single-use cryptographic tokens to onboard developers safely.</p>
          </div>
          <button class="btn" onclick="openInviteModal()">+ Create Invite</button>
        </div>
      </section>

      <!-- Tab 2: Users -->
      <section id="panel-users" class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Registered Users</h2>
          <button class="btn btn-secondary btn-sm" onclick="loadUsers()">Refresh</button>
        </div>

        <div class="card table-container">
          <table>
            <thead>
              <tr>
                <th>User Email</th>
                <th>Server Role</th>
                <th>Registered</th>
                <th>Public Key Fingerprint</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="usersTableBody">
              <tr><td colspan="5" style="text-align: center; color: var(--text-dim);">Loading users...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab 3: Invites -->
      <section id="panel-invites" class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Pending Invite Tokens</h2>
          <button class="btn" onclick="openInviteModal()">+ Create Invite</button>
        </div>

        <div class="card table-container">
          <table>
            <thead>
              <tr>
                <th>Invitee Email</th>
                <th>Assigned Role</th>
                <th>Invited By</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="invitesTableBody">
              <tr><td colspan="5" style="text-align: center; color: var(--text-dim);">Loading invites...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab 4: Projects -->
      <section id="panel-projects" class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Active Projects & Access</h2>
        </div>

        <div id="projectsList" style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="card" style="color: var(--text-dim); text-align: center;">Loading projects...</div>
        </div>
      </section>
    </main>
  </div>

  <!-- Create Invite Modal -->
  <div id="inviteModal" class="modal-overlay">
    <div class="modal">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 1.15rem; font-weight: 700;">Create Single-Use Invite Token</h3>
        <button class="btn btn-secondary btn-sm" onclick="closeInviteModal()">✕</button>
      </div>

      <div id="inviteForm">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Invitee Email Address</label>
          <input id="inviteEmail" class="form-input" type="email" placeholder="developer@company.com" required>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Server Role</label>
          <select id="inviteRole" class="form-select">
            <option value="member">member (standard developer)</option>
            <option value="admin">admin (can invite & manage server)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Expiration (Days)</label>
          <input id="inviteDays" class="form-input" type="number" value="7" min="1" max="90">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-secondary" onclick="closeInviteModal()">Cancel</button>
          <button class="btn" onclick="submitInvite()">Generate Invite</button>
        </div>
      </div>

      <!-- Generated Result Step -->
      <div id="inviteResult" style="display: none; flex-direction: column; gap: 1rem;">
        <div style="color: var(--accent-emerald); font-weight: 600; font-size: 0.9rem;">
          ✔ Invite token generated successfully!
        </div>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Share this command with the developer to register:</p>
        <div class="snippet-box">
          <code id="generatedCommand" class="snippet-text"></code>
          <button class="btn btn-secondary btn-sm" onclick="copyText(document.getElementById('generatedCommand').innerText)">Copy</button>
        </div>
        <button class="btn btn-secondary" style="width: 100%; margin-top: 0.5rem;" onclick="closeInviteModal()">Done</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    let currentUser = null;

    // Toast helper
    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    function copyText(text) {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    }

    // Switch sidebar tab
    function switchTab(tabId) {
      document.querySelectorAll('.nav-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tabId));
      });
      document.querySelectorAll('.panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === 'panel-' + tabId);
      });

      if (tabId === 'users') loadUsers();
      if (tabId === 'invites') loadInvites();
      if (tabId === 'projects') loadProjects();
    }

    // Authentication & Hash Handoff
    async function initAuth() {
      // 1. Check for #auth= in URL hash
      const hash = window.location.hash;
      if (hash.includes('auth=')) {
        const ticketParam = hash.split('auth=')[1]?.split('&')[0];
        if (ticketParam) {
          // Immediately sanitize URL hash from address bar
          history.replaceState(null, '', window.location.pathname);
          const ticket = decodeURIComponent(ticketParam);
          try {
            const res = await fetch('/api/v1/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticket })
            });
            if (!res.ok) {
              const err = await res.json();
              alert(err.message || 'Login failed');
            }
          } catch (e) {
            console.error('Session exchange error:', e);
          }
        }
      }

      // 2. Check session status
      try {
        const res = await fetch('/api/v1/auth/session/me');
        if (res.ok) {
          const data = await res.json();
          currentUser = data.user;
          renderDashboard(data);
        } else {
          showLoginView();
        }
      } catch (e) {
        showLoginView();
      }
    }

    function showLoginView() {
      document.getElementById('loginView').style.display = 'flex';
      document.getElementById('dashboardView').style.display = 'none';
      document.getElementById('headerUser').style.display = 'none';
      const origin = window.location.origin;
      document.getElementById('loginCliCmd').innerText = 'nsec dashboard --server ' + origin;
    }

    function renderDashboard(data) {
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('dashboardView').style.display = 'flex';
      document.getElementById('headerUser').style.display = 'flex';
      document.getElementById('userEmail').innerText = data.user.email;
      document.getElementById('userAvatar').innerText = (data.user.email[0] || 'A').toUpperCase();

      document.getElementById('statUsers').innerText = data.stats.totalUsers;
      document.getElementById('statAdmins').innerText = data.stats.adminUsers;
      document.getElementById('statInvites').innerText = data.stats.pendingInvites;
      document.getElementById('statProjects').innerText = data.stats.totalProjects;
    }

    async function logout() {
      await fetch('/api/v1/auth/session', { method: 'DELETE' });
      window.location.reload();
    }

    // Load Users
    async function loadUsers() {
      try {
        const res = await fetch('/api/v1/users');
        if (!res.ok) return;
        const users = await res.json();
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        users.forEach((u) => {
          const tr = document.createElement('tr');
          const isSelf = currentUser && currentUser.id === u.id;
          const roleTag = u.role === 'admin' 
            ? '<span class="tag-admin">ADMIN</span>' 
            : '<span class="tag-member">MEMBER</span>';
          
          let actionBtn = '';
          if (!isSelf) {
            if (u.role === 'admin') {
              actionBtn = \`<button class="btn btn-secondary btn-sm" onclick="toggleRole('\${u.id}', 'member')">Demote</button>\`;
            } else {
              actionBtn = \`<button class="btn btn-secondary btn-sm" onclick="toggleRole('\${u.id}', 'admin')">Promote</button>\`;
            }
          }

          const fp = u.publicKeys.signingKey ? u.publicKeys.signingKey.slice(27, 47) + '...' : '(none)';

          tr.innerHTML = \`
            <td><strong>\${u.email}</strong> \${isSelf ? '<span style="color:var(--text-dim);font-size:0.75rem;">(you)</span>' : ''}</td>
            <td>\${roleTag}</td>
            <td style="color:var(--text-muted)">\${u.createdAt ? u.createdAt.slice(0, 10) : ''}</td>
            <td><code style="color:var(--accent-cyan)">\${fp}</code></td>
            <td>\${actionBtn}</td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (e) {
        console.error('Failed to load users:', e);
      }
    }

    async function toggleRole(userId, newRole) {
      if (!confirm(\`Change this user role to \${newRole}?\`)) return;
      try {
        const res = await fetch(\`/api/v1/users/\${userId}/role\`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
          showToast(\`Role updated to \${newRole}\`);
          loadUsers();
        } else {
          const err = await res.json();
          alert(err.message || 'Failed to update role');
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Load Invites
    async function loadInvites() {
      try {
        const res = await fetch('/api/v1/invites');
        if (!res.ok) return;
        const invites = await res.json();
        const tbody = document.getElementById('invitesTableBody');
        tbody.innerHTML = '';

        if (invites.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 2rem;">No pending invites</td></tr>';
          return;
        }

        invites.forEach((inv) => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${inv.email}</strong></td>
            <td><span class="\${inv.role === 'admin' ? 'tag-admin' : 'tag-member'}">\${inv.role.toUpperCase()}</span></td>
            <td style="color:var(--text-muted)">\${inv.invitedBy}</td>
            <td style="color:var(--text-muted)">\${inv.expiresAt ? inv.expiresAt.slice(0, 10) : 'Never'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="revokeInvite('\${inv.id}')">Revoke</button></td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (e) {
        console.error('Failed to load invites:', e);
      }
    }

    async function revokeInvite(inviteId) {
      if (!confirm('Revoke this invite token?')) return;
      try {
        const res = await fetch(\`/api/v1/invites/\${inviteId}\`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Invite revoked');
          loadInvites();
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Load Projects
    async function loadProjects() {
      const container = document.getElementById('projectsList');
      container.innerHTML = '<div class="card" style="color:var(--text-dim); text-align:center;">Loading project access...</div>';
      try {
        const res = await fetch('/api/v1/auth/session/me');
        if (!res.ok) return;
        const data = await res.json();
        container.innerHTML = \`
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Project Environment Security</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem;">
              Projects in NullSec use end-to-end envelope encryption. Each environment possesses a unique AES-256-GCM symmetric key encrypted individually for each member using RSA-OAEP-4096.
            </p>
          </div>
        \`;
      } catch (e) {
        console.error(e);
      }
    }

    // Modal
    function openInviteModal() {
      document.getElementById('inviteModal').classList.add('active');
      document.getElementById('inviteForm').style.display = 'block';
      document.getElementById('inviteResult').style.display = 'none';
      document.getElementById('inviteEmail').value = '';
    }

    function closeInviteModal() {
      document.getElementById('inviteModal').classList.remove('active');
      loadInvites();
    }

    async function submitInvite() {
      const email = document.getElementById('inviteEmail').value.trim();
      const role = document.getElementById('inviteRole').value;
      const days = parseInt(document.getElementById('inviteDays').value, 10) || 7;

      if (!email) {
        alert('Please enter an email address');
        return;
      }

      const d = new Date();
      d.setDate(d.getDate() + days);

      try {
        const res = await fetch('/api/v1/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            role,
            expiresAt: d.toISOString()
          })
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.message || 'Failed to create invite');
          return;
        }

        const data = await res.json();
        const origin = window.location.origin;
        const cmd = \`nsec register \${data.email} --token \${data.token} --server \${origin}\`;

        document.getElementById('generatedCommand').innerText = cmd;
        document.getElementById('inviteForm').style.display = 'none';
        document.getElementById('inviteResult').style.display = 'flex';
      } catch (e) {
        console.error('Invite submit error:', e);
      }
    }

    // On Load
    window.addEventListener('DOMContentLoaded', initAuth);
  </script>
</body>
</html>
`;
