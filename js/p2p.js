// public/js/p2p.js
import { GameInstance } from "./engine/GameInstance.js";

export class P2PManager {
  constructor(networkClient) {
    this.networkClient = networkClient;
    this.peer = null;
    this.peerId = null;
    this.isHost = false;
    this.connections = new Map(); // peerId -> conn
    this.room = null;
    this.game = null;
    this.localPlayerId = null;
    this.hostConn = null;
  }

  init() {
    if (typeof Peer === "undefined") {
      console.warn("PeerJS library not loaded");
      return;
    }
    if (this.peer && !this.peer.destroyed) return;

    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" }
          ]
        }
      });

      this.peer.on("open", (id) => {
        this.peerId = id;
        console.log("P2P ready with Peer ID:", id);
      });

      this.peer.on("error", (err) => {
        console.warn("P2P error:", err.type || err);
      });
    } catch (e) {
      console.warn("P2P init exception:", e);
    }
  }

  createRoom(profile, options, callback) {
    this.isHost = true;
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const roomId = `BZ-${randomCode}`;
    this.localPlayerId = `host_${randomCode}`;

    this.room = {
      id: roomId,
      hostId: this.localPlayerId,
      options: {
        gameMode: options.gameMode || "ffa",
        scoreLimit: options.scoreLimit || 15,
        matchDuration: options.matchDuration || 300,
        mapId: options.mapId || "cyber_arena"
      },
      players: [
        {
          id: this.localPlayerId,
          name: profile.name || "Host",
          color: profile.color || "#00f0ff",
          avatar: profile.avatar || "striker",
          team: "blue",
          isHost: true,
          isReady: true,
          isBot: false
        }
      ]
    };

    const targetPeerId = `brawlz-${randomCode.toLowerCase()}`;
    if (this.peer) this.peer.destroy();

    this.peer = new Peer(targetPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    });

    this.peer.on("open", (id) => {
      this.peerId = id;
      console.log("Hosted Room Peer open:", id);

      this.peer.on("connection", (conn) => {
        this.handleGuestConnection(conn);
      });

      this.networkClient.trigger("connected", this.localPlayerId);
      if (callback) callback({ success: true, room: this.room });
    });

    this.peer.on("error", (err) => {
      console.warn("Host peer error:", err);
      if (callback) callback({ success: true, room: this.room });
    });
  }

  handleGuestConnection(conn) {
    conn.on("open", () => {
      console.log("Guest connected:", conn.peer);
      this.connections.set(conn.peer, conn);

      conn.on("data", (data) => {
        this.handleGuestMessage(conn.peer, data);
      });

      conn.on("close", () => {
        this.connections.delete(conn.peer);
        this.handleGuestDisconnect(conn.peer);
      });
    });
  }

  handleGuestMessage(peerId, msg) {
    if (!msg || !msg.type) return;

    if (msg.type === "join_request") {
      const guestPlayerId = `guest_${peerId}`;
      const newPlayer = {
        id: guestPlayerId,
        peerId,
        name: msg.profile.name || "Guest",
        color: msg.profile.color || "#ff007f",
        avatar: msg.profile.avatar || "striker",
        team: this.room.options.gameMode === "team" ? (this.room.players.length % 2 === 0 ? "blue" : "red") : "blue",
        isHost: false,
        isReady: false,
        isBot: false
      };

      this.room.players.push(newPlayer);
      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);

      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        conn.send({ type: "join_accepted", room: this.room, playerId: guestPlayerId });
      }
    } else if (msg.type === "player_input") {
      if (this.game) {
        this.game.handlePlayerInput(`guest_${peerId}`, msg.payload);
      }
    } else if (msg.type === "toggle_ready") {
      const p = this.room?.players.find(x => x.peerId === peerId);
      if (p) {
        p.isReady = Boolean(msg.isReady);
        this.broadcast({ type: "lobby_updated", data: this.room });
        this.networkClient.trigger("lobby_updated", this.room);
      }
    } else if (msg.type === "change_team") {
      const p = this.room?.players.find(x => x.peerId === peerId);
      if (p) {
        p.team = msg.team;
        this.broadcast({ type: "lobby_updated", data: this.room });
        this.networkClient.trigger("lobby_updated", this.room);
      }
    } else if (msg.type === "send_emote") {
      this.broadcast({ type: "player_emoted", data: { id: `guest_${peerId}`, emoji: msg.emoji } });
      this.networkClient.trigger("player_emoted", { id: `guest_${peerId}`, emoji: msg.emoji });
    } else if (msg.type === "send_tactical_ping") {
      this.broadcast({ type: "tactical_ping", data: { id: `guest_${peerId}`, ...msg.pingData } });
      this.networkClient.trigger("tactical_ping", { id: `guest_${peerId}`, ...msg.pingData });
    }
  }

  handleGuestDisconnect(peerId) {
    const idx = this.room?.players.findIndex(x => x.peerId === peerId);
    if (idx !== -1 && this.room) {
      this.room.players.splice(idx, 1);
      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);
      if (this.game) {
        this.game.removePlayer(`guest_${peerId}`);
      }
    }
  }

  joinRoom(roomCode, profile, callback) {
    this.isHost = false;
    const cleanCode = roomCode.replace(/^BZ-/i, "").toLowerCase();
    const targetPeerId = `brawlz-${cleanCode}`;

    if (!this.peer || this.peer.destroyed) {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" }
          ]
        }
      });
    }

    const connectToHost = () => {
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.hostConn = conn;

      conn.on("open", () => {
        console.log("Connected to Host peer:", targetPeerId);
        conn.send({ type: "join_request", profile });
      });

      conn.on("data", (msg) => {
        if (!msg || !msg.type) return;

        if (msg.type === "join_accepted") {
          this.localPlayerId = msg.playerId;
          this.room = msg.room;
          this.networkClient.trigger("connected", this.localPlayerId);
          if (callback) callback({ success: true, room: msg.room, player: { isHost: false } });
        } else if (msg.type === "lobby_updated") {
          this.room = msg.data;
          this.networkClient.trigger("lobby_updated", msg.data);
        } else if (msg.type === "game_started") {
          this.networkClient.trigger("game_started", msg.data);
        } else if (msg.type === "game_state") {
          this.networkClient.trigger("game_state", msg.data);
        } else {
          this.networkClient.trigger(msg.type, msg.data);
        }
      });

      conn.on("error", (err) => {
        console.warn("Connection to host failed:", err);
        if (callback) callback({ success: false, error: "Host not found or room code invalid" });
      });

      conn.on("close", () => {
        this.networkClient.trigger("disconnected");
      });
    };

    if (this.peer.open) {
      connectToHost();
    } else {
      this.peer.on("open", () => connectToHost());
      this.peer.on("error", (err) => {
        if (callback) callback({ success: false, error: "Could not connect to room. Check code." });
      });
    }
  }

  startGame(callback) {
    if (!this.isHost || !this.room) return;

    const mockIO = {
      to: () => ({
        emit: (event, data) => {
          this.networkClient.trigger(event, data);
          this.broadcast({ type: event, data });
        }
      })
    };

    this.game = new GameInstance(this.room.id, this.room.options, mockIO);

    this.room.players.forEach(p => {
      this.game.addPlayer(p.id, {
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        team: p.team,
        isBot: p.isBot
      }, p.isHost);
    });

    this.game.start();

    this.broadcast({
      type: "game_started",
      data: { map: this.game.map, options: this.game.options }
    });

    if (callback) callback({ success: true });
  }

  addBot(callback) {
    if (this.isHost && this.room) {
      const botId = `bot_${Date.now()}`;
      const bot = {
        id: botId,
        name: `🤖 Bot ${this.room.players.length}`,
        color: "#f43f5e",
        avatar: "striker",
        team: this.room.options.gameMode === "team" ? "red" : "blue",
        isHost: false,
        isReady: true,
        isBot: true
      };
      this.room.players.push(bot);
      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);
      if (callback) callback({ success: true, bot });
    }
  }

  removeBot(botId, callback) {
    if (this.isHost && this.room) {
      const idx = this.room.players.findIndex(p => p.isBot);
      if (idx !== -1) {
        this.room.players.splice(idx, 1);
        this.broadcast({ type: "lobby_updated", data: this.room });
        this.networkClient.trigger("lobby_updated", this.room);
      }
      if (callback) callback({ success: true });
    }
  }

  updateRoomOptions(options) {
    if (this.isHost && this.room) {
      this.room.options = { ...this.room.options, ...options };
      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);
    }
  }

  toggleReady(isReady) {
    if (!this.isHost && this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "toggle_ready", isReady });
    }
  }

  changeTeam(team) {
    if (!this.isHost && this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "change_team", team });
    }
  }

  sendInput(payload) {
    if (this.isHost && this.game) {
      this.game.handlePlayerInput(this.localPlayerId, payload);
    } else if (!this.isHost && this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "player_input", payload });
    }
  }

  sendEmote(emoji) {
    if (this.isHost) {
      this.broadcast({ type: "player_emoted", data: { id: this.localPlayerId, emoji } });
      this.networkClient.trigger("player_emoted", { id: this.localPlayerId, emoji });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "send_emote", emoji });
    }
  }

  sendTacticalPing(pingData) {
    if (this.isHost) {
      this.broadcast({ type: "tactical_ping", data: { id: this.localPlayerId, ...pingData } });
      this.networkClient.trigger("tactical_ping", { id: this.localPlayerId, ...pingData });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "send_tactical_ping", pingData });
    }
  }

  broadcast(msg) {
    for (const conn of this.connections.values()) {
      if (conn && conn.open) {
        conn.send(msg);
      }
    }
  }

  leaveRoom() {
    if (this.game) {
      this.game.stop();
      this.game = null;
    }
    this.broadcast({ type: "returned_to_lobby" });
    this.connections.clear();
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.room = null;
    this.isHost = false;
  }
}
