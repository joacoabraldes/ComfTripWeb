describe('ComfTrip - Recuperación de Contraseña', () => {
  beforeEach(() => {
    cy.visit('/recover-password');
  });

  it('debería mostrar el formulario de recuperación de contraseña', () => {
    cy.contains('Recover Password').should('exist');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('debería validar el campo de email', () => {
    cy.get('input[type="email"]').should('have.attr', 'required');
    cy.get('button[type="submit"]').click();
    
    // Verificar validación HTML5
    cy.get('input[type="email"]:invalid').should('exist');
  });

  it('debería permitir enviar solicitud de recuperación', () => {
    cy.intercept('POST', '**/recover-password', {
      statusCode: 200,
      body: { message: 'Email enviado' }
    }).as('recoverRequest');
    
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('button[type="submit"]').click();
    
    cy.wait('@recoverRequest');
  });

  it('debería permitir volver al login', () => {
    cy.contains('Login').click();
    cy.url().should('include', '/login');
  });
});

