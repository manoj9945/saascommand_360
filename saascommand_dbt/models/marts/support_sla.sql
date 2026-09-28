WITH support_metrics AS (

    SELECT
        ticket_id,
        customer_id,
        severity,
        created_at,
        resolved_at,
        resolution_hours,

        CASE
            WHEN severity = 'Critical' THEN 4
            WHEN severity = 'High' THEN 8
            WHEN severity = 'Medium' THEN 24
            WHEN severity = 'Low' THEN 48
        END AS sla_hours

    FROM {{ ref('stg_support') }}

),

sla_calculated AS (

    SELECT
        *,
        
        CASE
            WHEN resolved_at IS NULL THEN FALSE
            WHEN resolution_hours <= sla_hours THEN TRUE
            ELSE FALSE
        END AS within_sla

    FROM support_metrics

)

SELECT
    ticket_id,
    customer_id,
    severity,
    created_at,
    resolved_at,
    resolution_hours,
    sla_hours,
    within_sla,

    CASE
        WHEN within_sla = TRUE THEN 'Within SLA'
        WHEN resolved_at IS NULL THEN 'Unresolved'
        ELSE 'Breached SLA'
    END AS sla_status

FROM sla_calculated