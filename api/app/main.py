from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import joblib

from api.app.db import get_connection

app = FastAPI(
    title="SaaSCommand 360 API",
    description="Backend API for SaaS product, revenue, customer health and live event analytics.",
    version="1.0.0",
)

MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "models"
    / "churn_model.joblib"
)

churn_model = joblib.load(MODEL_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "message": "SaaSCommand 360 API is running"
    }


@app.get("/api/health")
def api_health():
    return {
        "status": "healthy",
        "service": "SaaSCommand 360 API"
    }


@app.get("/api/events/live")
def get_live_events(limit: int = 20):

    conn = get_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT
                    event_id,
                    event_type,
                    customer_id,
                    user_id,
                    feature,
                    event_timestamp,
                    received_at
                FROM bronze.live_events
                ORDER BY received_at DESC
                LIMIT %s;
                """,
                (limit,),
            )

            rows = cur.fetchall()

        return [
            {
                "event_id": row[0],
                "event_type": row[1],
                "customer_id": row[2],
                "user_id": row[3],
                "feature": row[4],
                "event_timestamp": row[5],
                "received_at": row[6],
            }
            for row in rows
        ]

    finally:
        conn.close()


@app.get("/api/revenue")
def get_revenue():

    conn = get_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT *
                FROM dbt.revenue;
                """
            )

            rows = cur.fetchall()
            columns = [desc.name for desc in cur.description]

        return [
            dict(zip(columns, row))
            for row in rows
        ]

    finally:
        conn.close()


@app.get("/api/customers/{customer_id}/health")
def get_customer_health(customer_id: int):

    conn = get_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT
                    customer_id,
                    usage_score,
                    support_score,
                    billing_score,
                    health_score,
                    health_status
                FROM dbt.customer_health
                WHERE customer_id = %s;
                """,
                (customer_id,),
            )

            row = cur.fetchone()

        if row is None:
            return {
                "message": "Customer not found",
                "customer_id": customer_id
            }

        return {
            "customer_id": row[0],
            "usage_score": row[1],
            "support_score": row[2],
            "billing_score": row[3],
            "health_score": float(row[4]),
            "health_status": row[5]
        }

    finally:
        conn.close()


@app.get("/api/product/usage")
def get_product_usage(limit: int = 100):

    conn = get_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT
                    usage_date,
                    feature,
                    total_events,
                    daily_active_users,
                    monthly_active_users,
                    daily_to_monthly_active_pct
                FROM dbt.product_usage
                ORDER BY usage_date DESC
                LIMIT %s;
                """,
                (limit,),
            )

            rows = cur.fetchall()

        return [
            {
                "usage_date": row[0],
                "feature": row[1],
                "total_events": row[2],
                "daily_active_users": row[3],
                "monthly_active_users": row[4],
                "daily_to_monthly_active_pct": float(row[5])
            }
            for row in rows
        ]

    finally:
        conn.close()

@app.get("/api/customer-health")
def get_customer_health(limit: int = 10):

    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    customer_id,
                    usage_score,
                    support_score,
                    billing_score,
                    health_score,
                    health_status
                FROM dbt.customer_health
                ORDER BY health_score ASC, customer_id
                LIMIT %s;
                """,
                (limit,),
            )

            rows = cur.fetchall()

        return [
            {
                "customer_id": row[0],
                "usage_score": row[1],
                "support_score": row[2],
                "billing_score": row[3],
                "health_score": float(row[4]),
                "health_status": row[5],
            }
            for row in rows
        ]

    finally:
        conn.close()


@app.get("/api/churn-risk")
def get_churn_risk(limit: int = 10):
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH subscription_features AS (
                    SELECT
                        s.account_id,

                        COUNT(*) AS subscription_count,

                        MAX(s.start_date) AS latest_subscription_start,

                        AVG(dp.monthly_price) AS avg_plan_price,

                        MAX(dp.monthly_price) AS max_plan_price,

                        MAX(
                            CASE
                                WHEN s.status = 'Cancelled' THEN 1
                                ELSE 0
                            END
                        ) AS churned

                    FROM silver.subscriptions s

                    LEFT JOIN silver.dim_plan dp
                        ON s.plan = dp.plan_name

                    GROUP BY s.account_id
                ),

                usage_features AS (
                    SELECT
                        u.account_id,

                        COUNT(pe.event_id) AS usage_events,

                        COUNT(DISTINCT pe.feature) AS features_used

                    FROM silver.users u

                    LEFT JOIN silver.product_events pe
                        ON u.user_id = pe.user_id
                        AND pe.is_valid_event = TRUE

                    GROUP BY u.account_id
                ),

                support_features AS (
                    SELECT
                        account_id,

                        COUNT(*) AS support_ticket_count,

                        AVG(
                            EXTRACT(
                                EPOCH FROM (
                                    resolved_at::TIMESTAMP
                                    - created_at::TIMESTAMP
                                )
                            ) / 3600.0
                        ) AS avg_resolution_hours

                    FROM silver.support

                    WHERE resolved_at IS NOT NULL

                    GROUP BY account_id
                ),

                billing_features AS (
                    SELECT
                        account_id,

                        COUNT(*) AS invoice_count,

                        SUM(
                            CASE
                                WHEN status = 'Failed' THEN 1
                                ELSE 0
                            END
                        ) AS failed_invoice_count

                    FROM silver.invoices

                    GROUP BY account_id
                )

                SELECT
                    a.account_id,
                    a.industry,
                    a.size,
                    a.region,

                    sf.subscription_count,
                    sf.latest_subscription_start,
                    sf.avg_plan_price,
                    sf.max_plan_price,

                    COALESCE(uf.usage_events, 0) AS usage_events,
                    COALESCE(uf.features_used, 0) AS features_used,

                    COALESCE(
                        sp.support_ticket_count,
                        0
                    ) AS support_ticket_count,

                    COALESCE(
                        sp.avg_resolution_hours,
                        0
                    ) AS avg_resolution_hours,

                    COALESCE(
                        bf.invoice_count,
                        0
                    ) AS invoice_count,

                    COALESCE(
                        bf.failed_invoice_count,
                        0
                    ) AS failed_invoice_count,

                    CASE
                        WHEN COALESCE(bf.invoice_count, 0) > 0
                        THEN
                            COALESCE(
                                bf.failed_invoice_count,
                                0
                            )::FLOAT
                            / bf.invoice_count
                        ELSE 0
                    END AS failed_invoice_rate

                FROM silver.accounts a

                INNER JOIN subscription_features sf
                    ON a.account_id = sf.account_id

                LEFT JOIN usage_features uf
                    ON a.account_id = uf.account_id

                LEFT JOIN support_features sp
                    ON a.account_id = sp.account_id

                LEFT JOIN billing_features bf
                    ON a.account_id = bf.account_id

                ORDER BY a.account_id
                LIMIT %s;
                """,
                (limit,),
            )

            rows = cur.fetchall()

        import pandas as pd

        columns = [
            "account_id",
            "industry",
            "size",
            "region",
            "subscription_count",
            "latest_subscription_start",
            "avg_plan_price",
            "max_plan_price",
            "usage_events",
            "features_used",
            "support_ticket_count",
            "avg_resolution_hours",
            "invoice_count",
            "failed_invoice_count",
            "failed_invoice_rate",
        ]

        df = pd.DataFrame(rows, columns=columns)

        reference_date = pd.Timestamp("2026-12-31")

        df["subscription_age_days"] = (
            reference_date
            - pd.to_datetime(df["latest_subscription_start"])
        ).dt.days

        df = df.drop(
            columns=["latest_subscription_start"]
        )

        probabilities = churn_model.predict_proba(df)[:, 1]

        results = []

        for index, probability in enumerate(probabilities):
            probability = float(probability)

            if probability >= 0.70:
                risk_level = "High"
            elif probability >= 0.40:
                risk_level = "Medium"
            else:
                risk_level = "Low"

            results.append(
                {
                    "customer_id": int(
                        df.iloc[index]["account_id"]
                    ),
                    "churn_probability": round(
                        probability,
                        4
                    ),
                    "risk_level": risk_level,
                }
            )

        results.sort(
            key=lambda x: x["churn_probability"],
            reverse=True
        )

        return results

    finally:
        conn.close()


