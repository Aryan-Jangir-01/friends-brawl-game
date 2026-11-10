# 🎮 BRAWL ZONE: Multi-Phone Action Arena

An action-packed, 2D top-down hero shooter & brawl arena designed specifically for friends to connect and battle together across different mobile phones in real time!

---

## ⚡ Features

- **📱 Zero-Install Mobile Cross-Play:** Friends play directly through Chrome, Safari, or any mobile browser. No app store downloads or APK installations needed.
- **📷 Instant QR Code Join:** Host creates a room, friends simply point their phone camera at the QR code on screen and enter the battle instantly!
- **🕹️ Dual Virtual Touch Joysticks:**
  - **Left Joystick:** Smooth 360° omnidirectional movement.
  - **Right Joystick:** Precision 360° aiming and tap/hold fire.
  - **Action Buttons:** Tactical Dash / Jet Sprint with cool particle trails + Quick Weapon Swap.
- **💻 Desktop Keyboard & Mouse Support:** Cross-play between phones and PCs (WASD / Arrows to move, Mouse to aim & shoot, Space to Dash).
- **🔫 Weapons & Power-ups:**
  - **Blaster:** Default weapon, reliable cadence, infinite ammo.
  - **Scatter Shotgun:** 5-pellet burst, lethal at close range.
  - **Plasma Repeater:** Rapid neon bolts with high velocity.
  - **RPG Rocket Launcher:** Explosive missiles with area-of-effect splash damage & screen shake.
  - **Laser Railgun:** Supersonic piercing beam.
  - **Pickups:** Health Packs (+40 HP), Energy Shields (+50 Shield), Speed Boost Overdrive.
- **🌿 Stealth & Destructible Environment:**
  - **Tall Grass / Bushes:** Hide inside bushes to become invisible to opponents unless you fire!
  - **Destructible Wooden Crates:** Blast crates to uncover mystery weapon & shield drops.
- **🔊 100% Procedural Audio Engine:** High-performance retro-arcade sound effects synthesized dynamically in-browser via Web Audio API—no audio files to download, works instantly offline.
- **📊 Real-Time Kill Feed, Minimap Radar & Match Leaderboard.**

---

## 🚀 How to Run and Play

### Step 1: Start the Server on your Computer
Open terminal in the project folder and run:
```bash
npm start
```
You will see output showing your local and Wi-Fi play URLs:
```
=======================================================
🎮  BRAWL ZONE - MULTIPLAYER ACTION SERVER RUNNING  🎮
=======================================================
Local Access:    http://localhost:3000
Mobile/LAN Play: http://10.151.227.122:3000  (Wi-Fi)
=======================================================
```

---

### Step 2: Connect Your Friends' Phones

#### Option A: Same Wi-Fi Network (Easiest)
1. Make sure all phones and your PC are connected to the **same Wi-Fi**.
2. On your phone (or host device), open:
   `http://<your-ip>:3000` (e.g. `http://10.151.227.122:3000`).
3. Tap **"CREATE ROOM"**.
4. Tap **"📷 QR"** to display the QR Code.
5. All your friends just open their phone camera, scan the QR code (or type the 4-letter Room Code), and they are in!

#### Option B: Mobile Hotspot (When outside or no Wi-Fi)
1. Turn on **Mobile Hotspot** on one phone.
2. Connect your PC and all friends' phones to that Hotspot.
3. Start the server and enjoy zero-lag multiplayer anywhere!

#### Option C: Play Over the Internet (Friends at different homes)
If your friends are in different locations and not on the same Wi-Fi, run:
```bash
npx localtunnel --port 3000
```
This generates a free public link (e.g., `https://crazy-tiger-99.loca.lt`) that anyone in the world can open on their phone!

---

## 🎮 Controls

### 📱 Mobile Phone Touch Controls
| Control | Action |
| :--- | :--- |
| **Left Screen Area** | Drag to move your brawler in any direction |
| **Right Screen Area** | Drag to aim in 360° and shoot |
| **⚡ DASH Button** | Fast evasive dodge sprint (2.5s cooldown) |
| **🔄 SWAP Button** | Switch between collected weapons |
| **⛶ Fullscreen** | Hide browser address bar for maximum view |

### 💻 Desktop Controls
| Key | Action |
| :--- | :--- |
| **W, A, S, D / Arrow Keys** | Move brawler |
| **Mouse Cursor** | Aim in 360° |
| **Left Click** | Shoot |
| **Spacebar** | Dash sprint |
| **Q / E or 1-5** | Switch weapons |

---

## 🏗️ Project Architecture

```
friends game/
  ├── package.json          # Dependencies (express, socket.io, qrcode)
  ├── PLAN.md               # Architecture specification & roadmap
  ├── server/
  │    ├── index.js         # Express server, local IP detection, QR generator
  │    ├── RoomManager.js   # Room lifecycle, host permissions, match state
  │    ├── GameInstance.js  # 45-60 Hz game physics, collision, weapons, spawners
  │    └── MapData.js       # Arena walls, bushes, crates, weapon statistics
  ├── public/
  │    ├── index.html       # HTML5 game canvas, glassmorphism lobby & HUD
  │    ├── css/
  │    │    ├── style.css   # Neon cyberpunk styling, responsive design
  │    │    └── joystick.css# Virtual joystick & action button styling
  │    └── js/
  │         ├── main.js     # Client orchestration & 60 FPS animation loop
  │         ├── audio.js    # Web Audio API sound synthesizer
  │         ├── network.js  # Socket.io connection & event handling
  │         ├── input.js    # Dual touch joysticks & keyboard/mouse input
  │         ├── renderer.js # High-DPI Canvas 2D arena & minimap renderer
  │         └── particles.js# Shockwaves, explosions, damage numbers
  └── test/
       └── multiplayer_test.js # Multi-client automated simulation test
```

