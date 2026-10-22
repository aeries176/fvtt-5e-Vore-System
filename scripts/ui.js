import { askSwallow } from "./digestchoice.js";
import { TYPES, MAX_SLOTS } from "./const.js";
import { MODULE_ID } from "./const.js";
import { getPrey, getPred, getConfig, activeSlots, ownsToken, esc, isEndoOnly, effectiveSlot } from "./util.js";
import { request } from "./socket.js";
import { isInsideGroup, promptWhisper } from "./inside.js";
import { stomachOn, stomachStrikeAction } from "./stomach.js";
import { toolbarHTML, runPresetAction } from "./presets.js";

const { DialogV2 } = foundry.applications.api;
const FD = () => foundry.applications.ux.FormDataExtended;
const playersCanVore = () => game.user.isGM || game.settings.get(MODULE_ID, "playersCanVore");

/* -------------------------------------------- */
/*  Actions                                      */
/* -------------------------------------------- */

/** The "Vore" action: opposed check against the user's targeted tokens. */
export function voreAction(pred, { secret = false } = {}) {
  if (secret && !game.user.isGM) return;
  if (!playersCanVore()) return ui.notifications.warn("The GM has disabled player-started Vore checks.");
  const sceneId = pred.parent.id;
  const targets = [...game.user.targets]
    .filter((t) => t.document.id !== pred.id && t.document.parent.id === sceneId)
    .map((t) => t.document);
  if (!targets.length) return ui.notifications.warn("Target at least one token to Vore.");
  if (getPrey(pred)) return ui.notifications.warn(`${pred.name} is currently held and cannot Vore.`);
  const combat = game.combat;
  if (!game.user.isGM && combat?.started && combat.combatant?.token?.id !== pred.id) {
    return ui.notifications.warn("You can only Vore on your own turn.");
  }
  const preyIds = targets.filter((t) => !getPrey(t)).map((t) => t.id);
  if (!preyIds.length) return ui.notifications.warn("Those targets are already vored.");
  request("startCheck", { sceneId, predId: pred.id, preyIds, secret });
}

/** Prey offers themselves to a targeted predator. The predator allows it or resists (then the prey must win a Vore check). */
export function feedAction(prey) {
  if (!game.user.isGM && !game.settings.get(MODULE_ID, "allowFeeding")) {
    return ui.notifications.warn("The GM has disabled feeding yourself to predators.");
  }
  if (getPrey(prey)) return ui.notifications.warn(`${prey.name} is currently held.`);
  const pred = [...game.user.targets]
    .map((t) => t.document)
    .find((t) => t.id !== prey.id && t.parent.id === prey.parent.id);
  if (!pred) return ui.notifications.warn("Target the predator you want to feed yourself to.");
  if (getPrey(pred)) return ui.notifications.warn(`${pred.name} is currently held and can't swallow anyone.`);
  request("startFeed", { sceneId: prey.parent.id, preyId: prey.id, predId: pred.id });
}

/** Toggle Endo on a predator: prey inside takes no digestion damage. */
export function endoAction(pred) {
  const on = !!pred.getFlag(MODULE_ID, "endo");
  if (!on && !game.settings.get(MODULE_ID, "allowEndo")) return ui.notifications.warn("The GM has disabled Endo.");
  request("toggleEndo", { sceneId: pred.parent.id, predId: pred.id });
}

/** The prey struggles: an opposed Escape check against the predator. */
export function escapeAction(prey) {
  const st = getPrey(prey);
  if (!st || st.digested) return ui.notifications.warn("That token isn't being held.");
  request("startEscape", { sceneId: prey.parent.id, preyId: prey.id });
}

/** Target the predator and open a two-minute window where damage you deal to it counts toward a breakout. */
export function strikeAction(prey) {
  const st = getPrey(prey);
  if (!st || st.digested) return;
  if (stomachOn()) return stomachStrikeAction(prey);
  canvas.tokens.get(st.predatorId)?.setTarget(true, { releaseOthers: true });
  request("strikeStart", { sceneId: prey.parent.id, preyId: prey.id });
  ui.notifications.info("Make your attack from your character sheet. Damage you deal to the predator counts toward breaking out.");
}

