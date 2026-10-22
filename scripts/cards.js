import { MODULE_ID } from "./const.js";
import {
  getPrey, getPred, getConfig, getSlot, activeSlots, tokenDoc, ownsToken, hasActivePlayerOwner, esc, say, fmtMsg, isEndo, isEndoOnly, audience, scopeFor
} from "./util.js";
import { register, registerClient, request, notify } from "./socket.js";
import { startVore, release, digest } from "./vore.js";
import {
  rollSkillTotal, rollSaveTotal, bestSkill, rollDamage, turnFormula, churnFormula, applyPreyDamage, applyPreyHealing,
  sizeModes, combineMode
} from "./rules.js";
import { describeInside } from "./inside.js";
import { stepTimed } from "./timed.js";
import { askSwallow, digestFields, hideField, readDigest } from "./digestchoice.js";

const FLAG = `flags.${MODULE_ID}.card`;
const SKILL_NAMES = { ath: "Athletics", acr: "Acrobatics" };
const { DialogV2 } = foundry.applications.api;

/* -------------------------------------------- */
/*  Card rendering                               */
/* -------------------------------------------- */

const name = (card, id) => esc(tokenDoc(card.sceneId, id)?.name ?? "?");
const participants = (card) => [card.predId, ...card.preyIds];

const TITLES = {
  capture: "Vore Check",
  escape: "Escape Check",
  feed: "Forced Feeding Check",
  forceRelease: "Forced Release Check"
};

function contestHTML(card) {
  const title = TITLES[card.kind] ?? "Vore Check";
  const rows = participants(card)
    .map((id) => {
      const role = id === card.predId ? "Predator" : "Prey";
      const r = card.rolls[id];
      const cell = r
        ? `${SKILL_NAMES[r.skill]}: <strong>${r.total}</strong>`
        : card.resolved
          ? "—"
          : `<em>waiting…</em> <button type="button" data-vore="roll" data-token="${id}">Roll</button>`;
      const size = card.size?.[id];
      const tag = size === "adv" ? " <small>(size: advantage)</small>" : size === "dis" ? " <small>(size: disadvantage)</small>" : "";
      return `<div class="vore-row"><span>${name(card, id)} <em>(${role})</em>${tag}</span><span>${cell}</span></div>`;
    })
    .join("");
  const out = card.outcome ? `<p class="vore-outcome">${card.outcome}</p>` : "";
  return `<div class="vore-card"><h3>${title}</h3>${rows}${out}</div>`;
}

function typeHTML(card) {
  const btns = card.resolved
    ? ""
    : `<button type="button" data-vore="type">Choose how to swallow</button>`;
  const prey = card.preyIds.map((id) => name(card, id)).join(", ");
  return `<div class="vore-card"><h3>Swallow</h3><p>${card.forced ? `${prey} forced their way into ${name(card, card.predId)}. Choose how.` : `${name(card, card.predId)} caught ${prey}.`}</p>${
    card.resolved ? `<p class="vore-outcome">${card.outcome ?? ""}</p>` : btns
  }</div>`;
}

function deathSaveHTML(card) {
  const body = card.resolved
    ? `<p class="vore-outcome">${card.outcome ?? "Resolved."}</p>`
    : `<button type="button" data-vore="deathsave">Roll Death Save</button>`;
  return `<div class="vore-card"><h3>Death Saving Throw</h3><p>${name(card, card.preyId)} is dying inside ${name(card, card.predId)}.</p>${body}</div>`;
}

function damageHTML(card) {
  const body = card.resolved
    ? `<p class="vore-outcome">${card.outcome ?? "Resolved."}</p>`
    : `<button type="button" data-vore="damage">${card.heal ? "Roll Healing" : "Roll Digestion Damage"}</button>`;
  return `<div class="vore-card"><h3>${card.heal ? "Soothing Digestion" : "Digestion"}</h3><p>${name(card, card.predId)} ${card.heal ? "soothes" : "churns"} ${name(card, card.preyId)}.</p>${body}</div>`;
}

function breakoutHTML(card) {
  const body = card.resolved
    ? `<p class="vore-outcome">${card.outcome ?? "Resolved."}</p>`
    : `<button type="button" data-vore="save">Roll Constitution Save (DC ${card.dc})</button>`;
  return `<div class="vore-card"><h3>Breaking Out</h3><p>${name(card, card.predId)} has taken ${card.total} damage from the inside!</p>${body}</div>`;
}

const RENDERERS = {
  capture: contestHTML, escape: contestHTML, feed: contestHTML, forceRelease: contestHTML, type: typeHTML, deathsave: deathSaveHTML, damage: damageHTML, breakout: breakoutHTML
};

