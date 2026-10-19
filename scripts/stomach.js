import { MODULE_ID } from "./const.js";
import { getPrey, getPred, getConfig, tokenDoc, ownsToken, esc, say, scopeFor, audience } from "./util.js";
import { register, request } from "./socket.js";
import { release } from "./vore.js";

const { DialogV2 } = foundry.applications.api;
const FLAG = `flags.${MODULE_ID}`;

/** Optional world rule: the predator's stomach has its own AC and HP that prey can break through. */
export const stomachOn = () => game.settings.get(MODULE_ID, "stomachRules");

const hasValue = (v) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0;

export function stomachAC(pred) {
  const set = getConfig(pred).stomachAC;
  return hasValue(set) ? Number(set) : 10 + (pred.actor?.system.abilities?.con?.mod ?? 0);
}

export function stomachMax(pred) {
  const set = getConfig(pred).stomachHP;
  if (hasValue(set)) return Number(set);
  const hp = pred.actor?.system.attributes.hp;
  return Math.max(1, Math.floor((hp?.effectiveMax ?? hp?.max ?? 10) / 2));
}

const stomachHp = (pred) => pred.getFlag(MODULE_ID, "stomach")?.hp ?? stomachMax(pred);

/** Players never see numbers, only the state of the wall. */
function wallCondition(pred, hp) {
  const pct = (hp / stomachMax(pred)) * 100;
  return pct > 75 ? "still firm" : pct > 50 ? "straining" : pct > 25 ? "tearing" : "about to give way";
}

/** Prey side: roll a simple attack from inside and report it to the GM. */
export async function stomachStrikeAction(prey) {
  const st = getPrey(prey);
  if (!st || st.digested || !prey.actor) return ui.notifications.warn("That token isn't being held.");
  const abilities = prey.actor.system.abilities ?? {};
  const options = ["str", "dex"].map((k) => `<option value="${k}">${k.toUpperCase()} (${abilities[k]?.mod >= 0 ? "+" : ""}${abilities[k]?.mod ?? 0})</option>`).join("");
  const choice = await DialogV2.prompt({
    window: { title: "Strike the stomach wall" },
    content: `<div class="form-group"><label>Attack with</label><div class="form-fields"><select name="ability">${options}</select></div></div>
      <div class="form-group"><label>Damage</label><div class="form-fields"><input type="text" name="formula" value="1d4 + @mod"></div>
      <p class="hint">Use @mod for the ability modifier. Unarmed is 1 + @mod; a weapon uses its own dice.</p></div>`,
    ok: { label: "Strike", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if (!choice) return;
  const mod = abilities[choice.ability]?.mod ?? 0;
  const prof = prey.actor.system.attributes?.prof ?? 0;
  const roll = await new Roll("1d20 + @mod + @prof", { mod, prof }).evaluate();
  const pred = tokenDoc(prey.parent.id, st.predatorId);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ token: prey }),
    flavor: "Strike from within",
    whisper: audience([pred, prey].filter(Boolean))
  });
  const nat = roll.dice[0]?.results[0]?.result ?? 0;
  request("stomachStrike", { sceneId: prey.parent.id, preyId: prey.id, attack: roll.total, nat, formula: choice.formula, mod });
}

/** GM side. */
export function registerStomach() {
  register("stomachStrike", async ({ sceneId, preyId, attack, nat, formula, mod }, userId) => {
    if (!stomachOn()) return;
    const prey = tokenDoc(sceneId, preyId);
    const st = getPrey(prey);
    if (!prey?.actor || !st || st.digested || !ownsToken(prey, game.users.get(userId))) return;
    const pred = tokenDoc(sceneId, st.predatorId);
    if (!pred) return;
    const whisper = scopeFor(pred, prey);
    const ac = stomachAC(pred);
    const hit = nat === 20 || (nat !== 1 && attack >= ac);
    if (!hit) {
      return say(`<p><strong>${esc(prey.name)}</strong> pounds on the walls of <strong>${esc(pred.name)}</strong>'s stomach, but it holds.</p>`, { whisper });
    }
    let damage = 0;
    try {
      damage = (await new Roll(String(formula || "1d4"), { mod }).evaluate()).total;
      if (nat === 20) damage += (await new Roll(String(formula || "1d4"), { mod }).evaluate()).total;
    } catch (e) {
      damage = Math.max(1, Number(mod) || 1);
    }
    damage = Math.max(1, damage);
    const hp = Math.max(0, stomachHp(pred) - damage);
    await pred.update({ [`${FLAG}.stomach`]: { hp } }, { voreMove: true });
    if (hp > 0) {
      return say(`<p><strong>${esc(prey.name)}</strong> hits the walls of <strong>${esc(pred.name)}</strong>'s stomach. They are ${wallCondition(pred, hp)}.</p>`, { whisper });
    }
    await say(`<p><strong>${esc(pred.name)}</strong>'s stomach gives way! Everyone inside spills out.</p>`, { whisper });
    for (const id of [...(getPred(pred)?.preyIds ?? [])]) {
      const held = tokenDoc(sceneId, id);
      if (held && getPrey(held) && !getPrey(held).digested) await release(held, { place: true });
    }
  });
}
