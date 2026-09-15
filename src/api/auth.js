import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "access_token";

export async function saveToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (error) {
    return null;
  }
}

export async function getCurrentUserId() {
  const token = await getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  return payload ? Number(payload.sub) : null;
}

export async function getCurrentUserRole() {
  const token = await getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  return payload ? payload.role : null;
}

export async function getCurrentUserName() {
  const token = await getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  return payload ? payload.name : null;
}