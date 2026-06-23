// frontend/src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const uploadPDF = async (file) => {
  const formData = new FormData();
  formData.append("pdf", file);

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  return response.json();
};

export const generateCourse = async (text, language) => {
  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  return response.json();
};

export const testConnection = async () => {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
};
