import { getPrey, getPred, isActiveGM } from "./util.js";
import { postContest, onPredatorTurn } from "./cards.js";

export function registerCombatHooks() {
  Hooks.on("updateCombat", async (combat, changed) => {
    if (!isActiveGM() || !combat.started) return;
    if (!("turn" in changed) && !("round" in changed)) return;
    const token = combat.combatant?.token;
    if (!token) return;
    const sceneId = token.parent.id;

    // Start of the prey's turn: opposed escape check against the predator.
    const prey = getPrey(token);
    if (prey && !prey.digested) {
      await postContest({ kind: "escape", sceneId, predId: prey.predatorId, preyIds: [token.id] });
    }
    // Start of the predator's turn: death saves, then digestion damage.
    if (getPred(token)?.preyIds?.length) await onPredatorTurn(token);
  });
}
