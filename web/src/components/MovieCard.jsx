import { clampToRating } from "../lib/scoring";
import RatingStars from "./RatingStars";

function getConfidenceLabel(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  if (n >= 200) {
    return { text: "Confidence: High", tone: "high" };
  }
  if (n >= 50) {
    return { text: "Confidence: Medium", tone: "medium" };
  }
  return { text: "Confidence: Low", tone: "low" };
}

export default function MovieCard({
  movie,
  ratingValue = 0,
  onRate,
  matchScore = null,
  matchLabel = "",
  showMatch = false,
  showCommunity = false,
  communityStats = null,
}) {
  const genresLine = movie.genres.length
    ? movie.genres.join(" | ")
    : "No genres listed";
  const communityCount = Number(communityStats?.num_ratings);
  const communityAvg = Number(communityStats?.avg_rating);
  const confidence = getConfidenceLabel(communityCount);

  return (
    <article className="movie-card">
      <div className="movie-main">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-genres">{genresLine}</p>

        {showMatch && Number.isFinite(matchScore) ? (
          <p className="movie-match">
            Match: <strong>{clampToRating(matchScore).toFixed(1)}/5</strong>
            {matchLabel ? <span className="movie-match-label">{matchLabel}</span> : null}
          </p>
        ) : null}

        {showCommunity && Number.isFinite(communityAvg) && communityCount > 0 ? (
          <div className="movie-community-block">
            <p className="movie-community">
              Community avg {communityAvg.toFixed(2)} (n={communityCount})
            </p>
            {confidence ? (
              <span className={`confidence-chip ${confidence.tone}`}>
                {confidence.text}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <RatingStars value={ratingValue} onChange={(value) => onRate(movie.movie_id, value)} />
    </article>
  );
}
