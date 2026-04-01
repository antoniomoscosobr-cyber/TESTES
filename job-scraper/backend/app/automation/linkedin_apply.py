import logging

from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.job import Job
from app.models.settings import UserSettings

logger = logging.getLogger(__name__)


async def apply_linkedin_job(
    db: Session,
    job: Job,
    settings: UserSettings,
) -> Application:
    """
    Automatiza candidatura no LinkedIn usando Playwright.
    Requer playwright instalado: playwright install chromium
    """
    if not settings.linkedin_email or not settings.linkedin_pass:
        logger.error("Credenciais LinkedIn nao configuradas")
        app = Application(
            job_id=job.id, metodo="linkedin", status="falhou", notas="Credenciais nao configuradas"
        )
        db.add(app)
        db.commit()
        return app

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            # Login no LinkedIn
            await page.goto("https://www.linkedin.com/login")
            await page.fill("#username", settings.linkedin_email)
            await page.fill("#password", settings.linkedin_pass)
            await page.click("[data-litms-control-urn='login-submit']")
            await page.wait_for_load_state("networkidle")

            # Verificar se login foi bem sucedido
            if "feed" not in page.url and "checkpoint" not in page.url:
                logger.warning("Login LinkedIn pode ter falhado")

            # Navegar para a vaga
            await page.goto(job.url)
            await page.wait_for_load_state("networkidle")

            # Tentar clicar em "Candidatura simplificada" / "Easy Apply"
            easy_apply_btn = await page.query_selector(
                "button.jobs-apply-button, "
                "button[aria-label*='Candidatura'], "
                "button[aria-label*='Easy Apply'], "
                "button[aria-label*='candidatura']"
            )

            if easy_apply_btn:
                await easy_apply_btn.click()
                await page.wait_for_timeout(2000)

                # Tentar submeter se houver botao de enviar
                submit_btn = await page.query_selector(
                    "button[aria-label*='Enviar'], "
                    "button[aria-label*='Submit'], "
                    "button[data-control-name='submit_unify']"
                )
                if submit_btn:
                    await submit_btn.click()
                    await page.wait_for_timeout(2000)
                    logger.info(f"Candidatura LinkedIn enviada: {job.titulo}")

                    app = Application(job_id=job.id, metodo="linkedin", status="enviada")
                    db.add(app)
                    db.commit()
                    db.refresh(app)
                    await browser.close()
                    return app
                else:
                    # Formulario multi-step - registrar como pendente
                    logger.info(f"Vaga requer formulario completo: {job.titulo}")
                    app = Application(
                        job_id=job.id,
                        metodo="linkedin",
                        status="pendente",
                        notas="Formulario multi-step detectado - requer intervencao manual",
                    )
                    db.add(app)
                    db.commit()
                    await browser.close()
                    return app
            else:
                logger.info(f"Botao Easy Apply nao encontrado: {job.titulo}")
                app = Application(
                    job_id=job.id,
                    metodo="linkedin",
                    status="falhou",
                    notas="Candidatura simplificada nao disponivel",
                )
                db.add(app)
                db.commit()
                await browser.close()
                return app

    except ImportError:
        logger.error("Playwright nao instalado. Execute: playwright install chromium")
        app = Application(
            job_id=job.id, metodo="linkedin", status="falhou", notas="Playwright nao instalado"
        )
        db.add(app)
        db.commit()
        return app
    except Exception as e:
        logger.error(f"Erro na candidatura LinkedIn para '{job.titulo}': {e}")
        app = Application(
            job_id=job.id, metodo="linkedin", status="falhou", notas=str(e)[:500]
        )
        db.add(app)
        db.commit()
        return app
