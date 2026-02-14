export default function GenreChips({ preferences, limit = 8 }) {
  const visible = preferences.slice(0, limit);

  if (!visible.length) {
    return <p className="empty-note">Rate more movies to infer your preferred genres.</p>;
  }

  return (
    <div className="chip-row">
      {visible.map((item) => (
        <span className="genre-chip" key={item.genre}>
          {item.genre}
          <small>
            score {item.score.toFixed(2)} | n={item.count}
          </small>
        </span>
      ))}
    </div>
  );
}
