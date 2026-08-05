import React, { createContext, useContext, useState, useEffect } from "react";
import { onSnapshot, doc, collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { RaffleConfig } from "../types";
import { localStorage } from "../utils/storage";
import { adminService } from "../services/adminService";

interface RaffleConfigContextType {
  raffleConfig: RaffleConfig;
  setRaffleConfig: React.Dispatch<React.SetStateAction<RaffleConfig>>;
  isConfigLoaded: boolean;
  selectedRaffleId: string;
  setSelectedRaffleId: (id: string) => void;
  raffles: RaffleConfig[];
  fetchRaffles: () => Promise<void>;
}

const EMPTY_CONFIG: RaffleConfig = {
  id: "",
  title: "",
  description: "",
  price: 0,
  totalNumbers: 100,
  isActive: false,
  imageUrl: "",
  pixKey: "",
  pixReceiver: "",
  pixBank: "",
  pixPhone: "",
  pixKeyType: "",
  pixBankLogo: "",
  winnerNumber: "",
  winnerName: "",
  isRaffleActive: false,
  promotionEnabled: false,
  promotionBuy: 5,
  promotionBonus: 1,
  status: "pausada",
};

const DEFAULT_CONFIG: RaffleConfig = { ...EMPTY_CONFIG };

const RaffleConfigContext = createContext<RaffleConfigContextType | undefined>(undefined);

export function RaffleConfigProvider({ children }: { children: React.ReactNode }) {
  const [selectedRaffleId, setSelectedRaffleIdState] = useState<string>(() => {
    try {
      return localStorage.getItem("selected_raffle_id") || "";
    } catch {
      return "";
    }
  });

  const setSelectedRaffleId = (id: string) => {
    setSelectedRaffleIdState(id);
    try {
      if (id) {
        localStorage.setItem("selected_raffle_id", id);
      } else {
        localStorage.removeItem("selected_raffle_id");
      }
    } catch (e) {
      console.error("Failed setting selected_raffle_id", e);
    }
  };

  const [raffles, setRaffles] = useState<RaffleConfig[]>([]);
  const [raffleConfig, setRaffleConfig] = useState<RaffleConfig>(() => {
    try {
      const saved = localStorage.getItem("raffle_config_v1");
      return saved ? { ...EMPTY_CONFIG, ...JSON.parse(saved) } : EMPTY_CONFIG;
    } catch {
      return EMPTY_CONFIG;
    }
  });
  const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

  const fetchRaffles = async () => {
    try {
      const adminToken = localStorage.getItem("admin_token") || localStorage.getItem("raffle_admin_token") || "";
      if (!adminToken) return;
      const list = await adminService.listRaffles(adminToken);
      if (Array.isArray(list)) {
        setRaffles(list);
        if (list.length === 0) {
          setSelectedRaffleIdState("");
          setRaffleConfig(EMPTY_CONFIG);
          setIsConfigLoaded(true);
          try {
            localStorage.removeItem("selected_raffle_id");
            localStorage.removeItem("raffle_config_v1");
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Failed to fetch raffles list:", err);
    }
  };

  useEffect(() => {
    fetchRaffles();
    // Realtime collection subscription
    const colRef = collection(db, "raffles");
    const unsubRaffles = onSnapshot(
      colRef,
      (snapshot) => {
        const list: RaffleConfig[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.id === "global_pix") return;
          const data = docSnap.data() as RaffleConfig;
          list.push({
            ...EMPTY_CONFIG,
            ...data,
            id: docSnap.id,
            status: data.status || (data.isRaffleActive !== false ? "ativa" : "pausada"),
          });
        });
        setRaffles(list);
        if (list.length === 0) {
          setSelectedRaffleIdState("");
          setRaffleConfig(EMPTY_CONFIG);
          setIsConfigLoaded(true);
          try {
            localStorage.removeItem("selected_raffle_id");
            localStorage.removeItem("raffle_config_v1");
          } catch (e) {}
        } else {
          setSelectedRaffleIdState((prevId) => {
            if (prevId && list.some((r) => r.id === prevId)) {
              return prevId;
            }
            return list[0].id;
          });
        }
      },
      (err) => {
        console.error("Failed realtime raffles listener:", err);
      }
    );
    return () => unsubRaffles();
  }, []);

  useEffect(() => {
    if (!selectedRaffleId) {
      setRaffleConfig(EMPTY_CONFIG);
      setIsConfigLoaded(true);
      return;
    }

    console.log(`🔗 [REALTIME_CONFIG_SETUP] Setting up listener for 'raffles/${selectedRaffleId}'...`);
    
    const docRef = doc(db, "raffles", selectedRaffleId);
    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as RaffleConfig;
          const mergedData = {
            ...EMPTY_CONFIG,
            ...data,
            id: docSnap.id,
            isActive: data.isActive !== false,
            isRaffleActive: data.isRaffleActive !== false,
          };

          setRaffleConfig(mergedData);
          
          try {
            localStorage.setItem("raffle_config_v1", JSON.stringify(mergedData));
          } catch (storageErr) {
            console.error("Failed to cache raffle config into localStorage:", storageErr);
          }
        } else {
          // Document does not exist (deleted)
          setRaffleConfig(EMPTY_CONFIG);
          try {
            localStorage.removeItem("raffle_config_v1");
          } catch (e) {}
        }
        setIsConfigLoaded(true);
      },
      (error) => {
        console.error(`🔴 [REALTIME_CONFIG_ERROR] Failed during realtime config sync for ${selectedRaffleId}:`, error);
        setIsConfigLoaded(true);
      }
    );

    return () => {
      unsub();
    };
  }, [selectedRaffleId]);

  return (
    <RaffleConfigContext.Provider value={{
      raffleConfig,
      setRaffleConfig,
      isConfigLoaded,
      selectedRaffleId,
      setSelectedRaffleId,
      raffles,
      fetchRaffles
    }}>
      {children}
    </RaffleConfigContext.Provider>
  );
}

export function useRaffleConfig() {
  const context = useContext(RaffleConfigContext);
  if (!context) {
    throw new Error("useRaffleConfig must be used within a RaffleConfigProvider");
  }
  return context;
}
