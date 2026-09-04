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

# Vercel invokes ``api/index.py`` with the project root as the working
# directory. The ``backend/`` package lives at the project root (a
# sibling of ``api/``), so we add its absolute path to ``sys.path`` and
# then import the ASGI ``app`` from ``main.py``.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from main import app  # noqa: E402  (sys.path manipulation above)

__all__ = ["app"]