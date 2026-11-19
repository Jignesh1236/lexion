# Contributing to Lexion

Thanks for taking the time to help. This guide keeps changes predictable and reviewable.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- Search existing issues and pull requests before opening a new one.
- For anything larger than a bug fix (new feature, new dependency, UX change), open an issue
  first so we can agree on the approach.
- Never include real peer IDs, TURN credentials, or personal audio in a bug report.

## Development setup

Requirements: Node.js 20.19+ and npm 10+.

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build      # production build in out/
npm start          # preview the production build
npm run dist:dir   # unpacked package in release/ (smoke test)
```

If Electron's binary download fails behind a proxy, set `ELECTRON_MIRROR` to a reachable mirror or
reinstall with `npm install electron --force`.

To test two peers locally, launch a second isolated instance:

```bash
npm run dev:second
```

Each profile gets its own `userData` directory, so the two instances can use different usernames.

## Project conventions

### Process boundaries

- **Main process** (`src/main/`) — windows, tray, menus, global shortcuts, file storage. Never
  render UI here.
- **Preload** (`src/preload/index.js`) — the only bridge between renderer and main. Expose small,
  purpose-built functions; never expose `ipcRenderer` directly.
- **Renderer** (`src/renderer/`) — React UI and WebRTC. No Node APIs; use `window.api`,
  `window.overlay`, and `window.lexion`.

New IPC channels should be namespaced (`app:*`, `overlay:*`, `lexion:*`) and validated in the main
process (see `basename()` usage for file access).

### Code style

- JavaScript + JSX, ES modules, semicolons, single quotes, 2-space indentation.
- Components are PascalCase files (`Settings.jsx`); utilities are camelCase (`sanitizePeerId.js`).
- Keep side effects in `useEffect`; keep refs in `useRef`. Follow the existing cleanup patterns.
- Prefer small pure helpers in `src/renderer/src/utils/` when logic is reused or testable.
- Match the surrounding formatting rather than reformatting unrelated lines.
- No new runtime dependency without discussion. Prefer platform APIs and the existing stack.

### UI changes

The current interface is intentionally minimal and monochrome. UI redesigns are out of scope for
drive-by pull requests; propose them in an issue with a mockup first. Bug fixes that preserve the
existing look are always welcome.

### Peer IDs and audio

- Peer IDs are sanitized with `sanitizePeerId()`; keep validation consistent on both sides.
- Microphone tracks must stay disabled until the user explicitly talks (`micOn`).
- Always stop media tracks and close `AudioContext` instances on cleanup.
- Treat any change to `LexionPeer` as security-sensitive: validate peer identity before accepting
  calls or data connections.

## Making a change

1. Fork the repository and create a branch:
   - `feat/short-description`
   - `fix/short-description`
   - `docs/short-description`
   - `chore/short-description`
2. Make the smallest change that solves the problem.
3. Update documentation if behavior, configuration, or commands change.
4. Verify the build:
   ```bash
   npm run build
   ```
5. Manually smoke-test the affected flow (see below).
6. Open a pull request using the template.

### Commit messages

Use the conventional prefix and an imperative summary:

```
feat: add partner quick-connect to settings
fix: preserve audio device IDs when saving connection settings
docs: document the connect.json fields
```

Keep commits focused. Squash fixup commits before requesting review.

## Manual test checklist

There is no automated E2E suite yet, so please run the relevant items by hand:

- [ ] Onboarding completes and the orb appears.
- [ ] Settings saves and the overlay reconnects with the new Peer ID.
- [ ] Changing audio devices does not wipe partner or hotkey settings.
- [ ] Push-to-talk and show/hide hotkeys work globally.
- [ ] Orb dragging, edge snapping, stashing, and un-stashing work.
- [ ] Chat sends and receives; message previews expire after the configured duration.
- [ ] Closing the main window leaves Lexion running in the tray.
- [ ] `npm run build` succeeds.

## Pull request expectations

- Explain **what** changed and **why**, with reproduction steps for bugs.
- Include screenshots or a short recording for any visible change.
- Call out trade-offs, follow-up work, and anything not covered by testing.
- Keep the diff free of unrelated formatting or dependency churn.
- Be responsive to review comments. Maintainers may ask for a smaller scope.

## Reporting bugs

Use the bug report template and include:

- OS and version
- Lexion version (About screen or `package.json`)
- Steps to reproduce
- Expected vs. actual behavior
- Console output from the main window (`Settings → Dev Tools`) and overlay
  (`Settings → Overlay Dev Tools`) if relevant

For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