/** Pick which of a predator's (living) prey an action applies to. Returns an array of token ids or null. */
async function choosePrey(pred, title, okLabel) {
  const prey = (getPred(pred)?.preyIds ?? [])
    .map((id) => pred.parent.tokens.get(id))
    .filter((t) => t && !getPrey(t)?.digested);
  if (!prey.length) {
    ui.notifications.warn("No prey to choose from.");
    return null;
  }
  if (prey.length === 1) return [prey[0].id];
  const boxes = prey.map((t) => `<label><input type="checkbox" name="${t.id}" checked> ${esc(t.name)}</label>`).join("<br>");
  const result = await DialogV2.prompt({
    window: { title },
    content: `<p>${title} which prey?</p>${boxes}`,
    ok: { label: okLabel, callback: (e, button) => new (FD())(button.form).object },
    rejectClose: false
  });
  if (!result) return null;
  const ids = prey.map((t) => t.id).filter((id) => result[id]);
  return ids.length ? ids : null;
}

export async function churnAction(pred) {
  const preyIds = await choosePrey(pred, "Churn", "Churn");
  if (preyIds) request("churn", { sceneId: pred.parent.id, predId: pred.id, preyIds });
}

/** Predator (or GM) lets prey go. */
export function panicAction(t) {
  if (!(getPrey(t)?.digested || t.getFlag(MODULE_ID, "digested"))) return ui.notifications.warn("That token isn't digested.");
  request("panicRelease", { sceneId: t.parent.id, tokenId: t.id });
  ui.notifications.info("Panic release requested. Waiting for the GM.");
}

export async function releaseAction(pred) {
  const preyIds = await choosePrey(pred, "Release", "Release");
  if (preyIds) request("releasePrey", { sceneId: pred.parent.id, predId: pred.id, preyIds });
}

/** GM tool: pick predator + prey from selected tokens and vore without any check. */
export async function manualVore({ secret = false } = {}) {
  const sel = canvas.tokens.controlled.map((t) => t.document);
  if (sel.length < 2) return ui.notifications.warn("Select two or more tokens first.");
  const predId = await DialogV2.wait({
    window: { title: "Vore: choose the Predator" },
    content: "<p>Which token is the Predator? The rest become Prey.</p>",
    buttons: sel.map((t) => ({ action: t.id, label: t.name, callback: () => t.id })),
    rejectClose: false
  });
  if (!predId) return;
  const pred = sel.find((t) => t.id === predId);
  const slots = activeSlots(getConfig(pred)).map((x) => ({ index: x.index, label: x.label }));
  const preyIds = sel.filter((t) => t.id !== predId && !getPrey(t)).map((t) => t.id);
  const pick = await askSwallow({ slots, title: `Vore: ${pred.name}`, pred, secret });
  if (!pick) return;
  const { slot, digest, hide } = pick;
  request("manualVore", { sceneId: pred.parent.id, predId, preyIds, slot, secret, hide, digest });
}

/* -------------------------------------------- */
/*  Hooks                                        */
/* -------------------------------------------- */

