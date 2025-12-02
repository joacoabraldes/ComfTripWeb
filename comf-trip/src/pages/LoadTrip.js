import React from 'react';
import loadingGif from '../components/loading.gif';
import { useTranslation } from "../i18n";

export default function LoadTrip({ statusMessage }) {
    const { t } = useTranslation();

    return (
        <div style={styles.overlay}>
            <div style={styles.box}>
                <p style={styles.text}>{statusMessage}</p>
                <img
                    src={loadingGif}
                    alt={t('common.loading')}
                    style={styles.loadingImage}
                />
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "white",
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    box: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    text: {
        fontSize: '16px',
        color: '#666',
        marginBottom: '20px',
        textAlign: 'center'
    },
    loadingImage: {
        width: '100px',
        height: '100px',
    }
};
