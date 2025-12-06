// src/components/trip/ReviewForm.jsx
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut } from '../../pages/api';
import { useTranslation } from '../../i18n';
import { FaStar } from 'react-icons/fa';
import '../../styles/review-form.css';

export default function ReviewForm({ tripId, existingReview, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 0);
      setTitle(existingReview.title || '');
      setComment(existingReview.comment || '');
    } else if (tripId) {
      loadReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReview, tripId]);

  const loadReview = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/trips/${tripId}/review`);
      const data = res?.data || res;
      if (data && data.id) {
        setRating(data.rating || 0);
        setTitle(data.title || '');
        setComment(data.comment || '');
      }
    } catch (err) {
      // Review doesn't exist yet, that's okay
      if (err?.status !== 404) {
        console.error('Error loading review:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (rating === 0) {
      alert(t('review.ratingRequired'));
      return;
    }
    if (!title.trim()) {
      alert(t('review.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      const reviewData = {
        rating,
        title: title.trim(),
        comment: comment.trim() || null,
      };

      // Check if review exists
      let reviewExists = false;
      if (existingReview?.id) {
        reviewExists = true;
      } else {
        try {
          await apiGet(`/trips/${tripId}/review`);
          reviewExists = true;
        } catch (err) {
          if (err?.status === 404) {
            reviewExists = false;
          } else {
            throw err;
          }
        }
      }

      if (reviewExists) {
        await apiPut(`/trips/${tripId}/review`, reviewData);
        alert(t('review.updateSuccess'));
      } else {
        try {
          await apiPost(`/trips/${tripId}/review`, reviewData);
          alert(t('review.saveSuccess'));
        } catch (postErr) {
          // If POST fails with 409 (conflict), review was created between check and post
          // Try to update instead
          if (postErr?.status === 409) {
            await apiPut(`/trips/${tripId}/review`, reviewData);
            alert(t('review.updateSuccess'));
          } else {
            throw postErr;
          }
        }
      }

      if (onSaved) onSaved();
    } catch (err) {
      console.error('Error saving review:', err);
      const message = err?.message || err?.error || t('review.saveError');
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const getRatingText = (ratingValue) => {
    const ratingMap = {
      5: t('review.ratings.excellent'),
      4: t('review.ratings.veryGood'),
      3: t('review.ratings.good'),
      2: t('review.ratings.fair'),
      1: t('review.ratings.poor'),
    };
    return ratingMap[ratingValue] || '';
  };

  if (loading) {
    return (
      <div className="review-form-container">
        <div className="review-form-loading">
          <span>{t('review.loadingReview')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="review-form-container">
      <h3 className="review-form-title">{t('review.title')}</h3>
      
      <div className="review-form-rating-container">
        <label className="review-form-label">{t('review.rating')} *</label>
        <div className="review-form-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="review-form-star-button"
              disabled={saving}
              aria-label={`Rate ${star} stars`}
            >
              <FaStar
                className={star <= rating ? 'review-form-star-filled' : 'review-form-star-empty'}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div className="review-form-rating-text">{getRatingText(rating)}</div>
        )}
      </div>

      <div className="review-form-input-container">
        <label className="review-form-label">{t('review.titleLabel')} *</label>
        <input
          type="text"
          className="review-form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('review.placeholder.title')}
          maxLength={100}
          disabled={saving}
        />
      </div>

      <div className="review-form-input-container">
        <label className="review-form-label">{t('review.commentLabel')}</label>
        <textarea
          className="review-form-textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('review.placeholder.comment')}
          maxLength={1000}
          rows={5}
          disabled={saving}
        />
        <div className="review-form-char-count">{comment.length}/1000</div>
      </div>

      <div className="review-form-buttons">
        {onCancel && (
          <button
            type="button"
            className="review-form-cancel-button"
            onClick={onCancel}
            disabled={saving}
          >
            {t('common.cancel')}
          </button>
        )}
        <button
          type="button"
          className="review-form-save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <span>{t('review.saving')}</span>
          ) : (
            <span>{existingReview ? t('review.updateButton') : t('review.saveButton')}</span>
          )}
        </button>
      </div>
    </div>
  );
}

