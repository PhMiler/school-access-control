import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/layout/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  identifier: z.string().trim().min(2, "Informe seu identificador").max(120),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(form));
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    setBusy(true);
    const ident = parsed.data.identifier!;
    let email = ident;
    if (!ident.includes("@")) {
      const { data, error } = await supabase.rpc("resolve_login_identifier", { _identifier: ident });
      if (error || !data) {
        setBusy(false);
        toast.error("Usuário não encontrado");
        return;
      }
      email = data as string;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password! });
    setBusy(false);
    if (error) toast.error("Credenciais inválidas"); else toast.success("Bem-vindo!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="rounded-xl bg-background px-6 py-4 shadow-elegant">
            <Logo />
          </div>
        </div>
        <Card className="border-0 shadow-elegant">
          <CardHeader>
            <CardTitle>Acesse o sistema</CardTitle>
            <CardDescription>Entre com suas credenciais institucionais</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Nome, email ou número do usuário</Label>
                <Input id="identifier" name="identifier" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                O acesso é restrito a usuários previamente cadastrados pelo administrador.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
