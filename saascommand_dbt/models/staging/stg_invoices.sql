SELECT
    invoice_id,
    account_id AS customer_id,
    amount,
    due_date,
    status
FROM silver.invoices