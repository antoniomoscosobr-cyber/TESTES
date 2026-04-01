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


class IndeedScraper(BaseScraper):
    fonte = "indeed"
    base_url = "https://br.indeed.com"

    def build_url(self, keyword: str, location: str, start: int = 0) -> str:
        q = quote_plus(keyword)
        l = quote_plus(location)
        return f"{self.base_url}/jobs?q={q}&l={l}&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11&start={start}"

    def parse_job_card(self, card) -> dict | None:
        try:
            title_el = card.find("h2", class_="jobTitle") or card.find("a", {"data-jk": True})
            if not title_el:
                return None

            title = title_el.get_text(strip=True)

            link_el = card.find("a", href=True)
            if not link_el:
                return None
            href = link_el["href"]
            if href.startswith("/"):
                href = f"{self.base_url}{href}"

            company_el = card.find("span", {"data-testid": "company-name"}) or card.find(
                "span", class_="companyName"
            )
            company = company_el.get_text(strip=True) if company_el else "Empresa nao informada"

            location_el = card.find("div", {"data-testid": "text-location"}) or card.find(
                "div", class_="companyLocation"
            )
            location = location_el.get_text(strip=True) if location_el else ""

            salary_el = card.find("div", {"data-testid": "attribute_snippet_testid"})
            salary = salary_el.get_text(strip=True) if salary_el else ""

            snippet_el = card.find("div", class_="job-snippet") or card.find(
                "table", class_="jobCardShelfContainer"
            )
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            return {
                "titulo": title,
                "empresa": company,
                "localizacao": location,
                "url": href,
                "salario": salary,
                "descricao": snippet,
            }
        except Exception as e:
            logger.error(f"Erro ao parsear card Indeed: {e}")
            return None

    def search(self, keywords: list[str], location: str = "Brasil") -> list[dict]:
        all_jobs = []

        for keyword in keywords:
            try:
                url = self.build_url(keyword, location)
                logger.info(f"Indeed: buscando '{keyword}' em '{location}'")

                response = requests.get(url, headers=HEADERS, timeout=15)
                if response.status_code != 200:
                    logger.warning(f"Indeed retornou status {response.status_code}")
                    self.rate_limit()
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                job_cards = soup.find_all("div", class_="job_seen_beacon") or soup.find_all(
                    "div", class_="jobsearch-ResultsList"
                )

                if not job_cards:
                    job_cards = soup.find_all("li", {"data-testid": lambda x: x and "result" in x})

                for card in job_cards:
                    job = self.parse_job_card(card)
                    if job:
                        seen_urls = {j["url"] for j in all_jobs}
                        if job["url"] not in seen_urls:
                            all_jobs.append(job)

                logger.info(f"Indeed: {len(job_cards)} cards encontrados para '{keyword}'")
                self.rate_limit()

            except requests.RequestException as e:
                logger.error(f"Erro de rede Indeed para '{keyword}': {e}")
                self.rate_limit()
            except Exception as e:
                logger.error(f"Erro inesperado Indeed para '{keyword}': {e}")
                self.rate_limit()

        return all_jobs
