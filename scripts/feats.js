import { MODULE_ID } from "./const.js";

const p = (...lines) => lines.map((l) => `<p>${l}</p>`).join("");

/** Workshop feats shipped in the "Vore System" compendium. Rules text only; edit freely. */
export const FEATS = [
  // ---- Predator ----
  {
    name: "Bottomless",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "<em>Prerequisite: Constitution 13 or higher.</em>",
      "You have no practical limit on the size of creature you can swallow, and a swallowed creature never makes you slower or clumsier.",
      "When the optional size rule is on, you ignore any Vore check disadvantage from being the smaller creature, and you have advantage against a creature of your size or smaller.",
      "Increase your Constitution score by 1, to a maximum of 20."
    )
  },
  {
    name: "Gulp Reflex",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "When a creature within 5 feet misses you with a melee attack, you can use your reaction to snap at it and start a Vore check against it.",
      "You can use this reaction a number of times equal to your proficiency bonus, regaining all uses on a long rest."
    )
  },
  {
    name: "Swallow Whole",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "You win ties on Vore checks you start.",
      "While you hold one or more creatures, you have a -2 penalty to attack rolls and to Dexterity (Stealth) checks, because it is hard to look casual with a bulge in your belly."
    )
  },
  {
    name: "Slow Cooker",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "You prefer your meals tender. If a Vore option uses timed digestion, its timer runs at half speed for you.",
      "At the start of each of your turns, each creature you hold gains temporary hit points equal to your proficiency bonus. This does not stack with itself.",
      "This pairs well with Endo."
    )
  },
  {
    name: "Lullaby",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "As a bonus action, you can hum, sing or rumble a soothing tune from inside your chest. Until the start of your next turn, creatures you hold have disadvantage on escape checks and on Strength-based attacks against you.",
      "A creature that is charmed or unconscious is also subject to the effect of the <em>sleep</em> spell (no save) if its hit points are at or below your level."
    )
  },
  {
    name: "Hunger Pangs",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "At the start of each of your turns, if you are not holding anyone, you have advantage on Vore checks you make against creatures within 10 feet until the end of that turn.",
      "Your stomach growls loudly. Creatures within 30 feet can hear it, which can give away your position."
    )
  },
  {
    name: "Regurgitate Projectile",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "As an action, you can spit out one creature you hold at a point you can see within 30 feet. It lands prone, takes 2d6 bludgeoning damage and is released in the nearest open space to that point. It is covered in slime until it spends an action cleaning itself.",
      "A willing creature takes no damage. You can't use this feature again until you finish a short or long rest."
    )
  },
  // ---- Prey ----
  {
    name: "Slippery",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "You have advantage on escape checks. When you escape, you are placed up to 10 feet from the predator, and your movement does not provoke opportunity attacks this turn.",
      "While you are slimed or wet, you also have advantage on checks to avoid being grappled."
    )
  },
  {
    name: "Gourmet's Dilemma",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "While you are held, you can use your action to whisper a taunt, a bribe, or a very convincing argument to the predator. The predator makes a Wisdom saving throw (DC 8 + your proficiency bonus + your Charisma modifier). On a failure, it turns Endo on until the end of its next turn.",
      "You can't use this feature again until you finish a short or long rest."
    )
  },
  {
    name: "Indigestible",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "You taste terrible once someone gets past the first bite. If a creature digests you, it takes 4d6 poison damage and is poisoned for 1 hour. You come back none the worse for it after a long rest, if the GM allows.",
      "You have advantage on saving throws against poison and acid while held."
    )
  },
  {
    name: "Tickle Fight",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "When you use Strike from Within, your blows are mostly flailing and a lot of wiggling. Instead of weapon damage, you deal 1d6 psychic damage plus your proficiency bonus.",
      "A predator that takes damage this way must succeed on a Constitution saving throw (DC 8 + your proficiency bonus + your Dexterity modifier) or burst out laughing and release you."
    )
  },
  {
    name: "Willing Snack",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "You never need to be asked: your owner may answer \"Allow Feeding\" and \"Allow Release\" on your behalf at any time.",
      "For every full hour you spend held while Endo is on, you gain 1 level of well-rested comfort. You can spend a level to regain 1d6 hit points, to end one condition, or to gain advantage on one saving throw. You can store up to your proficiency bonus in levels."
    )
  },
  // ---- Predator (round 2) ----
  {
    name: "Belly Rub",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "As an action, you or an ally within 5 feet can give your belly a good rub. Until the start of your next turn, creatures you hold have disadvantage on escape checks, and you gain temporary hit points equal to twice your proficiency bonus.",
      "You can benefit from this feature once per turn."
    )
  },
  {
    name: "Food Coma",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "Each time you digest a creature, you gain one Full Belly charge (up to your proficiency bonus).",
      "When you finish a short rest or a long rest, you can spend one Full Belly charge, no matter how long ago you digested the creature. You can spend only one charge per rest. You spend the first 10 minutes of that rest asleep and unaware, and in return you gain the following benefit:",
      "<strong>Short rest:</strong> each Hit Die you spend heals you for double the amount rolled.",
      "<strong>Long rest:</strong> you regain all of your spent Hit Dice instead of half, and you gain temporary hit points equal to your level."
    )
  },
  {
    name: "Sweet Talker",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "As an action, you can make a Charisma (Persuasion) check against a creature within 30 feet that can hear and understand you. The target opposes with Wisdom (Insight).",
      "On a success, the target has disadvantage on Vore and escape checks against you for 1 minute, and if it decides to Feed itself to you, it does not need to make any check. On a failure, the target is aware you were trying to charm it.",
      "A creature that is immune to being charmed is not affected."
    )
  },
  {
    name: "Hungry Eyes",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "As a bonus action, you can lock eyes with a creature within 30 feet that can see you. It must succeed on a Wisdom saving throw (DC 8 + your proficiency bonus + your Constitution modifier) or become frightened of you until the end of your next turn.",
      "You can use this feature a number of times equal to your proficiency bonus, regaining all uses on a long rest."
    )
  },
  {
    name: "Greedy Gulp",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "When you start a Vore check, you can target up to two creatures at once. You make the Vore check with disadvantage. You succeed against each creature whose check you beat.",
      "Each creature you catch this way is swallowed into the same Vore option. The GM can restrict multi-target Vore checks to creatures with this feat."
    )
  },
  {
    name: "Satisfied Purr",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "After you digest a creature, you give off a warm, contented aura for 1 hour. You and every ally within 10 feet of you has advantage on saving throws against being frightened or charmed.",
      "A new digestion refreshes the duration. It does not stack."
    )
  },
  {
    name: "Thunderous Belch",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "When you finish digesting a creature, you can let out a mighty belch (no action required). Each creature in a 10-foot cone must make a Constitution saving throw (DC 8 + your proficiency bonus + your Constitution modifier), taking 2d8 thunder damage on a failed save, or half as much on a successful one.",
      "The belch can be heard clearly by creatures within 300 feet of you."
    )
  },
  {
    name: "Hammerspace Stomach",
    group: "Predator",
    folder: "Predator Feats",
    hidesPrey: true,
    html: p(
      "<em>Your stomach opens onto a space that is bigger than you are.</em>",
      "Creatures you swallow are carried in that space instead of your body. While they are inside, their tokens are hidden from everyone but you, them and the GM, and nothing about your size or shape shows what you are holding.",
      "You can hold up to twice as many creatures as normal before you start to slow down, and creatures inside you can't tell where in the space the others are unless you allow it."
    )
  },
  {
    name: "Compression Belly",
    group: "Predator",
    folder: "Predator Feats",
    hidesPrey: true,
    html: p(
      "<em>Whatever you swallow folds down until it is hardly there.</em>",
      "Creatures you swallow are compressed and carried invisibly: their tokens are hidden from everyone but you, them and the GM, and you do not look any larger for it.",
      "A creature inside you is compressed to a tiny size. It has disadvantage on checks that rely on moving or reaching, but also has advantage on saving throws against being crushed or squeezed. You can release any creature you hold as a bonus action."
    )
  },
  {
    name: "Stomach of Holding",
    group: "Predator",
    folder: "Predator Feats",
    hidesPrey: true,
    v: 2,
    html: p(
      "As an action, you can swallow an object you can hold. Objects swallowed with this feat are never digested, damaged or lost, no matter how long they stay inside you.",
      "You can hold items totaling up to your Constitution score in pounds. As a bonus action, you can bring any held item back up into your hand. Creatures inside you can't reach these items unless you allow it.",
      "Creatures you swallow are hidden along with them: their tokens vanish from the map for everyone but you, them and the GM."
    )
  },
  {
    name: "Bellyhome",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "While Endo is on, a willing creature you hold can finish a long rest in only 4 hours. A creature that rests this way gains the benefits of a long rest as normal and can do light activity, such as reading or casting a cantrip, for the rest of the time.",
      "While you host a resting creature, your walking speed is halved."
    )
  },
  {
    name: "Soul Sip",
    group: "Predator",
    folder: "Predator Feats",
    html: p(
      "When you digest a creature, you can recall one of its memories, one language it knew, or one skill proficiency it had. You keep the language or proficiency until you finish a long rest. You can know one such thing at a time.",
      "The memory can be of anything the creature experienced, determined by the GM."
    )
  },
  // ---- Prey (round 2) ----
  {
    name: "Lap of Luxury",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "While you are held with Endo on, you regain one Hit Die of hit points at the start of each of your turns (roll it and add your Constitution modifier). You can regain hit points this way a number of times equal to your proficiency bonus, then you must finish a long rest."
    )
  },
  {
    name: "Gutslut",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "You really don't want to leave. You have advantage on checks to resist Release and on your escape checks if you choose to stay, and the predator has disadvantage on checks to force you out.",
      "While you are held, as a bonus action you can cling on: until the start of your next turn, you can't be forced out and your Resist Release checks gain a bonus equal to your proficiency bonus."
    )
  },
  {
    name: "Squirm",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "While you are held, as a bonus action you can squirm and wriggle. The predator must make a Constitution saving throw (DC 8 + your proficiency bonus + your Dexterity modifier) or lose its reaction until the end of its next turn.",
      "You can use this feature a number of times equal to your proficiency bonus, regaining all uses on a long rest."
    )
  },
  {
    name: "Teasing Prey",
    group: "Prey",
    folder: "Prey Feats",
    html: p(
      "You can use Charisma (Performance) instead of Athletics or Acrobatics for your escape checks, provided you can describe, in character, how you are teasing the predator.",
      "A predator that fails an escape check against you by 5 or more can't take reactions until the start of its next turn."
    )
  },
  // ---- Hostile stomachs (prey vs digestion) ----
  {
    name: "Acid-Washed Skin",
    group: "Hostile Stomach",
    folder: "Prey Feats",
    v: 2,
    html: p(
      "While you are held, you have resistance to digestion damage: it is halved, rounded down."
    )
  },
  {
    name: "Last Gasp",
    group: "Hostile Stomach",
    folder: "Prey Feats",
    html: p(
      "When you would be digested, you instead stay at 1 hit point and the predator must succeed on a Constitution saving throw (DC 8 + your proficiency bonus + your Constitution modifier). On a failure, it is forced to release you.",
      "You can't use this feature again until you finish a long rest."
    )
  },
  {
    name: "Frenzied Struggle",
    group: "Hostile Stomach",
    folder: "Prey Feats",
    replaces: "Knife in the Gut",
    v: 2,
    html: p(
      "You lash out with everything you have. When you use Strike from Within, damage you deal to the predator, of any damage type, counts as 1.5 times its value toward the breakout threshold and ignores the predator's resistances."
    )
  },
  {
    name: "Bitter Pill",
    group: "Hostile Stomach",
    folder: "Prey Feats",
    v: 2,
    html: p(
      "When a predator Churns you, you become hard to keep down. For the next minute, at the start of each of the predator's turns, it must succeed on a Constitution saving throw (DC 8 + your proficiency bonus + your Constitution modifier) or release you."
    )
  },
  {
    name: "Dead Weight",
    group: "Hostile Stomach",
    folder: "Prey Feats",
    html: p(
      "As a bonus action while held, you make yourself as heavy as you can. Until the start of your next turn, the predator's speed is halved and it has disadvantage on Dexterity saving throws."
    )
  },
  {
    name: "Miraculous Reformation",
    group: "Hostile Stomach",
    folder: "Prey Feats",
    replaces: "Reconstituted",
    v: 2,
    html: p(
      "You can pull yourself back together whenever you choose, including while you are still inside a predator.",
      "<strong>After being digested:</strong> you regain consciousness with 1 hit point, no exhaustion and your equipment intact, wherever your remains are.",
      "<strong>While still inside the predator:</strong> you can use your action to nullify digestion for 2 hours. During that time you take no digestion damage, can't be digested, and the predator can't Churn you.",
      "You can use this feature as often as you like."
    )
  },
  // ---- Weird ----
  {
    name: "Echo Chamber",
    group: "Weird",
    folder: "Prey Feats",
    html: p(
      "Everyone held inside the same predator can speak privately with one another and with the predator, as if over the inside channel, even if they are separated by several stomachs.",
      "You can also pick up what the predator is hearing. Once per turn, you can make a Wisdom (Perception) check against sounds near the predator as though you were standing next to it."
    )
  },
  {
    name: "Stomach Mage",
    group: "Weird",
    folder: "Prey Feats",
    html: p(
      "You can cast spells that require only verbal components while you are held, though the words come out as muffled mumbles to everyone else.",
      "You are immune to the acid damage of digestion while you maintain concentration on a spell."
    )
  },
  {
    name: "Symbiote",
    group: "Weird",
    folder: "Predator Feats",
    html: p(
      "<em>Choose one willing partner when you take this feat. The partner must also be a creature who can be the predator or the prey.</em>",
      "While you and your partner are in a Vore relationship, you share a pool of hit points equal to the larger of your maximums, and damage and healing apply to the pool. Either of you can lend spell slots to the other as a bonus action.",
      "When you are separated for more than 24 hours, the pool is split back into two."
    )
  },
  {
    name: "Gastric Archivist",
    group: "Weird",
    folder: "Predator Feats",
    html: p(
      "Your stomach keeps a record of everything it has digested. Keep a list of the creature types you have digested.",
      "For each creature type on your list, you have advantage on saving throws against abilities from creatures of that type, and you gain a +1 bonus to Wisdom (Insight) checks against them, up to a +5 bonus."
    )
  },
  {
    name: "In it Together",
    group: "Weird",
    folder: "Prey Feats",
    html: p(
      "While two or more allies are held inside the same predator, each of them can use its action to help another's escape check (that check has advantage).",
      "If two or more of them use Strike from Within in the same round, the damage they deal counts double toward the breakout threshold."
    )
  },
  {
    name: "Soothing Presence",
    group: "Weird",
    folder: "Prey Feats",
    v: 2,
    html: p(
      "<em>This feat works only between a predator and the prey it holds.</em>",
      "If the predator or the prey it is holding is frightened or charmed, the other can use its action to make a Charisma (Persuasion) check against the effect's save DC (or DC 12 if there is none). On a success, the condition ends on the affected creature, as though that creature had succeeded on its saving throw.",
      "You can take this feat as either the predator or the prey; it works for both ends of any Vore relationship you are in."
    )
  },
  {
    name: "Tummy Rumble",
    group: "Weird",
    folder: "Predator Feats",
    html: p(
      "While you hold a creature, your stomach rumbles and burbles loudly within 30 feet. Creatures that can hear it have advantage on Wisdom (Perception) checks to find you, and you have advantage on Charisma (Intimidation) checks against anyone who knows what it is.",
      "If you choose, you can make the noise sound like a cheerful purr instead of a growl. In that case, creatures that can hear you have disadvantage on Wisdom (Insight) checks to see through your disguise."
    )
  }
];

