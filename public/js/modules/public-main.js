import { API } from './api.js';
import { Modal } from './modal.js';

let selectedFrequency = 'One-time';
let loadedServices = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadPublicServices();
    setupEstimateForm();
    setMinDateForService();
    setupSupportWidget();
});

function setMinDateForService() {
    const dateInput = document.getElementById('estimateDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }
}

async function loadPublicServices() {
    const serviceSelect = document.getElementById('estimateService');
    const servicesContainer = document.getElementById('public-services-container');

    try {
        const response = await API.services.getAll();

        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.services || [];
        }

        loadedServices = Array.isArray(rawData) ? rawData : [];

        if (serviceSelect) {
            serviceSelect.innerHTML = '<option value="">Select a cleaning service...</option>';
        }

        if (servicesContainer) {
            servicesContainer.innerHTML = '';
        }

        loadedServices.forEach(service => {
            if (Number(service.is_active) === 1) {
                if (serviceSelect) {
                    const opt = document.createElement('option');
                    opt.value = service.id;
                    const price = service.price_per_hour !== undefined ? Number(service.price_per_hour).toFixed(2) : '0.00';
                    opt.textContent = `${service.name} (From $${price}/hr)`;
                    serviceSelect.appendChild(opt);
                }

                if (servicesContainer) {
                    const imageUrl = service.image_url && service.image_url.trim() !== ''
                        ? (service.image_url.startsWith('http') ? service.image_url : `http://localhost/purenest/public${service.image_url}`)
                        : 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=800';

                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'group cursor-pointer';
                    cardDiv.innerHTML = `
                        <div class="relative h-[300px] rounded-xl overflow-hidden mb-6 bg-surface-container-high">
                            <img alt="${escapeHTML(service.name)}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="${imageUrl}">
                        </div>
                        <h3 class="font-headline-sm text-headline-sm text-primary mb-3">${escapeHTML(service.name)}</h3>
                        <p class="font-body-md text-body-md text-on-surface-variant mb-4">${escapeHTML(service.description || 'Professional cleaning service tailored to your needs.')}</p>
                        <div class="flex items-center justify-between">
                            <span class="font-label-caps text-primary font-bold">Professional Service</span>
                            <a class="font-label-caps text-label-caps text-primary border-b border-primary pb-1 group-hover:text-primary/70 transition-colors inline-block" href="#booking-section">Request Service</a>
                        </div>
                    `;
                    servicesContainer.appendChild(cardDiv);
                }
            }
        });
    } catch (error) {
        console.error('Error loading services:', error);
        Modal.error('Failed to load available services. Please try again later.', 'Connection Error');
    }
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}

