"""
CaughtIn4K — Vercel Python serverless entrypoint.

Vercel's @vercel/python builder looks for a top-level ``app`` variable in this
file. We declare it unconditionally so the builder's static analysis can find
it, then attempt to load the real backend at import time.
"""
import importlib.util
import os
import sys
import traceback

from fastapi import FastAPI
from fastapi.responses import JSONResponse

_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_HERE)
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")
_MAIN_FILE = os.path.join(_BACKEND_DIR, "main.py")

# ---- Unconditional top-level assignment (Vercel requires this) ----
app = FastAPI(title="CaughtIn4K API (fallback)")


def _load_app():
    """
    Load ``backend.main`` from its absolute file path and return its
    ``app`` attribute.
    """
    if _BACKEND_DIR not in sys.path:
        sys.path.insert(0, _BACKEND_DIR)
    if _PROJECT_ROOT not in sys.path:
        sys.path.insert(0, _PROJECT_ROOT)

    spec = importlib.util.spec_from_file_location(
        "backend_main", _MAIN_FILE
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(
            f"Could not build import spec for {_MAIN_FILE!r}."
        )
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("backend", importlib.util.module_from_spec(
        importlib.util.spec_from_loader("backend", loader=None)
    ))
    sys.modules["backend.main"] = module
    spec.loader.exec_module(module)
    return module.app


try:
    app = _load_app()
except Exception as _exc:  # pragma: no cover
    _tb = traceback.format_exc()

    @app.get("/api/health")
    def _health():
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": str(_exc),
                "error_type": type(_exc).__name__,
                "traceback": _tb,
                "sys_path": sys.path[:8],
                "project_root": _PROJECT_ROOT,
                "backend_dir": _BACKEND_DIR,
                "main_file": _MAIN_FILE,
                "main_file_exists": os.path.exists(_MAIN_FILE),
                "cwd": os.getcwd(),
                "listdir_backend": sorted(os.listdir(_BACKEND_DIR))
                if os.path.isdir(_BACKEND_DIR) else None,
            },
        )

    @app.post("/api/analyze")
    def _analyze():
        return JSONResponse(
            status_code=500,
            content={"detail": "backend not loaded — see /api/health"},
        )


__all__ = ["app"]

