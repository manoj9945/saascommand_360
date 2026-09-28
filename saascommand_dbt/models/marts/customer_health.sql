WITH usage AS (

    SELECT
        c.customer_id,
        COUNT(e.event_id) AS total_events,
        COUNT(DISTINCT e.user_id) AS active_users,
        COUNT(DISTINCT e.feature) AS features_used
    FROM {{ ref('stg_customers') }} c
    LEFT JOIN {{ ref('stg_users') }} u
        ON c.customer_id = u.customer_id
    LEFT JOIN {{ ref('stg_product_events') }} e
        ON u.user_id = e.user_id
       AND e.is_valid_event = TRUE
    GROUP BY c.customer_id

),

subscription AS (

    SELECT
        customer_id,
        COUNT(*) FILTER (
            WHERE status = 'Active'
        ) AS active_subscriptions,

        COALESCE(
            SUM(
                CASE
                    WHEN status = 'Active' AND plan = 'Starter'
                        THEN 100
                    WHEN status = 'Active' AND plan = 'Professional'
                        THEN 250
                    WHEN status = 'Active' AND plan = 'Enterprise'
                        THEN 500
                    ELSE 0
                END
            ),
            0
        ) AS customer_mrr

    FROM {{ ref('stg_subscriptions') }}
    GROUP BY customer_id

),

support AS (

    SELECT
        customer_id,
        COUNT(*) AS total_tickets,

        COUNT(*) FILTER (
            WHERE severity IN ('Critical', 'High')
        ) AS high_priority_tickets,

        COALESCE(
            AVG(resolution_hours),
            0
        ) AS avg_resolution_hours

    FROM {{ ref('stg_support') }}
    GROUP BY customer_id

),

billing AS (

    SELECT
        customer_id,
        COUNT(*) AS total_invoices,
        COALESCE(SUM(amount), 0) AS total_billed,

        COUNT(*) FILTER (
            WHERE status = 'Paid'
        ) AS paid_invoices,

        COUNT(*) FILTER (
            WHERE status = 'Failed'
        ) AS failed_invoices

    FROM {{ ref('stg_invoices') }}
    GROUP BY customer_id

),

combined AS (

    SELECT
        c.customer_id,

        COALESCE(u.total_events, 0) AS total_events,
        COALESCE(u.active_users, 0) AS active_users,
        COALESCE(u.features_used, 0) AS features_used,

        COALESCE(s.active_subscriptions, 0) AS active_subscriptions,
        COALESCE(s.customer_mrr, 0) AS customer_mrr,

        COALESCE(sp.total_tickets, 0) AS total_tickets,
        COALESCE(sp.high_priority_tickets, 0) AS high_priority_tickets,
        COALESCE(sp.avg_resolution_hours, 0) AS avg_resolution_hours,

        COALESCE(b.total_invoices, 0) AS total_invoices,
        COALESCE(b.total_billed, 0) AS total_billed,
        COALESCE(b.paid_invoices, 0) AS paid_invoices,
        COALESCE(b.failed_invoices, 0) AS failed_invoices,

        CASE
            WHEN COALESCE(u.total_events, 0) >= 50 THEN 100
            WHEN COALESCE(u.total_events, 0) >= 30 THEN 80
            WHEN COALESCE(u.total_events, 0) >= 15 THEN 60
            WHEN COALESCE(u.total_events, 0) >= 5 THEN 40
            ELSE 0
        END AS usage_score,

        CASE
            WHEN COALESCE(sp.avg_resolution_hours, 0) <= 8 THEN 100
            WHEN COALESCE(sp.avg_resolution_hours, 0) <= 16 THEN 80
            WHEN COALESCE(sp.avg_resolution_hours, 0) <= 24 THEN 60
            ELSE 30
        END AS support_score,

        CASE
            WHEN COALESCE(b.total_invoices, 0) = 0 THEN 100

            WHEN
                COALESCE(b.failed_invoices, 0)::NUMERIC
                / NULLIF(b.total_invoices, 0) <= 0.10
                AND COALESCE(b.failed_invoices, 0) > 0
                THEN 80

            WHEN
                COALESCE(b.failed_invoices, 0)::NUMERIC
                / NULLIF(b.total_invoices, 0) <= 0.25
                THEN 60

            ELSE 30
        END AS billing_score

    FROM {{ ref('stg_customers') }} c

    LEFT JOIN usage u
        ON c.customer_id = u.customer_id

    LEFT JOIN subscription s
        ON c.customer_id = s.customer_id

    LEFT JOIN support sp
        ON c.customer_id = sp.customer_id

    LEFT JOIN billing b
        ON c.customer_id = b.customer_id

)

SELECT
    *,

    ROUND(
        usage_score * 0.40
        + support_score * 0.30
        + billing_score * 0.30,
        2
    ) AS health_score,

    CASE
        WHEN (
            usage_score * 0.40
            + support_score * 0.30
            + billing_score * 0.30
        ) >= 80
            THEN 'Healthy'

        WHEN (
            usage_score * 0.40
            + support_score * 0.30
            + billing_score * 0.30
        ) >= 60
            THEN 'Watch'

        ELSE 'At Risk'
    END AS health_status

FROM combined