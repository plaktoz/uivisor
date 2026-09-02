import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="flex items-center gap-4 px-6 py-3 bg-gray-800 text-white">
      <Link
        to="/tasks"
        data-testid="nav-tasks-link"
        className="hover:text-gray-300"
      >
        Tasks
      </Link>
      <Link
        to="/profile"
        data-testid="nav-profile-link"
        className="hover:text-gray-300"
      >
        Profile
      </Link>
      <button
        data-testid="nav-logout-btn"
        onClick={handleLogout}
        className="ml-auto hover:text-gray-300"
      >
        Logout
      </button>
    </nav>
  );
}
