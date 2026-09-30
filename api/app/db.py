import os

import psycopg
from dotenv import load_dotenv


# Load environment variables from .env
load_dotenv()


def get_connection():
    """
    Create a PostgreSQL connection.

    Production/cloud:
        Uses DATABASE_URL.

    Local fallback:
        Uses individual POSTGRES_* environment variables.
    """

    database_url = os.getenv("DATABASE_URL")

    if database_url:
        return psycopg.connect(database_url)

    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.getenv("POSTGRES_DB", "saascommand_360"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD"),
        sslmode=os.getenv("POSTGRES_SSLMODE", "prefer"),
    )