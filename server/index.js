// ============================================================
// KNOCKFRIEND - Backend
// Vse v jednom souboru: konstanty, herni simulace, server, sockets
// ============================================================

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

// ============================================================
// KONSTANTY (driv shared.js)
// ============================================================

const SHARED = {
  TICK_RATE: 60,                // server simulation Hz (60 pro plynuly movement)
  WORLD_WIDTH: 1600,
  WORLD_HEIGHT: 900,
  GRAVITY: 1800,
  MAX_FALL_SPEED: 1400,

  PLAYER: {
    WIDTH: 36,
    HEIGHT: 56,
    MOVE_SPEED: 380,
    ACCEL_GROUND: 4500,
    ACCEL_AIR: 2200,
    FRICTION_GROUND: 3500,
    JUMP_VELOCITY: 850,
    DOUBLE_JUMP_VELOCITY: 780,
    MAX_JUMPS: 2,
    MAX_HEALTH: 100,
    RESPAWN_DELAY: 1.2,
    KNOCKBACK_DAMP: 4.0,
    DEATH_Y: 1100,
  },

  ROUND: {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 8,
    PRE_ROUND: 3.0,
    POST_ROUND: 4.0,
    MATCH_WIN_SCORE: 3,
  },

  WEAPONS: {
    pistol: {
      name: "Pistol", damage: 12, fireRate: 0.18,
      bulletSpeed: 1200, bulletGravity: 0.15, spread: 0.02,
      pelletsPerShot: 1, recoil: 90, knockback: 220,
      bulletLife: 1.5, bulletRadius: 4, ammo: Infinity, color: "#ffe66d",
    },
    shotgun: {
      name: "Shotgun", damage: 8, fireRate: 0.55,
      bulletSpeed: 1050, bulletGravity: 0.35, spread: 0.22,
      pelletsPerShot: 6, recoil: 380, knockback: 180,
      bulletLife: 0.55, bulletRadius: 4, ammo: 18, color: "#ff9f43",
    },
    rocket: {
      name: "Rocket Launcher", damage: 45, splashDamage: 35, splashRadius: 160,
      fireRate: 0.95, bulletSpeed: 700, bulletGravity: 0.10, spread: 0.0,
      pelletsPerShot: 1, recoil: 520, knockback: 1400,
      bulletLife: 3.0, bulletRadius: 8, ammo: 5, color: "#ff5252", isRocket: true,
    },
    laser: {
      name: "Laser Rifle", damage: 22, fireRate: 0.10,
      bulletSpeed: 2400, bulletGravity: 0.0, spread: 0.0,
      pelletsPerShot: 1, recoil: 40, knockback: 90,
      bulletLife: 0.8, bulletRadius: 3, ammo: 30, color: "#54e0ff", isLaser: true,
    },
  },

  PICKUP: {
    SPAWN_INTERVAL: 8.0,
    MAX_ON_MAP: 3,
    FALL_GRAVITY: 600,
    WIDTH: 28,
    HEIGHT: 28,
  },

  COLORS: [
    "#ff5e5e", "#5ec8ff", "#7dff7d", "#ffd75e",
    "#c87dff", "#ff7dc8", "#7dffd0", "#ffa07d",
  ],

  MAPS: {
    skybridge: {
      name: "Skybridge", bg: "#1a2840", bgAccent: "#2a3a5a",
      platforms: [
        { x: 100, y: 720, w: 520, h: 40 },
        { x: 980, y: 720, w: 520, h: 40 },
        { x: 380, y: 540, w: 220, h: 24 },
        { x: 1000, y: 540, w: 220, h: 24 },
        { x: 690, y: 460, w: 220, h: 24, destructible: true, hp: 80 },
        { x: 220, y: 340, w: 180, h: 22 },
        { x: 1200, y: 340, w: 180, h: 22 },
        { x: 690, y: 240, w: 220, h: 22 },
      ],
      spawns: [
        { x: 200, y: 660 }, { x: 1380, y: 660 }, { x: 480, y: 480 },
        { x: 1100, y: 480 }, { x: 320, y: 280 }, { x: 1280, y: 280 },
        { x: 800, y: 180 }, { x: 770, y: 400 },
      ],
    },
    pillars: {
      name: "Pillars", bg: "#2a1a40", bgAccent: "#3a2a5a",
      platforms: [
        { x: 60, y: 760, w: 1480, h: 40 },
        { x: 280, y: 540, w: 80, h: 220 },
        { x: 640, y: 540, w: 80, h: 220, destructible: true, hp: 100 },
        { x: 880, y: 540, w: 80, h: 220, destructible: true, hp: 100 },
        { x: 1240, y: 540, w: 80, h: 220 },
        { x: 120, y: 420, w: 220, h: 22 },
        { x: 1240, y: 420, w: 220, h: 22 },
        { x: 580, y: 360, w: 220, h: 22 },
        { x: 800, y: 360, w: 220, h: 22 },
        { x: 380, y: 220, w: 200, h: 22 },
        { x: 1020, y: 220, w: 200, h: 22 },
        { x: 690, y: 140, w: 220, h: 22 },
      ],
      spawns: [
        { x: 200, y: 700 }, { x: 1400, y: 700 }, { x: 800, y: 700 },
        { x: 480, y: 300 }, { x: 1120, y: 300 }, { x: 230, y: 360 },
        { x: 1350, y: 360 }, { x: 800, y: 80 },
      ],
    },
    chasm: {
      name: "Chasm", bg: "#401a25", bgAccent: "#5a2a3a",
      platforms: [
        { x: 40, y: 700, w: 420, h: 36 },
        { x: 1140, y: 700, w: 420, h: 36 },
        { x: 540, y: 620, w: 120, h: 22 },
        { x: 940, y: 620, w: 120, h: 22 },
        { x: 740, y: 540, w: 120, h: 22, destructible: true, hp: 60 },
        { x: 200, y: 480, w: 240, h: 22 },
        { x: 1160, y: 480, w: 240, h: 22 },
        { x: 540, y: 360, w: 220, h: 22 },
        { x: 840, y: 360, w: 220, h: 22 },
        { x: 690, y: 220, w: 220, h: 22 },
      ],
      spawns: [
        { x: 150, y: 640 }, { x: 1450, y: 640 }, { x: 320, y: 420 },
        { x: 1280, y: 420 }, { x: 650, y: 300 }, { x: 950, y: 300 },
        { x: 800, y: 160 }, { x: 600, y: 580 },
      ],
    },
  },
};

// ============================================================
// HERNI TRIDA (driv game.js)
// ============================================================

let nextEntityId = 1;
const newId = () => "e" + (nextEntityId++);

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

class Game {
  constructor(roomId, mapKey = "skybridge") {
    this.roomId = roomId;
    this.mapKey = mapKey;
    this.map = SHARED.MAPS[mapKey];
    this.players = new Map();
    this.bullets = [];
    this.pickups = [];
    this.events = [];
    this.platforms = [];
    this.phase = "lobby";
    this.phaseTimer = 0;
    this.roundNumber = 0;
    this.lastWinner = null;
    this.matchWinner = null;
    this.pickupSpawnTimer = SHARED.PICKUP.SPAWN_INTERVAL;
    this.tickCount = 0;
    // Host = prvni hrac, ten muze menit nastaveni
    this.hostId = null;
    // Nastaveni matche - host muze v lobby zmenit
    this.matchSettings = {
      winScore: SHARED.ROUND.MATCH_WIN_SCORE, // pocet vyhranych kol pro vyhru matche
      phoneOnly: false, // pokud true, jen mobilni hraci se mohou pripojit
    };
  }

  loadMap(mapKey) {
    if (!SHARED.MAPS[mapKey]) return;
    this.mapKey = mapKey;
    this.map = SHARED.MAPS[mapKey];
    this.platforms = this.map.platforms.map((p) => ({
      ...p, hp: p.hp || 0, destroyed: false,
    }));
  }

  addPlayer(socketId, name, isBot = false) {
    if (this.players.size >= SHARED.ROUND.MAX_PLAYERS) return null;
    // Najdi prvni nepouzitou barvu
    const usedColors = new Set();
    for (const p of this.players.values()) usedColors.add(p.color);
    let color = SHARED.COLORS.find((c) => !usedColors.has(c)) || SHARED.COLORS[0];
    const player = {
      id: socketId,
      name: (name || "Player").slice(0, 16),
      color,
      x: 200, y: 200, vx: 0, vy: 0,
      facing: 1, onGround: false,
      jumpsLeft: SHARED.PLAYER.MAX_JUMPS,
      hp: SHARED.PLAYER.MAX_HEALTH,
      alive: false, respawnAt: 0,
      weapon: "pistol", ammo: Infinity, lastShotAt: -10,
      knockbackVx: 0, knockbackVy: 0,
      input: { left: false, right: false, jump: false, shoot: false, aimX: 0, aimY: 0, switch: null },
      lastJumpInput: false,
      score: 0, kills: 0, deaths: 0,
      ready: !!isBot, // boti jsou vzdy ready
      isBot,
      isAdmin: false,
      isTester: false,
      ping: 0,
      botMove: false, // jestli se bot ma hybat
      shotCountWindow: [],
    };
    this.players.set(socketId, player);
    // Pokud jsme jeste neměli hosta a tohle je realny hrac, je host
    if (!this.hostId && !isBot) {
      this.hostId = socketId;
    }
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    // Pokud odesel host, najdi noveho (prvniho realnyho hrace)
    if (this.hostId === socketId) {
      this.hostId = null;
      for (const [id, p] of this.players) {
        if (!p.isBot) {
          this.hostId = id;
          break;
        }
      }
    }
  }

  // Hrac si vybere barvu - jen v lobby, jen pokud neni jiz pouzita
  setColor(socketId, color) {
    if (this.phase !== "lobby") return false;
    if (!SHARED.COLORS.includes(color)) return false;
    const p = this.players.get(socketId);
    if (!p) return false;
    // Zkontroluj jestli barva neni pouzita jinym hracem
    for (const other of this.players.values()) {
      if (other.id !== socketId && other.color === color) {
        return false; // barva pouzita
      }
    }
    p.color = color;
    return true;
  }

