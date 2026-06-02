import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Mount the branded confirm modal once at the root. Any descendant
// component can call `useConfirm()` to prompt the user without
// falling back to window.confirm.
import { ConfirmDialogProvider } from './components/ConfirmDialog.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfirmDialogProvider>
      <App />
    </ConfirmDialogProvider>
  </React.StrictMode>,
)
