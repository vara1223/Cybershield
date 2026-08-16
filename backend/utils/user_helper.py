from fastapi import Request
from urllib.parse import unquote

def extract_user_info(request: Request):
    """
    Extract user_name and user_email from request headers:
    X-User-Name and X-User-Email
    Returns a tuple: (user_name, user_email)
    """
    raw_name  = request.headers.get("X-User-Name", "").strip()
    raw_email = request.headers.get("X-User-Email", "").strip()

    user_name  = unquote(raw_name).strip()  or "User"
    user_email = unquote(raw_email).strip().lower() or None

    return user_name, user_email
