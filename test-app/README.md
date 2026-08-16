# Task List App

A simple React demo app with login, user profile, and task management. Two users are pre-loaded with hardcoded data.

## Tech stack

- React 19 + Vite
- React Router v7 (client-side routing)
- Tailwind CSS v4

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:8084 in your browser.

## Sample accounts

| Username | Password |
|----------|----------|
| alice    | password1 |
| bob      | password2 |

Each user has their own task list. Sessions are not persisted — refreshing the page returns you to the login screen.

## Project structure

```
src/
  data.js                    # All hardcoded users and tasks (single source of truth)
  context/AuthContext.jsx    # Login state, task toggling, profile updates
  components/NavBar.jsx      # Top navigation bar
  pages/
    LoginPage.jsx            # Username + password login form
    ProfilePage.jsx          # Editable name and email
    TasksPage.jsx            # Per-user task list with done/undone toggle
  App.jsx                    # React Router setup and protected routes
```

## Other commands

```bash
npm run build    # Production build → dist/
npm run preview  # Preview the production build locally
```
