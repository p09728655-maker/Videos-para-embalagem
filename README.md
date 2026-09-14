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

## Atalhos (quando aberto no computador)

- `Espaço` — pausa / retoma
- `→` ou `Enter` — próxima camada
- `←` — camada anterior
