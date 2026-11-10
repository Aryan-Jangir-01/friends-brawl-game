// public/js/network.js

export class NetworkClient {
  constructor() {
    this.socket = null;
    this.ping = 0;
    this.callbacks = {};
  }

  connect() {
    this.socket = io({
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5
    });

    this.socket.on("connect", () => {
      console.log("Connected to BRAWL ZONE server:", this.socket.id);
      this.startPingLoop();
      this.trigger("connected", this.socket.id);
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

  createRoom(profile, options, callback) {
    this.socket.emit("create_room", { profile, options }, callback);
  }

  joinRoom(roomId, profile, callback) {
    this.socket.emit("join_room", { roomId, profile }, callback);
  }

  leaveRoom() {
    this.socket.emit("leave_room");
  }

  toggleReady(isReady) {
    this.socket.emit("toggle_ready", isReady);
  }

  changeTeam(team) {
    this.socket.emit("change_team", team);
  }

  updateRoomOptions(options) {
    this.socket.emit("update_room_options", options);
  }

  startGame(callback) {
    this.socket.emit("start_game", callback);
  }

  addBot(callback) {
    this.socket.emit("add_bot", callback);
  }

  removeBot(botId, callback) {
    this.socket.emit("remove_bot", botId, callback);
  }

  sendEmote(emoji) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("send_emote", emoji);
    }
  }

  returnToLobby() {
    this.socket.emit("return_to_lobby");
  }

  sendInput(payload) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("player_input", payload);
    }
  }
}

