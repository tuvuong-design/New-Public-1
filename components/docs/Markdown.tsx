import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  source: string;
};

export default function Markdown({ source }: Props) {
  return (
    <article className="prose prose-zinc max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 {...props} className="scroll-mt-20 text-3xl font-semibold tracking-tight" />
          ),
          h2: (props) => (
            <h2 {...props} className="scroll-mt-20 text-2xl font-semibold tracking-tight" />
          ),
          h3: (props) => (
            <h3 {...props} className="scroll-mt-20 text-xl font-semibold tracking-tight" />
          ),
          code: ({ className, ...props }) => (
            <code
              {...props}
              className={
                className ||
                "rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.95em] text-zinc-900"
              }
            />
          ),
          pre: ({ ...props }) => (
            <pre
              {...props}
              className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-zinc-50"
            />
          ),
          a: ({ href, ...props }) => (
            <a
              {...props}
              href={href}
              className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700"
            />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
