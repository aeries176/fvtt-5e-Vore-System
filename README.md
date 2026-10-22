# Vore System (D&D 5e) — Foundry VTT v13 / dnd5e 5.x

Install: unzip into `Data/modules/vore-system`, enable it in your world. A GM must be logged in (state changes run on the GM client).

## Using it
- **Token config → Vore tab:** every Vore option and its sub-sections are collapsible.
- **Token config → Vore tab (GM):** per-option vision limit, tint/vignette, sound range/volumes, muffled chat, and up to 3 Vore options (name, prey image, digested image, internal/external sound, offset, scale).
- **Vore action:** use the Vore - Devour feature on your character (the GM also has the Vore check tool in Vore Controls) with the prey targeted. Predator and prey get chat buttons to roll Athletics or Acrobatics. Predator must win; ties favor the prey. Then the predator picks the Vore type and how digestion works.
- **Vore Controls:** all Vore actions have their own group in the scene controls. **GM Vore button:** select 2+ tokens, click the utensils tool in Vore Controls, pick the predator and type. No check.
- **Churn:** the Vore - Churn feature on a predator.
- **Release / Restore (GM):** the Release / Restore tool in Vore Controls on a vored or digested token.
- Prey cannot be moved by drag; they follow the predator's position, rotation and flip.

## Rules implemented
- Digestion damage and Churn are half acid, half bludgeoning (resistances apply to each half). If your dnd5e version rejects a split, it falls back to all acid.
- Predator turn start: death save (dying player prey) → digestion damage 1d6+CON, +1d6 per 5 levels.
- Prey turn start: opposed escape check; prey wins → moved to nearest free, wall-free tile and fully restored.
- Churn: 2d6+CON, +2d6 per 5 levels. Damage at 0 HP adds one death save failure; 3 failures (players) or 0 HP (non-players) → digested; predator heals 1/4 max HP and gains temp HP of 1/8.

## Settings
- Players can start Vore checks (toggle).
- Smooth attach: prey is drawn in lockstep with the predator on every client (turn off to fall back to delayed following).
- Auto-roll for NPCs.
- Predator heals on digestion (a world setting, on or off): 1/4 of the prey's max HP, plus temp HP equal to 1/8.
- Digestion damage is 1d6 + CON per predator turn and Churn is 2d6 + CON, with another die set every 5 levels.

