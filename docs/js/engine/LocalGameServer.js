// public/js/engine/LocalGameServer.js
import { GameInstance } from "./GameInstance.js?v=20261113_02";

export class LocalGameServer {
  constructor(networkClient) {
    this.networkClient = networkClient;
    this.game = null;
    this.localPlayerId = "local_player_1";

    this.mockIO = {
      to: () => ({
        emit: (event, data) => {
          this.networkClient.trigger(event, data);
        }
      })
    };
  }

  start(profile, options = {}) {
    this.stop();

    const gameOptions = {
      gameMode: options.gameMode || "ffa",
      scoreLimit: options.scoreLimit || 15,
      matchDuration: options.matchDuration || 300,
      mapId: options.mapId || "cyber_arena"
    };

    this.game = new GameInstance("SOLO_ROOM", gameOptions, this.mockIO);

    // Add local human player
    this.game.addPlayer(this.localPlayerId, {
      name: profile.name || "Brawler",
      color: profile.color || "#00f0ff",
      avatar: profile.avatar || "striker"
    }, true);

    // Add 3 AI Bots
    this.game.addBot();
    this.game.addBot();
    this.game.addBot();

    // Start match loop
    this.game.start();

    return {
      success: true,
      localPlayerId: this.localPlayerId,
      room: {
        id: "SOLO",
        options: gameOptions,
        map: this.game.map
      }
    };
  }

  stop() {
    if (this.game) {
      this.game.stop();
      this.game = null;
    }
  }

  handleInput(input) {
    if (this.game) {
      this.game.handlePlayerInput(this.localPlayerId, input);
    }
  }

  fireWeapon(angle) {
    if (this.game) {
      this.game.handleWeaponFire(this.localPlayerId, angle);
    }
  }

  dash() {
    if (this.game) {
      this.game.handlePlayerDash(this.localPlayerId);
    }
  }

  swapWeapon() {
    if (this.game) {
      this.game.handleWeaponSwap(this.localPlayerId);
    }
  }

  activateSuper() {
    if (this.game) {
      this.game.handleSuperActivate(this.localPlayerId);
    }
  }

  sendPing(pingType, x, y) {
    if (this.game) {
      this.game.handleTacticalPing(this.localPlayerId, pingType, x, y);
    }
  }
}
