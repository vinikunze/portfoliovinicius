# Vinicius. Sites Premium & Web IA

Portfólio e página do link da bio. Uma página só, mobile first, em HTML, CSS e JS puros
(sem etapa de build). Publicada no GitHub Pages pelo GitHub Actions.

**No ar:** https://vinikunze.github.io/portfoliovinicius/
**Link da bio do Instagram:** https://vinikunze.github.io/portfoliovinicius/?utm_source=instagram&utm_medium=bio

## O que editar no dia a dia

| Quero... | Arquivo |
|---|---|
| Incluir, tirar ou mudar um projeto | `projects.json` |
| Colocar o ID do Google Tag Manager, meu @ do Instagram ou mudar a mensagem do WhatsApp | `config.js` |
| Trocar a logo | coloque `assets/brand/logo.png` (fundo preto, quadrada) |
| Adicionar vídeos (Reels) | `assets/videos/` (veja o README de lá) |
| Usar domínio próprio | `CNAME` (veja abaixo) |

Depois de editar, é só fazer o commit/push (pode ser pelo próprio site do GitHub).
O GitHub Actions tira os prints de novo, publica e verifica a página sozinho.

### Incluir um projeto novo

Copie um bloco do `projects.json` e ajuste:

```json
{
  "slug": "nome-curto-sem-espaco",
  "nome": "Nome do Cliente",
  "artigo": "do",
  "cidade": "Sinop, MT",
  "categoria": "Saúde",
  "segmento": "Clínica odontológica",
  "tipo": "Site institucional",
  "url": "https://site-do-cliente.com.br",
  "destaque": false,
  "destaques": ["Primeiro destaque", "Segundo destaque", "Terceiro destaque"],
  "video": ""
}
```

- `categoria`: Restaurantes, Saúde, Automotivo, Indústria e Comércio ou Institucional.
- `destaque: true` coloca o projeto nos cards grandes do topo (até 3).
- `artigo`: "do" ou "da", usado em textos como "Site da Dra. Gabriela".
- `urlCelular` (opcional): outra página para o print do celular (ex.: sistema de pedidos), com `rotuloCelular`.
- `linksExtras` (opcional): botões a mais, ex.: `[{"rotulo": "Ver sistema de pedidos", "url": "https://..."}]`.
- `prints`, `online`, `verificadoEm` são preenchidos automaticamente. Não precisa mexer.
- Projeto sem `url` ou fora do ar não aparece na página.

## Prints automáticos (`npm run prints`)

Abre cada site, confirma se está no ar, fecha banners de cookies, esconde botões flutuantes e tira:
desktop 1440x900, celular 390x844 e celular página inteira. Converte para WebP (qualidade 80, até 1600px,
com versões menores para `srcset`), atualiza o `projects.json`, gera os ícones a partir da logo
e a imagem de compartilhamento (`assets/og/og-image.jpg`, 1200x630).

Para rodar no seu computador:

```bash
npm install
npx playwright install chromium   # só na primeira vez
npm run prints                    # todos os projetos
npm run prints -- --only=egao-sushi,betao-pneus
npm run serve                     # abre a página em http://localhost:8080
npm run verify -- http://localhost:8080/
```

## Medição (Google Tag Manager)

Coloque o ID em `config.js` (`gtmId: "GTM-XXXXXXX"`). Sem ID, nada é carregado.
Eventos enviados ao `dataLayer`:

| Evento | Quando | Campos |
|---|---|---|
| `clique_whatsapp` | qualquer botão de WhatsApp | `local` (topo, menu, destaque_quero_assim, botao_fixo...), `projeto` |
| `clique_instagram` | botão do Instagram | `local` |
| `clique_ver_site` | "Ver site no ar" | `projeto`, `local` |
| `filtro_categoria` | filtro da grade | `categoria` |
| `play_video` | play em um vídeo | `projeto` |

Todos levam também `utm_source`, `utm_medium` e `utm_campaign` da URL.
No GTM: crie um acionador "Evento personalizado" com o nome do evento e variáveis da camada de dados `projeto` e `local`.

## Domínio próprio (registro.br)

1. Escreva o domínio no arquivo `CNAME` (só ele, ex.: `www.viniciussites.com.br`) e faça o commit.
   O GitHub Actions troca sozinho os endereços do site (canonical, Open Graph, sitemap).
2. No registro.br, entre no domínio, em **DNS > Configurar zona DNS** (use os DNS do Registro.br) e crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | (vazio, raiz) | 185.199.108.153 |
| A | (vazio, raiz) | 185.199.109.153 |
| A | (vazio, raiz) | 185.199.110.153 |
| A | (vazio, raiz) | 185.199.111.153 |
| AAAA | (vazio, raiz) | 2606:50c0:8000::153 |
| AAAA | (vazio, raiz) | 2606:50c0:8001::153 |
| AAAA | (vazio, raiz) | 2606:50c0:8002::153 |
| AAAA | (vazio, raiz) | 2606:50c0:8003::153 |
| CNAME | www | vinikunze.github.io |

3. No GitHub: **Settings > Pages > Custom domain**, digite `www.seudominio.com.br`, salve,
   espere o check verde e marque **Enforce HTTPS** (o certificado pode levar até 24 h).
4. Recomendado: **Settings (da sua conta) > Pages > Add a domain** para verificar o domínio
   (cria um registro TXT `_github-pages-challenge-vinikunze` no registro.br). Isso impede que outra pessoa use seu domínio.

A propagação do DNS no registro.br costuma levar de alguns minutos a 2 horas.
