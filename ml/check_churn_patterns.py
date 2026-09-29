import os
import getpass

import pandas as pd
import psycopg


password = os.getenv("POSTGRES_PASSWORD")

if not password:
    password = getpass.getpass("Enter PostgreSQL password: ")

conn = psycopg.connect(
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=os.getenv("POSTGRES_PORT", "5432"),
    dbname=os.getenv("POSTGRES_DB", "saascommand_360"),
    user=os.getenv("POSTGRES_USER", "postgres"),
    password=password,
)


query = """
WITH churn AS (
    SELECT
        account_id,
        MAX(
            CASE
                WHEN LOWER(status) = 'cancelled' THEN 1
                ELSE 0
            END
        ) AS churned
    FROM silver.subscriptions
    GROUP BY account_id
),

failed_invoices AS (
    SELECT
        account_id,
        COUNT(*) FILTER (
            WHERE LOWER(status) = 'failed'
        ) AS failed_invoice_count,
        COUNT(*) AS invoice_count
    FROM silver.invoices
    GROUP BY account_id
),

support AS (
    SELECT
        account_id,
        COUNT(*) AS support_ticket_count,
        AVG(
            EXTRACT(
                EPOCH FROM (
                    resolved_at::TIMESTAMP - created_at::TIMESTAMP
                )
            ) / 3600.0
        ) AS avg_resolution_hours
    FROM silver.support
    WHERE resolved_at IS NOT NULL
    GROUP BY account_id
),

usage AS (
    SELECT
        u.account_id,
        COUNT(pe.event_id) AS usage_events,
        COUNT(DISTINCT pe.feature) AS features_used
    FROM silver.users u
    LEFT JOIN silver.product_events pe
        ON u.user_id = pe.user_id
        AND pe.is_valid_event = TRUE
    GROUP BY u.account_id
)

SELECT
    c.account_id,
    c.industry,
    c.size,
    c.region,
    c.owner,

    ch.churned,

    COALESCE(u.usage_events, 0) AS usage_events,
    COALESCE(u.features_used, 0) AS features_used,

    COALESCE(s.support_ticket_count, 0) AS support_ticket_count,
    COALESCE(s.avg_resolution_hours, 0) AS avg_resolution_hours,

    COALESCE(f.failed_invoice_count, 0) AS failed_invoice_count,
    COALESCE(f.invoice_count, 0) AS invoice_count

FROM silver.accounts c

LEFT JOIN churn ch
    ON c.account_id = ch.account_id

LEFT JOIN usage u
    ON c.account_id = u.account_id

LEFT JOIN support s
    ON c.account_id = s.account_id

LEFT JOIN failed_invoices f
    ON c.account_id = f.account_id

ORDER BY c.account_id;
"""


df = pd.read_sql(query, conn)

conn.close()


print("\n========== CHURN FEATURE DATA ==========")

print("\nShape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nChurn distribution:")
print(df["churned"].value_counts())


print("\n========== CHURN RATE BY INDUSTRY ==========")

print(
    df.groupby("industry")["churned"]
    .agg(["count", "sum", "mean"])
    .sort_values("mean", ascending=False)
)


print("\n========== CHURN RATE BY SIZE ==========")

print(
    df.groupby("size")["churned"]
    .agg(["count", "sum", "mean"])
    .sort_values("mean", ascending=False)
)


print("\n========== CHURN RATE BY REGION ==========")

print(
    df.groupby("region")["churned"]
    .agg(["count", "sum", "mean"])
    .sort_values("mean", ascending=False)
)


print("\n========== AVERAGE FEATURES: CHURNED VS NON-CHURNED ==========")

numeric_columns = [
    "usage_events",
    "features_used",
    "support_ticket_count",
    "avg_resolution_hours",
    "failed_invoice_count",
    "invoice_count",
]

print(
    df.groupby("churned")[numeric_columns]
    .mean()
    .round(2)
)


print("\n========== FAILED INVOICE RATE ==========")

df["failed_invoice_rate"] = (
    df["failed_invoice_count"]
    / df["invoice_count"].replace(0, 1)
)

print(
    df.groupby("churned")["failed_invoice_rate"]
    .mean()
    .round(4)
)