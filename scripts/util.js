import { MODULE_ID, DEFAULT_CONFIG } from "./const.js";

/** Read a module flag from a TokenDocument, a PrototypeToken, or an Actor (via its prototype token). */
export function flagOf(doc, key) {
  const src = doc?.prototypeToken ?? doc;
  return foundry.utils.getProperty(src?.flags ?? {}, `${MODULE_ID}.${key}`) ?? null;
}

export const getPrey = (doc) => flagOf(doc, "prey");
export const getPred = (doc) => flagOf(doc, "pred");

/** Defaults <- actor prototype token config <- this token's own (possibly partial) overrides. */
export function getConfig(doc, { defaults = true } = {}) {
  const proto = doc?.actor ? flagOf(doc.actor, "config") : null;
  const own = flagOf(doc, "config");
  let cfg = foundry.utils.deepClone(DEFAULT_CONFIG);
  if (proto) cfg = foundry.utils.mergeObject(cfg, proto, { inplace: false });
  if (own) cfg = foundry.utils.mergeObject(cfg, own, { inplace: false });
  if (defaults) applyImageDefaults(cfg);
  return cfg;
}

/** Module defaults for Vore option 1 (images and sounds), keyed by slot index. Empty settings are left out. */
function slotDefaults() {
  const get = (key) => game.settings.get(MODULE_ID, key) || "";
  const first = {
    preyImg: get("defaultPreyImg1"),
    digestedImg: get("defaultDigestedImg1"),
    sound: get("defaultSound1"),
    swallowSound: get("defaultSwallowSound1"),
    escapeSound: get("defaultEscapeSound1"),
    digestSound: get("defaultDigestSound1")
  };
  return { 0: Object.fromEntries(Object.entries(first).filter(([, v]) => v)) };
}

/**
 * Vore option 1's default images and sounds fill any empty slot. They are applied when read, so they also
 * reach tokens that existed before the default was set. Pass { defaults: false } for the raw stored values.
 */
function applyImageDefaults(cfg) {
  for (const [i, values] of Object.entries(slotDefaults())) {
    const slot = cfg.slots[i];
    if (!slot) continue;
    for (const [key, value] of Object.entries(values)) if (!slot[key]) slot[key] = value;
  }
}

/** Remove values that merely repeat a module default from a config being saved, so defaults stay defaults. */
export function stripDefaultValues(cfg) {
  if (!cfg?.slots) return cfg;
  for (const [i, values] of Object.entries(slotDefaults())) {
    const slot = cfg.slots[i];
    if (!slot) continue;
    for (const [key, value] of Object.entries(values)) if (slot[key] === value) delete slot[key];
  }
  return cfg;
}

/** Slots the GM has given a label to. Falls back to the first (default) slot. */
export function activeSlots(cfg) {
  const list = [0, 1, 2]
    .map((i) => ({ index: i, ...cfg.slots[i] }))
    .filter((s) => s.label?.trim());
  return list.length ? list : [{ index: 0, ...cfg.slots[0], label: cfg.slots[0].label || "Default" }];
}

export function getSlot(cfg, index) {
  return cfg.slots[index] ?? cfg.slots[0];
}

export const isActiveGM = () => game.users.activeGM?.id === game.user.id;

export function tokenDoc(sceneId, tokenId) {
  return game.scenes.get(sceneId)?.tokens.get(tokenId) ?? null;
}

export function ownsToken(doc, user = game.user) {
  return !!user?.isGM || !!doc?.actor?.testUserPermission(user, "OWNER");
}

export function hasActivePlayerOwner(doc) {
  return game.users.some((u) => u.active && !u.isGM && doc?.actor?.testUserPermission(u, "OWNER"));
}

/** Player characters get death saves; everything else is digested outright. */
export const isPlayerCharacter = (actor) => actor?.type === "character" && actor.hasPlayerOwner;

export function say(html, { whisper } = {}) {
  return ChatMessage.create({
    content: html,
    speaker: { alias: "Vore" },
    whisper: whisper?.length ? whisper : undefined,
    flags: { [MODULE_ID]: { notice: true } }
  });
}

/** GMs plus anyone who owns one of these tokens' actors. */
export function audience(docs) {
  return game.users
    .filter((u) => u.isGM || docs.some((d) => d?.actor?.testUserPermission(u, "OWNER")))
    .map((u) => u.id);
}

/** Chat audience for an event. Secret Vore stays between the predator, the prey and the GM; otherwise public (undefined). */
export function scopeFor(pred, preys) {
  const list = [].concat(preys).filter(Boolean);
  if (!list.some((p) => getPrey(p)?.secret)) return undefined;
  return audience([pred, ...list]);
}

/** Digestion stage from the prey's HP: 0 = healthy, 1 = at or below 66%, 2 = at or below 33%. */
export function stageOf(actor) {
  const hp = actor?.system?.attributes?.hp;
  const max = hp?.effectiveMax ?? hp?.max ?? 0;
  if (!max) return 0;
  const pct = ((hp.value ?? 0) / max) * 100;
  return pct <= 33 ? 2 : pct <= 66 ? 1 : 0;
}

/** A Vore option with its digestion-stage overrides applied (stage 2 includes stage 1's overrides). */
export function effectiveSlot(slot, stage) {
  if (!slot || !stage) return slot;
  const out = { ...slot };
  for (let n = 1; n <= stage; n++) {
    for (const [k, v] of Object.entries(slot[`stage${n}`] ?? {})) {
      if (v === "" || v === null || v === undefined) continue;
      out[k] = v === "on" ? true : v === "off" ? false : /^fx(Strength|Distortion)$/.test(k) ? Number(v) : v;
    }
  }
  return out;
}

/** Oath of the Matron and similar: a predator that can never harm what it holds. */
export const isEndoOnly = (pred) => !!pred?.actor?.items?.some((i) => i.getFlag(MODULE_ID, "endoOnly"));

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Fill {placeholders} in a GM-written template. The template is escaped; values must already be safe HTML. */
export function fmtMsg(template, vars) {
  let text = esc(template);
  for (const [key, value] of Object.entries(vars)) text = text.replaceAll(`{${key}}`, value);
  return text;
}

/** Endo: predator holds prey without harming them. Ignored while the world setting is off. */
export const isEndo = (pred) => isEndoOnly(pred) || (!!flagOf(pred, "endo") && game.settings.get(MODULE_ID, "allowEndo"));
