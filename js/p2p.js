// public/js/p2p.js
import { GameInstance } from "./engine/GameInstance.js?v=20261113_05";

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:openrelay.metered.ca:80" },
      {
        urls: [
          "turn:eu-0.turn.peerjs.com:3478",
          "turn:us-0.turn.peerjs.com:3478"
        ],
        username: "peerjs",
        credential: "peerjsp"
      },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp"
        ],
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ],
    iceCandidatePoolSize: 10
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
    this.watchdogInterval = null;
    this._visibilityBound = false;
  }

  setupSignalingWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = setInterval(() => {
      if (this.peer && !this.peer.destroyed) {
        if (this.peer.disconnected) {
          console.log("[P2P] Signaling socket disconnected. Auto-reconnecting...");
          try {
            this.peer.reconnect();
            this.networkClient.trigger("signaling_status", { connected: false, reconnecting: true });
          } catch (e) {
            console.warn("[P2P] reconnect error:", e);
          }
        }
      }
    }, 4500);

    // Watch for document visibility changes (e.g. user switched apps and returned)
    if (typeof document !== "undefined" && !this._visibilityBound) {
      this._visibilityBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          console.log("[P2P] Document became visible. Checking signaling connection...");
          if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
            try { this.peer.reconnect(); } catch (e) {}
          }
        }
      });
      window.addEventListener("focus", () => {
        if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
          try { this.peer.reconnect(); } catch (e) {}
        }
      });
    }
  }

  init() {
    if (typeof Peer === "undefined") {
      console.warn("PeerJS library not loaded");
      return;
    }
    // Never re-init if this peer is actively hosting a room
    if (this.isHost && this.room && this.peer && !this.peer.destroyed) {
      return;
    }
    if (this.peer && !this.peer.destroyed && !this.peer.disconnected) return;

    try {
      this.peer = new Peer(PEER_CONFIG);

      this.peer.on("open", (id) => {
        this.peerId = id;
        console.log("[P2P] Ready with Peer ID:", id);
        this.networkClient.trigger("signaling_status", { connected: true, reconnecting: false });
      });

      this.peer.on("disconnected", () => {
        console.log("[P2P] Peer signaling disconnected, auto-reconnecting...");
        this.networkClient.trigger("signaling_status", { connected: false, reconnecting: true });
        try { this.peer.reconnect(); } catch (e) {}
      });

      this.peer.on("error", (err) => {
        console.warn("[P2P] Peer warning/error:", err.type || err);
        if (err.type === "disconnected" || err.type === "network") {
          try { this.peer.reconnect(); } catch (e) {}
        }
      });

      this.setupSignalingWatchdog();
    } catch (e) {
      console.warn("[P2P] init exception:", e);
    }
  }

  quickPlay(profile, callback) {
    const urlParams = new URLSearchParams(window.location.search);
    const arenaTag = (urlParams.get("arena") || "public")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "public";
    const targetPeerId = `brawlz-arena-${arenaTag}`;

    console.log(`[QuickPlay] Searching for Live Public Arena: ${targetPeerId}...`);

    let resolved = false;
    let peerErrorHandler = null;
    let hostClaimTimer = null;

    const cleanup = () => {
      if (hostClaimTimer) clearTimeout(hostClaimTimer);
      if (peerErrorHandler && this.peer) {
        try { this.peer.off("error", peerErrorHandler); } catch (e) {}
      }
    };

    // Fast check: If host does not respond within 3.2s, claim host role
    hostClaimTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log(`[QuickPlay] Host on ${targetPeerId} did not respond within 3.2s. Becoming Arena Host!`);
        this.hostQuickArena(targetPeerId, arenaTag, profile, callback);
      }
    }, 3200);

    const attemptJoin = () => {
      if (resolved) return;
      if (!this.peer || this.peer.destroyed || !this.peer.open) {
        console.log("[QuickPlay] Waiting for peer to be ready before connecting...");
        return;
      }

      try {
        console.log(`[QuickPlay] Connecting to host: ${targetPeerId} from peer: ${this.peer.id}...`);
        const conn = this.peer.connect(targetPeerId, { reliable: true, serialization: "json" });
        this.hostConn = conn;

        const onOpen = () => {
          console.log("[QuickPlay] Connected to Live Arena Host:", targetPeerId);
          conn.send({ type: "join_request", profile });
          this.startPingLoop();
        };

        if (conn.open) onOpen();
        else conn.on("open", onOpen);

        conn.on("data", (msg) => {
          if (!msg || !msg.type) return;

          if (msg.type === "join_accepted") {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.localPlayerId = msg.playerId;
              this.room = msg.room;
              this.isHost = false;
              this.networkClient.trigger("connected", this.localPlayerId);
              if (callback) callback({ success: true, isHost: false, room: msg.room, playerId: msg.playerId });
            }
          } else if (msg.type === "game_started") {
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
          console.warn("[QuickPlay] Connect error to host:", err);
          if (!resolved) {
            resolved = true;
            cleanup();
            console.log(`[QuickPlay] Connect error, taking over as Arena Host on ${targetPeerId}`);
            this.hostQuickArena(targetPeerId, arenaTag, profile, callback);
          }
        });

        conn.on("close", () => {
          console.log("[QuickPlay] Arena connection closed");
          if (!resolved) {
            resolved = true;
            cleanup();
            console.log(`[QuickPlay] Closed before accepted, becoming Arena Host`);
            this.hostQuickArena(targetPeerId, arenaTag, profile, callback);
          } else {
            console.log("[QuickPlay] Host left battle! Migrating arena host...");
            this.networkClient.trigger("host_migrating");
            setTimeout(() => {
              this.quickPlay(profile, (res) => {
                if (res.success) {
                  console.log("[QuickPlay] Reconnected to arena via host migration!");
                }
              });
            }, 600);
          }
        });
      } catch (err) {
        console.warn("[QuickPlay] Attempt join threw:", err);
        if (!resolved) {
          resolved = true;
          cleanup();
          this.hostQuickArena(targetPeerId, arenaTag, profile, callback);
        }
      }
    };

    peerErrorHandler = (err) => {
      console.warn("[QuickPlay] Peer error:", err.type || err);
      if (err.type === "peer-unavailable" && !resolved) {
        resolved = true;
        cleanup();
        console.log(`[QuickPlay] Target peer not found, becoming Host of ${targetPeerId}`);
        this.hostQuickArena(targetPeerId, arenaTag, profile, callback);
      }
    };

    // If client already has a clean, open, non-host peer, use it directly
    if (this.peer && !this.peer.destroyed && !this.peer.disconnected && this.peer.open && !this.isHost) {
      this.peer.on("error", peerErrorHandler);
      attemptJoin();
    } else {
      // Clean slate: destroy stale peer and create a fresh one to guarantee "open" event
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      this.isHost = false;
      this.init();
      this.peer.on("error", peerErrorHandler);

      if (this.peer.open) {
        attemptJoin();
      } else {
        this.peer.once("open", () => {
          attemptJoin();
        });
      }
    }
  }

  balanceBots() {
    if (!this.isHost || !this.game) return;
    const humanCount = Array.from(this.game.players.values()).filter(p => !p.isBot).length;
    // Keep total combatants at least 4 so arena is always full of action
    const targetBots = Math.max(0, 4 - humanCount);
    const currentBots = this.game.bots ? this.game.bots.size : 0;

    if (currentBots < targetBots) {
      const needed = targetBots - currentBots;
      for (let i = 0; i < needed; i++) {
        try { this.game.addBot(); } catch (e) {}
      }
    } else if (currentBots > targetBots) {
      const excess = currentBots - targetBots;
      for (let i = 0; i < excess; i++) {
        try { this.game.removeBot(); } catch (e) {}
      }
    }
  }

  hostQuickArena(targetPeerId, arenaTag, profile, callback) {
    this.isHost = true;
    this.localPlayerId = `host_${Date.now().toString(36)}`;

    this.room = {
      id: arenaTag.toUpperCase(),
      hostId: this.localPlayerId,
      options: {
        gameMode: "ffa",
        scoreLimit: 0, // 0 = UNLIMITED SCORE (ENDLESS BRAWL)
        matchDuration: 0, // 0 = UNLIMITED TIME (24/7 BATTLE ARENA)
        mapId: "cyber_arena"
      },
      players: [
        {
          id: this.localPlayerId,
          name: profile.name || "Hero",
          color: profile.color || "#00f0ff",
          avatar: profile.avatar || "striker",
          team: "blue",
          isHost: true,
          isReady: true,
          isBot: false
        }
      ]
    };

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    this.peer = new Peer(targetPeerId, PEER_CONFIG);

    let hostOpened = false;
    const hostTimeout = setTimeout(() => {
      if (!hostOpened) {
        console.warn("[QuickPlay Host] Timed out waiting for host peer to open");
        if (callback) callback({ success: false, error: "Signaling server connection timeout" });
      }
    }, 6500);

    this.peer.on("open", (id) => {
      hostOpened = true;
      clearTimeout(hostTimeout);
      this.peerId = id;
      console.log("[QuickPlay Host] Live Arena open and listening on Peer ID:", id);
      this.networkClient.trigger("connected", this.localPlayerId);

      // Start game engine immediately and balance bots!
      this.startGame(() => {
        this.balanceBots();
      });

      if (callback) callback({ success: true, isHost: true, room: this.room, playerId: this.localPlayerId });
    });

    this.peer.on("connection", (conn) => {
      this.handleGuestConnection(conn);
    });

    this.peer.on("disconnected", () => {
      try { this.peer.reconnect(); } catch (e) {}
    });

    this.peer.on("error", (err) => {
      console.warn("[QuickPlay Host] Peer error:", err);
      if (!hostOpened && err.type === "unavailable-id") {
        clearTimeout(hostTimeout);
        console.log("[QuickPlay Host] ID claimed by someone else, joining them as guest!");
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
        this.isHost = false;
        setTimeout(() => {
          this.init();
          this.quickPlay(profile, callback);
        }, 300);
      } else if (hostOpened && this.peer && !this.peer.destroyed && this.peer.disconnected) {
        try { this.peer.reconnect(); } catch (e) {}
      }
    });

    this.setupSignalingWatchdog();
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
      console.log("[P2P Host] Hosted Room Peer open:", id);
      this.networkClient.trigger("connected", this.localPlayerId);
      this.networkClient.trigger("signaling_status", { connected: true, reconnecting: false });
      if (callback) callback({ success: true, room: this.room });
    });

    this.peer.on("connection", (conn) => {
      this.handleGuestConnection(conn);
    });

    this.peer.on("disconnected", () => {
      console.log("[P2P Host] Host signaling disconnected. Auto-reconnecting...");
      this.networkClient.trigger("signaling_status", { connected: false, reconnecting: true });
      try { this.peer.reconnect(); } catch (e) {}
    });

    this.peer.on("error", (err) => {
      console.warn("[P2P Host] Host peer error:", err);
      if (err.type === "unavailable-id") {
        // ID clash, retry with a fresh code
        return this.createRoom(profile, options, callback);
      }
      if (err.type === "disconnected" || err.type === "network") {
        try { this.peer.reconnect(); } catch (e) {}
      }
    });

    this.setupSignalingWatchdog();
  }

  handleGuestConnection(conn) {
    const setup = () => {
      console.log("[P2P Host] Guest connected and open:", conn.peer);
      this.connections.set(conn.peer, conn);

      conn.on("data", (data) => {
        this.handleGuestMessage(conn, data);
      });

      conn.on("close", () => {
        console.log("[P2P Host] Guest disconnected:", conn.peer);
        this.connections.delete(conn.peer);
        this.handleGuestDisconnect(conn.peer);
      });

      conn.on("error", (err) => {
        console.warn("[P2P Host] Guest conn error:", err);
      });
    };

    if (conn.open) {
      setup();
    } else {
      conn.on("open", setup);
    }
  }

  handleGuestMessage(connOrPeerId, msg) {
    if (!msg || !msg.type) return;

    const conn = (typeof connOrPeerId === "object" && connOrPeerId !== null) ? connOrPeerId : this.connections.get(connOrPeerId);
    const peerId = (typeof connOrPeerId === "string") ? connOrPeerId : (connOrPeerId?.peer || "");

    if (msg.type === "join_request") {
      // Auto-heal room if it was null
      if (!this.room) {
        this.room = {
          id: "PUBLIC",
          hostId: this.localPlayerId || `host_${Date.now().toString(36)}`,
          options: {
            gameMode: "ffa",
            scoreLimit: 25,
            matchDuration: 600,
            mapId: "cyber_arena"
          },
          players: [
            {
              id: this.localPlayerId || "host",
              name: "Host",
              color: "#00f0ff",
              avatar: "striker",
              team: "blue",
              isHost: true,
              isReady: true,
              isBot: false
            }
          ]
        };
      }

      // If game is not active on host, start it right now so guest can fight
      if (!this.game) {
        this.startGame(() => {
          this.addBot();
        });
      }

      const guestPlayerId = `guest_${peerId}`;
      let player = this.room.players.find(p => p.id === guestPlayerId || p.peerId === peerId);
      if (!player) {
        player = {
          id: guestPlayerId,
          peerId,
          name: msg.profile?.name || "Guest",
          color: msg.profile?.color || "#ff007f",
          avatar: msg.profile?.avatar || "striker",
          team: this.room.options.gameMode === "team" ? (this.room.players.length % 2 === 0 ? "blue" : "red") : "blue",
          isHost: false,
          isReady: true,
          isBot: false
        };
        this.room.players.push(player);
      } else {
        if (msg.profile?.name) player.name = msg.profile.name;
        if (msg.profile?.color) player.color = msg.profile.color;
        if (msg.profile?.avatar) player.avatar = msg.profile.avatar;
      }

      this.broadcast({ type: "lobby_updated", data: this.room });
      this.networkClient.trigger("lobby_updated", this.room);

      if (conn && conn.open) {
        conn.send({ type: "join_accepted", room: this.room, playerId: guestPlayerId, gameRunning: Boolean(this.game) });
        if (this.game) {
          this.game.addPlayer(guestPlayerId, {
            name: player.name,
            color: player.color,
            avatar: player.avatar,
            team: player.team,
            isBot: false
          }, false);
          this.balanceBots();
          conn.send({
            type: "game_started",
            data: { map: this.game.map, options: this.game.options }
          });
          const joinPing = { id: guestPlayerId, playerName: player.name, icon: "⚔️", text: "JOINED THE BATTLE!", playerColor: player.color };
          this.broadcast({ type: "tactical_ping", data: joinPing });
          this.networkClient.trigger("tactical_ping", joinPing);
        }
      }
    } else if (msg.type === "player_input") {
      if (this.game) {
        this.game.handlePlayerInput(`guest_${peerId}`, msg.payload);
      }
    } else if (msg.type === "p2p_ping") {
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
        this.balanceBots();
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

    if (!this.peer || this.peer.destroyed || this.peer.disconnected || !this.peer.open) {
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      this.isHost = false;
      this.init();
    }

    let hasResponded = false;
    let attemptCount = 0;
    const maxAttempts = 3;
    let activeConn = null;
    let peerErrorHandler = null;
    let retryTimer = null;

    const cleanup = () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (peerErrorHandler && this.peer) {
        try { this.peer.off("error", peerErrorHandler); } catch (e) {}
      }
    };

    const overallTimeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        cleanup();
        if (callback) {
          callback({
            success: false,
            error: `Could not connect to room "${cleanCode.toUpperCase()}". Check the code and make sure Host is in the room!`
          });
        }
      }
    }, 18000);

    const attemptConnect = () => {
      if (hasResponded) return;
      attemptCount++;
      console.log(`[P2P Guest] Connecting to host: ${targetPeerId} (Attempt ${attemptCount}/${maxAttempts})...`);

      if (activeConn) {
        try { activeConn.close(); } catch (e) {}
        activeConn = null;
      }

      try {
        const conn = this.peer.connect(targetPeerId, { reliable: true, serialization: "json" });
        activeConn = conn;
        this.hostConn = conn;

        const onConnOpen = () => {
          if (hasResponded) return;
          console.log("[P2P Guest] Connected and open to host:", targetPeerId);
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
            clearTimeout(overallTimeout);
            hasResponded = true;
            cleanup();
            this.localPlayerId = msg.playerId;
            this.room = msg.room;
            this.networkClient.trigger("connected", this.localPlayerId);
            if (callback) callback({ success: true, room: msg.room, player: { isHost: false }, gameRunning: Boolean(msg.gameRunning) });
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
          console.warn("[P2P Guest] Connection to host error:", err);
        });

        conn.on("close", () => {
          console.log("[P2P Guest] Host connection closed");
          if (this.pingInterval) clearInterval(this.pingInterval);
          this.networkClient.trigger("disconnected");
        });
      } catch (e) {
        console.warn("[P2P Guest] connect call error:", e);
      }
    };

    peerErrorHandler = (err) => {
      console.warn("[P2P Guest] Peer error event:", err.type || err);
      if (err.type === "peer-unavailable" && !hasResponded) {
        if (attemptCount < maxAttempts) {
          console.log(`[P2P Guest] Host peer unavailable on attempt ${attemptCount}. Retrying in 1.8s...`);
          retryTimer = setTimeout(() => {
            if (!hasResponded) attemptConnect();
          }, 1800);
        } else {
          clearTimeout(overallTimeout);
          hasResponded = true;
          cleanup();
          if (callback) {
            callback({
              success: false,
              error: `Room code "${cleanCode.toUpperCase()}" not found. Ask Host to check their screen!`
            });
          }
        }
      }
    };

    this.peer.on("error", peerErrorHandler);

    if (this.peer.open) {
      attemptConnect();
    } else {
      this.peer.once("open", () => {
        attemptConnect();
      });
    }

    this.setupSignalingWatchdog();
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
    this.networkClient.trigger("game_started", {
      map: this.game.map,
      options: this.game.options
    });

    if (callback) callback({ success: true });
  }

  broadcastCompactState(worldState) {
    if (!worldState) return;

    const players = worldState.players?.map(p => ({
      id: p.id,
      name: p.name || "Player",
      color: p.color || "#00f0ff",
      avatar: p.avatar || "striker",
      team: p.team || "blue",
      x: Math.round((p.x || 0) * 10) / 10,
      y: Math.round((p.y || 0) * 10) / 10,
      angle: Math.round((p.angle || 0) * 100) / 100,
      health: Math.round(p.health || 0),
      maxHealth: Math.round(p.maxHealth || 100),
      shield: Math.round(p.shield || 0),
      maxShield: Math.round(p.maxShield || 50),
      isAlive: Boolean(p.isAlive),
      isDashing: Boolean(p.isDashing),
      currentWeapon: p.currentWeapon || "blaster",
      ammo: (!isFinite(p.ammo) || p.ammo === -1) ? -1 : Math.round(p.ammo),
      kills: Math.round(p.kills || 0),
      deaths: Math.round(p.deaths || 0),
      score: Math.round(p.score || 0),
      superCharge: Math.round(p.superCharge || 0),
      spawnShieldEndTime: p.spawnShieldEndTime || 0,
      isInvisible: Boolean(p.isInvisible),
      inBush: Boolean(p.inBush),
      speedBoost: Boolean(p.speedBoost)
    }));

    const bullets = worldState.bullets?.map(b => ({
      id: b.id,
      x: Math.round(b.x || 0),
      y: Math.round(b.y || 0),
      radius: Math.round(b.radius || 4),
      color: b.color || "#00f0ff",
      type: b.type || "blaster"
    }));

    const crates = worldState.crates?.map(c => ({
      id: c.id,
      hp: Math.round(c.hp || 0),
      maxHp: Math.round(c.maxHp || 100),
      x: Math.round(c.x || 0),
      y: Math.round(c.y || 0),
      size: Math.round(c.size || 40)
    }));

    this.broadcast({
      type: "game_state",
      data: {
        t: worldState.t || Date.now(),
        timeRemaining: Math.round(worldState.timeRemaining || 0),
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
      const dc = this.hostConn._dc || this.hostConn.dataChannel;
      if (dc && dc.bufferedAmount > 16384) {
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
    const isDroppable = msg && msg.type === "game_state";
    for (const [peerId, conn] of this.connections.entries()) {
      if (conn && conn.open) {
        const dc = conn._dc || conn.dataChannel;
        if (isDroppable && dc && dc.bufferedAmount > 32768) {
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
    const wasHost = this.isHost;
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
      try { this.hostConn.close(); } catch (e) {}
      this.hostConn = null;
    }
    this.room = null;
    this.isHost = false;

    // Destroy host peer so it does not linger as a zombie host holding brawlz-arena-public
    if (wasHost && this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
      setTimeout(() => {
        this.init();
      }, 300);
    }
  }
}
