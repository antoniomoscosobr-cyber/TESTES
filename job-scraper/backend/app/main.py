import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import init_db, get_db
from app.routes import api_router
from app.scheduler.jobs import start_scheduler, stop_scheduler, run_scraping
from app.models.settings import UserSettings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Iniciar scheduler automaticamente
    try:
        start_scheduler(60)
    except Exception:
        logging.getLogger(__name__).warning("Scheduler nao iniciou automaticamente")
    yield
    stop_scheduler()


app = FastAPI(
    title="JobHunter API",
    description="Sistema de automacao de busca de vagas",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {"message": "JobHunter API esta rodando", "docs": "/docs"}


@app.post("/api/scrape/run")
def trigger_scraping():
    """Executa scraping manualmente."""
    run_scraping()
    return {"message": "Scraping executado com sucesso"}


@app.post("/api/scrape/start-scheduler")
def api_start_scheduler(interval: int = 60):
    start_scheduler(interval)
    return {"message": f"Scheduler iniciado: a cada {interval} minutos"}


@app.post("/api/scrape/stop-scheduler")
def api_stop_scheduler():
    stop_scheduler()
    return {"message": "Scheduler parado"}
