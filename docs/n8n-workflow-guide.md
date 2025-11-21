# n8n Workflow - Drawing AI Analysis

This workflow automatically analyzes uploaded drawings using Google Gemini Vision AI and extracts searchable metadata.

## Workflow Overview

**Webhook URL**: `https://ericbruce.app.n8n.cloud/webhook/analyze-drawing`

**Trigger**: POST request with drawing metadata
**Purpose**: Analyze mechanical drawings and extract searchable information

## Workflow Steps

### 1. Webhook Trigger Node
**Type**: Webhook
**Method**: POST
**Path**: `/webhook/analyze-drawing`

**Expected Payload**:
```json
{
  "drawing_id": "uuid-here",
  "file_url": "https://your-project.supabase.co/storage/v1/object/public/drawings/filename.pdf",
  "part_number": "25179-001",
  "file_type": "pdf"
}
```

### 2. Supabase - Get Drawing Details
**Type**: Supabase
**Operation**: Get Row
**Table**: `drawings`
**Match**: `id` = `{{$json.drawing_id}}`

**Purpose**: Fetch full drawing metadata from database

### 3. Check File Type (IF Node)
**Type**: IF
**Condition**: Check if file is analyzable by AI

**Conditions**:
- If `file_type` is in: `['pdf', 'png', 'jpg', 'jpeg']` → Continue to AI analysis
- Else → Skip AI analysis, mark as complete

### 4. HTTP Request - Download File
**Type**: HTTP Request
**Method**: GET
**URL**: `{{$json.file_url}}`
**Response Format**: File
**Binary Property**: `data`

**Purpose**: Download the drawing file for AI analysis

### 5. Convert to Base64 (Code Node)
**Type**: Code
**Language**: JavaScript

```javascript
const binaryData = items[0].binary.data;
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const base64 = buffer.toString('base64');

return {
  json: {
    base64_data: base64,
    file_type: items[0].json.file_type,
    part_number: items[0].json.part_number
  }
};
```

**Purpose**: Convert downloaded file to base64 for Gemini API

### 6. Google Gemini Vision Analysis
**Type**: HTTP Request
**Method**: POST
**URL**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`

**Headers**:
```
x-goog-api-key: YOUR_GEMINI_API_KEY
Content-Type: application/json
```

**Body** (JSON):
```json
{
  "contents": [{
    "parts": [
      {
        "text": "You are analyzing a mechanical engineering drawing. Please provide a detailed but concise analysis including:\n\n1. **Type of Drawing**: What type of mechanical component or assembly is this? (e.g., gear, bracket, shaft, housing, assembly, etc.)\n\n2. **Main Components**: List the primary components or features visible in the drawing.\n\n3. **Key Features**: Identify important features such as:\n   - Holes, threads, or fasteners\n   - Dimensions or tolerances (if visible)\n   - Materials or finishes specified\n   - Unique or notable design elements\n\n4. **Part Numbers or Identifiers**: Any part numbers, revision letters, or identifying marks visible.\n\n5. **Keywords**: Generate 5-10 searchable keywords that describe this drawing (lowercase, single words or short phrases).\n\nProvide your analysis in a clear, structured format. Be specific and technical."
      },
      {
        "inline_data": {
          "mime_type": "image/{{$json.file_type === 'pdf' ? 'pdf' : 'jpeg'}}",
          "data": "{{$json.base64_data}}"
        }
      }
    ]
  }]
}
```

**Purpose**: Send drawing to Gemini AI for analysis

### 7. Parse AI Response (Code Node)
**Type**: Code
**Language**: JavaScript

```javascript
const response = items[0].json;

// Extract AI response
const aiText = response.candidates[0].content.parts[0].text;

// Extract keywords using regex (look for keywords section)
const keywordsMatch = aiText.match(/keywords[:\s]*(.*?)(?:\n\n|$)/is);
let keywords = [];

if (keywordsMatch) {
  // Parse keywords from the text
  const keywordsText = keywordsMatch[1];
  keywords = keywordsText
    .split(/[,\n•\-]/)
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0)
    .slice(0, 10); // Limit to 10 keywords
}

