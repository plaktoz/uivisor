export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  done: boolean;
}

export const USERS: User[] = [
  { id: 'alice', name: 'Alice', email: 'alice@example.com', password: 'password1' },
  { id: 'bob', name: 'Bob', email: 'bob@example.com', password: 'password2' },
];

export const TASKS: Task[] = [
  { id: 'task-1', userId: 'alice', title: 'Buy groceries', done: false },
  { id: 'task-2', userId: 'alice', title: 'Read a book', done: true },
  { id: 'task-3', userId: 'alice', title: 'Go for a walk', done: false },
  { id: 'task-4', userId: 'alice', title: 'Write unit tests', done: false },
  { id: 'task-5', userId: 'alice', title: 'Review pull request', done: true },
  { id: 'task-6', userId: 'alice', title: 'Update documentation', done: false },
  { id: 'task-7', userId: 'alice', title: 'Fix login bug', done: true },
  { id: 'task-8', userId: 'alice', title: 'Deploy to staging', done: false },
  { id: 'task-9', userId: 'alice', title: 'Schedule team meeting', done: false },
  { id: 'task-10', userId: 'alice', title: 'Send weekly report', done: false },
  { id: 'task-11', userId: 'bob', title: 'Prepare presentation', done: false },
  { id: 'task-12', userId: 'bob', title: 'Call the client', done: true },
  { id: 'task-13', userId: 'bob', title: 'Submit expense report', done: false },
];
