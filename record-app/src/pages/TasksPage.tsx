import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function TasksPage() {
  const { user, tasks, addTask, toggleTask } = useAuth();
  const [inputValue, setInputValue] = useState('');

  if (!user) return null;

  const userTasks = tasks.filter((t) => t.userId === user.id);
  const done = userTasks.filter((t) => t.done).length;
  const total = userTasks.length;

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    addTask(inputValue.trim());
    setInputValue('');
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1
        data-testid="task-page-heading"
        className="text-2xl font-bold mb-2"
      >
        {user.name}'s tasks
      </h1>
      <p
        data-testid="task-progress"
        className="text-gray-500 mb-4"
      >
        {done} / {total} done
      </p>
      <ul data-testid="task-list" className="mb-6 flex flex-col gap-2">
        {userTasks.map((task) => (
          <li
            key={task.id}
            data-testid={`task-item-${task.id}`}
            onClick={() => toggleTask(task.id)}
            className="flex items-center gap-3 p-3 bg-white rounded shadow cursor-pointer hover:bg-gray-50"
          >
            <input
              data-testid={`task-checkbox-${task.id}`}
              type="checkbox"
              checked={task.done}
              onChange={() => toggleTask(task.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4"
            />
            <span
              data-testid={`task-title-${task.id}`}
              className={task.done ? 'line-through text-gray-400' : ''}
            >
              {task.title}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          data-testid="new-task-input"
          type="text"
          placeholder="Add a task…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button
          data-testid="new-task-submit"
          type="submit"
          disabled={!inputValue.trim()}
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </form>
    </div>
  );
}
