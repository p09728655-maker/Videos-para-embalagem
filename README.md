# RitmoPatrimar · Vídeos Embalagem

Painel de gestão à vista do padrão de embalagem, exibido na TV do setor de embalagem
da Patrimar Móveis. Mostra, camada por camada, quais componentes entram na caixa,
as observações críticas (furação, pintura) e o desenho técnico da camada.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | Página inicial: atalhos e instruções |
| `gerador.html` | Lê o PDF de embalagem e monta o pacote do produto |
| `tv/index.html` | **Player da TV** — arquivo fixo, não muda ao trocar de produto |
| `tv/ativo.json` | Reserva manual, usada só se o Supabase não responder |
| `paineis/<slug>/` | Biblioteca: um produto por pasta, publicado uma vez só |
| `docs/padrao-desenho-tv.html` | **Padrão de folha para o desenhista** (publicado em `/padrao`) |
| `docs/modelo-folha-tv.dxf` | Modelo da folha TV 16:9 para abrir no CAD |
| `nova-senha.html` | Redefinição de senha, aberta pelo link do e-mail |
| `manifest.webmanifest`, `sw.js` | App instalável (PWA) do gerador |
| `logo/`, `icones/` | Marca Patrimar preparada para fundo escuro |

## Como funciona

O player é fixo. Ele pergunta ao Supabase qual produto está ativo
(`embalagem_config.painel_ativo`), carrega esse painel e monta a tela. As imagens
das camadas são arquivos separados, carregados só quando a camada aparece.

Isso separa três coisas que antes eram uma só:

- **publicar um produto** → sobe uma vez pelo gerador, fica na biblioteca
- **trocar o da TV** → um clique na biblioteca
- **mudar o player** → mexe em `tv/index.html`, sem tocar em nenhum produto

### Nada fica fixo na TV

Quem decide o que aparece é a biblioteca, e só ela. O botão **Tirar da TV** zera
`painel_ativo`: em até 1 minuto a TV entra em **espera** — logo da Patrimar e
"Nenhum produto na TV" — e fica assim até alguém escolher outro produto. Ela sai
da espera sozinha, sem ninguém precisar ir até lá com o controle.

Excluir da biblioteca o produto que está na TV também é permitido: o painel sai
do ar antes da exclusão, e a TV fica em espera.

O arquivo `tv/ativo.json` é **reserva manual** e vem vazio de propósito. Ele só é
lido quando o Supabase não responde. Preencher um slug ali prende esse produto na
tela toda vez que o banco cair — o que já causou o problema de a TV exibir um
padrão de embalagem antigo, de um produto que nem estava mais na biblioteca.
Sem produto escolhido no banco, o player **não** cai na reserva: espera vazia é
decisão de quem opera, não falha para contornar.

Antes, cada troca de produto gravava um HTML de ~8 MB no histórico do Git, para
sempre. Com as imagens fora do HTML, um produto fica em algumas centenas de KB
e é publicado uma vez, não a cada troca.

### O que a TV mostra de cada produto

Três modos, gravados em `embalagem_paineis.opcoes`. Escolhidos no gerador ao publicar e
trocáveis na biblioteca **sem republicar** — o UPDATE carimba `atualizado_em` e a TV
recarrega sozinha em até 1 minuto.

| Modo | `opcoes` | Tela |
|---|---|---|
| Desenho + lista | `{componentes:true}` | completa: coluna de componentes, camadas, cronômetro |
| Desenho sem a lista | `{componentes:false}` | sai a coluna; o desenho ocupa a largura toda |
| Só o desenho | `{soDesenho:true}` | a folha ocupa a tela: sem cabeçalho, coluna, cronômetro nem rodapé |

**Só o desenho** existe para a folha TV 16:9 do desenhista, que já traz camada e peças
escritas nela — repetir isso na tela só rouba área do desenho. Continuam visíveis duas
coisas que a folha não garante: a **OBS** digitada no gerador, em faixa no alto, e um fio
de progresso no rodapé, que mostra o ritmo da troca de camada.

No computador, o botão **Só o desenho** (aparece ao mexer o mouse) e a tecla `D` alternam
o modo **só naquela tela e só naquela sessão**: quem manda no que a TV exibe continua
sendo a biblioteca, senão um clique de conferência prenderia um modo na TV sem ninguém
saber onde desfazer.

