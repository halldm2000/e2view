AI Weather & Climate Model Interaction Tool – Design Doc

Version 0.01 – May 2 2025

1. Purpose

Provide a friction-free, cross-platform interface for scientists, students, and power users to view AI weather/climate model outputs interactively and trigger new model runs on demand, without wrestling with code, data formats, or infrastructure.

2. Audience & Personas

Persona

Skill level

Key Goals

Data Scientist (IDE user)

Python, VS Code, Git

Inspect NetCDF/Zarr in workspace; downscale a region with CorrDiff; export plots to paper.

Research Meteorologist

Little coding; knows GRIB/NetCDF

Drag-and-drop files; quickly visualise fields; overlay observational data.

Operational Forecaster

Domain expert, low patience

Pre-defined templates to generate high-res nowcasts for custom AOIs.

3. Requirements

Functional

Interactive Viewer – 2-D map & optional 3-D globe, time/height sliders, variable picker.

Model Run Wizard – simple form to choose model (GraphCast, CorrDiff…), domain, lead time.

Job Management – queue, status, cancel, and notify when complete.

Data Import – local upload, HTTP/S3/GS URL, or workspace file (VS Code).

Export – images, animations, Jupyter notebook with xarray code.

Non-Functional

Must run both inside VS Code (Webview) and as stand-alone PWA.

Latency < 200 ms for interactive pan/zoom of global 0.25° data on 50 Mbps link.

Deployable on any Kubernetes (cloud or on-prem GPU node pool).

CI/CD < 10 min; single helm upgrade.

4. Architecture (MVP)

graph LR
  Frontend (React + deck.gl) <--WS/REST--> FastAPI Gateway <--gRPC--> Triton NIM Pods
        │                                      │
        └─ fetch() ----------------------- S3/GCS Bucket (Zarr, kerchunk)

Details:

Viewer bundles kerchunk maps; slices requested via HTTP Range when small, else via slice API backed by xarray-dask.

Model Pods: one per AI model, packaged as NVIDIA NIMs, auto-scalable via KEDA GPU scaler.

Auth: Auth0 → JWT (15 min TTL) → FastAPI dependency.

Job Queue: K8s Jobs + Argo Workflows; results written to results/{user}/{job_id}.zarr.

5. Tech Stack

Layer

Choice

Notes

UI

TypeScript, React, Vite, Tailwind

Shared between VS Code Webview & PWA.

Maps/Globe

deck.gl + Mapbox GL JS; CesiumJS optional

GPU accelerated.

Data

Zarr (fsspec), kerchunk, netcdfjs (small)

Cloud-optimised chunking.

Backend

FastAPI, SQLModel (metadata)

Lightweight, async.

Inference

Triton Inference Server (NIMs)

GraphCast, CorrDiff, FourCastNet.

Orchestration

Argo Workflows

YAML-defined pipelines.

CI/CD

GitHub Actions → Docker → Helm

Multi-arch images.

6. MVP Scope (6–8 weeks)

VS Code extension skeleton with command Weather → Open Viewer.

Viewer displays global temp field from sample FourCastNet Zarr; time/level sliders.

Backend: single CorrDiff pod; simple /run endpoint; polling status.

Job output re-ingested & visualised as new layer.

Browser PWA reuses same viewer; upload small NetCDF.

7. Roadmap (post-MVP)

Collaborative viewing (Live Share / WebRTC).

Batch presets & cron triggers.

Earth-2 Studio deep-link integration.

Marketplace for community model plugins.

WebAssembly decode path for fully offline mode.

8. Open Questions / Risks

Large-file transfer in browser (> 50 GB) – need resumable uploads & tiling gateway?

GPU cost control – predictive auto-scale vs on-demand spin-up?

Licensing – some models may have usage restrictions (e.g., ECMWF). How to enforce per-model policy?

Mapbox/deck.gl licensing fees for high-volume public PWA usage.

9. Deployment Modes – Cloud vs Local Laptop

Mode

Target user

Stack

Pros

Cons

Single-laptop (offline)

Researcher with an RTX/GeForce/Quadro laptop

Docker Desktop + WSL2 + NVIDIA Container Toolkit. docker-compose.yml spins up:• viewer (Node)…• backend-api (FastAPI)• one Triton GPU container per model• optional MinIO for local object store

No external hosting; works on planes; reproducible demos.

Limited to one GPU; thermals; large Zarr files.

On-prem mini-cluster

Lab with a DGX / 4×A100 workstation

Same containers under docker compose or k3s; object store could be NFS or Ceph

Cheap GPU hours; LAN-speed transfers.

Manual node management; HA optional.

Full cloud (K8s)

Team / public users

Helm charts on EKS/GKE/AKS; cloud object store; global CDN for tiles

Auto-scaling; multi-tenant; pay-per-use.

Requires cloud account; egress charges.

Laptop quick-start (Windows 11 w/ GPU):

# 1. Pre-reqs
wsl --install Ubuntu
wsl --update
winget install -e --id Docker.DockerDesktop
# Enable: Settings → Resources → WSL Integration & GPU Support

# 2. Clone repo
git clone https://github.com/weather-ai/core
cd core

# 3. Pull only viewer + CorrDiff
cp examples/docker-compose-laptop.yml docker-compose.yml

# 4. Fire it up
docker compose up -d

# 5. Open http://localhost:3000  (PWA) or run VS Code command → Viewer

Offline mode

Data: local NetCDF/Zarr under ~/weather_data mounts into both Triton and viewer.

Model runs: Triton GPU container uses host GPU via NVIDIA Container Runtime; writes to results/....

VS Code extension auto-detects http://localhost:8000 → offline profile (no auth).

10. Zero-CLI Install & Onboarding UX

Goal: No command line for the end user. Install the VS Code extension, desktop app, or open the web page—and you’re ready in under a minute.

10.1 Installation paths

Path

Delivery

Under the hood

User sees

VS Code Extension

Marketplace / .vsix

On activation:1. check GPU & Docker2. pull weather-engine:latest3. launch via Dockerode4. download model bundles to %APPDATA%/WeatherAI/models

Toast “Engine starting… (~15 s)”; then Viewer panel.

Desktop App

Electron/Tauri (.msi, .dmg, .AppImage)

Bundles: Node, FastAPI binary, Triton, weights.Spawns local gRPC + React viewer.

Double-click launches app window.

Hosted PWA

https://viewer.weather.ai

Front-end → SaaS API (autoscaled GPUs).If local engine found, switches automatically.

Click → OAuth → Viewer loads.

11. Repository Structure & Design Doc Placement

weather-ai/
├── README.md
├── docs/
│   └── design/
│       └── interaction-tool-design.md  ← this file
├── app/
├── extensions/vscode/
├── backend/
├── models/
├── infra/
└── .github/workflows/

Add to repo:

git checkout -b docs/add-design
# copy this markdown into docs/design/interaction-tool-design.md
git add docs/design/interaction-tool-design.md
git commit -m "docs: add AI Wx/Climate interaction design"
git push -u origin docs/add-design

(End of Version 0.1)

