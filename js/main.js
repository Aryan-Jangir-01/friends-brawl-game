// public/js/main.js
import { audio } from "./audio.js";
import { ParticleSystem } from "./particles.js";
import { InputManager } from "./input.js";
import { GameRenderer } from "./renderer.js";
import { NetworkClient } from "./network.js";
import { MAPS } from "./engine/MapData.js";

// Global Game State
const state = {
  profile: {
    name: localStorage.getItem("brawl_player_name") || "Brawler",
    color: localStorage.getItem("brawl_player_color") || "#00f0ff",
    avatar: "striker"
  },
  currentRoom: null,
  localPlayerId: null,
  isHost: false,
  isReady: false,
  mapData: null,
  latestWorldState: null,
  gameRunning: false,
  lastInputTime: 0
};

// Expose weapon info for input cycle
window.__currentLocalWeapon = "blaster";
window.__localAvailableWeapons = ["blaster", "shotgun"];

// DOM Elements
const canvas = document.getElementById("game-canvas");
const miniMapCanvas = document.getElementById("mini-map-canvas");
const lobbyScreen = document.getElementById("lobby-screen");
const hudOverlay = document.getElementById("hud-overlay");
const viewRoomSelection = document.getElementById("view-room-selection");
const viewActiveRoom = document.getElementById("view-active-room");
const modalMatchOver = document.getElementById("modal-match-over");
const modalQR = document.getElementById("modal-qr");

// Lobby Profile Inputs
const nameInput = document.getElementById("player-name-input");
const avatarPreview = document.getElementById("avatar-preview");
const avatarInitials = document.getElementById("avatar-initials");

// Room Selection
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const inputRoomCode = document.getElementById("input-room-code");
const lanUrlText = document.getElementById("lan-url-text");
const btnCopyUrl = document.getElementById("btn-copy-url");

// Active Room UI
const roomCodeDisplay = document.getElementById("room-code-display");
const btnShareRoom = document.getElementById("btn-share-room");
const btnShowQR = document.getElementById("btn-show-qr");
const btnLeaveRoom = document.getElementById("btn-leave-room");
const selectGameMode = document.getElementById("select-game-mode");
const selectScoreLimit = document.getElementById("select-score-limit");
const playerCount = document.getElementById("player-count");
const lobbyPlayerList = document.getElementById("lobby-player-list");
const btnToggleReady = document.getElementById("btn-toggle-ready");
const btnStartGame = document.getElementById("btn-start-game");
const hostHint = document.getElementById("host-hint");

// In-Game HUD Elements
const hudRoomCode = document.getElementById("hud-room-code");
const hudPingBadge = document.getElementById("hud-ping-badge");
const hudTimer = document.getElementById("hud-timer");
const hudPlayerKills = document.getElementById("hud-player-kills");
const hudShieldFill = document.getElementById("hud-shield-fill");
const hudShieldText = document.getElementById("hud-shield-text");
const hudHealthFill = document.getElementById("hud-health-fill");
const hudHealthText = document.getElementById("hud-health-text");
const hudWeaponName = document.getElementById("hud-weapon-name");
const hudAmmoCount = document.getElementById("hud-ammo-count");
const hudWeaponIcon = document.getElementById("hud-weapon-icon");
const lowHealthVignette = document.getElementById("low-health-vignette");
const killFeed = document.getElementById("kill-feed");

// QR Modal
const qrImage = document.getElementById("qr-image");
const qrUrlText = document.getElementById("qr-url-text");
const btnCloseQr = document.getElementById("btn-close-qr");

// Match Over Modal
const matchOverTitle = document.getElementById("match-over-title");
const matchOverSubtitle = document.getElementById("match-over-subtitle");
const matchOverRows = document.getElementById("match-over-rows");
const btnRematch = document.getElementById("btn-rematch");

// Initialize Subsystems
const particles = new ParticleSystem();
const renderer = new GameRenderer(canvas, miniMapCanvas, particles);
const input = new InputManager(canvas);
const network = new NetworkClient();

// Fullscreen Helper
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

document.getElementById("btn-lobby-fullscreen")?.addEventListener("click", toggleFullscreen);
document.getElementById("btn-hud-fullscreen")?.addEventListener("click", toggleFullscreen);

// Toast notification helper
function showToast(message) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// Hero Class Metadata for dynamic UI
const HERO_INFO = {
  striker: {
    color: "#00f0ff",
    role: "Assault",
    desc: "Balanced combatant with high agility and rapid lasers",
    stats: { speed: 80, health: 70, power: 75 },
    superTitle: "⚡ Overdrive Storm",
    superDesc: "Shield surge + 360° rapid plasma laser storm"
  },
  juggernaut: {
    color: "#f59e0b",
    role: "Tank",
    desc: "Heavily armored juggernaut with massive HP and shockwave",
    stats: { speed: 50, health: 100, power: 85 },
    superTitle: "🛡️ Titan Quake",
    superDesc: "Ground slam shockwave destroying obstacles & blasting foes"
  },
  phantom: {
    color: "#a855f7",
    role: "Assassin",
    desc: "Speedster with hyper-fast dash and stealth smoke veil",
    stats: { speed: 100, health: 55, power: 70 },
    superTitle: "💨 Shadow Veil",
    superDesc: "Dense smoke bomb + 100% invisibility for 5 seconds"
  },
  sniper: {
    color: "#ff007f",
    role: "Sharpshooter",
    desc: "Long-range specialist equipped with devastating orbital railgun",
    stats: { speed: 65, health: 60, power: 100 },
    superTitle: "🎯 Orbital Strike",
    superDesc: "Massive satellite laser explosion at aim location"
  }
};

