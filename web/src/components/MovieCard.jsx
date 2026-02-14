import { clampRating, formatCommunityLine } from "../lib/data";
import RatingStars from "./RatingStars";

export default function MovieCard({
  movie,
  ratingValue = 0,
  onRate,
  matchScore = null,
  showMatch = false,
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

        {showMatch && Number.isFinite(matchScore) ? (
          <p className="movie-match">
            Match: <strong>{clampRating(matchScore).toFixed(2)}/5</strong>
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
