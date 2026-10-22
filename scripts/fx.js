import { MODULE_ID } from "./const.js";
import { getPrey, getConfig, getSlot, isActiveGM, ownsToken, effectiveSlot, stageOf } from "./util.js";
import { registerClient } from "./socket.js";
import { hearers } from "./inside.js";

/* -------------------------------------------- */
/*  Vision: prey sees only their own token       */
/* -------------------------------------------- */

export function patchVision() {
  const proto = foundry.canvas?.placeables?.Token?.prototype;
  const orig = proto?._getVisionSourceData;
  if (typeof orig !== "function") return console.warn("vore-system | vision patch unavailable");
  proto._getVisionSourceData = function (...args) {
    const data = orig.apply(this, args);
    try {
      const st = getPrey(this.document);
      const pred = st && !st.digested ? this.document.parent.tokens.get(st.predatorId) : null;
      if (pred && getSlot(getConfig(pred), st.slot).limitVision !== false) {
        data.radius = 0;
        if ("lightRadius" in data) data.lightRadius = 0;
      }
    } catch (e) {
      /* leave vision untouched on error */
    }
    return data;
  };
}

/* -------------------------------------------- */
/*  Screen effects (per Vore option)             */
/* -------------------------------------------- */

let overlay = null;
let art = null;

function setArt(src, opacity, pulse) {
  if (!src) {
    art?.remove();
    art = null;
    return;
  }
  if (!art) {
    art = document.createElement("div");
    art.id = "vore-overlay-art";
    (document.getElementById("interface") ?? document.body).before(art);
  }
  art.style.backgroundImage = `url("${String(src).replace(/"/g, "%22")}")`;
  art.style.opacity = String(Math.max(0, Math.min(1, Number(opacity) || 0)));
  art.classList.toggle("pulse", !!pulse);
}

function hexToRgba(hex, a) {
  const n = parseInt(String(hex).replace("#", ""), 16) || 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Apply the prey's screen effects. Pass null to clear everything. */
function applyScreenFx(slot) {
  const board = document.getElementById("board");
  if (!slot) {
    overlay?.remove();
    overlay = null;
    setArt(null);
    if (board) {
      board.style.filter = "";
      board.classList.remove("vore-wobble");
    }
    return;
  }
  // Optional stomach-interior art (built in, or your own image) with its own opacity.
  setArt(slot.fxImage || (slot.fxBuiltinArt ? `modules/${MODULE_ID}/images/stomach_interior.webp` : ""), slot.fxImageOpacity, slot.fxPulse);
  const color = slot.fxColor || "#7a1f2b";
  const strength = Number(slot.fxStrength) || 0;
  const layers = [];
  if (slot.fxTint) layers.push(`linear-gradient(${hexToRgba(color, strength * 0.5)}, ${hexToRgba(color, strength * 0.5)})`);
  if (slot.fxVignette) layers.push(`radial-gradient(ellipse at center, ${hexToRgba(color, strength * 0.25)} 30%, ${hexToRgba(color, strength)} 100%)`);

  if (layers.length) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "vore-overlay";
      (document.getElementById("interface") ?? document.body).before(overlay);
    }
    overlay.style.background = layers.join(", ");
    overlay.classList.toggle("pulse", !!slot.fxPulse);
  } else {
    overlay?.remove();
    overlay = null;
  }

  // Non-vignette effects are applied to the game canvas itself (never the UI).
  const distortion = Number(slot.fxDistortion) || 0;
  const filters = [];
  // "Liquid" is a slow GPU-composited sway (a transform animation) rather than a per-pixel filter, so it costs almost nothing.
  if (slot.fxBlur) filters.push(`blur(${(distortion * 4).toFixed(1)}px)`);
  if (board) {
    board.style.filter = filters.join(" ");
    board.classList.toggle("vore-wobble", !!slot.fxLiquid);
    board.style.setProperty("--vore-amp", String(0.4 + distortion * 1.2));
  }
}

/* -------------------------------------------- */
/*  Audio: one sound per Vore option, fades with distance */
/* -------------------------------------------- */

const sounds = new Map(); // key -> { src, sound, dead, base, range, predId, cur }

/** Where a token is on screen right now, including mid-movement while it is still animating. */
function liveCenter(doc) {
  const o = doc?.object;
  if (o?.position && o.w) return { x: o.position.x + o.w / 2, y: o.position.y + o.h / 2 };
  return centerOf(doc);
}

