// server/GameInstance.js
import { MAPS, WEAPON_CONFIGS, HERO_CLASSES } from "./MapData.js?v=20261113_06";
import { BotPlayer } from "./BotPlayer.js?v=20261113_06";

export class GameInstance {
  constructor(roomId, options = {}, io) {
    this.roomId = roomId;
    this.io = io;
    this.options = {
      gameMode: options.gameMode || "ffa", // ffa, team, survival
      scoreLimit: options.scoreLimit !== undefined ? options.scoreLimit : 0, // 0 = UNLIMITED SCORE
      matchDuration: options.matchDuration !== undefined ? options.matchDuration : 0, // 0 = UNLIMITED TIME
      mapId: options.mapId || "cyber_arena"
    };

    this.map = MAPS[this.options.mapId] || MAPS.cyber_arena;
    this.players = new Map();
    this.bots = new Map();
    this.bullets = [];
    this.bulletIdCounter = 1;
    this.groundItems = [];
    this.itemIdCounter = 1;
    this.crates = JSON.parse(JSON.stringify(this.map.crates));
    this.spawners = JSON.parse(JSON.stringify(this.map.itemSpawners)).map(s => ({
      ...s,
      nextSpawnTime: 0,
      activeItemId: null
    }));

    this.state = "lobby"; // lobby, playing, ended
    this.timeRemaining = this.options.matchDuration;
    this.tickInterval = null;
    this.tickRate = 45; // 45 Hz tick
    this.lastTickTime = Date.now();
    this.killFeed = [];
    this.leaderboard = [];

    // Pre-populate initial item spawns
    this.initSpawners();
  }

  initSpawners() {
    this.spawners.forEach(spawner => {
      this.spawnItemFromSpawner(spawner);
    });
  }

  spawnItemFromSpawner(spawner) {
    const item = {
      id: `item_${this.itemIdCounter++}`,
      spawnerId: spawner.id,
      x: spawner.x,
      y: spawner.y,
      type: spawner.type,
      radius: 20
    };
    this.groundItems.push(item);
    spawner.activeItemId = item.id;
  }

  addPlayer(socketId, profile = {}) {
    const spawn = this.getRandomSpawnPoint();
    const heroClass = HERO_CLASSES[profile.avatar] || HERO_CLASSES.striker;

    const initialWeapons = {
      blaster: { ammo: Infinity }
    };
    if (heroClass.starterWeapon && heroClass.starterWeapon !== "blaster") {
      initialWeapons[heroClass.starterWeapon] = { ammo: 20 };
    }

    const player = {
      id: socketId,
      name: profile.name || `Player_${socketId.substring(0, 4)}`,
      color: profile.color || "#00f0ff",
      avatar: profile.avatar || "striker",
      team: profile.team || (this.players.size % 2 === 0 ? "blue" : "red"),
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: 24,
      angle: 0,
      health: heroClass.maxHealth,
      maxHealth: heroClass.maxHealth,
      shield: heroClass.maxShield,
      maxShield: heroClass.maxShield,
      speed: heroClass.speed,
      baseSpeed: heroClass.speed,
      speedBoostEndTime: 0,

      // Inventory
      weapons: initialWeapons,
      currentWeapon: heroClass.starterWeapon || "blaster",
      lastShootTime: 0,

      // Movement & Dash
      dashCooldown: heroClass.dashCooldown,
      lastDashTime: 0,
      isDashing: false,
      dashEndTime: 0,

      // Stats
      kills: 0,
      deaths: 0,
      score: 0,
      damageDealt: 0,
      isAlive: true,
      respawnTimer: 0,
      inBush: false,
      isBot: profile.isBot || false,
      currentStreak: 0,
      multiKillCount: 0,
      lastKillTime: 0,
      damageDealt: 0,
      superCharge: 35, // 0 to 100
      superInvisEndTime: 0,

      // Input buffer from client
      input: {
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        isShooting: false,
        dashRequested: false
      }
    };

    this.players.set(socketId, player);
    return player;
  }

  addBot(team = null) {
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botController = new BotPlayer(botId, this, team);
    this.bots.set(botId, botController);
    const player = this.addPlayer(botId, {
      name: botController.name,
      color: botController.color,
      avatar: botController.avatar,
      team: botController.team,
      isBot: true
    });
    return player;
  }

