import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:8080";
const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

const isTestToken = (token) => token?.startsWith("fake-");

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !isTestToken(token)) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = localStorage.getItem("token");
    if (error.response?.status === 401 && !isTestToken(token)) {
      localStorage.clear();
      window.location = "/";
    }
    return Promise.reject(error);
  },
);

export const auth = {
  login: (payload) => api.post("/auth/login", payload),
  solicitarRecuperacao: (email) =>
    api.post("/auth/recuperar-senha/solicitar", { email }),
  alterarSenha: (data) => api.post("/auth/recuperar-senha/alterar", data),
};

export const postoService = {
  getAll: () => api.get("/postos"),
  create: (data) => api.post("/postos", data),
  update: (id, data) => api.put(`/postos/${id}`, data),
  delete: (id) => api.delete(`/postos/${id}`),
};

export const checkService = {
  checkin: (formData) =>
    api.post("/checkin", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  checkout: (formData) =>
    api.post("/checkout", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const usuarioService = {
  getAll: () => api.get("/usuarios"),
  create: (data) => api.post("/usuarios", data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  delete: (id) => api.delete(`/usuarios/${id}`),
};

export const base64ToFile = (base64, filename) => {
  const arr = base64.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
};

export default api;