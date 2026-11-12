// public/js/network.js
import { LocalGameServer } from "./engine/LocalGameServer.js?v=20261113_04";
import { P2PManager } from "./p2p.js?v=20261113_04";

export class NetworkClient {
  constructor() {
    this.socket = null;
    this.ping = 0;
    this.callbacks = {};
    this.isLocalSolo = false;
    this.mode = "p2p"; // "socket" or "p2p"
    this.localServer = new LocalGameServer(this);
    this.p2p = new P2PManager(this);
  }

  getServerUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const customServer = urlParams.get("server") || localStorage.getItem("brawl_custom_server");
    if (customServer) {
      return customServer.replace(/\/+$/, "");
    }

    // If hosted on GitHub Pages (e.g. *.github.io) or itch.io, connect to Render backend if available
    if (window.location.hostname.includes("github.io") || window.location.hostname.includes("itch.io")) {
      return "https://friends-brawl-game.onrender.com";
    }

    // Default: same origin (when running on localhost:3000 or directly on Render)
    return "";
  }

  getApiUrl(endpoint) {
    const base = this.getServerUrl();
    if (!base) return endpoint;
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${base}${cleanEndpoint}`;
  }

  connect() {
    const urlParams = new URLSearchParams(window.location.search);
    const customServer = urlParams.get("server") || localStorage.getItem("brawl_custom_server");
    const isStaticHost = window.location.hostname.includes("github.io") || window.location.hostname.includes("itch.io") || window.location.protocol === "file:";

    // Always initialize P2P as default/fallback for guaranteed online multiplayer
    this.p2p.init();

    if ((isStaticHost && !customServer) || typeof io === "undefined") {
      console.log("Running in PeerJS P2P multiplayer mode");
      this.mode = "p2p";
      this.trigger("p2p_active");
      return;
    }

    const serverUrl = this.getServerUrl();
    const socketOptions = {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 1,
      timeout: 2500
    };

    console.log("Attempting server connect to:", serverUrl || "(same-origin)");
    try {
      this.socket = serverUrl ? io(serverUrl, socketOptions) : io(socketOptions);

      this.socket.on("connect", () => {
        console.log("Connected to BRAWL ZONE central server:", this.socket.id);
        this.mode = "socket";
        this.startPingLoop();
        this.trigger("connected", this.socket.id);
      });

      this.socket.once("connect_error", () => {
        console.log("Central server unreachable, activating WebRTC P2P Multiplayer");
        try { this.socket.disconnect(); } catch (e) {}
        this.mode = "p2p";
        if (!this.p2p.isHost) {
          this.p2p.init();
        }
        this.trigger("p2p_active");
      });

      this.socket.on("disconnect", () => {
        if (this.mode === "socket") {
          console.log("Disconnected from central server");
          this.trigger("disconnected");
        }
      });

      // Latency / Ping
      this.socket.on("server_pong", (clientTime) => {
        this.ping = Math.round(Date.now() - clientTime);
        this.trigger("ping_update", this.ping);
      });

      // Lobby events
      this.socket.on("lobby_updated", (roomSummary) => {
        if (this.mode === "socket") this.trigger("lobby_updated", roomSummary);
      });

      this.socket.on("game_started", (startData) => {
        if (this.mode === "socket") this.trigger("game_started", startData);
      });

      // Gameplay sync events
      this.socket.on("game_state", (state) => {
        if (this.mode === "socket") this.trigger("game_state", state);
      });

      this.socket.on("weapon_fired", (data) => {
        if (this.mode === "socket") this.trigger("weapon_fired", data);
      });

      this.socket.on("bullet_impact", (data) => {
        if (this.mode === "socket") this.trigger("bullet_impact", data);
      });

      this.socket.on("player_hit", (data) => {
        if (this.mode === "socket") this.trigger("player_hit", data);
      });

      this.socket.on("player_killed", (data) => {
        if (this.mode === "socket") this.trigger("player_killed", data);
      });

      this.socket.on("player_dashed", (data) => {
        if (this.mode === "socket") this.trigger("player_dashed", data);
      });

      this.socket.on("item_collected", (data) => {
        if (this.mode === "socket") this.trigger("item_collected", data);
      });

      this.socket.on("crate_destroyed", (data) => {
        if (this.mode === "socket") this.trigger("crate_destroyed", data);
      });

      this.socket.on("match_ended", (data) => {
        if (this.mode === "socket") this.trigger("match_ended", data);
      });

      this.socket.on("returned_to_lobby", (roomSummary) => {
        if (this.mode === "socket") this.trigger("returned_to_lobby", roomSummary);
      });

      this.socket.on("player_emoted", (data) => {
        if (this.mode === "socket") this.trigger("player_emoted", data);
      });

      this.socket.on("killstreak_achieved", (data) => {
        if (this.mode === "socket") this.trigger("killstreak_achieved", data);
      });

      this.socket.on("super_activated", (data) => {
        if (this.mode === "socket") this.trigger("super_activated", data);
      });

      this.socket.on("tactical_ping", (data) => {
        if (this.mode === "socket") this.trigger("tactical_ping", data);
      });
    } catch (e) {
      console.warn("Socket init failed, fallback P2P:", e);
      this.mode = "p2p";
      this.p2p.init();
      this.trigger("p2p_active");
    }
  }

  startPingLoop() {
    setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit("client_ping", Date.now());
      }
    }, 3000);
  }

  on(event, cb) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  isServerOnline() {
    return true; // Central server or P2P WebRTC is always active
  }

  startSoloMatch(profile, options = {}) {
    this.isLocalSolo = true;
    this.trigger("connected", "local_player_1");
    const result = this.localServer.start(profile, options);
    return result;
  }

  quickPlay(profile, callback) {
    this.isLocalSolo = false;
    this.mode = "p2p";
    this.p2p.quickPlay(profile, callback);
  }

  createRoom(profile, options, callback) {
    this.isLocalSolo = false;
    if (this.mode === "socket" && this.socket && this.socket.connected) {
      this.socket.emit("create_room", { profile, options }, callback);
    } else {
      this.mode = "p2p";
      this.p2p.createRoom(profile, options, callback);
    }
  }

  joinRoom(roomId, profile, callback) {
    this.isLocalSolo = false;
    if (this.mode === "socket" && this.socket && this.socket.connected) {
      this.socket.emit("join_room", { roomId, profile }, callback);
    } else {
      this.mode = "p2p";
      this.p2p.joinRoom(roomId, profile, callback);
    }
  }

  leaveRoom() {
    if (this.isLocalSolo) {
      this.localServer.stop();
      this.isLocalSolo = false;
      return;
    }
    if (this.mode === "p2p") {
      this.p2p.leaveRoom();
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("leave_room");
    }
  }

  toggleReady(isReady) {
    if (this.mode === "p2p") {
      this.p2p.toggleReady(isReady);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("toggle_ready", isReady);
    }
  }

  changeTeam(team) {
    if (this.mode === "p2p") {
      this.p2p.changeTeam(team);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("change_team", team);
    }
  }

  updateRoomOptions(options) {
    if (this.mode === "p2p") {
      this.p2p.updateRoomOptions(options);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("update_room_options", options);
    }
  }

  startGame(callback) {
    if (this.mode === "p2p") {
      this.p2p.startGame(callback);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("start_game", callback);
    }
  }

  addBot(callback) {
    if (this.mode === "p2p") {
      this.p2p.addBot(callback);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("add_bot", callback);
    }
  }

  removeBot(botId, callback) {
    if (this.mode === "p2p") {
      this.p2p.removeBot(botId, callback);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("remove_bot", botId, callback);
    }
  }

  sendEmote(emoji) {
    if (this.isLocalSolo) {
      this.trigger("player_emoted", { id: "local_player_1", emoji });
      return;
    }
    if (this.mode === "p2p") {
      this.p2p.sendEmote(emoji);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("send_emote", emoji);
    }
  }

  sendTacticalPing(pingData) {
    if (this.isLocalSolo) {
      this.trigger("tactical_ping", {
        id: "local_player_1",
        playerName: "You",
        color: "#00f0ff",
        type: pingData.type,
        text: pingData.text,
        icon: pingData.icon,
        x: 1200,
        y: 900
      });
      return;
    }
    if (this.mode === "p2p") {
      this.p2p.sendTacticalPing(pingData);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("send_tactical_ping", pingData);
    }
  }

  returnToLobby() {
    if (this.isLocalSolo) {
      this.localServer.stop();
      this.isLocalSolo = false;
      return;
    }
    if (this.mode === "p2p") {
      this.p2p.leaveRoom();
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("return_to_lobby");
    }
  }

  sendInput(payload) {
    if (this.isLocalSolo) {
      this.localServer.handleInput(payload);
      return;
    }
    if (this.mode === "p2p") {
      this.p2p.sendInput(payload);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("player_input", payload);
    }
  }
}

