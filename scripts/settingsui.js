import { MODULE_ID } from "./const.js";

/** Group this module's long flat settings list under headings. Purely cosmetic; never touches the values. */
const GROUPS = [
  ["Who can do what", ["playersCanVore", "playersEditConfig", "allowFeeding", "allowEndo", "autoRollNPC", "autoAddFeatures"]],
  ["Digestion", ["digestHeal"]],
  ["Rules", ["sizeMatters", "preyStrikeBack", "breakoutThreshold", "breakoutDC", "stomachRules", "predatorDowned"]],
  ["Chat and display", ["muffleRange", "secretSoundRange", "showStatusPanel", "smoothAttach", "voreLog"]],
  ["Defaults for Vore option 1", ["defaultPreyImg1", "defaultDigestedImg1", "defaultSound1", "defaultSwallowSound1", "defaultEscapeSound1", "defaultDigestSound1"]]
];

export function registerSettingsUI() {
  Hooks.on("renderSettingsConfig", (app, html) => {
    try {
      const root = html instanceof HTMLElement ? html : html?.[0];
      if (!root) return;
      const items = [...root.querySelectorAll(`[data-setting-id^="${MODULE_ID}."]`)].filter((el) => el.classList.contains("form-group"));
      if (!items.length) return;
      const parent = items[0].parentElement;
      const byKey = new Map(items.map((el) => [el.dataset.settingId.slice(MODULE_ID.length + 1), el]));
      const used = new Set();
      const frag = document.createDocumentFragment();
      const heading = (text) => {
        const h = document.createElement("h4");
        h.className = "vore-settings-heading";
        h.textContent = text;
        frag.append(h);
      };
      for (const [title, keys] of GROUPS) {
        const here = keys.filter((k) => byKey.has(k));
        if (!here.length) continue;
        heading(title);
        for (const k of here) {
          frag.append(byKey.get(k));
          used.add(k);
        }
      }
      const rest = [...byKey.keys()].filter((k) => !used.has(k));
      if (rest.length) {
        heading("Other");
        rest.forEach((k) => frag.append(byKey.get(k)));
      }
      parent.append(frag);
    } catch (e) {
      console.warn("vore-system | could not group settings", e);
    }
  });
}
