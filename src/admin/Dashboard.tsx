import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShieldCheck, RefreshCw, Trash2, X, Smartphone, Zap, Trophy,
  ChevronDown, Search, Filter, ShieldAlert, Download, Upload,
  DollarSign, Check, Calendar, Phone, ArrowLeft, LogOut, MessageCircle, CheckCircle2,
  Image as ImageIcon, Loader2, Play, LayoutDashboard, ClipboardList, PlusCircle, Award, Settings,
  Copy, Edit3, Archive, Power, Sparkles, Eye, CheckCircle, Pause, ShoppingBag, Ticket, Save, FolderOpen,
  Calculator, Users, Grid, Star, BarChart3, TrendingUp, PieChart as PieChartIcon, Clock
} from "lucide-react";

import { db } from "../services/firebase";
import { adminService } from "../services/adminService";
import { performRobustImageUpload } from "../services/uploadService";
import { realtimeService } from "../realtime/realtimeService";
import { RaffleConfig } from "../types";
import { collection, getDocs, onSnapshot, doc, updateDoc, getDoc, query, where } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { useRaffleConfig } from "./RaffleConfigContext";
import { AdminProducts } from "./AdminProducts";
import { storeService } from "../services/storeService";
import { slugify } from "../utils/slug";
import { safeCopyToClipboard } from "../utils/helpers";
import { localStorage } from "../utils/storage";

// Supabase Views
import { PurchasesView } from "./views/PurchasesView";
import { NotificationsView } from "./views/NotificationsView";
import { AuditView } from "./views/AuditView";
import { DrawsView } from "./views/DrawsView";
import { getSupabaseClient } from "../services/supabase/supabaseClient";

// ... [rest of the file imports/state/etc]
// Need to find where to add `winnersList` and `editingWinner` state
// I will just add them near other state declarations.

// I will insert state variables and useEffect.

interface DashboardProps {
  currentPath?: string;
  setCurrentPath?: (path: string) => void;
}

const FEDERAL_RULES = [
  { id: "ultimo_digito_1", label: "Último dígito do 1º prêmio", description: "Utiliza o último algarismo do 1º prêmio oficial (ex: 48325 -> 5).", fieldsNeeded: 1 },
  { id: "ultimos_2_digitos_1", label: "Últimos 2 dígitos do 1º prêmio", description: "Utiliza os 2 últimos algarismos do 1º prêmio oficial (ex: 48325 -> 25).", fieldsNeeded: 1 },
  { id: "ultimos_3_digitos_1", label: "Últimos 3 dígitos do 1º prêmio", description: "Utiliza os 3 últimos algarismos do 1º prêmio oficial (ex: 48325 -> 325).", fieldsNeeded: 1 },
  { id: "ultimos_4_digitos_1", label: "Últimos 4 dígitos do 1º prêmio", description: "Utiliza os 4 últimos algarismos do 1º prêmio oficial (ex: 48325 -> 8325).", fieldsNeeded: 1 },
  { id: "completo_1", label: "Número completo do 1º prêmio", description: "Utiliza o número inteiro de 5 dígitos do 1º prêmio oficial (ex: 48325 -> 48325).", fieldsNeeded: 1 },
  { id: "soma_cinco", label: "Soma dos cinco prêmios", description: "Soma os valores inteiros de todos os cinco prêmios oficiais.", fieldsNeeded: 5 },
  { id: "soma_ultimos_cinco", label: "Soma dos últimos dígitos dos cinco prêmios", description: "Soma os últimos algarismos (dígitos das unidades) de cada um dos cinco prêmios.", fieldsNeeded: 5 },
  { id: "soma_personalizada", label: "Soma personalizada", description: "Soma os prêmios que você preencher, permitindo ignorar campos vazios.", fieldsNeeded: 5 },
];

function normalizeFederalRuleId(rule: string): string {
  if (!rule) return "ultimo_digito_1";
  const r = rule.trim();
  if (r === "ultimo_digito_1" || r === "ultimos_2_digitos_1" || r === "ultimos_3_digitos_1" || r === "ultimos_4_digitos_1" || r === "completo_1" || r === "soma_cinco" || r === "soma_ultimos_cinco" || r === "soma_personalizada") {
    return r;
  }
  // Map label strings to IDs
  if (r === "Último dígito do 1º prêmio" || r.includes("Último dígito")) return "ultimo_digito_1";
  if (r === "Dois últimos dígitos do 1º prêmio" || r.includes("Dois últimos")) return "ultimos_2_digitos_1";
  if (r === "Três últimos dígitos do 1º prêmio" || r.includes("Três últimos")) return "ultimos_3_digitos_1";
  if (r === "Quatro últimos dígitos do 1º prêmio" || r.includes("Quatro últimos")) return "ultimos_4_digitos_1";
  if (r === "Cinco dígitos do 1º prêmio (Número completo)" || r.includes("completo") || r.includes("Completo")) return "completo_1";
  if (r === "Combinação do 1º ao 5º prêmio" || r.includes("Combinação") || r.includes("Soma dos cinco") || r.includes("soma_cinco")) return "soma_cinco";
  
  return "ultimo_digito_1";
}

