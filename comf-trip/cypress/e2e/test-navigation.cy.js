describe('ComfTrip - Navegación y Rutas Protegidas', () => {
  it('debería redirigir a /login cuando se accede a la raíz', () => {
    cy.visit('/');
    cy.url().should('include', '/login');
  });

  it('debería redirigir a /login cuando se accede a una ruta protegida sin autenticación', () => {
    cy.visit('/home');
    cy.url().should('include', '/login');
    
    cy.visit('/trips');
    cy.url().should('include', '/login');
    
    cy.visit('/profile');
    cy.url().should('include', '/login');
  });

  it('debería permitir acceder a rutas públicas sin autenticación', () => {
    cy.visit('/login');
    cy.url().should('include', '/login');
    cy.contains('ComfTrip').should('be.visible');
    
    cy.visit('/register');
    cy.url().should('include', '/register');
    
    cy.visit('/recover-password');
    cy.url().should('include', '/recover-password');
  });
});

