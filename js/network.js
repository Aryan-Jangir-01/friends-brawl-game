// public/js/network.js
import { LocalGameServer } from "./engine/LocalGameServer.js";

export class NetworkClient {
  constructor() {
    this.socket = null;
    this.ping = 0;
    this.callbacks = {};
    this.isLocalSolo = false;
    this.localServer = new LocalGameServer(this);
  }

  getServerUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const customServer = urlParams.get("server") || localStorage.getItem("brawl_custom_server");
    if (customServer) {
      return customServer.replace(/\/+$/, "");
    }

    // If hosted on GitHub Pages (e.g. *.github.io) or itch.io, connect to Render backend
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
    const serverUrl = this.getServerUrl();
    const socketOptions = {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000
    };

    console.log("Connecting to server target:", serverUrl || "(same-origin)");
    this.socket = serverUrl ? io(serverUrl, socketOptions) : io(socketOptions);

    this.socket.on("connect", () => {
      console.log("Connected to BRAWL ZONE server:", this.socket.id);
      this.startPingLoop();
      this.trigger("connected", this.socket.id);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("Server connection error:", err.message);
      this.trigger("connect_error", err);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.trigger("disconnected");
    });

    // Latency / Ping
    this.socket.on("server_pong", (clientTime) => {
      this.ping = Math.round(Date.now() - clientTime);
      this.trigger("ping_update", this.ping);
    });

    // Lobby events
    this.socket.on("lobby_updated", (roomSummary) => {
      this.trigger("lobby_updated", roomSummary);
    });

    this.socket.on("game_started", (startData) => {
      this.trigger("game_started", startData);
    });

    // Gameplay sync events
    this.socket.on("game_state", (state) => {
      this.trigger("game_state", state);
    });

    this.socket.on("weapon_fired", (data) => {
      this.trigger("weapon_fired", data);
    });

    this.socket.on("bullet_impact", (data) => {
      this.trigger("bullet_impact", data);
    });

    this.socket.on("player_hit", (data) => {
      this.trigger("player_hit", data);
    });

    this.socket.on("player_killed", (data) => {
      this.trigger("player_killed", data);
    });

    this.socket.on("player_dashed", (data) => {
      this.trigger("player_dashed", data);
    });

    this.socket.on("item_collected", (data) => {
      this.trigger("item_collected", data);
    });

    this.socket.on("crate_destroyed", (data) => {
      this.trigger("crate_destroyed", data);
    });

    this.socket.on("match_ended", (data) => {
      this.trigger("match_ended", data);
    });

    this.socket.on("returned_to_lobby", (roomSummary) => {
      this.trigger("returned_to_lobby", roomSummary);
    });

    this.socket.on("player_emoted", (data) => {
      this.trigger("player_emoted", data);
    });

    this.socket.on("killstreak_achieved", (data) => {
      this.trigger("killstreak_achieved", data);
    });

    this.socket.on("super_activated", (data) => {
      this.trigger("super_activated", data);
    });

    this.socket.on("tactical_ping", (data) => {
      this.trigger("tactical_ping", data);
    });
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
    return Boolean(this.socket && this.socket.connected);
  }

  startSoloMatch(profile, options = {}) {
    this.isLocalSolo = true;
    const result = this.localServer.start(profile, options);
    this.trigger("connected", result.localPlayerId);
    return result;
  }

  createRoom(profile, options, callback) {
    if (!this.isServerOnline()) {
      if (callback) callback({ success: false, error: "Server offline" });
      return;
    }
    this.socket.emit("create_room", { profile, options }, callback);
  }

  joinRoom(roomId, profile, callback) {
    if (!this.isServerOnline()) {
      if (callback) callback({ success: false, error: "Server offline" });
      return;
    }
    this.socket.emit("join_room", { roomId, profile }, callback);
  }

  leaveRoom() {
    if (this.isLocalSolo) {
      this.localServer.stop();
      this.isLocalSolo = false;
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("leave_room");
    }
  }

  toggleReady(isReady) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("toggle_ready", isReady);
    }
  }

  changeTeam(team) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("change_team", team);
    }
  }

  updateRoomOptions(options) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("update_room_options", options);
    }
  }

  startGame(callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("start_game", callback);
    }
  }

  addBot(callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("add_bot", callback);
    }
  }

  removeBot(botId, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("remove_bot", botId, callback);
    }
  }

  sendEmote(emoji) {
    if (this.isLocalSolo) {
      this.trigger("player_emoted", { id: "local_player_1", emoji });
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
    if (this.socket && this.socket.connected) {
      this.socket.emit("return_to_lobby");
    }
  }

  sendInput(payload) {
    if (this.isLocalSolo) {
      this.localServer.handleInput(payload);
      return;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("player_input", payload);
    }
  }
}

