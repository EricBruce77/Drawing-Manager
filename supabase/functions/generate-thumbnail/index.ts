import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts'

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration
const THUMBNAIL_WIDTH = 400
const JPEG_QUALITY = 80

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { bucketPath, drawingId } = await req.json()

    if (!bucketPath || !drawingId) {
      throw new Error('Missing required parameters: bucketPath and drawingId')
    }

    console.log(`Generating thumbnail for: ${bucketPath}`)

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download the original file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('drawings')
      .download(bucketPath)

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    // Get file extension
    const fileExt = bucketPath.split('.').pop()?.toLowerCase()

    // Determine file type
    const isPdf = fileExt === 'pdf'
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExt || '')

    if (!isPdf && !isImage) {
      throw new Error(`Unsupported file type: ${fileExt}`)
    }

    let thumbnailBlob: Blob

    if (isPdf) {
      // For PDFs, we need to convert first page to an image
      // For production, you'll need to use an external service or pdf-to-image API
      // Options:
      // 1. Use Cloudinary API
      // 2. Use pdf2pic with Docker container
      // 3. Use external PDF rendering service

      // For now, we'll create a placeholder thumbnail or skip PDF processing
      // You can integrate with a service like https://api.pdf.co or similar

      console.warn(`PDF thumbnail generation not implemented for: ${bucketPath}`)
      console.warn(`Consider using an external PDF rendering service`)

      // Return error for PDF processing (n8n can handle this gracefully)
      throw new Error('PDF thumbnail generation requires external service - please configure PDF renderer')

    } else {
      // For images, resize using imagescript
      const imageBuffer = await fileData.arrayBuffer()

      // Decode image
      const image = await Image.decode(new Uint8Array(imageBuffer))

      // Calculate target height (maintain aspect ratio)
      const aspectRatio = image.height / image.width
      const targetHeight = Math.round(THUMBNAIL_WIDTH * aspectRatio)

      // Resize image
      const resized = image.resize(THUMBNAIL_WIDTH, targetHeight)

      // Encode as JPEG
      const encoded = await resized.encodeJPEG(JPEG_QUALITY)

      thumbnailBlob = new Blob([encoded], { type: 'image/jpeg' })
    }

    // Upload thumbnail to Supabase Storage
    const thumbnailPath = `thumbnails/${drawingId}.jpg`

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('drawings')
      .upload(thumbnailPath, thumbnailBlob, {
        contentType: 'image/jpeg',
        upsert: true // Overwrite if exists
      })

    if (uploadError) {
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
    }

    // Get public URL for the thumbnail
    const { data: { publicUrl } } = supabase
      .storage
      .from('drawings')
      .getPublicUrl(thumbnailPath)

    // Update the drawings table with thumbnail_url
    const { error: updateError } = await supabase
      .from('drawings')
      .update({ thumbnail_url: publicUrl })
      .eq('id', drawingId)

    if (updateError) {
      throw new Error(`Failed to update drawing record: ${updateError.message}`)
    }

    console.log(`Thumbnail generated successfully: ${thumbnailPath}`)

    return new Response(
      JSON.stringify({
        success: true,
        thumbnailPath,
        thumbnailUrl: publicUrl,
        drawingId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
