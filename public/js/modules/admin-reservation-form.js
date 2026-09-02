import { API } from './api.js';
import { Modal } from './modal.js';

let editingReservationId = null;
let selectedFrequency = 'One-time';
let loadedServices = [];
let originalCleanNotes = '';
document.addEventListener('DOMContentLoaded', async () => {
    setupFrequencyButtons();
    setupPhoneMask();
    setMinDateForService();

    const urlParams = new URLSearchParams(window.location.search);
    editingReservationId = urlParams.get('id');

    await loadServices();

    if (editingReservationId) {
        await setupEditMode(editingReservationId);
    }

    setupFormEvents();
});

function setMinDateForService() {
    const dateInput = document.getElementById('serviceDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }
}

async function loadServices() {
    const serviceSelect = document.getElementById('serviceType');
    if (!serviceSelect) return;

    try {
        const response = await API.services.getAll();

        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.services || [];
        }

        loadedServices = Array.isArray(rawData) ? rawData : [];

        serviceSelect.innerHTML = '<option value="">Select a cleaning service...</option>';
        loadedServices.forEach(service => {
            const opt = document.createElement('option');
            opt.value = service.id;
            const price = service.price_per_hour !== undefined ? Number(service.price_per_hour).toFixed(2) : '0.00';
            opt.textContent = `${service.name} ($${price}/hr)`;
            serviceSelect.appendChild(opt);
        });

    } catch (error) {
        console.error('Error loading services:', error);
        Modal.error('Failed to load available services. Please try again later.', 'Connection Error');
    }
}

async function setupEditMode(id) {
    try {
        const response = await API.reservations.getById(id);
        const reservation = response.data || response;
        if (!reservation) return;

        editingReservationId = reservation.id || id;

        const titleEl = document.querySelector('h3');
        const submitBtn = document.getElementById('btnSubmit');
        if (titleEl) titleEl.textContent = `Edit Reservation #${editingReservationId}`;
        if (submitBtn) submitBtn.textContent = 'Update Reservation';

        document.getElementById('firstName').value = reservation.first_name || '';
        document.getElementById('lastName').value = reservation.last_name || '';
        document.getElementById('email').value = reservation.email || '';
        document.getElementById('phone').value = reservation.phone_number || '';

        if (reservation.service_id) {
            document.getElementById('serviceType').value = String(reservation.service_id);
        }

        if (reservation.bedrooms !== undefined && reservation.bedrooms !== null) {
            document.getElementById('serviceBedrooms').value = String(Number(reservation.bedrooms));
        }

        if (reservation.bathrooms !== undefined && reservation.bathrooms !== null) {
            document.getElementById('serviceBathrooms').value = String(Number(reservation.bathrooms));
        }

        document.getElementById('serviceDate').value = reservation.service_date || '';
        document.getElementById('serviceTime').value = reservation.preferred_time || '';
        document.getElementById('address').value = reservation.service_address || '';

        // Limpiar las notas de cualquier frecuencia previa para mostrar las notas reales limpias al usuario
        if (reservation.special_instructions) {
            const parts = reservation.special_instructions.split('| Frequency:');
            originalCleanNotes = parts[0].trim();
            document.getElementById('notes').value = originalCleanNotes;
        }

        if (reservation.frequency) {
            selectedFrequency = reservation.frequency;
            const freqButtons = document.querySelectorAll('.freq-btn');
            freqButtons.forEach(btn => {
                if (btn.getAttribute('data-freq') === selectedFrequency) {
                    btn.classList.add('border-primary', 'bg-surface-container-low', 'font-medium', 'text-primary');
                    btn.classList.remove('border-outline-variant/50', 'text-on-surface');
                } else {
                    btn.classList.remove('border-primary', 'bg-surface-container-low', 'font-medium', 'text-primary');
                    btn.classList.add('border-outline-variant/50', 'text-on-surface');
                }
            });
        }

    } catch (error) {
        console.error(error);
        Modal.error('Failed to load reservation details for editing.', 'Error');
    }
}

function setupFrequencyButtons() {
    const freqButtons = document.querySelectorAll('.freq-btn');
    freqButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            freqButtons.forEach(b => {
                b.classList.remove('border-primary', 'bg-surface-container-low', 'font-medium', 'text-primary');
                b.classList.add('border-outline-variant/50', 'text-on-surface');
            });
            btn.classList.add('border-primary', 'bg-surface-container-low', 'font-medium', 'text-primary');
            btn.classList.remove('border-outline-variant/50', 'text-on-surface');
            selectedFrequency = btn.getAttribute('data-freq');
        });
    });
}

