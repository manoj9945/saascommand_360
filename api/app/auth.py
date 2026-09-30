import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash


# =========================================================
# Password hashing
# =========================================================

password_hash = PasswordHash.recommended()


# =========================================================
# JWT configuration
# =========================================================

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")

    if not secret:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is not configured."
        )

    return secret


# =========================================================
# Password functions
# =========================================================

def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


# =========================================================
# JWT functions
# =========================================================

def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            get_jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=401,
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# =========================================================
# Authentication dependencies
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)

    if not payload.get("sub") or not payload.get("email") or not payload.get("role"):
        raise HTTPException(
            status_code=401,
            detail="Invalid access token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user