  // Host muze zmenit nastaveni matche - jen v lobby
  setMatchSettings(socketId, settings) {
    if (this.hostId !== socketId) return false;
    if (this.phase !== "lobby") return false;
    if (settings && typeof settings.winScore === "number") {
      // Povolene hodnoty: 1 az 10 winu
      const ws = Math.max(1, Math.min(10, Math.round(settings.winScore)));
      this.matchSettings.winScore = ws;
    }
    if (settings && typeof settings.phoneOnly === "boolean") {
      this.matchSettings.phoneOnly = settings.phoneOnly;
    }
    return true;
  }

  setReady(socketId, ready) {
    const p = this.players.get(socketId);
    if (p) p.ready = !!ready;
  }

  setInput(socketId, input) {
    const p = this.players.get(socketId);
    if (!p) return;
    p.input = {
      left: !!input.left,
      right: !!input.right,
      jump: !!input.jump,
      shoot: !!input.shoot,
      aimX: clamp(Number(input.aimX) || 0, -2, 2),
      aimY: clamp(Number(input.aimY) || 0, -2, 2),
      switch: input.switch && SHARED.WEAPONS[input.switch] ? input.switch : null,
    };
  }

  tryStartMatch() {
    const ready = [...this.players.values()].filter((p) => p.ready);
    if (
      this.phase === "lobby" &&
      this.players.size >= SHARED.ROUND.MIN_PLAYERS &&
      ready.length === this.players.size
    ) {
      this.startMatch();
    }
  }

  startMatch() {
    for (const p of this.players.values()) {
      p.score = 0; p.kills = 0; p.deaths = 0;
    }
    this.matchWinner = null;
    this.roundNumber = 0;
    this.startRound();
  }

  startRound() {
    this.roundNumber++;
    this.bullets = [];
    this.pickups = [];
    this.pickupSpawnTimer = SHARED.PICKUP.SPAWN_INTERVAL * 0.5;
    this.events.push({ type: "round_start", round: this.roundNumber });
    this.loadMap(this.mapKey);

    // Nahodne preusporadame spawny (Fisher-Yates shuffle)
    const spawns = this.map.spawns.slice();
    for (let j = spawns.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [spawns[j], spawns[k]] = [spawns[k], spawns[j]];
    }

    // Pridelime spawny tak aby nikdo nebyl blizko jineho hrace
    const MIN_DIST = 250; // minimalni vzdalenost mezi hraci
    const usedSpawns = []; // pole pridelenych pozic

    for (const p of this.players.values()) {
      // Najdi nejlepsi spawn - ten ktery je nejdal od vsech jiz pridelenych
      let bestSpawn = null;
      let bestMinDist = -1;
      for (const s of spawns) {
        // Spocitej nejmensi vzdalenost od jiz pouzitych spawnu
        let minDist = Infinity;
        for (const u of usedSpawns) {
          const d = Math.hypot(s.x - u.x, s.y - u.y);
          if (d < minDist) minDist = d;
        }
        if (usedSpawns.length === 0) minDist = Infinity;
        // Pokud najdeme spawn s minimalni vzdalenosti vetsi nez bestMinDist, vezmeme
        if (minDist > bestMinDist) {
          bestMinDist = minDist;
          bestSpawn = s;
        }
      }
      // Pokud zadne misto neni dost daleko, vezmeme jakekoli (random)
      if (!bestSpawn || (bestMinDist < MIN_DIST && usedSpawns.length < spawns.length)) {
        // Najdi prvni spawn ktery jeste nebyl pouzity
        for (const s of spawns) {
          if (!usedSpawns.includes(s)) {
            bestSpawn = s;
            break;
          }
        }
        if (!bestSpawn) bestSpawn = spawns[0]; // fallback
      }

      usedSpawns.push(bestSpawn);
      p.x = bestSpawn.x; p.y = bestSpawn.y;
      p.vx = 0; p.vy = 0;
      p.knockbackVx = 0; p.knockbackVy = 0;
      p.hp = SHARED.PLAYER.MAX_HEALTH;
      p.alive = true;
      p.weapon = "pistol";
      p.ammo = Infinity;
      p.jumpsLeft = SHARED.PLAYER.MAX_JUMPS;
      p.respawnAt = 0;
    }

    this.phase = "preround";
    this.phaseTimer = SHARED.ROUND.PRE_ROUND;
  }

  endRound(winnerId) {
    this.lastWinner = winnerId;
    if (winnerId) {
      const w = this.players.get(winnerId);
      if (w) w.score++;
    }
    this.events.push({ type: "round_end", winnerId });

    let matchWinner = null;
    for (const p of this.players.values()) {
      if (p.score >= this.matchSettings.winScore) {
        matchWinner = p.id;
        break;
      }
    }
    if (matchWinner) {
      this.matchWinner = matchWinner;
      this.phase = "matchover";
      this.phaseTimer = 8.0;
      // Tracking statistik - gamesPlayed pro vsechny, wins pro vyherce, playTime
      const now = Date.now();
      for (const p of this.players.values()) {
        if (p.isBot || !p.username) continue;
        if (!users[p.username]) continue;
        if (!users[p.username].stats) users[p.username].stats = { gamesPlayed: 0, kills: 0, deaths: 0, wins: 0, playTimeMs: 0 };
        users[p.username].stats.gamesPlayed++;
        if (p.id === matchWinner) {
          users[p.username].stats.wins++;
        }
        if (p.matchStartTime) {
          users[p.username].stats.playTimeMs += (now - p.matchStartTime);
          p.matchStartTime = now; // reset pro dalsi match
        }
        saveUser(p.username);
      }
    } else {
      this.phase = "postround";
      this.phaseTimer = SHARED.ROUND.POST_ROUND;
    }
  }

  returnToLobby() {
    this.phase = "lobby";
    this.phaseTimer = 0;
    this.bullets = [];
    this.pickups = [];
    this.matchWinner = null;
    for (const p of this.players.values()) {
      p.ready = false; p.alive = false; p.score = 0;
    }
  }

  update(dt) {
    this.tickCount++;
    this.events = [];

    if (this.phase === "lobby") return;

    if (this.phase === "preround") {
      this.phaseTimer -= dt;
      this.simulatePlayers(dt, false);
      this.simulateBullets(dt);
      if (this.phaseTimer <= 0) {
        this.phase = "playing";
        this.phaseTimer = 0;
      }
      return;
    }

    if (this.phase === "playing") {
      this.simulatePlayers(dt, true);
      this.simulateBullets(dt);
      this.simulatePickups(dt);
      this.checkWinCondition();
      return;
    }

    if (this.phase === "postround" || this.phase === "matchover") {
      this.phaseTimer -= dt;
      this.simulatePlayers(dt, false);
      this.simulateBullets(dt);
      if (this.phaseTimer <= 0) {
        if (this.phase === "matchover") {
          this.returnToLobby();
        } else {
          this.startRound();
        }
      }
    }
  }

