"""
ETL: Base de Datos.xlsx -> public/data/*.json
Genera 7 archivos JSON pre-calculados para el dashboard estatico.
Ejecutar: python scripts/etl.py
"""
import json
import math
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).parent.parent
EXCEL = ROOT.parent / "Data" / "Base de Datos.xlsx"
OUT = ROOT / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────────────

def safe(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if hasattr(v, 'isoformat'): return v.isoformat()
    return v

def to_json(data, name):
    path = OUT / name
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=safe)
    print(f"  OK {name} ({path.stat().st_size // 1024} KB)")

def pct(val):
    if val is None or (isinstance(val, float) and math.isnan(val)): return None
    return round(float(val), 4)

# ── load data ─────────────────────────────────────────────────────────────────

print("Cargando Excel...")
gen = pd.read_excel(EXCEL, sheet_name="General")
cap = pd.read_excel(EXCEL, sheet_name="Por capability")

# Normalize column names
gen.columns = [c.strip() for c in gen.columns]
cap.columns = [c.strip() for c in cap.columns]

# Clean BU / WorkLocation trailing spaces
for df in [gen, cap]:
    for col in ["BU del participante", "Work Location"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

# Exclude known invalid / test entries
EXCLUDE_NAMES = {"Manuel A Mendoza", "Log Transformation Maz Log Transformation Maz"}
gen = gen[~gen["Nombre del participante"].isin(EXCLUDE_NAMES)].copy()
cap = cap[~cap["Nombre del participante"].isin(EXCLUDE_NAMES)].copy()
print(f"  Excluidos: {', '.join(EXCLUDE_NAMES)}")

# Only finalized assessments for scoring
fin = gen[gen["Assessments Status"] == "Finalizado"].copy()

# Detect cap sheet column names early (used in multiple sections)
cap_year_col = "Año" if "Año" in cap.columns else next(
    (c for c in cap.columns if c.lower().startswith("a") and "o" in c.lower()), "Año")
cap_period_col = next((c for c in cap.columns if "er" in c.lower() and "odo" in c.lower()), "Período")
cap_area_col = next((c for c in cap.columns if "rea" in c.lower() and "real" in c.lower() and "rol" not in c.lower()), "Área Realizada")
cap_rol_col = next((c for c in cap.columns if c.lower().startswith("rol")), "Rol realizado")

# Merge Work Location into cap from gen if not present
if "Work Location" not in cap.columns and "Work Location" in gen.columns:
    join_keys = [k for k in ["Nombre del participante", "Año", "Período", "Periodo"] if k in gen.columns and k in cap.columns]
    if join_keys:
        wl_map = gen[join_keys + ["Work Location"]].drop_duplicates(subset=join_keys)
        cap = cap.merge(wl_map, on=join_keys, how="left")
cap_wl_col = "Work Location" if "Work Location" in cap.columns else None

NIVEL_ORDER = ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"]
BU_LIST = sorted(gen["BU del participante"].dropna().unique().tolist())
AREA_LIST = sorted(gen["Área Realizada"].dropna().unique().tolist())
ROL_LIST = sorted(gen["Rol realizado"].dropna().unique().tolist())
CAP_LIST = sorted(cap["Capability"].dropna().unique().tolist())
PERIODOS = sorted(gen["Periodo"].dropna().unique().tolist())
AÑOS = sorted(gen["Año"].dropna().unique().tolist())
WL_LIST = sorted(gen["Work Location"].dropna().unique().tolist()) if "Work Location" in gen.columns else []

# Compute real period labels (avoid cartesian product phantoms)
PERIOD_LABELS = sorted(
    gen[["Año", "Periodo"]].dropna().drop_duplicates()
    .apply(lambda r: f"{int(r['Año'])}-P{int(r['Periodo'])}", axis=1)
    .tolist()
)

# ── 1. benchmarks.json ───────────────────────────────────────────────────────

print("Generando benchmarks.json...")
benchmarks = {
  "sources": [
    {"name": "APICS/ASCM Supply Chain Competency Model", "url": "https://www.ascm.org"},
    {"name": "Gartner 5-Stage Supply Chain Maturity Model"},
    {"name": "Dreyfus Model of Skill Acquisition"},
    {"name": "APQC Supply Chain Planning Benchmarks", "url": "https://www.apqc.org"},
    {"name": "McKinsey Supply Chain Risk Survey 2024"},
    {"name": "Deloitte Manufacturing Outlook 2025"},
    {"name": "ISM Supply Chain Capability Model", "url": "https://www.ismworld.org"}
  ],
  "nivel_distribution": {
    "mature_org": {"Novice": 0.075, "Advanced Beginner": 0.175, "Competent": 0.325, "Proficient": 0.225, "Expert": 0.075},
    "developing_org": {"Novice": 0.35, "Advanced Beginner": 0.275, "Competent": 0.175, "Proficient": 0.075, "Expert": 0.02},
    "label_mature": "Organización madura (Gartner/Dreyfus)",
    "label_developing": "Organización en desarrollo"
  },
  "profile_adherence": {
    "best_in_class_min": 0.80, "best_in_class_max": 0.85,
    "good_min": 0.75, "good_max": 0.80,
    "developing_min": 0.55, "developing_max": 0.65,
    "thresholds": {
      "strong_fit": 0.80,
      "good_fit": 0.70,
      "moderate_fit": 0.60,
      "poor_fit": 0.0
    },
    "threshold_labels": {
      "strong_fit": "Alto apego (>80%)",
      "good_fit": "Buen apego (70-80%)",
      "moderate_fit": "Apego moderado (60-70%)",
      "poor_fit": "Bajo apego (<60%)"
    }
  },
  "capability_categories": {
    "Soft Skills / Liderazgo": [
      "Empuje / Orientación a resultados", "Colaboración", "Resiliencia",
      "Negociación", "Planificación y organización"
    ],
    "Técnicas de Planning": [
      "Gestión de inventarios", "Estándares de logística inversa LCP y mantenimiento del inventario",
      "Transportación y logística", "Manufactura Esbelta", "Técnicas de programación",
      "Estándares VPO programación y nivel de servicio", "Gestión de riesgos",
      "Metodología S&OP", "Metodología MRP/MPS", "Pronóstico de la demanda",
      "DDMRP", "Control de la producción", "Planeación de capacidad"
    ],
    "Herramientas / Datos": [
      "Excel", "Orientación a datos", "SAP", "Power BI", "Sistemas de planeación"
    ],
    "Idiomas": ["Inglés"]
  }
}
to_json(benchmarks, "benchmarks.json")

# ── 2. summary.json ───────────────────────────────────────────────────────────

print("Generando summary.json...")

nivel_dist = fin["Nivel de dominio"].value_counts()
nivel_dist_pct = (nivel_dist / len(fin)).to_dict()

def nivel_pct(n):
    return round(nivel_dist_pct.get(n, 0), 4)

# Puntaje y apego por BU
bu_summary = []
for bu, grp in fin.groupby("BU del participante"):
    bu_summary.append({
        "bu": bu,
        "n": len(grp),
        "puntaje_promedio": pct(grp["Puntaje assessment"].mean()),
        "apego_promedio": pct(grp["% Apego al perfil"].mean()),
        "niveles": {n: int(grp["Nivel de dominio"].value_counts().get(n, 0)) for n in NIVEL_ORDER}
    })
bu_summary.sort(key=lambda x: -(x["apego_promedio"] or 0))

summary = {
    "total_participantes": int(gen["Nombre del participante"].nunique()),
    "total_assessments": len(gen),
    "assessments_finalizados": int((gen["Assessments Status"] == "Finalizado").sum()),
    "assessments_en_curso": int((gen["Assessments Status"] == "En curso").sum()),
    "puntaje_promedio_global": pct(fin["Puntaje assessment"].mean()),
    "apego_promedio_global": pct(fin["% Apego al perfil"].mean()),
    "reviso_reporte_pct": pct((gen["Revisó reporte"] == "Sí").sum() / len(gen)),
    "bus": BU_LIST,
    "work_locations": WL_LIST,
    "areas": AREA_LIST,
    "roles": ROL_LIST,
    "capabilities": CAP_LIST,
    "periodos": [int(p) for p in PERIODOS],
    "años": [int(a) for a in AÑOS],
    "period_labels": PERIOD_LABELS,
    "nivel_distribution": {n: nivel_pct(n) for n in NIVEL_ORDER},
    "nivel_counts": {n: int(nivel_dist.get(n, 0)) for n in NIVEL_ORDER},
    "bu_summary": bu_summary,
}
to_json(summary, "summary.json")

# ── 3. gaps.json ──────────────────────────────────────────────────────────────

print("Generando gaps.json...")

# Gap por capability: apego actual vs 100% (1.0 = meets profile exactly)
cap_gaps = []
for capability, grp in cap.groupby("Capability"):
    apego_mean = pct(grp["% Apego al perfil"].mean())
    gap = pct(1.0 - (apego_mean or 0))  # positive = below profile, negative = exceeds
    by_bu = {}
    for bu, bgrp in grp.groupby("BU del participante"):
        by_bu[bu] = {
            "apego": pct(bgrp["% Apego al perfil"].mean()),
            "n": len(bgrp)
        }
    by_year = {}
    if cap_year_col in cap.columns:
        for año, ygrp in grp.groupby(cap_year_col):
            by_year[int(año)] = {
                "apego": pct(ygrp["% Apego al perfil"].mean()),
                "n": len(ygrp)
            }
    by_bu_year = {}
    if cap_year_col in cap.columns:
        for bu, bgrp in grp.groupby("BU del participante"):
            by_bu_year[bu] = {}
            for año, bygrp in bgrp.groupby(cap_year_col):
                by_bu_year[bu][int(año)] = {
                    "apego": pct(bygrp["% Apego al perfil"].mean()),
                    "n": len(bygrp)
                }
    by_area = {}
    if cap_area_col in grp.columns:
        for area, agrp in grp.groupby(cap_area_col):
            by_area[area] = {
                "apego": pct(agrp["% Apego al perfil"].mean()),
                "n": len(agrp)
            }
    by_rol = {}
    if cap_rol_col in grp.columns:
        for rol, rgrp in grp.groupby(cap_rol_col):
            by_rol[rol] = {
                "apego": pct(rgrp["% Apego al perfil"].mean()),
                "n": len(rgrp)
            }
    by_year_area = {}
    if cap_year_col in grp.columns and cap_area_col in grp.columns:
        for año, ygrp in grp.groupby(cap_year_col):
            by_year_area[int(año)] = {}
            for area, agrp in ygrp.groupby(cap_area_col):
                by_year_area[int(año)][area] = {
                    "apego": pct(agrp["% Apego al perfil"].mean()),
                    "n": len(agrp)
                }
    by_bu_year_area = {}
    if cap_year_col in grp.columns and cap_area_col in grp.columns:
        for bu, bgrp in grp.groupby("BU del participante"):
            by_bu_year_area[bu] = {}
            for año, bygrp in bgrp.groupby(cap_year_col):
                by_bu_year_area[bu][int(año)] = {}
                for area, agrp in bygrp.groupby(cap_area_col):
                    by_bu_year_area[bu][int(año)][area] = {
                        "apego": pct(agrp["% Apego al perfil"].mean()),
                        "n": len(agrp)
                    }
    by_work_location = {}
    if cap_wl_col and cap_wl_col in grp.columns:
        for wl, wgrp in grp.groupby(cap_wl_col):
            by_work_location[wl] = {
                "apego": pct(wgrp["% Apego al perfil"].mean()),
                "n": len(wgrp)
            }
    cap_gaps.append({
        "capability": capability,
        "perfil_requerido": 1.0,   # always 100% — the reference
        "apego_actual": apego_mean,
        "gap": gap,
        "by_bu": by_bu,
        "by_year": by_year,
        "by_bu_year": by_bu_year,
        "by_area": by_area,
        "by_rol": by_rol,
        "by_year_area": by_year_area,
        "by_bu_year_area": by_bu_year_area,
        "by_work_location": by_work_location,
    })
cap_gaps.sort(key=lambda x: -(x["gap"] or 0))

# Gap por rol
rol_gaps = []
for rol, grp in fin.groupby("Rol realizado"):
    rol_gaps.append({
        "rol": rol,
        "n": len(grp),
        "puntaje_promedio": pct(grp["Puntaje assessment"].mean()),
        "apego_promedio": pct(grp["% Apego al perfil"].mean()),
        "nivel_predominante": grp["Nivel de dominio"].mode().iloc[0] if len(grp) > 0 else None,
    })
rol_gaps.sort(key=lambda x: x["apego_promedio"] or 0)

# Gap por BU: radar data (top 12 capabilities by gap for each BU)
bu_radar = {}
for bu in BU_LIST:
    bu_cap = cap[cap["BU del participante"] == bu]
    items = []
    for capability, grp in bu_cap.groupby("Capability"):
        apego = pct(grp["% Apego al perfil"].mean())
        items.append({
            "capability": capability,
            "apego": apego,
            "gap": pct(1.0 - (apego or 0)),
        })
    items.sort(key=lambda x: -(x["gap"] or 0))
    bu_radar[bu] = items[:12]

gaps = {
    "by_capability": cap_gaps,
    "by_rol": rol_gaps,
    "by_bu_radar": bu_radar
}
to_json(gaps, "gaps.json")

# ── 4. heatmap.json ───────────────────────────────────────────────────────────

print("Generando heatmap.json...")

def build_heatmap(df, row_col, row_list):
    rows = []
    for row_val in row_list:
        grp = df[df[row_col] == row_val]
        cells = {}
        for capability, cgrp in grp.groupby("Capability"):
            cells[capability] = {
                "apego": pct(cgrp["% Apego al perfil"].mean()),
                "n": len(cgrp)
            }
        rows.append({"label": row_val, "cells": cells})
    return rows

# Build per-period heatmaps
by_period = {}
for (año, periodo), grp in cap.groupby([cap_year_col, cap_period_col]):
    label = f"{int(año)}-P{int(periodo)}"
    by_period[label] = {
        "by_bu": build_heatmap(grp, "BU del participante", BU_LIST),
        "by_area": build_heatmap(grp, cap_area_col, AREA_LIST),
    }

by_bu_area_heatmap = {
    bu: build_heatmap(cap[cap["BU del participante"] == bu], cap_area_col, AREA_LIST)
    for bu in BU_LIST
}

by_area_bu_heatmap = {
    area: build_heatmap(cap[cap[cap_area_col] == area], "BU del participante", BU_LIST)
    for area in AREA_LIST
}

by_year_heatmap = {}
if cap_year_col in cap.columns:
    for año, ygrp in cap.groupby(cap_year_col):
        by_year_heatmap[int(año)] = {
            "by_bu": build_heatmap(ygrp, "BU del participante", BU_LIST),
            "by_area": build_heatmap(ygrp, cap_area_col, AREA_LIST),
            "by_bu_area": {
                bu: build_heatmap(ygrp[ygrp["BU del participante"] == bu], cap_area_col, AREA_LIST)
                for bu in BU_LIST
            },
            "by_area_bu": {
                area: build_heatmap(ygrp[ygrp[cap_area_col] == area], "BU del participante", BU_LIST)
                for area in AREA_LIST
            },
        }

by_wl_heatmap = {}
if cap_wl_col and cap_wl_col in cap.columns:
    for wl in WL_LIST:
        wgrp = cap[cap[cap_wl_col] == wl]
        if len(wgrp) == 0:
            continue
        by_wl_heatmap[wl] = {
            "by_bu": build_heatmap(wgrp, "BU del participante", BU_LIST),
            "by_area": build_heatmap(wgrp, cap_area_col, AREA_LIST),
        }

heatmap = {
    "capabilities": CAP_LIST,
    "by_bu": build_heatmap(cap, "BU del participante", BU_LIST),
    "by_area": build_heatmap(cap, cap_area_col, AREA_LIST),
    "by_period": by_period,
    "by_year": by_year_heatmap,
    "by_bu_area": by_bu_area_heatmap,
    "by_area_bu": by_area_bu_heatmap,
    "by_work_location": by_wl_heatmap,
    "benchmark_threshold": 0.70
}
to_json(heatmap, "heatmap.json")

# ── 5. evolution.json ─────────────────────────────────────────────────────────

print("Generando evolution.json...")

# Distribution per period
period_dist = []
for (año, periodo), grp in fin.groupby(["Año", "Periodo"]):
    dist = {n: int((grp["Nivel de dominio"] == n).sum()) for n in NIVEL_ORDER}
    total = sum(dist.values())
    period_dist.append({
        "año": int(año), "periodo": int(periodo),
        "label": f"{int(año)}-P{int(periodo)}",
        "n": len(grp),
        "puntaje_promedio": pct(grp["Puntaje assessment"].mean()),
        "apego_promedio": pct(grp["% Apego al perfil"].mean()),
        "nivel_counts": dist,
        "nivel_pct": {n: round(dist[n]/total, 4) if total > 0 else 0 for n in NIVEL_ORDER}
    })
period_dist.sort(key=lambda x: (x["año"], x["periodo"]))

# Annual aggregation
year_dist = []
for año, grp in fin.groupby("Año"):
    dist = {n: int((grp["Nivel de dominio"] == n).sum()) for n in NIVEL_ORDER}
    total = sum(dist.values())
    year_dist.append({
        "año": int(año),
        "label": str(int(año)),
        "n": len(grp),
        "puntaje_promedio": pct(grp["Puntaje assessment"].mean()),
        "apego_promedio": pct(grp["% Apego al perfil"].mean()),
        "nivel_counts": dist,
        "nivel_pct": {n: round(dist[n]/total, 4) if total > 0 else 0 for n in NIVEL_ORDER}
    })
year_dist.sort(key=lambda x: x["año"])

# Per-person delta between periods
p1 = fin[fin["Periodo"] == 1][["Nombre del participante","BU del participante","Rol realizado","Puntaje assessment","% Apego al perfil","Nivel de dominio"]].copy()
p2 = fin[fin["Periodo"] == 2][["Nombre del participante","BU del participante","Rol realizado","Puntaje assessment","% Apego al perfil","Nivel de dominio"]].copy()
p1.columns = ["nombre","bu","rol","puntaje_p1","apego_p1","nivel_p1"]
p2.columns = ["nombre","bu","rol","puntaje_p2","apego_p2","nivel_p2"]
merged = pd.merge(p1, p2, on=["nombre","bu","rol"], how="inner")

movers = []
for _, row in merged.iterrows():
    delta_puntaje = pct(row["puntaje_p1"] - row["puntaje_p2"])
    delta_apego = pct(row["apego_p1"] - row["apego_p2"])
    movers.append({
        "nombre": row["nombre"], "bu": row["bu"], "rol": row["rol"],
        "puntaje_p1": pct(row["puntaje_p1"]), "puntaje_p2": pct(row["puntaje_p2"]),
        "apego_p1": pct(row["apego_p1"]), "apego_p2": pct(row["apego_p2"]),
        "nivel_p1": row["nivel_p1"], "nivel_p2": row["nivel_p2"],
        "delta_puntaje": delta_puntaje,
        "delta_apego": delta_apego,
        "mejoro": (delta_puntaje or 0) > 0
    })
movers.sort(key=lambda x: -(x["delta_puntaje"] or 0))

# BU level evolution
bu_evolution = []
for bu in BU_LIST:
    bu_periods = []
    for pd_item in period_dist:
        bu_grp = fin[(fin["BU del participante"] == bu) & (fin["Periodo"] == pd_item["periodo"]) & (fin["Año"] == pd_item["año"])]
        if len(bu_grp) > 0:
            bu_periods.append({
                "label": pd_item["label"],
                "año": pd_item["año"], "periodo": pd_item["periodo"],
                "n": len(bu_grp),
                "puntaje_promedio": pct(bu_grp["Puntaje assessment"].mean()),
                "apego_promedio": pct(bu_grp["% Apego al perfil"].mean()),
            })
    if bu_periods:
        bu_evolution.append({"bu": bu, "periods": bu_periods})

# BU annual evolution
bu_evolution_annual = []
for bu in BU_LIST:
    bu_years = []
    for yr_item in year_dist:
        bu_grp = fin[(fin["BU del participante"] == bu) & (fin["Año"] == yr_item["año"])]
        if len(bu_grp) > 0:
            bu_years.append({
                "label": yr_item["label"],
                "año": yr_item["año"],
                "n": len(bu_grp),
                "puntaje_promedio": pct(bu_grp["Puntaje assessment"].mean()),
                "apego_promedio": pct(bu_grp["% Apego al perfil"].mean()),
            })
    if bu_years:
        bu_evolution_annual.append({"bu": bu, "years": bu_years})

# Per-person evolution across all periods
person_evolution = []
for nombre, grp in fin.groupby("Nombre del participante"):
    grp_sorted = grp.sort_values(["Año", "Periodo"])
    row0 = grp_sorted.iloc[0]
    periods = []
    for _, row in grp_sorted.iterrows():
        periods.append({
            "label": f"{int(row['Año'])}-P{int(row['Periodo'])}",
            "año": int(row["Año"]),
            "periodo": int(row["Periodo"]),
            "puntaje": pct(row["Puntaje assessment"]),
            "apego": pct(row["% Apego al perfil"]),
            "nivel": row["Nivel de dominio"],
        })
    person_evolution.append({
        "nombre": str(nombre),
        "bu": str(row0["BU del participante"]),
        "rol": str(row0["Rol realizado"]),
        "area": str(row0["Área Realizada"]) if "Área Realizada" in row0.index else "",
        "work_location": str(row0["Work Location"]).strip() if "Work Location" in row0.index else "",
        "periods": periods,
    })
person_evolution.sort(key=lambda x: x["nombre"])

# ── Scatter: tendencias vs antigüedad en el rol ───────────────────────────────
print("  Generando scatter de tendencias...")

ant_col = next((c for c in fin.columns if "rol" in c.lower() and "ig" in c.lower()), None)
fn_col  = next((c for c in fin.columns if "og" in c.lower() and "tica" in c.lower()), None)

def _ref_date(row):
    m = 4 if int(row["Periodo"]) == 1 else 10
    return pd.Timestamp(int(row["Año"]), m, 1)

fin2 = fin.copy()
fin2["_ref"] = fin2.apply(_ref_date, axis=1)
if ant_col:
    fin2["_meses"] = ((fin2["_ref"] - fin2[ant_col]) / pd.Timedelta(days=30.44)).clip(lower=0).round(1)
else:
    fin2["_meses"] = None

fin2 = fin2.sort_values(["Nombre del participante", "Año", "Periodo"])
fin2["_prev_apego"] = fin2.groupby("Nombre del participante")["% Apego al perfil"].shift(1)
fin2["_delta"]      = fin2["% Apego al perfil"] - fin2["_prev_apego"]

def _tend(delta):
    if delta is None or (isinstance(delta, float) and math.isnan(delta)): return "nuevo"
    if delta >  0.04: return "mejora"
    if delta < -0.04: return "empeora"
    return "igual"

fin2["_tend"] = fin2["_delta"].apply(_tend)

scatter_rows = []
for _, row in fin2.iterrows():
    meses = row["_meses"]
    scatter_rows.append({
        "nombre":   str(row["Nombre del participante"]),
        "bu":       str(row["BU del participante"]),
        "rol":      str(row["Rol realizado"]),
        "area":     str(row.get("Área Realizada", "")),
        "funcion":  str(row[fn_col]) if fn_col and fn_col in row.index else "",
        "año":      int(row["Año"]),
        "periodo":  int(row["Periodo"]),
        "label":    f"{int(row['Año'])}-P{int(row['Periodo'])}",
        "apego":    pct(row["% Apego al perfil"]),
        "apego_pct": round(float(row["% Apego al perfil"] or 0) * 100, 1),
        "puntaje":  pct(row["Puntaje assessment"]),
        "nivel":    row["Nivel de dominio"],
        "meses_rol": round(float(meses), 1) if meses is not None and not (isinstance(meses, float) and math.isnan(meses)) else None,
        "tendencia": row["_tend"],
        "delta_apego": pct(row["_delta"]) if not (isinstance(row["_delta"], float) and math.isnan(row["_delta"])) else None,
    })

# Zone thresholds (stored so frontend can render consistent backgrounds)
SCATTER_X_THRESH = 75   # % apego
SCATTER_Y_LOW    = 18   # months — below = new in position / high potential
SCATTER_Y_HIGH   = 36   # months — above = no learning / ready for challenge

evolution = {
    "by_period": period_dist,
    "by_year": year_dist,
    "movers": movers,
    "top_mejoras": movers[:10],
    "top_retrocesos": sorted(movers, key=lambda x: x["delta_puntaje"] or 0)[:10],
    "by_bu": bu_evolution,
    "by_bu_annual": bu_evolution_annual,
    "by_person": person_evolution,
    "scatter": scatter_rows,
    "scatter_thresholds": {
        "x_thresh": SCATTER_X_THRESH,
        "y_low":    SCATTER_Y_LOW,
        "y_high":   SCATTER_Y_HIGH,
    },
}
to_json(evolution, "evolution.json")

# ── 6. rankings.json ──────────────────────────────────────────────────────────

print("Generando rankings.json...")

rankings_rows = []
for _, row in fin.iterrows():
    rankings_rows.append({
        "nombre": row["Nombre del participante"],
        "bu": row["BU del participante"],
        "work_location": str(row["Work Location"]).strip() if "Work Location" in fin.columns else "",
        "rol": row["Rol realizado"],
        "area": row["Área Realizada"],
        "año": int(row["Año"]),
        "periodo": int(row["Periodo"]),
        "puntaje": pct(row["Puntaje assessment"]),
        "puntaje_maximo": pct(row["Puntaje máximo"]) if "Puntaje máximo" in fin.columns else 3,
        "puntaje_requerido": pct(row["Puntaje requerido perfil"]) if "Puntaje requerido perfil" in fin.columns else None,
        "apego": pct(row["% Apego al perfil"]),
        "nivel": row["Nivel de dominio"],
        "reviso_reporte": row["Revisó reporte"],
        "assessment_id": row["Assessments ID"],
    })
rankings_rows.sort(key=lambda x: -(x["puntaje"] or 0))

# Expertise concentration: per capability, who are the experts?
expertise = {}
for capability, grp in cap.groupby("Capability"):
    experts = cap[(cap["Capability"] == capability) & (cap["% Apego al perfil"] >= 1.0)]
    experts_detail = []
    for _, row in experts.iterrows():
        experts_detail.append({
            "nombre": row["Nombre del participante"],
            "bu": row["BU del participante"],
            "area": row.get(cap_area_col, ""),
            "año": int(row[cap_year_col]) if cap_year_col in row.index else None,
        })
    expertise[capability] = {
        "n_experts": len(experts),
        "experts": experts["Nombre del participante"].tolist()[:10],
        "experts_detail": experts_detail,
        "risk": "alto" if len(experts) <= 2 else ("medio" if len(experts) <= 5 else "bajo")
    }

# Needs development: apego < 0.60
needs_dev = [r for r in rankings_rows if (r["apego"] or 1) < 0.60]
needs_dev.sort(key=lambda x: x["apego"] or 0)

rankings = {
    "all": rankings_rows,
    "top_performers": rankings_rows[:20],
    "needs_development": needs_dev,
    "expertise_concentration": expertise
}
to_json(rankings, "rankings.json")

# ── 7. critical_findings.json ─────────────────────────────────────────────────

print("Generando critical_findings.json...")

findings = []

# Finding 1: BUs with >30% Novice/Advanced Beginner (developing org threshold)
for bu_item in summary["bu_summary"]:
    total = bu_item["n"]
    if total == 0: continue
    low = bu_item["niveles"].get("Novice", 0) + bu_item["niveles"].get("Advanced Beginner", 0)
    pct_low = low / total
    if pct_low > 0.30:
        findings.append({
            "severity": "alta" if pct_low > 0.50 else "media",
            "category": "Distribución de niveles",
            "title": f"{bu_item['bu']}: {round(pct_low*100)}% en niveles iniciales",
            "detail": f"{bu_item['bu']} tiene {low} de {total} personas en Novice o Advanced Beginner ({round(pct_low*100)}%). Benchmark de org madura: máx 25-30% en estos niveles.",
            "benchmark": "Org madura: Novice+Adv.Beginner ≤ 25-30%",
            "bu": bu_item["bu"]
        })

# Finding 2: capabilities with average apego < 0.60
for cap_item in gaps["by_capability"]:
    if (cap_item["apego_actual"] or 1) < 0.60:
        findings.append({
            "severity": "alta",
            "category": "Gap crítico de capability",
            "title": f"Brecha crítica: {cap_item['capability']}",
            "detail": f"Apego promedio de {round((cap_item['apego_actual'] or 0)*100)}% vs perfil requerido de {round((cap_item['perfil_requerido'] or 0)*100)}%. Gap de {round((cap_item['gap'] or 0)*100)} puntos.",
            "benchmark": "Umbral acción: apego < 60%",
            "capability": cap_item["capability"]
        })

# Finding 3: overall apego vs benchmark
apego_global = summary["apego_promedio_global"] or 0
if apego_global < 0.75:
    findings.append({
        "severity": "alta",
        "category": "Apego al perfil global",
        "title": f"Apego global ({round(apego_global*100)}%) por debajo del benchmark de org buena (75-80%)",
        "detail": f"El apego promedio de la organización es {round(apego_global*100)}%. Las organizaciones buenas alcanzan 75-80%, las best-in-class 80-85%.",
        "benchmark": "Org buena: 75-80% | Best-in-class: 80-85%"
    })
elif apego_global >= 0.80:
    findings.append({
        "severity": "positivo",
        "category": "Apego al perfil global",
        "title": f"Apego global ({round(apego_global*100)}%) en rango best-in-class",
        "detail": f"El apego promedio de la organización es {round(apego_global*100)}%, dentro del rango best-in-class (80-85%).",
        "benchmark": "Best-in-class: 80-85%"
    })

# Finding 4: expertise concentration risk
high_risk_caps = [cap_name for cap_name, info in rankings["expertise_concentration"].items() if info["risk"] == "alto"]
if high_risk_caps:
    findings.append({
        "severity": "media",
        "category": "Concentración de expertise",
        "title": f"{len(high_risk_caps)} capabilities con riesgo de persona clave",
        "detail": f"Las siguientes capabilities tienen ≤2 personas con alto dominio: {', '.join(high_risk_caps[:8])}{'...' if len(high_risk_caps) > 8 else ''}. Riesgo de dependencia crítica.",
        "benchmark": "Recomendado: ≥3 personas con dominio alto por capability crítica",
        "capabilities": high_risk_caps
    })

# Finding 5: reporte no revisado
no_reviso_pct = 1 - (summary["reviso_reporte_pct"] or 0)
if no_reviso_pct > 0.40:
    findings.append({
        "severity": "media",
        "category": "Adopción del proceso",
        "title": f"{round(no_reviso_pct*100)}% de participantes no revisó su reporte",
        "detail": f"{round(no_reviso_pct*100)}% de los evaluados no ha revisado su reporte de resultados. Esto limita el impacto del assessment en el desarrollo individual.",
        "benchmark": "Recomendado: 100% revisión de reportes"
    })

# Sort: alta -> media -> positivo
order = {"alta": 0, "media": 1, "positivo": 2}
findings.sort(key=lambda x: order.get(x["severity"], 3))

critical = {
    "total": len(findings),
    "alta_severidad": len([f for f in findings if f["severity"] == "alta"]),
    "media_severidad": len([f for f in findings if f["severity"] == "media"]),
    "positivos": len([f for f in findings if f["severity"] == "positivo"]),
    "findings": findings
}
to_json(critical, "critical_findings.json")

print(f"\nETL completo. 7 archivos generados en {OUT}")
