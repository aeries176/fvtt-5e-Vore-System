import { MODULE_ID } from "./const.js";
import { isActiveGM } from "./util.js";

/**
 * GM-only "Vore Log" journal: one page per scene, a timestamped line for every swallow, release,
 * digestion and restore. Handy for recaps. Turn it off with the "Keep a Vore Log journal" setting.
 */
const NAME = "Vore Log";
let queue = Promise.resolve();

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

async function write(scene, html) {
  let entry = game.journal.find((j) => j.getFlag(MODULE_ID, "log"));
  if (!entry) {
    entry = await JournalEntry.create({
      name: NAME,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
      flags: { [MODULE_ID]: { log: true } }
    });
  }
  let page = entry.pages.find((p) => p.getFlag(MODULE_ID, "scene") === scene.id);
  if (!page) {
    const [created] = await entry.createEmbeddedDocuments("JournalEntryPage", [
      { name: scene.name, type: "text", text: { content: "", format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML }, flags: { [MODULE_ID]: { scene: scene.id } } }
    ]);
    page = created;
  }
  await page.update({ "text.content": `${page.text.content ?? ""}${html}` });
}

/** Append one line to the log for a scene. Safe to call from anywhere; only the active GM writes. */
export function logEvent(scene, text, { secret = false } = {}) {
  try {
    if (!scene || !isActiveGM() || !game.settings.get(MODULE_ID, "voreLog")) return;
    const when = new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const combat = game.combats.find((c) => c.started && c.scene?.id === scene.id);
    const round = combat ? ` · round ${combat.round}` : "";
    const html = `<p><em>${esc(when)}${round}</em> — ${text}${secret ? " <em>(secret)</em>" : ""}</p>`;
    queue = queue.then(() => write(scene, html)).catch((e) => console.warn("vore-system | log failed", e));
  } catch (e) {
    console.warn("vore-system | log failed", e);
  }
}

export const logName = (doc) => `<strong>${esc(doc?.name ?? "someone")}</strong>`;