## Per-option behavior (Vore tab)
Each Vore option sets: whether digested remains are left beside the predator or kept inside, Restrained and full cover while held (outsiders can't target held prey; the predator, the prey and the GM still can), and one-shot swallow / escape / digestion sounds. The combat tracker shows who is inside whom.

## Default prey token for Vore option 1
Option 1 uses `images/prey_belly.png` as its prey token image unless its own field (or the module setting) says otherwise.

## Default sounds for Vore option 1
Option 1 uses these unless its own fields (or the module settings) say otherwise: Digestion_New_2024.mp3 (loop), gulp3-hard.wav (swallow), Voiceless_BehindSpit_1.wav (escape/release), Stomach_Growl_Wet_004.wav (digestion). Change or clear them in the module settings.

## Demo sounds (`modules/vore-system/sounds/`)
Loops: `gurgle_loop`, `heartbeat_loop`, `slosh_loop`, `bubbling_loop`. One-shots: `swallow`, `escape_splash`, `digest_fizz`, `burp` (nice as a digestion sound). Synthesized placeholders; replace with your own via the Vore tab.

## Character sheet, compendium and inside experience
- **Vore features:** every player character automatically gets six features, Vore - Devour, Vore - Feed, Vore - Struggle, Vore - Churn, Vore - Release and Vore - Endo (the "Vore - " prefix keeps them together on the sheet). They run the module's actions for your selected token. For NPCs, or characters that lack them, drag them from the compendium onto the sheet. The world setting "Add Vore features to player characters" turns the automatic step off. They are also in the **Vore System** compendium (an editable world compendium the module creates the first time a GM loads the world, folder Character Features), along with 41 workshop Vore feats (folders: Predator Feats, Prey Feats) and 8 workshop subclasses, rules text only. Console: `game.modules.get("vore-system").api.seedPack()` re-adds anything missing without overwriting your edits.
- **Inside descriptions:** each Vore option has pools of private whispers for the prey's player: when swallowed, each predator turn, HP drops to 66% (stage 1) or 33% (stage 2), dying, and digested. One line per variant, chosen at random.
- **Inside channel:** `/inside message` (or `/in`) or the Whisper tool or status panel button, private between the predator, their prey and the GM.

## Feeding, forced release and Endo
- **Feed:** a prey token targets a predator and uses the Vore - Feed feature. The predator's player chooses Allow Feeding (picking the Vore type, how digestion works and whether to hide the prey token) or Resist Feeding. If resisted, the prey must beat the predator in a Vore check (ties favor the predator); on success the prey picks any of the predator's Vore options and the chat shows the prey's own force-feed text for that type. Setting: "Prey can feed themselves to predators".
- **Release prey** asks the prey's player: Allow Release releases them as normal; Resist Release makes the predator beat the prey in a Vore check (ties favor the prey) to force them out, using the option's forced-release message. A GM releasing prey with no player owner skips the prompt. The GM's Release / Restore tool still overrides everything.
- **Endo:** the Vore - Endo feature toggles it for any predator. While on, prey take no per-turn damage and the timed countdown pauses. Churn turns it off. Setting: "Allow Endo" (off prevents turning it on and ignores it).

## Secret Vore (GM)
Two extra Vore Controls buttons. **Secret Vore check:** select the predator, target the prey; the check card is GM-only and the target's player gets a private roll dialog. **Secret GM Vore:** select tokens, no check. Either way the prey token is hidden from everyone else, and the swallow/escape/release/digestion messages, check cards and sounds go only to the GM, the predator's owner and the prey's owner. Releasing the prey reveals them again.

## Screen art, defaults and the HUD
- Each Vore option can overlay stomach-interior art on the prey's screen: tick "Stomach interior art" for the built-in image (`images/stomach_interior.webp`, generated for this module) or pick your own image, with an opacity slider.
- World settings set the default prey and digested token images and the default loop, swallow, escape and digestion sounds for Vore option 1. They show in the Vore tab and fill empty slots on every token, including existing ones; saving a token never copies them in. They fill any empty slot, including on existing tokens.
- There are no Token HUD buttons any more. Players use their Vore features; the GM has every tool in Vore Controls.
- Timers take hours, minutes and seconds, and can skip death saves. All chosen per swallow (see below).

## Presets, copy/paste and safety tools
- **Copy / Paste / Save preset / Load preset / Export / Import** buttons sit at the top of each Vore option and of the whole Vore tab. Copy and Paste move a config between tokens in your browser. Presets are shared with the world (players can save them if they may edit the Vore tab; only the GM can delete). Export and Import use JSON, so presets can move between worlds. Loading fills the form; press Update to keep it. Two presets ship built in.
- **Reset Vore state (GM):** a button in Vore Controls frees every held or digested token in the scene and clears leftovers. Use it if anything gets stuck. API: `game.modules.get("vore-system").api.resetScene(sceneId)`.
- **Panic release:** a player whose token is digested selects it and clicks the life-ring tool in Vore Controls. The GM gets an Allow / Deny prompt; if allowed, the token is restored and placed back on the map. If the GM denies it, the player is told. If no GM is online, or the GM doesn't answer within 60 seconds, the release goes through automatically.
- **When a predator is downed:** setting to release prey, ask the GM, or leave them held (reacts to 0 HP or the dead status).
- **Timed digestion in combat:** each of the predator's turns moves the countdown forward 6 seconds (no per-turn damage roll for timed swallows).

## Gear handling (per Vore option)
Keep (nothing changes), Strip (armor, weapons and equipment are unequipped while held and re-equipped on release) or Slime (gear stays on; released prey get a Slimed effect for an hour: disadvantage on Stealth, advantage on escaping a grapple, applied by hand).

## Digestion stages (per Vore option)
At 66% HP and below (stage 1) and 33% HP and below (stage 2) a Vore option can swap the prey's token image, loop sound and screen effects. Empty fields keep the normal setting.

## Stomach rules (world setting, off by default)
Each predator has a stomach AC (default 10 + CON mod) and HP (default half max HP), both editable in the Vore tab. Prey use Strike from within (attack roll + damage) against it. Players see only the state of the wall. When the HP hits 0 everyone inside is released. This replaces the breakout-threshold rule while it is on. The module works fully without it.

## Subclasses and Endo-only
The compendium has workshop subclasses in a "Subclasses" folder. Oath of the Matron is flagged Endo-only: such a predator is always Endo, cannot Churn and can never digest.

## Timed digestion (chosen per swallow)
Whenever a predator swallows someone (capture success, accepted feeding, GM Vore), a dialog asks how digestion works: damage on each of the predator's turns, or a timer with hours/minutes/seconds, a clock (real time or Foundry world time) and an optional skip of death saves. Your last choice is remembered as the dialog's default. The GM's client runs the countdown and drains the prey's HP smoothly; HP-threshold descriptions fire as it falls and the digestion message/sound play at the end. In combat the clock pauses and instead moves forward 6 seconds on each of the predator's turns. Players stop at 0 HP and a death save card appears instead of being digested outright, unless death saves are skipped. A GM must be logged in; the clock catches up after a reload.

## Muffled chat
In-character messages spoken by a vored token are muffled for everyone but the predator's owner. The GM and the speaker see the real text plus an "Others hear:" line.

## Optional rules (world settings, all off by default)
- Size affects Vore checks (larger rolls with advantage; two sizes larger also gives the smaller disadvantage).
- Prey can strike from inside: "Strike from within" button; damage to the predator during a prey's turn (or within 2 minutes of pressing it) counts toward a breakout threshold, then the predator makes a Constitution save or releases everyone.

## Roll prompts
Each participant's owner gets a private dialog (Athletics/Acrobatics, Normal/Advantage/Disadvantage). Prey owners can also use the Vore - Struggle feature; predator owners get Vore - Churn and Vore - Release.

## Notes
- Config resolves as: defaults, then the actor's prototype token Vore tab, then any per-token overrides.
- Swallow message supports {predator} and {prey}.

Known unknowns (written without a live Foundry to test)
Token config tab injection, vision limiting (patches `Token#_getVisionSourceData`), and dnd5e 5.x roll signatures are the likeliest places to need a tweak.

## Stacked vore hearing
When prey are inside prey (A eats B eats C), chat and the inside whisper channel follow the layers: each token is heard by its own predator, by the prey it holds, and by the others in the same belly. So C is heard only by B (and C's bellymates), A hears only B, and B hears both. Everyone else gets the muffled text.

## Muffled speech
Muffled chat keeps the rhythm and sound of the speech without the words: each syllable is boiled down to a soft onset (lips, tongue or throat), a vowel colour and a closing sound, so the number of syllables, the capitals, SHOUTING, stutters, drawn-out words and punctuation all carry through. No sound effects are added. Now and then a message trails off into "…", and rarely (roughly one message in ten) a longer word nearly gets out before the muffling cuts it off, like "terri—mrrf". Every client hears exactly the same muffling for the same message. Example: "Help! Get me out of here, I can't breathe!" is heard as "Hehp! Hehp meh mmp ohf hehr, Mm hahp meh!".

## Vore Log (GM journal)
A GM-only journal called "Vore Log" is created automatically, with one page per scene and a timestamped line (plus the combat round, if any) for every swallow, release, restore and digestion. Secret Vore events are tagged "(secret)". Turn it off with the setting "Keep a Vore Log journal".

## Macros
The "Vore Macros" compendium holds ready-made hotbar macros: Vore Check, Feed, Escape, Churn, Release, Endo Toggle, Strike From Within, Panic Release, plus GM-only Vore (selected tokens) and Reset Scene. Control your token (and target when needed), then run them. They call the module's API, so they keep working across updates.

## Publishing and installing from a link
`tools/make-release.sh https://github.com/YOU/REPO` builds `release/vore-system.zip` (files at the zip root, as Foundry's installer expects) and a `release/module.json` stamped with the Manifest and Download URLs. Create a GitHub release tagged with the module's version, attach both files, and use `https://github.com/YOU/REPO/releases/latest/download/module.json` as the Manifest URL in Foundry's installer.

## Digestion effect: damage or healing
The swallow dialog also asks whether digestion damages the prey or heals them. Healing uses the same dice as digestion damage (and Churn heals too), nobody is digested or put on death saves, and a healing timer raises HP smoothly toward full instead of draining it.

## Muffled chat range
The world setting "Muffled chat range" (default 30, in scene units, 0 = no limit) limits how far a vored token's muffled voice carries. Players without a token that close see nothing. The GM, the speaker, their predator and their bellymates always hear it.

## The Vore tab
The Vore tab opens on General and shows one panel at a time: General (sound and chat, force-feed text, Stomach AC/HP, copy/paste/presets, the Vore features button) has its own button, and below the "Vore Options" heading are the option buttons, with + to add another Vore option (up to six, one per type). General holds the per-actor settings (sound distance, muffling, Stomach AC/HP, force-feed text, the Vore features button and whole-tab copy/paste). Each option has a Type (Oral, Anal, Breast, Cock, Unbirth or Tail) and Basics (open), Look, Sounds, Inside descriptions, Digestion stages and Advanced. New characters start with one option.

## Interface cleanup (v0.16)
- **One swallow dialog:** the Vore type, Damage/Healing and Per-turn/Timer choices are now one dialog (also used for Feed and the GM Vore tools). Timer fields only appear when Timer is picked. The chat card has a single "Choose how to swallow" button.
- **Vore Controls:** the GM has every tool. Players only see the group while one applies (Panic release when digested, Strike and Whisper when held or holding), because everything else is on their Vore features.
- **Vore status panel:** a small panel (per-player setting, collapsible) shows who holds you, the digestion mode and timer, your HP, and the actions that apply, or for predators the prey they hold with Churn/Release/Endo.
- **Settings are grouped** under headings: Who can do what, Digestion damage and healing, Rules, Chat and display, and Defaults for Vore option 1.
- **Quieter chat:** system lines use a lighter style and finished cards fold down to one line (click to expand).
- **Vore tab:** hints are now hover tooltips (the ? icons), stage effects use an override tick box ("Change this at this stage"), and renaming an option updates its button immediately.
- **Liquid sway** is now a light GPU transform animation instead of a heavy per-pixel filter, so it no longer hurts the framerate. Reduced-motion browsers skip it.

## Version 0.17 changes
- **Hiding prey tokens:** Secret Vore no longer hides the prey's token unless you tick "Hide prey token" in the swallow dialog (off by default). A predator with Hammerspace Stomach, Compression Belly, Stomach of Holding or Smuggler Within gets the box ticked automatically. GM tools can always hide. Hidden prey make no loop, swallow or digestion sounds until they are revealed.
- **Vore status panel:** now called "Vore Status", draggable by its title (double-click to reset), and starts away from the player list.
- **Settings:** dice, level-step and heal-amount settings are gone (the defaults above apply), and Digestion healing is a plain on/off.
- **Force-feed text:** written by the prey, per the predator's Vore type, in the General panel of their own Vore tab.
- **Digestion stages:** compact, with color pickers and sliders. Anything you leave the same as the option is saved as unchanged.
- The first tool in Vore Controls is now "Select Token" and supports drag/box selecting like Foundry's own select tool.

## Sound fading (v0.17.4)
Looping Vore sounds now fade smoothly with distance from the predator while anyone is moving, like an ambient sound: the volume follows the live position of the predator and of the listener's tokens (or the GM's view center) many times a second, with an ease-in/out curve, instead of jumping each time a token finishes moving. "When a predator is downed" now defaults to "Ask the GM" and "Auto-roll NPC" is off by default.

## Version 0.18 changes
- **Secret Vore sounds:** sounds now play for everyone unless the prey token is hidden. With "Hide prey token" off, a secret swallow is audible; hidden prey stay silent.
- **Reveal:** the GM has a "Reveal hidden prey" tool (eye icon in Vore Controls: selected tokens, or every hidden prey in the scene) and a Reveal button next to hidden prey in a predator's Vore Status. Revealed prey are visible, make sound, and the vore is no longer secret.
- **Swallow dialog:** the timer duration, clock and skip-death-saves fields now appear and disappear as soon as Timing changes (also in the Feeding request).
- **Live countdown:** the Vore Status panel and tracker badges count down in real time, not only when HP ticks. A predator's panel shows each prey's state, progress bar, time left and HP, the same as the prey sees.
- **Death saves:** outside combat the prompt repeats after every save until three successes or three failures. Three successes stabilize the prey at 1 HP and reset their saves; digestion then carries on (a timer starts over and the saves repeat when it runs out). Three failures digest them for good. Churn dropping a player to 0 outside combat now asks for the save too.

## Version 0.18.1
- The digestion timer now pauses while a combat is running on the scene (including combats not tied to a scene); each predator turn still adds 6 seconds.
- Three death-save successes now give the prey 1 HP and reset their saves instead of digesting them. A timed prey's countdown restarts, so the saves repeat at the end of the new timer.
- New world setting "Secret Vore sound distance" (default 10, 0 = normal): how far Vore sounds carry while a vore is secret but the token is not hidden.
