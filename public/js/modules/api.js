const API_BASE_URL = 'http://localhost/purenest/api/public';

async function apiFetch(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`.replace(/([^:]\/)\/+/g, "$1");

    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (options.body instanceof FormData) {
        delete defaultHeaders['Content-Type'];
    }

    options.headers = {
        ...defaultHeaders,
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
                console.error("ERROR REAL DEL BACKEND:", errorData);
            } catch (e) {
                errorData = {
                    message: `Error HTTP [${options.method || 'GET'} ${endpoint}]: Endpoint no encontrado`
                };
            }

            const finalMessage =
                errorData.error_detail ||
                errorData.message ||
                `HTTP error! status: ${response.status}`;

            throw new Error(finalMessage);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        console.error('API Fetch Error:', error);
        throw error;
    }
}

export const API = {
    auth: {
        login: async (email, password) => apiFetch('/auth/login', { // o la ruta exacta de tu endpoint de login en PHP
            method: 'POST',
            body: JSON.stringify({ email, password })
        })
    },
    services: {
        getAll: async () => apiFetch('/services'),
        getById: async (id) => apiFetch(`/services?id=${id}`),
        create: async (payload, isFormData = false) => apiFetch('/services', {
            method: 'POST',
            body: isFormData ? payload : JSON.stringify(payload)
        }),
        update: async (id, payload, isFormData = false) => apiFetch(`/services?id=${id}`, {
            method: isFormData ? 'POST' : 'PUT',
            body: isFormData ? payload : JSON.stringify(payload)
        }),
        delete: async (id) => apiFetch(`/services?id=${id}`, {
            method: 'DELETE'
        })
    },
    reservations: {
        getAll: async () => apiFetch('/reservations'),
        getById: async (id) => apiFetch(`/reservations?id=${id}`),
        create: async (payload) => apiFetch('/reservations', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
        update: async (id, payload) => apiFetch(`/reservations?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }),
        delete: async (id) => apiFetch(`/reservations?id=${id}`, {
            method: 'DELETE'
        })
    },
    categories: {
        getAll: async () => apiFetch('/categories')
    }
};