  removeBot(botId = null) {
    if (!botId) {
      const keys = Array.from(this.bots.keys());
      if (keys.length > 0) botId = keys[keys.length - 1];
    }
    if (botId && this.bots.has(botId)) {
      this.bots.delete(botId);
      this.removePlayer(botId);
      return true;
    }
    return false;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.players.size === 0) {
      this.stop();
    }
  }

  handlePlayerInput(socketId, inputData) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) return;

    if (typeof inputData.moveX === "number") player.input.moveX = Math.max(-1, Math.min(1, inputData.moveX));
    if (typeof inputData.moveY === "number") player.input.moveY = Math.max(-1, Math.min(1, inputData.moveY));
    if (typeof inputData.aimAngle === "number") {
      player.input.aimAngle = inputData.aimAngle;
      player.angle = inputData.aimAngle;
    }
    if (typeof inputData.isShooting === "boolean") player.input.isShooting = inputData.isShooting;
    if (inputData.dashRequested) {
      this.triggerDash(player);
    }
    if (inputData.switchWeapon) {
      this.switchPlayerWeapon(player, inputData.switchWeapon);
    }
    if (inputData.superRequested) {
      this.triggerSuper(player);
    }
  }

  triggerSuper(player) {
    if ((player.superCharge || 0) < 100 || !player.isAlive) return;
    player.superCharge = 0;

    const heroClass = HERO_CLASSES[player.avatar] || HERO_CLASSES.striker;
    const now = Date.now();

    if (player.avatar === "striker") {
      player.shield = Math.min(player.maxShield + 35, 100);
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        this.bullets.push({
          id: `b_${this.bulletIdCounter++}`,
          shooterId: player.id,
          weapon: "plasma",
          x: player.x,
          y: player.y,
          startX: player.x,
          startY: player.y,
          vx: Math.cos(ang) * 950,
          vy: Math.sin(ang) * 950,
          angle: ang,
          damage: 24,
          range: 850,
          radius: 6,
          color: "#00f0ff",
          type: "plasma",
          aoeRadius: 0,
          distTraveled: 0
        });
      }
    } else if (player.avatar === "juggernaut") {
      const aoeRadius = 320;
      for (const target of this.players.values()) {
        if (!target.isAlive || target.id === player.id) continue;
        if (this.options.gameMode === "team" && target.team === player.team) continue;
        const dist = Math.hypot(target.x - player.x, target.y - player.y);
        if (dist < aoeRadius) {
          const dmg = Math.round(65 * (1 - dist / aoeRadius)) + 15;
          this.applyDamageToPlayer(target, dmg, player.id, "quake");
        }
      }
      this.crates.forEach(c => {
        if (c.hp > 0 && Math.hypot(c.x + c.size / 2 - player.x, c.y + c.size / 2 - player.y) < aoeRadius) {
          c.hp = 0;
          this.onCrateDestroyed(c);
        }
      });
    } else if (player.avatar === "phantom") {
      player.superInvisEndTime = now + 5000;
    } else if (player.avatar === "sniper") {
      const strikeX = player.x + Math.cos(player.angle) * 500;
      const strikeY = player.y + Math.sin(player.angle) * 500;
      const aoeRadius = 220;
      for (const target of this.players.values()) {
        if (!target.isAlive || target.id === player.id) continue;
        if (this.options.gameMode === "team" && target.team === player.team) continue;
        const dist = Math.hypot(target.x - strikeX, target.y - strikeY);
        if (dist < aoeRadius) {
          const dmg = Math.round(90 * (1 - dist / aoeRadius)) + 20;
          this.applyDamageToPlayer(target, dmg, player.id, "orbital");
        }
      }
      this.crates.forEach(c => {
        if (c.hp > 0 && Math.hypot(c.x + c.size / 2 - strikeX, c.y + c.size / 2 - strikeY) < aoeRadius) {
          c.hp = 0;
          this.onCrateDestroyed(c);
        }
      });
    }

    this.io.to(this.roomId).emit("super_activated", {
      playerId: player.id,
      hero: player.avatar,
      superName: heroClass.superName,
      x: player.x,
      y: player.y,
      angle: player.angle
    });
  }

  switchPlayerWeapon(player, weaponName) {
    if (player.weapons[weaponName]) {
      player.currentWeapon = weaponName;
    }
  }

  triggerDash(player) {
    const now = Date.now();
    if (now - player.lastDashTime >= player.dashCooldown && player.isAlive) {
      player.lastDashTime = now;
      player.isDashing = true;
      player.dashEndTime = now + 240; // 240ms duration dash

      // Direction of dash (movement or facing)
      let dx = player.input.moveX;
      let dy = player.input.moveY;
      if (Math.hypot(dx, dy) < 0.1) {
        dx = Math.cos(player.angle);
        dy = Math.sin(player.angle);
      }
      const len = Math.hypot(dx, dy) || 1;
      player.dashDirX = dx / len;
      player.dashDirY = dy / len;

      this.io.to(this.roomId).emit("player_dashed", {
        id: player.id,
        x: player.x,
        y: player.y,
        angle: player.angle
      });
    }
  }

  getRandomSpawnPoint() {
    const sp = this.map.spawnPoints;
    const choice = sp[Math.floor(Math.random() * sp.length)];
    // Add jitter
    return {
      x: choice.x + (Math.random() - 0.5) * 80,
      y: choice.y + (Math.random() - 0.5) * 80
    };
  }

  start() {
    this.state = "playing";
    this.timeRemaining = this.options.matchDuration;
    this.lastTickTime = Date.now();

    // Reset players
    this.players.forEach(p => {
      const sp = this.getRandomSpawnPoint();
      p.x = sp.x;
      p.y = sp.y;
      p.health = p.maxHealth;
      p.shield = p.maxShield;
      p.isAlive = true;
      p.kills = 0;
      p.deaths = 0;
      p.score = 0;
      p.currentStreak = 0;
      p.multiKillCount = 0;
      p.weapons = { blaster: { ammo: Infinity } };
      const heroClass = HERO_CLASSES[p.avatar] || HERO_CLASSES.striker;
      if (heroClass.starterWeapon && heroClass.starterWeapon !== "blaster") {
        p.weapons[heroClass.starterWeapon] = { ammo: 20 };
      }
      p.currentWeapon = heroClass.starterWeapon || "blaster";
    });

    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), 1000 / this.tickRate);

    this.io.to(this.roomId).emit("game_started", {
      map: this.map,
      options: this.options
    });
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.state = "ended";
  }

  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;

    if (this.state !== "playing") return;

    // 1. Update Match Timer (Only if matchDuration > 0; 0 means ENDLESS / UNLIMITED BATTLE!)
    if (this.options.matchDuration > 0) {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.endMatch("Time's Up!");
        return;
      }
    } else {
      this.timeRemaining = 0;
    }

    // 2. Update Players (Movement, Dash, Bush check, Shooting, Respawn)
    this.players.forEach(player => {
      this.updatePlayer(player, dt, now);
    });

    // 2.5. Update AI Bots
    this.bots.forEach(bot => {
      bot.update(dt, now);
    });

    // 3. Update Bullets (Physics, Collisions with Walls, Crates, Players)
    this.updateBullets(dt);

    // 4. Update Spawners & Ground Items
    this.updateSpawners(now);

    // 5. Check Score Limit
    if (this.options.scoreLimit > 0) {
      if (this.options.gameMode === "team") {
        const scores = this.getTeamScores();
        if (scores.blue >= this.options.scoreLimit) {
          this.endMatch(`Blue Team Victorious! Reached ${this.options.scoreLimit} points.`);
          return;
        } else if (scores.red >= this.options.scoreLimit) {
          this.endMatch(`Red Team Victorious! Reached ${this.options.scoreLimit} points.`);
          return;
        }
      } else {
        for (const player of this.players.values()) {
          if (player.score >= this.options.scoreLimit) {
            this.endMatch(`${player.name} Won! Reached score limit.`);
            return;
          }
        }
      }
    }

    // 6. Broadcast World State to Room
    this.broadcastState();
  }

  getTeamScores() {
    let blue = 0;
    let red = 0;
    for (const p of this.players.values()) {
      if (p.team === "blue") blue += p.kills;
      else if (p.team === "red") red += p.kills;
    }
    return { blue, red };
  }

  updatePlayer(player, dt, now) {
    if (!player.isAlive) {
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) {
        this.respawnPlayer(player);
      }
      return;
    }

    // Passive Super Charge over time
    player.superCharge = Math.min(100, (player.superCharge || 0) + dt * 1.5);

    // Check Speed Boost
    let currentSpeed = player.baseSpeed;
    if (now < player.speedBoostEndTime) {
      currentSpeed *= 1.45;
    }

    // Dash status
    if (player.isDashing) {
      if (now > player.dashEndTime) {
        player.isDashing = false;
      } else {
        currentSpeed = player.baseSpeed * 2.8;
      }
    }

    // Calculate Movement
    let mx = player.input.moveX;
    let my = player.input.moveY;
    if (player.isDashing) {
      mx = player.dashDirX;
      my = player.dashDirY;
    }

    const mag = Math.hypot(mx, my);
    if (mag > 0.05) {
      const norm = mag > 1 ? 1 / mag : 1;
      player.vx = mx * norm * currentSpeed;
      player.vy = my * norm * currentSpeed;
    } else {
      player.vx *= 0.7;
      player.vy *= 0.7;
      if (Math.abs(player.vx) < 5) player.vx = 0;
      if (Math.abs(player.vy) < 5) player.vy = 0;
    }

    // Projected position
    let newX = player.x + player.vx * dt;
    let newY = player.y + player.vy * dt;

    // Map bounds collision
    newX = Math.max(player.radius, Math.min(this.map.width - player.radius, newX));
    newY = Math.max(player.radius, Math.min(this.map.height - player.radius, newY));

    // Walls collision
    const resolvedPos = this.resolveCircleRectCollisions(newX, newY, player.radius);
    player.x = resolvedPos.x;
    player.y = resolvedPos.y;

    // Crates collision
    this.crates.forEach(crate => {
      if (crate.hp > 0) {
        const crateRect = { x: crate.x, y: crate.y, w: crate.size, h: crate.size };
        const res = this.resolveCircleSingleRect(player.x, player.y, player.radius, crateRect);
        player.x = res.x;
        player.y = res.y;
      }
    });

    // Bush detection
    player.inBush = this.checkBushOverlap(player.x, player.y);

    // Hazard detection (acid/toxic pools)
    if (this.map.hazards) {
      for (const hazard of this.map.hazards) {
        if (Math.hypot(player.x - hazard.x, player.y - hazard.y) < hazard.radius) {
          const dmg = (hazard.dps || 12) * dt;
          if (player.shield > 0) {
            player.shield = Math.max(0, player.shield - dmg);
          } else {
            player.health = Math.max(0, player.health - dmg);
          }
          if (player.health <= 0) {
            this.killPlayerByHazard(player);
          }
          break;
        }
      }
    }

    // Shooting
    if (player.input.isShooting) {
      this.tryShoot(player, now);
    }

    // Ground items pickup
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const item = this.groundItems[i];
      const dist = Math.hypot(player.x - item.x, player.y - item.y);
      if (dist < player.radius + item.radius) {
        if (this.applyItemToPlayer(player, item)) {
          // Free spawner if attached
          if (item.spawnerId) {
            const spawner = this.spawners.find(s => s.id === item.spawnerId);
            if (spawner) {
              spawner.activeItemId = null;
              spawner.nextSpawnTime = now + spawner.interval;
            }
          }
          this.groundItems.splice(i, 1);
          this.io.to(this.roomId).emit("item_collected", {
            playerId: player.id,
            itemId: item.id,
            type: item.type
          });
        }
      }
    }
  }

  applyItemToPlayer(player, item) {
    let applied = false;
    switch (item.type) {
      case "health":
        if (player.health < player.maxHealth) {
          player.health = Math.min(player.maxHealth, player.health + 40);
          applied = true;
        }
        break;
      case "shield":
        if (player.shield < player.maxShield) {
          player.shield = Math.min(player.maxShield, player.shield + 50);
          applied = true;
        }
        break;
      case "boost":
        player.speedBoostEndTime = Date.now() + 8000;
        applied = true;
        break;
      case "shotgun":
        player.weapons.shotgun = { ammo: (player.weapons.shotgun?.ammo || 0) + 15 };
        player.currentWeapon = "shotgun";
        applied = true;
        break;
      case "plasma":
        player.weapons.plasma = { ammo: (player.weapons.plasma?.ammo || 0) + 30 };
        player.currentWeapon = "plasma";
        applied = true;
        break;
      case "rocket":
        player.weapons.rocket = { ammo: (player.weapons.rocket?.ammo || 0) + 6 };
        player.currentWeapon = "rocket";
        applied = true;
        break;
      case "railgun":
        player.weapons.railgun = { ammo: (player.weapons.railgun?.ammo || 0) + 5 };
        player.currentWeapon = "railgun";
        applied = true;
        break;
      default:
        applied = false;
    }

    if (applied) {
      // Bonus super charge on collecting any item
      player.superCharge = Math.min(100, (player.superCharge || 0) + 15);
    }
    return applied;
  }

  checkBushOverlap(x, y) {
    for (const bush of this.map.bushes) {
      if (Math.hypot(x - bush.x, y - bush.y) < bush.radius) {
        return true;
      }
    }
    return false;
  }

  tryShoot(player, now) {
    const config = WEAPON_CONFIGS[player.currentWeapon] || WEAPON_CONFIGS.blaster;
    if (now - player.lastShootTime < config.fireRate) return;

    // Check ammo
    const weaponInv = player.weapons[player.currentWeapon];
    if (weaponInv && weaponInv.ammo !== Infinity) {
      if (weaponInv.ammo <= 0) {
        // Fallback to blaster
        player.currentWeapon = "blaster";
        return;
      }
      weaponInv.ammo -= 1;
    }

    player.lastShootTime = now;
    // Firing reveals player in bushes briefly
    player.lastFireTime = now;

    // Spawn bullets
    const pellets = config.pellets || 1;
    const baseAngle = player.angle;

    for (let i = 0; i < pellets; i++) {
      let shootAngle = baseAngle;
      if (pellets > 1) {
        const spreadStep = config.spread / (pellets - 1);
        shootAngle = baseAngle - config.spread / 2 + spreadStep * i;
      } else if (config.spread > 0) {
        shootAngle += (Math.random() - 0.5) * config.spread;
      }

      // Gun tip position
      const tipDist = player.radius + 12;
      const startX = player.x + Math.cos(baseAngle) * tipDist;
      const startY = player.y + Math.sin(baseAngle) * tipDist;

      const bullet = {
        id: `b_${this.bulletIdCounter++}`,
        shooterId: player.id,
        weapon: player.currentWeapon,
        x: startX,
        y: startY,
        startX: startX,
        startY: startY,
        vx: Math.cos(shootAngle) * config.speed,
        vy: Math.sin(shootAngle) * config.speed,
        angle: shootAngle,
        damage: config.damage,
        range: config.range,
        radius: config.radius,
        color: config.color,
        type: config.type,
        aoeRadius: config.aoeRadius || 0,
        distTraveled: 0
      };

      this.bullets.push(bullet);
    }

    this.io.to(this.roomId).emit("weapon_fired", {
      shooterId: player.id,
      weapon: player.currentWeapon,
      x: player.x,
      y: player.y,
      angle: player.angle
    });
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const prevX = b.x;
      const prevY = b.y;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const stepDist = Math.hypot(b.x - prevX, b.y - prevY);
      b.distTraveled += stepDist;

      // 1. Max Range
      if (b.distTraveled >= b.range) {
        this.explodeBullet(b);
        this.bullets.splice(i, 1);
        continue;
      }

      // 2. Map boundary
      if (b.x < 0 || b.x > this.map.width || b.y < 0 || b.y > this.map.height) {
        this.explodeBullet(b);
        this.bullets.splice(i, 1);
        continue;
      }

      // 3. Wall collisions
      if (this.isPointInsideWall(b.x, b.y)) {
        this.explodeBullet(b);
        this.bullets.splice(i, 1);
        continue;
      }

      // 4. Crate collisions
      let hitCrate = false;
      for (const crate of this.crates) {
        if (crate.hp > 0) {
          if (b.x >= crate.x && b.x <= crate.x + crate.size &&
              b.y >= crate.y && b.y <= crate.y + crate.size) {
            crate.hp -= b.damage;
            this.explodeBullet(b);
            if (crate.hp <= 0) {
              crate.hp = 0;
              this.onCrateDestroyed(crate);
            }
            hitCrate = true;
            break;
          }
        }
      }
      if (hitCrate) {
        this.bullets.splice(i, 1);
        continue;
      }

      // 5. Player collisions
      let hitPlayer = false;
      for (const target of this.players.values()) {
        if (!target.isAlive || target.id === b.shooterId) continue;

        // Friendly fire off in team mode
        if (this.options.gameMode === "team") {
          const shooter = this.players.get(b.shooterId);
          if (shooter && shooter.team === target.team) continue;
        }

        const dist = Math.hypot(b.x - target.x, b.y - target.y);
        if (dist <= target.radius + b.radius) {
          this.applyDamageToPlayer(target, b.damage, b.shooterId, b.weapon);
          this.explodeBullet(b);
          hitPlayer = true;
          break;
        }
      }

      if (hitPlayer) {
        this.bullets.splice(i, 1);
      }
    }
  }

  explodeBullet(bullet) {
    if (bullet.aoeRadius > 0) {
      // Area of effect damage (Rockets)
      for (const target of this.players.values()) {
        if (!target.isAlive) continue;
        const dist = Math.hypot(bullet.x - target.x, bullet.y - target.y);
        if (dist < bullet.aoeRadius) {
          const falloff = 1 - dist / bullet.aoeRadius;
          const aoeDamage = Math.round(bullet.damage * falloff);
          if (aoeDamage > 5) {
            this.applyDamageToPlayer(target, aoeDamage, bullet.shooterId, bullet.weapon);
          }
        }
      }

      // AoE damage to crates
      this.crates.forEach(crate => {
        if (crate.hp > 0) {
          const cx = crate.x + crate.size / 2;
          const cy = crate.y + crate.size / 2;
          const dist = Math.hypot(bullet.x - cx, bullet.y - cy);
          if (dist < bullet.aoeRadius) {
            crate.hp -= Math.round(bullet.damage * (1 - dist / bullet.aoeRadius));
            if (crate.hp <= 0) {
              crate.hp = 0;
              this.onCrateDestroyed(crate);
            }
          }
        }
      });
    }

    this.io.to(this.roomId).emit("bullet_impact", {
      x: bullet.x,
      y: bullet.y,
      type: bullet.type,
      weapon: bullet.weapon,
      aoeRadius: bullet.aoeRadius
    });
  }

  onCrateDestroyed(crate) {
    // Random drop from crate
    const drops = ["health", "shield", "boost", "shotgun", "plasma", "rocket"];
    const dropType = drops[Math.floor(Math.random() * drops.length)];

    const item = {
      id: `drop_${this.itemIdCounter++}`,
      x: crate.x + crate.size / 2,
      y: crate.y + crate.size / 2,
      type: dropType,
      radius: 20
    };
    this.groundItems.push(item);

    this.io.to(this.roomId).emit("crate_destroyed", {
      crateId: crate.id,
      x: crate.x,
      y: crate.y,
      drop: item
    });
  }

  applyDamageToPlayer(target, amount, attackerId, weaponName) {
    if (target.spawnShieldEndTime && Date.now() < target.spawnShieldEndTime) {
      return; // Protected under temporary spawn invulnerability shield
    }
    let remaining = amount;

    // Shield takes damage first
    if (target.shield > 0) {
      if (target.shield >= remaining) {
        target.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= target.shield;
        target.shield = 0;
      }
    }

    // Remaining damage to health
    if (remaining > 0) {
      target.health = Math.max(0, target.health - remaining);
    }

    const attacker = this.players.get(attackerId);
    if (attacker && attacker.id !== target.id) {
      attacker.damageDealt = (attacker.damageDealt || 0) + amount;
      attacker.superCharge = Math.min(100, (attacker.superCharge || 0) + Math.round(amount * 0.45));
    }
    target.superCharge = Math.min(100, (target.superCharge || 0) + Math.round(amount * 0.2));

    // Damage indicator event
    this.io.to(this.roomId).emit("player_hit", {
      targetId: target.id,
      attackerId: attackerId,
      damage: amount,
      targetHealth: target.health,
      targetShield: target.shield
    });

    // Check Death
    if (target.health <= 0) {
      target.isAlive = false;
      target.deaths += 1;
      target.currentStreak = 0;
      target.respawnTimer = 2.0; // 2.0s fast respawn for non-stop endless action

      if (attacker && attacker.id !== target.id) {
        attacker.kills += 1;
        attacker.score += 1;
        attacker.superCharge = Math.min(100, (attacker.superCharge || 0) + 25);
        attacker.currentStreak = (attacker.currentStreak || 0) + 1;

        const now = Date.now();
        if (now - (attacker.lastKillTime || 0) < 4500) {
          attacker.multiKillCount = (attacker.multiKillCount || 1) + 1;
        } else {
          attacker.multiKillCount = 1;
        }
        attacker.lastKillTime = now;

        let streakTitle = null;
        if (attacker.multiKillCount === 2) streakTitle = "DOUBLE KILL!";
        else if (attacker.multiKillCount === 3) streakTitle = "TRIPLE KILL!";
        else if (attacker.multiKillCount >= 4) streakTitle = "ULTRA KILL!";
        else if (attacker.currentStreak === 3) streakTitle = "KILLING SPREE!";
        else if (attacker.currentStreak === 5) streakTitle = "RAMPAGE!";
        else if (attacker.currentStreak >= 7) streakTitle = "UNSTOPPABLE!";

        if (streakTitle) {
          this.io.to(this.roomId).emit("killstreak_achieved", {
            playerId: attacker.id,
            playerName: attacker.name,
            title: streakTitle,
            color: attacker.color
          });
        }
      }

      const killEvent = {
        killerName: attacker ? attacker.name : "Suicide",
        killerColor: attacker ? attacker.color : "#999",
        victimName: target.name,
        victimColor: target.color,
        weapon: weaponName || "weapon",
        time: Date.now()
      };
      this.killFeed.unshift(killEvent);
      if (this.killFeed.length > 5) this.killFeed.pop();

      this.io.to(this.roomId).emit("player_killed", {
        victimId: target.id,
        killerId: attacker ? attacker.id : null,
        killEvent
      });
    }
  }

  killPlayerByHazard(target) {
    if (!target.isAlive) return;
    target.health = 0;
    target.isAlive = false;
    target.deaths += 1;
    target.currentStreak = 0;
    target.respawnTimer = 3.5;

    const killEvent = {
      killerName: "Toxic Hazard",
      killerColor: "#22c55e",
      victimName: target.name,
      victimColor: target.color,
      weapon: "acid",
      time: Date.now()
    };
    this.killFeed.unshift(killEvent);
    if (this.killFeed.length > 5) this.killFeed.pop();

    this.io.to(this.roomId).emit("player_killed", {
      victimId: target.id,
      killerId: null,
      killEvent
    });
  }

  respawnPlayer(player) {
    const sp = this.getRandomSpawnPoint();
    player.x = sp.x;
    player.y = sp.y;
    player.health = player.maxHealth;
    player.shield = player.maxShield;
    player.isAlive = true;
    player.spawnShieldEndTime = Date.now() + 2000; // 2 seconds temporary invulnerability shield
    player.weapons = { blaster: { ammo: Infinity } };
    const heroClass = HERO_CLASSES[player.avatar] || HERO_CLASSES.striker;
    if (heroClass.starterWeapon && heroClass.starterWeapon !== "blaster") {
      player.weapons[heroClass.starterWeapon] = { ammo: 20 };
    }
    player.currentWeapon = heroClass.starterWeapon || "blaster";

    this.io.to(this.roomId).emit("player_respawned", {
      id: player.id,
      x: player.x,
      y: player.y
    });
  }

  updateSpawners(now) {
    this.spawners.forEach(spawner => {
      if (!spawner.activeItemId && now >= spawner.nextSpawnTime) {
        this.spawnItemFromSpawner(spawner);
      }
    });
  }

  resolveCircleRectCollisions(cx, cy, radius) {
    let x = cx;
    let y = cy;

    for (const wall of this.map.walls) {
      const res = this.resolveCircleSingleRect(x, y, radius, wall);
      x = res.x;
      y = res.y;
    }

    return { x, y };
  }

  resolveCircleSingleRect(cx, cy, radius, rect) {
    // Closest point on rectangle to circle center
    const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));

    const distX = cx - nearestX;
    const distY = cy - nearestY;
    const distSq = distX * distX + distY * distY;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist === 0) {
        // Center is inside rect, push out along shortest axis
        const left = cx - rect.x;
        const right = rect.x + rect.w - cx;
        const top = cy - rect.y;
        const bottom = rect.y + rect.h - cy;
        const minVal = Math.min(left, right, top, bottom);
        if (minVal === left) return { x: rect.x - radius, y: cy };
        if (minVal === right) return { x: rect.x + rect.w + radius, y: cy };
        if (minVal === top) return { x: cx, y: rect.y - radius };
        return { x: cx, y: rect.y + rect.h + radius };
      }
      const overlap = radius - dist;
      return {
        x: cx + (distX / dist) * overlap,
        y: cy + (distY / dist) * overlap
      };
    }
    return { x: cx, y: cy };
  }

  isPointInsideWall(px, py) {
    for (const wall of this.map.walls) {
      if (px >= wall.x && px <= wall.x + wall.w &&
          py >= wall.y && py <= wall.y + wall.h) {
        return true;
      }
    }
    return false;
  }

  endMatch(reason) {
    this.stop();
    // Calculate final rankings
    const ranking = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        damageDealt: p.damageDealt || 0
      }))
      .sort((a, b) => b.score - a.score || b.kills - a.kills || b.damageDealt - a.damageDealt);

    let maxDamage = 0;
    let maxKills = 0;
    ranking.forEach(r => {
      if (r.damageDealt > maxDamage) maxDamage = r.damageDealt;
      if (r.kills > maxKills) maxKills = r.kills;
    });

    ranking.forEach((r, idx) => {
      r.isMVP = idx === 0;
      r.isTopDamage = r.damageDealt > 0 && r.damageDealt === maxDamage;
      r.isTopKills = r.kills > 0 && r.kills === maxKills;
    });

    this.io.to(this.roomId).emit("match_ended", {
      reason,
      ranking,
      teamScores: this.options.gameMode === "team" ? this.getTeamScores() : null
    });
  }

  broadcastState() {
    const playersList = [];
    this.players.forEach(p => {
      playersList.push({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        team: p.team,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        angle: Math.round(p.angle * 100) / 100,
        health: p.health,
        maxHealth: p.maxHealth,
        shield: p.shield,
        maxShield: p.maxShield,
        isAlive: p.isAlive,
        isDashing: p.isDashing,
        currentWeapon: p.currentWeapon,
        ammo: p.weapons[p.currentWeapon]?.ammo ?? Infinity,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        damageDealt: p.damageDealt || 0,
        superCharge: Math.round(p.superCharge || 0),
        isInvisible: Date.now() < (p.superInvisEndTime || 0),
        inBush: p.inBush,
        speedBoost: Date.now() < p.speedBoostEndTime
      });
    });

    const bulletsList = this.bullets.map(b => ({
      id: b.id,
      x: Math.round(b.x),
      y: Math.round(b.y),
      radius: b.radius,
      color: b.color,
      type: b.type
    }));

    this.io.to(this.roomId).emit("game_state", {
      t: Date.now(),
      timeRemaining: Math.ceil(this.timeRemaining),
      teamScores: this.options.gameMode === "team" ? this.getTeamScores() : null,
      players: playersList,
      bullets: bulletsList,
      items: this.groundItems,
      crates: this.crates.map(c => ({ id: c.id, hp: c.hp, maxHp: c.maxHp, x: c.x, y: c.y, size: c.size }))
    });
  }
}

