# Sky Run 1-1

A hyper-casual, horizontal-scrolling 3D jump-action game inspired by Mario 1-1.
Built with Three.js — single-file HTML5 PWA, no build step required.

## Play

Open `index.html` in any modern browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit the URL. On mobile, add to home screen to install as a PWA.

## Controls

| Action | Input |
| --- | --- |
| Jump (higher) | Hold Space / ↑ / Tap-and-hold |
| Jump (lower) | Tap (short press) |
| Triple jump | Press again mid-air (up to 3 stages) |

Stomp Goombas from above. Reach the flag at 70m to clear the stage.

## Features

- Procedurally generated stages — every run is different
- Variable jump height (hold = higher, tap = lower)
- Coyote time + jump buffering for responsive feel
- Squash & stretch, screen shake, synthesized Web Audio SFX
- Level progression — each clear raises speed and enemy count
- Fixed 70m goal per stage

## Testing

The repo includes a headless test harness (`test-harness.js`) that mirrors the
game's physics and collision logic, plus automated suites:

```bash
node pipe-full-test.js   # pipe collision / no-clip tests
node fall-full-test.js   # ground / pit fall tests
node auto-test.js        # AI bot playtests across levels
```

## Tech

- Three.js (r128, CDN)
- Vanilla JS, single-file PWA (manifest + service worker via Blob URLs)
- Web Audio API for synthesized sound effects (no asset files)

## License

MIT
