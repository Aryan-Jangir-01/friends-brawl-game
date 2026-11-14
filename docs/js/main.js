// public/js/main.js
import { audio } from "./audio.js?v=20261114_controls_v1";
import { ParticleSystem } from "./particles.js?v=20261114_controls_v1";
import { InputManager } from "./input.js?v=20261114_controls_v1";
import { GameRenderer } from "./renderer.js?v=20261114_controls_v1";
import { NetworkClient } from "./network.js?v=20261114_controls_v1";
import { MAPS } from "./engine/MapData.js?v=20261114_controls_v1";
import { VoiceChatManager } from "./voice.js?v=20261114_voice_v1";

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
const selectMatchDuration = document.getElementById("select-match-duration");
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
const btnSuper = document.getElementById("btn-super");
const superStatus = document.getElementById("super-btn-status");
const superMeterFill = document.getElementById("super-meter-fill");
const hudPlayersCount = document.getElementById("hud-players-count");
const hudTeamTracker = document.getElementById("hud-team-tracker");
const teamScoreBlue = document.getElementById("team-score-blue");
const teamScoreRed = document.getElementById("team-score-red");

// Memoized HUD State Cache to eliminate DOM layout thrashing on mobile
const lastHUDState = {
  timer: "",
  playersCount: "",
  teamScores: "",
  kills: -1,
  hpVal: -1,
  hpPct: -1,
  shVal: -1,
  shPct: -1,
  superCharge: -1,
  weapon: "",
  ammo: "",
  isVignetteActive: false
};
let lastHUDUpdateTime = 0;

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
const voiceManager = new VoiceChatManager(network);
window.__voiceManager = voiceManager;

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

// Display Quality & 2K Ultra HD Mode Controller
function updateQualityButtons(quality) {
  const qLobby = document.getElementById("btn-lobby-quality");
  const qHud = document.getElementById("btn-hud-quality");
  const labels = {
    "2k": { lobby: "💎 2K ULTRA", hud: "💎 2K", title: "2K Ultra HD (Crisp 1440p+)" },
    "fhd": { lobby: "⚡ 1080p FHD", hud: "⚡ 1080p", title: "Full HD 1080p (Balanced)" },
    "battery": { lobby: "🔋 BATTERY", hud: "🔋 SAVE", title: "Battery Saver (Standard 1x)" }
  };
  const cur = labels[quality] || labels["2k"];
  if (qLobby) qLobby.innerHTML = cur.lobby;
  if (qHud) qHud.innerHTML = cur.hud;
}

function cycleQuality() {
  const modes = ["2k", "fhd", "battery"];
  const curQuality = renderer.quality || "2k";
  const nextIdx = (modes.indexOf(curQuality) + 1) % modes.length;
  const nextQuality = modes[nextIdx];
  renderer.setQuality(nextQuality);
  updateQualityButtons(nextQuality);
  if (audio.playSelectChime) audio.playSelectChime();
  const names = {
    "2k": "💎 2K Ultra HD Mode Enabled! (Super Crisp 1440p+)",
    "fhd": "⚡ Full HD 1080p Mode Enabled! (Balanced)",
    "battery": "🔋 Battery Saver Mode Enabled! (Standard 1x)"
  };
  showToast(names[nextQuality] || "Display Quality Updated");
}

document.getElementById("btn-lobby-quality")?.addEventListener("click", cycleQuality);
document.getElementById("btn-hud-quality")?.addEventListener("click", cycleQuality);
updateQualityButtons(renderer.quality || "2k");

// Gameplay Controls Customizer Modal Controller
function initControlsModal() {
  const modal = document.getElementById("modal-controls");
  const btnOpenLobby = document.getElementById("btn-open-controls-modal");
  const btnOpenHud = document.getElementById("btn-hud-controls");
  const btnClose = document.getElementById("btn-close-controls");
  const btnBack = document.getElementById("btn-controls-back");
  const btnSave = document.getElementById("btn-save-controls");
  const btnReset = document.getElementById("btn-reset-controls");

  function openControlsModal() {
    if (!modal) return;
    if (audio.playHapticTick) audio.playHapticTick();
    syncControlUI();
    modal.classList.remove("hidden");
  }

  function closeControlsModal() {
    if (!modal) return;
    if (audio.playHapticTick) audio.playHapticTick();
    modal.classList.add("hidden");
  }

  function syncControlUI() {
    const cur = input.controlSettings || {
      joystickScale: "1.0",
      buttonScale: "1.0",
      joystickMode: "floating",
      vibration: "on"
    };

    setSegmentActive("ctrl-joystick-size", cur.joystickScale);
    setSegmentActive("ctrl-button-size", cur.buttonScale);
    setSegmentActive("ctrl-joystick-mode", cur.joystickMode);
    setSegmentActive("ctrl-vibration", cur.vibration);
  }

  function setSegmentActive(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(".seg-btn").forEach(btn => {
      if (btn.dataset.value === String(value)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function getSegmentValue(containerId, fallback) {
    const container = document.getElementById(containerId);
    const active = container?.querySelector(".seg-btn.active");
    return active?.dataset.value || fallback;
  }

  // Segment button click listeners
  ["ctrl-joystick-size", "ctrl-button-size", "ctrl-joystick-mode", "ctrl-vibration"].forEach(cid => {
    const container = document.getElementById(cid);
    if (!container) return;
    container.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (audio.playHapticTick) audio.playHapticTick();
      });
    });
  });

  btnOpenLobby?.addEventListener("click", openControlsModal);
  btnOpenHud?.addEventListener("click", openControlsModal);
  btnClose?.addEventListener("click", closeControlsModal);
  btnBack?.addEventListener("click", closeControlsModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeControlsModal();
  });

  btnSave?.addEventListener("click", () => {
    const newSettings = {
      joystickScale: getSegmentValue("ctrl-joystick-size", "1.0"),
      buttonScale: getSegmentValue("ctrl-button-size", "1.0"),
      joystickMode: getSegmentValue("ctrl-joystick-mode", "floating"),
      vibration: getSegmentValue("ctrl-vibration", "on")
    };
    input.applyControlSettings(newSettings);
    if (audio.playSelectChime) audio.playSelectChime();
    showToast("🎮 Controls Saved & Applied!");
    closeControlsModal();
  });

  btnReset?.addEventListener("click", () => {
    const def = {
      joystickScale: "1.0",
      buttonScale: "1.0",
      joystickMode: "floating",
      vibration: "on"
    };
    input.applyControlSettings(def);
    syncControlUI();
    if (audio.playSelectChime) audio.playSelectChime();
    showToast("🔄 Controls Reset to Default");
  });
}

initControlsModal();

// ========================================================
// CUSTOM HUD CONTROLS LAYOUT & DRAG/RESIZE EDITOR
// ========================================================
const DEFAULT_HUD_LAYOUT = {
  btnDash: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "⚡ Dash Boost Button" },
  btnSuper: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "💥 Super Ability Button" },
  btnSwap: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "🔄 Weapon Swap Button" },
  btnEmote: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "💬 Emote Button" },
  bottomBar: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "❤️ Health & Weapon Bar" },
  timerGroup: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "⏱️ Match Timer" },
  killsGroup: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "🏆 Kills Counter" },
  miniMap: { x: 0, y: 0, scale: 1.0, opacity: 1.0, name: "🗺️ Radar Mini-Map" }
};

