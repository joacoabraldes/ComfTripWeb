// src/pages/friendProfile.js
import React, { useEffect, useState } from 'react';
import '../styles/friendProfile.css';
import { apiGet } from './api';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import {formatDate, formatDateRange} from '../utils/dateUtils';
import LoadingSpinner from "../components/LoadingSpinner";
import {FaUser} from "react-icons/fa";
import FilterSelect from "../components/FilterSelect";

export default function FriendProfile() {
  // NOTE: route in App.jsx is "/friend/:friendId"
  const { friendId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [friend, setFriend] = useState(null);
  const [visibleTrips, setVisibleTrips] = useState([]);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // fetch a minimal user profile
      const res= await apiGet(`/friends/${friendId}`);

        const u = res.user || {};
      // backend may return extra fields; pick only non-sensitive fields
      const safe = {
          id: u?.id,
          name: u?.name || "",
          email: u?.email || "",
          phone: u?.phone || "",
          nationality: u?.nationality || "",
          birthdate: u?.birthdate ? formatDate(u.birthdate): "",
      };
      setFriend(safe);

      // fetch visible trips (trips endpoint returns trips visible to the logged-in user).
      const trips = await apiGet('/trips');
      const tripsArr = Array.isArray(trips) ? trips : (trips && trips.rows ? trips.rows : []);
      // show trips that belong to the friend OR that have share.shared_by === friend.id
      const friendTrips = tripsArr.filter(trip => {
        if (!trip) return false;
        if (Number(trip.user_id) === Number(friendId)) return true;
        if (trip.share && Number(trip.share.shared_by) === Number(friendId)) return true;
        return false;
      });
      setVisibleTrips(friendTrips);
    } catch (err) {
      console.error('Error loading friend profile:', err);
      setError(t('friendProfile.loadError'));
      setFriend(null);
      setVisibleTrips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  if (loading) {
    return (
      <LoadingSpinner message={t('friendProfile.loading')} fullScreen />
    );
  }

  if (error) {
    return (
      <div>
        <main className="friend-main">
          <div className="friend-container" style={{textAlign:"center", justifyContent:"center", alignItems:"center", paddingTop: 30}}>
            <div className="error" style={{paddingBottom:10, fontSize:25}}>{error}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!friend) {
    return (
      <div>
        <main className="friend-main">
          <div className="friend-container">
            <div className="muted">{t('friendProfile.notFound')}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <main className="friend-main">
        <div className="friend-container">
            <div className="profile-card">
                <div className="profile-main">
                    <div className="profile-left">
                        <div className="profile-photo">
                            {friend.photo ? <img src={friend.photo} alt={t('profile.photoAlt')} /> : <FaUser className="default-photo" />}
                        </div>
                        <h2 className="profile-name truncate-name" style={{maxWidth:"100%"}}>{friend.name || t('profile.noName')}</h2>
                    </div>

                    <div className="profile-right">
                        <div className="profile-field">
                            <span className="profile-field-label">{t('profile.email')}</span>
                            <span className="profile-field-value">{friend.email || "—"}</span>
                        </div>

                        <div className="profile-field">
                            <span className="profile-field-label">{t('profile.phone')}</span>
                            <span className="profile-field-value">{friend.phone || "—"}</span>
                        </div>

                        <div className="profile-field">
                            <span className="profile-field-label">{t('profile.birthdate')}</span>
                            <span className="profile-field-value">{friend.birthdate || "—"}</span>
                        </div>

                        <div className="profile-field">
                            <span className="profile-field-label">{t('profile.nationality')}</span>
                            <span className="profile-field-value">{friend.nationality || "—"}</span>
                        </div>
                    </div>
                </div>
            </div>
          <div className="friend-card">
              {/*<div className="friend-header">
              <div className="friend-avatar">{(friend.name || friend.email || 'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
              <div className="friend-meta">
                <h2>{friend.name}</h2>
                <div className="subtitle">{friend.username ? `@${friend.username}` : friend.email}</div>
                {friend.nationality ? <div className="tiny">{t('profile.nationality')}: {friend.nationality}</div> : null}
                {friend.created_at ? <div className="tiny">{t('friendProfile.memberSince')}: {String(friend.created_at).slice(0,10)}</div> : null}
              </div>
            </div>*/}

            <div className="friend-body">
              <h3>{t('friendProfile.trips')}</h3>
              {visibleTrips.length === 0 ? (
                <div className="muted">{t('friendProfile.noTrips')}</div>
              ) : (
                <div className="friend-trips">
                  {visibleTrips.map(trip => (
                    <div key={trip.id} className="trip-card">
                      <div className="trip-title">{trip.destination || t('friendProfile.unknownDestination')}</div>
                      <div className="trip-dates">{trip.start_date ? formatDateRange(trip.start_date, trip.end_date) : t('friendProfile.datesNotSpecified')}</div>
                      {trip.share ? (
                        <div className={`badge ${trip.share.public ? 'badge-primary' : 'badge-secondary'}`}>
                          {trip.share.public ? t('friendProfile.publicLink') : t('friendProfile.shared')}{trip.share.mode ? ` (${trip.share.mode})` : ''}
                        </div>
                      ) : null}
                      <div style={{ marginTop: 8 }}>
                        <button className="btn small" onClick={() => navigate(`/trip_itinerary/${trip.id}`)}>{t('common.view')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
