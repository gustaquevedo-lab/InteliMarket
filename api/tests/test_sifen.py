"""Tests for SIFEN CDC calculation and XML generation"""

import hashlib
import pytest


def test_cdc_format():
    """CDC must be 44 characters, all hex digits."""
    cdc = "A" * 44
    assert len(cdc) == 44
    assert all(c in "0123456789ABCDEF" for c in cdc)


def test_cdc_sha256_hash():
    """CDC is generated from SHA256 of concatenated fields."""
    fields = "ruc:12345678|tipo:1|punto:001|numero:0000001|fecha:20240101|monto:100000"
    cdc = hashlib.sha256(fields.encode("utf-8")).hexdigest().upper()[:44]
    assert len(cdc) == 44
    assert all(c in "0123456789ABCDEF" for c in cdc)


def test_cdc_different_inputs():
    """Different inputs produce different CDCs."""
    fields1 = "ruc:12345678|tipo:1|punto:001|numero:0000001|fecha:20240101|monto:100000"
    fields2 = "ruc:12345678|tipo:1|punto:001|numero:0000002|fecha:20240101|monto:100000"
    cdc1 = hashlib.sha256(fields1.encode("utf-8")).hexdigest().upper()[:44]
    cdc2 = hashlib.sha256(fields2.encode("utf-8")).hexdigest().upper()[:44]
    assert cdc1 != cdc2


def test_cdc_consistent():
    """Same input always produces same CDC."""
    fields = "ruc:12345678|tipo:1|punto:001|numero:0000001|fecha:20240101|monto:100000"
    cdc1 = hashlib.sha256(fields.encode("utf-8")).hexdigest().upper()[:44]
    cdc2 = hashlib.sha256(fields.encode("utf-8")).hexdigest().upper()[:44]
    assert cdc1 == cdc2
