const API_BASE_URL = 'https://cleaning.mutechlabs.com/api/public';

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
        login: async (email, password) => apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }),
        requestPasswordReset: async (email) => apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        }),
        resetPassword: async (payload) => apiFetch('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
    },
    serviceZones: {
        getAll: async () => apiFetch('/service-zones'),
        getActive: async () => apiFetch('/service-zones/active'),
        getById: async (id) => apiFetch(`/service-zones?id=${id}`),
        create: async (payload) => {
            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            if (!payload.user_id && user.id) {
                payload.user_id = user.id;
            }
            return apiFetch('/service-zones', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        update: async (id, payload) => {
            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            if (!payload.user_id && user.id) {
                payload.user_id = user.id;
            }
            return apiFetch(`/service-zones?id=${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        },
        delete: async (id) => {
            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            return apiFetch(`/service-zones?id=${id}`, {
                method: 'DELETE',
                body: JSON.stringify({ user_id: user.id || null })
            });
        }
    },
    authCustomer: {
        sendOtp: async (email) => apiFetch('/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email })
        }),
        verifyOtp: async (email, code) => apiFetch('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ email, code })
        })
    },
    ratings: {
        submitCustomerRating: async (reservationId, data) => {
            return await apiFetch(`/reservations/${reservationId}/customer-rating`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        submitStaffRating: async (reservationId, data) => {
            return await apiFetch(`/reservations?id=${reservationId}&action=staff-rating`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    },
    admins: {
        getAll: async () => apiFetch('/admins'),
        getById: async (id) => apiFetch(`/admins?id=${id}`),
        create: async (payload) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            if (!payload.logged_user_id && user.id) {
                payload.logged_user_id = user.id;
            }
            return apiFetch('/admins', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        update: async (id, payload) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            if (!payload.logged_user_id && user.id) {
                payload.logged_user_id = user.id;
            }
            return apiFetch(`/admins?id=${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        },
        delete: async (id) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            const payload = { logged_user_id: user.id || null };

            return apiFetch(`/admins?id=${id}`, {
                method: 'DELETE',
                body: JSON.stringify(payload)
            });
        },
        issueResetToken: async (id) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            const payload = { logged_user_id: user.id || null };

            return await apiFetch(`/admins/${id}/reset-token`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }
    },
    services: {
        getAll: async () => apiFetch('/services'),
        getById: async (id) => apiFetch(`/services?id=${id}`),
        create: async (payload, isFormData = false) => {
            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};

            if (isFormData) {
                if (!payload.has('user_id') && user.id) {
                    payload.append('user_id', user.id);
                }
            } else {
                if (!payload.user_id && user.id) {
                    payload.user_id = user.id;
                }
                payload = JSON.stringify(payload);
            }

            return apiFetch('/services', {
                method: 'POST',
                body: payload
            });
        },
        update: async (id, payload, isFormData = false) => {
            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};

            if (isFormData) {
                if (!payload.has('user_id') && user.id) {
                    payload.append('user_id', user.id);
                }
            } else {
                if (!payload.user_id && user.id) {
                    payload.user_id = user.id;
                }
                payload = JSON.stringify(payload);
            }

            return apiFetch(`/services?id=${id}`, {
                method: isFormData ? 'POST' : 'PUT',
                body: payload
            });
        },
        delete: async (id) => {
            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            const payload = { user_id: user.id || null };

            return apiFetch(`/services?id=${id}`, {
                method: 'DELETE',
                body: JSON.stringify(payload)
            });
        }
    },
    reservations: {
        getAll: async (month = null, year = null, search = null) => {
            let endpoint = '/reservations';
            const params = [];

            if (month && year) {
                params.push(`month=${month}&year=${year}`);
            }

            if (search) {
                params.push(`search=${encodeURIComponent(search)}`);
            }

            const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
            if (rawUser && rawUser !== 'undefined') {
                try {
                    const user = JSON.parse(rawUser);
                    const role = (user.role || '').toUpperCase();
                    if (role !== 'ADMIN' && user.id) {
                        params.push(`staff_id=${user.id}`);
                    }
                } catch (e) {
                    console.error('Error parsing user for reservation filter', e);
                }
            }

            if (params.length > 0) {
                endpoint += `?${params.join('&')}`;
            }

            return apiFetch(endpoint);
        },
        getById: async (id) => apiFetch(`/reservations?id=${id}`),
        create: async (payload) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            if (!payload.user_id && user.id) {
                payload.user_id = user.id;
            }
            return apiFetch('/reservations', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        update: async (id, payload) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};

            if (!payload.user_id && user.id) {
                payload.user_id = user.id;
            }

            return apiFetch(`/reservations?id=${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        },
        delete: async (id) => apiFetch(`/reservations?id=${id}`, {
            method: 'DELETE'
        }),
    },
    categories: {
        getAll: async () => apiFetch('/categories'),
        getById: async (id) => apiFetch(`/categories?id=${id}`),
        create: async (payload) => apiFetch('/categories', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
        update: async (id, payload) => apiFetch(`/categories?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }),
        delete: async (id) => apiFetch(`/categories?id=${id}`, {
            method: 'DELETE'
        })
    },
    audit: {
        getLogs: async () => apiFetch('/audit-logs'),
        getHistory: async () => apiFetch('/audit-logs/history')
    },
    systemSchedule: {
        get: async () => apiFetch('/system-schedule'),
        save: async (payload) => {
            const rawUser = localStorage.getItem('purenest_user');
            const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
            if (!payload.user_id && user.id) {
                payload.user_id = user.id;
            }
            return apiFetch('/system-schedule', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }
    },
    features: {
        getAll: async () => apiFetch('/features'),
        getById: async (id) => apiFetch(`/features?id=${id}`),
        getByService: async (serviceId) => apiFetch(`/services/${serviceId}/features`),
        create: async (payload) => apiFetch('/features', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
        update: async (id, payload) => apiFetch(`/features?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }),
        delete: async (id) => apiFetch(`/features?id=${id}`, {
            method: 'DELETE'
        })
    },
};