const HUD_VAR_MAP = {
  btnDash: { x: '--dash-x', y: '--dash-y', scale: '--dash-scale', opacity: '--dash-opacity' },
  btnSuper: { x: '--super-x', y: '--super-y', scale: '--super-scale', opacity: '--super-opacity' },
  btnSwap: { x: '--swap-x', y: '--swap-y', scale: '--swap-scale', opacity: '--swap-opacity' },
  btnEmote: { x: '--emote-x', y: '--emote-y', scale: '--emote-scale', opacity: '--emote-opacity' },
  bottomBar: { x: '--bar-x', y: '--bar-y', scale: '--bar-scale', opacity: '--bar-opacity' },
  timerGroup: { x: '--timer-x', y: '--timer-y', scale: '--timer-scale', opacity: '--timer-opacity' },
  killsGroup: { x: '--kills-x', y: '--kills-y', scale: '--kills-scale', opacity: '--kills-opacity' },
  miniMap: { x: '--map-x', y: '--map-y', scale: '--map-scale', opacity: '--map-opacity' }
};

let customHudLayout = loadCustomHudLayout();

function loadCustomHudLayout() {
  try {
    const raw = localStorage.getItem("brawl_custom_hud_layout");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate legacy single btnGroup to individual buttons
      if (parsed.btnGroup && !parsed.btnDash) {
        const bg = parsed.btnGroup;
        parsed.btnDash = { x: bg.x || 0, y: bg.y || 0, scale: bg.scale || 1.0, opacity: bg.opacity || 1.0 };
        parsed.btnSuper = { x: bg.x || 0, y: bg.y || 0, scale: bg.scale || 1.0, opacity: bg.opacity || 1.0 };
        parsed.btnSwap = { x: bg.x || 0, y: bg.y || 0, scale: bg.scale || 1.0, opacity: bg.opacity || 1.0 };
        parsed.btnEmote = { x: bg.x || 0, y: bg.y || 0, scale: bg.scale || 1.0, opacity: bg.opacity || 1.0 };
        delete parsed.btnGroup;
      }
      const layout = {};
      for (const key of Object.keys(DEFAULT_HUD_LAYOUT)) {
        layout[key] = {
          x: typeof parsed[key]?.x === "number" ? parsed[key].x : DEFAULT_HUD_LAYOUT[key].x,
          y: typeof parsed[key]?.y === "number" ? parsed[key].y : DEFAULT_HUD_LAYOUT[key].y,
          scale: typeof parsed[key]?.scale === "number" ? parsed[key].scale : DEFAULT_HUD_LAYOUT[key].scale,
          opacity: typeof parsed[key]?.opacity === "number" ? parsed[key].opacity : DEFAULT_HUD_LAYOUT[key].opacity,
          name: DEFAULT_HUD_LAYOUT[key].name
        };
      }
      return layout;
    }
  } catch (err) {
    console.warn("Could not load custom HUD layout:", err);
  }
  return JSON.parse(JSON.stringify(DEFAULT_HUD_LAYOUT));
}

function applyHudLayout(layout) {
  const overlay = document.getElementById("hud-overlay");
  if (!overlay) return;
  for (const [id, vars] of Object.entries(HUD_VAR_MAP)) {
    const item = layout[id] || DEFAULT_HUD_LAYOUT[id];
    overlay.style.setProperty(vars.x, `${Math.round(item.x || 0)}px`);
    overlay.style.setProperty(vars.y, `${Math.round(item.y || 0)}px`);
    overlay.style.setProperty(vars.scale, String(Number(item.scale || 1.0).toFixed(2)));
    overlay.style.setProperty(vars.opacity, String(Number(item.opacity !== undefined ? item.opacity : 1.0).toFixed(2)));
  }
}

// Initial application of HUD layout
applyHudLayout(customHudLayout);

