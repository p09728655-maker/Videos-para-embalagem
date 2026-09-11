# TV Embalagem · ritmoprod

Painel de gestão à vista do padrão de embalagem, exibido na TV do setor de embalagem
da Patrimar Móveis. Mostra, camada por camada, quais componentes entram na caixa,
as observações críticas (furação, pintura) e o desenho técnico da camada.

## Estrutura

| Caminho          | O que é |
|------------------|---------|
| `index.html`     | Página inicial: atalhos e instruções de publicação |
| `gerador.html`   | Gerador: lê o PDF de embalagem e monta o painel |
| `tv/index.html`  | **Painel ativo** — é este arquivo que a TV exibe |
| `vercel.json`    | Impede cache agressivo em `/tv`, para a TV enxergar a publicação nova |

## Fluxo de operação

1. No computador, abrir `gerador.html`.
2. Arrastar o PDF de embalagem. O gerador renderiza cada página como uma camada e
   extrai os componentes do texto do PDF.
3. **Revisar os componentes de cada camada.** A extração é heurística — sempre conferir.
4. Preencher nome do produto e tempo por camada.
5. Clicar em *Gerar painel para a TV*. Baixa um arquivo `index.html`.
6. Subir esse arquivo no GitHub em `tv/index.html`, substituindo o existente.
7. A Vercel publica em ~30 s e a TV recarrega sozinha.

A TV fica sempre no mesmo endereço (`<dominio>/tv`), salvo nos favoritos.
Ninguém precisa mexer na TV para trocar de produto.

## Restrições da Smart TV consideradas no painel

O navegador embutido de Smart TV é um Chromium antigo (Tizen 2020 ≈ Chrome 76,
webOS 5 ≈ Chrome 68). O painel gerado evita, por isso:

- `gap` em flexbox (Chrome 84+) — espaçamento feito com `margin`
- `inset` (Chrome 87+) — usa `top/left/right/bottom`
- `aspect-ratio` (Chrome 88+) — usa a técnica de `padding-top`
- cores hexadecimais de 8 dígitos (Chrome 62+) — usa `rgba()`
- `scrollIntoView` com opções — rolagem calculada manualmente
- `requestFullscreen()` retornando Promise — protegido com prefixos e `try/catch`

Outras decisões ligadas ao uso real na fábrica:

- **Inicia sozinho** após 2,5 s. A TV não tem mouse nem teclado.
- **Tipografia em `vh`**, para permanecer legível a 4 m e escalar de 720p a 4K.
- **Renderização a `scale 1.6` / JPEG 0.82.** Navegador de TV tem pouca memória;
  `2.2 / 0.88` gerava arquivos grandes demais. Acima de 8 MB o gerador avisa.
- **Imagens em cache no DOM**, decodificadas uma vez só, sem piscar a cada troca.
- **Recarga automática**: compara `ETag`/`Last-Modified` a cada 3 min e, como rede de
  segurança, recarrega a cada 30 min — o que também recupera a TV de travamentos de
  memória depois de horas ligada. Só recarrega com a rede respondendo, para não cair
  em tela de erro se o Wi-Fi da fábrica oscilar.

## Parâmetros de URL

- `?t=8` — força o tempo por camada em segundos, sem regerar o painel.

## Atalhos (quando aberto no computador)

- `Espaço` — pausa / retoma
- `→` ou `Enter` — próxima camada
- `←` — camada anterior
