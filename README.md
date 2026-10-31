# Organ Atlas

An interactive website that shows how the organs of the body work, starting with the **heart**.

## Open it

Double-click `index.html`, or serve the folder:

```sh
cd ~/Documents/organ-atlas
python3 -m http.server 8765   # then open http://localhost:8765
```

The 3D model uses [Three.js](https://threejs.org) loaded from a CDN, so it needs an internet connection.

## What's on the heart page

- A 3D heart, built in code, that beats and can be spun around. Click any part to learn about it.
- **Blood flow** view: see-through walls, blue (oxygen-poor) and red (oxygen-rich) blood, and opening/closing valves.
- **Follow a blood cell**: a guided tour of the full circulation loop.
- **Electricity**: the signal travelling from the SA node to the AV node and down to the ventricles.
- A live ECG monitor, lub-dub sound, and a heart-rate slider.
- Sections below: facts, the four chambers, the journey of blood, one heartbeat, the electrical system, a pulse tapper, healthy-heart tips and a quiz.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout and the Three.js loader |
| `css/style.css` | All styling |
| `js/heart-data.js` | All text (parts, journey steps, quiz) and heartbeat timing |
| `js/heart-scene.js` | The 3D heart: model, beating, blood flow, valves, labels |
| `js/main.js` | Page wiring: controls, ECG, sound, tapper, quiz |

To add another organ later, create `js/<organ>-data.js` and `js/<organ>-scene.js` on the same pattern and enable its tab in the header.
