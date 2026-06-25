from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import requests


GITHUB_API_URL = "https://api.github.com"
DEFAULT_OUTPUT = Path("data/github_top_contributors_monthly.csv")
DEFAULT_REPO_LIMIT = 10
DEFAULT_CONTRIBUTOR_LIMIT = 100


CSV_COLUMNS = [
    "coletado_em",
    "repo_rank",
    "repo_nome_completo",
    "repo_nome",
    "repo_url",
    "repo_criado_em",
    "repo_estrelas",
    "contribuinte_rank",
    "contribuinte_login",
    "contribuinte_id",
    "contribuinte_url",
    "commits_total",
    "adicoes_total",
    "remocoes_total",
    "ano",
    "mes",
    "ano_mes",
    "commits_mes",
    "adicoes_mes",
    "remocoes_mes",
]


@dataclass(frozen=True)
class Repository:
    rank: int
    full_name: str
    name: str
    html_url: str
    created_at: str
    stars: int


@dataclass(frozen=True)
class ContributorMonth:
    commits: int = 0
    additions: int = 0
    deletions: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extrai os 100 maiores contribuintes dos 10 repositorios publicos "
            "mais estrelados do GitHub e salva uma serie mensal em CSV."
        )
    )
    parser.add_argument(
        "--token",
        default=os.getenv("GITHUB_TOKEN"),
        help="Token do GitHub. Se omitido, usa a variavel de ambiente GITHUB_TOKEN.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"Caminho do CSV de saida. Padrao: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--repo-limit",
        type=int,
        default=DEFAULT_REPO_LIMIT,
        help=f"Quantidade de repositorios por estrelas. Padrao: {DEFAULT_REPO_LIMIT}.",
    )
    parser.add_argument(
        "--contributor-limit",
        type=int,
        default=DEFAULT_CONTRIBUTOR_LIMIT,
        help=(
            "Quantidade de contribuintes por commits em cada repositorio. "
            f"Padrao: {DEFAULT_CONTRIBUTOR_LIMIT}."
        ),
    )
    parser.add_argument(
        "--stats-retries",
        type=int,
        default=12,
        help="Tentativas para aguardar o GitHub calcular /stats/contributors.",
    )
    parser.add_argument(
        "--stats-wait",
        type=int,
        default=10,
        help="Segundos entre tentativas quando /stats/contributors retorna 202.",
    )
    parser.add_argument(
        "--request-wait",
        type=float,
        default=1.0,
        help="Pausa curta entre requisicoes para reduzir risco de rate limit.",
    )
    parser.add_argument(
        "--only-active-months",
        action="store_true",
        help="Salva apenas meses com atividade. Por padrao inclui meses zerados.",
    )
    return parser.parse_args()


def make_session(token: str | None) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "github-repository-contributor-extractor",
        }
    )

    if token:
        session.headers["Authorization"] = f"Bearer {token}"
    else:
        print(
            "Aviso: nenhum token foi informado. A API sem autenticacao tem limite baixo.",
            file=sys.stderr,
        )

    return session


def request_json(
    session: requests.Session,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    expected_statuses: set[int] | None = None,
    request_wait: float = 1.0,
) -> tuple[int, Any, requests.Response]:
    expected = expected_statuses or {200}
    url = f"{GITHUB_API_URL}{path}"

    while True:
        response = session.get(url, params=params, timeout=60)

        if response.status_code in expected:
            payload = response.json() if response.content else None
            time.sleep(request_wait)
            return response.status_code, payload, response

        if response.status_code == 403 and response.headers.get("X-RateLimit-Remaining") == "0":
            reset_at = int(response.headers.get("X-RateLimit-Reset", "0"))
            wait_seconds = max(reset_at - int(time.time()), 0) + 5
            reset_time = datetime.fromtimestamp(reset_at, tz=timezone.utc).isoformat()
            print(
                f"Rate limit atingido. Aguardando ate {reset_time} UTC ({wait_seconds}s)."
            )
            time.sleep(wait_seconds)
            continue

        message = extract_error_message(response)
        raise RuntimeError(f"Erro {response.status_code} em {url}: {message}")


