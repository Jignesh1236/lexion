import { forwardRef, useEffect, useRef, useState } from 'react';
import './Chat.css';

const GAP = 10;

function positionPanel(ballPos, panelWidth, panelHeight, viewport, isAbove) {
  const vw = viewport.width;
  const vh = viewport.height;
  const BALL = 72;

  let top = null;
  let bottom = null;

  let ballY = ballPos ? ballPos.y : Math.max(0, vh - BALL);
  let ballX = ballPos ? ballPos.x : Math.max(0, vw - BALL);

  const ballCenterY = ballY + BALL / 2;

  if (isAbove) {
    top = Math.max(0, ballY - panelHeight - GAP);
  } else {
    bottom = Math.max(0, vh - (ballY + BALL) - GAP);
  }

  let left = 0;
  const ballCenterX = ballX + BALL / 2;
  const maxLeft = vw - panelWidth;

  if (ballCenterX < vw / 2) {
    left = ballX;
  } else {
    left = ballX + BALL - panelWidth;
  }
  left = Math.max(0, Math.min(left, maxLeft));

  return { left, top, bottom, isAbove };
}

const Chat = forwardRef(function Chat(
  { open, ballPos, messages, canSend, status, onClose, onSend },
  ref
) {
  const [input, setInput] = useState('');
  const [size, setSize] = useState({ width: 300, height: 300 });
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  const measure = () => {
    const el = ref?.current;
    if (!el) return;
    setSize({ width: el.offsetWidth || 300, height: el.offsetHeight || 300 });
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (open) measure();
  }, [open, messages]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) {
      setInput('');
      if (inputRef.current) inputRef.current.focus();
    }
  }, [open]);

  const isAbove = !ballPos || ballPos.y + 72 < window.innerHeight / 2;
  const placement = positionPanel(ballPos, size.width, size.height, { width: window.innerWidth, height: window.innerHeight }, isAbove);

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
    top: placement.top !== null ? placement.top : 'auto',
    bottom: placement.bottom !== null ? placement.bottom : 'auto',
    display: open ? 'flex' : 'none'
  };

  return (
    <div ref={ref} id="lexion-chat" className={['lexion-chat', isAbove ? 'composer-top' : ''].join(' ')} style={panelStyle}>
      <div ref={messagesRef} id="lexion-messages">
        {messages.map((message, index) => (
          <div key={index} className={['lexion-message', message.partner ? 'is-partner' : ''].filter(Boolean).join(' ')}>
            {message.text}
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
    </div>
  );
});

export default Chat;