  simulatePlayers(dt, allowShoot) {
    // Bot AI: jednoducha logika - bud stoji, nebo se pohybuje nahodne
    for (const p of this.players.values()) {
      if (!p.isBot || !p.alive) continue;
      if (!p.botMove) {
        // Stoji - vsechny inputy false
        p.input.left = false;
        p.input.right = false;
        p.input.jump = false;
        p.input.shoot = false;
        continue;
      }
      // Nahodny wandering
      if (!p._botTimer || p._botTimer <= 0) {
        p._botDir = Math.random() < 0.33 ? -1 : Math.random() < 0.5 ? 0 : 1;
        p._botJump = Math.random() < 0.3;
        p._botTimer = 0.5 + Math.random() * 1.5;
      }
      p._botTimer -= dt;
      p.input.left = p._botDir === -1;
      p.input.right = p._botDir === 1;
      p.input.jump = p._botJump && Math.random() < 0.05;
      p.input.shoot = false;
    }

    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.phase === "playing" && p.respawnAt > 0) {
          p.respawnAt -= dt;
          if (p.respawnAt <= 0) p.respawnAt = 0;
        }
        continue;
      }

      const PL = SHARED.PLAYER;

      // Knockback decay
      const damp = Math.exp(-PL.KNOCKBACK_DAMP * dt);
      p.knockbackVx *= damp;
      p.knockbackVy *= damp;

      const inp = p.input;
      const wantLeft = inp.left && !inp.right;
      const wantRight = inp.right && !inp.left;
      const targetVx = wantLeft ? -PL.MOVE_SPEED : wantRight ? PL.MOVE_SPEED : 0;
      const accel = p.onGround ? PL.ACCEL_GROUND : PL.ACCEL_AIR;

      if (targetVx !== 0) {
        const diff = targetVx - p.vx;
        const step = Math.sign(diff) * accel * dt;
        if (Math.abs(step) > Math.abs(diff)) p.vx = targetVx;
        else p.vx += step;
        p.facing = wantLeft ? -1 : 1;
      } else if (p.onGround) {
        const fric = PL.FRICTION_GROUND * dt;
        if (p.vx > fric) p.vx -= fric;
        else if (p.vx < -fric) p.vx += fric;
        else p.vx = 0;
      }

      if (inp.jump && !p.lastJumpInput && p.jumpsLeft > 0) {
        if (p.onGround || p.jumpsLeft === PL.MAX_JUMPS) {
          p.vy = -PL.JUMP_VELOCITY;
        } else {
          p.vy = -PL.DOUBLE_JUMP_VELOCITY;
        }
        p.jumpsLeft--;
        p.onGround = false;
      }
      p.lastJumpInput = inp.jump;

      p.vy += SHARED.GRAVITY * dt;
      if (p.vy > SHARED.MAX_FALL_SPEED) p.vy = SHARED.MAX_FALL_SPEED;

      const totalVx = p.vx + p.knockbackVx;
      const totalVy = p.vy + p.knockbackVy;

      this.moveAndCollide(p, totalVx * dt, totalVy * dt);

      if (p.onGround) p.jumpsLeft = PL.MAX_JUMPS;

      // Zbrane se nedaji prepinat - mas pistol nebo to co ti padlo
      // (input.switch ignorujeme)

      // Strelba
      if (allowShoot && inp.shoot) {
        this.tryShoot(p);
      }

      if (p.y > SHARED.PLAYER.DEATH_Y) {
        this.killPlayer(p, null, "fall");
      }
    }
  }

  moveAndCollide(p, dx, dy) {
    const W = SHARED.PLAYER.WIDTH;
    const H = SHARED.PLAYER.HEIGHT;
    p.onGround = false;

    p.x += dx;
    for (const plat of this.platforms) {
      if (plat.destroyed) continue;
      if (aabb(p.x, p.y, W, H, plat.x, plat.y, plat.w, plat.h)) {
        if (dx > 0) p.x = plat.x - W;
        else if (dx < 0) p.x = plat.x + plat.w;
        p.vx = 0;
        p.knockbackVx *= 0.4;
      }
    }

    p.y += dy;
    for (const plat of this.platforms) {
      if (plat.destroyed) continue;
      if (aabb(p.x, p.y, W, H, plat.x, plat.y, plat.w, plat.h)) {
        if (dy > 0) {
          p.y = plat.y - H;
          p.onGround = true;
          p.vy = 0;
          p.knockbackVy = 0;
        } else if (dy < 0) {
          p.y = plat.y + plat.h;
          p.vy = 0;
          p.knockbackVy *= 0.5;
        }
      }
    }

    if (p.x < -40) p.x = -40;
    if (p.x > SHARED.WORLD_WIDTH - W + 40) p.x = SHARED.WORLD_WIDTH - W + 40;
  }

  tryShoot(p) {
    const wepDef = SHARED.WEAPONS[p.weapon];
    if (!wepDef) return;
    const now = this.tickCount / SHARED.TICK_RATE;
    if (now - p.lastShotAt < wepDef.fireRate) return;
    if (p.ammo <= 0) {
      p.weapon = "pistol";
      p.ammo = Infinity;
      return;
    }

    p.shotCountWindow.push(now);
    while (p.shotCountWindow.length && now - p.shotCountWindow[0] > 1.0) {
      p.shotCountWindow.shift();
    }
    const maxPerSecond = Math.ceil(1 / wepDef.fireRate) + 2;
    if (p.shotCountWindow.length > maxPerSecond) return;

    p.lastShotAt = now;
    if (p.ammo !== Infinity) p.ammo--;

    let ax = p.input.aimX;
    let ay = p.input.aimY;
    let amag = Math.hypot(ax, ay);
    if (amag < 0.01) {
      ax = p.facing; ay = 0; amag = 1;
    }
    ax /= amag; ay /= amag;
    p.facing = ax >= 0 ? 1 : -1;

    const muzzleX = p.x + SHARED.PLAYER.WIDTH / 2 + ax * 22;
    const muzzleY = p.y + SHARED.PLAYER.HEIGHT * 0.4 + ay * 10;

    for (let i = 0; i < wepDef.pelletsPerShot; i++) {
      const spread = wepDef.spread > 0 ? (Math.random() - 0.5) * 2 * wepDef.spread : 0;
      const speedJitter = 1 + (Math.random() - 0.5) * 0.1;
      const cs = Math.cos(spread);
      const sn = Math.sin(spread);
      const dx = ax * cs - ay * sn;
      const dy = ax * sn + ay * cs;
      const speed = wepDef.bulletSpeed * speedJitter;

      this.bullets.push({
        id: newId(), ownerId: p.id, weapon: p.weapon,
        x: muzzleX, y: muzzleY,
        vx: dx * speed, vy: dy * speed,
        gravity: wepDef.bulletGravity * SHARED.GRAVITY,
        life: wepDef.bulletLife,
        radius: wepDef.bulletRadius,
        damage: wepDef.damage,
        knockback: wepDef.knockback,
        color: wepDef.color,
        isRocket: !!wepDef.isRocket,
        isLaser: !!wepDef.isLaser,
        splashDamage: wepDef.splashDamage || 0,
        splashRadius: wepDef.splashRadius || 0,
      });
    }

    p.knockbackVx -= ax * wepDef.recoil;
    p.knockbackVy -= ay * wepDef.recoil * 0.5;

    this.events.push({
      type: "muzzle", x: muzzleX, y: muzzleY,
      dx: ax, dy: ay, weapon: p.weapon, shooterId: p.id,
    });
  }

  simulateBullets(dt) {
    const next = [];
    for (const b of this.bullets) {
      b.life -= dt;
      if (b.life <= 0) continue;

      b.vy += b.gravity * dt;
      const stepX = b.vx * dt;
      const stepY = b.vy * dt;

      const distance = Math.hypot(stepX, stepY);
      const steps = Math.max(1, Math.ceil(distance / 18));
      let alive = true;
      for (let s = 0; s < steps && alive; s++) {
        b.x += stepX / steps;
        b.y += stepY / steps;

        if (b.x < -50 || b.x > SHARED.WORLD_WIDTH + 50 || b.y > SHARED.WORLD_HEIGHT + 200) {
          alive = false;
          break;
        }

        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (p.id === b.ownerId) continue;
          if (
            b.x > p.x && b.x < p.x + SHARED.PLAYER.WIDTH &&
            b.y > p.y && b.y < p.y + SHARED.PLAYER.HEIGHT
          ) {
            this.applyBulletHit(b, p);
            alive = false;
            break;
          }
        }
        if (!alive) break;

        for (const plat of this.platforms) {
          if (plat.destroyed) continue;
          if (b.x > plat.x && b.x < plat.x + plat.w &&
              b.y > plat.y && b.y < plat.y + plat.h) {
            this.applyBulletPlatformHit(b, plat);
            alive = false;
            break;
          }
        }
      }

      if (alive) next.push(b);
    }
    this.bullets = next;
  }

  applyBulletHit(b, victim) {
    if (b.isRocket) {
      // Pred explozi - pridej extra direct hit damage (raketa trefila primo)
      victim.hp -= b.damage;
      this.events.push({
        type: "hit", x: b.x, y: b.y,
        victimId: victim.id, damage: b.damage, weapon: b.weapon,
      });
      this.explode(b);
    } else {
      victim.hp -= b.damage;
      const mag = Math.hypot(b.vx, b.vy) || 1;
      const dirX = b.vx / mag;
      const dirY = b.vy / mag;
      victim.knockbackVx += dirX * b.knockback;
      victim.knockbackVy += dirY * b.knockback - 60;
      this.events.push({
        type: "hit", x: b.x, y: b.y,
        victimId: victim.id, damage: b.damage, weapon: b.weapon,
      });
      if (victim.hp <= 0) {
        this.killPlayer(victim, b.ownerId, b.weapon);
      }
    }
  }

  applyBulletPlatformHit(b, plat) {
    if (b.isRocket) {
      this.explode(b);
    } else {
      this.events.push({ type: "spark", x: b.x, y: b.y, weapon: b.weapon });
      if (plat.destructible && !plat.destroyed) {
        plat.hp -= b.damage;
        if (plat.hp <= 0) {
          plat.destroyed = true;
          this.events.push({
            type: "platform_destroyed",
            x: plat.x + plat.w / 2,
            y: plat.y + plat.h / 2,
          });
        }
      }
    }
  }

  explode(b) {
    this.events.push({ type: "explosion", x: b.x, y: b.y, radius: b.splashRadius });
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const cx = p.x + SHARED.PLAYER.WIDTH / 2;
      const cy = p.y + SHARED.PLAYER.HEIGHT / 2;
      const dist = Math.hypot(cx - b.x, cy - b.y);
      if (dist < b.splashRadius) {
        const linearFalloff = 1 - dist / b.splashRadius;
        // Damage stale linearni
        const dmg = (p.id === b.ownerId
          ? Math.round(b.splashDamage * 0.5 * linearFalloff)
          : Math.round(b.splashDamage * linearFalloff));
        if (p.id !== b.ownerId || dmg > 0) p.hp -= dmg;
        // Knockback - kvadraticky falloff (vetsi rozdil mezi blizko a daleko)
        // + minimum knockback ze i daleky zasah te postrci
        const knockFalloff = Math.max(0.35, linearFalloff * linearFalloff);
        const nx = (cx - b.x) / (dist || 1);
        const ny = (cy - b.y) / (dist || 1);
        const force = b.knockback * knockFalloff;
        p.knockbackVx += nx * force;
        // Vetsi vertikalni boost - rakety hraci vyhozuji do vzduchu
        p.knockbackVy += ny * force - 350;
        if (p.hp <= 0) {
          this.killPlayer(p, b.ownerId, "rocket");
        }
      }
    }
    for (const plat of this.platforms) {
      if (!plat.destructible || plat.destroyed) continue;
      const cx = plat.x + plat.w / 2;
      const cy = plat.y + plat.h / 2;
      const dist = Math.hypot(cx - b.x, cy - b.y);
      if (dist < b.splashRadius) {
        plat.hp -= Math.round(b.splashDamage * (1 - dist / b.splashRadius));
        if (plat.hp <= 0) {
          plat.destroyed = true;
          this.events.push({ type: "platform_destroyed", x: cx, y: cy });
        }
      }
    }
  }

  killPlayer(victim, killerId, cause) {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    // Tracking statistik - jen pro prihlasene hrace
    if (victim.username && users[victim.username]) {
      if (!users[victim.username].stats) users[victim.username].stats = { gamesPlayed: 0, kills: 0, deaths: 0, wins: 0, playTimeMs: 0 };
      users[victim.username].stats.deaths++;
      saveUser(victim.username);
    }
    if (killerId && killerId !== victim.id) {
      const k = this.players.get(killerId);
      if (k) {
        k.kills++;
        if (k.username && users[k.username]) {
          if (!users[k.username].stats) users[k.username].stats = { gamesPlayed: 0, kills: 0, deaths: 0, wins: 0, playTimeMs: 0 };
          users[k.username].stats.kills++;
          saveUser(k.username);
        }
      }
    }
    this.events.push({ type: "death", victimId: victim.id, killerId, cause });
  }

  simulatePickups(dt) {
    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0 && this.pickups.length < SHARED.PICKUP.MAX_ON_MAP) {
      this.spawnPickup();
      this.pickupSpawnTimer = SHARED.PICKUP.SPAWN_INTERVAL;
    }

    for (const pu of this.pickups) {
      if (!pu.landed) {
        pu.vy += SHARED.PICKUP.FALL_GRAVITY * dt;
        pu.y += pu.vy * dt;
        for (const plat of this.platforms) {
          if (plat.destroyed) continue;
          if (
            pu.x + SHARED.PICKUP.WIDTH > plat.x &&
            pu.x < plat.x + plat.w &&
            pu.y + SHARED.PICKUP.HEIGHT > plat.y &&
            pu.y + SHARED.PICKUP.HEIGHT < plat.y + plat.h + 30 &&
            pu.vy >= 0
          ) {
            pu.y = plat.y - SHARED.PICKUP.HEIGHT;
            pu.vy = 0;
            pu.landed = true;
            break;
          }
        }
        if (pu.y > SHARED.PLAYER.DEATH_Y) pu.dead = true;
      }
    }
    this.pickups = this.pickups.filter((p) => !p.dead);

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const pu of this.pickups) {
        if (pu.dead) continue;
        if (
          p.x < pu.x + SHARED.PICKUP.WIDTH &&
          p.x + SHARED.PLAYER.WIDTH > pu.x &&
          p.y < pu.y + SHARED.PICKUP.HEIGHT &&
          p.y + SHARED.PLAYER.HEIGHT > pu.y
        ) {
          p.weapon = pu.weapon;
          const wd = SHARED.WEAPONS[pu.weapon];
          p.ammo = wd.ammo;
          pu.dead = true;
          this.events.push({
            type: "pickup", playerId: p.id, weapon: pu.weapon,
            x: pu.x, y: pu.y,
          });
        }
      }
    }
    this.pickups = this.pickups.filter((p) => !p.dead);
  }

  spawnPickup() {
    const choices = ["shotgun", "rocket", "laser"];
    const weapon = choices[Math.floor(Math.random() * choices.length)];
    const x = 100 + Math.random() * (SHARED.WORLD_WIDTH - 200);
    this.pickups.push({
      id: newId(), x, y: -40, vy: 0, weapon,
      landed: false, dead: false,
    });
  }

  checkWinCondition() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (this.players.size >= 2 && alive.length <= 1) {
      this.endRound(alive[0]?.id || null);
    } else if (this.players.size === 1 && alive.length === 0) {
      this.endRound(null);
    }
  }

  snapshot() {
    return {
      tick: this.tickCount,
      time: this.tickCount / SHARED.TICK_RATE,
      phase: this.phase,
      phaseTimer: +this.phaseTimer.toFixed(2),
      roundNumber: this.roundNumber,
      lastWinner: this.lastWinner,
      matchWinner: this.matchWinner,
      mapKey: this.mapKey,
      platforms: this.platforms.map((p, i) => ({
        i, destroyed: !!p.destroyed,
        hp: p.destructible ? p.hp : undefined,
      })),
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, color: p.color,
        x: +p.x.toFixed(2), y: +p.y.toFixed(2),
        facing: p.facing,
        hp: Math.max(0, Math.round(p.hp)),
        alive: p.alive, weapon: p.weapon,
        ammo: p.ammo === Infinity ? -1 : p.ammo,
        score: p.score, kills: p.kills, deaths: p.deaths,
        ready: p.ready,
        isAdmin: !!p.isAdmin,
        isTester: !!p.isTester,
        ping: p.isBot ? 0 : (p.ping || 0),
      })),
      bullets: this.bullets.map((b) => ({
        id: b.id, x: +b.x.toFixed(1), y: +b.y.toFixed(1),
        vx: +b.vx.toFixed(1), vy: +b.vy.toFixed(1),
        weapon: b.weapon, color: b.color, radius: b.radius,
        isRocket: b.isRocket, isLaser: b.isLaser,
      })),
      pickups: this.pickups.map((pu) => ({
        id: pu.id, x: +pu.x.toFixed(1), y: +pu.y.toFixed(1), weapon: pu.weapon,
      })),
      events: this.events,
    };
  }
}

