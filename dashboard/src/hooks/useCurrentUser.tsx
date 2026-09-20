import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { VoyagestarUser } from "../api/modules/auth";

type CurrentUserContextValue = {
  user: VoyagestarUser | null;
  setUser: Dispatch<SetStateAction<VoyagestarUser | null>>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  user,
  setUser,
  children,
}: {
  user: VoyagestarUser | null;
  setUser: Dispatch<SetStateAction<VoyagestarUser | null>>;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ user, setUser }), [user, setUser]);
  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/**
 * Current authenticated user from AuthGuard's ``/auth/me`` result.
 * ``null`` while loading or when the provider is not mounted.
 */
export function useCurrentUser(): VoyagestarUser | null {
  return useContext(CurrentUserContext)?.user ?? null;
}

export function useSetCurrentUser(): Dispatch<
  SetStateAction<VoyagestarUser | null>
> {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    return () => undefined;
  }
  return ctx.setUser;
}
