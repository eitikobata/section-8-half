# Assets pendentes

## alert.mp3
Som da sirene, tocado uma vez quando um novo incidente chega.
- Corta na duração que quiser
- Formato mp3, qualquer bitrate razoável

## character-banner.png
Personagem do banner full-width (acima de "Monitored Entities").
- **140px de altura**, largura livre/proporcional
- Fundo transparente (PNG)
- Corte: busto (ombros pra cima)

## character-dispatch.png
Personagem docked no topo do card de decisão (AI Analysis Card).
- **640px de largura × 180-220px de altura** (formato faixa larga/cinemático)
- Fundo opaco tá ok agora — tema SNES/PS1 (cena com fundo, tipo tela de
  diálogo de RPG antigo)
- `object-cover` corta pra preencher o frame, então não precisa bater
  a proporção exata — qualquer imagem nessa faixa de tamanho encaixa

Enquanto esses arquivos não existirem, o código lida bem com a
ausência: a imagem não aparece (sem ícone quebrado) e o áudio falha
silenciosamente no console.
