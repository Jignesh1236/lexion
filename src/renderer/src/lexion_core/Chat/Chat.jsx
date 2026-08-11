import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Chat.css';

const GAP = 22;
const MARGIN = 14;

function fmtTime(time) {
  if (!time) return '';
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function positionPanel(ballPos, panelWidth, panelHeight, viewport, preferAbove) {
  const vw = viewport.width;
  const vh = viewport.height;
  const BALL = 72;

  let ballY = ballPos?.y ?? vh - BALL - 24;
  let ballX = ballPos?.x ?? vw - BALL - 24;
  ballY = Math.max(0, Math.min(ballY, vh - BALL));
  ballX = Math.max(0, Math.min(ballX, vw - BALL));

  const ballTop = ballY;
  const ballBottom = ballY + BALL;
  const ballLeft = ballX;
  const ballRight = ballX + BALL;
  const availableAbove = ballTop - GAP - MARGIN;
  const availableBelow = vh - ballBottom - GAP - MARGIN;

  let isAbove = preferAbove
    ? availableAbove >= panelHeight || availableBelow < panelHeight
    : availableBelow >= panelHeight;

  let top = 'auto';
  let bottom = 'auto';
  if (isAbove) {
    top = Math.max(MARGIN, ballTop - panelHeight - GAP);
    if (top < MARGIN) {
      top = 'auto';
      bottom = Math.max(MARGIN, vh - ballBottom - GAP - panelHeight);
      isAbove = false;
      if (bottom < MARGIN) {
        bottom = 'auto';
        top = MARGIN;
      }
    }
  } else {
    const bottomPx = vh - ballBottom - GAP - panelHeight;
    if (bottomPx >= MARGIN) {
      bottom = Math.max(MARGIN, bottomPx);
    } else {
      const topPx = ballTop - panelHeight - GAP;
      if (topPx >= MARGIN) {
        top = Math.max(MARGIN, topPx);
        isAbove = true;
      } else {
        bottom = Math.max(MARGIN, vh - panelHeight - MARGIN);
        isAbove = true;
      }
    }
  }

  const ballCenterX = (ballLeft + ballRight) / 2;
  let left;
  const maxLeft = vw - panelWidth - MARGIN;
  if (ballCenterX < vw / 2) {
    left = Math.max(MARGIN, Math.min(ballRight + GAP, maxLeft));
    if (left + panelWidth > vw - MARGIN) left = maxLeft;
  } else {
    left = Math.max(MARGIN, Math.min(ballLeft - panelWidth - GAP, maxLeft));
  }

  return { left, top, bottom, isAbove };
}

const Chat = forwardRef(function Chat(
  { open, ballPos, messages, canSend, status, onClose, onSend },
  ref
) {
  const [input, setInput] = useState('');
  const [size, setSize] = useState({ width: 300, height: 400 });
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  const measure = () => {
    const el = ref?.current;
    if (!el) return;
    setSize({
      width: el.offsetWidth || 300,
      height: el.offsetHeight || 400
    });
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useLayoutEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => measure());
      return () => cancelAnimationFrame(id);
    }
  }, [open, messages, ballPos]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) {
      setInput('');
      setTimeout(() => {
        inputRef.current?.focus();
        messagesRef.current && (messagesRef.current.scrollTop = messagesRef.current.scrollHeight);
      }, 0);
    }
  }, [open]);

  const preferAbove = !ballPos || ballPos.y + 36 > window.innerHeight / 2;
  const placement = positionPanel(
    ballPos,
    size.width,
    size.height,
    { width: window.innerWidth, height: window.innerHeight },
    preferAbove
  );
  const isAbove = placement.isAbove;

  const send = () => {
    const text = input.trim();
    if (!text) return;
    if (!canSend) return;
    const ok = onSend(text);
    if (ok) {
      setInput('');
    }
  };

  const panelStyle = {
    left: placement.left,
    top: placement.top,
    bottom: placement.bottom,
    display: open ? 'flex' : 'none'
  };

  return (
    <div
      ref={ref}
      id="lexion-chat"
      className={['lexion-chat', isAbove ? 'composer-top' : ''].join(' ')}
      style={panelStyle}
    >
      <div id="lexion-chat-head">
        <span className="lexion-chat-title">Lexion</span>
        {status && (
          <button
            id="lexion-chat-status"
            type="button"
            title="Open Lexion settings"
            className={['lexion-chat-status', `is-${status.phase || 'ready'}`].join(' ')}
            onClick={() => window.overlay?.openMain?.()}
          >
            {status.talking ? 'Talking...' : status.connected ? 'Connected' : status.message || '—'}
          </button>
        )}
        <button id="lexion-chat-close" type="button" title="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div ref={messagesRef} id="lexion-messages">
        {messages.map((message, index) => (
          <div key={index} className={['lexion-message', message.partner ? 'is-partner' : ''].filter(Boolean).join(' ')}>
            <span className="lexion-message-text">{message.text}</span>
            {message.time && <span className="lexion-message-time">{fmtTime(message.time)}</span>}
          </div>
        ))}
      </div>

      <div id="lexion-composer">
        <input
          ref={inputRef}
          id="lexion-input"
          type="text"
          maxLength="500"
          placeholder={canSend ? 'Message...' : 'Not connected'}
          autoComplete="off"
          value={input}
          disabled={!canSend}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
            if (e.key === 'Escape') onClose?.();
          }}
        />
        <button
          id="lexion-send"
          type="button"
          title="Send"
          disabled={!canSend}
          onClick={send}
        >
          ➤
        </button>
      </div>
    </div>
  );
});

export default Chat;