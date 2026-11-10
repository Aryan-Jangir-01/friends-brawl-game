// server/MapData.js

export const MAPS = {
  cyber_arena: {
    name: "Cyber Arena",
    width: 2400,
    height: 1800,
    theme: {
      background: "#0c101d",
      gridColor: "rgba(30, 48, 80, 0.4)",
      wallColor: "#1a2639",
      wallBorder: "#00f0ff"
    },
    // Static indestructible walls
    walls: [
      // Outer boundaries handled automatically
      // Central fortress
      { x: 1100, y: 800, w: 200, h: 40 },
      { x: 1100, y: 960, w: 200, h: 40 },
      { x: 960, y: 800, w: 40, h: 200 },
      { x: 1400, y: 800, w: 40, h: 200 },

      // Left quad obstacles
      { x: 400, y: 350, w: 250, h: 50 },
      { x: 400, y: 350, w: 50, h: 250 },
      { x: 450, y: 1200, w: 200, h: 50 },
      { x: 600, y: 1250, w: 50, h: 200 },

      // Right quad obstacles
      { x: 1750, y: 350, w: 250, h: 50 },
      { x: 1950, y: 350, w: 50, h: 250 },
      { x: 1750, y: 1200, w: 200, h: 50 },
      { x: 1750, y: 1250, w: 50, h: 200 },

      // Top & Bottom cover pillars
      { x: 1150, y: 300, w: 100, h: 100 },
      { x: 1150, y: 1400, w: 100, h: 100 },
      { x: 250, y: 850, w: 100, h: 100 },
      { x: 2050, y: 850, w: 100, h: 100 }
    ],
    // Bushes (players inside are invisible to outside enemies unless shooting)
    bushes: [
      { id: "b1", x: 700, y: 550, radius: 90 },
      { id: "b2", x: 1700, y: 550, radius: 90 },
      { id: "b3", x: 700, y: 1250, radius: 90 },
      { id: "b4", x: 1700, y: 1250, radius: 90 },
      { id: "b5", x: 1200, y: 900, radius: 80 },
      { id: "b6", x: 450, y: 900, radius: 80 },
      { id: "b7", x: 1950, y: 900, radius: 80 }
    ],
    // Destructible crates
    crates: [
      { id: "c1", x: 800, y: 400, hp: 50, maxHp: 50, size: 50 },
      { id: "c2", x: 860, y: 400, hp: 50, maxHp: 50, size: 50 },
      { id: "c3", x: 1540, y: 400, hp: 50, maxHp: 50, size: 50 },
      { id: "c4", x: 1600, y: 400, hp: 50, maxHp: 50, size: 50 },
      { id: "c5", x: 800, y: 1400, hp: 50, maxHp: 50, size: 50 },
      { id: "c6", x: 1600, y: 1400, hp: 50, maxHp: 50, size: 50 },
      { id: "c7", x: 1050, y: 900, hp: 50, maxHp: 50, size: 50 },
      { id: "c8", x: 1350, y: 900, hp: 50, maxHp: 50, size: 50 }
    ],
    // Spawners for items (respawn every 15-20 seconds)
    itemSpawners: [
      { id: "s_mid", x: 1200, y: 900, type: "rocket", interval: 18000 },
      { id: "s_top", x: 1200, y: 200, type: "shotgun", interval: 12000 },
      { id: "s_bottom", x: 1200, y: 1600, type: "plasma", interval: 12000 },
      { id: "s_hp_left", x: 300, y: 400, type: "health", interval: 15000 },
      { id: "s_hp_right", x: 2100, y: 400, type: "health", interval: 15000 },
      { id: "s_sh_left", x: 300, y: 1400, type: "shield", interval: 15000 },
      { id: "s_sh_right", x: 2100, y: 1400, type: "shield", interval: 15000 },
      { id: "s_boost_1", x: 750, y: 900, type: "boost", interval: 15000 },
      { id: "s_boost_2", x: 1650, y: 900, type: "boost", interval: 15000 }
    ],
    // Player spawn zones
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2150, y: 250 },
      { x: 250, y: 1550 },
      { x: 2150, y: 1550 },
      { x: 1200, y: 450 },
      { x: 1200, y: 1350 },
      { x: 600, y: 900 },
      { x: 1800, y: 900 }
    ]
  }
};

export const HERO_CLASSES = {
  striker: {
    name: "Striker",
    icon: "⚡",
    desc: "Balanced combatant with standard armor and agility",
    maxHealth: 100,
    maxShield: 50,
    speed: 340,
    dashCooldown: 2500,
    starterWeapon: "blaster"
  },
  juggernaut: {
    name: "Juggernaut",
    icon: "🛡️",
    desc: "Heavy armored fortress with high HP and thick shield",
    maxHealth: 140,
    maxShield: 80,
    speed: 295,
    dashCooldown: 3200,
    starterWeapon: "shotgun"
  },
  phantom: {
    name: "Phantom",
    icon: "💨",
    desc: "Ultra-fast ninja with rapid dash recovery",
    maxHealth: 80,
    maxShield: 40,
    speed: 395,
    dashCooldown: 1600,
    starterWeapon: "plasma"
  },
  sniper: {
    name: "Sniper",
    icon: "🎯",
    desc: "Long-range specialist carrying heavy energy weapons",
    maxHealth: 90,
    maxShield: 40,
    speed: 330,
    dashCooldown: 2800,
    starterWeapon: "railgun"
  }
};

export const WEAPON_CONFIGS = {
  blaster: {
    name: "Blaster",
    damage: 18,
    speed: 850,
    range: 1000,
    fireRate: 220, // ms between shots
    spread: 0.04,
    pellets: 1,
    ammo: Infinity,
    color: "#00f0ff",
    radius: 4,
    type: "bullet"
  },
  shotgun: {
    name: "Scatter Shotgun",
    damage: 16, // per pellet * 5 = 80 max
    speed: 780,
    range: 550,
    fireRate: 650,
    spread: 0.35,
    pellets: 5,
    ammo: 20,
    color: "#ff7700",
    radius: 5,
    type: "bullet"
  },
  plasma: {
    name: "Plasma Repeater",
    damage: 24,
    speed: 950,
    range: 1200,
    fireRate: 140,
    spread: 0.08,
    pellets: 1,
    ammo: 35,
    color: "#a855f7",
    radius: 6,
    type: "plasma"
  },
  rocket: {
    name: "RPG Launcher",
    damage: 90,
    aoeRadius: 180,
    speed: 550,
    range: 1400,
    fireRate: 1100,
    spread: 0.02,
    pellets: 1,
    ammo: 8,
    color: "#ef4444",
    radius: 9,
    type: "rocket"
  },
  railgun: {
    name: "Laser Railgun",
    damage: 85,
    speed: 2400,
    range: 1800,
    fireRate: 1200,
    spread: 0,
    pellets: 1,
    ammo: 6,
    color: "#22c55e",
    radius: 4,
    type: "railgun"
  }
};