function updateHeroShowcase(heroClass) {
  const info = HERO_INFO[heroClass] || HERO_INFO.striker;
  const rolePill = document.getElementById("hero-role-pill");
  const desc = document.getElementById("hero-archetype-desc");
  const speedVal = document.getElementById("stat-val-speed");
  const speedBar = document.getElementById("stat-bar-speed");
  const healthVal = document.getElementById("stat-val-health");
  const healthBar = document.getElementById("stat-bar-health");
  const powerVal = document.getElementById("stat-val-power");
  const powerBar = document.getElementById("stat-bar-power");
  const superTitle = document.getElementById("hero-super-title");
  const superDesc = document.getElementById("hero-super-desc");

  if (rolePill) rolePill.textContent = info.role.toUpperCase();
  if (desc) desc.textContent = info.desc;
  if (speedVal) speedVal.textContent = `${info.stats.speed}%`;
  if (speedBar) speedBar.style.width = `${info.stats.speed}%`;
  if (healthVal) healthVal.textContent = `${info.stats.health}%`;
  if (healthBar) healthBar.style.width = `${info.stats.health}%`;
  if (powerVal) powerVal.textContent = `${info.stats.power}%`;
  if (powerBar) powerBar.style.width = `${info.stats.power}%`;
  if (superTitle) superTitle.textContent = info.superTitle;
  if (superDesc) superDesc.textContent = info.superDesc;
}

// 1. Initialize Profile & UI
function initProfile() {
  nameInput.value = state.profile.name;
  state.profile.color = localStorage.getItem("brawl_player_color") || HERO_INFO[state.profile.avatar]?.color || "#00f0ff";
  updateAvatarPreview();
  updateHeroShowcase(state.profile.avatar);

  nameInput.addEventListener("input", (e) => {
    state.profile.name = e.target.value.trim() || "Brawler";
    localStorage.setItem("brawl_player_name", state.profile.name);
    updateAvatarPreview();
  });

  // Color Palette Dots Picker
  const colorOptions = document.getElementById("color-options");
  if (colorOptions) {
    const savedColor = localStorage.getItem("brawl_player_color") || state.profile.color;
    colorOptions.querySelectorAll(".color-dot").forEach(btn => {
      if (btn.dataset.color === savedColor) {
        btn.classList.add("active");
        state.profile.color = savedColor;
      } else {
        btn.classList.remove("active");
      }

      btn.addEventListener("click", () => {
        colorOptions.querySelectorAll(".color-dot").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.profile.color = btn.dataset.color;
        localStorage.setItem("brawl_player_color", state.profile.color);
        updateAvatarPreview();
        showToast("Color Updated!");
      });
    });
  }

  // Hero Class Picker
  const classChips = document.getElementById("class-chips");
  if (classChips) {
    classChips.querySelectorAll(".class-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        classChips.querySelectorAll(".class-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.profile.avatar = btn.dataset.class;
        updateAvatarPreview();
        updateHeroShowcase(state.profile.avatar);
        showToast(`Selected Class: ${btn.textContent}`);
      });
    });
  }
}

function updateAvatarPreview() {
  avatarPreview.style.backgroundColor = state.profile.color;
  const initial = (state.profile.name || "B").substring(0, 2).toUpperCase();
  avatarInitials.textContent = initial;
}

// 2. Fetch Network Info (LAN IP / Join URL)
async function fetchNetworkInfo() {
  if (!lanUrlText) return;
  try {
    const res = await fetch(network.getApiUrl("/api/network-info"));
    const data = await res.json();
    if (data.joinUrl && lanUrlText) {
      lanUrlText.textContent = data.joinUrl;
      if (btnCopyUrl) {
        btnCopyUrl.onclick = () => {
          navigator.clipboard.writeText(data.joinUrl);
          showToast("Copied Mobile Play URL!");
        };
      }
    }
  } catch (err) {
    if (lanUrlText) lanUrlText.textContent = window.location.origin;
  }
}

