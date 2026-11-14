// public/js/voice.js
// High-performance real-time WebRTC Peer-to-Peer Live Voice Chat with Voice Activity Detection (VAD)

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" }
  ]
};

export class VoiceChatManager {
  constructor(networkClient) {
    this.network = networkClient;
    this.localStream = null;
    this.isMicMuted = false;
    this.isDeafened = false;
    this.isVoiceActive = false;
    this.currentRoomId = null;
    this.localPlayerName = "Brawler";

    // WebRTC Peer Connections: peerId -> RTCPeerConnection
    this.peerConnections = new Map();
    // Remote audio elements: peerId -> HTMLAudioElement
    this.remoteAudioElements = new Map();
    // Remote peers info: peerId -> { name, isMuted, isSpeaking }
    this.peers = new Map();
    // ICE Candidate Queue: peerId -> Array of RTCIceCandidateInit
    this.pendingCandidates = new Map();
    // Active offer flags: peerId -> boolean
    this.isMakingOffer = new Map();

    // Audio Analysis for Voice Activity Detection (VAD)
    this.audioContext = null;
    this.analyser = null;
    this.vadInterval = null;
    this.isSpeaking = false;
    this.silenceCounter = 0;

    // Event listeners
    this.listeners = new Map();

    this.initAudioUnlock();
    this.initNetworkListeners();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  trigger(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => {
        try { cb(data); } catch (e) { console.warn("[Voice] Listener error:", e); }
      });
    }
  }

  // Global user-gesture audio unlocker for mobile Safari & Chrome
  initAudioUnlock() {
    const unlock = () => {
      this.unlockAudio();
    };
    window.addEventListener("click", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("pointerdown", unlock, { passive: true });
  }

  unlockAudio() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    this.remoteAudioElements.forEach(audio => {
      if (audio.paused && audio.srcObject) {
        audio.play().catch(() => {});
      }
    });
  }

  initNetworkListeners() {
    if (!this.network) return;

    // Room existing voice participants list
    this.network.on("voice_room_users", async (data) => {
      if (!this.isVoiceActive || !data?.peers) return;
      console.log(`[Voice] Received voice participants list (${data.peers.length} peers)`);
      for (const peer of data.peers) {
        if (!peer.id || peer.id === this.getMyId()) continue;
        this.peers.set(peer.id, {
          name: peer.name || "Brawler",
          isMuted: Boolean(peer.isMuted),
          isSpeaking: false
        });

        // Deterministic role: smaller ID initiates offer
        if (this.getMyId() < peer.id) {
          await this.initiateCallTo(peer.id);
        }
      }
      this.updateVoiceUI();
    });

    // Incoming new user in voice chat
    this.network.on("voice_user_joined", async (data) => {
      if (!this.isVoiceActive || !data?.senderId) return;
      const peerId = data.senderId;
      if (peerId === this.getMyId()) return;

      console.log(`[Voice] Peer joined voice chat: ${peerId} (${data.name || "Brawler"})`);
      this.peers.set(peerId, {
        name: data.name || "Brawler",
        isMuted: Boolean(data.isMuted),
        isSpeaking: false
      });
      this.updateVoiceUI();

      // Deterministic role: smaller ID initiates offer
      if (this.getMyId() < peerId) {
        await this.initiateCallTo(peerId);
      }
    });

    // Incoming WebRTC signaling (offer, answer, or candidate)
    this.network.on("voice_signal", async (data) => {
      if (!this.isVoiceActive || !data?.senderId || !data?.signal) return;
      const peerId = data.senderId;
      if (peerId === this.getMyId()) return;

      // Ensure peer exists in peers map
      if (!this.peers.has(peerId)) {
        this.peers.set(peerId, {
          name: data.name || "Brawler",
          isMuted: false,
          isSpeaking: false
        });
        this.updateVoiceUI();
      }

      await this.handleIncomingSignal(peerId, data.signal);
    });

    // Peer mute/unmute state change
    this.network.on("voice_state_changed", (data) => {
      if (!data?.senderId) return;
      const peer = this.peers.get(data.senderId);
      if (peer) {
        if (typeof data.isMuted === "boolean") peer.isMuted = data.isMuted;
        this.trigger("peer_state_change", { peerId: data.senderId, ...data });
        this.updateVoiceUI();
      }
    });

    // Peer speaking status change
    this.network.on("voice_speaking_changed", (data) => {
      if (!data?.senderId) return;
      const peer = this.peers.get(data.senderId);
      if (peer) {
        peer.isSpeaking = Boolean(data.isSpeaking);
        this.trigger("speaking_change", {
          peerId: data.senderId,
          name: peer.name,
          isSpeaking: peer.isSpeaking,
          isLocal: false
        });
        this.updateSpeakingUI(peer.name, peer.isSpeaking);
      }
    });

    // Peer left voice chat
    this.network.on("voice_user_left", (data) => {
      if (!data?.senderId) return;
      this.closePeer(data.senderId);
    });
  }

  getMyId() {
    if (this.network.mode === "socket" && this.network.socket) {
      return this.network.socket.id;
    }
    if (this.network.mode === "p2p" && this.network.p2p) {
      return this.network.p2p.peerId;
    }
    return "local_user";
  }

  // Check Secure Context & Request Microphone access
  async requestMicrophone() {
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocal) {
      const httpsPort = 3443;
      console.warn("[Voice] Insecure context on LAN IP. Mobile browsers require HTTPS for getUserMedia.");
      this.trigger("toast", `🔒 Mobile Mic requires HTTPS! Open https://${location.hostname}:${httpsPort}`);
      this.isMicMuted = true;
      this.updateVoiceUI();
      return null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("[Voice] navigator.mediaDevices.getUserMedia is not supported.");
      this.trigger("toast", "🎙️ Microphone API not supported in this browser.");
      this.isMicMuted = true;
      this.updateVoiceUI();
      return null;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });

      this.isMicMuted = false;
      this.setupVAD(this.localStream);
      this.attachLocalStreamToAllPeers();
      console.log("[Voice] Microphone access granted & VAD active");
      this.updateVoiceUI();
      return this.localStream;
    } catch (err) {
      console.warn("[Voice] Microphone access denied or unavailable:", err);
      this.localStream = null;
      this.isMicMuted = true;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        this.trigger("toast", "⚠️ Microphone permission denied in browser settings.");
      } else {
        this.trigger("toast", "🎙️ Microphone not available. You can still listen to others!");
      }
      this.updateVoiceUI();
      return null;
    }
  }

  // Attach local audio track to all active peer connections
  attachLocalStreamToAllPeers() {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    for (const [peerId, pc] of this.peerConnections) {
      try {
        const senders = pc.getSenders();
        const existingSender = senders.find(s => s.track && s.track.kind === "audio");
        if (existingSender) {
          existingSender.replaceTrack(audioTrack).catch(e => console.warn("[Voice] replaceTrack failed:", e));
        } else {
          pc.addTrack(audioTrack, this.localStream);
          if (this.getMyId() < peerId && pc.signalingState === "stable") {
            this.initiateCallTo(peerId);
          }
        }
      } catch (err) {
        console.warn(`[Voice] Error attaching local track to peer ${peerId}:`, err);
      }
    }
  }

  // Join Voice Chat in the current Room
  async joinRoomVoice(roomId, playerName = "Brawler") {
    if (this.isVoiceActive && this.currentRoomId === roomId) return;
    this.currentRoomId = roomId;
    this.localPlayerName = playerName;
    this.isVoiceActive = true;

    console.log(`[Voice] Joining voice chat in room: ${roomId}`);

    // Request Microphone access
    await this.requestMicrophone();

    // Broadcast voice_join to room
    this.network.sendVoiceJoin({
      name: this.localPlayerName,
      isMuted: this.isMicMuted
    });

    this.updateVoiceUI();
  }

  // Create or retrieve an RTCPeerConnection for a peer
  getOrCreatePeerConnection(peerId) {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);
    this.pendingCandidates.set(peerId, []);
    this.isMakingOffer.set(peerId, false);

    // Add local audio track if microphone is available, or add receive-only transceiver
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        try { pc.addTrack(track, this.localStream); } catch (e) {}
      });
    } else {
      try {
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch (e) {}
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.network.sendVoiceSignal(peerId, { candidate: event.candidate });
      }
    };

    // Handle incoming audio track
    pc.ontrack = (event) => {
      console.log(`[Voice] Received remote audio stream from peer: ${peerId}`);
      let audio = this.remoteAudioElements.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `remote-voice-${peerId}`;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.setAttribute("playsinline", "");
        audio.setAttribute("webkit-playsinline", "");
        audio.volume = 1.0;
        audio.style.display = "none";
        document.body.appendChild(audio);
        this.remoteAudioElements.set(peerId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.muted = this.isDeafened;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log("[Voice] Audio play waiting for user gesture:", e);
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] Peer ${peerId} ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed") {
        try { pc.restartIce?.(); } catch (_) {}
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Voice] Peer ${peerId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        this.closePeer(peerId);
      }
    };

    return pc;
  }

  // Call another peer (Caller side)
  async initiateCallTo(peerId) {
    if (!peerId || peerId === this.getMyId()) return;
    try {
      const pc = this.getOrCreatePeerConnection(peerId);
      this.isMakingOffer.set(peerId, true);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      });

      if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
        console.warn(`[Voice] Skip initiateCallTo, state is ${pc.signalingState}`);
        return;
      }

      await pc.setLocalDescription(offer);
      this.network.sendVoiceSignal(peerId, {
        type: "offer",
        sdp: pc.localDescription.sdp
      });
      console.log(`[Voice] Sent WebRTC offer to ${peerId}`);
    } catch (err) {
      console.warn(`[Voice] Error creating offer to ${peerId}:`, err);
    } finally {
      this.isMakingOffer.set(peerId, false);
    }
  }

  // Handle incoming WebRTC signals with Perfect Negotiation & Candidate Buffering
  async handleIncomingSignal(peerId, signal) {
    if (!peerId || !signal) return;
    try {
      const pc = this.getOrCreatePeerConnection(peerId);

      if (signal.type === "offer") {
        const isPolite = this.getMyId() > peerId;
        const offerCollision = this.isMakingOffer.get(peerId) || pc.signalingState !== "stable";

        if (offerCollision && !isPolite) {
          console.log(`[Voice] Ignoring offer collision with ${peerId} (impolite side)`);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        await this.flushPendingCandidates(peerId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.network.sendVoiceSignal(peerId, {
          type: "answer",
          sdp: pc.localDescription.sdp
        });
        console.log(`[Voice] Created and sent answer to ${peerId}`);
      } else if (signal.type === "answer") {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await this.flushPendingCandidates(peerId, pc);
          console.log(`[Voice] Remote description set for answer from ${peerId}`);
        } else {
          console.warn(`[Voice] Received answer in unexpected state: ${pc.signalingState}`);
        }
      } else if (signal.candidate) {
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          // Buffer candidate until remote description is set!
          const pending = this.pendingCandidates.get(peerId) || [];
          pending.push(signal.candidate);
          this.pendingCandidates.set(peerId, pending);
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn(`[Voice] Error adding ICE candidate:`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`[Voice] Signal error with peer ${peerId}:`, err);
    }
  }

  async flushPendingCandidates(peerId, pc) {
    const pending = this.pendingCandidates.get(peerId) || [];
    while (pending.length > 0) {
      const cand = pending.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn(`[Voice] Error adding buffered ICE candidate:`, err);
      }
    }
  }

  // Voice Activity Detection (VAD) via Web Audio API AnalyserNode
  setupVAD(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      if (this.vadInterval) clearInterval(this.vadInterval);
      this.vadInterval = setInterval(() => {
        if (!this.localStream || this.isMicMuted || !this.analyser) {
          if (this.isSpeaking) {
            this.setLocalSpeaking(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;

        // Dynamic threshold for speaking
        const SPEAKING_THRESHOLD = 20;

        if (average > SPEAKING_THRESHOLD) {
          this.silenceCounter = 0;
          if (!this.isSpeaking) {
            this.setLocalSpeaking(true);
          }
        } else {
          this.silenceCounter++;
          // Require 3 consecutive silent frames (~210ms) before toggling off
          if (this.isSpeaking && this.silenceCounter > 3) {
            this.setLocalSpeaking(false);
          }
        }
      }, 70);
    } catch (e) {
      console.warn("[Voice] AudioContext VAD setup failed:", e);
    }
  }

  setLocalSpeaking(speaking) {
    this.isSpeaking = speaking;
    this.network.sendVoiceSpeaking(speaking);
    this.trigger("speaking_change", {
      peerId: this.getMyId(),
      name: this.localPlayerName,
      isSpeaking: speaking,
      isLocal: true
    });
    this.updateSpeakingUI(this.localPlayerName, speaking);
  }

  // Toggle Microphone (Mute / Unmute)
  async toggleMic() {
    this.unlockAudio();

    if (!this.localStream) {
      const stream = await this.requestMicrophone();
      if (!stream) {
        return this.isMicMuted;
      }
    }

    this.isMicMuted = !this.isMicMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMicMuted;
      });
    }

    if (this.isMicMuted && this.isSpeaking) {
      this.setLocalSpeaking(false);
    }

    this.network.sendVoiceState({ isMuted: this.isMicMuted });
    this.trigger("mic_change", this.isMicMuted);
    this.updateVoiceUI();
    return this.isMicMuted;
  }

  // Toggle Deafen (Hearing others)
  toggleDeafen() {
    this.unlockAudio();
    this.isDeafened = !this.isDeafened;
    this.remoteAudioElements.forEach(audio => {
      audio.muted = this.isDeafened;
    });

    this.trigger("deafen_change", this.isDeafened);
    this.updateVoiceUI();
    return this.isDeafened;
  }

  // Clean-up a single peer
  closePeer(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try { pc.close(); } catch (_) {}
      this.peerConnections.delete(peerId);
    }
    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      try { audio.pause(); audio.srcObject = null; audio.remove(); } catch (_) {}
      this.remoteAudioElements.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
    this.isMakingOffer.delete(peerId);
    this.peers.delete(peerId);
    this.updateVoiceUI();
  }

  // Leave Voice Chat entirely
  leaveRoomVoice() {
    console.log("[Voice] Leaving room voice chat");
    this.isVoiceActive = false;
    this.currentRoomId = null;

    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (this.audioContext) {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.localStream = null;
    }

    this.peerConnections.forEach(pc => {
      try { pc.close(); } catch (_) {}
    });
    this.peerConnections.clear();

    this.remoteAudioElements.forEach(audio => {
      try { audio.pause(); audio.srcObject = null; audio.remove(); } catch (_) {}
    });
    this.remoteAudioElements.clear();
    this.pendingCandidates.clear();
    this.isMakingOffer.clear();
    this.peers.clear();

    this.updateVoiceUI();
  }

  // Synchronize Voice Chat UI buttons & badges
  updateVoiceUI() {
    // Lobby Voice Buttons
    const btnLobbyMic = document.getElementById("btn-voice-toggle-mic");
    const iconLobbyMic = document.getElementById("icon-voice-mic");
    const labelLobbyMic = document.getElementById("label-voice-mic");
    const btnLobbyDeafen = document.getElementById("btn-voice-toggle-deafen");
    const iconLobbyDeafen = document.getElementById("icon-voice-deafen");
    const labelLobbyDeafen = document.getElementById("label-voice-deafen");
    const badgePeers = document.getElementById("voice-peers-badge");

    // In-Game HUD Voice Buttons
    const btnHudMic = document.getElementById("btn-hud-voice-mic");
    const btnHudDeafen = document.getElementById("btn-hud-voice-deafen");

    const connectedCount = this.peers.size + 1; // peers + self

    if (badgePeers) {
      if (this.isVoiceActive) {
        badgePeers.textContent = `${connectedCount} in voice`;
        badgePeers.classList.add("active");
      } else {
        badgePeers.textContent = "Offline";
        badgePeers.classList.remove("active");
      }
    }

    // Mic Button states
    if (this.isMicMuted) {
      if (btnLobbyMic) {
        btnLobbyMic.classList.remove("voice-mic-active");
        btnLobbyMic.classList.add("voice-mic-muted");
      }
      if (iconLobbyMic) iconLobbyMic.textContent = "🔇";
      if (labelLobbyMic) labelLobbyMic.textContent = "MUTED";

      if (btnHudMic) {
        btnHudMic.classList.remove("voice-active");
        btnHudMic.classList.add("voice-muted");
        btnHudMic.textContent = "🔇";
      }
    } else {
      if (btnLobbyMic) {
        btnLobbyMic.classList.add("voice-mic-active");
        btnLobbyMic.classList.remove("voice-mic-muted");
      }
      if (iconLobbyMic) iconLobbyMic.textContent = "🎙️";
      if (labelLobbyMic) labelLobbyMic.textContent = "MIC ON";

      if (btnHudMic) {
        btnHudMic.classList.add("voice-active");
        btnHudMic.classList.remove("voice-muted");
        btnHudMic.textContent = "🎙️";
      }
    }

    // Deafen Button states
    if (this.isDeafened) {
      if (btnLobbyDeafen) {
        btnLobbyDeafen.classList.add("voice-deafened");
      }
      if (iconLobbyDeafen) iconLobbyDeafen.textContent = "🔇";
      if (labelLobbyDeafen) labelLobbyDeafen.textContent = "MUTED";

      if (btnHudDeafen) {
        btnHudDeafen.classList.add("voice-deafened");
        btnHudDeafen.textContent = "🔇";
      }
    } else {
      if (btnLobbyDeafen) {
        btnLobbyDeafen.classList.remove("voice-deafened");
      }
      if (iconLobbyDeafen) iconLobbyDeafen.textContent = "🔊";
      if (labelLobbyDeafen) labelLobbyDeafen.textContent = "SOUND";

      if (btnHudDeafen) {
        btnHudDeafen.classList.remove("voice-deafened");
        btnHudDeafen.textContent = "🔊";
      }
    }
  }

  // Real-time floating speaking indicator in HUD
  updateSpeakingUI(speakerName, isSpeaking) {
    const activityPill = document.getElementById("hud-voice-activity");
    const nameEl = document.getElementById("hud-voice-speaker-name");
    if (!activityPill) return;

    if (isSpeaking) {
      if (nameEl) nameEl.textContent = `${speakerName} is speaking...`;
      activityPill.classList.remove("hidden");
    } else {
      // Check if any other peer is currently speaking
      let otherSpeaking = null;
      for (const [, peer] of this.peers) {
        if (peer.isSpeaking) {
          otherSpeaking = peer.name;
          break;
        }
      }
      if (this.isSpeaking) {
        otherSpeaking = this.localPlayerName;
      }

      if (otherSpeaking) {
        if (nameEl) nameEl.textContent = `${otherSpeaking} is speaking...`;
        activityPill.classList.remove("hidden");
      } else {
        activityPill.classList.add("hidden");
      }
    }
  }
}
