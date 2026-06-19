import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { checkDns } from "@/lib/dns-check.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/dns")({
  component: DnsPage,
  head: () => ({ meta: [{ title: "DNS статус — imotinadezhda.bg" }] }),
});

function DnsPage() {
  const fn = useServerFn(checkDns);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["dns-check"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">DNS статус</h1>
          <p className="text-muted-foreground">Автоматична проверка на A и TXT записите за домейна. Обновява се на всеки 60 секунди.</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Провери сега</span>
        </Button>
      </div>

      {error && <Card><CardContent className="p-4 text-destructive">Грешка при проверка: {String((error as Error).message)}</CardContent></Card>}

      {data && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Общ статус</CardTitle>
              {data.allOk ? (
                <Badge className="bg-green-600 hover:bg-green-700">Готово — DNS разпространен</Badge>
              ) : (
                <Badge variant="destructive">Изчакване на разпространение</Badge>
              )}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Последна проверка: {new Date(data.checkedAt).toLocaleString("bg-BG")}
              <br />
              Очакван A запис: <code className="font-mono">{data.expectedA}</code>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {data.records.map((r) => (
              <Card key={`${r.name}-${r.type}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {r.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
                    <span className="font-mono">{r.type}</span> {r.name}
                  </CardTitle>
                  <Badge variant={r.ok ? "default" : "secondary"}>{r.ok ? "OK" : "Изчаква"}</Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>Очаквана стойност: <code className="font-mono">{r.expected}</code></div>
                  <div>
                    <strong>Cloudflare DNS:</strong>{" "}
                    {r.cloudflare.length ? r.cloudflare.map((v) => <code key={v} className="font-mono mr-2">{v}</code>) : <span className="text-muted-foreground">няма отговор</span>}
                  </div>
                  <div>
                    <strong>Google DNS:</strong>{" "}
                    {r.google.length ? r.google.map((v) => <code key={v} className="font-mono mr-2">{v}</code>) : <span className="text-muted-foreground">няма отговор</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Указания</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>1. В регистратора добави A запис @ → 185.158.133.1</p>
              <p>2. Добави A запис www → 185.158.133.1</p>
              <p>3. Добави TXT запис _vercel със стойност от Vercel (Project Settings → Domains)</p>
              <p>4. Изчакай разпространението — обикновено до 1 час, максимум 72 часа</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
