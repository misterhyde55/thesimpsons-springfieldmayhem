import { CALLBACKS } from '../data/callbacks.js';

export function setCallbackFlag(runState, flagId) {
  runState.callbackFlags[flagId] = true;
}

// Checks every not-yet-fired callback registered for this `triggerPoint`;
// fires (and permanently marks fired) the first one whose condition
// matches. `context` is whatever that trigger point can offer (a battle,
// an hpPct, ...) -- see data/callbacks.js for what each one expects.
// Returns {title, text} for the UI to show as a banner, or null.
export function checkCallback(runState, triggerPoint, context = {}) {
  for (const callback of Object.values(CALLBACKS)) {
    if (callback.triggerPoint !== triggerPoint) continue;
    if (runState.firedCallbackIds.includes(callback.id)) continue;
    if (!callback.condition(runState, context)) continue;
    runState.firedCallbackIds.push(callback.id);
    const result = callback.fire(runState, context) || {};
    return { title: callback.title, text: result.text };
  }
  return null;
}
