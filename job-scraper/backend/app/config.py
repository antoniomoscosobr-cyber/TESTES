import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./jobhunter.db")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    LINKEDIN_EMAIL: str = os.getenv("LINKEDIN_EMAIL", "")
    LINKEDIN_PASS: str = os.getenv("LINKEDIN_PASS", "")
    RESUME_PATH: str = os.getenv("RESUME_PATH", "./curriculo.pdf")
    SCRAPE_INTERVAL: int = int(os.getenv("SCRAPE_INTERVAL", "60"))


settings = Settings()
