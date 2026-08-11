import { useEffect, useRef, useState } from 'react';
import './settings.css';

const SPECIAL = {
  Space: { token: 'Space', label: 'Space' },
  Enter: { token: 'Enter', label: 'Enter' },
  Tab: { token: 'Tab', label: 'Tab' },
  Escape: { token: 'Escape', label: 'Esc' },
  Backspace: { token: 'Backspace', label: 'Backspace' },
  Delete: { token: 'Delete', label: 'Del' },
  Insert: { token: 'Insert', label: 'Ins' },
  Home: { token: 'Home', label: 'Home' },
  End: { token: 'End', label: 'End' },
  PageUp: { token: 'PageUp', label: 'PgUp' },
  PageDown: { token: 'PageDown', label: 'PgDn' },
  ArrowUp: { token: 'Up', label: 'Up' },
  ArrowDown: { token: 'Down', label: 'Down' },
  ArrowLeft: { token: 'Left', label: 'Left' },
  ArrowRight: { token: 'Right', label: 'Right' }
};

function buildBinding(event) {
  const parts = [];
  const labelParts = [];
  if (event.ctrlKey) {
    parts.push('Control');
    labelParts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
    labelParts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
    labelParts.push('Shift');
  }
  if (event.metaKey) {
    parts.push('Super');
    labelParts.push('Win');
  }

  const finish = (token, label) => ({
    accelerator: [...parts, token].join('+'),
    label: [...labelParts, label].join('+')
  });

  const code = event.code || '';

  if (code === 'ControlLeft' || code === 'ControlRight' || code === 'ShiftLeft' || code === 'ShiftRight' || code === 'AltLeft' || code === 'AltRight' || code === 'MetaLeft' || code === 'MetaRight') return null;

  const fnMatch = /^F\d{1,2}$/.test(code);
  if (fnMatch) return finish(code, code);

  const key = event.key;
  if (key && key.length === 1) {
    let token = key;
    if (/^[a-zA-Z]$/.test(token)) token = token.toUpperCase();
    if (token === ' ') token = 'Space';
    return finish(token, token);
  }

  if (code === 'Space') return finish('Space', 'Space');

  const special = SPECIAL[code];
  if (special) return finish(special.token, special.label);

  const numMatch = code.match(/^Numpad(\d)$/);
  if (numMatch) return finish('num' + numMatch[1], 'Num ' + numMatch[1]);

  return null;
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

      const binding = buildBinding(event);
      if (!binding) return;

      if (which === 'ptt') {
        setPttAccel(binding.accelerator);
        setPttLabel(binding.label);
        window.lexion?.updateHotkeys?.({ pttKey: binding.accelerator, pttLabel: binding.label });
      } else {
        setToggleAccel(binding.accelerator);
        setToggleLabel(binding.label);
        window.lexion?.updateHotkeys?.({ overlayToggleKey: binding.accelerator, overlayToggleLabel: binding.label });
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
      <p className="settings-hint">
        Press any key to set it — letters, numbers, symbols and F-keys all work. The pressed key is detected directly,
        so custom keyboard layouts work too. Push-to-talk is disabled while the floating ball is hidden.
      </p>

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