// Central registry of illustrated UI icons, mirroring data/assets.js's
// pattern exactly: request an icon by (category, id) and get a URL back,
// or undefined if that file hasn't been uploaded yet. Nothing that renders
// an icon should ever hardcode a path under public/assets/icons/ -- go
// through getIconUrl (or, in UI code, ui/icons.js's iconHtml) so dropping
// in a new file is a one-line change here, not a hunt through the combat
// screen.
//
// None of these files exist yet -- every entry below is a *prepared*
// mapping for art that's coming later (see the folder layout in the design
// spec). Until an id's file is uploaded, ui/icons.js renders a small
// labeled CSS badge instead, never an emoji.
const BASE = '/assets/icons';

export const ICON_MANIFEST = {
  combat: {
    attack: `${BASE}/combat/attack.png`,
    heavyAttack: `${BASE}/combat/heavy-attack.png`,
    defend: `${BASE}/combat/defend.png`,
    heal: `${BASE}/combat/heal.png`,
    stun: `${BASE}/combat/stun.png`,
    dodge: `${BASE}/combat/dodge.png`,
    crit: `${BASE}/combat/crit.png`,
    multiHit: `${BASE}/combat/multi-hit.png`,
    counter: `${BASE}/combat/counter.png`,
  },
  // Every data/statusEffects.js STATUS id needs an entry here (see the
  // `iconId` field on each STATUS_INFO row) plus a few not implemented as
  // real mechanics yet, prepared for when they are.
  status: {
    strength: `${BASE}/status/strength.png`,
    armor: `${BASE}/status/armor.png`,
    weak: `${BASE}/status/weak.png`,
    vulnerable: `${BASE}/status/vulnerable.png`,
    dodge: `${BASE}/status/dodge.png`,
    stun: `${BASE}/status/stun.png`,
    radiation: `${BASE}/status/radiation.png`,
    infection: `${BASE}/status/infection.png`,
    tipsy: `${BASE}/status/tipsy.png`,
    poison: `${BASE}/status/poison.png`,
    burn: `${BASE}/status/burn.png`,
    bleed: `${BASE}/status/bleed.png`,
    rage: `${BASE}/status/rage.png`,
    sugarRush: `${BASE}/status/sugar-rush.png`,
    sanity: `${BASE}/status/sanity.png`,
    fear: `${BASE}/status/fear.png`,
    possession: `${BASE}/status/possession.png`,
    mutation: `${BASE}/status/mutation.png`,
  },
  resources: {
    donut: `${BASE}/resources/donut.png`,
    energy: `${BASE}/resources/energy.png`,
    money: `${BASE}/resources/money.png`,
    health: `${BASE}/resources/health.png`,
    mayhem: `${BASE}/resources/mayhem.png`,
    actions: `${BASE}/resources/actions.png`,
  },
  // Enemy/boss intent icons (systems/enemyAI.js, data/enemies.js,
  // data/bosses.js) -- a distinct vocabulary from the player's combat
  // action icons above, since "what is the enemy about to do" covers cases
  // (SUMMON, TRANSFORM, BOSS SPECIAL) a player action never needs.
  intent: {
    attack: `${BASE}/intent/attack.png`,
    attackTwice: `${BASE}/intent/attack-twice.png`,
    defend: `${BASE}/intent/defend.png`,
    infect: `${BASE}/intent/infect.png`,
    buff: `${BASE}/intent/buff.png`,
    debuff: `${BASE}/intent/debuff.png`,
    heal: `${BASE}/intent/heal.png`,
    summon: `${BASE}/intent/summon.png`,
    transform: `${BASE}/intent/transform.png`,
    phase: `${BASE}/intent/phase.png`,
    bossSpecial: `${BASE}/intent/boss-special.png`,
    unknown: `${BASE}/intent/unknown.png`,
  },
  // Ability-specific action artwork (data/abilities.js `icon` field) --
  // "items" per the design spec's folder layout, since these illustrate a
  // specific object (a bowling ball, a Duff can) rather than a generic
  // combat/resource concept.
  items: {
    bowlingBall: `${BASE}/items/bowling-ball.png`,
    duff: `${BASE}/items/duff.png`,
    radioactiveRod: `${BASE}/items/radioactive-rod.png`,
    slingshot: `${BASE}/items/slingshot.png`,
    saxophone: `${BASE}/items/saxophone.png`,
  },
  horror: {
    zombie: `${BASE}/horror/zombie.png`,
    alien: `${BASE}/horror/alien.png`,
    vampire: `${BASE}/horror/vampire.png`,
    ghost: `${BASE}/horror/ghost.png`,
    curse: `${BASE}/horror/curse.png`,
    mutation: `${BASE}/horror/mutation.png`,
    possession: `${BASE}/horror/possession.png`,
    timeDistortion: `${BASE}/horror/time-distortion.png`,
    unknown: `${BASE}/horror/unknown.png`,
  },
  map: {
    combat: `${BASE}/map/combat.png`,
    elite: `${BASE}/map/elite.png`,
    boss: `${BASE}/map/boss.png`,
    shop: `${BASE}/map/shop.png`,
    npc: `${BASE}/map/npc.png`,
    event: `${BASE}/map/event.png`,
    secret: `${BASE}/map/secret.png`,
    danger: `${BASE}/map/danger.png`,
    blockedRoad: `${BASE}/map/blocked.png`,
    rumor: `${BASE}/map/rumor.png`,
    unknownLocation: `${BASE}/map/unknown.png`,
  },
};

export function getIconUrl(category, id) {
  return ICON_MANIFEST[category]?.[id];
}
