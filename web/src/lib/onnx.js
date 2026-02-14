import * as ort from "onnxruntime-web";

const MODEL_PATH = "/recommender.onnx";
const MODEL_DATA_PATH = "/recommender.onnx.data";
const BATCH_SIZE = 512;

let sessionPromise = null;
const predictionCacheByUser = new Map();

function configureOrtWasm() {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    ort.env.wasm.numThreads = Math.max(
      1,
      Math.min(4, navigator.hardwareConcurrency)
    );
  }
  ort.env.wasm.simd = true;
}

function getSessionOptions() {
  return {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
    externalData: [{ path: MODEL_DATA_PATH }],
  };
}

async function createSessionFromPath() {
  return ort.InferenceSession.create(MODEL_PATH, getSessionOptions());
}

async function createSessionFromBuffers() {
  const [modelResp, dataResp] = await Promise.all([
    fetch(MODEL_PATH),
    fetch(MODEL_DATA_PATH),
  ]);

  if (!modelResp.ok) {
    throw new Error(`Unable to load ${MODEL_PATH} (HTTP ${modelResp.status})`);
  }
  if (!dataResp.ok) {
    throw new Error(
      `Unable to load ${MODEL_DATA_PATH} (HTTP ${dataResp.status})`
    );
  }

  const [modelBuf, dataBuf] = await Promise.all([
    modelResp.arrayBuffer(),
    dataResp.arrayBuffer(),
  ]);

  return ort.InferenceSession.create(new Uint8Array(modelBuf), {
    ...getSessionOptions(),
    externalData: [
      {
        path: "recommender.onnx.data",
        data: new Uint8Array(dataBuf),
      },
    ],
  });
}

export async function loadModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      configureOrtWasm();
      try {
        return await createSessionFromPath();
      } catch (error) {
        return createSessionFromBuffers();
      }
    })();
  }
  return sessionPromise;
}

function makeInt64Tensor(values) {
  const data = BigInt64Array.from(values.map((value) => BigInt(value)));
  return new ort.Tensor("int64", data, [values.length]);
}

function extractOutput(outputMap) {
  const firstOutputKey = Object.keys(outputMap)[0];
  if (!firstOutputKey) {
    throw new Error("ONNX model returned no outputs.");
  }
  return outputMap[firstOutputKey];
}

function getUserCache(userCacheKey) {
  if (!predictionCacheByUser.has(userCacheKey)) {
    predictionCacheByUser.set(userCacheKey, new Map());
  }
  return predictionCacheByUser.get(userCacheKey);
}

function buildMissingList(movieIds, cache, movie2idx) {
  const missing = [];
  for (const movieId of movieIds) {
    if (cache.has(movieId)) {
      continue;
    }

    const idx = Number(movie2idx[String(movieId)]);
    if (!Number.isFinite(idx)) {
      continue;
    }

    missing.push({ movieId, movieIdx: idx });
  }
  return missing;
}

async function runBatch(session, userIdx, batchItems, cache) {
  const userTensor = makeInt64Tensor(
    new Array(batchItems.length).fill(Number(userIdx))
  );
  const movieTensor = makeInt64Tensor(batchItems.map((item) => item.movieIdx));

  const outputs = await session.run({
    user_idx: userTensor,
    movie_idx: movieTensor,
  });
  const tensor = extractOutput(outputs);
  const values = Array.from(tensor.data, (value) => Number(value));

  for (let i = 0; i < batchItems.length; i += 1) {
    cache.set(batchItems[i].movieId, values[i]);
  }
}

export async function predictMoviesForUser({
  userCacheKey,
  userIdx,
  movieIds,
  movie2idx,
}) {
  if (!Number.isFinite(Number(userIdx))) {
    throw new Error("Invalid user_idx for inference.");
  }

  const normalizedMovieIds = Array.from(
    new Set(
      movieIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    )
  );

  const cache = getUserCache(String(userCacheKey));
  const missing = buildMissingList(normalizedMovieIds, cache, movie2idx);
  const session = await loadModel();

  for (let start = 0; start < missing.length; start += BATCH_SIZE) {
    const batch = missing.slice(start, start + BATCH_SIZE);
    await runBatch(session, userIdx, batch, cache);
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
  if (userCacheKey === null) {
    predictionCacheByUser.clear();
    return;
  }
  predictionCacheByUser.delete(String(userCacheKey));
}
