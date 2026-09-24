import { API } from './api.js';
import { Modal } from './modal.js';

let selectedFrequency = 'One-time';
let loadedServices = [];
let googleMapInstance = null;
let mapMarker = null;
let mapAutocomplete = null;
let selectedMapAddress = '';

let allowedZones = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllowedZonesFromDatabase();
    await loadPublicServices();
    setupEstimateForm();
    setMinDateForService();
    setupSupportWidget();
    setupAddressValidation();
    setupMapModal();
});

async function loadAllowedZonesFromDatabase() {
    try {
        const response = await API.serviceZones.getAll();
        let rawData = response;

        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.zones || [];
        }

        allowedZones = [];
        
        rawData.forEach(zone => {
            if (Number(zone.is_active) === 1) {
                allowedZones.push(zone.city_name.toLowerCase());
                if (zone.areas && Array.isArray(zone.areas)) {
                    zone.areas.forEach(area => {
                        if (Number(area.is_active) === 1) {
                            allowedZones.push(area.area_name.toLowerCase());
                        }
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error loading zones from database, using fallback:', error);
        allowedZones = ["alexandria", "old town", "del ray", "rosemont", "arlington", "clarendon", "ballston"];
    }
}

function validateAddressArea(addressText) {
    const textLower = addressText.toLowerCase();
    const errorEl = document.getElementById('addressError');
    const submitBtn = document.querySelector('#estimateForm button[type="submit"]');

    if (!addressText.trim()) {
        if (errorEl) errorEl.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return true;
    }

    if (allowedZones.length === 0) return true;

    const isAllowed = allowedZones.some(zone => textLower.includes(zone));

    if (!isAllowed) {
        if (errorEl) errorEl.classList.remove('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return false;
    } else {
        if (errorEl) errorEl.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return true;
    }
}

function setupAddressValidation() {
    const addressInput = document.getElementById('estimateAddress');
    const geoBtn = document.getElementById('geoBtn');

    if (addressInput) {
        addressInput.addEventListener('input', (e) => {
            validateAddressArea(e.target.value);
        });
    }

    if (geoBtn && addressInput) {
        geoBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await response.json();
                        const fullAddress = data.display_name || "";
                        addressInput.value = fullAddress;
                        validateAddressArea(fullAddress);
                    } catch (error) {
                        alert("We couldn't retrieve your exact address automatically. Please enter it manually.");
                    }
                }, () => {
                    alert("Please allow location access in your browser to use this feature.");
                });
            } else {
                alert("Your browser doesn't support geolocation.");
            }
        });
    }
}

function setupMapModal() {
    const modal = document.getElementById('mapModal');
    const openBtn = document.getElementById('mapModalBtn');
    const closeBtn = document.getElementById('closeMapModal');
    const cancelBtn = document.getElementById('cancelMapModal');
    const confirmBtn = document.getElementById('confirmMapModal');
    const addressInput = document.getElementById('estimateAddress');
    const mapSearchInput = document.getElementById('mapSearchInput');
    const searchBtn = document.getElementById('mapSearchBtn');

    if (!modal || !openBtn) return;

    const defaultLat = 38.8951;
    const defaultLng = -77.0364;

    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        
        setTimeout(async () => {
            if (!googleMapInstance) {
                googleMapInstance = L.map('googleMapContainer').setView([defaultLat, defaultLng], 13);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(googleMapInstance);

                mapMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(googleMapInstance);

                const updateAddressFromCoords = async (lat, lng) => {
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await response.json();
                        if (data && data.display_name) {
                            selectedMapAddress = data.display_name;
                            mapSearchInput.value = selectedMapAddress;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                };

                googleMapInstance.on('click', async (e) => {
                    const { lat, lng } = e.latlng;
                    mapMarker.setLatLng([lat, lng]);
                    googleMapInstance.flyTo([lat, lng], 15, { duration: 1.5 });
                    await updateAddressFromCoords(lat, lng);
                });

                mapMarker.on('dragend', async (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    await updateAddressFromCoords(lat, lng);
                });

                if (searchBtn && mapSearchInput) {
                    searchBtn.addEventListener('click', async () => {
                        const query = mapSearchInput.value.trim();
                        if (!query) return;
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                            const results = await res.json();
                            if (results && results.length > 0) {
                                const lat = parseFloat(results[0].lat);
                                const lon = parseFloat(results[0].lon);
                                googleMapInstance.flyTo([lat, lon], 16, { duration: 1.8 });
                                mapMarker.setLatLng([lat, lon]);
                                selectedMapAddress = results[0].display_name;
                                mapSearchInput.value = selectedMapAddress;
                            } else {
                                alert("Location not found.");
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    });
                }
            } else {
                googleMapInstance.invalidateSize();
            }
        }, 100);
    });

    const closeModal = () => modal.classList.add('hidden');

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        if (selectedMapAddress) {
            addressInput.value = selectedMapAddress;
            validateAddressArea(selectedMapAddress);
        }
        closeModal();
    });
}

