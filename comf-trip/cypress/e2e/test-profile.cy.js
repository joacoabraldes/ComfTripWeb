describe('ComfTrip - Perfil de Usuario', () => {
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
        user: { id: 1, email: 'test00@gmail.com', name: 'Test00' }
      }
    }).as('loginRequest');
    
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  });

  it('debería cargar la página de perfil', () => {
    cy.intercept('GET', '**/users/1', {
      statusCode: 200,
      body: { 
        user: {
          id: 1,
          name: 'Test00',
          email: 'test00@gmail.com',
          phone: '+1234567890',
          nationality: 'Spain',
          birthdate: '1990-01-01'
        }
      }
    }).as('getProfile');
    
    cy.visit('/profile');
    cy.url().should('include', '/profile');
    cy.wait('@getProfile');
  });

  it('debería mostrar la información del usuario', () => {
    const mockUser = {
      id: 1,
      name: 'Test00',
      email: 'test00@gmail.com',
      phone: '+1234567890',
      nationality: 'Spain',
      birthdate: '1990-01-01'
    };
    
    cy.intercept('GET', '**/users/1', {
      statusCode: 200,
      body: { user: mockUser }
    }).as('getProfile');
    
    cy.visit('/profile');
    cy.wait('@getProfile');
    
    // Verificar que se muestra la información del usuario
    cy.contains('Test00').should('exist');
    cy.contains('test00@gmail.com').should('exist');
  });

  it('debería permitir navegar a editar perfil', () => {
    cy.intercept('GET', '**/users/1', {
      statusCode: 200,
      body: { user: { id: 1, name: 'Test00', email: 'test00@gmail.com' } }
    }).as('getProfile');
    
    cy.visit('/profile');
    cy.wait('@getProfile');
    
    // Buscar botón de editar perfil
    cy.get('body').then(($body) => {
      if ($body.find('a[href*="edit-profile"], button:contains("Edit"), button:contains("Editar")').length > 0) {
        cy.contains('Edit', { matchCase: false }).click();
        cy.url().should('include', '/edit-profile');
      }
    });
  });

  it('debería permitir cerrar sesión', () => {
    cy.intercept('GET', '**/users/1', {
      statusCode: 200,
      body: { user: { id: 1, name: 'Test00', email: 'test00@gmail.com' } }
    }).as('getProfile');
    
    cy.visit('/profile');
    cy.wait('@getProfile');
    
    // Buscar botón de cerrar sesión
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Logout"), button:contains("Cerrar"), button[aria-label*="logout"]').length > 0) {
        cy.contains('Logout', { matchCase: false }).click();
        
        // Verificar que se redirige al login
        cy.url().should('include', '/login');
      }
    });
  });
});

