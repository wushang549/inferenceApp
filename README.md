# Inference ONNX - Guia rapida

Este repositorio ejecuta una inferencia local con ONNX Runtime usando el modelo dentro de la carpeta `inference/`.

## Estructura

```text
inference/
  infer_onnx.py
  metadata.json
  recommender.onnx
  recommender.onnx.data
  requirements.txt
```

## Requisitos

- Python 3.9 o superior
- PowerShell (Windows)

## Ejecutar desde cero (recien clonado)

1. Clona el repo y entra:

```powershell
git clone https://github.com/wushang549/inferenceApp.git
cd inferenceApp
```

2. Entra a la carpeta de inference:

```powershell
cd inference
```

3. Crea y activa entorno virtual:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

4. Instala dependencias:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

5. Ejecuta:

```powershell
python infer_onnx.py
```

Salida esperada (ejemplo):

```text
Predicted rating: 4.49
```

## Comando rapido (desde la raiz del repo)

Si ya tienes el entorno creado en `inference/.venv`:

```powershell
Set-Location .\inference; .\.venv\Scripts\python.exe .\infer_onnx.py
```

## Cambiar el usuario/pelicula de prueba

En `inference/infer_onnx.py` cambia:

- `user_id = 1`
- `movie_id = 1`

Los IDs deben existir en `inference/metadata.json`.
