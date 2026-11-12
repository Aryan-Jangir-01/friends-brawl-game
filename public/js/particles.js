// public/js/particles.js

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  emitMuzzle(x, y, angle, color = "#00f0ff") {
    for (let i = 0; i < 6; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const speed = 120 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        radius: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life: 0.12,
        maxLife: 0.12
      });
    }
  }

  emitSparks(x, y, count = 10, color = "#ffea00") {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2.5,
        color,
        alpha: 1,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4
      });
    }
  }

  emitExplosion(x, y, radius = 80, color = "#ef4444") {
    // 1. Shockwave ring
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: radius,
      color,
      alpha: 1,
      life: 0.35,
      maxLife: 0.35
    });

    // 2. Fire & smoke fragments
    const count = Math.min(40, Math.floor(radius / 2.5));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * (radius * 3.5);
      const isSmoke = Math.random() > 0.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: isSmoke ? 6 + Math.random() * 8 : 3 + Math.random() * 5,
        color: isSmoke ? "#4b5563" : (Math.random() > 0.4 ? "#f97316" : "#eab308"),
        alpha: 1,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.65
      });
    }
  }

  emitDashTrail(x, y, angle, color = "#00f0ff") {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: -Math.cos(angle) * 50 + (Math.random() - 0.5) * 30,
        vy: -Math.sin(angle) * 50 + (Math.random() - 0.5) * 30,
        radius: 4 + Math.random() * 4,
        color,
        alpha: 0.7,
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  emitSuperEffect(hero, x, y, angle = 0) {
    if (hero === "juggernaut") {
      // Massive titan ground quake shockwaves
      this.shockwaves.push({
        x, y, radius: 20, maxRadius: 320, color: "#f59e0b", alpha: 1, life: 0.55, maxLife: 0.55
      });
      this.shockwaves.push({
        x, y, radius: 10, maxRadius: 180, color: "#ef4444", alpha: 1, life: 0.4, maxLife: 0.4
      });
      for (let i = 0; i < 35; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 100 + Math.random() * 280;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 4 + Math.random() * 7,
          color: Math.random() > 0.5 ? "#f59e0b" : "#b45309",
          alpha: 1, life: 0.5 + Math.random() * 0.3, maxLife: 0.8
        });
      }
    } else if (hero === "phantom") {
      // Violet Shadow Veil smoke cloud
      this.shockwaves.push({
        x, y, radius: 15, maxRadius: 200, color: "#a855f7", alpha: 1, life: 0.6, maxLife: 0.6
      });
      for (let i = 0; i < 40; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 160;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 8 + Math.random() * 12,
          color: Math.random() > 0.5 ? "#9333ea" : "#3b0764",
          alpha: 0.85, life: 0.7 + Math.random() * 0.5, maxLife: 1.2
        });
      }
    } else if (hero === "sniper") {
      // Orbital Satellite Strike
      const strikeX = x + Math.cos(angle) * 500;
      const strikeY = y + Math.sin(angle) * 500;
      this.shockwaves.push({
        x: strikeX, y: strikeY, radius: 15, maxRadius: 240, color: "#00f0ff", alpha: 1, life: 0.5, maxLife: 0.5
      });
      for (let i = 0; i < 30; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 260;
        this.particles.push({
          x: strikeX, y: strikeY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 3 + Math.random() * 5,
          color: Math.random() > 0.5 ? "#00f0ff" : "#38bdf8",
          alpha: 1, life: 0.4 + Math.random() * 0.3, maxLife: 0.7
        });
      }
    } else {
      // Striker Overdrive Electric Storm
      this.shockwaves.push({
        x, y, radius: 10, maxRadius: 220, color: "#00f0ff", alpha: 1, life: 0.45, maxLife: 0.45
      });
      for (let i = 0; i < 28; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 120 + Math.random() * 200;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 3 + Math.random() * 4,
          color: "#00f0ff",
          alpha: 1, life: 0.35 + Math.random() * 0.25, maxLife: 0.6
        });
      }
    }
  }

  emitConfetti(x, y, count = 40) {
    const colors = ["#ffd700", "#ff007f", "#00f0ff", "#10b981", "#a855f7", "#ffffff"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 250;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        radius: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4
      });
    }
  }

  addFloatingText(x, y, text, color = "#ffffff", fontSize = 16) {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 15,
      text,
      color,
      fontSize,
      alpha: 1,
      vy: -45,
      life: 0.8,
      maxLife: 0.8
    });
  }

  update(dt) {
    // Safety cap to prevent particle flood
    if (this.particles.length > 100) {
      this.particles.splice(0, this.particles.length - 100);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = 1 - s.life / s.maxLife;
      s.radius = 10 + progress * (s.maxRadius - 10);
      s.alpha = (1 - progress);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
    }
  }

  draw(ctx) {
    ctx.save();

    // Shockwaves
    this.shockwaves.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = s.alpha * 0.8;
      ctx.stroke();
    });

    // Particles
    this.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    });

    // Floating text
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.font = `bold ${ft.fontSize}px 'Segoe UI', sans-serif`;
      ctx.globalAlpha = ft.alpha;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }
}