### Pausar a TV de longe

A TV não tem controle nem teclado, e até então pausar exigia ir até a embalagem. A
biblioteca grava o pedido em `embalagem_config.tv_pausa` (`null` = rodando; carimbo =
pausada desde) e o player consulta esse campo **de 5 em 5 segundos** — é comando, tem que
chegar rápido, por isso não espera o ciclo de 1 minuto da troca de produto.

- o comando só age **na virada** do valor, então a pausa feita no toque da tela não é
  desfeita pelo polling;
- **trocar ou tirar o produto da TV limpa a pausa** — senão o produto novo entraria
  congelado na primeira camada, com a pausa esquecida do anterior;
- a biblioteca mostra desde quando a TV está parada: TV pausada e esquecida é o risco
  real desta função;
- se o banco não tiver a coluna, o player desliga a checagem sozinho e continua tocando.

### Atualizar o player da TV de longe

Trocar de produto **não** recarrega a página — é de propósito, senão a TV perderia a tela
cheia a cada troca. O efeito colateral é que **versão nova do player só entra com um
reload**, e o único automático é o de segurança, a cada 6 h: depois de um deploy, a TV
continua rodando o código antigo.

O botão **Atualizar a TV**, na biblioteca, grava `embalagem_config.tv_recarregar`. O
player guarda o carimbo que viu ao subir e, quando ele muda, dá `location.reload()`. A
primeira leitura só registra o valor que já estava lá — sem isso a TV recarregaria em
loop a cada partida. Ao recarregar, ela sai da tela cheia: só alguém com o controle
devolve esse modo, então o botão avisa antes.

Pausa e recarga viajam na **mesma consulta de 5 em 5 segundos** (`checarComandos`). Erro
de schema — coluna que ainda não existe — suspende a checagem por 10 minutos em vez de
desligá-la de vez: um deploy fora de ordem não deixa a TV surda até o próximo reload.

### Quem pode o quê

A permissão vem do **papel na tabela `usuarios`**, a mesma do RitmoProd — não do domínio
do e-mail. A regra antiga (`e-mail terminando em @patrimarmoveis.com.br`) dava poder de
publicar e excluir painel a qualquer conta criada com um e-mail daquele domínio, sem que
ninguém provasse ter acesso a ele.

A regra, em uma linha: **gerar painel é só no computador; o resto vale nos dois.**

| Quem | Opera a TV | Gera e exclui painel |
|---|---|---|
| `admin`, `analista` (pessoas, tabela `usuarios`) | sim | sim |
| tablet da embalagem (tabela `embalagem_dispositivos`) | sim | **não** |
| `coletor` do RitmoProd | **não** | não |
| sem registro, ou desativado | não | não |

Os aparelhos da embalagem têm **tabela própria**, separada da de pessoas. Coletor é
aparelho de cronoanálise e não tem nada a ver com a TV da embalagem: são domínios
diferentes, cada um com o seu registro.

*Operar a TV* é colocar o produto no ar, tirar do ar, pausar, retomar, mandar recarregar
e ajustar tempo e modo de exibição. Essas duas últimas passam por função no banco
(`embalagem_definir_tempo`, `embalagem_definir_exibicao`) em vez de `UPDATE` na tabela:
assim o tablet ajusta o ritmo sem ganhar permissão de alterar o painel inteiro. As
imagens no bucket seguem a mesma regra de publicar.

A tela esconde o que a conta não pode fazer, mas quem recusa é o banco. Sem conseguir ler
o papel (rede fora), a tela não esconde nada — a recusa vem do servidor, e botão sumido
por falha de rede confundiria mais do que ajuda.

### Tablet autorizado, sem senha no chão de fábrica

Um aparelho por conta, registrado em `embalagem_dispositivos`. O administrador clica em
**Autorizar um tablet** na biblioteca, dá um nome, e a tela mostra um **código de oito
caracteres** (`ABCD-EFGH`) com o tempo que resta. No tablet, a biblioteca mostra
**Autorizar este aparelho**: digita o código e pronto — dali em diante entra sozinho, sem
senha e sem código, porque a sessão se renova.

