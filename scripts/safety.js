import { MODULE_ID } from "./const.js";
import { getPrey, getPred, ownsToken, esc, say, scopeFor, isActiveGM } from "./util.js";
import { register } from "./socket.js";
import { release } from "./vore.js";

const { DialogV2 } = foundry.applications.api;
const FLAG = `flags.${MODULE_ID}`;

/** Release every held prey of a predator and say so (secret Vore stays between its participants). */
async function releaseAll(pred, message) {
  const scene = pred.parent;
  const held = (getPred(pred)?.preyIds ?? []).map((id) => scene.tokens.get(id)).filter((t) => t && getPrey(t) && !getPrey(t).digested);
  if (!held.length) return;
  const whisper = scopeFor(pred, held);
  for (const prey of held) await release(prey, { place: true });
  await say(`<p>${message}</p>`, { whisper });
}

/**
 * GM unstick tool: free everything in a scene. Releases every held or digested token (restoring image, statuses,
 * gear and visibility), clears predator state, and removes leftover Vored/Slimed effects.
 */
export async function resetScene(sceneId) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;
  let freed = 0;
  for (const token of scene.tokens) {
    const digested = token.getFlag(MODULE_ID, "digested");
    if (getPrey(token) || digested) {
      try {
        await release(token, { place: false, restoreImage: true });
        freed++;
      } catch (e) {
        console.warn("vore-system | reset could not release", token.name, e);
      }
    }
  }
  for (const token of scene.tokens) {
    if (getPred(token) || token.getFlag(MODULE_ID, "stomach")) {
      await token.update({ [`${FLAG}.-=pred`]: null, [`${FLAG}.-=stomach`]: null }, { voreMove: true });
    }
    for (const id of ["vored", "slimed"]) {
      if (token.actor?.statuses?.has(id)) await token.actor.toggleStatusEffect(id, { active: false });
    }
  }
  await say(`<p>All Vore state in <strong>${esc(scene.name)}</strong> was reset (${freed} token${freed === 1 ? "" : "s"} freed).</p>`, {
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id)
  });
}

/** What happens to held prey when their predator is downed. */
async function onPredatorDowned(token) {
  if (!getPred(token)?.preyIds?.length) return;
  const mode = game.settings.get(MODULE_ID, "predatorDowned");
  if (mode === "stuck") return;
  const name = `<strong>${esc(token.name)}</strong>`;
  if (mode === "ask") {
    const free = await DialogV2.confirm({
      window: { title: "Predator downed" },
      content: `<p>${esc(token.name)} was downed while holding prey. Release them?</p>`,
      yes: { label: "Release" },
      no: { label: "Keep them held" },
      rejectClose: false
    });
    if (!free) return;
  }
  await releaseAll(token, `${name} collapses, and everyone inside spills out.`);
}

export function registerSafety() {
  register("resetScene", ({ sceneId }, userId) => {
    if (game.users.get(userId)?.isGM) return resetScene(sceneId);
  });

  Hooks.on("updateActor", (actor, changes) => {
    if (!isActiveGM()) return;
    const hp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
    if (hp === undefined || hp > 0) return;
    for (const token of actor.getActiveTokens(false, true)) onPredatorDowned(token);
  });

  // Dead from a status (e.g. toggled by hand) counts too.
  Hooks.on("createActiveEffect", (effect) => {
    if (!isActiveGM() || !effect.statuses?.has("dead")) return;
    const actor = effect.parent;
    if (actor?.documentName !== "Actor") return;
    for (const token of actor.getActiveTokens(false, true)) onPredatorDowned(token);
  });
}
