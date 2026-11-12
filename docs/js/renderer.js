// public/js/renderer.js

export class GameRenderer {
  constructor(canvas, miniMapCanvas, particleSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.miniMapCanvas = miniMapCanvas;
    this.miniMapCtx = miniMapCanvas ? miniMapCanvas.getContext("2d") : null;
    this.particles = particleSystem;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Camera
    this.camX = 1200;
    this.camY = 900;
    this.targetCamX = 1200;
    this.targetCamY = 900;
    this.hasSnappedFirstFrame = false;
    this.screenShake = 0;
    this.activeEmotes = new Map(); // playerId -> { emoji, endTime }
    this.recoil = new Map(); // playerId -> timestamp

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resetCamera(x = 1200, y = 900) {
    this.camX = x;
    this.camY = y;
    this.targetCamX = x;
    this.targetCamY = y;
    this.hasSnappedFirstFrame = false;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    if (this.miniMapCanvas && this.miniMapCtx) {
      this.miniMapCanvas.width = 140 * this.dpr;
      this.miniMapCanvas.height = 105 * this.dpr;
      this.miniMapCtx.scale(this.dpr, this.dpr);
    }
  }

  addScreenShake(amount = 12) {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  addPlayerEmote(playerId, emoji) {
    this.activeEmotes.set(playerId, { emoji, endTime: Date.now() + 2500 });
  }

  addPlayerRecoil(playerId) {
    this.recoil.set(playerId, Date.now());
  }

  updateCamera(targetX, targetY, dt) {
    // Smooth lerp
    this.targetCamX = targetX;
    this.targetCamY = targetY;
    const lerpSpeed = 10;
    this.camX += (this.targetCamX - this.camX) * Math.min(1, lerpSpeed * dt);
    this.camY += (this.targetCamY - this.camY) * Math.min(1, lerpSpeed * dt);

    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 30 * dt);
    }
  }

  render(worldState, localPlayerId, mapData, dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (!worldState || !mapData) return;

    // Screen shake offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
    }

    ctx.save();
    // Translate camera to center on local player
    ctx.translate(
      this.width / 2 - this.camX + shakeX,
      this.height / 2 - this.camY + shakeY
    );

    // 1. Draw Arena Grid Floor
    this.drawFloor(ctx, mapData);

    // 1.5. Draw Hazards (Toxic Acid Pools)
    if (mapData.hazards) {
      this.drawHazards(ctx, mapData.hazards);
    }

    // 2. Draw Obstacle Walls
    this.drawWalls(ctx, mapData.walls);

    // 3. Draw Destructible Crates
    if (worldState.crates) {
      this.drawCrates(ctx, worldState.crates);
    }

    // 4. Draw Ground Items & Spawners
    if (worldState.items) {
      this.drawItems(ctx, worldState.items);
    }

    // 5. Draw Players
    const localPlayer = worldState.players?.find(p => p.id === localPlayerId);
    if (worldState.players) {
      this.drawPlayers(ctx, worldState.players, localPlayer);
    }

    // 6. Draw Bushes
    this.drawBushes(ctx, mapData.bushes, localPlayer);

    // 7. Draw Bullets
    if (worldState.bullets) {
      this.drawBullets(ctx, worldState.bullets);
    }

    // 8. Draw Particles & Floating Texts
    this.particles.draw(ctx);

    ctx.restore();