/** Who may see a card: a secret check is GM-only (type picks also reach the predator); cards about secretly-held prey stay between the participants. */
function cardAudience(card) {
  const pred = tokenDoc(card.sceneId, card.predId);
  if (card.secret) {
    return card.kind === "type" ? audience([pred]) : game.users.filter((u) => u.isGM).map((u) => u.id);
  }
  const preys = (card.preyIds ?? [card.preyId]).map((id) => tokenDoc(card.sceneId, id));
  return scopeFor(pred, preys);
}

async function postCard(card) {
  const whisper = cardAudience(card);
  return ChatMessage.create({
    content: RENDERERS[card.kind](card),
    speaker: { alias: "Vore" },
    whisper: whisper?.length ? whisper : undefined,
    flags: { [MODULE_ID]: { card } }
  });
}

async function saveCard(msg, card) {
  await msg.update({ content: RENDERERS[card.kind](card), [FLAG]: card });
}

const readCard = (msg) => foundry.utils.deepClone(msg?.getFlag(MODULE_ID, "card") ?? null);

/* -------------------------------------------- */
/*  Private roll prompts                         */
/* -------------------------------------------- */

/** Active non-GM users who control this token. */
function playerOwnerIds(doc) {
  return game.users
    .filter((u) => u.active && !u.isGM && (doc.actor?.testUserPermission(u, "OWNER") || u.character?.id === doc.actor?.id))
    .map((u) => u.id);
}

