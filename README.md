# Defende o Lar

Tôin não entrega a casa. Jogo de cima para baixo, no navegador: prólogo, três dias e final.

O jogo que se apresenta é esta pasta (`gamejam/defende-o-lar`). Precisa de Node.js 18 ou mais novo.

## Como subir na sua máquina

Na pasta `defende-o-lar`:

```bash
npm install
npm run dev
```

O terminal mostra um endereço, em geral `http://localhost:5173`. Abra no Chrome ou no Edge e clique no canvas antes de jogar.

| Comando | Para que serve |
| --- | --- |
| `npm run dev` | Jogar enquanto edita. A página atualiza sozinha. |
| `npm test` | Confere direção da folha, prólogo, armas e os três dias. |
| `npm run build` | Gera a pasta `dist`, pronta para os professores. |
| `npm run preview` | Abre localmente o que está em `dist`. |

## Controles

- **WASD** ou setas andam. O corpo olha para onde anda.
- O **mouse** mira a arma. O analógico direito do controle também.
- **J** ou clique ataca. **1** é o facão, **2** o trabuco (a partir do dia 2).
- **Espaço**, **Enter** ou **E** avançam a fala. No prólogo, também pulam a cena do sal.
- **Esc** pausa. Lá dá para ligar **Invencível** ou **Pular a luta**, para a banca seguir a história se alguém travar.
- No menu, clique **Bora começar**, ou num dia, ou em **Os ajuste**. A tecla **O** e o **0** também abrem os ajuste. **Menos** e **mais** mudam o valor quantas vezes quiser: chapéu do Tôin, corte do facão, chumbo do trabuco, os chefe (manso, danado, cão nos coro) e a chumbada.
- O trabuco solta cinco balas em leque. Não precisa acertar o pixel do inimigo.
- O facão corta rápido, em golpes curtos.
- No dia 3, a carta do Corisco fica no chão. Chegue perto e aperte **E**.
- Se cair, **R** tenta o dia de novo e **M** volta ao menu.

O Tôin tem 8 chapéus e fica um segundo sem tomar outro golpe. O facão tira 4 e o trabuco, 3 no centro do leque. A Alma do Boiadeiro tem 80 de vida e o Corisco, 110. O golpe varre um arco, em vez de só aparecer o ícone.

## Onde está cada coisa

```
defende-o-lar/
  index.html          página, título e dicas em volta do canvas
  src/style.css       cores da página (osso e madeira)
  src/main.js         carrega os PNG e liga o canvas
  src/game.js         regras, dias, chefes, desenho e HUD
  src/facing.js       as cinco faixas da folha e o espelho da esquerda
  src/assets/         sprites
  test/               testes automáticos
  dist/               site gerado, é isto que se publica
```

Dentro de `src/game.js`:

| Função | O que mexe |
| --- | --- |
| `buildPrologue` | Cena do sal, quintal, pote e facão |
| `buildDay1` | Zé, estrada, botija e Alma do Boiadeiro |
| `buildDay2` | Nonô, Luzia, cerco e fuga |
| `buildDay3` | Casa sozinha e Corisco |
| `attack` / `updatePlayer` | Facão, trabuco, recarga e caminhada |
| `drawChar` | Folha `walk`, `idle` e `attack` |
| `drawGround` | Tiles de areia e estrada de barro |
| `renderSalt` | Noite do sal, antes das falas |
| `renderEnd` | Carta e silhuetas de Lampião e Maria Bonita |

Sprites em `src/assets/`:

- `walk.png`, `idle.png`, `attack.png`: Tôin e todo mundo que usa o mesmo corpo. Cinco faixas (baixo, diagonal baixo, lado, diagonal cima, cima). A esquerda é espelho.
- `sand0.png` a `sand3.png`: chão. Autoria de CDmir, CC0.
- `facao.png`: lâmina do golpe. Autoria de Kenney, CC0.
- `tile.png`, `cactus`, `rock`, `tree`, `barrel`, `plant`, `skull` e os outros: mato e o tile antigo.

A pasta `gamejam/GameJam` é o projeto Unity. Este jogo não usa ela. O arquivo `gamejam/protótipo_tôin_cangaco.html` é uma cópia antiga num HTML só. Mudança de regra entra em `defende-o-lar`.

## Como melhorar

1. Rode `npm run dev`.
2. Edite o arquivo da tabela acima. Sprite novo entra em `src/assets` com o nome em minúsculas, por exemplo `trabuco.png`. O `src/main.js` carrega sozinho todo PNG dessa pasta. No código, a imagem fica em `IMG.trabuco`.
3. Rode `npm test`. Se passar, rode `npm run build` antes de publicar de novo.

Um sprite de arma ou de casa precisa ser visto de cima, no mesmo pixel do Tôin. Um desenho de lado (personagem de plataforma, revólver de perfil) quebra a câmera.

## No dia da apresentação

Os professores jogam no navegador. Não peça para abrirem o `index.html` com dois cliques: o jogo usa módulos e o navegador bloqueia isso em arquivo solto.

### Jeito mais simples: itch.io

1. `npm run build`
2. Compacte **o conteúdo** de `dist` (o `index.html` na raiz do zip, junto com a pasta `assets`).
3. Crie uma página no [itch.io](https://itch.io), tipo HTML, e envie o zip.
4. Marque para embutir no navegador e rode o jogo uma vez na própria página.
5. Mande o link. Cada professor abre e joga, sem instalar nada.

### Na sala, sem internet no projetor

No notebook da apresentação, na pasta do jogo:

```bash
npm install
npm run dev -- --host
```

O Vite mostra um endereço da rede, algo como `http://192.168.0.10:5173`. Quem estiver no mesmo Wi-Fi abre esse endereço. Deixe o terminal aberto até o fim da banca.

Se a rede da sala bloquear isso, use o zip do `dist` numa página já publicada (itch.io ou GitHub Pages) e teste o link em casa, no 4G.

### GitHub Pages

Suba o repositório, rode `npm run build` e publique a pasta `dist`. O `vite.config.js` já usa `base: './'`, então o jogo acha os sprites numa subpasta.

Antes da banca: abra o link num celular e num computador, comece o prólogo, ande, dê um golpe e pause. O áudio só sai depois do primeiro clique.

## Melhorias futuras

- Depois da cena do sal, uma escolha de verdade: defender a casa ou entregar os suprimentos. Entregar precisa ter final, com a casa vazia. Lutar segue os três dias.
- Estoque visível: feijão, água e pólvora. Cangaceiro que chega na porta leva uma reserva. A garapa gasta água. O trabuco gasta pólvora.
- Casa de taipa, trabuco e chapéu como sprite, no mesmo traço do Tôin. Hoje a casa, o boi, o pote e o trabuco ainda são desenhados no código.
- Um corpo por pessoa. Hoje Zé, Nonô, Luzia e os cangaceiros reutilizam a folha do Tôin com outra cor.
- Som gravado no lugar do oscilador: berrante grave e tiro seco.
- Um jogo só. Quando a versão Vite estiver estável, o HTML antigo deixa de ser editado.
