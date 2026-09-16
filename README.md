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
