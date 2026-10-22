export const MODULE_ID = "vore-system";
export const SOCKET = `module.${MODULE_ID}`;

export const TYPES = ["Oral", "Anal", "Breast", "Cock", "Unbirth", "Tail"];
export const MAX_SLOTS = TYPES.length;

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
  descHp66: "", // stage 1
  descHp33: "", // stage 2
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
  // What this character says when they force themselves into a predator, keyed by the predator's Vore type.
  forceFed: {
    Oral: "{prey} forces themselves down {predator}'s throat!",
    Anal: "{prey} forces themselves into {predator}.",
    Breast: "{prey} forces themselves into {predator}.",
    Cock: "{prey} forces themselves into {predator}.",
    Unbirth: "{prey} forces themselves into {predator}.",
    Tail: "{prey} forces themselves into {predator}'s tail."
  },
  slots: { 0: blankSlot("Oral"), 1: blankSlot(""), 2: blankSlot(""), 3: blankSlot(""), 4: blankSlot(""), 5: blankSlot("") }
};
