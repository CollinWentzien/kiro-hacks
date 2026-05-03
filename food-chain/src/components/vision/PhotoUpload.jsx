/**
 * PhotoUpload.jsx — Image upload UI for ecosystem vision analysis
 *
 * Accepts a file from the device (or drag-and-drop), previews it,
 * then calls /api/vision-insights and returns the result via onResult.
 *
 * Props:
 *   onResult(data)  — called with the vision insight object on success
 *   onError(msg)    — called with an error string on failure
 *   disabled        — disables the control while a parent is loading
 */

import { useState, useRef, useCallback } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB    = 10;

export default function PhotoUpload({ onResult, onError, disabled = false }) {
  const [preview,   setPreview]   = useState(null);   // object URL for preview
  const [fileName,  setFileName]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const inputRef = useRef(null);

  // ── File validation ────────────────────────────────────────────────────────
  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload a JPEG, PNG, WebP, or GIF image.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Image must be smaller than ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }

  // ── Handle file selection ──────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;

    const err = validateFile(file);
    if (err) { onError?.(err); return; }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setFileName(file.name);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'anonymous');

      const res = await fetch('/api/vision-insights', {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — browser sets it with boundary automatically
      });

      const body = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));

      if (!res.ok || !body.success) {
        throw new Error(body.error || `Server error (HTTP ${res.status})`);
      }

      onResult?.(body.data);
    } catch (fetchErr) {
      onError?.(fetchErr.message);
    } finally {
      setLoading(false);
    }
  }, [onResult, onError]);

  // ── Input change ───────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  // ── Clear ──────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName(null);
  };

  const isDisabled = disabled || loading;

  return (
    <div className="photo-upload">
      {/* Drop zone / trigger */}
      <div
        className={`photo-upload__zone ${dragOver ? 'photo-upload__zone--drag' : ''} ${isDisabled ? 'photo-upload__zone--disabled' : ''}`}
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Upload a photo for ecosystem analysis"
        onKeyDown={e => e.key === 'Enter' && !isDisabled && inputRef.current?.click()}
      >
        {preview ? (
          <div className="photo-upload__preview-wrap">
            <img
              src={preview}
              alt="Selected image preview"
              className="photo-upload__preview-img"
            />
            {loading && (
              <div className="photo-upload__overlay" aria-label="Analysing image">
                <div className="photo-upload__spinner" aria-hidden="true" />
                <span>Analysing…</span>
              </div>
            )}
          </div>
        ) : (
          <div className="photo-upload__placeholder">
            <span className="photo-upload__icon" aria-hidden="true">📷</span>
            <span className="photo-upload__label">
              {loading ? 'Uploading…' : 'Upload or drag a photo'}
            </span>
            <span className="photo-upload__hint">
              Plant · Animal · Insect · Fungus · Soil · Fish
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Action row */}
      {preview && !loading && (
        <div className="photo-upload__actions">
          <span className="photo-upload__filename">{fileName}</span>
          <button
            className="photo-upload__clear"
            onClick={handleClear}
            aria-label="Remove selected image"
          >
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  );
}
