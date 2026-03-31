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

# Only finalized assessments for scoring
fin = gen[gen["Assessments Status"] == "Finalizado"].copy()

NIVEL_ORDER = ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"]
BU_LIST = sorted(gen["BU del participante"].dropna().unique().tolist())
AREA_LIST = sorted(gen["Área Realizada"].dropna().unique().tolist())
ROL_LIST = sorted(gen["Rol realizado"].dropna().unique().tolist())
CAP_LIST = sorted(cap["Capability"].dropna().unique().tolist())
PERIODOS = sorted(gen["Periodo"].dropna().unique().tolist())
AÑOS = sorted(gen["Año"].dropna().unique().tolist())

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
      "Metodología S&OP", "Metodología MPS/MRP", "Pronóstico de la demanda",
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
    "areas": AREA_LIST,
    "roles": ROL_LIST,
    "capabilities": CAP_LIST,
    "periodos": [int(p) for p in PERIODOS],
    "años": [int(a) for a in AÑOS],
    "nivel_distribution": {n: nivel_pct(n) for n in NIVEL_ORDER},
    "nivel_counts": {n: int(nivel_dist.get(n, 0)) for n in NIVEL_ORDER},
    "bu_summary": bu_summary,
}
to_json(summary, "summary.json")

# ── 3. gaps.json ──────────────────────────────────────────────────────────────

print("Generando gaps.json...")

# Gap por capability: perfil requerido vs apego actual
cap_gaps = []
for capability, grp in cap.groupby("Capability"):
    perfil_mean = pct(grp["Perfil"].mean())
    apego_mean = pct(grp["Apego Capability"].mean())
    gap = pct((perfil_mean or 0) - (apego_mean or 0))
    # by BU
    by_bu = {}
    for bu, bgrp in grp.groupby("BU del participante"):
        by_bu[bu] = {
            "perfil": pct(bgrp["Perfil"].mean()),
            "apego": pct(bgrp["Apego Capability"].mean()),
            "n": len(bgrp)
        }
    cap_gaps.append({
        "capability": capability,
        "perfil_requerido": perfil_mean,
        "apego_actual": apego_mean,
        "gap": gap,
        "by_bu": by_bu
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

# Gap por BU: radar data (top 10 capabilities by gap for each BU)
bu_radar = {}
for bu in BU_LIST:
    bu_cap = cap[cap["BU del participante"] == bu]
    items = []
    for capability, grp in bu_cap.groupby("Capability"):
        items.append({
            "capability": capability,
            "perfil": pct(grp["Perfil"].mean()),
            "apego": pct(grp["Apego Capability"].mean()),
        })
    items.sort(key=lambda x: -abs((x["perfil"] or 0) - (x["apego"] or 0)))
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
                "apego": pct(cgrp["Apego Capability"].mean()),
                "n": len(cgrp)
            }
        rows.append({"label": row_val, "cells": cells})
    return rows

heatmap = {
    "capabilities": CAP_LIST,
    "by_bu": build_heatmap(cap, "BU del participante", BU_LIST),
    "by_area": build_heatmap(cap, "Área Realizada", AREA_LIST),
    "benchmark_threshold": 0.70
}
to_json(heatmap, "heatmap.json")

# ── 5. evolution.json ─────────────────────────────────────────────────────────

print("Generando evolution.json...")

# Distribution per period
period_dist = []
for (año, periodo), grp in fin.groupby(["Año", "Periodo"]):
    grp_fin = grp[grp["Assessments Status"] == "Finalizado"] if "Assessments Status" in grp.columns else grp
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

evolution = {
    "by_period": period_dist,
    "movers": movers,
    "top_mejoras": movers[:10],
    "top_retrocesos": sorted(movers, key=lambda x: x["delta_puntaje"] or 0)[:10],
    "by_bu": bu_evolution
}
to_json(evolution, "evolution.json")

# ── 6. rankings.json ──────────────────────────────────────────────────────────

print("Generando rankings.json...")

rankings_rows = []
for _, row in fin.iterrows():
    rankings_rows.append({
        "nombre": row["Nombre del participante"],
        "bu": row["BU del participante"],
        "rol": row["Rol realizado"],
        "area": row["Área Realizada"],
        "año": int(row["Año"]),
        "periodo": int(row["Periodo"]),
        "puntaje": pct(row["Puntaje assessment"]),
        "apego": pct(row["% Apego al perfil"]),
        "nivel": row["Nivel de dominio"],
        "reviso_reporte": row["Revisó reporte"],
        "assessment_id": row["Assessments ID"],
    })
rankings_rows.sort(key=lambda x: -(x["puntaje"] or 0))

# Expertise concentration: per capability, who are the experts?
expertise = {}
for capability, grp in cap.groupby("Capability"):
    experts = cap[(cap["Capability"] == capability) & (cap["Apego Capability"] >= 2.5)]
    expertise[capability] = {
        "n_experts": len(experts),
        "experts": experts["Nombre del participante"].tolist()[:10],
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