// ============================================================
// HTTP server + Socket.io (driv index.js)
// ============================================================

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 8000,
});

// ============================================================
// ADMIN HESLO
// Nastav promennou prostredi ADMIN_PASSWORD na Renderu (Settings > Environment)
// Pokud neni nastavena, pouzije se default - ZMEN HO!
// Pouzivani: v chatu napis  /login <heslo>
// ============================================================
// ============================================================
// USER ACCOUNT SYSTEM - registrace + login + persistence
// Pouziva se pro: prihlaseni hracu (jmeno = username), admin
// Data se ukladaji do users.json (prezije sleep, smazane pri redeployi)
// ============================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "knockfriend2026";
const TESTER_PASSWORD = process.env.TESTER_PASSWORD || "knocktester2026";

const fs = require("fs");
const crypto = require("crypto");
const USERS_FILE = path.join(__dirname, "..", "data", "users.json");

// Zajisti ze data slozka existuje (pro file fallback)
const dataDir = path.dirname(USERS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// users: { username -> { username, passwordHash, salt, isAdmin, createdAt, lastLoginAt } }
let users = {};
// sessions: { token -> { username, createdAt, lastUsedAt } } - in-memory
const sessions = new Map();
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 dni

// MongoDB setup - pouzije se pokud je MONGODB_URI v env vars, jinak fallback na soubor
const MONGODB_URI = process.env.MONGODB_URI || null;
let mongoClient = null;
let mongoUsers = null; // collection
let mongoFriends = null; // collection pro pratele
let mongoFeedback = null; // collection pro feedback
let mongoEnabled = false;

// Friends file fallback - jednoduchy JSON file
const FRIENDS_FILE = path.join(__dirname, "..", "data", "friends.json");
let friendsData = []; // [{ from, to, status, createdAt, acceptedAt }]

// Feedback file fallback
const FEEDBACK_FILE = path.join(__dirname, "..", "data", "feedback.json");
let feedbackData = []; // [{ username, rating, bugs, suggestions, likes, createdAt }]

function loadFriendsFile() {
  try {
    if (fs.existsSync(FRIENDS_FILE)) {
      friendsData = JSON.parse(fs.readFileSync(FRIENDS_FILE, "utf8"));
    }
  } catch (err) {
    friendsData = [];
  }
}
function saveFriendsFile() {
  try {
    fs.writeFileSync(FRIENDS_FILE, JSON.stringify(friendsData, null, 2), "utf8");
  } catch (err) {
    console.error("[FRIENDS] Save error:", err.message);
  }
}

function loadFeedbackFile() {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      feedbackData = JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf8"));
    }
  } catch (err) {
    feedbackData = [];
  }
}
function saveFeedbackFile() {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbackData, null, 2), "utf8");
  } catch (err) {
    console.error("[FEEDBACK] Save error:", err.message);
  }
}

async function initMongo() {
  if (!MONGODB_URI) {
    console.log("[DB] MONGODB_URI neni nastaveny - pouzije se file storage");
    return;
  }
  try {
    const { MongoClient } = require("mongodb");
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      // SSL/TLS nastaveni pro Render kompatibilitu
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    await mongoClient.connect();
    const db = mongoClient.db("knockfriend");
    mongoUsers = db.collection("users");
    mongoFriends = db.collection("friends");
    mongoFeedback = db.collection("feedback");
    // Vytvor unique index na username (pokud jeste neni)
    await mongoUsers.createIndex({ username: 1 }, { unique: true });
    // Index pro friends - rychle dotazy na from/to
    await mongoFriends.createIndex({ from: 1, to: 1 }, { unique: true });
    await mongoFriends.createIndex({ to: 1, status: 1 });
    await mongoFriends.createIndex({ from: 1, status: 1 });
    // Index pro feedback - sort podle data
    await mongoFeedback.createIndex({ createdAt: -1 });
    mongoEnabled = true;
    console.log("[DB] MongoDB pripojena uspesne");
  } catch (err) {
    console.error("[DB] MongoDB chyba pripojeni:", err.message);
    console.log("[DB] Pouzije se file storage jako fallback");
    mongoEnabled = false;
  }
}

async function loadUsers() {
  if (mongoEnabled && mongoUsers) {
    try {
      const all = await mongoUsers.find({}).toArray();
      users = {};
      for (const u of all) {
        // Odstran _id (Mongo interni)
        const { _id, ...userData } = u;
        users[u.username] = userData;
      }
      console.log(`[DB] Loaded ${all.length} users from MongoDB`);
      migrateUserStats();
      return;
    } catch (err) {
      console.error("[DB] MongoDB load error:", err.message);
    }
  }
  // Fallback na soubor
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf8");
      users = JSON.parse(raw);
      console.log(`[DB] Loaded ${Object.keys(users).length} users from file`);
    }
  } catch (err) {
    console.error("[DB] File load error:", err.message);
    users = {};
  }
  migrateUserStats();
}

// Migrace - kdyby user neměl stats (existoval pred pridanim featuru)
function migrateUserStats() {
  for (const u of Object.values(users)) {
    if (!u.stats) {
      u.stats = {
        gamesPlayed: 0,
        kills: 0,
        deaths: 0,
        wins: 0,
        playTimeMs: 0,
      };
    }
  }
}

async function saveUser(username) {
  // Uloz jednoho uzivatele - efektivnejsi nez ukladat vse
  if (mongoEnabled && mongoUsers) {
    try {
      const user = users[username];
      if (!user) return;
      await mongoUsers.replaceOne(
        { username },
        user,
        { upsert: true }
      );
      return;
    } catch (err) {
      console.error("[DB] MongoDB save error:", err.message);
    }
  }
  // Fallback na soubor (uloz vse)
  saveAllUsersToFile();
}

function saveAllUsersToFile() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("[DB] File save error:", err.message);
  }
}

