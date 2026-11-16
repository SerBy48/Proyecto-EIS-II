"""
Graficas y tablas del Modulo 1 (rendimiento) a partir de la evidencia de k6.

Lee docs/evidencia/no-funcionales/rendimiento/:
  <nombre>.json             resumen (--summary-export)
  <nombre>-serie.json.gz    serie temporal (--out json)
  <nombre>-docker-stats.csv muestreo de recursos (estres y pico)

Escribe en docs/evidencia/no-funcionales/graficas/ los PNG, y en
rendimiento/ el archivo resumen-metricas.json con las cifras que usa el
informe (por corrida y por escalon de VU).

Paleta validada con el validador de la guia de visualizacion:
  una serie       verde oscuro #14702a
  dos series      #7cc57c / #14702a  (pasa CVD y vision normal; el claro va con etiqueta)
  tres series     #1baf7a / #2a78d6 / #eb6834 (los tres primeros slots de la paleta
                  de referencia: validan todos los pares)
Sin doble eje: cada medida va en su propio panel con el eje de tiempo compartido.

Uso: python scripts/graficas/rendimiento.py [--solo <prefijo>]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
EVIDENCIA = RAIZ / "docs" / "evidencia" / "no-funcionales" / "rendimiento"
GRAFICAS = RAIZ / "docs" / "evidencia" / "no-funcionales" / "graficas"

VERDE = "#14702a"
VERDE_CLARO = "#7cc57c"
TRES = ["#1baf7a", "#2a78d6", "#eb6834"]
TINTA = "#0b0b0b"
TINTA_2 = "#52514e"
REJILLA = "#e4e3df"
SUPERFICIE = "#ffffff"

BALDE_S = 5  # resolucion de las series temporales

ENDPOINT_PRINCIPAL = {
    "catalogo-busqueda": "catalogo_busqueda",
    "login": "login",
    "checkout": "checkout",
    "flujo-completo": "checkout",
    "asistente": "asistente",
}
NOMBRE_ESCENARIO = {
    "catalogo-busqueda": "Catálogo (búsqueda)",
    "login": "Login",
    "checkout": "Checkout",
    "flujo-completo": "Flujo completo",
    "asistente": "Asistente virtual",
}
NOMBRE_ENDPOINT = {
    "catalogo_busqueda": "GET /catalogo/productos?q=",
    "login": "POST /auth/login",
    "checkout": "POST /pedidos/checkout",
    "carrito_agregar": "POST /carrito/:id/items",
    "mis_pedidos": "GET /pedidos",
    "catalogo_detalle": "GET /catalogo/productos/:sku",
    "asistente": "POST /asistente/mensajes",
}

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.sans-serif": ["Arial", "DejaVu Sans", "Liberation Sans"],
        "font.size": 9,
        "axes.edgecolor": REJILLA,
        "axes.labelcolor": TINTA_2,
        "axes.titlecolor": TINTA,
        "axes.titlesize": 10,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",
        "axes.grid": True,
        "axes.axisbelow": True,
        "grid.color": REJILLA,
        "grid.linewidth": 0.6,
        "xtick.color": TINTA_2,
        "ytick.color": TINTA_2,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "figure.facecolor": SUPERFICIE,
        "axes.facecolor": SUPERFICIE,
        "savefig.dpi": 200,
        "savefig.bbox": "tight",
        "legend.frameon": False,
    }
)


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------
def percentil(valores: list[float], p: float) -> float:
    if not valores:
        return float("nan")
    o = sorted(valores)
    k = max(0, min(len(o) - 1, math.ceil(p / 100 * len(o)) - 1))
    return o[k]


def leer_serie(ruta: Path, endpoint: str | None):
    """Agrega la serie de k6 en baldes de BALDE_S segundos."""
    baldes = defaultdict(lambda: {"dur": [], "dur_ep": [], "reqs": 0, "fallos": 0, "fallos_n": 0, "vus": 0, "codigos": defaultdict(int)})
    inicio = None
    with gzip.open(ruta, "rt", encoding="utf-8") as f:
        for linea in f:
            if '"type":"Point"' not in linea:
                continue
            p = json.loads(linea)
            datos = p["data"]
            t = datetime.fromisoformat(datos["time"].replace("Z", "+00:00")).timestamp()
            if inicio is None:
                inicio = t
            b = baldes[int((t - inicio) // BALDE_S)]
            etiquetas = datos.get("tags") or {}
            if etiquetas.get("fase") == "preparacion":
                continue  # el login inicial de cada VU no es parte de la medicion
            m = p["metric"]
            if m == "http_req_duration":
                b["dur"].append(datos["value"])
                if endpoint is None or etiquetas.get("endpoint") == endpoint:
                    b["dur_ep"].append(datos["value"])
            elif m == "http_reqs":
                b["reqs"] += 1
                b["codigos"][etiquetas.get("status", "?")] += 1
            elif m == "http_req_failed":
                b["fallos_n"] += 1
                b["fallos"] += datos["value"]
            elif m == "vus":
                b["vus"] = max(b["vus"], datos["value"])
    if not baldes:
        return []
    filas = []
    for i in range(max(baldes) + 1):
        b = baldes.get(i)
        if b is None:
            continue
        filas.append(
            {
                "t": i * BALDE_S,
                "vus": b["vus"],
                "rps": b["reqs"] / BALDE_S,
                "p95": percentil(b["dur_ep"], 95),
                "p95_todo": percentil(b["dur"], 95),
                "errores_pct": 100 * b["fallos"] / b["fallos_n"] if b["fallos_n"] else 0.0,
                "n_ep": len(b["dur_ep"]),
                "dur_ep": b["dur_ep"],
                "reqs": b["reqs"],
                "fallos": b["fallos"],
                "codigos": dict(b["codigos"]),
            }
        )
    return filas


# Mesetas de cada perfil (tests/rendimiento/lib/perfiles.js). Solo se agrupan
# los baldes cercanos a una meseta real: un balde de 10 VU durante la rampa
# inicial del estres no es un escalon.
MESETAS = {"humo": (2,), "carga": (50,), "estres": (50, 100, 200, 300), "pico": (10, 300)}


def por_escalon(filas, perfil: str):
    """Agrupa los baldes de meseta por nivel de VU (estres/pico)."""
    mesetas = MESETAS.get(perfil, (10, 50, 100, 200, 300))
    niveles = defaultdict(lambda: {"dur": [], "reqs": 0, "fallos": 0, "seg": 0, "codigos": defaultdict(int)})
    for f in filas:
        v = f["vus"]
        if v <= 0:
            continue
        objetivo = min(mesetas, key=lambda x: abs(x - v))
        if abs(objetivo - v) > max(3, 0.05 * objetivo):
            continue  # balde de rampa, no de meseta
        n = niveles[objetivo]
        n["dur"].extend(f["dur_ep"])
        n["reqs"] += f["reqs"]
        n["fallos"] += f["fallos"]
        n["seg"] += BALDE_S
        for c, k in f["codigos"].items():
            n["codigos"][c] += k
    salida = []
    for vus in sorted(niveles):
        n = niveles[vus]
        salida.append(
            {
                "vus": vus,
                "segundos_en_meseta": n["seg"],
                "p50_ms": round(percentil(n["dur"], 50), 1),
                "p95_ms": round(percentil(n["dur"], 95), 1),
                "p99_ms": round(percentil(n["dur"], 99), 1),
                "rps": round(n["reqs"] / n["seg"], 1) if n["seg"] else 0,
                "errores_pct": round(100 * n["fallos"] / n["reqs"], 2) if n["reqs"] else 0,
                "codigos": dict(n["codigos"]),
            }
        )
    return salida


def leer_resumen(ruta: Path):
    r = json.loads(ruta.read_text(encoding="utf-8"))
    m = r["metrics"]

    def tendencia(clave):
        d = m.get(clave)
        if not d:
            return None
        return {k: round(d[k], 1) for k in ("avg", "med", "p(90)", "p(95)", "p(99)", "max", "min") if k in d}

    endpoints = {}
    for clave in m:
        g = re.match(r"http_req_duration\{endpoint:(\w+)\}", clave)
        if g:
            endpoints[g.group(1)] = tendencia(clave)
    reqs = m.get("http_reqs", {})
    fallidas = m.get("http_req_failed", {})
    checks = m.get("checks", {})
    return {
        "duracion_total": tendencia("http_req_duration"),
        "por_endpoint": endpoints,
        "peticiones": reqs.get("count"),
        "rps": round(reqs.get("rate", 0), 2),
        "errores_pct": round(100 * fallidas.get("value", 0), 3),
        "checks_pct": round(100 * checks.get("value", 0), 2),
        "iteraciones": m.get("iterations", {}).get("count"),
        "vus_max": m.get("vus_max", {}).get("value") or m.get("vus_max", {}).get("max"),
        "umbrales": {
            clave: {u: (not estado) for u, estado in (d.get("thresholds") or {}).items()}
            for clave, d in m.items()
            if d.get("thresholds")
        },
    }


def leer_stats(ruta: Path):
    """CPU (%) y memoria por contenedor. 100 % = un nucleo."""
    if not ruta.exists():
        return None
    series = defaultdict(list)
    t0 = None
    with ruta.open(encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            try:
                t = int(fila["marca_tiempo"])
                cpu = float(fila["cpu_pct"])
            except (ValueError, KeyError, TypeError):
                continue
            t0 = t if t0 is None else t0
            nombre = fila["contenedor"].replace("ecom_", "")
            series[nombre].append((t - t0, cpu))
    return series


# ---------------------------------------------------------------------------
# Graficas
# ---------------------------------------------------------------------------
def rotulo_tiempo(ax):
    ax.set_xlabel("tiempo desde el inicio (s)")


def grafica_serie(nombre: str, escenario: str, filas, destino: Path):
    ep = ENDPOINT_PRINCIPAL[escenario]
    t = [f["t"] for f in filas]
    paneles = [
        (f"Latencia p95 de {NOMBRE_ENDPOINT[ep]} (ms)", [f["p95"] for f in filas]),
        ("Throughput total (peticiones/s)", [f["rps"] for f in filas]),
        ("Tasa de errores del sistema (%)", [f["errores_pct"] for f in filas]),
        ("Usuarios virtuales activos (VU)", [f["vus"] for f in filas]),
    ]
    fig, ejes = plt.subplots(len(paneles), 1, figsize=(7.2, 7.4), sharex=True)
    for ax, (titulo, valores) in zip(ejes, paneles):
        ax.plot(t, valores, color=VERDE, linewidth=1.6, solid_capstyle="round")
        ax.set_title(titulo, fontsize=9)
        ax.set_ylim(bottom=0)
        validos = [v for v in valores if not math.isnan(v)]
        if validos:
            i = max(range(len(valores)), key=lambda k: -1 if math.isnan(valores[k]) else valores[k])
            ax.annotate(
                f"máx. {valores[i]:,.0f}".replace(",", "."),
                (t[i], valores[i]), textcoords="offset points", xytext=(4, 4), fontsize=8, color=TINTA,
            )
    rotulo_tiempo(ejes[-1])
    fig.suptitle(f"{NOMBRE_ESCENARIO[escenario]} — perfil {nombre.split('-')[-1] if nombre.count('-') else nombre}",
                 x=0.01, ha="left", fontsize=11, fontweight="bold", color=TINTA)
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)


def grafica_escalones(nombre: str, escenario: str, escalones, destino: Path):
    if len(escalones) < 2:
        return
    vus = [str(e["vus"]) for e in escalones]
    fig, ejes = plt.subplots(1, 2, figsize=(7.2, 2.8))
    ejes[0].bar(vus, [e["p95_ms"] for e in escalones], color=VERDE, width=0.6)
    ejes[0].set_title("Latencia p95 por escalón (ms)", fontsize=9)
    ejes[1].bar(vus, [e["errores_pct"] for e in escalones], color=VERDE, width=0.6)
    ejes[1].set_title("Errores del sistema por escalón (%)", fontsize=9)
    for ax, clave, fmt in ((ejes[0], "p95_ms", "{:,.0f}"), (ejes[1], "errores_pct", "{:.1f}")):
        ax.set_xlabel("VU sostenidos")
        for i, e in enumerate(escalones):
            ax.annotate(fmt.format(e[clave]).replace(",", "."), (i, e[clave]), ha="center",
                        textcoords="offset points", xytext=(0, 3), fontsize=8, color=TINTA)
        ax.set_ylim(bottom=0, top=max(1, max(e[clave] for e in escalones)) * 1.18)
    fig.suptitle(f"{NOMBRE_ESCENARIO[escenario]} — {NOMBRE_ENDPOINT[ENDPOINT_PRINCIPAL[escenario]]} por nivel de carga",
                 x=0.01, ha="left", fontsize=10, fontweight="bold", color=TINTA)
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)


def grafica_cpu(nombre: str, escenario: str, series, destino: Path):
    if not series:
        return
    filas = []
    for contenedor, puntos in series.items():
        cpus = [c for _, c in puntos]
        filas.append((contenedor, sum(cpus) / len(cpus), max(cpus)))
    filas.sort(key=lambda x: x[1])
    nombres = [f[0] for f in filas]
    y = range(len(filas))
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    alto = 0.38
    ax.barh([i + alto / 2 + 0.02 for i in y], [f[2] for f in filas], height=alto, color=VERDE_CLARO, label="máximo")
    ax.barh([i - alto / 2 - 0.02 for i in y], [f[1] for f in filas], height=alto, color=VERDE, label="promedio")
    ax.set_yticks(list(y), nombres)
    for i, f in enumerate(filas):
        ax.annotate(f"{f[1]:.0f} %", (f[1], i - alto / 2 - 0.02), va="center", textcoords="offset points", xytext=(3, 0), fontsize=7, color=TINTA)
        ax.annotate(f"{f[2]:.0f} %", (f[2], i + alto / 2 + 0.02), va="center", textcoords="offset points", xytext=(3, 0), fontsize=7, color=TINTA_2)
    ax.set_xlabel("CPU del contenedor (%; 100 % = un núcleo)")
    ax.grid(axis="y", visible=False)
    ax.legend(loc="lower right", ncols=2)
    ax.set_title(f"CPU por contenedor — {NOMBRE_ESCENARIO[escenario]}, {nombre.split('-')[-1]}", fontsize=10)
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)


def grafica_cpu_tiempo(nombre: str, escenario: str, series, filas_k6, destino: Path, top: int = 4):
    """Small multiples: CPU en el tiempo de los contenedores mas cargados."""
    if not series:
        return
    orden = sorted(series, key=lambda c: -sum(x for _, x in series[c]) / len(series[c]))[:top]
    fig, ejes = plt.subplots(len(orden) + 1, 1, figsize=(7.2, 1.55 * (len(orden) + 1)), sharex=True)
    for ax, c in zip(ejes, orden):
        ax.plot([t for t, _ in series[c]], [x for _, x in series[c]], color=VERDE, linewidth=1.4)
        ax.set_title(f"CPU de {c} (%)", fontsize=9)
        ax.set_ylim(bottom=0)
    ejes[-1].plot([f["t"] for f in filas_k6], [f["vus"] for f in filas_k6], color=VERDE, linewidth=1.4)
    ejes[-1].set_title("Usuarios virtuales (VU)", fontsize=9)
    ejes[-1].set_ylim(bottom=0)
    rotulo_tiempo(ejes[-1])
    fig.suptitle(f"Contenedores más cargados — {NOMBRE_ESCENARIO[escenario]}, {nombre.split('-')[-1]}",
                 x=0.01, ha="left", fontsize=11, fontweight="bold", color=TINTA)
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)


def grafica_comparativa(resumenes: dict, destino: Path, etiqueta: str = ""):
    """Barras agrupadas: p95 del endpoint principal por escenario y perfil."""
    perfiles = ["carga", "estres", "pico"]
    escenarios = [e for e in ENDPOINT_PRINCIPAL if any(f"{e}-{p}{etiqueta}" in resumenes for p in perfiles)]
    if not escenarios:
        return
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ancho = 0.26
    for j, perfil in enumerate(perfiles):
        xs, ys = [], []
        for i, e in enumerate(escenarios):
            r = resumenes.get(f"{e}-{perfil}{etiqueta}")
            ep = ENDPOINT_PRINCIPAL[e]
            if not r or ep not in r["por_endpoint"] or not r["por_endpoint"][ep]:
                continue
            xs.append(i + (j - 1) * (ancho + 0.02))
            ys.append(r["por_endpoint"][ep]["p(95)"])
        barras = ax.bar(xs, ys, width=ancho, color=TRES[j], label=perfil)
        for x, yv in zip(xs, ys):
            ax.annotate(f"{yv:,.0f}".replace(",", "."), (x, yv), ha="center", textcoords="offset points", xytext=(0, 3), fontsize=7, color=TINTA)
    ax.set_xticks(range(len(escenarios)), [f"{NOMBRE_ESCENARIO[e]}\n{NOMBRE_ENDPOINT[ENDPOINT_PRINCIPAL[e]]}" for e in escenarios], fontsize=8)
    ax.set_ylabel("latencia p95 (ms)")
    ax.grid(axis="x", visible=False)
    # Leyenda fuera del area de datos: dentro tapaba las barras del login.
    ax.legend(title="perfil", ncols=3, loc="lower right", bbox_to_anchor=(1, 1.0), title_fontsize=8, fontsize=8)
    ax.set_title("Latencia p95 del endpoint principal por escenario y perfil", fontsize=10, loc="left", pad=22)
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)


# ---------------------------------------------------------------------------
def grafica_antes_despues(salida: dict, destino: Path):
    """
    Antes y despues de las correcciones de la Fase 3, un panel por metrica
    (cada una con su escala: nada de doble eje). El panel del checkout compara
    la prueba A/B con y sin keep-alive, ejecutada en las mismas condiciones.
    """

    def escalon(nombre, vus):
        return next((e for e in salida.get(nombre, {}).get("por_escalon", []) if e["vus"] == vus), None)

    def exitosos(nombre):
        r = salida.get(nombre, {}).get("resumen")
        return round(r["peticiones"] * (1 - r["errores_pct"] / 100)) if r else None

    def p95(nombre, ep):
        r = salida.get(nombre, {}).get("resumen")
        return r["por_endpoint"][ep]["p(95)"] if r and r["por_endpoint"].get(ep) else None

    paneles = [
        ("Login, 50 VU: logins por segundo", "antes", "después",
         (escalon("login-carga", 50) or {}).get("rps"), (escalon("login-carga-despues", 50) or {}).get("rps")),
        ("Login, 50 VU: p95 (ms)", "antes", "después",
         (escalon("login-carga", 50) or {}).get("p95_ms"), (escalon("login-carga-despues", 50) or {}).get("p95_ms")),
        ("Login en estrés: logins exitosos", "antes", "después",
         exitosos("login-estres"), exitosos("login-estres-despues")),
        ("Catálogo, 300 VU: errores (%)", "antes", "después",
         (escalon("catalogo-busqueda-estres", 300) or {}).get("errores_pct"),
         (escalon("catalogo-busqueda-estres-despues", 300) or {}).get("errores_pct")),
        ("Checkout, 50 VU: p95 (ms), prueba A/B", "sin keep-alive", "con keep-alive",
         p95("checkout-carga-ab-sin-keepalive", "checkout"), p95("checkout-carga-despues-r4-saga-vacia", "checkout")),
    ]
    paneles = [p for p in paneles if p[3] is not None and p[4] is not None]
    if not paneles:
        return
    columnas = 3
    filas = math.ceil(len(paneles) / columnas)
    fig, ejes = plt.subplots(filas, columnas, figsize=(7.6, 2.5 * filas))
    ejes = list(ejes.flat) if hasattr(ejes, "flat") else [ejes]
    for ax, (titulo, rotulo_a, rotulo_b, a, b) in zip(ejes, paneles):
        barras = ax.bar([rotulo_a, rotulo_b], [a, b], color=[VERDE_CLARO, VERDE], width=0.55)
        for barra, valor in zip(barras, (a, b)):
            texto = f"{valor:,.1f}" if valor < 100 else f"{valor:,.0f}"
            ax.annotate(texto.replace(",", "X").replace(".", ",").replace("X", "."),
                        (barra.get_x() + barra.get_width() / 2, valor),
                        ha="center", textcoords="offset points", xytext=(0, 3), fontsize=8, color=TINTA)
        ax.set_ylim(0, max(a, b, 1) * 1.2)
        ax.set_title(titulo, fontsize=8.5)
        ax.grid(axis="x", visible=False)
    for ax in ejes[len(paneles):]:
        ax.axis("off")
    fig.suptitle("Fase 3: antes y después de las correcciones R1 a R4", x=0.01, ha="left", fontsize=10, fontweight="bold")
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Carga con fallo inyectado (Trabajo Final, Fase 4)
# ---------------------------------------------------------------------------
GRIS_CAIDA = "#f2d7cc"


def leer_eventos(ruta: Path):
    """Marcas de tiempo (epoch) del docker stop y del docker start."""
    parada = arranque = None
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        partes = linea.split(" ", 2)
        if len(partes) < 3:
            continue
        if partes[2].startswith("docker stop"):
            parada = int(partes[0])
        elif partes[2].startswith("docker start"):
            arranque = int(partes[0])
    return parada, arranque


def serie_con_checks(ruta: Path, endpoint: str, nombre_check: str | None):
    """Por balde: inicio absoluto, p95 del endpoint, % de errores y % del check."""
    baldes = defaultdict(lambda: {"dur": [], "fallos": 0, "n": 0, "ok": 0, "chk": 0})
    inicio = None
    with gzip.open(ruta, "rt", encoding="utf-8") as f:
        for linea in f:
            if '"type":"Point"' not in linea:
                continue
            p = json.loads(linea)
            d = p["data"]
            t = datetime.fromisoformat(d["time"].replace("Z", "+00:00")).timestamp()
            inicio = inicio if inicio is not None else t
            etiquetas = d.get("tags") or {}
            if etiquetas.get("fase") == "preparacion":
                continue
            b = baldes[int((t - inicio) // BALDE_S)]
            m = p["metric"]
            if m == "http_req_duration" and etiquetas.get("endpoint") == endpoint:
                b["dur"].append(d["value"])
            elif m == "http_req_failed":
                b["n"] += 1
                b["fallos"] += d["value"]
            elif m == "checks" and nombre_check and etiquetas.get("check") == nombre_check:
                b["chk"] += 1
                b["ok"] += d["value"]
    filas = []
    for i in sorted(baldes):
        b = baldes[i]
        filas.append({
            "t": i * BALDE_S,
            "p95": percentil(b["dur"], 95),
            "errores_pct": 100 * b["fallos"] / b["n"] if b["n"] else 0.0,
            "check_pct": 100 * b["ok"] / b["chk"] if b["chk"] else float("nan"),
        })
    return inicio, filas


def grafica_fallo(servicio: str, destino: Path, sufijo: str = ""):
    escenario = "catalogo-busqueda" if servicio == "inventario" else "checkout"
    serie = EVIDENCIA / f"{escenario}-carga-fallo-{servicio}{sufijo}-serie.json.gz"
    eventos = EVIDENCIA / f"fallo-{servicio}{sufijo}-eventos.txt"
    muestras = EVIDENCIA / f"fallo-{servicio}{sufijo}-muestras.csv"
    if not (serie.exists() and eventos.exists() and muestras.exists()):
        return None
    inicio, filas = serie_con_checks(serie, ENDPOINT_PRINCIPAL[escenario],
                                     "disponibilidad presente" if servicio == "inventario" else None)
    parada, arranque = leer_eventos(eventos)
    with muestras.open(encoding="utf-8") as f:
        lector = list(csv.DictReader(f))
    t = [f["t"] for f in filas]
    if servicio == "inventario":
        codigo = {"cerrado": 0, "semiabierto": 1, "abierto": 2}
        tm = [int(x["marca_tiempo"]) - inicio for x in lector if x["circuito"] in codigo]
        vm = [codigo[x["circuito"]] for x in lector if x["circuito"] in codigo]
        paneles = [
            ("Latencia p95 de GET /catalogo/productos?q= (ms)", t, [f["p95"] for f in filas], "linea"),
            ("Respuestas con disponibilidad de stock (%)", t, [f["check_pct"] for f in filas], "linea"),
            ("Errores del sistema (%)", t, [f["errores_pct"] for f in filas], "linea"),
            ("Circuit breaker catálogo → inventario", tm, vm, "escalon"),
        ]
        titulo = "Inventario detenido durante la carga del catálogo (50 VU)" + (
            " — antes de corregir R7" if sufijo == "-antes" else " — con R7 corregido" if sufijo == "" and (EVIDENCIA / "fallo-inventario-antes-eventos.txt").exists() else "")
    else:
        tm = [int(x["marca_tiempo"]) - inicio for x in lector if x["mensajes_en_cola"].strip() not in ("", "null")]
        vm = [int(x["mensajes_en_cola"]) for x in lector if x["mensajes_en_cola"].strip() not in ("", "null")]
        paneles = [
            ("Latencia p95 de POST /pedidos/checkout (ms)", t, [f["p95"] for f in filas], "linea"),
            ("Errores del sistema (%)", t, [f["errores_pct"] for f in filas], "linea"),
            ("Mensajes en la cola notificaciones.envio", tm, vm, "linea"),
        ]
        titulo = "Notificaciones detenido durante la carga del checkout (50 VU)"
    fig, ejes = plt.subplots(len(paneles), 1, figsize=(7.2, 1.85 * len(paneles) + 0.6), sharex=True)
    for ax, (titulo_panel, x, y, tipo) in zip(ejes, paneles):
        if parada and arranque:
            ax.axvspan(parada - inicio, arranque - inicio, color=GRIS_CAIDA, linewidth=0, zorder=0)
        if tipo == "escalon":
            ax.step(x, y, where="post", color=VERDE, linewidth=1.6)
            ax.set_yticks([0, 1, 2], ["cerrado", "semiabierto", "abierto"])
        else:
            ax.plot(x, y, color=VERDE, linewidth=1.6, solid_capstyle="round")
            ax.set_ylim(bottom=0)
        ax.set_title(titulo_panel, fontsize=9)
    if parada and arranque:
        ejes[0].annotate(f"{servicio} detenido ({arranque - parada} s)", ((parada - inicio), 1), xycoords=("data", "axes fraction"),
                         xytext=(4, -12), textcoords="offset points", fontsize=8, color=TINTA)
    rotulo_tiempo(ejes[-1])
    fig.suptitle(titulo, x=0.01, ha="left", fontsize=11, fontweight="bold", color=TINTA)
    fig.tight_layout()
    fig.savefig(destino)
    plt.close(fig)
    return {"inicio_k6": inicio, "parada_s": parada - inicio if parada else None, "arranque_s": arranque - inicio if arranque else None}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--solo", default="", help="procesar solo las corridas que empiezan por este prefijo")
    args = parser.parse_args()

    GRAFICAS.mkdir(parents=True, exist_ok=True)
    salida = {}
    resumenes = {}
    for resumen in sorted(EVIDENCIA.glob("*.json")):
        nombre = resumen.stem
        if nombre.endswith("-salud") or nombre == "resumen-metricas" or not nombre.startswith(args.solo):
            continue
        escenario = next((e for e in ENDPOINT_PRINCIPAL if nombre.startswith(e + "-")), None)
        if not escenario:
            continue
        print(f"- {nombre}", file=sys.stderr)
        r = leer_resumen(resumen)
        resumenes[nombre] = r
        entrada = {"resumen": r}
        serie = EVIDENCIA / f"{nombre}-serie.json.gz"
        if serie.exists():
            filas = leer_serie(serie, ENDPOINT_PRINCIPAL[escenario])
            perfil = next((p for p in MESETAS if f"-{p}" in nombre), "")
            entrada["por_escalon"] = por_escalon(filas, perfil)
            if "-humo" not in nombre:
                grafica_serie(nombre, escenario, filas, GRAFICAS / f"serie-{nombre}.png")
                if "-estres" in nombre or "-pico" in nombre:
                    grafica_escalones(nombre, escenario, entrada["por_escalon"], GRAFICAS / f"escalones-{nombre}.png")
            stats = leer_stats(EVIDENCIA / f"{nombre}-docker-stats.csv")
            if stats:
                entrada["cpu_contenedores"] = {
                    c: {"promedio": round(sum(x for _, x in p) / len(p), 1), "maximo": round(max(x for _, x in p), 1)}
                    for c, p in stats.items()
                }
                grafica_cpu(nombre, escenario, stats, GRAFICAS / f"cpu-{nombre}.png")
                grafica_cpu_tiempo(nombre, escenario, stats, filas, GRAFICAS / f"cpu-tiempo-{nombre}.png")
        salida[nombre] = entrada

    for servicio, sufijo in (("inventario", "-antes"), ("inventario", ""), ("notificaciones", "")):
        marcas = grafica_fallo(servicio, GRAFICAS / f"fallo-{servicio}{sufijo}.png", sufijo)
        if marcas:
            salida[f"fallo-{servicio}{sufijo}"] = marcas

    if not args.solo:
        grafica_comparativa(resumenes, GRAFICAS / "p95-por-escenario.png")
        grafica_antes_despues(salida, GRAFICAS / "antes-despues-fase3.png")
        (EVIDENCIA / "resumen-metricas.json").write_text(json.dumps(salida, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Listo: {len(salida)} corridas procesadas.", file=sys.stderr)


if __name__ == "__main__":
    main()
