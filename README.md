# 🗡️ PoE Progression Companion

A lightweight, always-on-top overlay for **Path of Exile** that keeps a
leveling/progression checklist right on top of the game — without ever
stealing your clicks or covering your inventory.

Import a build straight from **pobb.in**/**pastebin** and it auto-generates
your leveling checklist, gem links included. Click any item to search for it
in-game automatically. No more alt-tabbing to a wiki or a Google Doc mid-map.

## ✨ Features

- **Overlay that stays out of your way** — frameless, transparent,
  always-on-top, draggable, resizable. Move it wherever it doesn't block
  your inventory or the vendor screen.
- **Import a build in one click** — paste a pobb.in/pastebin link and it:
  - Prefers the build's own per-stage **skill sets** (the way most leveling
    guides are actually organized in PoB) and turns each one into a section.
  - Falls back to a hand-written leveling plan in the build's **Notes**, if
    the skill sets aren't split by stage.
  - Falls back again to a flat list of every gem in the build if neither
    exists.
  - Groups **linked support gems** under their active skill automatically,
    using the gem's own item id from the build data (not guesswork), so
    "Cobra Lash" shows "Added Cold Damage" and "Volley" nested under it.
  - Got a link wrong? Manually re-nest or un-nest any item in edit mode.
- **Click an item to act on it** — clicking a checklist item (or a gem)
  brings PoE's window to front, opens the vendor/trade search (`Ctrl+F`),
  and pastes the item name in for you. Marks it done automatically.
- **Passive auto-check** — copy an item in-game (`Ctrl+C` on it, like
  normal) and if it matches an unchecked entry, it gets checked off on its
  own.
- **Sections you control** — collapsible sections, drag-and-drop reordering
  for both sections and items, add/edit/delete anything in edit mode.
- **Multiple builds** — save and switch between separate checklists (one
  per character/build) from a dropdown.
- **Regex shortcut panel** — a small, detached, draggable window with
  square buttons for saved regex patterns (great for trade/vendor search).
  It's a separate OS window on purpose, so opening or resizing it never
  resizes the main checklist.
- **5 color themes** — Pink, White, Gray, Green, Blue.
- **Configurable global hotkey** — set any key combo (or a standalone
  function key like `F5`) to show/hide everything.
- **System tray icon** — show/hide or fully quit the app; it never lingers
  invisibly in the background.
- **Everything persists locally** — no account, no server, no telemetry.

## 🖥️ Requirements

- Windows (uses PowerShell + `SendKeys` to paste into the game window).
- [Node.js](https://nodejs.org) if running from source.

## 🚀 Running from source

```bash
git clone https://github.com/caiojgouvea/poe-overlay-checklist.git
cd poe-overlay-checklist
npm install
npm start
```

## 📦 Building a standalone .exe

```bash
npm run package
```

This produces a portable app folder at
`dist-packaged/PoE Progression Companion-win32-x64/` — just copy it
anywhere and run `PoE Progression Companion.exe`, no install needed.

There's also `npm run dist` (via `electron-builder`) if you'd rather have a
proper installer, but on Windows it needs **Developer Mode** enabled
(Settings → For developers) since it needs symlink privileges to fetch its
packaging tools.

## 🎮 Usage

| Action | How |
|---|---|
| Show / hide everything | Configured hotkey (default `Ctrl+Shift+L`) |
| Move the window | Drag anywhere on the panel (not on a button/input) |
| Resize the window | Drag the window edge, like any normal window |
| Enter edit mode | Click ⚙ in the header |
| Search an item in-game & check it off | Click its name |
| Rename an item/section | Double-click its name |
| Reorder items/sections | Drag the ⠿ handle (edit mode) |
| Turn an item into a sub-item | Click ⤷ on it (edit mode, nests under the item above) |
| Promote a sub-item back | Click ⤴ on it (edit mode) |
| Import a build | Edit mode → paste a pobb.in/pastebin link → **Go** |
| Open the regex shortcut panel | Click the **REGEX** tab on the edge of the window |
| Switch/add a build | Edit mode → Build dropdown |
| Change theme | Edit mode → Theme dropdown |
| Change the hotkey | Edit mode → Hotkey → **Set** → press your combo |
| Quit for real | Right-click the tray icon → Quit |

## 🗂️ Data storage

Everything is stored locally as JSON in Electron's per-user app data folder
(`%APPDATA%\poe-progression-companion\` on Windows) — builds/checklists,
window positions, regex shortcuts, theme, and hotkey. Nothing is sent
anywhere except the one HTTP request to fetch a build code when you use the
import feature.

## 🧱 Project structure

```
main.js                    Electron main process: windows, IPC, file
                            persistence, build import/parsing, tray, hotkey
preload.js                 contextBridge API exposed to the renderers
renderer/
  index.html / renderer.js / style.css   Main checklist window
  regex.html / regex.js                  Detached regex shortcut window
  regex-toggle.html / regex-toggle.js    Tiny window with the REGEX tab
data/support-gems.json     Support gem name list (RePoE data), used as a
                            fallback for gem link classification
assets/icon.png            Tray/window icon
```

## 🛠️ Tech stack

Plain [Electron](https://www.electronjs.org/) + vanilla HTML/CSS/JS — no
frontend framework, no build step. `npm start` runs it straight from source.

## ⚠️ Disclaimer

This is a fan-made tool, not affiliated with or endorsed by Grinding Gear
Games. Path of Exile is a trademark of Grinding Gear Games.