// Wrapper aby existujici kod (saveUsers()) furt fungoval
function saveUsers() {
  if (mongoEnabled) {
    // Pri Mongo neukladame vse (pomale) - jen oznacime ze nekdo se zmenil
    // Volajici by mel pouzit saveUser(username) pro konkretni update
    // Ale aby kod fungoval i bez zmen, ulozime vse
    for (const u of Object.keys(users)) {
      mongoUsers.replaceOne({ username: u }, users[u], { upsert: true })
        .catch(err => console.error("[DB] save error:", err.message));
    }
  } else {
    saveAllUsersToFile();
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function validateUsername(username) {
  if (typeof username !== "string") return "Invalid username";
  username = username.trim();
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 16) return "Username max 16 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Only letters, numbers, _ and -";
  return null; // OK
}

function validatePassword(password) {
  if (typeof password !== "string") return "Invalid password";
  if (password.length < 4) return "Password must be at least 4 characters";
  if (password.length > 64) return "Password too long";
  return null;
}

function registerUser(username, password) {
  const uErr = validateUsername(username);
  if (uErr) return { ok: false, error: uErr };
  const pErr = validatePassword(password);
  if (pErr) return { ok: false, error: pErr };

  const lcUsername = username.toLowerCase();
  // Hledej case-insensitive
  for (const u of Object.keys(users)) {
    if (u.toLowerCase() === lcUsername) {
      return { ok: false, error: "Username already taken" };
    }
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  users[username] = {
    username,
    passwordHash,
    salt,
    isAdmin: false,
    isTester: false,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    // Statistiky
    stats: {
      gamesPlayed: 0,    // pocet odehranych zapasu (matchu)
      kills: 0,          // celkem killu
      deaths: 0,         // celkem smrti
      wins: 0,           // pocet vyhranych matchu
      playTimeMs: 0,     // celkovy cas ve hre (millisekundy)
    },
  };
  saveUsers();

  // Vytvor session
  const token = generateToken();
  sessions.set(token, { username, createdAt: Date.now(), lastUsedAt: Date.now() });

  return { ok: true, token, username, isAdmin: false, isTester: false };
}

function loginUser(username, password) {
  const uErr = validateUsername(username);
  if (uErr) return { ok: false, error: "Invalid credentials" };

  // Najdi case-insensitive
  let user = null;
  let actualUsername = null;
  const lcUsername = username.toLowerCase();
  for (const u of Object.keys(users)) {
    if (u.toLowerCase() === lcUsername) {
      user = users[u];
      actualUsername = u;
      break;
    }
  }
  if (!user) return { ok: false, error: "Invalid credentials" };

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: "Invalid credentials" };

  user.lastLoginAt = Date.now();
  saveUsers();

  const token = generateToken();
  sessions.set(token, { username: actualUsername, createdAt: Date.now(), lastUsedAt: Date.now() });

  return { ok: true, token, username: actualUsername, isAdmin: !!user.isAdmin, isTester: !!user.isTester };
}

function validateSession(token) {
  if (!token || typeof token !== "string") return null;
  const data = sessions.get(token);
  if (!data) return null;
  if (Date.now() - data.lastUsedAt > SESSION_LIFETIME_MS) {
    sessions.delete(token);
    return null;
  }
  data.lastUsedAt = Date.now();
  const user = users[data.username];
  if (!user) {
    sessions.delete(token);
    return null;
  }
  return { username: data.username, isAdmin: !!user.isAdmin, isTester: !!user.isTester };
}

function revokeSession(token) {
  if (token) sessions.delete(token);
}

// Cleanup starych session kazdou hodinu
setInterval(() => {
  const now = Date.now();
  for (const [t, data] of sessions) {
    if (now - data.lastUsedAt > SESSION_LIFETIME_MS) {
      sessions.delete(t);
    }
  }
}, 60 * 60 * 1000);

// Promote uzivatele na admina pomoci hesla
function promoteToAdmin(username, providedPassword) {
  if (providedPassword !== ADMIN_PASSWORD) return false;
  const user = users[username];
  if (!user) return false;
  user.isAdmin = true;
  saveUsers();
  return true;
}

// Promote uzivatele na testera
function promoteToTester(username, providedPassword) {
  if (providedPassword !== TESTER_PASSWORD) return false;
  const user = users[username];
  if (!user) return false;
  user.isTester = true;
  saveUsers();
  return true;
}

// Inicializace databaze a nacteni uzivatelu (asynchronne)
(async () => {
  await initMongo();
  await loadUsers();
  loadFriendsFile(); // file fallback pro pratele
  loadFeedbackFile(); // file fallback pro feedback
})();

// Zpetna kompatibilita - admin token system jeste zustava pro chat /login prikaz
function generateAdminToken() {
  return generateToken();
}
function validateAdminToken(token) {
  const session = validateSession(token);
  return session?.isAdmin === true;
}
function revokeAdminToken(token) {
  revokeSession(token);
}

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

// User registrace
app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  const result = registerUser(username, password);
  res.json(result);
});

// User login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const result = loginUser(username, password);
  res.json(result);
});

// Logout - revokne session
app.post("/api/logout", (req, res) => {
  const { token } = req.body || {};
  revokeSession(token);
  res.json({ ok: true });
});

// Validace session - klient pri startu zkontroluje jestli ma platny token
app.post("/api/me", (req, res) => {
  const { token } = req.body || {};
  const session = validateSession(token);
  if (session) {
    res.json({ ok: true, username: session.username, isAdmin: session.isAdmin, isTester: session.isTester });
  } else {
    res.json({ ok: false });
  }
});

// ============================================================
// FRIENDS API
// ============================================================
// Format friendship dokumentu v Mongo:
// { from: "alice", to: "bob", status: "pending" | "accepted", createdAt: timestamp }
// "pending" znamena ze "from" poslal request "to"
// "accepted" znamena ze obema pratele
// Pri accept se vlastne dokument prepise, takze je vzdy jen 1 dokument na par.

// Helpper - vrati session nebo posle 401
function requireAuth(req, res) {
  const token = req.body?.token || req.query?.token;
  const session = validateSession(token);
  if (!session) {
    res.status(401).json({ ok: false, error: "Not logged in" });
    return null;
  }
  return session;
}

// Vyhledavani uzivatelu podle jmena (substring match, case-insensitive)
app.post("/api/users/search", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  const query = (req.body?.query || "").toString().trim();
  if (query.length < 2) {
    res.json({ ok: true, users: [] });
    return;
  }
  const lcQuery = query.toLowerCase();

  // Pri Mongo se zeptame primo DB (efektivnejsi)
  if (mongoEnabled && mongoUsers) {
    try {
      const escaped = lcQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const docs = await mongoUsers.find({
        username: { $regex: escaped, $options: "i" },
      }).limit(20).toArray();
      const results = docs
        .filter((u) => u.username !== session.username)
        .map((u) => ({
          username: u.username,
          isAdmin: !!u.isAdmin,
          isTester: !!u.isTester,
        }));
      res.json({ ok: true, users: results });
      return;
    } catch (err) {
      console.error("[FRIENDS] Search error:", err.message);
    }
  }

  // Fallback - filter z in-memory users objektu
  const results = [];
  for (const [username, user] of Object.entries(users)) {
    if (username.toLowerCase().includes(lcQuery) && username !== session.username) {
      results.push({
        username,
        isAdmin: !!user.isAdmin,
        isTester: !!user.isTester,
      });
      if (results.length >= 20) break;
    }
  }
  res.json({ ok: true, users: results });
});

// Helper - emit event vsem socketum daneho usera (pro live updates)
function emitToUser(username, event, data) {
  for (const [id, sock] of io.sockets.sockets) {
    if (sock.data?.username === username) {
      sock.emit(event, data);
    }
  }
}

// ============================================================
// STATS API
// ============================================================

// Stats prihlaseneho uzivatele
app.post("/api/stats/me", (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  const user = users[session.username];
  if (!user) {
    res.json({ ok: false, error: "User not found" });
    return;
  }
  const stats = user.stats || { gamesPlayed: 0, kills: 0, deaths: 0, wins: 0, playTimeMs: 0 };
  res.json({ ok: true, stats });
});

// Globalni stats - soucet pres vsechny uzivatele
app.get("/api/stats/global", (_req, res) => {
  let totalPlayers = 0;
  let totalGames = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalPlayTimeMs = 0;
  for (const u of Object.values(users)) {
    totalPlayers++;
    if (u.stats) {
      totalGames += u.stats.gamesPlayed || 0;
      totalKills += u.stats.kills || 0;
      totalDeaths += u.stats.deaths || 0;
      totalPlayTimeMs += u.stats.playTimeMs || 0;
    }
  }
  res.json({
    ok: true,
    stats: {
      totalPlayers,
      totalGames,
      totalKills,
      totalDeaths,
      totalPlayTimeMs,
    },
  });
});

// Leaderboard - top hraci serazeni podle killu
app.get("/api/stats/leaderboard", (req, res) => {
  const sortBy = (req.query?.sort || "kills").toString();
  const limit = Math.min(parseInt(req.query?.limit) || 20, 100);

  const list = [];
  for (const [username, u] of Object.entries(users)) {
    const s = u.stats || { gamesPlayed: 0, kills: 0, deaths: 0, wins: 0, playTimeMs: 0 };
    list.push({
      username,
      isAdmin: !!u.isAdmin,
      isTester: !!u.isTester,
      gamesPlayed: s.gamesPlayed || 0,
      kills: s.kills || 0,
      deaths: s.deaths || 0,
      wins: s.wins || 0,
      playTimeMs: s.playTimeMs || 0,
    });
  }

  // Sort podle vybraneho parametru
  list.sort((a, b) => {
    if (sortBy === "wins") return b.wins - a.wins;
    if (sortBy === "games") return b.gamesPlayed - a.gamesPlayed;
    if (sortBy === "hours") return b.playTimeMs - a.playTimeMs;
    return b.kills - a.kills; // default
  });

  res.json({ ok: true, players: list.slice(0, limit) });
});

// ============================================================
// FEEDBACK API
// ============================================================

// Posli feedback (kdokoli, i guest)
app.post("/api/feedback/submit", async (req, res) => {
  const rating = parseInt(req.body?.rating) || 0;
  const bugs = (req.body?.bugs || "").toString().slice(0, 1000).trim();
  const suggestions = (req.body?.suggestions || "").toString().slice(0, 1000).trim();
  const likes = (req.body?.likes || "").toString().slice(0, 500).trim();

  if (rating < 1 || rating > 5) {
    res.json({ ok: false, error: "Invalid rating" });
    return;
  }

  // Username z token (pokud je prihlasen) nebo anonymous
  const token = req.body?.token;
  const session = validateSession(token);
  const username = session ? session.username : "anonymous";

  const entry = {
    username,
    rating,
    bugs,
    suggestions,
    likes,
    createdAt: Date.now(),
  };

  if (mongoEnabled && mongoFeedback) {
    try {
      await mongoFeedback.insertOne(entry);
    } catch (err) {
      console.error("[FEEDBACK] Submit error:", err.message);
    }
  } else {
    feedbackData.push(entry);
    saveFeedbackFile();
  }
  console.log(`[FEEDBACK] ${username} - ${rating}* - bugs: ${bugs.slice(0, 30)} - suggestions: ${suggestions.slice(0, 30)}`);
  res.json({ ok: true });
});

// Admin endpoint - prehled vseho feedbacku
app.post("/api/feedback/list", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  const user = users[session.username];
  if (!user || !user.isAdmin) {
    res.status(403).json({ ok: false, error: "Admin only" });
    return;
  }

  let all = [];
  if (mongoEnabled && mongoFeedback) {
    try {
      const docs = await mongoFeedback.find({}).sort({ createdAt: -1 }).limit(100).toArray();
      all = docs.map((d) => {
        const { _id, ...rest } = d;
        return rest;
      });
    } catch (err) {
      console.error("[FEEDBACK] List error:", err.message);
    }
  } else {
    all = feedbackData.slice().reverse().slice(0, 100);
  }

  // Statistiky
  const totalCount = all.length;
  const avgRating = totalCount > 0
    ? (all.reduce((sum, f) => sum + f.rating, 0) / totalCount).toFixed(2)
    : 0;

  res.json({ ok: true, items: all, totalCount, avgRating });
});

