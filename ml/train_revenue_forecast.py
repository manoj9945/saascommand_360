import getpass

import numpy as np
import pandas as pd
import psycopg
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error


def get_connection():
    password = getpass.getpass("Enter PostgreSQL password: ")

    return psycopg.connect(
        host="localhost",
        port=5432,
        dbname="saascommand_360",
        user="postgres",
        password=password,
    )


def load_revenue_data():
    query = """
        SELECT
            DATE_TRUNC('month', date_key)::date AS revenue_month,
            SUM(amount) AS monthly_revenue
        FROM analytics.fact_billing
        WHERE status = 'Paid'
        GROUP BY DATE_TRUNC('month', date_key)
        ORDER BY revenue_month;
    """

    with get_connection() as conn:
        df = pd.read_sql(query, conn)

    return df


def main():
    # ---------------------------------------------------------
    # 1. Load historical paid revenue
    # ---------------------------------------------------------
    df = load_revenue_data()

    print("\nHistorical revenue:")
    print(df.to_string(index=False))

    if len(df) < 6:
        raise ValueError(
            "At least 6 months of revenue history are required."
        )

    # ---------------------------------------------------------
    # 2. Create numeric time index
    # ---------------------------------------------------------
    df["time_index"] = np.arange(len(df))

    # ---------------------------------------------------------
    # 3. Split data into training and validation
    # ---------------------------------------------------------
    train = df.iloc[:-2].copy()
    test = df.iloc[-2:].copy()

    X_train = train[["time_index"]]
    y_train = train["monthly_revenue"]

    X_test = test[["time_index"]]
    y_test = test["monthly_revenue"]

    # ---------------------------------------------------------
    # 4. Train validation model
    # ---------------------------------------------------------
    model = LinearRegression()

    model.fit(
        X_train,
        y_train
    )

    # ---------------------------------------------------------
    # 5. Validate model
    # ---------------------------------------------------------
    predictions = model.predict(X_test)

    mae = mean_absolute_error(
        y_test,
        predictions
    )

    validation = test[
        ["revenue_month", "monthly_revenue"]
    ].copy()

    validation["predicted_revenue"] = predictions

    print("\nValidation results:")

    print(
        validation.to_string(
            index=False,
            formatters={
                "monthly_revenue": lambda x: f"₹{x:,.2f}",
                "predicted_revenue": lambda x: f"₹{x:,.2f}",
            },
        )
    )

    print(f"\nValidation MAE: ₹{mae:,.2f}")

    # ---------------------------------------------------------
    # 6. Train final model using all historical data
    # ---------------------------------------------------------
    final_model = LinearRegression()

    final_model.fit(
        df[["time_index"]],
        df["monthly_revenue"]
    )

    # ---------------------------------------------------------
    # 7. Forecast next 3 months
    # ---------------------------------------------------------
    future_indices = np.arange(
        len(df),
        len(df) + 3
    )

    future_predictions = final_model.predict(
        future_indices.reshape(-1, 1)
    )

    last_month = pd.Timestamp(
        df["revenue_month"].iloc[-1]
    )

    forecast_dates = [
        last_month + pd.DateOffset(months=i)
        for i in range(1, 4)
    ]

    forecast = pd.DataFrame(
        {
            "forecast_month": forecast_dates,
            "forecast_revenue": future_predictions,
        }
    )

    print("\nNext 3-month revenue forecast:")

    print(
        forecast.to_string(
            index=False,
            formatters={
                "forecast_revenue": lambda x: f"₹{x:,.2f}"
            },
        )
    )

    # ---------------------------------------------------------
    # 8. Save forecast to PostgreSQL
    # ---------------------------------------------------------
    insert_query = """
        INSERT INTO analytics.revenue_forecast (
            forecast_month,
            forecast_revenue,
            model_name,
            validation_mae
        )
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (forecast_month)
        DO UPDATE SET
            forecast_revenue = EXCLUDED.forecast_revenue,
            model_name = EXCLUDED.model_name,
            validation_mae = EXCLUDED.validation_mae,
            generated_at = CURRENT_TIMESTAMP;
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            for _, row in forecast.iterrows():
                cur.execute(
                    insert_query,
                    (
                        row["forecast_month"].date(),
                        float(row["forecast_revenue"]),
                        "Linear Regression",
                        float(mae),
                    ),
                )

        conn.commit()

    print("\nForecast saved successfully to PostgreSQL.")


if __name__ == "__main__":
    main()