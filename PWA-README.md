# PWA Configuration for byomess.github.io

Este projeto agora está configurado como um Progressive Web App (PWA) com foco especial no jogo Hype Hero.

## Arquivos PWA Criados

- `manifest.json` - Configuração do app manifest
- `sw.js` - Service Worker para cache offline
- `generate-icons.html` - Gerador de ícones para o PWA

## Como gerar os ícones

1. Abra o arquivo `generate-icons.html` no navegador
2. Baixe todos os ícones gerados
3. Coloque-os na raiz do projeto (`/`)

## Funcionalidades PWA Implementadas

### ✅ Instalabilidade
- App pode ser instalado em dispositivos móveis e desktop
- Ícones personalizados para diferentes tamanhos
- Shortcuts para acesso rápido ao jogo

### ✅ Funcionalidade Offline
- Cache inteligente de recursos essenciais
- Jogo funciona offline após primeira visita
- Service Worker atualizado automaticamente

### ✅ Experiência Nativa
- Tela cheia automática quando instalado
- Suporte a orientações portrait e landscape
- Otimizado para dispositivos móveis
- Prevenção de zoom e scroll indesejados

### ✅ Performance
- Cache de bibliotecas externas (PixiJS, ToneJS)
- Cache de arquivos de música e charts
- Carregamento otimizado

## Configurações Específicas do Hype Hero

### Orientação
- Suporte completo a portrait e landscape
- Detecção automática de mudanças de orientação
- Layout responsivo mantido

### Tela Cheia
- Ativação automática quando rodando como PWA
- Controles de tela cheia integrados
- Experiência imersiva de jogo

### Controles Touch
- Prevenção de zoom por pinch
- Bloqueio de scroll durante o jogo
- Otimizado para touch em dispositivos móveis

## Deploy

1. Faça commit de todos os arquivos PWA
2. Certifique-se de que os ícones estão na raiz do projeto
3. Push para GitHub Pages
4. Teste a instalação em dispositivos móveis

## Teste de Funcionalidade

### No Chrome DevTools:
1. Abra as DevTools (F12)
2. Vá para a aba "Application"
3. Verifique "Manifest" e "Service Workers"
4. Use "Lighthouse" para auditoria PWA

### Em dispositivos móveis:
1. Acesse byomess.github.io/hype-hero
2. Procure por prompt de instalação
3. Teste funcionamento offline
4. Verifique orientação e tela cheia

## Melhorias Futuras

- [ ] Notificações push para novos charts
- [ ] Sincronização de scores offline
- [ ] Compartilhamento de resultados
- [ ] Background sync para downloads
- [ ] Update automático de conteúdo

## Troubleshooting

### Service Worker não registra:
- Verifique se está servindo via HTTPS
- Confirme que o arquivo sw.js está na raiz
- Limpe cache do navegador

### App não instala:
- Verifique manifest.json
- Confirme que os ícones existem
- Use Chrome DevTools para debug

### Offline não funciona:
- Verifique console para erros de cache
- Confirme que recursos estão listados no SW
- Teste carregamento offline após cache completo
