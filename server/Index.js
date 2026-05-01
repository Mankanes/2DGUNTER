// ============================================================
// Gun Mayhem - Backend
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
  TICK_RATE: 60,
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
    JUMP_VELOCITY: 720,
    DOUBLE_JUMP_VELOCITY: 640,
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
      name: "Rocket Launcher", damage: 45, splashDamage: 35, splashRadius: 130,
      fireRate: 0.95, bulletSpeed: 700, bulletGravity: 0.10, spread: 0.0,
      pelletsPerShot: 1, recoil: 520, knockback: 700,
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
        { x: 800, y: 180 }, { x: 800, y: 660 },
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
  }

  loadMap(mapKey) {
    if (!SHARED.MAPS[mapKey]) return;
    this.mapKey = mapKey;
    this.map = SHARED.MAPS[mapKey];
    this.platforms = this.map.platforms.map((p) => ({
      ...p, hp: p.hp || 0, destroyed: false,
    }));
  }

  addPlayer(socketId, name) {
    if (this.players.size >= SHARED.ROUND.MAX_PLAYERS) return null;
    const colorIndex = this.players.size;
    const player = {
      id: socketId,
      name: (name || "Player").slice(0, 16),
      color: SHARED.COLORS[colorIndex % SHARED.COLORS.length],
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
      ready: false,
      shotCountWindow: [],
    };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
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

    const spawns = this.map.spawns.slice();
    let i = 0;
    for (const p of this.players.values()) {
      const s = spawns[i % spawns.length];
      i++;
      p.x = s.x; p.y = s.y;
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
      if (p.score >= SHARED.ROUND.MATCH_WIN_SCORE) {
        matchWinner = p.id;
        break;
      }
    }
    if (matchWinner) {
      this.matchWinner = matchWinner;
      this.phase = "matchover";
      this.phaseTimer = 8.0;
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
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.phase === "playing" && p.respawnAt > 0) {
          p.respawnAt -= dt;
          if (p.respawnAt <= 0) p.respawnAt = 0;
        }
        continue;
      }

      const inp = p.input;
      const PL = SHARED.PLAYER;
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

      const damp = Math.exp(-PL.KNOCKBACK_DAMP * dt);
      p.knockbackVx *= damp;
      p.knockbackVy *= damp;

      const totalVx = p.vx + p.knockbackVx;
      const totalVy = p.vy + p.knockbackVy;

      this.moveAndCollide(p, totalVx * dt, totalVy * dt);

      if (p.onGround) p.jumpsLeft = PL.MAX_JUMPS;

      if (inp.switch && SHARED.WEAPONS[inp.switch]) {
        if (p.weapon !== inp.switch) {
          p.weapon = inp.switch;
          if (p.weapon === "pistol") p.ammo = Infinity;
        }
      }

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
        const falloff = 1 - dist / b.splashRadius;
        const dmg = (p.id === b.ownerId
          ? Math.round(b.splashDamage * 0.5 * falloff)
          : Math.round(b.splashDamage * falloff));
        if (p.id !== b.ownerId || dmg > 0) p.hp -= dmg;
        const nx = (cx - b.x) / (dist || 1);
        const ny = (cy - b.y) / (dist || 1);
        const force = b.knockback * falloff;
        p.knockbackVx += nx * force;
        p.knockbackVy += ny * force - 120;
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
    if (killerId && killerId !== victim.id) {
      const k = this.players.get(killerId);
      if (k) k.kills++;
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
        vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
        facing: p.facing, onGround: p.onGround,
        hp: Math.max(0, Math.round(p.hp)),
        alive: p.alive, weapon: p.weapon,
        ammo: p.ammo === Infinity ? -1 : p.ammo,
        score: p.score, kills: p.kills, deaths: p.deaths,
        ready: p.ready,
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

app.use(express.static(path.join(__dirname, "..", "public")));

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

  socket.on("hello", (data, ack) => {
    playerName = (data?.name || "Player").toString().slice(0, 16);
    if (typeof ack === "function") {
      ack({
        ok: true, id: socket.id,
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

  socket.on("input", (data) => {
    const roomId = socketRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    room.game.setInput(socket.id, data || {});
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

  const p = room.game.addPlayer(socket.id, name);
  if (!p) {
    if (typeof ack === "function") ack({ ok: false, error: "Could not join" });
    return;
  }
  socket.join(roomId);
  socketRoom.set(socket.id, roomId);

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
    players: [...room.game.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color,
      ready: p.ready, score: p.score,
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
  console.log(`Gun Mayhem server bezi na http://localhost:${PORT}`);
});