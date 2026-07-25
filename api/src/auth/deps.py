"""Re-exports from middleware for backward compatibility."""
from api.src.auth.middleware import require_auth, get_current_user
from api.src.features.deps import require_feature

__all__ = ["require_auth", "require_feature", "get_current_user"]
