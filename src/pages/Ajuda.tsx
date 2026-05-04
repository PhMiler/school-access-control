import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ = [
  { q: "Como registrar entrada/saída de um aluno?", a: "Vá em Controle de Acesso, escolha entre Entrada ou Saída, e use a biometria simulada ou digite a matrícula manualmente." },
  { q: "O sistema funciona com biometria real?", a: "Atualmente a biometria é simulada para fins de demonstração. Pode ser integrada a um leitor real via API." },
  { q: "Como cadastrar um novo aluno?", a: "Acesse Alunos → Novo aluno. Apenas perfis de gestão (Admin, Diretor, Gestor, RH) têm permissão." },
  { q: "Como exporto um relatório?", a: "Em Relatórios, configure os filtros e clique em CSV ou PDF." },
  { q: "Esqueci minha senha. E agora?", a: "Solicite a um administrador o reset; em produção, use a opção de recuperação por email." },
  { q: "Como promover alguém a Admin?", a: "Apenas administradores podem editar papéis em Usuários. Marque o checkbox da função desejada." },
];

export default function Ajuda() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Ajuda & FAQ</h1>
        <p className="text-muted-foreground">Guia rápido e perguntas frequentes</p>
      </div>
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Guia rápido</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Faça login com seu usuário institucional.</p>
          <p>2. No Dashboard veja presentes, últimas movimentações e alertas.</p>
          <p>3. Use Controle de Acesso para registrar entradas/saídas.</p>
          <p>4. Em Alunos, cadastre, edite ou desative alunos.</p>
          <p>5. Gere relatórios filtrados por data, aluno e curso.</p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Perguntas frequentes</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`i-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
