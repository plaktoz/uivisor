import { useAuth } from "../context/AuthContext";

export default function TasksPage() {
  const { userTasks, toggleTask, profile } = useAuth();
  const done = userTasks.filter((t) => t.done).length;

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 data-testid="task-page-heading" className="text-xl font-semibold text-gray-800">
          {profile.name}&apos;s tasks
        </h2>
        <span data-testid="task-progress" className="text-sm text-gray-400">
          {done} / {userTasks.length} done
        </span>
      </div>

      <ul data-testid="task-list" className="space-y-2">
        {userTasks.map((task) => (
          <li
            key={task.id}
            data-testid={`task-item-${task.id}`}
            onClick={() => toggleTask(task.id)}
            className="flex items-center gap-3 bg-white rounded-xl shadow-sm px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                task.done
                  ? "bg-indigo-600 border-indigo-600"
                  : "border-gray-300"
              }`}
            >
              {task.done && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span data-testid={`task-title-${task.id}`} className={`text-sm ${task.done ? "line-through text-gray-400" : "text-gray-700"}`}>
              {task.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
