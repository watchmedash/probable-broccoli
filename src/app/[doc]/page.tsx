import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// The legal pages, inside the site's own layout. The text lives in src/legal (kept in step with the app's copies).
const DOCS = ["privacy", "terms", "rules", "child-safety", "delete-account"] as const;
type Doc = (typeof DOCS)[number];

export const dynamicParams = false;
export const generateStaticParams = () => DOCS.map(doc => ({ doc }));

function load(doc: string) {
  if (!DOCS.includes(doc as Doc)) return null;
  const html = fs.readFileSync(path.join(process.cwd(), "src/legal", `${doc}.html`), "utf8");
  const title = html.match(/<!-- (.*?) -->/)?.[1] ?? doc;
  return { title, html };
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const page = load((await params).doc);
  if (!page) return {};
  return { title: page.title, alternates: { canonical: `/${(await params).doc}` } };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const page = load((await params).doc);
  if (!page) notFound();
  return (
    <main className="page single">
      <article className="panel doc" dangerouslySetInnerHTML={{ __html: page.html }} />
    </main>
  );
}