    // 9. Render Mini Map Radar
    this.renderMiniMap(worldState, localPlayerId, mapData);
  }

  drawFloor(ctx, map) {
    // Background fill
    ctx.fillStyle = map.theme?.background || "#0c101d";
    ctx.fillRect(0, 0, map.width, map.height);

    // Cyber grid with viewport culling
    ctx.strokeStyle = map.theme?.gridColor || "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    const gridSize = 80;

    const halfW = (this.width / 2) + gridSize;
    const halfH = (this.height / 2) + gridSize;
    const startX = Math.max(0, Math.floor((this.camX - halfW) / gridSize) * gridSize);
    const endX = Math.min(map.width, Math.ceil((this.camX + halfW) / gridSize) * gridSize);
    const startY = Math.max(0, Math.floor((this.camY - halfH) / gridSize) * gridSize);
    const endY = Math.min(map.height, Math.ceil((this.camY + halfH) / gridSize) * gridSize);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Glowing Arena Border
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, map.width, map.height);
  }

  drawHazards(ctx, hazards) {
    const time = Date.now() / 400;
    hazards.forEach(h => {
      ctx.save();
      // Outer warning ring
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fillStyle = h.color || "rgba(34, 197, 94, 0.3)";
      ctx.fill();

      ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.stroke();

      // Inner acid ripple
      const ripple = (Math.sin(time) + 1) / 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * 0.7 + ripple * 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
      ctx.fill();

      // Hazard icon
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("☣️", h.x, h.y);

      ctx.restore();
    });
  }

  drawWalls(ctx, walls) {
    if (!walls) return;
    walls.forEach(w => {
      // Drop shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(w.x + 6, w.y + 6, w.w, w.h);

      // Wall core
      ctx.fillStyle = "#162032";
      ctx.fillRect(w.x, w.y, w.w, w.h);

      // Wall glowing border
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);

      // Subtle diagonal hazard stripes on larger walls
      if (w.w >= 80 && w.h >= 80) {
        ctx.save();
        ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = -w.h; i < w.w; i += 24) {
          ctx.moveTo(w.x + i, w.y);
          ctx.lineTo(w.x + i + w.h, w.y + w.h);
        }
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  drawCrates(ctx, crates) {
    crates.forEach(c => {
      if (c.hp <= 0) return;

      // Drop shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(c.x + 4, c.y + 4, c.size, c.size);

      // Crate body
      ctx.fillStyle = "#9a6b38";
      ctx.fillRect(c.x, c.y, c.size, c.size);

      // Crate inner cross & bevel
      ctx.strokeStyle = "#5a3a1c";
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x, c.y, c.size, c.size);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.size, c.y + c.size);
      ctx.moveTo(c.x + c.size, c.y);
      ctx.lineTo(c.x, c.y + c.size);
      ctx.stroke();

      // Crate health bar
      if (c.hp < c.maxHp) {
        const barW = c.size;
        const barH = 5;
        const barX = c.x;
        const barY = c.y - 8;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = "#10b981";
        ctx.fillRect(barX, barY, barW * (c.hp / c.maxHp), barH);
      }
    });
  }

  drawItems(ctx, items) {
    const time = Date.now() / 300;
    items.forEach(it => {
      const bob = Math.sin(time + it.x) * 4;
      const cy = it.y + bob;

      ctx.save();
      ctx.translate(it.x, cy);

      // Ground glow ring
      ctx.beginPath();
      ctx.arc(0, 0, it.radius + 4, 0, Math.PI * 2);

      let glowColor = "#00f0ff";
      let icon = "⚡";
      if (it.type === "health") { glowColor = "#10b981"; icon = "❤️"; }
      else if (it.type === "shield") { glowColor = "#3b82f6"; icon = "🛡️"; }
      else if (it.type === "boost") { glowColor = "#f59e0b"; icon = "⚡"; }
      else if (it.type === "shotgun") { glowColor = "#ff7700"; icon = "💥"; }
      else if (it.type === "plasma") { glowColor = "#a855f7"; icon = "🔮"; }
      else if (it.type === "rocket") { glowColor = "#ef4444"; icon = "🚀"; }

      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.25;
      ctx.fill();

      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.stroke();

      // Icon
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 1;
      ctx.fillText(icon, 0, 0);

      ctx.restore();
    });
  }

  drawHumanCharacter(ctx, p, radius, kick) {
    const time = Date.now();
    const seed = (p.id ? p.id.charCodeAt(p.id.length - 1) : 0) * 19;
    const isMoving = Math.hypot(p.vx || 0, p.vy || 0) > 8;
    const walk = isMoving ? Math.sin(time / 80 + seed) * (radius * 0.32) : 0;

    // 1. Combat Boots (Stepping animation)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-radius * 0.5 + walk, -radius * 0.72, radius * 0.48, radius * 0.36);
    ctx.fillRect(-radius * 0.5 - walk, radius * 0.36, radius * 0.48, radius * 0.36);

    // 2. Torso & Armor Vest (Tactical uniform + Team color armor plate)
    // Dark uniform base
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(-radius * 0.1, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Colored Armor Plate
    ctx.fillStyle = p.color || "#00f0ff";
    ctx.beginPath();
    ctx.arc(-radius * 0.1, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Tactical Webbing Straps
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-radius * 0.35, -radius * 0.4, radius * 0.5, 3);
    ctx.fillRect(-radius * 0.35, radius * 0.3, radius * 0.5, 3);

    // 3. Hands & Weapon (Held forward with recoil)
    const weaponType = p.currentWeapon || "blaster";
    let weaponGlow = "#00f0ff";
    if (weaponType === "shotgun") weaponGlow = "#ff7700";
    else if (weaponType === "plasma") weaponGlow = "#a855f7";
    else if (weaponType === "rocket") weaponGlow = "#ef4444";
    else if (weaponType === "railgun") weaponGlow = "#eab308";

    // Gun body (Steel receiver)
    ctx.fillStyle = "#334155";
    ctx.fillRect(radius * 0.25 - kick, -4, radius * 0.85, 8);
    // Steel Barrel
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(radius * 1.05 - kick, -2, radius * 0.5, 4);
    // Glowing magazine
    ctx.fillStyle = weaponGlow;
    ctx.fillRect(radius * 0.45 - kick, -2, radius * 0.3, 4);

    // Left Arm & Glove
    ctx.fillStyle = p.color || "#00f0ff";
    ctx.beginPath();
    ctx.arc(radius * 0.15, -radius * 0.55, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(radius * 0.45 - kick, -5, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Right Arm & Glove
    ctx.fillStyle = p.color || "#00f0ff";
    ctx.beginPath();
    ctx.arc(radius * 0.15, radius * 0.55, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(radius * 0.62 - kick, 4, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // 4. Human Head, Face & Avatar Hair / Helmet
    // Warm natural skin tone
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#b45309";
    ctx.stroke();

    const avatar = p.avatar || "striker";
    if (avatar === "phantom") {
      // Ninja Cowl / Hood
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-2, 0, radius * 0.52, Math.PI * 0.35, Math.PI * 1.65);
      ctx.fill();
      // Glowing Ninja Eyes
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(radius * 0.2, -3.5, 3, 2);
      ctx.fillRect(radius * 0.2, 1.5, 3, 2);
    } else if (avatar === "juggernaut") {
      // Heavy Steel Armor Helmet
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(-1, 0, radius * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Glowing Visor Slit
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(radius * 0.15, -4, 4, 8);
    } else if (avatar === "sniper") {
      // Sharpshooter Beret
      ctx.fillStyle = "#065f46";
      ctx.beginPath();
      ctx.arc(-3, -2, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Tech Monocle
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(radius * 0.25, 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Striker (Default Human Brawler Hero)
      // Spiky Dark Hair
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-radius * 0.15, 0, radius * 0.5, Math.PI * 0.45, Math.PI * 1.55);
      ctx.fill();

      // Hero Headband in Player's Color
      ctx.fillStyle = p.color || "#00f0ff";
      ctx.fillRect(-radius * 0.08, -radius * 0.44, radius * 0.24, radius * 0.88);

      // Human Eyes looking in firing direction
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(radius * 0.2, -3.5, 2.8, 2.2);
      ctx.fillRect(radius * 0.2, 1.5, 2.8, 2.2);
      // White eye glint
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(radius * 0.23, -3, 1, 1);
      ctx.fillRect(radius * 0.23, 2, 1, 1);
    }
  }

  drawPlayers(ctx, players, localPlayer) {
    players.forEach(p => {
      const radius = p.radius || 22;

      if (!p.isAlive) {
        // Draw ghost respawn circle
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Stealth logic: If in bush and not local player and not teammate, hide or make almost invisible
      if (p.inBush && p.id !== localPlayer?.id) {
        const isTeammate = localPlayer?.team && p.team === localPlayer.team;
        if (!isTeammate) return; // Completely invisible to opponents!
      }

      // Invisibility logic (e.g. Phantom's Shadow Veil Super)
      if (p.isInvisible && p.id !== localPlayer?.id) {
        const isTeammate = localPlayer?.team && p.team === localPlayer.team;
        if (!isTeammate) return; // Completely hidden from enemies!
      }

      ctx.save();
      ctx.translate(p.x, p.y);

      // Translucency for stealth / invisibility
      if (p.isInvisible) {
        ctx.globalAlpha = 0.35;
      } else if (p.inBush) {
        ctx.globalAlpha = 0.55;
      }

      // 1. Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 6, radius * 0.9, radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Dash effect
      if (p.isDashing) {
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 240, 255, 0.25)";
        ctx.fill();
      }

      // 2b. Super Charged Aura when at 100%
      if ((p.superCharge || 0) >= 100) {
        const pulse = Math.sin(Date.now() / 140) * 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 9 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 234, 0, 0.75)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 234, 0, 0.14)";
        ctx.fill();
      }

      // 3. Shield aura
      if (p.shield > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
        ctx.fill();
      }

      // 4. Aim guide laser line for local player
      if (p.id === localPlayer?.id) {
        ctx.save();
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(radius + 18, 0);
        ctx.lineTo(radius + 280, 0);
        ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 8]);
        ctx.stroke();

        // Holographic Target Crosshair (replacing simple dot, zero shadowBlur for 60 FPS)
        ctx.setLineDash([]);
        const targetX = radius + 280;
        ctx.beginPath();
        ctx.arc(targetX, 0, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(targetX - 9, 0); ctx.lineTo(targetX - 3, 0);
        ctx.moveTo(targetX + 3, 0); ctx.lineTo(targetX + 9, 0);
        ctx.moveTo(targetX, -9); ctx.lineTo(targetX, -3);
        ctx.moveTo(targetX, 3); ctx.lineTo(targetX, 9);
        ctx.stroke();

        ctx.restore();
      }

      // 5. Draw Human Character with rotation & kickback
      ctx.save();
      ctx.rotate(p.angle);

      const lastFire = this.recoil.get(p.id) || 0;
      const elapsed = Date.now() - lastFire;
      let kick = 0;
      if (elapsed < 110) {
        kick = (1 - elapsed / 110) * 5;
      }

      this.drawHumanCharacter(ctx, p, radius, kick);

      ctx.restore(); // Restore player rotation

      // 6. Health & Shield Bars above player
      const barW = 44;
      const barH = 5;
      const barY = -radius - 16;

      // Shield bar (if active)
      if (p.shield > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(-barW / 2, barY - 6, barW, 4);
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(-barW / 2, barY - 6, barW * (p.shield / p.maxShield), 4);
      }

      // Health bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = p.id === localPlayer?.id ? "#10b981" : "#ef4444";
      ctx.fillRect(-barW / 2, barY, barW * (p.health / p.maxHealth), barH);

      // Player Name
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.strokeText(p.name, 0, barY - (p.shield > 0 ? 9 : 3));
      ctx.fillStyle = "#ffffff";
      ctx.fillText(p.name, 0, barY - (p.shield > 0 ? 9 : 3));

      // Active Emote Bubble
      const emote = this.activeEmotes.get(p.id);
      if (emote) {
        if (Date.now() < emote.endTime) {
          const bounce = Math.sin(Date.now() / 150) * 4;
          ctx.save();
          ctx.font = "24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(emote.emoji, 0, barY - 24 + bounce);
          ctx.restore();
        } else {
          this.activeEmotes.delete(p.id);
        }
      }

      ctx.restore();
    });
  }

  drawBushes(ctx, bushes, localPlayer) {
    if (!bushes) return;
    bushes.forEach(b => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);

      // Check if local player is inside this bush
      const playerInside = localPlayer && Math.hypot(localPlayer.x - b.x, localPlayer.y - b.y) < b.radius;

      ctx.fillStyle = playerInside ? "rgba(22, 101, 52, 0.55)" : "rgba(22, 101, 52, 0.9)";
      ctx.fill();

      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Decorative leafy textures
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const ox = b.x + Math.cos(ang) * (b.radius * 0.6);
        const oy = b.y + Math.sin(ang) * (b.radius * 0.6);
        ctx.beginPath();
        ctx.arc(ox, oy, b.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = playerInside ? "rgba(34, 197, 94, 0.35)" : "rgba(34, 197, 94, 0.75)";
        ctx.fill();
      }

      ctx.restore();
    });
  }

  drawBullets(ctx, bullets) {
    if (!bullets || bullets.length === 0) return;
    bullets.forEach(b => {
      ctx.save();
      const radius = b.radius || 4;
      const angle = b.angle !== undefined ? b.angle : Math.atan2(b.vy || 0, b.vx || 0);

      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      const color = b.color || "#00f0ff";

      // 1. High-speed laser tracer streak (fast rect, no gradient allocation)
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(-14, -radius * 0.5, 14, radius);

      // 2. Projectile Head (zero shadowBlur for 60 FPS)
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // White-hot energy core
      ctx.beginPath();
      ctx.arc(0.5, 0, radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Rocket flame / tail
      if (b.type === "rocket") {
        ctx.beginPath();
        ctx.arc(-radius * 0.5, 0, radius * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  renderMiniMap(worldState, localPlayerId, mapData) {
    if (!this.miniMapCtx || !worldState || !mapData) return;
    const mCtx = this.miniMapCtx;
    const mW = 140;
    const mH = 105;

    mCtx.clearRect(0, 0, mW, mH);

    // Scale factors
    const sx = mW / mapData.width;
    const sy = mH / mapData.height;

    // Walls on minimap
    mCtx.fillStyle = "rgba(0, 240, 255, 0.35)";
    mapData.walls.forEach(w => {
      mCtx.fillRect(w.x * sx, w.y * sy, w.w * sx, w.h * sy);
    });

    // Crates on minimap
    if (worldState.crates) {
      mCtx.fillStyle = "rgba(245, 158, 11, 0.75)";
      worldState.crates.forEach(c => {
        mCtx.fillRect(c.x * sx - 1, c.y * sy - 1, 2, 2);
      });
    }

    // Players on minimap
    if (worldState.players) {
      const me = worldState.players.find(p => p.id === localPlayerId);
      worldState.players.forEach(p => {
        if (!p.isAlive) return;
        const isMe = p.id === localPlayerId;
        const isTeammate = me && me.team && p.team && me.team === p.team;

        // Hide opponents in stealth or bushes
        if (!isMe && !isTeammate && (p.inBush || p.isInvisible)) return;

        mCtx.beginPath();
        const px = p.x * sx;
        const py = p.y * sy;
        mCtx.arc(px, py, isMe ? 4 : 2.5, 0, Math.PI * 2);

        if (isMe) {
          mCtx.fillStyle = "#00f0ff";
        } else if (isTeammate) {
          mCtx.fillStyle = "#10b981"; // friendly teammate green
        } else {
          mCtx.fillStyle = "#ef4444"; // opponent red
        }
        mCtx.fill();

        // Local player ping ring
        if (isMe) {
          mCtx.strokeStyle = "#ffffff";
          mCtx.lineWidth = 1;
          mCtx.stroke();
        }
      });
    }
  }
}

