# Renomear a aplicação para EduControl

## Alterações

1. **Marca exibida no sistema**
   - Substituir `EduAcesso` por `EduControl` no logotipo usado nas telas de login, menu e demais áreas.
   - Manter o subtítulo institucional e a identidade visual azul atuais.

2. **Título e informações públicas da página**
   - Trocar o título do navegador para `EduControl`.
   - Criar descrição, autoria e informações de compartilhamento coerentes com o sistema de controle de acesso estudantil.
   - Remover imagens e perfis sociais genéricos da Lovable.
   - Ajustar o idioma do documento para português do Brasil.

3. **Referências técnicas dispensáveis**
   - Remover a ferramenta de marcação de desenvolvimento `lovable-tagger` da configuração e das dependências, pois ela não é necessária ao funcionamento do EduControl.
   - Atualizar o arquivo de dependências travadas junto com essa remoção.

## Limite técnico

As referências internas da plataforma em arquivos automáticos de autenticação da prévia e na pasta de metadados `.lovable` serão preservadas. Elas não aparecem para usuários e alterá-las ou renomeá-las quebraria recursos internos; toda referência pública ou dispensável será removida.

## Verificação

- Confirmar que nenhuma tela, título ou metadado público ainda mostra `Lovable` ou `EduAcesso`.
- Conferir login, menu e página de alunos no navegador.
- Validar que a aplicação continua compilando sem erros após a remoção da dependência.
