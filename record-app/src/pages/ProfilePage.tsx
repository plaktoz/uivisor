import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUser({ ...user!, name, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div
        data-testid="profile-avatar"
        className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold mb-4"
      >
        {initials}
      </div>
      <p data-testid="profile-display-name" className="text-xl font-semibold mb-1">
        {user.name}
      </p>
      <p data-testid="profile-display-email" className="text-gray-500 mb-6">
        {user.email}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          data-testid="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          data-testid="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          data-testid="profile-submit"
          type="submit"
          className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700"
        >
          Save
        </button>
        {saved && (
          <span
            data-testid="profile-saved"
            className="text-green-600 text-sm text-center"
          >
            Saved!
          </span>
        )}
      </form>
    </div>
  );
}
