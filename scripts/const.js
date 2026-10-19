export const MODULE_ID = "vore-system";
export const SOCKET = `module.${MODULE_ID}`;

const blankStage = () => ({
  preyImg: "",
  sound: "",
  fxColor: "",
  fxStrength: "",
  fxDistortion: "",
  fxVignette: "",
  fxTint: "",
  fxPulse: "",
  fxLiquid: "",
  fxBlur: ""
});

const blankSlot = (label = "") => ({
  label,
  swallowMessage: "{predator} swallows {prey}.",
  forceFedMessage: "{prey} forces themselves down {predator}'s throat!", // prey feeds themselves to a resisting predator
  forceReleaseMessage: "{predator} is forced to release {prey}!", // predator is forced to let go of resisting prey
  gearMode: "keep", // "keep" | "strip" (unequip while held) | "slime" (gear stays, prey is Slimed on release)
  digestedPlacement: "adjacent", // "adjacent" = leave the digested token beside the predator, "inside" = keep it on the predator
  restrain: true,
  fullCover: true,
  swallowSound: "",
  escapeSound: "",
  digestSound: "",
  digestMessage: "{prey} has been digested.",
  limitVision: true, // prey sees only their own token while held
  // Private "inside" descriptions whispered to the prey's player. One line per variant; a random line is used.
  descSwallow: "",
  descRound: "",
  descHp75: "",
  descHp50: "",
  descHp25: "",
  descDying: "",
  descDigested: "",
  preyImg: "",
  digestedImg: "",
  sound: "",
  soundVolume: 0.6,
  offsetX: 0,
  offsetY: 0.35,
  scale: 1,
  // Screen effects for the prey's player. Any combination can be enabled.
  fxVignette: true,
  fxTint: false,
  fxPulse: false,
  fxLiquid: false,
  fxBlur: false,
  fxColor: "#7a1f2b",
  fxStrength: 0.35,
  fxDistortion: 0.4,
  fxBuiltinArt: false, // built-in stomach interior art as a screen overlay
  fxImage: "", // or your own overlay image
  fxImageOpacity: 0.5,
  // Digestion stages: overrides applied while the prey's HP is at or below 66% (stage 1) / 33% (stage 2).
  // Empty = keep the option's normal setting. Booleans use "" / "on" / "off".
  stage1: blankStage(),
  stage2: blankStage()
});

// Per-predator-token configuration (stored in token flags, edited in the "Vore" tab).
export const DEFAULT_CONFIG = {
  muffleChat: true,
  soundRange: 30,
  stomachAC: "", // used when "Stomach rules" is on. Empty = 10 + the predator's CON modifier
  stomachHP: "", // empty = half the predator's max HP
  slots: { 0: blankSlot("Oral"), 1: blankSlot(""), 2: blankSlot("") }
};
