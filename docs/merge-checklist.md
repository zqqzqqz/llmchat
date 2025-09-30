# Main Branch Merge Checklist

To safely merge the `work` delivery branch into `main` on [wilson323/llmchat](https://github.com/wilson323/llmchat), walk through the following checklist so the enterprise features remain stable after integration.

## 1. Sync & Review
- Fetch the latest `origin/main` and rebase the local `work` branch: `git fetch origin && git rebase origin/main`.
- Resolve any conflicts in backend services (`backend/src/services`), controllers, and admin dashboard components. Re-run linting if configuration files changed.
- Verify that `config/agents.json` still reflects the canonical agent definitions managed through the admin UI; regenerate snapshots if administrators modified data directly in production.

## 2. Database & Migration Verification
- Run `npm run backend:build` to ensure TypeScript migrations compile.
- Execute `npm run backend:test` locally to confirm the PostgreSQL bootstrap (`initDB`) still creates the `agents`, `chat_sessions`, `chat_messages`, and geo-tracking tables without manual steps.
- If the production database already contains data, validate `AgentConfigService.syncFromDatabase()` completes without attempting to re-import fixtures from JSON.

## 3. Frontend Regression Checks
- Build the frontend bundle with `npm run frontend:build`; confirm ECharts-based dashboards render without runtime warnings when pointed at staging APIs.
- Verify the admin FASTGPT management workflow on desktop and mobile widths (≥320px): creating, editing, importing, deleting, and toggling agents should immediately refresh the shared cache.
- Confirm the chat client pulls all agent metadata from the backend by clearing local storage and reloading—no residual fallback to static `agents.json` should exist.

## 4. End-to-End Validation
- Run the aggregated pipeline: `npm test`. The backend Jest suites (`agentConfigService.test.ts`, `analyticsService.test.ts`) must pass in-band, and the frontend placeholder script should still execute without missing-script failures.
- Smoke-test the streaming chat flow: initialize a session via the admin-initialized parameters, send a message with attachments or voice placeholders, and use the abort/stop controls to ensure the UI reacts gracefully.
- Inspect the admin analytics dashboard for the conversation trend chart, agent comparison bar chart, and China province heat map across date ranges.

## 5. Merge & Monitor
- After completing checks, merge with a fast-forward commit: `git checkout main && git merge --ff-only work`.
- Push to the remote and create a release PR summarizing database migrations, agent governance updates, geo analytics, and UX refinements.
- Monitor error logs and analytics for at least one release cycle, focusing on initialization failures, geo lookup errors, and caching inconsistencies.

Document completion of each step in `docs/test-report.md` so future deployments remain auditable.
