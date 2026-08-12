"""
Configuração de Logging Estruturado
JSON logs para produção, formato legível para desenvolvimento
"""
import logging
import json
import os
from datetime import datetime
from typing import Any, Dict
from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Formatter customizado para logs JSON estruturados"""

    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)

        # Adicionar timestamp ISO
        log_record["timestamp"] = datetime.utcnow().isoformat()

        # Adicionar nível de log
        log_record["level"] = record.levelname

        # Adicionar informações de origem
        log_record["logger"] = record.name
        log_record["module"] = record.module
        log_record["function"] = record.funcName
        log_record["line"] = record.lineno

        # Adicionar PID (útil para debugging)
        log_record["pid"] = os.getpid()


class StructuredLogger:
    """Logger estruturado com suporte a contexto"""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.context = {}

    def set_context(self, **kwargs):
        """Definir contexto global para este logger"""
        self.context.update(kwargs)

    def clear_context(self):
        """Limpar contexto"""
        self.context = {}

    def _add_context(self, extra: Dict[str, Any] = None) -> Dict[str, Any]:
        """Combinar contexto com extra"""
        combined = self.context.copy()
        if extra:
            combined.update(extra)
        return combined

    def debug(self, msg: str, **kwargs):
        """Log de debug"""
        extra = self._add_context(kwargs)
        self.logger.debug(msg, extra=extra)

    def info(self, msg: str, **kwargs):
        """Log de info"""
        extra = self._add_context(kwargs)
        self.logger.info(msg, extra=extra)

    def warning(self, msg: str, **kwargs):
        """Log de warning"""
        extra = self._add_context(kwargs)
        self.logger.warning(msg, extra=extra)

    def error(self, msg: str, **kwargs):
        """Log de error"""
        extra = self._add_context(kwargs)
        self.logger.error(msg, extra=extra, exc_info=True)

    def critical(self, msg: str, **kwargs):
        """Log de critical"""
        extra = self._add_context(kwargs)
        self.logger.critical(msg, extra=extra, exc_info=True)


def configure_logging(env: str = "development"):
    """Configurar logging para o projeto"""

    # Criar pasta de logs se não existir
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)

    # ── Logger root ────────────────────────────────────────────────────
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if env == "development" else logging.INFO)

    # ── Handler para console ────────────────────────────────────────────
    console_handler = logging.StreamHandler()

    if env == "development":
        # Desenvolvimento: formato legível
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    else:
        # Produção: formato JSON
        console_formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(logger)s %(message)s'
        )

    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # ── Handler para arquivo (JSON em produção) ────────────────────────
    if env == "production":
        file_handler = logging.FileHandler(f"{log_dir}/app.json")
        file_formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(logger)s %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
    else:
        # Desenvolvimento: arquivo de log simples
        file_handler = logging.FileHandler(f"{log_dir}/app.log")
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)

    # ── Handler de erro separado ────────────────────────────────────────
    error_handler = logging.FileHandler(f"{log_dir}/errors.log")
    error_handler.setLevel(logging.ERROR)
    error_formatter = CustomJsonFormatter(
        '%(timestamp)s %(level)s %(logger)s %(message)s'
    )
    error_handler.setFormatter(error_formatter)
    root_logger.addHandler(error_handler)

    return root_logger


def get_structured_logger(name: str) -> StructuredLogger:
    """Obter um logger estruturado"""
    return StructuredLogger(name)
