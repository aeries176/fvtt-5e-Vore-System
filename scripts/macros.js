import { MODULE_ID } from "./const.js";

const MACRO_PACK_VERSION = 1; // bump when macros are added or changed

const API = `game.modules.get("vore-system").api`;
const withToken = (call) => `const t = canvas.tokens.controlled[0]?.document;
if (!t) return ui.notifications.warn("Control a token first.");
${API}.${call}(t);`;

const MACROS = [
  { name: "Vore Check", img: "modules/vore-system/icons/vored.svg", command: withToken("voreAction"), note: "Control your token and target the prey, then run it." },
  { name: "Vore Feed", img: "modules/vore-system/icons/vored.svg", command: withToken("feedAction"), note: "Control your token and target the predator." },
  { name: "Vore Escape", img: "modules/vore-system/icons/vored.svg", command: withToken("escapeAction"), note: "Struggle from inside a predator." },
  { name: "Vore Churn", img: "modules/vore-system/icons/vored.svg", command: withToken("churnAction"), note: "Churn the prey you hold." },
  { name: "Vore Release", img: "modules/vore-system/icons/vored.svg", command: withToken("releaseAction"), note: "Release prey you hold." },
  { name: "Vore Endo Toggle", img: "modules/vore-system/icons/vored.svg", command: withToken("endoAction"), note: "Turn Endo on or off for your predator." },
  { name: "Vore Strike From Within", img: "modules/vore-system/icons/vored.svg", command: withToken("strikeAction"), note: "Strike your predator from inside." },
  { name: "Vore Panic Release", img: "modules/vore-system/icons/vored.svg", command: withToken("panicAction"), note: "Digested players: ask the GM to be let out. Goes through automatically after 60 seconds." },
  { name: "Vore (GM, selected tokens)", img: "modules/vore-system/icons/vored.svg", command: `if (!game.user.isGM) return ui.notifications.warn("GM only.");\n${API}.manualVore();`, note: "Select 2+ tokens, pick the predator and type. No check." },
  { name: "Vore Reset Scene (GM)", img: "modules/vore-system/icons/vored.svg", command: `if (!game.user.isGM) return ui.notifications.warn("GM only.");\n${API}.resetScene(canvas.scene.id);`, note: "Frees every held or digested token in this scene." }
];

/** Create the "Vore Macros" compendium (drag macros to your hotbar). GM only, once per version. */
export async function ensureMacroPack() {
  if (!game.user.isGM) return;
  if ((Number(game.settings.get(MODULE_ID, "macroPackVersion")) || 0) >= MACRO_PACK_VERSION) return;
  try {
    const CC = foundry.documents?.collections?.CompendiumCollection ?? CompendiumCollection;
    let pack = game.packs.get(`world.${MODULE_ID}-macros`);
    if (!pack) {
      pack = await CC.createCompendium({ label: "Vore Macros", name: `${MODULE_ID}-macros`, type: "Macro", packageType: "world" });
    }
    const have = new Set((await pack.getDocuments()).map((d) => d.name));
    const toCreate = MACROS.filter((m) => !have.has(m.name)).map((m) => ({
      name: m.name,
      type: "script",
      img: m.img,
      command: `// ${m.note}\n${m.command}`,
      flags: { [MODULE_ID]: { macro: true } }
    }));
    if (toCreate.length) await Macro.implementation.createDocuments(toCreate, { pack: pack.collection });
    await game.settings.set(MODULE_ID, "macroPackVersion", MACRO_PACK_VERSION);
  } catch (e) {
    console.warn("vore-system | could not create the macro compendium", e);
  }
}
