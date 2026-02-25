# Inference App

Monorepo with:
- `inference/`: Python script to run ONNX inference locally.
- `web/`: Vite + React frontend that runs ONNX in the browser.

## Prerequisites
- Python 3.10+ (recommended)
- Node.js 18+ and npm

---

## Run Python Inference (`infer_onnx.py`)

Important: run this from the `inference/` folder because the script reads local files (`metadata.json`, `recommender.onnx`) by relative path.

### PowerShell (Windows)

```powershell
cd inference
python -m venv .venv
.venv\Scripts\Activate
python -m pip install -r requirements.txt
python infer_onnx.py
```

Expected output example:

```text
Predicted rating: 4.065788269042969
```

If `pip` is not recognized, always use:

```powershell
python -m pip install -r requirements.txt
```

---

## Run Frontend (`web/`)

### Dev mode

```powershell
cd web
npm install
npm run dev
```

Open:
- `http://localhost:5173/`

### If runtime files are missing

```powershell
npm run copy-wasm
npm run dev
```

### Production build + preview

```powershell
cd web
npm run build
npm run preview
```

---

## Deploy to GitHub Pages

This repo is configured to deploy the `web/` app to GitHub Pages using GitHub Actions:
- Workflow file: `.github/workflows/deploy-pages.yml`
- Vite `base` is set automatically in CI using `GITHUB_REPOSITORY`

To enable it in GitHub:
1. Go to repository `Settings` -> `Pages`.
2. In `Build and deployment`, select `Source: GitHub Actions`.
3. Push to `main` and the site will deploy automatically.

Expected URL format:
- `https://<your-user>.github.io/inferenceApp/`

---

## Quick Folder Summary

```text
inference/
  infer_onnx.py
  metadata.json
  recommender.onnx
  requirements.txt

web/
  public/
    recommender.onnx
    metadata.json
    movies.json
    movie_stats.json
  src/
  package.json
```
