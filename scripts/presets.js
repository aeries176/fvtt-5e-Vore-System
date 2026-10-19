import { MODULE_ID } from "./const.js";
import { request, register } from "./socket.js";

const { DialogV2 } = foundry.applications.api;
const P = `flags.${MODULE_ID}.config.`;
const CLIP = `${MODULE_ID}.clipboard`;
const SOUNDS = `modules/${MODULE_ID}/sounds/`;

/* -------------------------------------------- */
/*  Reading and filling the Vore tab form        */
/* -------------------------------------------- */

const inputsFor = (root, prefix) => [...root.querySelectorAll("[name]")].filter((el) => el.name.startsWith(prefix));

function valueOf(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return el.value === "" ? "" : Number(el.value);
  if (el.tagName === "RANGE-PICKER") return Number(el.value);
  return el.value;
}

function read(root, prefix) {
  const data = {};
  for (const el of inputsFor(root, prefix)) foundry.utils.setProperty(data, el.name.slice(prefix.length), valueOf(el));
  return data;
}

function fill(root, prefix, data) {
  for (const el of inputsFor(root, prefix)) {
    const v = foundry.utils.getProperty(data, el.name.slice(prefix.length));
    if (v === undefined) continue;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = v ?? "";
  }
}

export const readSlot = (root, i) => read(root, `${P}slots.${i}.`);
export const readAll = (root) => read(root, P);
export const fillSlot = (root, i, data) => fill(root, `${P}slots.${i}.`, data);
export const fillAll = (root, data) => fill(root, P, data);

/* -------------------------------------------- */
/*  Preset library                               */
/* -------------------------------------------- */

const BUILTIN = {
  "Classic Stomach (built in)": {
    scope: "slot",
    builtin: true,
    data: {
      label: "Oral",
      swallowMessage: "{predator} swallows {prey} whole.",
      digestMessage: "{prey} has been digested.",
      preyImg: `modules/${MODULE_ID}/images/prey_belly.png`,
      sound: `${SOUNDS}Digestion_New_2024.mp3`,
      swallowSound: `${SOUNDS}gulp3-hard.wav`,
      escapeSound: `${SOUNDS}Voiceless_BehindSpit_1.wav`,
      digestSound: `${SOUNDS}Stomach_Growl_Wet_004.wav`,
      soundVolume: 0.6,
      restrain: true,
      fullCover: true,
      limitVision: true,
      gearMode: "keep",
      fxVignette: true,
      fxPulse: true,
      fxBuiltinArt: true,
      fxImageOpacity: 0.45,
      fxColor: "#7a1f2b",
      fxStrength: 0.35,
      descSwallow: "The world goes dark and warm as {predator} swallows you whole.\nA slick, muffled gulp, and you slide down into the hush of {predator}.",
      descRound: "The walls squeeze around you.\nA heartbeat thunders somewhere above.\nEverything sloshes and sways.",
      descDying: "Your strength fades as the dark closes in."
    }
  },
  "Slow Digestion (built in)": {
    scope: "slot",
    builtin: true,
    data: {
      label: "Slow Digestion",
      fxVignette: true,
      fxPulse: true,
      fxBuiltinArt: true,
      fxImageOpacity: 0.4,
      fxColor: "#7a1f2b",
      fxStrength: 0.3,
      stage1: { fxColor: "#a1472b", fxStrength: "0.5", fxLiquid: "on" },
      stage2: { fxColor: "#5c7a1f", fxStrength: "0.65", fxDistortion: "0.7", fxBlur: "on" },
      descHp75: "A prickling warmth creeps across your skin.",
      descHp50: "The juices rise around you, and your gear feels heavy.",
      descHp25: "Everything is liquid, and you can barely stand."
    }
  }
};

export function library() {
  const stored = game.settings.get(MODULE_ID, "presets") ?? {};
  return { ...BUILTIN, ...stored };
}

export function registerPresets() {
  register("savePreset", async ({ name, scope, data }, userId) => {
    const user = game.users.get(userId);
    if (!user || !name || !data || !["slot", "all"].includes(scope)) return;
    if (!user.isGM && !game.settings.get(MODULE_ID, "playersEditConfig")) return;
    const cur = foundry.utils.deepClone(game.settings.get(MODULE_ID, "presets") ?? {});
    cur[String(name).slice(0, 60)] = { scope, data };
    await game.settings.set(MODULE_ID, "presets", cur);
  });
  register("deletePreset", async ({ name }, userId) => {
    if (!game.users.get(userId)?.isGM) return;
    const cur = foundry.utils.deepClone(game.settings.get(MODULE_ID, "presets") ?? {});
    delete cur[name];
    await game.settings.set(MODULE_ID, "presets", cur);
  });
}

/* -------------------------------------------- */
/*  Dialogs and button actions                   */
/* -------------------------------------------- */

const formData = (button) => new foundry.applications.ux.FormDataExtended(button.form).object;

async function askText(title, label, value = "") {
  const r = await DialogV2.prompt({
    window: { title },
    content: `<div class="form-group"><label>${label}</label><div class="form-fields"><input type="text" name="v" value="${foundry.utils.escapeHTML(value)}" autofocus></div></div>`,
    ok: { label: "OK", callback: (e, b) => formData(b) },
    rejectClose: false
  });
  return r?.v?.trim() || null;
}