function initHudEditor() {
  const banner = document.getElementById("hud-editor-banner");
  const overlay = document.getElementById("hud-overlay");
  const btnOpenLobby = document.getElementById("btn-open-controls-editor");
  const btnOpenModal = document.getElementById("btn-modal-open-editor");
  const btnSave = document.getElementById("btn-editor-save");
  const btnReset = document.getElementById("btn-editor-reset");
  const btnClose = document.getElementById("btn-editor-close");
  const targetLabel = document.getElementById("palette-target-name");
  const btnCycle = document.getElementById("btn-palette-cycle");
  const btnScaleDown = document.getElementById("btn-scale-down");
  const btnScaleUp = document.getElementById("btn-scale-up");
  const labelScale = document.getElementById("label-target-scale");
  const btnOpacityDown = document.getElementById("btn-opacity-down");
  const btnOpacityUp = document.getElementById("btn-opacity-up");
  const labelOpacity = document.getElementById("label-target-opacity");
  const btnMoveLeft = document.getElementById("btn-move-left");
  const btnMoveRight = document.getElementById("btn-move-right");
  const btnMoveUp = document.getElementById("btn-move-up");
  const btnMoveDown = document.getElementById("btn-move-down");
  const btnItemReset = document.getElementById("btn-target-reset");

  const editableElements = Array.from(document.querySelectorAll(".hud-editable-item"));
  const validIds = Object.keys(DEFAULT_HUD_LAYOUT);

  let isEditorActive = false;
  let selectedId = "btnDash";
  let wasLobbyActive = false;
  let activePointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let itemStartX = 0;
  let itemStartY = 0;
  let tempLayout = JSON.parse(JSON.stringify(customHudLayout));

  function updatePaletteUI() {
    const cur = tempLayout[selectedId] || DEFAULT_HUD_LAYOUT[selectedId];
    if (targetLabel) targetLabel.textContent = cur.name || selectedId;
    if (labelScale) labelScale.textContent = `${Math.round((cur.scale || 1.0) * 100)}%`;
    if (labelOpacity) labelOpacity.textContent = `${Math.round((cur.opacity !== undefined ? cur.opacity : 1.0) * 100)}%`;

    editableElements.forEach(el => {
      if (el.dataset.hudId === selectedId) {
        el.classList.add("selected");
      } else {
        el.classList.remove("selected");
      }
    });
  }

  function selectTarget(id) {
    if (!validIds.includes(id)) return;
    selectedId = id;
    updatePaletteUI();
    if (audio.playHapticTick) audio.playHapticTick();
  }

  function openEditor() {
    if (isEditorActive) return;
    isEditorActive = true;
    tempLayout = JSON.parse(JSON.stringify(customHudLayout));

    // Hide controls modal if open
    document.getElementById("modal-controls")?.classList.add("hidden");

    // Remember if we were in lobby
    wasLobbyActive = lobbyScreen && !lobbyScreen.classList.contains("hidden");
    if (wasLobbyActive) {
      lobbyScreen.classList.add("hidden");
    }

    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.classList.add("hud-editor-active");
    }
    if (banner) {
      banner.classList.remove("hidden");
    }

    selectTarget(selectedId);
    applyHudLayout(tempLayout);

    if (audio.playSelectChime) audio.playSelectChime();
    showToast("📐 Touch/drag controls to move, use buttons to resize!");
  }

  function closeEditor(saved = false) {
    if (!isEditorActive) return;
    isEditorActive = false;

    if (banner) banner.classList.add("hidden");
    if (overlay) overlay.classList.remove("hud-editor-active");

    editableElements.forEach(el => el.classList.remove("selected"));

    if (saved) {
      customHudLayout = JSON.parse(JSON.stringify(tempLayout));
      localStorage.setItem("brawl_custom_hud_layout", JSON.stringify(customHudLayout));
      applyHudLayout(customHudLayout);
      showToast("💾 Controls Layout Saved!");
    } else {
      // Revert unsaved preview changes
      applyHudLayout(customHudLayout);
    }

    if (wasLobbyActive) {
      if (lobbyScreen) lobbyScreen.classList.remove("hidden");
      if (overlay) overlay.classList.add("hidden");
    }

    if (audio.playSelectChime) audio.playSelectChime();
  }

  // Pointer drag handling on all editable items
  editableElements.forEach(el => {
    const id = el.dataset.hudId;
    if (!id) return;

    el.addEventListener("pointerdown", (e) => {
      if (!isEditorActive) return;
      e.preventDefault();
      e.stopPropagation();

      selectTarget(id);
      activePointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      itemStartX = tempLayout[id]?.x || 0;
      itemStartY = tempLayout[id]?.y || 0;

      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    el.addEventListener("pointermove", (e) => {
      if (!isEditorActive || activePointerId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      tempLayout[id].x = Math.round(itemStartX + dx);
      tempLayout[id].y = Math.round(itemStartY + dy);

      applyHudLayout(tempLayout);
    });

    const endDrag = (e) => {
      if (!isEditorActive || activePointerId !== e.pointerId) return;
      activePointerId = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  });

  // Cycle Target Button
  btnCycle?.addEventListener("click", () => {
    const idx = validIds.indexOf(selectedId);
    const nextIdx = (idx + 1) % validIds.length;
    selectTarget(validIds[nextIdx]);
  });

  // Scale (Size: Chhota / Bada)
  btnScaleDown?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    cur.scale = Math.max(0.5, Math.round(((cur.scale || 1.0) - 0.05) * 100) / 100);
    applyHudLayout(tempLayout);
    updatePaletteUI();
    if (audio.playHapticTick) audio.playHapticTick();
  });

  btnScaleUp?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    cur.scale = Math.min(1.6, Math.round(((cur.scale || 1.0) + 0.05) * 100) / 100);
    applyHudLayout(tempLayout);
    updatePaletteUI();
    if (audio.playHapticTick) audio.playHapticTick();
  });

  // Opacity (Translucency)
  btnOpacityDown?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    const op = cur.opacity !== undefined ? cur.opacity : 1.0;
    cur.opacity = Math.max(0.3, Math.round((op - 0.1) * 100) / 100);
    applyHudLayout(tempLayout);
    updatePaletteUI();
    if (audio.playHapticTick) audio.playHapticTick();
  });

  btnOpacityUp?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    const op = cur.opacity !== undefined ? cur.opacity : 1.0;
    cur.opacity = Math.min(1.0, Math.round((op + 0.1) * 100) / 100);
    applyHudLayout(tempLayout);
    updatePaletteUI();
    if (audio.playHapticTick) audio.playHapticTick();
  });

  // D-Pad Nudge Buttons (6px step: Upar / Neeche / Aage / Peeche)
  const NUDGE_STEP = 6;
  btnMoveLeft?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    cur.x = (cur.x || 0) - NUDGE_STEP;
    applyHudLayout(tempLayout);
    if (audio.playHapticTick) audio.playHapticTick();
  });

  btnMoveRight?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    cur.x = (cur.x || 0) + NUDGE_STEP;
    applyHudLayout(tempLayout);
    if (audio.playHapticTick) audio.playHapticTick();
  });

  btnMoveUp?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    cur.y = (cur.y || 0) - NUDGE_STEP;
    applyHudLayout(tempLayout);
    if (audio.playHapticTick) audio.playHapticTick();
  });

  btnMoveDown?.addEventListener("click", () => {
    const cur = tempLayout[selectedId];
    if (!cur) return;
    cur.y = (cur.y || 0) + NUDGE_STEP;
    applyHudLayout(tempLayout);
    if (audio.playHapticTick) audio.playHapticTick();
  });

  // Reset single item
  btnItemReset?.addEventListener("click", () => {
    const def = DEFAULT_HUD_LAYOUT[selectedId];
    if (!def) return;
    tempLayout[selectedId] = {
      x: def.x,
      y: def.y,
      scale: def.scale,
      opacity: def.opacity,
      name: def.name
    };
    applyHudLayout(tempLayout);
    updatePaletteUI();
    if (audio.playHapticTick) audio.playHapticTick();
    showToast(`↺ ${def.name} Reset to Center`);
  });

  // Reset all to defaults
  btnReset?.addEventListener("click", () => {
    tempLayout = JSON.parse(JSON.stringify(DEFAULT_HUD_LAYOUT));
    applyHudLayout(tempLayout);
    updatePaletteUI();
    if (audio.playSelectChime) audio.playSelectChime();
    showToast("🔄 All Controls Reset to Defaults");
  });

  // Save layout
  btnSave?.addEventListener("click", () => {
    closeEditor(true);
  });

  // Close / Exit editor
  btnClose?.addEventListener("click", () => {
    closeEditor(false);
  });

  // ==========================================
  // Draggable Toolbars (Header Bar & Palette)
  // ==========================================
  function setupToolbarDrag(element, handle) {
    if (!element || !handle) return null;
    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let currentX = 0;
    let currentY = 0;
    let pointerId = null;

    handle.addEventListener("pointerdown", (e) => {
      // Do not initiate drag if user tapped a button or input inside the handle
      if (e.target.closest("button") || e.target.closest("input")) return;
      e.preventDefault();
      e.stopPropagation();

      isDragging = true;
      pointerId = e.pointerId;
      startPointerX = e.clientX - currentX;
      startPointerY = e.clientY - currentY;
      element.classList.add("is-dragging");

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    handle.addEventListener("pointermove", (e) => {
      if (!isDragging || e.pointerId !== pointerId) return;
      e.preventDefault();
      e.stopPropagation();

      currentX = e.clientX - startPointerX;
      currentY = e.clientY - startPointerY;

      element.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    const endDrag = (e) => {
      if (!isDragging || e.pointerId !== pointerId) return;
      isDragging = false;
      pointerId = null;
      element.classList.remove("is-dragging");
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    return {
      setTranslate: (x, y) => {
        currentX = x;
        currentY = y;
        element.style.transform = `translate(${x}px, ${y}px)`;
      },
      getTranslate: () => ({ x: currentX, y: currentY }),
      reset: () => {
        currentX = 0;
        currentY = 0;
        element.style.transform = "translate(0px, 0px)";
      }
    };
  }

  const headerBarEl = document.getElementById("editor-header-bar");
  const headerHandle = document.getElementById("header-drag-handle");
  const headerDrag = setupToolbarDrag(headerBarEl, headerHandle);

  const paletteEl = document.getElementById("editor-palette");
  const paletteHandle = document.getElementById("palette-drag-handle");
  const paletteDrag = setupToolbarDrag(paletteEl, paletteHandle);

  // Docking button (Toggles palette position between top and bottom)
  let isDockedTop = false;
  const btnDock = document.getElementById("btn-palette-dock");
  btnDock?.addEventListener("click", (e) => {
    e.stopPropagation();
    isDockedTop = !isDockedTop;
    if (isDockedTop) {
      const topOffset = -(window.innerHeight - 170);
      paletteDrag?.setTranslate(0, Math.min(-180, topOffset));
      btnDock.textContent = "⇅ BOTTOM";
      showToast("⬆️ Toolbar Docked to Top");
    } else {
      paletteDrag?.reset();
      btnDock.textContent = "⇅ TOP";
      showToast("⬇️ Toolbar Docked to Bottom");
    }
    if (audio.playHapticTick) audio.playHapticTick();
  });

  // Minimize / Expand Palette Button
  const btnCollapse = document.getElementById("btn-palette-collapse");
  btnCollapse?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!paletteEl) return;
    const isCollapsed = paletteEl.classList.toggle("collapsed");
    btnCollapse.textContent = isCollapsed ? "▲ EXPAND" : "▼ MIN";
    if (audio.playHapticTick) audio.playHapticTick();
    if (isCollapsed) {
      showToast("🔽 Toolbar Minimized");
    } else {
      showToast("🔼 Toolbar Expanded");
    }
  });

  // Reset toolbar positions on global reset
  btnReset?.addEventListener("click", () => {
    paletteDrag?.reset();
    headerDrag?.reset();
    if (btnDock) btnDock.textContent = "⇅ DOCK";
    isDockedTop = false;
  });

  // Open triggers
  btnOpenLobby?.addEventListener("click", openEditor);
  btnOpenModal?.addEventListener("click", openEditor);
}

initHudEditor();

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

  network.on("host_migrating", () => {
    showToast("Arena host migrated! Resuming fight... ⚡");
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
    // GUARD: If user has completely exited to main menu, ignore stray arena start events
    if (!state.currentRoom) {
      console.log("[GameStarted] Ignored because player is not in any room.");
      return;
    }

    console.log("Game started received:", startData);
    const chosenMapId = startData?.options?.mapId || state.currentRoom?.options?.mapId || "military_airbase";
    state.mapData = (startData && startData.map) ? startData.map : (MAPS[chosenMapId] || MAPS.military_airbase);
    state.gameRunning = true;
    particles.setWeatherMap(state.mapData?.id || chosenMapId || "military_airbase");

    // Reset camera state so it snaps directly to player on start
    renderer.resetCamera();
    renderer.resize();

    viewActiveRoom.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    hudOverlay.classList.remove("hidden");
    modalMatchOver.classList.add("hidden");

    if (hudRoomCode) hudRoomCode.textContent = state.currentRoom?.id || "BRAWL";
    audio.startMusic();
    triggerMatchCountdown();
    navigateToScreen("arena");
  });

  network.on("game_state", (worldState) => {
    if (!state.currentRoom || !state.gameRunning) return;
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
    if (!state.gameRunning) return;
    if (data.weapon === "shotgun") audio.playShotgun();
    else if (data.weapon === "plasma") audio.playPlasma();
    else if (data.weapon === "rocket") audio.playRocketLaunch();
    else if (data.weapon === "railgun") audio.playRailgun();
    else audio.playBlaster();

    if (data.shooterId === state.localPlayerId && navigator.vibrate) {
      try { navigator.vibrate(6); } catch (e) {}
    }

    const tipDist = 36;
    const fx = data.x + Math.cos(data.angle) * tipDist;
    const fy = data.y + Math.sin(data.angle) * tipDist;
    particles.emitMuzzle(fx, fy, data.angle);
  });

  network.on("bullet_impact", (data) => {
    if (!state.gameRunning) return;
    if (data.aoeRadius > 0) {
      audio.playExplosion(1.2);
      particles.emitExplosion(data.x, data.y, data.aoeRadius);
      renderer.addScreenShake(12);
    } else {
      particles.emitSparks(data.x, data.y, 8);
    }
  });

  network.on("player_hit", (data) => {
    if (!state.gameRunning) return;
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
    if (!state.gameRunning) return;
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
    if (!state.gameRunning) return;
    const isMe = data.playerId === state.localPlayerId;
    if (audio.playKillstreak) {
      audio.playKillstreak(data.title.includes("RAMPAGE") ? 5 : (data.title.includes("TRIPLE") ? 3 : 2));
    } else {
      audio.playStreakFanfare();
    }
    const banner = document.getElementById("killstreak-banner");
    const title = document.getElementById("streak-text");
    const sub = document.getElementById("streak-sub");
    if (banner && title && sub) {
      title.textContent = data.title;
      sub.textContent = isMe ? "⚡ YOU ARE UNSTOPPABLE! ⚡" : `${data.playerName} IS ON A RAMPAGE!`;
      banner.className = `killstreak-banner ${data.title.includes("RAMPAGE") || data.title.includes("UNSTOPPABLE") ? "streak-gold" : (data.title.includes("TRIPLE") ? "streak-purple" : "streak-cyan")}`;
      banner.classList.remove("hidden");
      if (isMe && navigator.vibrate) navigator.vibrate([70, 40, 90]);
      setTimeout(() => banner.classList.add("hidden"), 2800);
    }
  });

  network.on("player_dashed", (data) => {
    if (!state.gameRunning) return;
    particles.emitDashTrail(data.x, data.y, data.angle);
  });

  network.on("super_activated", (data) => {
    if (!state.gameRunning) return;
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
    if (!state.gameRunning) return;
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
    if (!state.gameRunning) return;
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
        if (res.playerId) {
          state.localPlayerId = res.playerId;
        }

        // Ensure mapData is loaded immediately
        const chosenMapId = res.room?.options?.mapId || "military_airbase";
        state.mapData = MAPS[chosenMapId] || MAPS.military_airbase;

        // Transition straight into the game arena!
        lobbyScreen.classList.add("hidden");
        hudOverlay.classList.remove("hidden");
        modalMatchOver.classList.add("hidden");

        renderer.resetCamera();
        renderer.resize();
        state.gameRunning = true;
    particles.setWeatherMap("military_airbase");
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
    state.latestWorldState = null;
    hudOverlay.classList.add("hidden");
    modalMatchOver.classList.add("hidden");

    if (state.currentRoom && state.currentRoom.id !== "PUBLIC" && state.currentRoom.id !== "SOLO") {
      // In a custom room with friends: return to room lobby view
      lobbyScreen.classList.remove("hidden");
      switchToRoomView(state.currentRoom);
      showToast("Returned to Room Lobby 🏠");
    } else {
      // In quick play or solo: leave cleanly
      network.leaveRoom();
      state.currentRoom = null;
      state.isHost = false;
      lobbyScreen.classList.remove("hidden");
      viewActiveRoom.classList.add("hidden");
      viewRoomSelection.classList.remove("hidden");

      if (btnQuickPlay) {
        btnQuickPlay.disabled = false;
        btnQuickPlay.textContent = "⚔️ BATTLE NOW (DROP IN) ⚔️";
      }

      try {
        window.history.replaceState({ screen: "lobby" }, document.title, window.location.pathname);
      } catch (e) {}

      showToast("Returned to Lobby 🏠");
    }
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
    showToast("Starting Solo Match vs AI Bots! ⚔️");
    const dur = selectMatchDuration ? Number(selectMatchDuration.value) : 240;
    const kills = selectScoreLimit ? Number(selectScoreLimit.value) : 15;
    state.currentRoom = { id: "SOLO", options: { mapId: "military_airbase", scoreLimit: kills, matchDuration: dur } };
    state.isHost = true;
    state.mapData = MAPS.military_airbase;
    lobbyScreen.classList.add("hidden");
    hudOverlay.classList.remove("hidden");
    modalMatchOver.classList.add("hidden");
    renderer.resetCamera();
    renderer.resize();
    state.gameRunning = true;
    particles.setWeatherMap("military_airbase");
    audio.startMusic();
    navigateToScreen("arena");
    network.startSoloMatch(state.profile, {
      gameMode: "ffa",
      scoreLimit: kills,
      matchDuration: dur,
      mapId: "military_airbase"
    });
  });
}

