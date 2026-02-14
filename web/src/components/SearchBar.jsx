export default function SearchBar({
  query,
  onQueryChange,
  selectedGenre,
  onGenreChange,
  genres,
  resultCount,
}) {
  return (
    <div className="search-shell">
      <div className="search-row">
        <label className="input-block">
          <span>Search by title</span>
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Type a movie title..."
          />
        </label>

        <label className="input-block">
          <span>Filter by genre</span>
          <select
            value={selectedGenre}
            onChange={(event) => onGenreChange(event.target.value)}
          >
            <option value="">All genres</option>
            {genres.map((genre) => (
              <option value={genre} key={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="search-meta">{resultCount} movies shown</p>
    </div>
  );
}
