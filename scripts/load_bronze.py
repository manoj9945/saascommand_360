import getpass
from pathlib import Path

import pandas as pd
import psycopg


# --------------------------------------------------
# Project paths
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"


# --------------------------------------------------
# CSV files and Bronze table names
# --------------------------------------------------

TABLES = {
    "accounts.csv": "accounts",
    "users.csv": "users",
    "product_events.csv": "product_events",
    "subscriptions.csv": "subscriptions",
    "invoices.csv": "invoices",
    "support.csv": "support",
    "dim_plan.csv": "dim_plan",
}


# --------------------------------------------------
# PostgreSQL connection
# --------------------------------------------------

password = getpass.getpass("Enter PostgreSQL password: ")

conn = psycopg.connect(
    host="localhost",
    port=5432,
    dbname="saascommand_360",
    user="postgres",
    password=password,
)


# --------------------------------------------------
# Load CSV files into Bronze
# --------------------------------------------------

for csv_file, table_name in TABLES.items():

    file_path = RAW_DIR / csv_file

    print(f"\nLoading {csv_file}...")

    df = pd.read_csv(file_path)

    # Replace existing Bronze table
    with conn.cursor() as cur:
        cur.execute(
            f'DROP TABLE IF EXISTS bronze."{table_name}" CASCADE;'
        )

    conn.commit()

    # Load dataframe into PostgreSQL
    with conn.cursor() as cur:
        columns = ", ".join(
            f'"{column}" TEXT'
            for column in df.columns
        )

        cur.execute(
            f'''
            CREATE TABLE bronze."{table_name}" (
                {columns}
            );
            '''
        )

        records = [
            tuple(None if pd.isna(value) else str(value) for value in row)
            for row in df.itertuples(index=False, name=None)
        ]

        placeholders = ", ".join(["%s"] * len(df.columns))

        cur.executemany(
            f'''
            INSERT INTO bronze."{table_name}"
            ({", ".join(f'"{column}"' for column in df.columns)})
            VALUES ({placeholders});
            ''',
            records,
        )

    conn.commit()

    print(
        f"Loaded {len(df):,} rows into bronze.{table_name}"
    )


conn.close()

print("\n===================================")
print("Bronze ingestion completed successfully!")
print("===================================")