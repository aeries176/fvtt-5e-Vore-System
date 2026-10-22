import { MODULE_ID } from "./const.js";
import { digest } from "./vore.js";
import { isPlayerCharacter, getPrey } from "./util.js";
import { describeInside } from "./inside.js";

/** Level for characters, CR for monsters, clamped to 1-20. */
export function effectiveLevel(actor) {
  const d = actor.system.details ?? {};
  const raw = Number(d.level ?? d.cr ?? 1) || 1;
  return Math.min(20, Math.max(1, Math.floor(raw)));
}

const conMod = (actor) => actor.system.abilities?.con?.mod ?? 0;
const fmt = (dice, size, mod) => `${dice}d${size} ${mod < 0 ? "-" : "+"} ${Math.abs(mod)}`;
const setting = (key, fallback) => {
  const v = Number(game.settings.get(MODULE_ID, key));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};

/** Digestion damage per predator turn: 1d6 + CON, with another 1d6 every 5 levels. */
export const turnFormula = (actor) => fmt(1 + Math.floor(effectiveLevel(actor) / 5), 6, conMod(actor));
/** Churn: 2d6 + CON, with another 2d6 every 5 levels. */
export const churnFormula = (actor) => fmt(2 + 2 * Math.floor(effectiveLevel(actor) / 5), 6, conMod(actor));

/** Roll Athletics or Acrobatics via dnd5e and return the total. mode: "norm" | "adv" | "dis". */
export async function rollSkillTotal(actor, skill, mode = "norm") {
  const advantage = mode === "adv";
  const disadvantage = mode === "dis";
  let result;
  try {
    result = await actor.rollSkill({ skill, advantage, disadvantage }, { configure: false }, { create: true });
  } catch (e) {
    result = await actor.rollSkill(skill, { fastForward: true, advantage, disadvantage });
  }
  const roll = Array.isArray(result) ? result[0] : result;
  return roll?.total ?? null;
}

/** Roll a saving throw via dnd5e and return the total. */
export async function rollSaveTotal(actor, ability) {
  let result;
  try {
    result = await actor.rollSavingThrow({ ability }, { configure: false }, { create: true });
  } catch (e) {
    result = await actor.rollAbilitySave(ability, { fastForward: true });
  }
  const roll = Array.isArray(result) ? result[0] : result;
  return roll?.total ?? null;
}

const SIZES = ["tiny", "sm", "med", "lg", "huge", "grg"];
const sizeIndex = (actor) => {
  const i = SIZES.indexOf(actor?.system?.traits?.size);
  return i < 0 ? 2 : i;
};

/**
 * Optional rule (world setting): the larger creature rolls with advantage; if it is two or more
 * sizes larger, the smaller one also rolls with disadvantage. Returns the mode for each side.
 */
export function sizeModes(predActor, preyActor) {
  const none = { pred: "norm", prey: "norm" };
  if (!game.settings.get(MODULE_ID, "sizeMatters")) return none;
  const d = sizeIndex(predActor) - sizeIndex(preyActor);
  if (d === 0) return none;
  if (d > 0) return { pred: "adv", prey: d >= 2 ? "dis" : "norm" };
  return { prey: "adv", pred: d <= -2 ? "dis" : "norm" };
}

/** Advantage and disadvantage cancel; otherwise whichever isn't "norm" wins. */
export function combineMode(a, b) {
  if (a === "norm") return b;
  if (b === "norm") return a;
  return a === b ? a : "norm";
}

/** NPC helper: whichever of the two skills is better. */
export function bestSkill(actor) {
  const s = actor.system.skills ?? {};
  return (s.acr?.total ?? 0) > (s.ath?.total ?? 0) ? "acr" : "ath";
}

export async function rollDamage(formula, flavor, alias) {
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({ speaker: { alias }, flavor });
  return roll.total;
}

/** Healing "digestion": prey recover HP (never past their max) and wake up if they were at 0. */
export async function applyPreyHealing(prey, total) {
  const actor = prey.actor;
  const hp = actor?.system.attributes.hp;
  if (!hp || total <= 0) return;
  const max = hp.effectiveMax ?? hp.max ?? 0;
  const now = hp.value ?? 0;
  await actor.update({ "system.attributes.hp.value": Math.min(max, now + total) });
}

/**
 * Apply digestion damage to a prey token.
 * Non-players at 0 HP are digested. Players start making death saves; damage at 0 HP adds one failure.
 * Returns "alive" | "dying" | "digested".
 */
export async function applyPreyDamage(prey, total) {
  const actor = prey.actor;
  const hp = () => actor.system.attributes.hp.value ?? 0;
  const failures = () => actor.system.attributes.death?.failure ?? 0;
  const before = hp();
  const tempBefore = actor.system.attributes.hp.temp ?? 0;
  const failBefore = failures();
  const st = getPrey(prey);
  const pred = st && prey.parent.tokens.get(st.predatorId);
  const max = actor.system.attributes.hp.effectiveMax ?? actor.system.attributes.hp.max ?? 0;

  // Digestion and Churn hit as half acid, half bludgeoning (each type meets resistances separately).
  const mixed = [
    { value: Math.ceil(total / 2), type: "acid", properties: new Set() },
    { value: Math.floor(total / 2), type: "bludgeoning", properties: new Set() }
  ].filter((d) => d.value > 0);
  try {
    await actor.applyDamage(mixed);
  } catch (e) {
    try {
      // If this dnd5e build can't take a split, fall back to all acid, then to plain damage.
      await actor.applyDamage([{ value: total, type: "acid", properties: new Set() }]);
    } catch (e2) {
      try {
        await actor.applyDamage(total);
      } catch (e3) {
        await actor.update({ "system.attributes.hp.value": Math.max(0, before - total) });
      }
    }
  }
  if (hp() === before && (actor.system.attributes.hp.temp ?? 0) === tempBefore && total > 0 && before > 0) {
    // Some versions swallow a bad payload silently; make sure the damage landed.
    await actor.update({ "system.attributes.hp.value": Math.max(0, before - total) });
  }
  if (hp() > 0) {
    // Fire the lowest stage threshold (66% / 33%) this hit crossed.
    if (pred && max > 0) {
      const crossed = [33, 66].find((t) => (before / max) * 100 > t && (hp() / max) * 100 <= t);
      if (crossed) await describeInside(prey, pred, st.slot, `descHp${crossed}`);
    }
    return "alive";
  }

  if (!isPlayerCharacter(actor)) {
    await digest(prey);
    return "digested";
  }
  let fails = failures();
  // Already at 0 HP: this hit counts as exactly one failed death save (unless dnd5e already added it).
  if (before <= 0 && fails === failBefore) {
    fails = Math.min(3, fails + 1);
    await actor.update({ "system.attributes.death.failure": fails });
  }
  if (fails >= 3) {
    await digest(prey);
    return "digested";
  }
  if (pred && before > 0) await describeInside(prey, pred, st.slot, "descDying");
  return "dying";
}
