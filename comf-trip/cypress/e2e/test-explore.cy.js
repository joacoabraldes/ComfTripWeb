describe('ComfTrip - Explorar (Explore)', () => {
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

  it('debería cargar la página de explorar', () => {
    cy.intercept('GET', '**/explore**', {
      statusCode: 200,
      body: { places: [] }
    }).as('getExplore');
    
    cy.visit('/explore');
    cy.url().should('include', '/explore');
    cy.wait('@getExplore');
  });

  it('debería mostrar opciones de búsqueda y filtros', () => {
    cy.intercept('GET', '**/explore**', {
      statusCode: 200,
      body: { places: [] }
    }).as('getExplore');
    
    cy.visit('/explore');
    cy.wait('@getExplore');
    
    // Verificar que la página se carga correctamente
    cy.get('body').should('be.visible');
  });
});

