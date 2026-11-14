// server/index.js
import express from "express";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import path from "path";
import os from "os";
import QRCode from "qrcode";
import selfsigned from "selfsigned";
import { fileURLToPath } from "url";
import { RoomManager } from "./RoomManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || (Number(PORT) + 443); // e.g. 3443
let httpsServer = null;

// Generate local self-signed SSL certificate for Secure Context on mobile phones
try {
  const pems = await selfsigned.generate([
    { name: "commonName", value: "brawlzone.local" }
  ], {
    days: 365,
    algorithm: "sha256"
  });

  httpsServer = https.createServer({
    key: pems.private,
    cert: pems.cert
  }, app);

  // Attach socket.io to the HTTPS server as well
  io.attach(httpsServer);
} catch (err) {
  console.warn("HTTPS certificate generation notice:", err.message);
}

const roomManager = new RoomManager(io);

// Static assets and CORS for cross-origin hosting (e.g. GitHub Pages)
const publicPath = path.join(__dirname, "..", "public");
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(express.static(publicPath));
app.use(express.json());

// Helper: Get local network IP addresses (Wi-Fi, Ethernet)
function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (127.0.0.1) and non-ipv4
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push({
          name,
          ip: iface.address
        });
      }
    }
  }
  return addresses;
}

// API: Get server network info and join URLs (HTTP and HTTPS)
app.get("/api/network-info", async (req, res) => {
  const addresses = getLocalNetworkAddresses();
  // Prefer Wi-Fi or 192.168 / 10.x LAN
  const primary = addresses.find(a => /wi-?fi|wlan/i.test(a.name)) || addresses[0] || { ip: "localhost" };
  const joinUrl = `http://${primary.ip}:${PORT}`;
  const httpsJoinUrl = httpsServer ? `https://${primary.ip}:${HTTPS_PORT}` : joinUrl;

  let qrDataUrl = "";
  let httpsQrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(joinUrl, {
      margin: 1,
      color: {
        dark: "#00f0ff",
        light: "#0a0e17"
      },
      width: 256
    });

    if (httpsServer) {
      httpsQrDataUrl = await QRCode.toDataURL(httpsJoinUrl, {
        margin: 1,
        color: {
          dark: "#10b981",
          light: "#0a0e17"
        },
        width: 256
      });
    }
  } catch (err) {
    console.error("QR Code generation error:", err);
  }

  res.json({
    ip: primary.ip,
    port: PORT,
    httpsPort: HTTPS_PORT,
    joinUrl,
    httpsJoinUrl,
    qrDataUrl,
    httpsQrDataUrl,
    allAddresses: addresses
  });
});

