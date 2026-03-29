"""Configuration loading and saving utilities."""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

TMP_DIR = Path(__file__).parent / "tmp"
CONFIG_FILE = TMP_DIR / "config.json"
METRICS_FILE = TMP_DIR / "metrics.json"
AI_CACHE_FILE = TMP_DIR / "ai_cache.json"


def load_config() -> dict[str, Any]:
    """Load configuration from config.json."""
    try:
        with open(CONFIG_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("config.json not found at %s", CONFIG_FILE)
        raise
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in config.json: %s", e)
        raise


def save_config(config: dict[str, Any]) -> None:
    """Save configuration to config.json."""
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except OSError as e:
        logger.error("Failed to save config.json: %s", e)
        raise


def load_metrics() -> dict[str, Any]:
    """Load metrics from metrics.json."""
    try:
        with open(METRICS_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in metrics.json: %s", e)
        return {}


def save_metrics(metrics: dict[str, Any]) -> None:
    """Save metrics to metrics.json."""
    try:
        with open(METRICS_FILE, "w") as f:
            json.dump(metrics, f, indent=2)
    except OSError as e:
        logger.error("Failed to save metrics.json: %s", e)
        raise


def load_ai_cache() -> dict[str, Any]:
    """Load AI enrichment cache from ai_cache.json."""
    try:
        with open(AI_CACHE_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in ai_cache.json: %s", e)
        return {}


def save_ai_cache(cache: dict[str, Any]) -> None:
    """Save AI enrichment cache to ai_cache.json."""
    try:
        with open(AI_CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except OSError as e:
        logger.error("Failed to save ai_cache.json: %s", e)
        raise


def clear_ai_cache() -> None:
    """Clear all AI enrichment cache entries."""
    try:
        with open(AI_CACHE_FILE, "w") as f:
            json.dump({}, f)
    except OSError as e:
        logger.error("Failed to clear ai_cache.json: %s", e)
        raise