/** 0..1 loudness for a looping sound, from the live distance between its predator and the listener. */
function levelFor(entry) {
  const scene = canvas?.scene;
  const pred = scene?.tokens.get(entry.predId);
  if (!pred) return 0;
  const origin = liveCenter(pred);
  const mine = scene.tokens.filter((t) => !game.user.isGM && ownsToken(t));
  let dist;
  if (mine.length) dist = Math.min(...mine.map((t) => measure(origin, liveCenter(t))));
  else {
    const pivot = canvas.stage?.pivot;
    dist = pivot ? measure(origin, { x: pivot.x, y: pivot.y }) : 0;
  }
  const x = Math.max(0, 1 - dist / Math.max(1, entry.range));
  return x * x * (3 - 2 * x); // smoothstep: eases in and out like an ambient sound
}

const masterVolume = () => game.settings.get("core", "globalInterfaceVolume") ?? 1;

/** Move every loop's volume toward its target a little each frame, so it fades smoothly while anyone moves. */
let tickFn = null;
let lastTick = 0;
function tickSounds() {
  const now = performance.now();
  if (now - lastTick < 40) return; // about 25 updates a second is plenty for a smooth fade
  lastTick = now;
  const master = masterVolume();
  for (const entry of sounds.values()) {
    if (!entry.sound) continue;
    const target = Math.max(0, Math.min(1, entry.base * levelFor(entry) * master));
    entry.cur = Math.abs(target - entry.cur) < 0.004 ? target : entry.cur + (target - entry.cur) * 0.35;
    entry.sound.volume = entry.cur;
  }
}
function ensureTicker(on) {
  const ticker = canvas?.app?.ticker;
  if (!ticker) return;
  if (on && !tickFn) {
    tickFn = tickSounds;
    ticker.add(tickFn);
  } else if (!on && tickFn) {
    ticker.remove(tickFn);
    tickFn = null;
  }
}

async function reconcileSounds(wanted) {
  for (const [key, entry] of sounds) {
    if (!wanted.has(key) || wanted.get(key).src !== entry.src) {
      entry.dead = true;
      entry.sound?.stop();
      sounds.delete(key);
    }
  }
  for (const [key, w] of wanted) {
    const existing = sounds.get(key);
    if (existing) {
      Object.assign(existing, { base: w.base, range: w.range, predId: w.predId });
      continue;
    }
    const entry = { src: w.src, sound: null, dead: false, base: w.base, range: w.range, predId: w.predId, cur: 0 };
    entry.cur = Math.max(0, Math.min(1, entry.base * levelFor(entry) * masterVolume()));
    sounds.set(key, entry);
    foundry.audio.AudioHelper.play({ src: w.src, volume: entry.cur, loop: true, autoplay: true }, false)
      .then((snd) => {
        if (entry.dead) snd?.stop();
        else entry.sound = snd;
      })
      .catch((e) => console.warn("vore-system | audio failed", e));
  }
  ensureTicker(sounds.size > 0);
}

const centerOf = (t) => {
  const size = t.parent.grid.size;
  return { x: t.x + (t.width * size) / 2, y: t.y + (t.height * size) / 2 };
};

function measure(a, b) {
  try {
    return canvas.grid.measurePath([a, b]).distance;
  } catch (e) {
    return (Math.hypot(a.x - b.x, a.y - b.y) / canvas.scene.grid.size) * (canvas.scene.grid.distance || 5);
  }
}

/** Distance from the predator to whoever is listening: the player's nearest token, or the GM's view center. */
function listenerDistance(pred, mine) {
  const origin = centerOf(pred);
  if (mine.length) return Math.min(...mine.map((t) => measure(origin, centerOf(t))));
  const pivot = canvas.stage?.pivot;
  return pivot ? measure(origin, { x: pivot.x, y: pivot.y }) : 0;
}

