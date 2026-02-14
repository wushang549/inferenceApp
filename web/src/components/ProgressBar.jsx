export default function ProgressBar({ current, target }) {
  const ratio = target > 0 ? Math.min(1, current / target) : 0;
  const pct = Math.round(ratio * 100);

  return (
    <section className="progress-card">
      <div className="progress-head">
        <h2>Rating Progress</h2>
        <p>
          Rated <strong>{current}</strong> / {target}
        </p>
      </div>
      <div className="progress-track" aria-label={`Rated ${current} of ${target}`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-hint">
        {current < target
          ? `Rate ${target - current} more movies to unlock recommendations.`
          : "Recommendations unlocked. Keep rating more movies to refine results."}
      </p>
    </section>
  );
}
