import { pushDocument } from "./cloudSync";

export const restaurantProfileStorageKey = "zg_restaurant_profile_v2";

export type RestaurantProfile = {
  name: string;
  cuisine: string;
  address: string;
  hours: string;
  signature: string;
  capacity: string;
  tone: string;
};

// 字段默认一律留空，靠 placeholder 引导用户填写，避免占位字串当成真实资料外泄
export const defaultRestaurantProfile: RestaurantProfile = {
  name: "",
  cuisine: "",
  address: "",
  hours: "",
  signature: "",
  capacity: "",
  tone: "",
};

// 资料未填时，UI 展示用的中性替代词（不会被当成真实店名/产品送进 AI）
export const profileFallback = {
  name: "你的餐饮品牌",
  cuisine: "餐饮",
  signature: "你的招牌产品/服务",
};

// 取字段值，空则回退到中性词（仅供 UI 展示，不进 AI prompt）
export function fieldOr(value: string, fallback: string) {
  return value.trim() || fallback;
}

export function normalizeRestaurantProfile(profile?: Partial<RestaurantProfile>): RestaurantProfile {
  return { ...defaultRestaurantProfile, ...profile };
}

export function loadRestaurantProfile(): RestaurantProfile {
  if (typeof window === "undefined") return defaultRestaurantProfile;

  try {
    const raw = localStorage.getItem(restaurantProfileStorageKey);
    if (!raw) return defaultRestaurantProfile;

    return normalizeRestaurantProfile(JSON.parse(raw));
  } catch {
    return defaultRestaurantProfile;
  }
}

export function saveRestaurantProfile(profile: RestaurantProfile) {
  localStorage.setItem(restaurantProfileStorageKey, JSON.stringify(profile));
  pushDocument(restaurantProfileStorageKey, profile);
}

export function hasConfiguredRestaurantProfile(profile: RestaurantProfile) {
  return profile.name.trim() !== "" && profile.signature.trim() !== "";
}

// 只列已填字段送进 AI，空字段直接跳过，避免 AI 复述占位文字或编造资料
export function restaurantProfileSummary(profile: RestaurantProfile) {
  return [
    profile.name.trim() ? `餐饮品牌：${profile.name}` : "",
    profile.cuisine.trim() ? `业态定位：${profile.cuisine}` : "",
    profile.address.trim() ? `地址：${profile.address}` : "",
    profile.hours.trim() ? `营业时间：${profile.hours}` : "",
    profile.signature.trim() ? `主推产品/服务：${profile.signature}` : "",
    profile.capacity.trim() ? `接待/出餐能力：${profile.capacity}` : "",
    profile.tone.trim() ? `回复语气：${profile.tone}` : "",
  ].filter(Boolean).join("\n");
}
