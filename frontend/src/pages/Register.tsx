import { useState, type FormEvent } from 'react';
import { apiFetch } from '../api';

type RegisterProps = {
  onRegister: () => void;
  onLoginClick: () => void;
};

export default function Register({
  onRegister,
  onLoginClick,
}: RegisterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [utilityId, setUtilityId] = useState('1');
  const [contactVisibility, setContactVisibility] =
    useState('authenticated');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          utility_id: Number(utilityId),
          name,
          email,
          password,
          contact_visibility: contactVisibility,
        }),
      });

      localStorage.setItem('token', data.token);

      onRegister();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to register.'
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
          Create Account
        </h2>

        <label style={{ color: '#222' }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
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

        <label style={{ color: '#222' }}>
          Utility ID
          <input
            type="number"
            min="1"
            value={utilityId}
            onChange={(event) => setUtilityId(event.target.value)}
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
          Contact visibility
          <select
            value={contactVisibility}
            onChange={(event) =>
              setContactVisibility(event.target.value)
            }
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 6,
              marginBottom: 14,
              padding: 10,
            }}
          >
            <option value="authenticated">Authenticated users</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
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
  {loading ? 'Creating account...' : 'Register'}
</button>

<button
  type="button"
  onClick={onLoginClick}
  style={{
    width: '100%',
    padding: 10,
    marginTop: 10,
    cursor: 'pointer',
  }}
>
  Back to Login
</button>
      </form>
    </div>
  );
}
