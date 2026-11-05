# Política de Privacidade do CandiFill

**Última atualização:** 5 de novembro de 2026

Esta política descreve o tratamento de dados na versão inicial do CandiFill. Ela precisa ser publicada junto da extensão e revisada quando o produto ou seus provedores mudarem.

## Dados armazenados no navegador

O CandiFill guarda no armazenamento local da extensão os dados que você insere ou importa para o cofre. Você pode manter vários perfis de candidatura. Contato, formação, configurações de IA e tema são compartilhados entre eles; resumos, experiência profissional, pretensões salariais, campos personalizados, respostas salvas e currículos pertencem a cada perfil. O cofre também guarda a chave de API configurada. Os perfis não são enviados a um servidor do CandiFill.

A preferência de idioma da interface também é salva localmente na extensão.

Quando um campo compatível estava vazio e você digita uma resposta elegível, a extensão pode criar uma sugestão para revisão. Para manter a sugestão disponível depois de uma navegação do formulário, ela fica temporariamente na sessão da extensão, associada à aba e ao domínio, por até 15 minutos. A sugestão só é gravada no perfil depois que você seleciona **Salvar**. Descartar a revisão remove a sugestão. O filtro automático pode não reconhecer todas as informações sensíveis; revise cada pergunta e resposta antes de salvar.

O backup JSON é gerado localmente para você baixar. Ele pode conter todos os perfis, respostas salvas e currículos anexados, mas omite as chaves de API.

## Dados enviados a provedores de IA

No Firefox 140 ou superior, o navegador pede consentimento antes do primeiro envio de cada categoria de dados necessária. Se você recusar, a solicitação não será enviada e os recursos locais continuarão disponíveis.

O CandiFill não tem um servidor próprio de IA. Se você configurar uma chave e acionar um recurso de IA, o texto necessário é enviado do navegador diretamente ao provedor selecionado:

- **Google Gemini:** texto do currículo durante a extração, ou o texto profissional selecionado para refinamento.
- **OpenAI:** texto do currículo durante a extração, ou o texto profissional selecionado para refinamento.

Ao criar um perfil adaptado a uma vaga, o CandiFill envia ao provedor selecionado a descrição da vaga, o cargo desejado, o título profissional, os resumos e o histórico de experiência do perfil ativo. Essa solicitação não inclui contato, formação, respostas salvas nem o currículo anexado. O resultado aparece como rascunho editável para revisão antes de salvar.

Quando você pede para buscar modelos disponíveis, o CandiFill envia sua chave de API ao provedor selecionado para consultar os modelos acessíveis por ela; essa consulta não inclui texto do perfil nem da candidatura. Ao selecionar **Testar compatibilidade**, o CandiFill envia uma solicitação curta ao modelo. O provedor pode contabilizar esse uso ou cobrar pela solicitação.

O provedor também recebe a chave de API necessária para autenticar a solicitação. A extensão não envia esses textos aos provedores enquanto você não aciona o recurso de IA. O tratamento posterior é regido pelos termos e pela política de privacidade do provedor escolhido.

## Dados de páginas de candidatura

O content script é injetado na página ativa somente depois que você aciona o CandiFill ou o atalho de teclado. A captura passiva de respostas é armada apenas em páginas com sinais de candidatura; você também pode ativá-la ao usar o CandiFill. O script identifica campos de formulário e pode ler respostas elegíveis para criar uma sugestão local. O CandiFill não envia formulários nem os valores da página a um servidor próprio. Filtros podem deixar passar informações sensíveis, então revise as sugestões. A extensão trabalha principalmente com `input`, `textarea` e `select`.

## Compartilhamento e telemetria

O CandiFill não inclui conta de usuário, servidor de perfil, anúncios ou serviço de analytics nesta versão. Os dados permanecem no navegador, exceto pelo texto e pela chave enviados diretamente ao provedor quando você usa um recurso de IA.

## Exclusão e cópias

Você pode remover respostas salvas no cofre e descartar sugestões ainda não confirmadas. Backups baixados ficam sob seu controle e precisam ser apagados por você. A extensão não recebe uma cópia do backup.

## Contato

**Contato de suporte e privacidade:** [matheusmdr@hotmail.com](mailto:matheusmdr@hotmail.com).
