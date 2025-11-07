describe('NeetLogIQ E2E Tests', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should load the homepage', () => {
    cy.contains('NeetLogIQ').should('be.visible')
    cy.get('h1').should('be.visible')
  })

  it('should have working navigation', () => {
    cy.get('nav').should('be.visible')
    cy.get('a[href*="/colleges"]').should('be.visible')
    cy.get('a[href*="/courses"]').should('be.visible')
  })

  it('should be responsive', () => {
    cy.viewport(375, 667) // Mobile viewport
    cy.get('nav').should('be.visible')
    
    cy.viewport(1280, 720) // Desktop viewport
    cy.get('nav').should('be.visible')
  })
})
