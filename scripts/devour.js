import { MODULE_ID } from "./const.js";
import { FEATS, SUBCLASSES, FOLDERS, RETIRED, featData, featDescription, subclassData, subclassDescription } from "./feats.js";

export const PACK_VERSION = 5; // bump when new compendium entries are added

export const FEATURE_NAME = "Vore Actions";
const ACTIVITIES = ["Devour", "Feed", "Endo", "Churn", "Release prey", "Struggle"];

const DESCRIPTION = `<p>Every Vore action in one feature. Each button runs the module's version of the action; most use your selected token and your current targets.</p>
<ul>
<li><strong>Devour</strong> &mdash; target a creature and start the opposed Athletics/Acrobatics check to swallow them.</li>
<li><strong>Feed</strong> &mdash; target a predator and offer yourself. They may allow it or resist (then you must win a Vore check).</li>
<li><strong>Endo</strong> &mdash; toggle: prey you hold takes no digestion damage.</li>
<li><strong>Churn</strong> &mdash; spend an action to deal extra damage to prey you're holding (ends Endo).</li>
<li><strong>Release prey</strong> &mdash; offer to let those you're holding go. They may allow it or resist.</li>
<li><strong>Struggle</strong> &mdash; while swallowed, make an opposed check to break free.</li>
</ul>`;

const activityData = (name) => ({ type: "utility", name, activation: { type: "action", value: 1 } });

/** Item data for the Vore Actions feature, with its activities built in (used by the compendium and the sheet button). */
export function voreActionsData() {
  const activities = {};
  for (const name of ACTIVITIES) {
    const _id = foundry.utils.randomID();
    activities[_id] = { _id, ...activityData(name) };
  }
  return {
    name: FEATURE_NAME,
    type: "feat",
    img: `modules/${MODULE_ID}/icons/vored.svg`,
    system: { description: { value: DESCRIPTION }, activities },
    flags: { [MODULE_ID]: { devour: true } }
  };
}

/** Add the "Vore Actions" feature to an actor. An older "Devour" feature is renamed and topped up instead. */
export async function addVoreActions(actor) {
  if (!actor) return ui.notifications.warn("This token has no actor to add a feature to.");
  const existing = actor.items.find((i) => i.getFlag(MODULE_ID, "devour"));
  try {
    if (existing) {
      await existing.update({ name: FEATURE_NAME, "system.description.value": DESCRIPTION });
      const have = new Set([...existing.system.activities].map((a) => String(a.name).toLowerCase()));
      for (const name of ACTIVITIES.filter((n) => !have.has(n.toLowerCase()))) {
        await existing.createActivity("utility", activityData(name), { renderSheet: false });
      }
      return ui.notifications.info(`${actor.name}'s Vore Actions are up to date.`);
    }
    await actor.createEmbeddedDocuments("Item", [voreActionsData()]);
    ui.notifications.info(`Added Vore Actions to ${actor.name}.`);
  } catch (e) {
    console.warn("vore-system | could not add Vore Actions", e);
    ui.notifications.warn("Couldn't add Vore Actions. Check the console, or use the Token HUD buttons instead.");
  }
}
export const addDevourFeature = addVoreActions; // old API name

/** Create the editable "Vore System" Item compendium once and put Vore Actions in it. GM only. */
export async function ensurePack({ force = false } = {}) {
  if (!game.user.isGM) return;
  const done = Number(game.settings.get(MODULE_ID, "packVersion")) || 0;
  if (done >= PACK_VERSION && !force) return;
  try {
    const CC = foundry.documents?.collections?.CompendiumCollection ?? CompendiumCollection;
    let pack = game.packs.get(`world.${MODULE_ID}`);
    if (!pack) {
      pack = await CC.createCompendium({
        label: "Vore System",
        name: MODULE_ID,
        type: "Item",
        system: game.system.id,
        packageType: "world"
      });
    }
    const FolderCls = foundry.documents?.Folder ?? Folder;
    const folderIds = {};
    for (const name of FOLDERS) {
      const existing = pack.folders.find((f) => f.name === name);
      folderIds[name] = existing?.id ?? (await FolderCls.create({ name, type: "Item" }, { pack: pack.collection })).id;
    }

    const docs = await pack.getDocuments();
    const byName = new Map(docs.map((d) => [d.name, d]));

    // Retire feats that were removed from the module (only ones this module created).
    for (const name of RETIRED) {
      const d = byName.get(name);
      if (d?.getFlag(MODULE_ID, "feat")) await d.delete();
    }

    const toCreate = [];
    if (!byName.has(FEATURE_NAME)) toCreate.push(voreActionsData());
    const entries = [
      ...FEATS.map((f) => ({ ...f, build: () => featData(f), describe: () => featDescription(f) })),
      ...SUBCLASSES.map((sc) => ({ ...sc, folder: "Subclasses", build: () => subclassData(sc), describe: () => subclassDescription(sc) }))
    ];
    for (const feat of entries) {
      const folder = folderIds[feat.folder] ?? null;
      const d = byName.get(feat.name) ?? (feat.replaces ? byName.get(feat.replaces) : null);
      if (!d) {
        toCreate.push({ ...feat.build(), folder });
        continue;
      }
      // Update only entries this module made, and only when the module's version of the feat is newer.
      if (!d.getFlag(MODULE_ID, "feat")) continue;
      const update = {};
      if (d.name !== feat.name) update.name = feat.name;
      if ((d.getFlag(MODULE_ID, "v") ?? 1) < (feat.v ?? 1)) {
        update["system.description.value"] = feat.describe();
        update[`flags.${MODULE_ID}.v`] = feat.v;
      }
      if (!d.folder) update.folder = folder;
      if (Object.keys(update).length) await d.update(update);
    }
    if (toCreate.length) await Item.implementation.createDocuments(toCreate, { pack: pack.collection });
    await game.settings.set(MODULE_ID, "packVersion", PACK_VERSION);
  } catch (e) {
    console.warn("vore-system | could not create the compendium", e);
  }
}

/** Make the Devour feature's buttons run the module's actions instead of posting a normal item card. */
export function registerDevourHooks({ voreAction, churnAction, releaseAction, escapeAction, feedAction, endoAction }) {
  let last = 0;

  const run = (item, activityName) => {
    const actor = item.actor;
    const token =
      canvas.tokens?.controlled.find((t) => t.actor?.id === actor?.id)?.document ?? actor?.getActiveTokens(true, true)[0];
    if (!token) {
      ui.notifications.warn("Place or select this character's token first.");
      return;
    }
    const name = String(activityName ?? "").toLowerCase();
    if (name.startsWith("feed")) feedAction(token);
    else if (name.startsWith("endo")) endoAction(token);
    else if (name.startsWith("churn")) churnAction(token);
    else if (name.startsWith("release")) releaseAction(token);
    else if (name.startsWith("struggle")) escapeAction(token);
    else voreAction(token);
  };

  const KNOWN = ["devour", "feed", "endo", "churn", "release", "struggle"];
  // Only the individual buttons run module actions. Using the feature itself lets dnd5e show its own
  // choice of activities, so nothing starts a Vore check by accident.
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    const item = activity?.item;
    if (!item?.getFlag?.(MODULE_ID, "devour")) return;
    const name = String(activity?.name ?? "").toLowerCase();
    if (!KNOWN.some((k) => name.startsWith(k))) return;
    if (Date.now() - last > 500) run(item, name);
    last = Date.now();
    return false;
  });
}
