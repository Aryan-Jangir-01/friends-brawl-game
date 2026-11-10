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
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }
}

