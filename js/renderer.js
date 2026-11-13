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
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 850;
    this.dpr = isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5);

    // Camera
    this.camX = 1200;
    this.camY = 900;
    this.targetCamX = 1200;
    this.targetCamY = 900;
    this.hasSnappedFirstFrame = false;
    this.screenShake = 0;
    this.activeEmotes = new Map(); // playerId -> { emoji, endTime }
    this.recoil = new Map(); // playerId -> timestamp
    this.lastMiniMapTime = 0;
    this.viewBounds = { left: 0, right: 2400, top: 0, bottom: 1800 };
    this.interpolatedPlayers = new Map(); // playerId -> { x, y, angle, walkPhase, isMoving, lastTargetX, lastTargetY }

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resetCamera(x = 1200, y = 900) {
    this.camX = x;
    this.camY = y;
    this.targetCamX = x;
    this.targetCamY = y;
    this.hasSnappedFirstFrame = true;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 850;
    this.dpr = isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before scaling
    this.ctx.scale(this.dpr, this.dpr);

    if (this.miniMapCanvas && this.miniMapCtx) {
      this.miniMapCanvas.width = 140 * this.dpr;
      this.miniMapCanvas.height = 105 * this.dpr;
      this.miniMapCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.miniMapCtx.scale(this.dpr, this.dpr);
    }
  }

  isRectInView(x, y, w, h) {
    const b = this.viewBounds;
    return (x + w >= b.left && x <= b.right && y + h >= b.top && y <= b.bottom);
  }

  isCircleInView(x, y, r) {
    const b = this.viewBounds;
    return (x + r >= b.left && x - r <= b.right && y + r >= b.top && y - r <= b.bottom);
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

  updateInterpolation(players, dt) {
    if (!players) return;
    const currentIds = new Set();

    players.forEach(p => {
      currentIds.add(p.id);
      let ip = this.interpolatedPlayers.get(p.id);
      if (!ip) {
        ip = {
          x: p.x,
          y: p.y,
          angle: p.angle,
          walkPhase: 0,
          isMoving: false,
          lastTargetX: p.x,
          lastTargetY: p.y
        };
        this.interpolatedPlayers.set(p.id, ip);
      }

      // Check distance to target
      const dx = p.x - ip.x;
      const dy = p.y - ip.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 150) {
        // Teleport / respawn: snap immediately
        ip.x = p.x;
        ip.y = p.y;
        ip.angle = p.angle;
      } else {
        // Continuous smooth exponential interpolation (22/s) - eliminates packet jump vibration
        const posLerp = Math.min(1, 22 * dt);
        ip.x += dx * posLerp;
        ip.y += dy * posLerp;

        // Angle interpolation using shortest angular arc
        let dAngle = p.angle - ip.angle;
        while (dAngle < -Math.PI) dAngle += Math.PI * 2;
        while (dAngle > Math.PI) dAngle -= Math.PI * 2;
        ip.angle += dAngle * Math.min(1, 20 * dt);
      }

      // Smooth walk animation
      const targetMoved = Math.hypot(p.x - ip.lastTargetX, p.y - ip.lastTargetY);
      ip.lastTargetX = p.x;
      ip.lastTargetY = p.y;

      if (targetMoved > 0.25 || dist > 1.2) {
        ip.isMoving = true;
        ip.walkPhase = (ip.walkPhase + dt * 11) % (Math.PI * 2);
      } else {
        ip.isMoving = false;
        ip.walkPhase = 0;
      }
    });

    // Clean up disconnected players
    for (const id of this.interpolatedPlayers.keys()) {
      if (!currentIds.has(id)) {
        this.interpolatedPlayers.delete(id);
      }
    }
  }

  updateCamera(targetX, targetY, dt) {
    this.targetCamX = targetX;
    this.targetCamY = targetY;
    const lerpSpeed = 18;
    this.camX += (this.targetCamX - this.camX) * Math.min(1, lerpSpeed * dt);
    this.camY += (this.targetCamY - this.camY) * Math.min(1, lerpSpeed * dt);

    if (Math.hypot(this.targetCamX - this.camX, this.targetCamY - this.camY) < 0.2) {
      this.camX = this.targetCamX;
      this.camY = this.targetCamY;
    }

    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 30 * dt);
      if (this.screenShake < 0.2) this.screenShake = 0;
    }
  }

  render(worldState, localPlayerId, mapData, dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (!worldState || !mapData) return;

    // 0. Update Smooth Entity Interpolation
    this.updateInterpolation(worldState.players, dt);

    // Synchronize Camera smoothly with Local Player's render position
    const localIP = this.interpolatedPlayers.get(localPlayerId);
    if (localIP) {
      if (!this.hasSnappedFirstFrame) {
        this.resetCamera(localIP.x, localIP.y);
      }
      this.updateCamera(localIP.x, localIP.y, dt);
    }

    // Viewport bounds for camera frustum culling (saves 80% draw calls on mobile)
    const margin = 80;
    const halfW = (this.width / 2) + margin;
    const halfH = (this.height / 2) + margin;
    this.viewBounds = {
      left: this.camX - halfW,
      right: this.camX + halfW,
      top: this.camY - halfH,
      bottom: this.camY + halfH
    };

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
    this.drawWalls(ctx, mapData.walls, mapData.theme, mapData);

    // 3. Draw Destructible Crates
    if (worldState.crates) {
      this.drawCrates(ctx, worldState.crates, mapData.theme);
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
    this.drawBushes(ctx, mapData.bushes, localPlayer, mapData.theme);

    // 7. Draw Bullets
    if (worldState.bullets) {
      this.drawBullets(ctx, worldState.bullets);
    }

    // 8. Draw Particles & Floating Texts
    this.particles.draw(ctx, this.viewBounds);

    ctx.restore();

    // 8.5. Cinematic Tactical Vignette
    this.drawVignette(ctx);

    // 9. Render Mini Map Radar (Throttled to 10 FPS for mobile GPU efficiency)
    const now = performance.now();
    if (!this.lastMiniMapTime || now - this.lastMiniMapTime >= 100) {
      this.lastMiniMapTime = now;
      this.renderMiniMap(worldState, localPlayerId, mapData);
    }
  }

  getMapId(map) {
    if (!map) return "military_airbase";
    if (map.id) return map.id;
    const n = (map.name || "").toLowerCase();
    if (n.includes("airbase")) return "military_airbase";
    if (n.includes("cargo") || n.includes("dock")) return "cargo_docks";
    if (n.includes("desert") || n.includes("dust")) return "desert_town";
    if (n.includes("factory")) return "abandoned_factory";
    if (n.includes("jungle")) return "dense_jungle";
    if (n.includes("arctic")) return "arctic_base";
    if (n.includes("ruin") || n.includes("city")) return "city_ruins";
    if (n.includes("railway") || n.includes("train") || n.includes("depot")) return "railway_depot";
    if (n.includes("bunker") || n.includes("island")) return "island_bunker";
    return "military_airbase";
  }

  drawFloor(ctx, map) {
    const theme = map.theme || {};
    const mapId = this.getMapId(map);

    // 1. Base Ground Fill
    ctx.fillStyle = theme.background || "#1a1d21";
    ctx.fillRect(0, 0, map.width, map.height);

    // Viewport Culling Bounds
    const pad = 120;
    const startX = Math.max(0, this.viewBounds.left - pad);
    const endX = Math.min(map.width, this.viewBounds.right + pad);
    const startY = Math.max(0, this.viewBounds.top - pad);
    const endY = Math.min(map.height, this.viewBounds.bottom + pad);

    // 2. Map-Specific Realistic Environmental Terrain
    if (mapId === "city_ruins") {
      this.drawCityRuinsTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "military_airbase") {
      this.drawAirbaseTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "cargo_docks") {
      this.drawCargoDocksTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "desert_town") {
      this.drawDesertTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "abandoned_factory") {
      this.drawFactoryTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "dense_jungle") {
      this.drawJungleTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "arctic_base") {
      this.drawArcticTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "railway_depot") {
      this.drawRailwayTerrain(ctx, map, startX, endX, startY, endY);
    } else if (mapId === "island_bunker") {
      this.drawBunkerTerrain(ctx, map, startX, endX, startY, endY);
    } else {
      this.drawAirbaseTerrain(ctx, map, startX, endX, startY, endY);
    }

    // 3. Heavy-Duty Realistic Outer Boundary Wall / Blast Border
    ctx.strokeStyle = theme.borderColor || "#475569";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, map.width - 10, map.height - 10);

    // Inner shadow on perimeter
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 4;
    ctx.strokeRect(9, 9, map.width - 18, map.height - 18);
  }

  drawCityRuinsTerrain(ctx, map, startX, endX, startY, endY) {
    // Weathered asphalt asphalt grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = Math.floor(startX / 100) * 100; x <= endX; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = Math.floor(startY / 100) * 100; y <= endY; y += 100) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Horizontal Main Boulevard (y: 880 to 1120, height: 240)
    const bTop = 880, bBottom = 1120;
    if (endY >= bTop && startY <= bBottom) {
      ctx.fillStyle = "#16171b";
      ctx.fillRect(0, bTop, map.width, 240);

      // Curbs & Sidewalks (North & South)
      ctx.fillStyle = "#272a30";
      ctx.fillRect(0, bTop - 18, map.width, 18);
      ctx.fillRect(0, bBottom, map.width, 18);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, bTop); ctx.lineTo(map.width, bTop);
      ctx.moveTo(0, bBottom); ctx.lineTo(map.width, bBottom);
      ctx.stroke();

      // White edge lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, bTop + 8); ctx.lineTo(map.width, bTop + 8);
      ctx.moveTo(0, bBottom - 8); ctx.lineTo(map.width, bBottom - 8);
      ctx.stroke();

      // Double Yellow Divider Line at y = 1000
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 997); ctx.lineTo(map.width, 997);
      ctx.moveTo(0, 1003); ctx.lineTo(map.width, 1003);
      ctx.stroke();
    }

    // Vertical Main Street (x: 1180 to 1420, width: 240)
    const sLeft = 1180, sRight = 1420;
    if (endX >= sLeft && startX <= sRight) {
      ctx.fillStyle = "#16171b";
      ctx.fillRect(sLeft, 0, 240, map.height);

      // Curbs (West & East)
      ctx.fillStyle = "#272a30";
      ctx.fillRect(sLeft - 18, 0, 18, map.height);
      ctx.fillRect(sRight, 0, 18, map.height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sLeft, 0); ctx.lineTo(sLeft, map.height);
      ctx.moveTo(sRight, 0); ctx.lineTo(sRight, map.height);
      ctx.stroke();

      // Dashed White Divider Line at x = 1300
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 3;
      ctx.setLineDash([24, 18]);
      ctx.beginPath();
      ctx.moveTo(1300, 0); ctx.lineTo(1300, map.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Pedestrian Zebra Crosswalks around center intersection (1300, 1000)
    if (this.isRectInView(1180, 840, 240, 360)) {
      ctx.fillStyle = "rgba(240, 240, 245, 0.7)";
      for (let x = 1200; x <= 1400; x += 22) {
        ctx.fillRect(x, 846, 12, 30);
        ctx.fillRect(x, 1124, 12, 30);
      }
      for (let y = 900; y <= 1100; y += 22) {
        ctx.fillRect(1146, y, 30, 12);
        ctx.fillRect(1424, y, 30, 12);
      }
    }

    // Cast Iron Manhole Covers
    const manholes = [
      { x: 1050, y: 1000 },
      { x: 1550, y: 1000 },
      { x: 1300, y: 720 },
      { x: 1300, y: 1280 }
    ];
    manholes.forEach(m => {
      if (!this.isCircleInView(m.x, m.y, 24)) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#262629";
      ctx.fill();
      ctx.strokeStyle = "#404045";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Cross-hatch grip
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x + 14, m.y);
      ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y + 14);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawAirbaseTerrain(ctx, map, startX, endX, startY, endY) {
    // Concrete slabs with expansion tar seams (140px grid)
    const slabSize = 140;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 2;
    for (let x = Math.floor(startX / slabSize) * slabSize; x <= endX; x += slabSize) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = Math.floor(startY / slabSize) * slabSize; y <= endY; y += slabSize) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Runway Strip (y: 820 to 1080, x: 250 to 2350)
    const rwTop = 820, rwBottom = 1080;
    if (endY >= rwTop && startY <= rwBottom) {
      ctx.fillStyle = "#15171a";
      ctx.fillRect(250, rwTop, 2100, 260);

      // Runway white border lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(250, rwTop); ctx.lineTo(2350, rwTop);
      ctx.moveTo(250, rwBottom); ctx.lineTo(2350, rwBottom);
      ctx.stroke();

      // Dashed centerline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 6;
      ctx.setLineDash([50, 35]);
      ctx.beginPath();
      ctx.moveTo(480, 950); ctx.lineTo(2120, 950);
      ctx.stroke();
      ctx.setLineDash([]);

      // Runway Threshold Piano Keys (West & East)
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      for (let y = rwTop + 15; y < rwBottom - 15; y += 28) {
        ctx.fillRect(270, y, 120, 16);
        ctx.fillRect(2210, y, 120, 16);
      }

      // Tire Touchdown Skid Marks (rubber burn streaks)
      ctx.fillStyle = "rgba(5, 5, 8, 0.35)";
      ctx.fillRect(450, 920, 280, 18);
      ctx.fillRect(450, 962, 280, 18);
      ctx.fillRect(1870, 920, 280, 18);
      ctx.fillRect(1870, 962, 280, 18);
    }

    // Yellow taxiway curved navigation lines
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(500, 450); ctx.quadraticCurveTo(800, 700, 1300, 820);
    ctx.moveTo(2100, 450); ctx.quadraticCurveTo(1800, 700, 1300, 820);
    ctx.moveTo(500, 1450); ctx.quadraticCurveTo(800, 1200, 1300, 1080);
    ctx.moveTo(2100, 1450); ctx.quadraticCurveTo(1800, 1200, 1300, 1080);
    ctx.stroke();

    // Helipad "H" at (1300, 450) and (1300, 1450)
    [ { x: 1300, y: 450 }, { x: 1300, y: 1450 } ].forEach(hp => {
      if (!this.isCircleInView(hp.x, hp.y, 65)) return;
      ctx.save();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 55, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", hp.x, hp.y);
      ctx.restore();
    });
  }

  drawCargoDocksTerrain(ctx, map, startX, endX, startY, endY) {
    // Port concrete joints
    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = 1.5;
    for (let x = Math.floor(startX / 120) * 120; x <= endX; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = Math.floor(startY / 120) * 120; y <= endY; y += 120) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Container staging bays: Painted yellow corner brackets [ ]
    const bays = [
      { x: 300, y: 300, w: 500, h: 300, label: "BAY 01" },
      { x: 1700, y: 300, w: 500, h: 300, label: "BAY 02" },
      { x: 300, y: 1400, w: 500, h: 300, label: "BAY 03" },
      { x: 1700, y: 1400, w: 500, h: 300, label: "BAY 04" }
    ];
    bays.forEach(b => {
      if (!this.isRectInView(b.x, b.y, b.w, b.h)) return;
      ctx.strokeStyle = "rgba(234, 179, 8, 0.4)";
      ctx.lineWidth = 2.5;
      const arm = 35;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + arm); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + arm, b.y);
      ctx.moveTo(b.x + b.w - arm, b.y); ctx.lineTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + arm);
      ctx.moveTo(b.x, b.y + b.h - arm); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x + arm, b.y + b.h);
      ctx.moveTo(b.x + b.w - arm, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h - arm);
      ctx.stroke();

      ctx.fillStyle = "rgba(234, 179, 8, 0.45)";
      ctx.font = "bold 13px monospace";
      ctx.fillText(b.label, b.x + 10, b.y + 20);
    });

    // Coastal Ocean Water & Shoreline (Right edge x > 2350 & Bottom edge y > 1850)
    if (endX >= 2350) {
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(2350, 0, map.width - 2350, map.height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(2350, 0); ctx.lineTo(2350, map.height);
      ctx.stroke();

      ctx.fillStyle = "#3e2718";
      ctx.fillRect(2330, 0, 20, map.height);
      ctx.fillStyle = "#1e293b";
      for (let y = 80; y < map.height; y += 140) {
        ctx.beginPath(); ctx.arc(2340, y, 8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawDesertTerrain(ctx, map, startX, endX, startY, endY) {
    // Flowing curved sand ripples
    ctx.strokeStyle = "rgba(217, 180, 130, 0.09)";
    ctx.lineWidth = 2;
    for (let y = Math.floor(startY / 90) * 90; y <= endY; y += 90) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      for (let x = startX; x <= endX; x += 160) {
        ctx.quadraticCurveTo(x + 80, y + Math.sin(x * 0.02) * 15, x + 160, y);
      }
      ctx.stroke();
    }

    // Central Sandstone Flagstone Plaza (x: 1000-1600, y: 750-1250)
    if (this.isRectInView(1000, 750, 600, 500)) {
      ctx.fillStyle = "rgba(70, 52, 35, 0.45)";
      ctx.fillRect(1000, 750, 600, 500);

      ctx.strokeStyle = "rgba(217, 180, 130, 0.18)";
      ctx.lineWidth = 2;
      for (let x = 1000; x <= 1600; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 750); ctx.lineTo(x, 1250); ctx.stroke();
      }
      for (let y = 750; y <= 1250; y += 50) {
        ctx.beginPath(); ctx.moveTo(1000, y); ctx.lineTo(1600, y); ctx.stroke();
      }
    }
  }

  drawFactoryTerrain(ctx, map, startX, endX, startY, endY) {
    // Industrial steel floor plates (120px grid)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.08)";
    ctx.lineWidth = 2;
    for (let x = Math.floor(startX / 120) * 120; x <= endX; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = Math.floor(startY / 120) * 120; y <= endY; y += 120) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Yellow & Black diagonal caution hazard warning stripes around center (1250, 950)
    if (this.isCircleInView(1250, 950, 120)) {
      ctx.save();
      ctx.translate(1250, 950);
      ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 14;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Grease & industrial oil spills
    const oilSlicks = [
      { x: 750, y: 700, r: 55 },
      { x: 1850, y: 1200, r: 65 },
      { x: 1600, y: 650, r: 45 }
    ];
    oilSlicks.forEach(os => {
      if (!this.isCircleInView(os.x, os.y, os.r)) return;
      ctx.fillStyle = "rgba(10, 12, 14, 0.55)";
      ctx.beginPath();
      ctx.arc(os.x, os.y, os.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(168, 85, 247, 0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  drawJungleTerrain(ctx, map, startX, endX, startY, endY) {
    // Rich forest earth with organic moss patches
    const mossPatches = [
      { x: 600, y: 600, r: 180 },
      { x: 1900, y: 500, r: 210 },
      { x: 700, y: 1500, r: 190 },
      { x: 1800, y: 1600, r: 220 },
      { x: 1250, y: 1050, r: 160 }
    ];
    mossPatches.forEach(mp => {
      if (!this.isCircleInView(mp.x, mp.y, mp.r)) return;
      ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, mp.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Winding mud & dirt trail traversing the jungle
    ctx.strokeStyle = "rgba(80, 55, 30, 0.25)";
    ctx.lineWidth = 55;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(300, 1050);
    ctx.quadraticCurveTo(800, 750, 1250, 1050);
    ctx.quadraticCurveTo(1700, 1350, 2200, 1050);
    ctx.stroke();
  }

  drawArcticTerrain(ctx, map, startX, endX, startY, endY) {
    // Snow drift contours
    ctx.strokeStyle = "rgba(186, 230, 253, 0.08)";
    ctx.lineWidth = 2;
    for (let y = Math.floor(startY / 100) * 100; y <= endY; y += 100) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Ice fissures glowing with cyan
    const fissures = [
      [ { x: 400, y: 800 }, { x: 550, y: 950 }, { x: 700, y: 900 } ],
      [ { x: 1750, y: 1100 }, { x: 1900, y: 1250 }, { x: 2100, y: 1200 } ]
    ];
    fissures.forEach(f => {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f[0].x, f[0].y);
      for (let i = 1; i < f.length; i++) ctx.lineTo(f[i].x, f[i].y);
      ctx.stroke();
    });

    // Caterpillar tracked vehicle tracks
    ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(300, 930); ctx.lineTo(2200, 930);
    ctx.moveTo(300, 970); ctx.lineTo(2200, 970);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawRailwayTerrain(ctx, map, startX, endX, startY, endY) {
    // 3 Major railroad tracks running horizontally: y = 450, y = 865, y = 1285
    const tracksY = [ 450, 865, 1285 ];
    tracksY.forEach(ty => {
      if (endY < ty - 50 || startY > ty + 50) return;

      // Dark crushed rock gravel ballast bed
      ctx.fillStyle = "#221f1d";
      ctx.fillRect(0, ty - 38, map.width, 76);

      // Wooden Railroad Ties (Sleepers)
      ctx.fillStyle = "#3d2516";
      ctx.strokeStyle = "#27170d";
      ctx.lineWidth = 1;
      for (let x = Math.max(0, Math.floor(startX / 24) * 24); x <= endX; x += 24) {
        ctx.fillRect(x - 6, ty - 32, 12, 64);
        ctx.strokeRect(x - 6, ty - 32, 12, 64);
      }

      // Parallel Steel Rails
      const r1 = ty - 20;
      const r2 = ty + 20;

      // Rail shadows
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, r1 + 3, map.width, 4);
      ctx.fillRect(0, r2 + 3, map.width, 4);

      // Steel rail bodies
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, r1); ctx.lineTo(map.width, r1);
      ctx.moveTo(0, r2); ctx.lineTo(map.width, r2);
      ctx.stroke();

      // Shiny silver specular top highlight
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, r1 - 1); ctx.lineTo(map.width, r1 - 1);
      ctx.moveTo(0, r2 - 1); ctx.lineTo(map.width, r2 - 1);
      ctx.stroke();
    });
  }

  drawBunkerTerrain(ctx, map, startX, endX, startY, endY) {
    // Military bunker steel diamond plate floor
    ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
    ctx.lineWidth = 1.5;
    for (let x = Math.floor(startX / 100) * 100; x <= endX; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = Math.floor(startY / 100) * 100; y <= endY; y += 100) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Outer island coastal surf (perimeter border)
    ctx.fillStyle = "rgba(2, 132, 199, 0.2)";
    ctx.fillRect(0, 0, map.width, 60);
    ctx.fillRect(0, map.height - 60, map.width, 60);
    ctx.fillRect(0, 0, 60, map.height);
    ctx.fillRect(map.width - 60, 0, 60, map.height);
  }

  drawHazards(ctx, hazards) {
    if (!hazards) return;
    const time = Date.now() / 400;
    hazards.forEach(h => {
      // Frustum culling
      if (!this.isCircleInView(h.x, h.y, h.radius)) return;

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

  drawWalls(ctx, walls, theme = {}, mapData = null) {
    if (!walls) return;
    const wallColor = theme.wallColor || "#2e3746";
    const wallBorder = theme.wallBorder || "#4b5563";
    const wallStyle = theme.wallStyle || "concrete";

    walls.forEach(w => {
      // Frustum culling
      if (!this.isRectInView(w.x, w.y, w.w, w.h)) return;

      // 1. Realistic Deep 3D Drop Shadow (bottom-right offset)
      ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
      ctx.fillRect(w.x + 8, w.y + 8, w.w, w.h);

      // 2. High-Fidelity Style Specific Rendering
      if (wallStyle === "container") {
        this.renderShippingContainer(ctx, w);
      } else if (wallStyle === "sandbag") {
        this.renderSandbagWall(ctx, w, wallColor, wallBorder);
      } else if (wallStyle === "brick") {
        this.renderBrickWall(ctx, w, wallColor, wallBorder);
      } else if (wallStyle === "train") {
        this.renderTrainBoxcar(ctx, w);
      } else if (wallStyle === "wood") {
        this.renderWoodLogWall(ctx, w, wallColor, wallBorder);
      } else if (wallStyle === "desert") {
        this.renderDesertAdobeWall(ctx, w, wallColor, wallBorder);
      } else {
        this.renderBunkerConcreteWall(ctx, w, wallColor, wallBorder);
      }
    });
  }

  renderShippingContainer(ctx, w) {
    // Authentic port shipping line container color palettes based on coordinate hash
    const palette = [
      { main: "#1e40af", light: "#3b82f6", dark: "#172554", text: "MAERSK" },
      { main: "#b91c1c", light: "#ef4444", dark: "#450a0a", text: "COSCO" },
      { main: "#15803d", light: "#22c55e", dark: "#052e16", text: "EVERGREEN" },
      { main: "#c2410c", light: "#f97316", dark: "#431407", text: "HAPAG" },
      { main: "#334155", light: "#64748b", dark: "#0f172a", text: "CMA-CGM" }
    ];
    const hash = Math.abs(Math.floor(w.x * 7 + w.y * 13)) % palette.length;
    const col = palette[hash];

    // Main container body
    ctx.fillStyle = col.main;
    ctx.fillRect(w.x, w.y, w.w, w.h);

    // Corrugated steel ridges
    ctx.lineWidth = 2;
    if (w.w >= w.h) {
      for (let x = w.x + 18; x < w.x + w.w - 14; x += 18) {
        ctx.strokeStyle = col.light;
        ctx.beginPath(); ctx.moveTo(x - 1, w.y + 4); ctx.lineTo(x - 1, w.y + w.h - 4); ctx.stroke();
        ctx.strokeStyle = col.dark;
        ctx.beginPath(); ctx.moveTo(x + 1, w.y + 4); ctx.lineTo(x + 1, w.y + w.h - 4); ctx.stroke();
      }
    } else {
      for (let y = w.y + 18; y < w.y + w.h - 14; y += 18) {
        ctx.strokeStyle = col.light;
        ctx.beginPath(); ctx.moveTo(w.x + 4, y - 1); ctx.lineTo(w.x + w.w - 4, y - 1); ctx.stroke();
        ctx.strokeStyle = col.dark;
        ctx.beginPath(); ctx.moveTo(w.x + 4, y + 1); ctx.lineTo(w.x + w.w - 4, y + 1); ctx.stroke();
      }
    }

    // Outer steel frame border
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 3;
    ctx.strokeRect(w.x, w.y, w.w, w.h);

    // Top specular light line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w.x + 2, w.y + 2); ctx.lineTo(w.x + w.w - 2, w.y + 2);
    ctx.stroke();

    // 4 Corner Castings (ISO Twist-Lock blocks)
    const cw = Math.min(14, w.w / 4);
    const ch = Math.min(14, w.h / 4);
    const corners = [
      { x: w.x, y: w.y },
      { x: w.x + w.w - cw, y: w.y },
      { x: w.x, y: w.y + w.h - ch },
      { x: w.x + w.w - cw, y: w.y + w.h - ch }
    ];
    corners.forEach(cr => {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cr.x, cr.y, cw, ch);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(cr.x, cr.y, cw, ch);
      // Oval twist hole
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(cr.x + cw / 2, cr.y + ch / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Stencil label in middle
    if (w.w >= 80 && w.h >= 24) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${col.text} 40FT`, w.x + w.w / 2, w.y + w.h / 2);
    }
  }

  renderSandbagWall(ctx, w, wallColor, wallBorder) {
    ctx.fillStyle = "#4a3b2c";
    ctx.fillRect(w.x, w.y, w.w, w.h);

    const isHorizontal = w.w >= w.h;
    const sackLength = 26;
    const sackWidth = isHorizontal ? Math.min(16, w.h) : Math.min(16, w.w);

    ctx.save();
    if (isHorizontal) {
      for (let y = w.y; y < w.y + w.h; y += sackWidth) {
        const rowOffset = ((y - w.y) / sackWidth) % 2 === 0 ? 0 : sackLength / 2;
        for (let x = w.x - rowOffset; x < w.x + w.w; x += sackLength) {
          const sx = Math.max(w.x, x);
          const sw = Math.min(sackLength - 2, w.x + w.w - sx);
          const sh = Math.min(sackWidth - 2, w.y + w.h - y);
          if (sw <= 0 || sh <= 0) continue;

          ctx.fillStyle = "#786543";
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(sx, y + 1, sw, sh, 3) : ctx.rect(sx, y + 1, sw, sh);
          ctx.fill();

          ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
          ctx.fillRect(sx + 2, y + 2, sw - 4, Math.max(2, sh / 3));

          ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    } else {
      for (let x = w.x; x < w.x + w.w; x += sackWidth) {
        const colOffset = ((x - w.x) / sackWidth) % 2 === 0 ? 0 : sackLength / 2;
        for (let y = w.y - colOffset; y < w.y + w.h; y += sackLength) {
          const sy = Math.max(w.y, y);
          const sw = Math.min(sackWidth - 2, w.x + w.w - x);
          const sh = Math.min(sackLength - 2, w.y + w.h - sy);
          if (sw <= 0 || sh <= 0) continue;

          ctx.fillStyle = "#786543";
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x + 1, sy, sw, sh, 3) : ctx.rect(x + 1, sy, sw, sh);
          ctx.fill();

          ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
          ctx.fillRect(x + 2, sy + 2, Math.max(2, sw / 3), sh - 4);

          ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    ctx.strokeStyle = "#382c1e";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  renderBrickWall(ctx, w, wallColor, wallBorder) {
    ctx.fillStyle = "#262626";
    ctx.fillRect(w.x, w.y, w.w, w.h);

    const bW = 20;
    const bH = 10;
    const brickTones = ["#7f1d1d", "#852618", "#6b211a", "#991b1b", "#5c1d18"];

    ctx.save();
    let row = 0;
    for (let y = w.y + 2; y < w.y + w.h - 2; y += bH + 2) {
      const offset = (row % 2 === 0) ? 0 : bW / 2;
      for (let x = w.x + 2 - offset; x < w.x + w.w - 2; x += bW + 2) {
        const bx = Math.max(w.x + 2, x);
        const bw = Math.min(bW, w.x + w.w - 2 - bx);
        const bh = Math.min(bH, w.y + w.h - 2 - y);
        if (bw <= 0 || bh <= 0) continue;

        const tone = brickTones[Math.abs(Math.floor(x * 3 + y * 7)) % brickTones.length];
        ctx.fillStyle = tone;
        ctx.fillRect(bx, y, bw, bh);

        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(bx, y, bw, 2);
      }
      row++;
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(w.x, w.y, w.w, Math.min(4, w.h / 3));

    ctx.strokeStyle = "#171717";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  renderTrainBoxcar(ctx, w) {
    ctx.fillStyle = "#3e2417";
    ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.lineWidth = 2;
    if (w.w >= w.h) {
      for (let x = w.x + 16; x < w.x + w.w - 12; x += 16) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath(); ctx.moveTo(x - 1, w.y + 3); ctx.lineTo(x - 1, w.y + w.h - 3); ctx.stroke();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath(); ctx.moveTo(x + 1, w.y + 3); ctx.lineTo(x + 1, w.y + w.h - 3); ctx.stroke();
      }

      const doorW = Math.min(80, w.w * 0.4);
      const doorX = w.x + (w.w - doorW) / 2;
      ctx.fillStyle = "#2a180f";
      ctx.fillRect(doorX, w.y + 4, doorW, w.h - 8);
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2;
      ctx.strokeRect(doorX, w.y + 4, doorW, w.h - 8);

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(doorX + doorW / 2, w.y + 6); ctx.lineTo(doorX + doorW / 2, w.y + w.h - 6);
      ctx.stroke();
    } else {
      for (let y = w.y + 16; y < w.y + w.h - 12; y += 16) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath(); ctx.moveTo(w.x + 3, y - 1); ctx.lineTo(w.x + w.w - 3, y - 1); ctx.stroke();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath(); ctx.moveTo(w.x + 3, y + 1); ctx.lineTo(w.x + w.w - 3, y + 1); ctx.stroke();
      }
    }

    ctx.strokeStyle = "#1a0f0a";
    ctx.lineWidth = 3;
    ctx.strokeRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = "#111827";
    if (w.w >= w.h) {
      ctx.fillRect(w.x - 4, w.y + w.h / 2 - 6, 4, 12);
      ctx.fillRect(w.x + w.w, w.y + w.h / 2 - 6, 4, 12);
    } else {
      ctx.fillRect(w.x + w.w / 2 - 6, w.y - 4, 12, 4);
      ctx.fillRect(w.x + w.w / 2 - 6, w.y + w.h, 12, 4);
    }
  }

  renderWoodLogWall(ctx, w, wallColor, wallBorder) {
    ctx.fillStyle = "#2d1f14";
    ctx.fillRect(w.x, w.y, w.w, w.h);

    const logSize = 16;
    const isH = w.w >= w.h;
    ctx.lineWidth = 2;
    if (isH) {
      for (let y = w.y + logSize; y < w.y + w.h; y += logSize) {
        ctx.strokeStyle = "#1a120b";
        ctx.beginPath(); ctx.moveTo(w.x, y); ctx.lineTo(w.x + w.w, y); ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath(); ctx.moveTo(w.x, y + 1); ctx.lineTo(w.x + w.w, y + 1); ctx.stroke();
      }
    } else {
      for (let x = w.x + logSize; x < w.x + w.w; x += logSize) {
        ctx.strokeStyle = "#1a120b";
        ctx.beginPath(); ctx.moveTo(x, w.y); ctx.lineTo(x, w.y + w.h); ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath(); ctx.moveTo(x + 1, w.y); ctx.lineTo(x + 1, w.y + w.h); ctx.stroke();
      }
    }
    ctx.strokeStyle = "#140c06";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  renderDesertAdobeWall(ctx, w, wallColor, wallBorder) {
    ctx.fillStyle = wallColor || "#523c28";
    ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(w.x, w.y, w.w, Math.min(5, w.h / 3));

    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1.5;
    const step = 28;
    if (w.w >= w.h) {
      for (let x = w.x + step; x < w.x + w.w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, w.y); ctx.lineTo(x, w.y + w.h); ctx.stroke();
      }
    } else {
      for (let y = w.y + step; y < w.y + w.h; y += step) {
        ctx.beginPath(); ctx.moveTo(w.x, y); ctx.lineTo(w.x + w.w, y); ctx.stroke();
      }
    }

    ctx.strokeStyle = wallBorder || "#8c6b45";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  renderBunkerConcreteWall(ctx, w, wallColor, wallBorder) {
    ctx.fillStyle = wallColor || "#252b36";
    ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(w.x, w.y, w.w, Math.min(5, w.h / 3));
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(w.x, w.y + w.h - Math.min(5, w.h / 3), w.w, Math.min(5, w.h / 3));

    const pad = 10;
    const tieHoles = [
      { x: w.x + pad, y: w.y + pad },
      { x: w.x + w.w - pad, y: w.y + pad },
      { x: w.x + pad, y: w.y + w.h - pad },
      { x: w.x + w.w - pad, y: w.y + w.h - pad }
    ];
    ctx.fillStyle = "#0f172a";
    tieHoles.forEach(th => {
      ctx.beginPath();
      ctx.arc(th.x, th.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = wallBorder || "#475569";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  drawCrates(ctx, crates, theme = {}) {
    if (!crates) return;
    const crateBg = theme.crateColor || "#8a6136";
    const crateBorder = theme.crateBorder || "#4a3219";

    crates.forEach(c => {
      if (c.hp <= 0) return;
      if (!this.isRectInView(c.x, c.y, c.size, c.size)) return;

      // 3D Drop shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(c.x + 6, c.y + 6, c.size, c.size);

      // Crate wooden plank background
      ctx.fillStyle = crateBg;
      ctx.fillRect(c.x, c.y, c.size, c.size);

      // Horizontal Wood Planks
      const plankCount = 4;
      const plankH = c.size / plankCount;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 1.5;
      for (let i = 1; i < plankCount; i++) {
        const py = c.y + i * plankH;
        ctx.beginPath();
        ctx.moveTo(c.x + 3, py);
        ctx.lineTo(c.x + c.size - 3, py);
        ctx.stroke();
      }

      // 3D Diagonal Cross Bracing
      ctx.strokeStyle = crateBorder;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(c.x + 4, c.y + 4);
      ctx.lineTo(c.x + c.size - 4, c.y + c.size - 4);
      ctx.moveTo(c.x + c.size - 4, c.y + 4);
      ctx.lineTo(c.x + 4, c.y + c.size - 4);
      ctx.stroke();

      // Outer Reinforced Wooden Rim
      ctx.strokeStyle = crateBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x, c.y, c.size, c.size);

      // 4 Heavy Iron Corner Reinforcement Brackets with Rivets
      const bw = Math.min(10, c.size * 0.22);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(c.x, c.y, bw, bw);
      ctx.fillRect(c.x + c.size - bw, c.y, bw, bw);
      ctx.fillRect(c.x, c.y + c.size - bw, bw, bw);
      ctx.fillRect(c.x + c.size - bw, c.y + c.size - bw, bw, bw);

      // Rivets (silver metallic dots)
      ctx.fillStyle = "#94a3b8";
      const rivets = [
        { x: c.x + bw / 2, y: c.y + bw / 2 },
        { x: c.x + c.size - bw / 2, y: c.y + bw / 2 },
        { x: c.x + bw / 2, y: c.y + c.size - bw / 2 },
        { x: c.x + c.size - bw / 2, y: c.y + c.size - bw / 2 }
      ];
      rivets.forEach(rv => {
        ctx.beginPath();
        ctx.arc(rv.x, rv.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Military Stencil Supply Insignia (Center)
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = `bold ${Math.max(9, Math.floor(c.size * 0.22))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AMMO", c.x + c.size / 2, c.y + c.size / 2);

      // Dynamic Damage Cracks (when HP < maxHP)
      if (c.hp < c.maxHp) {
        const dmgRatio = 1 - (c.hp / c.maxHp);
        ctx.strokeStyle = "rgba(15, 10, 5, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x + c.size * 0.3, c.y + 4);
        ctx.lineTo(c.x + c.size * 0.45, c.y + c.size * 0.5);
        ctx.lineTo(c.x + c.size * 0.35, c.y + c.size - 4);
        if (dmgRatio > 0.5) {
          ctx.moveTo(c.x + c.size * 0.45, c.y + c.size * 0.5);
          ctx.lineTo(c.x + c.size * 0.75, c.y + c.size * 0.65);
        }
        ctx.stroke();

        // Health bar
        const barW = c.size;
        const barH = 5;
        const barX = c.x;
        const barY = c.y - 8;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = c.hp > c.maxHp * 0.4 ? "#10b981" : "#ef4444";
        ctx.fillRect(barX, barY, barW * (c.hp / c.maxHp), barH);
      }
    });
  }

  drawItems(ctx, items) {
    if (!items) return;
    const time = Date.now() / 300;
    items.forEach(it => {
      // Frustum culling
      if (!this.isCircleInView(it.x, it.y, it.radius + 6)) return;

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

  drawHumanCharacter(ctx, p, radius, kick, walk = 0) {
    // 1. Combat Boots (Stepping animation with smooth continuous phase)
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
      const ip = this.interpolatedPlayers.get(p.id) || p;
      const px = ip.x !== undefined ? ip.x : p.x;
      const py = ip.y !== undefined ? ip.y : p.y;
      const pAngle = ip.angle !== undefined ? ip.angle : p.angle;

      // Frustum culling using smoothed render coordinates
      if (p.id !== localPlayer?.id && !this.isCircleInView(px, py, radius + 45)) {
        return;
      }

      if (!p.isAlive) {
        // Draw ghost respawn circle
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
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
      ctx.translate(px, py);

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

      // 3. Shield aura & Respawn Protection
      const isSpawnShield = p.spawnShieldEndTime && Date.now() < p.spawnShieldEndTime;
      if (p.shield > 0 || isSpawnShield) {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = isSpawnShield ? "#eab308" : "#3b82f6";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = isSpawnShield ? "rgba(234, 179, 8, 0.18)" : "rgba(59, 130, 246, 0.12)";
        ctx.fill();
      }

      // 4. Aim guide laser line for local player
      if (p.id === localPlayer?.id) {
        ctx.save();
        ctx.rotate(pAngle);
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
      ctx.rotate(pAngle);

      const lastFire = this.recoil.get(p.id) || 0;
      const elapsed = Date.now() - lastFire;
      let kick = 0;
      if (elapsed < 110) {
        kick = (1 - elapsed / 110) * 5;
      }

      const walk = ip.isMoving ? Math.sin(ip.walkPhase || 0) * (radius * 0.22) : 0;
      this.drawHumanCharacter(ctx, p, radius, kick, walk);

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

  drawBushes(ctx, bushes, localPlayer, theme = {}) {
    if (!bushes || bushes.length === 0) return;
    const localIP = localPlayer ? (this.interpolatedPlayers.get(localPlayer.id) || localPlayer) : null;
    const defaultDark = theme.bushColor || "#1b4332";
    const defaultMid = theme.bushBorder || "#2d6a4f";
    const defaultLight = theme.bushLeaf || "#52b788";

    bushes.forEach((b, idx) => {
      // Frustum culling with padding for organic foliage spread
      if (!this.isCircleInView(b.x, b.y, b.radius * 1.3)) return;

      const playerInside = localIP && Math.hypot(localIP.x - b.x, localIP.y - b.y) < b.radius;
      const alpha = playerInside ? 0.38 : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;

      // 1. Soft ground contact shadow under foliage
      ctx.beginPath();
      ctx.ellipse(b.x + 4, b.y + 8, b.radius * 1.05, b.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fill();

      // Deterministic pseudo-random seed based on position
      const seed = Math.sin(b.x * 12.9898 + b.y * 78.233) * 43758.5453;
      const getRand = (offset) => {
        const val = Math.sin(seed + offset) * 10000;
        return val - Math.floor(val);
      };

      // 2. Base deep-shadow undergrowth
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = defaultDark;
      ctx.fill();

      // 3. Multi-lobed organic canopy perimeter (12 irregular foliage lobes)
      const lobeCount = 12;
      for (let i = 0; i < lobeCount; i++) {
        const angle = (i / lobeCount) * Math.PI * 2 + getRand(i) * 0.25;
        const dist = b.radius * (0.62 + getRand(i * 3) * 0.28);
        const lobeRadius = b.radius * (0.38 + getRand(i * 7) * 0.16);
        const lx = b.x + Math.cos(angle) * dist;
        const ly = b.y + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(lx, ly, lobeRadius, 0, Math.PI * 2);
        ctx.fillStyle = defaultMid;
        ctx.fill();
      }

      // 4. Interior dense foliage layer
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.4;
        const dist = b.radius * 0.38;
        const lx = b.x + Math.cos(angle) * dist;
        const ly = b.y + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(lx, ly, b.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = defaultMid;
        ctx.fill();
      }

      // 5. Sunlit leaf tip highlights (top-left directional lighting)
      const sunAngle = -Math.PI * 0.75;
      for (let i = 0; i < 8; i++) {
        const angle = sunAngle + ((i - 3.5) / 4) * 0.9 + getRand(i * 11) * 0.2;
        const dist = b.radius * (0.55 + getRand(i * 5) * 0.3);
        const lx = b.x + Math.cos(angle) * dist;
        const ly = b.y + Math.sin(angle) * dist;
        const r = b.radius * (0.24 + getRand(i * 9) * 0.12);

        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fillStyle = defaultLight;
        ctx.fill();
      }

      // 6. Center canopy crest
      ctx.beginPath();
      ctx.arc(b.x - 3, b.y - 4, b.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = defaultLight;
      ctx.fill();

      // 7. Tactical stealth glow indicator when local player is concealed inside
      if (playerInside) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 1.05, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(74, 222, 128, 0.7)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }

  drawBullets(ctx, bullets) {
    if (!bullets || bullets.length === 0) return;
    bullets.forEach(b => {
      // Frustum culling
      if (!this.isCircleInView(b.x, b.y, 30)) return;

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
    mCtx.fillStyle = mapData.theme?.wallBorder || "rgba(100, 116, 139, 0.7)";
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

        const ip = this.interpolatedPlayers.get(p.id) || p;
        mCtx.beginPath();
        const px = (ip.x !== undefined ? ip.x : p.x) * sx;
        const py = (ip.y !== undefined ? ip.y : p.y) * sy;
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

  drawVignette(ctx) {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w <= 0 || h <= 0) return;

    const cx = w * 0.5;
    const cy = h * 0.5;
    const innerR = Math.min(cx, cy) * 0.72;
    const outerR = Math.max(cx, cy) * 1.28;

    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.65, "rgba(2, 6, 23, 0.18)");
    grad.addColorStop(1, "rgba(2, 6, 23, 0.48)");

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

