from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False)
    metodo: Mapped[str] = mapped_column(String(50), nullable=False)  # "email" ou "linkedin"
    status: Mapped[str] = mapped_column(String(50), default="pendente")  # pendente, enviada, falhou, respondida
    enviada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    resposta_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notas: Mapped[str] = mapped_column(Text, default="")

    vaga = relationship("Job", back_populates="candidaturas")

    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "metodo": self.metodo,
            "status": self.status,
            "enviada_em": self.enviada_em.isoformat() if self.enviada_em else None,
            "resposta_em": self.resposta_em.isoformat() if self.resposta_em else None,
            "notas": self.notas,
            "vaga": self.vaga.to_dict() if self.vaga else None,
        }
