# The Simpsons: Springfield Mayhem — Prototype

A fan-made roguelike prototype: every run is a randomly generated "episode" that
starts as an ordinary Simpsons errand and spirals into chaos.

This is a **vertical-slice prototype**, not the full game vision. It proves out
the core loop end to end — hub, episode generation, procedural branching route,
real-time combat, the donut health/currency decision, item pickups with
synergies, a mid-run story twist, and a boss fight — with an architecture meant
to make adding more of everything (characters, locations, items, enemies,
episode modifiers, bosses) a data change, not a rewrite.

## Run it

No build step, no dependencies to install — it's plain HTML/CSS/JS (ES modules).

```
npm start
```

Then open http://localhost:8080 in a browser. (Or just serve the folder with
any static file server, e.g. `python3 -m http.server 8080`.)

## Controls

- **WASD / Arrow keys** — move
- **Mouse** — aim
- **Click or Space** — attack

## What's implemented

- **Hub**: 742 Evergreen Terrace, character select (Homer playable; Bart,
  Lisa, Marge, Maggie shown as locked, ready to unlock later), a trophy shelf
  that grows across runs.
- **Episode generation**: a random title, an objective ("Get to Moe's
  Tavern"), and an episode modifier. Only "Alien Invasion" is fully wired up
  right now; five more modifiers are registered in
  `src/data/episodes.js` with `implemented: false` as a template for adding
  them.
- **Procedural route**: `src/systems/episodeManager.js` defines the stage
  skeleton (fixed stages + branch points where the player picks between two
  locations), matching the example route in the design doc.
- **The story twist**: arriving Downtown triggers a "BREAKING NEWS" event —
  Kang & Kodos invade, alien enemies start spawning, location dialogue swaps
  to its "alien" flavor text, and the run ends in a boss fight against them.
- **Combat**: melee arc attacks and a ranged bowling-ball weapon, contact and
  projectile damage, status effects (poison/burn), knockback.
- **Donut economy**: every donut is a real-time choice — eat it now for HP, or
  bank it as currency to spend at Apu's Kwik-E-Mart shop.
- **Items & synergies**: Duff Beer, Buzz Cola, Squishee, Krusty Burger,
  Radioactive Rod, Homer's Bowling Ball, Flaming Moe, Blinky, Malibu Stacy —
  and three discoverable combos (`src/systems/synergy.js`): Duff Beer +
  Flaming Moe → Drunken Inferno, Bowling Ball + Radioactive Rod → Nuclear
  Bowling Ball, Buzz Cola + Squishee → Sugar Rush Overdrive.
- **A relationship stub**: don't wreck Moe's jukebox and he'll toss you a
  free heal before the boss fight; trash it and he remembers.
- **A boss**: Kang & Kodos, two phases, three attack patterns (charge, spread
  blast, summon).
- **End screen & season tracking**: victory/defeat, town destruction %,
  enemies defeated, people pissed off, arrests, donuts eaten, a star rating,
  and a persistent (localStorage) Season/Episode counter with a season finale
  every 22 episodes.

## Architecture — adding new content

Everything content-related lives in `src/data/*.js` as plain objects, so new
content is additive:

- **Character**: add an entry to `src/data/characters.js`, set
  `unlocked: true`. It shows up in the hub automatically.
- **Location**: add an entry to `src/data/locations.js`, then reference its id
  from `ROUTE_TEMPLATE` in `src/systems/episodeManager.js` (as a fixed stage
  or a branch option).
- **Enemy**: add an entry to `src/data/enemies.js` with a `scenario` tag
  (`'any'` or an episode modifier id) — the spawner picks it up automatically.
- **Item**: add an entry to `src/data/items.js` (`consumable` / `passive` /
  `weapon` categories) — it enters the pickup pool automatically. Add tags and
  an entry in `src/systems/synergy.js` for combos with existing items.
- **Episode modifier**: add an entry to `src/data/episodes.js`, flip
  `implemented: true` once you've added its enemy/boss spawn tables, and it
  joins the random pool.
- **Boss**: add an entry to `src/data/bosses.js` with HP-threshold `phases`
  and reference it as an episode's `bossId`.

## Known limits of this prototype

- Only Homer and the Alien Invasion episode are fully playable; the rest are
  data-table stubs.
- No art assets — entities render as colored circles with emoji, which keeps
  iteration fast but isn't the final "interactive cartoon" look.
- No audio.
- Single arena per location rather than a walkable overworld between rooms.
