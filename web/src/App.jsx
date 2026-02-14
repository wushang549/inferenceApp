import { useEffect, useMemo, useState } from "react";
import MovieCard from "./components/MovieCard";
import ProgressBar from "./components/ProgressBar";
import RecommendationsSection from "./components/RecommendationsSection";
import SearchBar from "./components/SearchBar";
import {
  buildCandidatePool,
  buildGenreBonusMap,
  clampRating,
  computeGenreBonus,
  computeGenrePreferences,
  getTopRatedMovies,
  getUserIdx,
  loadAppData,
  searchMovies,
} from "./lib/data";
import { predictMoviesForUser } from "./lib/onnx";

const MIN_RATINGS_REQUIRED = 10;
const TOP_GENRES_FOR_SECTIONS = 3;

const STORAGE_KEYS = {
  ratings: "reco_ratings_v1",
  demoUserId: "reco_demo_user_id_v1",
};

function parseStoredRatings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ratings);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const clean = {};
    for (const [movieId, value] of Object.entries(parsed)) {
      const movieNum = Number(movieId);
      const ratingNum = Number(value);
      if (Number.isFinite(movieNum) && Number.isFinite(ratingNum)) {
        clean[String(movieNum)] = clampRating(ratingNum);
      }
    }
    return clean;
  } catch (error) {
    return {};
  }
}

