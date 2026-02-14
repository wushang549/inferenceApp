import GenreChips from "./GenreChips";
import MovieCard from "./MovieCard";

export default function RecommendationsSection({
  loading,
  error,
  latencyMs,
  preferredGenres,
  overallRecommendations,
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

          <div className="recommendation-group">
            <h3>For you</h3>
            <div className="movie-grid">
              {overallRecommendations.length ? (
                overallRecommendations.map((item) => (
                  <MovieCard
                    key={item.movie.movie_id}
                    movie={item.movie}
                    ratingValue={Number(ratingsByMovieId[item.movie.movie_id] || 0)}
                    onRate={onRate}
                    matchScore={item.predictedRating}
                    showMatch
                    showCommunity
                    communityStats={statsByMovieId.get(item.movie.movie_id) || null}
                  />
                ))
              ) : (
                <p className="empty-note">No recommendations available yet.</p>
              )}
            </div>
          </div>

          {genreRecommendations.map((group) => (
            <div className="recommendation-group" key={group.genre}>
              <h3>Because you like {group.genre}</h3>
              <div className="movie-grid">
                {group.items.length ? (
                  group.items.map((item) => (
                    <MovieCard
                      key={`${group.genre}-${item.movie.movie_id}`}
                      movie={item.movie}
                      ratingValue={Number(ratingsByMovieId[item.movie.movie_id] || 0)}
                      onRate={onRate}
                      matchScore={item.predictedRating}
                      showMatch
                      showCommunity
                      communityStats={statsByMovieId.get(item.movie.movie_id) || null}
                    />
                  ))
                ) : (
                  <p className="empty-note">No movies found for this genre yet.</p>
                )}
              </div>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
}
