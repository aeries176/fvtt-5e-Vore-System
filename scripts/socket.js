import { SOCKET } from "./const.js";
import { isActiveGM } from "./util.js";

// Players cannot edit other tokens or chat messages, so state changes run on the active GM's client.
const handlers = new Map(); // GM-side actions
const clientHandlers = new Map(); // actions delivered to specific users (e.g. roll prompts)
let queue = Promise.resolve();

export const register = (action, fn) => handlers.set(action, fn);
export const registerClient = (action, fn) => clientHandlers.set(action, fn);

function run(action, payload, userId) {
  const fn = handlers.get(action);
  if (!fn) return Promise.resolve();
  // Serialize so simultaneous rolls cannot overwrite each other's message updates.
  queue = queue.then(() => fn(payload, userId)).catch((e) => console.error("vore-system |", action, e));
  return queue;
}

export function initSocket() {
  game.socket.on(SOCKET, (data) => {
    if (data.to) {
      if (data.to.includes(game.user.id)) clientHandlers.get(data.action)?.(data.payload);
      return;
    }
    if (isActiveGM()) run(data.action, data.payload, data.userId);
  });
}

/** Ask the GM client to do something (or do it directly if we are the active GM). */
export function request(action, payload = {}) {
  if (isActiveGM()) return run(action, payload, game.user.id);
  if (!game.users.activeGM) {
    ui.notifications.warn("Vore System: a GM must be logged in for this action.");
    return Promise.resolve();
  }
  game.socket.emit(SOCKET, { action, payload, userId: game.user.id });
  return Promise.resolve();
}

/** Send a client-side action to specific users (including ourselves if listed). */
export function notify(userIds, action, payload = {}) {
  if (userIds.includes(game.user.id)) clientHandlers.get(action)?.(payload);
  const others = userIds.filter((id) => id !== game.user.id);
  if (others.length) game.socket.emit(SOCKET, { action, payload, to: others });
}
