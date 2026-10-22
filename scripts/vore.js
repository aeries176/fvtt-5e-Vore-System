import { MODULE_ID } from "./const.js";
import { isSmoothAttach } from "./attach.js";
import { notify } from "./socket.js";
import { describeInside } from "./inside.js";
import { initialTimedState } from "./timed.js";
import { cleanDigest } from "./digestchoice.js";
import { logEvent, logName } from "./journal.js";
import { getPrey, getPred, getConfig, getSlot, flagOf, isActiveGM, say, esc, fmtMsg, audience, scopeFor, stageOf, effectiveSlot, isEndoOnly, stripDefaultValues, normalizeStages, hidesPrey } from "./util.js";

const FLAG = `flags.${MODULE_ID}`;
/** Foundry v13 attaches properties to the options object, so every update needs its own. */
const moveOpts = (extra = {}) => ({ voreMove: true, ...extra });

/* -------------------------------------------- */
/*  Geometry                                     */
/* -------------------------------------------- */

/** Where a prey token sits relative to its predator (offset is in grid units, rotated/flipped with the predator). */
export function preyPlacement(pred, prey, slot) {
  const size = pred.parent.grid.size;
  const cx = pred.x + (pred.width * size) / 2;
  const cy = pred.y + (pred.height * size) / 2;
  const sx = Math.sign(pred.texture.scaleX) || 1;
  const sy = Math.sign(pred.texture.scaleY) || 1;
  const ox = (Number(slot.offsetX) || 0) * size * sx;
  const oy = (Number(slot.offsetY) || 0) * size * sy;
  const a = Math.toRadians(pred.rotation || 0);
  const rx = ox * Math.cos(a) - oy * Math.sin(a);
  const ry = ox * Math.sin(a) + oy * Math.cos(a);
  return {
    x: cx + rx - (prey.width * size) / 2,
    y: cy + ry - (prey.height * size) / 2,
    rotation: pred.rotation || 0,
    sx,
    sy
  };
}

const overlaps = (a, b) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;