function setupPhoneMask() {
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function setupFormEvents() {
    const form = document.getElementById('reservationForm');
    const cancelBtn = document.getElementById('btnCancel');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'admin-reservation-index.html';
        });
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const triggerError = (elementId, message) => {
            const el = document.getElementById(elementId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus({ preventScroll: true });
            }
            Modal.error(message, 'Validation Error');
        };

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();

        const serviceId = document.getElementById('serviceType').value;
        const bedrooms = Number(document.getElementById('serviceBedrooms').value);
        const bathrooms = Number(document.getElementById('serviceBathrooms').value);
        const serviceDate = document.getElementById('serviceDate').value;
        const preferredTime = document.getElementById('serviceTime').value;
        const serviceAddress = document.getElementById('address').value.trim();
        const notesInput = document.getElementById('notes');
        const userNotes = notesInput ? notesInput.value.trim() : '';

        if (!firstName) {
            triggerError('firstName', 'Please enter your first name.');
            return;
        }
        if (!lastName) {
            triggerError('lastName', 'Please enter your last name.');
            return;
        }
        if (!email) {
            triggerError('email', 'Please enter your email address.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            triggerError('email', 'Please enter a valid email address.');
            return;
        }

        if (!phone) {
            triggerError('phone', 'Please enter your phone number.');
            return;
        }

        const phoneRegex = /^\d+$/;
        if (!phoneRegex.test(phone)) {
            triggerError('phone', 'Phone number must contain only numbers without spaces or symbols.');
            return;
        }

        if (!serviceId) {
            triggerError('serviceType', 'Please select a cleaning service.');
            return;
        }
        if (!serviceDate) {
            triggerError('serviceDate', 'Please select a service date.');
            return;
        }

        const selectedDate = new Date(serviceDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            triggerError('serviceDate', 'The service date cannot be set in the past.');
            return;
        }

        if (!preferredTime) {
            triggerError('serviceTime', 'Please select a preferred time.');
            return;
        }

        if (selectedDate.getTime() === today.getTime()) {
            const [hours, minutes] = preferredTime.split(':').map(Number);
            const now = new Date();
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();

            if (hours < currentHours || (hours === currentHours && minutes <= currentMinutes)) {
                triggerError('serviceTime', 'You cannot select a time in the past for today.');
                return;
            }
        }

        if (!serviceAddress) {
            triggerError('address', 'Please enter your service address.');
            return;
        }

        const service = loadedServices.find(s => String(s.id) === String(serviceId));

        const baseRate = service ? Number(service.price_per_hour || 25) : 25;
        const baseDuration = service ? Number(service.estimated_duration_hours || 2) : 2;
        const sizeMultiplier = 1 + ((bedrooms + (bathrooms * 0.5) - 1.5) * 0.2);
        const estimatedTotal = baseRate * baseDuration * Math.max(sizeMultiplier, 1);

        const submitBtn = document.getElementById('btnSubmit');
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            const finalInstructions = userNotes
                ? `${userNotes} | Frequency: ${selectedFrequency}`
                : `Booked via admin panel. Frequency: ${selectedFrequency}`;

            const payload = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone_number: phone,
                service_id: Number(serviceId),
                service_date: serviceDate,
                preferred_time: preferredTime,
                service_address: serviceAddress,
                bedrooms: Number(bedrooms),
                bathrooms: Number(bathrooms),
                frequency: selectedFrequency,
                total_price: Number(estimatedTotal.toFixed(2)),
                status: 'PENDING',
                special_instructions: finalInstructions
            };

            if (editingReservationId) {
                await API.reservations.update(editingReservationId, payload);
                Modal.show({
                    type: 'success',
                    title: 'Reservation Updated',
                    message: `The reservation for ${firstName} ${lastName} has been successfully updated.`,
                    confirmText: 'Back to List',
                    showCancel: false,
                    onConfirm: () => {
                        window.location.href = 'admin-reservation-index.html';
                    }
                });
            } else {
                await API.reservations.create(payload);
                Modal.show({
                    type: 'success',
                    title: 'Reservation Created',
                    message: `The reservation for ${firstName} ${lastName} has been successfully created.`,
                    confirmText: 'Back to List',
                    showCancel: false,
                    onConfirm: () => {
                        window.location.href = 'admin-reservation-index.html';
                    }
                });
            }

        } catch (error) {
            console.error(error);
            Modal.error(error.message || 'An error occurred while saving the reservation.', 'Error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}