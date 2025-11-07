// Custom commands for NeetLogIQ testing

Cypress.Commands.add('login', () => {
  // Add login logic here when Firebase auth is implemented
  cy.log('Login command - to be implemented')
})

Cypress.Commands.add('searchFor', (query: string) => {
  cy.get('input[type="search"], input[placeholder*="search" i]').type(query)
  cy.get('button[type="submit"], button:contains("Search")').click()
})
