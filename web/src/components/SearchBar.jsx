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
          <span>Search</span>
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by title..."
          />
        </label>

        <label className="input-block">
          <span>Genre</span>
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

      <p className="search-meta">Showing {resultCount} movies</p>
    </div>
  );
}
