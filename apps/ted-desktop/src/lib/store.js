// A tiny external store (0.1.5 speed): the text of the composer lives here instead of in the App state, so a key
// press re-renders only the composer – not the thread, the sidebar and the open page (typing stays instant in long
// chats on an older laptop). set() takes a value or an updater like React's setState.
import { useSyncExternalStore } from "react";

export function createStore(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set: (next) => {
      const v = typeof next === "function" ? next(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      subs.forEach((f) => f());
    },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}

export const useStore = (store) => useSyncExternalStore(store.subscribe, store.get, store.get);
