import { MODULE_ID } from "./const.js";
import { getPrey, getPred, getConfig, getSlot, fmtMsg, esc } from "./util.js";

const { DialogV2 } = foundry.applications.api;

/* -------------------------------------------- */
/*  Inside descriptions (GM side)                */
/* -------------------------------------------- */

/** Whisper a random line from a Vore option's description pool to the prey's player(s). */
export async function describeInside(prey, pred, slotIndex, key) {
  if (!prey?.actor || !pred) return;
  const slot = getSlot(getConfig(pred), slotIndex);
  const lines = String(slot?.[key] ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return;
  const recipients = game.users
    .filter((u) => !u.isGM && (prey.actor.testUserPermission(u, "OWNER") || u.character?.id === prey.actor.id))
    .map((u) => u.id);
  if (!recipients.length) return;
  const line = lines[Math.floor(Math.random() * lines.length)];
  const text = fmtMsg(line, {
    predator: `<strong>${esc(pred.name)}</strong>`,
    prey: `<strong>${esc(prey.name)}</strong>`
  });
  await ChatMessage.create({
    content: `<div class="vore-inside"><p>${text}</p></div>`,
    whisper: recipients,
    speaker: { alias: `Inside ${pred.name}` },
    flags: { [MODULE_ID]: { notice: true } }
  });
}

/* -------------------------------------------- */
/*  Private whisper channel between predator and prey */
/* -------------------------------------------- */

/** Tokens that can use the inside channel: a held prey, or a predator holding someone. */
export function isInsideGroup(doc) {
  const st = getPrey(doc);
  return (!!st && !st.digested) || !!getPred(doc)?.preyIds?.length;
}

/**
 * Who can hear a token inside a belly: its own predator, the prey it is holding, and the others in the same belly.
 * With stacked vore (A eats B eats C), C hears B only, A hears B only, and B hears both.
 */
export function hearers(doc) {
  const scene = doc.parent;
  const out = new Map();
  const add = (t) => t && !getPrey(t)?.digested && out.set(t.id, t);
  const st = getPrey(doc);
  if (st && !st.digested) {
    const pred = scene.tokens.get(st.predatorId);
    add(pred);
    for (const id of getPred(pred)?.preyIds ?? []) add(scene.tokens.get(id)); // same belly
  }
  for (const id of getPred(doc)?.preyIds ?? []) add(scene.tokens.get(id)); // prey it holds
  out.delete(doc.id);
  return [...out.values()];
}

export async function sendInsideWhisper(doc, text) {
  const group = [doc, ...hearers(doc)];
  if (group.length < 2) return;

  // Everyone who owns a token in the group, plus the GM(s).
  const recipients = new Set(game.users.filter((u) => u.isGM).map((u) => u.id));
  for (const t of group) {
    for (const u of game.users) {
      if (!u.isGM && t.actor?.testUserPermission(u, "OWNER")) recipients.add(u.id);
    }
  }
  await ChatMessage.create({
    content: `<div class="vore-whisper"><em>inside</em> · <strong>${esc(doc.name)}</strong>: ${esc(text)}</div>`,
    whisper: [...recipients],
    speaker: { alias: doc.name },
    flags: { [MODULE_ID]: { notice: true } }
  });
}

export async function promptWhisper(doc) {
  if (!isInsideGroup(doc)) return ui.notifications.warn("That token isn't part of a vore scene.");
  const text = await DialogV2.prompt({
    window: { title: "Whisper inside" },
    content: `<p>Only the predator, their prey and the GM will see this.</p>
      <div class="form-group"><textarea name="text" rows="3" autofocus></textarea></div>`,
    ok: {
      label: "Send",
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object.text
    },
    rejectClose: false
  });
  if (text?.trim()) await sendInsideWhisper(doc, text.trim());
}

export function registerInside() {
  // `/inside message` (or `/in message`) speaks on the private channel as your selected token.
  Hooks.on("chatMessage", (log, message) => {
    const match = message.match(/^\/(?:inside|in)\s+([\s\S]+)/i);
    if (!match) return;
    const tokenId = ChatMessage.getSpeaker().token;
    const doc = canvas.scene?.tokens.get(tokenId);
    if (!doc || !isInsideGroup(doc)) {
      ui.notifications.warn("Select a token that is inside (or holding) someone to use /inside.");
      return false;
    }
    sendInsideWhisper(doc, match[1].trim());
    return false;
  });
}
