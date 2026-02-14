function StarIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`star-icon ${filled ? "filled" : ""}`}
    >
      <path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.4l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.5z" />
    </svg>
  );
}

export default function RatingStars({
  value = 0,
  onChange,
  disabled = false,
  className = "",
}) {
  return (
    <div className={`rating-stars ${className}`.trim()} role="group">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={`star-btn ${star <= value ? "active" : ""}`}
          onClick={() => onChange?.(star)}
          disabled={disabled}
          aria-label={`Rate ${star} out of 5`}
          title={`${star} / 5`}
        >
          <StarIcon filled={star <= value} />
        </button>
      ))}
      <span className="rating-label">{value ? `${value}/5` : "Not rated"}</span>
    </div>
  );
}
