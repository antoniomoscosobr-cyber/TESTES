import time
import random
import logging
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from app.models.job import Job

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Classe base para todos os scrapers de vagas."""

    fonte: str = ""
    base_url: str = ""

    def __init__(self, db: Session):
        self.db = db

    def rate_limit(self, min_seconds: float = 2.0, max_seconds: float = 5.0):
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)

    def save_job(self, job_data: dict) -> Job | None:
        existing = self.db.query(Job).filter(Job.url == job_data["url"]).first()
        if existing:
            logger.info(f"Vaga ja existe: {job_data['titulo']} - {job_data['empresa']}")
            return None

        job = Job(
            titulo=job_data.get("titulo", ""),
            empresa=job_data.get("empresa", ""),
            localizacao=job_data.get("localizacao", ""),
            url=job_data["url"],
            fonte=self.fonte,
            descricao=job_data.get("descricao", ""),
            salario=job_data.get("salario", ""),
            data_publicacao=job_data.get("data_publicacao"),
            email_contato=job_data.get("email_contato", ""),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        logger.info(f"Nova vaga salva: {job.titulo} - {job.empresa}")
        return job

    @abstractmethod
    def search(self, keywords: list[str], location: str = "Brasil") -> list[dict]:
        pass

    def run(self, keywords: list[str], location: str = "Brasil") -> int:
        logger.info(f"Iniciando scraping {self.fonte} para: {keywords}")
        jobs_found = self.search(keywords, location)
        saved_count = 0
        for job_data in jobs_found:
            result = self.save_job(job_data)
            if result:
                saved_count += 1
        logger.info(f"{self.fonte}: {len(jobs_found)} encontradas, {saved_count} novas salvas")
        return saved_count
