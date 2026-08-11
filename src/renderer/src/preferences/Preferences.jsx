import { useEffect, useRef, useState } from 'react';
import { buildBinding } from '../utils/keyBindings.js';
import './preferences.css';

export default function Preferences() {
  const [pttAccel, setPttAccel] = useState('');
  const [pttLabel, setPttLabel] = useState('None');
  const [toggleAccel, setToggleAccel] = useState('');
  const [toggleLabel, setToggleLabel] = useState('None');
  const [listening, setListening] = useState(null);
  const [saved, setSaved] = useState(false);

  const listeningRef = useRef(null);
  listeningRef.current = listening;

  useEffect(() => {
    window.api.loadData('connect.json').then((data) => {
      if (!data) return;
      setPttAccel(data.pttKey || '');
      setPttLabel(data.pttLabel || 'None');
      setToggleAccel(data.overlayToggleKey || '');
      setToggleLabel(data.overlayToggleLabel || 'None');
    });
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
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
      setListening(null);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <section className="preferences">
      <h2>Keybindings</h2>
      <p className="preferences-hint">
        Press any key to set it — letters, numbers, symbols and F-keys all work. The pressed key is detected directly, so
        custom keyboard layouts work too. Push-to-talk is disabled while the floating ball is hidden.
      </p>

      <div className="preferences-field">
        <span>Push-to-talk (toggle mic)</span>
        <button
          type="button"
          className={['preferences-key', listening === 'ptt' ? 'is-listening' : ''].filter(Boolean).join(' ')}
          onClick={() => setListening(listening === 'ptt' ? null : 'ptt')}
        >
          {listening === 'ptt' ? 'Press a key...' : pttLabel}
        </button>
      </div>

      <div className="preferences-field">
        <span>Overlay toggle</span>
        <button
          type="button"
          className={['preferences-key', listening === 'toggle' ? 'is-listening' : ''].filter(Boolean).join(' ')}
          onClick={() => setListening(listening === 'toggle' ? null : 'toggle')}
        >
          {listening === 'toggle' ? 'Press a key...' : toggleLabel}
        </button>
      </div>

      {saved && <p className="preferences-saved">Saved ✓</p>}
    </section>
  );
}