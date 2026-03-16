# Foldable Device Prototype — Wizard of Oz Setup

  Foldable Prototype Server
 
  - http://localhost:3000/screen1.html  ← Phone 1 (scatterplot)
  - http://localhost:3000/screen2.html  ← Phone 2 (control / right half)
  - http://localhost:3000/wizard.html   ← wizard of oz control



## State 

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
| **Year** slider + steppers + hold on click buttons | Manually sets the year on all clients |
| Event Log | Real-time WebSocket message feed |

