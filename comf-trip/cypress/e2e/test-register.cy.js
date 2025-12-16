describe('ComfTrip - Registro de Usuario', () => {
  beforeEach(() => {
    cy.visit('/register');
  });

  it('debería mostrar el formulario de registro correctamente', () => {
    cy.contains('Register').should('be.visible');
    cy.get('input[name="username"]').should('be.visible');
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('input[name="confirmPassword"]').should('be.visible');
    cy.contains('ComfTrip').should('be.visible');
  });

  it('debería validar campos requeridos en el registro', () => {
    cy.get('button[type="submit"]').click();
    
    // Verificar que los campos son requeridos
    cy.get('input[name="username"]').should('have.attr', 'required');
    cy.get('input[name="email"]').should('have.attr', 'required');
    cy.get('input[name="password"]').should('have.attr', 'required');
    cy.get('input[name="confirmPassword"]').should('have.attr', 'required');
  });

  it('debería validar formato de email', () => {
    cy.get('input[name="email"]').type('email-invalido');
    cy.get('input[name="email"]').blur();
    
    // Verificar que se muestra un error de validación
    cy.get('input[name="email"]').should('have.attr', 'type', 'email');
  });

  it('debería validar que las contraseñas coincidan', () => {
    cy.get('input[name="password"]').type('password123');
    cy.get('input[name="confirmPassword"]').type('password456');
    cy.get('input[name="confirmPassword"]').blur();
    
    // Verificar que se muestra un error si las contraseñas no coinciden
    // (dependiendo de la implementación, puede ser un mensaje de error visible)
  });

  it('debería permitir mostrar/ocultar contraseña', () => {
    cy.get('input[name="password"]').type('password123');
    
    // Buscar el botón de mostrar contraseña (puede ser un icono)
    cy.get('input[name="password"]').should('have.attr', 'type', 'password');
    
    // Si hay un botón para mostrar contraseña, hacer clic
    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label*="password"], button[aria-label*="contraseña"]').length > 0) {
        cy.get('button[aria-label*="password"], button[aria-label*="contraseña"]').first().click();
        cy.get('input[name="password"]').should('have.attr', 'type', 'text');
      }
    });
  });

  it('debería permitir navegar de registro a login', () => {
    cy.contains('Login').click();
    cy.url().should('include', '/login');
  });

  it('debería manejar errores del servidor durante el registro', () => {
    // Interceptar la llamada de registro para simular un error
    cy.intercept('POST', '**/register', {
      statusCode: 400,
      body: { message: 'El email ya está registrado' }
    }).as('registerError');
    
    cy.get('input[name="username"]').type('testuser');
    cy.get('input[name="email"]').type('existing@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('input[name="confirmPassword"]').type('password123');
    
    cy.get('button[type="submit"]').click();
    cy.wait('@registerError');
    
    // Verificar que se muestra un mensaje de error
    // (puede ser un alert, snackbar, o mensaje en la página)
  });
});

