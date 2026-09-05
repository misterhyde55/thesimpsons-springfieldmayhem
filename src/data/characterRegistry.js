// Single lookup point for "who is this character and what do they look
// like", spanning both playable Simpsons (data/characters.js) and everyone
// else (data/npcs.js). Every place in the game that needs a name or a
// portrait for a character id -- HUD, character select, dialogue/banners,
// boss intros -- should go through here instead of importing both tables
// and picking one, so adding a new uploaded character is purely a data
// change in characters.js or npcs.js plus one line in data/assets.js.
import { CHARACTERS } from './characters.js';
import { NPCS } from './npcs.js';
import { getAssetUrl } from './assets.js';

export function getCharacterInfo(id) {
  const playable = CHARACTERS[id];
  if (playable) {
    return { id, name: playable.name, type: 'playable', portraitUrl: getAssetUrl('characters', id) };
  }
  const npc = NPCS[id];
  if (npc) {
    return { id, name: npc.name, type: 'npc', portraitUrl: getAssetUrl('characters', id) };
  }
  return null;
}

export function getPortraitUrl(id) {
  return getCharacterInfo(id)?.portraitUrl || null;
}
