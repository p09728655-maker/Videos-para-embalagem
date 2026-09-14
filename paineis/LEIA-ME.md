# Biblioteca de painéis

Cada produto tem uma pasta aqui, criada pelo gerador. Uma vez publicada, ela fica
guardada — não precisa gerar de novo quando o produto voltar a ser produzido.

```
paineis/
  rack-intense-180/
    dados.json      → produto, tempo por camada, componentes e observações
    cam01.jpg       → desenho da camada 1
    cam02.jpg
    foto01.jpg      → foto do produto (opcional)
  mesa-lira/
    ...
```

Qual desses aparece na TV é definido na **biblioteca** (`biblioteca.html`), que
grava em `embalagem_config.painel_ativo` no Supabase. Um clique em **Colocar na
TV** troca o produto; **Tirar da TV** deixa a tela em espera, sem produto nenhum.
A TV percebe em até 1 minuto e se ajusta sozinha, sem controle remoto.

`tv/ativo.json` é só reserva para o Supabase fora do ar, e fica vazio de
propósito — slug preenchido ali prende o produto na tela em toda queda do banco.
