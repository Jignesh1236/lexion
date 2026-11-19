# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Contributor documentation: README, contributing guide, code of conduct, security policy and
  architecture notes.
- GitHub issue templates, pull request template, Dependabot config and a CI build workflow.
- Packaging configuration for Windows (NSIS), macOS (DMG) and Linux (AppImage).

### Fixed

- Saving connection settings no longer overwrites audio devices, hotkeys or toast settings.
- Onboarding now seeds `connect.json` immediately so the overlay works without opening Settings.
- The overlay spans the full virtual desktop and responds to display changes.
- Tray/window icons resolve correctly after packaging.
- A second launch focuses the existing window instead of starting a duplicate peer.
- External links open in the system browser instead of creating new Electron windows.
- Removed an unused browser panel that referenced a non-existent preload API.

## [1.0.0] - 2026-11-19

### Added

- Peer-to-peer voice calling over WebRTC with PeerJS signaling and TURN fallback.
- Peer-to-peer text chat with message previews next to the orb.
- Transparent, always-on-top floating orb with drag, edge snapping and stashing.
- Push-to-talk (hold the orb or use a global shortcut) and speaker detection.
- System tray, background running and show/hide controls.
- Onboarding, profile, connection settings, audio device picker and keybinding editor.
- Local JSON storage for profile and connection settings.
