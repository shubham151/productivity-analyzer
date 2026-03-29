"""Configuration loading and saving utilities."""

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent / "data"
_VERCEL_TMP = Path("/tmp")
_ON_VERCEL = os.environ.get("VERCEL") == "1"


def _data_path(filename: str) -> Path:
    """Return local data path, or /tmp fallback on Vercel."""
    return _VERCEL_TMP / filename if _ON_VERCEL else _DATA_DIR / filename


def _load_json(path: Path, default: Any = None) -> Any:
    """Read and parse a JSON file, returning default if the file does not exist."""
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        if default is not None:
            return default
        logger.error("File not found: %s", path)
        raise
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in %s: %s", path, e)
        raise


def _save_json(path: Path, data: Any) -> None:
    """Serialise data to JSON and write to path."""
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except OSError as e:
        logger.error("Failed to write %s: %s", path, e)
        raise


# ── Config ────────────────────────────────────────────────────────────────────

def load_config() -> dict[str, Any]:
    """Load config.json, falling back to the bundled default on Vercel."""
    path = _data_path("config.json")
    if _ON_VERCEL and not path.exists():
        path = _DATA_DIR / "config.json"   # bundled read-only default
    return _load_json(path)


def save_config(config: dict[str, Any]) -> None:
    """Save config.json."""
    _save_json(_data_path("config.json"), config)


# ── Metrics ───────────────────────────────────────────────────────────────────

def load_metrics() -> dict[str, Any]:
    """Load metrics.json, returning an empty dict if not yet pulled."""
    return _load_json(_data_path("metrics.json"), default={})


def save_metrics(metrics: dict[str, Any]) -> None:
    """Save metrics.json."""
    _save_json(_data_path("metrics.json"), metrics)


# ── AI cache ──────────────────────────────────────────────────────────────────

def load_ai_cache() -> dict[str, Any]:
    """Load ai_cache.json, returning an empty dict if not yet populated."""
    return _load_json(_data_path("ai_cache.json"), default={})


def save_ai_cache(cache: dict[str, Any]) -> None:
    """Save ai_cache.json."""
    _save_json(_data_path("ai_cache.json"), cache)


def clear_ai_cache() -> None:
    """Reset ai_cache.json to an empty object."""
    _save_json(_data_path("ai_cache.json"), {})
