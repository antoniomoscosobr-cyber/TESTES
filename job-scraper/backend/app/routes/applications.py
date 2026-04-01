from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import Application

router = APIRouter(prefix="/applications", tags=["Candidaturas"])


class CreateApplication(BaseModel):
    job_id: int
    metodo: str  # "email" ou "linkedin"
    notas: str = ""


class UpdateApplication(BaseModel):
    status: str | None = None
    notas: str | None = None


@router.get("/")
def list_applications(
    metodo: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Application)

    if metodo:
        query = query.filter(Application.metodo == metodo)
    if status:
        query = query.filter(Application.status == status)

    total = query.count()
    apps = (
        query.order_by(Application.enviada_em.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "candidaturas": [a.to_dict() for a in apps],
    }


@router.post("/")
def create_application(data: CreateApplication, db: Session = Depends(get_db)):
    app = Application(
        job_id=data.job_id,
        metodo=data.metodo,
        notas=data.notas,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app.to_dict()


@router.patch("/{app_id}")
def update_application(app_id: int, data: UpdateApplication, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        return {"error": "Candidatura nao encontrada"}, 404
    if data.status:
        app.status = data.status
        if data.status == "respondida":
            app.resposta_em = datetime.now(timezone.utc)
    if data.notas is not None:
        app.notas = data.notas
    db.commit()
    db.refresh(app)
    return app.to_dict()


@router.delete("/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        return {"error": "Candidatura nao encontrada"}, 404
    db.delete(app)
    db.commit()
    return {"message": "Candidatura removida"}
