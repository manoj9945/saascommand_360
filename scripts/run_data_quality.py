import os
import getpass
import psycopg


# ---------------------------------------------------------
# PostgreSQL connection
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Helper function
# ---------------------------------------------------------

def save_result(
    cur,
    check_name,
    table_name,
    check_type,
    status,
    actual_value,
    expected_value,
    message,
):
    cur.execute(
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
        VALUES (%s, %s, %s, %s, %s, %s, %s);
        """,
        (
            check_name,
            table_name,
            check_type,
            status,
            actual_value,
            expected_value,
            message,
        ),
    )


# ---------------------------------------------------------
# Run DQ checks
# ---------------------------------------------------------

with conn.cursor() as cur:

    # Clear previous results so each run represents
    # the latest DQ execution.
    cur.execute(
        "TRUNCATE TABLE analytics.data_quality_results;"
    )


    # =====================================================
    # 1. NULL CHECKS
    # =====================================================

    null_checks = [
        (
            "Accounts account_id NULL check",
            "silver.accounts",
            "NULL",
            """
            SELECT COUNT(*)
            FROM silver.accounts
            WHERE account_id IS NULL;
            """,
        ),
        (
            "Users user_id NULL check",
            "silver.users",
            "NULL",
            """
            SELECT COUNT(*)
            FROM silver.users
            WHERE user_id IS NULL;
            """,
        ),
        (
            "Product events event_id NULL check",
            "silver.product_events",
            "NULL",
            """
            SELECT COUNT(*)
            FROM silver.product_events
            WHERE event_id IS NULL;
            """,
        ),
        (
            "Subscriptions subscription_id NULL check",
            "silver.subscriptions",
            "NULL",
            """
            SELECT COUNT(*)
            FROM silver.subscriptions
            WHERE subscription_id IS NULL;
            """,
        ),
    ]

    for check_name, table_name, check_type, query in null_checks:

        cur.execute(query)
        actual = cur.fetchone()[0]

        status = "PASS" if actual == 0 else "FAIL"

        save_result(
            cur,
            check_name,
            table_name,
            check_type,
            status,
            actual,
            0,
            "Expected zero NULL values in key column.",
        )


    # =====================================================
    # 2. DUPLICATE CHECKS
    # =====================================================

    duplicate_checks = [
        (
            "Accounts duplicate account_id check",
            "silver.accounts",
            """
            SELECT COUNT(*)
            FROM (
                SELECT account_id
                FROM silver.accounts
                GROUP BY account_id
                HAVING COUNT(*) > 1
            ) x;
            """,
        ),
        (
            "Users duplicate user_id check",
            "silver.users",
            """
            SELECT COUNT(*)
            FROM (
                SELECT user_id
                FROM silver.users
                GROUP BY user_id
                HAVING COUNT(*) > 1
            ) x;
            """,
        ),
        (
            "Product events duplicate event_id check",
            "silver.product_events",
            """
            SELECT COUNT(*)
            FROM (
                SELECT event_id
                FROM silver.product_events
                GROUP BY event_id
                HAVING COUNT(*) > 1
            ) x;
            """,
        ),
    ]

    for check_name, table_name, query in duplicate_checks:

        cur.execute(query)
        actual = cur.fetchone()[0]

        status = "PASS" if actual == 0 else "FAIL"

        save_result(
            cur,
            check_name,
            table_name,
            "DUPLICATE",
            status,
            actual,
            0,
            "Expected zero duplicate business keys.",
        )


    # =====================================================
    # 3. REFERENTIAL INTEGRITY
    # =====================================================

    cur.execute(
        """
        SELECT COUNT(*)
        FROM silver.users u
        LEFT JOIN silver.accounts a
            ON u.account_id = a.account_id
        WHERE a.account_id IS NULL;
        """
    )

    invalid_user_accounts = cur.fetchone()[0]

    save_result(
        cur,
        "Users account reference check",
        "silver.users",
        "REFERENTIAL",
        "PASS" if invalid_user_accounts == 0 else "FAIL",
        invalid_user_accounts,
        0,
        "Every user should reference an existing account.",
    )


    cur.execute(
        """
        SELECT COUNT(*)
        FROM silver.product_events pe
        LEFT JOIN silver.users u
            ON pe.user_id = u.user_id
        WHERE u.user_id IS NULL;
        """
    )

    invalid_event_users = cur.fetchone()[0]

    save_result(
        cur,
        "Product event user reference check",
        "silver.product_events",
        "REFERENTIAL",
        "PASS" if invalid_event_users == 0 else "FAIL",
        invalid_event_users,
        0,
        "Every product event should reference an existing user.",
    )


    # =====================================================
    # 4. PRODUCT EVENT BUSINESS RULE
    # =====================================================

    cur.execute(
        """
        SELECT COUNT(*)
        FROM silver.product_events pe
        JOIN silver.users u
            ON pe.user_id = u.user_id
        WHERE pe.event_timestamp < u.created_at;
        """
    )

    invalid_events = cur.fetchone()[0]

    # These records are intentionally retained in the dataset.
    # We flag them instead of deleting them.

    status = "PASS" if invalid_events == 0 else "WARN"

    save_result(
        cur,
        "Product events before user creation",
        "silver.product_events",
        "BUSINESS_RULE",
        status,
        invalid_events,
        0,
        "Events before user creation are flagged for analytical exclusion.",
    )


    # =====================================================
    # 5. MULTIPLE ACTIVE SUBSCRIPTIONS
    # =====================================================

    cur.execute(
        """
        SELECT COUNT(*)
        FROM (
            SELECT account_id
            FROM silver.subscriptions
            WHERE status = 'Active'
            GROUP BY account_id
            HAVING COUNT(*) > 1
        ) x;
        """
    )

    multiple_active = cur.fetchone()[0]

    status = "PASS" if multiple_active == 0 else "WARN"

    save_result(
        cur,
        "Multiple active subscriptions per account",
        "silver.subscriptions",
        "BUSINESS_RULE",
        status,
        multiple_active,
        0,
        "Accounts with multiple active subscriptions are retained and handled by current-state logic.",
    )


    # =====================================================
    # 6. INVOICE BUSINESS RULE
    # =====================================================

    cur.execute(
        """
        SELECT COUNT(*)
        FROM silver.invoices i
        WHERE NOT EXISTS (
            SELECT 1
            FROM silver.dim_plan p
            WHERE i.amount = p.monthly_price
        );
        """
    )

    invalid_invoice_plans = cur.fetchone()[0]

    save_result(
        cur,
        "Invoice amount plan price check",
        "silver.invoices",
        "BUSINESS_RULE",
        "PASS" if invalid_invoice_plans == 0 else "FAIL",
        invalid_invoice_plans,
        0,
        "Every invoice amount should match a valid plan monthly price.",
    )


    # =====================================================
    # 7. TABLE VOLUME CHECKS
    # =====================================================

    volume_checks = [
        (
            "Accounts minimum volume",
            "silver.accounts",
            """
            SELECT COUNT(*)
            FROM silver.accounts;
            """,
            1,
        ),
        (
            "Users minimum volume",
            "silver.users",
            """
            SELECT COUNT(*)
            FROM silver.users;
            """,
            1,
        ),
        (
            "Product events minimum volume",
            "silver.product_events",
            """
            SELECT COUNT(*)
            FROM silver.product_events;
            """,
            1,
        ),
        (
            "Invoices minimum volume",
            "silver.invoices",
            """
            SELECT COUNT(*)
            FROM silver.invoices;
            """,
            1,
        ),
    ]

    for check_name, table_name, query, expected_minimum in volume_checks:

        cur.execute(query)
        actual = cur.fetchone()[0]

        status = "PASS" if actual >= expected_minimum else "FAIL"

        save_result(
            cur,
            check_name,
            table_name,
            "VOLUME",
            status,
            actual,
            expected_minimum,
            f"Expected at least {expected_minimum} row(s).",
        )


    # =====================================================
    # Commit all DQ results
    # =====================================================

    conn.commit()


# ---------------------------------------------------------
# Display summary
# ---------------------------------------------------------

with conn.cursor() as cur:

    cur.execute(
        """
        SELECT
            status,
            COUNT(*) AS check_count
        FROM analytics.data_quality_results
        GROUP BY status
        ORDER BY status;
        """
    )

    summary = cur.fetchall()


print("\n========== DATA QUALITY SUMMARY ==========")

for status, count in summary:
    print(f"{status}: {count}")


print("\n========== DQ RESULTS ==========")

with conn.cursor() as cur:

    cur.execute(
        """
        SELECT
            check_name,
            table_name,
            check_type,
            status,
            actual_value,
            expected_value
        FROM analytics.data_quality_results
        ORDER BY dq_id;
        """
    )

    rows = cur.fetchall()

    for row in rows:
        print(row)


conn.close()

print("\nData quality checks completed.")