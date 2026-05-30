import { createContext, useCallback, useContext, type PropsWithChildren } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { logout as logoutAction } from "../store/authSlice";
import type { Role } from "../types";

interface AuthContextValue {
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);
  const logout = useCallback(() => dispatch(logoutAction()), [dispatch]);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, hasRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

