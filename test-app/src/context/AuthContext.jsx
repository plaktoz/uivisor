import { createContext, useContext, useState } from "react";
import { USERS, TASKS } from "../data";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState(TASKS);

  function login(username, password) {
    const user = USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (!user) return false;
    setCurrentUser(user);
    setProfile({ name: user.name, email: user.email });
    return true;
  }

  function logout() {
    setCurrentUser(null);
    setProfile(null);
  }

  function updateProfile(fields) {
    setProfile((prev) => ({ ...prev, ...fields }));
  }

  function toggleTask(taskId) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    );
  }

  const userTasks = currentUser
    ? tasks.filter((t) => t.userId === currentUser.id)
    : [];

  return (
    <AuthContext.Provider
      value={{ currentUser, profile, userTasks, login, logout, updateProfile, toggleTask }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
