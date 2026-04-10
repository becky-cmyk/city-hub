import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AdminEditTarget {
  section: string;
  entityId: string;
  label?: string;
}

interface AdminEditContextType {
  target: AdminEditTarget | null;
  setTarget: (target: AdminEditTarget | null) => void;
}

const AdminEditContext = createContext<AdminEditContextType>({
  target: null,
  setTarget: () => {},
});

export function AdminEditProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<AdminEditTarget | null>(null);

  return (
    <AdminEditContext.Provider value={{ target, setTarget }}>
      {children}
    </AdminEditContext.Provider>
  );
}

export function useAdminEdit() {
  return useContext(AdminEditContext);
}

export function useRegisterAdminEdit(section: string, entityId: string | undefined | null, label?: string) {
  const { setTarget } = useAdminEdit();

  useEffect(() => {
    if (entityId) {
      setTarget({ section, entityId, label });
    }
    return () => setTarget(null);
  }, [section, entityId, label, setTarget]);
}
