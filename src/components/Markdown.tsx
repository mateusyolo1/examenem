import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
};

/**
 * Rich markdown renderer for assistant messages and AI-generated content.
 * Supports: headings (H1-H6), bold, italic, strikethrough, inline code,
 * code blocks, blockquotes, lists (incl. task lists), tables, links, hr.
 * Subscript/superscript via raw <sub>/<sup> are NOT enabled to keep content safe.
 */
export function Markdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        "prose-tutor max-w-none text-sm leading-relaxed text-foreground",
        "[&_*]:min-w-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...p }) => (
            <h1 className="text-2xl font-extrabold tracking-tight mt-4 mb-3 first:mt-0" {...p} />
          ),
          h2: ({ node, ...p }) => (
            <h2 className="text-xl font-bold tracking-tight mt-4 mb-2 first:mt-0" {...p} />
          ),
          h3: ({ node, ...p }) => (
            <h3 className="text-lg font-bold mt-3 mb-2 first:mt-0" {...p} />
          ),
          h4: ({ node, ...p }) => (
            <h4 className="text-base font-semibold mt-3 mb-1.5 first:mt-0" {...p} />
          ),
          h5: ({ node, ...p }) => (
            <h5 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-3 mb-1 first:mt-0" {...p} />
          ),
          h6: ({ node, ...p }) => (
            <h6 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-3 mb-1 first:mt-0" {...p} />
          ),
          p: ({ node, ...p }) => <p className="my-2 first:mt-0 last:mb-0" {...p} />,
          strong: ({ node, ...p }) => <strong className="font-bold text-foreground" {...p} />,
          em: ({ node, ...p }) => <em className="italic" {...p} />,
          del: ({ node, ...p }) => <del className="line-through opacity-70" {...p} />,
          a: ({ node, ...p }) => (
            <a
              className="text-primary underline underline-offset-2 hover:no-underline"
              target="_blank"
              rel="noreferrer"
              {...p}
            />
          ),
          ul: ({ node, ...p }) => <ul className="list-disc pl-5 my-2 space-y-1" {...p} />,
          ol: ({ node, ...p }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...p} />,
          li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
          blockquote: ({ node, ...p }) => (
            <blockquote
              className="border-l-4 border-primary/60 bg-muted/40 pl-4 pr-3 py-2 my-3 italic text-muted-foreground rounded-r"
              {...p}
            />
          ),
          hr: () => <hr className="my-4 border-border" />,
          code: ({ node, className, children, ...p }) => {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <code
                  className="block bg-muted text-foreground rounded-md p-3 font-mono text-xs overflow-x-auto"
                  {...p}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded font-mono text-[0.85em]"
                {...p}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, ...p }) => (
            <pre className="my-3 overflow-x-auto rounded-md bg-muted" {...p} />
          ),
          table: ({ node, ...p }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: ({ node, ...p }) => (
            <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold" {...p} />
          ),
          td: ({ node, ...p }) => (
            <td className="border border-border px-3 py-1.5 align-top" {...p} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