- a senha do aparelho é sorteada com 32 caracteres e **ninguém precisa decorá-la** nem vê-la;
- o código **vale 15 minutos e serve uma vez só**; a linha some do banco assim que é usado;
- o QR leva o mesmo código, não a senha: se a imagem for parar noutro lugar, o que vaza é
  um código que já venceu. A versão anterior punha a credencial dentro do link, que ficava
  no histórico do navegador e em qualquer conversa por onde o link passasse;
- o e-mail do aparelho sai do **domínio de quem autoriza**. O Supabase recusa e-mail cujo
  domínio não existe em DNS, e `dispositivo.ritmopatrimar.app` não resolve — toda criação
  falhava com *"Email address is invalid"*;
- **revogar é desligar o aparelho na lista**: nenhuma senha de pessoa muda, e os outros
  aparelhos seguem funcionando. A conta continua entrando, mas toda ação é recusada, e a
  biblioteca avisa isso na tela do próprio tablet;
- a lista mostra o último acesso de cada aparelho, para saber o que está em uso e o que
  ficou na gaveta.

No tablet, a biblioteca esconde o caminho para gerar painel e o botão de excluir: o banco
recusaria de qualquer forma, e link que leva a uma recusa é armadilha.

### Esqueci minha senha

O login é o do Supabase Auth, o mesmo usuário do RitmoProd. A tela de login tem
**Esqueci minha senha**: manda `POST /auth/v1/recover` e o Supabase envia o link de
redefinição, que volta para `nova-senha.html` com o token no **fragmento** da URL — que
não é enviado ao servidor, por isso a leitura é feita no navegador e o token some da
barra de endereços assim que a página abre.

