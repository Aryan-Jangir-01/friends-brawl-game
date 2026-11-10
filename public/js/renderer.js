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
    this.dpr = window.devicePixelRatio || 1;

    // Camera
    this.camX = 1200;
    this.camY = 900;
    this.targetCamX = 1200;
    this.targetCamY = 900;
    this.screenShake = 0;
    this.activeEmotes = new Map(); // playerId -> { emoji, endTime }
    this.recoil = new Map(); // playerId -> timestamp

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;

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

    // Cyber grid
    ctx.strokeStyle = map.theme?.gridColor || "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    const gridSize = 80;

    ctx.beginPath();
    for (let x = 0; x <= map.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, map.height);
    }
    for (let y = 0; y <= map.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(map.width, y);
    }
    ctx.stroke();

    // Glowing Arena Border
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, map.width, map.height);

    ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
    ctx.lineWidth = 18;
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

  drawPlayers(ctx, players, localPlayer) {
    players.forEach(p => {
      if (!p.isAlive) {
        // Draw ghost respawn circle
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
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
      ctx.ellipse(0, 6, p.radius * 0.9, p.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Dash effect
      if (p.isDashing) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 240, 255, 0.25)";
        ctx.fill();
      }

      // 2b. Super Charged Aura when at 100%
      if ((p.superCharge || 0) >= 100) {
        const pulse = Math.sin(Date.now() / 140) * 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 9 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 234, 0, 0.75)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 234, 0, 0.14)";
        ctx.fill();
      }

      // 3. Shield aura
      if (p.shield > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
        ctx.fill();
      }

      // 4. Rotating Gun Barrel & Body
      // Aim guide laser line for local player
      if (p.id === localPlayer?.id) {
        ctx.save();
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(p.radius + 18, 0);
        ctx.lineTo(p.radius + 280, 0);
        ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.rotate(p.angle);

      // Gun Barrel with kickback recoil
      const lastFire = this.recoil.get(p.id) || 0;
      const elapsed = Date.now() - lastFire;
      let kick = 0;
      if (elapsed < 110) {
        kick = (1 - elapsed / 110) * 5;
      }

      ctx.fillStyle = "#334155";
      ctx.fillRect(p.radius * 0.4 - kick, -4, 18, 8);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(p.radius * 0.4 + 14 - kick, -3, 6, 6);

      // Hands
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.radius * 0.5, -9, 5, 0, Math.PI * 2);
      ctx.arc(p.radius * 0.5, 9, 5, 0, Math.PI * 2);
      ctx.fill();

      // Main Armor Body
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Visor / Helmet Face
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(4, 0, p.radius * 0.55, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.fill();

      // Glowing Visor Eye
      ctx.fillStyle = "#00f0ff";
      ctx.beginPath();
      ctx.arc(7, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // Restore player rotation

      // 5. Health & Shield Bars above player
      const barW = 44;
      const barH = 5;
      const barY = -p.radius - 16;

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
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
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
    bullets.forEach(b => {
      ctx.save();

      // Glowing head
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color || "#00f0ff";
      ctx.shadowColor = b.color || "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.fill();

      // Rocket flame / tail
      if (b.type === "rocket") {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
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

    // Players on minimap
    if (worldState.players) {
      worldState.players.forEach(p => {
        if (!p.isAlive) return;
        mCtx.beginPath();
        const px = p.x * sx;
        const py = p.y * sy;
        mCtx.arc(px, py, p.id === localPlayerId ? 4 : 2.5, 0, Math.PI * 2);
        mCtx.fillStyle = p.id === localPlayerId ? "#00f0ff" : "#ef4444";
        mCtx.fill();

        // Local player ping ring
        if (p.id === localPlayerId) {
          mCtx.strokeStyle = "#ffffff";
          mCtx.lineWidth = 1;
          mCtx.stroke();
        }
      });
    }
  }
}

