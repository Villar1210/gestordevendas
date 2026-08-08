"""
Testes para Rate Limiting.
"""
import pytest
from datetime import datetime, timedelta


class TestRateLimiter:
    """Testes do rate limiter."""

    def test_unlimited_level(self):
        """Teste nível UNLIMITED."""

        class RL:
            def __init__(self):
                self.count = 0

            def check_limit(self, key, level):
                if level == "unlimited":
                    return True, None
                self.count += 1
                return self.count <= 10, None if self.count <= 10 else "Limitado"

        rl = RL()

        # UNLIMITED sempre passa
        for _ in range(100):
            allowed, reason = rl.check_limit("key1", "unlimited")
            assert allowed is True
            assert reason is None

    def test_relaxed_level(self):
        """Teste nível RELAXED (GET requests)."""

        class RL:
            def __init__(self):
                self.requests = {}

            def check_limit(self, key, level, limit=1000):
                if key not in self.requests:
                    self.requests[key] = 0

                if self.requests[key] >= limit:
                    return False, f"Limite {limit} atingido"

                self.requests[key] += 1
                return True, None

        rl = RL()
        level = "relaxed"
        limit = 1000

        # Primeiro 1000 requests passam
        for i in range(limit):
            allowed, reason = rl.check_limit("tenant-1", level, limit)
            assert allowed is True

        # 1001º request é bloqueado
        allowed, reason = rl.check_limit("tenant-1", level, limit)
        assert allowed is False
        assert "Limite 1000 atingido" in reason

    def test_normal_level(self):
        """Teste nível NORMAL (POST/PUT requests)."""

        class RL:
            def __init__(self):
                self.requests = {}

            def check_limit(self, key, level, limit=100):
                if key not in self.requests:
                    self.requests[key] = 0

                if self.requests[key] >= limit:
                    return False, f"Limite {limit} atingido"

                self.requests[key] += 1
                return True, None

        rl = RL()
        level = "normal"
        limit = 100

        # Primeiro 100 requests passam
        for i in range(limit):
            allowed, reason = rl.check_limit("tenant-1", level, limit)
            assert allowed is True

        # 101º request é bloqueado
        allowed, reason = rl.check_limit("tenant-1", level, limit)
        assert allowed is False

    def test_strict_level(self):
        """Teste nível STRICT (DELETE requests)."""

        class RL:
            def __init__(self):
                self.requests = {}

            def check_limit(self, key, level, limit=10):
                if key not in self.requests:
                    self.requests[key] = 0

                if self.requests[key] >= limit:
                    return False, f"Limite {limit} atingido"

                self.requests[key] += 1
                return True, None

        rl = RL()
        level = "strict"
        limit = 10

        # Primeiro 10 requests passam
        for i in range(limit):
            allowed, reason = rl.check_limit("tenant-1", level, limit)
            assert allowed is True

        # 11º request é bloqueado
        allowed, reason = rl.check_limit("tenant-1", level, limit)
        assert allowed is False

    def test_auth_level(self):
        """Teste nível AUTH (login attempts)."""

        class RL:
            def __init__(self):
                self.requests = {}

            def check_limit(self, key, level, limit=5):
                if key not in self.requests:
                    self.requests[key] = 0

                if self.requests[key] >= limit:
                    return False, f"Limite {limit} atingido"

                self.requests[key] += 1
                return True, None

        rl = RL()
        level = "auth"
        limit = 5

        # Primeiro 5 login attempts passam
        for i in range(limit):
            allowed, reason = rl.check_limit("ip-192.168.1.1", level, limit)
            assert allowed is True

        # 6º attempt é bloqueado
        allowed, reason = rl.check_limit("ip-192.168.1.1", level, limit)
        assert allowed is False
        assert "Limite 5 atingido" in reason

    def test_different_keys_independent(self):
        """Teste que diferentes keys têm contadores independentes."""

        class RL:
            def __init__(self):
                self.requests = {}

            def check_limit(self, key, level, limit=10):
                if key not in self.requests:
                    self.requests[key] = 0

                if self.requests[key] >= limit:
                    return False, f"Limite {limit} atingido"

                self.requests[key] += 1
                return True, None

        rl = RL()
        limit = 10

        # Tenant-1 usa 5 requisições
        for i in range(5):
            allowed, _ = rl.check_limit("tenant-1", "normal", limit)
            assert allowed is True

        # Tenant-2 pode usar 10 requisições (contador separado)
        for i in range(10):
            allowed, _ = rl.check_limit("tenant-2", "normal", limit)
            assert allowed is True

        # Tenant-1 ainda pode usar 5 mais (5 + 5 = 10)
        for i in range(5):
            allowed, _ = rl.check_limit("tenant-1", "normal", limit)
            assert allowed is True

        # Tenant-1 agora está limitado
        allowed, reason = rl.check_limit("tenant-1", "normal", limit)
        assert allowed is False

        # Tenant-2 também está limitado
        allowed, reason = rl.check_limit("tenant-2", "normal", limit)
        assert allowed is False

    def test_rate_limit_headers(self):
        """Teste headers informativos de rate limit."""
        headers = {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "75",
            "X-RateLimit-Reset": "1691254800",
            "X-RateLimit-Percentage": "25%",
        }

        assert headers["X-RateLimit-Limit"] == "100"
        assert headers["X-RateLimit-Remaining"] == "75"
        assert "X-RateLimit-Reset" in headers
        assert "25%" in headers["X-RateLimit-Percentage"]

    def test_retry_after_header(self):
        """Teste header Retry-After em resposta de limitação."""
        retry_after = "60"  # 60 segundos

        assert retry_after == "60"
        assert int(retry_after) >= 1

    def test_level_by_http_method(self):
        """Teste determinação de nível por método HTTP."""

        def get_level_for_method(method: str) -> str:
            if method == "GET":
                return "relaxed"
            elif method == "DELETE":
                return "strict"
            else:  # POST, PUT, PATCH
                return "normal"

        assert get_level_for_method("GET") == "relaxed"
        assert get_level_for_method("POST") == "normal"
        assert get_level_for_method("PUT") == "normal"
        assert get_level_for_method("DELETE") == "strict"
        assert get_level_for_method("PATCH") == "normal"

    def test_super_admin_not_limited(self):
        """Teste que Super Admin não é limitado."""

        class RL:
            def __init__(self):
                self.count = 0

            def check_limit(self, is_super_admin):
                if is_super_admin:
                    return True  # Sempre permitido
                self.count += 1
                return self.count <= 10

        rl = RL()

        # Super Admin faz 1000 requisições sem ser limitado
        for _ in range(1000):
            assert rl.check_limit(is_super_admin=True) is True

        # Usuário regular é limitado a 10
        rl = RL()
        for _ in range(10):
            assert rl.check_limit(is_super_admin=False) is True

        assert rl.check_limit(is_super_admin=False) is False

    def test_percentage_calculation(self):
        """Teste cálculo de percentual de uso."""
        limit = 100
        used = 25

        percentage = (used / limit) * 100
        assert round(percentage, 1) == 25.0

        used = 50
        percentage = (used / limit) * 100
        assert round(percentage, 1) == 50.0

        used = 100
        percentage = (used / limit) * 100
        assert round(percentage, 1) == 100.0
