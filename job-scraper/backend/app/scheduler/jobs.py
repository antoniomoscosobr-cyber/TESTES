import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.settings import UserSettings
from app.scrapers.indeed import IndeedScraper
from app.scrapers.linkedin import LinkedInScraper

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def run_scraping():
    """Executa scraping de todas as fontes."""
    logger.info("Iniciando job de scraping agendado...")
    db = SessionLocal()
    try:
        settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
        if not settings:
            logger.warning("Configuracoes nao encontradas. Configure primeiro.")
            return

        keywords = settings.get_keywords()
        location = settings.localizacao or "Brasil"

        # Indeed
        try:
            indeed = IndeedScraper(db)
            indeed_count = indeed.run(keywords[:5], location)  # Limitar keywords por execucao
            logger.info(f"Indeed: {indeed_count} novas vagas salvas")
        except Exception as e:
            logger.error(f"Erro no scraping Indeed: {e}")

        # LinkedIn
        try:
            linkedin = LinkedInScraper(db)
            linkedin_count = linkedin.run(keywords[:5], location)
            logger.info(f"LinkedIn: {linkedin_count} novas vagas salvas")
        except Exception as e:
            logger.error(f"Erro no scraping LinkedIn: {e}")

    finally:
        db.close()
    logger.info("Job de scraping finalizado.")


def start_scheduler(interval_minutes: int = 60):
    """Inicia o scheduler com o intervalo configurado."""
    if scheduler.running:
        scheduler.shutdown(wait=False)

    scheduler.add_job(
        run_scraping,
        "interval",
        minutes=interval_minutes,
        id="scraping_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler iniciado: scraping a cada {interval_minutes} minutos")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler parado")
