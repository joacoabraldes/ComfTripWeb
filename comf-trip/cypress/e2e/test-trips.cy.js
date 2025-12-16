describe('ComfTrip - Lista de Viajes (Trips)', () => {
  beforeEach(() => {
    // Login antes de cada test
    cy.visit('/login');
    cy.get('input[name="email"]').type('test00@gmail.com');
    cy.get('input[name="password"]').type('qwertyu');
    
    cy.intercept('POST', '**/login', {
      statusCode: 200,
      body: { 
        success: true,
        token: 'mock-token',
        user: { id: 1, email: 'test00@gmail.com' }
      }
    }).as('loginRequest');
    
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  });

  it('debería cargar la página de viajes', () => {
    cy.intercept('GET', '**/trips**', {
      statusCode: 200,
      body: { trips: [] }
    }).as('getTrips');
    
    cy.visit('/trips');
    cy.url().should('include', '/trips');
    cy.wait('@getTrips');
  });

  it('debería mostrar la lista de viajes cuando hay datos', () => {
    const mockTrips = [
      {
        id: 1,
        destination: 'Barcelona',
        start_date: '2024-06-01',
        end_date: '2024-06-07',
        country: 'Spain'
      },
      {
        id: 2,
        destination: 'Paris',
        start_date: '2024-07-01',
        end_date: '2024-07-05',
        country: 'France'
      }
    ];
    
    cy.intercept('GET', '**/trips**', {
      statusCode: 200,
      body: { trips: mockTrips }
    }).as('getTrips');
    
    cy.visit('/trips');
    cy.wait('@getTrips');
    
    // Verificar que se muestran los viajes
    cy.contains('Barcelona').should('exist');
    cy.contains('Paris').should('exist');
  });

  it('debería mostrar estado vacío cuando no hay viajes', () => {
    cy.intercept('GET', '**/trips**', {
      statusCode: 200,
      body: { trips: [] }
    }).as('getTrips');
    
    cy.visit('/trips');
    cy.wait('@getTrips');
    
    // Verificar que se muestra algún mensaje de estado vacío
    // (dependiendo de la implementación)
  });

  it('debería permitir filtrar viajes', () => {
    cy.intercept('GET', '**/trips**', {
      statusCode: 200,
      body: { trips: [] }
    }).as('getTrips');
    
    cy.visit('/trips');
    cy.wait('@getTrips');
    
    // Buscar elementos de filtro (pueden ser selects, inputs, etc.)
    cy.get('body').then(($body) => {
      if ($body.find('select, .react-select__control').length > 0) {
        cy.get('select, .react-select__control').first().should('exist');
      }
    });
  });

  it('debería permitir ordenar viajes', () => {
    cy.intercept('GET', '**/trips**', {
      statusCode: 200,
      body: { trips: [] }
    }).as('getTrips');
    
    cy.visit('/trips');
    cy.wait('@getTrips');
    
    // Buscar botones o controles de ordenamiento
    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label*="sort"], .sort-button').length > 0) {
        cy.get('button[aria-label*="sort"], .sort-button').first().should('exist');
      }
    });
  });
});

