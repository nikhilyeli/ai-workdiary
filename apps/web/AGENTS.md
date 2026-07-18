<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## AI Work Diary repository rules

These apply to all coding agents working in this project.

### Engineering

1. Keep changes focused and minimal.
2. Reuse existing patterns and utilities.
3. Validate with existing commands:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npm run test:e2e` (when Playwright browsers are available)

### Security and data handling

1. SQLite data remains server-local at `apps/web/data/workdiary.db`.
2. Browser `localStorage` is only for client auth/session values.
3. Never commit secrets, tokens, or database files.
4. Treat headers and all user inputs as untrusted.

### Efficient token/context usage

1. Read only relevant files for the task.
2. Prefer targeted searches over full-repo scans.
3. Avoid repeating unchanged code in outputs.
4. Batch related reads/edits when practical.

### Browser support

Browser-facing behavior should remain compatible with:
- Atlas
- Comet
- Opera
- Firefox
- Chrome
- Edge
- Safari
