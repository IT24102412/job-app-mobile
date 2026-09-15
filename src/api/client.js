import axios from "axios";
import { getToken } from "./auth";

// IMPORTANT: replace with YOUR computer's local IP address (not localhost)
const BASE_URL = "https://job-app-backend-4o6f.onrender.com";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;