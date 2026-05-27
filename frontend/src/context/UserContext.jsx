import { createContext, useContext } from 'react'

export const UserContext = createContext({
  userEmail: '',
  signOut: () => {},
})

export function useAppUser() {
  return useContext(UserContext)
}
