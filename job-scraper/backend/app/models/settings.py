import json

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

DEFAULT_KEYWORDS = [
    "designer",
    "motion design",
    "motion designer",
    "editor de video",
    "video editor",
    "design grafico",
    "graphic designer",
    "ui designer",
    "ux designer",
    "after effects",
    "premiere",
    "figma designer",
]


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    palavras_chave: Mapped[str] = mapped_column(Text, default=json.dumps(DEFAULT_KEYWORDS))
    localizacao: Mapped[str] = mapped_column(String(200), default="Brasil")
    modalidade: Mapped[str] = mapped_column(String(100), default="Remoto")
    email_smtp_host: Mapped[str] = mapped_column(String(300), default="smtp.gmail.com")
    email_smtp_port: Mapped[int] = mapped_column(Integer, default=587)
    email_smtp_user: Mapped[str] = mapped_column(String(300), default="")
    email_smtp_pass: Mapped[str] = mapped_column(String(300), default="")
    linkedin_email: Mapped[str] = mapped_column(String(300), default="")
    linkedin_pass: Mapped[str] = mapped_column(String(300), default="")
    curriculo_path: Mapped[str] = mapped_column(String(500), default="")
    intervalo_busca: Mapped[int] = mapped_column(Integer, default=60)

    def get_keywords(self) -> list[str]:
        return json.loads(self.palavras_chave) if self.palavras_chave else DEFAULT_KEYWORDS

    def to_dict(self):
        return {
            "id": self.id,
            "palavras_chave": self.get_keywords(),
            "localizacao": self.localizacao,
            "modalidade": self.modalidade,
            "email_smtp_host": self.email_smtp_host,
            "email_smtp_port": self.email_smtp_port,
            "email_smtp_user": self.email_smtp_user,
            "email_smtp_pass": "***" if self.email_smtp_pass else "",
            "linkedin_email": self.linkedin_email,
            "linkedin_pass": "***" if self.linkedin_pass else "",
            "curriculo_path": self.curriculo_path,
            "intervalo_busca": self.intervalo_busca,
        }
