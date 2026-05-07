import { Platform } from "react-native";
import axios from "axios";

const DEFAULT_API_URL = "http://10.0.2.2:3031/api/v1";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function normalizeApiUrl(value) {
  const configuredUrl = trimTrailingSlash(
    (value || DEFAULT_API_URL).trim() || DEFAULT_API_URL
  );

  if (Platform.OS !== "web") {
    return configuredUrl;
  }

  return configuredUrl
    .replace("://10.0.2.2:", "://localhost:")
    .replace("://10.0.2.2/", "://localhost/");
}

function toHealthUrl(apiUrl) {
  return apiUrl.replace(/\/api\/v\d+$/i, "") + "/health";
}

function notePayload(note) {
  const trimmedNote = note?.trim();
  return trimmedNote ? { note: trimmedNote } : {};
}

export const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
export const HEALTH_URL = toHealthUrl(API_URL);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export function setAuthToken(token) {
  const trimmedToken = token?.trim();

  if (trimmedToken) {
    api.defaults.headers.common.Authorization = `Bearer ${trimmedToken}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
}

export function formatApiError(error) {
  return error.response?.data?.message || error.message || "Unexpected error";
}

export async function healthCheck() {
  const res = await axios.get(HEALTH_URL, { timeout: 10000 });
  return res.data;
}

export async function checkIn(note) {
  const res = await api.post("/attendance/check-in", notePayload(note));
  return res.data;
}

export async function checkOut(note) {
  const res = await api.post("/attendance/check-out", notePayload(note));
  return res.data;
}

export async function getTodayAttendance() {
  const res = await api.get("/attendance/today");
  return res.data;
}