export function syncFX() {
  const scene = canvas?.scene;
  if (!scene) {
    applyScreenFx(null);
    return reconcileSounds(new Map());
  }
  const mine = scene.tokens.filter((t) => !game.user.isGM && ownsToken(t));
  const mineIds = new Set(mine.map((t) => t.id));
  const wanted = new Map();
  const groups = new Map();
  let fxSlot = null;

  for (const prey of scene.tokens) {
    const st = getPrey(prey);
    if (!st || st.digested) continue;
    const pred = scene.tokens.get(st.predatorId);
    if (!pred) continue;
    // Secret Vore is only heard and seen by the GM and the participants.
    if (st.secret && !game.user.isGM && !ownsToken(pred) && !ownsToken(prey)) continue;
    const cfg = getConfig(pred);
    // Digestion stages can override the sound and screen effects as the prey's HP falls.
    const slot = effectiveSlot(getSlot(cfg, st.slot), stageOf(prey.actor));
    if (mineIds.has(prey.id) && !fxSlot) fxSlot = slot;
    if (prey.hidden) continue; // hidden prey make no sound until they are revealed
    groups.set(`${pred.id}:${st.slot}:${slot.sound || slot.externalSound || slot.internalSound || ""}`, { pred, cfg, slot });
  }

  for (const [key, g] of groups) {
    const src = g.slot.sound || g.slot.externalSound || g.slot.internalSound;
    if (!src) continue;
    wanted.set(key, { src, base: Number(g.slot.soundVolume) || 0.6, range: Math.max(1, Number(g.cfg.soundRange) || 30), predId: g.pred.id });
  }
  applyScreenFx(fxSlot);
  return reconcileSounds(wanted);
}

/** One-shot event sound (swallow / escape / digest), faded by distance the same way as the loop. */
async function playOneShot({ sceneId, predId, src, volume }) {
  if (canvas?.scene?.id !== sceneId) return;
  const pred = canvas.scene.tokens.get(predId);
  if (!pred || !src) return;
  const mine = canvas.scene.tokens.filter((t) => !game.user.isGM && ownsToken(t));
  const range = Math.max(1, Number(getConfig(pred).soundRange) || 30);
  const x = Math.max(0, 1 - listenerDistance(pred, mine) / range);
  const level = x * x * (3 - 2 * x);
  const master = game.settings.get("core", "globalInterfaceVolume") ?? 1;
  const vol = Math.min(1, (Number(volume) || 0.6) * level * master);
  if (vol <= 0.01) return;
  foundry.audio.AudioHelper.play({ src, volume: vol, loop: false, autoplay: true }, false).catch((e) =>
    console.warn("vore-system | audio failed", e)
  );
}

const debouncedSync = foundry.utils.debounce(() => syncFX(), 80);

function refreshVision() {
  canvas?.perception?.update({ initializeVision: true, refreshVision: true, refreshLighting: true });
}

export function registerFXHooks() {
  registerClient("oneShot", playOneShot);
  Hooks.on("canvasReady", () => {
    syncFX();
    refreshVision();
  });
  Hooks.on("canvasTearDown", () => {
    applyScreenFx(null);
    reconcileSounds(new Map());
  });
  Hooks.on("canvasPan", debouncedSync); // the GM's "listening position" is the view center
  Hooks.on("updateToken", (doc, changes) => {
    if (doc.parent?.id !== canvas?.scene?.id) return;
    const flagsChanged = changes.flags && MODULE_ID in changes.flags;
    const moved = "x" in changes || "y" in changes;
    if (flagsChanged) refreshVision();
    if (flagsChanged || moved) debouncedSync();
  });
  // Digestion stages follow the prey's HP.
  Hooks.on("updateActor", (actor, changes) => {
    if (foundry.utils.getProperty(changes, "system.attributes.hp") !== undefined) debouncedSync();
  });
  Hooks.on("createToken", debouncedSync);
  Hooks.on("deleteToken", debouncedSync);
}

/* -------------------------------------------- */
/*  Muffled chat                                 */
/* -------------------------------------------- */

// Muffled speech keeps the rhythm and the "music" of what was said, but not the words: every syllable is boiled
// down to a soft onset (lips, tongue or throat), a vowel colour and a closing sound. Capitals, SHOUTING,
// stutters, drawn-out words and punctuation all carry through.
function hashOf(text) {
  let h = 7;
  for (const c of text.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

const ONSET = { p: "m", b: "m", m: "m", f: "m", v: "m", w: "m", t: "n", d: "n", s: "n", z: "n", l: "n", n: "n", r: "n", j: "n", k: "h", g: "h", c: "h", q: "h", x: "h", h: "h", y: "" };
const VOWEL = { a: "ah", e: "eh", i: "ih", o: "oh", u: "uh", y: "ih" };
const CODA_CLOSE = { s: "f", z: "f", f: "f", v: "f", t: "p", d: "p", p: "p", b: "p", k: "h", g: "h", c: "h", x: "h", m: "m", n: "n", l: "n", r: "r" };

function syllablesOf(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length > 3 && /[^aeiouy]e$/.test(w) && /[aeiouy][^aeiouy]/.test(w.slice(0, -1))) w = w.slice(0, -1); // silent e
  return w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]+(?=$))?|[^aeiouy]+$/g) ?? [w || "m"];
}

