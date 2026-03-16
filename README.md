# Foldable Device Prototype — Wizard of Oz Setup

## Architecture

```
                     ┌─────────────────────────────────┐
                     │   Node.js WebSocket Relay Server │
                     │   server.js  ·  port 3000        │
                     │   Serves /public  static files   │
                     └──────┬──────────┬───────┬────────┘
                            │          │       │
                      screen1.html  screen2.html  wizard.html
                      (Phone 1)     (Phone 2)     (Laptop)
```

All three clients connect to the same WebSocket at `ws://[HOST]:3000/ws`.
The server holds a single shared state object `{ year, mode, angle }` and
relays every mutation to all connected clients.

---

## Quick Start

### 1. Prerequisites
- Node.js 16+  (no npm packages needed — pure built-ins)

### 2. Run the server
```bash
cd foldable
node server.js
```

You'll see:
```
  Foldable Prototype Server
  ─────────────────────────
  http://localhost:3000/screen1.html  ← Phone 1 (scatterplot)
  http://localhost:3000/screen2.html  ← Phone 2 (control / right half)
  http://localhost:3000/wizard.html   ← Laptop (wizard of oz control)
```

### 3. Add the Gapminder dataset
The chart needs `public/gapminder_full.json`.

Download from: https://vega.github.io/vega-datasets/data/gapminder.json
and save it as `public/gapminder_full.json`.

Expected schema per record:
```json
{ "year": 1955, "country": "Afghanistan", "cluster": 2,
  "pop": 8891209, "life_expect": 30.332, "fertility": 7.7,
  "gdp": 975.8, "region": "Asia", "name": "Afghanistan" }
```

### 4. Open on devices
Find your laptop's local IP (e.g. `192.168.1.42`).

| Device   | URL |
|----------|-----|
| Phone 1  | `http://192.168.1.42:3000/screen1.html` |
| Phone 2  | `http://192.168.1.42:3000/screen2.html` |
| Laptop   | `http://localhost:3000/wizard.html` |

---

## State Machine

### State 1 — Folded (90°)
| Screen | Behaviour |
|--------|-----------|
| Screen 1 (Phone 1) | Full-width scatterplot |
| Screen 2 (Phone 2) | Transparent fullscreen slider. Moving slider broadcasts `setYear` to all clients. |

### State 2 — Flat / Unfolded (180°)
| Screen | Behaviour |
|--------|-----------|
| Screen 1 (Phone 1) | **Left half** of scatterplot. Tap-hold = year goes **backward** |
| Screen 2 (Phone 2) | **Right half** of scatterplot. Tap-hold = year goes **forward** |

The scatterplot is rendered at 2× viewport width on both phones and each phone
clips to its own half (left / right), creating the illusion of a single
continuous chart across the fold.

---

## Wizard of Oz Controls (laptop)

| Control | Effect |
|---------|--------|
| **Folded / Flat** buttons | Switches all clients between mode 1 and mode 2 |
| **Fold Angle** slider | Adjusts `currentAngle` (90–180°). Affects tap-hold speed: 90° = 4 yr/s, 180° = 1 yr/s |
| **Year** slider + steppers | Manually sets the year on all clients |
| Device Preview | Visual indicator of current state |
| Event Log | Real-time WebSocket message feed |

---

## WebSocket Protocol

All messages are JSON. The server holds canonical state.

| Message (→ server) | Fields | Description |
|--------------------|--------|-------------|
| `setYear`  | `{ year }` | Set year (1800–2014) |
| `setMode`  | `{ mode, angle }` | Switch folded / flat |
| `setAngle` | `{ angle }` | Update fold angle only |
| `getState` | — | Request full state sync |

| Message (← server broadcast) | Fields | Description |
|-------------------------------|--------|-------------|
| `state`  | `{ year, mode, angle }` | Full state on connect |
| `year`   | `{ year }` | Year updated |
| `mode`   | `{ mode, angle }` | Mode switched |
| `angle`  | `{ angle }` | Angle updated |

---

## Tap-hold Speed Formula

```
yearsPerSecond = round(4 − ((angle − 90) / 90) × 3)

angle=90°  → 4 yr/s  (fully folded, fast)
angle=135° → 2.5 yr/s
angle=180° → 1 yr/s  (fully flat, slow)
```

Year increments fire at `1000 / yearsPerSecond` ms intervals.

---

## File Structure
```
foldable/
├── server.js              Pure Node.js WS relay + static file server
└── public/
    ├── screen1.html       Phone 1 — scatterplot (folded full / flat left)
    ├── screen2.html       Phone 2 — slider or right half
    ├── wizard.html        Laptop — Wizard of Oz controller
    ├── screen1.js         Original Vega spec (reference, not directly used)
    └── gapminder_full.json  ← YOU NEED TO ADD THIS
```
