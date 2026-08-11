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

  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [inputId, setInputId] = useState('');
  const [outputId, setOutputId] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [testRunning, setTestRunning] = useState(false);
  const [permError, setPermError] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState('');
  const [devicesReady, setDevicesReady] = useState(false);

  const listeningRef = useRef(null);
  listeningRef.current = listening;

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const levelArrRef = useRef(null);
  const canvasRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const testAudioRef = useRef(null);

  useEffect(() => {
    window.api.loadData('connect.json').then((data) => {
      if (!data) return;
      setPttAccel(data.pttKey || '');
      setPttLabel(data.pttLabel || 'None');
      setToggleAccel(data.overlayToggleKey || '');
      setToggleLabel(data.overlayToggleLabel || 'None');
      setInputId(data.audioInputId || '');
      setOutputId(data.audioOutputId || '');
    });
  }, []);

  const refreshDevices = async () => {
    setPermError('');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const all = await navigator.mediaDevices.enumerateDevices();
        const ins = all.filter((d) => d.kind === 'audioinput');
        const outs = all.filter((d) => d.kind === 'audiooutput');
        setInputDevices(ins);
        setOutputDevices(outs);
        setDevicesReady(true);
        return { ins, outs };
      }
    } catch (err) {
      console.error('enumerateDevices error:', err);
    }
    return { ins: [], outs: [] };
  };

  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handler);
    }
    return () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handler);
      }
    };
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

  const stopTest = () => {
    setTestRunning(false);
    setMicLevel(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    levelArrRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const drawIdleWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const mid = height / 2;
    for (let x = 0; x <= width; x++) {
      const y = mid;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    drawIdleWave();
  }, []);

  const startTest = async () => {
    setPermError('');
    stopTest();
    setRecordedUrl('');
    setRecording(false);
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      };
      if (inputId) constraints.audio.deviceId = { exact: inputId };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      await refreshDevices();

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const actx = new AudioCtx();
      audioCtxRef.current = actx;
      if (actx.state === 'suspended') await actx.resume().catch(() => {});

      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      levelArrRef.current = new Uint8Array(analyser.frequencyBinCount);

      if (typeof MediaRecorder !== 'undefined') {
        try {
          const rec = new MediaRecorder(stream);
          chunksRef.current = [];
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size) chunksRef.current.push(e.data);
          };
          rec.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedUrl(url);
          };
          recorderRef.current = rec;
        } catch (err) {
          console.warn('MediaRecorder unavailable:', err);
        }
      }

      setTestRunning(true);
      const canvas = canvasRef.current;
      const draw = () => {
        if (!analyserRef.current || !levelArrRef.current || !canvas) return;
        const arr = levelArrRef.current;
        analyserRef.current.getByteTimeDomainData(arr);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = (arr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / arr.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
        setMicLevel(normalized);

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = `rgba(88, 101, 242, ${0.6 + normalized * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const step = width / arr.length;
        for (let i = 0; i < arr.length; i++) {
          const x = i * step;
          const y = ((arr[i] - 128) / 128) * (height / 2 - 4) + height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);
    } catch (err) {
      console.error('mic test error:', err);
      setPermError(err && err.name === 'NotAllowedError' ? 'Microphone permission denied. Allow it in browser/app permissions.' : 'Could not open microphone.');
      stopTest();
    }
  };

  const toggleRecord = () => {
    if (!testRunning || !recorderRef.current) return;
    if (!recording) {
      chunksRef.current = [];
      try {
        recorderRef.current.start();
        setRecording(true);
      } catch (err) {
        console.error('record start error:', err);
      }
    } else {
      try {
        recorderRef.current.stop();
      } catch (err) {
        console.error('record stop error:', err);
      }
      setRecording(false);
    }
  };

  const playRecording = async () => {
    if (!recordedUrl) return;
    if (!testAudioRef.current) {
      testAudioRef.current = new Audio();
    }
    const el = testAudioRef.current;
    el.src = recordedUrl;
    if (outputId && typeof el.setSinkId === 'function') {
      try { await el.setSinkId(outputId); } catch (err) { console.warn('setSinkId error:', err); }
    }
    try { await el.play(); } catch (err) { console.error('playback error:', err); }
  };

  const saveAudioSettings = async () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
    try {
      const existing = (await window.api.loadData('connect.json')) || {};
      const next = { ...existing, audioInputId: inputId, audioOutputId: outputId };
      await window.api.saveData('connect.json', next);
      window.overlay?.applyAudioDevices?.(inputId, outputId);
    } catch (err) {
      console.error('save audio settings error:', err);
    }
  };

  const deviceLabel = (d, fallback) => {
    if (d && d.label) return d.label;
    return fallback;
  };

  return (
    <section className="preferences">
      <h2>Audio Devices</h2>
      <p className="preferences-hint">
        Select your microphone and speaker. Hit Test Mic to check levels — say a few words, record a clip, then play it back on the selected output.
      </p>

      <div className="preferences-field">
        <span>Microphone Input</span>
        <select
          className="preferences-select"
          value={inputId}
          onChange={(e) => {
            setInputId(e.target.value);
            if (testRunning) setTimeout(startTest, 50);
          }}
        >
          <option value="">Default System Microphone</option>
          {inputDevices.map((d) => (
            <option key={d.deviceId || d.label} value={d.deviceId}>
              {deviceLabel(d, 'Unknown Microphone')}
            </option>
          ))}
          {!devicesReady && <option value="" disabled>Loading devices...</option>}
        </select>
      </div>

      <div className="preferences-field">
        <span>Speaker / Output</span>
        <select
          className="preferences-select"
          value={outputId}
          onChange={(e) => setOutputId(e.target.value)}
        >
          <option value="">Default System Output</option>
          {outputDevices.map((d) => (
            <option key={d.deviceId || d.label} value={d.deviceId}>
              {deviceLabel(d, 'Unknown Output')}
            </option>
          ))}
          {!devicesReady && <option value="" disabled>Loading devices...</option>}
        </select>
      </div>

      <div className="preferences-mic-test">
        <div className="preferences-mic-visual">
          <canvas ref={canvasRef} width={420} height={80} className="preferences-wave"></canvas>
          <div className="preferences-meter">
            <div className="preferences-meter-fill" style={{ width: `${Math.round(micLevel * 100)}%` }}></div>
          </div>
        </div>
        <div className="preferences-mic-actions">
          {!testRunning ? (
            <button type="button" className="preferences-key preferences-key--primary" onClick={startTest}>
              {permError ? 'Retry Mic Test' : 'Test Microphone'}
            </button>
          ) : (
            <button type="button" className="preferences-key" onClick={stopTest}>
              Stop Test
            </button>
          )}
          {testRunning && (
            <button
              type="button"
              className={['preferences-key', recording ? 'is-recording' : ''].filter(Boolean).join(' ')}
              onClick={toggleRecord}
            >
              {recording ? '● Stop Recording' : '● Record Clip'}
            </button>
          )}
          {recordedUrl && (
            <button type="button" className="preferences-key" onClick={playRecording}>
              ▶ Play on Selected Output
            </button>
          )}
        </div>
        {permError && <p className="preferences-error">{permError}</p>}
        {testRunning && !permError && (
          <p className="preferences-hint">
            {recording ? 'Recording... press Stop Recording when done.' : 'Speak now — the waveform and meter above should respond to your voice.'}
          </p>
        )}
        {recordedUrl && !testRunning && (
          <p className="preferences-hint">Recording captured. Hit "Play on Selected Output" to verify your chosen speaker.</p>
        )}
      </div>

      <div className="preferences-actions">
        <button type="button" className="preferences-key preferences-key--primary" onClick={saveAudioSettings}>
          {saved ? 'Saved ✓' : 'Save Audio Settings'}
        </button>
        <button type="button" className="preferences-key" onClick={refreshDevices}>
          ↻ Refresh Devices
        </button>
      </div>

      {saved && <p className="preferences-saved">Saved ✓</p>}

      <h2 style={{ marginTop: '1rem' }}>Keybindings</h2>
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
    </section>
  );
}
