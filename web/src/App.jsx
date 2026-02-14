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
import { predictMoviesForUser } from "./lib/onnx-runtime";

const MIN_RATINGS_REQUIRED = 10;
const TOP_GENRES_FOR_SECTIONS = 3;
const BASE_USER_ID = 1;

const STORAGE_KEYS = {
  ratings: "movie_reco_ratings_v2",
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
  const [showRatedMovies, setShowRatedMovies] = useState(false);

  const [recommendationState, setRecommendationState] = useState({
    overall: [],
    byGenre: [],
    latencyMs: 0,
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

  const ratedCount = useMemo(
    () => Object.keys(ratingsByMovieId).length,
    [ratingsByMovieId]
  );

  const quickRatingMovies = useMemo(() => {
    if (!data) {
      return [];
    }
    return getTopRatedMovies({
      movies: data.movies,
      statsByMovieId: data.statsByMovieId,
      limit: 5,
    });
  }, [data]);

  const browseMovies = useMemo(() => {
    if (!data) {
      return [];
    }

    const hasFilter = query.trim() || selectedGenre;
    if (!hasFilter) {
      return searchMovies({
        movies: data.movies,
        statsByMovieId: data.statsByMovieId,
        query: "",
        genre: "",
        limit: 20,
      });
    }

    return searchMovies({
      movies: data.movies,
      statsByMovieId: data.statsByMovieId,
      query,
      genre: selectedGenre,
      limit: 20,
    });
  }, [data, query, selectedGenre]);

  const genrePreferences = useMemo(() => {
    if (!data) {
      return [];
    }
    return computeGenrePreferences({
      ratingsByMovieId,
      moviesById: data.moviesById,
    });
  }, [data, ratingsByMovieId]);

  const baseUserIdx = useMemo(() => {
    if (!data) {
      return null;
    }
    return getUserIdx(data.metadata, BASE_USER_ID);
  }, [data]);

  const ratedMovies = useMemo(() => {
    if (!data) {
      return [];
    }

    return Object.entries(ratingsByMovieId)
      .map(([movieId, rating]) => ({
        movie: data.moviesById.get(Number(movieId)),
        rating: Number(rating),
      }))
      .filter((item) => item.movie && Number.isFinite(item.rating))
      .sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return a.movie.title.localeCompare(b.movie.title);
      });
  }, [data, ratingsByMovieId]);

  useEffect(() => {
    if (!data || ratedCount < MIN_RATINGS_REQUIRED) {
      setRecommendationState({
        overall: [],
        byGenre: [],
        latencyMs: 0,
      });
      setRecommendationError("");
      setRecommendationLoading(false);
      return;
    }

    if (!Number.isFinite(baseUserIdx)) {
      setRecommendationError("Recommendations are temporarily unavailable.");
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
          userCacheKey: `base-user-${BASE_USER_ID}`,
          userIdx: baseUserIdx,
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
          });
        }
      } catch (error) {
        // Keep friendly UI text, but expose root cause in console for debugging.
        // eslint-disable-next-line no-console
        console.error("Recommendation refresh failed:", error);
        if (!cancelled) {
          setRecommendationError(
            "We could not refresh recommendations right now. Please try again."
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
    baseUserIdx,
    genrePreferences,
  ]);

  const handleRateMovie = (movieId, rating) => {
    setRatingsByMovieId((prev) => ({
      ...prev,
      [String(movieId)]: clampRating(rating),
    }));
  };

  const handleClearRatings = () => {
    const confirmed = window.confirm(
      "This will delete all your saved ratings. Continue?"
    );
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(STORAGE_KEYS.ratings);
    setRatingsByMovieId({});
    setShowRatedMovies(false);
    setRecommendationError("");
    setRecommendationState({
      overall: [],
      byGenre: [],
      latencyMs: 0,
    });
  };

  if (dataLoading) {
    return (
      <main className="app-shell loading-page">
        <p>Loading your movie experience...</p>
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="app-shell">
        <section className="panel center-panel">
          <h1>Find your next movie</h1>
          <p className="error-text">{dataError}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <div className="brand">Movie Picks</div>
        <div className="nav-actions">
          <div className="rating-pill">{ratedCount} rated</div>
          <button
            type="button"
            className="clear-data-btn"
            onClick={handleClearRatings}
            disabled={ratedCount === 0}
          >
            Clear ratings
          </button>
        </div>
      </nav>

      <header className="hero-card">
        <div>
          <h1>Find your next movie</h1>
          <p>Rate a few movies to personalize your recommendations.</p>
        </div>
        <ProgressBar current={ratedCount} target={MIN_RATINGS_REQUIRED} />
      </header>

      <section className="panel">
        <div className="section-head">
          <h2>Quick ratings</h2>
          <p>Start with a few popular movies.</p>
        </div>
        <div className="movie-grid">
          {quickRatingMovies.map((movie) => (
            <MovieCard
              key={`quick-${movie.movie_id}`}
              movie={movie}
              ratingValue={Number(ratingsByMovieId[movie.movie_id] || 0)}
              onRate={handleRateMovie}
              showMatch={false}
              showCommunity={false}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Browse movies</h2>
          <p>Search by title or pick a genre.</p>
        </div>
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          selectedGenre={selectedGenre}
          onGenreChange={setSelectedGenre}
          genres={data.allGenres}
          resultCount={browseMovies.length}
        />

        <div className="movie-grid">
          {browseMovies.map((movie) => (
            <MovieCard
              key={`browse-${movie.movie_id}`}
              movie={movie}
              ratingValue={Number(ratingsByMovieId[movie.movie_id] || 0)}
              onRate={handleRateMovie}
              showMatch={false}
              showCommunity
              communityStats={data.statsByMovieId.get(movie.movie_id) || null}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="rated-head">
          <h2>Rated movies</h2>
          <button
            type="button"
            className="toggle-btn"
            onClick={() => setShowRatedMovies((prev) => !prev)}
            disabled={!ratedMovies.length}
          >
            {showRatedMovies ? "Hide" : "Show"} ({ratedMovies.length})
          </button>
        </div>
        {!ratedMovies.length ? (
          <p className="empty-note">You have not rated any movies yet.</p>
        ) : null}
        {showRatedMovies && ratedMovies.length ? (
          <ul className="rated-list">
            {ratedMovies.map((item) => (
              <li key={`rated-${item.movie.movie_id}`} className="rated-item">
                <div>
                  <h3>{item.movie.title}</h3>
                  <p>{item.movie.genres.join(" | ") || "No genres listed"}</p>
                </div>
                <span>{item.rating.toFixed(1)}/5</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {ratedCount >= MIN_RATINGS_REQUIRED ? (
        <RecommendationsSection
          loading={recommendationLoading}
          error={recommendationError}
          latencyMs={recommendationState.latencyMs}
          preferredGenres={genrePreferences}
          overallRecommendations={recommendationState.overall}
          genreRecommendations={recommendationState.byGenre}
          ratingsByMovieId={ratingsByMovieId}
          onRate={handleRateMovie}
          statsByMovieId={data.statsByMovieId}
        />
      ) : null}
    </main>
  );
}
