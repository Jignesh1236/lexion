import { useEffect, useState } from 'react';
import Onboarding from './onboarding/Onboarding.jsx';
import Home from './home/Home.jsx';
import Profile from './profile/Profile.jsx';

const USER_FILE = 'user.json';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');

  useEffect(() => {
    window.api.loadData(USER_FILE).then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <Onboarding
        onComplete={(data) => {
          setUser(data);
          window.api.saveData(USER_FILE, data);
        }}
      />
    );
  }

  if (view === 'profile') {
    return (
      <Profile
        user={user}
        onSave={(data) => {
          setUser(data);
          window.api.saveData(USER_FILE, data);
          setView('home');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  return <Home user={user} onNavigate={setView} />;
}