A mensagem na tela é sempre a mesma, tenha a conta ou não ("se esse e-mail tiver conta,
o link já saiu"): o endpoint responde 200 para e-mail inexistente de propósito, e repetir
isso na interface evita que a tela sirva para descobrir quem tem acesso.

Duas coisas precisam estar configuradas no projeto do Supabase, senão o fluxo falha em
silêncio:

| Onde | O quê | Se faltar |
|---|---|---|
| Authentication → URL Configuration → Redirect URLs | `https://<domínio>/**` | o link cai na Site URL e `nova-senha.html` abre sem token |
| Authentication → Emails → SMTP | servidor de e-mail próprio | ~2 e-mails por hora e entrega ruim: o link não chega |

Sem SMTP próprio o botão existe mas não é confiável no dia a dia. **Com poucas pessoas
usando, redefinir a senha pelo painel do Supabase continua sendo o caminho mais rápido** —
Authentication → Users → o usuário → definir a senha.

`nova-senha.html` fica fora do cache do service worker: ela depende do token do link e
tem que vir sempre da rede.

### Busca na biblioteca

A lista cresce um produto por publicação, e a biblioteca é usada no celular, ao lado da
TV. O campo de busca casa **todas as palavras digitadas, em qualquer ordem, sem acento e
sem maiúscula** — "nicho 2.0" acha `EMBALAGEM NICHO IMPACTO 2.0`, "comoda" acha
`CÔMODA ATLÂNTICA`. Ele só aparece a partir de 5 produtos: com três, seria um campo a
mais para ler sem nada para achar.

No celular, o cartão tem o alvo de toque em 44 px, a ação principal ocupa a linha inteira
e as ações de apoio ficam em duas linhas fixas (tempo e modo em cima; ver e excluir
embaixo), em `grid` — flex-wrap quebrava em lugar diferente conforme a largura da tela.

As colunas:

```sql
alter table public.embalagem_config add column if not exists tv_pausa timestamptz;
alter table public.embalagem_config add column if not exists tv_recarregar timestamptz;
```

As policies de `embalagem_config` são por tabela — leitura anônima e escrita autenticada
já valem para elas, sem policy nova.

### Tempo por camada na biblioteca

O ritmo certo só aparece com a linha rodando. O campo **Tempo** de cada produto, na
biblioteca, grava `embalagem_paineis.tempo` direto: mudar de 5 para 8 segundos não exige
mais gerar o PDF de novo. A TV recarrega em até 1 minuto (o `atualizado_em` muda) e
recomeça pela camada 01.

### Nem toda página do PDF é camada

A capa e as folhas de conjunto entram na leitura do PDF e não devem ir para a TV. No
gerador, **× remover camada** tira a página do painel e **Restaurar** devolve: nada é
apagado, o desenho continua à vista e a numeração das camadas se refaz sozinha (removida
a 01, a antiga 02 vira 01). Publicar com todas removidas é barrado — painel sem camada
vira tela de erro no player.

A ordem das descrições dentro da camada se acerta pelas setas `▲ ▼` de cada linha: a
ordem na tela é a ordem publicada, lida de cima para baixo.

### Onde a versão do painel aparece

O painel não tem número de versão: quem identifica a versão publicada é a data em
que ela foi publicada — `embalagem_paineis.atualizado_em`. Republicar o mesmo
produto **substitui** a publicação anterior e carimba a data nova; não há
histórico. As três telas mostram essa mesma data, cada uma no seu nível:

| Tela | Onde | Para quê |
|---|---|---|
| Gerador | faixa na etapa **4 · Publicação**, acima do botão | avisa, antes de publicar, se o produto já está na biblioteca e de quando é a versão que será substituída |
| Biblioteca | linha `Versão publicada em …` de cada produto | comparar o que está guardado e escolher o que vai para a TV |
| TV | rodapé, `VERSÃO dd/mm/aaaa` | quem confere de perto sabe se o padrão na tela é o vigente |

A formatação dessas datas vive em `supabase-config.js` (`dataBR`, `dataCurtaBR`,
`haQuantoTempo`), o único arquivo que as três telas carregam.

### Formato do `dados.json`

```json
{
  "produto": "RACK INTENSE 1.80",
  "tempo": 7,
  "camadas": [
    { "op": "CAMADA 01", "obs": "FURACOES PARA CIMA", "img": "cam01.jpg",
      "componentes": [ { "qtd": 2, "nome": "LATERAL ESQUERDA N 03" } ] }
  ],
  "fotos": ["foto01.jpg"]
}
```

### Formato do `tv/ativo.json` (reserva)

```json
{ "painel": "", "atualizado": null }
```

`painel` vazio = sem reserva. Para uma emergência com o Supabase fora do ar, ponha
o slug de uma pasta que exista em `paineis/` — e **lembre de esvaziar depois**,
senão esse produto volta à tela em toda queda do banco. `atualizado` força a TV a
recarregar quando a mesma pasta é republicada com correções.

## Restrições da Smart TV consideradas no player

O navegador embutido de Smart TV é um Chromium antigo (Tizen 2020 ≈ Chrome 76,
webOS 5 ≈ Chrome 68). O player evita:

- `gap` em flexbox (Chrome 84+) — espaçamento com `margin`
- `inset` (87+) — usa `top/left/right/bottom`
- `aspect-ratio` (88+) — usa a técnica de `padding-top`
- `min()` (79+) — usa `vh` puro
- cores hexadecimais de 8 dígitos (62+) — usa `rgba()`
- `scrollIntoView` com opções — rolagem calculada na mão
- `requestFullscreen()` retornando Promise — protegido com prefixos e `try/catch`

E, pelo uso real na fábrica:

- **inicia sozinho**, sem clique — a TV não tem mouse nem teclado
- **tipografia em `vh`**, legível a 4 m, de 720p a 4K
- **imagens sob demanda**, cada uma decodificada uma vez e mantida em cache
- **falha visível**: erro de carga aparece na tela com o motivo, em vez de tela preta
- **recarga de segurança** a cada 30 min, só com a rede respondendo — recupera a TV
  de travamento de memória depois de horas ligada sem cair em tela de erro

## Parâmetros de URL do player

- `?p=slug` — força um produto, ignorando o `ativo.json` (útil para conferir)
- `?t=8` — força o tempo por camada em segundos
- `?comp=0` / `?comp=1` — força esconder ou mostrar a coluna de componentes
- `?so=1` / `?so=0` — força o modo só o desenho, ignorando o que o produto tem publicado

## Atalhos (quando aberto no computador)

- `Espaço` — pausa / retoma
- `→` ou `Enter` — próxima camada
- `←` — camada anterior
- `D` — alterna o modo só o desenho (só nesta tela, só nesta sessão)
