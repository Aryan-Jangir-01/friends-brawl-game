// server/RoomManager.js
import { GameInstance } from "./GameInstance.js";

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomId -> RoomObject
  }

  generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return this.rooms.has(code) ? this.generateRoomCode() : code;
  }

  createRoom(hostSocket, hostProfile = {}, options = {}) {
    const roomId = (options.customCode || this.generateRoomCode()).toUpperCase().trim();
    if (this.rooms.has(roomId)) {
      return { success: false, error: "Room code already exists" };
    }

    const room = {
      id: roomId,
      hostId: hostSocket.id,
      state: "lobby", // lobby, playing, ended
      options: {
        gameMode: options.gameMode || "ffa", // ffa, team
        scoreLimit: options.scoreLimit || 15,
        matchDuration: options.matchDuration || 300,
        mapId: "cyber_arena"
      },
      players: new Map(), // socketId -> profile
      gameInstance: null
    };

    this.rooms.set(roomId, room);
    this.joinRoom(hostSocket, roomId, hostProfile);

    return { success: true, room: this.getRoomSummary(roomId) };
  }

  joinRoom(socket, roomId, profile = {}) {
    roomId = roomId.toUpperCase().trim();
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: "Room not found. Check code!" };
    }

    if (room.state === "playing" && !room.gameInstance) {
      return { success: false, error: "Game already underway" };
    }

    // Leave any existing room
    this.leaveCurrentRoom(socket);

    const player = {
      id: socket.id,
      name: (profile.name || "Brawler").substring(0, 14),
      color: profile.color || "#00f0ff",
      avatar: profile.avatar || "striker",
      team: profile.team || (room.players.size % 2 === 0 ? "blue" : "red"),
      isHost: socket.id === room.hostId,
      isReady: socket.id === room.hostId // Host is ready by default
    };

    room.players.set(socket.id, player);
    socket.join(roomId);
    socket.roomId = roomId;

    // If game is currently running, add to active gameInstance too
    if (room.state === "playing" && room.gameInstance) {
      room.gameInstance.addPlayer(socket.id, player);
    }

    this.broadcastLobbyUpdate(roomId);

    return { success: true, room: this.getRoomSummary(roomId), player };
  }

  leaveCurrentRoom(socket) {
    const roomId = socket.roomId;
    if (!roomId || !this.rooms.has(roomId)) return;

    const room = this.rooms.get(roomId);
    room.players.delete(socket.id);
    socket.leave(roomId);
    delete socket.roomId;

    if (room.gameInstance) {
      room.gameInstance.removePlayer(socket.id);
    }

    // If host left, assign new host or delete room if empty
    if (room.players.size === 0) {
      if (room.gameInstance) {
        room.gameInstance.stop();
      }
      this.rooms.delete(roomId);
    } else {
      if (room.hostId === socket.id) {
        const nextHostId = room.players.keys().next().value;
        room.hostId = nextHostId;
        const nextHostPlayer = room.players.get(nextHostId);
        if (nextHostPlayer) nextHostPlayer.isHost = true;
      }
      this.broadcastLobbyUpdate(roomId);
    }
  }

  updatePlayerReady(socket, isReady) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      player.isReady = isReady;
      this.broadcastLobbyUpdate(socket.roomId);
    }
  }

  updatePlayerTeam(socket, team) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player && (team === "blue" || team === "red")) {
      player.team = team;
      this.broadcastLobbyUpdate(socket.roomId);
    }
  }

  updateRoomOptions(socket, newOptions) {
    const room = this.rooms.get(socket.roomId);
    if (!room || room.hostId !== socket.id) return;

    room.options = { ...room.options, ...newOptions };
    this.broadcastLobbyUpdate(socket.roomId);
  }

  startGame(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return { success: false, error: "Room not found" };
    if (room.hostId !== socket.id) return { success: false, error: "Only host can start the game" };
    if (room.players.size < 1) return { success: false, error: "Need at least 1 player to test" };

    room.state = "playing";
    room.gameInstance = new GameInstance(room.id, room.options, this.io);

    // Register all players
    room.players.forEach(profile => {
      room.gameInstance.addPlayer(profile.id, profile);
    });

    room.gameInstance.start();

    this.io.to(room.id).emit("match_starting", {
      roomId: room.id,
      options: room.options,
      players: Array.from(room.players.values())
    });

    return { success: true };
  }

  returnToLobby(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room || room.hostId !== socket.id) return;

    if (room.gameInstance) {
      room.gameInstance.stop();
      room.gameInstance = null;
    }
    room.state = "lobby";

    this.io.to(room.id).emit("returned_to_lobby", this.getRoomSummary(room.id));
  }

  getRoomSummary(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      id: room.id,
      hostId: room.hostId,
      state: room.state,
      options: room.options,
      players: Array.from(room.players.values())
    };
  }

  broadcastLobbyUpdate(roomId) {
    const summary = this.getRoomSummary(roomId);
    if (summary) {
      this.io.to(roomId).emit("lobby_updated", summary);
    }
  }
}