function setMinDateForService() {
    const dateInput = document.getElementById('estimateDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }
}

function getImageUrl(imageUrl) {
    if (!imageUrl || !imageUrl.trim()) {
        return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=800';
    }
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    const fixedPath = imageUrl.startsWith('/uploads/') ? `/public${imageUrl}` : imageUrl;
    return `${window.location.origin}${fixedPath}`;
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
            if (Number(service.is_active) !== 1) return;

            if (serviceSelect) {
                const opt = document.createElement('option');
                opt.value = service.id;
                const price = service.price_per_hour !== undefined ? Number(service.price_per_hour).toFixed(2) : '0.00';
                opt.textContent = `${service.name} (From $${price}/hr)`;
                serviceSelect.appendChild(opt);
            }

            if (servicesContainer) {
                const imageUrl = getImageUrl(service.image_url);
                let detailsList = [];

                try {
                    const rawDetails = service.details || service.features || service.service_features;
                    if (rawDetails) {
                        const parsed = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : rawDetails;
                        if (Array.isArray(parsed)) {
                            detailsList = parsed.map(item => {
                                if (typeof item === 'object' && item !== null) {
                                    return item.name || item.feature_name || '';
                                }
                                return String(item);
                            }).filter(Boolean);
                        }
                    }
                } catch (e) {
                    const rawDetails = service.details || service.features || '';
                    detailsList = typeof rawDetails === 'string' ? rawDetails.split(',').map(s => s.trim()).filter(Boolean) : [];
                }

                let detailsHTML = '';
                if (Array.isArray(detailsList) && detailsList.length > 0) {
                    detailsHTML = `
                        <div class="mt-4 mb-4 space-y-1.5">
                            <span class="font-label-caps text-xs text-outline uppercase tracking-wider block mb-2">INCLUDES:</span>
                            <ul class="space-y-1 text-sm text-on-surface-variant">
                                ${detailsList.map(item => `
                                    <li class="flex items-start gap-2">
                                        <span class="material-symbols-outlined text-[16px] text-primary">check</span>
                                        <span>${escapeHTML(String(item).trim())}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }

                const priceLabel = service.price_per_hour !== undefined ? `Starting at $${Number(service.price_per_hour).toFixed(0)}` : '';
                const cardDiv = document.createElement('div');
                cardDiv.className = 'bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 soft-shadow flex flex-col justify-between';
                cardDiv.innerHTML = `
                    <div>
                        <div class="relative h-[220px] rounded-xl overflow-hidden mb-6 bg-surface-container-high">
                            <img alt="${escapeHTML(service.name)}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105" src="${imageUrl}">
                        </div>
                        <h3 class="font-headline-sm text-headline-sm text-primary mb-1">${escapeHTML(service.name)}</h3>
                        <p class="font-label-caps text-accent-rust font-bold mb-3">${priceLabel}</p>
                        <p class="font-body-md text-body-md text-on-surface-variant mb-4">${escapeHTML(service.description || 'Professional cleaning service tailored to your needs.')}</p>
                        ${detailsHTML}
                    </div>
                    <div class="pt-4 border-t border-outline-variant/10">
                        <button type="button" onclick="selectServiceCard('${service.id}')" class="w-full border border-primary text-primary py-2.5 rounded font-label-caps text-label-caps hover:bg-primary hover:text-on-primary transition-colors text-center">
                            SELECT ${escapeHTML(service.name).toUpperCase()}
                        </button>
                    </div>
                `;
                servicesContainer.appendChild(cardDiv);
            }
        });
    } catch (error) {
        console.error('Error loading services:', error);
        Modal.error('Failed to load available services. Please try again later.', 'Connection Error');
    }
}

