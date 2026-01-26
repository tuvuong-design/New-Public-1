export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200/70 bg-white">
      <div className="container py-8">
        <div className="row justify-between">
          <div className="small muted">
            © {new Date().getFullYear()} VideoShare — Next.js + Prisma + R2
          </div>
          <div className="row">
            <a className="btn btn-ghost px-3 py-2" href="/sitemap.xml">
              Sitemap
            </a>
            <a className="btn btn-ghost px-3 py-2" href="/robots.txt">
              Robots
            </a>
            <a className="btn btn-ghost px-3 py-2" href="/llms.txt">
              LLMs
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
