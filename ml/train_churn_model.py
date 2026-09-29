import os
import getpass
import psycopg
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    roc_auc_score,
    classification_report,
)

import joblib


# ---------------------------------------------------------
# 1. PostgreSQL connection
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
# 2. Build ML dataset
# ---------------------------------------------------------

query = """
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
                    resolved_at::TIMESTAMP - created_at::TIMESTAMP
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

    COALESCE(sp.support_ticket_count, 0) AS support_ticket_count,
    COALESCE(sp.avg_resolution_hours, 0) AS avg_resolution_hours,

    COALESCE(bf.invoice_count, 0) AS invoice_count,
    COALESCE(bf.failed_invoice_count, 0) AS failed_invoice_count,

    CASE
        WHEN COALESCE(bf.invoice_count, 0) > 0
        THEN
            COALESCE(bf.failed_invoice_count, 0)::FLOAT
            / bf.invoice_count
        ELSE 0
    END AS failed_invoice_rate,

    sf.churned

FROM silver.accounts a

INNER JOIN subscription_features sf
    ON a.account_id = sf.account_id

LEFT JOIN usage_features uf
    ON a.account_id = uf.account_id

LEFT JOIN support_features sp
    ON a.account_id = sp.account_id

LEFT JOIN billing_features bf
    ON a.account_id = bf.account_id
"""


df = pd.read_sql(query, conn)

conn.close()


# ---------------------------------------------------------
# 3. Display dataset information
# ---------------------------------------------------------

print("\n========== CHURN ML DATASET ==========")

print("\nShape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nChurn distribution:")
print(df["churned"].value_counts())


# ---------------------------------------------------------
# 4. Prepare features and target
# ---------------------------------------------------------

target = "churned"

X = df.drop(columns=[target])
y = df[target].astype(int)


# Date is converted into subscription age.
reference_date = pd.Timestamp("2026-12-31")

X["subscription_age_days"] = (
    reference_date - pd.to_datetime(X["latest_subscription_start"])
).dt.days

X = X.drop(columns=["latest_subscription_start"])


# ---------------------------------------------------------
# 5. Define feature types
# ---------------------------------------------------------

categorical_features = [
    "industry",
    "size",
    "region",
]

numeric_features = [
    "subscription_count",
    "avg_plan_price",
    "max_plan_price",
    "usage_events",
    "features_used",
    "support_ticket_count",
    "avg_resolution_hours",
    "invoice_count",
    "failed_invoice_count",
    "failed_invoice_rate",
    "subscription_age_days",
]


# ---------------------------------------------------------
# 6. Preprocessing
# ---------------------------------------------------------

numeric_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ]
)


categorical_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ]
)


preprocessor = ColumnTransformer(
    transformers=[
        ("numeric", numeric_pipeline, numeric_features),
        ("categorical", categorical_pipeline, categorical_features),
    ]
)


# ---------------------------------------------------------
# 7. Logistic Regression model
# ---------------------------------------------------------

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),

        (
            "classifier",
            LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
            ),
        ),
    ]
)


# ---------------------------------------------------------
# 8. Train/test split
# ---------------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)


print("\nTraining rows:", len(X_train))
print("Testing rows:", len(X_test))


# ---------------------------------------------------------
# 9. Train
# ---------------------------------------------------------

print("\n========== TRAINING MODEL ==========")

model.fit(X_train, y_train)


# ---------------------------------------------------------
# 10. Predictions
# ---------------------------------------------------------

y_pred = model.predict(X_test)

y_probability = model.predict_proba(X_test)[:, 1]


# ---------------------------------------------------------
# 11. Evaluation
# ---------------------------------------------------------

accuracy = accuracy_score(y_test, y_pred)

precision = precision_score(
    y_test,
    y_pred,
    zero_division=0,
)

recall = recall_score(
    y_test,
    y_pred,
    zero_division=0,
)

roc_auc = roc_auc_score(
    y_test,
    y_probability,
)


print("\n========== MODEL RESULTS ==========")

print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall   : {recall:.4f}")
print(f"ROC-AUC  : {roc_auc:.4f}")


print("\nClassification Report:")
print(
    classification_report(
        y_test,
        y_pred,
        zero_division=0,
    )
)


# ---------------------------------------------------------
# 12. Save model
# ---------------------------------------------------------

os.makedirs("models", exist_ok=True)

model_path = "models/churn_model.joblib"

joblib.dump(model, model_path)

print("\nModel saved to:")
print(model_path)