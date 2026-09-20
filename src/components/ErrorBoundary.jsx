// src/components/ErrorBoundary.jsx
// „Plasă de siguranță": prinde un crash de randare și arată un fallback,
// în loc să lase ecranul alb. Raportează automat eroarea.
import { Component } from 'react'
import { reportError } from '../lib/errorReporting'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    reportError(error, {
      componentStack: info?.componentStack,
      source: 'react',
      boundary: this.props.name || 'app',
    })
  }

  handleReload = () => {
    if (this.props.reloadPage) {
      window.location.reload()
    } else {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: '2rem 1.25rem', textAlign: 'center', color: '#c9ccd1',
          fontFamily: 'system-ui, sans-serif',
          minHeight: this.props.full ? '100vh' : undefined,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, background: this.props.full ? '#0E0F12' : undefined,
        }}>
          <div style={{ fontSize: 30 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e8eaed' }}>Ceva nu a mers aici</div>
          <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
            Partea asta s-a blocat, dar restul aplicației funcționează. Am notat problema automat.
          </div>
          <button onClick={this.handleReload} style={{
            marginTop: 6, padding: '9px 16px', background: '#22c55e', color: '#0E0F12',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Reîncarcă
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
