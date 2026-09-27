import { useState, type FormEvent } from 'react';
import { apiFetch } from '../api';

type LoginProps = {
  onLogin: () => void;
  onRegisterClick: () => void;
};

export default function Login({ onLogin, onRegisterClick }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      localStorage.setItem('token', data.token);

      onLogin();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to log in.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <form
  onSubmit={handleSubmit}
  style={{
    width: 320,
    background: 'white',
    padding: 24,
    borderRadius: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
  }}
>
        <h2
            style={{
            marginTop: 0,
            color: '#222',
        }}
>
  GridLock Login
</h2>

        <label style={{ color: '#222' }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 6,
              marginBottom: 14,
              padding: 10,
            }}
          />
        </label>

        <label style={{ color: '#222' }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 6,
              marginBottom: 14,
              padding: 10,
            }}
          />
        </label>

        {error && (
          <p style={{ color: 'crimson' }}>
            {error}
          </p>
        )}

        <button
  type="submit"
  disabled={loading}
  style={{
    width: '100%',
    padding: 10,
    cursor: loading ? 'default' : 'pointer',
  }}
>
  {loading ? 'Logging in...' : 'Login'}
</button>

<button
  type="button"
  onClick={onRegisterClick}
  style={{
    width: '100%',
    padding: 10,
    marginTop: 10,
    cursor: 'pointer',
  }}
>
  Create Account
</button>

      </form>
    </div>
  );
}
