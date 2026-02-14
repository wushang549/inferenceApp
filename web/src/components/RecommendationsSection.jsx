import GenreChips from "./GenreChips";
import MovieCard from "./MovieCard";

export default function RecommendationsSection({
  ratedCount,
  minRatings,
  loading,
  error,
  latencyMs,
  candidateCount,
  preferredGenres,
  overallRecommendations,
  genreRecommendations,
  ratingsByMovieId,
  onRate,
  statsByMovieId,
}) {
  const unlocked = ratedCount >= minRatings;

  return (
    <section className="recommendations-block">
      <div className="section-head">
        <h2>Recommendations</h2>
        <p>
          Demo mode: recommendations use a fixed MovieLens user profile plus your local
          genre preferences.
        </p>
      </div>

      {!unlocked ? (
        <p className="empty-note">
          Rate at least {minRatings} movies to generate recommendations.
        </p>
      ) : null}

      {unlocked ? (
        <>
          <div className="pref-block">
            <h3>Your preferred genres</h3>
            <GenreChips preferences={preferredGenres} />
          </div>

          {loading ? (
            <div className="loading-card">
              <div className="spinner" />
              <p>Generating recommendations...</p>
            </div>
          ) : null}

          {!loading && error ? <p className="error-text">{error}</p> : null}

          {!loading && !error ? (
            <>
              <p className="latency-line">
                Generated in {latencyMs.toFixed(1)} ms from {candidateCount} candidates.
              </p>

              <div className="recommendation-group">
                <h3>Top 5 recommended for you</h3>
                <div className="movie-grid">
                  {overallRecommendations.length ? (
                    overallRecommendations.map((item) => (
                      <MovieCard
                        key={item.movie.movie_id}
                        movie={item.movie}
                        ratingValue={Number(ratingsByMovieId[item.movie.movie_id] || 0)}
                        onRate={onRate}
                        predictedRating={item.predictedRating}
                        showPredicted
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
                  <h3>Top 5 by genre: {group.genre}</h3>
                  <div className="movie-grid">
                    {group.items.length ? (
                      group.items.map((item) => (
                        <MovieCard
                          key={`${group.genre}-${item.movie.movie_id}`}
                          movie={item.movie}
                          ratingValue={Number(ratingsByMovieId[item.movie.movie_id] || 0)}
                          onRate={onRate}
                          predictedRating={item.predictedRating}
                          showPredicted
                          showCommunity
                          communityStats={statsByMovieId.get(item.movie.movie_id) || null}
                        />
                      ))
                    ) : (
                      <p className="empty-note">No movies found for this genre.</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