export const RETIRED = ["Hostile Navigator"];
export const FOLDERS = ["Predator Feats", "Prey Feats", "Subclasses"];
export const featDescription = (feat) => `<p><em>Vore feat (${feat.group}). Workshop draft.</em></p>${feat.html}`;

export function featData(feat) {
  return {
    name: feat.name,
    type: "feat",
    img: `modules/${MODULE_ID}/icons/vored.svg`,
    system: { description: { value: featDescription(feat) }, type: { value: "feat" } },
    flags: { [MODULE_ID]: { feat: true, group: feat.group, v: feat.v ?? 1, hidesPrey: !!feat.hidesPrey } }
  };
}

/** Workshop subclasses. Features are written out as rules text; add them to the sheet by hand as you level. */
export const SUBCLASSES = [
  {
    name: "Circle of the Maw",
    classIdentifier: "druid",
    html: p(
      "<em>Druids of the Maw see the world as an endless meal and shape themselves into the creatures that do the eating.</em>",
      "<strong>Circle Spells (level 2).</strong> You always have <em>fog cloud</em>, <em>grease</em> (level 3), <em>stinking cloud</em> (level 5), <em>acid arrow</em> (level 3) and <em>plant growth</em> (level 5) prepared, and they don't count against your prepared spells.",
      "<strong>Gaping Shape (level 2).</strong> When you use Wild Shape, you can take a form that is able to swallow. While in that form, you can start a Vore check as part of your attack action, and you have advantage on it against a creature smaller than you.",
      "<strong>Mindful Meal (level 6).</strong> While you are in a Wild Shape form, you can turn Endo on or off as a bonus action. Creatures held in your Wild Shape take no damage from the transformation ending, and you can choose to release them when you revert.",
      "<strong>Hollow Stomach (level 10).</strong> Your stomach in beast form counts as magical. Creatures inside have disadvantage on escape checks against you, and you ignore resistance to acid damage.",
      "<strong>Great Digestion (level 14).</strong> When you digest a creature in beast form, you regain hit points equal to your druid level and can immediately Wild Shape without spending a use."
    )
  },
  {
    name: "Gastromancer",
    classIdentifier: "wizard",
    html: p(
      "<em>The School of Gastromancy treats the stomach as a spellbook: every meal teaches something.</em>",
      "<strong>Gastromancy Savant (level 2).</strong> Copying a spell relating to digestion, acid, hunger, poison or nausea costs half the usual gold and time.",
      "<strong>Hunger Magic (level 2).</strong> When you cast a spell that deals acid or poison damage, you can make a creature that fails its save hungry and distracted: it has disadvantage on its next attack roll before the end of your next turn.",
      "<strong>Well-Fed Caster (level 6).</strong> After you digest a creature, you regain one expended spell slot of a level up to half your proficiency bonus (rounded up). Once per long rest.",
      "<strong>Stomach Sanctum (level 10).</strong> Creatures you hold can't be targeted by spells from outside, and you can cast spells that require a verbal component without speaking aloud while holding someone.",
      "<strong>Alimentary Mastery (level 14).</strong> You can cast <em>stinking cloud</em> without a slot a number of times equal to your Intelligence modifier, and your digestion damage dice are one size larger."
    )
  },
  {
    name: "Hollow Hunger",
    classIdentifier: "warlock",
    html: p(
      "<em>Your patron is a vast, patient stomach that was old before the stars were lit.</em>",
      "<strong>Expanded Spell List.</strong> <em>false life</em>, <em>ray of sickness</em> (level 1); <em>acid arrow</em>, <em>silence</em> (level 3); <em>stinking cloud</em>, <em>hunger of hadar</em> (level 5); <em>polymorph</em>, <em>blight</em> (level 7); <em>cloudkill</em>, <em>contagion</em> (level 9).",
      "<strong>Gift of the Gullet (level 1).</strong> You can start a Vore check as a bonus action. You gain temporary hit points equal to your warlock level when you swallow a creature.",
      "<strong>Endless Appetite (level 6).</strong> You can hold any number of creatures. While you hold at least one creature, you can't be frightened.",
      "<strong>Patron's Pantry (level 10).</strong> As an action, you can swallow a weapon or small object you can see within 30 feet. It is delivered to your patron and returned to you at the end of your next turn.",
      "<strong>Feast of the Void (level 14).</strong> When you digest a creature, you can force each creature within 10 feet to make a Wisdom saving throw or be frightened of you until the end of your next turn."
    )
  },
  {
    name: "Feast Domain",
    classIdentifier: "cleric",
    html: p(
      "<em>The Feast Domain celebrates bounty, hunger sated and the warmth of a full belly.</em>",
      "<strong>Domain Spells.</strong> <em>goodberry</em>, <em>bless</em> (level 1); <em>enhance ability</em>, <em>lesser restoration</em> (level 3); <em>create food and water</em>, <em>plant growth</em> (level 5); <em>death ward</em>, <em>guardian of faith</em> (level 7); <em>heal</em>, <em>mass cure wounds</em> (level 9).",
      "<strong>Blessing of the Table (level 1).</strong> You gain proficiency with cook's utensils. When you cast a spell that restores hit points, a creature you hold in Endo also gains temporary hit points equal to your Wisdom modifier.",
      "<strong>Channel Divinity: Hearty Meal (level 2).</strong> As an action, you can feed allies within 30 feet a magical meal. They gain temporary hit points equal to 5 + your cleric level and advantage on saving throws against being frightened until the end of your next turn.",
      "<strong>Digestive Blessing (level 6).</strong> While Endo is on, creatures you hold regain 1d6 hit points at the start of each of your turns.",
      "<strong>Blessed Strikes (level 8).</strong> Your weapon and cantrip damage is boosted by 1d8 radiant, and creatures you hold take no damage from your attacks.",
      "<strong>Plenty (level 17).</strong> When you digest a creature, you and every ally within 30 feet regain hit points equal to your Wisdom modifier plus your cleric level."
    )
  },
  {
    name: "Smuggler Within",
    classIdentifier: "rogue",
    hidesPrey: true,
    v: 2,
    html: p(
      "<em>Some thieves hide in barrels. You hide in friends.</em>",
      "<strong>Hidden Passenger (level 3).</strong> You can be held by a willing ally with no check. While you are held, you can see through the ally's eyes and hear what it hears. You can also use Cunning Action to get out as a bonus action, placed adjacent to the ally.",
      "<strong>Concealed Delivery (level 3).</strong> You are completely invisible to creatures looking for you while held by an ally. They need an active search and a Perception check against your Stealth to find you. Your token is hidden from everyone but you, your holder and the GM, and the module hides the tokens of creatures you swallow in the same way.",
      "<strong>Ambush From Within (level 9).</strong> When you leave an ally's stomach on your turn, you have advantage on attack rolls until the end of that turn, and the first attack you make deals your Sneak Attack damage as if you had advantage, whether or not you meet the condition.",
      "<strong>Gut Instinct (level 13).</strong> You always know where your holder is, and you can swap places with a willing creature you hold.",
      "<strong>Perfect Smuggle (level 17).</strong> A willing creature you are held by can carry up to three other willing creatures at once without any of them being noticed. They keep their gear and can't be seen."
    )
  },
  {
    name: "Maw Champion",
    classIdentifier: "fighter",
    html: p(
      "<em>The Maw Champion makes the arena an appetizer.</em>",
      "<strong>Opening Gambit (level 3).</strong> When you make a grapple check, you can instead start a Vore check. You gain a bonus to the check equal to your Strength modifier.",
      "<strong>Bite Back (level 3).</strong> When you hit a creature that has swallowed one of your allies, you can force the creature to make a Constitution saving throw. If it fails, it releases the ally.",
      "<strong>Gluttonous Fury (level 7).</strong> When you hold a creature, you have advantage on Strength checks and Strength saving throws, and you can make one extra weapon attack when you take the Attack action. You can use this feature a number of times equal to your proficiency bonus.",
      "<strong>Heavy Hitter (level 10).</strong> You win ties on Vore checks, and you can start one as part of any weapon attack.",
      "<strong>Engulfing Presence (level 15).</strong> When you win a Vore check, creatures within 10 feet of you must make a Wisdom saving throw or be frightened of you until the end of your next turn.",
      "<strong>All You Can Eat (level 18).</strong> You can start Vore checks against up to three creatures at once, with no disadvantage."
    )
  },
  {
    name: "Oath of the Matron",
    classIdentifier: "paladin",
    endoOnly: true,
    html: p(
      "<em>A Matron's oath is motherly protection: to cradle, to heal, to keep safe. Matrons never digest. Anyone swallowed by a Paladin of this oath is held in perfect Endo and cannot be harmed by them.</em>",
      "<strong>Tenets of the Matron.</strong> <em>Nurture:</em> care for the weak and the afraid. <em>Shelter:</em> a held creature is a guest, not a meal. <em>Return:</em> release anyone who asks, once they are healed. <em>Patience:</em> never harm someone who trusts you.",
      "<strong>Endo-Only (level 3).</strong> You can never digest creatures. Endo is always on for you, you cannot Churn, and creatures you hold take no damage from your turn or from timed digestion. You still make Vore checks as normal.",
      "<strong>Oath Spells.</strong> <em>cure wounds</em>, <em>sanctuary</em> (level 3); <em>calm emotions</em>, <em>lesser restoration</em> (level 5); <em>beacon of hope</em>, <em>revivify</em> (level 9); <em>aura of purity</em>, <em>death ward</em> (level 13); <em>greater restoration</em>, <em>mass cure wounds</em> (level 17).",
      "<strong>Channel Divinity: Lay in Belly (level 3).</strong> Your Lay on Hands is enhanced for creatures you hold: you can spend hit points from the pool at double effect on a held creature (1 point heals 2 hit points), and you can cure a disease or poison for 3 points instead of 5. You can use Lay on Hands as a bonus action on a held creature.",
      "<strong>Mother's Embrace (level 7).</strong> Creatures you hold have resistance to all damage from outside sources and advantage on saving throws against being frightened or charmed. You can sense their needs and know when one is in danger.",
      "<strong>Gentle Release (level 15).</strong> When you release a held creature, it regains hit points equal to your paladin level, and any condition it has is ended (as <em>greater restoration</em>).",
      "<strong>Eternal Matron (level 20).</strong> For 1 hour, creatures you hold can't be reduced below 1 hit point and regain 10 hit points at the start of each of your turns. You can use this feature once per long rest."
    )
  },
  {
    name: "Way of the Open Maw",
    classIdentifier: "monk",
    html: p(
      "<em>Monks of the Open Maw channel ki through the gut, turning every swallow into a technique.</em>",
      "<strong>Hungry Ki (level 3).</strong> You can spend 1 ki point to start a Vore check as a bonus action. You can use your Wisdom modifier in place of Strength or Dexterity for the check.",
      "<strong>Inner Furnace (level 3).</strong> While you hold a creature, your unarmed strikes deal an extra 1d4 fire damage, and you gain temporary hit points equal to your Wisdom modifier at the start of each of your turns.",
      "<strong>Controlled Churn (level 6).</strong> When you Churn, you can spend 1 ki point to deal the damage as force instead and leave Endo on.",
      "<strong>Empty Belly Strike (level 11).</strong> When you digest a creature, you can immediately make an unarmed strike as a reaction against a creature within 5 feet.",
      "<strong>Hollow Perfection (level 17).</strong> You can hold any number of creatures. Spending 3 ki points when you start a Vore check makes the target unable to take reactions."
    )
  }
];

export const subclassDescription = (sc) => `<p><em>Vore subclass for ${sc.classIdentifier[0].toUpperCase() + sc.classIdentifier.slice(1)}. Workshop draft.</em></p>${sc.html}`;

export function subclassData(sc) {
  return {
    name: sc.name,
    type: "subclass",
    img: `modules/${MODULE_ID}/icons/vored.svg`,
    system: {
      identifier: sc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      classIdentifier: sc.classIdentifier,
      description: { value: subclassDescription(sc) }
    },
    flags: { [MODULE_ID]: { feat: true, subclass: true, endoOnly: !!sc.endoOnly, hidesPrey: !!sc.hidesPrey, v: sc.v ?? 1 } }
  };
}