export default function Dashboard({ currentPath = "/dashboard", setCurrentPath }: DashboardProps) {
  const { logout, navigate } = useAuth();
  const getAdminToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("raffle_admin_token") || "";
    }
    return "";
  };
  const {
    raffleConfig,
    setRaffleConfig,
    isConfigLoaded,
    selectedRaffleId,
    setSelectedRaffleId,
    raffles,
    fetchRaffles
  } = useRaffleConfig();

  // Mode: "list" (Minhas Rifas screen) or "detail" (Dashboard of a specific raffle)
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [mainAdminSection, setMainAdminSection] = useState<"rifas" | "loja" | "winners_hall">("rifas");
  const [currentAdminTab, setCurrentAdminTab] = useState<"overview" | "rifas" | "orders" | "customers" | "cotas" | "winners" | "audit" | "store" | "settings" | "planning" | "notifications">("rifas");

  const AUDIT_LOGS = [
    { id: 1, date: "06/08/2026", time: "14:32:15", user: "Admin", action: "Atualização Pix", ip: "189.120.45.12", details: "Chave Pix Global alterada para CNPJ oficial", status: "success" },
    { id: 2, date: "06/08/2026", time: "13:10:42", user: "System", action: "Apuração Sorteio", ip: "CronJob", details: "Cota vencedora calculada via regra do concurso Loteria Federal", status: "success" },
    { id: 3, date: "06/08/2026", time: "11:55:01", user: "Admin", action: "Estoque Loja", ip: "189.120.45.12", details: "Produto 'Molinete Marine Sports' adicionado ao catálogo", status: "success" },
    { id: 4, date: "06/08/2026", time: "10:22:19", user: "Admin", action: "Confirmar Pagamento", ip: "189.120.45.12", details: "Manual de cota aprovado para telefone (11) 99876-5432", status: "success" },
    { id: 5, date: "05/08/2026", time: "18:40:00", user: "Admin", action: "Alterar Rifa", ip: "189.120.45.12", details: "Status de 'Equipamento Premium' alterado para ATIVO", status: "success" },
    { id: 6, date: "05/08/2026", time: "15:05:12", user: "Admin", action: "Configuração Loja", ip: "189.120.45.12", details: "Loja Premium foi ativada e disponibilizada ao público", status: "success" },
  ];

  // Tabs inside detail view
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "new_raffle" | "winners" | "draw" | "settings">("dashboard");
  const [showPlanning, setShowPlanning] = useState<boolean>(currentPath === "/dashboard/planejamento");
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  const handleSwitchAdminTab = (tab: string) => {
    setCurrentAdminTab(tab as any);
    if (tab === "overview") {
      setViewMode("detail");
      setActiveTab("dashboard");
    } else if (tab === "rifas") {
      setViewMode("list");
      setMainAdminSection("rifas");
    } else if (tab === "orders") {
      setViewMode("detail");
      setActiveTab("orders");
    } else if (tab === "customers") {
      setViewMode("detail");
      setActiveTab("customers");
    } else if (tab === "cotas") {
      setViewMode("detail");
      setActiveTab("dashboard");
    } else if (tab === "winners") {
      setViewMode("detail");
    } else if (tab === "hall_da_fama") {
      setViewMode("list");
      setMainAdminSection("winners_hall");
    } else if (tab === "planning") {
      setViewMode("detail");
      setActiveTab("dashboard");
    } else if (tab === "audit") {
      setViewMode("list");
    } else if (tab === "store") {
      setViewMode("list");
      setMainAdminSection("loja");
    } else if (tab === "settings") {
      setViewMode("detail");
      setActiveTab("settings");
    }
    setMobileNavOpen(false);
  };

  // Filter for "Minhas Rifas" list
  const [raffleListFilter, setRaffleListFilter] = useState<"todas" | "ativas" | "encerradas" | "arquivadas">("todas");
  const [raffleListSearch, setRaffleListSearch] = useState<string>("");

  // Create/Edit Raffle Modal State
  const [showRaffleModal, setShowRaffleModal] = useState<boolean>(false);
  const [editingRaffleItem, setEditingRaffleItem] = useState<RaffleConfig | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalDescription, setModalDescription] = useState<string>("");
  const [modalPrice, setModalPrice] = useState<string>("10");
  const [modalTotalNumbers, setModalTotalNumbers] = useState<string>("100");
  const [modalImageUrl, setModalImageUrl] = useState<string>("");
  const [modalPixKey, setModalPixKey] = useState<string>("");
  const [modalPixReceiver, setModalPixReceiver] = useState<string>("");
  const [modalPixBank, setModalPixBank] = useState<string>("");
  const [modalPixPhone, setModalPixPhone] = useState<string>("");
  const [modalPromoEnabled, setModalPromoEnabled] = useState<boolean>(false);
  const [modalPromoBuy, setModalPromoBuy] = useState<string>("5");
  const [modalPromoBonus, setModalPromoBonus] = useState<string>("1");
  const [modalPurchaseMode, setModalPurchaseMode] = useState<"manual" | "aleatorio">("manual");
  const [modalPaymentMode, setModalPaymentMode] = useState<"automatic" | "manual">("automatic");
  const [modalDrawMode, setModalDrawMode] = useState<"automatico" | "federal">("automatico");
  const [modalFederalConcurso, setModalFederalConcurso] = useState<string>("");
  const [modalFederalData, setModalFederalData] = useState<string>("");
  const [modalFederalRegra, setModalFederalRegra] = useState<string>("Último dígito do 1º prêmio");
  const [modalIsDestaque, setModalIsDestaque] = useState<boolean>(true);
  const [isSubmittingRaffleModal, setIsSubmittingRaffleModal] = useState<boolean>(false);
  const [uploadingModalImage, setUploadingModalImage] = useState<boolean>(false);
  const [uploadingWinnerImage, setUploadingWinnerImage] = useState<boolean>(false);
  const [uploadingPrizeImage, setUploadingPrizeImage] = useState<boolean>(false);

  // Intelligent Sweepstakes (Sorteios Loteria Federal / RifaMaster Automático) states
  const [localDrawMode, setLocalDrawMode] = useState<"automatico" | "federal" | "manual">("automatico");
  const [federalRegra, setFederalRegra] = useState<string>("ultimo_digito_1");
  const [prizes, setPrizes] = useState<string[]>(["", "", "", "", ""]);
  const [manualCotaInput, setManualCotaInput] = useState<string>("");
  const [isSavingDrawMode, setIsSavingDrawMode] = useState<boolean>(false);
  const [calculatedResult, setCalculatedResult] = useState<number | null>(null);
  const [calculatedCota, setCalculatedCota] = useState<string>("");
  const [calculationFormulaText, setCalculationFormulaText] = useState<string>("");
  const [buyerStatus, setBuyerStatus] = useState<"pago" | "pendente" | "livre">("livre");
  const [foundBuyer, setFoundBuyer] = useState<any | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
  const [drawAuditData, setDrawAuditData] = useState<any | null>(null);

  // Global Pix Configuration State
  const [showGlobalPixModal, setShowGlobalPixModal] = useState<boolean>(false);
  const [globalPixKey, setGlobalPixKey] = useState<string>("");
  const [globalPixReceiver, setGlobalPixReceiver] = useState<string>("");
  const [globalPixBank, setGlobalPixBank] = useState<string>("");
  const [globalPixPhone, setGlobalPixPhone] = useState<string>("");
  const [isSubmittingGlobalPix, setIsSubmittingGlobalPix] = useState<boolean>(false);

  // Detail view state
  const [editedConfig, setEditedConfig] = useState<RaffleConfig>({ ...raffleConfig });
  const [dbNumbers, setDbNumbers] = useState<Record<string, any>>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [paidToasts, setPaidToasts] = useState<any[]>([]);
  const [unreadPaidCount, setUnreadPaidCount] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    supabase
      .from("admin_notifications")
      .select("id", { count: "exact" })
      .eq("read", false)
      .then(({ count, error }) => {
        if (error) console.error(error);
        else if (count !== null) setUnreadNotificationsCount(count);
      });
  }, [currentAdminTab]);
  const [winnersList, setWinnersList] = useState<any[]>([]);
  const [editingWinner, setEditingWinner] = useState<any | null>(null);
  const [addingWinner, setAddingWinner] = useState<boolean>(false);
  const [winnerSearch, setWinnerSearch] = useState<string>("");
  const [winnerFilter, setWinnerFilter] = useState<"all" | "featured" | "month" | "year">("all");

  // Unarchive & Manual Draw State Variables
  const [markingAsDrawnRaffle, setMarkingAsDrawnRaffle] = useState<RaffleConfig | null>(null);
  const [manualWinnerNumberInput, setManualWinnerNumberInput] = useState<string>("");
  const [manualWinnerNameInput, setManualWinnerNameInput] = useState<string>("");
  const [manualWinnerPhoneInput, setManualWinnerPhoneInput] = useState<string>("");
  const [isSubmittingManualDraw, setIsSubmittingManualDraw] = useState<boolean>(false);

  const [isStoreEnabledGlobally, setIsStoreEnabledGlobally] = useState<boolean>(() => {
    return storeService.getLocalStoreConfig().isEnabled;
  });
  const [isSavingStoreEnabled, setIsSavingStoreEnabled] = useState<boolean>(false);

  useEffect(() => {
    const unsub = storeService.subscribeStoreConfig((cfg) => {
      setIsStoreEnabledGlobally(Boolean(cfg.isEnabled));
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Customers & Filters states
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [customerSort, setCustomerSort] = useState<"spent" | "cotas" | "orders" | "ticket">("spent");
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any | null>(null);
  const [orderPeriodFilter, setOrderPeriodFilter] = useState<string>("all");
  const [orderRaffleFilter, setOrderRaffleFilter] = useState<string>("all");

  const aggregatedCustomers = useMemo(() => {
    const map: Record<string, {
      phone: string;
      name: string;
      ordersCount: number;
      totalCotas: number;
      totalSpent: number;
      lastOrderTimestamp: number;
      lastOrderDateStr: string;
      orders: any[];
    }> = {};

    orders.forEach((ord) => {
      const rawPhone = String(ord.phone || "").replace(/\D/g, "");
      if (!rawPhone) return;
      const key = rawPhone;
      const name = String(ord.name || "Cliente sem Nome").trim();
      const st = String(ord.status || "").toLowerCase().trim();
      const isPaid =
        st === "pago" ||
        st === "paid" ||
        st === "approved" ||
        st === "aprovado" ||
        st === "confirmed" ||
        st === "paga" ||
        st === "pagas" ||
        st === "concluido" ||
        st === "concluído";
      const numsList = Array.isArray(ord.nums)
        ? ord.nums
        : (Array.isArray(ord.purchasedNums) ? ord.purchasedNums : (Array.isArray(ord.numbers) ? ord.numbers : []));
      const numsCount = numsList.length;
      const val = Number(ord.val || ord.totalValue || ord.totalAmount || 0) || 0;
      const orderTime = ord.createdAt ? new Date(ord.createdAt).getTime() : Date.now();

      if (!map[key]) {
        map[key] = {
          phone: rawPhone,
          name,
          ordersCount: 0,
          totalCotas: 0,
          totalSpent: 0,
          lastOrderTimestamp: orderTime,
          lastOrderDateStr: ord.createdAt ? new Date(ord.createdAt).toLocaleString("pt-BR") : "Recentemente",
          orders: []
        };
      }

      map[key].ordersCount += 1;
      map[key].orders.push(ord);

      if (name && name !== "Cliente sem Nome") {
        map[key].name = name;
      }

      if (isPaid) {
        map[key].totalCotas += numsCount;
        map[key].totalSpent += val;
      }

      if (orderTime > map[key].lastOrderTimestamp) {
        map[key].lastOrderTimestamp = orderTime;
        map[key].lastOrderDateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleString("pt-BR") : "Recentemente";
      }
    });

    let list = Object.values(map);

    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase().trim();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }

    list.sort((a, b) => {
      if (customerSort === "spent") return b.totalSpent - a.totalSpent;
      if (customerSort === "cotas") return b.totalCotas - a.totalCotas;
      if (customerSort === "orders") return b.ordersCount - a.ordersCount;
      if (customerSort === "ticket") {
        const ticketA = a.ordersCount > 0 ? a.totalSpent / a.ordersCount : 0;
        const ticketB = b.ordersCount > 0 ? b.totalSpent / b.ordersCount : 0;
        return ticketB - ticketA;
      }
      return b.totalSpent - a.totalSpent;
    });

    return list;
  }, [orders, customerSearch, customerSort]);
  const [newWinnerData, setNewWinnerData] = useState<any>({
    winnerName: "",
    winnerNumber: "",
    prizeTitle: "",
    prizeImageUrl: "",
    prizeDescription: "",
    prizeValue: "",
    drawDate: new Date().toLocaleDateString("pt-BR"),
    drawTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    city: "",
    state: "",
    status: "Normal", // "Destaque" ou "Normal"
    videoLink: "",
    instagram: ""
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "winners_history"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setWinnersList(list);
    }, (err) => {
      console.error("Erro no listener de winners_history:", err);
    });
    return unsub;
  }, []);

  const sortedAndFilteredWinners = useMemo(() => {
    let list = [...winnersList];

    // 1. Sort: Newest first
    list.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return String(b.drawDate || "").localeCompare(String(a.drawDate || ""));
    });

    // 2. Filter by Search
    if (winnerSearch.trim() !== "") {
      const s = winnerSearch.toLowerCase();
      list = list.filter(w => 
        String(w.winnerName || "").toLowerCase().includes(s) ||
        String(w.prizeTitle || "").toLowerCase().includes(s) ||
        String(w.raffleTitle || "").toLowerCase().includes(s) ||
        String(w.prizeDescription || "").toLowerCase().includes(s)
      );
    }

    // 3. Filter by Tab
    const now = new Date();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
    const currentYearStr = String(now.getFullYear());

    if (winnerFilter === "featured") {
      list = list.filter(w => w.status === "Destaque");
    } else if (winnerFilter === "month") {
      list = list.filter(w => {
        const dateStr = String(w.drawDate || "");
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          return parts[1] === currentMonthStr && parts[2] === currentYearStr;
        }
        return false;
      });
    } else if (winnerFilter === "year") {
      list = list.filter(w => {
        const dateStr = String(w.drawDate || "");
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          return parts[2] === currentYearStr;
        }
        return false;
      });
    }

    return list;
  }, [winnersList, winnerSearch, winnerFilter]);

  // Planning simulation inputs
  const [lucroDesejadoInput, setLucroDesejadoInput] = useState<string>("");
  const [custoPremioInput, setCustoPremioInput] = useState<string>("");
  const [taxaMPInput, setTaxaMPInput] = useState<string>("");
  const [valorCotaPlanejadoInput, setValorCotaPlanejadoInput] = useState<string>("");
  const [promoAtivaInput, setPromoAtivaInput] = useState<boolean>(false);
  const [promoBuyInput, setPromoBuyInput] = useState<string>("");
  const [promoBonusInput, setPromoBonusInput] = useState<string>("");

  // Config inputs inside settings tab
  const [priceInput, setPriceInput] = useState<string>("");
  const [totalNumbersInput, setTotalNumbersInput] = useState<string>("");

  // Sync config inputs when raffleConfig changes
  useEffect(() => {
    if (raffleConfig.price !== undefined) setPriceInput(String(raffleConfig.price));
    if (raffleConfig.totalNumbers !== undefined) setTotalNumbersInput(String(raffleConfig.totalNumbers));
    setEditedConfig({ ...raffleConfig });

    // Sync planning states
    setLucroDesejadoInput(String(raffleConfig.lucroDesejado || "5000"));
    setCustoPremioInput(String(raffleConfig.custoPremio || "1500"));
    setTaxaMPInput(String(raffleConfig.taxaMP || "4.99"));
    setValorCotaPlanejadoInput(String(raffleConfig.price || "10"));
    setPromoAtivaInput(Boolean(raffleConfig.promotionEnabled));
    setPromoBuyInput(String(raffleConfig.promotionBuy || "5"));
    setPromoBonusInput(String(raffleConfig.promotionBonus || "1"));

    // Sync intelligent sweepstakes states
    setLocalDrawMode((raffleConfig.drawMode as any) || "automatico");
    setFederalRegra(normalizeFederalRuleId(raffleConfig.federalRegra || "ultimo_digito_1"));
    setPrizes(["", "", "", "", ""]);
    setManualCotaInput("");
    setCalculatedResult(null);
    setCalculatedCota("");
    setCalculationFormulaText("");
    setBuyerStatus("livre");
    setFoundBuyer(null);
    setShowConfirmationModal(false);
    setDrawAuditData(null);
  }, [raffleConfig?.id]);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      // Audio autoplay policy
    }
  };

  // Realtime subscriptions for numbers and orders
  useEffect(() => {
    const unsubNumbers = realtimeService.subscribeNumbers(db, (activeNumbers) => {
      setDbNumbers(activeNumbers);
    }, selectedRaffleId);

    const unsubOrders = realtimeService.subscribeOrders(
      db,
      true,
      (ordersList) => {
        setOrders(ordersList);
      },
      (notification) => {
        playNotificationSound();
        const toastItem = {
          id: Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          ...notification,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        };
        setPaidToasts((prev) => [toastItem, ...prev].slice(0, 5));
        setUnreadPaidCount((prev) => prev + 1);
      },
      { limitCount: 200, raffleId: selectedRaffleId || "all" }
    );

    return () => {
      unsubNumbers();
      unsubOrders();
    };
  }, [selectedRaffleId]);

  // Refresh raffles list periodically or on mount
  useEffect(() => {
    fetchRaffles();
  }, [viewMode]);

  // Auto switch viewMode to "list" if there are no raffles in database or no selectedRaffleId
  useEffect(() => {
    if (raffles.length === 0 || !selectedRaffleId) {
      setViewMode("list");
    }
  }, [raffles.length, selectedRaffleId]);

  // Filter orders for the selected raffle in detail view
  const raffleOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!selectedRaffleId || selectedRaffleId === "all") return true;
      const orderRaffleId = o.raffleId || "current";
      return (
        orderRaffleId === selectedRaffleId ||
        orderRaffleId === "current" ||
        !o.raffleId ||
        selectedRaffleId === "current" ||
        raffles.length <= 1
      );
    });
  }, [orders, selectedRaffleId, raffles.length]);

  // Computations for raffle stats in detail view
  const stats = useMemo(() => {
    const paidOrders = raffleOrders.filter((o) => {
      const s = String(o.status || "").toLowerCase().trim();
      return (
        s === "pago" ||
        s === "paid" ||
        s === "approved" ||
        s === "aprovado" ||
        s === "confirmed" ||
        s === "paga" ||
        s === "pagas" ||
        s === "concluido" ||
        s === "concluído"
      );
    });
    const paidAmount = paidOrders.reduce((acc, curr) => {
      const raw = Number(curr.val || curr.amount || curr.total || curr.totalValue || curr.valAmount || 0);
      if (raw > 0) return acc + raw;
      const numCount = (Array.isArray(curr.nums) ? curr.nums : (Array.isArray(curr.purchasedNums) ? curr.purchasedNums : [])).length || 1;
      return acc + (numCount * (raffleConfig?.price || 10));
    }, 0);

    const pendingOrders = raffleOrders.filter((o) => {
      const s = String(o.status || "").toLowerCase().trim();
      return s === "aguardando" || s === "pending_payment" || s === "reserved" || s === "pendente";
    });
    const pendingAmount = pendingOrders.reduce((acc, curr) => {
      const raw = Number(curr.val || curr.amount || curr.total || curr.totalValue || curr.valAmount || 0);
      if (raw > 0) return acc + raw;
      const numCount = (Array.isArray(curr.nums) ? curr.nums : (Array.isArray(curr.purchasedNums) ? curr.purchasedNums : [])).length || 1;
      return acc + (numCount * (raffleConfig?.price || 10));
    }, 0);

    let countPaid = 0;
    let countReserved = 0;

    Object.keys(dbNumbers).forEach((key) => {
      const n = dbNumbers[key];
      if (!n) return;
      const st = String(n.status || "").toLowerCase().trim();
      const isPaid = st === "paid" || st === "pago" || st === "approved" || st === "confirmed";
      const isPending = st === "reserved" || st === "pending_payment" || st === "aguardando" || st === "pendente";

      if (isPaid) {
        countPaid++;
      } else if (isPending) {
        const hasExpired = n.expiresAt ? n.expiresAt < Date.now() : false;
        let isCancelled = false;
        if (n.orderId) {
          const parentOrder = raffleOrders.find((o) => o.id === n.orderId);
          if (parentOrder) {
            const s = (parentOrder.status || "").toLowerCase().trim();
            if (s === "cancelado" || s === "canceled" || s === "expired" || s === "reembolsado" || s === "refunded") {
              isCancelled = true;
            }
          }
        }
        if (!hasExpired && !isCancelled) {
          countReserved++;
        }
      }
    });

    if (countPaid === 0 && countReserved === 0 && raffleOrders.length > 0) {
      raffleOrders.forEach((o) => {
        const st = String(o.status || "").toLowerCase().trim();
        const isPaid = st === "pago" || st === "paid" || st === "approved" || st === "confirmed" || st === "paga" || st === "pagas";
        const isPending = st === "aguardando" || st === "pending_payment" || st === "reserved" || st === "pendente";
        const numsList = Array.isArray(o.nums) ? o.nums : (Array.isArray(o.purchasedNums) ? o.purchasedNums : []);
        if (isPaid) {
          countPaid += numsList.length;
        } else if (isPending) {
          countReserved += numsList.length;
        }
      });
    }

    const totalNum = raffleConfig?.totalNumbers || 100;
    return {
      arrecadado: paidAmount,
      aEntrar: pendingAmount,
      countPaid,
      countReserved,
      countAvailable: Math.max(0, totalNum - countPaid - countReserved),
    };
  }, [raffleOrders, dbNumbers, raffleConfig.totalNumbers]);

  // Compute stats for all raffles (used in "Minhas Rifas" cards and Global Dashboard)
  const rafflesWithStats = useMemo(() => {
    return raffles.map((r) => {
      const rOrders = orders.filter((o) => {
        const oRaffleId = o.raffleId || "current";
        return oRaffleId === r.id || oRaffleId === "current" || !o.raffleId || raffles.length <= 1;
      });
      const paidOrders = rOrders.filter((o) => {
        const s = String(o.status || "").toLowerCase().trim();
        return (
          s === "pago" ||
          s === "paid" ||
          s === "approved" ||
          s === "aprovado" ||
          s === "confirmed" ||
          s === "paga" ||
          s === "pagas" ||
          s === "concluido" ||
          s === "concluído"
        );
      });

      const revenueFromOrders = paidOrders.reduce((acc, curr) => {
        const raw = Number(curr.val || curr.total || curr.amount || curr.totalValue || 0);
        if (raw > 0) return acc + raw;
        const numsList = Array.isArray(curr.nums)
          ? curr.nums
          : (Array.isArray(curr.purchasedNums) ? curr.purchasedNums : (Array.isArray(curr.numbers) ? curr.numbers : []));
        return acc + ((numsList.length || 1) * (Number(r.price) || 10));
      }, 0);

      let soldFromOrders = 0;
      paidOrders.forEach((o) => {
        const numsList = Array.isArray(o.nums)
          ? o.nums
          : (Array.isArray(o.purchasedNums) ? o.purchasedNums : (Array.isArray(o.numbers) ? o.numbers : []));
        soldFromOrders += numsList.length;
      });

      const soldCountFromDoc = Number(r.soldCount || 0);
      const pricePerCota = Number(r.price) || 0;
      const totalSoldNumbers = Math.max(soldCountFromDoc, soldFromOrders);
      const totalRevenue = Math.max(revenueFromOrders, totalSoldNumbers * pricePerCota);

      return {
        ...r,
        totalRevenue,
        totalSoldNumbers,
      };
    });
  }, [raffles, orders]);

  const CHART_COLORS = ['#A3E635', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981', '#F43F5E', '#06B6D4'];

  const analyticsData = useMemo(() => {
    const totalGlobalRevenue = rafflesWithStats.reduce((acc, r) => acc + (r.totalRevenue || 0), 0);
    const totalGlobalTickets = rafflesWithStats.reduce((acc, r) => acc + (r.totalSoldNumbers || 0), 0);

    const sortedByRevenue = [...rafflesWithStats].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
    const topRaffle = sortedByRevenue[0] || null;

    const pieData = rafflesWithStats.map((r, idx) => {
      const rev = r.totalRevenue || 0;
      const pct = totalGlobalRevenue > 0 ? (rev / totalGlobalRevenue) * 100 : 0;
      return {
        name: r.title && r.title.length > 20 ? r.title.substring(0, 18) + "..." : (r.title || "Rifa"),
        fullTitle: r.title || "Rifa",
        value: rev,
        percent: parseFloat(pct.toFixed(1)),
        color: CHART_COLORS[idx % CHART_COLORS.length],
        id: r.id
      };
    });

    const barData = rafflesWithStats.map((r) => {
      const sold = r.totalSoldNumbers || 0;
      const total = Number(r.totalNumbers) || 100;
      const price = Number(r.price) || 10;
      const potential = total * price;
      return {
        name: r.title && r.title.length > 18 ? r.title.substring(0, 16) + "..." : (r.title || "Rifa"),
        fullTitle: r.title || "Rifa",
        Arrecadado: r.totalRevenue || 0,
        Potencial: potential,
        CotasVendidas: sold,
        TotalCotas: total,
        PrecoCota: price,
        isDestaque: Boolean(r.isDestaque || r.isFeatured)
      };
    });

    const activeCount = rafflesWithStats.filter(r => r.status === "ativa" || (r.isRaffleActive !== false && r.status !== "encerrada")).length;

    return {
      totalGlobalRevenue,
      totalGlobalTickets,
      topRaffle,
      pieData,
      barData,
      activeCount
    };
  }, [rafflesWithStats]);

  // Filtered list of raffles for "Minhas Rifas" screen
  const filteredRafflesList = useMemo(() => {
    let result = rafflesWithStats;

    if (raffleListFilter === "ativas") {
      result = result.filter((r) => r.status === "ativa" || (r.isRaffleActive !== false && r.status !== "encerrada" && r.status !== "arquivada"));
    } else if (raffleListFilter === "encerradas") {
      result = result.filter((r) => r.status === "encerrada" || r.isRaffleActive === false);
    } else if (raffleListFilter === "arquivadas") {
      result = result.filter((r) => r.status === "arquivada");
    }

    if (raffleListSearch.trim()) {
      const q = raffleListSearch.toLowerCase().trim();
      result = result.filter((r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [rafflesWithStats, raffleListFilter, raffleListSearch]);

  // Modal handlers for Create / Edit Raffle
  const handleOpenCreateModal = async () => {
    setEditingRaffleItem(null);
    setModalTitle("");
    setModalDescription("");
    setModalPrice("10");
    setModalTotalNumbers("100");
    setModalImageUrl("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80");
    
    let defaultKey = "";
    let defaultReceiver = "";
    let defaultBank = "";
    let defaultPhone = "";

    try {
      const globalPixDoc = await getDoc(doc(db, "raffles", "global_pix"));
      if (globalPixDoc.exists()) {
        const data = globalPixDoc.data();
        defaultKey = data.pixKey || "";
        defaultReceiver = data.pixReceiver || "";
        defaultBank = data.pixBank || "";
        defaultPhone = data.pixPhone || "";
      } else {
        const activeRaffle = raffles.find(r => r.status === "ativa" || r.isRaffleActive !== false);
        if (activeRaffle) {
          defaultKey = activeRaffle.pixKey || "";
          defaultReceiver = activeRaffle.pixReceiver || "";
          defaultBank = activeRaffle.pixBank || "";
          defaultPhone = activeRaffle.pixPhone || "";
        } else if (raffleConfig) {
          defaultKey = raffleConfig.pixKey || "";
          defaultReceiver = raffleConfig.pixReceiver || "";
          defaultBank = raffleConfig.pixBank || "";
          defaultPhone = raffleConfig.pixPhone || "";
        }
      }
    } catch (err) {
      console.error("Error pre-populating with global Pix:", err);
    }

    setModalPixKey(defaultKey);
    setModalPixReceiver(defaultReceiver);
    setModalPixBank(defaultBank);
    setModalPixPhone(defaultPhone);
    setModalPromoEnabled(false);
    setModalPromoBuy("5");
    setModalPromoBonus("1");
    setModalPurchaseMode("manual");
    setModalPaymentMode("automatic");
    setModalDrawMode("automatico");
    setModalFederalConcurso("");
    setModalFederalData("");
    setModalFederalRegra("Último dígito do 1º prêmio");
    setModalIsDestaque(true);
    setShowRaffleModal(true);
  };

  const handleOpenGlobalPixModal = async () => {
    let key = "";
    let receiver = "";
    let bank = "";
    let phone = "";

    try {
      const globalPixDoc = await getDoc(doc(db, "raffles", "global_pix"));
      if (globalPixDoc.exists()) {
        const data = globalPixDoc.data();
        key = data.pixKey || "";
        receiver = data.pixReceiver || "";
        bank = data.pixBank || "";
        phone = data.pixPhone || "";
      } else {
        const activeRaffle = raffles.find(r => r.status === "ativa" || r.isRaffleActive !== false);
        if (activeRaffle) {
          key = activeRaffle.pixKey || "";
          receiver = activeRaffle.pixReceiver || "";
          bank = activeRaffle.pixBank || "";
          phone = activeRaffle.pixPhone || "";
        } else if (raffleConfig) {
          key = raffleConfig.pixKey || "";
          receiver = raffleConfig.pixReceiver || "";
          bank = raffleConfig.pixBank || "";
          phone = raffleConfig.pixPhone || "";
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do PIX global:", err);
    }

    setGlobalPixKey(key);
    setGlobalPixReceiver(receiver);
    setGlobalPixBank(bank);
    setGlobalPixPhone(phone);
    setShowGlobalPixModal(true);
  };

  const handleSaveGlobalPix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalPixKey.trim() || !globalPixReceiver.trim() || !globalPixBank.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    setIsSubmittingGlobalPix(true);
    try {
      const token = getAdminToken();
      const result = await adminService.updateGlobalPix(token, {
        pixKey: globalPixKey.trim(),
        pixReceiver: globalPixReceiver.trim(),
        pixBank: globalPixBank.trim(),
        pixPhone: globalPixPhone.trim()
      });

      if (result.success) {
        alert(`Conta PIX Global atualizada com sucesso! Refletido em ${result.updatedCount} rifas ativas.`);
        setShowGlobalPixModal(false);
        if (fetchRaffles) {
          await fetchRaffles();
        }
      } else {
        alert("Ocorreu um erro ao atualizar os dados do PIX Global.");
      }
    } catch (err: any) {
      console.error("Error saving global Pix:", err);
      alert(err.message || "Falha ao salvar Pix Global.");
    } finally {
      setIsSubmittingGlobalPix(false);
    }
  };

  const handleOpenEditModal = (raffle: RaffleConfig) => {
    setEditingRaffleItem(raffle);
    setModalTitle(raffle.title || "");
    setModalDescription(raffle.description || "");
    setModalPrice(String(raffle.price || 10));
    setModalTotalNumbers(String(raffle.totalNumbers || 100));
    setModalImageUrl(raffle.imageUrl || "");
    setModalPixKey(raffle.pixKey || "");
    setModalPixReceiver(raffle.pixReceiver || "");
    setModalPixBank(raffle.pixBank || "");
    setModalPixPhone(raffle.pixPhone || "");
    setModalPromoEnabled(Boolean(raffle.promotionEnabled));
    setModalPromoBuy(String(raffle.promotionBuy || 5));
    setModalPromoBonus(String(raffle.promotionBonus || 1));
    setModalPurchaseMode(raffle.purchaseMode || "manual");
    setModalPaymentMode(raffle.paymentMode || "automatic");
    setModalDrawMode(raffle.drawMode || "automatico");
    setModalFederalConcurso(raffle.federalConcurso || "");
    setModalFederalData(raffle.federalData || "");
    setModalFederalRegra(raffle.federalRegra || "Último dígito do 1º prêmio");
    setModalIsDestaque(Boolean(raffle.isDestaque ?? raffle.isFeatured ?? true));
    setShowRaffleModal(true);
  };

  const handleSubmitRaffleModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      alert("Por favor, digite um título para a rifa.");
      return;
    }

    setIsSubmittingRaffleModal(true);
    try {
      const payload: Partial<RaffleConfig> = {
        title: modalTitle.trim(),
        slug: slugify(modalTitle.trim()),
        description: modalDescription.trim(),
        price: parseFloat(modalPrice.replace(",", ".")) || 10,
        totalNumbers: parseInt(modalTotalNumbers) || 100,
        imageUrl: modalImageUrl.trim(),
        pixKey: modalPixKey.trim(),
        pixReceiver: modalPixReceiver.trim(),
        pixBank: modalPixBank.trim(),
        pixPhone: modalPixPhone.trim(),
        promotionEnabled: modalPromoEnabled,
        promotionBuy: parseInt(modalPromoBuy) || 5,
        promotionBonus: parseInt(modalPromoBonus) || 1,
        purchaseMode: modalPurchaseMode,
        paymentMode: modalPaymentMode,
        drawMode: modalDrawMode,
        federalConcurso: modalFederalConcurso.trim(),
        federalData: modalFederalData.trim(),
        federalRegra: modalFederalRegra.trim(),
        isDestaque: modalIsDestaque,
        isFeatured: modalIsDestaque,
        status: editingRaffleItem ? (editingRaffleItem.status || "ativa") : "ativa",
        isActive: editingRaffleItem ? (editingRaffleItem.isActive !== false) : true,
        isRaffleActive: editingRaffleItem ? (editingRaffleItem.isRaffleActive !== false) : true,
      };

      if (editingRaffleItem) {
        // Update existing raffle
        await adminService.saveConfig(getAdminToken(), { ...editingRaffleItem, ...payload } as RaffleConfig, true, editingRaffleItem.id);
        alert("Rifa atualizada com sucesso!");
      } else {
        // Create new raffle
        const res = await adminService.createRaffle(getAdminToken(), payload);
        alert("Sua nova rifa foi criada com sucesso!");
        if (res.raffleId) {
          setSelectedRaffleId(res.raffleId);
        }
      }

      setShowRaffleModal(false);
      await fetchRaffles();
    } catch (err: any) {
      alert("Erro ao salvar rifa: " + err.message);
    } finally {
      setIsSubmittingRaffleModal(false);
    }
  };

  const handleActivateRaffle = async (raffleId: string) => {
    try {
      await adminService.toggleRaffleStatus(getAdminToken(), true, raffleId);
      if (selectedRaffleId === raffleId) {
        setRaffleConfig((prev) => ({ ...prev, isRaffleActive: true, isActive: true, status: "ativa" }));
      }
      await fetchRaffles();
    } catch (err: any) {
      alert("Erro ao ativar rifa: " + (err.message || "Falha de conexão"));
    }
  };

  const handlePauseRaffle = async (raffleId: string) => {
    try {
      await adminService.toggleRaffleStatus(getAdminToken(), false, raffleId);
      if (selectedRaffleId === raffleId) {
        setRaffleConfig((prev) => ({ ...prev, isRaffleActive: false, isActive: false, status: "pausada" }));
      }
      await fetchRaffles();
    } catch (err: any) {
      alert("Erro ao pausar rifa: " + (err.message || "Falha de conexão"));
    }
  };

  const handleArchiveRaffle = async (raffleId: string) => {
    setConfirmAction({
      message: "Deseja arquivar esta rifa? Ela deixará de aparecer no site.",
      onConfirm: async () => {
        try {
          setConfirmAction(null);
          await adminService.archiveRaffle(getAdminToken(), raffleId);
          await fetchRaffles();
        } catch (err: any) {
          alert("Erro ao arquivar rifa: " + err.message);
        }
      }
    });
  };

  const handleUnarchiveRaffle = async (raffleId: string) => {
    setConfirmAction({
      message: "Deseja desarquivar esta rifa? Ela voltará a ficar como pausada.",
      onConfirm: async () => {
        try {
          setConfirmAction(null);
          await adminService.saveConfig(getAdminToken(), { id: raffleId, status: "pausada", isRaffleActive: false, isActive: false } as any, false, raffleId);
          alert("Rifa desarquivada com sucesso!");
          await fetchRaffles();
        } catch (err: any) {
          alert("Erro ao desarquivar rifa: " + err.message);
        }
      }
    });
  };
  const handleOpenMarkAsDrawn = (raffle: RaffleConfig) => {
    setSelectedRaffleId(raffle.id);
    setCurrentAdminTab("winners");
    setViewMode("detail");
  };

  const handleSubmitManualDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markingAsDrawnRaffle) return;
    if (!manualWinnerNumberInput.trim()) {
      alert("Por favor, informe o número da cota sorteada.");
      return;
    }
    if (!manualWinnerNameInput.trim()) {
      alert("Por favor, informe o nome do ganhador.");
      return;
    }

    setIsSubmittingManualDraw(true);
    try {
      const token = getAdminToken();
      const updatedConfig = {
        ...markingAsDrawnRaffle,
        winnerNumber: manualWinnerNumberInput.trim(),
        winnerName: manualWinnerNameInput.trim(),
        winnerPhone: manualWinnerPhoneInput.trim() || "N/A",
        status: "encerrada" as const,
        isRaffleActive: false,
        isActive: false,
        drawDate: new Date().toLocaleDateString("pt-BR"),
        drawTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };

      await adminService.saveConfig(token, updatedConfig, false, markingAsDrawnRaffle.id);
      
      setConfirmAction({
        message: "Deseja também publicar este ganhador automaticamente no Hall da Fama?",
        onConfirm: async () => {
          try {
            setConfirmAction(null);
            await adminService.publishDraw(token, "DRAW_" + Date.now(), updatedConfig, markingAsDrawnRaffle.id);
            alert("Sorteio registrado e ganhador publicado no Hall da Fama com sucesso!");
          } catch (pubErr: any) {
            console.error("Erro ao publicar ganhador:", pubErr);
            alert("Sorteio registrado, mas houve um erro ao publicar no Hall da Fama: " + pubErr.message);
          } finally {
            setMarkingAsDrawnRaffle(null);
            await fetchRaffles();
          }
        }
      });

    } catch (err: any) {
      alert("Erro ao registrar sorteio manual: " + err.message);
    } finally {
      setIsSubmittingManualDraw(false);
    }
  };

  const handleEndRaffle = async (raffleId: string) => {
    setConfirmAction({
      message: "Deseja realmente encerrar esta rifa? Ela deixará de receber novas apostas.",
      onConfirm: async () => {
        try {
          setConfirmAction(null);
          await adminService.endRaffle(getAdminToken(), raffleId);
          alert("Rifa encerrada com sucesso!");
          if (selectedRaffleId === raffleId) {
            setRaffleConfig((prev) => ({ ...prev, isRaffleActive: false, isActive: false, status: "encerrada" }));
          }
          await fetchRaffles();
        } catch (err: any) {
          alert("Erro ao encerrar rifa: " + err.message);
        }
      }
    });
  };

  const handleDuplicateRaffle = async (raffleId: string) => {
    try {
      const res = await adminService.duplicateRaffle(getAdminToken(), raffleId);
      alert("Rifa duplicada com sucesso!");
      await fetchRaffles();
      if (res.raffleId) {
        setSelectedRaffleId(res.raffleId);
        setViewMode("detail");
      }
    } catch (err: any) {
      alert("Erro ao duplicar rifa: " + err.message);
    }
  };

  const handleResetRaffle = (raffleId: string, raffleTitle?: string) => {
    setConfirmAction({
      message: `ATENÇÃO: Deseja realmente resetar a rifa "${raffleTitle || raffleId}"? Todas as cotas vendidas, reservadas e pedidos vinculados serão apagados definitivamente. As configurações e o histórico global de ganhadores serão mantidos.`,
      onConfirm: async () => {
        try {
          setConfirmAction(null);
          setIsClearing(true);
          const data = await adminService.clearRaffle(getAdminToken(), raffleId);
          if (selectedRaffleId === raffleId) {
            const updated = data.resetConfig || { ...raffleConfig, winnerNumber: "", winnerName: "" };
            setRaffleConfig(updated);
            setEditedConfig(updated);
          }
          await fetchRaffles();
          alert("Rifa resetada com sucesso!");
        } catch (err: any) {
          alert("Erro ao resetar rifa: " + (err.message || "Falha ao processar."));
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  const handleDeleteRaffle = (raffleId: string, raffleTitle?: string) => {
    setConfirmAction({
      message: `ATENÇÃO: Deseja realmente excluir a rifa "${raffleTitle || raffleId}"? Esta ação removerá a rifa, suas cotas, pedidos e pagamentos vinculados definitivamente do banco de dados. O histórico global de ganhadores não será afetado.`,
      onConfirm: async () => {
        try {
          setConfirmAction(null);
          await adminService.deleteRaffle(getAdminToken(), raffleId);
          alert("Rifa excluída com sucesso!");
          setViewMode("list");
          if (selectedRaffleId === raffleId) {
            setSelectedRaffleId("");
          }
          await fetchRaffles();
        } catch (err: any) {
          alert(err.message || "Erro ao excluir rifa.");
        }
      },
    });
  };

  const handleOpenRaffleDetail = (raffleId: string) => {
    setSelectedRaffleId(raffleId);
    setViewMode("detail");
    setActiveTab("dashboard");
    setCurrentAdminTab("overview");
  };

  // Status badge renderer helper
  const renderStatusBadge = (status?: string, isActive?: boolean) => {
    const st = (status || "").toLowerCase();
    if (st === "pausada") {
      return (
        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pausada
        </span>
      );
    }
    if (st === "encerrada") {
      return (
        <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase rounded-full flex items-center gap-1 shadow-sm">
          <Power className="w-3 h-3" /> Encerrada
        </span>
      );
    }
    if (st === "arquivada") {
      return (
        <span className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase rounded-full flex items-center gap-1 shadow-sm">
          <Archive className="w-3 h-3" /> Arquivada
        </span>
      );
    }
    if (st === "ativa" || isActive === true) {
      return (
        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase rounded-full flex items-center gap-1 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ativa
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pausada
      </span>
    );
  };

  // Filters for orders inside detail view
  const [adminStatusFilter, setAdminStatusFilter] = useState("Todos");
  const [adminSearch, setAdminSearch] = useState("");

  const filteredOrders = useMemo(() => {
    let result = raffleOrders;
    if (adminStatusFilter !== "Todos") {
      result = result.filter((o) => {
        const s = (o.status || "").toLowerCase();
        if (adminStatusFilter === "Pago") return s === "pago" || s === "paid" || s === "approved";
        if (adminStatusFilter === "Pendente") return s === "pending_payment" || s === "aguardando" || s === "reserved";
        if (adminStatusFilter === "Cancelado") return s === "cancelado" || s === "canceled" || s === "refunded" || s === "reembolsado" || s === "expired";
        return true;
      });
    }
    if (!adminSearch.trim()) return result;
    const q = adminSearch.toLowerCase().trim();
    return result.filter(
      (o) =>
        (o.name || "").toLowerCase().includes(q) ||
        (o.phone || "").includes(q) ||
        (o.id || "").toLowerCase().includes(q) ||
        (o.nums || []).some((n: string) => n.includes(q))
    );
  }, [raffleOrders, adminSearch, adminStatusFilter]);

  // Loading and action flags
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [manualWinningNumber, setManualWinningNumber] = useState("");

  const calculatingRef = useRef(false);
  const publishingRef = useRef(false);

  const handleCalculateAndValidateDraw = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (calculatingRef.current) return;
    calculatingRef.current = true;
    setIsCalculating(true);

    try {
      let resultValue = 0;
      let formulaStr = "";
      
      const padSize = String(raffleConfig.totalNumbers || 100).length;

      // Fetch the latest orders via Admin API
      let currentOrders = orders;
      try {
        const adminToken = getAdminToken();
        const res = await fetch("/api/admin-action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          credentials: "include",
          body: JSON.stringify({
            action: "list-orders",
            raffleId: selectedRaffleId || "current"
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.orders)) {
            currentOrders = data.orders;
            setOrders(data.orders);
          }
        } else if (res.status === 401 || res.status === 403) {
          console.warn("🚨 [Admin] Sessão expirada ao recalcular sorteio.");
        }
      } catch (apiErr) {
        console.error("Erro ao obter pedidos via Admin API:", apiErr);
      }

      if (localDrawMode === "manual") {
        if (!manualCotaInput.trim()) {
          alert("Por favor, informe a cota sorteada.");
          return;
        }
        const cotaNum = parseInt(manualCotaInput.replace(/\D/g, ""), 10);
        if (isNaN(cotaNum) || cotaNum <= 0 || cotaNum > (raffleConfig.totalNumbers || 100)) {
          alert(`Cota inválida. Deve ser um número entre 1 e ${raffleConfig.totalNumbers || 100}.`);
          return;
        }
        resultValue = cotaNum;
        formulaStr = `Cota informada manualmente: ${cotaNum}`;
      } else if (localDrawMode === "federal") {
        const activeRuleId = normalizeFederalRuleId(federalRegra);
        const selectedRuleObj = FEDERAL_RULES.find(r => r.id === activeRuleId);
        if (!selectedRuleObj) {
          alert("Regra de sorteio inválida ou não selecionada.");
          return;
        }

        const p1 = parseInt(prizes[0]?.replace(/\D/g, "") || "0", 10);
        const p2 = parseInt(prizes[1]?.replace(/\D/g, "") || "0", 10);
        const p3 = parseInt(prizes[2]?.replace(/\D/g, "") || "0", 10);
        const p4 = parseInt(prizes[3]?.replace(/\D/g, "") || "0", 10);
        const p5 = parseInt(prizes[4]?.replace(/\D/g, "") || "0", 10);

        // Validate required fields
        if (selectedRuleObj.fieldsNeeded === 1 && !prizes[0]?.trim()) {
          alert("O campo 1º prêmio é obrigatório para esta regra.");
          return;
        }
        if (selectedRuleObj.fieldsNeeded === 5) {
          if (activeRuleId === "soma_personalizada") {
            // At least one field should be filled
            if (prizes.every(p => !p.trim())) {
              alert("Por favor, preencha pelo menos um prêmio para realizar a soma personalizada.");
              return;
            }
          } else if (!prizes[0]?.trim() || !prizes[1]?.trim() || !prizes[2]?.trim() || !prizes[3]?.trim() || !prizes[4]?.trim()) {
            alert("Todos os 5 prêmios são obrigatórios para esta regra.");
            return;
          }
        }

        // Calculate rule result
        switch (activeRuleId) {
          case "ultimo_digito_1": {
            const str = String(p1);
            resultValue = parseInt(str.charAt(str.length - 1) || "0", 10);
            formulaStr = `Último dígito do 1º prêmio (${p1}) = ${resultValue}`;
            break;
          }
          case "ultimos_2_digitos_1": {
            const str = String(p1);
            resultValue = parseInt(str.slice(-2) || "0", 10);
            formulaStr = `Últimos 2 dígitos do 1º prêmio (${p1}) = ${resultValue}`;
            break;
          }
          case "ultimos_3_digitos_1": {
            const str = String(p1);
            resultValue = parseInt(str.slice(-3) || "0", 10);
            formulaStr = `Últimos 3 dígitos do 1º prêmio (${p1}) = ${resultValue}`;
            break;
          }
          case "ultimos_4_digitos_1": {
            const str = String(p1);
            resultValue = parseInt(str.slice(-4) || "0", 10);
            formulaStr = `Últimos 4 dígitos do 1º prêmio (${p1}) = ${resultValue}`;
            break;
          }
          case "completo_1": {
            resultValue = p1;
            formulaStr = `Número completo do 1º prêmio = ${resultValue}`;
            break;
          }
          case "soma_cinco": {
            resultValue = p1 + p2 + p3 + p4 + p5;
            formulaStr = `Soma dos 5 prêmios (${p1} + ${p2} + ${p3} + ${p4} + ${p5}) = ${resultValue}`;
            break;
          }
          case "soma_ultimos_cinco": {
            const d1 = parseInt(String(p1).slice(-1) || "0", 10);
            const d2 = parseInt(String(p2).slice(-1) || "0", 10);
            const d3 = parseInt(String(p3).slice(-1) || "0", 10);
            const d4 = parseInt(String(p4).slice(-1) || "0", 10);
            const d5 = parseInt(String(p5).slice(-1) || "0", 10);
            resultValue = d1 + d2 + d3 + d4 + d5;
            formulaStr = `Soma dos últimos dígitos dos 5 prêmios (${d1} + ${d2} + ${d3} + ${d4} + ${d5}) = ${resultValue}`;
            break;
          }
          case "soma_personalizada": {
            const nonZeroPrizes = prizes
              .map((p, idx) => ({ val: parseInt(p.replace(/\D/g, "") || "0", 10), index: idx + 1 }))
              .filter(item => item.val > 0);
            resultValue = nonZeroPrizes.reduce((acc, curr) => acc + curr.val, 0);
            formulaStr = `Soma personalizada (${nonZeroPrizes.map(item => `${item.index}º prêmio: ${item.val}`).join(" + ")}) = ${resultValue}`;
            break;
          }
        }
      }

      // Apply the modulo division formula
      let finalCota = resultValue;
      let calculationText = `Cota especificada diretamente pelo administrador`;
      
      if (localDrawMode !== "manual") {
        let moduloValue = resultValue % (raffleConfig.totalNumbers || 100);
        finalCota = moduloValue;
        calculationText = `${resultValue} MOD ${raffleConfig.totalNumbers || 100} = ${moduloValue}`;

        if (moduloValue === 0) {
          finalCota = raffleConfig.totalNumbers || 100;
          calculationText = `${resultValue} MOD ${raffleConfig.totalNumbers || 100} = 0 -> Caso MOD seja 0, utiliza-se a última cota (${raffleConfig.totalNumbers || 100})`;
        }
      }

      const finalCotaStr = String(finalCota).padStart(padSize, "0");
      setCalculatedResult(resultValue);
      setCalculatedCota(finalCotaStr);
      setCalculationFormulaText(calculationText);

      // Normalization helper (removing leading zeros) for comparisons
      const normalizeQuota = (q: string): string => {
        const cleaned = String(q).replace(/^0+/, "");
        return cleaned === "" ? "0" : cleaned;
      };
      const normalizedWinner = normalizeQuota(finalCotaStr);

      // Find the matching paid/pending order for this number, using normalized comparison
      let matchingOrder = currentOrders.find((o) => {
        const matchesRaffle =
          !selectedRaffleId ||
          selectedRaffleId === "all" ||
          o.raffleId === selectedRaffleId ||
          o.raffleId === "current" ||
          !o.raffleId;

        if (!matchesRaffle) return false;

        const allOrderNums = [
          ...(Array.isArray(o.nums) ? o.nums : []),
          ...(Array.isArray(o.purchasedNums) ? o.purchasedNums : []),
          ...(Array.isArray(o.bonusNums) ? o.bonusNums : []),
          ...(Array.isArray(o.numbers) ? o.numbers : []),
        ];

        return allOrderNums.map(normalizeQuota).includes(normalizedWinner);
      });

      // Fallback: Check numbers subcollection directly if order array lookup didn't find the buyer
      if (!matchingOrder && selectedRaffleId && selectedRaffleId !== "all") {
        try {
          const cotaDocSnap = await getDoc(doc(db, "raffles", selectedRaffleId, "numbers", finalCotaStr));
          if (cotaDocSnap.exists()) {
            const cData = cotaDocSnap.data();
            if (cData && cData.name && cData.name !== "Cota Livre / Não Vendida") {
              matchingOrder = {
                id: cData.orderId || `COTA_${finalCotaStr}`,
                name: cData.name,
                phone: cData.phone || "",
                status: cData.status === "paid" || cData.status === "pago" ? "Pago" : cData.status || "Pago",
                val: 0,
                nums: [finalCotaStr],
              };
            }
          }
        } catch (err) {
          console.info("Fallback cota doc lookup notice:", err);
        }
      }

      if (matchingOrder) {
        const statusStr = (matchingOrder.status || "").toLowerCase();
        if (statusStr === "pago" || statusStr === "paid" || statusStr === "approved") {
          setBuyerStatus("pago");
        } else {
          setBuyerStatus("pendente");
        }
        
        // Select the exact cota as recorded in the user's purchased array
        const allNums = [
          ...(Array.isArray(matchingOrder.nums) ? matchingOrder.nums : []),
          ...(Array.isArray(matchingOrder.purchasedNums) ? matchingOrder.purchasedNums : []),
          ...(Array.isArray(matchingOrder.bonusNums) ? matchingOrder.bonusNums : []),
          ...(Array.isArray(matchingOrder.numbers) ? matchingOrder.numbers : []),
        ];
        const actualCota = allNums.find(n => normalizeQuota(n) === normalizedWinner) || finalCotaStr;
        setCalculatedCota(actualCota);
        setFoundBuyer(matchingOrder);
      } else {
        setBuyerStatus("livre");
        setFoundBuyer(null);
      }

      // Set audit trail
      setDrawAuditData({
        drawMethod: localDrawMode === "manual" ? "Número informado manualmente" : "Loteria Federal",
        federalRegra: localDrawMode === "manual" ? "N/A" : (FEDERAL_RULES.find(r => r.id === federalRegra)?.label || federalRegra),
        prizesEntered: localDrawMode === "manual" ? [manualCotaInput] : prizes.filter(p => p.trim() !== ""),
        resultCalculated: resultValue,
        totalQuotas: raffleConfig.totalNumbers || 100,
        calculationFormula: calculationText,
        winnerNumber: finalCotaStr,
        drawDate: new Date().toLocaleDateString("pt-BR"),
        drawTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        adminResponsible: "Administrador"
      });

      setShowConfirmationModal(true);
    } catch (err: any) {
      alert("Erro ao calcular vencedor: " + (err.message || err));
    } finally {
      setIsCalculating(false);
      calculatingRef.current = false;
    }
  };

  const handleToggleRaffleStatus = async () => {
    try {
      setIsTogglingStatus(true);
      const newStatus = raffleConfig.isRaffleActive !== false ? false : true;
      await adminService.toggleRaffleStatus(getAdminToken(), newStatus, selectedRaffleId);
      setRaffleConfig((prev) => ({ ...prev, isRaffleActive: newStatus, isActive: newStatus }));
      await fetchRaffles();
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const finalConfig = {
        ...editedConfig,
        title: editedConfig.title?.trim() || "Nova Rifa",
        price: parseFloat(priceInput.replace(",", ".")) || 10,
        totalNumbers: parseInt(totalNumbersInput) || 100,
      };

      await adminService.saveConfig(getAdminToken(), finalConfig, finalConfig.isActive, selectedRaffleId);
      setRaffleConfig(finalConfig);
      await fetchRaffles();
      alert("Configurações salvas com sucesso!");
    } catch (err: any) {
      alert(err.message || "Erro ao salvar as configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPlanning = async () => {
    try {
      setIsSaving(true);
      const finalConfig = {
        ...raffleConfig,
        price: parseFloat(valorCotaPlanejadoInput.replace(",", ".")) || 10,
        totalNumbers: parseInt(totalNumbersInput) || 1000,
        custoPremio: parseFloat(custoPremioInput.replace(",", ".")) || 0,
        lucroDesejado: parseFloat(lucroDesejadoInput.replace(",", ".")) || 0,
        taxaMP: parseFloat(taxaMPInput.replace(",", ".")) || 0,
        promotionEnabled: promoAtivaInput,
        promotionBuy: parseInt(promoBuyInput) || 5,
        promotionBonus: parseInt(promoBonusInput) || 1
      };

      await adminService.saveConfig(getAdminToken(), finalConfig, finalConfig.isActive !== false, selectedRaffleId);
      setRaffleConfig(finalConfig);
      await fetchRaffles();
      alert("Planejamento financeiro e regras de bônus aplicados com sucesso na campanha ativa!");
    } catch (err: any) {
      alert("Erro ao aplicar planejamento: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (orderId: string, action: "confirm" | "cancel" | "refund") => {
    try {
      if (action === "refund") {
        setConfirmAction({
          message: "Deseja estornar o valor e liberar as cotas de volta para compra pública?",
          onConfirm: async () => {
            try {
              await adminService.orderAction(getAdminToken(), orderId, "refund", selectedRaffleId);
              alert("Pedido reembolsado!");
              setConfirmAction(null);
            } catch (err: any) {
              alert(err.message);
              setConfirmAction(null);
            }
          },
        });
        return;
      }
      await adminService.orderAction(getAdminToken(), orderId, action, selectedRaffleId);
      alert("Sucesso!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearRaffle = () => {
    setConfirmAction({
      message: "ATENÇÃO: Deseja apagar todos os números e registros de pedidos da rifa atual de forma definitiva?",
      onConfirm: async () => {
        try {
          setConfirmAction(null);
          setIsClearing(true);
          const data = await adminService.clearRaffle(getAdminToken(), selectedRaffleId);
          const updated = data.resetConfig || { ...raffleConfig, winnerNumber: "", winnerName: "", isRaffleActive: true, isActive: true };
          setRaffleConfig(updated);
          setEditedConfig(updated);
          alert("Limpeza concluída!");
        } catch (err: any) {
          alert(err.message);
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  if (!isConfigLoaded) {
    return (
      <div id="dashboard-loading-screen" className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-6">Carregando painel...</p>
      </div>
    );
  }

  // Helper render for Sweepstakes Draw Confirmation Modal
  const renderDrawConfirmationModal = () => {
    return (
      <>
        {/* SWEEPSTAKES APURAÇÃO CONFIRMATION MODAL */}
        {showConfirmationModal && (
          <div id="draw-confirmation-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-850 w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 space-y-6 my-8 shadow-2xl relative">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                <div className="text-left">
                  <h3 className="font-black text-white text-base uppercase tracking-tight flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
                    Apuração do Sorteio
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Confirme os dados antes de publicar oficialmente no Hall da Fama.
                  </p>
                </div>
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* AUDIT CARD */}
              <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl space-y-2 text-xs">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                  Cálculo Auditável Realizado
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left font-semibold text-zinc-300">
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase font-bold">Método / Regra</span>
                    <span className="text-white font-extrabold">{drawAuditData?.drawMethod} - {drawAuditData?.federalRegra}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase font-bold">Cálculo MOD (Resto)</span>
                    <span className="text-white font-extrabold font-mono">{drawAuditData?.calculationFormula}</span>
                  </div>
                </div>
              </div>

              {/* CASE 1: Cota Paga e Vencedora */}
              {buyerStatus === "pago" && foundBuyer && (
                <div className="space-y-6">
                  <div className="bg-emerald-950/20 border border-emerald-900/50 p-5 rounded-3xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500 text-black p-2 rounded-xl">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </div>
                      <div className="text-left">
                        <span className="text-emerald-400 font-black text-xs uppercase tracking-wider block font-black">VENCEDOR CONFIRMADO E ELEGÍVEL!</span>
                        <p className="text-[11px] text-zinc-400">Esta cota foi comprada e o pagamento está confirmado.</p>
                      </div>
                    </div>
                  </div>

                  {/* GRID OF DETAILS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-left">
                    <div className="bg-zinc-900 p-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Cota Sorteada</span>
                      <span className="text-lg font-black text-violet-400 font-mono">#{calculatedCota}</span>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Nome do Ganhador</span>
                      <span className="text-sm font-bold text-white uppercase block truncate">{foundBuyer.name}</span>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Telefone</span>
                      <span className="text-sm font-bold text-white font-mono block">{foundBuyer.phone}</span>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Prêmio / Rifa</span>
                      <span className="text-sm font-bold text-white block truncate">{raffleConfig.title}</span>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Valor do Pedido</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono block">R$ {Number(foundBuyer.val || 0).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-2xl">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Status Pagamento</span>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block mt-1">
                        CONFIRMADO
                      </span>
                    </div>
                  </div>

                  {/* DESEJA PUBLICAR ESTE VENCEDOR AUTOMATICAMENTE NO HALL DA FAMA */}
                  <div className="border-t border-zinc-900 pt-6 text-center space-y-4">
                    <p className="text-xs font-bold text-zinc-300">
                      Deseja publicar este vencedor automaticamente no Hall da Fama?
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setShowConfirmationModal(false)}
                        className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          if (publishingRef.current) return;
                          publishingRef.current = true;
                          setIsPublishing(true);
                          setIsDrawing(true);
                          try {
                            const token = getAdminToken();
                            
                            // Let's call our save endpoint using publish-draw action
                            const configToPublish = {
                              ...raffleConfig,
                              winnerNumber: calculatedCota,
                              winnerName: foundBuyer ? foundBuyer.name : "Cota Livre / Não Vendida",
                              winnerPhone: foundBuyer ? foundBuyer.phone || "" : "N/A",
                              status: "encerrada",
                              isRaffleActive: false,
                              isActive: false,
                              drawDate: new Date().toLocaleDateString("pt-BR"),
                              drawTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                              drawAudit: drawAuditData
                            };

                            const res = await adminService.publishDraw(token, "DRAW_" + Date.now(), configToPublish, selectedRaffleId);
                            
                            if (res?.alreadyProcessed) {
                              alert("Este sorteio já havia sido encerrado e publicado anteriormente.");
                            } else {
                              alert(`Vencedor registrado com sucesso no Hall da Fama!\nCota #${calculatedCota} - ${foundBuyer ? foundBuyer.name : "Cota Livre / Não Vendida"}`);
                            }
                            
                            // Instantly update local state to avoid any latency or cache issue
                            setRaffleConfig(configToPublish);
                            setEditedConfig(configToPublish);
                            setShowConfirmationModal(false);
                            await fetchRaffles();
                          } catch (err: any) {
                            alert("Erro ao oficializar vencedor: " + err.message);
                          } finally {
                            setIsDrawing(false);
                            setIsPublishing(false);
                            publishingRef.current = false;
                          }
                        }}
                        disabled={isDrawing || isPublishing}
                        className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDrawing || isPublishing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            PUBLICANDO...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                            Publicar e Encerrar Rifa
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CASE 2: Cota Reservada / Pendente */}
              {buyerStatus === "pendente" && foundBuyer && (
                <div className="space-y-6">
                  <div className="bg-amber-950/20 border border-amber-900/50 p-5 rounded-3xl space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-500 text-black p-2 rounded-xl mt-0.5">
                        <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="text-left">
                        <span className="text-amber-400 font-black text-xs uppercase tracking-wider block font-black">COTA RESERVADA / PAGAMENTO PENDENTE!</span>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          A cota calculada <strong className="text-white font-mono">#{calculatedCota}</strong> pertence ao comprador <strong className="text-white uppercase font-bold">{foundBuyer.name}</strong> ({foundBuyer.phone}), mas o pagamento do pedido ainda consta como <strong className="text-amber-400 font-extrabold">{foundBuyer.status}</strong>.
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-2">
                          Uma cota só pode ser coroada como vencedora se estiver com status de pagamento confirmado.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ACTION OPTIONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                    <button
                      onClick={() => {
                        setConfirmAction({
                          message: `Deseja aprovar e confirmar manualmente o pagamento deste pedido de ${foundBuyer.name} agora para elegê-lo como ganhador?`,
                          onConfirm: async () => {
                            setConfirmAction(null);
                            setIsDrawing(true);
                            try {
                              const token = getAdminToken();
                              // Approve order
                              await adminService.orderAction(token, foundBuyer.id, "confirm", selectedRaffleId);
                              
                              // Re-check order status in local view state
                              const updatedOrders = [...orders];
                              const idx = updatedOrders.findIndex(o => o.id === foundBuyer.id);
                              if (idx !== -1) {
                                updatedOrders[idx] = { ...updatedOrders[idx], status: "Pago" };
                                setOrders(updatedOrders);
                              }
                              
                              setBuyerStatus("pago");
                              alert(`Pagamento de ${foundBuyer.name} aprovado com sucesso! Agora você pode confirmar o vencedor.`);
                            } catch (err: any) {
                              alert("Erro ao aprovar pagamento: " + err.message);
                            } finally {
                              setIsDrawing(false);
                            }
                          }
                        });
                      }}
                      disabled={isDrawing}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs uppercase rounded-xl cursor-pointer tracking-wider flex items-center justify-center gap-1 transition-all"
                    >
                      {isDrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[2.5]" />}
                      APROVAR PAGAMENTO E VALIDAR
                    </button>

                    <button
                      onClick={() => setShowConfirmationModal(false)}
                      className="py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-black text-xs uppercase rounded-xl cursor-pointer tracking-wider transition-all"
                    >
                      REALIZAR NOVA APURAÇÃO
                    </button>
                  </div>
                </div>
              )}

              {/* CASE 3: Cota Livre (Não vendida) */}
              {buyerStatus === "livre" && (
                <div className="space-y-6">
                  <div className="bg-red-950/20 border border-red-900/50 p-5 rounded-3xl space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-red-500 text-white p-2 rounded-xl mt-0.5">
                        <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="text-left">
                        <span className="text-red-400 font-black text-xs uppercase tracking-wider block font-black">COTA LIVRE / NÃO VENDIDA!</span>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          A cota sorteada <strong className="text-white font-mono">#{calculatedCota}</strong> não foi vendida ou está livre no sistema. Não existem compradores com status Pago para esta cota.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 italic text-left">
                    Conforme as diretrizes, você deve realizar uma nova apuração de acordo com as regras estabelecidas pelo regulamento do sorteio ou modificar os números de entrada caso as regras permitam.
                  </p>

                  <button
                    onClick={() => setShowConfirmationModal(false)}
                    className="w-full py-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all"
                  >
                    REALIZAR NOVA APURAÇÃO / TENTAR NOVAMENTE
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  // Helper render for Shared Winners Hall Modals
  const renderSharedWinnersHallModals = () => {
    return (
      <>
        {addingWinner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Registrar Ganhador Manual
              </h3>
              <p className="text-xs text-zinc-500 mt-1">Insira os detalhes do vencedor para registrar no Hall da Fama.</p>

              {/* SELECTOR FOR DESIRED RAFFLE */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-zinc-500">Auto-preencher Rifa:</span>
                <select
                  value=""
                  onChange={(e) => {
                    const targetRaffle = raffles.find(r => r.id === e.target.value);
                    if (targetRaffle) {
                      setNewWinnerData((prev: any) => ({
                        ...prev,
                        raffleTitle: targetRaffle.title || "",
                        prizeTitle: targetRaffle.title || "",
                        prizeImageUrl: targetRaffle.imageUrl || "",
                        prizeDescription: targetRaffle.description || "",
                      }));
                    }
                  }}
                  className="bg-zinc-900 border border-zinc-850 text-[10px] font-black uppercase text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-violet-500"
                >
                  <option value="">-- SELECIONAR RIFA --</option>
                  {raffles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title || "Sem Título"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome Completo do Ganhador</label>
                    <input
                      type="text"
                      placeholder="ex: João Silva"
                      value={newWinnerData.winnerName || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, winnerName: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Foto do Ganhador</label>
                    <div className="flex items-center gap-2 bg-black p-2 rounded-xl border border-zinc-900">
                      {newWinnerData.winnerImageUrl ? (
                        <img src={newWinnerData.winnerImageUrl} className="w-10 h-10 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600 shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="URL ou carregue..."
                          value={newWinnerData.winnerImageUrl || ""}
                          onChange={(e) => setNewWinnerData({ ...newWinnerData, winnerImageUrl: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] text-white outline-none"
                        />
                        <label className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-white rounded-md text-[9px] font-bold cursor-pointer w-fit">
                          <Upload className="w-2.5 h-2.5 text-amber-500" />
                          {uploadingWinnerImage ? "Enviando..." : "Enviar Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingWinnerImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploadingWinnerImage(true);
                                const url = await performRobustImageUpload(file);
                                setNewWinnerData((prev: any) => ({ ...prev, winnerImageUrl: url }));
                              } catch (err: any) {
                                alert("Falha no upload: " + err.message);
                              } finally {
                                setUploadingWinnerImage(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome da Rifa</label>
                    <input
                      type="text"
                      placeholder="ex: Rifa Beneficente de Natal"
                      value={newWinnerData.raffleTitle || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, raffleTitle: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome do Prêmio</label>
                    <input
                      type="text"
                      placeholder="ex: iPhone 15 Pro Max"
                      value={newWinnerData.prizeTitle || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, prizeTitle: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Foto do Prêmio</label>
                    <div className="flex items-center gap-2 bg-black p-2 rounded-xl border border-zinc-900">
                      {newWinnerData.prizeImageUrl ? (
                        <img src={newWinnerData.prizeImageUrl} className="w-10 h-10 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600 shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="URL ou carregue..."
                          value={newWinnerData.prizeImageUrl || ""}
                          onChange={(e) => setNewWinnerData({ ...newWinnerData, prizeImageUrl: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] text-white outline-none"
                        />
                        <label className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-white rounded-md text-[9px] font-bold cursor-pointer w-fit">
                          <Upload className="w-2.5 h-2.5 text-amber-500" />
                          {uploadingPrizeImage ? "Enviando..." : "Enviar Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingPrizeImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploadingPrizeImage(true);
                                const url = await performRobustImageUpload(file);
                                setNewWinnerData((prev: any) => ({ ...prev, prizeImageUrl: url }));
                              } catch (err: any) {
                                alert("Falha no upload: " + err.message);
                              } finally {
                                setUploadingPrizeImage(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Valor Estimado (R$)</label>
                    <input
                      type="text"
                      placeholder="ex: 8.000,00"
                      value={newWinnerData.prizeValue || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, prizeValue: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Descrição Resumida</label>
                  <textarea
                    placeholder="ex: Ganhador levou o super iPhone 15 Pro Max lacrado!"
                    value={newWinnerData.prizeDescription || ""}
                    onChange={(e) => setNewWinnerData({ ...newWinnerData, prizeDescription: e.target.value })}
                    className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50 h-20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Número da Cota</label>
                    <input
                      type="text"
                      placeholder="ex: 450912"
                      value={newWinnerData.winnerNumber || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, winnerNumber: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Data Sorteio</label>
                    <input
                      type="text"
                      placeholder="23/07/2026"
                      value={newWinnerData.drawDate || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, drawDate: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Horário Sorteio</label>
                    <input
                      type="text"
                      placeholder="19:00"
                      value={newWinnerData.drawTime || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, drawTime: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cidade</label>
                    <input
                      type="text"
                      placeholder="ex: Florianópolis"
                      value={newWinnerData.city || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, city: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Estado (UF)</label>
                    <input
                      type="text"
                      placeholder="ex: SC"
                      value={newWinnerData.state || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, state: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Instagram (Sem @)</label>
                    <input
                      type="text"
                      placeholder="ex: joao_silva"
                      value={newWinnerData.instagram || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, instagram: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Link do Vídeo</label>
                    <input
                      type="text"
                      placeholder="https://youtube.com/..."
                      value={newWinnerData.videoLink || ""}
                      onChange={(e) => setNewWinnerData({ ...newWinnerData, videoLink: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Status do Ganhador</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setNewWinnerData({ ...newWinnerData, status: "Normal" })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                        newWinnerData.status !== "Destaque"
                          ? "bg-zinc-900 text-white border-zinc-800"
                          : "bg-black text-zinc-500 border-zinc-900 hover:text-zinc-400"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWinnerData({ ...newWinnerData, status: "Destaque" })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        newWinnerData.status === "Destaque"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          : "bg-black text-zinc-500 border-zinc-900 hover:text-zinc-400"
                      }`}
                    >
                      <Sparkles className="w-4 h-4" /> Destaque
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setAddingWinner(false)}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl font-black text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!newWinnerData.winnerName || !newWinnerData.winnerNumber || !newWinnerData.prizeTitle) {
                        alert("Por favor, preencha o nome, número e o título do prêmio.");
                        return;
                      }
                      try {
                        await adminService.addWinnerHistory(getAdminToken(), {
                          winnerName: newWinnerData.winnerName,
                          winnerNumber: newWinnerData.winnerNumber,
                          raffleTitle: newWinnerData.raffleTitle || "Rifa",
                          prizeTitle: newWinnerData.prizeTitle,
                          prizeImageUrl: newWinnerData.prizeImageUrl || "",
                          prizeDescription: newWinnerData.prizeDescription || "",
                          prizeValue: newWinnerData.prizeValue || "",
                          drawDate: newWinnerData.drawDate,
                          drawTime: newWinnerData.drawTime || "",
                          city: newWinnerData.city || "",
                          state: newWinnerData.state || "",
                          status: newWinnerData.status || "Normal",
                          instagram: newWinnerData.instagram || "",
                          videoLink: newWinnerData.videoLink || "",
                          winnerImageUrl: newWinnerData.winnerImageUrl || "",
                          raffleId: "manual",
                        });
                        setAddingWinner(false);
                        alert("Ganhador adicionado com sucesso!");
                      } catch (err: any) {
                        alert("Erro ao adicionar: " + err.message);
                      }
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Registrar Ganhador
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingWinner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-orange-400" /> Editar Ganhador
              </h3>
              <p className="text-xs text-zinc-500 mt-1">Atualize os dados do ganhador no Hall da Fama.</p>

              {/* SELECTOR FOR DESIRED RAFFLE */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-zinc-500">Auto-preencher Rifa:</span>
                <select
                  value=""
                  onChange={(e) => {
                    const targetRaffle = raffles.find(r => r.id === e.target.value);
                    if (targetRaffle) {
                      setEditingWinner((prev: any) => ({
                        ...prev,
                        raffleTitle: targetRaffle.title || "",
                        prizeTitle: targetRaffle.title || "",
                        prizeImageUrl: targetRaffle.imageUrl || "",
                        prizeDescription: targetRaffle.description || "",
                      }));
                    }
                  }}
                  className="bg-zinc-900 border border-zinc-850 text-[10px] font-black uppercase text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-violet-500"
                >
                  <option value="">-- SELECIONAR RIFA --</option>
                  {raffles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title || "Sem Título"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome Completo do Ganhador</label>
                    <input
                      type="text"
                      placeholder="ex: João Silva"
                      value={editingWinner.winnerName || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, winnerName: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Foto do Ganhador</label>
                    <div className="flex items-center gap-2 bg-black p-2 rounded-xl border border-zinc-900">
                      {editingWinner.winnerImageUrl ? (
                        <img src={editingWinner.winnerImageUrl} className="w-10 h-10 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600 shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="URL ou carregue..."
                          value={editingWinner.winnerImageUrl || ""}
                          onChange={(e) => setEditingWinner({ ...editingWinner, winnerImageUrl: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] text-white outline-none"
                        />
                        <label className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-white rounded-md text-[9px] font-bold cursor-pointer w-fit">
                          <Upload className="w-2.5 h-2.5 text-amber-500" />
                          {uploadingWinnerImage ? "Enviando..." : "Enviar Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingWinnerImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploadingWinnerImage(true);
                                const url = await performRobustImageUpload(file);
                                setEditingWinner((prev: any) => ({ ...prev, winnerImageUrl: url }));
                              } catch (err: any) {
                                alert("Falha no upload: " + err.message);
                              } finally {
                                setUploadingWinnerImage(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome da Rifa</label>
                    <input
                      type="text"
                      placeholder="ex: Rifa Beneficente"
                      value={editingWinner.raffleTitle || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, raffleTitle: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome do Prêmio</label>
                    <input
                      type="text"
                      placeholder="ex: PlaySation 5"
                      value={editingWinner.prizeTitle || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, prizeTitle: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Foto do Prêmio</label>
                    <div className="flex items-center gap-2 bg-black p-2 rounded-xl border border-zinc-900">
                      {editingWinner.prizeImageUrl ? (
                        <img src={editingWinner.prizeImageUrl} className="w-10 h-10 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600 shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="URL ou carregue..."
                          value={editingWinner.prizeImageUrl || ""}
                          onChange={(e) => setEditingWinner({ ...editingWinner, prizeImageUrl: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] text-white outline-none"
                        />
                        <label className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-white rounded-md text-[9px] font-bold cursor-pointer w-fit">
                          <Upload className="w-2.5 h-2.5 text-amber-500" />
                          {uploadingPrizeImage ? "Enviando..." : "Enviar Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingPrizeImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploadingPrizeImage(true);
                                const url = await performRobustImageUpload(file);
                                setEditingWinner((prev: any) => ({ ...prev, prizeImageUrl: url }));
                              } catch (err: any) {
                                alert("Falha no upload: " + err.message);
                              } finally {
                                setUploadingPrizeImage(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Valor Estimado (R$)</label>
                    <input
                      type="text"
                      placeholder="ex: 4.500,00"
                      value={editingWinner.prizeValue || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, prizeValue: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Descrição Resumida</label>
                  <textarea
                    placeholder="ex: Ganhador levou o prêmio..."
                    value={editingWinner.prizeDescription || ""}
                    onChange={(e) => setEditingWinner({ ...editingWinner, prizeDescription: e.target.value })}
                    className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50 h-20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Número da Cota</label>
                    <input
                      type="text"
                      placeholder="ex: 123456"
                      value={editingWinner.winnerNumber || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, winnerNumber: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Data Sorteio</label>
                    <input
                      type="text"
                      placeholder="23/07/2026"
                      value={editingWinner.drawDate || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, drawDate: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Horário Sorteio</label>
                    <input
                      type="text"
                      placeholder="19:00"
                      value={editingWinner.drawTime || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, drawTime: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cidade</label>
                    <input
                      type="text"
                      placeholder="ex: Florianópolis"
                      value={editingWinner.city || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, city: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Estado (UF)</label>
                    <input
                      type="text"
                      placeholder="ex: SC"
                      value={editingWinner.state || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, state: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Instagram (Sem @)</label>
                    <input
                      type="text"
                      placeholder="ex: joao_silva"
                      value={editingWinner.instagram || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, instagram: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Link do Vídeo</label>
                    <input
                      type="text"
                      placeholder="https://youtube.com/..."
                      value={editingWinner.videoLink || ""}
                      onChange={(e) => setEditingWinner({ ...editingWinner, videoLink: e.target.value })}
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Status do Ganhador</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditingWinner({ ...editingWinner, status: "Normal" })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                        editingWinner.status !== "Destaque"
                          ? "bg-zinc-900 text-white border-zinc-800"
                          : "bg-black text-zinc-500 border-zinc-900 hover:text-zinc-400"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingWinner({ ...editingWinner, status: "Destaque" })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        editingWinner.status === "Destaque"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          : "bg-black text-zinc-500 border-zinc-900 hover:text-zinc-400"
                      }`}
                    >
                      <Sparkles className="w-4 h-4" /> Destaque
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setEditingWinner(null)}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl font-black text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await adminService.updateWinner(getAdminToken(), editingWinner.id, {
                          winnerName: editingWinner.winnerName,
                          winnerNumber: editingWinner.winnerNumber,
                          raffleTitle: editingWinner.raffleTitle || "Rifa",
                          prizeTitle: editingWinner.prizeTitle || "",
                          prizeImageUrl: editingWinner.prizeImageUrl || "",
                          prizeDescription: editingWinner.prizeDescription || "",
                          prizeValue: editingWinner.prizeValue || "",
                          drawDate: editingWinner.drawDate,
                          drawTime: editingWinner.drawTime || "",
                          city: editingWinner.city || "",
                          state: editingWinner.state || "",
                          status: editingWinner.status || "Normal",
                          instagram: editingWinner.instagram || "",
                          videoLink: editingWinner.videoLink || "",
                          winnerImageUrl: editingWinner.winnerImageUrl || "",
                        });
                        setEditingWinner(null);
                        alert("Ganhador updated com sucesso!");
                      } catch (err: any) {
                        alert("Erro ao salvar: " + err.message);
                      }
                    }}
                    className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full">
              <h3 className="text-sm font-black uppercase text-white mb-2">Confirmação</h3>
              <p className="text-zinc-400 text-xs mb-6">{confirmAction.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 bg-zinc-900 text-white text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAction.onConfirm}
                  className="flex-1 py-2.5 bg-red-500 text-black text-xs font-black rounded-xl"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderPaidToastsContainer = () => {
    if (paidToasts.length === 0) return null;
    return (
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full px-2 pointer-events-none">
        {paidToasts.map((toast) => {
          const isPending = toast.type === "pending";
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto bg-zinc-900/95 border-2 ${
                isPending ? "border-amber-500/80" : "border-emerald-500/80"
              } text-white rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 flex flex-col gap-2.5 relative overflow-hidden`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
                  isPending
                    ? "from-amber-500 via-orange-400 to-yellow-400"
                    : "from-emerald-500 via-teal-400 to-emerald-400"
                }`}
              />

              <div className="flex items-start justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full ${
                      isPending
                        ? "bg-amber-500/20 border border-amber-500/50 text-amber-400"
                        : "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                    } flex items-center justify-center shrink-0`}
                  >
                    {isPending ? (
                      <Clock className="w-5 h-5 animate-pulse" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-black tracking-wider uppercase block ${
                        isPending ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {isPending ? "🔔 NOVO PEDIDO PENDENTE" : "🟢 PAGAMENTO CONFIRMADO!"}
                    </span>
                    <span className="text-xs font-black text-zinc-100">{toast.name}</span>
                  </div>
                </div>

                <button
                  onClick={() => setPaidToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[11px] text-zinc-200 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <span
                    className={`font-mono font-black ${
                      isPending ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    #{toast.orderId}
                  </span>
                  {toast.numsCount > 0 && (
                    <span className="text-zinc-400 text-[10px] ml-1.5">
                      ({toast.numsCount} cota{toast.numsCount > 1 ? "s" : ""})
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-black ${
                    isPending ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  R$ {toast.total ? Number(toast.total).toFixed(2).replace(".", ",") : "0,00"}
                </span>
              </div>

              {toast.raffleTitle && (
                <p className="text-[10px] text-zinc-400 font-semibold truncate">
                  Rifa: <span className="text-zinc-200">{toast.raffleTitle}</span>
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                <span className="text-[10px] font-bold text-zinc-500">{toast.time}</span>
                <button
                  onClick={() => {
                    setPaidToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    setUnreadPaidCount(0);
                    if (toast.raffleId && toast.raffleId !== "current") {
                      setSelectedRaffleId(toast.raffleId);
                    }
                    setCurrentAdminTab("orders");
                    setActiveTab("orders");
                    setViewMode("detail");
                  }}
                  className={`text-xs font-black hover:underline flex items-center gap-1 cursor-pointer ${
                    isPending
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-emerald-400 hover:text-emerald-300"
                  }`}
                >
                  Ver Pedido →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPlanningSection = () => {
    const custo = parseFloat(custoPremioInput.replace(",", ".")) || 0;
    const lucro = parseFloat(lucroDesejadoInput.replace(",", ".")) || 0;
    const taxa = parseFloat(taxaMPInput.replace(",", ".")) || 0;
    const totalCotas = parseInt(totalNumbersInput) || 1000;
    const pricePlan = parseFloat(valorCotaPlanejadoInput.replace(",", ".")) || 10;

    const buyNum = parseFloat(promoBuyInput) || 5;
    const bonusNum = parseFloat(promoBonusInput) || 1;

    // Faturamento líquido necessário para cobrir o prêmio e dar o lucro desejado
    const faturamentoLiquidoNecessario = custo + lucro;
    // Faturamento bruto necessário considerando as taxas
    const divisor = 1 - (taxa / 100);
    const faturamentoBrutoNecessario = divisor > 0 ? (faturamentoLiquidoNecessario / divisor) : 0;

    // 1. QUANTIDADE DE COTAS NECESSÁRIAS (para atingir o lucro desejado vendendo pelo preço planejado):
    const cotasPagasNecessarias = pricePlan > 0 ? Math.ceil(faturamentoBrutoNecessario / pricePlan) : 0;
    const pacotesCompletos = buyNum > 0 ? Math.floor(cotasPagasNecessarias / buyNum) : 0;
    const cotasBonusNecessarias = (promoAtivaInput && buyNum > 0 && bonusNum > 0)
      ? (pacotesCompletos * bonusNum)
      : 0;
    const cotasTotaisNecessarias = cotasPagasNecessarias + cotasBonusNecessarias;

    // 2. PREÇO IDEAL RECOMENDADO POR COTA (Protegendo o lucro desejado quando a promoção está ativa):
    // Se o usuário fixar a rifa em 'totalCotas', quantas cotas serão pagas pelo cliente?
    const cotasPagasNoTotal = (promoAtivaInput && buyNum > 0 && bonusNum > 0)
      ? (totalCotas * (buyNum / (buyNum + bonusNum)))
      : totalCotas;
    const cotasBonusNoTotal = totalCotas - cotasPagasNoTotal;

    // O preço ideal por cota deve ser calculated dividindo a meta de faturamento pelo número de COTAS PAGAS!
    const cotaIdeal = cotasPagasNoTotal > 0 ? (faturamentoBrutoNecessario / cotasPagasNoTotal) : 0;

    // 3. CENÁRIO PLANEJADO (Projeção real considerando o Preço e Total informados):
    const faturamentoBrutoPlanejado = cotasPagasNoTotal * pricePlan;
    const taxaTotalPlanejada = faturamentoBrutoPlanejado * (taxa / 100);
    const faturamentoLiquidoPlanejado = faturamentoBrutoPlanejado - taxaTotalPlanejada;
    const lucroLiquidoPlanejado = faturamentoLiquidoPlanejado - custo;
    const margemLucro = faturamentoBrutoPlanejado > 0 ? (lucroLiquidoPlanejado / faturamentoBrutoPlanejado) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* HEADER */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 font-bebas">Inteligência Financeira</span>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-0.5 font-bebas">🧮 Planejamento e Cálculos da Rifa</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Simule custos, configure bônus e calcule a quantidade de cotas e o valor ideal para proteger seu lucro desejado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Rifa Selecionada:</span>
            <span className="px-3 py-1.5 bg-violet-950/40 text-violet-300 border border-violet-850 rounded-xl text-xs font-bold uppercase font-bebas">
              {raffleConfig.title || "Sem Título"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* COLUNA 1: INPUTS & REQUISITOS DE COTAS (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 pb-3 border-b border-zinc-900 flex items-center gap-2 font-bebas">
                <Settings className="w-4 h-4 text-violet-400" /> Parâmetros de Simulação
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Custo do Prêmio (R$)</label>
                  <input
                    type="text"
                    value={custoPremioInput}
                    onChange={(e) => setCustoPremioInput(e.target.value)}
                    placeholder="Ex: 1500"
                    className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                  />
                  <span className="text-[9px] text-zinc-500">Valor investido na premiação.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Lucro Desejado (R$)</label>
                  <input
                    type="text"
                    value={lucroDesejadoInput}
                    onChange={(e) => setLucroDesejadoInput(e.target.value)}
                    placeholder="Ex: 5000"
                    className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                  />
                  <span className="text-[9px] text-zinc-500">Valor líquido limpo que deseja colocar no bolso.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Taxa Gateway (%)</label>
                  <input
                    type="text"
                    value={taxaMPInput}
                    onChange={(e) => setTaxaMPInput(e.target.value)}
                    placeholder="Ex: 1.5"
                    className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                  />
                  <span className="text-[9px] text-zinc-500">Taxa do Mercado Pago/PIX.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Total de Cotas Rifa</label>
                  <input
                    type="text"
                    value={totalNumbersInput}
                    onChange={(e) => setTotalNumbersInput(e.target.value)}
                    placeholder="Ex: 1000"
                    className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                  />
                  <span className="text-[9px] text-zinc-500">Capacidade máxima da campanha.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Valor da Cota (R$)</label>
                  <input
                    type="text"
                    value={valorCotaPlanejadoInput}
                    onChange={(e) => setValorCotaPlanejadoInput(e.target.value)}
                    placeholder="Ex: 5"
                    className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                  />
                  <span className="text-[9px] text-zinc-500">Preço de venda planejado.</span>
                </div>
              </div>
            </div>

            {/* BONUS NUMBER OPTIONS CARD */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2 font-bebas">
                  <Zap className="w-4 h-4 text-[#A3E635]" /> Números Bônus (Promoção Automática)
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoAtivaInput}
                    onChange={(e) => setPromoAtivaInput(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#A3E635]"></div>
                </label>
              </div>

              {promoAtivaInput ? (
                <div className="space-y-4">
                  <p className="text-[11px] text-zinc-400">
                    Defina a regra compre X e ganhe Y cotas bônus grátis. O cálculo de lucro protegerá automaticamente seu valor líquido!
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Compre (Quantidade de Cotas)</label>
                      <input
                        type="number"
                        min="1"
                        value={promoBuyInput}
                        onChange={(e) => setPromoBuyInput(e.target.value)}
                        placeholder="Ex: 2"
                        className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 font-bebas">Ganhe de Bônus (Cotas Extra Grátis)</label>
                      <input
                        type="number"
                        min="1"
                        value={promoBonusInput}
                        onChange={(e) => setPromoBonusInput(e.target.value)}
                        placeholder="Ex: 1"
                        className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  <div className="bg-[#A3E635]/10 border border-[#A3E635]/20 p-4 rounded-2xl text-xs text-[#A3E635] space-y-1.5">
                    <p className="font-bold">✨ Promoção Ativa: Compre {promoBuyInput}, Ganhe +{promoBonusInput} Grátis</p>
                    <p className="text-zinc-300 leading-relaxed">
                      A cada <strong>{promoBuyInput}</strong> cotas pagas no mesmo pedido, o cliente ganha <strong>{promoBonusInput}</strong> cota(s) bônus adicionais de graça.
                    </p>
                    <p className="text-[10px] text-[#A3E635] font-semibold">
                      🛡️ As cotas bônus são consideradas nos cálculos para que NUNCA reduzam seu lucro líquido desejado.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Promoção desativada. Todas as cotas da rifa serão cobradas pelo preço cheio planejado (R$ {pricePlan.toFixed(2)} cada).
                </p>
              )}
            </div>

            {/* DEDICATED CARD: QUANTIDADE DE COTAS NECESSÁRIAS */}
            <div className="bg-gradient-to-br from-violet-950/30 via-zinc-950 to-zinc-950 border border-violet-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                <h3 className="text-xs font-black uppercase tracking-wider text-violet-300 flex items-center gap-2 font-bebas">
                  <Calculator className="w-4 h-4 text-violet-400" /> Quantidade de Cotas Necessárias para Atingir a Meta
                </h3>
                <span className="px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-black rounded-lg uppercase">
                  Preço Fixado: R$ {pricePlan.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div className="bg-black/50 border border-zinc-900 rounded-2xl p-3.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 font-bebas">Cotas Pagas Vendas</span>
                  <div className="text-xl font-black text-[#A3E635] mt-1 font-mono">{cotasPagasNecessarias} un</div>
                  <span className="text-[8px] text-zinc-500">Arrecadam R$ {(cotasPagasNecessarias * pricePlan).toFixed(2)}</span>
                </div>

                <div className="bg-black/50 border border-zinc-900 rounded-2xl p-3.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 font-bebas">Cotas Bônus (Graça)</span>
                  <div className="text-xl font-black text-amber-400 mt-1 font-mono">{cotasBonusNecessarias} un</div>
                  <span className="text-[8px] text-zinc-500">{promoAtivaInput ? `Regra ${promoBuyInput}x${promoBonusInput}` : "Sem bônus"}</span>
                </div>

                <div className="bg-violet-950/40 border border-violet-500/30 rounded-2xl p-3.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-violet-300 font-bebas">Total Cotas na Rifa</span>
                  <div className="text-xl font-black text-white mt-1 font-mono">{cotasTotaisNecessarias} un</div>
                  <span className="text-[8px] text-violet-400 font-bold">Capacidade Mínima</span>
                </div>
              </div>

              <div className="p-3 bg-zinc-900/60 border border-zinc-880 rounded-2xl text-[11px] text-zinc-300 leading-relaxed">
                💡 <strong>Resultado da Meta:</strong> Para colocar <strong className="text-[#A3E635]">R$ {lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> limpos no bolso vendendo a <strong>R$ {pricePlan.toFixed(2)}</strong>/cota {promoAtivaInput ? "com bônus ativo" : ""}, sua rifa precisa ter no mínimo <strong className="text-white">{cotasTotaisNecessarias} cotas</strong> cadastradas no total ({cotasPagasNecessarias} pagas + {cotasBonusNecessarias} bônus grátis).
              </div>
            </div>
          </div>

          {/* COLUNA 2: RESULTADOS DOS CÁLCULOS (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* CARD METAS E PREÇO RECOMENDADO */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 pb-3 border-b border-zinc-900 font-bebas flex items-center justify-between">
                <span>🎯 Metas e Preço Recomendado</span>
                <span className="text-[10px] text-violet-400 font-bold">Proteção de Lucro</span>
              </h3>

              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500 font-bebas">Faturamento Bruto Necessário</span>
                  <div className="text-2xl font-black text-white mt-1 font-mono">
                    R$ {faturamentoBrutoNecessario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Arrecadação necessária para cobrir as taxas do gateway (R$ {(faturamentoBrutoNecessario - faturamentoLiquidoNecessario).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}) e o prêmio, garantindo seu lucro líquido desejado.
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-violet-400 font-bebas">Preço Ideal Recomendado por Cota</span>
                  <div className="text-2xl font-black text-violet-400 mt-1 font-mono">
                    R$ {cotaIdeal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {promoAtivaInput ? (
                      <>
                        Considerando que <strong>{Math.round(cotasPagasNoTotal)}</strong> das {totalCotas} cotas serão pagas (e <strong>{Math.round(cotasBonusNoTotal)}</strong> serão bônus grátis), cobrar <strong>R$ {cotaIdeal.toFixed(2)}</strong> por cota garante 100% do seu lucro líquido de R$ {lucro.toFixed(2)}!
                      </>
                    ) : (
                      <>Se você vender todas as {totalCotas} cotas sem bônus, este é o valor unitário para bater sua meta de lucro.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* CARD PROJEÇÃO REAL */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 pb-3 border-b border-zinc-900 flex items-center justify-between font-bebas">
                <span>📊 Projeção do Seu Cenário</span>
                <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-850 text-zinc-400 text-[9px] font-bold rounded-lg uppercase">
                  {promoAtivaInput ? "Com Bônus Ativo" : "Sem Bônus"}
                </span>
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                  <span className="text-zinc-400">Total de Cotas da Rifa</span>
                  <span className="font-bold text-white font-mono">{totalCotas}</span>
                </div>

                {promoAtivaInput && (
                  <>
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                      <span className="text-zinc-400">Cotas Pagas Estimadas</span>
                      <span className="font-bold text-[#A3E635] font-mono">{Math.round(cotasPagasNoTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                      <span className="text-zinc-400">Cotas Bônus (Dadas de Graça)</span>
                      <span className="font-bold text-amber-400 font-mono">{Math.round(cotasBonusNoTotal)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                  <span className="text-zinc-400">Faturamento Bruto Estimado</span>
                  <span className="font-black text-white font-mono">
                    R$ {faturamentoBrutoPlanejado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                  <span className="text-zinc-400">Taxas Gateway ({taxa}%)</span>
                  <span className="font-bold text-red-400 font-mono">
                    - R$ {taxaTotalPlanejada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                  <span className="text-zinc-400">Faturamento Líquido Estimado</span>
                  <span className="font-bold text-zinc-300 font-mono">
                    R$ {faturamentoLiquidoPlanejado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-zinc-900/50">
                  <span className="text-zinc-400">Custo do Prêmio</span>
                  <span className="font-bold text-red-500 font-mono">
                    - R$ {custo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-zinc-300 font-bold">Lucro Líquido Real</span>
                  <span className={`font-black text-lg font-mono ${lucroLiquidoPlanejado >= lucro ? "text-[#A3E635]" : lucroLiquidoPlanejado > 0 ? "text-amber-400" : "text-red-500"}`}>
                    R$ {lucroLiquidoPlanejado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-zinc-500">
                  <span>Margem Líquida</span>
                  <span className="font-bold font-mono">{margemLucro.toFixed(1)}%</span>
                </div>
              </div>

              {/* PROFIT STATUS NOTICE */}
              {lucroLiquidoPlanejado >= lucro ? (
                <div className="p-3 bg-[#A3E635]/10 border border-[#A3E635]/20 rounded-2xl text-[11px] text-[#A3E635]">
                  ✅ <strong>Lucro Protegido!</strong> O preço atual de R$ {pricePlan.toFixed(2)} garante R$ {lucroLiquidoPlanejado.toFixed(2)} de lucro líquido, cobrindo a meta de R$ {lucro.toFixed(2)} sem sofrer prejuízo do bônus.
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-400 space-y-1">
                  <p className="font-bold">⚠️ Atenção: Lucro Abaixo da Meta</p>
                  <p className="text-[10px] text-zinc-300 leading-normal">
                    Cobrando R$ {pricePlan.toFixed(2)}/cota com o bônus ativo em {totalCotas} cotas, seu lucro líquido fica em R$ {lucroLiquidoPlanejado.toFixed(2)} (meta: R$ {lucro.toFixed(2)}).
                  </p>
                  <p className="text-[10px] text-amber-300 font-bold">
                    👉 Dica: Ajuste o valor da cota para R$ {cotaIdeal.toFixed(2)} ou aumente o número de cotas para {cotasTotaisNecessarias} para garantir 100% da sua meta.
                  </p>
                </div>
              )}

              {/* ACTION TO SAVE ON THE LIVE CAMPAIGN */}
              <button
                onClick={handleApplyPlanning}
                disabled={isSaving}
                className="w-full py-4 mt-2 bg-gradient-to-r from-[#A3E635] to-emerald-500 hover:from-[#bbf255] hover:to-emerald-400 text-black rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#A3E635]/15 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    APLICANDO...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-black" />
                    APLICAR NA RIFA ATIVA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCotasGrid = () => {
    const total = raffleConfig.totalNumbers || 100;
    const cotaMap: Record<string, "pago" | "pendente"> = {};
    orders.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      const isPaid = s === "pago" || s === "paid" || s === "approved";
      const isPending = s === "pending_payment" || s === "aguardando" || s === "reserved";
      if (isPaid || isPending) {
        (o.nums || []).forEach((n: string) => {
          cotaMap[String(parseInt(n, 10))] = isPaid ? "pago" : "pendente";
        });
      }
    });

    const items = [];
    const padSize = String(total).length;
    for (let i = 1; i <= total; i++) {
      const status = cotaMap[String(i)] || "disponivel";
      items.push({ num: String(i).padStart(padSize, "0"), status });
    }

    return (
      <div className="bg-[#111513] border border-[#1A1F1B] rounded-[2rem] p-6 space-y-6 font-inter">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#A3E635]">Painel de Controle de Cotas</span>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white font-bebas mt-0.5">Visualizador em Tempo Real</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Status atual das cotas para a campanha <strong className="text-white">{raffleConfig.title || "Rifa Selecionada"}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase font-bebas tracking-wider border-b border-[#1A1F1B] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-[#1A1F1B] border border-zinc-800" />
            <span className="text-zinc-500">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-[#A3E635] border border-[#A3E635]/20" />
            <span className="text-[#A3E635]">Pago</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-[#F5C542] border border-[#F5C542]/20" />
            <span className="text-[#F5C542]">Reservado (Pendente)</span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
          {items.map((item) => (
            <div
              key={item.num}
              className={`p-2 rounded-xl text-center font-mono text-xs font-extrabold select-none transition-all border ${
                item.status === "pago"
                  ? "bg-[#A3E635] text-black border-[#A3E635]/20 shadow-md shadow-[#A3E635]/10"
                  : item.status === "pendente"
                  ? "bg-[#F5C542] text-black border-[#F5C542]/20 shadow-md shadow-[#F5C542]/10"
                  : "bg-[#1A1F1B] text-zinc-400 border-[#1A1F1B] hover:text-white hover:border-zinc-700"
              }`}
            >
              {item.num}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAuditLogs = () => {
    return (
      <div className="bg-[#111513] border border-[#1A1F1B] rounded-[2rem] p-6 space-y-6 font-inter">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#A3E635]">Auditoria de Segurança</span>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white font-bebas mt-0.5">Logs de Ações Administrativas</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Registro em tempo real de todas as ações de configuração, vendas, e apuração efetuadas no painel administrativo para segurança da plataforma.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#1A1F1B]">
          <table className="w-full text-left text-xs bg-[#111513]">
            <thead>
              <tr className="bg-[#1A1F1B] text-[10px] text-zinc-400 uppercase font-black tracking-widest border-b border-[#1A1F1B]">
                <th className="p-4 font-bebas tracking-wider text-sm">Data / Hora</th>
                <th className="p-4 font-bebas tracking-wider text-sm">Usuário</th>
                <th className="p-4 font-bebas tracking-wider text-sm">Ação</th>
                <th className="p-4 font-bebas tracking-wider text-sm">Detalhes do Evento</th>
                <th className="p-4 font-bebas tracking-wider text-sm">Endereço IP</th>
                <th className="p-4 text-center font-bebas tracking-wider text-sm">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1F1B]/50 font-medium">
              {AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="p-4 text-zinc-400 font-mono text-[10px] whitespace-nowrap">
                    {log.date} <span className="text-zinc-600">{log.time}</span>
                  </td>
                  <td className="p-4 text-white font-bold font-bebas uppercase tracking-wide">
                    {log.user}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-[#A3E635]/15 border border-[#A3E635]/20 text-[#A3E635] text-[10px] font-bold uppercase tracking-wider rounded-lg font-bebas">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-300 max-w-sm truncate">
                    {log.details}
                  </td>
                  <td className="p-4 text-zinc-500 font-mono text-[10px]">
                    {log.ip}
                  </td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] rounded font-semibold font-bebas">
                      SUCCESS
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSidebarLayout = (children: React.ReactNode) => {
    return (
      <div className="min-h-screen bg-[#0B0F0C] text-white flex flex-col md:flex-row font-inter">
        {/* Left Sidebar on Desktop */}
        <aside className="w-64 bg-[#111513] border-r border-[#1A1F1B] flex-shrink-0 hidden md:flex flex-col justify-between sticky top-0 h-screen z-20">
          <div className="p-6 space-y-6">
            {/* Brand logo */}
            <div className="flex items-center gap-3">
              <div className="bg-[#1A1F1B] p-2 rounded-xl border border-[#A3E635]/20">
                <ShieldCheck className="w-6 h-6 text-[#A3E635]" />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-wider text-white font-bebas">RifaMaster</h1>
                <p className="text-[9px] text-[#A3E635] font-bold uppercase tracking-widest font-bebas">Command Center</p>
              </div>
            </div>

            {/* Campaign Selection Selector Dropdown */}
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider font-bebas">Campanha Ativa</label>
              <div className="relative">
                <select
                  value={selectedRaffleId}
                  onChange={(e) => {
                    setSelectedRaffleId(e.target.value);
                    setViewMode("detail");
                    setActiveTab("dashboard");
                  }}
                  className="w-full bg-[#1A1F1B] border border-[#1A1F1B] text-white text-xs font-black uppercase rounded-xl px-3 py-2.5 pr-8 appearance-none outline-none cursor-pointer focus:border-[#A3E635] font-bebas"
                >
                  {raffles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title || "Rifa Sem Título"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Menu list */}
            <nav className="space-y-1">
              {[
                { id: "overview", label: "Dashboard", icon: LayoutDashboard },
                { id: "rifas", label: "Minhas Rifas", icon: Ticket },
                { id: "orders", label: "Compras / Pedidos", icon: ClipboardList },
                { id: "customers", label: "Top Clientes", icon: Users },
                { id: "cotas", label: "Cotas", icon: Grid },
                { id: "planning", label: "Planejamento", icon: Calculator },
                { id: "winners", label: "Sorteios", icon: Zap },
                { id: "hall_da_fama", label: "Hall da Fama", icon: Award },
                { id: "audit", label: "Auditoria", icon: ShieldCheck },
                { id: "store", label: "Loja Premium", icon: ShoppingBag },
                { id: "settings", label: "Configurações", icon: Settings },
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = currentAdminTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwitchAdminTab(item.id)}
                    className={`w-full flex justify-between items-center px-3.5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-bebas ${
                      isActive
                        ? "bg-[#A3E635] text-black shadow-md shadow-[#A3E635]/15 font-extrabold"
                        : "text-zinc-400 hover:text-white hover:bg-[#1A1F1B]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Profile / Logout */}
          <div className="p-6 border-t border-[#1A1F1B] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1A1F1B] border border-[#A3E635]/20 flex items-center justify-center font-bebas text-xs font-extrabold text-[#A3E635]">
                AD
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase font-bebas leading-none mb-0.5">Administrador</p>
                <span className="text-[9px] text-[#A3E635] uppercase font-black tracking-widest leading-none">Online</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Mobile Header Menu */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <header className="md:hidden border-b border-[#1A1F1B] bg-[#111513] sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#A3E635]" />
              <h1 className="text-sm font-black uppercase tracking-wider text-white font-bebas">RifaMaster</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="flex items-center gap-2 bg-[#1A1F1B] border border-[#A3E635]/30 text-xs font-black uppercase text-white rounded-xl px-3 py-2 outline-none cursor-pointer font-bebas active:scale-95 transition-all"
              >
                <span className="text-[#A3E635]">
                  {currentAdminTab === "overview" && "Dashboard"}
                  {currentAdminTab === "rifas" && "Minhas Rifas"}
                  {currentAdminTab === "orders" && "Pedidos"}
                  {currentAdminTab === "customers" && "Top Clientes"}
                  {currentAdminTab === "cotas" && "Cotas"}
                  {currentAdminTab === "winners" && "Sorteios"}
                  {currentAdminTab === "hall_da_fama" && "Hall da Fama"}
                  {currentAdminTab === "planning" && "Planejamento"}
                  {currentAdminTab === "audit" && "Auditoria"}
                  {currentAdminTab === "store" && "Loja Premium"}
                  {currentAdminTab === "settings" && "Configurações"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={logout}
                className="p-2 bg-red-500/10 text-red-400 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* Mobile Dropdown Menu Overlay */}
          {mobileNavOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
              <div className="bg-[#111513] border-t border-[#1A1F1B] rounded-t-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <span className="text-xs font-black uppercase tracking-widest text-[#A3E635] font-bebas">Navegação do Painel</span>
                  <button
                    onClick={() => setMobileNavOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 rounded-xl text-xs font-bold"
                  >
                    ✕ Fechar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
                    { id: "rifas", label: "Minhas Rifas", icon: Ticket },
                    { id: "orders", label: "Compras / Pedidos", icon: ClipboardList },
                    { id: "customers", label: "Top Clientes", icon: Users },
                    { id: "cotas", label: "Cotas", icon: Grid },
                    { id: "planning", label: "Planejamento & Cálculos", icon: Calculator },
                    { id: "winners", label: "Sorteios", icon: Zap },
                    { id: "hall_da_fama", label: "Hall da Fama", icon: Award },
                    { id: "audit", label: "Auditoria", icon: ShieldCheck },
                    { id: "store", label: "Loja Premium", icon: ShoppingBag },
                    { id: "settings", label: "Configurações", icon: Settings },
                  ].map((item) => {
                    const IconComp = item.icon;
                    const isActive = currentAdminTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSwitchAdminTab(item.id)}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider font-bebas transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#A3E635] text-black font-extrabold shadow-lg shadow-[#A3E635]/20"
                            : "bg-[#1A1F1B] text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComp className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {isActive && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW MODE 1: "MINHAS RIFAS" (LIST SCREEN)
  // ==========================================
  if (viewMode === "list") {
    return renderSidebarLayout(
      <div className="space-y-8 pb-32">
        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
          {currentAdminTab === "audit" ? (
          renderAuditLogs()
        ) : currentAdminTab === "winners" ? (
          <DrawsView selectedRaffleId={selectedRaffleId} raffleConfig={raffleConfig} />
        ) : mainAdminSection === "loja" ? (
          <AdminProducts />
        ) : mainAdminSection === "winners_hall" || currentAdminTab === "hall_da_fama" ? (
          <div className="space-y-6">
              {/* HEADER AREA */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Módulo Global</span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-0.5">🏆 Hall da Fama</h2>
                  <p className="text-xs text-zinc-500 mt-1">Gerencie os vencedores de todas as campanhas de forma independente do ciclo de vida das rifas.</p>
                </div>

                <button
                  onClick={() => {
                    setNewWinnerData({
                      winnerName: "",
                      winnerNumber: "",
                      prizeTitle: "",
                      prizeImageUrl: "",
                      prizeDescription: "",
                      prizeValue: "",
                      drawDate: new Date().toLocaleDateString("pt-BR"),
                      drawTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                      city: "",
                      state: "",
                      status: "Normal",
                      videoLink: "",
                      instagram: ""
                    });
                    setAddingWinner(true);
                  }}
                  className="px-6 py-3.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Registrar Novo Ganhador
                </button>
              </div>

              {/* STATS AREA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-500">Total de Ganhadores</p>
                    <p className="text-2xl font-black text-white mt-1">{winnersList.length}</p>
                  </div>
                  <div className="p-3 bg-zinc-900 text-amber-500 rounded-2xl">
                    <Trophy className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-500">Ganhadores em Destaque</p>
                    <p className="text-2xl font-black text-amber-500 mt-1">{winnersList.filter(w => w.status === "Destaque").length}</p>
                  </div>
                  <div className="p-3 bg-zinc-900 text-yellow-500 rounded-2xl">
                    <Sparkles className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* FILTERS & SEARCH BAR */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3.5">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={winnerSearch}
                    onChange={(e) => setWinnerSearch(e.target.value)}
                    placeholder="Buscar por nome, prêmio ou rifa..."
                    className="w-full bg-black border border-zinc-900 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-zinc-800 transition-colors placeholder:text-zinc-600"
                  />
                  {winnerSearch && (
                    <button onClick={() => setWinnerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs font-bold">✕</button>
                  )}
                </div>

                {/* TABS CHIPS */}
                <div className="flex bg-black p-1 rounded-xl border border-zinc-900 gap-1 overflow-x-auto w-full sm:w-auto">
                  {[
                    { id: "all", label: "Todos" },
                    { id: "featured", label: "⭐ Destaques" },
                    { id: "month", label: "📅 Este Mês" },
                    { id: "year", label: "⏳ Este Ano" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setWinnerFilter(tab.id as any)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        winnerFilter === tab.id
                          ? "bg-zinc-900 text-white border border-zinc-800"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* TABLE AREA */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <div className="overflow-x-auto rounded-2xl border border-zinc-900">
                  <table className="w-full text-left text-xs bg-black/20">
                    <thead className="bg-zinc-950 text-[10px] text-zinc-500 uppercase font-black">
                      <tr>
                        <th className="p-4">Foto / Prêmio</th>
                        <th className="p-4">Ganhador</th>
                        <th className="p-4">Rifa / Título</th>
                        <th className="p-4">Cota</th>
                        <th className="p-4">Localidade / Data</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                      {sortedAndFilteredWinners.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-zinc-500 font-bold uppercase text-xs">
                            Nenhum ganhador correspondente aos filtros.
                          </td>
                        </tr>
                      ) : (
                        sortedAndFilteredWinners.map((w) => (
                          <tr key={w.id} className="hover:bg-zinc-900/10">
                            <td className="p-4">
                              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center text-zinc-600 relative">
                                {w.prizeImageUrl ? (
                                  <img
                                    src={w.prizeImageUrl}
                                    alt={w.prizeTitle}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-zinc-700" />
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-white uppercase">{w.winnerName}</div>
                              {w.instagram && (
                                <a
                                  href={`https://instagram.com/${w.instagram.replace("@", "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-orange-400 font-mono hover:underline"
                                >
                                  @{w.instagram.replace("@", "")}
                                </a>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="text-zinc-300 font-black text-xs uppercase">{w.prizeTitle || w.raffleTitle}</div>
                              {w.prizeDescription && (
                                <div className="text-[10px] text-zinc-500 mt-0.5 max-w-[200px] truncate">{w.prizeDescription}</div>
                              )}
                              {w.prizeValue && (
                                <div className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">R$ {w.prizeValue}</div>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-violet-600/10 text-violet-400 border border-violet-500/20 rounded-lg text-xs font-mono font-black">{w.winnerNumber}</span>
                            </td>
                            <td className="p-4 text-zinc-400">
                              <div className="text-xs font-bold">{w.drawDate} {w.drawTime || ""}</div>
                              {(w.city || w.state) && (
                                <div className="text-[10px] text-zinc-500 uppercase mt-0.5 font-bold">
                                  {w.city}{w.city && w.state ? ` - ${w.state}` : w.state}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <button
                                onClick={async () => {
                                  const newStatus = w.status === "Destaque" ? "Normal" : "Destaque";
                                  try {
                                    await adminService.updateWinner(getAdminToken(), w.id, { status: newStatus });
                                  } catch (err: any) {
                                    alert("Erro ao alternar status: " + err.message);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase transition-all cursor-pointer border ${
                                  w.status === "Destaque"
                                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                {w.status === "Destaque" ? "Destaque" : "Normal"}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingWinner(w)}
                                  className="p-2 bg-zinc-900 hover:bg-orange-500/20 border border-zinc-800 text-orange-400 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      message: `Deseja realmente remover ${w.winnerName} do Hall da Fama? Esta ação é irreversível.`,
                                      onConfirm: async () => {
                                        try {
                                          await adminService.deleteWinnerHistory(getAdminToken(), w.id);
                                          setConfirmAction(null);
                                          alert("Ganhador removido do Hall da Fama!");
                                        } catch (err: any) {
                                          alert("Erro ao excluir: " + err.message);
                                        }
                                      }
                                    });
                                  }}
                                  className="p-2 bg-zinc-900 hover:bg-red-500/20 border border-zinc-800 text-red-400 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* TITLE & ACTION BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-4 sm:p-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Painel Principal</span>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mt-0.5">Minhas Rifas</h2>
              <p className="text-xs text-zinc-500 mt-1">Gerencie, crie e acompanhe todas as suas campanhas ativas e passadas.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={fetchRaffles}
                className="p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
                title="Atualizar Lista"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleOpenGlobalPixModal}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-3 sm:py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-98 min-h-[44px]"
                title="Configurar PIX Global"
              >
                <Settings className="w-4 h-4 text-violet-400 shrink-0" />
                <span>PIX Global</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-98 min-h-[44px]"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Criar Nova Rifa</span>
              </button>
            </div>
          </div>

          {/* FILTERS & SEARCH BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar rifa por nome..."
                value={raffleListSearch}
                onChange={(e) => setRaffleListSearch(e.target.value)}
                className="w-full bg-black/80 border border-zinc-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none focus:border-violet-500 transition-all"
              />
            </div>

            <div className="flex bg-black/80 p-1 rounded-xl border border-zinc-850 gap-1 w-full sm:w-auto">
              {[
                { id: "todas", label: "Todas" },
                { id: "ativas", label: "Ativas" },
                { id: "encerradas", label: "Encerradas" },
                { id: "arquivadas", label: "Arquivadas" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRaffleListFilter(f.id as any)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                    raffleListFilter === f.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* RAFFLE CARDS GRID */}
          {filteredRafflesList.length === 0 ? (
            <div className="bg-zinc-950 border border-dashed border-zinc-900 rounded-[2.5rem] p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-600">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white uppercase">Nenhuma Rifa Encontrada</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {raffleListSearch ? "Nenhuma rifa corresponde à sua busca." : "Comece criando sua primeira rifa para receber pedidos."}
                </p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="px-5 py-3 bg-violet-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-violet-500 transition-all cursor-pointer"
              >
                + Criar Nova Rifa
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRafflesList.map((raffle) => {
                const totalN = Number(raffle.totalNumbers || 100);
                const soldN = Number(raffle.totalSoldNumbers || 0);

                const isEncerradaOrWinner = raffle.status === "encerrada" || Boolean(raffle.winnerNumber);
                const is100Percent = isEncerradaOrWinner || soldN >= totalN;
                const percentSold = is100Percent ? 100 : Math.min(100, Math.round((soldN / (totalN || 1)) * 100));

                return (
                  <div
                    key={raffle.id}
                    className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-[2rem] overflow-hidden flex flex-col justify-between transition-all hover:shadow-2xl hover:shadow-violet-950/20 group"
                  >
                    {/* CARD HEADER WITH IMAGE & BADGE */}
                    <div>
                      <div 
                        onClick={() => handleOpenRaffleDetail(raffle.id)}
                        className="relative h-48 bg-zinc-900 overflow-hidden cursor-pointer"
                      >
                        {raffle.imageUrl ? (
                          <img
                            src={raffle.imageUrl}
                            alt={raffle.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <ImageIcon className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          {renderStatusBadge(raffle.status, raffle.isRaffleActive)}
                        </div>
                        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono font-bold text-amber-400">
                          R$ {(raffle.price || 0).toFixed(2).replace(".", ",")} / cota
                        </div>
                      </div>

                      {/* CARD CONTENT */}
                      <div className="p-5 space-y-4">
                        <div>
                          <h3 className="text-base font-black text-white uppercase tracking-tight line-clamp-1">
                            {raffle.title || "Rifa Sem Título"}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-violet-400 bg-violet-950/40 border border-violet-800/40 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                              /{raffle.slug || slugify(raffle.title || "")}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rSlug = raffle.slug || slugify(raffle.title || "") || raffle.id;
                                const shareUrl = `${window.location.origin}/${rSlug}`;
                                safeCopyToClipboard(shareUrl);
                                alert(`Link de compartilhamento copiado:\n${shareUrl}`);
                              }}
                              className="text-[10px] text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-1 rounded-md transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Copiar link direto para divulgar"
                            >
                              <Copy className="w-3 h-3 text-violet-400" />
                              <span>Copiar</span>
                            </button>
                          </div>
                          {raffle.description && (
                            <p className="text-xs text-zinc-500 line-clamp-2 mt-1.5 leading-relaxed">
                              {raffle.description}
                            </p>
                          )}
                        </div>

                        {/* PROGRESS BAR & STATS */}
                        <div className="space-y-2 bg-black/40 p-3.5 rounded-2xl border border-zinc-900">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-zinc-400 uppercase">Vendas Realizadas</span>
                            <span className="font-mono font-bold text-white">{percentSold}%</span>
                          </div>

                          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentSold}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] pt-1">
                            <span className="font-bold text-zinc-500 uppercase">Arrecadação Total</span>
                            <span className="font-mono font-extrabold text-emerald-400 text-xs">
                              R$ {(raffle.totalRevenue || 0).toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CARD FOOTER ACTIONS */}
                    <div className="p-5 pt-0 space-y-2.5">
                      <button
                        onClick={() => handleOpenRaffleDetail(raffle.id)}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Abrir Painel da Rifa
                      </button>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {raffle.status === "ativa" || (raffle.isRaffleActive !== false && raffle.status !== "pausada" && raffle.status !== "encerrada" && raffle.status !== "arquivada") ? (
                          <button
                            onClick={() => handlePauseRaffle(raffle.id)}
                            className="py-2.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                            title="Pausar Rifa"
                          >
                            <Pause className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Pausar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateRaffle(raffle.id)}
                            className="py-2.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                            title="Ativar Rifa no Site"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            Ativar
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(raffle)}
                          className="py-2.5 px-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="Editar Rifa"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          Editar
                        </button>

                        <button
                          onClick={() => handleDuplicateRaffle(raffle.id)}
                          className="py-2.5 px-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="Duplicar Rifa"
                        >
                          <Copy className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          Duplicar
                        </button>

                        <button
                          onClick={() => handleResetRaffle(raffle.id, raffle.title)}
                          className="py-2.5 px-2 bg-zinc-900 hover:bg-amber-950/20 border border-zinc-800 hover:border-amber-900/30 text-amber-400 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="Resetar Rifa (Zerar Cotas)"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          Resetar
                        </button>

                        {raffle.status === "arquivada" ? (
                          <button
                            onClick={() => handleUnarchiveRaffle(raffle.id)}
                            className="py-2.5 px-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                            title="Desarquivar Rifa"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                            Desarquivar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveRaffle(raffle.id)}
                            className="py-2.5 px-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                            title="Arquivar Rifa"
                          >
                            <Archive className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            Arquivar
                          </button>
                        )}

                        {(!raffle.winnerNumber) && (
                          <button
                            onClick={() => handleOpenMarkAsDrawn(raffle)}
                            className="py-2.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                            title="Colocar Sorteio Realizado"
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Sorteio
                          </button>
                        )}

                        {raffle.status !== "encerrada" && raffle.status !== "arquivada" && (
                          <button
                            onClick={() => handleEndRaffle(raffle.id)}
                            className="py-2.5 px-2 bg-red-950/30 hover:bg-red-900/40 border border-red-500/40 text-red-400 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                            title="Encerrar Rifa Manualmente"
                          >
                            <Power className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            Encerrar
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteRaffle(raffle.id, raffle.title)}
                          className="py-2.5 px-2 bg-zinc-900 hover:bg-red-950/20 border border-zinc-800 hover:border-red-900/30 text-red-400 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="Excluir Rifa"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </main>

        {/* CREATE / EDIT RAFFLE MODAL */}
        {showRaffleModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] overflow-y-auto p-3 sm:p-4 md:p-6 flex justify-center items-start sm:items-center min-h-screen">
            <div className="bg-zinc-950 border border-zinc-850 w-full max-w-lg rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 my-3 sm:my-8 shadow-2xl relative">
              <div className="flex justify-between items-start border-b border-zinc-900 pb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white text-base uppercase tracking-tight">
                    {editingRaffleItem ? "Editar Rifa" : "Criar Nova Rifa"}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {editingRaffleItem ? "Atualize as configurações da rifa." : "Preencha os dados da sua nova campanha."}
                  </p>
                  
                  {/* SWITCH RAFFLE SELECTOR */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 w-full">
                    <span className="text-[10px] font-black uppercase text-zinc-500 shrink-0">Editar outra:</span>
                    <select
                      value={editingRaffleItem ? editingRaffleItem.id : ""}
                      onChange={(e) => {
                        const targetRaffle = raffles.find(r => r.id === e.target.value);
                        if (targetRaffle) {
                          setEditingRaffleItem(targetRaffle);
                          setModalTitle(targetRaffle.title || "");
                          setModalDescription(targetRaffle.description || "");
                          setModalPrice(String(targetRaffle.price || 10));
                          setModalTotalNumbers(String(targetRaffle.totalNumbers || 100));
                          setModalImageUrl(targetRaffle.imageUrl || "");
                          setModalPixKey(targetRaffle.pixKey || "");
                          setModalPixReceiver(targetRaffle.pixReceiver || "");
                          setModalPixBank(targetRaffle.pixBank || "");
                          setModalPixPhone(targetRaffle.pixPhone || "");
                          setModalPromoEnabled(Boolean(targetRaffle.promotionEnabled));
                          setModalPromoBuy(String(targetRaffle.promotionBuy || 5));
                          setModalPromoBonus(String(targetRaffle.promotionBonus || 1));
                          setModalPurchaseMode(targetRaffle.purchaseMode || "manual");
                          setModalPaymentMode(targetRaffle.paymentMode || "automatic");
                          setModalDrawMode(targetRaffle.drawMode || "automatico");
                          setModalFederalConcurso(targetRaffle.federalConcurso || "");
                          setModalFederalData(targetRaffle.federalData || "");
                          setModalFederalRegra(targetRaffle.federalRegra || "Último dígito do 1º prêmio");
                        } else {
                          // Switching back to creation mode
                          setEditingRaffleItem(null);
                          setModalTitle("");
                          setModalDescription("");
                          setModalPrice("10");
                          setModalTotalNumbers("100");
                          setModalImageUrl("");
                          // Keep default pix key configurations if available
                          const defaultRaffle = raffles[0];
                          if (defaultRaffle) {
                            setModalPixKey(defaultRaffle.pixKey || "");
                            setModalPixReceiver(defaultRaffle.pixReceiver || "");
                            setModalPixBank(defaultRaffle.pixBank || "");
                            setModalPixPhone(defaultRaffle.pixPhone || "");
                          }
                          setModalPromoEnabled(false);
                          setModalPromoBuy("5");
                          setModalPromoBonus("1");
                          setModalPurchaseMode("manual");
                          setModalPaymentMode("automatic");
                          setModalDrawMode("automatico");
                        }
                      }}
                      className="bg-zinc-900 border border-zinc-850 text-[10px] font-black uppercase text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-violet-500 max-w-full truncate"
                    >
                      <option value="">-- CRIAR NOVA RIFA --</option>
                      {raffles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title || "Sem Título"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setShowRaffleModal(false)}
                  className="p-2.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitRaffleModal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Título da Rifa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: iPhone 15 Pro Max 256GB"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Descrição Completa</label>
                  <textarea
                    rows={3}
                    placeholder="Descreva detalhes do prêmio, regras e entrega..."
                    value={modalDescription}
                    onChange={(e) => setModalDescription(e.target.value)}
                    className="w-full bg-black border border-zinc-850 rounded-2xl p-3 text-base sm:text-xs text-white outline-none focus:border-violet-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Valor da Cota (R$) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 10"
                      value={modalPrice}
                      onChange={(e) => setModalPrice(e.target.value)}
                      className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Total de Cotas *</label>
                    <input
                      type="number"
                      required
                      placeholder="Ex: 100"
                      value={modalTotalNumbers}
                      onChange={(e) => setModalTotalNumbers(e.target.value)}
                      className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white font-mono outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {/* IMAGE UPLOAD */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Imagem do Prêmio</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-black p-3 rounded-2xl border border-zinc-850">
                    <div className="flex items-center gap-3">
                      {modalImageUrl ? (
                        <img src={modalImageUrl} className="w-14 h-14 object-cover rounded-xl shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-14 h-14 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 shrink-0">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 flex-1 w-full min-w-0">
                      <input
                        type="text"
                        placeholder="URL da imagem ou envie do computador..."
                        value={modalImageUrl}
                        onChange={(e) => setModalImageUrl(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-base sm:text-[11px] text-white outline-none focus:border-violet-500"
                      />
                      <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-white rounded-lg text-xs sm:text-[10px] font-bold cursor-pointer w-full sm:w-auto">
                        <Upload className="w-3.5 h-3.5 text-violet-400" />
                        {uploadingModalImage ? "Enviando..." : "Carregar Imagem"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setUploadingModalImage(true);
                              const url = await performRobustImageUpload(file);
                              setModalImageUrl(url);
                            } catch (err: any) {
                              alert("Falha no upload: " + err.message);
                            } finally {
                              setUploadingModalImage(false);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* PIX INFO */}
                <div className="space-y-3 pt-2 border-t border-zinc-900">
                  <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">Dados do Recebedor PIX</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Chave PIX (CPF/CNPJ/Email/Telefone)"
                      value={modalPixKey}
                      onChange={(e) => setModalPixKey(e.target.value)}
                      className="w-full bg-black border border-zinc-850 rounded-xl px-3 py-2.5 text-base sm:text-[11px] text-white outline-none focus:border-violet-500"
                    />
                    <input
                      type="text"
                      placeholder="Nome do Titular"
                      value={modalPixReceiver}
                      onChange={(e) => setModalPixReceiver(e.target.value)}
                      className="w-full bg-black border border-zinc-850 rounded-xl px-3 py-2.5 text-base sm:text-[11px] text-white outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {/* MODO DE APROVAÇÃO DAS COMPRAS */}
                <div className="space-y-4 pt-2 border-t border-zinc-900">
                  <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">Modo de Aprovação das Compras</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModalPaymentMode("automatic")}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        modalPaymentMode === "automatic"
                          ? "bg-violet-500/10 border-violet-500 text-white shadow-md shadow-violet-500/10"
                          : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        modalPaymentMode === "automatic" ? "border-violet-400 bg-violet-500 text-white" : "border-zinc-700 bg-zinc-900"
                      }`}>
                        {modalPaymentMode === "automatic" && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-black uppercase tracking-wide text-white">Aprovação automática</div>
                        <div className="text-[9px] text-zinc-400 leading-tight">Pagamento confirmado automaticamente pelo gateway (Mercado Pago).</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalPaymentMode("manual")}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        modalPaymentMode === "manual"
                          ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/10"
                          : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        modalPaymentMode === "manual" ? "border-amber-400 bg-amber-500 text-black" : "border-zinc-700 bg-zinc-900"
                      }`}>
                        {modalPaymentMode === "manual" && <div className="w-2 h-2 rounded-full bg-black" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-black uppercase tracking-wide text-white">Aprovação pelo administrador</div>
                        <div className="text-[9px] text-zinc-400 leading-tight">Pedido fica aguardando conferência e somente o administrador pode aprovar.</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* CONFIGURAÇÃO DE COMPRA E SORTEIO */}
                <div className="space-y-4 pt-2 border-t border-zinc-900">
                  <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">Modos de Compra e Sorteio</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-400 block">Modo de Compra</label>
                      <select
                        value={modalPurchaseMode}
                        onChange={(e) => setModalPurchaseMode(e.target.value as "manual" | "aleatorio")}
                        className="w-full bg-black border border-zinc-850 rounded-2xl px-3 py-2.5 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="manual">Escolha Manual</option>
                        <option value="aleatorio">Escolha Aleatória (Bolsão)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-400 block">Modo de Sorteio</label>
                      <select
                        value={modalDrawMode}
                        onChange={(e) => setModalDrawMode(e.target.value as "automatico" | "federal")}
                        className="w-full bg-black border border-zinc-850 rounded-2xl px-3 py-2.5 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="automatico">RifaMaster Automático</option>
                        <option value="federal">Loteria Federal</option>
                      </select>
                    </div>
                  </div>

                  {modalDrawMode === "federal" && (
                    <div className="bg-zinc-900/50 border border-zinc-850 p-3.5 sm:p-4 rounded-2xl space-y-3">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 block">Dados da Loteria Federal</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-500">Nº do Concurso</label>
                          <input
                            type="text"
                            placeholder="Ex: 5892"
                            value={modalFederalConcurso}
                            onChange={(e) => setModalFederalConcurso(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-base sm:text-[11px] text-white font-mono outline-none focus:border-violet-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-500">Data do Sorteio</label>
                          <input
                            type="text"
                            placeholder="Ex: 15/08/2026"
                            value={modalFederalData}
                            onChange={(e) => setModalFederalData(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-base sm:text-[11px] text-white outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500">Regra de Apuração</label>
                        <select
                          value={modalFederalRegra}
                          onChange={(e) => setModalFederalRegra(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-base sm:text-[11px] text-white outline-none focus:border-violet-500 cursor-pointer"
                        >
                          <option value="Último dígito do 1º prêmio">Último dígito do 1º prêmio</option>
                          <option value="Dois últimos dígitos do 1º prêmio">Dois últimos dígitos do 1º prêmio</option>
                          <option value="Três últimos dígitos do 1º prêmio">Três últimos dígitos do 1º prêmio</option>
                          <option value="Cinco dígitos do 1º prêmio (Número completo)">Cinco dígitos do 1º prêmio (Número completo)</option>
                          <option value="Combinação do 1º ao 5º prêmio">Combinação do 1º ao 5º prêmio</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* PROMOÇÃO E NÚMEROS BÔNUS */}
                <div className="space-y-4 pt-2 border-t border-zinc-900">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 block font-bebas">⚡ Regras de Números Bônus</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalPromoEnabled}
                        onChange={(e) => setModalPromoEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#A3E635]"></div>
                    </label>
                  </div>

                  {modalPromoEnabled ? (
                    <div className="space-y-3 bg-zinc-900/50 p-3.5 sm:p-4 rounded-2xl border border-zinc-850">
                      <p className="text-[10px] text-zinc-400">
                        Configure o método "compre X ganhe Y" (exemplo: compre 2 ganhe 1 de bônus).
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-500 font-bebas">Compre (Quantas cotas)</label>
                          <input
                            type="number"
                            min="1"
                            value={modalPromoBuy}
                            onChange={(e) => setModalPromoBuy(e.target.value)}
                            placeholder="Ex: 2"
                            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-base sm:text-[11px] text-white font-mono outline-none focus:border-violet-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-500 font-bebas">Ganhe (Bônus grátis)</label>
                          <input
                            type="number"
                            min="1"
                            value={modalPromoBonus}
                            onChange={(e) => setModalPromoBonus(e.target.value)}
                            placeholder="Ex: 1"
                            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-base sm:text-[11px] text-white font-mono outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                      <p className="text-[9px] text-zinc-500 italic mt-1 text-center bg-black/40 py-1 rounded">
                        Método Ativo: Compre {modalPromoBuy} ganhe {modalPromoBonus} de bônus
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      Esta rifa não terá números bônus promocionais.
                    </p>
                  )}
                </div>

                {/* POSICIONAMENTO: DESTAQUE VS RIFA COMUM */}
                <div className="space-y-2 pt-2 border-t border-zinc-900">
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-bebas flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Posicionamento na Página Principal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModalIsDestaque(true)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        modalIsDestaque
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-md shadow-amber-500/10"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${modalIsDestaque ? "bg-amber-500 text-black font-black" : "bg-zinc-800 text-zinc-400"}`}>
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase font-bebas tracking-wide">Rifa em Destaque</div>
                        <div className="text-[9px] text-zinc-400 leading-tight">Card principal destacado no topo da Home</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalIsDestaque(false)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        !modalIsDestaque
                          ? "bg-violet-500/10 border-violet-500 text-violet-300 shadow-md shadow-violet-500/10"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${!modalIsDestaque ? "bg-violet-500 text-white font-black" : "bg-zinc-800 text-zinc-400"}`}>
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase font-bebas tracking-wide">Rifa Comum</div>
                        <div className="text-[9px] text-zinc-400 leading-tight">Exibição padrão no catálogo de rifas</div>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRaffleModal}
                  className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl text-xs sm:text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-600/20 cursor-pointer mt-4 min-h-[48px] flex items-center justify-center"
                >
                  {isSubmittingRaffleModal
                    ? "SALVANDO..."
                    : editingRaffleItem
                    ? "SALVAR ALTERAÇÕES DA RIFA"
                    : "CRIAR E PUBLICAR RIFA"}
                </button>
              </form>
            </div>
          </div>
        )}

        {renderDrawConfirmationModal()}

        {/* GLOBAL PIX CONFIGURATION MODAL */}
        {showGlobalPixModal && (
          <div id="global-pix-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] overflow-y-auto p-3 sm:p-4 md:p-6 flex justify-center items-start sm:items-center min-h-screen">
            <div className="bg-zinc-950 border border-zinc-850 w-full max-w-lg rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 my-3 sm:my-8 shadow-2xl relative">
              <div className="flex justify-between items-start border-b border-zinc-900 pb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white text-base uppercase tracking-tight flex items-center gap-2">
                    <Settings className="w-5 h-5 text-violet-400 shrink-0" />
                    Conta PIX Global
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Atualize os dados e propague para todas as rifas ativas.
                  </p>
                  
                  {/* SELECTOR FOR DESIRED RAFFLE */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 w-full">
                    <span className="text-[10px] font-black uppercase text-zinc-500 shrink-0">Selecionar Rifa Ativa:</span>
                    <select
                      value={selectedRaffleId}
                      onChange={(e) => {
                        setSelectedRaffleId(e.target.value);
                      }}
                      className="bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-violet-500 max-w-full truncate"
                    >
                      {raffles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title || "Sem Título"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setShowGlobalPixModal(false)}
                  className="p-2.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-zinc-900/40 border border-violet-950/40 p-3.5 sm:p-4 rounded-2xl text-xs text-violet-300 space-y-2">
                <p className="font-bold text-violet-200">ℹ️ Como funciona?</p>
                <p className="text-zinc-400 leading-relaxed">
                  Ao atualizar esta conta PIX, os novos dados (Chave, Titular, Banco e Contato) serão salvos globalmente e aplicados imediatamente a <strong>todas as suas rifas ativas</strong> do sistema.
                </p>
              </div>

              <form onSubmit={handleSaveGlobalPix} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Chave PIX *</label>
                  <input
                    type="text"
                    required
                    placeholder="Chave (CNPJ, CPF, Celular, E-mail ou Aleatória)"
                    value={globalPixKey}
                    onChange={(e) => setGlobalPixKey(e.target.value)}
                    className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Nome do Recebedor (Titular) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do titular da conta"
                    value={globalPixReceiver}
                    onChange={(e) => setGlobalPixReceiver(e.target.value)}
                    className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Banco *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Nubank, Itaú..."
                      value={globalPixBank}
                      onChange={(e) => setGlobalPixBank(e.target.value)}
                      className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Telefone / Contato</label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={globalPixPhone}
                      onChange={(e) => setGlobalPixPhone(e.target.value)}
                      className="w-full bg-black border border-zinc-850 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-xs font-bold text-white outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingGlobalPix}
                  className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-600/20 cursor-pointer mt-4 flex items-center justify-center gap-2 min-h-[48px]"
                >
                  {isSubmittingGlobalPix ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      SALVANDO E PROPAGANDO...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      SALVAR E APLICAR EM TODAS AS RIFAS
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
        {renderSharedWinnersHallModals()}
        {renderPaidToastsContainer()}
      </div>
    );
  }

  // ==========================================
  // VIEW MODE 2: SPECIFIC RAFFLE DASHBOARD
  // ==========================================
  return renderSidebarLayout(
    <div className="space-y-6 pb-32">
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setCurrentAdminTab("rifas");
              setViewMode("list");
              setMainAdminSection("rifas");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111513] hover:bg-[#1A1F1B] border border-[#1A1F1B] text-zinc-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-bebas"
          >
            <ArrowLeft className="w-4 h-4 text-[#A3E635]" />
            Voltar para Lista de Campanhas
          </button>
        </div>



      {/* If currentAdminTab is audit, show audit logs */}
      {currentAdminTab === "audit" && <AuditView selectedRaffleId={selectedRaffleId} />}

      {/* If currentAdminTab is notifications, show notifications */}
      {currentAdminTab === "notifications" && <NotificationsView />}

      {/* If currentAdminTab is cotas, show cotas grid */}
      {currentAdminTab === "cotas" && renderCotasGrid()}

      {/* If currentAdminTab is planning, show planning calculations */}
      {currentAdminTab === "planning" && renderPlanningSection()}

      {/* If currentAdminTab is store, show AdminProducts */}
      {currentAdminTab === "store" && <AdminProducts />}

      {/* If currentAdminTab is winners (Sorteios), show draws */}
      {currentAdminTab === "winners" && <DrawsView selectedRaffleId={selectedRaffleId} raffleConfig={raffleConfig} />}

      {/* TAB CONDITIONAL RENDERING */}
      {(currentAdminTab === "overview" || currentAdminTab === "rifas") && activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* GLOBAL REVENUE ANALYTICS & CHARTS SECTION */}
            <div className="space-y-6">
              {/* GLOBAL KPIS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-bebas">Receita Global Acumulada</span>
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-white mt-2">
                    R$ {analyticsData.totalGlobalRevenue.toFixed(2).replace(".", ",")}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">Soma de todas as rifas e pedidos pagos</p>
                </div>

                <div className="bg-gradient-to-br from-amber-950/40 via-zinc-950 to-zinc-950 border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-bebas">Rifa Líder (Campeã)</span>
                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                      <Trophy className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-lg font-black text-amber-300 mt-2 truncate">
                    {analyticsData.topRaffle?.title || "Nenhuma Rifa"}
                  </div>
                  <p className="text-[10px] text-amber-400/80 font-mono mt-1">
                    R$ {(analyticsData.topRaffle?.totalRevenue || 0).toFixed(2).replace(".", ",")} arrecadados
                  </p>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-bebas">Total Cotas Vendidas</span>
                    <div className="p-2 bg-violet-500/10 rounded-xl text-violet-400">
                      <Ticket className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-violet-400 mt-2">
                    {analyticsData.totalGlobalTickets} <span className="text-xs text-zinc-500">cotas</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">Total acumulado de números pagos</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-bebas">Rifas no Catálogo</span>
                    <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-white mt-2">
                    {analyticsData.activeCount} <span className="text-xs text-zinc-500">ativas ({rafflesWithStats.length} total)</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">Campanhas cadastradas no sistema</p>
                </div>
              </div>

              {/* CHARTS GRID: BAR CHART & PIE CHART */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* CHART 1: REVENUE BAR CHART (7 COLUMNS) */}
                <div className="lg:col-span-7 bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-900 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#A3E635]" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-white font-bebas">
                          Arrecadação Financeira por Rifa
                        </h3>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Comparativo de faturamento (R$) de todas as campanhas</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20 px-2.5 py-1 rounded-full font-bold">
                      Tempo Real
                    </span>
                  </div>

                  {analyticsData.barData.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-zinc-600 space-y-2">
                      <BarChart3 className="w-8 h-8 opacity-40" />
                      <p className="text-xs">Nenhuma rifa cadastrada para exibir o gráfico.</p>
                    </div>
                  ) : (
                    <div className="h-72 w-full pt-2">
                      <div className="flex h-full items-center justify-center text-zinc-500">Gráfico desabilitado temporariamente</div>
                    </div>
                  )}
                </div>

                {/* CHART 2: PIE CHART - REVENUE SHARE & TOP RAFFLE (5 COLUMNS) */}
                <div className="lg:col-span-5 bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                  <div className="border-b border-zinc-900 pb-4">
                    <div className="flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-white font-bebas">
                        Distribuição da Arrecadação (%)
                      </h3>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Participação relativa de cada rifa no faturamento</p>
                  </div>

                  {analyticsData.totalGlobalRevenue === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-zinc-600 text-center px-4 space-y-2">
                      <PieChartIcon className="w-8 h-8 opacity-40 text-amber-400" />
                      <p className="text-xs">Ainda não há receitas registradas para montar o gráfico de pizza.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-48 w-full relative flex items-center justify-center">
                        <div className="flex h-full items-center justify-center text-zinc-500">Gráfico desabilitado temporariamente</div>
                      </div>

                      {/* PIE LEGEND */}
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {analyticsData.pieData.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] bg-zinc-900/50 p-2 rounded-xl border border-zinc-850">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="font-bold text-zinc-300 truncate">{item.fullTitle}</span>
                            </div>
                            <span className="font-mono font-black text-amber-400 shrink-0 ml-2">
                              R$ {item.value.toFixed(2).replace(".", ",")} ({item.percent}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-violet-950/40 via-zinc-950 to-zinc-950 border border-violet-500/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      raffleConfig.status === "encerrada"
                        ? "bg-red-500 animate-pulse"
                        : raffleConfig.isRaffleActive !== false
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-500"
                    }`}
                  />
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Status Operacional</h4>
                </div>
                <p className="text-sm font-bold text-zinc-400 mt-1">
                  {raffleConfig.status === "encerrada"
                    ? "Esta rifa foi encerrada e o vencedor oficial foi publicado."
                    : raffleConfig.isRaffleActive !== false
                    ? "Esta rifa está ativa e aceitando PIX."
                    : "Esta rifa está pausada temporariamente."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleToggleRaffleStatus}
                  disabled={isTogglingStatus || raffleConfig.status === "encerrada"}
                  className={`px-4 py-2.5 ${raffleConfig.isRaffleActive !== false ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"} rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTogglingStatus ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : raffleConfig.isRaffleActive !== false ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pausar Rifa
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativar Rifa
                    </>
                  )}
                </button>

                {raffleConfig.status !== "encerrada" && (
                  <button
                    onClick={() => handleEndRaffle(selectedRaffleId)}
                    className="px-4 py-2.5 bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    Encerrar Rifa
                  </button>
                )}

                <button
                  onClick={() => handleResetRaffle(selectedRaffleId, raffleConfig.title)}
                  disabled={isClearing}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-amber-950/20 border border-zinc-800 text-amber-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isClearing ? "animate-spin" : ""}`} />
                  Resetar
                </button>

                <button
                  onClick={() => handleDeleteRaffle(selectedRaffleId, raffleConfig.title)}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-red-950/20 border border-zinc-800 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              {[
                { label: "Cotas Vendidas", val: `${stats.countPaid} un`, color: "text-white" },
                { label: "Receita Obtida", val: `R$ ${stats.arrecadado.toFixed(2).replace(".", ",")}`, color: "text-emerald-400" },
                { label: "Reservadas", val: `${stats.countReserved} un`, color: "text-amber-500" },
                { label: "Disponíveis", val: `${stats.countAvailable} un`, color: "text-zinc-500" },
                { label: "Receita Pendente", val: `R$ ${stats.aEntrar.toFixed(2).replace(".", ",")}`, color: "text-amber-400" },
              ].map((s, i) => (
                <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between h-20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{s.label}</span>
                  <span className={`text-sm font-black font-mono ${s.color}`}>{s.val}</span>
                </div>
              ))}
            </div>

            {(raffleConfig.status === "encerrada" || raffleConfig.winnerNumber) && (
              <div id="winner-celebration-card" className="bg-gradient-to-r from-amber-950/20 via-zinc-950 to-zinc-950 border border-amber-500/20 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Ganhador Oficial da Rifa</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase font-black block">Cota Premiada</span>
                    <span className="text-2xl font-black text-amber-400 font-mono">#{raffleConfig.winnerNumber}</span>
                  </div>
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase font-black block">Nome do Ganhador</span>
                    <span className="text-base font-black text-white uppercase block truncate">{raffleConfig.winnerName || "Ganhador"}</span>
                  </div>
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase font-black block">Telefone de Contato</span>
                    <span className="text-base font-black text-zinc-300 font-mono block">{raffleConfig.winnerPhone || "N/A"}</span>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500 flex flex-wrap gap-x-4 gap-y-1 font-bold">
                  <span>📅 Sorteio realizado em: {raffleConfig.drawDate || "N/A"} às {raffleConfig.drawTime || "N/A"}</span>
                  {raffleConfig.videoLink && (
                    <a href={raffleConfig.videoLink} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                      📺 Assistir Vídeo da Apuração
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Prêmio Ativo</h3>
              <div className="flex items-center gap-4">
                {raffleConfig.imageUrl ? (
                  <img
                    src={raffleConfig.imageUrl}
                    className="w-16 h-16 object-cover rounded-xl border border-zinc-900"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-750">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h4 className="text-base font-bold text-white">{raffleConfig.title || "Rifa Sem Título"}</h4>
                  <p className="text-xs text-zinc-500">
                    Valor Unitário: R$ {(raffleConfig.price || 0).toFixed(2).replace(".", ",")} | Total Cotas: {raffleConfig.totalNumbers || 100}
                  </p>
                </div>
              </div>
            </div>

            <PurchasesView selectedRaffleId={selectedRaffleId} orders={orders} limit={5} compact />
          </div>
        )}

        {/* ORDERS TAB WITH SUPABASE PURCHASES */}
        {currentAdminTab === "orders" && (
          <PurchasesView
            selectedRaffleId={selectedRaffleId}
            orders={orders}
            raffles={raffles}
            onSelectRaffle={(id) => setSelectedRaffleId(id)}
          />
        )}

        {/* CUSTOMERS TAB (NEW) */}
        {currentAdminTab === "customers" && (
          <div className="space-y-6">
            {/* CLIENTS SUMMARY KPIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total de Clientes</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-1">{aggregatedCustomers.length}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Maior Comprador</span>
                <span className="text-sm font-black text-white truncate mt-1">
                  {aggregatedCustomers[0] ? `${aggregatedCustomers[0].name} (R$ ${aggregatedCustomers[0].totalSpent.toFixed(2)})` : "Nenhum"}
                </span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ticket Médio Geral</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-1">
                  R$ {(
                    aggregatedCustomers.length > 0
                      ? aggregatedCustomers.reduce((acc, c) => acc + (c.ordersCount > 0 ? c.totalSpent / c.ordersCount : 0), 0) / aggregatedCustomers.length
                      : 0
                  ).toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Cotas Clientes</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-1">
                  {aggregatedCustomers.reduce((acc, c) => acc + c.totalCotas, 0)} cotas
                </span>
              </div>
            </div>

            {/* RANKING & SEARCH FILTERS */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou WhatsApp..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                <span className="text-[10px] font-black uppercase text-zinc-500 shrink-0">Ordenar por:</span>
                <select
                  value={customerSort}
                  onChange={(e) => setCustomerSort(e.target.value as any)}
                  className="bg-black border border-zinc-800 text-amber-400 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
                >
                  <option value="spent">Maior Valor Gasto (R$)</option>
                  <option value="cotas">Maior Qtd. de Cotas</option>
                  <option value="orders">Maior Qtd. de Compras</option>
                  <option value="ticket">Maior Ticket Médio</option>
                </select>
              </div>
            </div>

            {/* CUSTOMERS TABLE */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-zinc-900">
                <table className="w-full text-left text-xs bg-black/30">
                  <thead>
                    <tr className="bg-zinc-900/80 text-[10px] text-zinc-400 uppercase font-black tracking-wider border-b border-zinc-850">
                      <th className="p-3.5 text-center">Pos.</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Telefone / WhatsApp</th>
                      <th className="p-3.5 text-center">Compras</th>
                      <th className="p-3.5 text-center">Total Cotas</th>
                      <th className="p-3.5 text-right">Valor Comprado</th>
                      <th className="p-3.5 text-right">Ticket Médio</th>
                      <th className="p-3.5 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {aggregatedCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-zinc-500 text-xs font-bold uppercase">
                          Nenhum cliente registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      aggregatedCustomers.map((cust, idx) => {
                        const ticketAvg = cust.ordersCount > 0 ? cust.totalSpent / cust.ordersCount : 0;
                        const cleanPhone = cust.phone.replace(/\D/g, "");
                        const waLink = `https://wa.me/55${cleanPhone}`;

                        return (
                          <tr
                            key={cust.phone}
                            onClick={() => setSelectedCustomerDetail(cust)}
                            className="hover:bg-zinc-900/50 cursor-pointer transition-colors"
                          >
                            <td className="p-3.5 text-center font-mono font-black text-zinc-500">
                              {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                            </td>
                            <td className="p-3.5 font-bold text-white uppercase">
                              {cust.name}
                            </td>
                            <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg font-mono text-[11px] font-bold transition-all"
                              >
                                <MessageCircle className="w-3 h-3" />
                                {cust.phone}
                              </a>
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-zinc-300">
                              {cust.ordersCount}x
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-amber-400">
                              {cust.totalCotas} cotas
                            </td>
                            <td className="p-3.5 text-right font-mono font-black text-amber-400">
                              R$ {cust.totalSpent.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-zinc-400">
                              R$ {ticketAvg.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedCustomerDetail(cust)}
                                className="px-3 py-1 bg-zinc-900 hover:bg-amber-500 hover:text-black border border-zinc-800 text-zinc-300 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer"
                              >
                                Detalhes
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CUSTOMER DETAIL MODAL / DRAWER */}
            {selectedCustomerDetail && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-2xl relative">
                  <div className="flex justify-between items-start border-b border-zinc-900 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Relatório de Cliente</span>
                      <h3 className="text-xl font-black text-white uppercase mt-0.5">{selectedCustomerDetail.name}</h3>
                      <p className="text-xs text-zinc-400 font-mono mt-1 flex items-center gap-2">
                        <span>📱 WhatsApp: {selectedCustomerDetail.phone}</span>
                        <a
                          href={`https://wa.me/55${selectedCustomerDetail.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline font-bold text-[10px]"
                        >
                          (Abrir WhatsApp)
                        </a>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCustomerDetail(null)}
                      className="p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black p-4 rounded-2xl border border-zinc-900">
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-500 block">Total Gasto</span>
                      <span className="text-sm font-black text-amber-400 font-mono">R$ {selectedCustomerDetail.totalSpent.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-500 block">Total Cotas</span>
                      <span className="text-sm font-black text-amber-400 font-mono">{selectedCustomerDetail.totalCotas} un</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-500 block">Qtd Compras</span>
                      <span className="text-sm font-black text-white font-mono">{selectedCustomerDetail.ordersCount} pedidos</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-500 block">Ticket Médio</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        R$ {(selectedCustomerDetail.ordersCount > 0 ? selectedCustomerDetail.totalSpent / selectedCustomerDetail.ordersCount : 0).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Histórico de Pedidos do Cliente</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {selectedCustomerDetail.orders.map((ord: any) => {
                        const s = (ord.status || "").toLowerCase();
                        const isPaid = s === "pago" || s === "paid" || s === "approved";
                        const isPending = s === "pending_payment" || s === "aguardando" || s === "reserved";
                        return (
                          <div key={ord.id} className="bg-black/60 border border-zinc-900 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="font-bold text-white uppercase line-clamp-1">{ord.raffleTitle || "Rifa"}</div>
                              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                Cotas: {(ord.nums || []).join(", ")} | {ord.createdAt ? new Date(ord.createdAt).toLocaleString("pt-BR") : ""}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-black text-amber-400">R$ {Number(ord.val || 0).toFixed(2)}</div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${
                                isPaid ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : isPending ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}>
                                {isPaid ? "Pago" : isPending ? "Pendente" : "Cancelado"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentAdminTab === "settings" && activeTab === "draw" && (
          <div className="space-y-6">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6">
              <div className="text-center space-y-2 border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Sortear Rifa
                </h3>
                <p className="text-zinc-400 text-xs">
                  Selecione o método de sorteio e preencha os parâmetros para a apuração oficial do vencedor.
                </p>
              </div>

              {/* METODO DE APURAÇÃO SELECT */}
              <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-left">
                    <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Método de Sorteio</h4>
                    <p className="text-[10px] text-zinc-500">Escolha a origem oficial para a definição do vencedor.</p>
                  </div>
                  <select
                    value={localDrawMode}
                    onChange={async (e) => {
                      const newMode = e.target.value as "automatico" | "federal" | "manual";
                      setLocalDrawMode(newMode);
                      // Auto save to raffleConfig
                      setIsSavingDrawMode(true);
                      try {
                        const token = getAdminToken();
                        await adminService.saveConfig(token, { ...raffleConfig, drawMode: newMode }, raffleConfig.isActive, selectedRaffleId);
                        if (fetchRaffles) await fetchRaffles();
                      } catch (err) {
                        console.error("Erro ao salvar modo de sorteio:", err);
                      } finally {
                        setIsSavingDrawMode(false);
                      }
                    }}
                    className="bg-black border border-zinc-850 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer focus:border-violet-500 w-full sm:w-64"
                  >
                    <option value="automatico">RifaMaster Automático</option>
                    <option value="federal">Loteria Federal (Smart)</option>
                    <option value="manual">Número informado manualmente</option>
                  </select>
                </div>
              </div>

              {/* MODE: AUTOMATICO */}
              {localDrawMode === "automatico" && (
                <div className="space-y-6 text-center py-6 max-w-md mx-auto">
                  <div className="bg-violet-600/10 border border-violet-950/30 p-4 rounded-2xl text-xs text-violet-300 text-left">
                    <p className="font-bold text-violet-200">🤖 Como funciona o RifaMaster Automático?</p>
                    <p className="text-zinc-400 leading-relaxed mt-1">
                      O algoritmo realiza um embaralhamento eletrônico Fisher-Yates duplo criptograficamente seguro (CSPRNG) em tempo real, garantindo total aleatoriedade e igualdade de chances entre todas as cotas com status <strong>Pago</strong>.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (calculatingRef.current) return;
                      setConfirmAction({
                        message: "Deseja realmente iniciar o sorteio eletrônico RifaMaster?",
                        onConfirm: async () => {
                          setConfirmAction(null);
                          calculatingRef.current = true;
                          setIsCalculating(true);
                          setIsDrawing(true);
                          try {
                            const token = getAdminToken();
                            const res = await adminService.draw(token, selectedRaffleId);
                          
                          // Set up states for confirmation modal
                          const padSize = String(raffleConfig.totalNumbers || 100).length;
                          const finalCotaStr = String(res.winnerNumber).padStart(padSize, "0");
                          
                          setCalculatedResult(parseInt(res.winnerNumber, 10));
                          setCalculatedCota(finalCotaStr);
                          setCalculationFormulaText("Embaralhamento eletrônico Fisher-Yates CSPRNG");
                          
                          // Fetch latest orders via Admin API
                          let currentOrders = orders;
                          try {
                            const adminToken = getAdminToken();
                            const res = await fetch("/api/admin-action", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${adminToken}`
                              },
                              credentials: "include",
                              body: JSON.stringify({
                                action: "list-orders",
                                raffleId: selectedRaffleId || "current"
                              })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              if (Array.isArray(data.orders)) {
                                currentOrders = data.orders;
                                setOrders(data.orders);
                              }
                            } else if (res.status === 401 || res.status === 403) {
                              console.warn("🚨 [Admin] Sessão expirada ao buscar pedidos mais recentes.");
                            }
                          } catch (apiErr) {
                            console.error("Erro ao obter pedidos via Admin API:", apiErr);
                          }

                          const normalizeQuota = (q: string): string => {
                            const cleaned = String(q).replace(/^0+/, "");
                            return cleaned === "" ? "0" : cleaned;
                          };
                          const normalizedWinner = normalizeQuota(finalCotaStr);

                          let matchingOrder = currentOrders.find((o) => {
                            const matchesRaffle =
                              !selectedRaffleId ||
                              selectedRaffleId === "all" ||
                              o.raffleId === selectedRaffleId ||
                              o.raffleId === "current" ||
                              !o.raffleId;

                            if (!matchesRaffle) return false;

                            const allOrderNums = [
                              ...(Array.isArray(o.nums) ? o.nums : []),
                              ...(Array.isArray(o.purchasedNums) ? o.purchasedNums : []),
                              ...(Array.isArray(o.bonusNums) ? o.bonusNums : []),
                              ...(Array.isArray(o.numbers) ? o.numbers : []),
                            ];

                            return allOrderNums.map(normalizeQuota).includes(normalizedWinner);
                          });

                          if (!matchingOrder && selectedRaffleId && selectedRaffleId !== "all") {
                            try {
                              const cotaDocSnap = await getDoc(doc(db, "raffles", selectedRaffleId, "numbers", finalCotaStr));
                              if (cotaDocSnap.exists()) {
                                const cData = cotaDocSnap.data();
                                if (cData && cData.name && cData.name !== "Cota Livre / Não Vendida") {
                                  matchingOrder = {
                                    id: cData.orderId || `COTA_${finalCotaStr}`,
                                    name: cData.name,
                                    phone: cData.phone || "",
                                    status: cData.status === "paid" || cData.status === "pago" ? "Pago" : cData.status || "Pago",
                                    val: 0,
                                    nums: [finalCotaStr],
                                  };
                                }
                              }
                            } catch (err) {
                              console.info("Fallback cota doc lookup notice:", err);
                            }
                          }
                          
                          if (matchingOrder) {
                            const statusStr = (matchingOrder.status || "").toLowerCase();
                            if (statusStr === "pago" || statusStr === "paid" || statusStr === "approved") {
                              setBuyerStatus("pago");
                            } else {
                              setBuyerStatus("pendente");
                            }
                            const allNums = [
                              ...(Array.isArray(matchingOrder.nums) ? matchingOrder.nums : []),
                              ...(Array.isArray(matchingOrder.purchasedNums) ? matchingOrder.purchasedNums : []),
                              ...(Array.isArray(matchingOrder.bonusNums) ? matchingOrder.bonusNums : []),
                              ...(Array.isArray(matchingOrder.numbers) ? matchingOrder.numbers : []),
                            ];
                            const actualCota = allNums.find(n => normalizeQuota(n) === normalizedWinner) || finalCotaStr;
                            setCalculatedCota(actualCota);
                            setFoundBuyer(matchingOrder);
                          } else if (res.winnerName && res.winnerName !== "Cota Livre / Não Vendida") {
                            setBuyerStatus("pago");
                            setFoundBuyer({
                              name: res.winnerName,
                              phone: res.winnerPhone || "N/A",
                              val: 0,
                              nums: [finalCotaStr]
                            });
                          } else {
                            setBuyerStatus("livre");
                            setFoundBuyer(null);
                          }
                          
                          setDrawAuditData({
                            drawMethod: "RifaMaster Automático",
                            federalRegra: "Algoritmo Fisher-Yates CSPRNG",
                            prizesEntered: [],
                            resultCalculated: parseInt(res.winnerNumber, 10),
                            totalQuotas: raffleConfig.totalNumbers || 100,
                            calculationFormula: "Fisher-Yates duplo criptográfico",
                            winnerNumber: finalCotaStr,
                            drawDate: new Date().toLocaleDateString("pt-BR"),
                            drawTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                            adminResponsible: "Administrador"
                          });

                          setShowConfirmationModal(true);
                        } catch (err: any) {
                          alert("Erro ao realizar sorteio eletrônico: " + err.message);
                        } finally {
                          setIsDrawing(false);
                          setIsCalculating(false);
                          calculatingRef.current = false;
                        }
                      }
                    });
                  }}
                    disabled={isDrawing || isCalculating || isSavingDrawMode}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDrawing || isCalculating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        CALCULANDO...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-white" />
                        EXECUTAR SORTEIO ELETRÔNICO
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* MODE: LOTERIA FEDERAL */}
              {localDrawMode === "federal" && (
                <div className="space-y-6">
                  {/* SELECT RULE */}
                  <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-3xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-left">
                        <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Regra de Apuração</h4>
                        <p className="text-[10px] text-zinc-500">Defina o critério matemático para calcular a cota com base na Loteria Federal.</p>
                      </div>
                      <select
                        value={federalRegra}
                        onChange={async (e) => {
                          const newRegra = e.target.value;
                          setFederalRegra(newRegra);
                          // Auto save rule
                          setIsSavingDrawMode(true);
                          try {
                            const token = getAdminToken();
                            await adminService.saveConfig(token, { ...raffleConfig, federalRegra: newRegra }, raffleConfig.isActive, selectedRaffleId);
                            if (fetchRaffles) await fetchRaffles();
                          } catch (err) {
                            console.error("Erro ao salvar regra de sorteio:", err);
                          } finally {
                            setIsSavingDrawMode(false);
                          }
                        }}
                        className="bg-black border border-zinc-850 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer focus:border-violet-500 w-full sm:w-80"
                      >
                        {FEDERAL_RULES.map((rule) => (
                          <option key={rule.id} value={rule.id}>{rule.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-zinc-500 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900 text-left">
                      ℹ️ <strong>Critério selecionado:</strong> {FEDERAL_RULES.find(r => r.id === normalizeFederalRuleId(federalRegra))?.description}
                    </p>
                  </div>

                  {/* INPUT FIELDS */}
                  <div className="space-y-4 text-left">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Insira os resultados oficiais da Loteria Federal</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                      {/* Field 1 */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">1º Prêmio *</label>
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="Ex: 48325"
                          value={prizes[0]}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            const updated = [...prizes];
                            updated[0] = val;
                            setPrizes(updated);
                          }}
                          className="w-full bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-violet-500 text-center font-mono"
                        />
                      </div>

                      {/* Other fields shown only if rule needs 5 fields */}
                      {((FEDERAL_RULES.find(r => r.id === normalizeFederalRuleId(federalRegra))?.fieldsNeeded || 1) === 5) && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">
                              2º Prêmio {normalizeFederalRuleId(federalRegra) === "soma_personalizada" ? "" : "*"}
                            </label>
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="Ex: 71642"
                              value={prizes[1]}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                const updated = [...prizes];
                                updated[1] = val;
                                setPrizes(updated);
                              }}
                              className="w-full bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-violet-500 text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">
                              3º Prêmio {normalizeFederalRuleId(federalRegra) === "soma_personalizada" ? "" : "*"}
                            </label>
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="Ex: 39108"
                              value={prizes[2]}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                const updated = [...prizes];
                                updated[2] = val;
                                setPrizes(updated);
                              }}
                              className="w-full bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-violet-500 text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">
                              4º Prêmio {normalizeFederalRuleId(federalRegra) === "soma_personalizada" ? "" : "*"}
                            </label>
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="Ex: 22491"
                              value={prizes[3]}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                const updated = [...prizes];
                                updated[3] = val;
                                setPrizes(updated);
                              }}
                              className="w-full bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-violet-500 text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">
                              5º Prêmio {normalizeFederalRuleId(federalRegra) === "soma_personalizada" ? "" : "*"}
                            </label>
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="Ex: 58037"
                              value={prizes[4]}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                const updated = [...prizes];
                                updated[4] = val;
                                setPrizes(updated);
                              }}
                              className="w-full bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-violet-500 text-center font-mono"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCalculateAndValidateDraw(e)}
                      disabled={isCalculating || isDrawing || isSavingDrawMode}
                      className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer shadow-lg shadow-violet-600/20 mt-4 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          CALCULANDO...
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4" />
                          CALCULAR E BUSCAR VENCEDOR
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* MODE: MANUAL */}
              {localDrawMode === "manual" && (
                <div className="space-y-6 max-w-md mx-auto py-4">
                  <div className="space-y-3 text-left">
                    <label className="text-[10px] font-black uppercase text-zinc-400 block text-center">Número Sorteado Manualmente *</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        required
                        placeholder={`Ex: de 1 a ${raffleConfig.totalNumbers || 100}`}
                        value={manualCotaInput}
                        onChange={(e) => setManualCotaInput(e.target.value)}
                        className="flex-1 bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-sm font-black text-white font-mono outline-none focus:border-violet-500 text-center"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleCalculateAndValidateDraw(e)}
                        disabled={isCalculating || isDrawing}
                        className="px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCalculating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            CALCULANDO...
                          </>
                        ) : (
                          "Apurar Vencedor"
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 italic mt-1 leading-relaxed text-center">
                      O sistema buscará o comprador com status <strong>Pago</strong> correspondente ao número digitado. Caso a cota não esteja paga ou esteja livre, o sistema impedirá o registro automático e exibirá o diagnóstico detalhado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {false && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">Gerenciar Ganhadores</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Adicione, edite ou remova registros do Hall da Fama sem precisar abrir uma rifa.</p>
              </div>
              <button
                onClick={() => {
                  setNewWinnerData({
                    winnerName: "",
                    winnerNumber: "",
                    prizeTitle: "",
                    prizeImageUrl: "",
                    drawDate: new Date().toLocaleDateString("pt-BR"),
                    videoLink: "",
                    instagram: ""
                  });
                  setAddingWinner(true);
                }}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Novo Ganhador
              </button>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
              <div className="overflow-x-auto rounded-2xl border border-zinc-900">
                <table className="w-full text-left text-xs bg-black/20">
                  <thead className="bg-zinc-950 text-[10px] text-zinc-500 uppercase font-black">
                    <tr>
                      <th className="p-3">Ganhador</th>
                      <th className="p-3">Rifa / Prêmio</th>
                      <th className="p-3">Cota</th>
                      <th className="p-3">Rede / Vídeo</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/50">
                    {winnersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500 font-bold uppercase text-xs">
                          Nenhum ganhador registrado no Hall da Fama.
                        </td>
                      </tr>
                    ) : (
                      winnersList.map(w => (
                        <tr key={w.id} className="hover:bg-zinc-900/10">
                          <td className="p-3">
                            <div className="font-bold text-white uppercase">{w.winnerName}</div>
                            {w.instagram && (
                              <span className="text-[10px] text-orange-400 font-mono">@{w.instagram.replace("@", "")}</span>
                            )}
                          </td>
                          <td className="p-3 text-zinc-400">{w.prizeTitle || w.raffleTitle}</td>
                          <td className="p-3 text-zinc-400 font-mono font-bold">{w.winnerNumber}</td>
                          <td className="p-3 text-zinc-500">
                            {w.videoLink ? (
                              <a href={w.videoLink} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline text-[10px] font-bold">
                                Assistir Vídeo 🔗
                              </a>
                            ) : (
                              <span className="text-[10px] text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingWinner(w)} 
                                className="p-2 bg-zinc-900 hover:bg-orange-500/20 border border-zinc-800 text-orange-400 rounded-lg transition-colors"
                                title="Editar Ganhador"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => {
                                  setConfirmAction({
                                    message: `Tem certeza que deseja excluir ${w.winnerName} do Hall da Fama?`,
                                    onConfirm: async () => {
                                      try {
                                        setConfirmAction(null);
                                        await adminService.deleteWinnerHistory(getAdminToken(), w.id);
                                        alert("Ganhador removido do Hall da Fama!");
                                      } catch (err: any) {
                                        alert("Erro ao excluir: " + err.message);
                                      }
                                    }
                                  });
                                }} 
                                className="p-2 bg-zinc-900 hover:bg-red-500/20 border border-zinc-800 text-red-400 rounded-lg transition-colors"
                                title="Excluir Ganhador"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Winner Modal */}
            {editingWinner && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto" onClick={() => setEditingWinner(null)}>
                <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-black text-white mb-4 uppercase tracking-wider">Editar Ganhador / Sorteio</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome do Ganhador</label>
                      <input 
                        type="text" 
                        value={editingWinner.winnerName || ""} 
                        onChange={(e) => setEditingWinner({...editingWinner, winnerName: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Número Sorteado / Cota</label>
                        <input 
                          type="text" 
                          value={editingWinner.winnerNumber || ""} 
                          onChange={(e) => setEditingWinner({...editingWinner, winnerNumber: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Data do Sorteio</label>
                        <input 
                          type="text" 
                          value={editingWinner.drawDate || ""} 
                          onChange={(e) => setEditingWinner({...editingWinner, drawDate: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Título do Prêmio</label>
                      <input 
                        type="text" 
                        value={editingWinner.prizeTitle || editingWinner.raffleTitle || ""} 
                        onChange={(e) => setEditingWinner({...editingWinner, prizeTitle: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Foto do Prêmio (URL)</label>
                      <input 
                        type="text" 
                        value={editingWinner.prizeImageUrl || ""} 
                        onChange={(e) => setEditingWinner({...editingWinner, prizeImageUrl: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Instagram (Sem @)</label>
                        <input 
                          type="text" 
                          placeholder="ex: joao_silva"
                          value={editingWinner.instagram || ""} 
                          onChange={(e) => setEditingWinner({...editingWinner, instagram: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Link do Vídeo</label>
                        <input 
                          type="text" 
                          placeholder="https://youtube.com/..."
                          value={editingWinner.videoLink || ""} 
                          onChange={(e) => setEditingWinner({...editingWinner, videoLink: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setEditingWinner(null)}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            await adminService.updateWinner(getAdminToken(), editingWinner.id, {
                              winnerName: editingWinner.winnerName,
                              winnerNumber: editingWinner.winnerNumber,
                              prizeTitle: editingWinner.prizeTitle,
                              prizeImageUrl: editingWinner.prizeImageUrl,
                              drawDate: editingWinner.drawDate,
                              instagram: editingWinner.instagram || "",
                              videoLink: editingWinner.videoLink || "",
                            });
                            setEditingWinner(null);
                            alert("Ganhador atualizado com sucesso!");
                          } catch (err: any) {
                            alert("Erro ao atualizar: " + err.message);
                          }
                        }}
                        className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Salvar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add Winner Modal */}
            {addingWinner && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto" onClick={() => setAddingWinner(false)}>
                <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-black text-white mb-4 uppercase tracking-wider">Registrar Ganhador Manual</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome do Ganhador</label>
                      <input 
                        type="text" 
                        placeholder="Nome do ganhador"
                        value={newWinnerData.winnerName || ""} 
                        onChange={(e) => setNewWinnerData({...newWinnerData, winnerName: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Número Sorteado / Cota</label>
                        <input 
                          type="text" 
                          placeholder="ex: 147"
                          value={newWinnerData.winnerNumber || ""} 
                          onChange={(e) => setNewWinnerData({...newWinnerData, winnerNumber: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Data do Sorteio</label>
                        <input 
                          type="text" 
                          placeholder="DD/MM/AAAA"
                          value={newWinnerData.drawDate || ""} 
                          onChange={(e) => setNewWinnerData({...newWinnerData, drawDate: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Título do Prêmio</label>
                      <input 
                        type="text" 
                        placeholder="ex: iPhone 15 Pro Max"
                        value={newWinnerData.prizeTitle || ""} 
                        onChange={(e) => setNewWinnerData({...newWinnerData, prizeTitle: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Foto do Prêmio (URL)</label>
                      <input 
                        type="text" 
                        placeholder="https://link-da-imagem.com/foto.jpg"
                        value={newWinnerData.prizeImageUrl || ""} 
                        onChange={(e) => setNewWinnerData({...newWinnerData, prizeImageUrl: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Instagram (Sem @)</label>
                        <input 
                          type="text" 
                          placeholder="ex: joao_silva"
                          value={newWinnerData.instagram || ""} 
                          onChange={(e) => setNewWinnerData({...newWinnerData, instagram: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Link do Vídeo</label>
                        <input 
                          type="text" 
                          placeholder="https://youtube.com/..."
                          value={newWinnerData.videoLink || ""} 
                          onChange={(e) => setNewWinnerData({...newWinnerData, videoLink: e.target.value})}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm mt-1 outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setAddingWinner(false)}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={async () => {
                          if (!newWinnerData.winnerName || !newWinnerData.winnerNumber || !newWinnerData.prizeTitle) {
                            alert("Por favor, preencha o nome, número e título do prêmio.");
                            return;
                          }
                          try {
                            await adminService.addWinnerHistory(getAdminToken(), {
                              winnerName: newWinnerData.winnerName,
                              winnerNumber: newWinnerData.winnerNumber,
                              prizeTitle: newWinnerData.prizeTitle,
                              prizeImageUrl: newWinnerData.prizeImageUrl,
                              drawDate: newWinnerData.drawDate,
                              instagram: newWinnerData.instagram || "",
                              videoLink: newWinnerData.videoLink || "",
                              raffleId: "manual",
                            });
                            setAddingWinner(false);
                            alert("Ganhador adicionado com sucesso!");
                          } catch (err: any) {
                            alert("Erro ao adicionar: " + err.message);
                          }
                        }}
                        className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Registrar Ganhador
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}



        {currentAdminTab === "settings" && (
          <div className="space-y-6">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-900">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Configurações da Rifa ({selectedRaffleId})
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-zinc-500">Selecionar Rifa:</span>
                  <select
                    value={selectedRaffleId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedRaffleId(newId);
                    }}
                    className="bg-zinc-900 border border-zinc-800 text-xs font-black uppercase text-white rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-violet-500"
                  >
                    {raffles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title || "Sem Título"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500">Título da Rifa</label>
                  <input
                    type="text"
                    value={editedConfig.title || ""}
                    onChange={(e) => setEditedConfig((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-sm font-bold text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Valor Cota (R$)</label>
                    <input
                      type="text"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-sm font-bold text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Total Cotas</label>
                    <input
                      type="text"
                      value={totalNumbersInput}
                      onChange={(e) => setTotalNumbersInput(e.target.value)}
                      className="w-full bg-black border border-zinc-900 rounded-2xl px-4 py-3 text-sm font-bold text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-zinc-900">
                  <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">Modos de Compra e Sorteio</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500">Modo de Compra</label>
                      <select
                        value={editedConfig.purchaseMode || "manual"}
                        onChange={(e) => setEditedConfig((prev) => ({ ...prev, purchaseMode: e.target.value as "manual" | "aleatorio" }))}
                        className="w-full bg-black border border-zinc-900 rounded-2xl px-3 py-3 text-sm font-bold text-white cursor-pointer"
                      >
                        <option value="manual">Escolha Manual</option>
                        <option value="aleatorio">Escolha Aleatória (Bolsão)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500">Modo de Sorteio</label>
                      <select
                        value={editedConfig.drawMode || "automatico"}
                        onChange={(e) => setEditedConfig((prev) => ({ ...prev, drawMode: e.target.value as "automatico" | "federal" }))}
                        className="w-full bg-black border border-zinc-900 rounded-2xl px-3 py-3 text-sm font-bold text-white cursor-pointer"
                      >
                        <option value="automatico">RifaMaster Automático</option>
                        <option value="federal">Loteria Federal</option>
                      </select>
                    </div>
                  </div>

                  {(editedConfig.drawMode === "federal") && (
                    <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl space-y-3">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 block">Dados da Loteria Federal</span>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-500">Nº do Concurso</label>
                          <input
                            type="text"
                            placeholder="Ex: 5892"
                            value={editedConfig.federalConcurso || ""}
                            onChange={(e) => setEditedConfig((prev) => ({ ...prev, federalConcurso: e.target.value }))}
                            className="w-full bg-black border border-zinc-900 rounded-xl px-3 py-2 text-[11px] text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-500">Data do Sorteio</label>
                          <input
                            type="text"
                            placeholder="Ex: 15/08/2026"
                            value={editedConfig.federalData || ""}
                            onChange={(e) => setEditedConfig((prev) => ({ ...prev, federalData: e.target.value }))}
                            className="w-full bg-black border border-zinc-900 rounded-xl px-3 py-2 text-[11px] text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500">Regra de Apuração</label>
                        <select
                          value={editedConfig.federalRegra || "Último dígito do 1º prêmio"}
                          onChange={(e) => setEditedConfig((prev) => ({ ...prev, federalRegra: e.target.value }))}
                          className="w-full bg-black border border-zinc-900 rounded-xl px-3 py-2 text-[11px] text-white"
                        >
                          <option value="Último dígito do 1º prêmio">Último dígito do 1º prêmio</option>
                          <option value="Dois últimos dígitos do 1º prêmio">Dois últimos dígitos do 1º prêmio</option>
                          <option value="Três últimos dígitos do 1º prêmio">Três últimos dígitos do 1º prêmio</option>
                          <option value="Cinco dígitos do 1º prêmio (Número completo)">Cinco dígitos do 1º prêmio (Número completo)</option>
                          <option value="Combinação do 1º ao 5º prêmio">Combinação do 1º ao 5º prêmio</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 bg-violet-650 hover:bg-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest cursor-pointer"
                >
                  {isSaving ? "SALVANDO..." : "SALVAR CONFIGURAÇÕES DA RIFA"}
                </button>
              </form>
            </div>

            {/* LOJA PREMIUM CONFIGURATION */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  LOJA PREMIUM
                </h3>
              </div>
              <p className="text-xs text-zinc-500">
                Ative ou desative o módulo opcional da Loja RifaMaster. Quando desativado, o menu público e a página /loja serão ocultados.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      setIsSavingStoreEnabled(true);
                      await storeService.setStoreEnabled(true);
                    } catch (e: any) {
                      console.error("Erro ao ativar loja: ", e);
                    } finally {
                      setIsSavingStoreEnabled(false);
                    }
                  }}
                  disabled={isSavingStoreEnabled}
                  className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isStoreEnabledGlobally
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-black"
                      : "bg-black text-zinc-500 border-zinc-900 hover:text-zinc-400"
                  }`}
                >
                  <Check className="w-4 h-4" /> Ativada
                </button>
                <button
                  onClick={async () => {
                    try {
                      setIsSavingStoreEnabled(true);
                      await storeService.setStoreEnabled(false);
                    } catch (e: any) {
                      console.error("Erro ao desativar loja: ", e);
                    } finally {
                      setIsSavingStoreEnabled(false);
                    }
                  }}
                  disabled={isSavingStoreEnabled}
                  className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isStoreEnabledGlobally
                      ? "bg-red-500/10 text-red-400 border-red-500/30 font-black"
                      : "bg-black text-zinc-500 border-zinc-900 hover:text-zinc-400"
                  }`}
                >
                  <X className="w-4 h-4" /> Desativada
                </button>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">Resetar Cotas Desta Rifa</h3>
              <p className="text-xs text-zinc-500">Apaga todas as cotas vendidas, reservadas e pedidos associados apenas à rifa selecionada ({selectedRaffleId}). As configurações da rifa e o histórico global de ganhadores serão mantidos.</p>
              <button
                onClick={() => handleResetRaffle(selectedRaffleId, raffleConfig.title)}
                disabled={isClearing}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isClearing ? "animate-spin" : ""}`} />
                {isClearing ? "RESETANDO RIFA..." : "RESETAR ESTA RIFA"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* DRAW CONFIRMATION & SHARED WINNERS HALL MODALS */}
      {renderDrawConfirmationModal()}
      {renderSharedWinnersHallModals()}
      {renderPaidToastsContainer()}

      {markingAsDrawnRaffle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setMarkingAsDrawnRaffle(null)}>
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" /> Registrar Sorteio Realizado
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Defina o ganhador e conclua esta rifa definitivamente.</p>
              </div>
              <button onClick={() => setMarkingAsDrawnRaffle(null)} className="p-1.5 text-zinc-500 hover:text-white bg-zinc-900 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SELECTOR TO SWITCH RAFFLE WITHIN THE DRAW MODAL */}
            <div className="mt-3 bg-zinc-900/40 border border-zinc-900 p-3.5 rounded-2xl flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase text-zinc-400">Rifa Ativa:</span>
              <select
                value={markingAsDrawnRaffle.id}
                onChange={(e) => {
                  const r = raffles.find((x) => x.id === e.target.value);
                  if (r) {
                    setMarkingAsDrawnRaffle(r);
                  }
                }}
                className="bg-zinc-950 border border-zinc-800 text-[10px] font-black uppercase text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-violet-500 max-w-[200px]"
              >
                {raffles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title || "Sem Título"}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSubmitManualDraw} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Número da Cota Ganhadora</label>
                <input
                  type="text"
                  placeholder="Ex: 42 ou 057"
                  value={manualWinnerNumberInput}
                  onChange={(e) => setManualWinnerNumberInput(e.target.value)}
                  className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50 font-mono text-center text-lg font-black tracking-widest"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome Completo do Ganhador</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  value={manualWinnerNameInput}
                  onChange={(e) => setManualWinnerNameInput(e.target.value)}
                  className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50 font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Telefone do Ganhador (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={manualWinnerPhoneInput}
                  onChange={(e) => setManualWinnerPhoneInput(e.target.value)}
                  className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-white text-xs mt-1 outline-none focus:border-amber-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingManualDraw}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black text-xs uppercase rounded-xl cursor-pointer tracking-wider flex items-center justify-center gap-1 transition-all"
              >
                {isSubmittingManualDraw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[2.5]" />}
                CONFIRMAR SORTEIO E ENCERRAR RIFA
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
