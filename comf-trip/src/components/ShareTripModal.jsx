import React, { useState, useEffect } from "react";
import { useTranslation } from "../i18n";
import Modal from "./Modal";
import ActionButton from "./ActionButton";
import { apiGet, apiPost, apiDelete } from "../pages/api";
import { formatDateRange } from "../utils/dateUtils";
import ConfirmDialog from "./ConfirmDialog";
import IconButton from "./IconButton";
import { FaTimes } from "react-icons/fa";
import { useSnackbar } from "../contexts/SnackbarContext";

export default function ShareTripModal({
  isOpen,
  onClose,
  trip = null,
  friend = null,
  availableTrips = [],
  onShareSuccess,
  chooseTrips = false,
  loadingTrips = true,
}) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnackbar();

  const [friends, setFriends] = useState([]);
  const [sharedFriends, setSharedFriends] = useState([]);

  // ✅ antes: selectedFriend (radio)
  // ✅ ahora: Set para múltiples
  const [selectedFriendIds, setSelectedFriendIds] = useState(new Set());

  const [selectedTripIds, setSelectedTripIds] = useState(new Set());
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [notSharedTrips, setNotSharedTrips] = useState([]);

  const [removeConfirm, setRemoveConfirm] = useState({
    isOpen: false,
    userId: null,
  });

  const [removeTripConfirm, setRemoveTripConfirm] = useState({
    isOpen: false,
    tripId: null,
  });

  const [isRemoveShare, setIsRemoveShare] = useState(false);

  useEffect(() => {
    if (isOpen && !chooseTrips) {
      loadFriends();
    }
  }, [isOpen, chooseTrips]);

  useEffect(() => {
    if (isOpen && chooseTrips && friend && availableTrips.length > 0) {
      loadTripsSplit();
    }
  }, [isOpen, chooseTrips, friend, availableTrips]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/friends");
      const friendsArr = Array.isArray(res) ? res : res?.rows ?? [];

      const sharedRes = await apiGet(`/share/trip/${trip.id}/users`);
      const alreadySharedArr = Array.isArray(sharedRes) ? sharedRes : sharedRes?.rows ?? [];

      const sharedIds = new Set(alreadySharedArr.map((u) => u.id ?? u.user_id));

      const available = [];
      const shared = [];

      friendsArr.forEach((fr) => {
        if (sharedIds.has(fr.id)) shared.push(fr);
        else available.push(fr);
      });

      setFriends(available);
      setSharedFriends(shared);

      // ✅ limpiar selección al refrescar
      setSelectedFriendIds(new Set());
    } catch (err) {
      console.error("Error loading friends:", err);
      showError(t("trips.share.errorFriends"));
      setFriends([]);
      setSharedFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTripsSplit = async () => {
    try {
      const res = await apiGet(`/share/by-me/${friend.id}`);
      const sharedArr = Array.isArray(res) ? res : res?.rows ?? [];

      const sharedTripIds = new Set(sharedArr.map((t) => t.id));

      const shared = [];
      const notShared = [];

      availableTrips.forEach((tr) => {
        if (sharedTripIds.has(tr.id)) shared.push(tr);
        else notShared.push(tr);
      });

      setSharedTrips(shared);
      setNotSharedTrips(notShared);
    } catch (err) {
      console.error("Error loading shared trips:", err);
      showError(t("trips.share.errorTrip"));
      setSharedTrips([]);
      setNotSharedTrips(availableTrips);
    }
  };

  const toggleTripSelection = (tripId) => {
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  };

  // ✅ nuevo: toggle amigos (multi)
  const toggleFriendSelection = (friendId) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const submitShare = async () => {
    if (chooseTrips) {
      if (selectedTripIds.size === 0) return;
      setSharing(true);

      const successes = [];
      const failures = [];

      for (const tripId of Array.from(selectedTripIds)) {
        try {
          await apiPost(`/trips/${tripId}/share`, {
            mode: "viewer",
            public: false,
            shared_with_user_id: friend.id,
          });
          successes.push(tripId);
        } catch (err) {
          console.error(`Share failed for trip ${tripId}:`, err);
          const message =
            err?.message ??
            err?.data?.message ??
            t("common.error");
          failures.push({ tripId, message });
        }
      }

      if (successes.length > 0) {
        setNotSharedTrips((prev) => prev.filter((t) => !successes.includes(t.id)));
        setSharedTrips((prev) => [
          ...prev,
          ...successes
            .map((id) => notSharedTrips.find((tr) => tr.id === id))
            .filter(Boolean),
        ]);
        setSelectedTripIds(new Set());
        showSuccess(t("community.shareSuccess", { count: successes.length }));
      }

      if (failures.length > 0) {
        showError(t("community.shareErrors", { count: failures.length }));
      }

      setSharing(false);
      if (onShareSuccess) onShareSuccess();
      return;
    }

    // ✅ MODO NORMAL: compartir 1 viaje con MUCHOS amigos
    if (!trip) return;
    if (selectedFriendIds.size === 0) return;

    setSharing(true);

    const ids = Array.from(selectedFriendIds);
    const successes = [];
    const failures = [];

    for (const fid of ids) {
      const fr = friends.find((x) => Number(x.id) === Number(fid));
      try {
        await apiPost(`/trips/${trip.id}/share`, {
          mode: "viewer",
          public: false,
          shared_with_user_id: fid,
        });
        successes.push(fid);

        // mover de disponibles -> compartidos
        if (fr) {
          setSharedFriends((prev) => [...prev, { ...fr, mode: "viewer" }]);
          setFriends((prev) => prev.filter((x) => Number(x.id) !== Number(fid)));
        }
      } catch (err) {
        console.error("Error sharing trip:", err);
        failures.push(fid);
      }
    }

    setSelectedFriendIds(new Set());
    setSharing(false);

    if (successes.length > 0) {
      showSuccess(t("community.shareSuccess", { count: successes.length }));
      if (onShareSuccess) onShareSuccess();
    }
    if (failures.length > 0) {
      showError(t("community.shareErrors", { count: failures.length }));
    }
  };

  const removeShare = async (userId) => {
    try {
      await apiDelete(`/share/trip/${trip.id}/user/${userId}`);
      await loadFriends();
    } catch (err) {
      console.error("Error removing shared user:", err);
      showError(t("trips.share.removeError"));
    } finally {
      setRemoveConfirm({ isOpen: false, userId: null });
      setIsRemoveShare(false);
    }
  };

  const removeTripShare = async (tripId) => {
    try {
      await apiDelete(`/share/trip/${tripId}/user/${friend.id}`);
      await loadTripsSplit();
    } catch (err) {
      console.error(err);
      showError(t("trips.share.removeError"));
    } finally {
      setRemoveTripConfirm({ isOpen: false, tripId: null });
    }
  };

  const handleClose = () => {
    if (!sharing) {
      onClose();
      setSelectedFriendIds(new Set());
      setSelectedTripIds(new Set());
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} closeOnOverlayClick={!sharing} disabled={sharing}>
      {chooseTrips && isOpen ? (
        <>
          <h3>
            {t("community.shareTitle", {
              name: friend.name || friend.email || `${t("community.user")} ${friend.id}`,
            })}
          </h3>
          <p className="hint">{t("community.shareSubtitle")}</p>

          <div style={{ marginTop: 14, maxHeight: "50vh", overflow: "auto" }}>
            {loadingTrips ? (
              <div className="muted">{t("trips.loading")}</div>
            ) : (
              <>
                <h4 style={{ marginBottom: 10 }}>{t("trips.share.notSharedTrips")}</h4>

                {notSharedTrips.length === 0 ? (
                  <div className="muted">
                    {sharedTrips ? t("trips.share.noTripsToShareAvailable") : t("community.noOwnTrips")}
                  </div>
                ) : (
                  <div className="list">
                    {notSharedTrips.map((tr) => {
                      const isSelected = selectedTripIds.has(tr.id);
                      return (
                        <label key={tr.id} style={{ display: "block", cursor: "pointer" }}>
                          <div className="list-item" style={{ alignItems: "center", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                <div>
                                  <div className="title">{tr.destination || `${t("trips.share.trip")} #${tr.id}`}</div>
                                  <div className="subtitle" style={{ paddingTop: 15 }}>
                                    {tr.start_date ? formatDateRange(tr.start_date, tr.end_date) : t("trips.unknownDestination")}
                                  </div>
                                </div>
                                <div>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleTripSelection(tr.id);
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

                {sharedTrips.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 20, marginBottom: 10 }}>{t("trips.share.alreadySharedTrips")}</h4>

                    <div className="list muted">
                      {sharedTrips.map((tr) => (
                        <label key={tr.id} style={{ display: "block", cursor: "pointer" }}>
                          <div className="list-item" style={{ alignItems: "center", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div>
                                  <div className="title">{tr.destination || `${t("trips.share.trip")} #${tr.id}`}</div>
                                  <div className="subtitle" style={{ paddingTop: 15 }}>
                                    {tr.start_date ? formatDateRange(tr.start_date, tr.end_date) : t("trips.unknownDestination")}
                                  </div>
                                </div>
                                {tr?.mode && <span className="badge badge-secondary" style={{ marginLeft: 8 }}>{tr?.mode}</span>}
                              </div>
                            </div>

                            <IconButton
                              icon={<FaTimes size={16} color="#e74c3c" />}
                              title={t("trips.share.remove")}
                              onClick={() => setRemoveTripConfirm({ isOpen: true, tripId: tr.id })}
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <ActionButton variant="ghost" onClick={handleClose} disabled={sharing}>
              {t("community.cancel")}
            </ActionButton>
            <ActionButton variant="primary" onClick={submitShare} disabled={sharing || selectedTripIds.size === 0}>
              {sharing ? t("community.sharing") : `${t("community.share")} ${selectedTripIds.size ? `(${selectedTripIds.size})` : ""}`}
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <h3>{trip ? t("trips.share.title", { destination: trip.destination }) : t("trips.share.title", { destination: "" })}</h3>
          <p className="hint">{t("trips.share.subtitle")}</p>

          {loading ? (
            <div className="muted">{t("common.loading")}</div>
          ) : (
            <>
              <h4 style={{ marginTop: 10, marginBottom: 15 }}>{t("trips.share.availableFriends")}</h4>

              {friends.length === 0 ? (
                <div className="muted">{t("trips.share.noFriends")}</div>
              ) : (
                <div className="list">
                  {friends.map((f) => {
                    const checked = selectedFriendIds.has(f.id);
                    return (
                      <label
                        key={f.id}
                        style={{ display: "flex", cursor: "pointer", marginBottom: 8, gap: 10 }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFriendSelection(f.id)}
                          disabled={sharing}
                        />
                        <div className="info" style={{ display: "flex" }}>
                          <div className="avatar">
                            {(f.name || f.email || "U")
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div style={{ marginLeft: 12 }}>
                            <div className="title">{f.name || f.email}</div>
                            {f.name && <div className="subtitle">{f.email}</div>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {sharedFriends.length > 0 && (
                <>
                  <h4 style={{ marginTop: 10, marginBottom: 15 }}>{t("trips.share.alreadyShared")}</h4>

                  <div className="list">
                    {sharedFriends.map((f) => (
                      <div
                        key={f.id}
                        className="list-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div className="info" style={{ display: "flex" }}>
                          <div className="avatar">
                            {(f.name || f.email || "U")
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div style={{ marginLeft: 12 }}>
                            <div className="title">{f.name || f.email}</div>
                            {f.name && <div className="subtitle">{f.email}</div>}
                          </div>
                          {f?.mode && <span className="badge badge-secondary" style={{ marginLeft: 20 }}>{f?.mode}</span>}
                        </div>

                        <IconButton
                          icon={<FaTimes size={16} color="#e74c3c" />}
                          title={t("trips.share.remove")}
                          disabled={sharing}
                          onClick={() => {
                            setRemoveConfirm({ isOpen: true, userId: f.id });
                            setIsRemoveShare(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <ActionButton variant="ghost" onClick={handleClose} disabled={sharing}>
              {t("common.cancel")}
            </ActionButton>

            <ActionButton
              variant="primary"
              onClick={submitShare}
              disabled={sharing || loading || selectedFriendIds.size === 0}
            >
              {sharing ? t("trips.share.sharing") : `${t("trips.share.share")} ${selectedFriendIds.size ? `(${selectedFriendIds.size})` : ""}`}
            </ActionButton>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={removeConfirm.isOpen}
        onClose={() => {
          setRemoveConfirm({ isOpen: false, userId: null });
          setIsRemoveShare(false);
        }}
        onConfirm={() => {
          if (isRemoveShare && removeConfirm.userId) removeShare(removeConfirm.userId);
        }}
        title={t("trips.share.removeTitle")}
        message={t("trips.share.removeConfirm")}
        confirmText={t("community.remove")}
        variant="primary"
      />

      <ConfirmDialog
        isOpen={removeTripConfirm.isOpen}
        onClose={() => setRemoveTripConfirm({ isOpen: false, tripId: null })}
        onConfirm={() => {
          if (removeTripConfirm.tripId) removeTripShare(removeTripConfirm.tripId);
        }}
        title={t("trips.share.removeTitle")}
        message={t("trips.share.removeConfirm")}
        confirmText={t("community.remove")}
        variant="primary"
      />
    </Modal>
  );
}
