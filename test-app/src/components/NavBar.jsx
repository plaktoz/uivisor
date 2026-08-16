import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!currentUser) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex gap-4">
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-800"}`
          }
        >
          Tasks
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-800"}`
          }
        >
          Profile
        </NavLink>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-400 hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </nav>
  );
}
