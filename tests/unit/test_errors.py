"""tests/unit/test_errors.py"""

from __future__ import annotations

import pytest

from voyagestar.infra.errors import ErrorCode, VoyagestarError


def test_voyagestar_error_carries_code_and_status():
    err = VoyagestarError(ErrorCode.AGENT_NOT_FOUND, "missing", details={"id": "a"})
    assert err.code is ErrorCode.AGENT_NOT_FOUND
    assert err.status == 404
    assert err.message == "missing"
    assert err.details == {"id": "a"}


def test_voyagestar_error_default_status_for_known_code():
    err = VoyagestarError(ErrorCode.FORBIDDEN, "nope")
    assert err.status == 403


def test_voyagestar_error_to_envelope():
    err = VoyagestarError(ErrorCode.AUTH_FAILED, "bad creds")
    assert err.to_envelope() == {
        "error": {"code": "AUTH_FAILED", "message": "bad creds", "details": {}}
    }


def test_voyagestar_error_to_envelope_localized():
    err = VoyagestarError(ErrorCode.TOKEN_EXPIRED, "token expired")
    assert err.to_envelope(locale="zh")["error"]["message"] == "登录已过期，请重新登录。"


def test_unknown_error_code_rejected():
    with pytest.raises(ValueError):
        ErrorCode("NOT_A_CODE")
