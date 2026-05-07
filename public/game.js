// ============================================================
// KNOCKFRIEND - Frontend (klient)
// Vse v jednom: menu, lobby, input, render, particles, interpolace
// ============================================================

(() => {
  const socket = io();
  let SHARED = null;
  let selfId = null;
  let roomId = null;

  const SNAPSHOT_BUFFER_MS = 70;
  const snapshots = [];

  const screens = {
    auth: document.getElementById("auth"),
    menu: document.getElementById("menu"),
    lobby: document.getElementById("lobby"),
    game: document.getElementById("game"),
  };
  function showScreen(name) {
    for (const k in screens) screens[k].classList.toggle("active", k === name);
    // Feedback tlacitko - viditelne jen mimo hru (menu, lobby, auth)
    const fbBtn = document.getElementById("btn-open-feedback");
    if (fbBtn) {
      fbBtn.style.display = (name === "game") ? "none" : "flex";
    }
  }

  // ---------- AUTH ----------
  let currentUser = null; // { username, isAdmin } pokud je prihlaseny, jinak null
  let sessionToken = localStorage.getItem("kf_session_token") || null;

  const authError = document.getElementById("auth-error");
  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = "block";
  }
  function hideAuthError() {
    authError.style.display = "none";
  }

  // Auth tab switcher
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.getAttribute("data-tab");
      document.getElementById("login-form").style.display = which === "login" ? "block" : "none";
      document.getElementById("register-form").style.display = which === "register" ? "block" : "none";
      hideAuthError();
    };
  });

  // Login submit
  document.getElementById("btn-login").onclick = async () => {
    hideAuthError();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    if (!username || !password) {
      showAuthError("Enter username and password");
      return;
    }
    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json();
      if (data.ok) {
        sessionToken = data.token;
        localStorage.setItem("kf_session_token", data.token);
        currentUser = { username: data.username, isAdmin: data.isAdmin, isTester: data.isTester };
        onAuthSuccess();
      } else {
        showAuthError(data.error || "Login failed");
      }
    } catch (err) {
      showAuthError("Connection error");
    }
  };

  // Register submit
  document.getElementById("btn-register").onclick = async () => {
    hideAuthError();
    const username = document.getElementById("register-username").value.trim();
    const password = document.getElementById("register-password").value;
    const password2 = document.getElementById("register-password2").value;
    if (!username || !password) {
      showAuthError("Enter username and password");
      return;
    }
    if (password !== password2) {
      showAuthError("Passwords don't match");
      return;
    }
    try {
      const resp = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json();
      if (data.ok) {
        sessionToken = data.token;
        localStorage.setItem("kf_session_token", data.token);
        currentUser = { username: data.username, isAdmin: data.isAdmin, isTester: data.isTester };
        onAuthSuccess();
      } else {
        showAuthError(data.error || "Registration failed");
      }
    } catch (err) {
      showAuthError("Connection error");
    }
  };

  // Continue as Guest
  document.getElementById("btn-guest").onclick = () => {
    currentUser = null;
    sessionToken = null;
    localStorage.removeItem("kf_session_token");
    onAuthSuccess(); // i guest jde do menu, ale s name inputem
  };

  // Login na enter
  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-login").click();
  });
  document.getElementById("register-password2").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-register").click();
  });

  function onAuthSuccess() {
    updateUserInfoUI();
    showScreen("menu");
  }

  function updateUserInfoUI() {
    const userInfo = document.getElementById("user-info");
    const guestNameInput = document.getElementById("guest-name-input");
    const userInfoName = document.getElementById("user-info-name");
    const userInfoAdmin = document.getElementById("user-info-admin");
    const userInfoTester = document.getElementById("user-info-tester");
    const friendsPanel = document.getElementById("friends-panel");
    if (currentUser) {
      userInfo.style.display = "flex";
      guestNameInput.style.display = "none";
      userInfoName.textContent = currentUser.username;
      userInfoAdmin.style.display = currentUser.isAdmin ? "inline-block" : "none";
      if (userInfoTester) {
        userInfoTester.style.display = (currentUser.isTester && !currentUser.isAdmin) ? "inline-block" : "none";
      }
      // Zobraz friends panel a refresh
      if (friendsPanel) {
        friendsPanel.style.display = "flex";
        refreshFriendsList();
      }
      // Refresh stats (zobrazi moje stats sekci)
      if (typeof refreshStats === "function") refreshStats();
    } else {
      userInfo.style.display = "none";
      guestNameInput.style.display = "block";
      // Skry friends panel
      if (friendsPanel) friendsPanel.style.display = "none";
      // Refresh stats (skryje moje stats sekci)
      if (typeof refreshStats === "function") refreshStats();
    }
  }

  // Logout button
  document.getElementById("btn-logout").onclick = async () => {
    if (sessionToken) {
      try {
        await fetch("/api/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: sessionToken }),
        });
      } catch {}
    }
    sessionToken = null;
    localStorage.removeItem("kf_session_token");
    currentUser = null;
    updateUserInfoUI();
    showScreen("auth");
  };

  // Pri startu ověř session token
  async function checkSession() {
    if (!sessionToken) {
      showScreen("auth");
      return;
    }
    try {
      const resp = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken }),
      });
      const data = await resp.json();
      if (data.ok) {
        currentUser = { username: data.username, isAdmin: data.isAdmin, isTester: data.isTester };
        updateUserInfoUI();
        showScreen("menu");
      } else {
        sessionToken = null;
        localStorage.removeItem("kf_session_token");
        showScreen("auth");
      }
    } catch {
      showScreen("auth");
    }
  }
  checkSession();

  // ---------- FRIENDS PANEL ----------
  let friendsRefreshInterval = null;

  async function apiCall(endpoint, body) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, token: sessionToken }),
      });
      return await resp.json();
    } catch (err) {
      return { ok: false, error: "Network error" };
    }
  }

  async function refreshFriendsList() {
    if (!currentUser || !sessionToken) return;
    const data = await apiCall("/api/friends/list", {});
    if (!data.ok) return;

    // Friends list
    const friendsListEl = document.getElementById("friends-list");
    const friendsCountEl = document.getElementById("friends-count");
    friendsCountEl.textContent = data.friends.length;
    friendsListEl.innerHTML = "";
    if (data.friends.length === 0) {
      friendsListEl.innerHTML = '<div class="friends-empty">No friends yet</div>';
    } else {
      for (const f of data.friends) {
        friendsListEl.appendChild(createFriendRow(f, "friend"));
      }
    }

    // Incoming requests
    const incomingSection = document.getElementById("friends-incoming-section");
    const incomingEl = document.getElementById("friends-incoming");
    const incomingCount = document.getElementById("friends-incoming-count");
    if (data.incoming.length > 0) {
      incomingSection.style.display = "block";
      incomingCount.textContent = data.incoming.length;
      incomingEl.innerHTML = "";
      for (const f of data.incoming) {
        incomingEl.appendChild(createFriendRow(f, "incoming"));
      }
    } else {
      incomingSection.style.display = "none";
    }

    // Outgoing requests
    const outgoingSection = document.getElementById("friends-outgoing-section");
    const outgoingEl = document.getElementById("friends-outgoing");
    const outgoingCount = document.getElementById("friends-outgoing-count");
    if (data.outgoing.length > 0) {
      outgoingSection.style.display = "block";
      outgoingCount.textContent = data.outgoing.length;
      outgoingEl.innerHTML = "";
      for (const f of data.outgoing) {
        outgoingEl.appendChild(createFriendRow(f, "outgoing"));
      }
    } else {
      outgoingSection.style.display = "none";
    }
  }

  function createFriendRow(user, type) {
    const row = document.createElement("div");
    row.className = "friend-row";
    const dotClass = "friend-status-dot" + (user.isOnline ? " online" : "");
    const nameClass = user.isAdmin ? " admin" : (user.isTester ? " tester" : "");
    const namePrefix = user.isAdmin ? "[A] " : (user.isTester ? "[T] " : "");

    let actionsHtml = "";
    if (type === "friend") {
      actionsHtml = `<button class="friend-btn remove" data-action="remove" data-user="${escapeHtml(user.username)}">REMOVE</button>`;
    } else if (type === "incoming") {
      actionsHtml = `
        <button class="friend-btn accept" data-action="accept" data-user="${escapeHtml(user.username)}">ACCEPT</button>
        <button class="friend-btn decline" data-action="remove" data-user="${escapeHtml(user.username)}">DECLINE</button>
      `;
    } else if (type === "outgoing") {
      actionsHtml = `<button class="friend-btn remove" data-action="remove" data-user="${escapeHtml(user.username)}">REMOVE</button>`;
    }

    row.innerHTML = `
      <div class="${dotClass}"></div>
      <div class="friend-name${nameClass}">${namePrefix}${escapeHtml(user.username)}</div>
      <div class="friend-actions">${actionsHtml}</div>
    `;

    // Bind actions
    row.querySelectorAll(".friend-btn").forEach((btn) => {
      btn.onclick = async () => {
        const action = btn.getAttribute("data-action");
        const username = btn.getAttribute("data-user");
        if (action === "accept") {
          await apiCall("/api/friends/accept", { username });
        } else if (action === "remove") {
          await apiCall("/api/friends/remove", { username });
        }
        refreshFriendsList();
      };
    });

    return row;
  }

  // Search input
  const searchInput = document.getElementById("friends-search-input");
  const searchResultsEl = document.getElementById("friends-search-results");
  let searchTimer = null;

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const query = searchInput.value.trim();
      if (query.length < 2) {
        searchResultsEl.innerHTML = "";
        return;
      }
      searchTimer = setTimeout(async () => {
        const data = await apiCall("/api/users/search", { query });
        if (!data.ok) return;
        searchResultsEl.innerHTML = "";
        if (data.users.length === 0) {
          searchResultsEl.innerHTML = '<div class="friends-empty">No users found</div>';
          return;
        }
        for (const u of data.users) {
          const row = document.createElement("div");
          row.className = "friend-row";
          const nameClass = u.isAdmin ? " admin" : (u.isTester ? " tester" : "");
          const namePrefix = u.isAdmin ? "[A] " : (u.isTester ? "[T] " : "");
          row.innerHTML = `
            <div class="friend-status-dot"></div>
            <div class="friend-name${nameClass}">${namePrefix}${escapeHtml(u.username)}</div>
            <div class="friend-actions">
              <button class="friend-btn add" data-user="${escapeHtml(u.username)}">+ Add</button>
            </div>
          `;
          row.querySelector("button").onclick = async () => {
            const result = await apiCall("/api/friends/request", { username: u.username });
            if (result.ok) {
              row.querySelector(".friend-actions").innerHTML = '<span style="font-size:11px;color:#4ade80">Sent</span>';
              setTimeout(() => {
                searchInput.value = "";
                searchResultsEl.innerHTML = "";
                refreshFriendsList();
              }, 1000);
            } else {
              row.querySelector(".friend-actions").innerHTML = `<span style="font-size:11px;color:#ef4444">${result.error}</span>`;
            }
          };
          searchResultsEl.appendChild(row);
        }
      }, 350);
    });
  }

  // Refresh button
  const friendsRefreshBtn = document.getElementById("btn-friends-refresh");
  if (friendsRefreshBtn) {
    friendsRefreshBtn.onclick = refreshFriendsList;
  }

  // Auto-refresh kazdych 15s kdyz je menu aktivni
  setInterval(() => {
    if (currentUser && document.getElementById("menu")?.classList.contains("active")) {
      refreshFriendsList();
    }
  }, 15000);

  // ---------- STATS PANEL ----------
  function formatHours(ms) {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) {
      const minutes = ms / (1000 * 60);
      return minutes.toFixed(0) + "m";
    }
    return hours.toFixed(1);
  }

  async function refreshStats() {
    // Globalni stats - vsem (i guestum)
    try {
      const r = await fetch("/api/stats/global");
      const data = await r.json();
      if (data.ok) {
        const s = data.stats;
        document.getElementById("stat-global-players").textContent = s.totalPlayers;
        document.getElementById("stat-global-games").textContent = s.totalGames;
        document.getElementById("stat-global-kills").textContent = s.totalKills;
        document.getElementById("stat-global-hours").textContent = formatHours(s.totalPlayTimeMs);
      }
    } catch (err) {}

    // Moje stats - jen pokud prihlasen
    const mySection = document.getElementById("my-stats-section");
    if (currentUser && sessionToken) {
      const data = await apiCall("/api/stats/me", {});
      if (data.ok) {
        mySection.style.display = "flex";
        const s = data.stats;
        document.getElementById("stat-my-games").textContent = s.gamesPlayed;
        document.getElementById("stat-my-hours").textContent = formatHours(s.playTimeMs);
        document.getElementById("stat-my-kills").textContent = s.kills;
        document.getElementById("stat-my-wins").textContent = s.wins;
        const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
        document.getElementById("stat-my-kd").textContent = kd;
      }
    } else {
      mySection.style.display = "none";
    }

    // Leaderboard
    refreshLeaderboard();
  }

  async function refreshLeaderboard() {
    const sortSelect = document.getElementById("leaderboard-sort");
    const sort = sortSelect ? sortSelect.value : "kills";
    try {
      const r = await fetch(`/api/stats/leaderboard?sort=${sort}&limit=10`);
      const data = await r.json();
      if (!data.ok) return;
      const listEl = document.getElementById("leaderboard-list");
      listEl.innerHTML = "";
      if (data.players.length === 0) {
        listEl.innerHTML = '<div class="lb-empty">No players yet</div>';
        return;
      }
      data.players.forEach((p, idx) => {
        const rank = idx + 1;
        const row = document.createElement("div");
        const isMe = currentUser && p.username === currentUser.username;
        row.className = `lb-row rank-${rank}${isMe ? " me" : ""}`;
        const namePrefix = p.isAdmin ? "[A] " : (p.isTester ? "[T] " : "");
        const nameClass = p.isAdmin ? " admin" : (p.isTester ? " tester" : "");
        let statValue = "";
        if (sort === "wins") statValue = p.wins;
        else if (sort === "games") statValue = p.gamesPlayed;
        else if (sort === "hours") statValue = formatHours(p.playTimeMs);
        else statValue = p.kills;
        row.innerHTML = `
          <div class="lb-rank">${"#" + rank}</div>
          <div class="lb-name${nameClass}" title="${escapeHtml(p.username)}">${namePrefix}${escapeHtml(p.username)}</div>
          <div class="lb-stat">${statValue}</div>
        `;
        listEl.appendChild(row);
      });
    } catch (err) {}
  }

  // Sort change
  const sortSelect = document.getElementById("leaderboard-sort");
  if (sortSelect) {
    sortSelect.onchange = refreshLeaderboard;
  }

  // ---------- FEEDBACK MODAL ----------
  const feedbackBtn = document.getElementById("btn-open-feedback");
  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackCloseBtn = document.getElementById("btn-close-feedback");
  const feedbackSubmitBtn = document.getElementById("btn-submit-feedback");
  const ratingStars = document.querySelectorAll("#feedback-rating .star");
  const ratingText = document.getElementById("feedback-rating-text");
  let selectedRating = 0;

  const ratingLabels = {
    1: "Terrible",
    2: "Bad",
    3: "OK",
    4: "Good",
    5: "Amazing!",
  };

  function updateStars(rating) {
    ratingStars.forEach((s) => {
      const r = parseInt(s.getAttribute("data-rating"));
      s.classList.toggle("active", r <= rating);
    });
    ratingText.textContent = ratingLabels[rating] || "";
  }

  ratingStars.forEach((star) => {
    star.addEventListener("mouseenter", () => {
      const r = parseInt(star.getAttribute("data-rating"));
      ratingStars.forEach((s) => {
        const sr = parseInt(s.getAttribute("data-rating"));
        s.classList.toggle("hover", sr <= r);
      });
    });
    star.addEventListener("mouseleave", () => {
      ratingStars.forEach((s) => s.classList.remove("hover"));
    });
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.getAttribute("data-rating"));
      updateStars(selectedRating);
    });
  });

  function openFeedbackModal() {
    feedbackModal.classList.add("active");
    // Reset
    selectedRating = 0;
    updateStars(0);
    document.getElementById("feedback-likes").value = "";
    document.getElementById("feedback-bugs").value = "";
    document.getElementById("feedback-suggestions").value = "";
    document.getElementById("feedback-error").style.display = "none";
    document.getElementById("feedback-success").style.display = "none";
    feedbackSubmitBtn.parentElement.style.display = "flex";
  }
  function closeFeedbackModal() {
    feedbackModal.classList.remove("active");
  }

  if (feedbackBtn) feedbackBtn.onclick = openFeedbackModal;
  if (feedbackCloseBtn) feedbackCloseBtn.onclick = closeFeedbackModal;
  feedbackModal.addEventListener("click", (e) => {
    if (e.target === feedbackModal) closeFeedbackModal();
  });

  feedbackSubmitBtn.onclick = async () => {
    if (selectedRating < 1 || selectedRating > 5) {
      const errEl = document.getElementById("feedback-error");
      errEl.textContent = "Please select a rating (1-5 stars)";
      errEl.style.display = "block";
      return;
    }
    const body = {
      rating: selectedRating,
      likes: document.getElementById("feedback-likes").value.trim(),
      bugs: document.getElementById("feedback-bugs").value.trim(),
      suggestions: document.getElementById("feedback-suggestions").value.trim(),
      token: sessionToken || null,
    };
    feedbackSubmitBtn.disabled = true;
    try {
      const r = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.ok) {
        // Schovej formular, ukaz success
        feedbackSubmitBtn.parentElement.style.display = "none";
        document.getElementById("feedback-success").style.display = "block";
        // Auto-close po 2.5s
        setTimeout(closeFeedbackModal, 2500);
      } else {
        const errEl = document.getElementById("feedback-error");
        errEl.textContent = data.error || "Failed to submit";
        errEl.style.display = "block";
      }
    } catch (err) {
      const errEl = document.getElementById("feedback-error");
      errEl.textContent = "Network error";
      errEl.style.display = "block";
    } finally {
      feedbackSubmitBtn.disabled = false;
    }
  };

  // Initial refresh + auto-refresh kazdych 30s
  refreshStats();
  setInterval(() => {
    if (document.getElementById("menu")?.classList.contains("active")) {
      refreshStats();
    }
  }, 30000);

  // Animovane pozadi v menu - mini simulace botu
  initMenuTrailer("menu-bg", "menu");
  initMenuTrailer("auth-bg", "auth");

  function initMenuTrailer(canvasId, screenId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#ff5e5e", "#5ec8ff", "#7dff7d", "#ffd75e"];
    const NAMES = ["NEO", "ZAP", "ARC", "JAX"];

    let bots = [];
    let bullets = [];
    let particles = [];
    let mapKey = "skybridge";
    let initialized = false;

    function spawnBot(i) {
      const b = {
        id: i,
        x: 200 + i * 350,
        y: 100,
        vx: 0,
        vy: 0,
        facing: i % 2 === 0 ? 1 : -1,
        color: COLORS[i],
        name: NAMES[i],
        alive: true,
        hp: 100,
        onGround: false,
        weapon: "pistol",
        aimX: i % 2 === 0 ? 1 : -1,
        aimY: 0,
        moveDir: 0,
        moveTimer: 0,
        jumpTimer: 0,
        shootTimer: 0.5 + Math.random() * 0.5,
        respawnAt: 0,
      };
      // Pokud mame mapu, pouzij jeji spawn
      if (SHARED && SHARED.MAPS && SHARED.MAPS[mapKey]) {
        const sp = SHARED.MAPS[mapKey].spawns[i % SHARED.MAPS[mapKey].spawns.length];
        b.x = sp.x;
        b.y = sp.y;
      }
      return b;
    }

    function initBots() {
      bots = [];
      bullets = [];
      particles = [];
      for (let i = 0; i < 4; i++) {
        bots.push(spawnBot(i));
      }
      initialized = true;
    }

    let lastTime = performance.now();
    let mapChangeTimer = 30;

    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const screenActive = document.getElementById(screenId)?.classList.contains("active");
      if (!screenActive) return;
      if (!SHARED || !SHARED.MAPS) return;

      if (!initialized) initBots();

      const map = SHARED.MAPS[mapKey];
      if (!map) return;

      // Obcas zmen mapu
      mapChangeTimer -= dt;
      if (mapChangeTimer <= 0) {
        const keys = Object.keys(SHARED.MAPS);
        mapKey = keys[Math.floor(Math.random() * keys.length)];
        initBots();
        mapChangeTimer = 25 + Math.random() * 15;
      }

      const PL = SHARED.PLAYER;
      const aliveBots = bots.filter(b => b.alive);

      // === UPDATE BOTU ===
      for (const b of bots) {
        // Mrtvy - pockej na respawn
        if (!b.alive) {
          if (now >= b.respawnAt) {
            const sp = map.spawns[Math.floor(Math.random() * map.spawns.length)];
            b.x = sp.x;
            b.y = sp.y;
            b.vx = 0;
            b.vy = 0;
            b.alive = true;
            b.hp = 100;
            b.weapon = "pistol";
            b.facing = Math.random() > 0.5 ? 1 : -1;
            b.aimX = b.facing;
            b.aimY = 0;
          }
          continue;
        }

        // === AI - pohyb ===
        b.moveTimer -= dt;
        if (b.moveTimer <= 0) {
          // 60% sance jit nahodnym smerem, 40% stat
          const r = Math.random();
          if (r < 0.3) b.moveDir = -1;
          else if (r < 0.6) b.moveDir = 1;
          else b.moveDir = 0;
          b.moveTimer = 0.6 + Math.random() * 1.5;
        }

        // === Skok ===
        b.jumpTimer -= dt;
        if (b.jumpTimer <= 0 && b.onGround && Math.random() < 0.4) {
          b.vy = -550;
          b.onGround = false;
          b.jumpTimer = 1.5 + Math.random() * 2;
        }

        // === AI - mireni a strelba ===
        b.shootTimer -= dt;
        if (b.shootTimer <= 0 && aliveBots.length > 1) {
          // Najdi nejblizsi cil
          let target = null;
          let minD = Infinity;
          for (const o of aliveBots) {
            if (o === b) continue;
            const d = Math.hypot(o.x - b.x, o.y - b.y);
            if (d < minD) {
              minD = d;
              target = o;
            }
          }
          if (target) {
            const dx = (target.x + 24) - (b.x + 24);
            const dy = (target.y + 32) - (b.y + 32);
            const m = Math.hypot(dx, dy) || 1;
            b.aimX = dx / m;
            b.aimY = dy / m;
            b.facing = b.aimX >= 0 ? 1 : -1;

            // Vystrel
            bullets.push({
              x: b.x + 24 + b.aimX * 30,
              y: b.y + 32 + b.aimY * 30,
              vx: b.aimX * 800,
              vy: b.aimY * 800,
              life: 1.5,
              owner: b,
              color: "#ffe066",
              radius: 4,
              damage: 15,
            });
          }
          b.shootTimer = 0.5 + Math.random() * 0.7;
        }

        // === Pohyb ===
        const moveSpeed = 280;
        if (b.moveDir !== 0) {
          b.vx = b.moveDir * moveSpeed;
        } else {
          b.vx *= 0.85;
        }

        // Gravitace
        b.vy += 1400 * dt;
        if (b.vy > 800) b.vy = 800;

        // Aplikace pohybu
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Kolize s platformami (jednoduche)
        b.onGround = false;
        const W = SHARED.PLAYER.WIDTH, H = SHARED.PLAYER.HEIGHT;
        for (const plat of map.platforms) {
          // Y kolize - pristani z hora
          if (b.x + W > plat.x && b.x < plat.x + plat.w) {
            // Bot byl nad platformou a ted spada do ni
            const prevY = b.y - b.vy * dt;
            if (b.vy > 0 && prevY + H <= plat.y + 5 && b.y + H > plat.y && b.y < plat.y + plat.h) {
              b.y = plat.y - H;
              b.vy = 0;
              b.onGround = true;
            }
          }
        }

        // Hranice mapy X
        if (b.x < 0) { b.x = 0; b.moveDir = 1; }
        if (b.x > SHARED.WORLD_WIDTH - W) { b.x = SHARED.WORLD_WIDTH - W; b.moveDir = -1; }

        // Pad mimo mapu = smrt
        if (b.y > SHARED.WORLD_HEIGHT + 100) {
          b.alive = false;
          b.respawnAt = now + 1500 + Math.random() * 1000;
          for (let k = 0; k < 15; k++) {
            particles.push({
              x: b.x + W/2,
              y: SHARED.WORLD_HEIGHT,
              vx: (Math.random() - 0.5) * 400,
              vy: -Math.random() * 400 - 100,
              life: 0.8,
              color: b.color,
            });
          }
        }
      }

      // === STRELY ===
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bl = bullets[i];
        bl.life -= dt;
        if (bl.life <= 0) { bullets.splice(i, 1); continue; }
        bl.x += bl.vx * dt;
        bl.y += bl.vy * dt;

        // Mimo mapu
        if (bl.x < -50 || bl.x > SHARED.WORLD_WIDTH + 50 ||
            bl.y < -50 || bl.y > SHARED.WORLD_HEIGHT + 50) {
          bullets.splice(i, 1);
          continue;
        }

        // Kolize s mapou
        let hitMap = false;
        for (const plat of map.platforms) {
          if (bl.x > plat.x && bl.x < plat.x + plat.w &&
              bl.y > plat.y && bl.y < plat.y + plat.h) {
            hitMap = true;
            for (let k = 0; k < 4; k++) {
              particles.push({
                x: bl.x, y: bl.y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.4,
                color: bl.color,
              });
            }
            break;
          }
        }
        if (hitMap) { bullets.splice(i, 1); continue; }

        // Kolize s boty
        const W = SHARED.PLAYER.WIDTH, H = SHARED.PLAYER.HEIGHT;
        for (const b of bots) {
          if (b === bl.owner || !b.alive) continue;
          if (bl.x > b.x && bl.x < b.x + W && bl.y > b.y && bl.y < b.y + H) {
            // Hit!
            b.hp -= bl.damage;
            // Knockback
            const m = Math.hypot(bl.vx, bl.vy) || 1;
            b.vx += (bl.vx / m) * 350;
            b.vy += (bl.vy / m) * 200 - 150;
            for (let k = 0; k < 8; k++) {
              particles.push({
                x: bl.x, y: bl.y,
                vx: (Math.random() - 0.5) * 300,
                vy: (Math.random() - 0.5) * 300,
                life: 0.5,
                color: b.color,
              });
            }
            if (b.hp <= 0) {
              b.alive = false;
              b.respawnAt = now + 1800 + Math.random() * 1200;
              for (let k = 0; k < 20; k++) {
                particles.push({
                  x: b.x + W/2, y: b.y + H/2,
                  vx: (Math.random() - 0.5) * 500,
                  vy: (Math.random() - 0.5) * 500,
                  life: 0.8,
                  color: b.color,
                });
              }
            }
            bullets.splice(i, 1);
            break;
          }
        }
      }

      // === PARTICLES ===
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += 600 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // === RENDER ===
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ww = SHARED.WORLD_WIDTH;
      const wh = SHARED.WORLD_HEIGHT;
      const sx = w / ww;
      const sy = h / wh;
      const scale = Math.min(sx, sy);
      const offsetX = (w - ww * scale) / 2;
      const offsetY = (h - wh * scale) / 2;

      // Pozadi
      ctx.fillStyle = map.bg || "#0a0e1a";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Background pruhy
      ctx.fillStyle = map.bgAccent || "#2a3a5a";
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(0, i * 120, ww, 60);
      }
      ctx.globalAlpha = 1;

      // Platformy
      for (const plat of map.platforms) {
        if (plat.destructible) {
          ctx.fillStyle = "#8b6f4a";
        } else {
          ctx.fillStyle = "#3a4a6a";
        }
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(plat.x, plat.y, plat.w, 3);
      }

      // Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // Strely
      for (const bl of bullets) {
        ctx.fillStyle = bl.color;
        ctx.shadowColor = bl.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.radius || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Boti - kresleni presne jako v hre (stejny render kod)
      for (const b of bots) {
        if (!b.alive) continue;
        const W = SHARED.PLAYER.WIDTH;
        const H = SHARED.PLAYER.HEIGHT;

        // Stin pod postavou
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(b.x + W / 2, b.y + H + 4, W * 0.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Telo (zaoblene rohy)
        ctx.fillStyle = b.color;
        roundRect(ctx, b.x, b.y, W, H, 8);
        ctx.fill();

        // Svetlejsi vrch (jako helma)
        ctx.fillStyle = lighten(b.color, 0.18);
        roundRect(ctx, b.x + 4, b.y + 4, W - 8, H * 0.45, 6);
        ctx.fill();

        // Dve oci s panenkami (jako ve hre)
        const eyeY = b.y + 18;
        const eyeBaseX = b.x + W / 2;
        const eyeOffset = b.facing > 0 ? 4 : -4;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(eyeBaseX - 6 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeBaseX + 6 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(eyeBaseX - 6 + eyeOffset + (b.facing > 0 ? 1 : -1), eyeY, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeBaseX + 6 + eyeOffset + (b.facing > 0 ? 1 : -1), eyeY, 2, 0, Math.PI * 2); ctx.fill();

        // Zbran
        const cx = b.x + W / 2;
        const cy = b.y + H * 0.4;
        const ang = Math.atan2(b.aimY, b.aimX);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        if (b.weapon === "rocket") {
          ctx.fillStyle = "#444";
          ctx.fillRect(0, -7, 28, 14);
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(24, -8, 6, 16);
        } else if (b.weapon === "shotgun") {
          ctx.fillStyle = "#5a4a3a";
          ctx.fillRect(0, -5, 26, 10);
          ctx.fillStyle = "#222";
          ctx.fillRect(20, -6, 8, 12);
        } else if (b.weapon === "laser") {
          ctx.fillStyle = "#1a3a4a";
          ctx.fillRect(0, -5, 28, 10);
          ctx.fillStyle = "#54e0ff";
          ctx.fillRect(24, -3, 6, 6);
        } else {
          ctx.fillStyle = "#333";
          ctx.fillRect(0, -4, 18, 8);
          ctx.fillStyle = "#222";
          ctx.fillRect(14, -5, 4, 10);
        }
        ctx.restore();

        // Jmeno nad postavou
        ctx.save();
        ctx.font = "bold 13px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(b.x + W / 2 - 35, b.y - 22, 70, 16);
        ctx.fillStyle = b.color;
        ctx.fillText(b.name, b.x + W / 2, b.y - 10);
        ctx.restore();

        // HP bar nad jmenem
        const hpRatio = Math.max(0, Math.min(1, b.hp / 100));
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(b.x - 4, b.y - 6, W + 8, 5);
        ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#facc15" : "#ef4444";
        ctx.fillRect(b.x - 4, b.y - 6, (W + 8) * hpRatio, 5);
      }

      ctx.restore();
    }

    requestAnimationFrame(tick);
  }

  const nameInput = document.getElementById("name-input");
  nameInput.value = localStorage.getItem("gm_name") || "Player" + Math.floor(Math.random() * 99);

  // Pri vstupu do hry na mobilu pozadej o fullscreen (musi byt pri user gesture)
  function tryGoFullscreenOnMobile() {
    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    if (typeof requestFullscreen === "function") {
      requestFullscreen();
    } else {
      // requestFullscreen jeste neni definovane - zkusime primo
      const el = document.documentElement;
      const req = el.requestFullscreen ||
                  el.webkitRequestFullscreen ||
                  el.mozRequestFullScreen ||
                  el.msRequestFullscreen;
      if (req) req.call(el).catch(() => {});
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    }
  }

  document.getElementById("btn-quickplay").onclick = () => {
    saveName();
    tryGoFullscreenOnMobile();
    socket.emit("quick_play", {}, handleJoin);
  };
  document.getElementById("btn-create").onclick = () => {
    saveName();
    tryGoFullscreenOnMobile();
    socket.emit("create_room", { mapKey: "skybridge" }, handleJoin);
  };
  document.getElementById("btn-join").onclick = () => {
    saveName();
    tryGoFullscreenOnMobile();
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    if (!code) return;
    socket.emit("join_room", { roomId: code }, handleJoin);
  };
  document.getElementById("btn-refresh").onclick = refreshRooms;

  function saveName() {
    // Pokud jsem prihlasen, pouzij username z uctu, jinak input
    const n = currentUser?.username || (nameInput?.value || "").trim() || "Player";
    localStorage.setItem("gm_name", n);
    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    socket.emit("hello", { name: n, sessionToken, isTouch });
  }

  // Server posila novy token pri uspesnem login
  socket.on("admin_token", (data) => {
    if (data?.token) {
      localStorage.setItem("kf_admin_token", data.token);
    } else {
      // Logout - smaz token
      localStorage.removeItem("kf_admin_token");
    }
  });

  // Server posila update statusu (admin/tester promotion bez reloglu)
  socket.on("user_status_update", (data) => {
    if (currentUser) {
      currentUser.isAdmin = !!data.isAdmin;
      currentUser.isTester = !!data.isTester;
      updateUserInfoUI();
    }
  });

  // Server hlasi ze friends data se zmenily (request, accept, remove)
  socket.on("friends_changed", () => {
    if (currentUser && typeof refreshFriendsList === "function") {
      refreshFriendsList();
    }
  });

  function refreshRooms() {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data) => {
        const list = document.getElementById("rooms-list");
        list.innerHTML = "";

        // Update online count
        const totalPlayers = data.rooms.reduce((sum, r) => sum + r.playerCount, 0);
        const onlineEl = document.getElementById("online-count");
        if (onlineEl) {
          if (totalPlayers === 0) {
            onlineEl.textContent = "Be the first online!";
          } else if (totalPlayers === 1) {
            onlineEl.textContent = "1 player online";
          } else {
            onlineEl.textContent = `${totalPlayers} players online`;
          }
        }

        if (!data.rooms.length) {
          // Empty state je v CSS pres :empty pseudo-class
          return;
        }
        for (const r of data.rooms) {
          const row = document.createElement("div");
          row.className = "room-row";
          row.innerHTML = `
            <div>
              <div class="room-code">${r.id}</div>
              <div class="room-meta">${r.name} · ${r.mapKey} · ${r.phase}</div>
            </div>
            <div class="room-meta">${r.playerCount}/${r.maxPlayers}</div>
          `;
          row.onclick = () => {
            saveName();
            socket.emit("join_room", { roomId: r.id }, handleJoin);
          };
          list.appendChild(row);
        }
      })
      .catch(() => {});
  }

  function handleJoin(resp) {
    if (!resp || !resp.ok) {
      alert(resp?.error || "Could not join room");
      return;
    }
    roomId = resp.roomId;
    selfId = resp.selfId;
    SHARED = resp.shared;
    clearChatLogs();
    document.getElementById("lobby-code").textContent = roomId;
    document.getElementById("lobby-map").value = resp.mapKey;
    document.getElementById("lobby-win-score").textContent = SHARED.ROUND.MATCH_WIN_SCORE;
    showScreen("lobby");
  }

  // Pri prvnim pripojeni posli session token (pokud existuje) pro auto-login
  const isTouchInit = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  const initialName = currentUser?.username || nameInput?.value || "Guest";
  socket.emit("hello", { name: initialName, sessionToken, isTouch: isTouchInit }, (resp) => {
    if (resp?.shared) {
      // SHARED dostaneme uz pri hello - umozni trailer simulaci v menu
      SHARED = resp.shared;
    }
    if (resp?.username) {
      // Server overil session token
      currentUser = { username: resp.username, isAdmin: resp.isAdmin, isTester: resp.isTester };
      updateUserInfoUI();
    }
    if (resp?.isAdmin) {
      console.log("[KNOCKFRIEND] Logged in as admin: " + resp.username);
    }
    refreshRooms();
  });

  // Auto-refresh open rooms a online count kazdych 5 sekund (jen kdyz menu aktivni)
  setInterval(() => {
    if (document.getElementById("menu")?.classList.contains("active")) {
      refreshRooms();
    }
  }, 5000);

  // ---------- LOBBY ----------
  const lobbyPlayersEl = document.getElementById("lobby-players");
  const lobbyMapEl = document.getElementById("lobby-map");
  const winButtonsEl = document.getElementById("win-buttons");
  const phoneOnlyToggle = document.getElementById("phone-only-toggle");
  const colorPickerEl = document.getElementById("color-picker");
  let isReady = false;
  let currentHostId = null;
  // Flag: hrac se chce divat na lobby (i kdyz hra zrovna bezi)
  // Nastavi se pres "Back to Lobby" tlacitko, vypne se pri Ready nebo Leave
  let userPreferLobby = false;

  // Vybudovat color picker - bude prepsano az pridem SHARED.COLORS
  function buildColorPicker(colors, myColor, takenColors) {
    if (!colorPickerEl || !colors) return;
    colorPickerEl.innerHTML = "";
    for (const c of colors) {
      const btn = document.createElement("button");
      btn.className = "color-swatch-btn";
      if (c === myColor) btn.classList.add("selected");
      if (takenColors.has(c) && c !== myColor) {
        btn.classList.add("taken");
        btn.disabled = true;
      }
      btn.style.background = c;
      btn.title = c;
      btn.onclick = () => {
        if (btn.disabled) return;
        socket.emit("set_color", { color: c });
      };
      colorPickerEl.appendChild(btn);
    }
  }

  document.getElementById("btn-leave").onclick = () => {
    socket.emit("leave_room");
    isReady = false;
    userPreferLobby = false;
    clearChatLogs();
    showScreen("menu");
    refreshRooms();
  };
  document.getElementById("btn-ready").onclick = () => {
    isReady = !isReady;
    if (isReady) userPreferLobby = false; // chce zase hrat
    socket.emit("ready", { ready: isReady });
    document.getElementById("btn-ready").textContent = isReady ? "Cancel" : "Ready";
    document.getElementById("btn-ready").classList.toggle("ready", isReady);
  };
  lobbyMapEl.onchange = () => {
    socket.emit("change_map", { mapKey: lobbyMapEl.value });
  };

  // Win buttons - host muze menit pocet vyhranych kol
  document.querySelectorAll(".win-btn").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      const wins = parseInt(btn.getAttribute("data-wins"));
      socket.emit("set_match_settings", { winScore: wins });
    };
  });

  // Phone only toggle
  phoneOnlyToggle.onclick = () => {
    if (phoneOnlyToggle.disabled) return;
    const newState = !phoneOnlyToggle.classList.contains("active");
    socket.emit("set_match_settings", { phoneOnly: newState });
  };

  socket.on("room_info", (info) => {
    if (info.id !== roomId) return;
    document.getElementById("lobby-code").textContent = info.id;
    if (lobbyMapEl.value !== info.mapKey) lobbyMapEl.value = info.mapKey;

    // Match settings - jen host muze menit
    currentHostId = info.hostId;
    const isHost = info.hostId === selfId;
    lobbyMapEl.disabled = !isHost;

    // Color picker - vybuduj podle aktualnich barev hracu
    if (SHARED && SHARED.COLORS) {
      const me = info.players.find((p) => p.id === selfId);
      const takenColors = new Set(info.players.map((p) => p.color));
      buildColorPicker(SHARED.COLORS, me?.color, takenColors);
    }

    // Update win buttons
    if (info.matchSettings) {
      const ws = info.matchSettings.winScore;
      document.querySelectorAll(".win-btn").forEach((btn) => {
        const w = parseInt(btn.getAttribute("data-wins"));
        btn.classList.toggle("active", w === ws);
        btn.disabled = !isHost;
      });

      // Phone-only toggle stav
      const phoneOn = !!info.matchSettings.phoneOnly;
      phoneOnlyToggle.classList.toggle("active", phoneOn);
      phoneOnlyToggle.querySelector(".toggle-state").textContent = phoneOn ? "ON" : "OFF";
      phoneOnlyToggle.disabled = !isHost;
    }

    // Update host-only tagy
    document.querySelectorAll(".host-tag").forEach((tag) => {
      tag.style.display = isHost ? "none" : "inline-block";
    });

    // Update lobby hint
    const winScoreEl = document.getElementById("lobby-win-score");
    if (winScoreEl && info.matchSettings) {
      winScoreEl.textContent = info.matchSettings.winScore;
    }

    lobbyPlayersEl.innerHTML = "";
    for (const p of info.players) {
      const row = document.createElement("div");
      row.className = "lobby-player" + (p.ready ? " ready" : "") + (p.isAdmin ? " admin" : "") + (p.isTester ? " tester" : "");
      const adminBadge = p.isAdmin ? '<span class="admin-badge">ADMIN</span> ' : '';
      const testerBadge = p.isTester && !p.isAdmin ? '<span class="tester-badge">TESTER</span> ' : '';
      const hostBadge = p.id === info.hostId ? '<span class="player-host-badge">HOST</span>' : '';
      const nameStyle = p.isAdmin ? 'color: #ffd700' : (p.isTester ? 'color: #54e0ff' : '');
      row.innerHTML = `
        <div class="swatch" style="background:${p.color};color:${p.color}"></div>
        <div class="pname" style="${nameStyle}">${adminBadge}${testerBadge}${escapeHtml(p.name)}${p.id === selfId ? " (you)" : ""}${hostBadge}</div>
        <div class="pready">${p.ready ? "READY" : "..."}</div>
      `;
      lobbyPlayersEl.appendChild(row);
    }
  });

  // ---------- SETTINGS UI ----------
  const settingsModal = document.getElementById("settings-modal");
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  let isListeningForKey = false; // true kdyz uzivatel meni keybind
  let listeningButton = null;

  function openSettings() {
    settingsModal.classList.add("active");
    refreshKeybindsUI();
    refreshCrosshairUI();
    drawCrosshairPreview();
    refreshSettingsActions();
  }
  function closeSettings() {
    settingsModal.classList.remove("active");
    if (listeningButton) {
      listeningButton.classList.remove("listening");
      listeningButton = null;
      isListeningForKey = false;
    }
  }
  btnOpenSettings.onclick = openSettings;
  btnCloseSettings.onclick = closeSettings;
  // Klik mimo modal zavre
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // Akcni tlacitka v settings - viditelnost podle kontextu
  const btnBackToLobby = document.getElementById("btn-back-to-lobby");
  const btnExitToMenu = document.getElementById("btn-exit-to-menu");

  function refreshSettingsActions() {
    // Tlacitka maji smysl jen kdyz jsi v mistnosti (lobby nebo ve hre)
    const inGame = screens.game.classList.contains("active");
    const inLobby = screens.lobby.classList.contains("active");
    const inRoom = !!roomId;

    // Back to Lobby - jen kdyz jsi ve hre (ve lobby screen uz jsi v lobby)
    btnBackToLobby.classList.toggle("hidden", !inGame);
    // Exit to Menu - kdyz jsi v mistnosti (lobby i hra)
    btnExitToMenu.classList.toggle("hidden", !inRoom);
  }

  if (btnBackToLobby) {
    btnBackToLobby.onclick = () => {
      // Vrat se do lobby aktualni mistnosti (neopusti mistnost!)
      // Server bezi normalne - hrac jen vidi lobby UI misto game UI
      userPreferLobby = true;
      closeSettings();
      showScreen("lobby");
    };
  }

  if (btnExitToMenu) {
    btnExitToMenu.onclick = () => {
      // Opusti mistnost uplne a vrati se na uvodni stranku (menu)
      socket.emit("leave_room");
      isReady = false;
      userPreferLobby = false;
      const readyBtn = document.getElementById("btn-ready");
      if (readyBtn) {
        readyBtn.textContent = "Ready";
        readyBtn.classList.remove("ready");
      }
      clearChatLogs();
      closeSettings();
      showScreen("menu");
      refreshRooms();
    };
  }

  // Tab prepinani
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".settings-tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      const tabName = tab.getAttribute("data-tab");
      document.querySelector(`.settings-tab-content[data-tab="${tabName}"]`).classList.add("active");
      if (tabName === "crosshair") drawCrosshairPreview();
    };
  });

  // Keybinds UI
  function refreshKeybindsUI() {
    document.querySelectorAll(".keybind-btn").forEach((btn) => {
      const action = btn.getAttribute("data-action");
      btn.textContent = displayKey(settings.keybinds[action]);
    });
  }
  function displayKey(k) {
    if (!k) return "—";
    if (k === " ") return "Space";
    if (k === "`") return "~";
    return k.length === 1 ? k.toUpperCase() : k;
  }

  document.querySelectorAll(".keybind-btn").forEach((btn) => {
    btn.onclick = () => {
      // Pokud uz nejaka jina poslucha, zrus
      if (listeningButton) {
        listeningButton.classList.remove("listening");
      }
      listeningButton = btn;
      isListeningForKey = true;
      btn.classList.add("listening");
      btn.textContent = "Press a key...";
    };
  });

  // Globalni listener pro keybind capture (mimo herni input)
  document.addEventListener("keydown", (e) => {
    if (!isListeningForKey || !listeningButton) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      // Zruseni
      listeningButton.classList.remove("listening");
      refreshKeybindsUI();
      listeningButton = null;
      isListeningForKey = false;
      return;
    }

    let keyToBind = e.key.toLowerCase();
    if (keyToBind === " ") keyToBind = " ";
    const action = listeningButton.getAttribute("data-action");

    // Pokud je klavesa uz pouzita, vymen ji
    for (const otherAction in settings.keybinds) {
      if (otherAction !== action && settings.keybinds[otherAction] === keyToBind) {
        // Druhe akci dame puvodni klavesu prvni
        settings.keybinds[otherAction] = settings.keybinds[action];
      }
    }
    settings.keybinds[action] = keyToBind;
    saveKeybinds();
    refreshKeybindsUI();
    listeningButton.classList.remove("listening");
    listeningButton = null;
    isListeningForKey = false;
  }, true); // capture phase aby chytal pred ostatnimi

  document.getElementById("btn-reset-keybinds").onclick = () => {
    settings.keybinds = { ...DEFAULT_KEYBINDS };
    saveKeybinds();
    refreshKeybindsUI();
  };

  // Crosshair UI
  const chCanvas = document.getElementById("crosshair-preview");
  const chCtx = chCanvas.getContext("2d");
  const chControls = {
    enabled: document.getElementById("ch-enabled"),
    style: document.getElementById("ch-style"),
    color: document.getElementById("ch-color"),
    size: document.getElementById("ch-size"),
    sizeVal: document.getElementById("ch-size-val"),
    gap: document.getElementById("ch-gap"),
    gapVal: document.getElementById("ch-gap-val"),
    thickness: document.getElementById("ch-thickness"),
    thicknessVal: document.getElementById("ch-thickness-val"),
    dot: document.getElementById("ch-dot"),
    outline: document.getElementById("ch-outline"),
    outlineOpacity: document.getElementById("ch-outline-opacity"),
    outlineOpacityVal: document.getElementById("ch-outline-opacity-val"),
  };

  function refreshCrosshairUI() {
    chControls.enabled.checked = settings.crosshair.enabled !== false;
    chControls.style.value = settings.crosshair.style;
    chControls.color.value = settings.crosshair.color;
    chControls.size.value = settings.crosshair.size;
    chControls.sizeVal.textContent = settings.crosshair.size;
    chControls.gap.value = settings.crosshair.gap;
    chControls.gapVal.textContent = settings.crosshair.gap;
    chControls.thickness.value = settings.crosshair.thickness;
    chControls.thicknessVal.textContent = settings.crosshair.thickness;
    chControls.dot.checked = settings.crosshair.dot;
    chControls.outline.checked = settings.crosshair.outline;
    chControls.outlineOpacity.value = settings.crosshair.outlineOpacity;
    chControls.outlineOpacityVal.textContent = settings.crosshair.outlineOpacity;
  }

  function bindCrosshairControls() {
    chControls.enabled.onchange = () => { settings.crosshair.enabled = chControls.enabled.checked; saveCrosshair(); drawCrosshairPreview(); };
    chControls.style.onchange = () => { settings.crosshair.style = chControls.style.value; saveCrosshair(); drawCrosshairPreview(); };
    chControls.color.oninput = () => { settings.crosshair.color = chControls.color.value; saveCrosshair(); drawCrosshairPreview(); };
    chControls.size.oninput = () => {
      settings.crosshair.size = parseInt(chControls.size.value);
      chControls.sizeVal.textContent = settings.crosshair.size;
      saveCrosshair(); drawCrosshairPreview();
    };
    chControls.gap.oninput = () => {
      settings.crosshair.gap = parseInt(chControls.gap.value);
      chControls.gapVal.textContent = settings.crosshair.gap;
      saveCrosshair(); drawCrosshairPreview();
    };
    chControls.thickness.oninput = () => {
      settings.crosshair.thickness = parseInt(chControls.thickness.value);
      chControls.thicknessVal.textContent = settings.crosshair.thickness;
      saveCrosshair(); drawCrosshairPreview();
    };
    chControls.dot.onchange = () => { settings.crosshair.dot = chControls.dot.checked; saveCrosshair(); drawCrosshairPreview(); };
    chControls.outline.onchange = () => { settings.crosshair.outline = chControls.outline.checked; saveCrosshair(); drawCrosshairPreview(); };
    chControls.outlineOpacity.oninput = () => {
      settings.crosshair.outlineOpacity = parseInt(chControls.outlineOpacity.value);
      chControls.outlineOpacityVal.textContent = settings.crosshair.outlineOpacity;
      saveCrosshair(); drawCrosshairPreview();
    };
  }
  bindCrosshairControls();

  document.getElementById("btn-reset-crosshair").onclick = () => {
    settings.crosshair = { ...DEFAULT_CROSSHAIR };
    saveCrosshair();
    refreshCrosshairUI();
    drawCrosshairPreview();
  };

  // Vykreslovani crosshairu (sdilena funkce - pouziva se v preview i in-game)
  function drawCrosshair(ctx, cx, cy) {
    const c = settings.crosshair;
    if (c.enabled === false) return; // crosshair vypnuty v settings
    ctx.save();
    ctx.lineCap = "butt";

    // Outline (zakulacuje crosshair tmavym lemem pro citelnost)
    if (c.outline) {
      const outlineAlpha = c.outlineOpacity / 100;
      ctx.strokeStyle = `rgba(0, 0, 0, ${outlineAlpha})`;
      ctx.fillStyle = `rgba(0, 0, 0, ${outlineAlpha})`;
      ctx.lineWidth = c.thickness + 2;
      drawCrosshairShape(ctx, cx, cy, c, true);
    }

    // Hlavni crosshair
    ctx.strokeStyle = c.color;
    ctx.fillStyle = c.color;
    ctx.lineWidth = c.thickness;
    drawCrosshairShape(ctx, cx, cy, c, false);

    ctx.restore();
  }

  function drawCrosshairShape(ctx, cx, cy, c, isOutline) {
    const size = c.size;
    const gap = c.gap;
    const dotPad = isOutline ? 1 : 0;

    if (c.style === "dot") {
      // Jen tecka
      const r = Math.max(1, c.thickness);
      ctx.beginPath();
      ctx.arc(cx, cy, r + dotPad, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (c.style === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.stroke();
      if (c.dot) {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, c.thickness) + dotPad, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // CROSS nebo T-SHAPE
    // Pro outline rozsirujeme cary o pixel na kazdou stranu
    const off = isOutline ? 1 : 0;

    // Horni
    if (c.style !== "t-shape") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - gap - off);
      ctx.lineTo(cx, cy - gap - size - off);
      ctx.stroke();
    }
    // Dolni
    ctx.beginPath();
    ctx.moveTo(cx, cy + gap + off);
    ctx.lineTo(cx, cy + gap + size + off);
    ctx.stroke();
    // Leva
    ctx.beginPath();
    ctx.moveTo(cx - gap - off, cy);
    ctx.lineTo(cx - gap - size - off, cy);
    ctx.stroke();
    // Prava
    ctx.beginPath();
    ctx.moveTo(cx + gap + off, cy);
    ctx.lineTo(cx + gap + size + off, cy);
    ctx.stroke();

    if (c.dot) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, c.thickness) + dotPad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrosshairPreview() {
    chCtx.clearRect(0, 0, chCanvas.width, chCanvas.height);
    // Pozadi - tmavé s mírnym textur ax to vypadá jako herni scena
    chCtx.fillStyle = "#1a2840";
    chCtx.fillRect(0, 0, chCanvas.width, chCanvas.height);
    // Jemne pruhy
    chCtx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < 6; i++) {
      chCtx.fillRect(0, i * 40, chCanvas.width, 20);
    }
    if (settings.crosshair.enabled === false) {
      // Misto crosshairu zobraz "DISABLED"
      chCtx.fillStyle = "#5a6a90";
      chCtx.font = "bold 16px Segoe UI";
      chCtx.textAlign = "center";
      chCtx.textBaseline = "middle";
      chCtx.fillText("CROSSHAIR DISABLED", chCanvas.width / 2, chCanvas.height / 2);
      return;
    }
    // Crosshair uprostred
    drawCrosshair(chCtx, chCanvas.width / 2, chCanvas.height / 2);
  }

  // ---------- KONZOLE (jako CS) ----------
  const consoleEl = document.getElementById("console");
  const consoleLog = document.getElementById("console-log");
  const consoleInput = document.getElementById("console-input");
  let isConsoleOpen = false;
  const consoleHistory = [];
  let consoleHistoryIdx = -1;

  function openConsole() {
    isConsoleOpen = true;
    consoleEl.classList.add("active");
    consoleInput.value = "";
    consoleInput.focus();
    // Vypni hru
    input.left = false; input.right = false;
    input.jump = false; input.shoot = false;
    consoleHistoryIdx = -1;
    // Pri prvnim otevreni vypis hint
    if (!consoleLog.children.length) {
      appendConsoleLine("Console opened. Type 'help' for commands.", "info");
    }
  }

  function closeConsole() {
    isConsoleOpen = false;
    consoleEl.classList.remove("active");
    consoleInput.blur();
  }

  function appendConsoleLine(text, type) {
    const line = document.createElement("div");
    line.className = "console-line " + (type || "");
    line.textContent = text;
    consoleLog.appendChild(line);
    consoleLog.scrollTop = consoleLog.scrollHeight;
    while (consoleLog.children.length > 200) {
      consoleLog.removeChild(consoleLog.firstChild);
    }
  }

  function executeConsoleCommand(cmd) {
    cmd = cmd.trim();
    if (!cmd) return;
    consoleHistory.push(cmd);
    if (consoleHistory.length > 50) consoleHistory.shift();
    appendConsoleLine("> " + cmd, "cmd");

    // Klientske prikazy
    if (cmd === "clear") {
      consoleLog.innerHTML = "";
      return;
    }
    if (cmd === "close" || cmd === "quit") {
      closeConsole();
      return;
    }

    // Vsechno ostatni posli na server
    socket.emit("console", { cmd });
  }

  consoleInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      executeConsoleCommand(consoleInput.value);
      consoleInput.value = "";
      consoleHistoryIdx = -1;
    } else if (e.key === "Escape" || actionForKey(e.key) === "console") {
      closeConsole();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      if (consoleHistory.length === 0) return;
      if (consoleHistoryIdx === -1) consoleHistoryIdx = consoleHistory.length - 1;
      else if (consoleHistoryIdx > 0) consoleHistoryIdx--;
      consoleInput.value = consoleHistory[consoleHistoryIdx] || "";
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (consoleHistoryIdx === -1) return;
      if (consoleHistoryIdx < consoleHistory.length - 1) {
        consoleHistoryIdx++;
        consoleInput.value = consoleHistory[consoleHistoryIdx];
      } else {
        consoleHistoryIdx = -1;
        consoleInput.value = "";
      }
      e.preventDefault();
    }
  });
  consoleInput.addEventListener("keyup", (e) => e.stopPropagation());

  socket.on("console", (msg) => {
    appendConsoleLine(msg.text, msg.type || "info");
  });

  // Ping response - server posila request, my hned odpovime
  socket.on("ping_request", (data) => {
    socket.emit("ping_response", { t: data?.t || Date.now() });
  });

  // ---------- CHAT ----------
  const lobbyChatLog = document.getElementById("lobby-chat-log");
  const lobbyChatInput = document.getElementById("lobby-chat-input");
  const lobbyChatSend = document.getElementById("lobby-chat-send");
  const gameChatLog = document.getElementById("game-chat-log");
  const gameChatInputWrap = document.getElementById("game-chat-input-wrap");
  const gameChatInput = document.getElementById("game-chat-input");

  let isChatOpen = false; // true = in-game chat input je aktivni, klavesy jdou do chatu

  function sendChatMessage(text) {
    text = (text || "").trim();
    if (!text) return;
    socket.emit("chat", { text });
  }

  function openGameChat() {
    isChatOpen = true;
    gameChatInputWrap.classList.add("active");
    gameChatInput.value = "";
    gameChatInput.focus();
    // Vypni vsechny inputy ve hre, ax neumre nahodou
    input.left = false; input.right = false;
    input.jump = false; input.shoot = false;
  }

  function closeGameChat() {
    isChatOpen = false;
    gameChatInputWrap.classList.remove("active");
    gameChatInput.blur();
  }

  // Lobby chat - posilani
  lobbyChatSend.onclick = () => {
    sendChatMessage(lobbyChatInput.value);
    lobbyChatInput.value = "";
  };
  lobbyChatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendChatMessage(lobbyChatInput.value);
      lobbyChatInput.value = "";
    }
  });

  // In-game chat - posilani
  gameChatInput.addEventListener("keydown", (e) => {
    e.stopPropagation(); // ax to nezachyti globalni keydown
    if (e.key === "Enter") {
      sendChatMessage(gameChatInput.value);
      gameChatInput.value = "";
      closeGameChat();
    } else if (e.key === "Escape") {
      closeGameChat();
    }
  });
  gameChatInput.addEventListener("keyup", (e) => e.stopPropagation());

  // Prijem chat zprav od serveru
  socket.on("chat", (msg) => {
    appendChatMessage(msg);
  });

  function appendChatMessage(msg) {
    const adminBadge = msg.isAdmin ? '<span class="chat-admin">[A]</span> ' : (msg.isTester ? '<span class="chat-tester">[T]</span> ' : '');
    const nameColor = msg.isAdmin ? "#ffd700" : (msg.isTester ? "#54e0ff" : msg.color);

    // Lobby log
    const lobbyRow = document.createElement("div");
    lobbyRow.className = "chat-msg" + (msg.id === "system" ? " system" : "");
    lobbyRow.innerHTML =
      adminBadge +
      `<span class="chat-name" style="color:${nameColor}">${escapeHtml(msg.name)}:</span>` +
      `<span class="chat-text">${escapeHtml(msg.text)}</span>`;
    lobbyChatLog.appendChild(lobbyRow);
    lobbyChatLog.scrollTop = lobbyChatLog.scrollHeight;
    // Limit pocet zprav v lobby logu
    while (lobbyChatLog.children.length > 50) {
      lobbyChatLog.removeChild(lobbyChatLog.firstChild);
    }

    // In-game log (zprava zmizi po 6 sekundach)
    const gameRow = document.createElement("div");
    gameRow.className = "game-chat-msg";
    gameRow.innerHTML =
      adminBadge +
      `<span class="chat-name" style="color:${nameColor}">${escapeHtml(msg.name)}:</span>` +
      `<span class="chat-text">${escapeHtml(msg.text)}</span>`;
    gameChatLog.appendChild(gameRow);
    while (gameChatLog.children.length > 6) {
      gameChatLog.removeChild(gameChatLog.firstChild);
    }
    setTimeout(() => {
      gameRow.classList.add("fading");
      setTimeout(() => gameRow.remove(), 1000);
    }, 6000);
  }

  // Pri zmene mistnosti vycisti chat
  function clearChatLogs() {
    lobbyChatLog.innerHTML = "";
    gameChatLog.innerHTML = "";
  }

  // ---------- INPUT ----------
  const input = {
    left: false, right: false, jump: false, shoot: false,
    aimX: 1, aimY: 0, switch: null,
  };
  let mouseX = -1, mouseY = -1;

  // ---------- SETTINGS (keybinds + crosshair) ----------
  const DEFAULT_KEYBINDS = {
    left: "a",
    right: "d",
    jump: "w",
    chat: "z",
    console: "`",
  };
  const DEFAULT_CROSSHAIR = {
    enabled: true,          // crosshair viditelny
    style: "cross",         // cross | dot | circle | t-shape
    color: "#00ff00",
    size: 8,
    gap: 4,
    thickness: 2,
    dot: false,
    outline: true,
    outlineOpacity: 80,
  };

  const settings = {
    keybinds: { ...DEFAULT_KEYBINDS },
    crosshair: { ...DEFAULT_CROSSHAIR },
  };

  function loadSettings() {
    try {
      const kb = JSON.parse(localStorage.getItem("kf_keybinds") || "{}");
      settings.keybinds = { ...DEFAULT_KEYBINDS, ...kb };
    } catch (e) {}
    try {
      const ch = JSON.parse(localStorage.getItem("kf_crosshair") || "{}");
      settings.crosshair = { ...DEFAULT_CROSSHAIR, ...ch };
    } catch (e) {}
  }
  function saveKeybinds() {
    localStorage.setItem("kf_keybinds", JSON.stringify(settings.keybinds));
  }
  function saveCrosshair() {
    localStorage.setItem("kf_crosshair", JSON.stringify(settings.crosshair));
    updateCanvasCursor();
  }
  function updateCanvasCursor() {
    const c = document.getElementById("canvas");
    if (!c) return;
    // Pokud crosshair vypnuty, ukaz default kurzor; jinak schovej (kreslime vlastni)
    c.style.cursor = settings.crosshair.enabled === false ? "default" : "none";
  }
  loadSettings();
  updateCanvasCursor();

  // Vraci akci (jeden z DEFAULT_KEYBINDS klicu) podle stiskle klavesy
  function actionForKey(key) {
    const lower = (key || "").toLowerCase();
    for (const action in settings.keybinds) {
      if (settings.keybinds[action] === lower) return action;
    }
    return null;
  }

  document.addEventListener("keydown", (e) => {
    // Pokud je konzole nebo chat otevreny, klavesy nezpracovavej
    if (isConsoleOpen || isChatOpen) return;
    // Pokud je settings modal otevreny (a poslouchame klavesu pro keybind), nereaguj
    if (isListeningForKey) return;
    // Pokud je focus v input/textarea, nereaguj (uzivatel pise text)
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    // Tab - rozsireny scoreboard (drz pro zobrazeni)
    if (e.key === "Tab" && screens.game.classList.contains("active")) {
      e.preventDefault();
      showTabScoreboard();
      return;
    }

    const action = actionForKey(e.key);

    // Konzole
    if (action === "console" || e.key === "`" || e.key === "~") {
      openConsole();
      e.preventDefault();
      return;
    }

    // Chat (jen ve hre)
    if (action === "chat" && screens.game.classList.contains("active")) {
      openGameChat();
      e.preventDefault();
      return;
    }

    if (action === "left" || action === "right" || action === "jump") {
      input[action] = true;
      e.preventDefault();
    }

    // Specialni: Space a sipky vzdy fungujou jako alternativy (nelze prebindovat)
    if (e.key === " " || e.key === "ArrowUp") {
      input.jump = true;
      e.preventDefault();
    }
    if (e.key === "ArrowLeft") { input.left = true; e.preventDefault(); }
    if (e.key === "ArrowRight") { input.right = true; e.preventDefault(); }

    // Zbrane se nedaji prepinat - dostanes je z pickupu
  });

  document.addEventListener("keyup", (e) => {
    if (isConsoleOpen || isChatOpen) return;
    if (isListeningForKey) return;
    // Pokud je focus v input/textarea, nereaguj
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    // Tab pusten - schovej scoreboard
    if (e.key === "Tab") {
      e.preventDefault();
      hideTabScoreboard();
      return;
    }

    const action = actionForKey(e.key);
    if (action === "left" || action === "right" || action === "jump") {
      input[action] = false;
      e.preventDefault();
    }
    if (e.key === " " || e.key === "ArrowUp") { input.jump = false; e.preventDefault(); }
    if (e.key === "ArrowLeft") { input.left = false; e.preventDefault(); }
    if (e.key === "ArrowRight") { input.right = false; e.preventDefault(); }
  });

  // ---------- MOBILNI / DOTYKOVE OVLADANI ----------
  const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    document.body.classList.add("has-touch");
  }

  // ---------- AIM JOYSTICK (prava strana - mireni a strelba) ----------
  const aimJoy = {
    active: false,
    aimX: 1,
    aimY: 0,
    activeTouchId: null,
  };
  const aimJoyEl = document.getElementById("aim-joystick");
  const aimJoyStickEl = document.getElementById("aim-joystick-stick");

  function getTouchById(touches, id) {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  }

  function aimJoyStart(e) {
    e.preventDefault();
    e.stopPropagation();
    if (aimJoy.active) return;
    aimJoy.active = true;
    if (e.touches && e.changedTouches && e.changedTouches.length) {
      aimJoy.activeTouchId = e.changedTouches[0].identifier;
    } else {
      aimJoy.activeTouchId = null;
    }
    aimJoyEl.classList.add("active");
    input.shoot = true;
    aimJoyMove(e);
  }
  function aimJoyMove(e) {
    if (!aimJoy.active) return;
    e.preventDefault();
    let touch;
    if (e.touches) {
      touch = aimJoy.activeTouchId !== null
        ? getTouchById(e.touches, aimJoy.activeTouchId)
        : e.touches[0];
      if (!touch) return;
    } else {
      touch = e;
    }
    const rect = aimJoyEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    aimJoy.aimX = dx / dist;
    aimJoy.aimY = dy / dist;
    const maxR = rect.width / 2 - 20;
    const useDist = Math.min(dist, maxR);
    const sx = (dx / dist) * useDist;
    const sy = (dy / dist) * useDist;
    aimJoyStickEl.style.transform = `translate(${sx}px, ${sy}px)`;
  }
  function aimJoyEnd(e) {
    if (!aimJoy.active) return;
    // Pokud je touchend a aktivni dotyk skoncil, zavri
    if (e.changedTouches && aimJoy.activeTouchId !== null) {
      let foundActive = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === aimJoy.activeTouchId) {
          foundActive = true;
          break;
        }
      }
      if (!foundActive) return;
    }
    e.preventDefault();
    aimJoy.active = false;
    aimJoy.activeTouchId = null;
    aimJoyEl.classList.remove("active");
    input.shoot = false;
    aimJoyStickEl.style.transform = "translate(0, 0)";
  }

  aimJoyEl.addEventListener("touchstart", aimJoyStart, { passive: false });
  aimJoyEl.addEventListener("touchmove", aimJoyMove, { passive: false });
  aimJoyEl.addEventListener("touchend", aimJoyEnd, { passive: false });
  aimJoyEl.addEventListener("touchcancel", aimJoyEnd, { passive: false });
  // Pro desktop testovani taky mys
  aimJoyEl.addEventListener("mousedown", aimJoyStart);
  document.addEventListener("mousemove", (e) => { if (aimJoy.active && !e.touches) aimJoyMove(e); });
  document.addEventListener("mouseup", (e) => { if (aimJoy.active && !e.touches) aimJoyEnd(e); });

  // Zachovani zpetne kompatibility - stary nazev
  const joystick = aimJoy;

  // ---------- POHYBOVY JOYSTICK (leva strana - pohyb) ----------
  const moveJoy = {
    active: false,
    activeTouchId: null,
  };
  const moveJoyEl = document.getElementById("move-joystick");
  const moveJoyStickEl = document.getElementById("move-joystick-stick");

  function moveJoyStart(e) {
    e.preventDefault();
    e.stopPropagation();
    if (moveJoy.active) return;
    moveJoy.active = true;
    if (e.touches && e.changedTouches && e.changedTouches.length) {
      moveJoy.activeTouchId = e.changedTouches[0].identifier;
    } else {
      moveJoy.activeTouchId = null;
    }
    moveJoyEl.classList.add("active");
    moveJoyMove(e);
  }
  function moveJoyMove(e) {
    if (!moveJoy.active) return;
    e.preventDefault();
    let touch;
    if (e.touches) {
      touch = moveJoy.activeTouchId !== null
        ? getTouchById(e.touches, moveJoy.activeTouchId)
        : e.touches[0];
      if (!touch) return;
    } else {
      touch = e;
    }
    const rect = moveJoyEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;

    // Mrtva zona uprostred (ignore mali pohyby)
    const deadZone = 12;
    if (dist < deadZone) {
      input.left = false;
      input.right = false;
    } else {
      // Pohyb podle X osy
      input.left = dx < -deadZone * 0.5;
      input.right = dx > deadZone * 0.5;
    }

    // Skok: kdyz taha vyrazne nahoru (dy zaporne, vetsi nez X) - edge triggered
    // pro double jump musi pustit a pretazit nahoru znovu
    const jumpThreshold = 30;
    const wantsJump = dy < -jumpThreshold && Math.abs(dy) > Math.abs(dx) * 0.6;
    if (wantsJump && !moveJoy.lastUpState) {
      input.jump = true;
      moveJoy.lastUpState = true;
    } else if (!wantsJump) {
      input.jump = false;
      moveJoy.lastUpState = false;
    }

    // Vizualni stick
    const maxR = rect.width / 2 - 18;
    const useDist = Math.min(dist, maxR);
    const sx = (dx / dist) * useDist;
    const sy = (dy / dist) * useDist;
    moveJoyStickEl.style.transform = `translate(${sx}px, ${sy}px)`;
  }
  function moveJoyEnd(e) {
    if (!moveJoy.active) return;
    if (e.changedTouches && moveJoy.activeTouchId !== null) {
      let foundActive = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === moveJoy.activeTouchId) {
          foundActive = true;
          break;
        }
      }
      if (!foundActive) return;
    }
    e.preventDefault();
    moveJoy.active = false;
    moveJoy.activeTouchId = null;
    moveJoy.lastUpState = false;
    moveJoyEl.classList.remove("active");
    input.left = false;
    input.right = false;
    input.jump = false;
    moveJoyStickEl.style.transform = "translate(0, 0)";
  }

  if (moveJoyEl) {
    moveJoyEl.addEventListener("touchstart", moveJoyStart, { passive: false });
    moveJoyEl.addEventListener("touchmove", moveJoyMove, { passive: false });
    moveJoyEl.addEventListener("touchend", moveJoyEnd, { passive: false });
    moveJoyEl.addEventListener("touchcancel", moveJoyEnd, { passive: false });
    moveJoyEl.addEventListener("mousedown", moveJoyStart);
    document.addEventListener("mousemove", (e) => { if (moveJoy.active && !e.touches) moveJoyMove(e); });
    document.addEventListener("mouseup", (e) => { if (moveJoy.active && !e.touches) moveJoyEnd(e); });
  }

  // Tlacitka pohybu (left, right, jump)
  document.querySelectorAll(".mbtn[data-action]").forEach((btn) => {
    const action = btn.getAttribute("data-action");
    const press = (e) => {
      e.preventDefault();
      input[action] = true;
      btn.classList.add("pressed");
    };
    const release = (e) => {
      e.preventDefault();
      input[action] = false;
      btn.classList.remove("pressed");
    };
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    // Pro desktop debug
    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
  });

  // Vrchni tlacitka - chat a scoreboard
  const mbtnTab = document.getElementById("mbtn-tab");
  if (mbtnTab) {
    mbtnTab.addEventListener("touchstart", (e) => { e.preventDefault(); showTabScoreboard(); }, { passive: false });
    mbtnTab.addEventListener("touchend", (e) => { e.preventDefault(); hideTabScoreboard(); }, { passive: false });
    mbtnTab.addEventListener("mousedown", (e) => { e.preventDefault(); showTabScoreboard(); });
    mbtnTab.addEventListener("mouseup", (e) => { e.preventDefault(); hideTabScoreboard(); });
  }
  const mbtnChat = document.getElementById("mbtn-chat");
  if (mbtnChat) {
    mbtnChat.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof openGameChat === "function") openGameChat();
    });
  }

  // ---------- FULLSCREEN ----------
  function isFullscreenActive() {
    return !!(document.fullscreenElement ||
              document.webkitFullscreenElement ||
              document.mozFullScreenElement ||
              document.msFullscreenElement);
  }
  // Detekce iOS (Safari/Chrome na iOS - vsechny pouzivaji WebKit a NEPODPORUJI Fullscreen API)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Standalone mode = uz pridano na home screen, hra bezi fullscreen
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                       window.navigator.standalone === true;

  function requestFullscreen() {
    // iOS - Fullscreen API neexistuje; ukaz instrukce na "Add to Home Screen"
    if (isIOS && !isStandalone) {
      showIOSFullscreenHelp();
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen ||
                el.webkitRequestFullscreen ||
                el.mozRequestFullScreen ||
                el.msRequestFullscreen;
    if (req) req.call(el).catch(() => {});

    // Pokus o lock orientace na landscape (jen pokud telefon)
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
  }

  function showIOSFullscreenHelp() {
    // Vytvor modal pokud neexistuje
    let m = document.getElementById("ios-fs-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "ios-fs-modal";
      m.className = "modal-overlay";
      m.innerHTML = `
        <div class="modal-card" style="max-width:420px">
          <div class="modal-header">
            <h2>FULLSCREEN ON iPHONE</h2>
            <button class="btn-icon" id="ios-fs-close">X</button>
          </div>
          <div class="modal-body">
            <p style="color:#94a3c4;font-size:13px;line-height:1.6">
              Safari on iPhone does not allow fullscreen mode for websites.
              To play in fullscreen, add KnockFriend to your Home Screen:
            </p>
            <ol style="color:#fff;font-size:13px;line-height:1.8;padding-left:20px">
              <li>Tap the <b>Share</b> button at the bottom of Safari</li>
              <li>Scroll down and tap <b>Add to Home Screen</b></li>
              <li>Tap <b>Add</b></li>
              <li>Open the new icon from your Home Screen — it will run fullscreen!</li>
            </ol>
            <p style="color:#5a6a90;font-size:11px;margin-top:14px">
              Note: This works only in Safari, not Chrome/Firefox on iOS.
            </p>
          </div>
        </div>
      `;
      document.body.appendChild(m);
      m.querySelector("#ios-fs-close").onclick = () => m.classList.remove("active");
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.remove("active");
      });
    }
    m.classList.add("active");
  }

  function exitFullscreen() {
    const exit = document.exitFullscreen ||
                 document.webkitExitFullscreen ||
                 document.mozCancelFullScreen ||
                 document.msExitFullscreen;
    if (exit) exit.call(document).catch(() => {});
  }
  function toggleFullscreen() {
    if (isFullscreenActive()) exitFullscreen();
    else requestFullscreen();
  }

  const mbtnFullscreen = document.getElementById("mbtn-fullscreen");
  if (mbtnFullscreen) {
    const fsHandler = (e) => {
      e.preventDefault();
      toggleFullscreen();
      // Aktualizuj ikonku
      mbtnFullscreen.textContent = isFullscreenActive() ? "⛶" : "⛶";
    };
    mbtnFullscreen.addEventListener("click", fsHandler);
    mbtnFullscreen.addEventListener("touchend", fsHandler, { passive: false });
  }

  // Klavesa F = fullscreen toggle (PC)
  document.addEventListener("keydown", (e) => {
    if (isConsoleOpen || isChatOpen || isListeningForKey) return;
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.key === "F11" || (e.key === "f" && e.ctrlKey)) {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // ---------- ROTATION HINT ----------
  function updateOrientationHint() {
    if (!isTouchDevice) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    const isInGame = screens.game.classList.contains("active");
    const dismissed = sessionStorage.getItem("kf_rotate_dismissed") === "1";

    if (isPortrait && isInGame && !dismissed) {
      document.body.classList.add("portrait-warning");
    } else {
      document.body.classList.remove("portrait-warning");
    }
  }
  const rotateDismiss = document.getElementById("rotate-dismiss");
  if (rotateDismiss) {
    rotateDismiss.addEventListener("click", () => {
      sessionStorage.setItem("kf_rotate_dismissed", "1");
      document.body.classList.remove("portrait-warning");
    });
  }
  window.addEventListener("resize", updateOrientationHint);
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      updateOrientationHint();
      // Pri zmene orientace prepocti canvas
      if (typeof resizeCanvas === "function") resizeCanvas();
    }, 200);
  });

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  canvas.addEventListener("mousemove", (e) => {
    if (isTouchDevice) return; // mobile pouziva joystick, ne mys
    const rect = canvas.getBoundingClientRect();
    // CSS souradnice (canvas se renderuje s setTransform(dpr) takze pouzivame CSS pixely)
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (isTouchDevice) return;
    if (e.button === 0) input.shoot = true;
  });
  canvas.addEventListener("mouseup", (e) => {
    if (isTouchDevice) return;
    if (e.button === 0) input.shoot = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mouseleave", () => {
    if (isTouchDevice) return;
    input.shoot = false;
    mouseX = -1; mouseY = -1; // schova crosshair
  });

  setInterval(() => {
    if (!SHARED) return;
    if (!screens.game.classList.contains("active")) return;
    const self = getInterpolatedSelf();
    let aimX = 1, aimY = 0;

    if (aimJoy.active) {
      // Mobilni joystick aktivni
      aimX = aimJoy.aimX;
      aimY = aimJoy.aimY;
    } else if (isTouchDevice) {
      // Mobil - joystick neaktivni, pouzij posledni smer (zbran zustane otocena)
      aimX = aimJoy.aimX;
      aimY = aimJoy.aimY;
    } else if (self && mouseX >= 0) {
      // PC - aim podle pozice mysi
      const cam = computeCamera();
      const sx = (self.x + SHARED.PLAYER.WIDTH / 2 - cam.x) * cam.scale;
      const sy = (self.y + SHARED.PLAYER.HEIGHT * 0.4 - cam.y) * cam.scale;
      aimX = mouseX - sx;
      aimY = mouseY - sy;
      const m = Math.hypot(aimX, aimY) || 1;
      aimX /= m; aimY /= m;
    }
    socket.emit("input", {
      left: input.left, right: input.right, jump: input.jump,
      shoot: input.shoot, aimX, aimY, switch: input.switch,
    });
    input.switch = null;
  }, 1000 / 60);

  // ---------- SNAPSHOTS / INTERPOLATION ----------
  socket.on("state", (snap) => {
    snap.recvAt = performance.now();
    snapshots.push(snap);
    while (snapshots.length > 120) snapshots.shift();

    if (screens.lobby.classList.contains("active")) {
      if (snap.phase !== "lobby" && !userPreferLobby) {
        // Prechod lobby -> hra: vycisti stare particles
        particles.length = 0;
        showScreen("game");
        resizeCanvas();
        if (typeof updateOrientationHint === "function") updateOrientationHint();
      }
    }
    // Server hlasi lobby phase - resetuj klientsky stav bez ohledu na screen
    // (i kdyby uzivatel byl pres "Back to Lobby" tlacitko v menu)
    if (snap.phase === "lobby") {
      // Pokud je hrac na game screenu, prepni do lobby
      if (screens.game.classList.contains("active")) {
        snapshots.length = 0;
        snapshots.push(snap);
        particles.length = 0;
        showScreen("lobby");
      }
      // Resetuj ready stav (server uz me odready'l)
      if (isReady) {
        isReady = false;
        const btn = document.getElementById("btn-ready");
        if (btn) {
          btn.textContent = "Ready";
          btn.classList.remove("ready");
        }
      }
    }

    handleEvents(snap);
  });

  function getInterpolatedState() {
    if (!snapshots.length) return null;
    const renderTime = performance.now() - SNAPSHOT_BUFFER_MS;
    let a = null, b = null;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].recvAt <= renderTime) {
        a = snapshots[i];
        b = snapshots[i + 1] || a;
        break;
      }
    }
    if (!a) {
      a = snapshots[0];
      b = snapshots[Math.min(1, snapshots.length - 1)];
    }
    if (a === b) return cloneSnapshot(a);
    const span = b.recvAt - a.recvAt || 1;
    const t = clamp((renderTime - a.recvAt) / span, 0, 1);
    return interpolateSnapshots(a, b, t);
  }

  function getInterpolatedSelf() {
    if (!snapshots.length) return null;
    const last = snapshots[snapshots.length - 1];
    return last.players.find((p) => p.id === selfId);
  }

  function cloneSnapshot(s) {
    // Pouze players a bullets se interpoluji (mutuji)
    // Ostatni pole (pickups, platforms) staci shallow reference
    return {
      tick: s.tick,
      time: s.time,
      phase: s.phase,
      phaseTimer: s.phaseTimer,
      roundNumber: s.roundNumber,
      lastWinner: s.lastWinner,
      matchWinner: s.matchWinner,
      mapKey: s.mapKey,
      events: s.events,
      pickups: s.pickups,
      platforms: s.platforms,
      players: s.players.map((p) => ({ ...p })),
      bullets: s.bullets.map((b) => ({ ...b })),
    };
  }

  function interpolateSnapshots(a, b, t) {
    const result = cloneSnapshot(b);
    for (const pa of a.players) {
      const pb = result.players.find((p) => p.id === pa.id);
      if (!pb) continue;
      pb.x = lerp(pa.x, pb.x, t);
      pb.y = lerp(pa.y, pb.y, t);
    }
    for (const ba of a.bullets) {
      const bb = result.bullets.find((b) => b.id === ba.id);
      if (!bb) continue;
      bb.x = lerp(ba.x, bb.x, t);
      bb.y = lerp(ba.y, bb.y, t);
    }
    return result;
  }

  // ---------- EVENTS / PARTICLES ----------
  const particles = [];
  const MAX_PARTICLES = 600;
  let shakeAmount = 0;
  let shakeDecay = 0;
  let lastTickProcessed = -1;

  function addParticle(p) {
    // Pokud je particles array plne, zahod nejstarsi
    if (particles.length >= MAX_PARTICLES) {
      particles.shift();
    }
    particles.push(p);
  }

  function handleEvents(snap) {
    if (lastTickProcessed === snap.tick) return;
    lastTickProcessed = snap.tick;

    for (const ev of snap.events || []) {
      if (ev.type === "muzzle") {
        spawnMuzzle(ev.x, ev.y, ev.dx, ev.dy, ev.weapon);
        if (ev.shooterId === selfId) addShake(2);
      } else if (ev.type === "hit") {
        spawnHit(ev.x, ev.y, ev.weapon);
        if (ev.victimId === selfId) addShake(6);
      } else if (ev.type === "spark") {
        spawnSpark(ev.x, ev.y, ev.weapon);
      } else if (ev.type === "explosion") {
        spawnExplosion(ev.x, ev.y, ev.radius);
        addShake(14);
      } else if (ev.type === "death") {
        addKillFeed(ev);
        if (ev.victimId === selfId) addShake(20);
      } else if (ev.type === "platform_destroyed") {
        spawnRubble(ev.x, ev.y);
        addShake(6);
      } else if (ev.type === "pickup") {
        spawnPickupBurst(ev.x, ev.y);
      }
    }
  }

  function addShake(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
    shakeDecay = 0.85;
  }

  function spawnMuzzle(x, y, dx, dy, weapon) {
    const w = SHARED.WEAPONS[weapon];
    const color = w?.color || "#fff";
    for (let i = 0; i < 6; i++) {
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
      const sp = 200 + Math.random() * 200;
      addParticle({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.18, maxLife: 0.18,
        size: 4 + Math.random() * 3,
        color, kind: "spark",
      });
    }
    addParticle({
      x, y, vx: 0, vy: 0,
      life: 0.08, maxLife: 0.08,
      size: 22, color, kind: "flash",
    });
  }

  function spawnHit(x, y, weapon) {
    const w = SHARED.WEAPONS[weapon];
    const color = w?.color || "#ff5e5e";
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 350;
      addParticle({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 100,
        life: 0.4 + Math.random() * 0.3, maxLife: 0.6,
        size: 3 + Math.random() * 3,
        color: i % 2 === 0 ? "#ff5e5e" : color,
        kind: "blood", gravity: 600,
      });
    }
  }
  function spawnSpark(x, y, weapon) {
    const w = SHARED.WEAPONS[weapon];
    const color = w?.color || "#fff";
    for (let i = 0; i < 5; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 200;
      addParticle({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.3, maxLife: 0.3,
        size: 2 + Math.random() * 2,
        color, kind: "spark", gravity: 400,
      });
    }
  }
  function spawnExplosion(x, y, radius) {
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 600;
      const colors = ["#ffe66d", "#ff9f43", "#ff5e3d", "#fff"];
      addParticle({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: "ember", gravity: 200,
      });
    }
    addParticle({
      x, y, vx: 0, vy: 0,
      life: 0.4, maxLife: 0.4,
      size: 0, maxSize: radius,
      color: "#ffaa55", kind: "ring",
    });
  }
  function spawnRubble(x, y) {
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 250;
      addParticle({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 100,
        life: 0.6 + Math.random() * 0.3, maxLife: 0.9,
        size: 3 + Math.random() * 4,
        color: "#a08070", kind: "rubble", gravity: 800,
      });
    }
  }
  function spawnPickupBurst(x, y) {
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 200;
      addParticle({
        x: x + 14, y: y + 14,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.4, maxLife: 0.4,
        size: 3 + Math.random() * 2,
        color: "#54e0ff", kind: "spark",
      });
    }
  }

  // ---------- CAMERA + RENDER ----------
  // Vsechny render souradnice pouzivame v CSS pixelech (canvas je skalovany pres setTransform(dpr))
  function canvasCssWidth() { return window.innerWidth; }
  function canvasCssHeight() { return window.innerHeight; }

  function computeCamera() {
    const ww = SHARED.WORLD_WIDTH;
    const wh = SHARED.WORLD_HEIGHT;
    const cw = canvasCssWidth();
    const ch = canvasCssHeight();
    const sx = cw / ww;
    const sy = ch / wh;
    let scale = Math.min(sx, sy);

    // Na mobilu zoomneme blize - klasicky "fit-to-screen" je moc daleko
    // Faktor 1.7 = 70% blize. Pak ale musime sledovat hrace ze pouze nezacne videt vychodni okraj.
    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      scale *= 1.7;
    }

    // Standardni "fit" pozice (vystredovany svet)
    let x = (ww - cw / scale) / 2;
    let y = (wh - ch / scale) / 2;

    // Pokud kamera vidi vyrez mensi nez svet, sleduj hrace
    const visibleW = cw / scale;
    const visibleH = ch / scale;
    if (visibleW < ww || visibleH < wh) {
      // Sleduj sebe (nebo prostredek mapy pokud nemame self)
      const self = snapshots.length ? snapshots[snapshots.length - 1].players.find((p) => p.id === selfId) : null;
      if (self) {
        const PL = SHARED.PLAYER;
        const targetX = self.x + PL.WIDTH / 2 - visibleW / 2;
        const targetY = self.y + PL.HEIGHT / 2 - visibleH / 2;
        // Smooth follow s clamp na hranice mapy
        x = Math.max(0, Math.min(ww - visibleW, targetX));
        y = Math.max(0, Math.min(wh - visibleH, targetY));
      }
    }

    return { x, y, scale };
  }

  function resizeCanvas() {
    // Pro ostry render na HiDPI obrazovkach (Retina, mobil) skalujeme canvas pixely
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limit 2 abychom neztratili FPS na 3x DPI
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    // Vsechny render operace skalujeme aby pouzivaly CSS pixely
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  // Pri zmene orientace pockaame chvili a pak pretvorime
  window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 200);
  });

  let lastFrame = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!SHARED || !screens.game.classList.contains("active")) return;
    const state = getInterpolatedState();
    if (!state) return;

    updateParticles(dt);

    if (shakeAmount > 0) {
      shakeAmount *= shakeDecay;
      if (shakeAmount < 0.5) shakeAmount = 0;
    }

    render(state);
    updateHud(state);
  }
  requestAnimationFrame(frame);

  function updateParticles(dt) {
    // In-place filter (rychlejsi nez splice v cyklu)
    let writeIdx = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind !== "ring" && p.kind !== "flash") {
        if (p.gravity) p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      particles[writeIdx++] = p;
    }
    particles.length = writeIdx;
  }

  function render(state) {
    const cam = computeCamera();
    const map = SHARED.MAPS[state.mapKey];
    const cw = canvasCssWidth();
    const ch = canvasCssHeight();

    ctx.fillStyle = map?.bg || "#1a2840";
    ctx.fillRect(0, 0, cw, ch);

    const sx = (Math.random() - 0.5) * shakeAmount;
    const sy = (Math.random() - 0.5) * shakeAmount;

    ctx.save();
    ctx.translate(-cam.x * cam.scale + sx, -cam.y * cam.scale + sy);
    ctx.scale(cam.scale, cam.scale);

    drawBackground(map);

    for (let i = 0; i < map.platforms.length; i++) {
      const def = map.platforms[i];
      const live = state.platforms[i];
      if (live && live.destroyed) continue;
      drawPlatform(def, live);
    }

    for (const pu of state.pickups) drawPickup(pu);
    for (const p of state.players) drawPlayer(p);
    for (const b of state.bullets) drawBullet(b);
    drawParticles();
    drawDeathZone();

    ctx.restore();

    // Vlastni crosshair - kreslime v screen coords (po ctx.restore)
    if (mouseX >= 0 && mouseY >= 0 &&
        mouseX <= cw && mouseY <= ch) {
      drawCrosshair(ctx, mouseX, mouseY);
    } else if (aimJoy && aimJoy.active && SHARED) {
      // Mobile: kdyz mirime joystickem, kresli crosshair pred postavou
      const self = state.players.find((p) => p.id === selfId);
      if (self && self.alive) {
        const cam = computeCamera();
        // Pozice postavy ve screen coords
        const psx = (self.x + SHARED.PLAYER.WIDTH / 2 - cam.x) * cam.scale;
        const psy = (self.y + SHARED.PLAYER.HEIGHT * 0.4 - cam.y) * cam.scale;
        // Crosshair v dali ve smeru mireni
        const dist = 200; // vzdalenost crosshairu od postavy
        const cx = psx + aimJoy.aimX * dist;
        const cy = psy + aimJoy.aimY * dist;
        drawCrosshair(ctx, cx, cy);
      }
    }

    // Minimapa (jen mobil)
    drawMinimap(state);
  }

  // ---------- MINIMAPA (mobile only) ----------
  const minimapEl = document.getElementById("minimap");
  const minimapCtx = minimapEl ? minimapEl.getContext("2d") : null;

  function drawMinimap(state) {
    if (!minimapEl || !minimapCtx) return;
    if (!isTouchDevice) return; // jen mobil

    const ww = SHARED.WORLD_WIDTH;
    const wh = SHARED.WORLD_HEIGHT;
    const mw = minimapEl.width;
    const mh = minimapEl.height;
    const sx = mw / ww;
    const sy = mh / wh;

    // Pozadi
    minimapCtx.clearRect(0, 0, mw, mh);
    minimapCtx.fillStyle = "rgba(20, 30, 60, 0.6)";
    minimapCtx.fillRect(0, 0, mw, mh);

    // Platformy
    const map = SHARED.MAPS[state.mapKey];
    if (map) {
      for (let i = 0; i < map.platforms.length; i++) {
        const plat = map.platforms[i];
        const live = state.platforms[i];
        if (live && live.destroyed) continue;
        minimapCtx.fillStyle = "#3a4a6a";
        minimapCtx.fillRect(plat.x * sx, plat.y * sy, plat.w * sx, Math.max(2, plat.h * sy));
      }
    }

    // Pickupy (zbrane na zemi)
    for (const pu of state.pickups) {
      minimapCtx.fillStyle = "#ffe66d";
      minimapCtx.fillRect(pu.x * sx - 1, pu.y * sy - 1, 3, 3);
    }

    // Hraci
    for (const p of state.players) {
      if (!p.alive) continue;
      const px = (p.x + SHARED.PLAYER.WIDTH / 2) * sx;
      const py = (p.y + SHARED.PLAYER.HEIGHT / 2) * sy;
      // Barva vetsi pro sebe, mensi pro ostatni
      const r = p.id === selfId ? 4 : 3;
      minimapCtx.fillStyle = p.color;
      minimapCtx.beginPath();
      minimapCtx.arc(px, py, r, 0, Math.PI * 2);
      minimapCtx.fill();
      // Ja - bily kruzek navíc
      if (p.id === selfId) {
        minimapCtx.strokeStyle = "#fff";
        minimapCtx.lineWidth = 1.5;
        minimapCtx.stroke();
      }
    }
  }

  function drawBackground(map) {
    ctx.save();
    ctx.fillStyle = map?.bgAccent || "#2a3a5a";
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 8; i++) {
      const y = i * 120;
      ctx.fillRect(0, y, SHARED.WORLD_WIDTH, 60);
    }
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, SHARED.PLAYER.DEATH_Y - 40, SHARED.WORLD_WIDTH, 200);
  }

  function drawPlatform(def, live) {
    const x = def.x, y = def.y, w = def.w, h = def.h;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 4, y + 6, w, h);

    const isDestructible = def.destructible;
    let baseColor = isDestructible ? "#7a5a3a" : "#3a4a70";
    let topColor = isDestructible ? "#a07a4a" : "#5a6a90";
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = topColor;
    ctx.fillRect(x, y, w, Math.min(6, h * 0.4));

    if (isDestructible && live && def.hp) {
      const ratio = clamp(live.hp / def.hp, 0, 1);
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 4, y - 8, w - 8, 4);
      ctx.fillStyle = ratio > 0.5 ? "#4ade80" : ratio > 0.25 ? "#facc15" : "#ef4444";
      ctx.fillRect(x + 4, y - 8, (w - 8) * ratio, 4);
    }
  }

  function drawPlayer(p) {
    const W = SHARED.PLAYER.WIDTH;
    const H = SHARED.PLAYER.HEIGHT;
    if (!p.alive) {
      ctx.save();
      ctx.globalAlpha = 0.35;
    }

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(p.x + W / 2, p.y + H + 4, W * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    roundRect(ctx, p.x, p.y, W, H, 8);
    ctx.fill();

    ctx.fillStyle = lighten(p.color, 0.18);
    roundRect(ctx, p.x + 4, p.y + 4, W - 8, H * 0.45, 6);
    ctx.fill();

    const eyeY = p.y + 18;
    const eyeBaseX = p.x + W / 2;
    const eyeOffset = p.facing > 0 ? 4 : -4;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(eyeBaseX - 6 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeBaseX + 6 + eyeOffset, eyeY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(eyeBaseX - 6 + eyeOffset + (p.facing > 0 ? 1 : -1), eyeY, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeBaseX + 6 + eyeOffset + (p.facing > 0 ? 1 : -1), eyeY, 2, 0, Math.PI * 2); ctx.fill();

    drawWeapon(p);

    ctx.save();
    ctx.font = "bold 13px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(p.x + W / 2 - 55, p.y - 22, 110, 16);
    ctx.fillStyle = p.isAdmin ? "#ffd700" : (p.isTester ? "#54e0ff" : p.color);
    const namePrefix = p.isAdmin ? "[A] " : (p.isTester ? "[T] " : "");
    ctx.fillText(namePrefix + p.name + (p.id === selfId ? " (YOU)" : ""), p.x + W / 2, p.y - 10);
    ctx.restore();

    const hpRatio = clamp(p.hp / SHARED.PLAYER.MAX_HEALTH, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(p.x - 4, p.y - 6, W + 8, 5);
    ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#facc15" : "#ef4444";
    ctx.fillRect(p.x - 4, p.y - 6, (W + 8) * hpRatio, 5);

    if (!p.alive) ctx.restore();

    if (p.id === selfId && p.alive) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(p.x - 2, p.y - 2, W + 4, H + 4);
      ctx.setLineDash([]);
    }
  }

  function drawWeapon(p) {
    if (!p.alive) return;
    const wepDef = SHARED.WEAPONS[p.weapon];
    if (!wepDef) return;
    const cx = p.x + SHARED.PLAYER.WIDTH / 2;
    const cy = p.y + SHARED.PLAYER.HEIGHT * 0.4;

    let aimX, aimY;
    if (p.id === selfId) {
      if (aimJoy.active) {
        // Mobil - joystick aktivni
        aimX = aimJoy.aimX;
        aimY = aimJoy.aimY;
      } else if (isTouchDevice) {
        // Mobil - joystick neni aktivni, pouzij posledni aim (ne facing!)
        // aimJoy.aimX/aimY se resetuji jen pri novem touch
        aimX = aimJoy.aimX;
        aimY = aimJoy.aimY;
      } else if (mouseX >= 0) {
        // PC - aim podle mysi
        const cam = computeCamera();
        const sx = (cx - cam.x) * cam.scale;
        const sy = (cy - cam.y) * cam.scale;
        aimX = mouseX - sx;
        aimY = mouseY - sy;
      } else {
        // Fallback - pouzij smer postavy
        aimX = p.facing;
        aimY = 0;
      }
    } else {
      aimX = p.facing;
      aimY = 0;
    }
    const m = Math.hypot(aimX, aimY) || 1;
    aimX /= m; aimY /= m;

    const ang = Math.atan2(aimY, aimX);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    if (p.weapon === "rocket") {
      ctx.fillStyle = "#444";
      ctx.fillRect(0, -7, 28, 14);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(24, -8, 6, 16);
    } else if (p.weapon === "shotgun") {
      ctx.fillStyle = "#5a4a3a";
      ctx.fillRect(0, -5, 26, 10);
      ctx.fillStyle = "#222";
      ctx.fillRect(20, -6, 8, 12);
    } else if (p.weapon === "laser") {
      ctx.fillStyle = "#1a3a4a";
      ctx.fillRect(0, -5, 28, 10);
      ctx.fillStyle = "#54e0ff";
      ctx.fillRect(24, -3, 6, 6);
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#54e0ff";
      ctx.fillRect(28, -2, 2, 4);
    } else {
      ctx.fillStyle = "#333";
      ctx.fillRect(0, -4, 18, 8);
      ctx.fillStyle = "#222";
      ctx.fillRect(14, -5, 4, 10);
    }
    ctx.restore();
  }

  function drawBullet(b) {
    ctx.save();
    if (b.isLaser) {
      const len = 30;
      const ang = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      const grad = ctx.createLinearGradient(-len, 0, 6, 0);
      grad.addColorStop(0, "rgba(84,224,255,0)");
      grad.addColorStop(1, "#fff");
      ctx.fillStyle = grad;
      ctx.fillRect(-len, -2, len + 6, 4);
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#54e0ff";
      ctx.fillStyle = "#54e0ff";
      ctx.fillRect(-2, -1.5, 8, 3);
    } else if (b.isRocket) {
      const ang = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.fillStyle = "#888";
      ctx.fillRect(-10, -4, 16, 8);
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(6, -4); ctx.lineTo(12, 0); ctx.lineTo(6, 4); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffaa55";
      ctx.beginPath();
      ctx.arc(-12, 0, 6 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = b.color || "#ffe66d";
      ctx.shadowBlur = 8;
      ctx.shadowColor = b.color || "#ffe66d";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickup(pu) {
    const w = SHARED.PICKUP.WIDTH;
    const h = SHARED.PICKUP.HEIGHT;
    const wepDef = SHARED.WEAPONS[pu.weapon];
    const color = wepDef?.color || "#fff";

    ctx.save();
    const bob = Math.sin(performance.now() * 0.005) * 3;
    ctx.translate(0, bob);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(pu.x + 3, pu.y + 3, w, h);

    ctx.fillStyle = "#1a2240";
    ctx.fillRect(pu.x, pu.y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(pu.x + 1, pu.y + 1, w - 2, h - 2);

    ctx.fillStyle = color;
    ctx.font = "bold 16px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letter =
      pu.weapon === "shotgun" ? "S" :
      pu.weapon === "rocket" ? "R" :
      pu.weapon === "laser" ? "L" : "P";
    ctx.fillText(letter, pu.x + w / 2, pu.y + h / 2 + 1);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const t = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      if (p.kind === "flash") {
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 30;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - t) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "ring") {
        const r = p.maxSize * (1 - t);
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawDeathZone() {
    const y = SHARED.PLAYER.DEATH_Y;
    const grad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    grad.addColorStop(0, "rgba(255,0,0,0)");
    grad.addColorStop(1, "rgba(255,0,0,0.45)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 30, SHARED.WORLD_WIDTH, 60);
  }

  // ---------- HUD ----------
  function updateHud(state) {
    const ri = document.getElementById("round-info");
    ri.textContent =
      state.phase === "lobby" ? "" :
      `ROUND ${state.roundNumber}` +
      (state.phase === "preround" ? `  STARTS IN ${Math.ceil(state.phaseTimer)}` : "");

    const sb = document.getElementById("scoreboard");
    const players = state.players.slice().sort((a, b) => b.score - a.score);
    let html = `<div class="row header">
        <div></div><div>Player</div><div>W</div><div>K</div><div>D</div></div>`;
    for (const p of players) {
      const adminBadge = p.isAdmin ? "[A] " : (p.isTester ? "[T] " : "");
      const nameColor = p.isAdmin ? 'color:#ffd700' : (p.isTester ? 'color:#54e0ff' : '');
      html += `<div class="row${p.alive ? "" : " dead"}">
        <div class="swatch" style="background:${p.color}"></div>
        <div class="pname" style="${nameColor}">${adminBadge}${escapeHtml(p.name)}${p.id === selfId ? " (YOU)" : ""}</div>
        <div class="pscore">${p.score}</div>
        <div class="pkd">${p.kills}</div>
        <div class="pkd">${p.deaths}</div>
      </div>`;
    }
    sb.innerHTML = html;

    const self = state.players.find((p) => p.id === selfId);
    const wi = document.getElementById("weapon-info");
    if (self && self.alive) {
      const wd = SHARED.WEAPONS[self.weapon];
      wi.innerHTML = `<span class="wname">${wd.name}</span>` +
        (self.ammo === -1 ? '<span class="wammo">∞</span>' :
        `<span class="wammo">${self.ammo}</span>`);
      wi.style.display = "flex";
    } else {
      wi.style.display = "none";
    }

    const banner = document.getElementById("phase-banner");
    if (state.phase === "preround") {
      banner.style.display = "block";
      banner.classList.remove("small");
      banner.textContent = Math.ceil(state.phaseTimer) || "GO!";
    } else if (state.phase === "postround") {
      banner.style.display = "block";
      banner.classList.add("small");
      const w = state.players.find((p) => p.id === state.lastWinner);
      banner.textContent = w ? `${w.name.toUpperCase()} WINS THE ROUND` : "DRAW";
      banner.style.color = w?.color || "#fff";
    } else if (state.phase === "matchover") {
      banner.style.display = "block";
      banner.classList.add("small");
      const w = state.players.find((p) => p.id === state.matchWinner);
      banner.textContent = w ? `${w.name.toUpperCase()} WINS THE MATCH!` : "MATCH OVER";
      banner.style.color = w?.color || "#fff";
    } else {
      banner.style.display = "none";
      banner.style.color = "#fff";
    }

    // Tab scoreboard - aktualizovat pokud je viditelny
    if (isTabOpen) updateTabScoreboard(state);
  }

  // ---------- TAB SCOREBOARD (rozsireny) ----------
  let isTabOpen = false;
  const tabScoreboard = document.getElementById("tab-scoreboard");
  const tabTbody = document.getElementById("tab-tbody");

  function showTabScoreboard() {
    if (isTabOpen) return;
    isTabOpen = true;
    tabScoreboard.classList.add("active");
  }
  function hideTabScoreboard() {
    isTabOpen = false;
    tabScoreboard.classList.remove("active");
  }
  // Pojistka: kdyz se ztrati focus okna (alt-tab), schovej
  window.addEventListener("blur", hideTabScoreboard);

  function updateTabScoreboard(state) {
    // Header info
    const roundInfo = document.getElementById("tab-round-info");
    const mapInfo = document.getElementById("tab-map-info");
    if (roundInfo) {
      roundInfo.textContent = state.phase === "lobby" ? "Lobby" : `Round ${state.roundNumber}`;
    }
    if (mapInfo) {
      const mapName = SHARED.MAPS[state.mapKey]?.name || state.mapKey;
      mapInfo.textContent = mapName;
    }

    // Seradime hrace - admini nahore, pak podle wins
    const players = state.players.slice().sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return b.isAdmin ? 1 : -1;
      return b.score - a.score;
    });

    let html = "";
    for (const p of players) {
      const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : (p.kills > 0 ? p.kills.toFixed(2) : "0.00");
      const kdClass = p.deaths === 0 && p.kills === 0 ? "" :
                     parseFloat(kd) >= 1.5 ? "tab-kd-good" :
                     parseFloat(kd) >= 0.8 ? "tab-kd-mid" : "tab-kd-bad";

      const ping = p.ping || 0;
      const pingClass = ping === 0 ? "" :
                        ping < 80 ? "tab-ping-good" :
                        ping < 200 ? "tab-ping-mid" : "tab-ping-bad";
      const pingText = ping === 0 ? "—" : `${ping}ms`;

      const adminBadge = p.isAdmin ? "[A] " : "";
      const rowClasses = [
        p.alive ? "" : "dead",
        p.id === selfId ? "self" : "",
      ].filter(Boolean).join(" ");

      html += `<tr class="${rowClasses}">
        <td><span class="tab-swatch" style="background:${p.color}"></span></td>
        <td><span class="tab-name${p.isAdmin ? ' admin' : ''}">${adminBadge}${escapeHtml(p.name)}${p.id === selfId ? " (YOU)" : ""}</span></td>
        <td class="tab-wins">${p.score}</td>
        <td>${p.kills}</td>
        <td>${p.deaths}</td>
        <td class="${kdClass}">${kd}</td>
        <td class="${pingClass}">${pingText}</td>
      </tr>`;
    }
    tabTbody.innerHTML = html;
  }

  function addKillFeed(ev) {
    const feed = document.getElementById("killfeed");
    const state = snapshots[snapshots.length - 1];
    const victim = state?.players.find((p) => p.id === ev.victimId);
    const killer = ev.killerId ? state?.players.find((p) => p.id === ev.killerId) : null;
    const row = document.createElement("div");
    row.className = "killfeed-row";
    if (killer) {
      row.innerHTML = `<span style="color:${killer.color}">${escapeHtml(killer.name)}</span>` +
        ` KILLED <span style="color:${victim?.color || "#fff"}">${escapeHtml(victim?.name || "?")}</span>` +
        ` <span style="opacity:0.7">[${ev.cause}]</span>`;
    } else {
      row.innerHTML = `<span style="color:${victim?.color || "#fff"}">${escapeHtml(victim?.name || "?")}</span> fell off the world`;
    }
    feed.appendChild(row);
    setTimeout(() => row.remove(), 4000);
  }

  // ---------- HELPERS ----------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function lighten(hex, amount) {
    const c = hex.replace("#", "");
    const num = parseInt(c, 16);
    let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
    r = Math.min(255, r + Math.round(255 * amount));
    g = Math.min(255, g + Math.round(255 * amount));
    b = Math.min(255, b + Math.round(255 * amount));
    return `rgb(${r},${g},${b})`;
  }
})();