// server/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import os from "os";
import QRCode from "qrcode";
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
const roomManager = new RoomManager(io);

// Static assets
const publicPath = path.join(__dirname, "..", "public");
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

// API: Get server network info and join URL
app.get("/api/network-info", async (req, res) => {
  const addresses = getLocalNetworkAddresses();
  // Prefer Wi-Fi or 192.168 / 10.x LAN
  const primary = addresses.find(a => /wi-?fi|wlan/i.test(a.name)) || addresses[0] || { ip: "localhost" };
  const joinUrl = `http://${primary.ip}:${PORT}`;

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(joinUrl, {
      margin: 1,
      color: {
        dark: "#00f0ff",
        light: "#0a0e17"
      },
      width: 256
    });
  } catch (err) {
    console.error("QR Code generation error:", err);
  }

  res.json({
    ip: primary.ip,
    port: PORT,
    joinUrl,
    qrDataUrl,
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
    roomManager.leaveCurrentRoom(socket);
  });
});

// Start Server
server.listen(PORT, "0.0.0.0", () => {
  const addresses = getLocalNetworkAddresses();
  console.log("\n=======================================================");
  console.log("🎮  BRAWL ZONE - MULTIPLAYER ACTION SERVER RUNNING  🎮");
  console.log("=======================================================");
  console.log(`Local Access:    http://localhost:${PORT}`);
  addresses.forEach(a => {
    console.log(`Mobile/LAN Play: http://${a.ip}:${PORT}  (${a.name})`);
  });
  console.log("=======================================================\n");
  console.log("👉 Tip: Connect your phone to the same Wi-Fi or Hotspot,");
  console.log("   then open the Mobile/LAN Play link above or scan QR code!\n");
});

