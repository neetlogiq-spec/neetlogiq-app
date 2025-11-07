import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Example test component
const ExampleComponent = () => {
  return <div>Hello NeetLogIQ!</div>
}

describe('Example Component', () => {
  it('renders correctly', () => {
    render(<ExampleComponent />)
    expect(screen.getByText('Hello NeetLogIQ!')).toBeInTheDocument()
  })
})
