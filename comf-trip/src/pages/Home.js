import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";
import SearchIcon from "../components/icons/SearchIcon";
import { apiGet } from "./api";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [recommendedItineraries, setRecommendedItineraries] = useState([]);
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // 获取用户信息
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // 获取即将到来的旅行
  useEffect(() => {
    const fetchUpcomingTrips = async () => {
      try {
        const trips = await apiGet("/trips/next");
        setUpcomingTrips(trips);
      } catch (error) {
        console.error("Error fetching upcoming trips:", error);
      }
    };

    fetchUpcomingTrips();
  }, []);

  // 获取推荐行程（模拟数据）
  useEffect(() => {
    // 模拟数据 - 实际应用中应从API获取
    const mockItineraries = [
      {
        id: 1,
        title: "Tour Gastronómico Español",
        description: "Descubre la rica cocina española desde tapas hasta paella",
        duration: "10 días",
        rating: 5,
        details: {
          description: "Un viaje culinario por España que te llevará desde los bares de tapas de Madrid hasta los restaurantes de mariscos de Galicia, pasando por los mercados de Barcelona y las bodegas de La Rioja.",
          includes: "Alojamiento en hoteles boutique, 5 experiencias gastronómicas guiadas, transporte entre ciudades, y degustaciones en 3 bodegas de vino.",
          price: "€1,850 por persona"
        }
      },
      {
        id: 2,
        title: "Aventura en los Alpes",
        description: "Explora las majestuosas montañas de los Alpes suizos",
        duration: "7 días",
        rating: 4,
        details: {
          description: "Una aventura inolvidable por los Alpes suizos, con caminatas, teleféricos y paisajes espectaculares.",
          includes: "Alojamiento en refugios de montaña, guías expertos, equipo de senderismo y transporte entre destinos.",
          price: "€1,200 por persona"
        }
      },
      {
        id: 3,
        title: "Cultura Japonesa",
        description: "Sumérgete en la tradición y modernidad de Japón",
        duration: "14 días",
        rating: 5,
        details: {
          description: "Descubre la fascinante cultura japonesa, desde los templos antiguos de Kioto hasta la vibrante vida nocturna de Tokio.",
          includes: "Alojamiento en ryokans tradicionales y hoteles modernos, tours culturales, clases de cocina y pase de tren bala.",
          price: "€2,500 por persona"
        }
      }
    ];

    const mockDestinations = [
      {
        id: 1,
        name: "Barcelona, España",
        description: "Arquitectura & Playas & Cultura"
      },
      {
        id: 2,
        name: "Cancún, México",
        description: "Playas & Aventura & Relajo"
      },
      {
        id: 3,
        name: "París, Francia",
        description: "Arte & Romance & Gastronomía"
      }
    ];

    setRecommendedItineraries(mockItineraries);
    setPopularDestinations(mockDestinations);
  }, []);

  const handleItineraryClick = (itinerary) => {
    setSelectedItinerary(itinerary);
  };

  const closeItineraryDetail = () => {
    setSelectedItinerary(null);
  };

  return (
    <div className="home-root">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      
      {/* Header - Fixed at top */}
      <header className="home-header fixed-header">
        <div className="header-left">
          <button
            className="icon-btn"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menú"
          >
            <Hamburger />
          </button>
        </div>

        <div className="header-center">
          <div className="search-bar">
            <SearchIcon />
            <input type="text" placeholder="Buscar destino, atracción o actividad..." />
          </div>
        </div>

        <div className="header-right">
          <span className="user-name">{user?.name || "Usuario"}</span>
          <button
            className="icon-btn profile"
            aria-label="Perfil"
            title="Perfil"
            onClick={() => navigate("/profile")}
          >
            <UserIcon />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="home-main with-fixed-header">
        {/* Upcoming Trips Section */}
        {upcomingTrips.length > 0 && (
          <section className="upcoming-trips-section">
            <h2>Próximos Viajes</h2>
            <div className="upcoming-trips-list">
              {upcomingTrips.map(trip => (
                <div key={trip.id} className="trip-card">
                  <div className="trip-info">
                    <h3>{trip.destination}</h3>
                    <p>{new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</p>
                  </div>
                  <button className="view-trip-btn" onClick={() => navigate(`/trips/${trip.id}`)}>
                    Ver Detalles
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommended Itineraries Section */}
        <section className="itineraries-section">
          <div className="section-header">
            <h2>Itinerarios Recomendados</h2>
            <button className="view-all-btn">Ver todos</button>
          </div>
          
          <div className="itineraries-grid">
            {recommendedItineraries.map(itinerary => (
              <div 
                key={itinerary.id} 
                className="itinerary-card"
                onClick={() => handleItineraryClick(itinerary)}
              >
                <div className="card-header">
                  <h3>{itinerary.title}</h3>
                  <div className="rating">
                    {"★".repeat(itinerary.rating)}{"☆".repeat(5 - itinerary.rating)}
                  </div>
                </div>
                <p className="description">{itinerary.description}</p>
                <div className="card-footer">
                  <span className="duration">{itinerary.duration}</span>
                  <button className="details-btn">Ver detalles</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Popular Destinations Section */}
        <section className="destinations-section">
          <div className="section-header">
            <h2>Destinos Populares</h2>
            <button className="view-all-btn">Ver todos</button>
          </div>
          
          <div className="destinations-grid">
            {popularDestinations.map(destination => (
              <div key={destination.id} className="destination-card">
                <h3>{destination.name}</h3>
                <p>{destination.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Itinerary Detail Modal */}
      {selectedItinerary && (
        <div className="modal-overlay" onClick={closeItineraryDetail}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={closeItineraryDetail}>×</button>
            <h2>{selectedItinerary.title}</h2>
            <div className="modal-rating">
              {"★".repeat(selectedItinerary.rating)}{"☆".repeat(5 - selectedItinerary.rating)}
            </div>
            <p className="modal-description">{selectedItinerary.details.description}</p>
            <div className="modal-section">
              <h3>Incluye</h3>
              <p>{selectedItinerary.details.includes}</p>
            </div>
            <div className="modal-section">
              <h3>Precio</h3>
              <p>{selectedItinerary.details.price}</p>
            </div>
            <div className="modal-actions">
              <button className="btn-primary">Reservar ahora</button>
              <button className="btn-secondary">Compartir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}