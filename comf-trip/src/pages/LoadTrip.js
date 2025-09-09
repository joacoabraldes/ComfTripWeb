import React from 'react';
import loadingGif from '../components/loading.gif';
import { useNavigate } from 'react-router-dom';

const LoadTrip = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <p style={styles.text}>
        Estamos calculando los mejores lugares para visitar en tu viaje
      </p>
      <img 
        src={loadingGif} 
        alt="Loading..."
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

export default LoadTrip;