@app.get("/api/alerts")
def get_alerts(limit: int = 20):
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    alert_id,
                    customer_id,
                    alert_type,
                    severity,
                    owner,
                    status,
                    reason,
                    recommended_action,
                    source,
                    created_at,
                    acknowledged_at
                FROM analytics.alerts
                ORDER BY
                    CASE severity
                        WHEN 'High' THEN 1
                        WHEN 'Medium' THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                LIMIT %s;
                """,
                (limit,),
            )

            rows = cur.fetchall()

        return [
            {
                "alert_id": row[0],
                "customer_id": row[1],
                "alert_type": row[2],
                "severity": row[3],
                "owner": row[4],
                "status": row[5],
                "reason": row[6],
                "recommended_action": row[7],
                "source": row[8],
                "created_at": row[9],
                "acknowledged_at": row[10],
            }
            for row in rows
        ]

    finally:
        conn.close()


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE analytics.alerts
                SET
                    status = 'Acknowledged',
                    acknowledged_at = CURRENT_TIMESTAMP
                WHERE alert_id = %s
                  AND status = 'Open'
                RETURNING
                    alert_id,
                    customer_id,
                    alert_type,
                    severity,
                    owner,
                    status,
                    acknowledged_at;
                """,
                (alert_id,),
            )

            row = cur.fetchone()

        if row is None:
            return {
                "message": "Alert not found or already acknowledged",
                "alert_id": alert_id,
            }

        conn.commit()

        return {
            "message": "Alert acknowledged successfully",
            "alert_id": row[0],
            "customer_id": row[1],
            "alert_type": row[2],
            "severity": row[3],
            "owner": row[4],
            "status": row[5],
            "acknowledged_at": row[6],
        }

    finally:
        conn.close()



@app.get("/api/data-quality")
def get_data_quality():
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    check_name,
                    table_name,
                    check_type,
                    status,
                    actual_value,
                    expected_value,
                    message,
                    checked_at
                FROM analytics.data_quality_results
                ORDER BY
                    CASE status
                        WHEN 'FAIL' THEN 1
                        WHEN 'WARN' THEN 2
                        ELSE 3
                    END,
                    check_name;
                """
            )

            rows = cur.fetchall()

        return [
            {
                "check_name": row[0],
                "table_name": row[1],
                "check_type": row[2],
                "status": row[3],
                "actual_value": float(row[4]) if row[4] is not None else None,
                "expected_value": float(row[5]) if row[5] is not None else None,
                "message": row[6],
                "checked_at": row[7].isoformat() if row[7] else None,
            }
            for row in rows
        ]

    finally:
        conn.close()


@app.get("/api/forecasts")
def get_revenue_forecasts():
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    forecast_month,
                    forecast_revenue,
                    model_name,
                    validation_mae,
                    generated_at
                FROM analytics.revenue_forecast
                ORDER BY forecast_month;
                """
            )

            rows = cur.fetchall()

        return [
            {
                "forecast_month": row[0].isoformat(),
                "forecast_revenue": float(row[1]),
                "model_name": row[2],
                "validation_mae": float(row[3]) if row[3] is not None else None,
                "generated_at": row[4].isoformat(),
            }
            for row in rows
        ]

    finally:
        conn.close()