/** Dialog shown only to the token's owner: pick Athletics/Acrobatics and Normal/Advantage/Disadvantage. */
async function askRoll({ messageId, tokenId, sceneId, card: snapshot }) {
  // A secret check's card is GM-only, so the target's player works from the snapshot sent with the prompt.
  const visible = game.messages.get(messageId);
  const card = visible ? readCard(visible) : snapshot;
  if (!card || card.resolved || card.rolls?.[tokenId]) return;
  const doc = tokenDoc(sceneId, tokenId);
  if (!doc?.actor) return;
  const best = bestSkill(doc.actor);
  const role = card.secret ? "Opposed check" : tokenId === card.predId ? "Predator" : "Prey";
  const skills = Object.entries(SKILL_NAMES)
    .map(([k, v]) => `<option value="${k}" ${k === best ? "selected" : ""}>${v}</option>`)
    .join("");
  const sizeMode = card.size?.[tokenId] ?? "norm";
  const sizeNote =
    sizeMode === "norm" ? "" : `<p><em>Size gives you ${sizeMode === "adv" ? "advantage" : "disadvantage"} on this roll.</em></p>`;
  const content = `
    <p><strong>${esc(doc.name)}</strong> (${role}) — choose how to roll.</p>${sizeNote}
    <div class="form-group"><label>Skill</label><div class="form-fields"><select name="skill">${skills}</select></div></div>
    <div class="form-group"><label>Roll</label><div class="form-fields">
      <select name="mode"><option value="norm">Normal</option><option value="adv">Advantage</option><option value="dis">Disadvantage</option></select>
    </div></div>`;
  const choice = await DialogV2.prompt({
    window: { title: card.secret ? "Opposed Check" : TITLES[card.kind] ?? "Vore Check" },
    content,
    ok: { label: "Roll", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if (!choice) return;
  // Someone else (e.g. the GM) may have rolled for this token while the dialog was open.
  if (visible) {
    const fresh = readCard(game.messages.get(messageId));
    if (!fresh || fresh.resolved || fresh.rolls[tokenId]) return ui.notifications.info("That roll was already made.");
  }
  const total = await rollSkillTotal(doc.actor, choice.skill, combineMode(choice.mode, sizeMode));
  if (total === null) return;
  request("contestRoll", { messageId, tokenId, skill: choice.skill, total });
}

/** GM side: send the roll prompt to the token's player(s), or auto-roll / ask the GM for NPCs. */
async function promptParticipant(messageId, card, id) {
  const doc = tokenDoc(card.sceneId, id);
  if (!doc?.actor) return;
  const owners = playerOwnerIds(doc);
  if (!owners.length && game.settings.get(MODULE_ID, "autoRollNPC")) {
    const skill = bestSkill(doc.actor);
    const total = await rollSkillTotal(doc.actor, skill, card.size?.[id] ?? "norm");
    if (total !== null) await recordRoll(messageId, id, skill, total);
    return;
  }
  const targets = owners.length ? owners : game.users.filter((u) => u.isGM && u.active).map((u) => u.id);
  notify(targets, "promptRoll", { messageId, tokenId: id, sceneId: card.sceneId, card: card.secret ? card : undefined });
}

/* -------------------------------------------- */
/*  Contests (capture / escape)                  */
/* -------------------------------------------- */

/** Size-based advantage/disadvantage for each participant (only when the world setting is on). */
function sizeModesFor(sceneId, predId, preyIds) {
  const predActor = tokenDoc(sceneId, predId)?.actor;
  const result = {};
  const predModes = [];
  for (const id of preyIds) {
    const modes = sizeModes(predActor, tokenDoc(sceneId, id)?.actor);
    result[id] = modes.prey;
    predModes.push(modes.pred);
  }
  // The predator rolls once against everyone, so only use a size mode if it applies to all of them.
  result[predId] = predModes.every((m) => m === predModes[0]) ? predModes[0] ?? "norm" : "norm";
  return result;
}

export async function postContest({ kind, sceneId, predId, preyIds, secret = false }) {
  const card = { kind, sceneId, predId, preyIds, rolls: {}, resolved: false, secret: !!secret, size: sizeModesFor(sceneId, predId, preyIds) };
  const msg = await postCard(card);
  for (const id of participants(card)) await promptParticipant(msg.id, card, id);
}

async function recordRoll(messageId, tokenId, skill, total) {
  const msg = game.messages.get(messageId);
  const card = readCard(msg);
  if (!card || card.resolved || card.rolls[tokenId] || !participants(card).includes(tokenId)) return;
  card.rolls[tokenId] = { skill, total };
  if (participants(card).every((id) => card.rolls[id])) await resolveContest(msg, card);
  else await saveCard(msg, card);
}

async function resolveContest(msg, card) {
  card.resolved = true;
  const predTotal = card.rolls[card.predId].total;
  const pred = tokenDoc(card.sceneId, card.predId);

  if (card.kind === "capture") {
    const caught = card.preyIds.filter((id) => predTotal > card.rolls[id].total);
    const missed = card.preyIds.filter((id) => !caught.includes(id));
    card.outcome = [
      caught.length ? `Caught: ${caught.map((id) => name(card, id)).join(", ")}.` : "",
      missed.length ? `Slipped away: ${missed.map((id) => name(card, id)).join(", ")}.` : ""
    ].join(" ");
    await saveCard(msg, card);
    if (caught.length) await chooseType(card, caught, { secret: card.secret });
  } else if (card.kind === "feed") {
    // The prey must beat a resisting predator. Ties favor the one being resisted against (the predator).
    const preyId = card.preyIds[0];
    const success = card.rolls[preyId].total > predTotal;
    card.outcome = success
      ? `${name(card, preyId)} overpowers ${name(card, card.predId)}'s resistance!`
      : `${name(card, card.predId)} keeps ${name(card, preyId)} out.`;
    await saveCard(msg, card);
    if (success) await chooseType(card, [preyId], { forced: true });
  } else if (card.kind === "forceRelease") {
    // The predator must beat the prey to force them out. Ties favor the prey.
    const preyId = card.preyIds[0];
    const prey = tokenDoc(card.sceneId, preyId);
    const st = getPrey(prey);
    const forced = predTotal > card.rolls[preyId].total;
    card.outcome = forced
      ? `${name(card, card.predId)} forces ${name(card, preyId)} out!`
      : `${name(card, preyId)} holds fast.`;
    await saveCard(msg, card);
    if (forced && prey && st && !st.digested) {
      const slotCfg = getSlot(getConfig(pred), st.slot);
      const whisper = scopeFor(pred, prey);
      await release(prey, { place: true });
      const template = (slotCfg.forceReleaseMessage ?? "").trim() || "{predator} is forced to release {prey}!";
      await say(`<p>${fmtMsg(template, { predator: `<strong>${esc(pred.name)}</strong>`, prey: `<strong>${esc(prey.name)}</strong>` })}</p>`, { whisper });
    }
  } else {
    const preyId = card.preyIds[0];
    const prey = tokenDoc(card.sceneId, preyId);
    const escaped = card.rolls[preyId].total > predTotal;
    card.outcome = escaped
      ? `${name(card, preyId)} breaks free!`
      : `${name(card, card.predId)} holds on to ${name(card, preyId)}.`;
    await saveCard(msg, card);
    if (escaped && prey && getPrey(prey)) {
      const whisper = scopeFor(pred, prey);
      await release(prey, { place: true });
      await say(`<p><strong>${esc(prey.name)}</strong> escapes from <strong>${esc(pred?.name ?? "the predator")}</strong>.</p>`, { whisper });
    }
  }
}

async function chooseType(card, preyIds, { forced = false, secret = false } = {}) {
  const pred = tokenDoc(card.sceneId, card.predId);
  const slots = activeSlots(getConfig(pred)).map((s) => ({ index: s.index, label: s.label }));
  // The chooser picks the Vore type and how digestion works. (When prey force themselves in, the prey chooses.)
  await postCard({ kind: "type", sceneId: card.sceneId, predId: card.predId, preyIds, slots, resolved: false, forced, secret, chooser: forced ? "prey" : "pred" });
}

/* -------------------------------------------- */
/*  Digestion (per predator turn) and Churn      */
/* -------------------------------------------- */

export async function onPredatorTurn(pred) {
  const sceneId = pred.parent.id;
  for (const preyId of getPred(pred)?.preyIds ?? []) {
    const prey = pred.parent.tokens.get(preyId);
    const st = getPrey(prey);
    if (!prey || !st || st.digested) continue;
    if (isEndo(pred)) {
      await describeInside(prey, pred, st.slot, "descRound");
      continue; // Endo: nothing inside takes damage or makes death saves
    }
    const hp = prey.actor?.system.attributes.hp.value ?? 1;
    const dying = hp <= 0 && prey.actor?.type === "character" && prey.actor.hasPlayerOwner;
    if (st.timed && !st.timed.halted && !dying) {
      // Timed digestion: each combat turn is 6 seconds on the countdown instead of a damage roll.
      await describeInside(prey, pred, st.slot, "descRound");
      await stepTimed(prey, 6000);
      continue;
    }
    if (dying && st.timed?.skip) {
      await digest(prey);
      continue;
    }
    if (dying) {
      await describeInside(prey, pred, st.slot, "descDying");
      await postCard({ kind: "deathsave", sceneId, predId: pred.id, preyId, resolved: false });
    } else {
      await describeInside(prey, pred, st.slot, "descRound");
      await postDamage(sceneId, pred.id, preyId);
    }
  }
}

export function postDeathSave(sceneId, predId, preyId) {
  return postCard({ kind: "deathsave", sceneId, predId, preyId, resolved: false });
}

async function postDamage(sceneId, predId, preyId) {
  const msg = await postCard({ kind: "damage", sceneId, predId, preyId, resolved: false, heal: !!getPrey(tokenDoc(sceneId, preyId))?.heal });
  const pred = tokenDoc(sceneId, predId);
  if (game.settings.get(MODULE_ID, "autoRollNPC") && !hasActivePlayerOwner(pred)) await resolveDamage(msg.id);
}

async function resolveDamage(messageId) {
  const msg = game.messages.get(messageId);
  const card = readCard(msg);
  if (!card || card.resolved) return;
  const pred = tokenDoc(card.sceneId, card.predId);
  const prey = tokenDoc(card.sceneId, card.preyId);
  card.resolved = true;
  if (!pred?.actor || !prey?.actor || !getPrey(prey)) {
    card.outcome = "No longer vored.";
    return saveCard(msg, card);
  }
  if (getPrey(prey).heal) {
    const healed = await rollDamage(turnFormula(pred.actor), "Soothing digestion (healing)", pred.name);
    await applyPreyHealing(prey, healed);
    card.outcome = `${name(card, card.preyId)} recovers ${healed} HP.`;
    return saveCard(msg, card);
  }
  const total = await rollDamage(turnFormula(pred.actor), "Digestion damage (half acid, half bludgeoning)", pred.name);
  const result = await applyPreyDamage(prey, total);
  card.outcome = `${total} damage to ${name(card, card.preyId)}${result === "digested" ? " — digested." : result === "dying" ? " — dying." : "."}`;
  await saveCard(msg, card);
}

async function resolveDeathSave(messageId) {
  const msg = game.messages.get(messageId);
  const card = readCard(msg);
  if (!card || card.resolved) return;
  const prey = tokenDoc(card.sceneId, card.preyId);
  card.resolved = true;
  const fails = prey?.actor?.system.attributes.death?.failure ?? 0;
  const alive = (prey?.actor?.system.attributes.hp.value ?? 0) > 0;
  card.outcome = fails >= 3 ? "Three failures — digested." : alive ? "Back on their feet." : `Failures: ${fails}/3.`;
  await saveCard(msg, card);
  if (!prey || !getPrey(prey)) return;
  if (fails >= 3) return digest(prey);
  // Timed options don't roll per-turn damage; the countdown handles it.
  if (getPrey(prey)?.timed) return;
  await postDamage(card.sceneId, card.predId, card.preyId);
}

/** Prey hurt the predator enough from inside: the predator must save or let everyone go. */
export async function postBreakout({ sceneId, predId, total }) {
  const dc = Number(game.settings.get(MODULE_ID, "breakoutDC")) || 15;
  const msg = await postCard({ kind: "breakout", sceneId, predId, total, dc, resolved: false });
  const pred = tokenDoc(sceneId, predId);
  if (game.settings.get(MODULE_ID, "autoRollNPC") && !hasActivePlayerOwner(pred) && pred?.actor) {
    const roll = await rollSaveTotal(pred.actor, "con");
    if (roll !== null) await resolveBreakout(msg.id, roll);
  }
}

async function resolveBreakout(messageId, total) {
  const msg = game.messages.get(messageId);
  const card = readCard(msg);
  if (!card || card.resolved) return;
  const pred = tokenDoc(card.sceneId, card.predId);
  card.resolved = true;
  if (total >= card.dc) {
    card.outcome = `${total} vs DC ${card.dc} — ${name(card, card.predId)} holds on.`;
    return saveCard(msg, card);
  }
  card.outcome = `${total} vs DC ${card.dc} — ${name(card, card.predId)} can't keep them down!`;
  await saveCard(msg, card);
  const heldIds = [...(getPred(pred)?.preyIds ?? [])];
  const whisper = scopeFor(pred, heldIds.map((id) => tokenDoc(card.sceneId, id)));
  for (const id of heldIds) {
    const prey = tokenDoc(card.sceneId, id);
    if (prey && getPrey(prey) && !getPrey(prey).digested) await release(prey, { place: true });
  }
  await say(`<p><strong>${esc(pred?.name ?? "The predator")}</strong> regurgitates everyone inside.</p>`, { whisper });
}

/** Churn: extra damage on top of the per-turn damage. Not an attack. */
async function churn({ sceneId, predId, preyIds }) {
  const pred = tokenDoc(sceneId, predId);
  if (!pred?.actor) return;
  if (isEndoOnly(pred)) return say(`<p><strong>${esc(pred.name)}</strong> would never harm those they hold.</p>`);
  if (pred.getFlag(MODULE_ID, "endo")) {
    await pred.update({ [`flags.${MODULE_ID}.endo`]: false }, { voreMove: true });
    await say(`<p><strong>${esc(pred.name)}</strong> churns, ending Endo.</p>`);
  }
  for (const id of preyIds) {
    const prey = tokenDoc(sceneId, id);
    const st = getPrey(prey);
    if (!prey?.actor || !st || st.digested || st.predatorId !== predId) continue;
    const whisper = scopeFor(pred, prey);
    if (st.heal) {
      const healed = await rollDamage(churnFormula(pred.actor), `Soothing churn \u2014 ${prey.name} (healing)`, pred.name);
      await applyPreyHealing(prey, healed);
      continue;
    }
    const total = await rollDamage(churnFormula(pred.actor), `Churn — ${prey.name} (half acid, half bludgeoning)`, pred.name);
    const result = await applyPreyDamage(prey, total);
    if (result !== "alive") await say(`<p><strong>${esc(prey.name)}</strong> is ${result === "digested" ? "digested" : "dying"}.</p>`, { whisper });
  }
}

/* -------------------------------------------- */
/*  Socket handlers + chat listeners             */
/* -------------------------------------------- */

/** Pending consent requests (GM side). Stale ones expire so a closed dialog can't block a retry. */
const pending = new Map();
function claim(key) {
  const t = pending.get(key);
  if (t && Date.now() - t < 120000) return false;
  pending.set(key, Date.now());
  return true;
}

/** Shown to the person who must answer a feeding or release request. */
async function promptConsent({ type, sceneId, predId, preyId, slots }) {
  const pred = tokenDoc(sceneId, predId);
  const prey = tokenDoc(sceneId, preyId);
  if (!pred || !prey) return;
  const feed = type === "feed";
  const intro = feed
    ? `<strong>${esc(prey.name)}</strong> wants to feed themselves to <strong>${esc(pred.name)}</strong>.`
    : `<strong>${esc(pred.name)}</strong> wants to release <strong>${esc(prey.name)}</strong>.`;
  const options = (slots ?? []).map((s) => `<option value="${s.index}">${esc(s.label)}</option>`).join("");
  const picker =
    feed && (slots?.length ?? 0) > 1
      ? `<div class="form-group"><label>Vore type (if you allow it)</label><div class="form-fields"><select name="slot">${options}</select></div></div>`
      : "";
  const reply = (allow) => (event, button) => ({
    allow,
    slot: Number(button.form?.elements?.slot?.value ?? slots?.[0]?.index ?? 0),
    digest: feed && allow ? readDigest(button.form) : null,
    hide: feed && allow ? !!button.form?.elements?.dhide?.checked : false
  });
  const pick = await DialogV2.wait({
    window: { title: feed ? "Feeding request" : "Release request" },
    content: `<p>${intro}</p>${picker}${feed ? digestFields() + hideField(pred) : ""}`,
    buttons: [
      { action: "yes", label: feed ? "Allow Feeding" : "Allow Release", default: true, callback: reply(true) },
      { action: "no", label: feed ? "Resist Feeding" : "Resist Release", callback: reply(false) }
    ],
    rejectClose: false
  });
  if (!pick) return;
  request("consentReply", { type, sceneId, predId, preyId, allow: pick.allow, slot: pick.slot, digest: pick.digest, hide: pick.hide });
}

/** Shown to the GM when a player asks for a panic release. */
async function promptPanic({ sceneId, tokenId, userName }) {
  const prey = tokenDoc(sceneId, tokenId);
  if (!prey) return;
  const allow = await DialogV2.wait({
    window: { title: "Panic release request" },
    content: `<p><strong>${esc(userName)}</strong> wants a panic release for <strong>${esc(prey.name)}</strong>, taking them out of the digested state. Allow it? If you don't answer within a minute it is allowed automatically.</p>`,
    buttons: [
      { action: "yes", label: "Allow", default: true, callback: () => true },
      { action: "no", label: "Deny", callback: () => false }
    ],
    rejectClose: false
  });
  request("panicReply", { sceneId, tokenId, allow: allow === true });
}

const userCan = (userId, doc) => ownsToken(doc, game.users.get(userId));

export function registerCardHandlers() {
  registerClient("promptRoll", askRoll);
  registerClient("promptPanic", promptPanic);
  registerClient("promptConsent", promptConsent);

  register("startCheck", ({ sceneId, predId, preyIds, secret }, userId) => {
    const pred = tokenDoc(sceneId, predId);
    const user = game.users.get(userId);
    if (!pred || !user) return;
    if (!user.isGM && (!game.settings.get(MODULE_ID, "playersCanVore") || !userCan(userId, pred))) return;
    return postContest({ kind: "capture", sceneId, predId, preyIds, secret: !!secret && user.isGM });
  });

  register("startEscape", ({ sceneId, preyId }, userId) => {
    const prey = tokenDoc(sceneId, preyId);
    const st = getPrey(prey);
    if (!prey || !st || st.digested || !userCan(userId, prey)) return;
    return postContest({ kind: "escape", sceneId, predId: st.predatorId, preyIds: [preyId] });
  });

  register("contestRoll", ({ messageId, tokenId, skill, total }) => recordRoll(messageId, tokenId, skill, total));
  register("rollDigest", ({ messageId }) => resolveDamage(messageId));
  register("breakoutSave", ({ messageId, total }, userId) => {
    const card = readCard(game.messages.get(messageId));
    if (card && userCan(userId, tokenDoc(card.sceneId, card.predId)) && Number.isFinite(total)) return resolveBreakout(messageId, total);
  });
  register("deathSaveDone", ({ messageId }) => resolveDeathSave(messageId));
  register("churn", (data, userId) => {
    const pred = tokenDoc(data.sceneId, data.predId);
    if (pred && userCan(userId, pred)) return churn(data);
  });
  register("manualVore", (data, userId) => {
    if (game.users.get(userId)?.isGM) return startVore({ ...data, secret: !!data.secret, gm: true });
  });

  // GM release / restore of a single token.
  register("release", ({ sceneId, tokenId, restoreImage }, userId) => {
    if (!game.users.get(userId)?.isGM) return;
    const doc = tokenDoc(sceneId, tokenId);
    return doc && release(doc, { place: true, restoreImage });
  });

  // A predator's owner asks to release prey. The prey's player must consent or resist.
  register("releasePrey", async ({ sceneId, predId, preyIds }, userId) => {
    const pred = tokenDoc(sceneId, predId);
    const user = game.users.get(userId);
    if (!pred || !userCan(userId, pred)) return;
    for (const id of preyIds) {
      const prey = tokenDoc(sceneId, id);
      const st = getPrey(prey);
      if (!prey || !st || st.predatorId !== predId || st.digested) continue;
      const owners = playerOwnerIds(prey);
      // A GM moving NPCs around doesn't need to ask themselves.
      if (user?.isGM && !owners.length) {
        const whisper = scopeFor(pred, prey);
        await release(prey, { place: true });
        await say(`<p><strong>${esc(pred.name)}</strong> lets <strong>${esc(prey.name)}</strong> go.</p>`, { whisper });
        continue;
      }
      if (!claim(`release:${id}`)) continue;
      const to = owners.length ? owners : game.users.filter((u) => u.isGM && u.active).map((u) => u.id);
      notify(to, "promptConsent", { type: "release", sceneId, predId, preyId: id });
      await say(`<p><strong>${esc(pred.name)}</strong> offers to release <strong>${esc(prey.name)}</strong>.</p>`, { whisper: scopeFor(pred, prey) });
    }
  });

  // Panic release: a digested player asks the GM to let them out of that state.
  register("panicRelease", async ({ sceneId, tokenId }, userId) => {
    const prey = tokenDoc(sceneId, tokenId);
    const user = game.users.get(userId);
    if (!prey || !user || !userCan(userId, prey)) return;
    if (!(getPrey(prey)?.digested || prey.getFlag(MODULE_ID, "digested"))) return;
    const gms = game.users.filter((u) => u.isGM && u.active).map((u) => u.id);
    if (user.isGM) {
      await release(prey, { place: true, restoreImage: true });
      return say(`<p><strong>${esc(prey.name)}</strong> is restored.</p>`, { whisper: [userId] });
    }
    const auto = async (why) => {
      if (!(getPrey(prey)?.digested || prey.getFlag(MODULE_ID, "digested"))) return;
      await release(prey, { place: true, restoreImage: true });
      await say(`<p>${why} <strong>${esc(prey.name)}</strong> is back.</p>`, { whisper: [userId, ...gms] });
    };
    if (!gms.length) return auto("No GM is online, so the panic release goes through.");
    if (!claim(`panic:${tokenId}`)) return;
    notify(gms, "promptPanic", { sceneId, tokenId, userName: user.name });
    await say(`<p>Panic release requested for <strong>${esc(prey.name)}</strong>. It goes through automatically in 60 seconds if the GM doesn't answer.</p>`, { whisper: [userId, ...gms] });
    setTimeout(() => {
      if (!pending.has(`panic:${tokenId}`)) return;
      pending.delete(`panic:${tokenId}`);
      auto("The GM didn't answer in time, so the panic release goes through.");
    }, 60000);
  });

  register("panicReply", async ({ sceneId, tokenId, allow }, userId) => {
    if (!game.users.get(userId)?.isGM || !pending.has(`panic:${tokenId}`)) return;
    pending.delete(`panic:${tokenId}`);
    const prey = tokenDoc(sceneId, tokenId);
    if (!prey) return;
    const to = [...playerOwnerIds(prey), ...game.users.filter((u) => u.isGM).map((u) => u.id)];
    if (!allow) return say(`<p>The GM denied the panic release for <strong>${esc(prey.name)}</strong>.</p>`, { whisper: to });
    if (!(getPrey(prey)?.digested || prey.getFlag(MODULE_ID, "digested"))) return;
    await release(prey, { place: true, restoreImage: true });
    await say(`<p>The GM approved the panic release. <strong>${esc(prey.name)}</strong> is back.</p>`, { whisper: to });
  });

  // Prey asks to feed themselves to a predator. The predator's player must allow or resist.
  register("startFeed", async ({ sceneId, predId, preyId }, userId) => {
    const pred = tokenDoc(sceneId, predId);
    const prey = tokenDoc(sceneId, preyId);
    const user = game.users.get(userId);
    if (!pred?.actor || !prey?.actor || pred.id === prey.id || getPrey(pred) || getPrey(prey)) return;
    if (!user || !userCan(userId, prey)) return;
    if (!user.isGM && !game.settings.get(MODULE_ID, "allowFeeding")) return;
    if (!claim(`feed:${preyId}`)) return;
    const owners = playerOwnerIds(pred);
    const to = owners.length ? owners : game.users.filter((u) => u.isGM && u.active).map((u) => u.id);
    const slots = activeSlots(getConfig(pred)).map((s) => ({ index: s.index, label: s.label }));
    notify(to, "promptConsent", { type: "feed", sceneId, predId, preyId, slots });
    await say(`<p><strong>${esc(prey.name)}</strong> tries to feed themselves to <strong>${esc(pred.name)}</strong>.</p>`);
  });

  register("consentReply", async ({ type, sceneId, predId, preyId, allow, slot, digest, hide }, userId) => {
    const key = `${type}:${preyId}`;
    if (!pending.has(key)) return;
    const pred = tokenDoc(sceneId, predId);
    const prey = tokenDoc(sceneId, preyId);
    // Feeding: the predator answers. Release: the prey answers.
    if (!pred || !prey || !userCan(userId, type === "feed" ? pred : prey)) return;
    pending.delete(key);
    if (type === "feed") {
      if (getPrey(pred) || getPrey(prey)) return;
      if (allow) {
        const valid = activeSlots(getConfig(pred)).map((s) => s.index);
        const chosen = valid.includes(Number(slot)) ? Number(slot) : valid[0];
        return startVore({ sceneId, predId, preyIds: [preyId], slot: chosen, digest, hide: !!hide });
      }
      await say(`<p><strong>${esc(pred.name)}</strong> resists being fed.</p>`);
      return postContest({ kind: "feed", sceneId, predId, preyIds: [preyId] });
    }
    const st = getPrey(prey);
    if (!st || st.predatorId !== predId || st.digested) return;
    const whisper = scopeFor(pred, prey);
    if (allow) {
      await release(prey, { place: true });
      return say(`<p><strong>${esc(pred.name)}</strong> lets <strong>${esc(prey.name)}</strong> go.</p>`, { whisper });
    }
    await say(`<p><strong>${esc(prey.name)}</strong> resists being released.</p>`, { whisper });
    return postContest({ kind: "forceRelease", sceneId, predId, preyIds: [preyId] });
  });

  // Endo: the predator holds prey without hurting them.
  register("toggleEndo", async ({ sceneId, predId }, userId) => {
    const pred = tokenDoc(sceneId, predId);
    if (!pred?.actor || !userCan(userId, pred) || getPrey(pred)) return;
    if (isEndoOnly(pred)) return; // always Endo
    const on = !!pred.getFlag(MODULE_ID, "endo");
    if (!on && !game.settings.get(MODULE_ID, "allowEndo")) return;
    await pred.update({ [`flags.${MODULE_ID}.endo`]: !on }, { voreMove: true });
    await say(
      `<p><strong>${esc(pred.name)}</strong> ${on ? "turns Endo off. Digestion resumes." : "turns Endo on. Nobody inside takes damage."}</p>`
    );
  });

  register("chooseType", async ({ messageId, slot, digest, hide }, userId) => {
    const msg = game.messages.get(messageId);
    const card = readCard(msg);
    if (!card || card.resolved) return;
    const chooserId = card.chooser === "prey" ? card.preyIds[0] : card.predId;
    if (!userCan(userId, tokenDoc(card.sceneId, chooserId))) return;
    card.resolved = true;
    card.outcome = `Type: ${esc(getConfig(tokenDoc(card.sceneId, card.predId)).slots[slot]?.label ?? "")}`;
    await saveCard(msg, card);
    await startVore({ sceneId: card.sceneId, predId: card.predId, preyIds: card.preyIds, slot, forced: !!card.forced, secret: !!card.secret, hide: !!hide, digest });
  });

  // Tidy chat: system lines get a light style, and resolved cards fold down to one line (click to expand).
  Hooks.on("renderChatMessageHTML", (msg, html) => {
    if (msg.getFlag(MODULE_ID, "notice")) html.classList.add("vore-notice");
    const card = msg.getFlag(MODULE_ID, "card");
    if (!card?.resolved) return;
    const el = html.querySelector(".vore-card");
    if (!el) return;
    el.classList.add("resolved");
    el.title = "Click to expand or collapse";
    el.addEventListener("click", (e) => {
      if (!e.target.closest("button")) el.classList.toggle("open");
    });
  });

  Hooks.on("renderChatMessageHTML", (msg, html) => {
    const card = msg.getFlag(MODULE_ID, "card");
    if (!card) return;
    html.querySelectorAll("button[data-vore]").forEach((btn) => {
      const kind = btn.dataset.vore;
      const tokenId =
        kind === "roll" ? btn.dataset.token
        : kind === "deathsave" ? card.preyId
        : kind === "type" && card.chooser === "prey" ? card.preyIds[0]
        : card.predId;
      if (!ownsToken(tokenDoc(card.sceneId, tokenId))) return btn.remove();
      btn.addEventListener("click", async () => {
        const doc = tokenDoc(card.sceneId, tokenId);
        if (kind === "roll") return askRoll({ messageId: msg.id, tokenId, sceneId: card.sceneId });
        btn.disabled = true;
        if (kind === "deathsave") {
          try {
            await doc.actor.rollDeathSave({}, { configure: false }, { create: true });
          } catch (e) {
            await doc.actor.rollDeathSave({});
          }
          request("deathSaveDone", { messageId: msg.id });
        } else if (kind === "save") {
          const total = await rollSaveTotal(doc.actor, "con");
          if (total === null) return (btn.disabled = false);
          request("breakoutSave", { messageId: msg.id, total });
        } else if (kind === "damage") {
          request("rollDigest", { messageId: msg.id });
        } else if (kind === "type") {
          const pick = await askSwallow({ slots: card.slots, title: "Swallow", pred: tokenDoc(card.sceneId, card.predId), secret: !!card.secret });
          if (!pick) return (btn.disabled = false);
          request("chooseType", { messageId: msg.id, slot: pick.slot, digest: pick.digest, hide: pick.hide });
        }
      });
    });
  });
}
