import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page single">
      <div className="panel empty">
        <h1 style={{ color: "var(--ink)", fontSize: 22, margin: "0 0 8px" }}>Nothing here</h1>
        <p style={{ margin: "0 0 16px" }}>It may have been deleted, or the link is wrong.</p>
        <Link href="/" className="btn">Go to Nakodu</Link>
      </div>
    </main>
  );
}
