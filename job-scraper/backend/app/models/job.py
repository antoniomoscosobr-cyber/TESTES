from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(500), nullable=False)
    empresa: Mapped[str] = mapped_column(String(300), nullable=False)
    localizacao: Mapped[str] = mapped_column(String(300), default="")
    url: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    fonte: Mapped[str] = mapped_column(String(50), nullable=False)  # "linkedin" ou "indeed"
    descricao: Mapped[str] = mapped_column(Text, default="")
    salario: Mapped[str] = mapped_column(String(200), default="")
    data_publicacao: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data_coleta: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    status: Mapped[str] = mapped_column(String(50), default="nova")  # nova, interessante, descartada
    email_contato: Mapped[str] = mapped_column(String(300), default="")

    candidaturas = relationship("Application", back_populates="vaga", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "empresa": self.empresa,
            "localizacao": self.localizacao,
            "url": self.url,
            "fonte": self.fonte,
            "descricao": self.descricao,
            "salario": self.salario,
            "data_publicacao": self.data_publicacao.isoformat() if self.data_publicacao else None,
            "data_coleta": self.data_coleta.isoformat() if self.data_coleta else None,
            "status": self.status,
            "email_contato": self.email_contato,
        }
