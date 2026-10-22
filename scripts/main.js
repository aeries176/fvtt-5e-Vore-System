import { MODULE_ID } from "./const.js";
import { initSocket } from "./socket.js";
import { registerVoreHooks, startVore, release, digest, ensureVoredStatus } from "./vore.js";
import { registerCardHandlers } from "./cards.js";
import { registerCombatHooks } from "./combat.js";
import { registerUIHooks, voreAction, churnAction, releaseAction, escapeAction, feedAction, endoAction, panicAction, manualVore, strikeAction } from "./ui.js";
import { ensureMacroPack } from "./macros.js";
import { registerPanel } from "./panel.js";
import { registerSettingsUI } from "./settingsui.js";
import { registerExtras } from "./extras.js";
import { registerInside } from "./inside.js";
import { registerStrike } from "./strike.js";
import { registerTimed } from "./timed.js";
import { registerStomach } from "./stomach.js";
import { registerSafety, resetScene } from "./safety.js";
import { registerPresets } from "./presets.js";
import { addDevourFeature, addVoreActions, ensurePack, registerDevourHooks, registerFeatureHooks, ensureActorFeatures } from "./devour.js";
import { registerAttachHooks, setSmoothAttach } from "./attach.js";
import { patchVision, registerFXHooks, registerMuffleHooks, syncFX } from "./fx.js";

Hooks.once("init", () => {
  ensureVoredStatus();

  game.settings.register(MODULE_ID, "playersCanVore", {
    name: "VORE.Settings.PlayersVore.Name",
    hint: "VORE.Settings.PlayersVore.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "playersEditConfig", {
    name: "VORE.Settings.PlayersEdit.Name",
    hint: "VORE.Settings.PlayersEdit.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "smoothAttach", {
    name: "VORE.Settings.Smooth.Name",
    hint: "VORE.Settings.Smooth.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => setSmoothAttach(value)
  });

  game.settings.register(MODULE_ID, "sizeMatters", {
    name: "VORE.Settings.Size.Name",
    hint: "VORE.Settings.Size.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "preyStrikeBack", {
    name: "VORE.Settings.Strike.Name",
    hint: "VORE.Settings.Strike.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "breakoutThreshold", {
    name: "VORE.Settings.Threshold.Name",
    hint: "VORE.Settings.Threshold.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 20
  });
  game.settings.register(MODULE_ID, "breakoutDC", {
    name: "VORE.Settings.DC.Name",
    hint: "VORE.Settings.DC.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 15
  });

  game.settings.register(MODULE_ID, "digestHeal", {
    name: "VORE.Settings.DigestHeal.Name",
    hint: "VORE.Settings.DigestHeal.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "allowEndo", {
    name: "VORE.Settings.Endo.Name",
    hint: "VORE.Settings.Endo.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "allowFeeding", {
    name: "VORE.Settings.Feeding.Name",
    hint: "VORE.Settings.Feeding.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "packVersion", { scope: "world", config: false, type: Number, default: 0 });

  game.settings.register(MODULE_ID, "stomachRules", {
    name: "VORE.Settings.Stomach.Name",
    hint: "VORE.Settings.Stomach.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "muffleRange", {
    name: "VORE.Settings.MuffleRange.Name",
    hint: "VORE.Settings.MuffleRange.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 30
  });
  game.settings.register(MODULE_ID, "secretSoundRange", {
    name: "VORE.Settings.SecretSoundRange.Name",
    hint: "VORE.Settings.SecretSoundRange.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 10
  });
  game.settings.register(MODULE_ID, "autoAddFeatures", {
    name: "VORE.Settings.AutoFeatures.Name",
    hint: "VORE.Settings.AutoFeatures.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "voreLog", {
    name: "VORE.Settings.Log.Name",
    hint: "VORE.Settings.Log.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "macroPackVersion", { scope: "world", config: false, type: Number, default: 0 });
  game.settings.register(MODULE_ID, "defaultPreyImg1", {
    name: "VORE.Settings.DefPrey1.Name",
    hint: "VORE.Settings.DefPrey1.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "modules/vore-system/images/prey_belly.png",
    filePicker: "imagevideo"
  });
  game.settings.register(MODULE_ID, "defaultDigestedImg1", {
    name: "VORE.Settings.DefDig1.Name",
    hint: "VORE.Settings.DefDig1.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "imagevideo"
  });

  game.settings.register(MODULE_ID, "defaultSound1", {
    name: "VORE.Settings.DefSound1.Name",
    hint: "VORE.Settings.DefSound1.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "modules/vore-system/sounds/Digestion_New_2024.mp3",
    filePicker: "audio"
  });
  game.settings.register(MODULE_ID, "defaultSwallowSound1", {
    name: "VORE.Settings.DefSwallow1.Name",
    hint: "VORE.Settings.DefSwallow1.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "modules/vore-system/sounds/gulp3-hard.wav",
    filePicker: "audio"
  });
  game.settings.register(MODULE_ID, "defaultEscapeSound1", {
    name: "VORE.Settings.DefEscape1.Name",
    hint: "VORE.Settings.DefEscape1.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "modules/vore-system/sounds/Voiceless_BehindSpit_1.wav",
    filePicker: "audio"
  });
  game.settings.register(MODULE_ID, "defaultDigestSound1", {
    name: "VORE.Settings.DefDigestSnd1.Name",
    hint: "VORE.Settings.DefDigestSnd1.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "modules/vore-system/sounds/Stomach_Growl_Wet_004.wav",
    filePicker: "audio"
  });

  game.settings.register(MODULE_ID, "predatorDowned", {
    name: "VORE.Settings.Downed.Name",
    hint: "VORE.Settings.Downed.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: { release: "Release everyone inside", ask: "Ask the GM", stuck: "Leave them held" },
    default: "ask"
  });
  game.settings.register(MODULE_ID, "presets", { scope: "world", config: false, type: Object, default: {} });

  game.settings.register(MODULE_ID, "autoRollNPC", {
    name: "VORE.Settings.AutoRoll.Name",
    hint: "VORE.Settings.AutoRoll.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });


  registerVoreHooks();
  registerCombatHooks();
  registerUIHooks();
  registerFXHooks();
  registerAttachHooks();
  registerExtras();
  registerMuffleHooks();
  registerInside();
  registerPanel();
  registerFeatureHooks();
  registerSettingsUI();
});

// The dnd5e system may rebuild CONFIG.statusEffects after init, so make sure ours survives.
Hooks.once("setup", ensureVoredStatus);

Hooks.once("ready", () => {
  ensureVoredStatus();
  initSocket();
  registerCardHandlers();
  registerStrike();
  registerStomach();
  registerSafety();
  registerPresets();
  registerTimed();
  registerDevourHooks({ voreAction, churnAction, releaseAction, escapeAction, feedAction, endoAction });
  patchVision();
  game.modules.get(MODULE_ID).api = { voreAction, feedAction, escapeAction, endoAction, releaseAction, panicAction, strikeAction, manualVore, churnAction, startVore, release, digest, syncFX, resetScene, addDevourFeature, addVoreActions, seedPack: () => ensurePack({ force: true }) };
  syncFX();
  if (game.users.activeGM?.id === game.user.id) {
    ensurePack();
    ensureMacroPack();
    ensureActorFeatures();
  }
});
