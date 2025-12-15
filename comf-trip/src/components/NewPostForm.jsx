// src/components/social/NewPostForm.jsx
import React, { useState } from 'react';
import { createPost } from '../services/socialService';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useTranslation } from '../i18n';

export default function NewPostForm({ onPostCreated }) {
  const { t } = useTranslation();
  const { showError } = useSnackbar();
  const [content, setContent] = useState('');
  const [imagesInput, setImagesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      let images = null;
      if (imagesInput.trim()) {
        // separo por coma -> array de URLs
        images = imagesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const newPost = await createPost({ content: content.trim(), images });

      if (onPostCreated) onPostCreated(newPost);
      setContent('');
      setImagesInput('');
    } catch (err) {
      console.error(err);
      showError(t('socialFeed.errorCreatePost'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        backgroundColor: '#fff',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>{t('socialFeed.createPost')}</h2>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder={t('socialFeed.tripThoughtsPlaceholder')}
        style={{
          width: '100%',
          resize: 'vertical',
          padding: 8,
          borderRadius: 6,
          border: '1px solid #ccc',
          marginBottom: 8,
        }}
      />
      <input
        type="text"
        value={imagesInput}
        onChange={(e) => setImagesInput(e.target.value)}
        placeholder={t('socialFeed.imageUrlsPlaceholder')}
        style={{
          width: '100%',
          padding: 8,
          borderRadius: 6,
          border: '1px solid #ccc',
          marginBottom: 8,
          fontSize: 13,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #007bff',
            backgroundColor: submitting ? '#cfe3ff' : '#007bff',
            color: '#fff',
            cursor: submitting ? 'default' : 'pointer',
            fontWeight: 500,
          }}
        >
          {submitting ? t('socialFeed.publishing') : t('socialFeed.publish')}
        </button>
      </div>
    </form>
  );
}
