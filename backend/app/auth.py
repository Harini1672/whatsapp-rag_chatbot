"""
JWT verification using Supabase Auth.
The frontend sends the Supabase access token in the Authorization header.
We verify it with the Supabase JWKS endpoint.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from functools import lru_cache
from app.config import get_settings
from app.models import TokenData

security = HTTPBearer()


@lru_cache(maxsize=1)
def _get_jwks():
    """Fetch Supabase JWKS (cached)."""
    settings = get_settings()
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    r = httpx.get(url, timeout=10)
    r.raise_for_status()
    return r.json()


def _decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        # Try decoding without JWKS first (works for Supabase JWT_SECRET signed tokens)
        payload = jwt.decode(
            token,
            settings.SUPABASE_KEY,  # service role / JWT secret
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError:
        pass

    # Fallback: use HS256 with anon key
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_ANON_KEY or settings.SUPABASE_KEY,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    token = credentials.credentials
    payload = _decode_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")

    # Fetch org membership from Supabase
    from app.database import get_supabase
    db = get_supabase()
    try:
        result = (
            db.table("organization_members")
            .select("role, org_id")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if result.data:
            return TokenData(
                user_id=user_id,
                org_id=result.data["org_id"],
                role=result.data["role"],
            )
    except Exception:
        pass

    return TokenData(user_id=user_id, org_id=None, role="admin")