// Zjisti zda uzivatel uz poslal feedback (aby se neopakoval formular)
app.post("/api/feedback/check", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) {
    res.json({ ok: true, submitted: false });
    return;
  }

  let count = 0;
  if (mongoEnabled && mongoFeedback) {
    try {
      count = await mongoFeedback.countDocuments({ username: session.username });
    } catch (err) {}
  } else {
    count = feedbackData.filter((f) => f.username === session.username).length;
  }
  res.json({ ok: true, submitted: count > 0, count });
});

// Posli friend request
app.post("/api/friends/request", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  const targetUsername = (req.body?.username || "").toString().trim();
  if (!targetUsername || targetUsername === session.username) {
    res.json({ ok: false, error: "Invalid target" });
    return;
  }
  if (!users[targetUsername]) {
    res.json({ ok: false, error: "User not found" });
    return;
  }

  if (mongoEnabled && mongoFriends) {
    try {
      // Zkontroluj zda uz neexistuje
      const existing = await mongoFriends.findOne({
        $or: [
          { from: session.username, to: targetUsername },
          { from: targetUsername, to: session.username },
        ],
      });
      if (existing) {
        if (existing.status === "accepted") {
          res.json({ ok: false, error: "Already friends" });
        } else if (existing.from === session.username) {
          res.json({ ok: false, error: "Request already sent" });
        } else {
          // Druhy poslal request prvni - misto duplikatu rovnou accept
          await mongoFriends.updateOne(
            { from: targetUsername, to: session.username },
            { $set: { status: "accepted", acceptedAt: Date.now() } }
          );
          emitToUser(session.username, "friends_changed", {});
          emitToUser(targetUsername, "friends_changed", {});
          res.json({ ok: true, autoAccepted: true });
        }
        return;
      }
      await mongoFriends.insertOne({
        from: session.username,
        to: targetUsername,
        status: "pending",
        createdAt: Date.now(),
      });
      // Notify obema klientum aby se panel updatnul
      emitToUser(session.username, "friends_changed", {});
      emitToUser(targetUsername, "friends_changed", {});
      res.json({ ok: true });
    } catch (err) {
      console.error("[FRIENDS] Request error:", err.message);
      res.json({ ok: false, error: "Server error" });
    }
  } else {
    // File fallback
    const existing = friendsData.find((f) =>
      (f.from === session.username && f.to === targetUsername) ||
      (f.from === targetUsername && f.to === session.username)
    );
    if (existing) {
      if (existing.status === "accepted") {
        res.json({ ok: false, error: "Already friends" });
      } else if (existing.from === session.username) {
        res.json({ ok: false, error: "Request already sent" });
      } else {
        existing.status = "accepted";
        existing.acceptedAt = Date.now();
        saveFriendsFile();
        res.json({ ok: true, autoAccepted: true });
      }
      return;
    }
    friendsData.push({
      from: session.username,
      to: targetUsername,
      status: "pending",
      createdAt: Date.now(),
    });
    saveFriendsFile();
    emitToUser(session.username, "friends_changed", {});
    emitToUser(targetUsername, "friends_changed", {});
    res.json({ ok: true });
  }
});

// Akceptuj friend request
app.post("/api/friends/accept", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  const fromUsername = (req.body?.username || "").toString().trim();
  if (!fromUsername) {
    res.json({ ok: false, error: "Invalid" });
    return;
  }
  if (mongoEnabled && mongoFriends) {
    try {
      const result = await mongoFriends.updateOne(
        { from: fromUsername, to: session.username, status: "pending" },
        { $set: { status: "accepted", acceptedAt: Date.now() } }
      );
      if (result.matchedCount === 0) {
        res.json({ ok: false, error: "Request not found" });
      } else {
        emitToUser(session.username, "friends_changed", {});
        emitToUser(fromUsername, "friends_changed", {});
        res.json({ ok: true });
      }
    } catch (err) {
      res.json({ ok: false, error: "Server error" });
    }
  } else {
    const f = friendsData.find((x) => x.from === fromUsername && x.to === session.username && x.status === "pending");
    if (!f) {
      res.json({ ok: false, error: "Request not found" });
    } else {
      f.status = "accepted";
      f.acceptedAt = Date.now();
      saveFriendsFile();
      emitToUser(session.username, "friends_changed", {});
      emitToUser(fromUsername, "friends_changed", {});
      res.json({ ok: true });
    }
  }
});

// Odmítni / smaž friend request nebo přátelství
app.post("/api/friends/remove", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  const otherUsername = (req.body?.username || "").toString().trim();
  if (!otherUsername) {
    res.json({ ok: false, error: "Invalid" });
    return;
  }
  if (mongoEnabled && mongoFriends) {
    try {
      await mongoFriends.deleteOne({
        $or: [
          { from: session.username, to: otherUsername },
          { from: otherUsername, to: session.username },
        ],
      });
      emitToUser(session.username, "friends_changed", {});
      emitToUser(otherUsername, "friends_changed", {});
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: "Server error" });
    }
  } else {
    friendsData = friendsData.filter((f) =>
      !((f.from === session.username && f.to === otherUsername) ||
        (f.from === otherUsername && f.to === session.username))
    );
    saveFriendsFile();
    emitToUser(session.username, "friends_changed", {});
    emitToUser(otherUsername, "friends_changed", {});
    res.json({ ok: true });
  }
});

// Get friend list - rozdeli na: friends, incoming requests, outgoing requests
app.post("/api/friends/list", async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;

  let all = [];
  if (mongoEnabled && mongoFriends) {
    try {
      all = await mongoFriends.find({
        $or: [
          { from: session.username },
          { to: session.username },
        ],
      }).toArray();
    } catch (err) {
      console.error("[FRIENDS] List error:", err.message);
      res.json({ ok: false, error: "Server error" });
      return;
    }
  } else {
    all = friendsData.filter((f) => f.from === session.username || f.to === session.username);
  }

  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const f of all) {
    const other = f.from === session.username ? f.to : f.from;
    const otherUser = users[other];
    const meta = {
      username: other,
      isOnline: isUserOnline(other),
      isAdmin: !!(otherUser?.isAdmin),
      isTester: !!(otherUser?.isTester),
    };
    if (f.status === "accepted") {
      friends.push(meta);
    } else if (f.status === "pending") {
      if (f.to === session.username) incoming.push(meta);
      else outgoing.push(meta);
    }
  }
  // Online priatele nahoru
  friends.sort((a, b) => (b.isOnline - a.isOnline) || a.username.localeCompare(b.username));
  res.json({ ok: true, friends, incoming, outgoing });
});

// Helper - zkontroluj jestli je uzivatel online (v nejakem socketu prihlasen)
function isUserOnline(username) {
  for (const [id, sock] of io.sockets.sockets) {
    if (sock.data?.username === username) return true;
  }
  return false;
}

app.get("/api/rooms", (_req, res) => {
  const list = [];
  for (const [id, room] of rooms) {
    list.push({
      id, name: room.name,
      playerCount: room.game.players.size,
      maxPlayers: SHARED.ROUND.MAX_PLAYERS,
      mapKey: room.game.mapKey,
      phase: room.game.phase,
    });
  }
  res.json({ rooms: list });
});

const rooms = new Map();
const socketRoom = new Map();

function genRoomId() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function createRoom(name, mapKey) {
  let id = genRoomId();
  while (rooms.has(id)) id = genRoomId();
  const game = new Game(id, mapKey);
  game.loadMap(mapKey);
  const room = { id, name: name || `Room ${id}`, game, lastActive: Date.now() };
  rooms.set(id, room);
  return room;
}

function removeEmptyRoom(roomId) {
  const r = rooms.get(roomId);
  if (r && r.game.players.size === 0) rooms.delete(roomId);
}

