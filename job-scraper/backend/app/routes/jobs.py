from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job

router = APIRouter(prefix="/jobs", tags=["Vagas"])


@router.get("/")
def list_jobs(
    fonte: str | None = None,
    status: str | None = None,
    busca: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Job)

    if fonte:
        query = query.filter(Job.fonte == fonte)
    if status:
        query = query.filter(Job.status == status)
    if busca:
        query = query.filter(
            (Job.titulo.ilike(f"%{busca}%"))
            | (Job.empresa.ilike(f"%{busca}%"))
            | (Job.descricao.ilike(f"%{busca}%"))
        )

    total = query.count()
    jobs = (
        query.order_by(Job.data_coleta.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "vagas": [j.to_dict() for j in jobs],
    }


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return {"error": "Vaga nao encontrada"}, 404
    return job.to_dict()


@router.patch("/{job_id}/status")
def update_job_status(job_id: int, status: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return {"error": "Vaga nao encontrada"}, 404
    job.status = status
    db.commit()
    return job.to_dict()


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return {"error": "Vaga nao encontrada"}, 404
    db.delete(job)
    db.commit()
    return {"message": "Vaga removida"}
