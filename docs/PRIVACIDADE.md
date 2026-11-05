# Política de Privacidade do CandiFill

**Última atualização:** 5 de novembro de 2026

Esta política descreve o tratamento de dados na versão inicial do CandiFill. Ela precisa ser publicada junto da extensão e revisada quando o produto ou seus provedores mudarem.

## Dados armazenados no navegador

O CandiFill guarda no armazenamento local da extensão os dados que você insere ou importa para o cofre, como informações de contato, experiência profissional, formação, respostas reutilizáveis, currículo e a chave de API que você configurou. Esse perfil não é enviado a um servidor do CandiFill.

Quando um campo compatível estava vazio e você digita uma resposta elegível, a extensão pode criar uma sugestão para revisão. Para manter a sugestão disponível depois de uma navegação do formulário, ela fica temporariamente na sessão da extensão, associada à aba e ao domínio, por até 15 minutos. A sugestão só é gravada no perfil depois que você seleciona **Salvar**. Descartar a revisão remove a sugestão. O filtro automático pode não reconhecer todas as informações sensíveis; revise cada pergunta e resposta antes de salvar.

O backup JSON é gerado localmente para você baixar. Ele pode conter o perfil, as respostas salvas e o currículo anexado, mas omite a chave de API.

## Dados enviados a provedores de IA

O CandiFill não tem um servidor próprio de IA. Se você configurar uma chave e acionar um recurso de IA, o texto necessário é enviado do navegador diretamente ao provedor selecionado:

- **Google Gemini:** texto do currículo durante a extração, ou o texto profissional selecionado para refinamento.
- **OpenAI:** texto do currículo durante a extração, ou o texto profissional selecionado para refinamento.

O provedor também recebe a chave de API necessária para autenticar a solicitação. A extensão não envia esses textos aos provedores enquanto você não aciona o recurso de IA. O tratamento posterior é regido pelos termos e pela política de privacidade do provedor escolhido.

## Dados de páginas de candidatura

O content script pode ser carregado em páginas de vários sites para habilitar o preenchimento. A captura passiva de respostas só é armada quando a página tem sinais de candidatura; você também pode armá-la ao acionar o CandiFill manualmente. O script identifica campos de formulário e pode ler uma resposta elegível que você digitou para montar uma sugestão local. O CandiFill não envia formulários automaticamente nem envia os valores da página a um servidor próprio. Os valores sensíveis reconhecidos pelo filtro são excluídos, mas o filtro pode falhar; revise as sugestões. A extensão trabalha principalmente com `input`, `textarea` e `select`; controles especiais podem não ser processados.

## Compartilhamento e telemetria

O CandiFill não inclui conta de usuário, servidor de perfil, anúncios ou serviço de analytics nesta versão. Os dados permanecem no navegador, exceto pelo texto e pela chave enviados diretamente ao provedor quando você usa um recurso de IA.

## Exclusão e cópias

Você pode remover respostas salvas no cofre e descartar sugestões ainda não confirmadas. Backups baixados ficam sob seu controle e precisam ser apagados por você. A extensão não recebe uma cópia do backup.

## Contato

**Contato de suporte e privacidade:** [matheusmdr@hotmail.com](mailto:matheusmdr@hotmail.com).
