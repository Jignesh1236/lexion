import Peer from 'peerjs';

function sanitizePeerId(value) {
  if (!value) return null;
  const clean = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return clean || null;
}

export class LexionPeer {
  constructor(username, callbacks = {}) {
    this.cbs = callbacks;
    this.peer = null;
    this.currentCall = null;
    this.dataConnection = null;
    this.localStream = null;
    this.micTrack = null;
    this.micOn = false;
    this.audioContext = null;
    this.analyser = null;
    this.audioData = null;
    this.speakTimer = null;
    this.connectTimer = null;
    this.reconnectTimer = null;
    this.disposed = false;
    this.myPeerId = sanitizePeerId(username);
    this.partnerPeerId = null;
    this.state = {
      phase: 'starting',
      connected: false,
      talking: false,
      partnerSpeaking: false,
      chatReady: false,
      message: ''
    };

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    };

    if (!this.myPeerId) {
      this.emit({ phase: 'error', message: 'Invalid username' });
      return;
    }

    this.peer = new Peer(this.myPeerId, {
      debug: 3,
      config
    });

    this.peer.on('open', (id) => {
      this.myPeerId = id;
      this.emit({ phase: 'ready', message: `Ready: ${id}` });
    });
    this.peer.on('disconnected', () => {
      this.emit({ phase: 'disconnected', connected: false });
      if (!this.disposed) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.disposed) return;
          try {
            this.peer.reconnect();
          } catch {}
        }, 500);
      }
    });
    this.peer.on('error', (error) => {
      console.error('[LexionPeer] error:', error);
      this.emit({ phase: 'error', message: this.mapError(error) });
    });
    this.peer.on('call', (call) => this.handleIncomingCall(call));
    this.peer.on('connection', (connection) => this.handleIncomingConnection(connection));
  }

  emit(next) {
    if (this.disposed) return;
    this.state = { ...this.state, ...next };
    this.cbs.onStatus?.(this.state);
  }

  async ensureMic() {
    if (this.localStream) return this.localStream;
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    this.micTrack = this.localStream.getAudioTracks()[0];
    if (this.micTrack) this.micTrack.enabled = false;
    return this.localStream;
  }

  async connect(partnerId) {
    const cleanPartner = sanitizePeerId(partnerId);
    if (!cleanPartner) {
      this.emit({ phase: 'error', message: 'Invalid partner username' });
      return;
    }
    if (cleanPartner === this.myPeerId) {
      this.emit({ phase: 'error', message: 'You cannot connect to yourself' });
      return;
    }
    this.partnerPeerId = cleanPartner;
    this.emit({ phase: 'connecting', connected: false, message: 'Connecting...' });

    clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      if (this.disposed) return;
      if (this.state.phase === 'connecting' && !this.state.connected) {
        this.emit({
          phase: 'error',
          message: 'Could not establish the voice call. Check the partner username, or if NAT blocks it try the same network.'
        });
      }
    }, 25000);

    try {
      const stream = await this.ensureMic();
      const startConnections = () => {
        if (this.disposed) return;
        const data = this.peer.connect(this.partnerPeerId, { reliable: true, serialization: 'json' });
        this.setupData(data);
        const call = this.peer.call(this.partnerPeerId, stream);
        this.setupCall(call);
      };
      if (this.peer.open) startConnections();
      else this.peer.once('open', startConnections);
    } catch (error) {
      console.error('[LexionPeer] ensureMic failed:', error);
      this.clearConnectTimer();
      this.emit({ phase: 'error', message: 'Microphone permission denied' });
    }
  }

  setupCall(call) {
    if (this.disposed) return;

    if (this.currentCall && this.currentCall !== call) {
      try { this.currentCall.close(); } catch {}
    }
    this.currentCall = call;

    call.on('stream', (remoteStream) => {
      this.clearConnectTimer();
      this.attachRemoteAudio(remoteStream);
      this.monitorRemoteAudio(remoteStream);
      this.emit({ connected: true, phase: 'connected', message: 'Connected' });
    });

    call.on('iceStateChanged', (state) => {
      if (state === 'connected' || state === 'completed') {
        this.clearConnectTimer();
        if (!this.state.connected) {
          this.emit({ connected: true, phase: 'connected', message: 'Connected' });
        }
      } else if (state === 'checking') {
      } else if (state === 'failed') {
        this.clearConnectTimer();
        this.emit({ phase: 'error', message: 'ICE failed — try same Wi-Fi or disable VPN' });
      } else if (state === 'disconnected' || state === 'closed') {
        if (this.state.connected) {
          this.cleanupAudio();
          this.emit({ connected: false, partnerSpeaking: false, phase: 'disconnected', message: 'Disconnected', talking: false });
        }
      }
    });

    call.on('close', () => {
      this.clearConnectTimer();
      this.cleanupAudio();
      if (this.currentCall === call) this.currentCall = null;
      this.emit({ connected: false, partnerSpeaking: false, phase: 'disconnected', message: 'Disconnected', talking: false });
    });

    call.on('error', (error) => {
      console.error('[LexionPeer] call error:', error);
      this.clearConnectTimer();
      this.emit({ phase: 'error', message: 'Voice connection error: ' + (error?.type || error?.message || 'unknown') });
    });
  }

  attachRemoteAudio(remoteStream) {
    try {
      let audio = document.getElementById('lexion-remote-audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'lexion-remote-audio';
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.setAttribute('playsinline', '');
        audio.setAttribute('webkit-playsinline', '');
        document.body.appendChild(audio);
      }
      audio.srcObject = remoteStream;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          console.warn('[LexionPeer] audio.play blocked:', err);
          const resumeOnce = () => {
            audio.play().catch(() => {});
            document.removeEventListener('click', resumeOnce);
            document.removeEventListener('keydown', resumeOnce);
          };
          document.addEventListener('click', resumeOnce, { once: true });
          document.addEventListener('keydown', resumeOnce, { once: true });
        });
      }
    } catch (err) {
      console.error('[LexionPeer] attachRemoteAudio error:', err);
    }
  }

  clearConnectTimer() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  handleIncomingConnection(connection) {
    if (this.disposed) {
      try { connection.close(); } catch {}
      return;
    }
    const partnerId = connection.peer;
    if (this.partnerPeerId && this.partnerPeerId !== partnerId) {
      console.warn('[LexionPeer] rejecting data conn from unknown peer:', partnerId);
      try { connection.close(); } catch {}
      return;
    }
    const knownPartner = this.partnerPeerId === partnerId;
    const hasDataConn = this.dataConnection && this.dataConnection !== connection;
    const existingPartner = this.dataConnection?.peer;
    if (knownPartner && hasDataConn && existingPartner === partnerId) {
      const iKeepIncoming = partnerId < this.myPeerId;
      if (!iKeepIncoming) {
        console.warn('[LexionPeer] dedup: closing incoming data conn, keeping existing');
        try { connection.close(); } catch {}
        return;
      }
      console.warn('[LexionPeer] dedup: replacing outgoing data conn with incoming');
    }
    if (!this.partnerPeerId) this.partnerPeerId = partnerId;
    this.setupData(connection);
  }

  setupData(connection) {
    if (this.disposed) return;

    if (this.dataConnection && this.dataConnection !== connection) {
      try { this.dataConnection.close(); } catch {}
    }
    this.dataConnection = connection;

    let didOpen = false;
    const openTimeout = setTimeout(() => {
      if (!didOpen && !this.disposed) {
        console.warn('[LexionPeer] data conn open timeout, will retry via incoming');
      }
    }, 10000);

    connection.on('open', () => {
      didOpen = true;
      clearTimeout(openTimeout);
      if (this.disposed) return;
      this.clearConnectTimer();
      this.emit({ chatReady: true });
    });
    connection.on('data', (data) => {
      if (this.disposed) return;
      if (data && data.type === 'message') this.cbs.onMessage?.(data.text);
    });
    connection.on('close', () => {
      clearTimeout(openTimeout);
      if (this.dataConnection === connection) {
        this.dataConnection = null;
        this.emit({ chatReady: false });
      }
    });
    connection.on('error', (err) => {
      clearTimeout(openTimeout);
      console.error('[LexionPeer] data connection error:', err);
    });
  }

  handleIncomingCall(call) {
    if (this.disposed) {
      try { call.close(); } catch {}
      return;
    }
    const partnerId = call.peer;
    if (this.partnerPeerId && this.partnerPeerId !== partnerId) {
      console.warn('[LexionPeer] rejecting call from unknown peer:', partnerId);
      try { call.close(); } catch {}
      return;
    }
    const knownPartner = this.partnerPeerId === partnerId;
    const hasCall = this.currentCall && this.currentCall !== call;
    const existingPartner = this.currentCall?.peer;
    if (knownPartner && hasCall && existingPartner === partnerId) {
      const iKeepIncoming = partnerId < this.myPeerId;
      if (!iKeepIncoming) {
        console.warn('[LexionPeer] dedup: closing incoming call, keeping existing');
        try { call.close(); } catch {}
        return;
      }
      console.warn('[LexionPeer] dedup: replacing outgoing call with incoming');
    }
    if (!this.partnerPeerId) this.partnerPeerId = partnerId;
    this.ensureMic()
      .then((stream) => {
        if (!this.disposed) {
          call.answer(stream);
          this.setupCall(call);
        }
      })
      .catch((err) => {
        console.error('[LexionPeer] ensureMic for incoming call failed:', err);
        this.emit({ phase: 'error', message: 'Microphone permission denied' });
      });
  }

  sendMessage(text) {
    if (!this.dataConnection || !this.dataConnection.open) return false;
    try {
      this.dataConnection.send({ type: 'message', text });
      return true;
    } catch (err) {
      console.error('[LexionPeer] sendMessage error:', err);
      return false;
    }
  }

  setMic(on) {
    this.ensureMic()
      .then(() => {
        if (!this.micTrack || this.disposed) return;
        this.micOn = !!on;
        this.micTrack.enabled = this.micOn;
        this.emit({ talking: this.micOn });
      })
      .catch((err) => {
        console.error('[LexionPeer] setMic error:', err);
        this.emit({ phase: 'error', message: 'Microphone permission denied' });
      });
  }

  toggleMic() {
    this.setMic(!this.micOn);
  }

  monitorRemoteAudio(stream) {
    this.cleanupAudio();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
        const resumeOnce = () => {
          this.audioContext?.resume().catch(() => {});
          document.removeEventListener('click', resumeOnce);
          document.removeEventListener('keydown', resumeOnce);
        };
        document.addEventListener('click', resumeOnce, { once: true });
        document.addEventListener('keydown', resumeOnce, { once: true });
      }
      this.detectSpeaking();
    } catch (error) {
      console.error('[LexionPeer] monitorRemoteAudio error:', error);
    }
  }

  cleanupAudio() {
    this.emit({ partnerSpeaking: false });
    if (this.speakTimer) clearTimeout(this.speakTimer);
    this.speakTimer = null;
    if (this.audioContext) this.audioContext.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
    this.audioData = null;
  }

  detectSpeaking() {
    if (!this.analyser || this.disposed) return;
    try {
      this.analyser.getByteFrequencyData(this.audioData);
      let total = 0;
      for (let i = 0; i < this.audioData.length; i++) total += this.audioData[i];
      const average = total / this.audioData.length;
      if (average > 12) {
        if (!this.state.partnerSpeaking) this.emit({ partnerSpeaking: true });
        clearTimeout(this.speakTimer);
        this.speakTimer = setTimeout(() => {
          if (!this.disposed) this.emit({ partnerSpeaking: false });
        }, 180);
      }
    } catch {}
    if (!this.disposed) requestAnimationFrame(() => this.detectSpeaking());
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearConnectTimer();
    if (this.speakTimer) clearTimeout(this.speakTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanupAudio();
    if (this.micTrack) this.micTrack.enabled = false;
    try { this.currentCall?.close(); } catch {}
    try { this.dataConnection?.close(); } catch {}
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.micTrack = null;
    this.currentCall = null;
    this.dataConnection = null;
    try { this.peer?.destroy(); } catch {}
    this.peer = null;
  }

  mapError(error) {
    if (!error) return 'Peer error';
    switch (error.type) {
      case 'unavailable-id':
        return 'Username already taken';
      case 'peer-unavailable':
        return 'Partner not found (wrong username?)';
      case 'network':
        return 'Network or signaling error';
      default:
        return 'PeerJS: ' + (error.type || 'error');
    }
  }
}
