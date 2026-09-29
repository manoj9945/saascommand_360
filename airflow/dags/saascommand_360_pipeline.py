from datetime import timedelta

import pendulum
import subprocess
from airflow.sdk import dag, task
from airflow.providers.postgres.hooks.postgres import PostgresHook


POSTGRES_CONN_ID = "saascommand_postgres"


@dag(
    dag_id="saascommand_360_pipeline",
    schedule=None,
    start_date=pendulum.datetime(2026, 9, 29, tz="Asia/Kolkata"),
    catchup=False,
    dagrun_timeout=timedelta(minutes=30),
    tags=["saascommand", "batch", "data-quality"],
)
def saascommand_360_pipeline():

    @task
    def check_bronze_data():
        hook = PostgresHook(postgres_conn_id=POSTGRES_CONN_ID)

        tables = [
            "accounts",
            "users",
            "product_events",
            "subscriptions",
            "invoices",
            "support",
        ]

        for table in tables:
            result = hook.get_first(
                f"SELECT COUNT(*) FROM bronze.{table}"
            )

            count = result[0]

            print(f"bronze.{table}: {count:,} rows")

            if count == 0:
                raise ValueError(
                    f"bronze.{table} is empty"
                )

        print("Bronze data validation completed successfully.")

    @task
    def check_silver_data():
        hook = PostgresHook(postgres_conn_id=POSTGRES_CONN_ID)

        tables = [
            "accounts",
            "users",
            "product_events",
            "subscriptions",
            "invoices",
            "support",
        ]

        for table in tables:
            result = hook.get_first(
                f"SELECT COUNT(*) FROM silver.{table}"
            )

            count = result[0]

            print(f"silver.{table}: {count:,} rows")

            if count == 0:
                raise ValueError(
                    f"silver.{table} is empty"
                )

        print("Silver data validation completed successfully.")


    @task
    def run_dbt():
        result = subprocess.run(
            [
                "dbt",
                "run",
                "--project-dir",
                "/opt/airflow/dbt_project",
                "--profiles-dir",
                "/opt/airflow",
            ],
            capture_output=True,
            text=True,
        )

        print(result.stdout)

        if result.returncode != 0:
            print(result.stderr)
            raise RuntimeError("dbt run failed")

        print("dbt run completed successfully")


    @task
    def check_analytics_data():
        hook = PostgresHook(postgres_conn_id=POSTGRES_CONN_ID)

        tables = [
            "dim_customer",
            "dim_user",
            "dim_plan",
            "dim_date",
            "fact_usage",
            "fact_billing",
            "fact_subscription",
            "fact_support",
        ]

        for table in tables:
            result = hook.get_first(
                f"SELECT COUNT(*) FROM analytics.{table}"
            )

            count = result[0]

            print(f"analytics.{table}: {count:,} rows")

            if count == 0:
                raise ValueError(
                    f"analytics.{table} is empty"
                )

        print("Analytics/star-schema validation completed successfully.")

    @task
    def run_core_data_quality_checks():
        hook = PostgresHook(postgres_conn_id=POSTGRES_CONN_ID)

        checks = []

        # 1. Account NULL check
        result = hook.get_first(
            """
            SELECT COUNT(*)
            FROM silver.accounts
            WHERE account_id IS NULL
            """
        )

        actual = result[0]
        status = "PASS" if actual == 0 else "FAIL"

        checks.append(
            ("Accounts account_id NULL check", "silver.accounts",
             "NULL", status, actual, 0)
        )

        # 2. Account duplicate check
        result = hook.get_first(
            """
            SELECT COUNT(*)
            FROM (
                SELECT account_id
                FROM silver.accounts
                GROUP BY account_id
                HAVING COUNT(*) > 1
            ) x
            """
        )

        actual = result[0]
        status = "PASS" if actual == 0 else "FAIL"

        checks.append(
            ("Accounts duplicate account_id check", "silver.accounts",
             "DUPLICATE", status, actual, 0)
        )

        # 3. User → account referential integrity
        result = hook.get_first(
            """
            SELECT COUNT(*)
            FROM silver.users u
            LEFT JOIN silver.accounts a
                ON u.account_id = a.account_id
            WHERE a.account_id IS NULL
            """
        )

        actual = result[0]
        status = "PASS" if actual == 0 else "FAIL"

        checks.append(
            ("Users account reference check", "silver.users",
             "REFERENTIAL", status, actual, 0)
        )

        # 4. Product event → user referential integrity
        result = hook.get_first(
            """
            SELECT COUNT(*)
            FROM silver.product_events pe
            LEFT JOIN silver.users u
                ON pe.user_id = u.user_id
            WHERE u.user_id IS NULL
            """
        )

        actual = result[0]
        status = "PASS" if actual == 0 else "FAIL"

        checks.append(
            ("Product event user reference check",
             "silver.product_events",
             "REFERENTIAL", status, actual, 0)
        )

        # 5. Product events before user creation
        result = hook.get_first(
            """
            SELECT COUNT(*)
            FROM silver.product_events pe
            JOIN silver.users u
                ON pe.user_id = u.user_id
            WHERE pe.event_timestamp < u.created_at
            """
        )

        actual = result[0]
        status = "PASS" if actual == 0 else "WARN"

        checks.append(
            ("Product events before user creation",
             "silver.product_events",
             "BUSINESS_RULE", status, actual, 0)
        )

        # 6. Multiple active subscriptions
        result = hook.get_first(
            """
            SELECT COUNT(*)
            FROM (
                SELECT account_id
                FROM silver.subscriptions
                WHERE status = 'Active'
                GROUP BY account_id
                HAVING COUNT(*) > 1
            ) x
            """
        )

        actual = result[0]
        status = "PASS" if actual == 0 else "WARN"

        checks.append(
            ("Multiple active subscriptions per account",
             "silver.subscriptions",
             "BUSINESS_RULE", status, actual, 0)
        )

        # Save results
        for check in checks:
            (
                check_name,
                table_name,
                check_type,
                status,
                actual_value,
                expected_value,
            ) = check

            hook.run(
                """
                INSERT INTO analytics.data_quality_results
                (
                    check_name,
                    table_name,
                    check_type,
                    status,
                    actual_value,
                    expected_value,
                    message
                )
                VALUES
                (%s, %s, %s, %s, %s, %s, %s)
                """,
                parameters=[
                    check_name,
                    table_name,
                    check_type,
                    status,
                    actual_value,
                    expected_value,
                    f"Airflow automated check: {status}",
                ],
            )

            print(
                f"{check_name}: {status} "
                f"(actual={actual_value}, expected={expected_value})"
            )

        failed = sum(1 for check in checks if check[3] == "FAIL")

        if failed > 0:
            raise ValueError(
                f"Airflow data quality detected {failed} failed checks."
            )

        print("Core data quality checks completed.")

    @task
    def check_alerts():
        hook = PostgresHook(postgres_conn_id=POSTGRES_CONN_ID)

        result = hook.get_first(
            """
            SELECT
                COUNT(*) AS total_open_alerts
            FROM analytics.alerts
            WHERE status = 'Open'
            """
        )

        open_alerts = result[0]

        print(f"Open alerts: {open_alerts:,}")

        result = hook.get_records(
            """
            SELECT
                alert_type,
                severity,
                COUNT(*) AS alert_count
            FROM analytics.alerts
            WHERE status = 'Open'
            GROUP BY alert_type, severity
            ORDER BY alert_count DESC
            """
        )

        for row in result:
            print(
                f"Alert type={row[0]}, "
                f"severity={row[1]}, "
                f"count={row[2]:,}"
            )

        print("Alert monitoring completed.")

    bronze = check_bronze_data()
    silver = check_silver_data()
    dbt = run_dbt()
    analytics = check_analytics_data()
    dq = run_core_data_quality_checks()
    alerts = check_alerts()

    bronze >> silver >> dbt >> analytics >> dq >> alerts


saascommand_360_pipeline()