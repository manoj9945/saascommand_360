import getpass
import sys
from pathlib import Path

# Allow imports from the project root
PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.app.db import get_connection
from api.app.auth import hash_password


def main():

    print("=" * 50)
    print("SaaSCommand 360 - Create Admin User")
    print("=" * 50)

    email = input("Admin email: ").strip()
    full_name = input("Full name: ").strip()

    password = getpass.getpass("Password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if password != confirm_password:
        print("Passwords do not match.")
        return

    if len(password) < 8:
        print("Password must contain at least 8 characters.")
        return

    hashed_password = hash_password(password)

    conn = get_connection()

    try:

        with conn.cursor() as cur:

            cur.execute(
                """
                INSERT INTO public.app_users (
                    email,
                    password_hash,
                    full_name,
                    role,
                    is_active
                )
                VALUES (%s, %s, %s, 'admin', TRUE)
                ON CONFLICT (email)
                DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    full_name = EXCLUDED.full_name,
                    role = 'admin',
                    is_active = TRUE
                RETURNING user_id, email, full_name, role;
                """,
                (
                    email,
                    hashed_password,
                    full_name,
                ),
            )

            user = cur.fetchone()

        conn.commit()

        print()
        print("Admin user created successfully.")
        print(f"User ID: {user[0]}")
        print(f"Email: {user[1]}")
        print(f"Name: {user[2]}")
        print(f"Role: {user[3]}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()