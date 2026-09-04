# uivisor

A YAML-driven web UI test runner. Write user flows in plain YAML — navigate, type, tap, assert — and run them against a real browser via Playwright.

This repo is a monorepo with two packages:

| Package | Description |
|---------|-------------|
| [`uivisor-app/`](./uivisor-app/) | The `uivisor` CLI — the test runner itself |
| [`test-app/`](./test-app/) | A sample React app to run tests against |

---

## Prerequisites

- **Node.js 24+** (both packages require it; use [nvm](https://github.com/nvm-sh/nvm) and run `nvm use` in each directory)
- **npm 10+**

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd uivisor
```

### 2. Set up the test app

The test app is a small React app with login, profile, and task management — it's the target the flows run against.

```bash
cd test-app
nvm use          # switches to Node 24
npm install
npm run dev      # starts the app — note the port printed in the output
```

Leave this running, then open a new terminal for the next steps.

### 3. Set up the test runner

```bash
cd uivisor-app
nvm use          # switches to Node 24
npm install
npx playwright install chromium
npm run build
```

### 4. (Optional) Link the CLI globally

```bash
npm link
```

This makes the `uivisor` command available anywhere in your terminal. Without it, use `npx uivisor` from the workspace root instead.

---

## Running Flows

With the test app running, run the included example flows:

```bash
# Run all flows in a directory
npx uivisor test test-app/flows/

# Run a single flow
npx uivisor test test-app/flows/login-happy.yaml

# Run headed with slow motion (useful for watching/debugging)
npx uivisor test test-app/flows/login-happy.yaml --headed --slow-mo 500

# Generate an HTML report
npx uivisor test test-app/flows/ --reporter html
```

The CLI exits with code `0` if all flows pass, or `1` if any fail — compatible with CI pipelines.

---

## Writing Your Own Flows

Create a `.yaml` file in your project:

```yaml
appId: http://localhost:3000
commands:
  - goto: http://localhost:3000/login
  - inputText:
      element:
        testId: "username"
      text: "alice"
  - tapOn:
      testId: "submit"
  - assertUrl: /dashboard
  - assertVisible: "Welcome, Alice"
```

See [`uivisor-app/README.md`](./uivisor-app/README.md) for the full command reference and selector options.

---

## Running Tests (for `uivisor-app` development)

```bash
cd uivisor-app

npm test              # all tests
npm run test:unit     # unit tests only
npm run test:integration  # integration tests only
```

---

## Docker / Podman

To build and run the test runner in a container:

```bash
cd uivisor-app
docker compose up --build
# or: podman compose up --build
```