return {
  json: {
    drawing_id: items[0].json.drawing_id || $('Webhook').first().json.body.drawing_id,
    ai_description: aiText,
    ai_tags: keywords,
    analyzed_at: new Date().toISOString()
  }
};
```

**Purpose**: Extract and format AI analysis results

### 8. Supabase - Update Drawing
**Type**: Supabase
**Operation**: Update Row
**Table**: `drawings`
**Match**: `id` = `{{$json.drawing_id}}`

**Fields to Update**:
```json
{
  "ai_description": "{{$json.ai_description}}",
  "ai_tags": "{{$json.ai_tags}}",
  "analyzed_at": "{{$json.analyzed_at}}"
}
```

**Purpose**: Save AI analysis back to database

### 9. Success Response
**Type**: Respond to Webhook
**Response Code**: 200

**Body**:
```json
{
  "success": true,
  "message": "Drawing analyzed successfully",
  "drawing_id": "{{$json.drawing_id}}"
}
```

## Error Handling

### Add Error Workflow (Optional)
If any step fails, catch the error and update the drawing status:

**Error Trigger**: Connected to all nodes via error output

**Supabase - Update on Error**:
- Table: `drawings`
- Match: `id` = drawing_id from webhook
- Update: `status` = 'failed'

**Error Response**:
```json
{
  "success": false,
  "error": "{{$json.error.message}}"
}
```

## Testing the Workflow

### Test Payload
```bash
curl -X POST https://ericbruce.app.n8n.cloud/webhook/analyze-drawing \
  -H "Content-Type: application/json" \
  -d '{
    "drawing_id": "test-uuid-123",
    "file_url": "https://example.com/test-drawing.pdf",
    "part_number": "25179-001",
    "file_type": "pdf"
  }'
```

### Expected Result
The workflow should:
1. Download the drawing
2. Send to Gemini AI for analysis
3. Extract description and keywords
4. Update the database with AI metadata
5. Return success response

## Integration with React App

In the React app ([UploadDrawing.jsx](src/components/UploadDrawing.jsx)), add this after successful upload:

```javascript
// After inserting drawing into database
const { data: newDrawing } = await supabase
  .from('drawings')
  .insert([drawingData])
  .select()
  .single()

// Trigger AI analysis (optional - fire and forget)
if (['pdf', 'png', 'jpg', 'jpeg'].includes(fileExt)) {
  fetch(import.meta.env.VITE_N8N_ANALYZE_DRAWING_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      drawing_id: newDrawing.id,
      file_url: publicUrl,
      part_number: formData.partNumber,
      file_type: fileExt
    })
  }).catch(err => console.error('AI analysis failed:', err))
}
```

## Setup Instructions

### 1. Get Google Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key

### 2. Create Workflow in n8n
1. Log into n8n: [ericbruce.app.n8n.cloud](https://ericbruce.app.n8n.cloud)
2. Create new workflow
3. Add nodes as described above
4. Configure Gemini API key in HTTP Request node
5. Set up Supabase credentials
6. Activate workflow

### 3. Test Workflow
1. Upload a test drawing in the React app
2. Check n8n execution log
3. Verify `ai_description` and `ai_tags` appear in database

## Tips

- **Rate Limiting**: Gemini API has rate limits. For bulk imports, add a delay between requests
- **Cost**: Gemini Flash is very cheap (~$0.075 per 1M input tokens)
- **File Size**: Keep drawings under 10MB for best performance
- **Supported Formats**: PDF works best; PNG/JPG also supported

## Optional Enhancements

### 1. Batch Analysis
Modify workflow to accept multiple drawing IDs and process in batches

### 2. Advanced Extraction
Use AI to extract:
- Dimension callouts
- Material specifications
- Tolerance ranges
- Assembly relationships

### 3. OCR for DWG Files
For DWG files, first convert to PDF using a conversion service, then analyze

### 4. Similarity Search
Use AI embeddings to find visually similar drawings