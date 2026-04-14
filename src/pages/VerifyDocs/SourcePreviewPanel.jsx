export default function SourcePreviewPanel({ viewUrl, fileUrl }) {
  return (
    <div className="col-span-12 md:col-span-6 min-h-0 rounded-xl overflow-hidden tomo-surface flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-tomo-border flex items-center justify-between">
        <p className="text-sm font-medium text-tomo-text-h">Source document</p>
        {fileUrl && (
          <p className="text-xs text-tomo-text truncate max-w-[60%]">{fileUrl}</p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {viewUrl ? (
          <iframe title="pdf-viewer" src={viewUrl} className="w-full h-full" />
        ) : (
          <div className="h-full flex items-center justify-center text-tomo-text">
            Select a document…
          </div>
        )}
      </div>
    </div>
  )
}