export function registerUIHooks() {
  // All Vore actions live in their own "Vore Controls" group in the scene controls.
  Hooks.on("getSceneControlButtons", (controls) => {
    const controlled = () => canvas.tokens.controlled[0]?.document;
    const withToken = (fn) => () => {
      const t = controlled();
      if (!t) return ui.notifications.warn("Control a token first.");
      fn(t);
    };
    // Which tools show depends on the controlled token, so players only see what applies to them right now.
    const ctx = () => {
      const doc = canvas.tokens?.controlled?.[0]?.document;
      const st = doc && getPrey(doc);
      const digested = !!doc && (!!st?.digested || !!doc.getFlag(MODULE_ID, "digested"));
      const held = !!st && !st.digested;
      const holding = !!doc && (getPred(doc)?.preyIds ?? []).some((id) => {
        const p = doc.parent.tokens.get(id);
        return p && !getPrey(p)?.digested;
      });
      return { doc, held, digested, holding, free: !!doc && !st && !digested };
    };
    const list = [
      { name: "vore-check", title: "Vore check (controlled token vs targets)", icon: "fa-solid fa-dice-d20", visible: () => game.user.isGM, onChange: withToken(voreAction) },
      { name: "vore-feed", title: "Feed yourself to the targeted predator", icon: "fa-solid fa-bowl-food", visible: () => game.user.isGM, onChange: withToken(feedAction) },
      { name: "vore-panic", title: "Panic release (digested players: ask the GM to be let out)", icon: "fa-solid fa-life-ring", visible: () => game.user.isGM || ctx().digested, onChange: withToken(panicAction) },
      { name: "vore-escape", title: "Struggle: escape check", icon: "fa-solid fa-person-running", visible: () => game.user.isGM, onChange: withToken(escapeAction) },
      { name: "vore-churn", title: "Churn prey you hold", icon: "fa-solid fa-rotate", visible: () => game.user.isGM, onChange: withToken(churnAction) },
      { name: "vore-release", title: "Release prey you hold", icon: "fa-solid fa-door-open", visible: () => game.user.isGM, onChange: withToken(releaseAction) },
      { name: "vore-endo", title: "Toggle Endo", icon: "fa-solid fa-heart", visible: () => game.user.isGM, onChange: withToken(endoAction) },
      { name: "vore-strike", title: "Strike from within", icon: "fa-solid fa-hand-fist", visible: () => (game.user.isGM || ctx().held) && (game.settings.get(MODULE_ID, "preyStrikeBack") || stomachOn()), onChange: withToken(strikeAction) },
      { name: "vore-restore", title: "Release / Restore selected tokens (GM)", icon: "fa-solid fa-person-walking-arrow-right", visible: () => game.user.isGM, onChange: () => {
          const sel = canvas.tokens.controlled.map((t) => t.document);
          if (!sel.length) return ui.notifications.warn("Select the held or digested tokens first.");
          for (const t of sel) request("release", { sceneId: t.parent.id, tokenId: t.id, restoreImage: true });
        } },
      { name: "vore-reset", title: "Reset all Vore state in this scene (GM unstick tool)", icon: "fa-solid fa-triangle-exclamation", visible: () => game.user.isGM, onChange: async () => {
          const ok = await DialogV2.confirm({
            window: { title: "Reset Vore state" },
            content: "<p>Release every held or digested token in this scene and clear all Vore state? Use this if something got stuck.</p>",
            yes: { label: "Reset" },
            rejectClose: false
          });
          if (ok) request("resetScene", { sceneId: canvas.scene.id });
        } },
      { name: "vore-reveal", title: "Reveal hidden prey (selected tokens, or every hidden prey in the scene)", icon: "fa-solid fa-eye", visible: () => game.user.isGM, onChange: () => {
          const sel = canvas.tokens.controlled.map((t) => t.document);
          const pool = (sel.length ? sel : [...canvas.scene.tokens]).filter((t) => t.hidden && getPrey(t) && !getPrey(t).digested);
          if (!pool.length) return ui.notifications.info("No hidden prey to reveal.");
          request("revealPrey", { sceneId: canvas.scene.id, tokenIds: pool.map((t) => t.id) });
        } },
      { name: "vore-whisper", title: "Whisper inside", icon: "fa-solid fa-comment-dots", visible: () => game.user.isGM || ctx().held || ctx().holding, onChange: withToken(promptWhisper) },
      { name: "vore-secret-check", title: "Secret Vore check (GM: private check, hidden prey)", icon: "fa-solid fa-user-secret", visible: () => game.user.isGM, onChange: withToken((t) => voreAction(t, { secret: true })) },
      { name: "vore", title: "Vore (selected tokens, no check)", icon: "fa-solid fa-utensils", visible: () => game.user.isGM, onChange: () => manualVore() },
      { name: "vore-secret", title: "Secret GM Vore (selected tokens, no check, hidden)", icon: "fa-solid fa-eye-slash", visible: () => game.user.isGM, onChange: () => manualVore({ secret: true }) }
    ];
    // Opening the group activates its active tool, so that must be a harmless selector, never an action.
    const tools = {
      // Named "select" like Foundry's own select tool, so drag/box selecting works while this group is open.
      select: { name: "select", title: "Select Token", icon: "fa-solid fa-expand", order: -1, visible: true, onChange: () => {} }
    };
    list.forEach((tool, i) => {
      const { visible, ...rest } = tool;
      // A getter, so the tool list follows the controlled token every time the controls re-render.
      tools[tool.name] = Object.defineProperty({ ...rest, order: i, button: true }, "visible", { get: visible, enumerable: true });
    });
    const group = {
      name: "vore",
      title: "Vore Controls",
      icon: "fa-solid fa-utensils",
      order: 98,
      layer: "tokens", // keeps token selection and targeting working while this group is open
      activeTool: "select",
      tools: Array.isArray(controls) ? Object.values(tools) : tools
    };
    // Players only see the group while one of its few tools applies to them (the rest live on the Vore features).
    Object.defineProperty(group, "visible", { get: () => game.user.isGM || ctx().held || ctx().digested || ctx().holding, enumerable: true });
    if (Array.isArray(controls)) controls.push(group);
    else controls.vore = group;
  });

  // Re-render the controls when the selection or Vore state changes, so the visible tools stay in step.
  let refreshTimer = null;
  const refreshControls = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      try {
        ui.controls?.render();
      } catch (e) {
        console.warn("vore-system | controls refresh failed", e);
      }
    }, 80);
  };
  Hooks.on("controlToken", refreshControls);
  Hooks.on("updateToken", (doc, change) => {
    if (change?.flags?.[MODULE_ID] !== undefined || foundry.utils.hasProperty(change, `flags.${MODULE_ID}`)) refreshControls();
  });
  Hooks.on("deleteToken", refreshControls);
  Hooks.on("canvasReady", refreshControls);

  // The in-world token config and the actor's prototype token config are separate application classes.
  Hooks.on("renderTokenConfig", injectVoreTab);
  Hooks.on("renderPrototypeTokenConfig", injectVoreTab);
}

