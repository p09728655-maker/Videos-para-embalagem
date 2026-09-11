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

Qual desses aparece na TV é definido em `tv/ativo.json`:

```json
{ "painel": "rack-intense-180", "atualizado": "2026-09-11T13:40:00Z" }
```

Trocar o produto da TV = trocar esse nome. A TV percebe em até 1 minuto e
troca sozinha. Não precisa mexer na TV nem republicar o painel.

O campo `atualizado` serve para forçar a TV a recarregar quando você
republica a **mesma** pasta com correções: mude o carimbo e a TV recarrega.