def extract_error_message(response: requests.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text.strip()

    if isinstance(data, dict):
        return str(data.get("message", data))
    return str(data)


def fetch_top_repositories(
    session: requests.Session,
    *,
    repo_limit: int,
    request_wait: float,
) -> list[Repository]:
    status, payload, _ = request_json(
        session,
        "/search/repositories",
        params={
            "q": "stars:>1 fork:false",
            "sort": "stars",
            "order": "desc",
            "per_page": repo_limit,
        },
        expected_statuses={200},
        request_wait=request_wait,
    )

    if status != 200 or not isinstance(payload, dict):
        raise RuntimeError("Resposta inesperada ao buscar repositorios por estrelas.")

    repositories = []
    for index, item in enumerate(payload.get("items", []), start=1):
        repositories.append(
            Repository(
                rank=index,
                full_name=item["full_name"],
                name=item["name"],
                html_url=item["html_url"],
                created_at=item["created_at"],
                stars=int(item.get("stargazers_count", 0)),
            )
        )

    return repositories


def fetch_contributor_stats(
    session: requests.Session,
    repository: Repository,
    *,
    stats_retries: int,
    stats_wait: int,
    request_wait: float,
) -> list[dict[str, Any]]:
    path = f"/repos/{repository.full_name}/stats/contributors"

    for attempt in range(1, stats_retries + 1):
        status, payload, _ = request_json(
            session,
            path,
            expected_statuses={200, 202, 204},
            request_wait=request_wait,
        )

        if status == 200:
            if not isinstance(payload, list):
                raise RuntimeError(
                    f"Resposta inesperada em stats/contributors para {repository.full_name}."
                )
            return payload

        if status == 204:
            print(f"Sem estatisticas disponiveis para {repository.full_name}.")
            return []

        print(
            f"GitHub ainda esta calculando {repository.full_name} "
            f"({attempt}/{stats_retries}). Aguardando {stats_wait}s."
        )
        time.sleep(stats_wait)

    raise RuntimeError(
        f"GitHub nao concluiu as estatisticas de {repository.full_name} "
        f"apos {stats_retries} tentativas."
    )


def month_range(start_iso: str, end: date) -> list[str]:
    start_dt = parse_github_datetime(start_iso).date()
    current = date(start_dt.year, start_dt.month, 1)
    last = date(end.year, end.month, 1)
    months = []

    while current <= last:
        months.append(f"{current.year:04d}-{current.month:02d}")
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    return months


def parse_github_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def week_to_month(timestamp: int) -> str:
    week_start = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    return f"{week_start.year:04d}-{week_start.month:02d}"


def top_contributors(
    stats: list[dict[str, Any]],
    *,
    contributor_limit: int,
) -> list[dict[str, Any]]:
    valid_stats = [item for item in stats if item.get("author")]
    return sorted(
        valid_stats,
        key=lambda item: (
            int(item.get("total", 0)),
            item["author"].get("login", ""),
        ),
        reverse=True,
    )[:contributor_limit]


def aggregate_months(contributor: dict[str, Any]) -> dict[str, ContributorMonth]:
    monthly: dict[str, ContributorMonth] = {}
    totals = defaultdict(lambda: {"commits": 0, "additions": 0, "deletions": 0})

    for week in contributor.get("weeks", []):
        month_key = week_to_month(int(week["w"]))
        totals[month_key]["commits"] += int(week.get("c", 0))
        totals[month_key]["additions"] += int(week.get("a", 0))
        totals[month_key]["deletions"] += int(week.get("d", 0))

    for month_key, values in totals.items():
        monthly[month_key] = ContributorMonth(
            commits=values["commits"],
            additions=values["additions"],
            deletions=values["deletions"],
        )

    return monthly


def contributor_totals(contributor: dict[str, Any]) -> tuple[int, int, int]:
    weeks = contributor.get("weeks", [])
    commits = int(contributor.get("total", 0))
    additions = sum(int(week.get("a", 0)) for week in weeks)
    deletions = sum(int(week.get("d", 0)) for week in weeks)
    return commits, additions, deletions


def build_rows_for_repository(
    repository: Repository,
    contributors: list[dict[str, Any]],
    *,
    contributor_limit: int,
    collected_at: str,
    include_zero_months: bool,
) -> list[dict[str, Any]]:
    rows = []
    repo_months = month_range(repository.created_at, datetime.now(timezone.utc).date())

    for contributor_rank, contributor in enumerate(
        top_contributors(contributors, contributor_limit=contributor_limit),
        start=1,
    ):
        author = contributor["author"]
        commits_total, additions_total, deletions_total = contributor_totals(contributor)
        monthly = aggregate_months(contributor)
        month_keys = repo_months if include_zero_months else sorted(monthly.keys())

        for month_key in month_keys:
            month_stats = monthly.get(month_key, ContributorMonth())
            year, month = month_key.split("-")
            rows.append(
                {
                    "coletado_em": collected_at,
                    "repo_rank": repository.rank,
                    "repo_nome_completo": repository.full_name,
                    "repo_nome": repository.name,
                    "repo_url": repository.html_url,
                    "repo_criado_em": repository.created_at,
                    "repo_estrelas": repository.stars,
                    "contribuinte_rank": contributor_rank,
                    "contribuinte_login": author.get("login", ""),
                    "contribuinte_id": author.get("id", ""),
                    "contribuinte_url": author.get("html_url", ""),
                    "commits_total": commits_total,
                    "adicoes_total": additions_total,
                    "remocoes_total": deletions_total,
                    "ano": int(year),
                    "mes": int(month),
                    "ano_mes": month_key,
                    "commits_mes": month_stats.commits,
                    "adicoes_mes": month_stats.additions,
                    "remocoes_mes": month_stats.deletions,
                }
            )

    return rows


def write_csv(rows: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()
    session = make_session(args.token)
    output_path = Path(args.output)
    include_zero_months = not args.only_active_months
    collected_at = datetime.now(timezone.utc).isoformat()
    all_rows: list[dict[str, Any]] = []

    print(
        f"Buscando os {args.repo_limit} repositorios publicos nao-forks "
        "com mais estrelas no GitHub."
    )
    repositories = fetch_top_repositories(
        session,
        repo_limit=args.repo_limit,
        request_wait=args.request_wait,
    )

    for repository in repositories:
        print(
            f"[{repository.rank}/{len(repositories)}] Extraindo {repository.full_name} "
            f"({repository.stars} estrelas)."
        )
        contributors = fetch_contributor_stats(
            session,
            repository,
            stats_retries=args.stats_retries,
            stats_wait=args.stats_wait,
            request_wait=args.request_wait,
        )
        rows = build_rows_for_repository(
            repository,
            contributors,
            contributor_limit=args.contributor_limit,
            collected_at=collected_at,
            include_zero_months=include_zero_months,
        )
        all_rows.extend(rows)
        print(
            f"-> {repository.full_name}: {len(top_contributors(contributors, contributor_limit=args.contributor_limit))} "
            f"contribuintes e {len(rows)} linhas mensais."
        )

    write_csv(all_rows, output_path)
    print(f"\nExtracao finalizada: {len(all_rows)} linhas salvas em {output_path}.")


if __name__ == "__main__":
    main()
