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
| `tv/ativo.json` | Define qual produto está na TV agora |
| `paineis/<slug>/` | Biblioteca: um produto por pasta, publicado uma vez só |
| `manifest.webmanifest`, `sw.js` | App instalável (PWA) do gerador |
| `logo/`, `icones/` | Marca Patrimar preparada para fundo escuro |

## Como funciona

O player é fixo. Ele lê `tv/ativo.json` para saber qual produto exibir, carrega
`paineis/<slug>/dados.json` e monta a tela. As imagens das camadas são arquivos
separados, carregados só quando a camada aparece.

Isso separa três coisas que antes eram uma só:

- **publicar um produto** → sobe a pasta em `paineis/`, uma vez na vida
- **trocar o da TV** → edita uma linha em `tv/ativo.json`
- **mudar o player** → mexe em `tv/index.html`, sem tocar em nenhum produto

Antes, cada troca de produto gravava um HTML de ~8 MB no histórico do Git, para
sempre. Com as imagens fora do HTML, um produto fica em algumas centenas de KB
e é publicado uma vez, não a cada troca.

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

### Formato do `tv/ativo.json`

```json
{ "painel": "rack-intense-180", "atualizado": "2026-09-11T13:40:00Z" }
```

`atualizado` força a TV a recarregar quando você republica a **mesma** pasta com
correções — mude o carimbo e a TV recarrega.

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
