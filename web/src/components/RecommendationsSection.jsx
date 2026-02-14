import { useEffect, useMemo, useState } from "react";
import GenreChips from "./GenreChips";
import MovieCard from "./MovieCard";

const SECTION_COLORS = {
  forYou: "#2563eb",
  fresh: "#0f766e",
};
const RECOMMENDATION_PAGE_SIZE = 4;

const GENRE_COLORS = [
  "#7c3aed",
  "#0f766e",
  "#0369a1",
  "#be185d",
  "#b45309",
  "#166534",
  "#1d4ed8",
  "#9f1239",
];

function getGenreAccent(genre) {
  if (!genre) {
    return "#4b5563";
  }

  let hash = 0;
  for (let i = 0; i < genre.length; i += 1) {
    hash = (hash * 31 + genre.charCodeAt(i)) >>> 0;
  }
  return GENRE_COLORS[hash % GENRE_COLORS.length];
}

function RecommendationGroup({
  sectionKey,
  title,
  pillLabel,
  accentColor,
  items,
  emptyText,
  ratingsByMovieId,
  onRate,
  statsByMovieId,
}) {
  const [page, setPage] = useState(0);
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(items.length / RECOMMENDATION_PAGE_SIZE)),
    [items]
  );

  useEffect(() => {
    setPage(0);
  }, [sectionKey, items]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, pageCount - 1));
  }, [pageCount]);

  const visibleItems = useMemo(() => {
    const start = page * RECOMMENDATION_PAGE_SIZE;
    return items.slice(start, start + RECOMMENDATION_PAGE_SIZE);
  }, [items, page]);

  return (
    <div className="recommendation-group" style={{ "--section-accent": accentColor }}>
      <div className="recommendation-group-head">
        <h3>{title}</h3>
        <span className="section-pill">
          <span className="section-pill-dot" />
          {pillLabel}
        </span>
      </div>

      <div className="movie-grid">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <MovieCard
              key={item.movie.movie_id}
              movie={item.movie}
              ratingValue={Number(ratingsByMovieId[item.movie.movie_id] || 0)}
              onRate={onRate}
              matchScore={item.predictedRating}
              matchLabel={item.matchLabel}
              showMatch
              showCommunity
              communityStats={statsByMovieId.get(item.movie.movie_id) || null}
            />
          ))
        ) : (
          <p className="empty-note">{emptyText}</p>
        )}
      </div>
      {items.length > RECOMMENDATION_PAGE_SIZE ? (
        <div className="section-pagination">
          <span className="page-indicator">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="arrow-btn"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page <= 0}
            aria-label={`Previous page for ${title}`}
          >
            &#8592;
          </button>
          <button
            type="button"
            className="arrow-btn"
            onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
            disabled={page >= pageCount - 1}
            aria-label={`Next page for ${title}`}
          >
            &#8594;
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function RecommendationsSection({
  loading,
  error,
  latencyMs,
  preferredGenres,
  overallRecommendations,
  freshRecommendations,
  genreRecommendations,
  ratingsByMovieId,
  onRate,
  statsByMovieId,
}) {
  return (
    <section className="recommendations-block">
      <div className="section-head">
        <h2>Recommendations</h2>
        <p>Fresh picks based on what you rate.</p>
      </div>

      <div className="pref-block">
        <h3>Your favorite genres</h3>
        <GenreChips preferences={preferredGenres} />
      </div>

      {loading ? (
        <div className="loading-card">
          <div className="spinner" />
          <p>Updating recommendations...</p>
        </div>
      ) : null}

      {!loading && error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <>
          <p className="latency-line">Updated in {(latencyMs / 1000).toFixed(2)}s</p>

          <RecommendationGroup
            sectionKey="for-you"
            title="For you"
            pillLabel="For you"
            accentColor={SECTION_COLORS.forYou}
            items={overallRecommendations}
            emptyText="No recommendations available yet."
            ratingsByMovieId={ratingsByMovieId}
            onRate={onRate}
            statsByMovieId={statsByMovieId}
          />

          <RecommendationGroup
            sectionKey="fresh-picks"
            title="Fresh picks"
            pillLabel="Fresh"
            accentColor={SECTION_COLORS.fresh}
            items={freshRecommendations}
            emptyText="No fresh picks available yet."
            ratingsByMovieId={ratingsByMovieId}
            onRate={onRate}
            statsByMovieId={statsByMovieId}
          />

          {genreRecommendations.map((group) => (
            <RecommendationGroup
              key={group.genre}
              sectionKey={`genre-${group.genre}`}
              title={`Because you like ${group.genre}`}
              pillLabel={group.genre}
              accentColor={getGenreAccent(group.genre)}
              items={group.items}
              emptyText="No movies found for this genre yet."
              ratingsByMovieId={ratingsByMovieId}
              onRate={onRate}
              statsByMovieId={statsByMovieId}
            />
          ))}
        </>
      ) : null}
    </section>
  );
}
