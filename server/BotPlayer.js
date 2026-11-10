// server/BotPlayer.js

const BOT_NAMES = [
  "CyberViper", "NeonGhost", "TitanX", "ShadowReaper",
  "BlazeBot", "ApexHunter", "ZeroCool", "RogueOne"
];

const BOT_COLORS = [
  "#f43f5e", "#8b5cf6", "#ec4899", "#14b8a6",
  "#eab308", "#f97316", "#06b6d4", "#a855f7"
];

const BOT_CLASSES = ["striker", "juggernaut", "phantom", "sniper"];

export class BotPlayer {
  constructor(id, gameInstance, team = null) {
    this.id = id;
    this.game = gameInstance;
    this.name = `🤖 ${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]}`;
    this.color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
    this.avatar = BOT_CLASSES[Math.floor(Math.random() * BOT_CLASSES.length)];
    this.team = team || (Math.random() > 0.5 ? "blue" : "red");
    this.isBot = true;

    // AI state
    this.target = null;
    this.lastDecisionTime = 0;
    this.decisionInterval = 250; // ms
    this.aimJitter = 0;
    this.stuckTimer = 0;
    this.lastPos = { x: 0, y: 0 };
    this.wanderAngle = Math.random() * Math.PI * 2;
  }

  update(dt, now) {
    const player = this.game.players.get(this.id);
    if (!player || !player.isAlive) return;

    // Check stuck
    const movedDist = Math.hypot(player.x - this.lastPos.x, player.y - this.lastPos.y);
    if (movedDist < 10) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.8) {
        this.wanderAngle += Math.PI * 0.7; // Turn away
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    this.lastPos = { x: player.x, y: player.y };

    // AI Decision Making (4 times per second)
    if (now - this.lastDecisionTime > this.decisionInterval) {
      this.lastDecisionTime = now;
      this.makeDecision(player, now);
    }
  }

  makeDecision(player, now) {
    // 1. Check for urgent health pickup if HP is low
    if (player.health < 45 && this.game.groundItems.length > 0) {
      const nearestHealth = this.findNearestItem(player, "health");
      if (nearestHealth) {
        this.steerTowards(player, nearestHealth.x, nearestHealth.y);
        return;
      }
    }

    // 2. Find target enemy
    const enemy = this.findBestTarget(player);
    this.target = enemy;

    if (enemy) {
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);

      // Aim with humanized jitter
      this.aimJitter = (Math.random() - 0.5) * 0.15;
      player.input.aimAngle = angleToEnemy + this.aimJitter;
      player.angle = player.input.aimAngle;

      // Shoot if within reasonable range (< 850px)
      if (dist < 850) {
        player.input.isShooting = true;
      } else {
        player.input.isShooting = false;
      }

      // Movement tactic:
      // If close (< 250px), strafe or back up.
      // If far (> 350px), approach.
      if (dist > 350) {
        this.steerTowards(player, enemy.x, enemy.y);
      } else if (dist < 200) {
        // Back up / retreat
        player.input.moveX = -Math.cos(angleToEnemy);
        player.input.moveY = -Math.sin(angleToEnemy);
      } else {
        // Strafe sideways
        const strafeDir = Math.random() > 0.5 ? 1 : -1;
        player.input.moveX = -Math.sin(angleToEnemy) * strafeDir;
        player.input.moveY = Math.cos(angleToEnemy) * strafeDir;
      }

      // Dash tactic: If enemy is shooting or close, dash defensively
      if (dist < 260 && Math.random() < 0.25) {
        this.game.triggerDash(player);
      }
    } else {
      // No visible enemy: Wander around or search for weapon/shield
      const item = this.findNearestItem(player);
      if (item && Math.hypot(item.x - player.x, item.y - player.y) < 600) {
        this.steerTowards(player, item.x, item.y);
      } else {
        // Random wandering
        if (Math.random() < 0.1) {
          this.wanderAngle += (Math.random() - 0.5) * 1.5;
        }
        player.input.moveX = Math.cos(this.wanderAngle);
        player.input.moveY = Math.sin(this.wanderAngle);
        player.input.aimAngle = this.wanderAngle;
        player.angle = this.wanderAngle;
      }
      player.input.isShooting = false;
    }
  }

  findBestTarget(player) {
    let best = null;
    let minDist = Infinity;

    for (const other of this.game.players.values()) {
      if (other.id === player.id || !other.isAlive) continue;
      // Skip teammates
      if (this.game.options.gameMode === "team" && other.team === player.team) continue;

      // Skip stealth players in bushes unless bot is also close (< 180px)
      const dist = Math.hypot(other.x - player.x, other.y - player.y);
      if (other.inBush && dist > 180) continue;

      if (dist < minDist) {
        minDist = dist;
        best = other;
      }
    }

    return best;
  }

  findNearestItem(player, specificType = null) {
    let nearest = null;
    let minDist = Infinity;

    for (const item of this.game.groundItems) {
      if (specificType && item.type !== specificType) continue;
      const dist = Math.hypot(item.x - player.x, item.y - player.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = item;
      }
    }

    return nearest;
  }

  steerTowards(player, tx, ty) {
    const dx = tx - player.x;
    const dy = ty - player.y;
    const len = Math.hypot(dx, dy) || 1;

    player.input.moveX = dx / len;
    player.input.moveY = dy / len;
  }
}

