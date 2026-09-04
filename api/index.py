"""
CaughtIn4K — Vercel Python serverless entrypoint.

This module re-exports the FastAPI application defined in
``backend/main.py`` so that Vercel's Python builder can serve it as an
ASGI function at ``/api/*``.

No FastAPI application is duplicated here. The same routes
(``/api/health``, ``/api/analyze``) and analyzer chain (URL, Webpage,
NLP, Visual) are preserved exactly as they exist in ``backend/main.py``.
"""
import os
import sys

# Make ``backend`` importable when this file is executed from the project
# root by Vercel's Python runtime. We append the absolute path of the
# ``backend`` package directory and then import the ASGI ``app``.
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from main import app  # noqa: E402  (sys.path manipulation above)

__all__ = ["app"]
