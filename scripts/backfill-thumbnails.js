/**
 * Backfill Script - Generate Thumbnails for Existing Drawings
 *
 * This script:
 * 1. Finds all drawings in the database without thumbnails
 * 2. Downloads each file from Supabase Storage
 * 3. Generates a thumbnail (400px wide JPEG)
 * 4. Uploads the thumbnail to Supabase Storage
 * 5. Updates the database with the thumbnail URL
 *
 * Usage:
 *   npm run backfill-thumbnails
 *
 * Or run directly:
 *   node scripts/backfill-thumbnails.js
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env file
dotenv.config()
import sharp from 'sharp'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from 'canvas'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

// Set up PDF.js worker for Node.js - use legacy build
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
// Convert Windows path to file:// URL
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY // Service role key for admin access

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing environment variables')
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Generate thumbnail from PDF file buffer
 */
async function generatePDFThumbnail(fileBuffer) {
  console.log('  📄 Generating PDF thumbnail...')

  // Convert Buffer to Uint8Array for pdf.js
  const uint8Array = new Uint8Array(fileBuffer)
  const loadingTask = pdfjs.getDocument({ data: uint8Array })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)

  const viewport = page.getViewport({ scale: 1.5 })
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise

  // Convert canvas to buffer and resize with Sharp
  const pngBuffer = canvas.toBuffer('image/png')
  const thumbnailBuffer = await sharp(pngBuffer)
    .resize(400, null, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toBuffer()

  return thumbnailBuffer
}

/**
 * Generate thumbnail from image file buffer
 */
async function generateImageThumbnail(fileBuffer) {
  console.log('  🖼️ Generating image thumbnail...')

  const thumbnailBuffer = await sharp(fileBuffer)
    .resize(400, null, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toBuffer()

  return thumbnailBuffer
}

/**
 * Process a single drawing
 */
async function processDrawing(drawing) {
  console.log(`\n📋 Processing: ${drawing.file_name} (ID: ${drawing.id})`)

  try {
    // Download file from Supabase Storage
    console.log('  ⬇️ Downloading file...')
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('drawings')
      .download(drawing.file_url)

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`)
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Generate thumbnail based on file type
    let thumbnailBuffer
    const fileType = drawing.file_type?.toLowerCase() || ''
    const fileName = drawing.file_name?.toLowerCase() || ''

    if (fileType === 'pdf' || fileName.endsWith('.pdf')) {
      thumbnailBuffer = await generatePDFThumbnail(fileBuffer)
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType) ||
               fileName.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
      thumbnailBuffer = await generateImageThumbnail(fileBuffer)
    } else {
      console.log(`  ⏭️ Skipping: Unsupported file type (${fileType})`)
      return { success: false, reason: 'unsupported' }
    }

    // Upload thumbnail to Supabase Storage
    const thumbnailFileName = `thumbnails/${Date.now()}-${drawing.file_name.replace(/\.[^/.]+$/, '')}.jpg`
    console.log(`  📤 Uploading thumbnail: ${thumbnailFileName}`)

    const { error: uploadError } = await supabase.storage
      .from('drawings')
      .upload(thumbnailFileName, thumbnailBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Update database with thumbnail URL
    console.log('  💾 Updating database...')
    const { error: updateError } = await supabase
      .from('drawings')
      .update({ thumbnail_url: thumbnailFileName })
      .eq('id', drawing.id)

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    console.log('  ✅ Success!')
    return { success: true }

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting thumbnail backfill process...\n')

  // Find all drawings without thumbnails
  console.log('🔍 Finding drawings without thumbnails...')
  const { data: drawings, error } = await supabase
    .from('drawings')
    .select('*')
    .is('thumbnail_url', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Database query failed:', error.message)
    process.exit(1)
  }

  if (!drawings || drawings.length === 0) {
    console.log('✨ All drawings already have thumbnails!')
    return
  }

  console.log(`📊 Found ${drawings.length} drawings without thumbnails\n`)
  console.log('═'.repeat(60))

  // Process each drawing
  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  }

  for (let i = 0; i < drawings.length; i++) {
    const drawing = drawings[i]
    console.log(`\n[${i + 1}/${drawings.length}]`)

    const result = await processDrawing(drawing)

    if (result.success) {
      results.success++
    } else if (result.reason === 'unsupported') {
      results.skipped++
    } else {
      results.failed++
    }

    // Small delay to avoid rate limiting
    if (i < drawings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('\n📈 Summary:')
  console.log(`  ✅ Successful: ${results.success}`)
  console.log(`  ⏭️ Skipped: ${results.skipped}`)
  console.log(`  ❌ Failed: ${results.failed}`)
  console.log(`\n🎉 Backfill complete!\n`)
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