/* -------------------------------------------- */
/*  Token config "Vore" tab                      */
/* -------------------------------------------- */

const P = `flags.${MODULE_ID}.config`;

function field(label, input, hint = "") {
  const help = hint ? ` <i class="fa-regular fa-circle-question vore-help" data-tooltip="${esc(hint)}" title="${esc(hint)}"></i>` : "";
  return `<div class="form-group"><label>${label}${help}</label><div class="form-fields">${input}</div></div>`;
}
const check = (n, v) => `<input type="checkbox" name="${P}.${n}" ${v ? "checked" : ""}>`;
const num = (n, v, step = 1) => `<input type="number" name="${P}.${n}" value="${v ?? ""}" step="${step}">`;
const text = (n, v) => `<input type="text" name="${P}.${n}" value="${esc(v)}">`;
const file = (n, v, type) => `<file-picker name="${P}.${n}" type="${type}" value="${esc(v)}"></file-picker>`;
const select = (n, v, options) =>
  `<select name="${P}.${n}">${options.map(([val, label]) => `<option value="${val}" ${v === val ? "selected" : ""}>${label}</option>`).join("")}</select>`;
const area = (n, v, placeholder) =>
  `<textarea name="${P}.${n}" rows="3" placeholder="${esc(placeholder)}">${esc(v)}</textarea>`;