// 3. Network & Lobby Event Wiring
function initNetwork() {
  network.connect();

  const statusDot = document.getElementById("server-status-dot");
  const statusText = document.getElementById("server-status-text");

  network.on("p2p_active", () => {
    if (statusDot) statusDot.style.background = "#10b981";
    if (statusText) statusText.textContent = "Multiplayer: Online (P2P Ready)";
  });

  network.on("signaling_status", (status) => {
    const lobbyStatus = document.getElementById("lobby-connection-status");
    if (status.connected) {
      if (statusDot) statusDot.style.background = "#10b981";
      if (statusText) statusText.textContent = "Multiplayer: Online (P2P Ready)";
      if (lobbyStatus) {
        lobbyStatus.style.color = "#10b981";
        lobbyStatus.textContent = "🟢 Room Live (Waiting for friends)";
      }
    } else if (status.reconnecting) {
      if (statusDot) statusDot.style.background = "#f59e0b";
      if (statusText) statusText.textContent = "Multiplayer: 🟡 Reconnecting signaling...";
      if (lobbyStatus) {
        lobbyStatus.style.color = "#f59e0b";
        lobbyStatus.textContent = "🟡 Reconnecting signaling...";
      }
    }
  });

  network.on("connected", (socketId) => {
    state.localPlayerId = socketId;
    console.log("Registered local ID:", socketId);

    if (statusDot) statusDot.style.background = "#10b981";
    if (statusText) statusText.textContent = "Multiplayer: Online";
  });

  network.on("ping_update", (ping) => {
    if (hudPingBadge) {
      hudPingBadge.textContent = `${ping}ms`;
      if (ping < 60) hudPingBadge.style.color = "#10b981";
      else if (ping < 120) hudPingBadge.style.color = "#f59e0b";
      else hudPingBadge.style.color = "#ef4444";
    }
  });

  network.on("lobby_updated", (room) => {
    state.currentRoom = room;
    renderLobbyRoom(room);
  });

  network.on("disconnected", () => {
    console.log("Disconnected from match");
    if (state.gameRunning) {
      showToast("⚠️ Match ended or connection lost. Returning to lobby...");
      setTimeout(() => {
        state.gameRunning = false;
        hudOverlay.classList.add("hidden");
        lobbyScreen.classList.remove("hidden");
        state.currentRoom = null;
      }, 1200);
    }
  });

  network.on("game_started", (startData) => {
    console.log("Game started received:", startData);
    const chosenMapId = startData?.options?.mapId || state.currentRoom?.options?.mapId || "cyber_arena";
    state.mapData = (startData && startData.map) ? startData.map : (MAPS[chosenMapId] || MAPS.cyber_arena);
    state.gameRunning = true;

    // Reset camera state so it snaps directly to player on start
    renderer.resetCamera();
    renderer.resize();

    lobbyScreen.classList.add("hidden");
    hudOverlay.classList.remove("hidden");
    modalMatchOver.classList.add("hidden");

    if (hudRoomCode) hudRoomCode.textContent = state.currentRoom?.id || "BRAWL";
    audio.startMusic();
    triggerMatchCountdown();
    navigateToScreen("arena");
  });

  network.on("game_state", (worldState) => {
    if (!worldState) return;

    // Reconstitute any compact crate coordinates if needed
    if (worldState.crates && state.mapData?.crates) {
      for (const c of worldState.crates) {
        if (c.x === undefined) {
          const baseCrate = state.mapData.crates.find(bc => bc.id === c.id);
          if (baseCrate) {
            c.x = baseCrate.x;
            c.y = baseCrate.y;
            c.size = baseCrate.size;
            c.maxHp = baseCrate.maxHp;
          }
        }
      }
    }

    state.latestWorldState = worldState;
    updateHUD(worldState);
  });

  // Gameplay Events
  network.on("weapon_fired", (data) => {
    if (data.weapon === "shotgun") audio.playShotgun();
    else if (data.weapon === "plasma") audio.playPlasma();
    else if (data.weapon === "rocket") audio.playRocketLaunch();
    else if (data.weapon === "railgun") audio.playRailgun();
    else audio.playBlaster();

    if (data.shooterId === state.localPlayerId && navigator.vibrate) {
      navigator.vibrate(12);
    }

    const tipDist = 36;
    const fx = data.x + Math.cos(data.angle) * tipDist;
    const fy = data.y + Math.sin(data.angle) * tipDist;
    particles.emitMuzzle(fx, fy, data.angle);
  });

  network.on("bullet_impact", (data) => {
    if (data.aoeRadius > 0) {
      audio.playExplosion(1.2);
      particles.emitExplosion(data.x, data.y, data.aoeRadius);
      renderer.addScreenShake(12);
    } else {
      particles.emitSparks(data.x, data.y, 8);
    }
  });

  network.on("player_hit", (data) => {
    audio.playPlayerHit();
    const isMe = data.targetId === state.localPlayerId;
    const color = isMe ? "#ef4444" : "#ffea00";

    // Find target pos
    const target = state.latestWorldState?.players?.find(p => p.id === data.targetId);
    if (target) {
      particles.addFloatingText(target.x, target.y, `-${data.damage}`, color, isMe ? 20 : 16);
      particles.emitSparks(target.x, target.y, 6, color);
    }

    if (isMe) {
      renderer.addScreenShake(8);
      if (navigator.vibrate) navigator.vibrate(30);
    }
  });

  network.on("player_killed", (data) => {
    audio.playKillSting();
    addKillFeedItem(data.killEvent);

    if (data.killerId === state.localPlayerId) {
      showToast(`🔥 YOU KILLED ${data.killEvent.victimName.toUpperCase()}!`);
      particles.addFloatingText(window.innerWidth / 2, window.innerHeight / 2 - 40, "KILL!", "#00f0ff", 28);
    }

    if (data.victimId === state.localPlayerId) {
      showToast(`💀 You were eliminated by ${data.killEvent.killerName}! Respawning...`);
      if (navigator.vibrate) navigator.vibrate([50, 30, 70]);
      triggerRespawnCountdown(3.5);
    }
  });

  network.on("killstreak_achieved", (data) => {
    audio.playStreakFanfare();
    const banner = document.getElementById("killstreak-banner");
    const title = document.getElementById("streak-text");
    const sub = document.getElementById("streak-sub");
    if (banner && title && sub) {
      title.textContent = data.title;
      sub.textContent = `${data.playerName} is on fire!`;
      banner.classList.remove("hidden");
      setTimeout(() => banner.classList.add("hidden"), 2600);
    }
  });

  network.on("player_dashed", (data) => {
    particles.emitDashTrail(data.x, data.y, data.angle);
  });

  network.on("super_activated", (data) => {
    audio.playSuper(data.hero);
    particles.emitSuperEffect(data.hero, data.x, data.y, data.angle);
    renderer.addScreenShake(data.hero === "juggernaut" ? 18 : 12);

    const isMe = data.playerId === state.localPlayerId;
    const playerObj = state.latestWorldState?.players?.find(p => p.id === data.playerId);
    const pName = playerObj ? playerObj.name : "Player";

    if (isMe) {
      showToast(`⚡ YOU UNLEASHED ${data.superName.toUpperCase()}!`);
      if (navigator.vibrate) navigator.vibrate([60, 30, 80]);
    } else {
      showToast(`💥 ${pName} UNLEASHED ${data.superName.toUpperCase()}!`);
    }
  });

  network.on("item_collected", (data) => {
    audio.playPickup(data.type);
    if (data.playerId === state.localPlayerId) {
      const label = `+${data.type.toUpperCase()}`;
      const color = data.type === "health" ? "#10b981" : "#00f0ff";
      showToast(`Picked up ${data.type.toUpperCase()}!`);

      const me = state.latestWorldState?.players?.find(p => p.id === state.localPlayerId);
      if (me) {
        particles.addFloatingText(me.x, me.y, label, color, 18);
      }
    }
  });

  network.on("crate_destroyed", (data) => {
    audio.playExplosion(0.8);
    particles.emitExplosion(data.x + 25, data.y + 25, 50, "#eab308");
  });

  network.on("match_ended", (data) => {
    state.gameRunning = false;
    audio.stopMusic();
    showMatchOverModal(data);
  });

  network.on("returned_to_lobby", (roomSummary) => {
    state.gameRunning = false;
    state.latestWorldState = null;
    audio.stopMusic();
    modalMatchOver.classList.add("hidden");
    hudOverlay.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    renderLobbyRoom(roomSummary);
  });

  network.on("player_emoted", (data) => {
    renderer.addPlayerEmote(data.playerId, data.emoji);
    audio.playEmoteSound();
  });

  network.on("tactical_ping", (data) => {
    audio.playTacticalPing();
    const isMe = data.playerId === state.localPlayerId;
    const msg = `${data.icon} ${data.playerName}: ${data.text}`;
    showToast(msg);

    const player = state.latestWorldState?.players?.find(p => p.id === data.playerId);
    if (player) {
      particles.addFloatingText(player.x, player.y - 32, `${data.icon} ${data.text}`, data.playerColor || "#00f0ff", 20);
    }
  });

  network.on("player_respawned", (data) => {
    if (data.id === state.localPlayerId) {
      if (respawnInterval) {
        clearInterval(respawnInterval);
        respawnInterval = null;
      }
      const overlay = document.getElementById("respawn-overlay");
      if (overlay) overlay.classList.add("hidden");
      showToast("🛡️ RESPAWNED! READY FOR COMBAT!");
      particles.emitSuperEffect("striker", data.x, data.y, 0);
    }
  });
}

