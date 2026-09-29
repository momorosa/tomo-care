export default function SourcePreviewPanel({ viewUrl, fileUrl, document, demoMode = false }) {
  const preloaded = demoMode && document?.text_extracted?.weight_measurement?.extraction_method === "synthetic_fixture"
  const fileName = fileUrl ? fileUrl.split("/").pop() : null

  return (
    <div className="tomo-source-panel col-span-12 md:col-span-6 min-h-0 rounded-xl overflow-hidden tomo-surface flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-tomo-border flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-tomo-text-h">Source document</p>
        {viewUrl && <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          className="tomo-btn tomo-btn-secondary shrink-0 text-xs">Open PDF<span className="sr-only"> in a new tab</span></a>}
        {fileName && (
          <p className="text-xs font-mono text-tomo-text truncate max-w-[60%]">
            {fileName}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {viewUrl ? (
          <iframe title="pdf-viewer" src={viewUrl} className="w-full h-full" />
        ) : (
          <div className="h-full flex items-center justify-center text-tomo-text">
            {preloaded ? <div className="p-6 space-y-3 max-w-md" role="note">
              <h2 className="text-lg font-semibold text-tomo-text-h">Preloaded demo history</h2>
              <p>This fictional visit was seeded to demonstrate spending and weight history. It was not extracted from a PDF or verified during this session.</p>
              <p>The recorded visit details are shown in the read-only panel. No PDF is attached by design.</p>
            </div> : document ? "No PDF is attached to this record." : "Select a document…"}
          </div>
        )}
      </div>
    </div>
  )
}