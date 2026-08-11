import Peer from 'peerjs';

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
    this.disposed = false;
    this.state = {
      phase: 'starting',
      connected: false,
      talking: false,
      partnerSpeaking: false,
      chatReady: false,
      message: ''
    };

    this.peer = new Peer(username);

    this.peer.on('open', (id) => this.emit({ phase: 'ready', message: `Ready: ${id}` }));
    this.peer.on('disconnected', () => this.emit({ phase: 'disconnected', connected: false }));
    this.peer.on('error', (error) => this.emit({ phase: 'error', message: this.mapError(error) }));
    this.peer.on('call', (call) => this.handleIncomingCall(call));
    this.peer.on('connection', (connection) => this.setupData(connection));
  }

  emit(next) {
    if (this.disposed) return;
    this.state = { ...this.state, ...next };
    this.cbs.onStatus?.(this.state);
  }

  async ensureMic() {
    if (this.localStream) return this.localStream;
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.micTrack = this.localStream.getAudioTracks()[0];
    if (this.micTrack) this.micTrack.enabled = false;
    return this.localStream;
  }

  async connect(partnerId) {
    if (!partnerId) return;
    this.emit({ phase: 'connecting', connected: false, message: 'Connecting...' });

    const data = this.peer.connect(partnerId);
    this.setupData(data);

    try {
      const stream = await this.ensureMic();
      const call = this.peer.call(partnerId, stream);
      this.setupCall(call);
    } catch (error) {
      this.emit({ phase: 'error', message: 'Microphone permission denied' });
    }
  }

  setupCall(call) {
    this.currentCall = call;

    call.on('stream', (remoteStream) => {
      let audio = document.getElementById('lexion-remote-audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'lexion-remote-audio';
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = remoteStream;
      audio.play().catch(() => {});

      this.monitorRemoteAudio(remoteStream);
      this.emit({ connected: true, phase: 'connected', message: 'Connected' });
    });

    call.on('close', () => {
      this.cleanupAudio();
      this.emit({ connected: false, partnerSpeaking: false, phase: 'disconnected', message: 'Disconnected', talking: false });
    });

    call.on('error', (error) => {
      this.emit({ phase: 'error', message: 'Voice connection error' });
    });
  }

  setupData(connection) {
    this.dataConnection = connection;

    connection.on('open', () => this.emit({ chatReady: true }));
    connection.on('data', (data) => {
      if (data && data.type === 'message') this.cbs.onMessage?.(data.text);
    });
    connection.on('close', () => {
      if (this.dataConnection === connection) {
        this.dataConnection = null;
        this.emit({ chatReady: false });
      }
    });
    connection.on('error', () => {});
  }

  handleIncomingCall(call) {
    this.ensureMic()
      .then((stream) => {
        if (!this.disposed) {
          call.answer(stream);
          this.setupCall(call);
        }
      })
      .catch(() => this.emit({ phase: 'error', message: 'Microphone permission denied' }));
  }

  sendMessage(text) {
    if (!this.dataConnection || !this.dataConnection.open) return false;
    this.dataConnection.send({ type: 'message', text });
    return true;
  }

  toggleMic() {
    this.ensureMic()
      .then(() => {
        if (!this.micTrack || this.disposed) return;
        this.micOn = !this.micOn;
        this.micTrack.enabled = this.micOn;
        this.emit({ talking: this.micOn });
      })
      .catch(() => this.emit({ phase: 'error', message: 'Microphone permission denied' }));
  }

  monitorRemoteAudio(stream) {
    this.cleanupAudio();
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
      this.detectSpeaking();
    } catch (error) {
      console.error(error);
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

    if (!this.disposed) requestAnimationFrame(() => this.detectSpeaking());
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.speakTimer) clearTimeout(this.speakTimer);
    this.cleanupAudio();
    if (this.micTrack) this.micTrack.enabled = false;
    this.currentCall?.close();
    this.dataConnection?.close();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.micTrack = null;
    this.peer?.destroy();
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