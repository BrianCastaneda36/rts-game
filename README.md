# Iron Dominion: a three.js Command & Conquer-style RTS

Everything is procedural (geometry, canvas-generated PBR textures, baked 2048² terrain splat, instanced vegetation, particle FX), written as plain ES modules with no build step and no external assets. Visual-only code lives in `js/textures.js`, `js/models.js`, `js/fx.js`, `js/geom.js` and the `Terrain` class; gameplay logic is unchanged. three.js r170 comes from jsdelivr through an import map.

## Run
```
cd rts-game
python3 -m http.server
# open http://localhost:8000
```
If `navigator.gpu` has a usable adapter, the game loads `three/webgpu` and uses `WebGPURenderer`. Otherwise it falls back to the standard `WebGLRenderer`. The top bar shows which renderer is active. You need internet access the first time so the browser can fetch three.js from the CDN.

## Controls
| Action | Input |
|---|---|
| Pan | WASD / arrow keys / push the mouse to a screen edge / drag on the minimap |
| Zoom | Mouse wheel |
| Select | Left-click, or left-drag a box (Shift adds to the selection) |
| Move / attack / harvest | Right-click on ground / an enemy / ore (harvesters) |
| Move via minimap | Right-click on the minimap |
| Build structure | Click a sidebar structure, then left-click to place it (green = valid, red = invalid). Right-click or Esc cancels |
| Train units | Click a unit button to queue it. Right-click the button to cancel and get a refund |
| Jump to base | H |

Tech tree: Power Plant → Refinery / Barracks. Refinery → War Factory. Each refinery comes with a free harvester. If power usage goes above output, production runs at half speed. You win when the enemy has lost its Construction Yard and every unit, and you lose under the same condition.

## The AI
**Unit personalities (`js/ai/personality.js`).** Every unit spawns with three random traits: aggression, caution and greed. Every 1.5–3 s (the timing is jittered per unit), each unit scores four actions: *attack*, *defend base*, *escort harvester* and *retreat*. The scores use health, nearby friend and enemy counts, distance to base, threat near the base, credits and the unit's traits. The unit then **samples** an action with weights proportional to score² (it does not just pick the top score). Enemy units act on the result fully. Your units get only light autonomy: they engage nearby enemies or pull back when badly hurt, and they leave you in control for 10 s after any order you give.

**The neural brain (`js/ai/brain.js`).** This is a hand-rolled feedforward network that runs entirely on your device, with no libraries and no network calls:
6 features (credits, army strength ratio, threat near base, harvester count, power balance, elapsed time) + bias → a 12-unit tanh hidden layer → two softmax heads:
- **strategy**: economy / build_army / attack / defend / harass
- **production**: rifle / rocket / tank / harvester

The weights start from hand-designed priors. For example, high threat pushes toward defend, a strong army ratio pushes toward attack, and few harvesters push toward economy and building harvesters. Outputs are sampled with a temperature and blended with the commander's own personality, which adds bias to the logits. The brain learns online with REINFORCE: reward = (damage dealt − damage taken)/400 + credits earned/1000, measured against a running baseline. It updates both layers and saves its weights to `localStorage`, so it keeps adapting from one game to the next.

**The commander (`js/ai/commander.js`).** It follows a build order and adapts it to keep power up. Wave timing is jittered and shortens as the game goes on, and wave size grows over time. It picks targets by weighted random: Construction Yard, refinery, harvesters, power or anything else. About 35% of waves split into two flanking groups, and some waves take a single flank waypoint. Harass raids go after harvesters. A wave that is losing pulls back to a rally point, regroups, picks up reinforcements and attacks again. The HUD panel at the bottom-left shows what the AI is currently thinking: its strategy, top probabilities, production mix, inputs and reward.

## Files
`index.html`, `style.css`, `js/main.js` (renderer bootstrap), `js/T.js` (shared THREE binding), `js/terrain.js`, `js/models.js`, `js/defs.js`, `js/game.js` (simulation, combat, input), `js/ui.js` (HUD, sidebar, minimap, health bars), `js/ai/brain.js`, `js/ai/personality.js`, `js/ai/commander.js`.

## Known limitations
- No real pathfinding. Units steer around buildings but can get stuck on water edges and steep terrain.
- No fog of war. No base defenses or turrets. No repair or selling.
- The brain runs on the main thread, not a Web Worker. It is tiny, so this is cheap.
- Balance is rough.

## Phase 2 features
- **Main menu**: Single Player (1-3 AI), Host / Join multiplayer, Upgrades, Daily Reward.
- **Points** (★): earned from kills, harvesting, wins (and losses), and daily rewards. Saved in localStorage.
- **Daily login streak**: based on calendar days, with rewards escalating over a 7-day cycle (+100 per completed week).
- **Upgrade shop**: Tank Mk II/III evolution, infantry training, weapon systems, harvest rate, building armor and a war chest. Upgrades are permanent.
- **Natural disasters**: earthquake, lightning storm, flash flood and meteor (which leaves a crater that deforms the terrain). They trigger at random every ~2-3 minutes; `X` triggers one for debugging.
- **Multiplayer**: PeerJS WebRTC with a 5-letter room code and 2-4 players free-for-all. AI fills empty slots. The host is authoritative (snapshots at 10 Hz, clients send commands).
- **Mobile / PWA**:
  - Touch controls: tap to select or command, long-press-drag for box select, one- or two-finger pan, pinch to zoom.
  - Collapsible build drawer.
  - Installable as an app via `manifest.json` + `sw.js`.
- **Portraits**: every build button and the selection panel show the real 3D model, rendered at startup.