// 4. Lobby Actions & Navigation
function navigateToScreen(screenName) {
  try {
    if (window.history && window.history.pushState) {
      window.history.pushState({ screen: screenName }, "");
    }
  } catch (e) {}
}

window.addEventListener("popstate", (e) => {
  // 1. If QR modal is open -> close it
  if (modalQR && !modalQR.classList.contains("hidden")) {
    modalQR.classList.add("hidden");
    return;
  }
  // 2. If Match Over modal is open -> back to lobby
  if (modalMatchOver && !modalMatchOver.classList.contains("hidden")) {
    const btnMatchOverBack = document.getElementById("btn-match-over-back");
    if (btnMatchOverBack) btnMatchOverBack.click();
    else btnRematch?.click();
    return;
  }
  // 3. If in arena match -> leave and return to lobby
  if (state.gameRunning || (hudOverlay && !hudOverlay.classList.contains("hidden"))) {
    const btnHudBack = document.getElementById("btn-hud-back");
    if (btnHudBack) btnHudBack.click();
    return;
  }
  // 4. If in active waiting room -> leave and return to main menu
  if (viewActiveRoom && !viewActiveRoom.classList.contains("hidden")) {
    btnLeaveRoom?.click();
    return;
  }
});

// Quick Play: Drop-in Public Arena
const btnQuickPlay = document.getElementById("btn-quick-play");
if (btnQuickPlay) {
  btnQuickPlay.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    btnQuickPlay.disabled = true;
    btnQuickPlay.textContent = "JOINING ARENA... ⚔️";
    showToast("Connecting to live Battle Arena... 🚀");

    let finished = false;
    // Watchdog timer: If anything stalls on mobile networks, reset button so player is never permanently stuck
    const watchdogTimer = setTimeout(() => {
      if (!finished) {
        btnQuickPlay.disabled = false;
        btnQuickPlay.textContent = "⚔️ BATTLE NOW (DROP IN) ⚔️";
        showToast("⚠️ Reconnecting to arena... Please tap again if not opened.");
      }
    }, 11000);

    network.quickPlay(state.profile, (res) => {
      finished = true;
      clearTimeout(watchdogTimer);
      btnQuickPlay.disabled = false;
      btnQuickPlay.textContent = "⚔️ BATTLE NOW (DROP IN) ⚔️";
      if (res.success) {
        state.currentRoom = res.room;
        state.isHost = res.isHost;

        // Ensure mapData is loaded immediately
        const chosenMapId = res.room?.options?.mapId || "cyber_arena";
        state.mapData = MAPS[chosenMapId] || MAPS.cyber_arena;

        // Transition straight into the game arena!
        lobbyScreen.classList.add("hidden");
        hudOverlay.classList.remove("hidden");
        modalMatchOver.classList.add("hidden");

        renderer.resetCamera();
        renderer.resize();
        state.gameRunning = true;
        audio.startMusic();
        navigateToScreen("arena");
        showToast("⚔️ IN BATTLE! FIGHT YOUR FRIENDS!");
      } else {
        showToast(`Could not enter arena: ${res.error}`);
      }
    });
  });
}

const btnShareInvite = document.getElementById("btn-share-invite-link");
if (btnShareInvite) {
  btnShareInvite.addEventListener("click", () => {
    const playUrl = `${window.location.origin}${window.location.pathname}`;
    const shareText = "⚔️ Come fight me right now in Brawl Zone! Tap the link and hit 'BATTLE NOW' to jump straight into my arena!";
    if (navigator.share) {
      navigator.share({
        title: "Brawl Zone - Fight with me!",
        text: shareText,
        url: playUrl
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(playUrl);
      showToast("Game Link Copied! Send to friends on WhatsApp 📋");
    }
  });
}

const btnHudBack = document.getElementById("btn-hud-back");
if (btnHudBack) {
  btnHudBack.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    audio.stopMusic();
    state.gameRunning = false;
    network.leaveRoom();
    state.currentRoom = null;
    state.isHost = false;
    hudOverlay.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    modalMatchOver.classList.add("hidden");
    showToast("Returned to Lobby 🏠");
  });
}

const btnHudInvite = document.getElementById("btn-hud-invite");
if (btnHudInvite) {
  btnHudInvite.addEventListener("click", () => {
    const playUrl = `${window.location.origin}${window.location.pathname}`;
    const shareText = "⚔️ Come fight me right now in Brawl Zone! Tap the link and hit 'BATTLE NOW' to jump straight into my arena!";
    if (navigator.share) {
      navigator.share({
        title: "Brawl Zone - Fight with me!",
        text: shareText,
        url: playUrl
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(playUrl);
      showToast("Game Link Copied! Send to friends on WhatsApp 📋");
    }
  });
}

const btnPracticeBots = document.getElementById("btn-practice-bots");
if (btnPracticeBots) {
  btnPracticeBots.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    renderer.resize();
    showToast("Starting Solo Match vs AI Bots! ⚔️");
    state.currentRoom = { id: "SOLO", options: { mapId: "cyber_arena" } };
    state.isHost = true;
    navigateToScreen("arena");
    network.startSoloMatch(state.profile, {
      gameMode: "ffa",
      scoreLimit: 15,
      matchDuration: 300,
      mapId: "cyber_arena"
    });
  });
}

