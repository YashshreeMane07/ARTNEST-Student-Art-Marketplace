import { createContext, useContext } from "react";

export type Creator = {
  id: string;
  name: string;
  initials: string;
  college: string;
  location: string;
  bio: string;
  followers: number;
  works: number;
  rating: number;
  skills: string[];
};

export type Art = {
  id: string;
  title: string;
  creatorId: string;
  category: string;
  style: string;
  price: number;
  likes: number;
  saves: number;
  views: number;
  rating: number;
  image: string;
  description: string;
  tags: string[];
  rank?: number;
  created: number;
};

export type AppState = {
  arts: Art[];
  wishlist: string[];
  cart: string[];
  liked: string[];
  following: string[];
  loading: boolean;
  apiError: string;
  dashboard: any;
  dashboardLoading: boolean;
  toast: (message: string) => void;
  refreshArts: () => Promise<void>;
  refreshPrivate: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  toggleSave: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  addCart: (id: string) => Promise<void>;
  removeCart: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  publishArt: (art: Art, status?: "DRAFT" | "PUBLISHED", file?: File) => Promise<Art | null>;
  toggleFollow: (id: string) => Promise<void>;
};

export const DataContext = createContext<AppState | null>(null);

export function useApp() {
  const value = useContext(DataContext);
  if (!value) throw new Error("ARTNEST application state is unavailable.");
  return value;
}
