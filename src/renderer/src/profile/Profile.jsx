import { useState } from 'react';
import './profile.css';

export default function Profile({ user, onSave, onBack }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username || '');

  const canSave = name.trim() !== '' && (username.trim() !== '' || username === '');

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name, username });
  };

  return (
    <main className="profile">
      <button className="profile__back" onClick={onBack}>&larr; Back</button>

      <div className="profile__card">
        <h1>Profile</h1>

        <label className="profile__field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </label>

        <label className="profile__field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        </label>

        <button className="profile__save" onClick={handleSave}>Save Changes</button>
      </div>
    </main>
  );
}