btnCreateRoom.addEventListener("click", () => {
  audio.unlock();
  btnCreateRoom.disabled = true;
  btnCreateRoom.textContent = "CREATING... 🚀";
  network.createRoom(state.profile, { gameMode: "ffa", scoreLimit: 15 }, (res) => {
    btnCreateRoom.disabled = false;
    btnCreateRoom.textContent = "CREATE ROOM 🚀";
    if (res.success) {
      state.currentRoom = res.room;
      state.isHost = true;
      switchToRoomView(res.room);
      showToast("Room Created! Share the code or QR code with friends.");
    } else {
      showToast(`Error: ${res.error}`);
    }
  });
});

inputRoomCode?.addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase();
});

btnJoinRoom.addEventListener("click", () => {
  audio.unlock();
  const rawCode = inputRoomCode.value.trim().toUpperCase();
  const cleanCode = rawCode.replace(/^BZ[-_ ]?/i, "").replace(/[^A-Z0-9]/g, "");
  if (!cleanCode) return showToast("Please enter a room code");
  joinSpecificRoom(cleanCode);
});

function joinSpecificRoom(code) {
  const cleanCode = (code || "").toUpperCase().replace(/^BZ[-_ ]?/i, "").replace(/[^A-Z0-9]/g, "").trim();
  if (!cleanCode) return showToast("Invalid room code");

  if (btnJoinRoom) {
    btnJoinRoom.disabled = true;
    btnJoinRoom.textContent = "JOINING... ⏳";
  }

  showToast(`Connecting to Room ${cleanCode}...`);

  network.joinRoom(cleanCode, state.profile, (res) => {
    if (btnJoinRoom) {
      btnJoinRoom.disabled = false;
      btnJoinRoom.textContent = "JOIN 🎮";
    }

    if (res.success) {
      state.currentRoom = res.room;
      state.isHost = res.player?.isHost || false;
      if (res.gameRunning) {
        lobbyScreen.classList.add("hidden");
        hudOverlay.classList.remove("hidden");
        modalMatchOver.classList.add("hidden");
        const chosenMapId = res.room?.options?.mapId || "cyber_arena";
        state.mapData = MAPS[chosenMapId] || MAPS.cyber_arena;
        renderer.resetCamera();
        renderer.resize();
        state.gameRunning = true;
        audio.startMusic();
        navigateToScreen("arena");
        showToast(`⚔️ Entered Battle in Room ${cleanCode}!`);
      } else {
        switchToRoomView(res.room);
        showToast(`Joined Room ${cleanCode}!`);
      }
    } else {
      showToast(`Failed to join: ${res.error}`);
    }
  });
}

const btnRoomBack = document.getElementById("btn-room-back");
if (btnRoomBack) {
  btnRoomBack.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    btnLeaveRoom.click();
    showToast("Returned to Main Menu 🏠");
  });
}

btnLeaveRoom.addEventListener("click", () => {
  network.leaveRoom();
  state.currentRoom = null;
  state.isHost = false;
  viewActiveRoom.classList.add("hidden");
  viewRoomSelection.classList.remove("hidden");
});

btnToggleReady.addEventListener("click", () => {
  state.isReady = !state.isReady;
  network.toggleReady(state.isReady);
  btnToggleReady.textContent = state.isReady ? "CANCEL READY ❌" : "TOGGLE READY ✔️";
  btnToggleReady.classList.toggle("btn-primary", state.isReady);
  btnToggleReady.classList.toggle("btn-secondary", !state.isReady);
});

btnStartGame.addEventListener("click", () => {
  audio.unlock();
  network.startGame((res) => {
    if (!res.success) {
      showToast(`Cannot start: ${res.error}`);
    }
  });
});

// Room Options Change
selectGameMode.addEventListener("change", (e) => {
  if (state.isHost) {
    network.updateRoomOptions({ gameMode: e.target.value });
  }
});

selectScoreLimit.addEventListener("change", (e) => {
  if (state.isHost) {
    network.updateRoomOptions({ scoreLimit: parseInt(e.target.value) });
  }
});

