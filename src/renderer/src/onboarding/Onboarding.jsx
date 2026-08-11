import { useState } from 'react';
import { steps } from './steps.js';
import './onboarding.css';

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  const step = steps[current];
  const isLast = current === steps.length - 1;

  const value = step.id === 'name' ? name : username;
  const canProceed = !['name', 'username'].includes(step.id) || value.trim() !== '';

  const handleNext = () => {
    if (!canProceed) return;
    if (isLast) {
      onComplete({ name, username });
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <div className="onboarding">
      <h1>{step.title}</h1>
      <p>{step.description}</p>

      {step.id === 'name' && (
        <input
          className="onboarding-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      )}

      {step.id === 'username' && (
        <input
          className="onboarding-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
      )}

      <div className="onboarding-nav">
        {current > 0 && (
          <button onClick={() => setCurrent(current - 1)}>Back</button>
        )}
        <button onClick={handleNext} disabled={!canProceed}>
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>

      <div className="onboarding-dots">
        {steps.map((s, i) => (
          <span key={s.id} className={i === current ? 'active' : ''} />
        ))}
      </div>
    </div>
  );
}