"""
Voice service: Speech-to-text (local Whisper via openai-whisper) and
Text-to-speech (OpenAI TTS API — unchanged, gracefully skipped when no API key).

STT change: Uses the local openai/whisper-small model via the `whisper` package.
            No API key required. Model downloads on first use (~150 MB).
TTS unchanged: Still calls OpenAI tts-1. Returns None gracefully if OPENAI_API_KEY
               is not set, causing the system to fall back to text responses.
Language detection: Uses langdetect (local, free) instead of OpenAI.
"""
import io
import logging
import httpx
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def transcribe_audio_url(audio_url: str, audio_key: str, media_type: str) -> Optional[str]:
    """
    Download and decrypt audio from WasenderAPI, then transcribe with
    local Whisper (openai/whisper-small via the `whisper` package).

    No API key required — the model runs entirely on-device.
    First call downloads ~150 MB to the HuggingFace cache automatically.
    """
    import os
    import tempfile
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

    try:
        # Download encrypted audio
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(audio_url, follow_redirects=True)
        resp.raise_for_status()
        encrypted_bytes = resp.content

        # Decrypt (HKDF + AES-256-CBC) — unchanged helper below
        audio_bytes = _decrypt_whatsapp_media(encrypted_bytes, audio_key, media_type)

        # Write decrypted audio to a temp file (whisper expects a file path)
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # Transcribe locally with whisper-small
        import asyncio
        import whisper as _whisper

        model_name = settings.STT_MODEL.split("/")[-1]  # "openai/whisper-small" → "small"

        def _transcribe():
            model = _whisper.load_model(model_name)
            result = model.transcribe(tmp_path, fp16=False)  # fp16=False for CPU
            return result.get("text", "").strip()

        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, _transcribe)

        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

        logger.info(f"STT transcribed ({model_name}): '{text[:80]}'")
        return text if text else None

    except Exception as e:
        logger.error(f"Audio transcription failed: {e}")
        return None


def _decrypt_whatsapp_media(encrypted_data: bytes, media_key_b64: str, media_type: str) -> bytes:
    """Decrypt WhatsApp media using HKDF + AES-256-CBC."""
    import hashlib
    import hmac as _hmac
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    import base64

    info_map = {
        "audio": b"WhatsApp Audio Keys",
        "image": b"WhatsApp Image Keys",
        "video": b"WhatsApp Video Keys",
        "document": b"WhatsApp Document Keys",
    }
    info = info_map.get(media_type, b"WhatsApp Audio Keys")

    media_key = base64.b64decode(media_key_b64 + "==")  # pad base64

    # HKDF-SHA256
    def hkdf(ikm: bytes, length: int, salt: bytes = b"", info: bytes = b"") -> bytes:
        # Extract
        if not salt:
            salt = bytes(hashlib.sha256().digest_size)
        prk = _hmac.new(salt, ikm, hashlib.sha256).digest()
        # Expand
        okm = b""
        t = b""
        for i in range(1, (length + 31) // 32 + 1):
            t = _hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
            okm += t
        return okm[:length]

    keys = hkdf(media_key, 112, info=info)
    iv = keys[:16]
    cipher_key = keys[16:48]

    # Remove 10-byte MAC suffix
    ciphertext = encrypted_data[:-10]

    cipher = Cipher(algorithms.AES(cipher_key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    return decryptor.update(ciphertext) + decryptor.finalize()


async def text_to_speech(text: str, language: str = "en") -> Optional[bytes]:
    """
    Convert text to speech using OpenAI TTS.
    Returns MP3 audio bytes, or None if TTS is unavailable.
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OpenAI not configured — cannot generate TTS")
        return None

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text[:4096],  # TTS input limit
        )

        # Collect streaming bytes
        audio_bytes = b""
        async for chunk in response.iter_bytes():
            audio_bytes += chunk
        return audio_bytes

    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        return None


async def detect_language(text: str) -> str:
    """
    Detect language using langdetect (free, local, no API key).
    Returns ISO 639-1 code (e.g. 'en', 'te', 'hi').
    Falls back to 'en' on any error.
    """
    if not text.strip():
        return "en"

    try:
        from langdetect import detect
        lang = detect(text[:300])  # langdetect only needs a short sample
        # Normalise: langdetect returns 'en', 'te', 'hi' etc. — already ISO 639-1
        return lang[:2] if lang else "en"
    except Exception:
        return "en"
