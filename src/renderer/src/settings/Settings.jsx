import { useEffect, useState } from 'react';
import { sanitizePeerId } from '../utils/sanitizePeerId.js';
import './settings.css';

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

export default function Settings({ user }) {
  const [username, setUsername] = useState('');
  const [partner, setPartner] = useState('');
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.loadData('connect.json').then((data) => {
      if (data) {
        setUsername(data.username || '');
        setPartner(data.partner || '');
      }

      const derived = sanitizePeerId(user?.username || user?.name);
      if (!data?.username && derived) {
        setUsername(derived);
        window.api.saveData('connect.json', { ...(data || {}), username: derived });
      }
    });
  }, [user]);

  useEffect(() => {
    const off = window.lexion?.onStatus?.((next) => setStatus(next));
    return off;
  }, []);

  const save = async () => {
    setError('');
    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only use A-Z, a-z, 0-9, _ and -.');
      return;
    }

    const data = {
      username: sanitizePeerId(username.trim()) || username.trim(),
      partner: sanitizePeerId(partner.trim()) || partner.trim()
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
        <span>Your username (Peer ID) — auto-filled from profile</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jignesh" />
      </label>

      <label className="settings-field">
        <span>Partner username</span>
        <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="e.g. riya" />
      </label>

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