io.on("connection", (socket) => {
  let playerName = "Player";

  // Ping measurement - server posila ping, klient odpovi pong, mereme RTT
  socket.data.ping = 0;
  let lastPingTime = 0;
  const pingInterval = setInterval(() => {
    lastPingTime = Date.now();
    socket.emit("ping_request", { t: lastPingTime });
  }, 2000);
  socket.on("ping_response", (data) => {
    const rtt = Date.now() - (data?.t || lastPingTime);
    if (rtt >= 0 && rtt < 5000) {
      socket.data.ping = rtt;
      // Aktualizuj ping i v Game state pokud je hrac v mistnosti
      const roomId = socketRoom.get(socket.id);
      const room = rooms.get(roomId);
      if (room) {
        const p = room.game.players.get(socket.id);
        if (p) p.ping = rtt;
      }
    }
  });
  socket.on("disconnect", () => clearInterval(pingInterval));

  socket.on("hello", (data, ack) => {
    socket.data.isTouch = !!data?.isTouch;

    // Pokus se o validaci session tokenu (registrovany ucet)
    let sessionUsername = null;
    if (data?.sessionToken) {
      const session = validateSession(data.sessionToken);
      if (session) {
        sessionUsername = session.username;
        socket.data.sessionToken = data.sessionToken;
        socket.data.username = session.username;
        socket.data.isAdmin = session.isAdmin;
        socket.data.isTester = session.isTester;
      }
    }

    // Pokud nema validni session, jen pouzij jmeno z dat (guest)
    if (!sessionUsername) {
      playerName = (data?.name || "Guest").toString().slice(0, 16);
    } else {
      // Prihlaseny uzivatel - pouzij jeho username
      playerName = sessionUsername;
    }

    if (typeof ack === "function") {
      ack({
        ok: true, id: socket.id,
        username: sessionUsername,
        isAdmin: !!socket.data.isAdmin,
        isTester: !!socket.data.isTester,
        shared: serializeShared(),
        rooms: [...rooms.values()].map((r) => ({
          id: r.id, name: r.name,
          playerCount: r.game.players.size,
          maxPlayers: SHARED.ROUND.MAX_PLAYERS,
          mapKey: r.game.mapKey, phase: r.game.phase,
        })),
      });
    }
  });

  socket.on("create_room", (data, ack) => {
    const mapKey = SHARED.MAPS[data?.mapKey] ? data.mapKey : "skybridge";
    const room = createRoom(data?.name, mapKey);
    joinRoom(socket, room.id, playerName, ack);
  });

  socket.on("join_room", (data, ack) => {
    const roomId = (data?.roomId || "").toString().toUpperCase();
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof ack === "function") ack({ ok: false, error: "Room not found" });
      return;
    }
    if (room.game.players.size >= SHARED.ROUND.MAX_PLAYERS) {
      if (typeof ack === "function") ack({ ok: false, error: "Room is full" });
      return;
    }
    joinRoom(socket, roomId, playerName, ack);
  });

  socket.on("quick_play", (_data, ack) => {
    let target = null;
    for (const r of rooms.values()) {
      if (r.game.phase === "lobby" && r.game.players.size < SHARED.ROUND.MAX_PLAYERS) {
        target = r;
        break;
      }
    }
    if (!target) target = createRoom("Quickplay", "skybridge");
    joinRoom(socket, target.id, playerName, ack);
  });

  socket.on("ready", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    room.game.setReady(socket.id, !!data?.ready);
    room.game.tryStartMatch();
  });

  // Host muze menit nastaveni matche (jen v lobby)
  socket.on("set_match_settings", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.game.setMatchSettings(socket.id, data || {})) {
      io.to(roomId).emit("room_info", roomInfo(room));
    }
  });

  // Hrac si vybere barvu
  socket.on("set_color", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.game.setColor(socket.id, data?.color)) {
      io.to(roomId).emit("room_info", roomInfo(room));
    }
  });

  // Globalni admin status - per socket (drzime to mimo Game protoze
  // /login muze fungovat i mimo mistnost)
  // Pouzivame socket.data aby to bylo dostupne i z joinRoom
  socket.data.isAdmin = false;

  // Konzolove prikazy (jako CS) - pouze pro adminy (krome /login)
  let nextBotIdNum = 1;
  function consoleHandler(data) {
    const cmd = (data?.cmd || "").toString().trim();
    if (!cmd) return;

    // /login funguje VSEM, i mimo mistnost (admin/tester status je per-socket)
    if (cmd.startsWith("/login ") || cmd.startsWith("login ")) {
      const password = cmd.replace(/^\/?login\s+/, "").trim();
      if (password === ADMIN_PASSWORD) {
        socket.data.isAdmin = true;
        // Pokud je prihlaseny, ulozit do users.json (perzistentni)
        if (socket.data.username) {
          promoteToAdmin(socket.data.username, password);
          sendConsole(socket, "[OK] Admin status ulozen do uctu " + socket.data.username, "ok");
        } else {
          // Nepritlaseny - jen per-socket admin (ztrati se po reconnect)
          sendConsole(socket, "[OK] Admin status povolen (jen pro tuto session, prihlas se pro perzistenci)", "ok");
        }
        // Posli klientovi update statusu (aby se UI aktualizovalo bez reloglu)
        socket.emit("user_status_update", {
          username: socket.data.username,
          isAdmin: true,
          isTester: !!socket.data.isTester,
        });
        // Pokud je v mistnosti, oznam vsem
        const roomId = socketRoom.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
          const me = room.game.players.get(socket.id);
          if (me) {
            me.isAdmin = true;
            io.to(roomId).emit("chat", {
              id: "system",
              name: "SYSTEM",
              color: "#ffd700",
              text: `[ADMIN] ${me.name} se stal adminem`,
              time: Date.now(),
            });
            io.to(roomId).emit("room_info", roomInfo(room));
          }
        }
      } else if (password === TESTER_PASSWORD) {
        socket.data.isTester = true;
        if (socket.data.username) {
          promoteToTester(socket.data.username, password);
          sendConsole(socket, "[OK] Tester status ulozen do uctu " + socket.data.username, "ok");
        } else {
          sendConsole(socket, "[OK] Tester status povolen (jen pro tuto session, prihlas se pro perzistenci)", "ok");
        }
        socket.emit("user_status_update", {
          username: socket.data.username,
          isAdmin: !!socket.data.isAdmin,
          isTester: true,
        });
        // Oznam v mistnosti
        const roomId = socketRoom.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
          const me = room.game.players.get(socket.id);
          if (me) {
            me.isTester = true;
            io.to(roomId).emit("chat", {
              id: "system",
              name: "SYSTEM",
              color: "#54e0ff",
              text: `[TESTER] ${me.name} se stal testerem`,
              time: Date.now(),
            });
            io.to(roomId).emit("room_info", roomInfo(room));
          }
        }
      } else {
        sendConsole(socket, "[FAIL] Nespravne heslo", "error");
      }
      return;
    }

    if (cmd === "/logout" || cmd === "logout") {
      if (socket.data.isAdmin) {
        socket.data.isAdmin = false;
        revokeAdminToken(socket.data.adminToken);
        socket.data.adminToken = null;
        socket.emit("admin_token", { token: null }); // klient si smaze
        sendConsole(socket, "Admin status odebran", "info");
        const roomId = socketRoom.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
          const me = room.game.players.get(socket.id);
          if (me) {
            me.isAdmin = false;
            io.to(roomId).emit("room_info", roomInfo(room));
          }
        }
      }
      return;
    }

    // Pro vsechny ostatni prikazy musime byt v mistnosti
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) {
      sendConsole(socket, "Nejsi v mistnosti - pouze /login je dostupny", "error");
      return;
    }

    const me = room.game.players.get(socket.id);
    if (!me) return;

    // Sync admin status z global do player objektu
    if (socket.data.isAdmin && !me.isAdmin) {
      me.isAdmin = true;
      io.to(roomId).emit("room_info", roomInfo(room));
    }
    // Sync tester status
    if (socket.data.isTester && !me.isTester) {
      me.isTester = true;
      io.to(roomId).emit("room_info", roomInfo(room));
    }

    // Admin check pro vsechny ostatni prikazy
    if (!me.isAdmin) {
      sendConsole(socket, "[FAIL] Permission denied. Pouze admin muze pouzivat konzoli.", "error");
      sendConsole(socket, "  Pro prihlaseni napis: /login <heslo>", "info");
      return;
    }

    const parts = cmd.split(/\s+/);
    const main = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      if (main === "help") {
        sendConsole(socket, "Prikazy:", "info");
        sendConsole(socket, "  /login <heslo>   - prihlasit se jako admin", "info");
        sendConsole(socket, "  /logout          - odhlasit se", "info");
        sendConsole(socket, "  bot add [jmeno]  - prida bota", "info");
        sendConsole(socket, "  bot remove       - odebere posledniho bota", "info");
        sendConsole(socket, "  bot clear        - odebere vsechny boty", "info");
        sendConsole(socket, "  bot move on/off  - boti se hybou nebo stoji", "info");
        sendConsole(socket, "  kill             - zabij sam sebe", "info");
        sendConsole(socket, "  give <weapon>    - daruj si zbran (pistol/shotgun/rocket/laser)", "info");
        sendConsole(socket, "  map <name>       - zmen mapu (jen v lobby)", "info");
        sendConsole(socket, "  start            - spusti zapas (i bez ready check)", "info");
        sendConsole(socket, "  list             - vypis hracu", "info");
      }
      else if (main === "bot" && args[0] === "add") {
        if (room.game.players.size >= SHARED.ROUND.MAX_PLAYERS) {
          return sendConsole(socket, "Mistnost je plna (max " + SHARED.ROUND.MAX_PLAYERS + ")", "error");
        }
        const botName = args[1] || ("Bot" + (nextBotIdNum++));
        const botId = "bot_" + Math.random().toString(36).slice(2, 9);
        const bot = room.game.addPlayer(botId, botName, true);
        if (bot) {
          // Pokud uz hra bezi, hned bota spawni
          if (room.game.phase !== "lobby") {
            const spawns = room.game.map.spawns;
            const s = spawns[Math.floor(Math.random() * spawns.length)];
            bot.x = s.x; bot.y = s.y;
            bot.alive = true;
            bot.hp = SHARED.PLAYER.MAX_HEALTH;
          }
          io.to(roomId).emit("room_info", roomInfo(room));
          sendConsole(socket, `Pridan bot: ${botName}`, "ok");
        } else {
          sendConsole(socket, "Nepodarilo se pridat bota", "error");
        }
      }
      else if (main === "bot" && args[0] === "remove") {
        const bots = [...room.game.players.values()].filter(p => p.isBot);
        if (!bots.length) return sendConsole(socket, "Zadny bot neni v mistnosti", "error");
        const last = bots[bots.length - 1];
        room.game.removePlayer(last.id);
        io.to(roomId).emit("room_info", roomInfo(room));
        sendConsole(socket, `Odebran bot: ${last.name}`, "ok");
      }
      else if (main === "bot" && args[0] === "clear") {
        const bots = [...room.game.players.values()].filter(p => p.isBot);
        for (const b of bots) room.game.removePlayer(b.id);
        io.to(roomId).emit("room_info", roomInfo(room));
        sendConsole(socket, `Odebrano ${bots.length} botu`, "ok");
      }
      else if (main === "bot" && args[0] === "move") {
        const enable = args[1] === "on";
        for (const p of room.game.players.values()) {
          if (p.isBot) p.botMove = enable;
        }
        sendConsole(socket, `Bot pohyb: ${enable ? "ON" : "OFF"}`, "ok");
      }
      else if (main === "kill") {
        if (me && me.alive) {
          room.game.killPlayer(me, null, "console");
          sendConsole(socket, "Sebevrazda", "ok");
        } else {
          sendConsole(socket, "Nezijes", "error");
        }
      }
      else if (main === "give") {
        const wep = args[0]?.toLowerCase();
        if (!wep || !SHARED.WEAPONS[wep]) {
          return sendConsole(socket, "Pouziti: give pistol|shotgun|rocket|laser", "error");
        }
        if (!me || !me.alive) return sendConsole(socket, "Nezijes", "error");
        me.weapon = wep;
        me.ammo = SHARED.WEAPONS[wep].ammo;
        sendConsole(socket, `Mas: ${SHARED.WEAPONS[wep].name}`, "ok");
      }
      else if (main === "map") {
        if (room.game.phase !== "lobby") {
          return sendConsole(socket, "Mapu lze zmenit jen v lobby", "error");
        }
        const mapKey = args[0]?.toLowerCase();
        if (!SHARED.MAPS[mapKey]) {
          return sendConsole(socket, "Mapy: " + Object.keys(SHARED.MAPS).join(", "), "error");
        }
        room.game.loadMap(mapKey);
        io.to(roomId).emit("room_info", roomInfo(room));
        sendConsole(socket, `Mapa zmenena na: ${mapKey}`, "ok");
      }
      else if (main === "start") {
        if (room.game.phase !== "lobby") {
          return sendConsole(socket, "Zapas uz bezi", "error");
        }
        if (room.game.players.size < SHARED.ROUND.MIN_PLAYERS) {
          return sendConsole(socket, `Potreba alespon ${SHARED.ROUND.MIN_PLAYERS} hracu (vc botu)`, "error");
        }
        // Forcni vsechny ready a spust
        for (const p of room.game.players.values()) p.ready = true;
        room.game.startMatch();
        sendConsole(socket, "Zapas spusten!", "ok");
      }
      else if (main === "list") {
        sendConsole(socket, `Hraci v mistnosti (${room.game.players.size}):`, "info");
        for (const p of room.game.players.values()) {
          sendConsole(socket, `  ${p.isBot ? "[BOT]" : "     "} ${p.name} (hp:${Math.round(p.hp)} ${p.alive ? "alive" : "dead"})`, "info");
        }
      }
      else {
        sendConsole(socket, `Neznamy prikaz: ${main}. Napis 'help'`, "error");
      }
    } catch (e) {
      sendConsole(socket, "Chyba: " + e.message, "error");
    }
  }
  // Registrace event handleru - volá interni consoleHandler
  socket.on("console", consoleHandler);

  function sendConsole(s, text, type) {
    s.emit("console", { text, type: type || "info" });
    // Take posli jako chat (aby to videli mobilni uzivatele)
    const colors = {
      ok: "#4ade80",
      error: "#ef4444",
      info: "#94a3c4",
    };
    s.emit("chat", {
      id: "system",
      name: "CONSOLE",
      color: colors[type] || colors.info,
      text,
      time: Date.now(),
    });
  }

  socket.on("input", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    room.game.setInput(socket.id, data || {});
  });

  // Chat - rate limit a max delka
  let lastChatTime = 0;
  const chatHistory = [];
  socket.on("chat", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.game.players.get(socket.id);
    if (!player) return;

    const now = Date.now();
    let text = (data?.text || "").toString().slice(0, 100).trim();
    if (!text) return;

    // Rate limit pouze pro normalni chat zpravy, ne pro prikazy
    const isCommand = text.startsWith("/");
    if (!isCommand) {
      // Rate limit: max 1 zprava za 500ms
      if (now - lastChatTime < 500) return;
      // Anti-spam: max 5 zprav za 5 sekund
      chatHistory.push(now);
      while (chatHistory.length && now - chatHistory[0] > 5000) chatHistory.shift();
      if (chatHistory.length > 5) return;
      lastChatTime = now;
    }

    // Admin login - heslo se nikdy nesmi objevit v chatu
    if (text.startsWith("/login ")) {
      const password = text.slice(7).trim();
      if (password === ADMIN_PASSWORD) {
        player.isAdmin = true;
        socket.data.isAdmin = true;
        // Pokud je prihlaseny ucet, ulozit
        if (socket.data.username) {
          promoteToAdmin(socket.data.username, password);
        }
        // Posli klientovi update statusu (aby se UI aktualizovalo bez reloglu)
        socket.emit("user_status_update", {
          username: socket.data.username,
          isAdmin: true,
          isTester: !!socket.data.isTester,
        });
        socket.emit("chat", {
          id: "system",
          name: "SYSTEM",
          color: "#ffd700",
          text: `[OK] Admin status povolen pro ${player.name}`,
          time: now,
        });
        io.to(roomId).emit("chat", {
          id: "system",
          name: "SYSTEM",
          color: "#ffd700",
          text: `[ADMIN] ${player.name} se stal adminem`,
          time: now,
        });
        io.to(roomId).emit("room_info", roomInfo(room));
      } else if (password === TESTER_PASSWORD) {
        player.isTester = true;
        socket.data.isTester = true;
        if (socket.data.username) {
          promoteToTester(socket.data.username, password);
        }
        socket.emit("user_status_update", {
          username: socket.data.username,
          isAdmin: !!socket.data.isAdmin,
          isTester: true,
        });
        socket.emit("chat", {
          id: "system",
          name: "SYSTEM",
          color: "#54e0ff",
          text: `[OK] Tester status povolen pro ${player.name}`,
          time: now,
        });
        io.to(roomId).emit("chat", {
          id: "system",
          name: "SYSTEM",
          color: "#54e0ff",
          text: `[TESTER] ${player.name} se stal testerem`,
          time: now,
        });
        io.to(roomId).emit("room_info", roomInfo(room));
      } else {
        socket.emit("chat", {
          id: "system",
          name: "SYSTEM",
          color: "#ff5e3d",
          text: "[FAIL] Nespravne heslo",
          time: now,
        });
      }
      return; // /login se nikdy nebroadcastuje!
    }

    if (text === "/logout" && player.isAdmin) {
      player.isAdmin = false;
      socket.data.isAdmin = false;
      revokeAdminToken(socket.data.adminToken);
      socket.data.adminToken = null;
      socket.emit("admin_token", { token: null });
      socket.emit("chat", {
        id: "system",
        name: "SYSTEM",
        color: "#94a3c4",
        text: "Admin status odebran",
        time: now,
      });
      io.to(roomId).emit("room_info", roomInfo(room));
      return;
    }

    // Pokud zprava zacina lomitkem, zpracuj jako konzolovy prikaz
    // (umoznuje pouzivat /bot, /kill, /give, atd. z mobilu kde neni konzole)
    if (text.startsWith("/")) {
      const cmdText = text.slice(1).trim(); // odstran lomitko
      if (cmdText) {
        // Spust stejnou logiku jako "console" event
        consoleHandler({ cmd: cmdText });
      }
      return; // /command se nikdy nebroadcastuje
    }

    io.to(roomId).emit("chat", {
      id: socket.id,
      name: player.name,
      color: player.color,
      text,
      isAdmin: player.isAdmin,
      isTester: player.isTester,
      time: now,
    });
  });

  socket.on("leave_room", () => {
    leaveRoom(socket);
  });

  socket.on("change_map", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.game.phase !== "lobby") return;
    if (SHARED.MAPS[data?.mapKey]) {
      room.game.loadMap(data.mapKey);
      io.to(roomId).emit("room_info", roomInfo(room));
    }
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
  });
});

