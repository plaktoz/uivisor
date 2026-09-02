import { createContext, useContext, useState, type ReactNode } from 'react';
import { USERS, TASKS, type User, type Task } from '../data';

interface AuthContextValue {
  user: User | null;
  tasks: Task[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(TASKS);

  function login(username: string, password: string): boolean {
    const found = USERS.find(
      (u) => (u.email === username || u.name.toLowerCase() === username.toLowerCase()) &&
             u.password === password
    );
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
  }

  function addTask(title: string) {
    if (!user) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      userId: user.id,
      title,
      done: false,
    };
    setTasks((prev) => [...prev, newTask]);
  }

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  return (
    <AuthContext.Provider value={{ user, tasks, login, logout, addTask, toggleTask, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
