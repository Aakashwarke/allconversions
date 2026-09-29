import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy",
  description: `${BRAND.name} converts files entirely inside your browser. Your documents are never uploaded, stored or seen by us.`,
};

const SECTIONS = [
  {
    h: "Your files are never uploaded",
    p: [
      `Every conversion on ${BRAND.name} runs inside your browser tab using WebAssembly and the browser's own codecs. Your file is read from disk by the page, processed in memory, and written back out as a download.`,
      "At no point does the file, or any part of it, travel to a server we control. You can confirm this yourself: open your browser's developer tools, switch to the Network tab, and convert a file. You will see no upload request.",
    ],
  },
  {
    h: "What this means in practice",
    p: [
      "We cannot read your documents, because we never receive them. We cannot leak them in a breach, because we never store them. We cannot hand them to anyone, because we do not have them.",
      "Closing the tab discards everything. There is no history, no recovery and no retention period, because there is nothing to retain.",
    ],
  },
  {
    h: "What we do collect",
    p: [
      "Standard, aggregate web analytics: which pages are visited, roughly where visitors come from, and which conversions are most used. This is used to decide what to build next. It contains no file names and no file contents.",
      "The free tier shows advertising. Ad providers set their own cookies under their own policies, and those are disclosed in the consent banner shown on first visit.",
    ],
  },
  {
    h: "One exception, clearly marked",
    p: [
      "Audio and video conversion downloads a one-time ~32MB FFmpeg engine from a public CDN. That request fetches program code to your device. Your media file itself still never leaves the browser.",
    ],
  },
  {
    h: "Downloaded file names",
    p: [
      `Converted files are named ${BRAND.filePrefix}${BRAND.fileSeparator}yourfilename.ext. This is applied locally as the download is created. It is a naming convention, not a watermark: the file contents are unmodified and you are free to rename the file.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-4xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-4 text-lg text-muted">
        The short version: we do not have your files, and we could not get them
        if we wanted to.
      </p>

      <div className="mt-10 space-y-9">
        {SECTIONS.map((section) => (
          <section key={section.h}>
            <h2 className="text-xl font-semibold tracking-tight">{section.h}</h2>
            {section.p.map((text, i) => (
              <p key={i} className="mt-3 text-muted">{text}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
