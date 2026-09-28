SELECT
    subscription_id,
    account_id AS customer_id,
    plan,
    start_date,
    status
FROM silver.subscriptions