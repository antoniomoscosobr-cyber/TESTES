import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export const dashboardAPI = {
  getStats: () => api.get("/dashboard/stats"),
};

export const jobsAPI = {
  list: (params) => api.get("/jobs/", { params }),
  get: (id) => api.get(`/jobs/${id}`),
  updateStatus: (id, status) => api.patch(`/jobs/${id}/status`, null, { params: { status } }),
  delete: (id) => api.delete(`/jobs/${id}`),
};

export const applicationsAPI = {
  list: (params) => api.get("/applications/", { params }),
  create: (data) => api.post("/applications/", data),
  update: (id, data) => api.patch(`/applications/${id}`, data),
  delete: (id) => api.delete(`/applications/${id}`),
};

export const settingsAPI = {
  get: () => api.get("/settings/"),
  update: (data) => api.put("/settings/", data),
  uploadResume: (file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/settings/curriculo", form);
  },
};

export const scraperAPI = {
  run: () => api.post("/scrape/run"),
  startScheduler: (interval) => api.post("/scrape/start-scheduler", null, { params: { interval } }),
  stopScheduler: () => api.post("/scrape/stop-scheduler"),
};

export default api;
