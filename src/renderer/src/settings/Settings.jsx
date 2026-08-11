import { useEffect, useRef, useState } from 'react';
import './settings.css';

const KEY_NAMES = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Delete: 'Del',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt'
};

function toAccelerator(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');

  let key = event.code || '';
  if (/^Key[A-Z]$/.test(key)) key = key.slice(3);
  else if (/^Digit\d$/.test(key)) key = key.slice(5);
  else if (/^F\d{1,2}$/.test(key)) key = key;
  else if (key === 'Space') key = 'Space';
  else if (/^Numpad\d$/.test(key)) key = key.slice(6);
  else if (/^Arrow/.test(key)) key = key.slice(5);
  else if (['Escape', 'Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) key = key;
  else return null;

  return [...parts, key].join('+');
}

function toLabel(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Win');

  const code = event.code || '';
  let key = code;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else if (KEY_NAMES[code]) key = KEY_NAMES[code];

  return [...parts, key].join('+') || 'None';
}

function statusText(status) {
  if (!status) return 'Waiting for overlay status...';
  if (status.talking) return 'Talking (mic on)';
  switch (status.phase) {
    case 'no-username':
      return 'No username set yet';
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return status.message || 'Error';
    case 'ready':
      return 'Ready';
    case 'disconnected':
      return status.message || 'Disconnected';
    default:
      return status.message || status.phase;
  }
}

export default function Settings() {
  const [username, setUsername] = useState('');
  const [partner, setPartner] = useState('');
  const [pttAccel, setPttAccel] = useState('');
  const [pttLabel, setPttLabel] = useState('None');
  const [toggleAccel, setToggleAccel] = useState('');
  const [toggleLabel, setToggleLabel] = useState('None');
  const [listening, setListening] = useState(null);
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const listeningRef = useRef(null);
  listeningRef.current = listening;

  useEffect(() => {
    window.api.loadData('connect.json').then((data) => {
      if (!data) return;
      setUsername(data.username || '');
      setPartner(data.partner || '');
      setPttAccel(data.pttKey || '');
      setPttLabel(data.pttLabel || 'None');
      setToggleAccel(data.overlayToggleKey || '');
      setToggleLabel(data.overlayToggleLabel || 'None');
    });
  }, []);

  useEffect(() => {
    const off = window.lexion?.onStatus?.((next) => setStatus(next));
    return off;
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const which = listeningRef.current;
      if (!which) return;
      event.preventDefault();
      event.stopPropagation();

      if (event.code === 'Escape') {
        setListening(null);
        return;
      }

      const accel = toAccelerator(event);
      if (!accel) return;
      const label = toLabel(event);

      if (which === 'ptt') {
        setPttAccel(accel);
        setPttLabel(label);
      } else {
        setToggleAccel(accel);
        setToggleLabel(label);
      }
      setListening(null);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const save = async () => {
    setError('');
    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only use A-Z, a-z, 0-9, _ and -.');
      return;
    }

    const data = {
      username: username.trim(),
      partner: partner.trim(),
      pttKey: pttAccel || null,
      pttLabel,
      overlayToggleKey: toggleAccel || null,
      overlayToggleLabel: toggleLabel
    };

    await window.api.saveData('connect.json', data);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <section className="settings">
      <h2>Connection</h2>
      <p className="settings-hint">
        Your username is your Peer ID. Both of you set your own username, then enter each other's username to connect.
      </p>

      <label className="settings-field">
        <span>Your username (Peer ID)</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jignesh" />
      </label>

      <label className="settings-field">
        <span>Partner username</span>
        <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="e.g. riya" />
      </label>

      <h2>Keybindings</h2>

      <div className="settings-field">
        <span>Push-to-talk (toggle mic)</span>
        <button
          type="button"
          className={['settings-key', listening === 'ptt' ? 'is-listening' : ''].filter(Boolean).join(' ')}
          onClick={() => setListening(listening === 'ptt' ? null : 'ptt')}
        >
          {listening === 'ptt' ? 'Press a key...' : pttLabel}
        </button>
      </div>

      <div className="settings-field">
        <span>Overlay toggle</span>
        <button
          type="button"
          className={['settings-key', listening === 'toggle' ? 'is-listening' : ''].filter(Boolean).join(' ')}
          onClick={() => setListening(listening === 'toggle' ? null : 'toggle')}
        >
          {listening === 'toggle' ? 'Press a key...' : toggleLabel}
        </button>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-save" onClick={save}>
          {saved ? 'Saved ✓' : 'Save & Connect'}
        </button>
        <button type="button" className="settings-meta" onClick={() => window.lexion?.toggleOverlay?.()}>
          Toggle Floating Ball
        </button>
      </div>

      {error && <p className="settings-error">{error}</p>}

      <p className={['settings-status', status?.talking ? 'is-talking' : ''].filter(Boolean).join(' ')}>
        Status: {statusText(status)}
      </p>
    </section>
  );
}