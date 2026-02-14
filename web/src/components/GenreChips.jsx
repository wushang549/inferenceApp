export default function GenreChips({ preferences, limit = 8 }) {
  const visible = preferences
    .filter((item) => item.score > 0)
    .slice(0, limit);

  if (!visible.length) {
    return <p className="empty-note">Rate a few more movies to reveal your favorite genres.</p>;
  }

  return (
    <div className="chip-row">
      {visible.map((item) => (
        <span className="genre-chip" key={item.genre}>{item.genre}</span>
      ))}
    </div>
  );
}
