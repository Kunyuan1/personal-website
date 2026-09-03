import { site } from "@/data/site";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-faint">
            © {new Date().getFullYear()} {site.name}
          </p>

          {/* 不要回答 — the warning sent back across four light years. */}
          <p
            className="font-mono text-xs text-faint/70"
            title="Do not answer. Do not answer. Do not answer."
          >
            <span className="cjk">不要回答</span>
            <span className="mx-2 text-line-bright">·</span>
            Do not answer
          </p>
        </div>
      </div>
    </footer>
  );
}
