"""
SaaSCommand 360 - Synthetic Data Generator

This script generates the synthetic CSV data used by the SaaSCommand 360 project.

It creates:
    accounts.csv
    users.csv
    product_events.csv
    subscriptions.csv
    invoices.csv
    support.csv
    dim_plan.csv

Default row counts:
    Accounts         : 5,000
    Users            : 20,000
    Product events   : 200,000
    Subscriptions    : 7,000
    Invoices         : 30,000
    Support tickets  : 20,000
    Plans            : 3

Usage:
    python generate_saascommand_data.py

Optional:
    python generate_saascommand_data.py --output data/raw --seed 42
"""

from pathlib import Path
import argparse
import numpy as np
import pandas as pd


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

N_ACCOUNTS = 5_000
N_USERS = 20_000
N_EVENTS = 200_000
N_SUBSCRIPTIONS = 7_000
N_INVOICES = 30_000
N_SUPPORT = 20_000

START_DATE = pd.Timestamp("2026-01-01")
END_DATE = pd.Timestamp("2026-09-25 23:59:59")
SUBSCRIPTION_START = pd.Timestamp("2025-07-01")
USER_START = pd.Timestamp("2026-01-01")


# ------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------

def random_timestamps(rng, start, end, n):
    """Return n random timestamps between start and end."""
    start_ns = start.value
    end_ns = end.value
    values = rng.integers(start_ns, end_ns, size=n)
    return pd.to_datetime(values)


def weighted_choice(rng, values, probabilities, n):
    return rng.choice(values, size=n, p=probabilities)


# ------------------------------------------------------------
# Main generator
# ------------------------------------------------------------

