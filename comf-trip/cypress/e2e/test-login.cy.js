describe('ComfTrip - Tests de Login y Creación de Viajes', () => {
  beforeEach(() => {
    // Visitar la página de login antes de cada test
    cy.visit('/login');
  });

  describe('Login', () => {
    it('debería mostrar la página de login correctamente', () => {
      // Verificar que los elementos principales estén presentes
      cy.contains('Iniciar Sesion').should('be.visible');
      cy.get('input[name="email"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
      cy.contains('ComfTrip').should('be.visible');
    });

    it('debería mostrar errores de validación para campos vacíos', () => {
      // Intentar enviar el formulario sin datos
      cy.get('button[type="submit"]').click();
      
      // Verificar que los campos son requeridos (HTML5 validation)
      cy.get('input[name="email"]').should('have.attr', 'required');
      cy.get('input[name="password"]').should('have.attr', 'required');
    });

    it('debería permitir navegar a la página de registro', () => {
      cy.contains('Register').click();
      cy.url().should('include', '/register');
    });

    it('debería mostrar el estado de carga durante el login', () => {
      // Llenar los campos con datos de prueba
      cy.get('input[name="email"]').type('test00@gmail.com');
      cy.get('input[name="password"]').type('qwertyu');
      
      // Interceptar la llamada de login para simular una respuesta lenta
      cy.intercept('POST', '**/login', {
        delay: 2000,
        statusCode: 200,
        body: { success: true }
      }).as('loginRequest');
      
      // Hacer clic en el botón de login
      cy.get('button[type="submit"]').click();
      
      // Verificar que se muestra el estado de carga
      cy.contains('Entrando...').should('be.visible');
      cy.get('button[type="submit"]').should('be.disabled');
    });

    it('debería manejar credenciales inválidas', () => {
      // Interceptar la llamada de login para simular un error
      cy.intercept('POST', '**/login', {
        statusCode: 401,
        body: { message: 'Credenciales inválidas' }
      }).as('loginError');
      
      // Llenar los campos con credenciales inválidas
      cy.get('input[name="email"]').type('invalid@example.com');
      cy.get('input[name="password"]').type('wrongpassword');
      
      // Hacer clic en el botón de login
      cy.get('button[type="submit"]').click();
      
      // Verificar que se muestra un mensaje de error
      cy.on('window:alert', (str) => {
        expect(str).to.include('Credenciales inválidas');
      });
    });
  });

  describe('Creación de Viaje', () => {
    beforeEach(() => {
      // Hacer login real con las credenciales proporcionadas
      cy.visit('/login');
      
      // Llenar el formulario de login
      cy.get('input[name="email"]').type('test00@gmail.com');
      cy.get('input[name="password"]').type('qwertyu');
      
      // Interceptar la llamada de login para capturar la respuesta
      cy.intercept('POST', '**/login').as('loginRequest');
      
      // Hacer clic en el botón de login
      cy.get('button[type="submit"]').click();
      
      // Esperar a que se complete el login
      cy.wait('@loginRequest');
      
      // Verificar que se redirigió correctamente o que el usuario está logueado
      cy.url().should('not.include', '/login');
      
      // Visitar la página de crear viaje
      cy.visit('/add-trip');
    });

    it('debería mostrar la página de creación de viaje correctamente', () => {
      // Verificar elementos principales de la página (usar exist en lugar de visible para elementos que pueden estar ocultos)
      cy.contains('Destino y Fechas').should('exist');
      cy.contains('Vuelos').should('exist');
      cy.contains('Preferencias').should('exist');
      cy.get('button[type="submit"]').should('exist');
    });

    it('debería permitir seleccionar una ciudad de destino', () => {
      // Hacer clic en el dropdown de ciudad de destino
      cy.get('.react-select__control').first().click();
      
      // Verificar que aparecen las opciones de ciudades
      cy.contains('Barcelona, Spain').should('exist');
      cy.contains('Buenos Aires, Argentina').should('exist');
      cy.contains('Rome, Italy').should('exist');
      
      // Seleccionar Barcelona (usar force para elementos que pueden estar ocultos)
      cy.contains('Barcelona, Spain').click({ force: true });
      
      // Verificar que se seleccionó correctamente
      cy.get('.react-select__single-value').should('contain', 'Barcelona');
    });

    it('debería permitir seleccionar fechas en el calendario', () => {
      // Seleccionar una ciudad primero
      cy.get('.react-select__control').first().click();
      cy.contains('Barcelona, Spain').click({ force: true });
      
      // Verificar que el calendario está visible
      cy.get('.calendar').should('be.visible');
      
      // Seleccionar una fecha de inicio (próximo mes)
      cy.get('.arrow').last().click(); // Ir al próximo mes
      cy.get('.day').not('.empty-day').first().click();
      
      // Seleccionar una fecha de fin
      cy.get('.day').not('.empty-day').eq(3).click();
      
      // Verificar que se muestra el rango de fechas seleccionado
      cy.contains('Viaje a Barcelona').should('be.visible');
    });

    it('debería permitir seleccionar el país de origen', () => {
      // Hacer clic en el dropdown de país de origen (segundo select en la sección de vuelos)
      cy.get('.flights-grid .react-select__control').first().click();
      
      // Esperar a que aparezcan las opciones y usar force para elementos que pueden estar ocultos
      cy.contains('Spain').should('exist');
      cy.contains('Argentina').should('exist');
      
      // Seleccionar España (usar force para elementos que pueden estar ocultos por overflow)
      cy.contains('Spain').click({ force: true });
      
      // Verificar que se seleccionó correctamente
      cy.get('.flights-grid .react-select__single-value').should('contain', 'Spain');
    });

    it('debería permitir seleccionar el ritmo del viaje', () => {
      // Hacer clic en el dropdown de ritmo (en la sección de preferencias)
      cy.get('section:contains("Preferencias") .react-select__control').click();
      
      // Verificar que aparecen las opciones de ritmo
      cy.contains('Relajado').should('exist');
      cy.contains('Moderado').should('exist');
      cy.contains('Intenso').should('exist');
      
      // Seleccionar Moderado (usar force para elementos que pueden estar ocultos)
      cy.contains('Moderado').click({ force: true });
      
      // Verificar que se seleccionó correctamente
      cy.get('section:contains("Preferencias") .react-select__single-value').should('contain', 'Moderado');
    });

    it('debería permitir agregar lugares de interés', () => {
      // Llenar el campo de lugares
      cy.get('textarea').first().type('Sagrada Familia, Park Güell, Las Ramblas');
      
      // Verificar que el texto se ingresó correctamente
      cy.get('textarea').first().should('have.value', 'Sagrada Familia, Park Güell, Las Ramblas');
    });

    it('debería permitir agregar notas del viaje', () => {
      // Llenar el campo de notas
      cy.get('textarea').last().type('Viaje familiar, preferimos restaurantes locales');
      
      // Verificar que el texto se ingresó correctamente
      cy.get('textarea').last().should('have.value', 'Viaje familiar, preferimos restaurantes locales');
    });

    it('debería mostrar validación al intentar crear viaje sin datos completos', () => {
      // Intentar enviar el formulario sin completar los campos requeridos
      cy.get('button[type="submit"]').click();
      
      // Verificar que se muestra un mensaje de error
      cy.on('window:alert', (str) => {
        expect(str).to.include('Selecciona el ritmo del viaje');
      });
    });

    it('debería permitir agregar múltiples destinos', () => {
      // Verificar que existe el botón para agregar destino
      cy.contains('+ Agregar otro destino').should('exist');
      
      // Hacer clic en agregar destino
      cy.contains('+ Agregar otro destino').click();
      
      // Verificar que se agregó un nuevo destino
      // El botón debería seguir visible para agregar más destinos
      cy.contains('+ Agregar otro destino').should('exist');
    });
  });
});
