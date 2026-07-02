# Visualizacao de repositorios do GitHub

Visualizacao interativa de popularidade, manutencao, dominios e contribuicoes em repositorios publicos do GitHub.

## Executar

Requer Node.js 20 ou superior.

```powershell
npm run serve
```

O servidor informa a URL local no terminal. Os arquivos em `data/*.js` permitem que a pagina carregue os dados sem depender de requisicoes JSON em ambientes estaticos.

## Arquitetura da interface

O JavaScript do navegador esta separado por responsabilidade:

- `src/app.js`: ponto de entrada e tratamento de falhas.
- `src/data.js`: carregamento, deduplicacao defensiva e normalizacao.
- `src/state.js`: estado compartilhado e formatadores.
- `src/filters.js`: debounce, filtros e paginacao.
- `src/charts.js`: calculos analiticos, resumos e renderizadores D3.
- `src/tooltips.js`: tooltips, foco e acessibilidade das marcas SVG.

A busca usa debounce de 280 ms. Os graficos sao renderizados por `IntersectionObserver` quando se aproximam da area visivel e atualizados somente quando estao visiveis novamente. A tabela mostra 25 registros por pagina.

Pontos, barras, celulas e fatias podem receber foco por teclado. `Enter` ou `Espaco` exibe os detalhes; pontos com URL abrem o repositorio. Cada grafico tambem possui um resumo textual visivel e associado por `aria-describedby`.

A navegacao organiza a leitura em quatro capitulos: Visao geral, Ecossistema, Contribuidores e Ranking. Dois repositorios sao comparados por padrao e um terceiro pode ser adicionado. Barras de dominio e linguagem, celulas dos mapas de calor e legendas de dominio, linguagem e tipo de conta atuam como filtros cruzados.

Busca, dominios, linguagem, tipo de conta e os tres repositorios de comparacao sao gravados na query string. Assim, recarregar ou compartilhar a URL restaura o mesmo recorte.

O recorte filtrado pode ser exportado pelos botoes `CSV` e `PNG`. O CSV inclui todas as linhas e metadados da coleta; a imagem gera um resumo com KPIs e os 14 primeiros repositorios. Campos iniciados por caracteres de formula recebem protecao antes de serem gravados no CSV.

## Pipeline de dados

Toda coleta e preparacao esta em `scripts/data-pipeline.mjs`.

Preparar o dataset de repositorios a partir de CSV ou JSON:

```powershell
npm run prepare-data -- --repository-source data/raw/github-top-repositories.csv
```

Preparar tambem um historico de contribuidores existente:

```powershell
npm run prepare-data -- --repository-source data/raw/github-top-repositories.csv --contributor-source data/raw/github-top-contributors-monthly.csv
```

Coletar os 100 maiores contribuidores dos 10 repositorios publicos nao-forks com mais estrelas e preparar a saida:

```powershell
$env:GITHUB_TOKEN="seu_token"
npm run collect-data
```

Registrar um snapshot atualizado de estrelas e forks para os repositorios ja preparados:

```powershell
$env:GITHUB_TOKEN="seu_token"
npm run snapshot-data
```

Para criar apenas a linha de base a partir do arquivo local, sem consultar a API:

```powershell
npm run snapshot-data -- --offline
```

Opcoes importantes:

- `--repository-limit`: limite de repositorios unicos preparados, padrao `1000`.
- `--repository-count`: repositorios consultados na API, padrao `10`.
- `--contributor-count`: contribuidores por repositorio, padrao `100`.
- `--raw-output`: CSV bruto produzido pela coleta.
- `--snapshot-source`: JSON ou CSV com os repositorios acompanhados, padrao `data/github-top-repositories.json`.
- `--snapshot-limit`: quantidade maxima de repositorios atualizados em uma rodada, padrao `1000`.
- `--offline`: registra os valores da fonte como linha de base sem consultar o GitHub.
- `--output-directory`: diretorio dos JSON e fallbacks JavaScript, padrao `data`.
- `--no-include-zero-months`: omite meses sem atividade na coleta.

Nenhum comando depende de caminhos pessoais. Caminhos de entrada sao sempre explicitos e podem ser relativos ao projeto.

## Metodologia

### Repositorios

1. Cada linha da fonte e normalizada para um esquema comum.
2. Registros sao deduplicados pela chave exata `fullName` antes do limite e do ranking.
3. Os valores de `Domain` das duplicatas sao unidos em `domains[]`, sem perder projetos multidominio.
4. Metricas numericas duplicadas usam o maior valor observado; topicos e dominios usam a uniao dos valores.
5. O ranking e recalculado por estrelas sobre os repositorios unicos.

KPIs gerais, tabela, dispersoes e correlacoes contam cada `fullName` uma unica vez. Graficos de dominio contam um repositorio uma vez em cada dominio associado; por isso a soma das categorias de dominio pode superar o total de repositorios.

