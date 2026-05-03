/**
 * visionService.js — Backend vision analysis service
 *
 * Handles Supabase Storage upload and database persistence for vision results.
 * The actual Ollama call is made directly in the vite.config.js middleware
 * so the base64 buffer never needs a round-trip through a public URL.
 *
 * Backend only. Never import from frontend code.
 *
 * Environment variables:
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Service role key (server-side only)
 */

import { supabase } from '../lib/supabaseClient.js';

const STORAGE_BUCKET = 'ecosystem-photos';

/**
 * Upload a raw image buffer to Supabase Storage.
 *
 * @param {Buffer} buffer    - Raw image bytes
 * @param {string} mimeType  - e.g. 'image/jpeg'
 * @param {string} [userId]
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export async function uploadImageToStorage(buffer, mimeType, userId = 'anonymous') {
  const ext      = (mimeType.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const filename = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return data.publicUrl;
}

/**
 * Save a vision result to the ecosystem_photos table.
 *
 * @param {string} imageUrl
 * @param {Object} result    - Normalised vision result object
 * @param {string} [userId]
 * @returns {Promise<Object>} Inserted row
 */
export async function saveVisionResult(imageUrl, result, userId = 'anonymous') {
  const { data, error } = await supabase
    .from('ecosystem_photos')
    .insert({
      user_id:         userId,
      image_url:       imageUrl,
      category:        result.category,
      common_name:     result.common_name,
      scientific_name: result.scientific_name,
      confidence:      result.confidence,
      health_status:   result.health_status,
      insights:        result.insights,
      recommendations: result.recommendations,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save vision result: ${error.message}`);
  return data;
}
