/** The predator picks how digestion works each time they swallow: damage per turn, or a countdown timer. */
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

/** Form fields for the digestion choice (also embedded in the GM Vore dialog). */
export function digestFields() {
  const d = last();
  const sel = (v) => (d.mode === v ? "selected" : "");
  return `
  <div class="form-group"><label>Effect on prey</label><div class="form-fields">
    <select name="deffect">
      <option value="damage" ${d.effect === "heal" ? "" : "selected"}>Damage (digestion)</option>
      <option value="heal" ${d.effect === "heal" ? "selected" : ""}>Healing (prey recover HP, nobody is digested)</option>
    </select></div></div>
  <div class="form-group"><label>Timing</label><div class="form-fields">
    <select name="dmode">
      <option value="turn" ${sel("turn")}>Damage on each of the predator's turns</option>
      <option value="timed" ${sel("timed")}>Timer (countdown)</option>
    </select></div></div>
  <div class="form-group"><label>Timer duration</label><div class="form-fields">
    <input type="number" name="dh" value="${d.hours}" min="0" step="1" style="max-width:4.5rem"> h
    <input type="number" name="dm" value="${d.minutes}" min="0" step="1" style="max-width:4.5rem"> m
    <input type="number" name="ds" value="${d.seconds}" min="0" step="1" style="max-width:4.5rem"> s</div>
    <p class="hint">Timer only. All zero = 10 minutes. In combat each predator turn adds 6 seconds.</p></div>
  <div class="form-group"><label>Timer clock</label><div class="form-fields">
    <select name="dclock">
      <option value="real" ${d.clock === "real" ? "selected" : ""}>Real time (wall clock)</option>
      <option value="world" ${d.clock === "world" ? "selected" : ""}>World clock (in-game time)</option>
    </select></div></div>
  <div class="form-group"><label>Timer: skip death saves</label><div class="form-fields">
    <input type="checkbox" name="dskip" ${d.skipDeathSaves ? "checked" : ""}></div>
    <p class="hint">Prey reaching 0 HP from the timer are digested right away.</p></div>`;
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

/** Ask how this swallow digests. Resolves to the choice, or null if cancelled. */
export async function askDigest(title = "How does digestion work?") {
  return DialogV2.wait({
    window: { title },
    content: `<p>Choose what happens to this prey inside, and how.</p>${digestFields()}`,
    buttons: [{ action: "ok", label: "Swallow", default: true, callback: (e, b) => readDigest(b.form) }],
    rejectClose: false
  });
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
