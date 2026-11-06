"use client";

import { FavoritesProvider } from "@/lib/hooks/useFavorites";
import { ToastProvider } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

export default function Providers(props: { children: React.ReactNode }) {
  return (
    <FavoritesProvider>
      <ToastProvider>
        {props.children}
        <ToastContainer />
      </ToastProvider>
    </FavoritesProvider>
  );
}