async function showJson(title, text) {
  await DialogV2.wait({
    window: { title },
    content: `<p>Copy this to share it or move it to another world.</p><textarea readonly rows="12" style="width:100%" name="t">${foundry.utils.escapeHTML(text)}</textarea>`,
    buttons: [
      { action: "copy", label: "Copy to clipboard", default: true, callback: () => navigator.clipboard?.writeText(text).then(() => ui.notifications.info("Copied.")) },
      { action: "close", label: "Close" }
    ],
    rejectClose: false
  });
}

async function askJson(title) {
  const r = await DialogV2.prompt({
    window: { title },
    content: `<p>Paste exported Vore JSON below.</p><textarea rows="12" style="width:100%" name="t"></textarea>`,
    ok: { label: "Import", callback: (e, b) => formData(b) },
    rejectClose: false
  });
  if (!r?.t?.trim()) return null;
  try {
    return JSON.parse(r.t);
  } catch (e) {
    ui.notifications.error("That isn't valid JSON.");
    return null;
  }
}

async function pickPreset(scope) {
  const lib = Object.entries(library()).filter(([, p]) => p.scope === scope);
  if (!lib.length) {
    ui.notifications.info("No presets saved yet.");
    return null;
  }
  const options = lib.map(([n]) => `<option value="${foundry.utils.escapeHTML(n)}">${foundry.utils.escapeHTML(n)}</option>`).join("");
  const buttons = [
    { action: "load", label: "Load into form", default: true, callback: (e, b) => ({ action: "load", name: formData(b).preset }) }
  ];
  if (game.user.isGM) buttons.push({ action: "delete", label: "Delete", callback: (e, b) => ({ action: "delete", name: formData(b).preset }) });
  buttons.push({ action: "cancel", label: "Cancel", callback: () => null });
  return DialogV2.wait({
    window: { title: "Vore presets" },
    content: `<div class="form-group"><label>Preset</label><div class="form-fields"><select name="preset">${options}</select></div></div>`,
    buttons,
    rejectClose: false
  });
}

const clipRead = () => {
  try {
    return JSON.parse(localStorage.getItem(CLIP) ?? "null");
  } catch (e) {
    return null;
  }
};

const loaded = () => ui.notifications.info("Loaded into the form. Press Update / Save to keep it.");

/** Handle one toolbar button. `slot` is the option index, or "all" for the whole Vore tab. */
export async function runPresetAction(root, act, slot) {
  const all = slot === "all";
  const scope = all ? "all" : "slot";
  const get = () => (all ? readAll(root) : readSlot(root, slot));
  const put = (data) => (all ? fillAll(root, data) : fillSlot(root, slot, data));

  if (act === "copy") {
    try {
      localStorage.setItem(CLIP, JSON.stringify({ scope, data: get() }));
      ui.notifications.info(all ? "Copied the whole Vore tab." : `Copied Vore option ${slot + 1}.`);
    } catch (e) {
      ui.notifications.warn("Couldn't use browser storage. Use Export instead.");
    }
  } else if (act === "paste") {
    const clip = clipRead();
    if (!clip?.data) return ui.notifications.warn("Nothing copied yet.");
    if (clip.scope !== scope) return ui.notifications.warn(all ? "That's a single option. Paste it into an option instead." : "That's a whole Vore tab. Use Paste on the top bar instead.");
    put(clip.data);
    loaded();
  } else if (act === "save") {
    const name = await askText("Save preset", "Preset name");
    if (!name) return;
    await request("savePreset", { name, scope, data: get() });
    ui.notifications.info(`Saved preset "${name}".`);
  } else if (act === "load") {
    const pick = await pickPreset(scope);
    if (!pick?.name) return;
    if (pick.action === "delete") {
      if (library()[pick.name]?.builtin) return ui.notifications.warn("Built-in presets can't be deleted.");
      await request("deletePreset", { name: pick.name });
      return ui.notifications.info(`Deleted "${pick.name}".`);
    }
    put(library()[pick.name].data);
    loaded();
  } else if (act === "export") {
    await showJson(all ? "Export Vore tab" : `Export Vore option ${slot + 1}`, JSON.stringify({ module: MODULE_ID, scope, data: get() }, null, 2));
  } else if (act === "import") {
    const json = await askJson(all ? "Import Vore tab" : `Import into Vore option ${slot + 1}`);
    if (!json) return;
    if (json.scope !== scope || !json.data) return ui.notifications.warn(`That export is for ${json.scope === "all" ? "a whole Vore tab" : "a single option"}.`);
    put(json.data);
    loaded();
  }
}

export function toolbarHTML(slot, compact = false) {
  const b = (act, label, icon) =>
    `<button type="button" data-vore-act="${act}" data-slot="${slot}" data-tooltip="${label}" title="${label}"><i class="fa-solid ${icon}"></i>${compact ? "" : ` ${label}`}</button>`;
  return `<div class="vore-toolbar">${b("copy", "Copy", "fa-copy")}${b("paste", "Paste", "fa-paste")}${b("save", "Save preset", "fa-floppy-disk")}${b("load", "Load preset", "fa-folder-open")}${b("export", "Export", "fa-file-export")}${b("import", "Import", "fa-file-import")}</div>`;
}
