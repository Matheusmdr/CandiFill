# CandiFill

Extensão de navegador para agilizar candidaturas a vagas. O CandiFill mantém um cofre local com seus dados profissionais, preenche campos compatíveis e permite revisar respostas novas antes de guardá-las.

> **Estado do projeto:** preparando a primeira publicação. A instalação normal pelo Firefox Add-ons será ligada aqui após a aprovação da listagem. Até lá, este README explica como testar a versão a partir do código-fonte.

Se você já usava uma versão de desenvolvimento anterior, exporte seu cofre em JSON antes de instalar a CandiFill e depois importe o arquivo. A nova identidade da extensão usa um armazenamento separado no Firefox.

## Recursos

- Preenchimento de campos compatíveis com os dados do seu perfil, sem substituir respostas que você já digitou e sem enviar formulários.
- Revisão manual de respostas novas. A captura passiva só é armada em páginas reconhecidas como candidatura; acionando o CandiFill manualmente, você também pode ativá-la. Sugestões não confirmadas ficam temporariamente na sessão do navegador e só são adicionadas ao perfil depois da sua confirmação.
- Cofre local para dados pessoais, experiência, formação, respostas reutilizáveis e currículo.
- Importação de currículo e refinamento de texto usando uma chave própria do Google Gemini ou da OpenAI. O texto selecionado para esses recursos é enviado diretamente ao provedor escolhido.
- Backup e restauração do perfil em JSON; a chave de API é omitida do backup.

Leia a [Política de Privacidade](docs/PRIVACIDADE.md) antes de usar a extensão.

## Instalação para uso normal

A distribuição inicial será pelo **Firefox Add-ons (AMO)**, sem custo de instalação para quem usa a extensão. O link de instalação será adicionado depois que a Mozilla aprovar a listagem.

O Firefox exige uma versão assinada para instalação permanente nas versões Release e Beta. O procedimento abaixo carrega uma versão temporária para avaliação e desenvolvimento; ela será removida quando o Firefox fechar.

## Testar a partir do código-fonte

Requisitos: Firefox 121 ou posterior, Node.js 22.12 ou posterior e npm.

1. Na página pública deste repositório, selecione **Code → Download ZIP** e extraia o arquivo. Também é possível clonar o repositório com Git.
2. Abra um terminal na pasta extraída e instale as dependências:

   ```bash
   npm ci
   ```

3. Compile a extensão:

   ```bash
   npm run build
   ```

4. No Firefox, abra `about:debugging#/runtime/this-firefox`.
5. Selecione **Carregar extensão temporária…** e escolha `dist/manifest.json`.

No PowerShell do Windows, se a política de execução bloquear `npm.ps1`, use `npm.cmd ci` e `npm.cmd run build`.

Para testar mudanças, rode `npm test` e gere novamente a pasta `dist` com `npm run build`. A pasta `dist` é saída de compilação; não edite seus arquivos diretamente.

## Navegadores

A primeira distribuição será preparada para Firefox 121+. O projeto ainda não passou por smoke tests em todos os ATS e navegadores listados em versões anteriores do README; compatibilidade só será anunciada depois de verificação manual. Zen Browser pode aceitar extensões do Firefox, mas ainda precisa de teste próprio.

## Privacidade e permissões

- O perfil e o currículo ficam no armazenamento local da extensão no navegador.
- Respostas capturadas para revisão ficam na sessão da extensão, associadas à aba e ao site, por até 15 minutos. Elas não são salvas no perfil sem confirmação.
- Os recursos de IA enviam o texto necessário ao provedor escolhido (Gemini ou OpenAI) quando você os aciona; a extensão não opera um servidor próprio de IA.
- O content script usa acesso a páginas para detectar e preencher formulários; a captura passiva é limitada a páginas reconhecidas como candidatura. Veja a política para os dados processados e as limitações dos filtros.

Consulte a [Política de Privacidade](docs/PRIVACIDADE.md) para detalhes.

## Desenvolvimento

```bash
npm ci
npm test
npm run build
```

- `src/`: aplicação React, content script, background e serviços.
- `public/`: manifesto e ícones da extensão.
- `docs/`: política de privacidade.

## Contribuições e problemas

Relate problemas pela aba **Issues** deste repositório. Não inclua currículos, chaves de API, respostas de formulários ou outros dados pessoais em issues. Para suporte ou para reportar uma falha de segurança em privado, escreva para [matheusmdr@hotmail.com](mailto:matheusmdr@hotmail.com).

## Licença

Este projeto é distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
