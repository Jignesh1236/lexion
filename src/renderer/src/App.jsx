import { useEffect, useState } from 'react';
import Onboarding from './onboarding/Onboarding.jsx';
import Home from './home/Home.jsx';

const USER_FILE = 'user.json';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <Home
      user={user}
      onUserSave={(data) => {
        setUser(data);
        window.api.saveData(USER_FILE, data);
      }}
    />
  );
}