import { MODULE_ID } from "./const.js";
import { getPrey, isActiveGM, isEndo, combatRunning } from "./util.js";
import { applyPreyDamage, applyPreyHealing } from "./rules.js";
import { postDeathSave } from "./cards.js";
import { digest } from "./vore.js";

const FLAG = `flags.${MODULE_ID}`;
const TICK_MS = 5000;
const SAVE_EVERY_MS = 60000;
const clock = new Map(); // "scene:prey" -> { elapsed, lastTick, saved }

/** State stored on the prey when a "timed" Vore option swallows them. */
export function initialTimedState(prey, d) {
  if (!d || d.mode !== "timed") return null;
  const heal = d.effect === "heal";
  const slotCfg = { digestHours: d.hours, digestMinutes: d.minutes, digestSeconds: d.seconds, digestClock: d.clock };
  const secs =
    (Number(slotCfg.digestHours) || 0) * 3600 + (Number(slotCfg.digestMinutes) || 0) * 60 + (Number(slotCfg.digestSeconds) || 0);
  const total = (secs > 0 ? secs : 600) * 1000; // nothing entered = 10 minutes
  return {
    startedAt: foundry.utils.randomID(), // unique per swallow, so a re-vored token never inherits an old clock
    clock: slotCfg.digestClock === "world" ? "world" : "real",
    total: Math.max(1000, total),
    elapsed: 0,
    drained: 0,
    startHp: prey.actor?.system.attributes.hp.value ?? 0,
    lastTick: slotCfg.digestClock === "world" ? game.time.worldTime * 1000 : Date.now(),
    halted: false,
    skip: !!d.skipDeathSaves,
    heal
  };
}

/** Combat is slowed-down time: the countdown is frozen while a combat is running on the scene. */

async function advance(scene, prey, pred, st, real, addMs = 0) {
  const t = st.timed;
  // "world" timers follow Foundry's game clock (milliseconds of in-game time); "real" ones follow the wall clock.
  const now = t.clock === "world" ? game.time.worldTime * 1000 : real;
  const key = `${scene.id}:${prey.id}:${t.startedAt ?? ""}`;
  const mem = clock.get(key) ?? { elapsed: t.elapsed, lastTick: t.lastTick ?? now, saved: real };
  const gap = Math.max(0, now - mem.lastTick);
  mem.lastTick = now;
  // The clock itself is frozen during combat, and while the predator has Endo on (nobody inside takes damage).
  // In combat, time instead moves in 6-second steps on each of the predator's turns (addMs).
  if (isEndo(pred) || (!addMs && combatRunning(scene))) {
    // Save once as the clock freezes, so everyone's live display stops at the same moment.
    const first = !mem.frozen;
    mem.frozen = true;
    clock.set(key, mem);
    if (first) await prey.update({ [`${FLAG}.prey.timed`]: { ...t, elapsed: Math.max(mem.elapsed, t.elapsed), lastTick: now } }, { voreMove: true });
    return;
  }
  const resumed = !!mem.frozen;
  mem.frozen = false;
  mem.elapsed = Math.max(mem.elapsed, t.elapsed) + (resumed ? 0 : addMs || gap);
  mem.saveNow = resumed || !!addMs;
  clock.set(key, mem);

  const progress = Math.min(1, mem.elapsed / t.total);
  const hp = prey.actor?.system.attributes.hp;
  if (!hp) return;
  const finished = progress >= 1;
  if (t.heal) {
    // Healing timer: HP climbs smoothly toward full over the duration, then the timer simply ends.
    const max = hp.effectiveMax ?? hp.max ?? 0;
    const gain = Math.max(0, max - t.startHp);
    const add = finished ? Math.max(0, max - (hp.value ?? 0)) : Math.round(gain * progress) - t.drained;
    if (add > 0) await applyPreyHealing(prey, add);
    if (add > 0 || finished || mem.saveNow || real - mem.saved > SAVE_EVERY_MS) {
      mem.saved = real;
      await prey.update(
        { [`${FLAG}.prey.timed`]: { ...t, elapsed: mem.elapsed, lastTick: now, drained: t.drained + Math.max(0, add), halted: finished ? true : t.halted } },
        { voreMove: true }
      );
    }
    return;
  }
  const delta = finished ? (hp.value ?? 0) + (hp.temp ?? 0) : Math.round(t.startHp * progress) - t.drained;

  if (delta > 0 || mem.saveNow || real - mem.saved > SAVE_EVERY_MS) {
    mem.saved = real;
    await prey.update(
      { [`${FLAG}.prey.timed`]: { ...t, elapsed: mem.elapsed, lastTick: now, drained: t.drained + Math.max(0, delta) } },
      { voreMove: true }
    );
  }
  if (delta <= 0) return;

  const result = await applyPreyDamage(prey, delta);
  if (result === "dying" && t.skip) {
    // This option skips death saves: straight to full digestion.
    await digest(prey);
  } else if (result === "dying") {
    // Players never go straight to digested: the timer stops and the normal death saves take over.
    await prey.update({ [`${FLAG}.prey.timed.halted`]: true }, { voreMove: true });
    await postDeathSave(scene.id, st.predatorId, prey.id);
  }
}

/** One combat turn = 6 seconds: move a timed prey's countdown forward. Called on the predator's turn. */
export async function stepTimed(prey, ms = 6000) {
  const st = getPrey(prey);
  if (!st || st.digested || !st.timed || st.timed.halted) return;
  const scene = prey.parent;
  const pred = scene.tokens.get(st.predatorId);
  if (!pred) return;
  await advance(scene, prey, pred, st, Date.now(), ms);
}

let busy = false;
async function tick() {
  if (busy || !isActiveGM()) return;
  busy = true;
  try {
    const now = Date.now();
    const scenes = new Set([canvas?.scene, ...game.scenes.filter((s) => s.active)].filter(Boolean));
    for (const scene of scenes) {
      for (const prey of scene.tokens) {
        const st = getPrey(prey);
        if (!st || st.digested || !st.timed || st.timed.halted) continue;
        const pred = scene.tokens.get(st.predatorId);
        if (!pred) continue;
        try {
          await advance(scene, prey, pred, st, now);
        } catch (e) {
          console.error("vore-system | timed digestion failed", e);
        }
      }
    }
  } finally {
    busy = false;
  }
}

export function registerTimed() {
  setInterval(tick, TICK_MS);
  // Advancing the game clock should take effect right away.
  Hooks.on("updateWorldTime", () => tick());
}
