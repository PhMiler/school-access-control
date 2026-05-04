import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

const PERFIS = [
  { nome: "Admin", cor: "bg-destructive text-destructive-foreground", desc: "Acesso total ao sistema. Gerencia usuários, papéis e exclui registros." },
  { nome: "Diretor", cor: "bg-primary text-primary-foreground", desc: "Visualiza tudo, cadastra/edita alunos e acompanha relatórios institucionais." },
  { nome: "Gestor", cor: "bg-primary text-primary-foreground", desc: "Cadastra/edita alunos e acessa relatórios operacionais." },
  { nome: "RH", cor: "bg-primary text-primary-foreground", desc: "Cadastra/edita alunos e usuários relacionados a recursos humanos." },
  { nome: "Professor", cor: "bg-secondary text-secondary-foreground", desc: "Visualiza alunos e registra entradas/saídas no controle de acesso." },
];

export default function Perfis() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Perfis de Acesso</h1>
        <p className="text-muted-foreground">Hierarquia de permissões baseada em função (RBAC)</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PERFIS.map(p => (
          <Card key={p.nome} className="shadow-card">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className={`h-10 w-10 rounded-lg ${p.cor} flex items-center justify-center`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{p.nome}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{p.desc}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card border-primary/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          As permissões são aplicadas no banco via <strong>RLS (Row Level Security)</strong> do PostgreSQL e
          verificadas com a função segura <code>has_role()</code>, garantindo que nenhum usuário escale privilégios pelo cliente.
        </CardContent>
      </Card>
    </div>
  );
}
