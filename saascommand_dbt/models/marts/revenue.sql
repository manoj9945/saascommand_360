WITH subscription_metrics AS (

    SELECT
        plan,

        COUNT(*) FILTER (
            WHERE status = 'Active'
        ) AS active_subscriptions,

        COUNT(DISTINCT customer_id) FILTER (
            WHERE status = 'Active'
        ) AS active_customers,

        COUNT(*) FILTER (
            WHERE status = 'Cancelled'
        ) AS cancelled_subscriptions,

        SUM(
            CASE
                WHEN status = 'Active' THEN
                    CASE
                        WHEN plan = 'Starter' THEN 100
                        WHEN plan = 'Professional' THEN 250
                        WHEN plan = 'Enterprise' THEN 500
                        ELSE 0
                    END
                ELSE 0
            END
        ) AS active_mrr,

        SUM(
            CASE
                WHEN status = 'Cancelled' THEN
                    CASE
                        WHEN plan = 'Starter' THEN 100
                        WHEN plan = 'Professional' THEN 250
                        WHEN plan = 'Enterprise' THEN 500
                        ELSE 0
                    END
                ELSE 0
            END
        ) AS cancelled_mrr

    FROM {{ ref('stg_subscriptions') }}

    GROUP BY plan
)

SELECT
    plan,
    active_subscriptions,
    active_customers,
    cancelled_subscriptions,

    active_mrr,

    active_mrr * 12 AS active_arr,

    cancelled_mrr,

    ROUND(
        cancelled_mrr / NULLIF(active_mrr + cancelled_mrr, 0) * 100,
        2
    ) AS cancelled_revenue_share_pct

FROM subscription_metrics