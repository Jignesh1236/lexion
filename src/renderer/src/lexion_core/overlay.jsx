import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Ball from './Ball/index.js';
import Chat from './Chat/index.js';
import { LexionPeer } from './peer/LexionPeer.js';
import './overlay.css';

const BALL_SIZE = 72;

function buildInteractiveAreas(ballRect, chatRect, setupRect) {
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

  const peerRef = useRef(null);
  const ballRectRef = useRef(null);
  const chatRef = useRef(null);
  const setupRef = useRef(null);
  const draggingRef = useRef(false);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

  const reportAreas = useCallback(() => {
    const ballRect = ballRectRef.current?.getBoundingClientRect?.();
    const chatRect = chatOpenRef.current ? chatRef.current?.getBoundingClientRect?.() : null;
    const setupRect = setupRef.current?.getBoundingClientRect?.();
    const areas = buildInteractiveAreas(ballRect, chatRect, setupRect);
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
      window.overlay?.sendStatus?.(merged);
      return merged;
    });
  }, []);

  const addIncoming = useCallback((text) => {
    setMessages((list) => [...list.slice(-19), { text, partner: true }]);
  }, []);

  const startPeer = useCallback(
    (saved) => {
      const peer = new LexionPeer(saved.username, {
        onStatus: pushStatus,
        onMessage: addIncoming
      });
      peerRef.current = peer;
      if (saved.partner) peer.connect(saved.partner);
      return peer;
    },
    [pushStatus, addIncoming]
  );

  useEffect(() => {
    let cancelled = false;

    window.api.loadData('connect.json').then((saved) => {
      if (cancelled) return;
      setSettings(saved || null);
      if (saved && saved.username) {
        startPeer(saved);
      } else {
        pushStatus({ phase: 'no-username', connected: false, chatReady: false, message: 'Set your username in Lexion settings' });
      }
    });

    const offApply = window.overlay.onApplySettings((next) => {
      setSettings(next);
      peerRef.current?.dispose();
      peerRef.current = null;
      setMessages([]);
      if (next && next.username) startPeer(next);
      else pushStatus({ phase: 'no-username', connected: false, chatReady: false, message: 'Set your username in Lexion settings' });
    });

    return () => {
      cancelled = true;
      offApply?.();
      peerRef.current?.dispose();
    };
  }, [startPeer, pushStatus]);

  useEffect(() => {
    const offPtt = window.overlay.onPttToggle(() => peerRef.current?.toggleMic());
    return offPtt;
  }, []);

  useEffect(() => {
    const onBlur = () => {
      setChatOpen(false);
      window.overlay?.forceIgnore?.();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  const onBallClick = () => setChatOpen((open) => !open);
  const onToggleVoice = () => peerRef.current?.toggleMic();

  const onDragChange = (dragging) => {
    draggingRef.current = dragging;
    window.overlay?.setDrag?.(dragging);
    if (!dragging) reportAreas();
  };

  const onSendMessage = (text) => {
    const ok = peerRef.current?.sendMessage(text);
    if (ok) setMessages((list) => [...list.slice(-19), { text, partner: false }]);
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
        onRef={(el) => {
          ballRectRef.current = el;
        }}
        onPositionChange={setBallPos}
        onClick={onBallClick}
        onToggleVoice={onToggleVoice}
        onDragChange={onDragChange}
      />

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