import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, Caretaker, ElderlyUser } from '@/services/api';

interface AppContextType {
  caretaker: Caretaker | null;
  allCaretakers: Caretaker[];
  elderlyUsers: ElderlyUser[];
  selectedUser: ElderlyUser | null;
  loading: boolean;
  error: string | null;
  setCaretaker: (caretaker: Caretaker) => void;
  setSelectedUser: (user: ElderlyUser | null) => void;
  refreshData: () => Promise<void>;
  // Caretaker CRUD
  addCaretaker: (data: { name: string; email: string; contact: string }) => Promise<Caretaker>;
  updateCaretaker: (caretakerId: string, data: { name?: string; email?: string; contact?: string }) => Promise<Caretaker>;
  deleteCaretaker: (caretakerId: string) => Promise<void>;
  // Elderly User CRUD
  addElderlyUser: (data: { name: string; age: number; relation: string; contact: string }) => Promise<ElderlyUser>;
  updateElderlyUser: (userId: string, data: { name?: string; age?: number; relation?: string; contact?: string }) => Promise<ElderlyUser>;
  deleteElderlyUser: (userId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [caretaker, setCaretakerState] = useState<Caretaker | null>(null);
  const [allCaretakers, setAllCaretakers] = useState<Caretaker[]>([]);
  const [elderlyUsers, setElderlyUsers] = useState<ElderlyUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ElderlyUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsersForCaretaker = async (cId: string) => {
    try {
      const users = await api.getCaretakerUsers(cId);
      setElderlyUsers(users);
      if (users.length > 0) {
        setSelectedUser((prev) => {
          if (prev) {
            const match = users.find((u) => u.id === prev.id);
            return match || users[0];
          }
          return users[0];
        });
      } else {
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Error fetching users for caretaker:', err);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all caretakers
      const caretakersList = await api.getAllCaretakers().catch(() => []);
      setAllCaretakers(caretakersList);

      // Fetch or seed current active caretaker ("Steve Rogers")
      const currentCaretaker = await api.getCurrentCaretaker();
      setCaretakerState(currentCaretaker);

      // Ensure active caretaker is in list
      if (!caretakersList.find((c) => c.id === currentCaretaker.id)) {
        setAllCaretakers((prev) => [...prev, currentCaretaker]);
      }

      // Fetch users for active caretaker
      await fetchUsersForCaretaker(currentCaretaker.id);
    } catch (err: any) {
      console.error('Error loading AppContext data:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setCaretaker = async (newCaretaker: Caretaker) => {
    setCaretakerState(newCaretaker);
    await fetchUsersForCaretaker(newCaretaker.id);
  };

  // Caretaker CRUD
  const addCaretaker = async (data: { name: string; email: string; contact: string }) => {
    const newCaretaker = await api.createCaretaker(data);
    setAllCaretakers((prev) => [...prev, newCaretaker]);
    setCaretaker(newCaretaker);
    return newCaretaker;
  };

  const updateCaretaker = async (
    caretakerId: string,
    data: { name?: string; email?: string; contact?: string }
  ) => {
    const updated = await api.updateCaretaker(caretakerId, data);
    setAllCaretakers((prev) => prev.map((c) => (c.id === caretakerId ? updated : c)));
    if (caretaker?.id === caretakerId) {
      setCaretakerState(updated);
    }
    return updated;
  };

  const deleteCaretaker = async (caretakerId: string) => {
    await api.deleteCaretaker(caretakerId);
    setAllCaretakers((prev) => {
      const nextList = prev.filter((c) => c.id !== caretakerId);
      if (caretaker?.id === caretakerId && nextList.length > 0) {
        setCaretaker(nextList[0]);
      }
      return nextList;
    });
  };

  // Elderly User CRUD
  const addElderlyUser = async (data: { name: string; age: number; relation: string; contact: string }) => {
    if (!caretaker) {
      throw new Error('No active caretaker found');
    }
    const newUser = await api.addElderlyUser(caretaker.id, data);
    setElderlyUsers((prev) => [...prev, newUser]);
    setSelectedUser(newUser);
    return newUser;
  };

  const updateElderlyUser = async (
    userId: string,
    data: { name?: string; age?: number; relation?: string; contact?: string }
  ) => {
    const updated = await api.updateElderlyUser(userId, data);
    setElderlyUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    if (selectedUser?.id === userId) {
      setSelectedUser(updated);
    }
    return updated;
  };

  const deleteElderlyUser = async (userId: string) => {
    await api.deleteElderlyUser(userId);
    setElderlyUsers((prev) => {
      const nextList = prev.filter((u) => u.id !== userId);
      if (selectedUser?.id === userId) {
        setSelectedUser(nextList.length > 0 ? nextList[0] : null);
      }
      return nextList;
    });
  };

  return (
    <AppContext.Provider
      value={{
        caretaker,
        allCaretakers,
        elderlyUsers,
        selectedUser,
        loading,
        error,
        setCaretaker,
        setSelectedUser,
        refreshData: loadData,
        addCaretaker,
        updateCaretaker,
        deleteCaretaker,
        addElderlyUser,
        updateElderlyUser,
        deleteElderlyUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