O mapa de sobreposicao cruza os 10 dominios mais frequentes e conta quantos repositorios pertencem a cada par. A base atual contem 147 projetos multidominio. Selecionar uma celula aplica simultaneamente os dois dominios.

### Indicador de saude

O indice de saude varia de 0 a 100 e combina:

- 30% de recencia da ultima atualizacao, caindo linearmente ate zero em 730 dias;
- 25% de issues por estrela, em que taxas menores recebem notas maiores e o percentil 90 da base define o limite;
- 25% de forks, normalizados em escala logaritmica pelo maior valor da base;
- 20% de atividade pelo ultimo `push`, caindo linearmente ate zero em 365 dias.

Notas a partir de 75 sao marcadas como `Saudavel`, de 50 a 74 como `Atencao` e abaixo de 50 como `Risco`. O indicador e comparativo e nao substitui uma avaliacao de manutencao, seguranca ou qualidade do codigo.

### Crescimento por snapshots

`scripts/data-pipeline.mjs snapshot` consulta `GET /repos/{owner}/{repo}` e acrescenta uma coleta a `data/repository-snapshots.json`, preservando os valores anteriores. O grafico agrega estrelas ou forks somente para a coorte de repositorios presente em todos os snapshots exibidos. Assim, mudancas de cobertura nao sao confundidas com crescimento.

Com apenas um snapshot, a pagina apresenta uma linha de base e nao calcula variacao. O workflow `.github/workflows/repository-snapshots.yml` executa a coleta toda segunda-feira e grava o resultado no repositorio; tambem pode ser iniciado manualmente.

### Licencas

A distribuicao de licencas conta cada `fullName` uma vez e responde aos filtros globais. Valores vazios, `No License`, `None`, `N/A`, `Unknown` e `NOASSERTION` sao reunidos em `Sem licenca`.

Ausencia de licenca nao significa dominio publico nem permissao implicita de reutilizacao. O painel trata esse grupo separadamente e evita inferir direitos juridicos a partir da popularidade ou da visibilidade do codigo.

### Contribuidores

A coleta usa `GET /search/repositories` e `GET /repos/{owner}/{repo}/stats/contributors`. Os dados semanais retornados pelo GitHub sao agregados por mes UTC. O CSV conserva commits, adicoes e remocoes totais e mensais.

Cada contribuidor recebe uma classificacao de completude:

- `complete`: commits e alteracoes mensais disponiveis.
- `totals_only`: commits mensais e totais historicos de adicoes/remocoes; linhas mensais sao estimadas proporcionalmente aos commits.
- `commits_only`: adicoes/remocoes ausentes; o registro participa apenas das analises de commits.

Valores ausentes nao sao convertidos em zero. Perfis como expansao, limpeza ou refatoracao so sao calculados quando `changesAvailable` e verdadeiro.

As contas sao separadas em `person`, `bot` e `automation`. Coletas novas priorizam `author.type` retornado pelo GitHub. Fontes legadas sem esse campo usam uma heuristica documentada por login: sufixos como `bot` identificam bots, enquanto termos como `autoroll`, `gardener`, `automation` e `automerge` identificam contas de automacao. O campo `accountTypeSource` registra se a origem foi `github`, `source` ou `heuristic`.

A cobertura de linhas e publicada em tres perspectivas:

- contribuidores com adicoes e remocoes sobre o total de contribuidores;
- commits desses contribuidores sobre o total de commits;
- repositorios em que todas as contas do recorte possuem adicoes e remocoes.

### Limitacoes

- Estrelas, forks, issues e ranking representam o momento de coleta da fonte.
- A API de estatisticas pode responder `202` enquanto processa dados ou `204` quando nao ha estatisticas.
- Os 100 contribuidores sao uma amostra por repositorio, nao todo o historico de autoria.
- Adicoes e remocoes descrevem volume de linhas; isoladamente, nao comprovam intencao de refatoracao.
- Correlacao de Pearson indica associacao linear e nao causalidade.
- `watchers` nao participa da matriz de correlacao porque, nesta fonte, frequentemente replica a contagem de estrelas.

O painel separa a data do dataset de repositorios, a coleta dos contribuidores e a preparacao local. Quantidade de registros unicos, fontes e limitacoes tambem aparecem diretamente na pagina.

## Saidas

- `data/github-top-repositories.json` e `.js`: repositorios unicos, dominios e metadados.
- `data/top-contributors-history.json` e `.js`: contribuidores, serie mensal e completude.
- `data/repository-snapshots.json` e `.js`: historico preservado de estrelas e forks.
- `data/raw/github-top-contributors-monthly.csv`: CSV gerado pelo modo de coleta.
