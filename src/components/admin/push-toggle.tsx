import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { sendTestPush } from "@/lib/push.functions";

export function PushToggle() {
  const { state, error, subscribe, unsubscribe } = usePushSubscription();

  if (state === "unsupported") return null;

  if (state === "subscribed") {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const r = await sendTestPush({ data: undefined as any }).catch(() => ({ sent: 0 }));
            toast.success(`Изпратени ${r.sent} тестови известия`);
          }}
        >
          <BellRing className="size-4" /> Push активен
        </Button>
        <Button size="sm" variant="ghost" onClick={unsubscribe} title="Изключи">
          <BellOff className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={subscribe}
      disabled={state === "loading" || state === "denied"}
      title={state === "denied" ? "Известията са блокирани в браузъра" : "Активирай push известия"}
    >
      <Bell className="size-4" /> {state === "denied" ? "Известията са блокирани" : "Активирай push"}
      {error && <span className="ml-1 text-destructive">!</span>}
    </Button>
  );
}
