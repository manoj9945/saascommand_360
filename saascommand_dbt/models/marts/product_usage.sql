WITH valid_events AS (

    SELECT
        event_id,
        user_id,
        feature,
        event_timestamp,
        event_timestamp::DATE AS usage_date
    FROM {{ ref('stg_product_events') }}
    WHERE is_valid_event = TRUE

),

daily_usage AS (

    SELECT
        usage_date,
        feature,

        COUNT(*) AS total_events,

        COUNT(DISTINCT user_id) AS daily_active_users

    FROM valid_events
    GROUP BY
        usage_date,
        feature

),

monthly_usage AS (

    SELECT
        DATE_TRUNC('month', usage_date)::DATE AS month_start,
        feature,

        COUNT(DISTINCT user_id) AS monthly_active_users

    FROM valid_events
    GROUP BY
        DATE_TRUNC('month', usage_date)::DATE,
        feature

)

SELECT
    d.usage_date,
    d.feature,
    d.total_events,
    d.daily_active_users,
    m.monthly_active_users,

    ROUND(
        d.daily_active_users::NUMERIC
        / NULLIF(m.monthly_active_users, 0) * 100,
        2
    ) AS daily_to_monthly_active_pct

FROM daily_usage d

JOIN monthly_usage m
    ON DATE_TRUNC('month', d.usage_date)::DATE = m.month_start
   AND d.feature = m.feature

ORDER BY
    d.usage_date,
    d.feature