// Share / QR Code
btnShareRoom.addEventListener("click", () => {
  if (!state.currentRoom) return;
  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${state.currentRoom.id}`;
  if (navigator.share) {
    navigator.share({
      title: "Join my Brawl Zone match!",
      text: `Join my game room ${state.currentRoom.id} on Brawl Zone:`,
      url: roomUrl
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(roomUrl);
    showToast("Copied Room Join Link to clipboard!");
  }
});

btnShowQR.addEventListener("click", async () => {
  if (!state.currentRoom) return;
  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${state.currentRoom.id}`;
  qrUrlText.textContent = roomUrl;

  try {
    const res = await fetch(network.getApiUrl(`/api/qr?url=${encodeURIComponent(roomUrl)}`));
    const data = await res.json();
    if (data.qr) {
      qrImage.src = data.qr;
      modalQR.classList.remove("hidden");
      navigateToScreen("qr");
      return;
    }
  } catch (err) {}

  // Direct fast QR image generation fallback
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(roomUrl)}`;
  modalQR.classList.remove("hidden");
  navigateToScreen("qr");
});

const btnQrBack = document.getElementById("btn-qr-back");
if (btnQrBack) {
  btnQrBack.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    modalQR.classList.add("hidden");
  });
}

btnCloseQr.addEventListener("click", () => {
  modalQR.classList.add("hidden");
});

// Switch view helper
function switchToRoomView(room) {
  viewRoomSelection.classList.add("hidden");
  viewActiveRoom.classList.remove("hidden");
  renderLobbyRoom(room);
  navigateToScreen("room");
}

function renderLobbyRoom(room) {
  if (!room) return;
  roomCodeDisplay.textContent = room.id;
  roomCodeDisplay.style.cursor = "pointer";
  roomCodeDisplay.title = "Tap to copy Room Code";
  roomCodeDisplay.onclick = () => {
    if (state.currentRoom?.id) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(state.currentRoom.id).catch(() => {});
      }
      showToast(`Copied Room Code: ${state.currentRoom.id}! 📋`);
    }
  };
  playerCount.textContent = room.players.length;

  const isMeHost = room.hostId === state.localPlayerId;
  state.isHost = isMeHost;

  // Host privileges
  selectGameMode.disabled = !isMeHost;
  selectScoreLimit.disabled = !isMeHost;
  selectGameMode.value = room.options?.gameMode || "ffa";
  selectScoreLimit.value = String(room.options?.scoreLimit || 15);

  const selectMap = document.getElementById("select-map");
  if (selectMap) {
    selectMap.disabled = !isMeHost;
    selectMap.value = room.options?.mapId || "cyber_arena";
    selectMap.onchange = (e) => {
      if (state.isHost) {
        network.updateRoomOptions({ mapId: e.target.value });
      }
    };
  }

  if (isMeHost) {
    btnStartGame.classList.remove("hidden");
    hostHint.classList.add("hidden");
    document.getElementById("host-bot-controls")?.classList.remove("hidden");
  } else {
    btnStartGame.classList.add("hidden");
    hostHint.classList.remove("hidden");
    document.getElementById("host-bot-controls")?.classList.add("hidden");
  }

  // Render players grid
  lobbyPlayerList.innerHTML = "";
  room.players.forEach(p => {
    const card = document.createElement("div");
    card.className = `player-lobby-card ${p.isHost ? "is-host" : ""} ${p.isReady ? "is-ready" : ""}`;

    const hostBadge = p.isHost ? `<span class="host-badge">👑 HOST</span>` : "";
    const initial = (p.name || "B").substring(0, 2).toUpperCase();

    card.innerHTML = `
      ${hostBadge}
      <div class="avatar-mini" style="background-color: ${p.color};">${initial}</div>
      <div class="p-name">${escapeHtml(p.name)}</div>
      <div class="p-status ${p.isReady ? "ready" : "waiting"}">
        ${p.isReady ? "READY" : "WAITING"}
      </div>
    `;
    lobbyPlayerList.appendChild(card);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}

// 5. In-Game HUD Updates
function updateHUD(worldState) {
  if (!worldState) return;

  // Timer
  const mins = Math.floor(worldState.timeRemaining / 60);
  const secs = worldState.timeRemaining % 60;
  hudTimer.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Live Arena Players Count
  const hudPlayersCount = document.getElementById("hud-players-count");
  if (hudPlayersCount && worldState.players) {
    const humanCount = worldState.players.filter(p => !p.isBot).length;
    hudPlayersCount.textContent = `👥 ${humanCount} IN ARENA`;
  }

  // Team score tracker
  const hudTeamTracker = document.getElementById("hud-team-tracker");
  const teamScoreBlue = document.getElementById("team-score-blue");
  const teamScoreRed = document.getElementById("team-score-red");
  if (worldState.teamScores && hudTeamTracker && teamScoreBlue && teamScoreRed) {
    hudTeamTracker.classList.remove("hidden");
    teamScoreBlue.textContent = worldState.teamScores.blue;
    teamScoreRed.textContent = worldState.teamScores.red;
  } else if (hudTeamTracker) {
    hudTeamTracker.classList.add("hidden");
  }

  // Find local player
  const me = worldState.players?.find(p => p.id === state.localPlayerId);
  if (me) {
    hudPlayerKills.textContent = me.kills;

    // Health
    const hpPct = Math.max(0, Math.min(100, (me.health / me.maxHealth) * 100));
    hudHealthFill.style.width = `${hpPct}%`;
    hudHealthText.textContent = Math.ceil(me.health);

    // Shield
    const shPct = Math.max(0, Math.min(100, (me.shield / me.maxShield) * 100));
    hudShieldFill.style.width = `${shPct}%`;
    hudShieldText.textContent = Math.ceil(me.shield);

    // Super Meter & Button
    const btnSuper = document.getElementById("btn-super");
    const superStatus = document.getElementById("super-btn-status");
    const superMeterFill = document.getElementById("super-meter-fill");
    const superCharge = Math.min(100, Math.max(0, me.superCharge || 0));

    if (superMeterFill) {
      const circ = 207.34;
      superMeterFill.style.strokeDashoffset = `${circ * (1 - superCharge / 100)}`;
    }

    if (btnSuper && superStatus) {
      if (superCharge >= 100) {
        if (!btnSuper.classList.contains("ready")) {
          btnSuper.classList.add("ready");
          audio.playSuperReady();
          if (navigator.vibrate) navigator.vibrate(40);
        }
        superStatus.textContent = "READY!";
      } else {
        btnSuper.classList.remove("ready");
        superStatus.textContent = `${superCharge}%`;
      }
    }

    // Low Health Vignette
    if (me.health <= 35 && me.isAlive) {
      lowHealthVignette.classList.add("active");
    } else {
      lowHealthVignette.classList.remove("active");
    }

    // Weapon & Ammo
    hudWeaponName.textContent = me.currentWeapon.toUpperCase();
    hudAmmoCount.textContent = (me.ammo === Infinity || me.ammo === -1) ? "∞" : me.ammo;
    window.__currentLocalWeapon = me.currentWeapon;

    let icon = "🔫";
    if (me.currentWeapon === "shotgun") icon = "💥";
    else if (me.currentWeapon === "plasma") icon = "🔮";
    else if (me.currentWeapon === "rocket") icon = "🚀";
    else if (me.currentWeapon === "railgun") icon = "⚡";
    hudWeaponIcon.textContent = icon;
  }
}

function addKillFeedItem(event) {
  const item = document.createElement("div");
  item.className = "kill-feed-item";
  item.innerHTML = `<span style="color:${event.killerColor}">${escapeHtml(event.killerName)}</span> ➔ <span style="color:${event.victimColor}">${escapeHtml(event.victimName)}</span>`;
  killFeed.appendChild(item);
  setTimeout(() => item.remove(), 4000);
}

// 6. Match Over Screen
function showMatchOverModal(data) {
  matchOverTitle.textContent = "MATCH FINISHED";
  const winner = data.ranking[0];
  matchOverSubtitle.textContent = winner ? `🏆 Champion: ${winner.name}` : data.reason;

  // Sound and confetti celebration
  audio.playVictory();
  particles.emitConfetti(renderer.width / 2, renderer.height / 3, 50);

  // Olympic Cyber Podium Setup
  const p1 = data.ranking[0];
  const p2 = data.ranking[1];
  const p3 = data.ranking[2];

  const col1 = document.getElementById("podium-1");
  const col2 = document.getElementById("podium-2");
  const col3 = document.getElementById("podium-3");

  if (p1 && col1) {
    col1.style.display = "flex";
    const av = document.getElementById("podium-avatar-1");
    if (av) {
      av.style.backgroundColor = p1.color;
      av.textContent = (p1.name || "P").substring(0, 2).toUpperCase();
    }
    document.getElementById("podium-name-1").textContent = p1.name;
    document.getElementById("podium-score-1").textContent = `${p1.kills} Kills`;
  }

  if (p2 && col2) {
    col2.style.display = "flex";
    const av = document.getElementById("podium-avatar-2");
    if (av) {
      av.style.backgroundColor = p2.color;
      av.textContent = (p2.name || "P").substring(0, 2).toUpperCase();
    }
    document.getElementById("podium-name-2").textContent = p2.name;
    document.getElementById("podium-score-2").textContent = `${p2.kills} Kills`;
  } else if (col2) {
    col2.style.display = "none";
  }

  if (p3 && col3) {
    col3.style.display = "flex";
    const av = document.getElementById("podium-avatar-3");
    if (av) {
      av.style.backgroundColor = p3.color;
      av.textContent = (p3.name || "P").substring(0, 2).toUpperCase();
    }
    document.getElementById("podium-name-3").textContent = p3.name;
    document.getElementById("podium-score-3").textContent = `${p3.kills} Kills`;
  } else if (col3) {
    col3.style.display = "none";
  }

  // Leaderboard table
  matchOverRows.innerHTML = "";
  data.ranking.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = `lb-row ${idx === 0 ? "winner" : ""}`;
    const badge = p.isMVP ? " 👑" : "";
    row.innerHTML = `
      <span>${idx + 1}</span>
      <span style="color: ${p.color}; text-align: left;">${escapeHtml(p.name)}${badge}</span>
      <span>${p.kills}</span>
      <span>${p.deaths}</span>
      <span>${p.score}</span>
    `;
    matchOverRows.appendChild(row);
  });

  modalMatchOver.classList.remove("hidden");
  navigateToScreen("match_over");
}

const btnMatchOverBack = document.getElementById("btn-match-over-back");
if (btnMatchOverBack) {
  btnMatchOverBack.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    audio.stopMusic();
    state.gameRunning = false;
    network.leaveRoom();
    state.currentRoom = null;
    state.isHost = false;
    modalMatchOver.classList.add("hidden");
    hudOverlay.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    showToast("Returned to Lobby 🏠");
  });
}

btnRematch.addEventListener("click", () => {
  if (state.isHost) {
    network.returnToLobby();
  } else {
    modalMatchOver.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    hudOverlay.classList.add("hidden");
  }
});

// 7. Main Game Loop (60 FPS)
let lastFrameTime = performance.now();

function gameLoop(time) {
  const dt = Math.min((time - lastFrameTime) / 1000, 0.1);
  lastFrameTime = time;

  if (state.gameRunning) {
    // Ensure mapData is never null
    if (!state.mapData) {
      const chosenMapId = state.currentRoom?.options?.mapId || "cyber_arena";
      state.mapData = MAPS[chosenMapId] || MAPS.cyber_arena;
    }

    // Active world state (fallback to room players while waiting for first packet)
    const world = state.latestWorldState || {
      players: (state.currentRoom?.players || []).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        team: p.team,
        radius: 22,
        x: 1200,
        y: 900,
        angle: 0,
        health: 100,
        maxHealth: 100,
        shield: 50,
        maxShield: 50,
        isAlive: true,
        currentWeapon: "blaster",
        ammo: Infinity
      })),
      bullets: [],
      items: [],
      crates: state.mapData?.crates || []
    };

    const me = world.players?.find(p => p.id === state.localPlayerId);

    // Update Camera
    if (me && me.x && me.y) {
      if (!renderer.hasSnappedFirstFrame) {
        renderer.camX = me.x;
        renderer.camY = me.y;
        renderer.targetCamX = me.x;
        renderer.targetCamY = me.y;
        renderer.hasSnappedFirstFrame = true;
      }
      renderer.updateCamera(me.x, me.y, dt);
    }

    // Input polling and network broadcast (throttled to ~25 Hz / 40ms)
    const now = Date.now();
    if (now - state.lastInputTime >= 40) {
      state.lastInputTime = now;
      const screenCenter = me ? {
        x: renderer.width / 2,
        y: renderer.height / 2
      } : null;

      const payload = input.getPayload(screenCenter);
      network.sendInput(payload);
    }

    // Update Particles
    particles.update(dt);

    // Render Canvas
    renderer.render(world, state.localPlayerId, state.mapData, dt);
  }

  requestAnimationFrame(gameLoop);
}

// Bot Controls
document.getElementById("btn-add-bot")?.addEventListener("click", () => {
  network.addBot((res) => {
    if (!res.success) showToast(res.error || "Cannot add bot");
  });
});

document.getElementById("btn-remove-bot")?.addEventListener("click", () => {
  network.removeBot(null, (res) => {
    if (!res.success) showToast(res.error || "Cannot remove bot");
  });
});

// Match Start Countdown (3... 2... 1... BRAWL!)
function triggerMatchCountdown() {
  const overlay = document.getElementById("match-countdown-overlay");
  const num = document.getElementById("countdown-num");
  const sub = document.getElementById("countdown-sub");
  if (!overlay || !num || !sub) return;

  overlay.classList.remove("hidden");
  let count = 3;
  num.className = "countdown-num";
  num.textContent = count;
  sub.textContent = "GET READY!";
  audio.playCountdownBeep(false);

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      num.className = "countdown-num";
      num.textContent = count;
      sub.textContent = count === 1 ? "LOCK AND LOAD!" : "GET READY!";
      audio.playCountdownBeep(false);
    } else if (count === 0) {
      num.className = "countdown-num brawl-go";
      num.textContent = "BRAWL!";
      sub.textContent = "ELIMINATE ALL FOES!";
      audio.playCountdownBeep(true);
      renderer.addScreenShake(12);
    } else {
      clearInterval(timer);
      overlay.classList.add("hidden");
    }
  }, 900);
}

// Respawn Countdown Overlay
let respawnInterval = null;
function triggerRespawnCountdown(seconds = 3.5) {
  const overlay = document.getElementById("respawn-overlay");
  const timerText = document.getElementById("respawn-countdown-text");
  if (!overlay || !timerText) return;

  if (respawnInterval) clearInterval(respawnInterval);
  overlay.classList.remove("hidden");

  let remaining = seconds;
  timerText.textContent = remaining.toFixed(1);

  respawnInterval = setInterval(() => {
    remaining -= 0.1;
    if (remaining <= 0) {
      clearInterval(respawnInterval);
      respawnInterval = null;
      overlay.classList.add("hidden");
    } else {
      timerText.textContent = Math.max(0, remaining).toFixed(1);
    }
  }, 100);
}

// Emote & Tactical Wheel
const btnEmote = document.getElementById("btn-emote");
const emoteWheel = document.getElementById("emote-wheel");
const tabEmotes = document.getElementById("tab-emotes");
const tabTactical = document.getElementById("tab-tactical");
const wheelEmotesGrid = document.getElementById("wheel-emotes-grid");
const wheelTacticalGrid = document.getElementById("wheel-tactical-grid");

if (btnEmote && emoteWheel) {
  btnEmote.addEventListener("click", (e) => {
    e.stopPropagation();
    emoteWheel.classList.toggle("hidden");
  });

  if (tabEmotes && tabTactical && wheelEmotesGrid && wheelTacticalGrid) {
    tabEmotes.addEventListener("click", (e) => {
      e.stopPropagation();
      tabEmotes.classList.add("active");
      tabTactical.classList.remove("active");
      wheelEmotesGrid.classList.remove("hidden");
      wheelTacticalGrid.classList.add("hidden");
    });

    tabTactical.addEventListener("click", (e) => {
      e.stopPropagation();
      tabTactical.classList.add("active");
      tabEmotes.classList.remove("active");
      wheelTacticalGrid.classList.remove("hidden");
      wheelEmotesGrid.classList.add("hidden");
    });
  }

  emoteWheel.querySelectorAll(".emote-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const emoji = item.dataset.emoji;
      network.sendEmote(emoji);
      emoteWheel.classList.add("hidden");
    });
  });

  emoteWheel.querySelectorAll(".tactical-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const type = item.dataset.type;
      const text = item.dataset.text;
      const icon = item.dataset.icon;
      network.sendTacticalPing({ type, text, icon });
      emoteWheel.classList.add("hidden");
    });
  });

  document.addEventListener("click", () => {
    emoteWheel.classList.add("hidden");
  });
}

// Sound toggle
const btnHudSound = document.getElementById("btn-hud-sound");
if (btnHudSound) {
  btnHudSound.addEventListener("click", () => {
    const isMuted = audio.toggleMute();
    btnHudSound.textContent = isMuted ? "🔇" : "🔊";
    showToast(isMuted ? "Sound Muted" : "Sound Enabled");
  });
}

// Startup
initProfile();
fetchNetworkInfo();

// Force unregister all legacy service workers and clear caches
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) r.unregister();
  });
}

const btnForceUpdate = document.getElementById("btn-force-update");
if (btnForceUpdate) {
  btnForceUpdate.addEventListener("click", async () => {
    showToast("Clearing cache & reloading... 🔄");
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {}
    }
    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      } catch (e) {}
    }
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + "?t=" + Date.now();
    }, 300);
  });
}

// PWA Install Prompt
let deferredInstallPrompt = null;
const btnInstallApp = document.getElementById("btn-install-app");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (btnInstallApp) btnInstallApp.classList.remove("hidden");
});

if (btnInstallApp) {
  btnInstallApp.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === "accepted") {
        btnInstallApp.classList.add("hidden");
      }
      deferredInstallPrompt = null;
    } else {
      showToast("📱 On iPhone: Tap Share ➔ Add to Home Screen!");
    }
  });
}

initNetwork();

// Check for room / arena query parameter in URL (e.g. ?arena=public, ?battle=1, or ?room=XYZ)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get("room");
const arenaParam = urlParams.get("arena");
const autoBattle = urlParams.get("battle") || urlParams.get("play");

if (arenaParam || autoBattle) {
  setTimeout(() => {
    btnQuickPlay?.click();
  }, 600);
} else if (roomParam) {
  const cleanParam = roomParam.toUpperCase().replace(/^BZ[-_ ]?/i, "").replace(/[^A-Z0-9]/g, "").trim();
  if (inputRoomCode) inputRoomCode.value = cleanParam;
  setTimeout(() => {
    joinSpecificRoom(cleanParam);
  }, 800);
}

requestAnimationFrame(gameLoop);