function muffleWord(word) {
  const h = hashOf(word);
  if (!/[A-Za-z]/.test(word)) return "mm"; // numbers
  const sylls = syllablesOf(word);
  let out = sylls
    .map((syl, i) => {
      const m = syl.match(/^([^aeiouy]*)([aeiouy]*)([^aeiouy]*)$/);
      const [, on = "", nuc = "", coda = ""] = m ?? [];
      let o = /^(sh|ch|th|ph|wh)/.test(on) ? "h" : (ONSET[on[0]] ?? "");
      if (/^[aeiouy]/.test(syl)) o = ((h >> i) & 1) ? "m" : "";
      let v = VOWEL[nuc[0]] ?? "uh";
      if (((h >> (i + 3)) & 3) === 0) v = "m" + (v === "uh" ? "m" : v.slice(0, 1)); // some vowels go fully nasal: "mm"
      v = v.replace(/^mm?[aeiou]$/, "mm");
      const c = coda ? (CODA_CLOSE[coda[coda.length - 1]] ?? "") : "";
      return o + v + c;
    })
    .join(sylls.length > 3 ? "-" : "");
  out = out.replace(/(.)\1{2,}/g, "$1$1");
  if (word.length > 1 && word === word.toUpperCase()) return out.toUpperCase();
  return /^[A-Z]/.test(word) ? out[0].toUpperCase() + out.slice(1) : out;
}

/** Stutters ("I-I-I can't") and drawn-out words ("noooo") keep their rhythm. */
function muffleToken(token) {
  const stutter = token.match(/^([A-Za-z])(?:-\1)+-(.+)$/i);
  if (stutter) {
    const rest = muffleWord(stutter[2]);
    const lead = rest[0] === rest[0].toUpperCase() ? rest[0] : rest[0].toLowerCase();
    return `${lead}-${lead.toLowerCase()}-${rest}`;
  }
  if (/(\w)\1{3,}/.test(token)) {
    const out = muffleWord(token.replace(/(\w)\1+/g, "$1"));
    return out.replace(/([a-z])$/i, (m) => m.repeat(4));
  }
  return muffleWord(token);
}

