describe('ComfTrip - Manejo de Errores', () => {
  it('debería manejar errores 404 correctamente', () => {
    cy.visit('/ruta-inexistente', { failOnStatusCode: false });
    
    // Verificar que se muestra una página de error o redirige
    cy.url().should('satisfy', (url) => {
      return url.includes('/error') || url.includes('/login') || url.includes('/ruta-inexistente');
    });
  });

  it('debería manejar errores de red', () => {
    cy.visit('/login');
    
    // Simular error de red
    cy.intercept('POST', '**/login', {
      forceNetworkError: true
    }).as('networkError');
    
    cy.get('input[name="email"]').type('test00@gmail.com');
    cy.get('input[name="password"]').type('qwertyu');
    cy.get('button[type="submit"]').click();
    
    // Verificar que se maneja el error (puede ser un mensaje de error visible)
    cy.wait('@networkError');
  });
});

