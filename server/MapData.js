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
  },

  neon_labyrinth: {
    name: "Neon Labyrinth",
    width: 2200,
    height: 2200,
    theme: {
      background: "#090914",
      gridColor: "rgba(168, 85, 247, 0.25)",
      wallColor: "#170f2b",
      wallBorder: "#a855f7"
    },
    walls: [
      // Concentric labyrinth corridors
      { x: 400, y: 400, w: 1400, h: 40 },
      { x: 400, y: 1760, w: 1400, h: 40 },
      { x: 400, y: 400, w: 40, h: 550 },
      { x: 400, y: 1210, w: 40, h: 590 },
      { x: 1760, y: 400, w: 40, h: 550 },
      { x: 1760, y: 1210, w: 40, h: 590 },

      // Inner ring
      { x: 750, y: 750, w: 700, h: 40 },
      { x: 750, y: 1410, w: 700, h: 40 },
      { x: 750, y: 750, w: 40, h: 250 },
      { x: 750, y: 1160, w: 40, h: 290 },
      { x: 1410, y: 750, w: 40, h: 250 },
      { x: 1410, y: 1160, w: 40, h: 290 },

      // Center vault
      { x: 1000, y: 1000, w: 80, h: 200 },
      { x: 1120, y: 1000, w: 80, h: 200 }
    ],
    bushes: [
      { id: "lb1", x: 600, y: 600, radius: 95 },
      { id: "lb2", x: 1600, y: 600, radius: 95 },
      { id: "lb3", x: 600, y: 1600, radius: 95 },
      { id: "lb4", x: 1600, y: 1600, radius: 95 },
      { id: "lb5", x: 1100, y: 600, radius: 85 },
      { id: "lb6", x: 1100, y: 1600, radius: 85 },
      { id: "lb7", x: 600, y: 1100, radius: 85 },
      { id: "lb8", x: 1600, y: 1100, radius: 85 }
    ],
    crates: [
      { id: "lc1", x: 1070, y: 920, hp: 50, maxHp: 50, size: 60 },
      { id: "lc2", x: 1070, y: 1220, hp: 50, maxHp: 50, size: 60 },
      { id: "lc3", x: 920, y: 1070, hp: 50, maxHp: 50, size: 60 },
      { id: "lc4", x: 1220, y: 1070, hp: 50, maxHp: 50, size: 60 },
      { id: "lc5", x: 500, y: 500, hp: 40, maxHp: 40, size: 50 },
      { id: "lc6", x: 1700, y: 500, hp: 40, maxHp: 40, size: 50 },
      { id: "lc7", x: 500, y: 1700, hp: 40, maxHp: 40, size: 50 },
      { id: "lc8", x: 1700, y: 1700, hp: 40, maxHp: 40, size: 50 }
    ],
    itemSpawners: [
      { id: "ls_mid", x: 1100, y: 1100, type: "rocket", interval: 14000 },
      { id: "ls_hp1", x: 400, y: 1100, type: "health", interval: 12000 },
      { id: "ls_hp2", x: 1800, y: 1100, type: "health", interval: 12000 },
      { id: "ls_sh1", x: 1100, y: 400, type: "shield", interval: 12000 },
      { id: "ls_sh2", x: 1100, y: 1800, type: "shield", interval: 12000 },
      { id: "ls_wp1", x: 800, y: 800, type: "shotgun", interval: 10000 },
      { id: "ls_wp2", x: 1400, y: 1400, type: "plasma", interval: 10000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 1950, y: 250 },
      { x: 250, y: 1950 },
      { x: 1950, y: 1950 },
      { x: 1100, y: 250 },
      { x: 1100, y: 1950 }
    ]
  },

  toxic_wasteland: {
    name: "Toxic Wasteland",
    width: 2600,
    height: 1800,
    theme: {
      background: "#0c150c",
      gridColor: "rgba(34, 197, 94, 0.2)",
      wallColor: "#1b291b",
      wallBorder: "#22c55e"
    },
    // Acid pools that cause continuous damage if stood inside
    hazards: [
      { id: "h1", x: 1300, y: 900, radius: 170, dps: 18, color: "rgba(34, 197, 94, 0.4)" },
      { id: "h2", x: 600, y: 500, radius: 130, dps: 15, color: "rgba(34, 197, 94, 0.35)" },
      { id: "h3", x: 2000, y: 1300, radius: 130, dps: 15, color: "rgba(34, 197, 94, 0.35)" }
    ],
    walls: [
      { x: 900, y: 400, w: 800, h: 45 },
      { x: 900, y: 1350, w: 800, h: 45 },
      { x: 450, y: 800, w: 250, h: 60 },
      { x: 1900, y: 800, w: 250, h: 60 },
      { x: 1270, y: 200, w: 60, h: 200 },
      { x: 1270, y: 1400, w: 60, h: 200 }
    ],
    bushes: [
      { id: "tb1", x: 1300, y: 550, radius: 85 },
      { id: "tb2", x: 1300, y: 1250, radius: 85 },
      { id: "tb3", x: 900, y: 900, radius: 80 },
      { id: "tb4", x: 1700, y: 900, radius: 80 }
    ],
    crates: [
      { id: "tc1", x: 1270, y: 870, hp: 50, maxHp: 50, size: 60 },
      { id: "tc2", x: 600, y: 900, hp: 50, maxHp: 50, size: 50 },
      { id: "tc3", x: 2000, y: 900, hp: 50, maxHp: 50, size: 50 }
    ],
    itemSpawners: [
      { id: "ts_mid", x: 1300, y: 900, type: "railgun", interval: 16000 },
      { id: "ts_hp1", x: 300, y: 900, type: "health", interval: 12000 },
      { id: "ts_hp2", x: 2300, y: 900, type: "health", interval: 12000 },
      { id: "ts_sh1", x: 1300, y: 100, type: "shield", interval: 12000 },
      { id: "ts_sh2", x: 1300, y: 1700, type: "shield", interval: 12000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2350, y: 250 },
      { x: 250, y: 1550 },
      { x: 2350, y: 1550 },
      { x: 1300, y: 350 },
      { x: 1300, y: 1450 }
    ]
  }
};

