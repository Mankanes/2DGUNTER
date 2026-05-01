// ============================================================
// Gun Mayhem - Frontend (klient)
// Vse v jednom: menu, lobby, input, render, particles, interpolace
// ============================================================

(() => {
  const socket = io();
  let SHARED = null;
  let selfId = null;
  let roomId = null;

  const SNAPSHOT_BUFFER_MS = 100;
  const snapshots = [];

  const screens = {
    menu: document.getElementById("menu"),
    lobby: document.getElementById("lobby"),
    game: document.getElementById("game"),
  };
  function showScreen(name) {
    for (const k in screens) screens[k].classList.toggle("active", k === name);
  }

  // ---------- MENU ----------
  const nameInput = document.getElementById("name-input");
  nameInput.value = localStorage.getItem("gm_name") || "Player" + Math.floor(Math.random() * 99);

  document.getElementById("btn-quickplay").onclick = () => {
    saveName();
    socket.emit("quick_play", {}, handleJoin);
  };
  document.getElementById("btn-create").onclick = () => {
    saveName();
    socket.emit("create_room", { mapKey: "skybridge" }, handleJoin);
  };
  document.getElementById("btn-join").onclick = () => {
    saveName();
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    if (!code) return;
    socket.emit("join_room", { roomId: code }, handleJoin);
  };
  document.getElementById("btn-refresh").onclick = refreshRooms;

  function saveName() {
    const n = nameInput.value.trim() || "Player";
    localStorage.setItem("gm_name", n);
    socket.emit("hello", { name: n });
  }

  function refreshRooms() {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data) => {
        const list = document.getElementById("rooms-list");
        list.innerHTML = "";
        if (!data.rooms.length) {
          list.innerHTML = '<div class="room-empty">No open rooms — create one!</div>';
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

  socket.emit("hello", { name: nameInput.value }, () => {
    refreshRooms();
  });

  // ---------- LOBBY ----------
  const lobbyPlayersEl = document.getElementById("lobby-players");
  const lobbyMapEl = document.getElementById("lobby-map");
  let isReady = false;

  document.getElementById("btn-leave").onclick = () => {
    socket.emit("leave_room");
    isReady = false;
    clearChatLogs();
    showScreen("menu");
    refreshRooms();
  };
  document.getElementById("btn-ready").onclick = () => {
    isReady = !isReady;
    socket.emit("ready", { ready: isReady });
    document.getElementById("btn-ready").textContent = isReady ? "Cancel" : "Ready";
    document.getElementById("btn-ready").classList.toggle("ready", isReady);
  };
  lobbyMapEl.onchange = () => {
    socket.emit("change_map", { mapKey: lobbyMapEl.value });
  };

  socket.on("room_info", (info) => {
    if (info.id !== roomId) return;
    document.getElementById("lobby-code").textContent = info.id;
    if (lobbyMapEl.value !== info.mapKey) lobbyMapEl.value = info.mapKey;
    lobbyPlayersEl.innerHTML = "";
    for (const p of info.players) {
      const row = document.createElement("div");
      row.className = "lobby-player" + (p.ready ? " ready" : "");
      row.innerHTML = `
        <div class="swatch" style="background:${p.color};color:${p.color}"></div>
        <div class="pname">${escapeHtml(p.name)}${p.id === selfId ? " (you)" : ""}</div>
        <div class="pready">${p.ready ? "READY" : "..."}</div>
      `;
      lobbyPlayersEl.appendChild(row);
    }
  });

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
    } else if (e.key === "Escape" || e.key === "`" || e.key === "~") {
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
    // Lobby log
    const lobbyRow = document.createElement("div");
    lobbyRow.className = "chat-msg";
    lobbyRow.innerHTML =
      `<span class="chat-name" style="color:${msg.color}">${escapeHtml(msg.name)}:</span>` +
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
      `<span class="chat-name" style="color:${msg.color}">${escapeHtml(msg.name)}:</span>` +
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
  let mouseX = 0, mouseY = 0;

  const keyMap = {
    a: "left", arrowleft: "left",
    d: "right", arrowright: "right",
    w: "jump", arrowup: "jump", " ": "jump",
  };

  document.addEventListener("keydown", (e) => {
    // Pokud je konzole nebo chat otevreny, klavesy nezpracovavej
    if (isConsoleOpen || isChatOpen) return;

    // ~ nebo ` otevre konzoli (kdykoliv - v menu, lobby, hre)
    if (e.key === "`" || e.key === "~") {
      openConsole();
      e.preventDefault();
      return;
    }

    // Enter otevre in-game chat (jen kdyz jsme ve hre)
    if (e.key === "Enter" && screens.game.classList.contains("active")) {
      openGameChat();
      e.preventDefault();
      return;
    }

    const k = e.key.toLowerCase();
    if (keyMap[k]) {
      input[keyMap[k]] = true;
      e.preventDefault();
    }
    if (k === "1") input.switch = "pistol";
    else if (k === "2") input.switch = "shotgun";
    else if (k === "3") input.switch = "rocket";
    else if (k === "4") input.switch = "laser";
  });
  document.addEventListener("keyup", (e) => {
    if (isConsoleOpen || isChatOpen) return;
    const k = e.key.toLowerCase();
    if (keyMap[k]) {
      input[keyMap[k]] = false;
      e.preventDefault();
    }
  });

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) input.shoot = true;
  });
  canvas.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.shoot = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mouseleave", () => { input.shoot = false; });

  setInterval(() => {
    if (!SHARED) return;
    const self = getInterpolatedSelf();
    let aimX = 1, aimY = 0;
    if (self) {
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
      if (snap.phase !== "lobby") {
        showScreen("game");
        resizeCanvas();
        spawnInitialAmbient();
      }
    }
    if (screens.game.classList.contains("active") && snap.phase === "lobby") {
      showScreen("lobby");
      isReady = false;
      const btn = document.getElementById("btn-ready");
      btn.textContent = "Ready";
      btn.classList.remove("ready");
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
    const s = getInterpolatedState();
    if (!s) return null;
    return s.players.find((p) => p.id === selfId);
  }

  function cloneSnapshot(s) {
    return {
      ...s,
      players: s.players.map((p) => ({ ...p })),
      bullets: s.bullets.map((b) => ({ ...b })),
      pickups: s.pickups.map((p) => ({ ...p })),
      platforms: s.platforms.map((p) => ({ ...p })),
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
  let shakeAmount = 0;
  let shakeDecay = 0;
  let lastTickProcessed = -1;

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
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.18, maxLife: 0.18,
        size: 4 + Math.random() * 3,
        color, kind: "spark",
      });
    }
    particles.push({
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
      particles.push({
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
      particles.push({
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
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: "ember", gravity: 200,
      });
    }
    particles.push({
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
      particles.push({
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
      particles.push({
        x: x + 14, y: y + 14,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.4, maxLife: 0.4,
        size: 3 + Math.random() * 2,
        color: "#54e0ff", kind: "spark",
      });
    }
  }
  function spawnInitialAmbient() {
    particles.length = 0;
  }

  // ---------- CAMERA + RENDER ----------
  function computeCamera() {
    const ww = SHARED.WORLD_WIDTH;
    const wh = SHARED.WORLD_HEIGHT;
    const sx = canvas.width / ww;
    const sy = canvas.height / wh;
    const scale = Math.min(sx, sy);
    const x = (ww - canvas.width / scale) / 2;
    const y = (wh - canvas.height / scale) / 2;
    return { x, y, scale };
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);

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
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.kind !== "ring" && p.kind !== "flash") {
        if (p.gravity) p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  function render(state) {
    const cam = computeCamera();
    const map = SHARED.MAPS[state.mapKey];

    ctx.fillStyle = map?.bg || "#1a2840";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    ctx.fillRect(p.x + W / 2 - 50, p.y - 22, 100, 16);
    ctx.fillStyle = p.color;
    ctx.fillText(p.name + (p.id === selfId ? " ★" : ""), p.x + W / 2, p.y - 10);
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
      const cam = computeCamera();
      const sx = (cx - cam.x) * cam.scale;
      const sy = (cy - cam.y) * cam.scale;
      aimX = mouseX - sx;
      aimY = mouseY - sy;
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
      html += `<div class="row${p.alive ? "" : " dead"}">
        <div class="swatch" style="background:${p.color}"></div>
        <div class="pname">${escapeHtml(p.name)}${p.id === selfId ? " ★" : ""}</div>
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
        ` 🔫 <span style="color:${victim?.color || "#fff"}">${escapeHtml(victim?.name || "?")}</span>` +
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