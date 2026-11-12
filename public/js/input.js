// public/js/input.js
import { audio } from "./audio.js?v=20261113_03";

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.moveX = 0;
    this.moveY = 0;
    this.aimAngle = 0;
    this.isShooting = false;
    this.dashRequested = false;
    this.superRequested = false;
    this.switchWeaponRequested = null;

    this.isTouchDevice = false;

    // Joysticks State
    this.leftTouchId = null;
    this.leftCenter = { x: 0, y: 0 };
    this.leftPos = { x: 0, y: 0 };
    this.maxJoystickRadius = 50;

    this.rightTouchId = null;
    this.rightCenter = { x: 0, y: 0 };
    this.rightPos = { x: 0, y: 0 };

    // Keyboard state
    this.keys = {};
    this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.isMouseDown = false;

    // DOM Elements
    this.moveRing = document.getElementById("move-joystick");
    this.moveKnob = document.getElementById("move-joystick-knob");
    this.aimRing = document.getElementById("aim-joystick");
    this.aimKnob = document.getElementById("aim-joystick-knob");
    this.touchZoneLeft = document.getElementById("touch-zone-left");
    this.touchZoneRight = document.getElementById("touch-zone-right");
    this.btnDash = document.getElementById("btn-dash");
    this.btnSuper = document.getElementById("btn-super");
    this.btnSwitchWeapon = document.getElementById("btn-switch-weapon");
    this.dashOverlay = document.getElementById("dash-cooldown-overlay");

    // Dash cooldown visual
    this.lastDashTime = 0;
    this.dashCooldownMs = 2500;

    this.initListeners();
  }

  initListeners() {
    // 1. Touch Events on Touch Zones
    if (this.touchZoneLeft) {
      this.touchZoneLeft.addEventListener("touchstart", (e) => this.handleLeftTouchStart(e), { passive: false });
      this.touchZoneLeft.addEventListener("touchmove", (e) => this.handleLeftTouchMove(e), { passive: false });
      this.touchZoneLeft.addEventListener("touchend", (e) => this.handleLeftTouchEnd(e), { passive: false });
      this.touchZoneLeft.addEventListener("touchcancel", (e) => this.handleLeftTouchEnd(e), { passive: false });
    }

    if (this.touchZoneRight) {
      this.touchZoneRight.addEventListener("touchstart", (e) => this.handleRightTouchStart(e), { passive: false });
      this.touchZoneRight.addEventListener("touchmove", (e) => this.handleRightTouchMove(e), { passive: false });
      this.touchZoneRight.addEventListener("touchend", (e) => this.handleRightTouchEnd(e), { passive: false });
      this.touchZoneRight.addEventListener("touchcancel", (e) => this.handleRightTouchEnd(e), { passive: false });
    }

    // 2. Action Buttons
    if (this.btnDash) {
      this.btnDash.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerDash();
      }, { passive: false });
      this.btnDash.addEventListener("click", (e) => {
        this.triggerDash();
      });
    }

    if (this.btnSuper) {
      this.btnSuper.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerSuper();
      }, { passive: false });
      this.btnSuper.addEventListener("click", () => {
        this.triggerSuper();
      });
    }

    if (this.btnSwitchWeapon) {
      this.btnSwitchWeapon.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cycleWeapon();
      }, { passive: false });
      this.btnSwitchWeapon.addEventListener("click", () => {
        this.cycleWeapon();
      });
    }

    // 3. Desktop Keyboard & Mouse
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
        this.triggerDash();
      }
      if (e.code === "KeyR" || e.code === "KeyF") {
        e.preventDefault();
        this.triggerSuper();
      }
      if (e.code === "KeyQ" || e.code === "KeyE") {
        this.cycleWeapon();
      }
      if (e.code === "Digit1") this.switchWeaponRequested = "blaster";
      if (e.code === "Digit2") this.switchWeaponRequested = "shotgun";
      if (e.code === "Digit3") this.switchWeaponRequested = "plasma";
      if (e.code === "Digit4") this.switchWeaponRequested = "rocket";
      if (e.code === "Digit5") this.switchWeaponRequested = "railgun";
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener("mousemove", (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    window.addEventListener("mousedown", (e) => {
      // Don't trigger shooting if clicking HUD or buttons
      if (e.target.closest("button") || e.target.closest(".hud-top-bar") || e.target.closest(".hud-bottom-bar")) return;
      this.isMouseDown = true;
      audio.unlock();
    });

    window.addEventListener("mouseup", () => {
      this.isMouseDown = false;
    });
  }

  handleLeftTouchStart(e) {
    e.preventDefault();
    this.isTouchDevice = true;
    audio.unlock();

    for (const touch of e.changedTouches) {
      if (this.leftTouchId === null) {
        this.leftTouchId = touch.identifier;
        const rect = this.canvas.getBoundingClientRect();
        this.leftCenter = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        this.leftPos = { ...this.leftCenter };

        this.moveRing.style.left = `${this.leftCenter.x}px`;
        this.moveRing.style.top = `${this.leftCenter.y}px`;
        this.moveKnob.style.transform = `translate(-50%, -50%)`;
        this.moveRing.classList.remove("hidden");
        break;
      }
    }
  }

  handleLeftTouchMove(e) {
    e.preventDefault();
    if (this.leftTouchId === null) return;

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.leftTouchId) {
        const rect = this.canvas.getBoundingClientRect();
        const curX = touch.clientX - rect.left;
        const curY = touch.clientY - rect.top;

        let dx = curX - this.leftCenter.x;
        let dy = curY - this.leftCenter.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.maxJoystickRadius) {
          dx = (dx / dist) * this.maxJoystickRadius;
          dy = (dy / dist) * this.maxJoystickRadius;
        }

        this.moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        this.moveX = dx / this.maxJoystickRadius;
        this.moveY = dy / this.maxJoystickRadius;
        break;
      }
    }
  }

  handleLeftTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.leftTouchId) {
        this.leftTouchId = null;
        this.moveX = 0;
        this.moveY = 0;
        this.moveRing.classList.add("hidden");
        break;
      }
    }
  }

  handleRightTouchStart(e) {
    e.preventDefault();
    this.isTouchDevice = true;
    audio.unlock();

    for (const touch of e.changedTouches) {
      if (this.rightTouchId === null) {
        this.rightTouchId = touch.identifier;
        const rect = this.canvas.getBoundingClientRect();
        this.rightCenter = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        this.rightPos = { ...this.rightCenter };

        this.aimRing.style.left = `${this.rightCenter.x}px`;
        this.aimRing.style.top = `${this.rightCenter.y}px`;
        this.aimKnob.style.transform = `translate(-50%, -50%)`;
        this.aimRing.classList.remove("hidden");
        this.isShooting = true;
        break;
      }
    }
  }

  handleRightTouchMove(e) {
    e.preventDefault();
    if (this.rightTouchId === null) return;

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.rightTouchId) {
        const rect = this.canvas.getBoundingClientRect();
        const curX = touch.clientX - rect.left;
        const curY = touch.clientY - rect.top;

        let dx = curX - this.rightCenter.x;
        let dy = curY - this.rightCenter.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          this.aimAngle = Math.atan2(dy, dx);
          this.isShooting = true;
        }

        if (dist > this.maxJoystickRadius) {
          dx = (dx / dist) * this.maxJoystickRadius;
          dy = (dy / dist) * this.maxJoystickRadius;
        }

        this.aimKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        break;
      }
    }
  }

  handleRightTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.rightTouchId) {
        this.rightTouchId = null;
        this.isShooting = false;
        this.aimRing.classList.add("hidden");
        break;
      }
    }
  }

  triggerDash() {
    const now = Date.now();
    if (now - this.lastDashTime >= this.dashCooldownMs) {
      this.lastDashTime = now;
      this.dashRequested = true;
      audio.playDash();

      // Animate cooldown radial overlay
      if (this.dashOverlay) {
        this.dashOverlay.style.transform = "scaleY(1)";
        const startTime = Date.now();
        const animateCooldown = () => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, 1 - elapsed / this.dashCooldownMs);
          this.dashOverlay.style.transform = `scaleY(${remaining})`;
          if (remaining > 0) {
            requestAnimationFrame(animateCooldown);
          }
        };
        requestAnimationFrame(animateCooldown);
      }
    }
  }

  triggerSuper() {
    this.superRequested = true;
    audio.unlock();
    if (navigator.vibrate) {
      navigator.vibrate([40, 20, 40]);
    }
  }

  cycleWeapon() {
    // Tell server to switch to next available weapon
    const weaponOrder = ["blaster", "shotgun", "plasma", "rocket", "railgun"];
    const current = window.__currentLocalWeapon || "blaster";
    const available = window.__localAvailableWeapons || ["blaster", "shotgun"];

    const idx = weaponOrder.indexOf(current);
    for (let i = 1; i < weaponOrder.length; i++) {
      const nextW = weaponOrder[(idx + i) % weaponOrder.length];
      if (available.includes(nextW)) {
        this.switchWeaponRequested = nextW;
        break;
      }
    }
  }

  getPayload(playerScreenCenter) {
    // If on desktop (no touch active), calculate from keys and mouse
    if (!this.isTouchDevice && this.leftTouchId === null && this.rightTouchId === null) {
      let mx = 0;
      let my = 0;
      if (this.keys["KeyW"] || this.keys["ArrowUp"]) my -= 1;
      if (this.keys["KeyS"] || this.keys["ArrowDown"]) my += 1;
      if (this.keys["KeyA"] || this.keys["ArrowLeft"]) mx -= 1;
      if (this.keys["KeyD"] || this.keys["ArrowRight"]) mx += 1;

      const mag = Math.hypot(mx, my);
      this.moveX = mag > 0 ? mx / mag : 0;
      this.moveY = mag > 0 ? my / mag : 0;

      if (playerScreenCenter) {
        const dx = this.mousePos.x - playerScreenCenter.x;
        const dy = this.mousePos.y - playerScreenCenter.y;
        this.aimAngle = Math.atan2(dy, dx);
      }
      this.isShooting = this.isMouseDown;
    }

    const payload = {
      moveX: Math.round(this.moveX * 100) / 100,
      moveY: Math.round(this.moveY * 100) / 100,
      aimAngle: Math.round(this.aimAngle * 100) / 100,
      isShooting: this.isShooting,
      dashRequested: this.dashRequested,
      superRequested: this.superRequested,
      switchWeapon: this.switchWeaponRequested
    };

    // Reset single-frame requests
    this.dashRequested = false;
    this.superRequested = false;
    this.switchWeaponRequested = null;

    return payload;
  }
}

