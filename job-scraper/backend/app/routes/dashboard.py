from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.models.application import Application

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_vagas = db.query(func.count(Job.id)).scalar() or 0
    vagas_novas = db.query(func.count(Job.id)).filter(Job.status == "nova").scalar() or 0

    total_candidaturas = db.query(func.count(Application.id)).scalar() or 0
    candidaturas_email = (
        db.query(func.count(Application.id))
        .filter(Application.metodo == "email")
        .scalar() or 0
    )
    candidaturas_linkedin = (
        db.query(func.count(Application.id))
        .filter(Application.metodo == "linkedin")
        .scalar() or 0
    )
    candidaturas_enviadas = (
        db.query(func.count(Application.id))
        .filter(Application.status == "enviada")
        .scalar() or 0
    )
    candidaturas_respondidas = (
        db.query(func.count(Application.id))
        .filter(Application.status == "respondida")
        .scalar() or 0
    )
    candidaturas_falhas = (
        db.query(func.count(Application.id))
        .filter(Application.status == "falhou")
        .scalar() or 0
    )

    # Candidaturas por dia (ultimos 30 dias)
    candidaturas_por_dia = (
        db.query(
            func.date(Application.enviada_em).label("dia"),
            func.count(Application.id).label("total"),
        )
        .group_by(func.date(Application.enviada_em))
        .order_by(func.date(Application.enviada_em).desc())
        .limit(30)
        .all()
    )

    # Vagas por fonte
    vagas_por_fonte = (
        db.query(Job.fonte, func.count(Job.id).label("total"))
        .group_by(Job.fonte)
        .all()
    )

    # Vagas recentes
    vagas_recentes = (
        db.query(Job)
        .order_by(Job.data_coleta.desc())
        .limit(10)
        .all()
    )

    return {
        "total_vagas": total_vagas,
        "vagas_novas": vagas_novas,
        "total_candidaturas": total_candidaturas,
        "candidaturas_email": candidaturas_email,
        "candidaturas_linkedin": candidaturas_linkedin,
        "candidaturas_enviadas": candidaturas_enviadas,
        "candidaturas_respondidas": candidaturas_respondidas,
        "candidaturas_falhas": candidaturas_falhas,
        "candidaturas_por_dia": [
            {"dia": str(row.dia), "total": row.total} for row in candidaturas_por_dia
        ],
        "vagas_por_fonte": [
            {"fonte": row.fonte, "total": row.total} for row in vagas_por_fonte
        ],
        "vagas_recentes": [v.to_dict() for v in vagas_recentes],
    }
