import { useState } from 'react';
import GridMap from './components/GridMap';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('token'))
  );

  const [showRegister, setShowRegister] = useState(false);

  function handleLogin() {
    setIsAuthenticated(true);
  }

  function handleRegister() {
    setIsAuthenticated(true);
  }

  function handleLogout() {
  localStorage.removeItem('token');
  setIsAuthenticated(false);
  setShowRegister(false);
}

  if (!isAuthenticated) {
    return showRegister ? (
      <Register
  onRegister={handleRegister}
  onLoginClick={() => setShowRegister(false)}
/>
    ) : (
      <Login
  onLogin={handleLogin}
  onRegisterClick={() => setShowRegister(true)}
/>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <GridMap />

      <button
        onClick={handleLogout}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          background: 'white',
          border: 'none',
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          color: '#222',
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default App;
