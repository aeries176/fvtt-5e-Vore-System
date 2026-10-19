import { MODULE_ID } from "./const.js";
import { getPrey, getPred, tokenDoc, ownsToken } from "./util.js";
import { register, request } from "./socket.js";
import { postBreakout } from "./cards.js";

/**
 * Optional rule ("Prey can strike from inside", world setting).
 *
 * Prey attack the predator from their character sheet as normal. Damage the predator takes counts toward
 * a breakout when it happens (a) during the turn of one of its prey in combat, or (b) within two minutes
 * of the prey pressing "Strike from within". Reaching the threshold in a round makes the predator roll a
 * Constitution save; on a failure everyone inside is released.
 */

const WINDOW_MS = 120_000;
const pending = new Map(); // predator token id -> time the strike window ends
const totals = new Map(); // predator token id -> { key, total, triggered, at }

// When "Stomach rules" is on, breaking out works through the stomach's AC and HP instead.
const enabled = () => game.settings.get(MODULE_ID, "preyStrikeBack") && !game.settings.get(MODULE_ID, "stomachRules");

export function registerStrike() {
  register("strikeStart", ({ sceneId, preyId }, userId) => {
    if (!enabled()) return;
    const prey = tokenDoc(sceneId, preyId);
    const st = getPrey(prey);
    if (!st || st.digested || !ownsToken(prey, game.users.get(userId))) return;
    pending.set(st.predatorId, Date.now() + WINDOW_MS);
  });

  register("strikeDamage", async ({ sceneId, predId, amount }) => {
    if (!enabled() || !(amount > 0)) return;
    const pred = tokenDoc(sceneId, predId);
    const preyIds = (getPred(pred)?.preyIds ?? []).filter((id) => !getPrey(pred.parent.tokens.get(id))?.digested);
    if (!preyIds.length) return;

    const combat = game.combat;
    const inCombat = !!combat?.started;
    const preyTurn = inCombat && preyIds.includes(combat.combatant?.token?.id);
    if (!preyTurn && (pending.get(predId) ?? 0) < Date.now()) return;

    const now = Date.now();
    const key = inCombat ? `${combat.id}:${combat.round}` : "free";
    let st = totals.get(predId);
    if (!st || st.key !== key || (key === "free" && now - st.at > 60_000)) st = { key, total: 0, triggered: false, at: now };
    st.total += amount;
    st.at = now;
    totals.set(predId, st);

    const threshold = Number(game.settings.get(MODULE_ID, "breakoutThreshold")) || 20;
    if (!st.triggered && st.total >= threshold) {
      st.triggered = true;
      await postBreakout({ sceneId, predId, total: st.total });
    }
  });

  // Whoever applies damage to a predator that is holding prey reports it; the GM decides if it counts.
  Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id || !enabled()) return;
    const newHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
    if (newHp === undefined) return;
    const amount = (actor.system.attributes.hp.value ?? 0) - newHp;
    if (amount <= 0) return;
    for (const token of canvas.scene?.tokens ?? []) {
      if (token.actor === actor && getPred(token)?.preyIds?.length) {
        request("strikeDamage", { sceneId: token.parent.id, predId: token.id, amount });
      }
    }
  });
}
