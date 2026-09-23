import { API } from './api.js';
import { Modal } from './modal.js';

let currentReservationId = null;
let globalReservations = [];

document.addEventListener('DOMContentLoaded', async () => {
    const rawUser = localStorage.getItem('luxuriapure_user') || localStorage.getItem('purenest_user');
    const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
    const headerTitle = document.querySelector('header h1');
    if (headerTitle && user.name) {
        headerTitle.textContent = `Good morning, ${user.name.split(' ')[0]}.`;
    }

    await loadDashboardData();
    setupModalListeners();
});

async function loadDashboardData() {
    let reservations = [];
    let services = [];

    try {
        reservations = await API.reservations.getAll();
        if (reservations && typeof reservations === 'object' && !Array.isArray(reservations)) {
            reservations = reservations.data || reservations.reservations || [];
        }
    } catch (error) {
        console.error('Error loading reservations:', error);
    }

    try {
        services = await API.services.getAll();
        if (services && typeof services === 'object' && !Array.isArray(services)) {
            services = services.data || services.services || [];
        }
    } catch (error) {
        console.error('Error loading services:', error);
    }

    globalReservations = Array.isArray(reservations) ? reservations : [];

    updateCounters(globalReservations, Array.isArray(services) ? services : []);
    renderRecentReservationsTable(globalReservations);
}

function updateCounters(reservations, services) {
    const todayStr = new Date().toISOString().split('T')[0];

    const todayCount = reservations.filter(r => r.service_date === todayStr).length;
    const pendingCount = reservations.filter(r => r.status === 'PENDING').length;
    const confirmedCount = reservations.filter(r => r.status === 'CONFIRMED').length;
    const activeServicesCount = services.filter(s => Number(s.is_active) === 1).length;

    const cards = document.querySelectorAll('section.grid > div');
    if (cards.length >= 4) {
        cards[0].querySelector('.text-display-lg-mobile').textContent = todayCount;
        cards[1].querySelector('.text-display-lg-mobile').textContent = pendingCount;
        cards[2].querySelector('.text-display-lg-mobile').textContent = confirmedCount;
        cards[3].querySelector('.text-display-lg-mobile').textContent = activeServicesCount;
    }
}

function renderRecentReservationsTable(reservations) {
    const recentReservations = reservations.slice(0, 5);

    // 1. Renderizar Vista de Escritorio (Tabla)
    const tbody = document.querySelector('table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        recentReservations.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-outline-variant/20 hover:bg-surface-warm transition-colors';

            const customerName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || 'Guest Customer';
            const serviceName = res.service_name || 'Standard Premium Cleaning';
            const formattedDate = formatDate(res.service_date, res.preferred_time);
            const staffDisplay = res.staff_name ? `<span class="text-primary font-medium">${escapeHTML(res.staff_name)}</span>` : `<span class="text-outline text-xs italic">Unassigned</span>`;

            tr.innerHTML = `
                <td class="px-8 py-5 text-on-surface-variant font-medium">#RES-${String(res.id).padStart(4, '0')}</td>
                <td class="px-8 py-5 text-primary font-semibold">${escapeHTML(customerName)}</td>
                <td class="px-8 py-5 text-on-surface-variant">${escapeHTML(serviceName)}</td>
                <td class="px-8 py-5 text-on-surface-variant">${staffDisplay}</td>
                <td class="px-8 py-5 text-on-surface-variant">${formattedDate}</td>
                <td class="px-8 py-5">${getStatusBadge(res.status)}</td>
                <td class="px-8 py-5 text-right flex justify-end gap-4">
                    <button class="text-outline hover:text-primary transition-colors btn-view" title="View & Quote" data-id="${res.id}">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        attachTableEvents(tbody);
    }

    // 2. Renderizar Vista Móvil (Tarjetas Adaptativas)
    let mobileContainer = document.getElementById('mobile-reservations-container');

    // Si el contenedor móvil no existe en el HTML aún, lo creamos dinámicamente justo antes de la tabla
    if (!mobileContainer) {
        const tableWrapper = document.querySelector('section .overflow-x-auto');
        if (tableWrapper) {
            mobileContainer = document.createElement('div');
            mobileContainer.id = 'mobile-reservations-container';
            mobileContainer.className = 'block md:hidden divide-y divide-outline-variant/20 bg-surface/30';
            tableWrapper.parentNode.insertBefore(mobileContainer, tableWrapper);

            // Asegurar que la tabla clásica solo se vea en desktop
            const parentTableDiv = tableWrapper;
            parentTableDiv.classList.add('hidden', 'md:block');
        }
    }

    if (mobileContainer) {
        mobileContainer.innerHTML = '';
        recentReservations.forEach(res => {
            const customerName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || 'Guest Customer';
            const serviceName = res.service_name || 'Standard Premium Cleaning';
            const formattedDate = formatDate(res.service_date, res.preferred_time);
            const staffDisplay = res.staff_name ? `<span class="text-primary font-medium">${escapeHTML(res.staff_name)}</span>` : `<span class="text-outline text-xs italic">Unassigned</span>`;

            const cardDiv = document.createElement('div');
            cardDiv.className = 'p-5 space-y-4 hover:bg-surface-warm/50 transition-colors';
            cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-medium text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md">#RES-${String(res.id).padStart(4, '0')}</span>
                    <div>${getStatusBadge(res.status)}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Customer</span>
                        <span class="font-semibold text-primary">${escapeHTML(customerName)}</span>
                    </div>
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Service</span>
                        <span class="text-on-surface">${escapeHTML(serviceName)}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-sm pt-1 border-t border-outline-variant/10">
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Staff Assigned</span>
                        <span class="text-xs">${staffDisplay}</span>
                    </div>
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Date</span>
                        <span class="text-on-surface-variant text-xs">${formattedDate}</span>
                    </div>
                </div>

                <div class="pt-2 flex justify-end">
                    <button class="w-full py-2.5 px-4 rounded-lg bg-surface-container text-primary font-label-caps text-xs flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-all btn-view" data-id="${res.id}">
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                        <span>View Details & Quote</span>
                    </button>
                </div>
            `;
            mobileContainer.appendChild(cardDiv);
        });
        attachTableEvents(mobileContainer);
    }
}

