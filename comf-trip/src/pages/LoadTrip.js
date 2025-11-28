import React, { useEffect } from 'react';
import loadingGif from '../components/loading.gif';
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";

export default function LoadTrip() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tripId = location.state?.tripId;

  useEffect(() => {
    if (!tripId) return;
    const timer = setTimeout(() => {
      navigate(`/trip_itinerary/${tripId}`);
    }, 3000); // ⏳ 3 segundos en la pantalla de carga

    return () => clearTimeout(timer);
  }, [tripId, navigate]);


  return (
    <div style={styles.container}>
      <p style={styles.text}>
        {t('loadTrip.calculating')}
      </p>
      <img 
        src={loadingGif} 
        alt={t('common.loading')}
        style={styles.loadingImage}
      />
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'white',
  },
  text: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '20px',
  },
  loadingImage: {
    width: '100px',
    height: '100px',
  }
};
