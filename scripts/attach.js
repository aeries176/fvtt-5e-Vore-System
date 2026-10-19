import { MODULE_ID } from "./const.js";
import { getPrey, getPred, getConfig, getSlot } from "./util.js";

/**
 * Visual parent/child attachment.
 *
 * Foundry has no token hierarchy, and the prey's *document* can only be updated by the GM after the
 * predator's update has already been broadcast, so it always lands a beat late. To make the prey move
 * in lockstep, every client re-positions the prey's on-screen token each time the predator's token is
 * refreshed (which happens every animation frame). The GM's document update then just commits the
 * final position, without its own animation.
 */

let smooth = true;
let warned = false;

export const isSmoothAttach = () => smooth;

/** Position the prey's displayed token relative to the predator's *displayed* (possibly mid-animation) token. */
function applyVisual(predObj, preyObj) {
  const preyDoc = preyObj.document;
  const st = getPrey(preyDoc);
  if (!st || !predObj.position || !preyObj.position) return;

  const predDoc = predObj.document;
  const size = predDoc.parent.grid.size;
  const slot = getSlot(getConfig(predDoc), st.slot);

  const angle = Number(predObj.mesh?.angle ?? predDoc.rotation) || 0;
  const sx = Math.sign(predDoc.texture.scaleX) || 1;
  const sy = Math.sign(predDoc.texture.scaleY) || 1;
  const ox = (Number(slot.offsetX) || 0) * size * sx;
  const oy = (Number(slot.offsetY) || 0) * size * sy;
  const a = Math.toRadians(angle);

  const cx = predObj.position.x + (predDoc.width * size) / 2 + (ox * Math.cos(a) - oy * Math.sin(a));
  const cy = predObj.position.y + (predDoc.height * size) / 2 + (ox * Math.sin(a) + oy * Math.cos(a));
  const nx = cx - (preyDoc.width * size) / 2;
  const ny = cy - (preyDoc.height * size) / 2;
  if (![nx, ny, angle].every(Number.isFinite)) return;

  // Shift the token container and its mesh by the same amount, so anchor offsets are preserved.
  const dx = nx - preyObj.position.x;
  const dy = ny - preyObj.position.y;
  preyObj.position.set(nx, ny);
  if (preyObj.mesh) {
    preyObj.mesh.position.x += dx;
    preyObj.mesh.position.y += dy;
    preyObj.mesh.angle = angle;
  }
}

/** Move a token's prey (and their prey, if nested) to match it. */
function attachChildren(tokenObj, depth = 0) {
  if (depth > 4) return;
  for (const id of getPred(tokenObj.document)?.preyIds ?? []) {
    const child = canvas.tokens.get(id);
    if (!child) continue;
    applyVisual(tokenObj, child);
    attachChildren(child, depth + 1);
  }
}

export function registerAttachHooks() {
  Hooks.once("ready", () => {
    smooth = game.settings.get(MODULE_ID, "smoothAttach");
  });

  Hooks.on("refreshToken", (token) => {
    if (!smooth) return;
    try {
      attachChildren(token);
      const st = getPrey(token.document);
      if (st) {
        const predObj = canvas.tokens.get(st.predatorId);
        if (predObj) applyVisual(predObj, token);
        attachChildren(token);
      }
    } catch (e) {
      if (!warned) console.warn("vore-system | visual attach failed (turn off 'Smooth attach' to disable)", e);
      warned = true;
    }
  });
}

export function setSmoothAttach(value) {
  smooth = !!value;
  canvas?.tokens?.placeables.forEach((t) => t.renderFlags?.set({ refreshPosition: true }));
}