def generate_data(output_dir: str = "data/raw", seed: int = 42):
    rng = np.random.default_rng(seed)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("Generating SaaSCommand 360 synthetic data...")
    print(f"Output directory: {output_path.resolve()}")
    print(f"Random seed: {seed}")
    print()

    # --------------------------------------------------------
    # 1. Plan dimension
    # --------------------------------------------------------

    plans = pd.DataFrame({
        "plan_id": [1, 2, 3],
        "plan_name": ["Starter", "Professional", "Enterprise"],
        "monthly_price": [100, 250, 500],
    })

    plans.to_csv(output_path / "dim_plan.csv", index=False)

    # --------------------------------------------------------
    # 2. Accounts
    # --------------------------------------------------------

    account_ids = np.arange(100001, 100001 + N_ACCOUNTS)

    accounts = pd.DataFrame({
        "account_id": account_ids,
        "industry": weighted_choice(
            rng,
            ["Technology", "Manufacturing", "Retail", "Education",
             "Finance", "Healthcare"],
            [0.174, 0.170, 0.168, 0.164, 0.162, 0.162],
            N_ACCOUNTS,
        ),
        "size": weighted_choice(
            rng,
            ["Small", "Medium", "Large", "Enterprise"],
            [0.36, 0.36, 0.19, 0.10],
            N_ACCOUNTS,
        ),
        "region": weighted_choice(
            rng,
            ["West", "North", "South", "East"],
            [0.264, 0.249, 0.247, 0.240],
            N_ACCOUNTS,
        ),
        "owner": weighted_choice(
            rng,
            [f"CSM_{i:02d}" for i in range(1, 21)],
            [0.05] * 20,
            N_ACCOUNTS,
        ),
    })

    accounts.to_csv(output_path / "accounts.csv", index=False)

    # --------------------------------------------------------
    # 3. Users
    # --------------------------------------------------------

    user_ids = np.arange(200001, 200001 + N_USERS)

    users = pd.DataFrame({
        "user_id": user_ids,
        "account_id": rng.choice(account_ids, size=N_USERS, replace=True),
        "role": weighted_choice(
            rng,
            ["User", "Analyst", "Manager", "Admin"],
            [0.50, 0.25, 0.15, 0.10],
            N_USERS,
        ),
        "created_at": random_timestamps(
            rng, USER_START, END_DATE, N_USERS
        ),
    })

    users.to_csv(output_path / "users.csv", index=False)

    # --------------------------------------------------------
    # 4. Subscriptions
    # --------------------------------------------------------

    subscription_ids = np.arange(300001, 300001 + N_SUBSCRIPTIONS)

    subscription_plans = weighted_choice(
        rng,
        ["Starter", "Professional", "Enterprise"],
        [0.452, 0.398, 0.150],
        N_SUBSCRIPTIONS,
    )

    subscription_status = weighted_choice(
        rng,
        ["Active", "Cancelled", "Paused"],
        [0.818, 0.131, 0.051],
        N_SUBSCRIPTIONS,
    )

    subscriptions = pd.DataFrame({
        "subscription_id": subscription_ids,
        "account_id": rng.choice(account_ids, size=N_SUBSCRIPTIONS),
        "plan": subscription_plans,
        "start_date": random_timestamps(
            rng, SUBSCRIPTION_START, END_DATE, N_SUBSCRIPTIONS
        ),
        "status": subscription_status,
    })

    subscriptions.to_csv(output_path / "subscriptions.csv", index=False)

    # --------------------------------------------------------
    # 5. Invoices
    # --------------------------------------------------------

    invoice_ids = np.arange(400001, 400001 + N_INVOICES)
    invoice_accounts = rng.choice(account_ids, size=N_INVOICES)

    # Use plan prices so invoice amounts remain business-plausible.
    amount = rng.choice([100, 250, 500], size=N_INVOICES, p=[0.452, 0.398, 0.150])

    invoice_status = weighted_choice(
        rng,
        ["Paid", "Pending", "Overdue", "Failed"],
        [0.778, 0.100, 0.061, 0.061],
        N_INVOICES,
    )

    invoices = pd.DataFrame({
        "invoice_id": invoice_ids,
        "account_id": invoice_accounts,
        "amount": amount,
        "due_date": random_timestamps(
            rng, START_DATE, END_DATE, N_INVOICES
        ),
        "status": invoice_status,
    })

    invoices.to_csv(output_path / "invoices.csv", index=False)

    # --------------------------------------------------------
    # 6. Product events
    # --------------------------------------------------------

    event_ids = np.arange(600001, 600001 + N_EVENTS)

    product_events = pd.DataFrame({
        "event_id": event_ids,
        "user_id": rng.choice(user_ids, size=N_EVENTS),
        "feature": weighted_choice(
            rng,
            ["Dashboard", "Reports", "Export",
             "Integrations", "Billing", "AI_Assistant"],
            [0.249, 0.200, 0.150, 0.150, 0.150, 0.101],
            N_EVENTS,
        ),
        "timestamp": random_timestamps(
            rng, START_DATE, END_DATE, N_EVENTS
        ),
    })

    product_events.to_csv(output_path / "product_events.csv", index=False)

    # --------------------------------------------------------
    # 7. Support tickets
    # --------------------------------------------------------

    ticket_ids = np.arange(500001, 500001 + N_SUPPORT)

    created_at = random_timestamps(
        rng, START_DATE, END_DATE, N_SUPPORT
    )

    # Resolution time in hours. Critical tickets generally resolve faster
    # than low-priority tickets in this synthetic dataset.
    severity = weighted_choice(
        rng,
        ["Low", "Medium", "High", "Critical"],
        [0.442, 0.355, 0.150, 0.053],
        N_SUPPORT,
    )

    resolution_hours = np.empty(N_SUPPORT)

    masks = {
        "Low": severity == "Low",
        "Medium": severity == "Medium",
        "High": severity == "High",
        "Critical": severity == "Critical",
    }

    resolution_hours[masks["Low"]] = rng.uniform(1, 48, masks["Low"].sum())
    resolution_hours[masks["Medium"]] = rng.uniform(1, 36, masks["Medium"].sum())
    resolution_hours[masks["High"]] = rng.uniform(1, 24, masks["High"].sum())
    resolution_hours[masks["Critical"]] = rng.uniform(0.5, 12, masks["Critical"].sum())

    resolved_at = created_at + pd.to_timedelta(resolution_hours, unit="h")

    support = pd.DataFrame({
        "ticket_id": ticket_ids,
        "account_id": rng.choice(account_ids, size=N_SUPPORT),
        "severity": severity,
        "created_at": created_at,
        "resolved_at": resolved_at,
    })

    support.to_csv(output_path / "support.csv", index=False)

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("Data generation completed successfully.")
    print()
    print("Files created:")

    for filename in [
        "accounts.csv",
        "users.csv",
        "product_events.csv",
        "subscriptions.csv",
        "invoices.csv",
        "support.csv",
        "dim_plan.csv",
    ]:
        file_path = output_path / filename
        rows = len(pd.read_csv(file_path))
        print(f"  {filename:<22} {rows:,} rows")

    print()
    print("IMPORTANT:")
    print("1. Keep data/raw/ out of Git if it contains the large raw dataset.")
    print("2. The generator script itself can be committed to GitHub.")
    print("3. This script generates the same project schema and scale,")
    print("   but not byte-for-byte identical random values to the supplied ZIP.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate SaaSCommand 360 synthetic CSV data."
    )

    parser.add_argument(
        "--output",
        default="data/raw",
        help="Directory where CSV files will be created.",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible generation.",
    )

    args = parser.parse_args()

    generate_data(
        output_dir=args.output,
        seed=args.seed,
    )
