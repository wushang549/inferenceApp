import * as ort from "onnxruntime-web";

const MODEL_URL = "/recommender.onnx";
const DEFAULT_BATCH_SIZE = 512;

let sessionPromise = null;
const predictionCacheByUser = new Map();

function configureOrtRuntime() {
  ort.env.wasm.wasmPaths = "/";
  // Keep Vite-compatible runtime resolution: only override the wasm binary URL.
  ort.env.wasm.wasmPaths = { wasm: "/ort-wasm-simd-threaded.jsep.wasm" };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
}

function makeInt64Tensor(values) {
  return new ort.Tensor(
    "int64",
    BigInt64Array.from(values, (value) => BigInt(value)),
    [values.length]
  );
}

function getFirstOutputTensor(outputMap) {
  const firstOutputName = Object.keys(outputMap)[0];
  if (!firstOutputName) {
    throw new Error("Model returned no outputs.");
  }

  return outputMap[firstOutputName];
}

export async function loadSession() {
  if (!sessionPromise) {
    configureOrtRuntime();
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    }).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

export async function predictBatch(userIdx, movieIdxArray) {
  const numericUserIdx = Number(userIdx);
  if (!Number.isFinite(numericUserIdx)) {
    throw new Error("predictBatch: userIdx must be a finite number.");
  }

  if (!Array.isArray(movieIdxArray) || movieIdxArray.length === 0) {
    return [];
  }

  const normalizedMovieIdx = movieIdxArray.map((value) => Number(value));
  if (normalizedMovieIdx.some((value) => !Number.isFinite(value))) {
    throw new Error("predictBatch: movieIdxArray contains invalid values.");
  }

  const session = await loadSession();

  const userTensor = makeInt64Tensor(
    new Array(normalizedMovieIdx.length).fill(numericUserIdx)
  );
  const movieTensor = makeInt64Tensor(normalizedMovieIdx);

  const outputMap = await session.run({
    user_idx: userTensor,
    movie_idx: movieTensor,
  });

  const outputTensor = getFirstOutputTensor(outputMap);
  return Array.from(outputTensor.data, (value) => Number(value));
}

function getUserCache(userCacheKey) {
  const key = String(userCacheKey);
  if (!predictionCacheByUser.has(key)) {
    predictionCacheByUser.set(key, new Map());
  }
  return predictionCacheByUser.get(key);
}

export async function predictMoviesForUser({
  userCacheKey,
  userIdx,
  movieIds,
  movie2idx,
  batchSize = DEFAULT_BATCH_SIZE,
}) {
  if (!movie2idx || typeof movie2idx !== "object") {
    throw new Error("predictMoviesForUser: movie2idx mapping is required.");
  }

  const normalizedMovieIds = Array.from(
    new Set(
      (movieIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    )
  );

  const cache = getUserCache(userCacheKey);
  const missing = [];

  for (const movieId of normalizedMovieIds) {
    if (cache.has(movieId)) {
      continue;
    }

    const movieIdx = Number(movie2idx[String(movieId)]);
    if (!Number.isFinite(movieIdx)) {
      continue;
    }

    missing.push({ movieId, movieIdx });
  }

  const safeBatchSize = Math.max(1, Number(batchSize) || DEFAULT_BATCH_SIZE);

  for (let start = 0; start < missing.length; start += safeBatchSize) {
    const chunk = missing.slice(start, start + safeBatchSize);
    const predictions = await predictBatch(
      userIdx,
      chunk.map((item) => item.movieIdx)
    );

    for (let i = 0; i < chunk.length; i += 1) {
      cache.set(chunk[i].movieId, predictions[i]);
    }
  }

  const result = new Map();
  for (const movieId of normalizedMovieIds) {
    if (cache.has(movieId)) {
      result.set(movieId, cache.get(movieId));
    }
  }

  return result;
}

export function clearPredictionCache(userCacheKey = null) {
  if (userCacheKey === null || userCacheKey === undefined) {
    predictionCacheByUser.clear();
    return;
  }

  predictionCacheByUser.delete(String(userCacheKey));
}
