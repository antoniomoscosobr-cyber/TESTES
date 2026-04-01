import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.job import Job
from app.models.settings import UserSettings

logger = logging.getLogger(__name__)


def build_email_body(job: Job, nome_candidato: str = "") -> str:
    return f"""Prezado(a) Recrutador(a),

Venho por meio deste demonstrar meu interesse na vaga de {job.titulo} na empresa {job.empresa}.

Possuo experiencia nas areas de Design, Motion Design e Edicao de Video, e acredito que meu perfil se alinha com os requisitos da posicao.

Segue em anexo meu curriculo para apreciacao.

Fico a disposicao para uma conversa.

Atenciosamente,
{nome_candidato}
"""


def send_application_email(
    db: Session,
    job: Job,
    settings: UserSettings,
) -> Application:
    """Envia email de candidatura com curriculo anexo."""
    if not job.email_contato:
        logger.warning(f"Vaga {job.id} nao tem email de contato")
        app = Application(job_id=job.id, metodo="email", status="falhou", notas="Sem email de contato")
        db.add(app)
        db.commit()
        return app

    if not settings.email_smtp_user or not settings.email_smtp_pass:
        logger.error("Credenciais SMTP nao configuradas")
        app = Application(job_id=job.id, metodo="email", status="falhou", notas="SMTP nao configurado")
        db.add(app)
        db.commit()
        return app

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.email_smtp_user
        msg["To"] = job.email_contato
        msg["Subject"] = f"Candidatura - {job.titulo} | {job.empresa}"

        body = build_email_body(job, nome_candidato=settings.email_smtp_user.split("@")[0])
        msg.attach(MIMEText(body, "plain", "utf-8"))

        # Anexar curriculo
        resume_path = Path(settings.curriculo_path)
        if resume_path.exists() and resume_path.suffix == ".pdf":
            with open(resume_path, "rb") as f:
                pdf = MIMEApplication(f.read(), _subtype="pdf")
                pdf.add_header("Content-Disposition", "attachment", filename=resume_path.name)
                msg.attach(pdf)
        else:
            logger.warning(f"Curriculo nao encontrado: {settings.curriculo_path}")

        # Enviar
        with smtplib.SMTP(settings.email_smtp_host, settings.email_smtp_port) as server:
            server.starttls()
            server.login(settings.email_smtp_user, settings.email_smtp_pass)
            server.send_message(msg)

        logger.info(f"Email enviado para {job.email_contato} - Vaga: {job.titulo}")

        app = Application(job_id=job.id, metodo="email", status="enviada")
        db.add(app)
        db.commit()
        db.refresh(app)
        return app

    except Exception as e:
        logger.error(f"Erro ao enviar email para {job.email_contato}: {e}")
        app = Application(job_id=job.id, metodo="email", status="falhou", notas=str(e))
        db.add(app)
        db.commit()
        return app
