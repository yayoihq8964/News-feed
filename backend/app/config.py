from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # News APIs
    finnhub_api_key: str = ""
    newsapi_api_key: str = ""
    gnews_api_key: str = ""

    # Default LLM
    default_llm_provider: str = "openai"  # openai/anthropic/grok/ollama
    default_llm_model: str = "gpt-4o"
    default_llm_api_key: str = ""

    # Additional LLM keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    grok_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    openai_base_url: str = "https://api.openai.com/v1"
    grok_base_url: str = "https://api.x.ai/v1"

    # App
    news_poll_interval: int = 60  # seconds
    analysis_batch_size: int = 10
    database_url: str = "sqlite+aiosqlite:///data/macrolens.db"

    class Config:
        env_file = ".env"


settings = Settings()
