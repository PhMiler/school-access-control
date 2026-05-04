import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/layout/Logo";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  numero_usuario: z.string().trim().min(1).max(40),
  password: z.string().min(6).max(72),
});

export default function Setup() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [needed, setNeeded] = useState<boolean | null>(null);

  useEffect(() => { setNeeded(true); }, []);


  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const { error } = await supabase.functions.invoke("bootstrap-admin", { body: parsed.data });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Administrador criado! Faça login.");
    navigate("/auth", { replace: true });
  };

  if (needed === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!needed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Setup já realizado</CardTitle>
            <CardDescription>O sistema já possui um administrador configurado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">Ir para login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="rounded-xl bg-background px-6 py-4 shadow-elegant"><Logo /></div>
        </div>
        <Card className="border-0 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />Configuração inicial
            </CardTitle>
            <CardDescription>Crie o usuário administrador do sistema. Esta tela aparece apenas no primeiro acesso.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input name="nome" required /></div>
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
              <div className="space-y-2"><Label>Número do usuário</Label><Input name="numero_usuario" required /></div>
              <div className="space-y-2"><Label>Senha</Label><Input name="password" type="password" minLength={6} required /></div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar administrador
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