const range = (n, v) => `<range-picker name="${P}.${n}" min="0" max="1" step="0.05" value="${v}"></range-picker>`;
/** A collapsible section. Everything inside is still submitted when it is closed. */
const section = (title, body, { open = false, cls = "" } = {}) =>
  `<details class="vore-section ${cls}" ${open ? "open" : ""}><summary>${title}</summary><div class="vore-section-body">${body}</div></details>`;

/** One digestion stage. Fields start at what the stage looks like now; anything left equal to the option is saved as "unchanged". */
function stageHTML(k, n, slot, label) {
  const g = `${k}.stage${n}`;
  const raw = slot[`stage${n}`] ?? {};
  const eff = effectiveSlot(slot, n);
  const cell = (text, input) => `<label class="vs-cell"><span>${text}</span>${input}</label>`;
  const box = (key, text) => `<label class="vs-box"><input type="checkbox" name="${P}.${g}.${key}" ${eff[key] ? "checked" : ""}> ${text}</label>`;
  const slider = (key, v) => `<range-picker name="${P}.${g}.${key}" min="0" max="1" step="0.05" value="${Number(v) || 0}"></range-picker>`;
  return `<fieldset class="vore-stage"><legend>${label}</legend>
    <div class="vs-grid">
      ${cell("Token image (blank = same)", file(`${g}.preyImg`, raw.preyImg ?? "", "imagevideo"))}
      ${cell("Loop sound (blank = same)", file(`${g}.sound`, raw.sound ?? "", "audio"))}
      ${cell("Color", `<input type="color" name="${P}.${g}.fxColor" value="${eff.fxColor || "#7a1f2b"}">`)}
      ${cell("Tint strength", slider("fxStrength", eff.fxStrength))}
      ${cell("Distortion / blur", slider("fxDistortion", eff.fxDistortion))}
    </div>
    <div class="vs-boxes">${box("fxVignette", "Vignette")}${box("fxTint", "Tint")}${box("fxPulse", "Pulse")}${box("fxLiquid", "Sway")}${box("fxBlur", "Blur")}</div>
  </fieldset>`;
}

function slotHTML(i, s) {
  const k = `slots.${i}`;
  const title = `Vore option ${i + 1}${s.label ? ` \u2014 ${esc(s.label)}` : ""}`;
  const known = TYPES.includes(s.label);
  const typeSelect = `<select name="${P}.${k}.label" data-vore-type>${i ? `<option value="" ${s.label ? "" : "selected"}>(none)</option>` : ""}${[
    ...TYPES,
    ...(s.label && !known ? [s.label] : [])
  ]
    .map((t) => `<option value="${esc(t)}" ${s.label === t ? "selected" : ""}>${esc(t)}${TYPES.includes(t) ? "" : " (custom)"}</option>`)
    .join("")}</select>`;

  const basics = `
    ${field("Type", typeSelect, "Which kind of Vore this option is. Each type can be used once per character; prey write their own force-feed text for each type in their own Vore tab.")}
    ${field("Swallow message", text(`${k}.swallowMessage`, s.swallowMessage), "Use {predator} and {prey}.")}
    ${field("Digestion message", text(`${k}.digestMessage`, s.digestMessage), "Use {predator}, {prey}, {heal} and {temp}.")}`;

  const moreMessages = `
    ${field("Forced-release message", text(`${k}.forceReleaseMessage`, s.forceReleaseMessage), "When a predator forces resisting prey out. Use {predator} and {prey}.")}`;

  const rules = `
    ${field("When prey is digested", select(`${k}.digestedPlacement`, s.digestedPlacement, [["adjacent", "Leave remains beside the predator"], ["inside", "Keep remains inside the predator"]]))}
    ${field("Gear", select(`${k}.gearMode`, s.gearMode ?? "keep", [["keep", "Prey keeps their gear"], ["strip", "Unequip gear while held (restored on release)"], ["slime", "Gear stays; prey is Slimed when released"]]))}
    ${field("Restrain prey", check(`${k}.restrain`, s.restrain), "Applies the Restrained condition while held.")}
    ${field("Full cover for prey", check(`${k}.fullCover`, s.fullCover), "Outsiders can't target prey held inside the predator.")}
    ${field("Limit prey vision", check(`${k}.limitVision`, s.limitVision), "Prey sees only their own token (like Darkness) while held.")}`;

  const look = `
    ${field("Prey token image", file(`${k}.preyImg`, s.preyImg, "imagevideo"), "Replaces the prey's token image while vored (e.g. a belly).")}
    ${field("Digested token image", file(`${k}.digestedImg`, s.digestedImg, "imagevideo"))}`;

  const placement = `
    ${field("Offset X / Y (grid units)", `${num(`${k}.offsetX`, s.offsetX, 0.05)}${num(`${k}.offsetY`, s.offsetY, 0.05)}`, "Prey position relative to the predator's center, before rotation/flip.")}
    ${field("Prey image scale", num(`${k}.scale`, s.scale, 0.05))}`;

  const sound = `
    ${field("Sound", file(`${k}.sound`, s.sound, "audio"), "Loops while prey is vored. Fades with distance from the predator.")}
    ${field("Sound volume", range(`${k}.soundVolume`, s.soundVolume))}
    ${field("Swallow sound", file(`${k}.swallowSound`, s.swallowSound, "audio"), "Plays once when prey is swallowed.")}
    ${field("Escape / release sound", file(`${k}.escapeSound`, s.escapeSound, "audio"))}
    ${field("Digestion sound", file(`${k}.digestSound`, s.digestSound, "audio"))}`;

  const inside = `
    <p class="hint">Private to the prey's player. One line per variant; a random line is used each time. Use {predator} and {prey}.</p>
    ${field("When swallowed", area(`${k}.descSwallow`, s.descSwallow, "The world goes dark and warm as {predator} swallows you whole."))}
    ${field("Each of the predator's turns", area(`${k}.descRound`, s.descRound, "The walls squeeze around you."))}
    ${field("HP drops to 66% (stage 1)", area(`${k}.descHp66`, s.descHp66 || s.descHp75, ""))}
    ${field("HP drops to 33% (stage 2)", area(`${k}.descHp33`, s.descHp33 || s.descHp50 || s.descHp25, ""))}
    ${field("Dying (at 0 HP)", area(`${k}.descDying`, s.descDying, "Your strength fades as the dark closes in."))}
    ${field("When digested", area(`${k}.descDigested`, s.descDigested, ""))}`;

  const fx = `
    ${field("Vignette", check(`${k}.fxVignette`, s.fxVignette))}
    ${field("Flat tint", check(`${k}.fxTint`, s.fxTint))}
    ${field("Pulse (breathing)", check(`${k}.fxPulse`, s.fxPulse), "Animates the vignette/tint.")}
    ${field("Liquid sway", check(`${k}.fxLiquid`, s.fxLiquid), "A slow, light swaying of the whole view, like being carried. Cheap to run.")}
    ${field("Blur", check(`${k}.fxBlur`, s.fxBlur))}
    ${field("Stomach interior art", check(`${k}.fxBuiltinArt`, s.fxBuiltinArt), "Overlays the built-in stylized stomach-interior art on the prey's screen.")}
    ${field("Color", `<input type="color" name="${P}.${k}.fxColor" value="${s.fxColor}">`)}
    ${field("Tint strength", range(`${k}.fxStrength`, s.fxStrength))}`;

  const fxMore = `
    ${field("Custom overlay image", file(`${k}.fxImage`, s.fxImage ?? "", "imagevideo"), "Your own art instead of the built-in one. Use a PNG or WebP with transparency for best results.")}
    ${field("Overlay image opacity", range(`${k}.fxImageOpacity`, s.fxImageOpacity ?? 0.5))}
    ${field("Distortion / blur amount", range(`${k}.fxDistortion`, s.fxDistortion))}`;

  const stages = `
    <p class="hint">Stage 1 starts at 66% HP and stage 2 at 33% (keeping stage 1's changes). Anything you leave the same as the option, or the previous stage, stays unchanged.</p>
    ${stageHTML(k, 1, s, "Stage 1 (66% HP or less)")}
    ${stageHTML(k, 2, s, "Stage 2 (33% HP or less)")}`;

  const advanced = section("Extra messages", moreMessages) + section("Position and size", placement) + section("Overlay image and distortion", fxMore);
  return `<div class="vore-panel" data-vore-panel="${i}" hidden>
    <p class="vore-panel-title">${title}${i ? ` <button type="button" class="vore-remove" data-vore-remove="${i}"><i class="fa-solid fa-trash"></i> Remove this option</button>` : ""}</p>
    ${toolbarHTML(i, true)}
    ${section("Basics", basics + rules, { open: true })}
    ${section("Look: token and screen effects", look + fx)}
    ${section("Sounds", sound)}
    ${section("Inside descriptions (private to the prey's player)", inside)}
    ${section("Digestion stages", stages)}
    ${section("Advanced", advanced)}
  </div>`;
}

function formHTML(cfg) {
  const forced = TYPES.map((t) => field(t, text(`forceFed.${t}`, cfg.forceFed?.[t] ?? ""), "")).join("");
  const general =
    section(
      "Sound and chat",
      `${field("Sound fade distance (grid units)", num("soundRange", cfg.soundRange), "The sound is silent beyond this distance from the predator.")}
       ${field("Muffle prey chat", check("muffleChat", cfg.muffleChat), "Everyone except the predator's owner and prey's bellymates sees muffled text, and only within the world's muffled chat range.")}`,
      { open: true }
    ) +
    section(
      "Force-feed text",
      `<p class="hint">What this character says when they force themselves into a predator, by the predator's Vore type. Use {prey} and {predator}.</p>${forced}`
    ) +
    section(
      "Stomach (AC and HP)",
      `<p class="hint">Only used when the "Stomach rules" world setting is on. Leave blank for automatic values.</p>
       ${field("Stomach AC", num("stomachAC", cfg.stomachAC), "Blank = 10 + the predator's CON modifier.")}
       ${field("Stomach HP", num("stomachHP", cfg.stomachHP), "Blank = half the predator's max HP.")}`
    ) +
    section(
      "Copy, paste and presets",
      `<p class="hint">Works on every Vore option at once. Each option also has its own buttons.</p>${toolbarHTML("all")}`
    );
  const pills = Array.from({ length: MAX_SLOTS }, (_, i) => {
    const l = cfg.slots[i]?.label;
    const on = i === 0 || !!l;
    return `<button type="button" class="vore-pill" data-vore-pill="${i}" ${on ? "" : "hidden"}>${esc(l || `Option ${i + 1}`)}</button>`;
  }).join("");
  const anyOff = Array.from({ length: MAX_SLOTS }, (_, i) => i).some((i) => i && !cfg.slots[i]?.label);
  return `<div class="vore-config">
    <nav class="vore-pills"><button type="button" class="vore-pill active" data-vore-pill="general"><i class="fa-solid fa-gear"></i> General</button></nav>
    <p class="vore-pills-title">Vore Options</p>
    <nav class="vore-pills">${pills}<button type="button" class="vore-pill vore-plus" data-vore-add ${anyOff ? "" : "hidden"} title="Add another Vore option"><i class="fa-solid fa-plus"></i></button></nav>
    <div class="vore-panel" data-vore-panel="general">${general}</div>
    ${Array.from({ length: MAX_SLOTS }, (_, i) => slotHTML(i, cfg.slots[i])).join("")}
  </div>`;
}

