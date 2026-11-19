import { useEffect, useState } from 'react';
import Onboarding from './onboarding/Onboarding.jsx';
import Home from './home/Home.jsx';
import { sanitizePeerId } from './utils/sanitizePeerId.js';

const USER_FILE = 'user.json';
const CONNECT_FILE = 'connect.json';

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
        onComplete={async (data) => {
          setUser(data);
          await window.api.saveData(USER_FILE, data);

          // Make the overlay usable immediately: derive a Peer ID from the
          // profile instead of waiting for the Settings screen to be opened.
          const connect = (await window.api.loadData(CONNECT_FILE)) || {};
          const username = sanitizePeerId(data.username || data.name);
          if (username && !connect.username) {
            await window.api.saveData(CONNECT_FILE, {
              toastDurationSec: 5,
              ...connect,
              username
            });
          }
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
