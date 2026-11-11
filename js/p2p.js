// public/js/p2p.js
import { GameInstance } from "./engine/GameInstance.js";

// High-reliability global STUN servers for WebRTC NAT hole punching
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.cloudflare.com:3478" }
];

// Clean 4-character alphabet avoiding ambiguous glyphs (no 0/O, 1/I)
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

function sanitizeRoomCode(raw) {
  if (!raw) return "";
  return raw
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^BZ/, "")
    .toLowerCase();
}

export class P2PManager {
  constructor(networkClient) {
    this.networkClient = networkClient;
    this.peer = null;
    this.peerId = null;
    this.isHost = false;
    this.connections = new Map(); // peerId -> DataConnection
    this.room = null;
    this.game = null;
    this.localPlayerId = null;
    this.hostConn = null;
    this.isInitialized = false;
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
        config: { iceServers: ICE_SERVERS }
      });

      this.peer.on("open", (id) => {
        this.peerId = id;
        this.isInitialized = true;
        console.log("P2P ready with Peer ID:", id);
      });

      this.peer.on("error", (err) => {
        console.warn("P2P peer error:", err.type || err);
      });
    } catch (e) {
      console.warn("P2P init exception:", e);
    }
  }

  createRoom(profile, options, callback) {
    this.isHost = true;
    const code = generateRoomCode();
    const roomId = `BZ-${code}`;
    this.localPlayerId = `host_${code.toLowerCase()}`;

    this.room = {
      id: roomId,
      hostId: this.localPlayerId,
      options: {
        gameMode: options?.gameMode || "ffa",
        scoreLimit: options?.scoreLimit || 15,
        matchDuration: options?.matchDuration || 300,
        mapId: options?.mapId || "cyber_arena"
      },
      players: [
        {
          id: this.localPlayerId,
          name: profile?.name || "Host",
          color: profile?.color || "#00f0ff",
          avatar: profile?.avatar || "striker",
          team: "blue",
          isHost: true,
          isReady: true,
          isBot: false
        }
      ]
    };

    const targetPeerId = `brawlz-${code.toLowerCase()}`;
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    try {
      this.peer = new Peer(targetPeerId, {
        debug: 1,
        config: { iceServers: ICE_SERVERS }
      });

      let opened = false;

      this.peer.on("open", (id) => {
        opened = true;
        this.peerId = id;
        console.log("Hosted Room Peer open:", id);
        this.networkClient.trigger("connected", this.localPlayerId);
        if (callback) callback({ success: true, room: this.room });
      });

      this.peer.on("connection", (conn) => {
        this.handleGuestConnection(conn);
      });

      this.peer.on("error", (err) => {
        console.warn("Host peer error:", err);
        if (!opened && (err.type === "unavailable-id" || err.type === "socket-error")) {
          // Retry with new clean code
          return this.createRoom(profile, options, callback);
        }
        if (!opened && callback) {
          callback({ success: false, error: err.message || "Failed to initialize room host." });
        }
      });
    } catch (err) {
      console.error("Failed creating host peer:", err);
      if (callback) callback({ success: false, error: err.message });
    }
  }

  handleGuestConnection(conn) {
    console.log("Incoming connection from guest peer:", conn.peer);

    const setupGuest = () => {
      console.log("Guest data channel connected:", conn.peer);
      this.connections.set(conn.peer, conn);
    };

    if (conn.open) {
      setupGuest();
    } else {
      conn.on("open", setupGuest);
    }

    conn.on("data", (data) => {
      this.handleGuestMessage(conn.peer, data);
    });

    conn.on("close", () => {
      console.log("Guest peer closed:", conn.peer);
      this.connections.delete(conn.peer);
      this.handleGuestDisconnect(conn.peer);
    });

    conn.on("error", (err) => {
      console.warn("Guest connection error:", err);
      this.connections.delete(conn.peer);
      this.handleGuestDisconnect(conn.peer);
    });
  }

  handleGuestMessage(peerId, msg) {
    if (!msg || !msg.type || !this.room) return;

    if (msg.type === "join_request") {
      const guestPlayerId = `guest_${peerId}`;
      let player = this.room.players.find(p => p.id === guestPlayerId);

      if (!player) {
        const team = this.room.options.gameMode === "team"
          ? (this.room.players.length % 2 === 0 ? "blue" : "red")
          : "blue";

        player = {
          id: guestPlayerId,
          peerId,
          name: msg.profile?.name || `Friend ${this.room.players.length + 1}`,
          color: msg.profile?.color || "#ff007f",
          avatar: msg.profile?.avatar || "striker",
          team,
          isHost: false,
          isReady: false,
          isBot: false
        };
        this.room.players.push(player);
      }

      // Ensure connection is registered
      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        conn.send({ type: "join_accepted", room: this.room, playerId: guestPlayerId });
      }

      // Sync updated lobby with all connected friends and host
      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);

      // If a match is already actively running, seamlessly add guest into it
      if (this.game && this.game.state === "playing") {
        this.game.addPlayer(guestPlayerId, {
          name: player.name,
          color: player.color,
          avatar: player.avatar,
          team: player.team
        });
        if (conn && conn.open) {
          conn.send({
            type: "game_started",
            data: { map: this.game.map, options: this.game.options }
          });
        }
      }
    } else if (msg.type === "player_input") {
      if (this.game) {
        this.game.handlePlayerInput(`guest_${peerId}`, msg.payload);
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
      const p = this.room?.players.find(x => x.peerId === peerId || x.id === `guest_${peerId}`);
      const senderId = p ? p.id : `guest_${peerId}`;
      this.broadcast({ type: "player_emoted", data: { playerId: senderId, emoji: msg.emoji } });
      this.networkClient.trigger("player_emoted", { playerId: senderId, emoji: msg.emoji });
    } else if (msg.type === "send_tactical_ping") {
      const p = this.room?.players.find(x => x.peerId === peerId || x.id === `guest_${peerId}`);
      const senderId = p ? p.id : `guest_${peerId}`;
      this.broadcast({ type: "tactical_ping", data: { playerId: senderId, ...msg.pingData } });
      this.networkClient.trigger("tactical_ping", { playerId: senderId, ...msg.pingData });
    }
  }

  handleGuestDisconnect(peerId) {
    if (!this.room) return;
    const idx = this.room.players.findIndex(x => x.peerId === peerId || x.id === `guest_${peerId}`);
    if (idx !== -1) {
      const removed = this.room.players.splice(idx, 1)[0];
      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);
      if (this.game && removed) {
        this.game.removePlayer(removed.id);
      }
    }
  }

  joinRoom(roomCode, profile, callback) {
    this.isHost = false;
    const cleanCode = sanitizeRoomCode(roomCode);
    if (!cleanCode) {
      if (callback) callback({ success: false, error: "Please enter a valid Room Code." });
      return;
    }

    const targetPeerId = `brawlz-${cleanCode}`;

    let handled = false;
    const finish = (result) => {
      if (!handled) {
        handled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (callback) callback(result);
      }
    };

    // 9 second timeout for clear user feedback
    const timeoutId = setTimeout(() => {
      finish({
        success: false,
        error: `Room "${roomCode}" not found or Host is offline. Check room code!`
      });
    }, 9000);

    if (!this.peer || this.peer.destroyed) {
      this.peer = new Peer({
        debug: 1,
        config: { iceServers: ICE_SERVERS }
      });
    }

    const connectToHost = () => {
      console.log("Connecting to Host peer:", targetPeerId);
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.hostConn = conn;

      const sendJoinRequest = () => {
        console.log("Data connection open to Host, sending join_request...");
        conn.send({ type: "join_request", profile });
      };

      if (conn.open) {
        sendJoinRequest();
      } else {
        conn.on("open", sendJoinRequest);
      }

      conn.on("data", (msg) => {
        if (!msg || !msg.type) return;

        if (msg.type === "join_accepted") {
          console.log("Joined room successfully!", msg);
          this.localPlayerId = msg.playerId;
          this.room = msg.room;
          finish({ success: true, room: msg.room, player: { isHost: false } });
          this.networkClient.trigger("lobby_updated", msg.room);
        } else if (msg.type === "lobby_updated") {
          this.room = msg.data;
          this.networkClient.trigger("lobby_updated", msg.data);
        } else if (msg.type === "game_started") {
          this.networkClient.trigger("game_started", msg.data);
        } else if (msg.type === "game_state") {
          this.networkClient.trigger("game_state", msg.data);
        } else if (msg.type === "returned_to_lobby") {
          this.networkClient.trigger("returned_to_lobby", msg.data || this.room);
        } else {
          this.networkClient.trigger(msg.type, msg.data);
        }
      });

      conn.on("close", () => {
        console.log("Connection to host closed");
        this.networkClient.trigger("disconnected");
      });

      conn.on("error", (err) => {
        console.warn("Connection to host error:", err);
        finish({ success: false, error: "Could not connect to Host." });
      });
    };

    const onPeerError = (err) => {
      if (err.type === "peer-unavailable") {
        finish({
          success: false,
          error: `Room "${roomCode.toUpperCase()}" does not exist. Verify the 4-letter code!`
        });
      }
    };
    this.peer.once("error", onPeerError);

    if (this.peer.open) {
      connectToHost();
    } else {
      this.peer.once("open", () => connectToHost());
    }
  }

  startGame(callback) {
    if (!this.isHost || !this.room) return;

    if (this.game) {
      this.game.stop();
      this.game = null;
    }

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
      if (p.isBot) {
        this.game.addBot(p.team);
      } else {
        this.game.addPlayer(p.id, {
          name: p.name,
          color: p.color,
          avatar: p.avatar,
          team: p.team
        });
      }
    });

    this.game.start();

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
      this.broadcast({ type: "player_emoted", data: { playerId: this.localPlayerId, emoji } });
      this.networkClient.trigger("player_emoted", { playerId: this.localPlayerId, emoji });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "send_emote", emoji });
    }
  }

  sendTacticalPing(pingData) {
    if (this.isHost) {
      this.broadcast({ type: "tactical_ping", data: { playerId: this.localPlayerId, ...pingData } });
      this.networkClient.trigger("tactical_ping", { playerId: this.localPlayerId, ...pingData });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: "send_tactical_ping", pingData });
    }
  }

  broadcast(msg) {
    for (const [peerId, conn] of this.connections.entries()) {
      if (conn && conn.open) {
        try {
          // Flow control: drop stale high-frequency game_state frames if data channel is congested
          if (msg.type === "game_state" && conn.dataChannel && conn.dataChannel.bufferedAmount > 65536) {
            continue;
          }
          conn.send(msg);
        } catch (e) {
          console.warn("Failed sending to peer:", peerId, e);
        }
      }
    }
  }

  returnToLobby() {
    if (this.game) {
      this.game.stop();
      this.game = null;
    }
    if (this.isHost && this.room) {
      this.broadcast({ type: "returned_to_lobby", data: this.room });
      this.networkClient.trigger("returned_to_lobby", this.room);
    }
  }

  leaveRoom() {
    if (this.game) {
      this.game.stop();
      this.game = null;
    }
    if (this.isHost) {
      this.broadcast({ type: "returned_to_lobby" });
      this.connections.clear();
    }
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.room = null;
    this.isHost = false;
  }
}
