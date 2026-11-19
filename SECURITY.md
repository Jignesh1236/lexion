# Security Policy

## Supported versions

Lexion is pre-1.0 software distributed from source. Security fixes are applied to the latest
release on the default branch.

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report privately through the repository host's security advisory feature (for example, GitHub
"Report a vulnerability") or contact the maintainers directly. Include:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected version, OS, and configuration
- Any suggested fix or mitigation

You can expect an acknowledgement within a few days. Please allow time for a fix before public
disclosure.

## Scope

Security-relevant areas include, but are not limited to:

- Peer identity checks in `src/renderer/src/lexion_core/peer/LexionPeer.js`
- IPC surface exposed through `src/preload/index.js`
- File access and JSON handling in `src/main/index.js`
- Overlay click-through and hit-testing logic
- WebRTC/TURN configuration and credential handling
- Electron `webPreferences` and content security policy

## Known considerations

- **TURN credentials are bundled for the public demo relay.** They are not secrets in the usual
  sense, but they are shared and can be abused. Operators distributing Lexion should replace them
  with their own relay credentials.
- **Peer IDs are public.** Treat a username as discoverable; do not put personal information in it.
- **Settings are stored unencrypted** as JSON in the OS user-data directory. Anyone with access to
  the OS account can read them.
- **Chat history is in-memory only.** Messages are not encrypted at rest because they are not
  written to disk by Lexion. WebRTC media and data channels are encrypted in transit (DTLS/SRTP).
- **No telemetry.** Lexion does not collect analytics or crash reports.

## Dependency updates

Dependabot is configured for npm. Please review Electron, electron-vite, and PeerJS updates with
extra care, since they affect the browser runtime and the peer connection.
