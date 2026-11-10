# BRAWL ZONE: Multi-Phone Action Arena - Specification & Plan

## Project Overview
An action-packed, top-down multiplayer arena shooter designed specifically for friends to play together across different mobile phones (and desktop browsers) in real time. Players connect instantly via local Wi-Fi / Hotspot or online URL with Room Codes and QR Codes—no app store downloads or APK installations needed.

---

## 1. Architecture & Tech Stack

```
+-------------------------------------------------------------+
|                     Client (Mobile/Desktop)                 |
|  - HTML5 2D Canvas Renderer (60 FPS, particle physics)       |
|  - Dual Touch Virtual Joysticks (Move & Aim/Shoot)          |
|  - Web Audio API Sound Synthesizer (Zero asset lag)         |
|  - Responsive Glassmorphism HUD (Health, Ammo, Dash, Radar)  |
+-------------------------------------------------------------+
                              ^
                              | WebSockets (Socket.io)
                              v
+-------------------------------------------------------------+
|                     Server (Node.js + Express)              |
|  - Room Manager (Lobby, Matchmaking, Custom Room Codes)     |
|  - Game Loop (60 Hz physics tick & spatial collision)       |
|  - State Synchronization & Client Interpolation             |
|  - Auto Local IP & QR Code Generator for mobile join        |
+-------------------------------------------------------------+
```

---

## 2. Roadmap & Atomic Phases (GSD Workflow)

### Phase 1: Project Setup & Core Server Foundation
- Initialize Node.js project (`package.json`).
- Install dependencies: `express`, `socket.io`, `qrcode`.
- Create server with automatic LAN IP detection, static asset serving, and Socket.io setup.
- Verify server starts and serves basic HTTP + WebSocket connection.

### Phase 2: Room System & Mobile-Friendly Lobby UI
- Create modern glassmorphism lobby UI.
- Player customization: Name, avatar color/skin, character class.
- "Create Room" with custom room code & "Join Room" inputs.
- Real-time QR Code rendering for instant mobile camera join.
- Host controls: Game mode (Free-For-All, Team Brawl, Survival), map selection, "Start Match".
- Room player list with ready status.

### Phase 3: Game Engine & Controls (Touch + Keyboard/Mouse)
- High-performance HTML5 Canvas rendering loop with delta-time.
- Mobile controls:
  - Dynamic floating Left Joystick for omnidirectional movement.
  - Right Joystick for 360-degree aiming and auto-fire or touch-to-shoot.
  - Action buttons: Dash / Boost, Switch Weapon, Special Grenade.
- Desktop controls: WASD/Arrows, mouse aim & left click, Space for dash.
- Viewport camera follow system centered on player with screen bounds.

### Phase 4: Combat Mechanics, Weapons & Power-ups
- Diverse weapon system:
  1. **Blaster**: Medium range, steady fire, infinite ammo.
  2. **Shotgun**: 5-pellet spread, high damage at close range.
  3. **Plasma Rifle**: High velocity, neon energy bolts.
  4. **Rocket Launcher**: Slow explosive rockets with AoE explosion & smoke.
  5. **Laser Railgun**: Instant hitscan beam.
- Destructible crates and obstacles.
- Bush / Grass hideout system (players become transparent/hidden to enemies unless firing).
- Dynamic spawners: Health Kits, Shield Boost, Speed Overdrive, Weapon Crates.

### Phase 5: Audio Synthesis, Visual Juiciness & FX
- Web Audio API procedural sound engine:
  - Firing sounds for each weapon type.
  - Impact hits, explosions, dash swoosh.
  - Pickups, death sound, killstreak announcements.
- Visual FX:
  - Particle emitters (bullet trails, rocket smoke, sparks, blast rings).
  - Floating combat damage numbers (`-25`, `CRIT!`, `KILL`).
  - Screen shake on heavy hits and explosions.
  - Vignette low-health pulsing red border.

### Phase 6: Game State, Kill Feed, Leaderboard & Game Over
- Real-time Kill Feed in top-right corner.
- Live Scoreboard (Kills, Deaths, Score, Ping).
- Win condition and Match Over celebration screen with MVP badges.
- Rematch / Play Again lobby return.

### Phase 7: Verification, Code Quality & Optimization
- Test responsive mobile layout on multiple viewport sizes.
- Verify multi-client connection and latency handling.
- Review code against CodeRabbit quality standards (memory leak checks, spatial partitioning, event cleanup).
- Document exact steps for playing over Wi-Fi / Mobile Hotspot / Internet.
