import { create } from "zustand";

interface OrderState {
  customerPhone: string;
  packages: OrderPackage[];
  currentStep: number;
  setCustomerPhone: (phone: string) => void;
  addPackage: (pkg: OrderPackage) => void;
  nextStep: () => void;
  prevStep: () => void;
}

type OrderPackage = {
  label?: string;
  quantity?: number;
  notes?: string;
};

export const useOrderStore = create<OrderState>((set) => ({
  customerPhone: "",
  packages: [],
  currentStep: 1,
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
  addPackage: (pkg) => set((state) => ({ packages: [...state.packages, pkg] })),
  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
  prevStep: () => set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),
}));
