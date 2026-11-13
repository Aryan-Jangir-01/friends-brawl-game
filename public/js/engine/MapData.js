// server/MapData.js

export const MAPS = {
  // 1. 🎖️ Military Airbase (Runway, Sandbags, Concrete Bunkers)
  military_airbase: {
    id: "military_airbase",
    name: "Military Airbase",
    width: 2600,
    height: 1900,
    theme: {
      background: "#1a1d21",
      gridColor: "rgba(234, 179, 8, 0.07)",
      borderColor: "#475569",
      wallColor: "#2e3746",
      wallBorder: "#4b5563",
      wallStyle: "sandbag",
      bushColor: "rgba(30, 58, 38, 0.9)",
      bushBorder: "#1b4332",
      bushLeaf: "rgba(45, 106, 79, 0.75)",
      crateColor: "#404a37",
      crateBorder: "#2d3427"
    },
    walls: [
      // Central command hangar
      { x: 1100, y: 800, w: 400, h: 40 },
      { x: 1100, y: 1060, w: 400, h: 40 },
      { x: 980, y: 800, w: 40, h: 300 },
      { x: 1580, y: 800, w: 40, h: 300 },

      // Runway blast barriers (Top-Left & Top-Right)
      { x: 400, y: 400, w: 300, h: 45 },
      { x: 400, y: 400, w: 45, h: 300 },
      { x: 1900, y: 400, w: 300, h: 45 },
      { x: 2155, y: 400, w: 45, h: 300 },

      // Runway blast barriers (Bottom-Left & Bottom-Right)
      { x: 400, y: 1200, w: 45, h: 300 },
      { x: 400, y: 1455, w: 300, h: 45 },
      { x: 2155, y: 1200, w: 45, h: 300 },
      { x: 1900, y: 1455, w: 300, h: 45 },

      // Concrete pillboxes
      { x: 1250, y: 350, w: 100, h: 100 },
      { x: 1250, y: 1450, w: 100, h: 100 },
      { x: 250, y: 900, w: 100, h: 100 },
      { x: 2250, y: 900, w: 100, h: 100 }
    ],
    bushes: [
      { id: "ab1", x: 750, y: 600, radius: 95 },
      { id: "ab2", x: 1850, y: 600, radius: 95 },
      { id: "ab3", x: 750, y: 1300, radius: 95 },
      { id: "ab4", x: 1850, y: 1300, radius: 95 },
      { id: "ab5", x: 1300, y: 950, radius: 85 },
      { id: "ab6", x: 500, y: 950, radius: 85 },
      { id: "ab7", x: 2100, y: 950, radius: 85 }
    ],
    crates: [
      { id: "ac1", x: 880, y: 420, hp: 50, maxHp: 50, size: 55 },
      { id: "ac2", x: 945, y: 420, hp: 50, maxHp: 50, size: 55 },
      { id: "ac3", x: 1600, y: 420, hp: 50, maxHp: 50, size: 55 },
      { id: "ac4", x: 1665, y: 420, hp: 50, maxHp: 50, size: 55 },
      { id: "ac5", x: 880, y: 1420, hp: 50, maxHp: 50, size: 55 },
      { id: "ac6", x: 1665, y: 1420, hp: 50, maxHp: 50, size: 55 },
      { id: "ac7", x: 1050, y: 950, hp: 50, maxHp: 50, size: 55 },
      { id: "ac8", x: 1500, y: 950, hp: 50, maxHp: 50, size: 55 }
    ],
    itemSpawners: [
      { id: "as_mid", x: 1300, y: 950, type: "rocket", interval: 18000 },
      { id: "as_top", x: 1300, y: 220, type: "shotgun", interval: 12000 },
      { id: "as_bottom", x: 1300, y: 1680, type: "plasma", interval: 12000 },
      { id: "as_hp_left", x: 300, y: 450, type: "health", interval: 15000 },
      { id: "as_hp_right", x: 2300, y: 450, type: "health", interval: 15000 },
      { id: "as_sh_left", x: 300, y: 1450, type: "shield", interval: 15000 },
      { id: "as_sh_right", x: 2300, y: 1450, type: "shield", interval: 15000 },
      { id: "as_boost_1", x: 800, y: 950, type: "boost", interval: 15000 },
      { id: "as_boost_2", x: 1800, y: 950, type: "boost", interval: 15000 }
    ],
    spawnPoints: [
      { x: 300, y: 300 },
      { x: 2300, y: 300 },
      { x: 300, y: 1600 },
      { x: 2300, y: 1600 },
      { x: 1300, y: 500 },
      { x: 1300, y: 1400 },
      { x: 650, y: 950 },
      { x: 1950, y: 950 }
    ]
  },

  // 2. 🚢 Cargo Docks (Shipping Containers, Wet Asphalt, Tactical Corridors)
  cargo_docks: {
    id: "cargo_docks",
    name: "Cargo Docks",
    width: 2500,
    height: 2000,
    theme: {
      background: "#111418",
      gridColor: "rgba(100, 116, 139, 0.08)",
      borderColor: "#0284c7",
      wallColor: "#882b2b",
      wallBorder: "#991b1b",
      wallStyle: "container",
      bushColor: "rgba(30, 41, 59, 0.9)",
      bushBorder: "#1e293b",
      bushLeaf: "rgba(51, 65, 85, 0.75)",
      crateColor: "#78350f",
      crateBorder: "#451a03"
    },
    walls: [
      // Shipping containers clusters
      { x: 650, y: 380, w: 320, h: 70 },
      { x: 650, y: 640, w: 320, h: 70 },
      { x: 1530, y: 380, w: 320, h: 70 },
      { x: 1530, y: 640, w: 320, h: 70 },

      { x: 650, y: 1290, w: 320, h: 70 },
      { x: 650, y: 1550, w: 320, h: 70 },
      { x: 1530, y: 1290, w: 320, h: 70 },
      { x: 1530, y: 1550, w: 320, h: 70 },

      // Central crossing container stack
      { x: 1100, y: 860, w: 75, h: 280 },
      { x: 1325, y: 860, w: 75, h: 280 },

      // Side flank blockers
      { x: 300, y: 965, w: 260, h: 70 },
      { x: 1940, y: 965, w: 260, h: 70 }
    ],
    bushes: [
      { id: "cb1", x: 1250, y: 600, radius: 90 },
      { id: "cb2", x: 1250, y: 1400, radius: 90 },
      { id: "cb3", x: 450, y: 600, radius: 85 },
      { id: "cb4", x: 2050, y: 600, radius: 85 },
      { id: "cb5", x: 450, y: 1400, radius: 85 },
      { id: "cb6", x: 2050, y: 1400, radius: 85 }
    ],
    crates: [
      { id: "cc1", x: 1215, y: 960, hp: 50, maxHp: 50, size: 60 },
      { id: "cc2", x: 800, y: 510, hp: 50, maxHp: 50, size: 55 },
      { id: "cc3", x: 1700, y: 510, hp: 50, maxHp: 50, size: 55 },
      { id: "cc4", x: 800, y: 1420, hp: 50, maxHp: 50, size: 55 },
      { id: "cc5", x: 1700, y: 1420, hp: 50, maxHp: 50, size: 55 }
    ],
    itemSpawners: [
      { id: "cs_mid", x: 1250, y: 1000, type: "shotgun", interval: 12000 },
      { id: "cs_top", x: 1250, y: 250, type: "rocket", interval: 16000 },
      { id: "cs_bottom", x: 1250, y: 1750, type: "railgun", interval: 16000 },
      { id: "cs_hp1", x: 250, y: 500, type: "health", interval: 14000 },
      { id: "cs_hp2", x: 2250, y: 1500, type: "health", interval: 14000 },
      { id: "cs_sh1", x: 2250, y: 500, type: "shield", interval: 14000 },
      { id: "cs_sh2", x: 250, y: 1500, type: "shield", interval: 14000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2250, y: 250 },
      { x: 250, y: 1750 },
      { x: 2250, y: 1750 },
      { x: 1250, y: 450 },
      { x: 1250, y: 1550 },
      { x: 450, y: 1000 },
      { x: 2050, y: 1000 }
    ]
  },

  // 3. 🏜️ Desert Town (Dust II Style Sandstone Alleys & Courtyards)
  desert_town: {
    id: "desert_town",
    name: "Desert Town (Dust II)",
    width: 2600,
    height: 2000,
    theme: {
      background: "#261e14",
      gridColor: "rgba(217, 180, 130, 0.07)",
      borderColor: "#785b3a",
      wallColor: "#523c28",
      wallBorder: "#8c6b45",
      wallStyle: "desert",
      bushColor: "rgba(84, 71, 46, 0.9)",
      bushBorder: "#5c4d32",
      bushLeaf: "rgba(120, 103, 68, 0.75)",
      crateColor: "#8f653b",
      crateBorder: "#5c3d1e"
    },
    walls: [
      // Central marketplace adobe walls
      { x: 1050, y: 750, w: 500, h: 45 },
      { x: 1050, y: 1205, w: 500, h: 45 },
      { x: 920, y: 750, w: 45, h: 500 },
      { x: 1635, y: 750, w: 45, h: 500 },

      // Long A-site alleyway walls
      { x: 400, y: 350, w: 450, h: 45 },
      { x: 400, y: 350, w: 45, h: 450 },
      { x: 400, y: 1200, w: 45, h: 450 },
      { x: 400, y: 1605, w: 450, h: 45 },

      // B-site fortress walls
      { x: 1750, y: 350, w: 450, h: 45 },
      { x: 2155, y: 350, w: 45, h: 450 },
      { x: 2155, y: 1200, w: 45, h: 450 },
      { x: 1750, y: 1605, w: 450, h: 45 }
    ],
    bushes: [
      { id: "db1", x: 750, y: 600, radius: 90 },
      { id: "db2", x: 1850, y: 600, radius: 90 },
      { id: "db3", x: 750, y: 1400, radius: 90 },
      { id: "db4", x: 1850, y: 1400, radius: 90 },
      { id: "db5", x: 1300, y: 980, radius: 85 }
    ],
    crates: [
      { id: "dc1", x: 1100, y: 850, hp: 50, maxHp: 50, size: 55 },
      { id: "dc2", x: 1450, y: 850, hp: 50, maxHp: 50, size: 55 },
      { id: "dc3", x: 1100, y: 1100, hp: 50, maxHp: 50, size: 55 },
      { id: "dc4", x: 1450, y: 1100, hp: 50, maxHp: 50, size: 55 },
      { id: "dc5", x: 500, y: 500, hp: 45, maxHp: 45, size: 50 },
      { id: "dc6", x: 2050, y: 500, hp: 45, maxHp: 45, size: 50 }
    ],
    itemSpawners: [
      { id: "ds_mid", x: 1300, y: 980, type: "railgun", interval: 15000 },
      { id: "ds_a", x: 500, y: 400, type: "shotgun", interval: 12000 },
      { id: "ds_b", x: 2100, y: 400, type: "plasma", interval: 12000 },
      { id: "ds_hp1", x: 300, y: 1000, type: "health", interval: 14000 },
      { id: "ds_hp2", x: 2300, y: 1000, type: "health", interval: 14000 },
      { id: "ds_sh1", x: 1300, y: 250, type: "shield", interval: 12000 },
      { id: "ds_sh2", x: 1300, y: 1750, type: "shield", interval: 12000 }
    ],
    spawnPoints: [
      { x: 300, y: 300 },
      { x: 2300, y: 300 },
      { x: 300, y: 1700 },
      { x: 2300, y: 1700 },
      { x: 1300, y: 450 },
      { x: 1300, y: 1550 },
      { x: 600, y: 1000 },
      { x: 2000, y: 1000 }
    ]
  },

  // 4. 🏭 Abandoned Factory (Red Bricks, Heavy Machinery & Acid Vats)
  abandoned_factory: {
    id: "abandoned_factory",
    name: "Abandoned Factory",
    width: 2500,
    height: 1900,
    theme: {
      background: "#151618",
      gridColor: "rgba(239, 68, 68, 0.06)",
      borderColor: "#dc2626",
      wallColor: "#3d2424",
      wallBorder: "#6b3333",
      wallStyle: "brick",
      bushColor: "rgba(38, 38, 42, 0.9)",
      bushBorder: "#26262a",
      bushLeaf: "rgba(64, 64, 70, 0.75)",
      crateColor: "#475569",
      crateBorder: "#1e293b"
    },
    hazards: [
      { id: "fh1", x: 1250, y: 950, radius: 160, dps: 18, color: "rgba(220, 38, 38, 0.35)" },
      { id: "fh2", x: 600, y: 550, radius: 120, dps: 15, color: "rgba(220, 38, 38, 0.3)" },
      { id: "fh3", x: 1900, y: 1350, radius: 120, dps: 15, color: "rgba(220, 38, 38, 0.3)" }
    ],
    walls: [
      { x: 850, y: 420, w: 800, h: 45 },
      { x: 850, y: 1435, w: 800, h: 45 },
      { x: 420, y: 850, w: 260, h: 60 },
      { x: 1820, y: 850, w: 260, h: 60 },
      { x: 1220, y: 200, w: 60, h: 220 },
      { x: 1220, y: 1480, w: 60, h: 220 }
    ],
    bushes: [
      { id: "fb1", x: 1250, y: 600, radius: 85 },
      { id: "fb2", x: 1250, y: 1300, radius: 85 },
      { id: "fb3", x: 850, y: 950, radius: 80 },
      { id: "fb4", x: 1650, y: 950, radius: 80 }
    ],
    crates: [
      { id: "fc1", x: 1220, y: 920, hp: 50, maxHp: 50, size: 60 },
      { id: "fc2", x: 600, y: 950, hp: 50, maxHp: 50, size: 55 },
      { id: "fc3", x: 1900, y: 950, hp: 50, maxHp: 50, size: 55 }
    ],
    itemSpawners: [
      { id: "fs_mid", x: 1250, y: 950, type: "rocket", interval: 16000 },
      { id: "fs_hp1", x: 300, y: 950, type: "health", interval: 12000 },
      { id: "fs_hp2", x: 2200, y: 950, type: "health", interval: 12000 },
      { id: "fs_sh1", x: 1250, y: 120, type: "shield", interval: 12000 },
      { id: "fs_sh2", x: 1250, y: 1780, type: "shield", interval: 12000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2250, y: 250 },
      { x: 250, y: 1650 },
      { x: 2250, y: 1650 },
      { x: 1250, y: 380 },
      { x: 1250, y: 1520 }
    ]
  },

  // 5. 🌲 Dense Jungle (Rainforest Mud, Ancient Trees, Stealth Bushes)
  dense_jungle: {
    id: "dense_jungle",
    name: "Dense Jungle",
    width: 2500,
    height: 2100,
    theme: {
      background: "#141c12",
      gridColor: "rgba(34, 197, 94, 0.06)",
      borderColor: "#15803d",
      wallColor: "#23311f",
      wallBorder: "#365314",
      wallStyle: "wood",
      bushColor: "rgba(20, 83, 45, 0.92)",
      bushBorder: "#14532d",
      bushLeaf: "rgba(22, 101, 52, 0.8)",
      crateColor: "#5c4028",
      crateBorder: "#3a2817"
    },
    walls: [
      // Ancient stone ruin walls & fallen logs
      { x: 800, y: 550, w: 350, h: 50 },
      { x: 1350, y: 550, w: 350, h: 50 },
      { x: 800, y: 1500, w: 350, h: 50 },
      { x: 1350, y: 1500, w: 350, h: 50 },

      // Giant tree trunks (natural pillars)
      { x: 1200, y: 950, w: 100, h: 200 },
      { x: 550, y: 1000, w: 180, h: 70 },
      { x: 1770, y: 1000, w: 180, h: 70 }
    ],
    bushes: [
      // Massive stealth fern bushes across the jungle
      { id: "jb1", x: 1250, y: 700, radius: 110 },
      { id: "jb2", x: 1250, y: 1400, radius: 110 },
      { id: "jb3", x: 600, y: 650, radius: 100 },
      { id: "jb4", x: 1900, y: 650, radius: 100 },
      { id: "jb5", x: 600, y: 1450, radius: 100 },
      { id: "jb6", x: 1900, y: 1450, radius: 100 },
      { id: "jb7", x: 1250, y: 1050, radius: 95 }
    ],
    crates: [
      { id: "jc1", x: 950, y: 900, hp: 50, maxHp: 50, size: 55 },
      { id: "jc2", x: 1500, y: 900, hp: 50, maxHp: 50, size: 55 },
      { id: "jc3", x: 950, y: 1200, hp: 50, maxHp: 50, size: 55 },
      { id: "jc4", x: 1500, y: 1200, hp: 50, maxHp: 50, size: 55 }
    ],
    itemSpawners: [
      { id: "js_mid", x: 1250, y: 1050, type: "plasma", interval: 13000 },
      { id: "js_top", x: 1250, y: 300, type: "rocket", interval: 16000 },
      { id: "js_bottom", x: 1250, y: 1800, type: "shotgun", interval: 12000 },
      { id: "js_hp1", x: 300, y: 1050, type: "health", interval: 14000 },
      { id: "js_hp2", x: 2200, y: 1050, type: "health", interval: 14000 }
    ],
    spawnPoints: [
      { x: 300, y: 300 },
      { x: 2200, y: 300 },
      { x: 300, y: 1800 },
      { x: 2200, y: 1800 },
      { x: 1250, y: 500 },
      { x: 1250, y: 1600 }
    ]
  },

  // 6. ❄️ Arctic Snow Base (Glacier Ice, Cold Blast Doors, Snow Camo)
  arctic_base: {
    id: "arctic_base",
    name: "Arctic Snow Base",
    width: 2500,
    height: 1900,
    theme: {
      background: "#1c242c",
      gridColor: "rgba(186, 230, 253, 0.08)",
      borderColor: "#38bdf8",
      wallColor: "#334155",
      wallBorder: "#64748b",
      wallStyle: "concrete",
      bushColor: "rgba(47, 65, 86, 0.9)",
      bushBorder: "#475569",
      bushLeaf: "rgba(148, 163, 184, 0.65)",
      crateColor: "#cbd5e1",
      crateBorder: "#64748b"
    },
    walls: [
      // Central high-tech radar bunker
      { x: 1080, y: 800, w: 340, h: 45 },
      { x: 1080, y: 1055, w: 340, h: 45 },
      { x: 960, y: 800, w: 45, h: 300 },
      { x: 1495, y: 800, w: 45, h: 300 },

      // Perimeter ice barriers
      { x: 450, y: 450, w: 250, h: 45 },
      { x: 450, y: 450, w: 45, h: 250 },
      { x: 1800, y: 450, w: 250, h: 45 },
      { x: 2005, y: 450, w: 45, h: 250 },
      { x: 450, y: 1205, w: 45, h: 250 },
      { x: 450, y: 1410, w: 250, h: 45 },
      { x: 2005, y: 1205, w: 45, h: 250 },
      { x: 1800, y: 1410, w: 250, h: 45 }
    ],
    bushes: [
      { id: "sb1", x: 750, y: 650, radius: 90 },
      { id: "sb2", x: 1750, y: 650, radius: 90 },
      { id: "sb3", x: 750, y: 1250, radius: 90 },
      { id: "sb4", x: 1750, y: 1250, radius: 90 },
      { id: "sb5", x: 1250, y: 950, radius: 80 }
    ],
    crates: [
      { id: "sc1", x: 1030, y: 925, hp: 50, maxHp: 50, size: 55 },
      { id: "sc2", x: 1420, y: 925, hp: 50, maxHp: 50, size: 55 },
      { id: "sc3", x: 800, y: 450, hp: 50, maxHp: 50, size: 50 },
      { id: "sc4", x: 1650, y: 450, hp: 50, maxHp: 50, size: 50 }
    ],
    itemSpawners: [
      { id: "ss_mid", x: 1250, y: 950, type: "railgun", interval: 15000 },
      { id: "ss_top", x: 1250, y: 250, type: "shotgun", interval: 12000 },
      { id: "ss_bottom", x: 1250, y: 1650, type: "rocket", interval: 16000 },
      { id: "ss_hp1", x: 300, y: 950, type: "health", interval: 14000 },
      { id: "ss_hp2", x: 2200, y: 950, type: "health", interval: 14000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2250, y: 250 },
      { x: 250, y: 1650 },
      { x: 2250, y: 1650 },
      { x: 1250, y: 500 },
      { x: 1250, y: 1400 }
    ]
  },

  // 7. 🏙️ City Ruins (Street Warzone, Rubble & Broken Concrete)
  city_ruins: {
    id: "city_ruins",
    name: "City Ruins",
    width: 2600,
    height: 2000,
    theme: {
      background: "#161719",
      gridColor: "rgba(245, 245, 245, 0.06)",
      borderColor: "#6b7280",
      wallColor: "#2a2d32",
      wallBorder: "#4b5563",
      wallStyle: "brick",
      bushColor: "rgba(35, 45, 35, 0.9)",
      bushBorder: "#283528",
      bushLeaf: "rgba(45, 60, 45, 0.75)",
      crateColor: "#52525b",
      crateBorder: "#27272a"
    },
    walls: [
      // Collapsed city intersection buildings
      { x: 600, y: 450, w: 400, h: 50 },
      { x: 600, y: 450, w: 50, h: 350 },
      { x: 1600, y: 450, w: 400, h: 50 },
      { x: 1950, y: 450, w: 50, h: 350 },

      { x: 600, y: 1200, w: 50, h: 350 },
      { x: 600, y: 1500, w: 400, h: 50 },
      { x: 1950, y: 1200, w: 50, h: 350 },
      { x: 1600, y: 1500, w: 400, h: 50 },

      // Destroyed bus / barricades in mid street
      { x: 1150, y: 920, w: 300, h: 60 },
      { x: 1270, y: 650, w: 60, h: 180 },
      { x: 1270, y: 1070, w: 60, h: 180 }
    ],
    bushes: [
      { id: "urb1", x: 800, y: 700, radius: 85 },
      { id: "urb2", x: 1800, y: 700, radius: 85 },
      { id: "urb3", x: 800, y: 1300, radius: 85 },
      { id: "urb4", x: 1800, y: 1300, radius: 85 },
      { id: "urb5", x: 1300, y: 1000, radius: 80 }
    ],
    crates: [
      { id: "uc1", x: 1050, y: 920, hp: 50, maxHp: 50, size: 55 },
      { id: "uc2", x: 1495, y: 920, hp: 50, maxHp: 50, size: 55 },
      { id: "uc3", x: 700, y: 550, hp: 50, maxHp: 50, size: 50 },
      { id: "uc4", x: 1850, y: 550, hp: 50, maxHp: 50, size: 50 }
    ],
    itemSpawners: [
      { id: "us_mid", x: 1300, y: 1000, type: "rocket", interval: 16000 },
      { id: "us_top", x: 1300, y: 250, type: "shotgun", interval: 12000 },
      { id: "us_bottom", x: 1300, y: 1750, type: "plasma", interval: 12000 },
      { id: "us_hp1", x: 300, y: 1000, type: "health", interval: 14000 },
      { id: "us_hp2", x: 2300, y: 1000, type: "health", interval: 14000 }
    ],
    spawnPoints: [
      { x: 300, y: 300 },
      { x: 2300, y: 300 },
      { x: 300, y: 1700 },
      { x: 2300, y: 1700 },
      { x: 1300, y: 450 },
      { x: 1300, y: 1550 }
    ]
  },

  // 8. 🚂 Railway Depot (Train Cars, Tracks, Gravel & Choke Points)
  railway_depot: {
    id: "railway_depot",
    name: "Railway Depot",
    width: 2700,
    height: 1800,
    theme: {
      background: "#181716",
      gridColor: "rgba(180, 150, 120, 0.06)",
      borderColor: "#78350f",
      wallColor: "#4a2d1d",
      wallBorder: "#6b3d26",
      wallStyle: "train",
      bushColor: "rgba(45, 48, 35, 0.9)",
      bushBorder: "#353825",
      bushLeaf: "rgba(65, 70, 50, 0.75)",
      crateColor: "#6b4a2b",
      crateBorder: "#3d2814"
    },
    walls: [
      // Train boxcars (horizontal & vertical)
      { x: 600, y: 450, w: 450, h: 65 },
      { x: 1650, y: 450, w: 450, h: 65 },
      { x: 600, y: 1285, w: 450, h: 65 },
      { x: 1650, y: 1285, w: 450, h: 65 },

      // Central train wagon switchyard
      { x: 1150, y: 700, w: 400, h: 65 },
      { x: 1150, y: 1035, w: 400, h: 65 },
      { x: 400, y: 865, w: 65, h: 250 },
      { x: 2235, y: 865, w: 65, h: 250 }
    ],
    bushes: [
      { id: "rb1", x: 1350, y: 550, radius: 85 },
      { id: "rb2", x: 1350, y: 1250, radius: 85 },
      { id: "rb3", x: 800, y: 900, radius: 80 },
      { id: "rb4", x: 1900, y: 900, radius: 80 }
    ],
    crates: [
      { id: "rc1", x: 1050, y: 865, hp: 50, maxHp: 50, size: 60 },
      { id: "rc2", x: 1590, y: 865, hp: 50, maxHp: 50, size: 60 },
      { id: "rc3", x: 1320, y: 865, hp: 50, maxHp: 50, size: 60 }
    ],
    itemSpawners: [
      { id: "rs_mid", x: 1350, y: 900, type: "shotgun", interval: 11000 },
      { id: "rs_top", x: 1350, y: 200, type: "railgun", interval: 15000 },
      { id: "rs_bottom", x: 1350, y: 1600, type: "rocket", interval: 15000 },
      { id: "rs_hp1", x: 250, y: 900, type: "health", interval: 14000 },
      { id: "rs_hp2", x: 2450, y: 900, type: "health", interval: 14000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2450, y: 250 },
      { x: 250, y: 1550 },
      { x: 2450, y: 1550 },
      { x: 1350, y: 400 },
      { x: 1350, y: 1400 }
    ]
  },

  // 9. 🏝️ Island Bunker (Coastline Sand, Sea Pillboxes & Palm Bushes)
  island_bunker: {
    id: "island_bunker",
    name: "Island Bunker",
    width: 2500,
    height: 2000,
    theme: {
      background: "#1f1d16",
      gridColor: "rgba(56, 189, 248, 0.08)",
      borderColor: "#0284c7",
      wallColor: "#383c3e",
      wallBorder: "#555b5f",
      wallStyle: "concrete",
      bushColor: "rgba(22, 65, 42, 0.9)",
      bushBorder: "#17442b",
      bushLeaf: "rgba(34, 95, 62, 0.75)",
      crateColor: "#805833",
      crateBorder: "#4a321a"
    },
    walls: [
      // Coastal pillbox batteries
      { x: 1100, y: 800, w: 300, h: 45 },
      { x: 1100, y: 1155, w: 300, h: 45 },
      { x: 975, y: 800, w: 45, h: 400 },
      { x: 1480, y: 800, w: 45, h: 400 },

      // Sea wall revetments
      { x: 500, y: 500, w: 300, h: 50 },
      { x: 1700, y: 500, w: 300, h: 50 },
      { x: 500, y: 1450, w: 300, h: 50 },
      { x: 1700, y: 1450, w: 300, h: 50 }
    ],
    bushes: [
      { id: "ib1", x: 750, y: 700, radius: 95 },
      { id: "ib2", x: 1750, y: 700, radius: 95 },
      { id: "ib3", x: 750, y: 1300, radius: 95 },
      { id: "ib4", x: 1750, y: 1300, radius: 95 },
      { id: "ib5", x: 1250, y: 1000, radius: 85 }
    ],
    crates: [
      { id: "ic1", x: 1040, y: 970, hp: 50, maxHp: 50, size: 55 },
      { id: "ic2", x: 1405, y: 970, hp: 50, maxHp: 50, size: 55 },
      { id: "ic3", x: 650, y: 590, hp: 50, maxHp: 50, size: 50 },
      { id: "ic4", x: 1800, y: 590, hp: 50, maxHp: 50, size: 50 }
    ],
    itemSpawners: [
      { id: "is_mid", x: 1250, y: 1000, type: "rocket", interval: 15000 },
      { id: "is_top", x: 1250, y: 250, type: "plasma", interval: 12000 },
      { id: "is_bottom", x: 1250, y: 1750, type: "shotgun", interval: 12000 },
      { id: "is_hp1", x: 300, y: 1000, type: "health", interval: 14000 },
      { id: "is_hp2", x: 2200, y: 1000, type: "health", interval: 14000 }
    ],
    spawnPoints: [
      { x: 250, y: 250 },
      { x: 2250, y: 250 },
      { x: 250, y: 1750 },
      { x: 2250, y: 1750 },
      { x: 1250, y: 450 },
      { x: 1250, y: 1550 }
    ]
  }
};

// Aliases for bulletproof backwards compatibility with previous sessions or cached room data
MAPS.cyber_arena = MAPS.military_airbase;
MAPS.neon_labyrinth = MAPS.desert_town;
MAPS.toxic_wasteland = MAPS.abandoned_factory;

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