export default function App() {
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [ratingsByMovieId, setRatingsByMovieId] = useState(parseStoredRatings);

  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");

  const [demoUserInput, setDemoUserInput] = useState(
    () => localStorage.getItem(STORAGE_KEYS.demoUserId) || "1"
  );
  const [activeDemoUserId, setActiveDemoUserId] = useState(
    () => localStorage.getItem(STORAGE_KEYS.demoUserId) || "1"
  );
  const [demoUserError, setDemoUserError] = useState("");

  const [recommendationState, setRecommendationState] = useState({
    overall: [],
    byGenre: [],
    latencyMs: 0,
    candidateCount: 0,
  });
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setDataLoading(true);
      setDataError("");
      try {
        const loadedData = await loadAppData();
        if (!cancelled) {
          setData(loadedData);
        }
      } catch (error) {
        if (!cancelled) {
          setDataError(error?.message || "Failed to load app data.");
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(ratingsByMovieId));
  }, [ratingsByMovieId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.demoUserId, String(activeDemoUserId));
  }, [activeDemoUserId]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const fallbackId = Object.prototype.hasOwnProperty.call(
      data.metadata.user2idx,
      "1"
    )
      ? "1"
      : Object.keys(data.metadata.user2idx)[0] || "";

    const currentValid = Object.prototype.hasOwnProperty.call(
      data.metadata.user2idx,
      String(activeDemoUserId)
    );
    if (currentValid) {
      return;
    }

    if (fallbackId) {
      setActiveDemoUserId(fallbackId);
      setDemoUserInput(fallbackId);
      setDemoUserError("");
    } else {
      setDemoUserError("No valid Demo User ID was found in metadata.user2idx.");
    }
  }, [data, activeDemoUserId]);

  const ratedCount = useMemo(
    () => Object.keys(ratingsByMovieId).length,
    [ratingsByMovieId]
  );

  const initialTopMovies = useMemo(() => {
    if (!data) {
      return [];
    }
    return getTopRatedMovies({
      movies: data.movies,
      statsByMovieId: data.statsByMovieId,
      limit: 5,
    });
  }, [data]);

  const movieListToRate = useMemo(() => {
    if (!data) {
      return [];
    }

    const hasFilter = query.trim() || selectedGenre;
    if (!hasFilter) {
      return initialTopMovies;
    }

    return searchMovies({
      movies: data.movies,
      statsByMovieId: data.statsByMovieId,
      query,
      genre: selectedGenre,
      limit: 24,
    });
  }, [data, query, selectedGenre, initialTopMovies]);

  const genrePreferences = useMemo(() => {
    if (!data) {
      return [];
    }
    return computeGenrePreferences({
      ratingsByMovieId,
      moviesById: data.moviesById,
    });
  }, [data, ratingsByMovieId]);

  const activeUserIdx = useMemo(() => {
    if (!data) {
      return null;
    }
    return getUserIdx(data.metadata, activeDemoUserId);
  }, [data, activeDemoUserId]);

  useEffect(() => {
    if (!data || ratedCount < MIN_RATINGS_REQUIRED) {
      setRecommendationState({
        overall: [],
        byGenre: [],
        latencyMs: 0,
        candidateCount: 0,
      });
      setRecommendationError("");
      setRecommendationLoading(false);
      return;
    }

    if (!Number.isFinite(activeUserIdx)) {
      setRecommendationError(
        `Demo User ID "${activeDemoUserId}" does not exist in metadata.user2idx.`
      );
      return;
    }

    let cancelled = false;

    async function generateRecommendations() {
      setRecommendationLoading(true);
      setRecommendationError("");
      const start = performance.now();

      try {
        const candidatePool = buildCandidatePool({
          movies: data.movies,
          genreToMovies: data.genreToMovies,
          statsByMovieId: data.statsByMovieId,
          movie2idx: data.metadata.movie2idx,
          ratingsByMovieId,
          preferredGenres: genrePreferences,
        });

        const predictionMap = await predictMoviesForUser({
          userCacheKey: String(activeDemoUserId),
          userIdx: activeUserIdx,
          movieIds: candidatePool.map((movie) => movie.movie_id),
          movie2idx: data.metadata.movie2idx,
        });

        const genreBonusMap = buildGenreBonusMap(genrePreferences);
        const scored = candidatePool
          .map((movie) => {
            const predicted = predictionMap.get(movie.movie_id);
            if (!Number.isFinite(predicted)) {
              return null;
            }

            const genreBonus = computeGenreBonus(movie.genres, genreBonusMap);
            return {
              movie,
              predictedRating: predicted,
              finalScore: predicted + genreBonus,
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.finalScore - a.finalScore);

        const overall = scored.slice(0, 5);
        const topGenres = genrePreferences
          .slice(0, TOP_GENRES_FOR_SECTIONS)
          .map((item) => item.genre);

        const byGenre = topGenres.map((genre) => ({
          genre,
          items: scored.filter((item) => item.movie.genres.includes(genre)).slice(0, 5),
        }));

        const latencyMs = performance.now() - start;
        if (!cancelled) {
          setRecommendationState({
            overall,
            byGenre,
            latencyMs,
            candidateCount: candidatePool.length,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRecommendationError(
            error?.message || "Failed to generate recommendations."
          );
        }
      } finally {
        if (!cancelled) {
          setRecommendationLoading(false);
        }
      }
    }

    generateRecommendations();
    return () => {
      cancelled = true;
    };
  }, [
    data,
    ratedCount,
    ratingsByMovieId,
    activeDemoUserId,
    activeUserIdx,
    genrePreferences,
  ]);

  const handleRateMovie = (movieId, rating) => {
    setRatingsByMovieId((prev) => ({
      ...prev,
      [String(movieId)]: clampRating(rating),
    }));
  };

  const applyDemoUserId = (event) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    const candidate = demoUserInput.trim();
    if (!candidate) {
      setDemoUserError("Demo User ID is required.");
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(data.metadata.user2idx, candidate)) {
      setDemoUserError(
        `Demo User ID "${candidate}" was not found. Pick one that exists in metadata.user2idx.`
      );
      return;
    }

    setActiveDemoUserId(candidate);
    setDemoUserError("");
  };

  if (dataLoading) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Movie Recommender</h1>
          <p>Loading model metadata and movie catalog...</p>
        </section>
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Movie Recommender</h1>
          <p className="error-text">{dataError}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Browser-only ONNX Inference</p>
        <h1>Interactive Movie Recommender</h1>
        <p>
          Rate movies, infer your genre taste locally, and get recommendations
          using ONNX predictions in the browser.
        </p>
      </header>

      <section className="panel demo-user-panel">
        <div>
          <h2>Demo User Profile</h2>
          <p>
            The model uses an existing MovieLens user profile as a base. Your own ratings
            add a local genre bonus for personalization.
          </p>
        </div>
        <form className="demo-user-form" onSubmit={applyDemoUserId}>
          <label>
            Demo User ID
            <input
              type="number"
              min="1"
              value={demoUserInput}
              onChange={(event) => setDemoUserInput(event.target.value)}
            />
          </label>
          <button type="submit">Apply</button>
        </form>
        {demoUserError ? <p className="error-text">{demoUserError}</p> : null}
        {!demoUserError ? (
          <p className="active-user-line">
            Active Demo User ID: <strong>{activeDemoUserId}</strong>
          </p>
        ) : null}
      </section>

      <ProgressBar current={ratedCount} target={MIN_RATINGS_REQUIRED} />

      <section className="panel">
        <div className="section-head">
          <h2>{ratedCount < MIN_RATINGS_REQUIRED ? "Start rating movies" : "Rate more movies"}</h2>
          <p>
            {query.trim() || selectedGenre
              ? "Search by title or filter by genre."
              : "Showing 5 top-rated movies globally to start (ratings hidden on purpose)."}
          </p>
        </div>

        <SearchBar
          query={query}
          onQueryChange={setQuery}
          selectedGenre={selectedGenre}
          onGenreChange={setSelectedGenre}
          genres={data.allGenres}
          resultCount={movieListToRate.length}
        />

        <div className="movie-grid">
          {movieListToRate.map((movie) => (
            <MovieCard
              key={movie.movie_id}
              movie={movie}
              ratingValue={Number(ratingsByMovieId[movie.movie_id] || 0)}
              onRate={handleRateMovie}
              showPredicted={false}
              showCommunity={false}
            />
          ))}
        </div>
      </section>

      <RecommendationsSection
        ratedCount={ratedCount}
        minRatings={MIN_RATINGS_REQUIRED}
        loading={recommendationLoading}
        error={recommendationError}
        latencyMs={recommendationState.latencyMs}
        candidateCount={recommendationState.candidateCount}
        preferredGenres={genrePreferences}
        overallRecommendations={recommendationState.overall}
        genreRecommendations={recommendationState.byGenre}
        ratingsByMovieId={ratingsByMovieId}
        onRate={handleRateMovie}
        statsByMovieId={data.statsByMovieId}
      />
    </main>
  );
}
