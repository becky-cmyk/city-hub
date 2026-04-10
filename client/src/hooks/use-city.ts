import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import type { City, Zone, Category } from "@shared/schema";

export function useCity(citySlug: string | undefined) {
  return useQuery<City>({
    queryKey: ["/api/cities", citySlug],
    enabled: !!citySlug,
  });
}

export function useCityZones(citySlug: string | undefined) {
  return useQuery<Zone[]>({
    queryKey: ["/api/cities", citySlug, "zones"],
    enabled: !!citySlug,
  });
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
}

const ADMIN_CITY_KEY = "adminSelectedCityId";
const ADMIN_CITY_SLUG_KEY = "adminSelectedCitySlug";
const ADMIN_MODE_KEY = "adminMode";

export type AdminMode = "platform" | "metro";

export function useAdminCitySelection() {
  const [selectedCityId, setSelectedCityIdState] = useState<string>(() => {
    return localStorage.getItem(ADMIN_CITY_KEY) || "";
  });
  const [selectedCitySlug, setSelectedCitySlugState] = useState<string>(() => {
    return localStorage.getItem(ADMIN_CITY_SLUG_KEY) || "";
  });
  const [adminMode, setAdminModeState] = useState<AdminMode>(() => {
    return (localStorage.getItem(ADMIN_MODE_KEY) as AdminMode) || "metro";
  });

  const { data: adminCities } = useQuery<City[]>({
    queryKey: ["/api/admin/cities"],
  });

  useEffect(() => {
    if (adminCities && adminCities.length > 0 && !selectedCityId) {
      const defaultCity = adminCities[0];
      setSelectedCityIdState(defaultCity.id);
      setSelectedCitySlugState(defaultCity.slug);
      localStorage.setItem(ADMIN_CITY_KEY, defaultCity.id);
      localStorage.setItem(ADMIN_CITY_SLUG_KEY, defaultCity.slug);
    }
  }, [adminCities, selectedCityId]);

  const setSelectedCity = useCallback((city: City) => {
    setSelectedCityIdState(city.id);
    setSelectedCitySlugState(city.slug);
    localStorage.setItem(ADMIN_CITY_KEY, city.id);
    localStorage.setItem(ADMIN_CITY_SLUG_KEY, city.slug);
  }, []);

  const setAdminMode = useCallback((mode: AdminMode) => {
    setAdminModeState(mode);
    localStorage.setItem(ADMIN_MODE_KEY, mode);
  }, []);

  return {
    selectedCityId,
    selectedCitySlug,
    setSelectedCity,
    adminCities: adminCities || [],
    adminMode,
    setAdminMode,
  };
}

export function useDefaultCityId(): string {
  const stored = localStorage.getItem(ADMIN_CITY_KEY);
  const slugStored = localStorage.getItem(ADMIN_CITY_SLUG_KEY);
  const { data } = useCity(slugStored || undefined);
  if (stored) return stored;
  return data?.id || "";
}
