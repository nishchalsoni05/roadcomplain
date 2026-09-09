import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)
const ADMIN_EMAIL = 'admin@gmail.com'
const STORAGE_KEY = 'margdarshan_auth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
  })

  const login = (email, password) => {
    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL
    const userData = {
      email: email.toLowerCase().trim(),
      isAdmin,
      name: isAdmin ? 'Ministry Admin' : email.split('@')[0],
      role: isAdmin ? 'super_admin' : 'user',
      loginTime: new Date().toISOString(),
    }
    setUser(userData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    return isAdmin
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.isAdmin ?? false }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
