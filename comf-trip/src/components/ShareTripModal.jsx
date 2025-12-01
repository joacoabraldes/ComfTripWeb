import React, { useState, useEffect } from "react";
import { useTranslation } from "../i18n";
import Modal from "./Modal";
import ActionButton from "./ActionButton";
import { apiGet, apiPost } from "../pages/api";
import {formatDateRange} from "../utils/dateUtils";

/**
 * ShareTripModal Component - Modal for sharing trips with friends
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Function to call when modal closes
 * @param {object} trip - Trip object to share (for single trip sharing)
 * @param {object} friend - Friend object to share with (for sharing multiple trips)
 * @param {array} availableTrips - Array of trips available to share (for multi-trip sharing)
 * @param {function} onShareSuccess - Callback when sharing succeeds
 */
export default function ShareTripModal({
  isOpen,
  onClose,
  trip = null,
  friend = null,
  availableTrips = [],
  onShareSuccess,
}) {
  const { t } = useTranslation();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedTripIds, setSelectedTripIds] = useState(new Set());
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(false);

  const isMultiTripMode = !!friend && availableTrips.length > 0;

  useEffect(() => {
    if (isOpen && !isMultiTripMode) {
      loadFriends();
    }
  }, [isOpen, isMultiTripMode]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/friends");
      setFriends(res.friends || []);
    } catch (err) {
      console.error("Error loading friends:", err);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTripSelection = (tripId) => {
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const submitShare = async () => {
    if (isMultiTripMode) {
      if (selectedTripIds.size === 0) return;
      setSharing(true);
      const successes = [];
      const failures = [];

      for (const tripId of Array.from(selectedTripIds)) {
        try {
          await apiPost(`/trips/${tripId}/share`, {
            mode: 'viewer',
            public: false,
            shared_with_user_id: friend.id,
          });
          successes.push(tripId);
        } catch (err) {
          console.error(`Share failed for trip ${tripId}:`, err);
          const message = (err && err.message) ? err.message : (err && err.data && err.data.message) ? err.data.message : t('common.error');
          failures.push({ tripId, message });
        }
      }

      setSharing(false);
      let msg = '';
      if (successes.length) msg += t('community.shareSuccess', { count: successes.length }) + '\n';
      if (failures.length) msg += t('community.shareErrors', { count: failures.length }) + '\n' + failures.map(f => ` - ${f.tripId}: ${f.message}`).join('\n');

      alert(msg || t('community.operationCompleted'));
      if (onShareSuccess) onShareSuccess();
      onClose();
      setSelectedTripIds(new Set());
    } else {
      if (!selectedFriend || !trip) return;
      setSharing(true);
      try {
        await apiPost(`/trips/${trip.id}/share`, {
          mode: 'viewer',
          public: false,
          shared_with_user_id: selectedFriend.id,
        });
        alert(t("trips.share.success", { friendName: selectedFriend.name || selectedFriend.email }));
        if (onShareSuccess) onShareSuccess();
        onClose();
        setSelectedFriend(null);
      } catch (err) {
        console.error("Error sharing trip:", err);
        alert(t("trips.share.error"));
      } finally {
        setSharing(false);
      }
    }
  };

  const handleClose = () => {
    if (!sharing) {
      onClose();
      setSelectedFriend(null);
      setSelectedTripIds(new Set());
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeOnOverlayClick={!sharing}
      disabled={sharing}
    >
      {isMultiTripMode ? (
        <>
          <h3>
            {t("community.shareTitle", {
              name:
                friend.name ||
                friend.email ||
                `${t("community.user")} ${friend.id}`,
            })}
          </h3>
          <p className="hint">{t("community.shareSubtitle")}</p>

          <div style={{ marginTop: 14, maxHeight: "50vh", overflow: "auto" }}>
            {availableTrips.length === 0 ? (
              <div className="muted">{t("community.noOwnTrips")}</div>
            ) : (
              <div className="list">
                {availableTrips.map((trip) => {
                  const isSelected = selectedTripIds.has(trip.id);
                  return (
                    <label
                      key={trip.id}
                      style={{ display: "block", cursor: "pointer" }}
                    >
                      <div
                        className="list-item"
                        style={{ alignItems: "center", gap: 12 }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div className="title">
                                {trip.destination || `Viaje #${trip.id}`}
                              </div>
                              <div className="subtitle" style={{paddingTop:15}}>
                                {trip.start_date
                                  ? formatDateRange(trip.start_date, trip.end_date)
                                  : t("trips.unknownDestination")}
                              </div>
                            </div>
                            <div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleTripSelection(trip.id);
                                }}
                                disabled={sharing}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <ActionButton variant="ghost" onClick={handleClose} disabled={sharing}>
              {t("community.cancel")}
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={submitShare}
              disabled={sharing || selectedTripIds.size === 0}
            >
              {sharing
                ? t("community.sharing")
                : `${t("community.share")} ${
                    selectedTripIds.size ? `(${selectedTripIds.size})` : ""
                  }`}
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <h3>
            {trip
              ? t("trips.share.title", { destination: trip.destination })
              : t("trips.share.title", { destination: "" })}
          </h3>
          <p className="hint">{t("trips.share.subtitle")}</p>

          {loading ? (
            <div className="muted">{t("common.loading")}</div>
          ) : friends.length === 0 ? (
            <div className="muted">{t("trips.share.noFriends")}</div>
          ) : (
            <div className="list">
              {friends.map((f) => (
                <label
                  key={f.id}
                  style={{
                    display: "block",
                    cursor: "pointer",
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="radio"
                    name="friend"
                    value={f.id}
                    checked={selectedFriend && selectedFriend.id === f.id}
                    onChange={() => setSelectedFriend(f)}
                    disabled={sharing}
                  />{" "}
                  {f.name || f.email || `Usuario ${f.id}`}
                </label>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <ActionButton variant="ghost" onClick={handleClose} disabled={sharing}>
              {t("common.cancel")}
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={submitShare}
              disabled={!selectedFriend || sharing || loading}
            >
              {sharing ? t("trips.share.sharing") : t("trips.share.share")}
            </ActionButton>
          </div>
        </>
      )}
    </Modal>
  );
}

