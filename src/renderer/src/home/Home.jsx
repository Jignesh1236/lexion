import { useState } from 'react';
import Settings from '../settings/Settings.jsx';
import Preferences from '../preferences/Preferences.jsx';
import Profile from '../profile/Profile.jsx';
import { sanitizePeerId } from '../utils/sanitizePeerId.js';
import './home.css';

const NAV_ITEMS = ['Home', 'Profile', 'Preferences', 'Settings', 'About'];

export default function Home({ user, onUserSave }) {
  const [active, setActive] = useState('Home');

  const handleProfileSave = (profile) => {
    onUserSave?.(profile);

    window.api.loadData('connect.json').then((connect) => {
      const current = connect || {};
      const username = sanitizePeerId(profile.username || profile.name);
      if (username && current.username !== username) {
        window.api.saveData('connect.json', { ...current, username });
      }
    });

    setActive('Home');
  };

  let content;

  if (active === 'Profile') {
    content = <Profile user={user} onSave={handleProfileSave} onBack={() => setActive('Home')} />;
  } else if (active === 'Settings') {
    content = <Settings user={user} />;
  } else if (active === 'Preferences') {
    content = <Preferences />;
  } else {
    content = (
      <>
        <p className="home__greeting">
          {user.name}
          {user.username && <span>@{user.username}</span>}
        </p>

        <div className="home__container">
          <div className="home__box">lexion</div>
          <div className="home__box">Box 2</div>
          <div className="home__box">Box 3</div>
          <div className="home__box">Box 4</div>
        </div>
      </>
    );
  }

  return (
    <main className="home">
      <aside className="home__settings">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li
              key={item}
              className={['home__settings-item', active === item ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setActive(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>

      {content}
    </main>
  );
}