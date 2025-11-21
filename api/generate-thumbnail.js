// Vercel serverless function for generating PDF/image thumbnails
// Uses Puppeteer for PDF rendering (works in serverless environment)

import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let browser = null

  try {
    const { fileUrl, fileType } = req.body

    if (!fileUrl || !fileType) {
      return res.status(400).json({ error: 'Missing fileUrl or fileType' })
    }

    console.log('Generating thumbnail for:', fileUrl, 'Type:', fileType)

    let thumbnailBuffer

    if (fileType === 'pdf' || fileType === 'application/pdf' || fileType.toLowerCase() === 'pdf') {
      // Generate PDF thumbnail using Puppeteer
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      })

      const page = await browser.newPage()
      await page.goto(fileUrl, { waitUntil: 'networkidle0' })

      // Take screenshot of first page
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: false,
      })

      // Resize to 400px width using sharp
      thumbnailBuffer = await sharp(screenshot)
        .resize(400, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer()

      await browser.close()
      browser = null

    } else if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(fileType.toLowerCase())) {
      // Generate image thumbnail using sharp
      const response = await fetch(fileUrl)
      const arrayBuffer = await response.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)

      thumbnailBuffer = await sharp(imageBuffer)
        .resize(400, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer()

    } else {
      return res.status(400).json({ error: `Unsupported file type: ${fileType}` })
    }

    // Return thumbnail as base64
    const base64 = thumbnailBuffer.toString('base64')

    console.log('Thumbnail generated successfully, size:', thumbnailBuffer.length, 'bytes')

    return res.status(200).json({
      success: true,
      thumbnail: base64,
      mimeType: 'image/jpeg',
      size: thumbnailBuffer.length
    })

  } catch (error) {
    console.error('Error generating thumbnail:', error)

    // Close browser if still open
    if (browser) {
      await browser.close()
    }

    return res.status(500).json({
      error: 'Failed to generate thumbnail',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Increase timeout for PDF rendering (Vercel Pro: 60s, Hobby: 10s)
export const config = {
  maxDuration: 60,
}
