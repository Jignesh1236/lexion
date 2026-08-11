import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Ball from './Ball/index.js';
import Chat from './Chat/index.js';
import { LexionPeer } from './peer/LexionPeer.js';
import './overlay.css';

const BALL_SIZE = 72;

function pointInRect(x, y, rect) {
  if (!rect) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function hitCircle(x, y, rect, size) {
  if (!rect) return false;
  const cx = rect.left + size / 2;
  const cy = rect.top + size / 2;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= (size / 2) * (size / 2);
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
  const interactiveRef = useRef(false);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

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

  const isInsideInteractive = useCallback((x, y) => {
    const ballRect = ballRectRef.current;
    if (ballRect && hitCircle(x, y, ballRect, BALL_SIZE)) return true;

    if (chatOpenRef.current) {
      const panelRect = chatRef.current?.getBoundingClientRect();
      if (pointInRect(x, y, panelRect)) return true;
    }

    const setupRect = setupRef.current?.getBoundingClientRect?.();
    if (setupRect && pointInRect(x, y, setupRect)) return true;

    return false;
  }, []);

  const updateInteractive = useCallback(
    (x, y) => {
      const inside = isInsideInteractive(x, y);
      if (inside !== interactiveRef.current) {
        interactiveRef.current = inside;
        window.overlay?.setInteractive?.(inside);
      }
    },
    [isInsideInteractive]
  );

  useEffect(() => {
    const onMove = (event) => updateInteractive(event.clientX, event.clientY);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [updateInteractive]);

  useEffect(() => {
    const onBlur = () => {
      interactiveRef.current = false;
      window.overlay?.setInteractive?.(false);
      setChatOpen(false);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  const onBallClick = () => setChatOpen((open) => !open);
  const onToggleVoice = () => peerRef.current?.toggleMic();

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