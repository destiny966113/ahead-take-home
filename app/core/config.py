from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
    )

    app_env: str = "development"
    api_port: int = 8088

    database_url: str = "postgresql+psycopg2://app:app@localhost:5432/app"
    redis_url: str = "redis://localhost:6379/0"

    minio_endpoint: str = "localhost:9000"
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin"
    minio_bucket: str = "omip"

    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    celery_eager: bool = False

    # PARSER API config
    parser_api_url: str = "https://edb59857d1b8.ngrok-free.app"

    # LLM config (mock in tests; do not call by default)
    LLM_PROVIDER: str | None = None
    LLM_MODEL: str | None = None
    LLM_API_KEY: str | None = None


settings = Settings()  # singleton

