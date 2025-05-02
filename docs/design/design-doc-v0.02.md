# e2view – Design Doc

Version 0.02 – May 5 2025

<!-- TOC -->
- [1. 🎯 Purpose](#1--purpose)
- [2. 👥 Audience & Personas](#2--audience--personas)
- [3. ✅ Requirements](#3--requirements)
- [4. 🏗️ Architecture (MVP)](#4-️-architecture-mvp)
- [5. 💻 Tech Stack](#5--tech-stack)
- [6. 🚀 MVP Scope (6–8 weeks)](#6--mvp-scope-68-weeks)
- [7. 🗺️ Roadmap (post-MVP)](#7-️-roadmap-post-mvp)
- [8. ❓ Open Questions + New Sections](#8--open-questions--new-sections)
  - [8.1 Abandoned Alternatives](#81-abandoned-alternatives)
  - [8.2 Cost Control Escalation](#82-cost-control-escalation)
- [9. ☁️ Deployment Modes – Unified k3d Approach](#9-️-deployment-modes--unified-k3d-approach)
- [10. 🖱️ Zero-CLI Install & Onboarding UX](#10-️-zero-cli-install--onboarding-ux)
  - [10.1 Installation paths](#101-installation-paths)
- [11. 📁 Repository Structure & Design Doc Placement](#11--repository-structure--design-doc-placement)
<!-- /TOC -->

## 1. 🎯 Purpose

Provide a friction-free, cross-platform interface for scientists, students, and power users to view AI weather/climate model outputs interactively and trigger new model runs on demand, without wrestling with code, data formats, or infrastructure.

## 2. 👥 Audience & Personas

| Persona                   | Skill level                      | Key Goals                                                                           |
|---------------------------|----------------------------------|-------------------------------------------------------------------------------------|
| Data Scientist (IDE user) | Python, VS Code, Git             | Inspect NetCDF/Zarr in workspace; downscale a region with CorrDiff; export plots. |
| Research Meteorologist    | Little coding; knows GRIB/NetCDF | Drag-and-drop files; quickly visualise fields; overlay observational data.        |
| Operational Forecaster    | Domain expert, low patience      | Pre-defined templates to generate high-res nowcasts for custom AOIs.                |

The target users range from Data Scientists comfortable with Python and IDEs needing to inspect data and run models like CorrDiff (a specific AI weather model for downscaling), to Research Meteorologists with less coding experience who need easy visualization and data overlay, and Operational Forecasters requiring simple templates for specific, high-resolution forecasts.

## 3. ✅ Requirements

**Functional**

- Interactive Viewer – 2-D map & optional 3-D globe, time/height sliders, variable picker.
- Model Run Wizard – simple form to choose model (GraphCast, CorrDiff…), domain, lead time.
- Job Management – queue, status, cancel, and notify when complete.
- Data Import – local upload, HTTP/S3/GS URL, or workspace file (VS Code).
- Export – images, animations, Jupyter notebook with `xarray` code.

**Non-Functional**

- Must run both inside VS Code (Webview) and as stand-alone PWA.
- **Latency Budget** (200ms total):
  - Network roundtrip: 50ms
  - Tile processing: 100ms (p95)
  - Rendering: 50ms
- **Error Budget**: 5% of requests may exceed latency target (24h rolling)
- **Cost Controls**:
  - Default 100 GPU-min/day free tier
  - Teams: $500/month auto-approval threshold

The tool must provide core functions like an interactive map/globe viewer with controls, a wizard for initiating model runs (using specific AI models like GraphCast or CorrDiff), job tracking, data import from various sources (local, URL, workspace), and export capabilities (images, animations, Jupyter notebooks). Non-functionally, it needs to operate both within the VS Code editor and as a standalone Progressive Web App (PWA - a web app installable like a native app), adhere to strict performance targets including a total latency budget of 200ms and an error budget allowing only 5% of requests to exceed this, and incorporate cost controls like a free GPU usage tier and team spending limits.

## 4. 🏗️ Architecture (MVP)

```mermaid
graph LR
  Frontend <--WS/REST--> FastAPI Gateway <--gRPC--> Triton NIM Pods
        │                                      │
        └─ GET /v1/data/... --> Data Access Service <--> S3/GCS/Zarr/NetCDF
```

**Details:**

- **Data Access Service** handles unified interface:
  - Auto-routes requests: direct HTTP range fetches (small) vs `xarray-dask` processing (large)
  - Browser client uses simple `GET /v1/data/{dataset}/chunk/{zarr_path}.bin`
- **Model Pods**: NVIDIA NIMs with KEDA GPU auto-scaling
- **Auth**: VS Code session tokens (extension) / Device code flow (PWA) → JWT
- **Job Queue**: K8s Jobs + Argo Workflows → `results/{user}/{job_id}.zarr`

The Minimum Viable Product (MVP) architecture features a web Frontend communicating via standard WebSockets/REST protocols with a FastAPI Gateway (chosen for its speed and ease of use in Python). This gateway uses gRPC (a high-performance communication protocol) to interact with NVIDIA NIM Pods (containerized AI Inference Microservices managed by Kubernetes) for efficient model execution. Data access is centralized in a service that intelligently routes requests for cloud storage (like AWS S3 or Google Cloud Storage) or scientific formats (like Zarr or NetCDF), optimizing between direct file fetches for small requests and parallel processing using `xarray` and `dask` for large datasets. Authentication relies on standard JWTs (JSON Web Tokens), obtained via VS Code integration or a device authorization flow for the PWA. Background tasks like model runs are managed as Kubernetes Jobs orchestrated by Argo Workflows (a system for defining and running complex compute pipelines on Kubernetes), storing results in user-specific Zarr datasets (a format optimized for chunked, cloud-based data).

## 5. 💻 Tech Stack

| Layer         | Choice                                    | Notes                               |
|---------------|-------------------------------------------|-------------------------------------|
| UI            | TypeScript, React, Vite, Tailwind         | Shared between VS Code Webview & PWA. |
| Maps/Globe    | `deck.gl` + Mapbox GL JS; CesiumJS optional | GPU accelerated.                    |
| Data          | Zarr (`fsspec`), `kerchunk`, `netcdfjs` (small) | Cloud-optimised chunking.           |
| Backend       | FastAPI, SQLModel (metadata)              | Lightweight, async.                 |
| Inference     | Triton Inference Server (NIMs)            | GraphCast, CorrDiff, FourCastNet.   |
| Orchestration | Argo Workflows                            | YAML-defined pipelines.             |
| CI/CD         | GitHub Actions → Docker → Helm            | Multi-arch images.                  |

The technology choices prioritize modern web standards and Python for the backend. The UI uses TypeScript with the React library, built using Vite and styled with Tailwind CSS, allowing code reuse between the VS Code webview and the PWA. Visualization leverages `deck.gl` (a powerful GPU-accelerated geospatial library) with Mapbox GL JS for base maps. Data handling focuses on cloud-native formats like Zarr (using `fsspec` for accessing various storage backends and `kerchunk` to create virtual aggregated datasets), supplemented by `netcdfjs` for smaller client-side operations. The backend API is built with FastAPI (a high-performance asynchronous Python framework) using SQLModel for database interactions. Model inference is standardized via NVIDIA Triton Inference Server deployed as NIMs (supporting models like GraphCast, CorrDiff, FourCastNet). Complex tasks are orchestrated using Argo Workflows (Kubernetes-native), and the development pipeline (CI/CD) employs standard tools: GitHub Actions for automation, Docker for containerization, and Helm for Kubernetes deployment.

## 6. 🚀 MVP Scope (6–8 weeks)

- VS Code extension skeleton with command `e2view → Open Viewer`.
- Viewer displays global temp field from sample FourCastNet Zarr; time/level sliders.
- Backend: single CorrDiff pod; simple `/run` endpoint; polling status.
- Job output re-ingested & visualised as new layer.
- Browser PWA reuses same viewer; upload small NetCDF.

The initial 6-8 week MVP will focus on core visualization and a single model workflow. This includes the VS Code extension skeleton providing a command to open the viewer, which will display a global temperature field from a sample FourCastNet model output (in Zarr format, a chunked array format suitable for cloud storage) with basic time/level sliders. The backend will support running the CorrDiff model via a simple API endpoint (`/run`) with status polling. A key requirement is that the output from this model run can be loaded back into the viewer as a new data layer. The Progressive Web App (PWA) version will reuse the same viewer interface and allow users to upload small NetCDF files (a common scientific data format).

## 7. 🗺️ Roadmap (post-MVP)

- Collaborative viewing (Live Share / WebRTC).
- Batch presets & cron triggers.
- Earth-2 Studio deep-link integration.
- Marketplace for community model plugins.
- WebAssembly decode path for fully offline mode.

Future development ideas include features like collaborative viewing sessions (potentially using WebRTC for real-time peer-to-peer communication similar to Google Docs or VS Code Live Share), allowing users to define batch jobs or scheduled (cron) runs, integrating with NVIDIA's Earth-2 Studio platform via deep links for seamless workflow transitions, establishing a marketplace for community-contributed model plugins, and investigating the use of WebAssembly (a binary instruction format for browsers) to enable some data decoding or visualization tasks to run entirely client-side, potentially enabling an offline mode.

## 8. ❓ Open Questions + New Sections

### 8.1 Abandoned Alternatives

| Option                | Reason for Rejection              |
|-----------------------|------------------------------------|
| PyScript data decoding| Bundle size (+50MB) vs performance|
| CesiumJS 3D           | Licensing costs vs `deck.gl`+Mapbox |
| gRPC-Web              | Limited browser streaming support |
| Direct S3 writes      | CORS complexity for ad-hoc buckets|

Several alternatives were considered and rejected during the design process. Using PyScript (a framework for running Python in the browser) for client-side data decoding was deemed impractical due to its large bundle size affecting initial load time and performance. While CesiumJS offers powerful 3D globe features, its licensing costs made the combination of `deck.gl` and Mapbox a more favourable choice. Using gRPC-Web (gRPC for browsers) was ruled out due to its relatively limited support for bidirectional streaming compared to WebSockets. Allowing the frontend to write directly to user-provided S3 buckets was avoided because managing Cross-Origin Resource Sharing (CORS) security policies correctly across arbitrary buckets would be too complex and error-prone.

### 8.2 Cost Control Escalation

| GPU Budget Action       | Trigger Condition          |
|-------------------------|----------------------------|
| Queue Low-Priority Jobs | >50% daily budget consumed |
| Require MFA Approval    | >80% budget consumed       |
| Hard Stop               | 100% budget reached        |

GPU (Graphics Processing Unit) compute time is a key cost driver. To manage this, escalating actions are triggered based on budget usage. If a user or team consumes over 50% of their daily allocated GPU budget, subsequently submitted jobs will be placed in a low-priority queue. Exceeding 80% of the budget will require explicit approval via Multi-Factor Authentication (MFA) before new GPU-intensive jobs can start. Upon reaching 100% of the budget, a hard stop is enforced, preventing any further GPU usage until the budget resets (typically daily).

## 9. ☁️ Deployment Modes – Unified k3d Approach

| Mode       | Configuration Differences          |
|------------|------------------------------------|
| Local      | `k3d` in Docker Desktop, local models|
| Cloud      | `k3d` in cloud VMs + object storage  |
| HPC Bridge | `k3d` agents submit to Slurm         |

**Pros:**
- Single container images across environments
- Identical Kubernetes manifests
- NVIDIA `k3d` extension for GPU access
- MinIO pre-configured for local storage

The tool is designed for flexible deployment using a unified approach based on `k3d`, a tool that runs a lightweight Kubernetes cluster inside Docker. This allows the same application containers and Kubernetes configuration files to be used across different environments: a **Local** mode running entirely within Docker Desktop (ideal for development, using local model files); a **Cloud** mode where `k3d` runs on cloud Virtual Machines (VMs) utilizing cloud object storage (like S3 or GCS); and an **HPC Bridge** mode where `k3d` agents running on a High-Performance Computing cluster submit jobs to the cluster's native workload manager (like Slurm). This unified strategy simplifies development and deployment, leverages the NVIDIA `k3d` extension for easy GPU access in local setups, and uses MinIO (an S3-compatible object storage server) to provide local storage during development.

## 10. 🖱️ Zero-CLI Install & Onboarding UX

**Goal**: No command line for the end user. Install the VS Code extension, desktop app, or open the web page—and you're ready in under a minute.

### 10.1 Installation paths

| Path              | Delivery                                | Under the hood                                                                                                                    | User sees                                            |
|-------------------|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| VS Code Extension | Marketplace / `.vsix`                   | On activation:<br>1. check GPU & Docker<br>2. pull `e2view-engine:latest`<br>3. launch via Dockerode<br>4. download model bundles to `%APPDATA%/e2view/models` | Toast "Engine starting… (~15 s)"; then Viewer panel. |
| Desktop App       | Electron/Tauri (`.msi`, `.dmg`, `.AppImage`) | Bundles: Node, FastAPI binary, Triton, weights.<br>Spawns local gRPC + React viewer.                                         | Double-click launches app window.                    |
| Hosted PWA        | `https://viewer.e2view.ai`             | Front-end → SaaS API (autoscaled GPUs).<br>If local engine found, switches automatically.                                        | Click → OAuth → Viewer loads.                        |

The primary goal for installation is a smooth, zero-Command-Line Interface (CLI) experience, allowing users to get started quickly (under a minute). This is supported via three distinct paths: 1) A **VS Code Extension**, installable from the Marketplace or a `.vsix` file, which handles dependencies like checking for Docker and GPU availability, pulling the necessary `e2view-engine` Docker image, launching it (using libraries like `dockerode`), and downloading model data automatically to a dedicated `%APPDATA%/e2view/models` directory. 2) A **Desktop App** built using frameworks like Electron or Tauri (which package web technologies like Node.js, React, and the FastAPI backend binary into native installers like `.msi` or `.dmg`), providing a simple double-click launch experience. 3) A **Hosted Progressive Web App (PWA)** accessible via a URL (e.g., `https://viewer.e2view.ai`), which connects to a cloud-hosted backend (Software-as-a-Service, SaaS) with auto-scaling GPUs, authenticates users via standard OAuth, and can intelligently switch to using a locally running engine if one is detected.

## 11. 📁 Repository Structure & Design Doc Placement

```text
e2view/
├── README.md
├── docs/
│   └── design/
│       └── e2view-design.md  ← this file
├── app/
├── extensions/vscode/
├── backend/
├── models/
├── infra/
└── .github/workflows/
```

**Add to repo:**

```bash
git checkout -b docs/add-design
# copy this markdown into docs/design/e2view-design.md
git add docs/design/e2view-design.md
git commit -m "docs: add e2view design document"
git push -u origin docs/add-design
```

The project's code will be organized within the `e2view/` repository. Key directories include `docs/` for all documentation, `app/` for the main shared UI components, `extensions/vscode/` for the VS Code specific parts, `backend/` for the API services, `models/` potentially containing model definitions or configurations, `infra/` for infrastructure-as-code (like Kubernetes manifests or Terraform), and `.github/workflows/` for automated CI/CD pipelines using GitHub Actions. This design document is located at `docs/design/e2view-design.md`.

(End of Version 0.2)

