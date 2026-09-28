SELECT
    ticket_id,
    account_id AS customer_id,
    severity,
    created_at,
    resolved_at,
    ROUND(
        (EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::NUMERIC,
        2
    ) AS resolution_hours
FROM silver.support