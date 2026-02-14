const METADATA_PATH = "/metadata.json";
const MOVIES_PATH = "/movies.json";
const MOVIE_STATS_PATH = "/movie_stats.json";

let appDataPromise = null;

function toMovieId(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function parseGenres(genresValue) {
  if (Array.isArray(genresValue)) {
    return genresValue.map((g) => String(g).trim()).filter(Boolean);
  }

  if (typeof genresValue === "string") {
    return genresValue
      .split("|")
      .map((g) => g.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeMovie(raw) {
  const movieId = toMovieId(raw.movie_id ?? raw.movieId ?? raw.id);
  if (movieId === null) {
    return null;
  }

  return {
    movie_id: movieId,
    title: String(raw.title ?? `Movie ${movieId}`),
    genres: parseGenres(raw.genres),
  };
}

async function fetchJson(path, { optional = false } = {}) {
  const response = await fetch(path);
  if (!response.ok) {
    if (optional && response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch ${path} (HTTP ${response.status})`);
  }
  return response.json();
}

function makeStatsMap(rawStats) {
  if (!rawStats || typeof rawStats !== "object") {
    return new Map();
  }

  const map = new Map();
  for (const [movieId, value] of Object.entries(rawStats)) {
    const parsedId = toMovieId(movieId);
    if (parsedId === null || !value || typeof value !== "object") {
      continue;
    }

    const avgRating = Number(value.avg_rating);
    const numRatings = Number(value.num_ratings);
    if (!Number.isFinite(avgRating)) {
      continue;
    }

    map.set(parsedId, {
      avg_rating: avgRating,
      num_ratings: Number.isFinite(numRatings) ? numRatings : 0,
    });
  }
  return map;
}

function communitySortValue(stats) {
  if (!stats) {
    return -Infinity;
  }
  const confidence = Math.log1p(Math.max(0, stats.num_ratings || 0));
  return stats.avg_rating + confidence * 0.08;
}

function buildGenreIndex(movies) {
  const index = new Map();
  for (const movie of movies) {
    for (const genre of movie.genres) {
      if (!index.has(genre)) {
        index.set(genre, []);
      }
      index.get(genre).push(movie);
    }
  }
  return index;
}

export async function loadAppData() {
  if (!appDataPromise) {
    appDataPromise = (async () => {
      const [metadataRaw, moviesRaw, statsRaw] = await Promise.all([
        fetchJson(METADATA_PATH),
        fetchJson(MOVIES_PATH),
        fetchJson(MOVIE_STATS_PATH, { optional: true }),
      ]);

      if (!metadataRaw || typeof metadataRaw !== "object") {
        throw new Error("metadata.json is missing or invalid.");
      }

      if (!metadataRaw.user2idx || !metadataRaw.movie2idx) {
        throw new Error(
          "metadata.json must include user2idx and movie2idx mappings."
        );
      }

      if (!Array.isArray(moviesRaw)) {
        throw new Error("movies.json must be an array.");
      }

      const movies = moviesRaw
        .map((movie) => normalizeMovie(movie))
        .filter(Boolean);

      const moviesById = new Map();
      for (const movie of movies) {
        moviesById.set(movie.movie_id, movie);
      }

      const statsByMovieId = makeStatsMap(statsRaw);
      const allGenres = Array.from(
        new Set(movies.flatMap((movie) => movie.genres))
      ).sort((a, b) => a.localeCompare(b));

      const genreToMovies = buildGenreIndex(movies);

      return {
        metadata: metadataRaw,
        movies,
        moviesById,
        statsByMovieId,
        allGenres,
        genreToMovies,
      };
    })();
  }

  return appDataPromise;
}

export function getTopRatedMovies({
  movies,
  statsByMovieId,
  limit = 5,
  minRatings = 20,
}) {
  if (!statsByMovieId || statsByMovieId.size === 0) {
    return [...movies].slice(0, limit);
  }

  const strict = [...movies]
    .filter((movie) => {
      const stats = statsByMovieId.get(movie.movie_id);
      return stats && stats.num_ratings >= minRatings;
    })
    .sort((a, b) => {
      const scoreDiff =
        communitySortValue(statsByMovieId.get(b.movie_id)) -
        communitySortValue(statsByMovieId.get(a.movie_id));
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.title.localeCompare(b.title);
    });

  if (strict.length >= limit) {
    return strict.slice(0, limit);
  }

  const fallback = [...movies].sort((a, b) => {
    const scoreDiff =
      communitySortValue(statsByMovieId.get(b.movie_id)) -
      communitySortValue(statsByMovieId.get(a.movie_id));
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.title.localeCompare(b.title);
  });

  const selected = new Map();
  for (const movie of strict) {
    selected.set(movie.movie_id, movie);
  }
  for (const movie of fallback) {
    if (selected.size >= limit) {
      break;
    }
    selected.set(movie.movie_id, movie);
  }
  return Array.from(selected.values()).slice(0, limit);
}

export function searchMovies({
  movies,
  statsByMovieId,
  query = "",
  genre = "",
  minCommunityCount = 0,
  limit = 30,
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const minCount = Math.max(0, Number(minCommunityCount) || 0);

  const filtered = movies.filter((movie) => {
    if (genre && !movie.genres.includes(genre)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    if (!movie.title.toLowerCase().includes(normalizedQuery)) {
      return false;
    }

    return true;
  });

  const filteredByCount = filtered.filter((movie) => {
    if (minCount <= 0) {
      return true;
    }

    const stats = statsByMovieId?.get(movie.movie_id);
    const n = Number(stats?.num_ratings);
    return Number.isFinite(n) && n >= minCount;
  });

  return filteredByCount
    .sort((a, b) => {
      const hasStats = statsByMovieId && statsByMovieId.size > 0;
      if (hasStats) {
        const scoreDiff =
          communitySortValue(statsByMovieId.get(b.movie_id)) -
          communitySortValue(statsByMovieId.get(a.movie_id));
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
      }
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

export function computeGenrePreferences({ ratingsByMovieId, moviesById }) {
  const byGenre = new Map();

  for (const [movieId, ratingValue] of Object.entries(ratingsByMovieId)) {
    const movie = moviesById.get(Number(movieId));
    const rating = Number(ratingValue);
    if (!movie || !Number.isFinite(rating)) {
      continue;
    }

    const centered = rating - 3;
    const weight = centered;

    for (const genre of movie.genres) {
      if (!byGenre.has(genre)) {
        byGenre.set(genre, { score: 0, count: 0 });
      }
      const agg = byGenre.get(genre);
      agg.score += weight;
      agg.count += 1;
    }
  }

  const preferences = Array.from(byGenre.entries()).map(([genre, value]) => {
    const countBoost = Math.log1p(value.count) * 0.35;
    const finalScore = value.score * (1 + countBoost);
    return {
      genre,
      score: finalScore,
      count: value.count,
    };
  });

  return preferences.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.count - a.count;
  });
}

export function buildGenreBonusMap(preferences) {
  if (!preferences.length) {
    return new Map();
  }

  const maxPositive = Math.max(
    ...preferences.map((item) => Math.max(0, item.score)),
    0
  );

  const map = new Map();
  for (const pref of preferences) {
    if (pref.score <= 0 || maxPositive <= 0) {
      map.set(pref.genre, 0);
      continue;
    }
    map.set(pref.genre, pref.score / maxPositive);
  }
  return map;
}

export function computeGenreBonus(movieGenres, genreBonusMap) {
  if (!movieGenres.length || genreBonusMap.size === 0) {
    return 0;
  }

  let total = 0;
  for (const genre of movieGenres) {
    total += genreBonusMap.get(genre) || 0;
  }

  const avg = total / movieGenres.length;
  return avg * 0.45;
}

function randomSample(array, count) {
  if (count <= 0 || array.length === 0) {
    return [];
  }

  if (count >= array.length) {
    return [...array];
  }

  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, count);
}

function hasModelMovieIdx(movie2idx, movieId) {
  return Object.prototype.hasOwnProperty.call(movie2idx, String(movieId));
}

export function buildCandidatePool({
  movies,
  genreToMovies,
  statsByMovieId,
  movie2idx,
  ratingsByMovieId,
  preferredGenres,
  topGenreCount = 3,
  perGenreLimit = 220,
  randomSampleSize = 260,
  communityLimit = 220,
  maxCandidates = 1000,
}) {
  const ratedMovieIds = new Set(
    Object.keys(ratingsByMovieId).map((movieId) => Number(movieId))
  );
  const candidates = new Map();

  const addMovie = (movie) => {
    if (!movie) {
      return;
    }
    if (ratedMovieIds.has(movie.movie_id)) {
      return;
    }
    if (!hasModelMovieIdx(movie2idx, movie.movie_id)) {
      return;
    }
    candidates.set(movie.movie_id, movie);
  };

  const topGenres = preferredGenres.slice(0, topGenreCount).map((x) => x.genre);
  for (const genre of topGenres) {
    const genreMovies = [...(genreToMovies.get(genre) || [])];
    genreMovies.sort((a, b) => {
      const diff =
        communitySortValue(statsByMovieId.get(b.movie_id)) -
        communitySortValue(statsByMovieId.get(a.movie_id));
      if (diff !== 0) {
        return diff;
      }
      return a.title.localeCompare(b.title);
    });
    genreMovies.slice(0, perGenreLimit).forEach(addMovie);
  }

  const modelMovies = movies.filter((movie) =>
    hasModelMovieIdx(movie2idx, movie.movie_id)
  );

  randomSample(
    modelMovies.filter((movie) => !ratedMovieIds.has(movie.movie_id)),
    randomSampleSize
  ).forEach(addMovie);

  if (statsByMovieId && statsByMovieId.size > 0) {
    const topCommunity = [...modelMovies]
      .sort((a, b) => {
        const diff =
          communitySortValue(statsByMovieId.get(b.movie_id)) -
          communitySortValue(statsByMovieId.get(a.movie_id));
        if (diff !== 0) {
          return diff;
        }
        return a.title.localeCompare(b.title);
      })
      .slice(0, communityLimit);
    topCommunity.forEach(addMovie);
  }

  return Array.from(candidates.values()).slice(0, maxCandidates);
}

export function getUserIdx(metadata, demoUserId) {
  if (!metadata?.user2idx) {
    return null;
  }

  const key = String(demoUserId);
  if (!Object.prototype.hasOwnProperty.call(metadata.user2idx, key)) {
    return null;
  }

  const idx = Number(metadata.user2idx[key]);
  return Number.isFinite(idx) ? idx : null;
}

export function clampRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 1;
  }
  return Math.min(5, Math.max(1, num));
}

export function formatCommunityLine(stats) {
  if (!stats) {
    return "";
  }
  return `Community avg ${stats.avg_rating.toFixed(2)} (n=${stats.num_ratings})`;
}
