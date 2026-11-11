// public/js/p2p.js
import { GameInstance } from "./engine/GameInstance.js";

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  }
};

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
    this.pingInterval = null;
  }

  init() {
    if (typeof Peer === "undefined") {
      console.warn("PeerJS library not loaded");
      return;
    }
    if (this.peer && !this.peer.destroyed && !this.peer.disconnected) return;

    try {
      this.peer = new Peer(PEER_CONFIG);

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
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let randomCode = "";
    for (let i = 0; i < 4; i++) {
      randomCode += chars[Math.floor(Math.random() * chars.length)];
    }
    const roomId = randomCode;
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
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    this.peer = new Peer(targetPeerId, PEER_CONFIG);

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
      if (err.type === "unavailable-id") {
        // ID clash, retry with a fresh code
        return this.createRoom(profile, options, callback);
      }
      if (callback) callback({ success: false, error: err.type || "Peer creation failed" });
    });
  }

  handleGuestConnection(conn) {
    const setup = () => {
      console.log("Guest connected and open:", conn.peer);
      this.connections.set(conn.peer, conn);

      conn.on("data", (data) => {
        this.handleGuestMessage(conn.peer, data);
      });

      conn.on("close", () => {
        console.log("Guest disconnected:", conn.peer);
        this.connections.delete(conn.peer);
        this.handleGuestDisconnect(conn.peer);
      });

      conn.on("error", (err) => {
        console.warn("Guest conn error:", err);
      });
    };

    if (conn.open) {
      setup();
    } else {
      conn.on("open", setup);
    }
  }

  handleGuestMessage(peerId, msg) {
    if (!msg || !msg.type) return;

    if (msg.type === "join_request") {
      const guestPlayerId = `guest_${peerId}`;
      const existing = this.room?.players.find(p => p.id === guestPlayerId);
      if (!existing && this.room) {
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
      }

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
    } else if (msg.type === "p2p_ping") {
      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        conn.send({ type: "p2p_pong", t: msg.t });
      }
    } else if (msg.type === "toggle_ready") {
      const p = this.room?.players.find(x => x.peerId === peerId || x.id === `guest_${peerId}`);
      if (p) {
        p.isReady = Boolean(msg.isReady);
        this.broadcast({ type: "lobby_updated", data: this.room });
        this.networkClient.trigger("lobby_updated", this.room);
      }
    } else if (msg.type === "change_team") {
      const p = this.room?.players.find(x => x.peerId === peerId || x.id === `guest_${peerId}`);
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
    const idx = this.room?.players.findIndex(x => x.peerId === peerId || x.id === `guest_${peerId}`);
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
    const cleanCode = (roomCode || "")
      .toUpperCase()
      .replace(/^BZ[-_ ]?/i, "")
      .replace(/[^A-Z0-9]/g, "")
      .trim()
      .toLowerCase();

    if (!cleanCode) {
      if (callback) callback({ success: false, error: "Please enter a valid room code" });
      return;
    }

    const targetPeerId = `brawlz-${cleanCode}`;

    if (!this.peer || this.peer.destroyed || this.peer.disconnected) {
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      this.peer = new Peer(PEER_CONFIG);
    }

    let hasResponded = false;
    const connectTimeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        if (callback) callback({ success: false, error: "Could not find host. Check the room code!" });
      }
    }, 8000);

    const connectToHost = () => {
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.hostConn = conn;

      const onConnOpen = () => {
        console.log("Connected to Host peer:", targetPeerId);
        conn.send({ type: "join_request", profile });
        this.startPingLoop();
      };

      if (conn.open) {
        onConnOpen();
      } else {
        conn.on("open", onConnOpen);
      }

      conn.on("data", (msg) => {
        if (!msg || !msg.type) return;

        if (msg.type === "join_accepted") {
          clearTimeout(connectTimeout);
          hasResponded = true;
          this.localPlayerId = msg.playerId;
          this.room = msg.room;
          this.networkClient.trigger("connected", this.localPlayerId);
          if (callback) callback({ success: true, room: msg.room, player: { isHost: false } });
        } else if (msg.type === "lobby_updated") {
          this.room = msg.data;
          this.networkClient.trigger("lobby_updated", msg.data);
        } else if (msg.type === "game_started") {
          console.log("P2P guest received game_started:", msg.data);
          this.networkClient.trigger("game_started", msg.data);
        } else if (msg.type === "game_state") {
          this.networkClient.trigger("game_state", msg.data);
        } else if (msg.type === "p2p_pong") {
          const rtt = Date.now() - msg.t;
          this.networkClient.ping = Math.round(rtt / 2);
          this.networkClient.trigger("ping_update", this.networkClient.ping);
        } else {
          this.networkClient.trigger(msg.type, msg.data);
        }
      });

      conn.on("error", (err) => {
        console.warn("Connection to host error:", err);
        clearTimeout(connectTimeout);
        if (!hasResponded) {
          hasResponded = true;
          if (callback) callback({ success: false, error: "Host not found or room code invalid" });
        }
      });

      conn.on("close", () => {
        console.log("Host connection closed");
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.networkClient.trigger("disconnected");
      });
    };

    if (this.peer.open) {
      connectToHost();
    } else {
      this.peer.on("open", () => connectToHost());
      this.peer.on("error", (err) => {
        clearTimeout(connectTimeout);
        if (!hasResponded) {
          hasResponded = true;
          if (callback) callback({ success: false, error: "Could not connect to room server." });
        }
      });
    }
  }

  startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send({ type: "p2p_ping", t: Date.now() });
      }
    }, 2500);
  }

  startGame(callback) {
    if (!this.isHost || !this.room) return;

    let lastStateSync = 0;
    const mockIO = {
      to: () => ({
        emit: (event, data) => {
          this.networkClient.trigger(event, data);

          if (event === "game_state") {
            const now = Date.now();
            if (now - lastStateSync >= 50) { // 20 Hz sync for WebRTC peers
              lastStateSync = now;
              this.broadcastCompactState(data);
            }
          } else {
            this.broadcast({ type: event, data });
          }
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

  broadcastCompactState(worldState) {
    if (!worldState) return;

    const players = worldState.players?.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      team: p.team,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      angle: Math.round(p.angle * 100) / 100,
      health: p.health,
      maxHealth: p.maxHealth,
      shield: p.shield,
      maxShield: p.maxShield,
      isAlive: p.isAlive,
      isDashing: p.isDashing,
      currentWeapon: p.currentWeapon,
      ammo: p.ammo,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      superCharge: Math.round(p.superCharge || 0),
      isInvisible: p.isInvisible,
      inBush: p.inBush,
      speedBoost: p.speedBoost
    }));

    const bullets = worldState.bullets?.map(b => ({
      id: b.id,
      x: Math.round(b.x),
      y: Math.round(b.y),
      radius: b.radius,
      color: b.color,
      type: b.type
    }));

    const crates = worldState.crates?.map(c => ({
      id: c.id,
      hp: c.hp,
      maxHp: c.maxHp,
      x: c.x,
      y: c.y,
      size: c.size
    }));

    this.broadcast({
      type: "game_state",
      data: {
        t: worldState.t,
        timeRemaining: worldState.timeRemaining,
        teamScores: worldState.teamScores,
        players,
        bullets,
        items: worldState.items,
        crates
      }
    });
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
      if (this.hostConn.dataChannel && this.hostConn.dataChannel.bufferedAmount > 16384) {
        return;
      }
      try {
        this.hostConn.send({ type: "player_input", payload });
      } catch (e) {
        console.warn("sendInput failed:", e);
      }
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
    for (const [peerId, conn] of this.connections.entries()) {
      if (conn && conn.open) {
        if (conn.dataChannel && conn.dataChannel.bufferedAmount > 32768) {
          continue;
        }
        try {
          conn.send(msg);
        } catch (e) {
          console.warn("Broadcast send error to:", peerId, e);
        }
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.room = null;
    this.isHost = false;
  }
}
