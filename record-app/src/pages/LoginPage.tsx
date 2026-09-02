import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = login(username, password);
    if (ok) {
      setError(false);
      navigate('/tasks');
    } else {
      setError(true);
    }
  }

  return (
    <div
      data-testid="login-page"
      className="min-h-screen flex items-center justify-center bg-gray-50"
    >
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>
        <form data-testid="login-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            data-testid="login-username"
            type="text"
            placeholder="alice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            data-testid="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button
            data-testid="login-submit"
            type="submit"
            className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700"
          >
            Login
          </button>
          {error && (
            <span
              data-testid="login-error"
              className="text-red-600 text-sm text-center"
            >
              Invalid username or password.
            </span>
          )}
          <p
            data-testid="login-hint"
            className="text-gray-400 text-xs text-center"
          >
            Try: alice / password1 · bob / password2
          </p>
        </form>
      </div>
    </div>
  );
}
