import { useEffect, useState } from "react";
import { getVapidPublicKey, saveSubscription, removeSubscription } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushState = "unsupported" | "denied" | "prompt" | "subscribed" | "loading" | "error";

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) setState("subscribed");
        else if (Notification.permission === "denied") setState("denied");
        else setState("prompt");
      } catch {
        setState("error");
      }
    })();
  }, []);

  async function subscribe() {
    setError(null);
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await getVapidPublicKey();
      if (!key) throw new Error("VAPID public key not configured on server");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }
      const json = sub.toJSON();
      await saveSubscription({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
          userAgent: navigator.userAgent,
        },
      });
      setState("subscribed");
    } catch (e: any) {
      setError(e?.message ?? "Грешка");
      setState("error");
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setState("prompt");
    } catch (e: any) {
      setError(e?.message ?? "Грешка");
    }
  }

  return { state, error, subscribe, unsubscribe };
}
