import { useState } from 'react';
import Settings from '../settings/Settings.jsx';
import './home.css';

const NAV_ITEMS = ['Home', 'Profile', 'Preferences', 'General', 'Appearance', 'Settings', 'About'];

export default function Home({ user }) {
  const [active, setActive] = useState('Home');

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

      {active === 'Settings' ? (
        <Settings />
      ) : (
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
      )}
    </main>
  );
}