import { MODULE_ID } from "./const.js";
import { getPrey, getPred, ownsToken, esc, isEndo } from "./util.js";

/* -------------------------------------------- */
/*  Combat tracker: who is inside whom           */
/* -------------------------------------------- */

function badgeFor(token) {
  const scene = token.parent;
  const st = getPrey(token);
  if (st?.secret && !game.user.isGM) return null;
  if (st) {
    const pred = scene.tokens.get(st.predatorId);
    const label = st.digested ? "Digested inside" : "Inside";
    const pct = st.timed && !st.digested ? ` (${Math.min(100, Math.round((st.timed.elapsed / st.timed.total) * 100))}%)` : "";
    return `${label} ${esc(pred?.name ?? "?")}${pct}`;
  }
  const names = (getPred(token)?.preyIds ?? [])
    .map((id) => scene.tokens.get(id))
    .filter((t) => t && (game.user.isGM || !getPrey(t)?.secret))
    .map((t) => esc(t.name));
  return names.length ? `Holding ${names.join(", ")}${isEndo(token) ? " (Endo)" : ""}` : null;
}

function decorateTracker(app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const combat = app.viewed ?? game.combat;
  if (!root || !combat) return;
  root.querySelectorAll("li.combatant").forEach((li) => {
    li.querySelector(".vore-badge")?.remove();
    const token = combat.combatants.get(li.dataset.combatantId)?.token;
    const text = token && badgeFor(token);
    if (!text) return;
    const badge = document.createElement("div");
    badge.className = "vore-badge";
    badge.innerHTML = `<i class="fa-solid fa-utensils"></i> ${text}`;
    (li.querySelector(".token-name") ?? li).append(badge);
  });
}

/* -------------------------------------------- */
/*  Full cover: outsiders can't target held prey */
/* -------------------------------------------- */

function guardTargeting(user, token, targeted) {
  if (!targeted || user.id !== game.user.id || game.user.isGM) return;
  const st = getPrey(token.document);
  if (!st || st.digested || !st.fullCover) return;
  const pred = token.document.parent.tokens.get(st.predatorId);
  // The predator and the prey themselves can still target each other.
  if (ownsToken(token.document) || (pred && ownsToken(pred))) return;
  token.setTarget(false, { user, releaseOthers: false, groupSelection: true });
  ui.notifications.info(`${token.name} has full cover inside ${pred?.name ?? "the predator"}.`);
}

export function registerExtras() {
  Hooks.on("renderCombatTracker", decorateTracker);
  Hooks.on("targetToken", guardTargeting);
  // Keep the tracker badges current as vore state changes.
  Hooks.on("updateToken", (doc, changes) => {
    if (changes.flags && MODULE_ID in changes.flags) ui.combat?.render?.();
  });
}
