/** The predator picks how digestion works each time they swallow: damage per turn, or a countdown timer. */
import { hidesPrey } from "./util.js";

const { DialogV2 } = foundry.applications.api;
const KEY = "vore-system.lastDigest";

const DEFAULT = { effect: "damage", mode: "turn", hours: 0, minutes: 10, seconds: 0, clock: "real", skipDeathSaves: false };

function last() {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULT };
  }
}

/** Form fields for the digestion choice (also embedded in other Vore dialogs). Timer fields only show for "Timer". */
export function digestFields() {
  const d = last();
  const timed = d.mode === "timed";
  return `
  <div class="form-group"><label>Effect on prey</label><div class="form-fields">
    <select name="deffect">
      <option value="damage" ${d.effect === "heal" ? "" : "selected"}>Damage (digestion)</option>
      <option value="heal" ${d.effect === "heal" ? "selected" : ""}>Healing (prey recover, nobody is digested)</option>
    </select></div></div>
  <div class="form-group"><label>Timing</label><div class="form-fields">
    <select name="dmode">
      <option value="turn" ${timed ? "" : "selected"}>Each of the predator's turns</option>
      <option value="timed" ${timed ? "selected" : ""}>Timer (countdown)</option>
    </select></div></div>
  <div class="form-group" data-timer ${timed ? "" : 'style="display:none"'}><label>Timer duration</label><div class="form-fields">
    <input type="number" name="dh" value="${d.hours}" min="0" step="1" style="max-width:4.5rem"> h
    <input type="number" name="dm" value="${d.minutes}" min="0" step="1" style="max-width:4.5rem"> m
    <input type="number" name="ds" value="${d.seconds}" min="0" step="1" style="max-width:4.5rem"> s</div>
    <p class="hint">All zero = 10 minutes. In combat each predator turn adds 6 seconds.</p></div>
  <div class="form-group" data-timer ${timed ? "" : 'style="display:none"'}><label>Timer clock</label><div class="form-fields">
    <select name="dclock">
      <option value="real" ${d.clock === "world" ? "" : "selected"}>Real time (wall clock)</option>
      <option value="world" ${d.clock === "world" ? "selected" : ""}>World clock (in-game time)</option>
    </select></div></div>
  <div class="form-group" data-timer ${timed ? "" : 'style="display:none"'}><label>Skip death saves</label><div class="form-fields">
    <input type="checkbox" name="dskip" ${d.skipDeathSaves ? "checked" : ""}></div>
    <p class="hint">Prey reaching 0 HP from the timer are digested right away.</p></div>`;
}

/** Show the timer fields only while "Timer" is selected. Call from a dialog's render callback. */
export function bindDigest(dialog) {
  const root = dialog?.element ?? dialog;
  const sel = root?.querySelector?.('select[name="dmode"]');
  if (!sel) return;
  const apply = () => {
    root.querySelectorAll("[data-timer]").forEach((e) => (e.style.display = sel.value === "timed" ? "" : "none"));
    dialog.setPosition?.({ height: "auto" });
  };
  sel.addEventListener("change", apply);
  apply();
}

/** Read the fields back out of a form element. */
export function readDigest(form) {
  const el = form.elements ?? form;
  const v = (n) => el[n]?.value;
  const out = {
    effect: v("deffect") === "heal" ? "heal" : "damage",
    mode: v("dmode") === "timed" ? "timed" : "turn",
    hours: Math.max(0, Number(v("dh")) || 0),
    minutes: Math.max(0, Number(v("dm")) || 0),
    seconds: Math.max(0, Number(v("ds")) || 0),
    clock: v("dclock") === "world" ? "world" : "real",
    skipDeathSaves: !!el.dskip?.checked
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {}
  return out;
}

/** The "Hide prey token" checkbox: on request for GM tools and Secret Vore (off by default), automatic with a hiding feat. */
export function hideField(pred, secret = false) {
  const feat = hidesPrey(pred);
  if (!feat && !secret && !game.user.isGM) return "";
  return `<div class="form-group"><label>Hide prey token</label><div class="form-fields"><input type="checkbox" name="dhide" ${!secret && feat ? "checked" : ""}></div>
    <p class="hint">${feat && !secret ? "Your stomach hides what it holds. " : ""}Hidden prey vanish from the map for everyone but you, them and the GM, and make no sound until revealed.</p></div>`;
}

/** One dialog for the whole choice: Vore type (when there is more than one) plus effect and timing. */
export async function askSwallow({ slots = [], title = "Swallow", intro = "", pred = null, secret = false } = {}) {
  const picker =
    slots.length > 1
      ? `<div class="form-group"><label>Vore type</label><div class="form-fields"><select name="slot">${slots
          .map((s) => `<option value="${s.index}">${foundry.utils.escapeHTML(s.label)}</option>`)
          .join("")}</select></div></div>`
      : "";
  return DialogV2.wait({
    window: { title },
    content: `${intro ? `<p>${intro}</p>` : ""}${picker}${digestFields()}${hideField(pred, secret)}`,
    buttons: [
      {
        action: "ok",
        label: "Swallow",
        default: true,
        callback: (e, b) => ({ slot: Number(b.form.elements.slot?.value ?? slots[0]?.index ?? 0), digest: readDigest(b.form), hide: !!b.form.elements.dhide?.checked })
      }
    ],
    render: (event, dialog) => bindDigest(dialog),
    rejectClose: false
  });
}

/** Just the digestion choice (no Vore type). */
export async function askDigest(title = "How does digestion work?") {
  const r = await askSwallow({ title });
  return r?.digest ?? null;
}

/** Keep only sane values before they reach the world state. */
export function cleanDigest(d) {
  if (!d) return { effect: "damage", mode: "turn" };
  return {
    effect: d.effect === "heal" ? "heal" : "damage",
    mode: d.mode === "timed" ? "timed" : "turn",
    hours: Math.max(0, Number(d.hours) || 0),
    minutes: Math.max(0, Number(d.minutes) || 0),
    seconds: Math.max(0, Number(d.seconds) || 0),
    clock: d.clock === "world" ? "world" : "real",
    skipDeathSaves: !!d.skipDeathSaves
  };
}