window.selectServiceCard = function (serviceId) {
    const serviceSelect = document.getElementById('estimateService');
    if (serviceSelect) {
        serviceSelect.value = serviceId;
        serviceSelect.dispatchEvent(new Event('change'));
    }
    const formSection = document.getElementById('estimateForm') || document.getElementById('hero');
    if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}

function setupEstimateForm() {
    const form = document.getElementById('estimateForm');
    const freqButtons = document.querySelectorAll('.freq-btn');
    const phoneInput = document.getElementById('clientPhone');

    if (phoneInput) {
        phoneInput.addEventListener('input', e => {
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

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const serviceAddress = document.getElementById('estimateAddress').value.trim();
        if (!validateAddressArea(serviceAddress)) {
            Modal.error('We are sorry, but we do not provide service in this area at the moment.', 'Area Not Available');
            return;
        }

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
            const timeToMinutes = t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            const selectedMinutes = timeToMinutes(preferredTime);
            if (selectedMinutes >= timeToMinutes(globalStart) && selectedMinutes <= timeToMinutes(globalEnd)) {
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

        if (blockedDays.map(Number).includes(dayOfWeek)) {
            triggerError('estimateDate', 'Selected day is blocked for this specific service. Please choose another date.');
            return;
        }

        if (service.block_time_start && service.block_time_end) {
            const timeToMinutes = t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            const selectedMinutes = timeToMinutes(preferredTime);
            if (selectedMinutes >= timeToMinutes(service.block_time_start) && selectedMinutes <= timeToMinutes(service.block_time_end)) {
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
            const finalInstructions = userNotes ? `${userNotes} | Frequency: ${selectedFrequency}` : `Booked via public site. Frequency: ${selectedFrequency}`;
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

window.submitClientRating = async function (reservationId) {
    const rating = document.getElementById(`clientRating-${reservationId}`).value;
    const notes = document.getElementById(`clientNotes-${reservationId}`).value.trim();

    try {
        await API.ratings.submitCustomerRating(reservationId, {
            customer_rating: Number(rating),
            customer_notes: notes
        });
        Modal.show({
            type: 'success',
            title: 'Thank You!',
            message: 'Your feedback has been successfully submitted.',
            confirmText: 'Done',
            showCancel: false
        });
    } catch (err) {
        console.error(err);
        Modal.error('Could not submit rating. Please try again.', 'Rating Error');
    }
};

function setupSupportWidget() {
    document.addEventListener('click', async e => {
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
            const message = encodeURIComponent('Hello LuxuriaPure Support, I need help with a cleaning service.');
            window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            return;
        }

        if (text.includes('Track My Booking')) {
            e.preventDefault();
            const step1HTML = `
                <div class="flex flex-col gap-3 pt-2" id="otpStep1">
                    <label class="text-xs sm:text-sm text-on-surface-variant font-medium">Enter your email address to receive a security PIN:</label>
                    <input type="email" id="trackingEmailInput" placeholder="jane@example.com" class="w-full input-underline text-body-md text-primary pb-2 focus:ring-0 border-b border-outline-variant/50 outline-none">
                </div>
            `;

            Modal.show({
                type: 'info',
                title: 'Secure Booking Access',
                message: 'We will send a 4-digit verification code to your email.',
                htmlContent: step1HTML,
                confirmText: 'Send Security PIN',
                showCancel: true,
                onConfirm: async () => {
                    const emailInput = document.getElementById('trackingEmailInput');
                    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

                    if (!email || !email.includes('@')) {
                        Modal.error('Please enter a valid email address.', 'Validation Error');
                        return false;
                    }

                    try {
                        await API.authCustomer.sendOtp(email);
                        const step2HTML = `
                            <div class="flex flex-col gap-3 pt-2" id="otpStep2">
                                <p class="text-xs text-emerald-600 font-medium">A 4-digit PIN has been sent to <b>${escapeHTML(email)}</b>.</p>
                                <label class="text-xs sm:text-sm text-on-surface-variant font-medium">Enter the 4-digit PIN:</label>
                                <input type="text" maxlength="4" id="trackingPinInput" placeholder="1234" class="w-full text-center tracking-widest text-xl input-underline text-body-md text-primary pb-2 focus:ring-0 border-b border-outline-variant/50 outline-none">
                            </div>
                        `;

                        Modal.show({
                            type: 'info',
                            title: 'Verify Security PIN',
                            message: 'Check your inbox and enter your code below.',
                            htmlContent: step2HTML,
                            confirmText: 'Verify & View Bookings',
                            showCancel: true,
                            onConfirm: async () => {
                                const pinInput = document.getElementById('trackingPinInput');
                                const pinCode = pinInput ? pinInput.value.trim() : '';

                                if (!pinCode || pinCode.length !== 4) {
                                    Modal.error('Please enter a valid 4-digit PIN.', 'Verification Error');
                                    return false;
                                }

                                try {
                                    const response = await API.authCustomer.verifyOtp(email, pinCode);
                                    let reservations = response.reservations || (response.data && response.data.reservations) || [];

                                    if (reservations.length > 0) {
                                        reservations.sort((a, b) => new Date(b.service_date) - new Date(a.service_date));
                                        let listHTML = `<div class="space-y-3 max-h-[350px] overflow-y-auto pr-1 mt-2 text-left">`;

                                        reservations.forEach(found => {
                                            const statusColor = found.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : found.status === 'CONFIRMED' ? 'bg-primary-fixed text-primary-container' : 'bg-tertiary-fixed text-tertiary-container';
                                            const displayPrice = Number(found.total_price || 0) > 0 ? `$${Number(found.total_price).toFixed(2)}` : 'Pending Quote';
                                            const isCompleted = found.status === 'COMPLETED';

                                            const ratingSection = isCompleted ? `
                                                <div class="mt-2 pt-2 border-t border-outline-variant/20 flex flex-col gap-1.5">
                                                    <span class="text-[11px] font-bold text-primary">Rate your Cleaner / Staff:</span>
                                                    <div class="flex items-center gap-2">
                                                        <select id="clientRating-${found.id}" class="text-xs bg-surface-container-low p-1 rounded border border-outline-variant">
                                                            <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                                                            <option value="4">⭐⭐⭐⭐ (4)</option>
                                                            <option value="3">⭐⭐⭐ (3)</option>
                                                            <option value="2">⭐⭐ (2)</option>
                                                            <option value="1">⭐ (1)</option>
                                                        </select>
                                                        <input type="text" id="clientNotes-${found.id}" placeholder="Leave a note..." class="text-xs p-1 bg-surface-container-low rounded border border-outline-variant flex-1">
                                                        <button onclick="submitClientRating(${found.id})" class="px-2.5 py-1 bg-primary text-on-primary rounded text-xs font-semibold">Send</button>
                                                    </div>
                                                </div>
                                            ` : '';

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
                                                    ${ratingSection}
                                                </div>
                                            `;
                                        });

                                        listHTML += `</div>`;

                                        Modal.show({
                                            type: 'info',
                                            title: `Verified Booking History (${reservations.length})`,
                                            message: `Authenticated successfully for: ${escapeHTML(email)}`,
                                            confirmText: 'Close',
                                            showCancel: false,
                                            htmlContent: listHTML
                                        });
                                    } else {
                                        Modal.error('No reservations were found for this email address.', 'Result');
                                    }
                                } catch (error) {
                                    console.error('Error verifying PIN:', error);
                                    Modal.error('Invalid or expired PIN code. Please try again.', 'Verification Error');
                                }
                                return false;
                            }
                        });
                    } catch (error) {
                        console.error('Error sending OTP:', error);
                        Modal.error('Could not send verification code. Please check the email address.', 'Error');
                    }
                    return false;
                }
            });
            return;
        }
    });
}