import { MODULE_ID } from "./const.js";
import { FEATS, SUBCLASSES, FOLDERS, RETIRED, featData, featDescription, subclassData, subclassDescription } from "./feats.js";

export const PACK_VERSION = 7; // bump when new compendium entries are added

export const FEATURE_NAME = "Vore Actions"; // the old single feature; replaced by the six below
export const FEATURES_VERSION = 1; // bump to add or change the actor features below

const FEATURES = [
  { key: "devour", name: "Vore - Devour", activity: "Devour", html: "<p>Target a creature and start the opposed Athletics/Acrobatics Vore check to swallow them. The predator must win; ties go to the prey.</p>" },
  { key: "feed", name: "Vore - Feed", activity: "Feed", html: "<p>Target a predator and offer yourself to them. They may allow it or resist; if they resist, you must win a Vore check, and then you choose how.</p>" },
  { key: "struggle", name: "Vore - Struggle", activity: "Struggle", html: "<p>While you are swallowed, make an opposed check against your predator to break free.</p>" },
  { key: "churn", name: "Vore - Churn", activity: "Churn", html: "<p>Spend an action to churn the prey you hold, dealing extra digestion damage (or healing, if you chose healing). Ends Endo.</p>" },
  { key: "release", name: "Vore - Release", activity: "Release", html: "<p>Offer to let the prey you hold go. They may allow it or resist; if they resist, you must win a check to force them out.</p>" },
  { key: "endo", name: "Vore - Endo", activity: "Endo", html: "<p>Toggle Endo: while it is on, the prey you hold takes no digestion damage and makes no death saves.</p>" }
];

const activityData = (name) => ({ type: "utility", name, activation: { type: "action", value: 1 } });

/** Item data for one Vore action feature, with its single activity built in. */
export function voreFeatureData(f) {
  const _id = foundry.utils.randomID();
  return {
    name: f.name,
    type: "feat",
    img: `modules/${MODULE_ID}/icons/vored.svg`,
    system: { description: { value: f.html }, activities: { [_id]: { _id, ...activityData(f.activity) } } },
    flags: { [MODULE_ID]: { voreAction: f.key } }
  };
}
export const voreFeaturesData = () => FEATURES.map(voreFeatureData);

/** Give an actor the six Vore action features (and remove the old combined "Vore Actions" one). */
export async function addVoreActions(actor, { quiet = false } = {}) {
  if (!actor) return ui.notifications.warn("This token has no actor to add a feature to.");
  try {
    const old = actor.items.filter((i) => i.getFlag(MODULE_ID, "devour") && !i.getFlag(MODULE_ID, "voreAction")).map((i) => i.id);
    if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
    const have = new Set(actor.items.map((i) => i.getFlag(MODULE_ID, "voreAction")).filter(Boolean));
    const missing = FEATURES.filter((f) => !have.has(f.key)).map(voreFeatureData);
    if (missing.length) await actor.createEmbeddedDocuments("Item", missing);
    await actor.setFlag(MODULE_ID, "featuresVersion", FEATURES_VERSION);
    if (!quiet) ui.notifications.info(`${actor.name} has the Vore action features.`);
  } catch (e) {
    console.warn("vore-system | could not add Vore actions", e);
    if (!quiet) ui.notifications.warn("Couldn't add the Vore features. Check the console.");
  }
}
export const addDevourFeature = addVoreActions; // old API name

/** Every player character gets the Vore action features once (a character you remove them from isn't re-added). */
export async function ensureActorFeatures() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (!game.settings.get(MODULE_ID, "autoAddFeatures")) return;
  for (const actor of game.actors) {
    if (actor.type !== "character" || (Number(actor.getFlag(MODULE_ID, "featuresVersion")) || 0) >= FEATURES_VERSION) continue;
    await addVoreActions(actor, { quiet: true });
  }
}

export function registerFeatureHooks() {
  Hooks.on("createActor", (actor, options, userId) => {
    if (userId !== game.user.id || actor.type !== "character" || !game.settings.get(MODULE_ID, "autoAddFeatures")) return;
    addVoreActions(actor, { quiet: true });
  });
}

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
    // The folder for the six Vore features was first called "Vore Actions".
    const renamed = pack.folders.find((f) => f.name === "Vore Actions");
    if (renamed && !pack.folders.find((f) => f.name === "Character Features")) await renamed.update({ name: "Character Features" });
    for (const name of ["Character Features", ...FOLDERS]) {
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
    // The old single "Vore Actions" feature is replaced by six separate ones.
    const oldCombined = byName.get(FEATURE_NAME);
    if (oldCombined?.getFlag(MODULE_ID, "devour") && !oldCombined.getFlag(MODULE_ID, "voreAction")) await oldCombined.delete();
    for (const f of FEATURES) if (!byName.has(f.name)) toCreate.push({ ...voreFeatureData(f), folder: folderIds["Character Features"] });
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
        update[`flags.${MODULE_ID}.hidesPrey`] = !!feat.hidesPrey;
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

/** Make the Vore action features run the module's actions instead of posting a normal item card. */
export function registerDevourHooks({ voreAction, churnAction, releaseAction, escapeAction, feedAction, endoAction }) {
  let last = 0;
  const actions = { devour: voreAction, feed: feedAction, struggle: escapeAction, churn: churnAction, release: releaseAction, endo: endoAction };

  Hooks.on("dnd5e.preUseActivity", (activity) => {
    const key = activity?.item?.getFlag?.(MODULE_ID, "voreAction");
    const run = actions[key];
    if (!run) return;
    const actor = activity.item.actor;
    const token =
      canvas.tokens?.controlled.find((t) => t.actor?.id === actor?.id)?.document ?? actor?.getActiveTokens(true, true)[0];
    if (!token) ui.notifications.warn("Place or select this character's token first.");
    else if (Date.now() - last > 500) run(token);
    last = Date.now();
    return false;
  });
}
