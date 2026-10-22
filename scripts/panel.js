import { MODULE_ID } from "./const.js";
import { getPrey, getPred, getConfig, getSlot, ownsToken, esc, isEndo } from "./util.js";
import { escapeAction, strikeAction, churnAction, releaseAction, endoAction, panicAction } from "./ui.js";
import { promptWhisper } from "./inside.js";
import { stomachOn } from "./stomach.js";

/**
 * A small status panel for whoever is inside a predator (or holding someone): who holds them, the digestion mode and
 * timer, HP, and the actions that apply, all in one place. Per-player setting; collapsible.
 */
const ID = "vore-status-panel";
const POS_KEY = "vore-system.panelPos";
let pos = null;
try {
  pos = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
} catch {}

function place(el) {
  if (!pos) return; // default spot comes from the stylesheet
  const x = Math.max(0, Math.min(window.innerWidth - 60, pos.x));
  const y = Math.max(0, Math.min(window.innerHeight - 30, pos.y));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.bottom = "auto";
}

function enableDrag(el) {
  el.addEventListener("pointerdown", (event) => {
    const head = event.target.closest(".vsp-head");
    if (!head || event.target.closest("[data-vsp-toggle]") || event.button !== 0) return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - rect.left;
    const dy = event.clientY - rect.top;
    head.setPointerCapture?.(event.pointerId);
    const move = (e) => {
      pos = { x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)), y: Math.max(0, Math.min(window.innerHeight - 30, e.clientY - dy)) };
      place(el);
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {}
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    event.preventDefault();
  });
  // Double-click the title to put the panel back in its default spot.
  el.addEventListener("dblclick", (event) => {
    if (!event.target.closest(".vsp-head") || event.target.closest("[data-vsp-toggle]")) return;
    pos = null;
    try {
      localStorage.removeItem(POS_KEY);
    } catch {}
    el.style.left = el.style.top = el.style.bottom = "";
  });
}
let collapsed = false;
try {
  collapsed = localStorage.getItem("vore-system.panelCollapsed") === "1";
} catch {}

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}h ` : ""}${h || m ? `${String(m).padStart(h ? 2 : 1, "0")}m ` : ""}${String(s % 60).padStart(2, "0")}s`;
};

/** The tokens this user should see in the panel. */
function relevant() {
  const scene = canvas?.scene;
  if (!scene) return [];
  const pool = game.user.isGM ? canvas.tokens.controlled.map((t) => t.document) : scene.tokens.filter((t) => ownsToken(t));
  return pool.filter((t) => {
    const st = getPrey(t);
    return st || t.getFlag(MODULE_ID, "digested") || (getPred(t)?.preyIds ?? []).length;
  });
}

function timerLine(st) {
  const t = st.timed;
  if (!t) return "";
  const pct = Math.min(100, Math.round(((t.elapsed ?? 0) / t.total) * 100));
  const left = fmt(t.total - (t.elapsed ?? 0));
  const label = t.heal ? "Recovering" : "Digesting";
  return `<div class="vsp-bar" title="${label}: about ${left} left"><span style="width:${pct}%"></span></div>
          <div class="vsp-sub">${label} · ${t.halted ? "finished" : `about ${left} left`}</div>`;
}

function hpLine(doc) {
  const hp = doc.actor?.system?.attributes?.hp;
  if (!hp) return "";
  const max = hp.effectiveMax ?? hp.max ?? 0;
  return `<div class="vsp-sub">HP ${hp.value ?? 0} / ${max}${hp.temp ? ` (+${hp.temp} temp)` : ""}</div>`;
}

