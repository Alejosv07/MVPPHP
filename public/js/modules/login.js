import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const alertMessage = document.getElementById('alert-message');
    const submitBtn = document.getElementById('submitBtn');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            showAlert('Please enter email and password', 'error');
            return;
        }

        showAlert('Verifying credentials...', 'info');
        submitBtn.disabled = true;

        try {
            const response = await API.auth.login(email, password);

            showAlert('Login successful! Redirecting...', 'success');

            localStorage.setItem('purenest_user', JSON.stringify(response.user));

            setTimeout(() => {
                window.location.href = 'admin-index.html';
            }, 1000);

        } catch (error) {
            showAlert(error.message || 'Invalid credentials', 'error');
            submitBtn.disabled = false;
        }
    });

    function showAlert(message, type) {
        if (!alertMessage) return;
        alertMessage.textContent = message;
        alertMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700', 'bg-blue-100', 'text-blue-700');

        if (type === 'error') {
            alertMessage.classList.add('bg-red-100', 'text-red-700');
        } else if (type === 'success') {
            alertMessage.classList.add('bg-green-100', 'text-green-700');
        } else {
            alertMessage.classList.add('bg-blue-100', 'text-blue-700');
        }
    }
});