btnCreateRoom.addEventListener("click", () => {
  audio.unlock();
  btnCreateRoom.disabled = true;
  btnCreateRoom.textContent = "CREATING... 🚀";
  const initialDuration = selectMatchDuration ? Number(selectMatchDuration.value) : 240;
  const initialScoreLimit = selectScoreLimit ? Number(selectScoreLimit.value) : 15;
  const initialGameMode = selectGameMode ? selectGameMode.value : "ffa";
  network.createRoom(state.profile, { gameMode: initialGameMode, scoreLimit: initialScoreLimit, matchDuration: initialDuration }, (res) => {
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
        const chosenMapId = res.room?.options?.mapId || "military_airbase";
        state.mapData = MAPS[chosenMapId] || MAPS.military_airbase;
        renderer.resetCamera();
        renderer.resize();
        state.gameRunning = true;
    particles.setWeatherMap("military_airbase");
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
  voiceManager.leaveRoomVoice();
  network.leaveRoom();
  state.currentRoom = null;
  state.isHost = false;
  state.latestWorldState = null;
  viewActiveRoom.classList.add("hidden");
  viewRoomSelection.classList.remove("hidden");
  if (btnQuickPlay) {
    btnQuickPlay.disabled = false;
    btnQuickPlay.textContent = "⚔️ BATTLE NOW (DROP IN) ⚔️";
  }
  try {
    window.history.replaceState({ screen: "lobby" }, document.title, window.location.pathname);
  } catch (e) {}
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
  audio.playClick();

  // Ensure current map selector, match duration, and room options are strictly synchronized
  const selectMap = document.getElementById("select-map");
  if (state.currentRoom) {
    state.currentRoom.options = state.currentRoom.options || {};
    if (selectMap && selectMap.value) state.currentRoom.options.mapId = selectMap.value;
    if (selectGameMode) state.currentRoom.options.gameMode = selectGameMode.value;
    if (selectScoreLimit) state.currentRoom.options.scoreLimit = Number(selectScoreLimit.value);
    if (selectMatchDuration) state.currentRoom.options.matchDuration = Number(selectMatchDuration.value);
    network.updateRoomOptions(state.currentRoom.options);
  }

  btnStartGame.disabled = true;
  btnStartGame.textContent = "STARTING MATCH... ⚔️";

  network.startGame((res) => {
    setTimeout(() => {
      btnStartGame.disabled = false;
      btnStartGame.textContent = "START MATCH ⚔️";
    }, 1500);

    if (res && !res.success) {
      showToast(`Cannot start: ${res.error || "Please wait..."}`);
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

if (selectMatchDuration) {
  selectMatchDuration.addEventListener("change", (e) => {
    if (state.isHost) {
      network.updateRoomOptions({ matchDuration: parseInt(e.target.value) });
    }
  });
}

// ===================================================
// Android 17 Liquid Glass Dropdown Controller
// ===================================================
const MAP_PREVIEWS = {
  military_airbase: { icon: "🎖️", name: "Military Airbase", tag: "Bunkers & Runway", desc: "Airfield combat with blast barriers and tactical sniper hangars." },
  cargo_docks: { icon: "🚢", name: "Cargo Docks", tag: "Containers & Harbor", desc: "Multi-level container mazes with tight ambush corners." },
  desert_town: { icon: "🏜️", name: "Desert Town", tag: "Dust II Ruins", desc: "Sunken stone pillars, open sand bazaar, and lethal crossfire lanes." },
  abandoned_factory: { icon: "🏭", name: "Abandoned Factory", tag: "Industrial Hazard", desc: "Rusted machinery, hazardous vats, and narrow catwalks." },
  dense_jungle: { icon: "🌲", name: "Dense Jungle", tag: "Rainforest & River", desc: "Misty wilderness with natural rock choke points and river flanks." },
  arctic_base: { icon: "❄️", name: "Arctic Snow Base", tag: "Sub-Zero Outpost", desc: "Reinforced snow barriers, frozen runway, and blast-proof bunkers." },
  city_ruins: { icon: "🏙️", name: "City Ruins", tag: "Urban Warzone", desc: "Destroyed bus barricades, rubble alleyways, and street crossfire." },
  railway_depot: { icon: "🚂", name: "Railway Depot", tag: "Freight & Switchyard", desc: "Heavy boxcars, rusted rail lines, and tactical corridor lanes." },
  island_bunker: { icon: "🏝️", name: "Island Bunker", tag: "Coastal Fortress", desc: "Sea wall revetments, fortified pillbox battery, and ocean perimeter." }
};

function initA17Dropdowns() {
  const dropdownIds = ["select-game-mode", "select-score-limit", "select-match-duration", "select-map"];
  
  dropdownIds.forEach(id => {
    const select = document.getElementById(id);
    const wrapper = document.getElementById(`wrapper-${id}`);
    if (!select || !wrapper) return;

    const trigger = wrapper.querySelector(".a17-dropdown-trigger");
    const menu = wrapper.querySelector(".a17-dropdown-menu");
    const options = menu ? menu.querySelectorAll(".a17-option") : [];
    const parent = wrapper.closest(".setting-item");

    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (select.disabled || trigger.classList.contains("disabled")) return;
        if (audio.playHapticTick) audio.playHapticTick();
        const isOpen = wrapper.classList.contains("open");
        closeAllA17Dropdowns();
        if (!isOpen) {
          wrapper.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
          if (parent) parent.classList.add("has-open-dropdown");

          const selectedOpt = menu.querySelector(".a17-option.selected");
          if (selectedOpt) {
            selectedOpt.scrollIntoView({ block: "nearest" });
          }
        }
      });
    }

    options.forEach(opt => {
      opt.addEventListener("pointerenter", () => {
        if (audio.playHapticTick) audio.playHapticTick();
      });

      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        if (select.disabled || trigger.classList.contains("disabled")) return;
        if (audio.playSelectChime) audio.playSelectChime();
        const val = opt.dataset.value;
        select.value = val;
        syncA17Dropdown(id);
        closeAllA17Dropdowns();
        if (typeof select.onchange === "function") {
          select.onchange({ target: select });
        }
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    syncA17Dropdown(id);
  });

  // Haptic hover on standard UI buttons
  document.querySelectorAll(".btn, .app-back-btn, .hud-back-btn").forEach(btn => {
    btn.addEventListener("pointerenter", () => {
      if (audio.playHapticTick) audio.playHapticTick();
    });
  });
}

function syncA17Dropdown(selectId) {
  const select = document.getElementById(selectId);
  const wrapper = document.getElementById(`wrapper-${selectId}`);
  if (!select || !wrapper) return;

  const trigger = wrapper.querySelector(".a17-dropdown-trigger");
  const menu = wrapper.querySelector(".a17-dropdown-menu");
  const options = menu ? menu.querySelectorAll(".a17-option") : [];
  const valueDisplay = trigger ? trigger.querySelector(".a17-trigger-value") : null;
  const parent = wrapper.closest(".setting-item");

  if (trigger) {
    if (select.disabled) {
      trigger.classList.add("disabled");
      wrapper.classList.remove("open");
      if (parent) parent.classList.remove("has-open-dropdown");
    } else {
      trigger.classList.remove("disabled");
    }
  }

  const curVal = String(select.value);
  let matchedLabel = "";
  options.forEach(opt => {
    if (opt.dataset.value === curVal) {
      opt.classList.add("selected");
      matchedLabel = opt.querySelector(".a17-opt-label")?.textContent || opt.textContent;
    } else {
      opt.classList.remove("selected");
    }
  });

  if (matchedLabel && valueDisplay) {
    valueDisplay.textContent = matchedLabel;
  }

  // Update Map Preview Card if map selection changed
  if (selectId === "select-map") {
    const preview = MAP_PREVIEWS[curVal] || MAP_PREVIEWS.military_airbase;
    const pIcon = document.getElementById("map-preview-icon");
    const pName = document.getElementById("map-preview-name");
    const pTag = document.getElementById("map-preview-tag");
    const pDesc = document.getElementById("map-preview-desc");
    if (pIcon && preview) {
      pIcon.textContent = preview.icon;
      if (pName) pName.textContent = preview.name;
      if (pTag) pTag.textContent = preview.tag;
      if (pDesc) pDesc.textContent = preview.desc;
    }
  }
}

function closeAllA17Dropdowns() {
  document.querySelectorAll(".a17-dropdown-wrapper.open, .custom-select-wrapper.open").forEach(w => {
    w.classList.remove("open");
    const tr = w.querySelector(".a17-dropdown-trigger, .custom-select-trigger");
    if (tr) tr.setAttribute("aria-expanded", "false");
    const parent = w.closest(".setting-item");
    if (parent) parent.classList.remove("has-open-dropdown");
  });
}

function syncAllCustomSelects() {
  ["select-game-mode", "select-score-limit", "select-match-duration", "select-map"].forEach(id => {
    syncA17Dropdown(id);
  });
}

document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".a17-dropdown-wrapper") && !e.target.closest(".custom-select-wrapper")) {
    closeAllA17Dropdowns();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllA17Dropdowns();
  }
});

initA17Dropdowns();

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
  if (room) state.currentRoom = room;
  viewRoomSelection.classList.add("hidden");
  viewActiveRoom.classList.remove("hidden");
  renderLobbyRoom(room);
  navigateToScreen("room");

  // Automatically connect to Room Live Voice Chat!
  if (room && room.id && room.id !== "SOLO") {
    voiceManager.joinRoomVoice(room.id, state.profile.name);
  }
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
  if (selectMatchDuration) selectMatchDuration.disabled = !isMeHost;
  selectGameMode.value = room.options?.gameMode || "ffa";
  selectScoreLimit.value = String(room.options?.scoreLimit !== undefined ? room.options.scoreLimit : 15);
  if (selectMatchDuration) selectMatchDuration.value = String(room.options?.matchDuration !== undefined ? room.options.matchDuration : 240);

  const selectMap = document.getElementById("select-map");
  if (selectMap) {
    selectMap.disabled = !isMeHost;
    selectMap.value = room.options?.mapId || "military_airbase";
    selectMap.onchange = (e) => {
      if (state.isHost) {
        network.updateRoomOptions({ mapId: e.target.value });
      }
    };
  }

  // Synchronize Android 17 custom select pills
  syncAllCustomSelects();

  if (isMeHost) {
    btnStartGame.classList.remove("hidden");
    hostHint.classList.add("hidden");
    document.getElementById("host-bot-controls")?.classList.remove("hidden");
  } else {
    btnStartGame.classList.add("hidden");
    hostHint.classList.remove("hidden");
    document.getElementById("host-bot-controls")?.classList.add("hidden");
  }

  // Render players grid with real-time Voice Speaking aura
  lobbyPlayerList.innerHTML = "";
  room.players.forEach(p => {
    const card = document.createElement("div");
    const pid = p.id || p.peerId;
    card.id = `lobby-player-${pid}`;
    const isLocal = pid === state.localPlayerId;
    const isSpeaking = (isLocal && voiceManager.isSpeaking) || voiceManager.peers.get(pid)?.isSpeaking;
    card.className = `player-lobby-card ${p.isHost ? "is-host" : ""} ${p.isReady ? "is-ready" : ""} ${isSpeaking ? "is-speaking" : ""}`;

    const hostBadge = p.isHost ? `<span class="host-badge">👑 HOST</span>` : "";
    const initial = (p.name || "B").substring(0, 2).toUpperCase();
    const isMuted = (isLocal && voiceManager.isMicMuted) || voiceManager.peers.get(pid)?.isMuted;
    const voiceStatus = isMuted ? `<span class="player-voice-status" title="Muted">🔇</span>` : `<span class="player-voice-status" title="Voice Active">🎙️</span>`;

    card.innerHTML = `
      ${hostBadge}
      <div class="avatar-mini" style="background-color: ${p.color};">${initial}</div>
      <div class="p-name">${escapeHtml(p.name)} ${voiceStatus}</div>
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

// 5. In-Game HUD Updates (Optimized with dirty checking & throttled to ~28 Hz to eliminate mobile DOM lag)
function updateHUD(worldState) {
  if (!worldState) return;

  const now = performance.now();
  if (now - lastHUDUpdateTime < 35) return; // Cap DOM HUD updates to ~28 Hz
  lastHUDUpdateTime = now;

  // Timer: 0 or unbounded means 24/7 Endless Arena!
  const isEndless = !worldState.timeRemaining || worldState.timeRemaining <= 0 || worldState.timeRemaining > 3600;
  const timerText = isEndless
    ? "⚔️ ENDLESS"
    : `${String(Math.floor(worldState.timeRemaining / 60)).padStart(2, "0")}:${String(worldState.timeRemaining % 60).padStart(2, "0")}`;

  if (lastHUDState.timer !== timerText) {
    lastHUDState.timer = timerText;
    hudTimer.textContent = timerText;
    if (!isEndless && worldState.timeRemaining <= 30) {
      hudTimer.style.color = "#ef4444";
      hudTimer.style.textShadow = "0 0 10px rgba(239, 68, 68, 0.6)";
    } else {
      hudTimer.style.color = "";
      hudTimer.style.textShadow = "";
    }
  }

  // Live Arena Players Count
  if (hudPlayersCount && worldState.players) {
    const humanCount = worldState.players.filter(p => !p.isBot).length;
    const countText = `👥 ${humanCount} BRAWLERS`;
    if (lastHUDState.playersCount !== countText) {
      lastHUDState.playersCount = countText;
      hudPlayersCount.textContent = countText;
    }
  }

  // Team score tracker
  if (worldState.teamScores && hudTeamTracker && teamScoreBlue && teamScoreRed) {
    const scoreKey = `${worldState.teamScores.blue}-${worldState.teamScores.red}`;
    if (lastHUDState.teamScores !== scoreKey) {
      lastHUDState.teamScores = scoreKey;
      hudTeamTracker.classList.remove("hidden");
      teamScoreBlue.textContent = worldState.teamScores.blue;
      teamScoreRed.textContent = worldState.teamScores.red;
    }
  } else if (hudTeamTracker && lastHUDState.teamScores !== "hidden") {
    lastHUDState.teamScores = "hidden";
    hudTeamTracker.classList.add("hidden");
  }

  // Find local player
  const me = worldState.players?.find(p => p.id === state.localPlayerId);
  if (me) {
    if (lastHUDState.kills !== me.kills) {
      lastHUDState.kills = me.kills;
      hudPlayerKills.textContent = me.kills;
    }

    // Health (Dirty checked)
    const hpVal = Math.ceil(me.health);
    const hpPct = Math.round(Math.max(0, Math.min(100, (me.health / me.maxHealth) * 100)));
    if (lastHUDState.hpPct !== hpPct) {
      lastHUDState.hpPct = hpPct;
      hudHealthFill.style.width = `${hpPct}%`;
    }
    if (lastHUDState.hpVal !== hpVal) {
      lastHUDState.hpVal = hpVal;
      hudHealthText.textContent = hpVal;
    }

    // Shield (Dirty checked)
    const shVal = Math.ceil(me.shield);
    const shPct = Math.round(Math.max(0, Math.min(100, (me.shield / me.maxShield) * 100)));
    if (lastHUDState.shPct !== shPct) {
      lastHUDState.shPct = shPct;
      hudShieldFill.style.width = `${shPct}%`;
    }
    if (lastHUDState.shVal !== shVal) {
      lastHUDState.shVal = shVal;
      hudShieldText.textContent = shVal;
    }

    // Super Meter & Button (Dirty checked)
    const superCharge = Math.min(100, Math.max(0, Math.round(me.superCharge || 0)));
    if (lastHUDState.superCharge !== superCharge) {
      lastHUDState.superCharge = superCharge;
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
    }

    // Low Health Vignette (Dirty checked)
    const isLowHp = me.health <= 35 && me.isAlive;
    if (lastHUDState.isVignetteActive !== isLowHp) {
      lastHUDState.isVignetteActive = isLowHp;
      if (isLowHp) {
        lowHealthVignette.classList.add("active");
      } else {
        lowHealthVignette.classList.remove("active");
      }
    }

    // Weapon & Ammo (Dirty checked)
    if (lastHUDState.weapon !== me.currentWeapon) {
      lastHUDState.weapon = me.currentWeapon;
      hudWeaponName.textContent = me.currentWeapon.toUpperCase();
      window.__currentLocalWeapon = me.currentWeapon;

      let icon = "🔫";
      if (me.currentWeapon === "shotgun") icon = "💥";
      else if (me.currentWeapon === "plasma") icon = "🔮";
      else if (me.currentWeapon === "rocket") icon = "🚀";
      else if (me.currentWeapon === "railgun") icon = "⚡";
      hudWeaponIcon.textContent = icon;
    }

    const ammoVal = (me.ammo === Infinity || me.ammo === -1) ? "∞" : me.ammo;
    if (lastHUDState.ammo !== ammoVal) {
      lastHUDState.ammo = ammoVal;
      hudAmmoCount.textContent = ammoVal;
    }
  }
}

function addKillFeedItem(event) {
  const item = document.createElement("div");
  item.className = "kill-feed-item";
  const weaponIcon = {
    rocket: "🚀",
    railgun: "⚡",
    shotgun: "💥",
    plasma: "🔮",
    blaster: "🔫",
    grenade: "💣",
    melee: "🗡️"
  }[event.weapon] || "⚔️";

  item.innerHTML = `
    <span class="kf-killer" style="color:${event.killerColor}">${escapeHtml(event.killerName)}</span>
    <span class="kf-weapon" title="${escapeHtml(event.weapon || 'weapon')}">${weaponIcon}</span>
    <span class="kf-victim" style="color:${event.victimColor}">${escapeHtml(event.victimName)}</span>
  `;
  killFeed.appendChild(item);
  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateX(20px)";
    item.style.transition = "all 0.3s ease";
    setTimeout(() => item.remove(), 300);
  }, 4000);
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

function returnToLobbyCleanly() {
  audio.stopMusic();
  state.gameRunning = false;
  state.latestWorldState = null;
  network.leaveRoom();
  state.currentRoom = null;
  state.isHost = false;
  modalMatchOver.classList.add("hidden");
  hudOverlay.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  viewActiveRoom.classList.add("hidden");
  viewRoomSelection.classList.remove("hidden");

  if (btnQuickPlay) {
    btnQuickPlay.disabled = false;
    btnQuickPlay.textContent = "⚔️ BATTLE NOW (DROP IN) ⚔️";
  }
  if (btnCreateRoom) {
    btnCreateRoom.disabled = false;
    btnCreateRoom.textContent = "CREATE ROOM 🚀";
  }

  try {
    window.history.replaceState({ screen: "lobby" }, document.title, window.location.pathname);
  } catch (e) {}
}

const btnMatchOverBack = document.getElementById("btn-match-over-back");
if (btnMatchOverBack) {
  btnMatchOverBack.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    if (state.currentRoom && state.currentRoom.id !== "PUBLIC" && state.currentRoom.id !== "SOLO") {
      modalMatchOver.classList.add("hidden");
      hudOverlay.classList.add("hidden");
      lobbyScreen.classList.remove("hidden");
      switchToRoomView(state.currentRoom);
      showToast("Returned to Room Lobby 🏠");
    } else {
      returnToLobbyCleanly();
      showToast("Returned to Lobby 🏠");
    }
  });
}

btnRematch.addEventListener("click", () => {
  audio.unlock();
  audio.playClick();
  if (state.currentRoom && state.currentRoom.id !== "PUBLIC" && state.currentRoom.id !== "SOLO") {
    modalMatchOver.classList.add("hidden");
    hudOverlay.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    switchToRoomView(state.currentRoom);
    showToast("Returned to Room Lobby 🏠");
  } else {
    returnToLobbyCleanly();
    showToast("Returned to Lobby 🏠");
  }
});

const btnPlayAgain = document.getElementById("btn-play-again");
if (btnPlayAgain) {
  btnPlayAgain.addEventListener("click", () => {
    audio.unlock();
    audio.playClick();
    audio.stopMusic();

    modalMatchOver.classList.add("hidden");

    // Case 1: Solo match vs Bots
    if (state.currentRoom?.id === "SOLO" || network.isLocalSolo) {
      showToast("Starting New Solo Match vs Bots! ⚔️");
      const opts = state.currentRoom?.options || { mapId: "military_airbase", scoreLimit: 15, matchDuration: 240 };
      state.currentRoom = { id: "SOLO", options: opts };
      state.isHost = true;
      state.mapData = MAPS[opts.mapId] || MAPS.military_airbase;
      lobbyScreen.classList.add("hidden");
      hudOverlay.classList.remove("hidden");
      modalMatchOver.classList.add("hidden");
      renderer.resetCamera();
      renderer.resize();
      state.gameRunning = true;
    particles.setWeatherMap("military_airbase");
      audio.startMusic();
      navigateToScreen("arena");
      network.startSoloMatch(state.profile, opts);
      return;
    }

    // Case 2: Custom Room with Friends
    if (state.currentRoom && state.currentRoom.id !== "PUBLIC") {
      if (state.isHost) {
        showToast("Starting Next Round for Room! ⚔️");
        network.startGame((res) => {
          if (res && !res.success) {
            showToast(`Cannot start: ${res.error}`);
            switchToRoomView(state.currentRoom);
          }
        });
      } else {
        showToast("Waiting for Host to start next round... ⏳");
        switchToRoomView(state.currentRoom);
      }
      return;
    }

    // Case 3: Quick Play (Public Arena)
    showToast("Rejoining Arena for Next Battle... ⚔️");
    state.gameRunning = false;
    state.latestWorldState = null;
    network.quickPlay(state.profile, (res) => {
      if (res.success) {
        state.currentRoom = res.room;
        state.isHost = res.isHost;
        if (res.playerId) state.localPlayerId = res.playerId;
        const chosenMapId = res.room?.options?.mapId || "military_airbase";
        state.mapData = MAPS[chosenMapId] || MAPS.military_airbase;
        lobbyScreen.classList.add("hidden");
        hudOverlay.classList.remove("hidden");
        modalMatchOver.classList.add("hidden");
        renderer.resetCamera();
        renderer.resize();
        state.gameRunning = true;
    particles.setWeatherMap("military_airbase");
        audio.startMusic();
        navigateToScreen("arena");
        showToast("⚔️ IN BATTLE! Round 2!");
      } else {
        showToast("Returned to Lobby 🏠");
        returnToLobbyCleanly();
      }
    });
  });
}

// 7. Main Game Loop (60 FPS)
let lastFrameTime = performance.now();

function gameLoop(time) {
  const dt = Math.min((time - lastFrameTime) / 1000, 0.1);
  lastFrameTime = time;

  if (state.gameRunning) {
    // Ensure mapData is never null
    if (!state.mapData) {
      const chosenMapId = state.currentRoom?.options?.mapId || "military_airbase";
      state.mapData = MAPS[chosenMapId] || MAPS.military_airbase;
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
    particles.update(dt, renderer.viewBounds);

    // Render Canvas (Interpolates all entities smoothly & updates camera without jitter)
    renderer.render(world, state.localPlayerId, state.mapData, dt);
  }

  requestAnimationFrame(gameLoop);
}

// Bot Controls
document.getElementById("btn-add-bot")?.addEventListener("click", () => {
  audio.unlock();
  audio.playClick();
  network.addBot((res) => {
    if (!res.success) showToast(res.error || "Cannot add bot");
    else showToast("Bot Added to Room 🤖");
  });
});

document.getElementById("btn-remove-bot")?.addEventListener("click", () => {
  audio.unlock();
  audio.playClick();
  network.removeBot(null, (res) => {
    if (!res.success) showToast(res.error || "Cannot remove bot");
    else showToast("Bot Removed from Room");
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
    if (document.getElementById("hud-overlay")?.classList.contains("hud-editor-active")) return;
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

// ========================================================
// LIVE ROOM & IN-GAME WEBRTC VOICE CHAT CONTROLLER
// ========================================================
const btnVoiceMic = document.getElementById("btn-voice-toggle-mic");
const btnVoiceDeafen = document.getElementById("btn-voice-toggle-deafen");
const btnHudVoiceMic = document.getElementById("btn-hud-voice-mic");
const btnHudVoiceDeafen = document.getElementById("btn-hud-voice-deafen");

function onToggleMic() {
  const isMuted = voiceManager.toggleMic();
  if (audio.playClick) audio.playClick();
  showToast(isMuted ? "🔇 Microphone Muted" : "🎙️ Microphone Live!");
}

function onToggleDeafen() {
  const isDeafened = voiceManager.toggleDeafen();
  if (audio.playClick) audio.playClick();
  showToast(isDeafened ? "🔇 Voice Audio Muted" : "🔊 Voice Audio Active");
}

btnVoiceMic?.addEventListener("click", onToggleMic);
btnHudVoiceMic?.addEventListener("click", onToggleMic);
btnVoiceDeafen?.addEventListener("click", onToggleDeafen);
btnHudVoiceDeafen?.addEventListener("click", onToggleDeafen);

voiceManager.on("toast", (msg) => {
  showToast(msg);
});

voiceManager.on("speaking_change", ({ peerId, isSpeaking }) => {
  const card = document.getElementById(`lobby-player-${peerId}`);
  if (card) {
    if (isSpeaking) {
      card.classList.add("is-speaking");
    } else {
      card.classList.remove("is-speaking");
    }
  }
});

initNetwork();

// Check for room / arena query parameter in URL (e.g. ?arena=public, ?battle=1, or ?room=XYZ)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get("room");
const arenaParam = urlParams.get("arena");
const autoBattle = urlParams.get("battle") || urlParams.get("play");

// Immediately sanitize URL so browser back / reload does not loop back into battle
if (arenaParam || autoBattle || roomParam) {
  try {
    window.history.replaceState({ screen: "lobby" }, document.title, window.location.pathname);
  } catch (e) {}
}

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
