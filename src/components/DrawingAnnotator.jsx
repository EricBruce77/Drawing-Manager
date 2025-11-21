import { useRef, useState, useEffect } from 'react'
import { ReactSketchCanvas } from 'react-sketch-canvas'

export default function DrawingAnnotator({ fileUrl, fileType, onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [strokeColor, setStrokeColor] = useState('#FF0000') // Default red
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [backgroundImage, setBackgroundImage] = useState(null)

  useEffect(() => {
    // For images, use the URL directly
    if (['png', 'jpg', 'jpeg'].includes(fileType?.toLowerCase())) {
      setBackgroundImage(fileUrl)
    }
    // For PDFs, we'll need to convert to image (handled in parent component)
    else if (fileType?.toLowerCase() === 'pdf') {
      setBackgroundImage(fileUrl)
    }
  }, [fileUrl, fileType])

  const handleSave = async () => {
    if (!canvasRef.current) return

    try {
      // Export the annotated image
      const annotatedImage = await canvasRef.current.exportImage('png')

      // Convert data URL to blob
      const response = await fetch(annotatedImage)
      const blob = await response.blob()

      // Call the parent's save handler with the blob
      onSave(blob)
    } catch (error) {
      console.error('Error exporting annotation:', error)
      alert('Error saving annotations: ' + error.message)
    }
  }

  const handleUndo = () => {
    canvasRef.current?.undo()
  }

  const handleRedo = () => {
    canvasRef.current?.redo()
  }

  const handleClear = () => {
    if (window.confirm('Clear all annotations?')) {
      canvasRef.current?.clearCanvas()
    }
  }

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF']

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-slate-800 p-4 rounded-lg mb-4 flex flex-wrap gap-4 items-center">
        {/* Color Picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">Color:</label>
          <div className="flex gap-1">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={`w-8 h-8 rounded border-2 ${
                  strokeColor === color ? 'border-white' : 'border-slate-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">Size:</label>
          <input
            type="range"
            min="1"
            max="10"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-slate-300 w-8">{strokeWidth}px</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleUndo}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
            title="Undo"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
            title="Redo"
          >
            ↷ Redo
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-slate-900 rounded-lg overflow-hidden">
        {backgroundImage ? (
          <ReactSketchCanvas
            ref={canvasRef}
            style={{
              border: '1px solid #475569',
              borderRadius: '0.5rem',
            }}
            width="100%"
            height="600px"
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            backgroundImage={backgroundImage}
            preserveBackgroundImageAspectRatio="xMidYMid meet"
            exportWithBackgroundImage={true}
            canvasColor="transparent"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Loading drawing...</p>
          </div>
        )}
      </div>

      {/* Save/Cancel Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          Save Annotations
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