function injectVoreTab(app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  // In-world: a TokenDocument. Prototype: a PrototypeToken (or the actor that owns it).
  const doc = app.token ?? app.document ?? app.prototype ?? app.actor;
  if (!root || !doc || root.querySelector('[data-tab="vore"]')) return;
  // The GM always gets the tab. Players get it for tokens/actors they own, if the world setting allows.
  if (!game.user.isGM) {
    const actor = doc.actor ?? doc;
    const allowed = game.settings.get(MODULE_ID, "playersEditConfig") && actor?.testUserPermission?.(game.user, "OWNER");
    if (!allowed) return;
  }

  const nav = root.querySelector("nav.tabs, nav.sheet-tabs");
  const sample = nav?.querySelector("[data-tab]");
  const sections = [...root.querySelectorAll(".tab[data-tab]")];
  if (!nav || !sample || !sections.length) return;

  const group = sample.dataset.group ?? "sheet";
  const link = document.createElement(sample.tagName.toLowerCase());
  link.className = sample.className.replace(/\bactive\b/g, "").trim();
  if (sample.dataset.action) link.dataset.action = sample.dataset.action;
  link.dataset.group = group;
  link.dataset.tab = "vore";
  link.innerHTML = `<i class="fa-solid fa-utensils"></i> <span>Vore</span>`;
  nav.append(link);

  const section = document.createElement("div");
  section.className = "tab";
  section.dataset.tab = "vore";
  section.dataset.group = group;
  section.innerHTML = formHTML(getConfig(doc)); // shows the module defaults too; saving never copies them in
  sections.at(-1).after(section);
  const typeSelects = () => [...section.querySelectorAll("[data-vore-type]")];
  const show = (id) => {
    section.querySelectorAll("[data-vore-pill]").forEach((p) => p.classList.toggle("active", p.dataset.vorePill === String(id)));
    section.querySelectorAll("[data-vore-panel]").forEach((p) => (p.hidden = p.dataset.vorePanel !== String(id)));
  };
  // Each type can be used once: types taken by another option are greyed out here.
  const refreshTypes = () => {
    const used = typeSelects().map((x) => x.value).filter(Boolean);
    for (const sel of typeSelects()) {
      for (const opt of sel.options) opt.disabled = !!opt.value && opt.value !== sel.value && used.includes(opt.value);
    }
    typeSelects().forEach((sel, i) => {
      const pill = section.querySelector(`[data-vore-pill="${i}"]`);
      if (pill) {
        pill.textContent = sel.value || `Option ${i + 1}`;
        pill.hidden = i > 0 && !sel.value;
      }
    });
    section.querySelector("[data-vore-add]").hidden = typeSelects().every((sel, i) => i === 0 || !!sel.value);
  };
  refreshTypes();
  section.addEventListener("change", (event) => {
    if (event.target?.matches?.("[data-vore-type]")) refreshTypes();
  });
  section.addEventListener("vore-refill", refreshTypes);
  section.addEventListener("click", (event) => {
    const pill = event.target.closest("[data-vore-pill]");
    if (pill) {
      event.preventDefault();
      show(pill.dataset.vorePill);
      return;
    }
    if (event.target.closest("[data-vore-add]")) {
      event.preventDefault();
      const sels = typeSelects();
      const next = sels.findIndex((sel, i) => i > 0 && !sel.value);
      const free = TYPES.find((t) => !sels.some((sel) => sel.value === t));
      if (next < 0 || !free) return;
      sels[next].value = free;
      refreshTypes();
      show(next);
      return;
    }
    const rm = event.target.closest("[data-vore-remove]");
    if (rm) {
      event.preventDefault();
      const sel = typeSelects()[Number(rm.dataset.voreRemove)];
      if (sel) sel.value = "";
      refreshTypes();
      show("general");
      return;
    }
    const btn = event.target.closest("[data-vore-act]");
    if (!btn) return;
    event.preventDefault();
    const slot = btn.dataset.slot === "all" ? "all" : Number(btn.dataset.slot);
    runPresetAction(section, btn.dataset.voreAct, slot);
  });
}
