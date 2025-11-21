import { pdfjs } from 'react-pdf'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set up PDF.js worker - use bundled worker instead of CDN (React 19 + pdf.js v5 blocks CDN)
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/**
 * Generate a thumbnail from a PDF file
 * @param {File} file - The PDF file
 * @returns {Promise<Blob>} - Thumbnail as a Blob
 */
export async function generatePDFThumbnail(file) {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Load PDF document
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    // Get first page
    const page = await pdf.getPage(1)

    // Set canvas size for thumbnail (width: 400px)
    const viewport = page.getViewport({ scale: 1 })
    const scale = 400 / viewport.width
    const scaledViewport = page.getViewport({ scale })

    // Create canvas
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise

    // Convert canvas to Blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/jpeg', 0.8)
    })
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error)
    throw error
  }
}

/**
 * Generate a thumbnail from an image file
 * @param {File} file - The image file
 * @returns {Promise<Blob>} - Thumbnail as a Blob
 */
export async function generateImageThumbnail(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        // Create canvas for thumbnail (max width: 400px)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const maxWidth = 400
        const scale = Math.min(1, maxWidth / img.width)

        canvas.width = img.width * scale
        canvas.height = img.height * scale

        // Draw resized image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Convert to Blob
        canvas.toBlob((blob) => {
          resolve(blob)
        }, 'image/jpeg', 0.8)
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Generate thumbnail based on file type
 * @param {File} file - The file to generate thumbnail for
 * @returns {Promise<Blob>} - Thumbnail as a Blob
 */
export async function generateThumbnail(file) {
  const fileType = file.type.toLowerCase()

  if (fileType === 'application/pdf') {
    return generatePDFThumbnail(file)
  } else if (fileType.startsWith('image/')) {
    return generateImageThumbnail(file)
  } else {
    throw new Error(`Unsupported file type for thumbnail: ${fileType}`)
  }
}