/** Tiny seeded generator, so every client hears exactly the same muffling for the same message. */
function seeded(text) {
  let h = hashOf(text) || 1;
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

/** Rarely a word almost gets out before the muffling swallows it: "Hel-mmph!" */
function leakWord(word, rnd) {
  const letters = word.replace(/[^A-Za-z]/g, "");
  const keep = Math.min(5, Math.max(3, Math.ceil(letters.length * 0.6)));
  const head = word.slice(0, keep);
  const tail = ["mmph", "mrrf", "mmf", "nngh"][Math.floor(rnd() * 4)];
  const cut = word === word.toUpperCase() && letters.length > 1 ? tail.toUpperCase() : tail;
  return `${head}\u2014${cut}`;
}

export function muffleText(text) {
  const rnd = seeded(text);
  let words = 0;
  // Which long word, if any, nearly gets through. At most one per message, and only some messages.
  const leakChance = rnd() < 0.12;
  const wordRe = /[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g;
  const total = (text.match(wordRe) ?? []).length;
  const leakAt = leakChance && total >= 4 ? 1 + Math.floor(rnd() * (total - 2)) : -1;
  let out = text.replace(wordRe, (w) => {
    const i = words++;
    if (i === leakAt && w.replace(/[^A-Za-z]/g, "").length >= 5) return leakWord(w, rnd);
    return muffleToken(w);
  });
  // Emphasis carries through the cloth.
  out = out.replace(/!{2,}/g, "!!").replace(/\?!|!\?/g, "?!");
  // Now and then the sentence just trails off.
  if (words >= 5 && rnd() < 0.15) out = out.replace(/([a-z])[.!?]*$/i, "$1\u2026");
  return out;
}

/** Find the vored (non-digested) token a message was spoken by. Works with or without a controlled token. */
function voredSpeaker(speaker) {
  const scene = game.scenes.get(speaker?.scene) ?? canvas?.scene;
  if (!scene) return null;
  const candidates = [];
  const direct = speaker?.token && scene.tokens.get(speaker.token);
  if (direct) candidates.push(direct);
  if (speaker?.actor) candidates.push(...scene.tokens.filter((t) => t.actorId === speaker.actor));
  for (const token of candidates) {
    const st = getPrey(token);
    if (!st || st.digested) continue;
    const pred = scene.tokens.get(st.predatorId);
    if (pred) return { scene, token, pred };
  }
  return null;
}

function muffleElement(el) {
  if (!el) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) n.textContent = muffleText(n.textContent);
}

/** Can the current user hear a muffled voice from this spot? The GM and the speaker always can. */
function withinEarshot(scene, spot) {
  if (game.user.isGM) return true;
  const range = Number(game.settings.get(MODULE_ID, "muffleRange")) || 0;
  if (range <= 0) return true; // 0 = anyone on the map
  if (!scene || !spot) return true;
  const mine = scene.tokens.filter((t) => ownsToken(t));
  if (!mine.length) return false;
  return mine.some((t) => measure(spot, centerOf(t)) <= range);
}

export function registerMuffleHooks() {
  // Chat bubbles over tokens are built separately from chat messages, so muffle them here too.
  Hooks.on("chatBubble", (token, html) => {
    try {
      const doc = token?.document ?? token;
      const hit = voredSpeaker({ scene: doc?.parent?.id, token: doc?.id });
      if (!hit || !getConfig(hit.pred).muffleChat) return;
      const el = html instanceof HTMLElement ? html : html?.[0];
      const clear = [hit.pred, ...hearers(hit.token)].some((t) => ownsToken(t));
      if (ownsToken(doc) || clear) return; // the speaker, their GM and their bellymates hear it clearly
      if (!withinEarshot(doc.parent, centerOf(doc))) {
        if (el) el.style.display = "none";
        return false; // too far away to hear
      }
      muffleElement(el);
    } catch (e) {
      console.warn("vore-system | bubble muffle failed", e);
    }
  });

  // Tag in-character speech from a vored token when it is created.
  Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
    if (userId !== game.user.id) return;
    if (msg.rolls?.length || msg.whisper?.length || msg.getFlag(MODULE_ID, "notice")) return;
    const S = CONST.CHAT_MESSAGE_STYLES;
    if (msg.style === S.OOC || msg.style === S.WHISPER || msg.style === S.ROLL) return;
    const hit = voredSpeaker(msg.speaker);
    if (!hit || !getConfig(hit.pred).muffleChat) return;
    const ids = [hit.pred.id, ...hearers(hit.token).map((t) => t.id)];
    const c = centerOf(hit.token);
    msg.updateSource({ [`flags.${MODULE_ID}.muffled`]: { predId: hit.pred.id, sceneId: hit.scene.id, hearIds: [...new Set(ids)], x: c.x, y: c.y } });
  });

  // The predator's owner hears the real words. Everyone else sees muffled text. The GM and the author
  // keep the real words and also see what the others hear, so it's obvious the muffling is working.
  Hooks.on("renderChatMessageHTML", (msg, html) => {
    const m = msg.getFlag(MODULE_ID, "muffled");
    if (!m) return;
    const content = html.querySelector(".message-content");
    if (!content || content.dataset.voreMuffled) return;
    content.dataset.voreMuffled = "1";
    const scn = game.scenes.get(m.sceneId ?? msg.speaker?.scene);
    const listeners = (m.hearIds ?? [m.predId]).map((id) => scn?.tokens.get(id)).filter(Boolean);
    if (!game.user.isGM && listeners.some((t) => ownsToken(t))) return;
    if (!game.user.isGM && msg.author?.id !== game.user.id && Number.isFinite(m.x) && !withinEarshot(scn, { x: m.x, y: m.y })) {
      html.hidden = true; // too far from the speaker to hear anything
      html.style.display = "none";
      return;
    }

    if (game.user.isGM || msg.author?.id === game.user.id) {
      const note = document.createElement("div");
      note.className = "vore-muffle-note";
      note.textContent = `Others hear: ${muffleText(content.textContent.trim())}`;
      content.append(note);
      return;
    }
    muffleElement(content);
  });
}
