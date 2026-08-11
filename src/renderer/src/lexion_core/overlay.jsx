import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Ball from './Ball/index.js';
import Chat from './Chat/index.js';
import { LexionPeer } from './peer/LexionPeer.js';
import './overlay.css';

const BALL_SIZE = 72;

function buildInteractiveAreas(ballRect, chatRect, setupRect, previewRect) {
  const areas = [];

  if (ballRect) {
    const r = ballRect.width / 2;
    areas.push({ type: 'circle', x: ballRect.left + r, y: ballRect.top + r, r });
  }

  if (chatRect) {
    areas.push({ type: 'rect', x: chatRect.left, y: chatRect.top, w: chatRect.width, h: chatRect.height });
  }

  if (setupRect) {
    areas.push({ type: 'rect', x: setupRect.left, y: setupRect.top, w: setupRect.width, h: setupRect.height });
  }

  if (previewRect) {
    areas.push({ type: 'rect', x: previewRect.left, y: previewRect.top, w: previewRect.width, h: previewRect.height });
  }

  return areas;
}

function Overlay() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState({
    phase: 'starting',
    connected: false,
    talking: false,
    partnerSpeaking: false,
    chatReady: false,
    message: ''
  });
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [ballPos, setBallPos] = useState(null);
  const [unread, setUnread] = useState(0);
  const [preview, setPreview] = useState(null);

  const peerRef = useRef(null);
  const ballRectRef = useRef(null);
  const chatRef = useRef(null);
  const setupRef = useRef(null);
  const previewRef = useRef(null);
  const draggingRef = useRef(false);
  const chatOpenRef = useRef(false);
  const previewTimerRef = useRef(null);
  const settingsRef = useRef(null);
  chatOpenRef.current = chatOpen;
  settingsRef.current = settings;

  const reportAreas = useCallback(() => {
    const ballRect = ballRectRef.current?.getBoundingClientRect?.();
    const chatRect = chatOpenRef.current ? chatRef.current?.getBoundingClientRect?.() : null;
    const setupRect = setupRef.current?.getBoundingClientRect?.();
    const previewRect = previewRef.current?.getBoundingClientRect?.();
    const areas = buildInteractiveAreas(ballRect, chatRect, setupRect, previewRect);
    window.overlay?.setAreas?.(areas);
  }, []);

  useEffect(() => {
    reportAreas();
    const interval = setInterval(reportAreas, 250);
    window.addEventListener('resize', reportAreas);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', reportAreas);
    };
  }, [reportAreas]);

  useEffect(() => {
    reportAreas();
  }, [chatOpen, reportAreas]);

  const pushStatus = useCallback((next) => {
    setStatus((prev) => {
      const merged = { ...prev, ...next };
      try { window.overlay?.sendStatus?.(merged); } catch (err) { console.warn('pushStatus send failed:', err); }
      return merged;
    });
  }, []);

  useEffect(() => {
    try {
      window.overlay?.sendStatus?.({
        phase: 'booting',
        connected: false,
        talking: false,
        partnerSpeaking: false,
        chatReady: false,
        message: 'Overlay booting…'
      });
    } catch (err) {
      console.warn('initial sendStatus failed:', err);
    }
    const bootTimer = setTimeout(() => {
      pushStatus({ phase: 'starting', message: 'Waiting for username…' });
    }, 50);
    return () => clearTimeout(bootTimer);
  }, [pushStatus]);

  useEffect(() => {
    const handleError = (event) => {
      const err = event.error || event.message || 'unknown';
      console.error('[overlay] window error:', err);
      try {
        pushStatus({
          phase: 'error',
          message: err?.message ? err.message : String(err)
        });
      } catch (inner) {
        console.warn('[overlay] pushStatus inside error handler failed:', inner);
      }
    };
    const handleRejection = (event) => {
      const reason = event.reason || 'unknown rejection';
      console.error('[overlay] unhandledrejection:', reason);
      try {
        pushStatus({
          phase: 'error',
          message: reason?.message ? reason.message : String(reason)
        });
      } catch (inner) {
        console.warn('[overlay] pushStatus inside rejection handler failed:', inner);
      }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [pushStatus]);

  const addIncoming = useCallback((text) => {
    setMessages((list) => [...list.slice(-19), { text, partner: true, time: Date.now() }]);
    if (!chatOpenRef.current) {
      setUnread((n) => n + 1);
      const duration = Math.max(1, Math.min(60, Number(settingsRef.current?.toastDurationSec) || 5)) * 1000;
      setPreview({ text, time: Date.now() });
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => setPreview(null), duration);
    }
  }, []);

  const startPeer = useCallback(
    (saved) => {
      const peer = new LexionPeer(saved.username, {
        onStatus: pushStatus,
        onMessage: addIncoming
      }, {
        audioInputId: saved.audioInputId || '',
        audioOutputId: saved.audioOutputId || ''
      });
      peerRef.current = peer;
      if (saved.partner) peer.connect(saved.partner);
      return peer;
    },
    [pushStatus, addIncoming]
  );

  const applyAudioDevices = useCallback(
    async (inputId, outputId) => {
      const peer = peerRef.current;
      if (!peer) return;
      try {
        peer.changeAudioOutput(outputId || '');
      } catch (err) {
        console.warn('changeAudioOutput error:', err);
      }
      try {
        if (peer.localStream) {
          await peer.changeAudioInput(inputId || '');
          if (peer.currentCall && peer.localStream) {
            const newTrack = peer.localStream.getAudioTracks()[0];
            if (newTrack) {
              const oldTrack = peer.micTrack;
              const wasEnabled = oldTrack ? oldTrack.enabled : false;
              try {
                const sender = peer.currentCall.peerConnection
                  ?.getSenders
                  ?.()
                  ?.find((s) => s.track && s.track.kind === 'audio');
                if (sender) {
                  await sender.replaceTrack(newTrack);
                }
              } catch (err) {
                console.warn('replaceTrack failed, falling back to reconnect:', err);
              }
              peer.micTrack = newTrack;
              if (peer.micOn) newTrack.enabled = true;
              else newTrack.enabled = wasEnabled && !!peer.micOn;
            }
          }
        } else {
          peer.audioInputId = inputId || '';
        }
      } catch (err) {
        console.warn('changeAudioInput error:', err);
      }
    },
    []
  );

  useEffect(() => {
    const offApplyAudio = window.overlay.onApplyAudioDevices((inputId, outputId) => {
      applyAudioDevices(inputId, outputId);
    });
    return offApplyAudio;
  }, [applyAudioDevices]);

  useEffect(() => {
    let cancelled = false;

    window.api.loadData('connect.json').then((saved) => {
      if (cancelled) return;
      setSettings(saved || null);
      if (saved && saved.username) {
        try {
          startPeer(saved);
        } catch (err) {
          console.error('[overlay] startPeer on load failed:', err);
          pushStatus({ phase: 'error', message: err?.message ? err.message : String(err) });
        }
      } else {
        pushStatus({ phase: 'no-username', connected: false, chatReady: false, message: 'Set your username in Lexion settings' });
      }
    }).catch((err) => {
      console.error('[overlay] loadData connect.json failed:', err);
      pushStatus({ phase: 'error', message: 'Failed to load connect settings' });
    });

    const offApply = window.overlay.onApplySettings((next) => {
      setSettings(next);
      try {
        peerRef.current?.dispose();
      } catch (err) {
        console.warn('[overlay] peer dispose error:', err);
      }
      peerRef.current = null;
      setMessages([]);
      setUnread(0);
      setPreview(null);
      if (next && next.username) {
        try {
          startPeer(next);
        } catch (err) {
          console.error('[overlay] startPeer on apply failed:', err);
          pushStatus({ phase: 'error', message: err?.message ? err.message : String(err) });
        }
      } else {
        pushStatus({ phase: 'no-username', connected: false, chatReady: false, message: 'Set your username in Lexion settings' });
      }
    });

    return () => {
      cancelled = true;
      offApply?.();
      try {
        peerRef.current?.dispose();
      } catch (err) {
        console.warn('[overlay] cleanup dispose error:', err);
      }
    };
  }, [startPeer, pushStatus]);

  useEffect(() => {
    const offPtt = window.overlay.onPttToggle(() => peerRef.current?.toggleMic());
    return offPtt;
  }, []);

  useEffect(() => () => {
    clearTimeout(previewTimerRef.current);
  }, []);

  useEffect(() => {
    const onBlur = () => {
      setChatOpen(false);
      if (!draggingRef.current) window.overlay?.forceIgnore?.();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  const onBallClick = () => {
    reportAreas();
    setChatOpen((open) => {
      const next = !open;
      if (next) {
        setUnread(0);
        setPreview(null);
        clearTimeout(previewTimerRef.current);
      }
      return next;
    });
    setTimeout(reportAreas, 0);
    setTimeout(reportAreas, 50);
    setTimeout(reportAreas, 150);
  };

  const onPreviewClick = () => {
    setChatOpen(true);
    setPreview(null);
    setUnread(0);
    clearTimeout(previewTimerRef.current);
    setTimeout(reportAreas, 0);
    setTimeout(reportAreas, 50);
  };

  const dismissPreview = (e) => {
    e?.stopPropagation?.();
    setPreview(null);
    clearTimeout(previewTimerRef.current);
    setTimeout(reportAreas, 0);
  };

  const onToggleVoice = () => {
    peerRef.current?.toggleMic();
  };

  const onBallTalkStart = () => {
    const peer = peerRef.current;
    if (!peer) return;
    peer.ensureMic().then(
      () => peer.setMic(true),
      (err) => {
        console.warn('onBallTalkStart ensureMic failed:', err);
        pushStatus({ phase: 'error', message: 'Microphone permission denied' });
      }
    );
  };

  const onBallTalkStop = () => peerRef.current?.setMic(false);

  const onDragChange = (dragging) => {
    draggingRef.current = dragging;
    window.overlay?.setDrag?.(dragging);
    if (!dragging) reportAreas();
  };

  const onSendMessage = (text) => {
    const ok = peerRef.current?.sendMessage(text);
    if (ok) setMessages((list) => [...list.slice(-19), { text, partner: false, time: Date.now() }]);
    return !!ok;
  };

  const showSetup = !settings || !settings.username;

  return (
    <>
      {showSetup && (
        <div ref={setupRef} className="lexion-setup">
          <p>No username configured yet.</p>
          <button type="button" onClick={() => window.overlay?.openMain?.()}>
            Open Lexion Settings
          </button>
        </div>
      )}

      <Ball
        size={BALL_SIZE}
        connected={status.connected}
        talking={status.talking}
        partnerSpeaking={status.partnerSpeaking}
        unread={unread}
        onRef={(el) => {
          ballRectRef.current = el;
        }}
        onPositionChange={setBallPos}
        onClick={onBallClick}
        onToggleVoice={onToggleVoice}
        onDragChange={onDragChange}
        onTalkStart={onBallTalkStart}
        onTalkStop={onBallTalkStop}
      />

      {preview && !chatOpen && ballPos && (
        <div
          ref={previewRef}
          key={preview.time}
          className="lexion-preview"
          style={{
            left: Math.min(ballPos.x + BALL_SIZE + 10, Math.max(10, window.innerWidth - 280)),
            top: Math.min(ballPos.y, Math.max(0, window.innerHeight - 80))
          }}
          onClick={onPreviewClick}
          role="button"
          tabIndex={0}
          title="Click to open chat"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onPreviewClick();
            if (e.key === 'Escape') dismissPreview(e);
          }}
        >
          <span className="lexion-preview-text">{preview.text}</span>
          <button
            type="button"
            className="lexion-preview-close"
            title="Dismiss"
            onClick={dismissPreview}
          >
            ✕
          </button>
        </div>
      )}

      <Chat
        ref={chatRef}
        open={chatOpen}
        ballPos={ballPos}
        messages={messages}
        canSend={status.chatReady}
        status={status}
        onClose={() => setChatOpen(false)}
        onSend={onSendMessage}
      />
    </>
  );
}

createRoot(document.getElementById('root')).render(<Overlay />);