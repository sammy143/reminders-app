# Design (source of truth for how the app looks)

Produced with the Stitch MCP server (local only) in feature F000.

- `DESIGN.md` — design system: colors, typography, spacing, radii as Tailwind-compatible
  tokens. `tailwind.config.js` mirrors these; change here first.
- `screens/<name>.png` + `screens/<name>.html` — Stitch exports per screen. The HTML is a
  visual reference (web/Tailwind), not code to copy into the app.

Update this folder before changing UI code; the reviewer checks UI against it.