export const HERO_CLASSES = {
  striker: {
    name: "Striker",
    icon: "⚡",
    role: "Assault",
    desc: "Balanced combatant with high agility and rapid lasers",
    maxHealth: 100,
    maxShield: 50,
    speed: 340,
    dashCooldown: 2500,
    starterWeapon: "blaster",
    superName: "Overdrive Storm",
    superDesc: "Shield boost + rapid 360° laser storm",
    superChargeRequired: 100,
    stats: { speed: 80, health: 70, firepower: 75 }
  },
  juggernaut: {
    name: "Juggernaut",
    icon: "🛡️",
    role: "Tank",
    desc: "Heavily armored juggernaut with massive HP and shockwave",
    maxHealth: 140,
    maxShield: 80,
    speed: 295,
    dashCooldown: 3200,
    starterWeapon: "shotgun",
    superName: "Titan Quake",
    superDesc: "Massive ground slam shockwave destroying obstacles & blasting foes",
    superChargeRequired: 100,
    stats: { speed: 50, health: 100, firepower: 85 }
  },
  phantom: {
    name: "Phantom",
    icon: "💨",
    role: "Assassin",
    desc: "Speedster with hyper-fast dash and stealth smoke veil",
    maxHealth: 80,
    maxShield: 40,
    speed: 395,
    dashCooldown: 1600,
    starterWeapon: "plasma",
    superName: "Shadow Veil",
    superDesc: "Dense smoke bomb + 100% invisibility for 5 seconds",
    superChargeRequired: 100,
    stats: { speed: 100, health: 55, firepower: 70 }
  },
  sniper: {
    name: "Sniper",
    icon: "🎯",
    role: "Sharpshooter",
    desc: "Long-range specialist equipped with devastating orbital railgun",
    maxHealth: 90,
    maxShield: 40,
    speed: 330,
    dashCooldown: 2800,
    starterWeapon: "railgun",
    superName: "Orbital Strike",
    superDesc: "Massive satellite laser explosion at aim location",
    superChargeRequired: 100,
    stats: { speed: 65, health: 60, firepower: 100 }
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

