import React, { useState , useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import "../styles/explorar.css";

const Explorar = () => {
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState(["todo"]);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Estados para opciones de filtrado
  const [selectedBudgets, setSelectedBudgets] = useState("");
  const [selectedDurations, setSelectedDurations] = useState("");
  const [selectedSeasons, setSelectedSeasons] = useState("");

  // Mapeo de iconos
  const categoryIcons = {
    todo: '🌍',
    playas: '🏖️',
    naturaleza: '🌲',
    gastronomia: '🍴',
    cultura: '🎭',
    aventura: '🧗',
    relax: '🧘',
    shopping: '🛍️',
    historia: '📜',
    arte: '🎨',
    musica: '🎵',
    deportes: '⚽',
    romantico: '💖',
    familiar: '👨‍👩‍👧‍👦',
    lujo: '💎',
    economico: '💰'
  };

  // Opciones de categorías
  const categories = [
    { id: "todo", name: "Todo" },
    { id: "playas", name: "Playas" },
    { id: "naturaleza", name: "Naturaleza" },
    { id: "gastronomia", name: "Gastronomía" },
    { id: "cultura", name: "Cultura" },
    { id: "aventura", name: "Aventura" },
    { id: "relax", name: "Relax" },
    { id: "shopping", name: "Shopping" },
    { id: "historia", name: "Historia" },
    { id: "arte", name: "Arte" },
    { id: "musica", name: "Música" },
    { id: "deportes", name: "Deportes" },
    { id: "romantico", name: "Romántico" },
    { id: "familiar", name: "Familiar" }
  ];

  const budgets = [
    { id: "economico", name: "Económico" },
    { id: "moderado", name: "Moderado" },
    { id: "lujo", name: "Lujo" }
  ];

  const durations = [
    { id: "corto", name: "Corto (1-3 días)" },
    { id: "medio", name: "Medio (4-7 días)" },
    { id: "largo", name: "Largo (8+ días)" },
    { id: "fin_semana", name: "Fin de semana" }
  ];

  const seasons = [
    { id: "primavera", name: "Primavera"},
    { id: "verano", name: "Verano"},
    { id: "otoño", name: "Otoño"},
    { id: "invierno", name: "Invierno"}
  ]

  const experiences = [
    {
      id: 1,
      title: "Tour gastronómico por Madrid",
      description: "Descubre los sabores auténticos de la capital española",
      rating: 5,
      price: 1000,
      category: "gastronomia",
      budget: "moderado",
      duration: "medio",
      preferences: ["gastronomia", "cultura"],
      image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    },
    {
      id: 2,
      title: "Senderismo en los Pirineos",
      description: "Rutas guiadas por las montañas más impresionantes de Europa",
      rating: 4.5,
      price: 800,
      category: "naturaleza",
      budget: "economico",
      duration: "largo",
      preferences: ["naturaleza", "aventura"],
      image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    },
    {
      id: 3,
      title: "Barcelona, España",
      description: "Arquitectura única y playas mediterráneas",
      rating: 4.8,
      price: 2100,
      category: "playas",
      budget: "moderado",
      duration: "medio",
      preferences: ["playas", "cultura", "shopping"],
      image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    },
    {
      id: 4,
      title: "Tour cultural en Roma",
      description: "Descubre la historia y el arte de la Ciudad Eterna",
      rating: 4.9,
      price: 1200,
      category: "cultura",
      budget: "lujo",
      duration: "largo",
      preferences: ["cultura", "historia", "arte"],
      image: "https://images.unsplash.com/photo-1552832230-c0197043a4d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    }
  ];

  const popularDestinations = [
    {
      id: 1,
      name: "Barcelona, España",
      description: "Arquitectura única y playas mediterráneas",
      rating: 4.8,
      reviews: 2100,
      image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    },
    {
      id: 2,
      name: "París, Francia",
      description: "La ciudad del amor y la luz",
      rating: 4.7,
      reviews: 1850,
      image: "https://images.unsplash.com/photo-1502602898536-47ad22581b52?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    },
    {
      id: 3,
      name: "Tokio, Japón",
      description: "Tradición y modernidad en armonía",
      rating: 4.9,
      reviews: 2450,
      image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
    }
  ];

  // Manejar selección de categorías
  const handleCategorySelect = (categoryId) => {
    if (categoryId === "todo") {
      // Al seleccionar "Todo", deseleccionar todas las demás
      setSelectedCategories(["todo"]);
    } else {
      // Al seleccionar otra categoría, quitar la opción "Todo"
      const newCategories = selectedCategories.includes(categoryId)
        ? selectedCategories.filter(id => id !== categoryId)
        : [...selectedCategories.filter(id => id !== "todo"), categoryId];
      
      // Si no hay categorías seleccionadas, seleccionar automáticamente "Todo"
      setSelectedCategories(newCategories.length > 0 ? newCategories : ["todo"]);
    }
  };

  // Manejar selección de opciones de filtrado
  const handleFilterSelect = (filterType, filterId, currentSelection, setSelection) => {
  if (currentSelection === filterId) {
    // Si se hace clic en una opción ya seleccionada, deseleccionar
    setSelection("");
  } else {
    // Seleccionar nueva opción
    setSelection(filterId);
  }
};

  const handleExperienceClick = (experience) => {
    setSelectedExperience(experience);
    setShowDetailModal(true);
  };

  const handleCreateTrip = () => {
    setShowDetailModal(false);
    navigate("/add-trip", { 
      state: { 
        destination: `${selectedExperience.title}` 
      } 
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: selectedExperience.title,
        text: selectedExperience.description,
        url: window.location.href,
      })
      .catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Enlace copiado al portapapeles");
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star">★</span>);
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="star">☆</span>);
    }
    
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }
    
    return stars;
  };

  return (
    <div className="explorar-page">
      <Header />
      
      <main className="explorar-main">
        <div className="explorar-container">
          <h1 className="explorar-title">Explorar por categorías</h1>
          
          <div className="categories-section">
            <div className="categories-grid">
              {categories.map(category => (
                <div 
                  key={category.id}
                  className={`category-card ${selectedCategories.includes(category.id) ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(category.id)}
                >
                  <div className="category-icon">
                    {categoryIcons[category.id] || '📍'}
                  </div>
                  <div className="category-name">{category.name}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="filters-section">
            <h2>Filtra por</h2>
            
            <div className="filter-group">
              <h3>Duración del viaje</h3>
              <div className="filter-options">
                {durations.map(duration => (
                  <button 
                    key={duration.id}
                    className={`filter-btn ${selectedDurations === duration.id ? 'selected' : ''}`}
                    onClick={() => handleFilterSelect('duration', duration.id, selectedDurations, setSelectedDurations)}
                  >
                    {duration.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="filter-group">
              <h3>Presupuesto</h3>
              <div className="filter-options">
                {budgets.map(budget => (
                  <button 
                    key={budget.id}
                    className={`filter-btn ${selectedBudgets === budget.id ? 'selected' : ''}`}
                    onClick={() => handleFilterSelect('budget', budget.id, selectedBudgets, setSelectedBudgets)}
                  >
                    {budget.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h3>Época del año</h3>
              <div className="filter-options">
                {seasons.map(seasons => (
                  <button 
                    key={seasons.id}
                    className={`filter-btn ${selectedSeasons === seasons.id ? 'selected' : ''}`}
                    onClick={() => handleFilterSelect('seasons', seasons.id, selectedSeasons, setSelectedSeasons)}
                  >
                    {seasons.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="experiences-section">
            <div className="section-header">
              <h2>Experiencias únicas</h2>
              <button className="see-all-btn">Ver todos</button>
            </div>
            
            <div className="experiences-grid">
              {experiences.map(experience => (
                <div 
                  key={experience.id}
                  className="experience-card"
                  onClick={() => handleExperienceClick(experience)}
                >
                  <div className="card-image">
                    <img src={experience.image} alt={experience.title} />
                    <div className="card-overlay"></div>
                  </div>
                  <div className="card-content">
                    <h3 className="card-title">{experience.title}</h3>
                    <p className="card-description">{experience.description}</p>
                    <div className="card-rating">
                      {renderStars(experience.rating)}
                      <span className="rating-text">{experience.rating}</span>
                    </div>
                    <div className="card-price">Desde ${experience.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="destinations-section">
            <h2>Destinos Populares</h2>
            <div className="destinations-grid">
              {popularDestinations.map(destination => (
                <div 
                  key={destination.id}
                  className="destination-card"
                  onClick={() => handleExperienceClick(destination)}
                >
                  <div className="destination-image">
                    <img src={destination.image} alt={destination.name} />
                  </div>
                  <div className="destination-content">
                    <h3 className="destination-name">{destination.name}</h3>
                    <p className="destination-description">{destination.description}</p>
                    <div className="destination-rating">
                      {renderStars(destination.rating)}
                      <span className="rating-text">{destination.rating} ({destination.reviews})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      
      {showDetailModal && selectedExperience && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowDetailModal(false)}
            >
              &times;
            </button>
            
            <div className="modal-image">
              <img src={selectedExperience.image} alt={selectedExperience.title || selectedExperience.name} />
            </div>
            
            <div className="modal-details">
              <h2>{selectedExperience.title || selectedExperience.name}</h2>
              <p className="modal-description">{selectedExperience.description}</p>
              
              <div className="modal-rating">
                {renderStars(selectedExperience.rating)}
                <span className="rating-text">{selectedExperience.rating}</span>
                {selectedExperience.reviews && (
                  <span className="reviews-text">({selectedExperience.reviews} reseñas)</span>
                )}
              </div>
              
              {selectedExperience.price && (
                <div className="modal-price">Desde ${selectedExperience.price}</div>
              )}
              
              <div className="modal-actions">
                <button className="btn-create" onClick={handleCreateTrip}>
                  Crear plan de viaje
                </button>
                <button className="btn-share" onClick={handleShare}>
                  Compartir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Explorar;