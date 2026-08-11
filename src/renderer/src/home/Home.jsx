import './home.css';

export default function Home({ user, onNavigate }) {
  return (
    <main className="home">
      <aside className="home__settings">
        <ul>
          <li className="home__settings-item is-active" onClick={() => onNavigate('home')}>
            Home
          </li>
          <li className="home__settings-item" onClick={() => onNavigate('profile')}>
            Profile
          </li>
          <li className="home__settings-item">Settings</li>
          <li className="home__settings-item">About</li>
        </ul>
      </aside>

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
    </main>
  );
}