import logging
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}


class LinkedInScraper(BaseScraper):
    """Scraper para vagas publicas do LinkedIn (sem login necessario)."""

    fonte = "linkedin"
    base_url = "https://www.linkedin.com/jobs/search"

    def build_url(self, keyword: str, location: str, start: int = 0) -> str:
        q = quote_plus(keyword)
        geo_id = "106057199"  # Brasil
        return (
            f"{self.base_url}?"
            f"keywords={q}"
            f"&location={quote_plus(location)}"
            f"&geoId={geo_id}"
            f"&f_WT=2"  # Remoto
            f"&start={start}"
        )

    def parse_job_card(self, card) -> dict | None:
        try:
            title_el = card.find("h3", class_="base-search-card__title")
            if not title_el:
                return None
            title = title_el.get_text(strip=True)

            link_el = card.find("a", class_="base-card__full-link") or card.find("a", href=True)
            if not link_el:
                return None
            url = link_el.get("href", "")
            if "?" in url:
                url = url.split("?")[0]

            company_el = card.find("h4", class_="base-search-card__subtitle") or card.find(
                "a", class_="hidden-nested-link"
            )
            company = company_el.get_text(strip=True) if company_el else "Empresa nao informada"

            location_el = card.find("span", class_="job-search-card__location")
            location = location_el.get_text(strip=True) if location_el else ""

            date_el = card.find("time")
            date_posted = date_el.get("datetime", "") if date_el else ""

            return {
                "titulo": title,
                "empresa": company,
                "localizacao": location,
                "url": url,
                "salario": "",
                "descricao": "",
                "data_publicacao_str": date_posted,
            }
        except Exception as e:
            logger.error(f"Erro ao parsear card LinkedIn: {e}")
            return None

    def search(self, keywords: list[str], location: str = "Brasil") -> list[dict]:
        all_jobs = []

        for keyword in keywords:
            try:
                url = self.build_url(keyword, location)
                logger.info(f"LinkedIn: buscando '{keyword}' em '{location}'")

                response = requests.get(url, headers=HEADERS, timeout=15)
                if response.status_code != 200:
                    logger.warning(f"LinkedIn retornou status {response.status_code}")
                    self.rate_limit()
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                job_cards = soup.find_all("div", class_="base-card")
                if not job_cards:
                    job_cards = soup.find_all("li", class_="jobs-search__result-card")

                for card in job_cards:
                    job = self.parse_job_card(card)
                    if job:
                        job.pop("data_publicacao_str", None)
                        seen_urls = {j["url"] for j in all_jobs}
                        if job["url"] not in seen_urls:
                            all_jobs.append(job)

                logger.info(f"LinkedIn: {len(job_cards)} cards encontrados para '{keyword}'")
                self.rate_limit()

            except requests.RequestException as e:
                logger.error(f"Erro de rede LinkedIn para '{keyword}': {e}")
                self.rate_limit()
            except Exception as e:
                logger.error(f"Erro inesperado LinkedIn para '{keyword}': {e}")
                self.rate_limit()

        return all_jobs
