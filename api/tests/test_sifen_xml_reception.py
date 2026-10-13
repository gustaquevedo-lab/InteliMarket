"""Tests for SIFEN e-Kuatia XML ingestion and reception matching for Distributor suppliers"""

from decimal import Decimal
import pytest
from api.src.purchases.sifen_xml_parser import parse_sifen_xml


SAMPLE_SIFEN_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rDE xmlns="http://ekuatia.set.gov.py/sifen/xsd">
  <dVerFor>150</dVerFor>
  <DE Id="01800030582001001000012312026092812345678901">
    <dDVId>1</dDVId>
    <dFecFirma>2026-09-28T08:00:00</dFecFirma>
    <gTimb>
      <iTiDE>1</iTiDE>
      <dDesTiDE>Factura electrónica</dDesTiDE>
      <dNumTim>12345678</dNumTim>
      <dEst>001</dEst>
      <dPunExp>001</dPunExp>
      <dNumDoc>0000123</dNumDoc>
      <dFeIniT>2026-01-01</dFeIniT>
    </gTimb>
    <gDGen>
      <dFeEmiDE>2026-09-28T08:00:00</dFeEmiDE>
    </gDGen>
    <gEmis>
      <dRucEm>80003058</dRucEm>
      <dDVEmi>2</dDVEmi>
      <iTipCont>2</iTipCont>
      <dNomEmi>PARAGUAY REFRESCOS S.A.</dNomEmi>
      <dNomFanEmi>PARESA</dNomFanEmi>
      <dDirEmi>Ruta 1 Km 14.5</dDirEmi>
      <dTelEmi>021-999999</dTelEmi>
      <dEmailE>facturacion@paresa.com.py</dEmailE>
    </gEmis>
    <gDatRec>
      <iNatRec>1</iNatRec>
      <iTiOpe>1</iTiOpe>
      <dRucRec>80012345</dRucRec>
      <dDVRec>6</dDVRec>
      <dNomRec>CASA GONZALITO DISTRIBUIDORA S.A.</dNomRec>
    </gDatRec>
    <gCamCond>
      <iCondOpe>2</iCondOpe>
      <dDesCondOpe>Crédito</dDesCondOpe>
      <cMoneOpe>PYG</cMoneOpe>
      <gCuotas>
        <dVenCuo>2026-10-28</dVenCuo>
        <dMonCuo>1500000</dMonCuo>
      </gCuotas>
    </gCamCond>
    <gDtipDE>
      <gCamItem>
        <dCodInt>KO-500</dCodInt>
        <dParAranc>7840058000100</dParAranc>
        <dDesProSer>COCA COLA 500ML PET X 12</dDesProSer>
        <dCantProSer>50</dCantProSer>
        <gValorItem>
          <dPUniProSer>30000</dPUniProSer>
          <gValorRestaItem>
            <dDescItem>0</dDescItem>
            <dTotOpeItem>1500000</dTotOpeItem>
          </gValorRestaItem>
        </gValorItem>
        <gCamIVA>
          <iAfecIVA>1</iAfecIVA>
          <dPropIVA>100</dPropIVA>
          <dTasaIVA>10</dTasaIVA>
        </gCamIVA>
      </gCamItem>
      <gCamItem>
        <dCodInt>KO-500-BONIF</dCodInt>
        <dParAranc>7840058000100</dParAranc>
        <dDesProSer>COCA COLA 500ML PET X 12 (BONIFICACION)</dDesProSer>
        <dCantProSer>5</dCantProSer>
        <gValorItem>
          <dPUniProSer>0</dPUniProSer>
          <gValorRestaItem>
            <dDescItem>0</dDescItem>
            <dTotOpeItem>0</dTotOpeItem>
          </gValorRestaItem>
        </gValorItem>
        <gCamIVA>
          <iAfecIVA>4</iAfecIVA>
          <dPropIVA>100</dPropIVA>
          <dTasaIVA>0</dTasaIVA>
        </gCamIVA>
      </gCamItem>
    </gDtipDE>
    <gTotSub>
      <dSub10>1363636</dSub10>
      <dIVA10>136364</dIVA10>
      <dTotOpe>1500000</dTotOpe>
      <dTotDesc>0</dTotDesc>
    </gTotSub>
  </DE>
</rDE>
"""


def test_parse_sifen_xml_extracts_headers_and_items():
    parsed = parse_sifen_xml(SAMPLE_SIFEN_XML)
    assert parsed["cdc"] == "01800030582001001000012312026092812345678901"
    assert len(parsed["cdc"]) == 44
    assert parsed["timbrado"] == "12345678"
    assert parsed["numero_factura"] == "001-001-0000123"
    assert parsed["emisor"]["ruc"] == "80003058-2"
    assert parsed["emisor"]["razon_social"] == "PARAGUAY REFRESCOS S.A."
    assert parsed["condicion"] == "credito"
    assert parsed["total"] == Decimal("1500000")
    
    items = parsed["items"]
    assert len(items) == 2
    
    # Item 1: Compra regular
    item1 = items[0]
    assert item1["codigo_proveedor"] == "KO-500"
    assert item1["cantidad"] == Decimal("50")
    assert item1["precio_unitario"] == Decimal("30000")
    assert item1["total"] == Decimal("1500000")
    assert item1["es_bonificacion"] is False
    
    # Item 2: Bonificación a costo 0
    item2 = items[1]
    assert item2["codigo_proveedor"] == "KO-500-BONIF"
    assert item2["cantidad"] == Decimal("5")
    assert item2["precio_unitario"] == Decimal("0")
    assert item2["total"] == Decimal("0")
    assert item2["es_bonificacion"] is True
