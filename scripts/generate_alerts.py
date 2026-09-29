import os
import psycopg


# ---------------------------------------------------------
# PostgreSQL connection
# ---------------------------------------------------------

password = os.getenv("POSTGRES_PASSWORD")

if not password:
    import getpass
    password = getpass.getpass("Enter PostgreSQL password: ")


conn = psycopg.connect(
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=os.getenv("POSTGRES_PORT", "5432"),
    dbname=os.getenv("POSTGRES_DB", "saascommand_360"),
    user=os.getenv("POSTGRES_USER", "postgres"),
    password=password,
)


# ---------------------------------------------------------
# Generate alerts
# ---------------------------------------------------------

try:
    with conn.cursor() as cur:

        # -------------------------------------------------
        # 1. At-risk customer health alerts
        # -------------------------------------------------

        cur.execute(
            """
            INSERT INTO analytics.alerts (
                customer_id,
                alert_type,
                severity,
                owner,
                status,
                reason,
                recommended_action,
                source,
                metadata
            )
            SELECT
                customer_id,
                'Customer Health Risk',
                'High',
                'CSM',
                'Open',
                'Customer health status is At Risk.',
                'CSM should review customer health and contact the customer.',
                'Customer Health',
                jsonb_build_object(
                    'health_score', health_score,
                    'usage_score', usage_score,
                    'support_score', support_score,
                    'billing_score', billing_score
                )
            FROM dbt.customer_health ch
            WHERE ch.health_status = 'At Risk'
              AND NOT EXISTS (
                  SELECT 1
                  FROM analytics.alerts a
                  WHERE a.customer_id = ch.customer_id
                    AND a.alert_type = 'Customer Health Risk'
                    AND a.status = 'Open'
              );
            """
        )

        health_alerts = cur.rowcount


        # -------------------------------------------------
        # 2. Payment failure alerts
        # -------------------------------------------------

        cur.execute(
            """
            WITH billing AS (
                SELECT
                    account_id,

                    COUNT(*) AS invoice_count,

                    SUM(
                        CASE
                            WHEN status = 'Failed'
                            THEN 1
                            ELSE 0
                        END
                    ) AS failed_invoice_count

                FROM silver.invoices

                GROUP BY account_id
            )

            INSERT INTO analytics.alerts (
                customer_id,
                alert_type,
                severity,
                owner,
                status,
                reason,
                recommended_action,
                source,
                metadata
            )
            SELECT
                account_id,

                'Payment Failure',

                CASE
                    WHEN failed_invoice_count >= 2
                    THEN 'High'
                    ELSE 'Medium'
                END,

                'Billing',

                'Open',

                'Customer has one or more failed invoices.',

                'Billing team should review the failed payment and contact the customer if required.',

                'Billing',

                jsonb_build_object(
                    'failed_invoice_count',
                    failed_invoice_count,
                    'invoice_count',
                    invoice_count
                )

            FROM billing b

            WHERE failed_invoice_count > 0

              AND NOT EXISTS (
                  SELECT 1
                  FROM analytics.alerts a
                  WHERE a.customer_id = b.account_id
                    AND a.alert_type = 'Payment Failure'
                    AND a.status = 'Open'
              );
            """
        )

        payment_alerts = cur.rowcount


    conn.commit()


    print("\n========== ALERT GENERATION ==========")

    print(
        f"New customer health alerts: {health_alerts}"
    )

    print(
        f"New payment failure alerts: {payment_alerts}"
    )

    print(
        f"Total new alerts: "
        f"{health_alerts + payment_alerts}"
    )


finally:
    conn.close()