"use client";

import { FavoritesProvider } from "@/lib/hooks/useFavorites";

export default function Providers(props: { children: React.ReactNode }) {
  return <FavoritesProvider>{props.children}</FavoritesProvider>;
}