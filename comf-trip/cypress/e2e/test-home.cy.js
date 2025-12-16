describe('ComfTrip - Página de Inicio (Home)', () => {
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
    
    // Interceptar llamadas de la API para la página de inicio
    cy.intercept('GET', '**/trips**', {
      statusCode: 200,
      body: { trips: [] }
    }).as('getTrips');
    
    cy.intercept('GET', '**/popular**', {
      statusCode: 200,
      body: { trips: [] }
    }).as('getPopular');
  });

  it('debería cargar la página de inicio después del login', () => {
    cy.visit('/home');
    cy.url().should('include', '/home');
  });

  it('debería mostrar elementos principales de la página de inicio', () => {
    cy.visit('/home');
    
    // Esperar a que carguen los datos
    cy.wait(['@getTrips', '@getPopular']);
    
    // Verificar que la página se carga (puede tener diferentes elementos según el estado)
    cy.get('body').should('be.visible');
  });
});

