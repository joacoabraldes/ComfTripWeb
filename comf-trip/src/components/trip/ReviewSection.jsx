// src/components/trip/ReviewSection.jsx
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../pages/api';
import { useTranslation } from '../../i18n';
import { FaStar, FaEdit, FaPlus } from 'react-icons/fa';
import ReviewForm from './ReviewForm';
import '../../styles/review-section.css';

export default function ReviewSection({ tripId, trip, isOwner }) {
  const { t } = useTranslation();
  const [review, setReview] = useState(trip?.review || null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (trip?.review) {
      setReview(trip.review);
    } else if (tripId) {
      loadReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, tripId]);

  const loadReview = async () => {
    if (!Number.isFinite(tripId) || tripId <= 0) return;
    
    setLoadingReview(true);
    try {
      const res = await apiGet(`/trips/${tripId}/review`);
      const data = res?.data || res;
      if (data && data.id) {
        setReview(data);
      } else {
        setReview(null);
      }
    } catch (err) {
      // Review doesn't exist yet, that's okay (404 or endpoint not found)
      if (err?.status !== 404) {
        console.error('Error loading review:', err?.message || err);
      }
      setReview(null);
    } finally {
      setLoadingReview(false);
    }
  };

  const handleReviewSaved = async () => {
    setShowReviewForm(false);
    await loadReview();
  };

  const handleCancel = () => {
    setShowReviewForm(false);
  };

  if (!Number.isFinite(tripId) || tripId <= 0) {
    return null;
  }

  return (
    <>
      {!showReviewForm ? (
        <div className="review-section-container">
          <div className="review-section-header">
            <h3 className="review-section-title">{t('review.title')}</h3>
              {isOwner && <button
              type="button"
              className="review-section-edit-button"
              onClick={() => setShowReviewForm(true)}
            >
              {review ? <FaEdit /> : <FaPlus />}
              <span>{review ? t('common.edit') : t('common.add')}</span>
            </button>}
          </div>
          {loadingReview ? (
            <div className="review-section-loading">
              <span>{t('review.loadingReview')}</span>
            </div>
          ) : review ? (
            <div className="review-section-display">
              <div className="review-section-rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar
                    key={star}
                    className={
                      star <= (review.rating || 0)
                        ? 'review-section-star-filled'
                        : 'review-section-star-empty'
                    }
                  />
                ))}
                <span className="review-section-rating-text">
                  {review.rating || 0}/5
                </span>
              </div>
              {review.title && (
                <div className="review-section-title-text">{review.title}</div>
              )}
              {review.comment && (
                <div className="review-section-comment">{review.comment}</div>
              )}
            </div>
          ) : (
            <div className="review-section-no-review">
              {t('review.noReview')}
            </div>
          )}
        </div>
      ) : (
        <ReviewForm
          tripId={tripId}
          existingReview={review}
          onSaved={handleReviewSaved}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