function rowFor(doc) {
  const st = getPrey(doc);
  const scene = doc.parent;
  const btn = (act, label) => `<button type="button" data-vsp="${act}" data-token="${doc.id}">${label}</button>`;
  if (st && !st.digested) {
    const pred = scene.tokens.get(st.predatorId);
    const cfg = pred ? getSlot(getConfig(pred), st.slot) : {};
    const mode = pred && isEndo(pred) ? "Endo: you are safe" : st.heal ? "Being soothed (healing)" : "Being digested";
    const strike = game.settings.get(MODULE_ID, "preyStrikeBack") || stomachOn();
    return `<div class="vsp-row"><strong>${esc(doc.name)}</strong> — inside <em>${esc(pred?.name ?? "someone")}</em>${cfg.label ? ` (${esc(cfg.label)})` : ""}
      <div class="vsp-sub">${mode}${st.timed ? "" : " · damage on each of their turns"}</div>${timerLine(st)}${hpLine(doc)}
      <div class="vsp-actions">${btn("struggle", "Struggle")}${strike ? btn("strike", "Strike") : ""}${btn("whisper", "Whisper")}</div></div>`;
  }
  if (st?.digested || doc.getFlag(MODULE_ID, "digested")) {
    return `<div class="vsp-row"><strong>${esc(doc.name)}</strong> — digested
      <div class="vsp-actions">${btn("panic", "Panic release")}</div></div>`;
  }
  const preyDocs = (getPred(doc)?.preyIds ?? []).map((id) => scene.tokens.get(id)).filter((p) => p && !getPrey(p)?.digested);
  const list = preyDocs
    .map((p) => `<div class="vsp-sub">${esc(p.name)}${getPrey(p)?.timed ? ` · ${Math.min(100, Math.round(((getPrey(p).timed.elapsed ?? 0) / getPrey(p).timed.total) * 100))}%` : ""}</div>`)
    .join("");
  return `<div class="vsp-row"><strong>${esc(doc.name)}</strong> — holding ${preyDocs.length}${isEndo(doc) ? " (Endo)" : ""}${list}
    <div class="vsp-actions">${btn("churn", "Churn")}${btn("release", "Release")}${btn("endo", "Endo")}${btn("whisper", "Whisper")}</div></div>`;
}

function render() {
  let el = document.getElementById(ID);
  const rows = game.settings.get(MODULE_ID, "showStatusPanel") ? relevant() : [];
  if (!rows.length) return el?.remove();
  if (!el) {
    el = document.createElement("div");
    el.id = ID;
    document.body.append(el);
    enableDrag(el);
    place(el);
    el.addEventListener("click", async (event) => {
      if (event.target.closest("[data-vsp-toggle]")) {
        collapsed = !collapsed;
        try {
          localStorage.setItem("vore-system.panelCollapsed", collapsed ? "1" : "0");
        } catch {}
        return render();
      }
      const b = event.target.closest("[data-vsp]");
      if (!b) return;
      const doc = canvas.scene?.tokens.get(b.dataset.token);
      if (!doc) return;
      const run = { struggle: escapeAction, strike: strikeAction, whisper: promptWhisper, churn: churnAction, release: releaseAction, endo: endoAction, panic: panicAction }[b.dataset.vsp];
      run?.(doc);
    });
  }
  el.classList.toggle("collapsed", collapsed);
  el.innerHTML = `<div class="vsp-head" title="Drag to move. Double-click to reset."><span><i class="fa-solid fa-grip-vertical"></i> <i class="fa-solid fa-utensils"></i> Vore Status</span><i class="fa-solid ${collapsed ? "fa-chevron-up" : "fa-chevron-down"}" data-vsp-toggle title="${collapsed ? "Expand" : "Collapse"}"></i></div>
    ${collapsed ? "" : `<div class="vsp-body">${rows.map(rowFor).join("")}</div>`}`;
}

export function registerPanel() {
  game.settings.register(MODULE_ID, "showStatusPanel", {
    name: "VORE.Settings.Panel.Name",
    hint: "VORE.Settings.Panel.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: render
  });
  let timer = null;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  };
  Hooks.on("canvasReady", soon);
  Hooks.on("controlToken", soon);
  Hooks.on("updateToken", soon);
  Hooks.on("deleteToken", soon);
  Hooks.on("updateActor", soon);
  setInterval(() => {
    if (document.getElementById(ID) && !collapsed) render(); // keeps timers and HP fresh
  }, 5000);
  Hooks.once("ready", soon);
}