// API: Generate QR code for a specific room link
app.get("/api/qr", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing url parameter");
  try {
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      margin: 1,
      color: {
        dark: "#00f0ff",
        light: "#0c101d"
      },
      width: 256
    });
    res.json({ qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

// Socket.io Connection & Event Handling
io.on("connection", (socket) => {
  // Ping measurement
  socket.on("client_ping", (clientTime) => {
    socket.emit("server_pong", clientTime);
  });

  // Room Management
  socket.on("create_room", ({ profile, options }, callback) => {
    const result = roomManager.createRoom(socket, profile, options);
    if (callback) callback(result);
  });

  socket.on("join_room", ({ roomId, profile }, callback) => {
    const result = roomManager.joinRoom(socket, roomId, profile);
    if (callback) callback(result);
  });

  socket.on("leave_room", () => {
    if (socket.roomId) {
      io.to(socket.roomId).emit("voice_user_left", { senderId: socket.id });
    }
    socket.voiceData = null;
    roomManager.leaveCurrentRoom(socket);
  });

  socket.on("toggle_ready", (isReady) => {
    roomManager.updatePlayerReady(socket, isReady);
  });

  socket.on("change_team", (team) => {
    roomManager.updatePlayerTeam(socket, team);
  });

  socket.on("update_room_options", (newOptions) => {
    roomManager.updateRoomOptions(socket, newOptions);
  });

  socket.on("start_game", (callback) => {
    const result = roomManager.startGame(socket);
    if (callback) callback(result);
  });

  socket.on("add_bot", (callback) => {
    const result = roomManager.addBotToRoom(socket);
    if (callback) callback(result);
  });

  socket.on("remove_bot", (botId, callback) => {
    const result = roomManager.removeBotFromRoom(socket, botId);
    if (callback) callback(result);
  });

  socket.on("send_emote", (emoji) => {
    roomManager.sendEmote(socket, emoji);
  });

  socket.on("send_tactical_ping", (pingData) => {
    roomManager.sendTacticalPing(socket, pingData);
  });

  socket.on("return_to_lobby", () => {
    roomManager.returnToLobby(socket);
  });

  // Live Room Voice Chat Signaling
  socket.on("voice_join", (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    socket.voiceData = {
      id: socket.id,
      name: data?.name || "Brawler",
      isMuted: Boolean(data?.isMuted)
    };

    // 1. Gather other participants currently in voice in this room
    const room = roomManager.rooms.get(roomId);
    if (room) {
      const existingPeers = [];
      for (const p of room.players.values()) {
        const s = io.sockets.sockets.get(p.id);
        if (s && s.id !== socket.id && s.voiceData) {
          existingPeers.push({
            id: s.id,
            name: s.voiceData.name,
            isMuted: s.voiceData.isMuted
          });
        }
      }
      socket.emit("voice_room_users", { peers: existingPeers });
    }

    // 2. Broadcast new voice member to existing room peers
    socket.to(roomId).emit("voice_user_joined", {
      senderId: socket.id,
      name: socket.voiceData.name,
      isMuted: socket.voiceData.isMuted
    });
  });

  socket.on("voice_signal", ({ targetId, signal }) => {
    if (!targetId || !signal) return;
    io.to(targetId).emit("voice_signal", {
      senderId: socket.id,
      name: socket.voiceData?.name || "Brawler",
      signal
    });
  });

  socket.on("voice_state", (state) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    if (socket.voiceData && typeof state?.isMuted === "boolean") {
      socket.voiceData.isMuted = state.isMuted;
    }
    socket.to(roomId).emit("voice_state_changed", {
      senderId: socket.id,
      ...state
    });
  });

  socket.on("voice_speaking", ({ isSpeaking }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("voice_speaking_changed", {
      senderId: socket.id,
      isSpeaking: Boolean(isSpeaking)
    });
  });

  // Gameplay Inputs
  socket.on("player_input", (inputData) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = roomManager.rooms.get(roomId);
    if (room && room.gameInstance) {
      room.gameInstance.handlePlayerInput(socket.id, inputData);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (socket.roomId) {
      io.to(socket.roomId).emit("voice_user_left", { senderId: socket.id });
    }
    socket.voiceData = null;
    roomManager.leaveCurrentRoom(socket);
  });
});

// Start HTTP Server
server.listen(PORT, "0.0.0.0", () => {
  const addresses = getLocalNetworkAddresses();
  console.log("\n=======================================================");
  console.log("🎮  BRAWL ZONE - MULTIPLAYER ACTION SERVER RUNNING  🎮");
  console.log("=======================================================");
  console.log(`Local HTTP:      http://localhost:${PORT}`);
  addresses.forEach(a => {
    console.log(`Mobile/LAN Play: http://${a.ip}:${PORT}  (${a.name})`);
  });
  console.log("=======================================================");
});

// Start HTTPS Server (for Phone Mic permissions on local Wi-Fi)
if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    const addresses = getLocalNetworkAddresses();
    console.log(`🔒 Local HTTPS:     https://localhost:${HTTPS_PORT}`);
    addresses.forEach(a => {
      console.log(`🔒 Mobile HTTPS:    https://${a.ip}:${HTTPS_PORT}  (Recommended for Phone Mic!)`);
    });
    console.log("=======================================================\n");
    console.log("👉 Tip: For Mobile Voice Chat (Microphone) on local Wi-Fi,");
    console.log("   open the Mobile HTTPS link above on your phone and tap");
    console.log("   'Advanced -> Proceed' once to allow microphone access!\n");
  });
}