/** Nearest unoccupied, wall-free spot next to the predator (never on another token or the predator). */
export function findFreeSpot(pred, prey) {
  const scene = pred.parent;
  const size = scene.grid.size;
  const rect = (t) => ({ x: t.x, y: t.y, w: t.width * size, h: t.height * size });
  const blockers = scene.tokens.filter((t) => t.id !== prey.id).map(rect);
  const w = prey.width * size;
  const h = prey.height * size;
  const pc = { x: pred.x + (pred.width * size) / 2, y: pred.y + (pred.height * size) / 2 };
  const bounds = scene.dimensions?.sceneRect;
  const canTestWalls = canvas.scene?.id === scene.id && CONFIG.Canvas?.polygonBackends?.move?.testCollision;

  const candidates = [];
  for (let gx = -4; gx < Math.ceil(pred.width) + 4; gx++) {
    for (let gy = -4; gy < Math.ceil(pred.height) + 4; gy++) {
      const c = { x: pred.x + gx * size, y: pred.y + gy * size, w, h };
      if (bounds && (c.x < bounds.x || c.y < bounds.y || c.x + w > bounds.right || c.y + h > bounds.bottom)) continue;
      if (blockers.some((b) => overlaps(c, b))) continue;
      const cc = { x: c.x + w / 2, y: c.y + h / 2 };
      candidates.push({ ...c, d: Math.hypot(cc.x - pc.x, cc.y - pc.y), cc });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const c of candidates) {
    if (canTestWalls) {
      try {
        if (CONFIG.Canvas.polygonBackends.move.testCollision(pc, c.cc, { type: "move", mode: "any" })) continue;
      } catch (e) {
        /* wall test unavailable; accept candidate */
      }
    }
    return { x: c.x, y: c.y };
  }
  return null;
}

/* -------------------------------------------- */
/*  State changes (GM client only)               */
/* -------------------------------------------- */

export function ensureVoredStatus() {
  if (!CONFIG.statusEffects.some((e) => e.id === "vored")) {
    CONFIG.statusEffects.push({ id: "vored", name: "VORE.Status.Vored", img: `modules/${MODULE_ID}/icons/vored.svg` });
  }
  if (!CONFIG.statusEffects.some((e) => e.id === "slimed")) {
    CONFIG.statusEffects.push({ id: "slimed", name: "VORE.Status.Slimed", img: `modules/${MODULE_ID}/icons/slimed.svg` });
  }
}

async function setStatus(doc, id, active, overlay = false) {
  try {
    if (id === "vored") ensureVoredStatus();
    await doc.actor?.toggleStatusEffect(id, { active, overlay });
  } catch (e) {
    console.warn("vore-system | status toggle failed", id, e);
  }
}

/** Play a one-shot event sound (swallow / escape / digest) on every client, fading with distance. */
function playEvent(pred, slotIndex, key, secret = false) {
  const slot = getSlot(getConfig(pred), slotIndex);
  const src = slot?.[key];
  if (!src) return;
  const users = game.users.filter((u) => u.active).map((u) => u.id);
  notify(users, "oneShot", { sceneId: pred.parent.id, predId: pred.id, src, volume: Number(slot.soundVolume) || 0.6, secret: !!secret });
}

/** Statuses applied to prey while held. Only ones the actor didn't already have, so we never strip theirs. */
function statusesToAdd(prey, slotCfg) {
  const wanted = [];
  if (slotCfg.restrain !== false) wanted.push("restrained");
  if (slotCfg.fullCover !== false) wanted.push("totalcover");
  const known = (id) => CONFIG.statusEffects.some((e) => e.id === id);
  return wanted.filter((id) => known(id) && !prey.actor?.statuses?.has(id));
}

async function setPredPreys(pred, ids) {
  if (!pred) return;
  if (ids.length) await pred.update({ [`${FLAG}.pred`]: { preyIds: ids } }, moveOpts());
  else await pred.update({ [`${FLAG}.-=pred`]: null, [`${FLAG}.-=stomach`]: null }, moveOpts());
}

/** Gear handling: "strip" unequips armor, weapons and gear while held, so it can be restored on release. */
async function stripGear(prey) {
  const ids = (prey.actor?.items ?? [])
    .filter((i) => ["weapon", "equipment"].includes(i.type) && i.system.equipped === true)
    .map((i) => i.id);
  if (ids.length) await prey.actor.updateEmbeddedDocuments("Item", ids.map((id) => ({ _id: id, "system.equipped": false })));
  return ids;
}

async function restoreGear(prey, ids = []) {
  const have = (ids ?? []).filter((id) => prey.actor?.items.has(id));
  if (have.length) await prey.actor.updateEmbeddedDocuments("Item", have.map((id) => ({ _id: id, "system.equipped": true })));
}

/** A temporary "Slimed" condition after being released from a slimy stomach. */
async function applySlimed(prey) {
  ensureVoredStatus();
  try {
    await prey.actor?.createEmbeddedDocuments("ActiveEffect", [
      {
        name: game.i18n.localize("VORE.Status.Slimed"),
        img: `modules/${MODULE_ID}/icons/slimed.svg`,
        statuses: ["slimed"],
        duration: { seconds: 3600 },
        description: "Covered in slime: disadvantage on Dexterity (Stealth), advantage on checks to escape a grapple. Wash it off to end it."
      }
    ]);
  } catch (e) {
    console.warn("vore-system | could not apply Slimed", e);
  }
}

export async function startVore({ sceneId, predId, preyIds, slot = 0, forced = false, secret = false, hide = false, gm = false, digest: digestChoice = null }) {
  const scene = game.scenes.get(sceneId);
  const pred = scene?.tokens.get(predId);
  if (!pred) return;
  const cfg = getConfig(pred);
  const slotCfg = getSlot(cfg, slot);
  const ids = new Set(getPred(pred)?.preyIds ?? []);
  const names = [];
  const swallowed = [];
  // Prey tokens vanish from the map only when asked: by the GM on a Secret Vore, or by a predator whose feat allows it.
  const hideTokens = !!hide && (secret || gm || hidesPrey(pred));

  for (const id of preyIds) {
    const prey = scene.tokens.get(id);
    if (!prey || id === predId || getPrey(prey)) continue;
    const place = preyPlacement(pred, prey, slotCfg);
    const original = {
      img: prey.texture.src,
      scaleX: prey.texture.scaleX,
      scaleY: prey.texture.scaleY,
      rotation: prey.rotation,
      x: prey.x,
      y: prey.y,
      hidden: prey.hidden
    };
    const scale = Number(slotCfg.scale) || 1;
    const added = statusesToAdd(prey, slotCfg);
    const update = {
      x: place.x,
      y: place.y,
      rotation: place.rotation,
      "texture.scaleX": place.sx * Math.abs(original.scaleX) * scale,
      "texture.scaleY": place.sy * Math.abs(original.scaleY) * scale,
      [`${FLAG}.prey`]: { predatorId: predId, slot, digested: false, original, added, fullCover: slotCfg.fullCover !== false, timed: initialTimedState(prey, cleanDigest(digestChoice)), heal: cleanDigest(digestChoice).effect === "heal", secret: !!secret, stage: 0 }
    };
    if (slotCfg.preyImg) update["texture.src"] = slotCfg.preyImg;
    if (hideTokens) update.hidden = true; // hidden prey: the token vanishes from everyone else's view
    await prey.update(update, moveOpts({ animate: true }));
    if (slotCfg.gearMode === "strip") {
      const gear = await stripGear(prey);
      if (gear.length) await prey.update({ [`${FLAG}.prey.gear`]: gear }, moveOpts());
    }
    await setStatus(prey, "vored", true);
    for (const statusId of added) await setStatus(prey, statusId, true);
    ids.add(id);
    names.push(prey.name);
    swallowed.push(prey);
  }
  if (!names.length) return;
  await setPredPreys(pred, [...ids]);
  logEvent(scene, `${logName(pred)} swallowed ${swallowed.map(logName).join(", ")}${forced ? " (they forced their way in)" : ""}${swallowed.some((p) => getPrey(p)?.timed) ? " \u2014 timed digestion" : ""}.`, { secret });
  if (!hideTokens) playEvent(pred, slot, "swallowSound", secret); // no sound while the prey is hidden
  for (const prey of swallowed) await describeInside(prey, pred, slot, "descSwallow");
  const whisper = secret ? audience([pred, ...swallowed]) : undefined;
  const template = (slotCfg.swallowMessage ?? "").trim() || "{predator} swallows {prey}.";
  if (forced) {
    // Each prey's own text for this Vore type (set in their Vore tab), one line each.
    for (const prey of swallowed) {
      const mine = getConfig(prey).forceFed ?? {};
      const text = String(mine[slotCfg.label] ?? "").trim() || `{prey} forces themselves into {predator}.`;
      await say(`<p>${fmtMsg(text, { predator: `<strong>${esc(pred.name)}</strong>`, prey: `<strong>${esc(prey.name)}</strong>` })}</p>`, { whisper });
    }
  } else {
    await say(
      `<p>${fmtMsg(template, {
        predator: `<strong>${esc(pred.name)}</strong>`,
        prey: `<strong>${names.map(esc).join(", ")}</strong>`
      })}</p>`,
      { whisper }
    );
  }
}

/** GM: make a hidden held prey visible again. Their sounds start, and the vore is no longer secret. */
export async function revealPrey(prey) {
  const st = getPrey(prey);
  if (!st || !prey.hidden) return false;
  const pred = prey.parent.tokens.get(st.predatorId);
  await prey.update({ hidden: false, [`${FLAG}.prey.secret`]: false }, moveOpts());
  logEvent(prey.parent, `${logName(prey)} was revealed${pred ? ` inside ${logName(pred)}` : ""}.`, { secret: false });
  return true;
}

/** Free a prey token (escape, GM release or restore). */
export async function release(prey, { place = true, restoreImage } = {}) {
  const st = getPrey(prey);
  const digestedFlag = prey.getFlag(MODULE_ID, "digested");
  const scene = prey.parent;
  const pred = st ? scene.tokens.get(st.predatorId) : null;
  const original = st?.original ?? digestedFlag?.original;
  const gear = st?.gear ?? digestedFlag?.gear;
  const slotCfg = pred ? getSlot(getConfig(pred), st?.slot ?? 0) : {};
  restoreImage ??= !st?.digested;

  const update = {};
  if (st) update[`${FLAG}.-=prey`] = null;
  if (restoreImage && original) {
    update["texture.src"] = original.img;
    update["texture.scaleX"] = original.scaleX;
    update["texture.scaleY"] = original.scaleY;
    update.rotation = original.rotation;
    update[`${FLAG}.-=digested`] = null;
    if (original.hidden !== undefined) update.hidden = original.hidden; // end of Secret Vore
  } else if (st?.digested && original) {
    update[`${FLAG}.digested`] = { original, gear };
  }
  if (place && pred) {
    const spot = findFreeSpot(pred, prey);
    if (spot) Object.assign(update, spot);
  }
  await prey.update(update, moveOpts({ animate: true }));
  logEvent(scene, st && !st.digested
    ? `${logName(prey)} was released from ${logName(pred)}.`
    : `${logName(prey)} was restored${pred ? ` (digested by ${logName(pred)})` : ""}.`, { secret: !!st?.secret });
  await setStatus(prey, "vored", false);
  for (const statusId of st?.added ?? []) await setStatus(prey, statusId, false);
  if (restoreImage) await setStatus(prey, "dead", false);
  if (restoreImage && gear?.length) await restoreGear(prey, gear);
  if (restoreImage && st && !st.digested && slotCfg.gearMode === "slime") await applySlimed(prey);
  if (pred) {
    const ids = (getPred(pred)?.preyIds ?? []).filter((i) => i !== prey.id);
    await setPredPreys(pred, ids);
    if (st && !st.digested) playEvent(pred, st.slot, "escapeSound", st.secret);
  }
}

export async function digest(prey) {
  const st = getPrey(prey);
  if (!st || st.digested) return;
  const scene = prey.parent;
  const pred = scene.tokens.get(st.predatorId);
  if (pred && isEndoOnly(pred)) return; // an Endo-only predator can never digest anyone
  const cfg = pred ? getConfig(pred) : null;
  const slotCfg = cfg ? getSlot(cfg, st.slot) : {};

  const update = { [`${FLAG}.prey.digested`]: true };
  if (slotCfg.digestedImg) update["texture.src"] = slotCfg.digestedImg;
  await prey.update(update, moveOpts());
  await setStatus(prey, "vored", false);
  for (const statusId of st.added ?? []) await setStatus(prey, statusId, false);
  await setStatus(prey, "dead", true, true);
  logEvent(scene, `${logName(prey)} was digested${pred ? ` by ${logName(pred)}` : ""}.`, { secret: !!st.secret });
  if (pred) {
    if (!prey.hidden) playEvent(pred, st.slot, "digestSound", st.secret);
    await describeInside(prey, pred, st.slot, "descDigested");
  }

  // Predator recovers 1/4 of the prey's max HP and gains temp HP equal to 1/8.
  const preyHp = prey.actor?.system.attributes.hp;
  const predActor = pred?.actor;
  let heal = 0;
  let temp = 0;
  if (preyHp && predActor && game.settings.get(MODULE_ID, "digestHeal")) {
    const max = preyHp.effectiveMax ?? preyHp.max ?? 0;
    // The predator recovers 1/4 of the prey's max HP and gains temp HP equal to 1/8.
    heal = Math.floor(max / 4);
    temp = Math.floor(max / 8);
    const hp = predActor.system.attributes.hp;
    const predMax = hp.effectiveMax ?? hp.max ?? 0;
    await predActor.update({
      "system.attributes.hp.value": Math.min(predMax, (hp.value ?? 0) + heal),
      "system.attributes.hp.temp": Math.max(hp.temp ?? 0, temp)
    });
  }
  // Old saved default mentioned healing; treat it as blank so it doesn't claim a heal that didn't happen.
  const OLD = "{prey} has been digested. {predator} recovers {heal} HP and gains {temp} temporary HP.";
  let template = (slotCfg.digestMessage ?? "").trim();
  if (!template || template === OLD) {
    template = "{prey} has been digested." + (heal || temp ? " {predator} recovers {heal} HP and gains {temp} temporary HP." : "");
  }
  await say(
    `<p>${fmtMsg(template, {
      predator: `<strong>${esc(pred?.name ?? "The predator")}</strong>`,
      prey: `<strong>${esc(prey.name)}</strong>`,
      heal,
      temp
    })}</p>`,
    { whisper: st.secret ? audience([pred, prey].filter(Boolean)) : undefined }
  );

  // Each Vore option decides whether digested prey are left behind or kept on the predator.
  if ((slotCfg.digestedPlacement ?? "adjacent") === "adjacent") {
    await release(prey, { place: true, restoreImage: false });
  }
}

/* -------------------------------------------- */
/*  Hooks: movement lock, glue, cleanup          */
/* -------------------------------------------- */

const MOVE_KEYS = ["x", "y", "rotation", "elevation", "width", "height"];

async function syncGlue(pred) {
  const scene = pred.parent;
  const cfg = getConfig(pred);
  for (const id of getPred(pred)?.preyIds ?? []) {
    const prey = scene.tokens.get(id);
    const st = getPrey(prey);
    if (!prey || !st) continue;
    const slotCfg = getSlot(cfg, st.slot);
    const place = preyPlacement(pred, prey, slotCfg);
    const scale = Number(slotCfg.scale) || 1;
    const target = {
      x: place.x,
      y: place.y,
      rotation: place.rotation,
      elevation: pred.elevation,
      "texture.scaleX": place.sx * Math.abs(st.original.scaleX) * scale,
      "texture.scaleY": place.sy * Math.abs(st.original.scaleY) * scale
    };
    // Skip if the prey is already exactly where it should be.
    const current = {
      x: prey.x,
      y: prey.y,
      rotation: prey.rotation,
      elevation: prey.elevation,
      "texture.scaleX": prey.texture.scaleX,
      "texture.scaleY": prey.texture.scaleY
    };
    const same = Object.keys(target).every((k) => Math.abs((target[k] ?? 0) - (current[k] ?? 0)) < 0.01);
    // With smooth attach, clients already show the prey moving with the predator; just commit the result.
    if (!same) await prey.update(target, moveOpts({ animate: !isSmoothAttach() }));
  }
}

export function registerVoreHooks() {
  // Prey cannot move themselves; only this module (or a GM release) may move them.
  Hooks.on("preUpdateToken", (doc, changes, options) => {
    if (options?.voreMove) return;
    if (!getPrey(doc)) return;
    if (MOVE_KEYS.some((k) => k in changes)) {
      ui.notifications.warn(`${doc.name} is held by a predator. Use the token HUD to release them.`);
      return false;
    }
  });

  // Prey follows the predator (position, rotation, flip).
  // Any update to a predator re-syncs its prey (the sync is a no-op when nothing moved), so we don't
  // depend on which keys Foundry puts in `changes` for a drag, rotate or mirror.
  Hooks.on("updateToken", async (doc, changes, options) => {
    if (!isActiveGM()) return;
    if (!getPred(doc)?.preyIds?.length) return;
    const flipped = changes.texture && ("scaleX" in changes.texture || "scaleY" in changes.texture);
    const moved = MOVE_KEYS.some((k) => k in changes) || flipped;
    if (options?.voreMove && !moved) return; // our own bookkeeping updates
    try {
      await syncGlue(doc);
    } catch (e) {
      console.error("vore-system | glue failed", e);
    }
  });

  // A token config form only saves what the GM actually changed, so unchanged tokens keep inheriting
  // from the actor's prototype token.
  Hooks.on("preUpdateToken", (doc, changes) => {
    const mine = changes.flags?.[MODULE_ID];
    if (mine?.config) normalizeStages(doc, mine.config);
    if (!mine?.config || flagOf(doc, "config")) return;
    stripDefaultValues(mine.config);
    const base = getConfig(doc, { defaults: false });
    const merged = foundry.utils.mergeObject(foundry.utils.deepClone(base), mine.config, { inplace: false });
    const diff = foundry.utils.diffObject(base, merged);
    if (foundry.utils.isEmpty(diff)) delete mine.config;
    else mine.config = diff;
  });

  // Digestion stages: when a held prey's HP crosses 66% / 33%, swap their token image to the stage's image.
  Hooks.on("updateActor", async (actor, changes) => {
    if (!isActiveGM() || foundry.utils.getProperty(changes, "system.attributes.hp") === undefined) return;
    for (const prey of actor.getActiveTokens(false, true)) {
      const st = getPrey(prey);
      if (!st || st.digested) continue;
      const pred = prey.parent.tokens.get(st.predatorId);
      if (!pred) continue;
      const stage = stageOf(actor);
      if ((st.stage ?? 0) === stage) continue;
      const slot = getSlot(getConfig(pred), st.slot);
      const img = effectiveSlot(slot, stage).preyImg || st.original?.img;
      const update = { [`${FLAG}.prey.stage`]: stage };
      if (img && img !== prey.texture.src) update["texture.src"] = img;
      await prey.update(update, moveOpts());
    }
  });

  // Saving a prototype token (actor) form: same rule, so defaults aren't copied into the actor.
  Hooks.on("preUpdateActor", (actor, changes) => {
    const cfg = changes.prototypeToken?.flags?.[MODULE_ID]?.config;
    if (cfg) {
      normalizeStages(actor, cfg);
      stripDefaultValues(cfg);
    }
  });

  Hooks.on("deleteToken", async (doc) => {
    if (!isActiveGM()) return;
    const scene = doc.parent;
    for (const id of getPred(doc)?.preyIds ?? []) {
      const prey = scene.tokens.get(id);
      if (prey) await release(prey, { place: false });
    }
    const st = getPrey(doc);
    const pred = st && scene.tokens.get(st.predatorId);
    if (pred) await setPredPreys(pred, (getPred(pred)?.preyIds ?? []).filter((i) => i !== doc.id));
  });
}
