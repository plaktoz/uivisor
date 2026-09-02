# record-app

A minimal demo web app with login, tasks, and profile pages. Built as a recording target for `uivisor-record`.

## Prerequisites

- Node >= 24
- npm >= 10

## Start the app

```bash
npm install
npm run dev
```

The app runs at [http://localhost:5174](http://localhost:5174).

## uivisor-record

Use this app as a target when recording flows with `uivisor-record`:

```bash
uivisor-record --url http://localhost:5174 --output my-flow.ts
```

## Example flow

1. Navigate to `http://localhost:5174` — you are redirected to `/login`
2. Enter username `alice` and password `password1`, then click **Login**
3. You land on `/tasks` — Alice has 10 pre-loaded tasks
4. Click a task row to toggle its completion state
5. Type a new task title and click **Add** to create it
6. Click **Profile** in the nav to visit `/profile`
7. Edit your display name or email and click **Save**
8. Click **Logout** to return to `/login`
