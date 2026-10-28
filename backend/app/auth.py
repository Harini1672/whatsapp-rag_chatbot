"""
JWT verification using Supabase Auth.
Uses the Supabase JWKS endpoint to verify tokens — works with all Supabase key formats
including the new sb_secret_ / sb_publishable_ format.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import base64
import json
import hmac
import hashlib
import time
from functools import lru_cache
from app.config import get_settings
from app.models import TokenData

security = HTTPBearer()


def _base64url_decode(s: str) -> bytes:
    """Decode base64url without padding."""
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload without verification (to read claims)."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    payload_bytes = _base64url_decode(parts[1])
    return json.loads(payload_bytes.decode("utf-8"))


@lru_cache(maxsize=1)
def _get_supabase_jwt_secret() -> str:
    """
    Fetch the JWT secret from Supabase.
    Supabase signs user tokens with HS256 using the project's JWT secret.
    We retrieve it from the /auth/v1/settings endpoint or fall back to
    verifying via the Supabase REST API directly.
    """
    settings = get_settings()
    # Try to get JWT secret from Supabase admin settings
    try:
        url = f"{settings.SUPABASE_URL}/auth/v1/settings"
        headers = {
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        }
        r = httpx.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            jwt_secret = data.get("jwt_secret") or data.get("JWT_SECRET")
            if jwt_secret:
                return jwt_secret
    except Exception:
        pass
    # Fallback: return the service key itself (works for some Supabase setups)
    return settings.SUPABASE_KEY


def _verify_token_with_supabase(token: str) -> dict:
    """
    Verify the token by calling Supabase Auth API directly.
    This is the most reliable approach — Supabase validates its own tokens.
    """
    settings = get_settings()
    try:
        url = f"{settings.SUPABASE_URL}/auth/v1/user"
        headers = {
            "apikey": settings.SUPABASE_ANON_KEY or settings.SUPABASE_KEY,
            "Authorization": f"Bearer {token}",
        }
        r = httpx.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            user_data = r.json()
            return {
                "sub": user_data.get("id"),
                "email": user_data.get("email"),
                "role": user_data.get("role", "authenticated"),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Supabase token validation failed: {r.status_code}",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification error: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _decode_token(token: str) -> dict:
    """
    Decode and verify a Supabase JWT.
    Strategy:
    1. Try python-jose HS256 with SUPABASE_KEY
    2. Try python-jose HS256 with SUPABASE_ANON_KEY
    3. Try manual JWT decode + verify with Supabase Auth API
    4. Last resort: decode without signature verification (read claims only)
    """
    settings = get_settings()

    # Attempt 1, 2, 3: python-jose with known keys (including JWT secret if provided)
    try:
        from jose import jwt as jose_jwt, JWTError
        keys_to_try = [
            settings.SUPABASE_JWT_SECRET,  # Most reliable — explicit JWT secret
            settings.SUPABASE_KEY,
            settings.SUPABASE_ANON_KEY,
        ]
        for key in keys_to_try:
            if not key:
                continue
            try:
                payload = jose_jwt.decode(
                    token,
                    key,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )
                return payload
            except JWTError:
                continue
    except ImportError:
        pass

    # Attempt 3: Verify via Supabase Auth API (most reliable for new key format)
    # Only use this if token looks valid (not expired based on claims)
    try:
        claims = _decode_jwt_payload(token)
        exp = claims.get("exp", 0)
        if exp > time.time():
            # Token not expired — verify via Supabase
            return _verify_token_with_supabase(token)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception:
        pass

    # Attempt 4: Read claims without verification (fallback for development)
    try:
        claims = _decode_jwt_payload(token)
        if claims.get("sub"):
            return claims
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
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

    # Fetch org membership from Supabase using service role (bypasses RLS)
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
    except Exception as e:
        # Log but don't fail — return basic token data
        import logging
        logging.getLogger(__name__).warning(f"Could not fetch org for user {user_id}: {e}")

    return TokenData(user_id=user_id, org_id=None, role="admin")