function attachTableEvents(tbody) {
    tbody.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (id) {
                openModal(id);
            }
        });
    });
}

function setupModalListeners() {
    const modal = document.getElementById('reservation-modal');
    if (!modal) return;

    modal.querySelectorAll('[btn-close]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    const btnAssignStaff = document.getElementById('modal-btn-assign-staff');
    if (btnAssignStaff) {
        btnAssignStaff.addEventListener('click', async () => {
            const staffIdVal = document.getElementById('modal-staff')?.value;
            const targetModal = document.getElementById('reservation-modal');
            const targetId = currentReservationId || targetModal?.dataset?.reservationId;

            if (!targetId) return;

            const currentRes = globalReservations.find(r => String(r.id) === String(targetId));
            const currentStatus = currentRes ? currentRes.status : 'PENDING';

            closeModal();

            await updateModalStatusWithDetails(targetId, currentStatus, {
                staff_id: staffIdVal ? Number(staffIdVal) : null,
                comment: staffIdVal ? `Assigned staff ID ${staffIdVal}` : 'Staff unassigned'
            });
        });
    }

    const btnQuoteAction = document.getElementById('modal-btn-quote-action');
    const btnRescheduleAction = document.getElementById('modal-btn-reschedule-action');
    const btnCancelAction = document.getElementById('modal-btn-reject-action');

    let activeActionMode = null;

    if (btnQuoteAction) {
        const newBtnQuote = btnQuoteAction.cloneNode(true);
        btnQuoteAction.parentNode.replaceChild(newBtnQuote, btnQuoteAction);

        newBtnQuote.addEventListener('click', async () => {
            const container = document.getElementById('modal-action-inputs');
            const pWrapper = document.getElementById('price-input-wrapper');
            const rWrapper = document.getElementById('reason-input-wrapper');
            const resWrapper = document.getElementById('reschedule-input-wrapper');

            if (activeActionMode !== 'quote') {
                activeActionMode = 'quote';
                container.classList.remove('hidden');
                pWrapper.classList.remove('hidden');
                rWrapper.classList.add('hidden');
                resWrapper.classList.add('hidden');

                const priceInput = document.getElementById('modal-input-price');
                if (priceInput) priceInput.focus();

                newBtnQuote.innerHTML = '<span class="material-symbols-outlined text-sm">send</span> Send Quote & Notify';
                return;
            }

            const priceVal = document.getElementById('modal-input-price').value;
            if (!priceVal || Number(priceVal) <= 0) {
                Modal.error('Please enter a valid price greater than $0.00.', 'Validation Error');
                return;
            }

            const staffIdVal = document.getElementById('modal-staff')?.value;
            const targetModal = document.getElementById('reservation-modal');
            const targetId = currentReservationId || targetModal?.dataset?.reservationId;

            const currentRes = globalReservations.find(r => String(r.id) === String(targetId));
            const currentStatus = currentRes ? currentRes.status : 'PENDING';

            closeModal();
            activeActionMode = null;
            container.classList.add('hidden');
            pWrapper.classList.add('hidden');
            newBtnQuote.innerHTML = '<span class="material-symbols-outlined text-sm">payments</span> Set Price & Quote';

            await updateModalStatusWithDetails(targetId, currentStatus, {
                total_price: Number(priceVal),
                staff_id: staffIdVal ? Number(staffIdVal) : null,
                comment: `Admin assigned/updated total price to $${Number(priceVal).toFixed(2)}`
            });
        });
    }

    if (btnRescheduleAction) {
        const newBtnReschedule = btnRescheduleAction.cloneNode(true);
        btnRescheduleAction.parentNode.replaceChild(newBtnReschedule, btnRescheduleAction);

        newBtnReschedule.addEventListener('click', async () => {
            const container = document.getElementById('modal-action-inputs');
            const pWrapper = document.getElementById('price-input-wrapper');
            const rWrapper = document.getElementById('reason-input-wrapper');
            const resWrapper = document.getElementById('reschedule-input-wrapper');

            if (activeActionMode !== 'reschedule') {
                activeActionMode = 'reschedule';
                container.classList.remove('hidden');
                resWrapper.classList.remove('hidden');
                pWrapper.classList.add('hidden');
                rWrapper.classList.add('hidden');

                const rescheduleInput = document.getElementById('modal-input-reschedule-datetime');
                if (rescheduleInput) {
                    const currentDatetime = document.getElementById('modal-datetime')?.value;
                    if (currentDatetime) rescheduleInput.value = currentDatetime;
                    rescheduleInput.focus();
                }

                newBtnReschedule.innerHTML = '<span class="material-symbols-outlined text-sm">send</span> Confirm Reschedule';
                return;
            }

            const datetimeInput = document.getElementById('modal-input-reschedule-datetime').value;
            if (!datetimeInput) {
                Modal.error('Please select a new date and time for the reservation.', 'Validation Error');
                return;
            }

            const [datePart, timePart] = datetimeInput.split('T');
            const serviceDate = datePart;
            const preferredTime = timePart ? (timePart.length === 5 ? timePart + ':00' : timePart) : '09:00:00';
            const staffIdVal = document.getElementById('modal-staff')?.value;

            const targetModal = document.getElementById('reservation-modal');
            const targetId = currentReservationId || targetModal?.dataset?.reservationId;

            closeModal();
            activeActionMode = null;
            container.classList.add('hidden');
            resWrapper.classList.add('hidden');
            newBtnReschedule.innerHTML = '<span class="material-symbols-outlined text-sm">event_repeat</span> Reschedule Service';

            await updateModalStatusWithDetails(targetId, 'RESCHEDULED', {
                service_date: serviceDate,
                preferred_time: preferredTime,
                staff_id: staffIdVal ? Number(staffIdVal) : null,
                comment: `Rescheduled by admin to ${serviceDate} at ${preferredTime}`
            });
        });
    }

    if (btnCancelAction) {
        const newBtnCancel = btnCancelAction.cloneNode(true);
        btnCancelAction.parentNode.replaceChild(newBtnCancel, btnCancelAction);

        newBtnCancel.addEventListener('click', async () => {
            const container = document.getElementById('modal-action-inputs');
            const pWrapper = document.getElementById('price-input-wrapper');
            const rWrapper = document.getElementById('reason-input-wrapper');
            const resWrapper = document.getElementById('reschedule-input-wrapper');

            if (activeActionMode !== 'cancel') {
                activeActionMode = 'cancel';
                container.classList.remove('hidden');
                rWrapper.classList.remove('hidden');
                pWrapper.classList.add('hidden');
                resWrapper.classList.add('hidden');

                const reasonInput = document.getElementById('modal-input-reason');
                if (reasonInput) reasonInput.focus();

                newBtnCancel.innerHTML = '<span class="material-symbols-outlined text-sm">send</span> Confirm Rejected';
                return;
            }

            const reasonVal = document.getElementById('modal-input-reason').value.trim();
            if (!reasonVal) {
                Modal.error('Please provide a reason for cancelling the service.', 'Validation Error');
                return;
            }

            const staffIdVal = document.getElementById('modal-staff')?.value;
            const targetModal = document.getElementById('reservation-modal');
            const targetId = currentReservationId || targetModal?.dataset?.reservationId;

            closeModal();
            activeActionMode = null;
            container.classList.add('hidden');
            rWrapper.classList.add('hidden');
            newBtnCancel.innerHTML = '<span class="material-symbols-outlined text-sm">cancel</span> Rejected Service';

            await updateModalStatusWithDetails(targetId, 'REJECTED', {
                staff_id: staffIdVal ? Number(staffIdVal) : null,
                comment: `Cancelled by admin. Reason: ${reasonVal}`
            });
        });
    }
}

async function openModal(id) {
    const modal = document.getElementById('reservation-modal');
    const res = globalReservations.find(r => String(r.id) === String(id));
    if (!modal || !res) return;

    currentReservationId = res.id;
    modal.dataset.reservationId = res.id;

    const container = document.getElementById('modal-action-inputs');
    if (container) container.classList.add('hidden');

    const btnQuote = document.getElementById('modal-btn-quote-action');
    if (btnQuote) btnQuote.innerHTML = '<span class="material-symbols-outlined text-sm">payments</span> Set Price & Quote';

    const btnReschedule = document.getElementById('modal-btn-reschedule-action');
    if (btnReschedule) btnReschedule.innerHTML = '<span class="material-symbols-outlined text-sm">event_repeat</span> Reschedule Service';

    const btnCancel = document.getElementById('modal-btn-reject-action');
    if (btnCancel) btnCancel.innerHTML = '<span class="material-symbols-outlined text-sm">cancel</span> Rejected Service';

    const titleEl = modal.querySelector('header h2');
    if (titleEl) titleEl.textContent = `Reservation #RES-${String(res.id).padStart(4, '0')}`;

    const headerStatus = modal.querySelector('header span');
    if (headerStatus) {
        headerStatus.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-label-caps ${getStatusBadgeClass(res.status)}`;
        headerStatus.textContent = res.status;
    }

    const inputName = document.getElementById('modal-fullname');
    const inputEmail = document.getElementById('modal-email');
    const inputPhone = document.getElementById('modal-phone');
    const inputAddress = document.getElementById('modal-address');
    const inputBedrooms = document.getElementById('modal-bedrooms');
    const inputBathrooms = document.getElementById('modal-bathrooms');
    const inputFrequency = document.getElementById('modal-frequency');
    const inputPrice = document.getElementById('modal-price');
    const inputDatetime = document.getElementById('modal-datetime');
    const textareaNotes = document.getElementById('modal-notes');
    const inputModalPriceSet = document.getElementById('modal-input-price');

    if (inputName) inputName.value = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || '';
    if (inputEmail) inputEmail.value = res.email || '';
    if (inputPhone) inputPhone.value = res.phone_number || '';
    if (inputAddress) inputAddress.value = res.service_address || '';
    if (inputBedrooms) inputBedrooms.value = res.bedrooms !== undefined ? `${res.bedrooms} Bedroom(s)` : 'N/A';
    if (inputBathrooms) inputBathrooms.value = res.bathrooms !== undefined ? `${res.bathrooms} Bathroom(s)` : 'N/A';
    if (inputFrequency) inputFrequency.value = res.frequency || 'One-time';
    if (inputPrice) inputPrice.value = res.total_price && Number(res.total_price) > 0 ? `$${Number(res.total_price).toFixed(2)}` : 'Pending Quote';
    if (inputModalPriceSet) inputModalPriceSet.value = res.total_price && Number(res.total_price) > 0 ? res.total_price : '';
    if (inputDatetime) inputDatetime.value = `${res.service_date}T${res.preferred_time ? res.preferred_time.substring(0, 5) : '09:00'}`;
    if (textareaNotes) textareaNotes.value = res.special_instructions || '';

    const staffSelect = document.getElementById('modal-staff');
    if (staffSelect) {
        try {
            if (!staffSelect.dataset.loaded) {
                const response = await API.admins.getAll();
                let staffList = response;
                if (response && typeof response === 'object' && !Array.isArray(response)) {
                    staffList = response.data || response.admins || [];
                }
                staffSelect.innerHTML = '<option value="">-- Unassigned --</option>';
                if (Array.isArray(staffList)) {
                    staffList.forEach(u => {
                        const opt = document.createElement('option');
                        opt.value = u.id;
                        opt.textContent = `${u.name} (${u.role || 'STAFF'})`;
                        staffSelect.appendChild(opt);
                    });
                }
                staffSelect.dataset.loaded = "true";
            }
        } catch (e) {
            console.error('Error loading staff list:', e);
        }
        staffSelect.value = res.staff_id || "";
    }

    const serviceSelect = document.getElementById('modal-service');
    if (serviceSelect) {
        try {
            if (!serviceSelect.dataset.loaded) {
                const response = await API.services.getAll();
                let rawServices = response;
                if (response && typeof response === 'object' && !Array.isArray(response)) {
                    rawServices = response.data || response.services || [];
                }
                const servicesArray = Array.isArray(rawServices) ? rawServices : [];

                serviceSelect.innerHTML = '';
                servicesArray.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    serviceSelect.appendChild(opt);
                });
                serviceSelect.dataset.loaded = "true";
            }
        } catch (e) {
            console.error(e);
        }

        let matched = false;
        for (let i = 0; i < serviceSelect.options.length; i++) {
            const opt = serviceSelect.options[i];
            if (String(opt.value) === String(res.service_id) || opt.text.trim().toLowerCase() === (res.service_name || '').trim().toLowerCase()) {
                serviceSelect.selectedIndex = i;
                matched = true;
                break;
            }
        }

        if (!matched && res.service_name) {
            const newOpt = document.createElement('option');
            newOpt.value = res.service_id || 'custom';
            newOpt.textContent = res.service_name;
            newOpt.selected = true;
            serviceSelect.appendChild(newOpt);
        }
    }

    modal.classList.remove('hidden', 'pointer-events-none');
}

function closeModal() {
    const modal = document.getElementById('reservation-modal');
    if (modal) {
        modal.classList.add('hidden', 'pointer-events-none');
        delete modal.dataset.reservationId;
    }
    currentReservationId = null;
}

async function updateModalStatusWithDetails(targetId, newStatus, extraData = {}) {
    if (!targetId) {
        Modal.error('Reservation ID is missing.', 'Error');
        return;
    }

    try {
        const rawUser = localStorage.getItem('luxuriapure_user') || localStorage.getItem('purenest_user');
        const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
        const currentUserId = user.id || null;

        await API.reservations.update(targetId, {
            status: newStatus,
            user_id: currentUserId,
            ...extraData
        });

        await loadDashboardData();
        Modal.success('Reservation updated successfully and email notification sent.', 'Success');
    } catch (err) {
        Modal.error(err.message || 'Failed to update reservation status.', 'Update Error');
    }
}

function getStatusBadge(status) {
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-label-caps tracking-wide ${getStatusBadgeClass(status)}">${status}</span>`;
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'PENDING': return 'bg-tertiary-fixed text-tertiary-container';
        case 'CONFIRMED': return 'bg-primary-fixed text-primary-container';
        case 'INITIATED': return 'bg-blue-100 text-blue-800';
        case 'ON_THE_WAY': return 'bg-amber-100 text-amber-800';
        case 'RESCHEDULED': return 'bg-purple-100 text-purple-800';
        case 'COMPLETED': return 'bg-emerald-100 text-emerald-800';
        case 'CANCELLED': return 'bg-error-container text-on-error-container';
        case 'REJECTED': return 'bg-surface-variant text-on-surface-variant border border-outline-variant/55';
        default: return 'bg-surface-variant text-on-surface-variant';
    }
}

function formatDate(dateStr, timeStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        (timeStr ? `, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '');
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}