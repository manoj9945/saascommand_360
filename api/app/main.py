from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.app.db import get_connection

app = FastAPI(
    title="SaaSCommand 360 API",
    description="Backend API for SaaS product, revenue, customer health and live event analytics.",
    version="1.0.0",
)

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