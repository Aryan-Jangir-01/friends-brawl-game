// test/multiplayer_test.js
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

async function runTest() {
  console.log("🧪 Starting Multiplayer Simulation Test...");

  const clientA = io(SERVER_URL);
  const clientB = io(SERVER_URL);

  let roomCreated = false;
  let roomId = null;
  let gameStartedReceivedA = false;
  let gameStartedReceivedB = false;
  let stateReceivedCount = 0;
  let dashReceived = false;
  let weaponFiredReceived = false;
  let superChargeVerified = false;

  await new Promise(resolve => {
    let connected = 0;
    clientA.on("connect", () => {
      console.log("Client A connected (Phone 1):", clientA.id);
      if (++connected === 2) resolve();
    });
    clientB.on("connect", () => {
      console.log("Client B connected (Phone 2):", clientB.id);
      if (++connected === 2) resolve();
    });
  });

  // Client A creates room
  await new Promise(resolve => {
    clientA.emit("create_room", {
      profile: { name: "PlayerOne", color: "#00f0ff" },
      options: { gameMode: "ffa", scoreLimit: 10 }
    }, (res) => {
      console.log("Room create response:", res);
      if (res.success) {
        roomId = res.room.id;
        roomCreated = true;
      }
      resolve();
    });
  });

  if (!roomCreated) {
    throw new Error("Failed to create room!");
  }

  // Client B joins room
  await new Promise(resolve => {
    clientB.emit("join_room", {
      roomId,
      profile: { name: "PlayerTwo", color: "#ff007f" }
    }, (res) => {
      console.log("Client B join response:", res);
      if (res.success) {
        console.log("Client B successfully joined room:", roomId);
      }
      resolve();
    });
  });

  // Setup listeners for match start
  clientA.on("game_started", () => { gameStartedReceivedA = true; });
  clientB.on("game_started", () => { gameStartedReceivedB = true; });

  clientA.on("player_dashed", () => { dashReceived = true; });
  clientB.on("weapon_fired", () => { weaponFiredReceived = true; });

  clientA.on("game_state", (state) => {
    stateReceivedCount++;
    if (state.players && state.players[0] && typeof state.players[0].superCharge === "number") {
      superChargeVerified = true;
    }
  });

  // Client A starts game
  await new Promise(resolve => {
    clientA.emit("start_game", (res) => {
      console.log("Start game response:", res);
      resolve();
    });
  });

  // Wait 1.5 seconds for game ticks
  await new Promise(r => setTimeout(r, 600));

  // Client A sends input (Move, Dash, Shoot)
  clientA.emit("player_input", {
    moveX: 1,
    moveY: 0,
    aimAngle: 0.5,
    isShooting: true,
    dashRequested: true
  });

  // Wait another 1 second
  await new Promise(r => setTimeout(r, 1000));

  console.log("Verification Results:");
  console.log("- Room created:", roomCreated, `(Code: ${roomId})`);
  console.log("- Client A game_started:", gameStartedReceivedA);
  console.log("- Client B game_started:", gameStartedReceivedB);
  console.log("- Total Game States received by Client A:", stateReceivedCount);
  console.log("- Dash event received:", dashReceived);
  console.log("- Weapon fired event received:", weaponFiredReceived);
  console.log("- Super Charge verified in game_state:", superChargeVerified);

  clientA.disconnect();
  clientB.disconnect();

  if (roomCreated && gameStartedReceivedA && gameStartedReceivedB && stateReceivedCount > 10 && dashReceived && weaponFiredReceived && superChargeVerified) {
    console.log("✅ ALL MULTIPLAYER TEST ASSERTIONS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ Some multiplayer assertions failed!");
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});