function joinRoom(socket, roomId, name, ack) {
  if (socketRoom.has(socket.id)) leaveRoom(socket);

  const room = rooms.get(roomId);
  if (!room) {
    if (typeof ack === "function") ack({ ok: false, error: "Room not found" });
    return;
  }

  // Phone-only mode - povolen jen pokud je klient na touch zarizeni
  // (host se vlastniho omezeni zbavi pres /logout/restart, ale pokud nastavi phoneOnly, musi byt taky touch)
  if (room.game.matchSettings.phoneOnly && !socket.data?.isTouch) {
    if (typeof ack === "function") ack({ ok: false, error: "This room is phone-only. Open on a mobile device." });
    return;
  }

  const p = room.game.addPlayer(socket.id, name);
  if (!p) {
    if (typeof ack === "function") ack({ ok: false, error: "Could not join" });
    return;
  }
  // Pokud je socket prihlaseny jako admin, nastav i player.isAdmin
  if (socket.data && socket.data.isAdmin) {
    p.isAdmin = true;
  }
  if (socket.data && socket.data.isTester) {
    p.isTester = true;
  }
  // Username (jen pokud je prihlasen) - pro tracking statistik
  if (socket.data && socket.data.username) {
    p.username = socket.data.username;
  }
  // Track time spent in matches
  p.matchStartTime = Date.now();
  socket.join(roomId);
  socketRoom.set(socket.id, roomId);

  console.log(`[JOIN] ${socket.id.slice(0,6)} (${name}) -> room ${roomId} - hracu v mistnosti: ${room.game.players.size}`);

  if (typeof ack === "function") {
    ack({
      ok: true, roomId, selfId: socket.id,
      mapKey: room.game.mapKey,
      shared: serializeShared(),
    });
  }
  io.to(roomId).emit("room_info", roomInfo(room));
}

function leaveRoom(socket) {
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room) {
    room.game.removePlayer(socket.id);

    // Pokud zustali jen boti, smaz cely room
    const realPlayers = [...room.game.players.values()].filter(p => !p.isBot);
    if (realPlayers.length === 0) {
      for (const p of [...room.game.players.values()]) {
        room.game.removePlayer(p.id);
      }
    }

    io.to(roomId).emit("room_info", roomInfo(room));
    if (room.game.players.size === 0) {
      removeEmptyRoom(roomId);
    } else if (room.game.phase !== "lobby" && room.game.players.size < SHARED.ROUND.MIN_PLAYERS) {
      room.game.returnToLobby();
    }
  }
  socket.leave(roomId);
  socketRoom.delete(socket.id);
}

function roomInfo(room) {
  return {
    id: room.id, name: room.name,
    mapKey: room.game.mapKey, phase: room.game.phase,
    hostId: room.game.hostId,
    matchSettings: { ...room.game.matchSettings },
    players: [...room.game.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color,
      ready: p.ready, score: p.score,
      isAdmin: !!p.isAdmin,
      isTester: !!p.isTester,
    })),
  };
}

function serializeShared() {
  return {
    WORLD_WIDTH: SHARED.WORLD_WIDTH,
    WORLD_HEIGHT: SHARED.WORLD_HEIGHT,
    PLAYER: SHARED.PLAYER,
    WEAPONS: SHARED.WEAPONS,
    PICKUP: SHARED.PICKUP,
    MAPS: SHARED.MAPS,
    TICK_RATE: SHARED.TICK_RATE,
    ROUND: SHARED.ROUND,
    COLORS: SHARED.COLORS,
  };
}

// Hlavni simulacni smycka
const TICK_MS = 1000 / SHARED.TICK_RATE;
let lastTickTime = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastTickTime) / 1000);
  lastTickTime = now;

  for (const [roomId, room] of rooms) {
    room.game.update(dt);
    const snap = room.game.snapshot();
    io.to(roomId).emit("state", snap);
  }

  for (const [id, room] of rooms) {
    if (room.game.players.size === 0) rooms.delete(id);
  }
}, TICK_MS);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`KNOCKFRIEND server bezi na portu ${PORT}`);
});