function setupEstimateForm() {
    const form = document.getElementById('estimateForm');
    const freqButtons = document.querySelectorAll('.freq-btn');
    const phoneInput = document.getElementById('clientPhone');

    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    freqButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            freqButtons.forEach(b => {
                b.classList.remove('border-primary', 'bg-surface-container-low', 'font-medium');
                b.classList.add('border-outline-variant');
            });
            btn.classList.add('border-primary', 'bg-surface-container-low', 'font-medium');
            btn.classList.remove('border-outline-variant');
            selectedFrequency = btn.getAttribute('data-freq');
        });
    });

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

        const firstName = document.getElementById('clientFirstName').value.trim();
        const lastName = document.getElementById('clientLastName').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();

        const serviceId = document.getElementById('estimateService').value;
        const bedrooms = Number(document.getElementById('estimateBedrooms').value);
        const bathrooms = Number(document.getElementById('estimateBathrooms').value);
        const serviceDate = document.getElementById('estimateDate').value;
        const preferredTime = document.getElementById('estimateTime').value;
        const serviceAddress = document.getElementById('estimateAddress').value.trim();

        const notesInput = document.getElementById('clientNotes');
        const userNotes = notesInput ? notesInput.value.trim() : '';

        if (!firstName) { triggerError('clientFirstName', 'Please enter your first name.'); return; }
        if (!lastName) { triggerError('clientLastName', 'Please enter your last name.'); return; }
        if (!email) { triggerError('clientEmail', 'Please enter your email address.'); return; }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { triggerError('clientEmail', 'Please enter a valid email address.'); return; }

        if (!phone) { triggerError('clientPhone', 'Please enter your phone number.'); return; }

        const phoneRegex = /^\d+$/;
        if (!phoneRegex.test(phone)) { triggerError('clientPhone', 'Phone number must contain only numbers without spaces or symbols.'); return; }

        if (!serviceId) { triggerError('estimateService', 'Please select a cleaning service.'); return; }
        if (!serviceDate) { triggerError('estimateDate', 'Please select a service date.'); return; }

        const selectedDate = new Date(serviceDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) { triggerError('estimateDate', 'The service date cannot be set in the past.'); return; }
        if (!preferredTime) { triggerError('estimateTime', 'Please select a preferred time.'); return; }

        if (selectedDate.getTime() === today.getTime()) {
            const [hours, minutes] = preferredTime.split(':').map(Number);
            const now = new Date();
            if (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes())) {
                triggerError('estimateTime', 'You cannot select a time in the past for today.');
                return;
            }
        }

        if (!serviceAddress) { triggerError('estimateAddress', 'Please enter your service address.'); return; }

        let systemSchedule = {};
        try {
            const scheduleResponse = await API.systemSchedule.get();
            systemSchedule = scheduleResponse.data || scheduleResponse || {};
        } catch (err) {
            console.warn('Could not fetch system schedule restrictions:', err);
        }

        let rawSpecificDates = systemSchedule.blocked_specific_dates || [];
        if (typeof rawSpecificDates === 'string') {
            try { rawSpecificDates = JSON.parse(rawSpecificDates); } catch (e) { rawSpecificDates = []; }
        }
        const blockedSpecificDates = Array.isArray(rawSpecificDates) ? rawSpecificDates : [];
        
        if (blockedSpecificDates.includes(serviceDate)) {
            triggerError('estimateDate', 'The business is closed on this specific date due to administrator restrictions. Please choose another date.');
            return;
        }

        let rawGlobalDays = systemSchedule.global_blocked_days || [];
        if (typeof rawGlobalDays === 'string') {
            try { rawGlobalDays = JSON.parse(rawGlobalDays); } catch (e) { rawGlobalDays = []; }
        }
        
        const dayOfWeek = selectedDate.getDay();
        const normalizedGlobalDays = Array.isArray(rawGlobalDays) ? rawGlobalDays.map(Number) : [];
        
        if (normalizedGlobalDays.includes(dayOfWeek)) {
            triggerError('estimateDate', 'Bookings are globally disabled for this day of the week. Please select another date.');
            return;
        }

        const globalStart = systemSchedule.global_block_time_start;
        const globalEnd = systemSchedule.global_block_time_end;
        if (globalStart && globalEnd) {
            const timeToMinutes = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const selectedMinutes = timeToMinutes(preferredTime);
            const startMinutes = timeToMinutes(globalStart);
            const endMinutes = timeToMinutes(globalEnd);

            if (selectedMinutes >= startMinutes && selectedMinutes <= endMinutes) {
                triggerError('estimateTime', `Bookings are globally blocked between ${globalStart} and ${globalEnd}. Please select a different time.`);
                return;
            }
        }

        const service = loadedServices.find(s => String(s.id) === String(serviceId));
        if (!service) return;

        let blockedDays = [];
        try {
            blockedDays = service.blocked_days ? (Array.isArray(service.blocked_days) ? service.blocked_days : JSON.parse(service.blocked_days)) : [];
        } catch (err) {
            blockedDays = [];
        }

        const normalizedBlockedDays = blockedDays.map(Number);
        if (normalizedBlockedDays.includes(dayOfWeek)) {
            triggerError('estimateDate', 'Selected day is blocked for this specific service. Please choose another date.');
            return;
        }

        if (service.block_time_start && service.block_time_end) {
            const timeToMinutes = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const selectedMinutes = timeToMinutes(preferredTime);
            const startMinutes = timeToMinutes(service.block_time_start);
            const endMinutes = timeToMinutes(service.block_time_end);

            if (selectedMinutes >= startMinutes && selectedMinutes <= endMinutes) {
                triggerError('estimateTime', `This service cannot be scheduled between ${service.block_time_start} and ${service.block_time_end}.`);
                return;
            }
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        try {
            const finalInstructions = userNotes
                ? `${userNotes} | Frequency: ${selectedFrequency}`
                : `Booked via public site. Frequency: ${selectedFrequency}`;

            const payload = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone_number: phone,
                service_id: Number(serviceId),
                service_date: serviceDate,
                preferred_time: preferredTime,
                service_address: serviceAddress,
                bedrooms: bedrooms,
                bathrooms: bathrooms,
                frequency: selectedFrequency,
                total_price: 0.00,
                status: 'PENDING',
                special_instructions: finalInstructions
            };

            await API.reservations.create(payload);

            Modal.show({
                type: 'success',
                title: 'Service Request Sent!',
                message: `Thank you ${firstName}! Your service request has been successfully submitted. Our team will review your details and send you a price estimate shortly.`,
                confirmText: 'Done',
                showCancel: false,
                onConfirm: () => {
                    form.reset();
                    setMinDateForService();
                }
            });

        } catch (error) {
            console.error(error);
            Modal.error(error.message || 'An error occurred while saving your reservation.', 'Booking Error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    });
}

function setupSupportWidget() {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('button, a, div, span');
        if (!target) return;

        const text = target.textContent ? target.textContent.trim() : '';

        if (text.includes('Request an Estimate') || text.includes('Request Service')) {
            e.preventDefault();
            const formSection = document.getElementById('estimateForm') || document.getElementById('hero');
            if (formSection) {
                formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const firstInput = document.getElementById('clientFirstName');
                if (firstInput) firstInput.focus();
            }
            return;
        }

        if (text.includes('Talk to Support')) {
            e.preventDefault();
            const phoneNumber = '15713761694';
            const message = encodeURIComponent('Hello PureNest Support, I need help with a cleaning service.');
            window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            return;
        }

        if (text.includes('Track My Booking')) {
            e.preventDefault();

            const trackingFormHTML = `
                <div class="flex flex-col gap-3 pt-2">
                    <label class="text-xs sm:text-sm text-on-surface-variant font-medium">Enter your Reservation ID or Email:</label>
                    <input type="text" id="trackingIdentifierInput" placeholder="e.g. 12 or jane@example.com" class="w-full input-underline text-body-md text-primary pb-2 focus:ring-0 border-b border-outline-variant/50 outline-none">
                </div>
            `;

            Modal.show({
                type: 'info',
                title: 'Track My Booking',
                message: 'Please provide your details below to check your booking history.',
                htmlContent: trackingFormHTML,
                confirmText: 'Search Booking',
                showCancel: true,
                onConfirm: async () => {
                    const inputElement = document.getElementById('trackingIdentifierInput');
                    const identifier = inputElement ? inputElement.value.trim().toLowerCase() : '';

                    if (!identifier) {
                        Modal.error('Please enter a valid ID or email address.', 'Tracking Error');
                        return false;
                    }

                    try {
                        const response = await API.reservations.getAll();
                        let reservations = response;
                        if (response && typeof response === 'object' && !Array.isArray(response)) {
                            reservations = response.data || response.reservations || [];
                        }

                        const foundList = reservations.filter(r =>
                            String(r.id) === identifier ||
                            (r.email && String(r.email).toLowerCase() === identifier)
                        );

                        Modal.close();

                        if (foundList.length > 0) {
                            foundList.sort((a, b) => new Date(b.service_date) - new Date(a.service_date));

                            let listHTML = `<div class="space-y-3 max-h-[350px] overflow-y-auto pr-1 mt-2 text-left">`;

                            foundList.forEach(found => {
                                const statusColor = found.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                                    found.status === 'CONFIRMED' ? 'bg-primary-fixed text-primary-container' :
                                        'bg-tertiary-fixed text-tertiary-container';

                                const displayPrice = Number(found.total_price || 0) > 0 ? `$${Number(found.total_price).toFixed(2)}` : 'Pending Quote';

                                listHTML += `
                                    <div class="p-3 rounded-lg border border-outline-variant/30 bg-surface flex flex-col gap-1.5 shadow-sm">
                                        <div class="flex justify-between items-center">
                                            <span class="text-xs font-bold text-primary">#RES-${String(found.id).padStart(4, '0')} - ${escapeHTML(found.service_name || 'Cleaning Service')}</span>
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor}">${found.status || 'PENDING'}</span>
                                        </div>
                                        <div class="text-xs text-on-surface-variant flex flex-col gap-0.5">
                                            <span><b>Date:</b> ${found.service_date} at ${found.preferred_time || 'N/A'}</span>
                                            <span><b>Address:</b> ${escapeHTML(found.service_address || 'N/A')}</span>
                                            <span><b>Total:</b> ${displayPrice}</span>
                                        </div>
                                    </div>
                                `;
                            });
                            listHTML += `</div>`;

                            Modal.show({
                                type: 'info',
                                title: `Booking History (${foundList.length} found)`,
                                message: `Showing all services associated with: ${identifier}`,
                                confirmText: 'Close',
                                showCancel: false,
                                htmlContent: listHTML
                            });
                        } else {
                            Modal.error('No reservations were found matching that ID or email.', 'Tracking Result');
                        }
                    } catch (error) {
                        console.error('Error tracking reservation:', error);
                        Modal.close();
                        Modal.error('Could not retrieve booking details at this moment. Please try again later.', 'Error');
                    }

                    return false;
                }
            });
            return;
        }
    });
}