import { clampRating, formatCommunityLine } from "../lib/data";
import RatingStars from "./RatingStars";

export default function MovieCard({
  movie,
  ratingValue = 0,
  onRate,
  predictedRating = null,
  showPredicted = false,
  showCommunity = false,
  communityStats = null,
}) {
  const genresLine = movie.genres.length
    ? movie.genres.join(" | ")
    : "No genres listed";

  return (
    <article className="movie-card">
      <div className="movie-main">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-genres">{genresLine}</p>

        {showPredicted && Number.isFinite(predictedRating) ? (
          <p className="movie-prediction">
            Predicted rating: <strong>{clampRating(predictedRating).toFixed(2)}</strong>
          </p>
        ) : null}

        {showCommunity && communityStats ? (
          <p className="movie-community">{formatCommunityLine(communityStats)}</p>
        ) : null}
      </div>

      <RatingStars value={ratingValue} onChange={(value) => onRate(movie.movie_id, value)} />
    </article>
  );
}
