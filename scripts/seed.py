#!/usr/bin/env python3
"""Sube los proyectos de assets/data/projects.json a Retool (workflow admin).
Uso: RETOOL_ADMIN_URL=... RETOOL_ADMIN_KEY=... python3 scripts/seed.py
Correrlo UNA sola vez: volver a correrlo duplica los proyectos.
"""
import json, os, sys, urllib.request, urllib.error

url = os.environ.get("RETOOL_ADMIN_URL")
key = os.environ.get("RETOOL_ADMIN_KEY")
if not url or not key:
    sys.exit("Faltan RETOOL_ADMIN_URL y RETOOL_ADMIN_KEY")

with open("assets/data/projects.json", encoding="utf-8") as f:
    projects = json.load(f)

for p in projects:
    body = json.dumps({"accion": "crear", **p}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json", "X-Workflow-Api-Key": key,
        "User-Agent": "portafolio-seed/1.0"})
    try:
        with urllib.request.urlopen(req) as res:
            print("OK", p["proyecto"][:40], res.read().decode()[:80])
    except urllib.error.HTTPError as e:
        sys.exit("Error %s en %s: %s" % (e.code, p["proyecto"][:40], e.read().decode()[:200]))
