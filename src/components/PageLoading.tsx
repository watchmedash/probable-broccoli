/** Shows at once when you follow a link, while the next page is fetched. */
export function PageLoading() {
  return (
    <main className="page single" aria-busy="true" aria-label="Loading">
      <div className="feed">
        {[0, 1, 2].map(i => (
          <div key={i} className="card skeleton">
            <span style={{ width: "30%" }} />
            <span style={{ width: "80%", height: 18 }} />
            <span style={{ width: "100%" }} />
            <span style={{ width: "60%" }} />
          </div>
        ))}
      </div>
    </main>
  );
}
