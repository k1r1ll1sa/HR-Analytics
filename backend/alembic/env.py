import sys
import os
from dotenv import load_dotenv
from pathlib import Path

# 1. Загружаем переменные окружения ДО импорта settings
load_dotenv()

from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# 2. Добавляем путь к проекту
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# 3. Импортируем настройки, Base и ВСЕ модели
from app.core.config import settings
from app.core.database import Base
from app.models.user import User
from app.models.company import Company, Department, Employee, Position
from app.models.survey import Survey, SurveyQuestion, SurveySession, SurveyAssignment, SurveyAnswer

# 4. ОТЛАДКА: Проверяем URL и таблицы
print("=" * 70)
print(f"1. URL для Alembic (должен быть psycopg2): {settings.DATABASE_URL}")
print(f"2. Таблицы, которые видит Alembic: {list(Base.metadata.tables.keys())}")
print("=" * 70)

config = context.config

# 5. Подменяем URL на СИНХРОННЫЙ (psycopg2) для Alembic
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()