"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** User-written markdown (custom cards). Raw HTML is not rendered. Loaded lazily. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="srd-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
