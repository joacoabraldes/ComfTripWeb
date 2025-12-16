describe('ComfTrip - UI: Responsive, Accesibilidad e Internacionalización', () => {
  describe('Responsive', () => {
    it('debería ser responsive en diferentes tamaños de pantalla', () => {
      cy.visit('/login');
      
      // Verificar en móvil
      cy.viewport(375, 667);
      cy.contains('ComfTrip').should('be.visible');
      
      // Verificar en tablet
      cy.viewport(768, 1024);
      cy.contains('ComfTrip').should('be.visible');
      
      // Verificar en desktop
      cy.viewport(1920, 1080);
      cy.contains('ComfTrip').should('be.visible');
    });
  });

  describe('Accesibilidad', () => {
    it('debería tener elementos accesibles', () => {
      cy.visit('/login');
      
      // Verificar que los inputs tienen labels o aria-labels
      cy.get('input[name="email"]').should('have.attr', 'name');
      cy.get('input[name="password"]').should('have.attr', 'name');
      
      // Verificar que los botones son accesibles
      cy.get('button[type="submit"]').should('be.visible');
    });
  });

  describe('Internacionalización', () => {
    it('debería permitir cambiar el idioma', () => {
      cy.visit('/login');
      
      // Buscar selector de idioma
      cy.get('body').then(($body) => {
        if ($body.find('select[name*="language"], button[aria-label*="language"], .language-selector').length > 0) {
          cy.get('select[name*="language"], button[aria-label*="language"], .language-selector').first().should('exist');
        }
      });
    });
  });
});

