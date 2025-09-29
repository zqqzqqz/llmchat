# Repository Guidelines

## Project Structure & Module Organization
The repository is managed via npm workspaces with `backend/` and `frontend/`. The Express backend lives in `backend/src` with domain folders `controllers/`, `routes/`, `services/`, and cross-cutting utilities under `utils/`. Database and agent configuration files are stored under `config/` (`config.jsonc` and `agents.json`); keep local overrides out of version control. The React SPA lives in `frontend/src`, organized around `components/`, `store/` for Zustand state, `services/` for HTTP clients, and shared helpers in `lib/` and `hooks/`. Static assets ship from `frontend/src/img` and styles from `styles/`.

## Build, Test, and Development Commands
Use `npm run dev` to boot backend and frontend together (ts-node-dev + Vite). `npm run backend:dev` and `npm run frontend:dev` run each service independently. Build distributables with `npm run build`, which compiles the backend to `backend/dist` and creates a Vite production bundle in `frontend/dist`. Run targeted scripts such as `npm run backend:build` or `npm run frontend:preview` when staging deployment artifacts. Run the full test suite with `npm test`; lint TypeScript sources via `npm run backend:lint` or `npm run frontend:lint`.

## Coding Style & Naming Conventions
Both workspaces use TypeScript, two-space indentation, and single quotes. Respect path aliases (`@/...`) resolved through tsconfig-paths and Vite. Favor PascalCase for React components, camelCase for functions and variables, and suffix service modules with `Service`. Keep controllers thin and encapsulate external calls inside `services/`. Always run the relevant ESLint task before submitting changes.

## Testing Guidelines
Backend tests use Jest (`npm run backend:test` or `npm run backend:test -- --watch`), colocated under `backend/src/**/__tests__`. Mirror the existing `fastgptEvents.test.ts` pattern and stub network I/O with jest mocks. Frontend currently lacks automated coverage; new UI work should introduce `.test.tsx` files alongside components and wire them into the Jest/Vite stack (add libraries as part of the PR). Cover edge cases around authentication guards and agent switching flows, and include manual QA notes when automated coverage is not feasible.

## Commit & Pull Request Guidelines
Follow the conventional commit style seen in history (e.g., `feat: refine reasoning trail ux`). Start summaries with a lowercase imperative verb and keep them under ~72 characters. For multi-scope changes, prefer separate commits. Pull requests should describe motivation, list key changes, note testing evidence, and link issues or designs. Include screenshots or terminal outputs when touching UI or CLI behavior, and call out configuration impacts.

## Configuration & Security Notes
Backend bootstraps via `dotenv` and the JSONC config loader; provide a local `backend/.env` for secrets and update `config/config.jsonc` only with sanitized defaults. Never commit real credentials or production agent keys. When sharing configs, scrub `agents.json` of provider tokens and document any required environment variables in the PR.
