# Copilot coding instructions for AI Work Diary

## Core behavior

- Keep changes small and task-focused.
- Prefer existing patterns and utilities over new frameworks.
- Validate with repository commands before finalizing:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e` (when Playwright browsers are installed)

## Security and data expectations

- SQLite is server-local (`apps/web/data/workdiary.db`); never move app data to browser storage.
- Browser `localStorage` is only for auth/session client values.
- Never commit secrets, access tokens, refresh tokens, or DB files.
- Treat all request headers and body fields as untrusted input.

## Efficient context/token usage

- Read only relevant files.
- Prefer focused searches and minimal diffs.
- Avoid repeating unchanged code.
- Keep responses concise and implementation-oriented.

## Browser compatibility targets

Maintain compatibility for major and requested browsers:
- Atlas
- Comet
- Opera
- Firefox
- Chrome
- Edge
- Safari
