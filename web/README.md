# Web App

Simple movie recommender front-end built with Vite + React.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` (or the URL shown by Vite).

## Runtime setup (WASM files)

This app needs ONNX Runtime wasm files in `public/`.

Automatic:

```bash
npm install
```

Manual (if needed):

```bash
npm run copy-wasm
```

PowerShell manual copy:

```powershell
Copy-Item .\\node_modules\\onnxruntime-web\\dist\\*.wasm .\\public\\ -Force
```

macOS/Linux manual copy:

```bash
cp ./node_modules/onnxruntime-web/dist/*.wasm ./public/
```

If the app shows `Setup issue: missing runtime files. Run npm run copy-wasm.`, run the command and restart dev server.
