import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),

    // ── /api/chat middleware ──────────────────────────────────────────────────
    {
      name: 'api-chat-middleware',
      configureServer(server) {
        server.middlewares.use('/api/chat', async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            let parsed;
            try {
              parsed = JSON.parse(body);
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              return;
            }

            try {
              const dotenv = await import('dotenv');
              dotenv.config();

              const { handleChatRequest } = await import('./src/backend/api/chatService.js');

              console.log(`[api/chat] Received message: "${(parsed.message ?? '').slice(0, 100)}"`);

              const result = await handleChatRequest(parsed);

              res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err) {
              console.error('[api/chat] Handler error:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Internal server error', details: err.message }));
            }
          });
        });
      },
    },

    // ── /api/vision-insights middleware ──────────────────────────────────────
    // Accepts multipart/form-data (file upload).
    // Encodes the file buffer directly to base64 and sends it to Ollama llava.
    // Runs entirely server-side — secrets never reach the browser.
    {
      name: 'api-vision-middleware',
      configureServer(server) {
        server.middlewares.use('/api/vision-insights', async (req, res) => {
          // Always respond with JSON — never let an exception reach the wire unhandled
          const jsonError = (status, message) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: message }));
          };

          if (req.method !== 'POST') return jsonError(405, 'Method not allowed');

          try {
            const dotenv = await import('dotenv');
            dotenv.config();

            const contentType = req.headers['content-type'] ?? '';

            // ── Collect raw body as Buffer ────────────────────────
            const rawBody = await new Promise((resolve, reject) => {
              const chunks = [];
              req.on('data', c => chunks.push(c));
              req.on('end',  () => resolve(Buffer.concat(chunks)));
              req.on('error', reject);
            });

            // ── Parse multipart/form-data ─────────────────────────
            if (!contentType.includes('multipart/form-data')) {
              return jsonError(400, 'Expected multipart/form-data upload');
            }

            const boundary = contentType.split('boundary=')[1]?.trim();
            if (!boundary) return jsonError(400, 'Missing multipart boundary');

            // Split on --boundary markers
            const sep   = Buffer.from(`\r\n--${boundary}`);
            const start = Buffer.from(`--${boundary}`);

            // Find all part slices
            let fileBuffer = null;
            let mimeType   = 'image/jpeg';
            let userId     = 'anonymous';

            // Walk the raw body looking for parts
            let pos = rawBody.indexOf(start);
            while (pos !== -1) {
              pos += start.length;
              // Skip \r\n after boundary
              if (rawBody[pos] === 0x0d && rawBody[pos + 1] === 0x0a) pos += 2;
              // Find end of this part's headers
              const headerEnd = rawBody.indexOf(Buffer.from('\r\n\r\n'), pos);
              if (headerEnd === -1) break;
              const headers = rawBody.slice(pos, headerEnd).toString('utf8');
              const bodyStart = headerEnd + 4;
              // Find next boundary
              const nextBoundary = rawBody.indexOf(sep, bodyStart);
              const bodyEnd = nextBoundary === -1 ? rawBody.length : nextBoundary;
              const partBody = rawBody.slice(bodyStart, bodyEnd);

              if (headers.includes('filename=') || headers.toLowerCase().includes('name="file"')) {
                const ctMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
                mimeType   = ctMatch ? ctMatch[1].trim() : 'image/jpeg';
                fileBuffer = partBody;
              } else if (headers.toLowerCase().includes('name="userid"')) {
                userId = partBody.toString('utf8').trim() || 'anonymous';
              }

              pos = nextBoundary === -1 ? -1 : nextBoundary;
            }

            if (!fileBuffer || fileBuffer.length === 0) {
              return jsonError(400, 'No image file found in upload');
            }

            // ── Resize image before encoding (max 768px wide) ─────
            // Smaller images are dramatically faster for llava to process.
            let processedBuffer = fileBuffer;
            try {
              const sharp = (await import('sharp')).default;
              processedBuffer = await sharp(fileBuffer)
                .resize({ width: 768, withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
              console.log(`[vision] Resized: ${fileBuffer.length} → ${processedBuffer.length} bytes`);
            } catch (resizeErr) {
              // Non-fatal — use original buffer if sharp fails
              console.warn('[vision] Image resize failed, using original:', resizeErr.message);
            }

            // ── Base64-encode the (resized) buffer ────────────────
            const base64Image = processedBuffer.toString('base64');

            // ── Call Ollama moondream ─────────────────────────────
            const ollamaBase  = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
            const visionModel = process.env.OLLAMA_VISION_MODEL ?? 'moondream';
            const timeoutMs   = 90000; // 90 s — moondream is much faster than llava

            const { VISION_SYSTEM_PROMPT, buildVisionUserPrompt } =
              await import('./src/backend/vision/visionPrompt.js');

            const startTime  = Date.now();
            console.log(`[vision] START ${new Date(startTime).toISOString()} — model=${visionModel} imageBytes=${processedBuffer.length}`);

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            let ollamaRes;
            try {
              ollamaRes = await fetch(`${ollamaBase}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                  model:  visionModel,
                  stream: false,
                  // No format:"json" — moondream ignores it and it can suppress output
                  system: VISION_SYSTEM_PROMPT,
                  prompt: buildVisionUserPrompt(),
                  images: [base64Image],
                }),
              });
            } catch (fetchErr) {
              clearTimeout(timer);
              const duration = Date.now() - startTime;
              if (fetchErr.name === 'AbortError') {
                console.error(`[vision] TIMEOUT after ${duration}ms`);
                return jsonError(504, 'Local vision model timed out. Try a smaller image or switch to cloud vision.');
              }
              console.error(`[vision] Fetch error after ${duration}ms:`, fetchErr.message);
              return jsonError(502, `Could not reach Ollama: ${fetchErr.message}`);
            }

            clearTimeout(timer);
            const endTime  = Date.now();
            const duration = endTime - startTime;
            console.log(`[vision] END ${new Date(endTime).toISOString()} — duration=${duration}ms status=${ollamaRes.status}`);

            if (!ollamaRes.ok) {
              const errText = await ollamaRes.text().catch(() => '');
              console.error('[vision] Ollama HTTP error:', ollamaRes.status, errText);
              return jsonError(502, `Ollama returned HTTP ${ollamaRes.status}: ${errText.slice(0, 200)}`);
            }

            // ── Parse Ollama response ─────────────────────────────
            const ollamaJson = await ollamaRes.json();
            const rawResponse = ollamaJson?.response ?? '';

            console.log(`[vision] Raw response (${rawResponse.length} chars):`, rawResponse.slice(0, 400));

            let visionData;
            try {
              // 1. Direct parse
              visionData = JSON.parse(rawResponse);
            } catch {
              // 2. Extract first {...} block from mixed text
              const match = rawResponse.match(/\{[\s\S]*?\}/);
              if (match) {
                try { visionData = JSON.parse(match[0]); } catch { /* fall through */ }
              }
              // 3. Greedy match — model may wrap JSON in prose
              if (!visionData) {
                const greedyMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (greedyMatch) {
                  try { visionData = JSON.parse(greedyMatch[0]); } catch { /* fall through */ }
                }
              }
              // 4. Give up — return a structured fallback so the UI still renders
              if (!visionData) {
                console.error('[vision] All JSON parse attempts failed. Raw response:\n', rawResponse);
                visionData = {
                  category:        'unknown',
                  common_name:     'Could not parse response',
                  scientific_name: '',
                  confidence:      0,
                  health_status:   'Unknown',
                  ecosystem_role:  '',
                  insights:        ['The vision model responded but the output could not be parsed as JSON.'],
                  recommendations: ['Try a clearer, well-lit photo.', 'Ensure moondream is fully loaded: ollama pull moondream'],
                  warning:         '',
                  raw_response:    rawResponse.slice(0, 500),
                };
              }
            }

            // ── Normalise result ──────────────────────────────────
            const result = {
              category:        visionData.category        ?? 'unknown',
              common_name:     visionData.common_name     ?? 'Unknown',
              scientific_name: visionData.scientific_name ?? '',
              confidence:      Math.min(100, Math.max(0, parseInt(visionData.confidence ?? 0, 10))),
              health_status:   visionData.health_status   ?? 'Unknown',
              ecosystem_role:  visionData.ecosystem_role  ?? '',
              insights:        Array.isArray(visionData.insights)        ? visionData.insights        : [],
              recommendations: Array.isArray(visionData.recommendations) ? visionData.recommendations : [],
              warning:         visionData.warning         ?? '',
            };

            // ── Upload to Supabase Storage + save record ──────────
            let imageUrl = null;
            let savedId  = null;
            try {
              const { uploadImageToStorage, saveVisionResult } =
                await import('./src/backend/vision/visionService.js');
              imageUrl = await uploadImageToStorage(fileBuffer, mimeType, userId);
              const saved = await saveVisionResult(imageUrl, result, userId);
              savedId = saved.id;
            } catch (dbErr) {
              // Non-fatal — return the vision result even if storage/DB fails
              console.warn('[vision] Storage/DB save failed (non-fatal):', dbErr.message);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              data: { ...result, id: savedId, imageUrl },
            }));

          } catch (err) {
            console.error('[api/vision-insights] Unexpected error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message ?? 'Internal server error' }));
          }
        });
      },
    },
  ],

  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
