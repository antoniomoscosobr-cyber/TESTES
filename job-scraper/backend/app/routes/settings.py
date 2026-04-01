import json

from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import UserSettings

router = APIRouter(prefix="/settings", tags=["Configuracoes"])


class UpdateSettings(BaseModel):
    palavras_chave: list[str] | None = None
    localizacao: str | None = None
    modalidade: str | None = None
    email_smtp_host: str | None = None
    email_smtp_port: int | None = None
    email_smtp_user: str | None = None
    email_smtp_pass: str | None = None
    linkedin_email: str | None = None
    linkedin_pass: str | None = None
    intervalo_busca: int | None = None


def get_or_create_settings(db: Session) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return settings.to_dict()


@router.put("/")
def update_settings(data: UpdateSettings, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)

    if data.palavras_chave is not None:
        settings.palavras_chave = json.dumps(data.palavras_chave)
    if data.localizacao is not None:
        settings.localizacao = data.localizacao
    if data.modalidade is not None:
        settings.modalidade = data.modalidade
    if data.email_smtp_host is not None:
        settings.email_smtp_host = data.email_smtp_host
    if data.email_smtp_port is not None:
        settings.email_smtp_port = data.email_smtp_port
    if data.email_smtp_user is not None:
        settings.email_smtp_user = data.email_smtp_user
    if data.email_smtp_pass is not None:
        settings.email_smtp_pass = data.email_smtp_pass
    if data.linkedin_email is not None:
        settings.linkedin_email = data.linkedin_email
    if data.linkedin_pass is not None:
        settings.linkedin_pass = data.linkedin_pass
    if data.intervalo_busca is not None:
        settings.intervalo_busca = data.intervalo_busca

    db.commit()
    db.refresh(settings)
    return settings.to_dict()


@router.post("/curriculo")
async def upload_curriculo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        return {"error": "Apenas arquivos PDF sao aceitos"}

    save_path = f"./uploads/{file.filename}"
    import os
    os.makedirs("./uploads", exist_ok=True)

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    settings = get_or_create_settings(db)
    settings.curriculo_path = save_path
    db.commit()

    return {"message": "Curriculo enviado com sucesso", "path": save_path}
