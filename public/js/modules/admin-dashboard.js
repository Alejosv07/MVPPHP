import { API } from './api.js';
import { Modal } from './modal.js';

let currentReservationId = null;
let globalReservations = [];

document.addEventListener('DOMContentLoaded', async () => {
    const rawUser = localStorage.getItem('purenest_user');
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
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const recentReservations = reservations.slice(0, 5);

    recentReservations.forEach(res => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-outline-variant/20 hover:bg-surface-warm transition-colors';

        const customerName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || 'Guest Customer';
        const serviceName = res.service_name || 'Standard Premium Cleaning';
        const formattedDate = formatDate(res.service_date, res.preferred_time);

        tr.innerHTML = `
            <td class="px-8 py-5 text-on-surface-variant font-medium">#RES-${String(res.id).padStart(4, '0')}</td>
            <td class="px-8 py-5 text-primary font-semibold">${escapeHTML(customerName)}</td>
            <td class="px-8 py-5 text-on-surface-variant">${escapeHTML(serviceName)}</td>
            <td class="px-8 py-5 text-on-surface-variant">${formattedDate}</td>
            <td class="px-8 py-5">${getStatusBadge(res.status)}</td>
            <td class="px-8 py-5 text-right flex justify-end gap-4">
                <button class="text-outline hover:text-primary transition-colors btn-view" title="View" data-id="${res.id}">
                    <span class="material-symbols-outlined text-[20px]">visibility</span>
                </button>
                <button class="text-primary-container hover:text-primary transition-colors btn-confirm ${res.status !== 'PENDING' ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}" title="Confirm" data-id="${res.id}">
                    <span class="material-symbols-outlined text-[20px]">check</span>
                </button>
                <button class="text-outline hover:text-primary transition-colors btn-edit" title="Edit" data-id="${res.id}">
                    <span class="material-symbols-outlined text-[20px]">edit</span>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    attachTableEvents(tbody);
}

function attachTableEvents(tbody) {
    tbody.querySelectorAll('.btn-view, .btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const isEdit = e.currentTarget.classList.contains('btn-edit');
            if (id) {
                if (isEdit) {
                    window.location.href = `admin-reservation.html?id=${id}`;
                } else {
                    openModal(id);
                }
            }
        });
    });

    tbody.querySelectorAll('.btn-confirm').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (!id) return;
            await handleQuickStatusUpdate(id, 'CONFIRMED');
        });
    });
}

function setupModalListeners() {
    const modal = document.getElementById('reservation-modal');
    if (!modal) return;

    modal.querySelectorAll('[btn-close]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    const actionButtons = modal.querySelectorAll('.mt-12 button');
    if (actionButtons.length >= 5) {
        actionButtons[0].addEventListener('click', () => updateModalStatus('CONFIRMED'));
        actionButtons[1].addEventListener('click', () => updateModalStatus('PENDING'));
        actionButtons[2].addEventListener('click', () => updateModalStatus('COMPLETED'));
        actionButtons[3].addEventListener('click', () => updateModalStatus('REJECTED'));
        actionButtons[4].addEventListener('click', () => updateModalStatus('CANCELLED'));
    }
}

async function openModal(id) {
    const modal = document.getElementById('reservation-modal');
    const res = globalReservations.find(r => String(r.id) === String(id));
    if (!modal || !res) return;

    currentReservationId = res.id;
    modal.dataset.reservationId = res.id;

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

    if (inputName) inputName.value = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || '';
    if (inputEmail) inputEmail.value = res.email || '';
    if (inputPhone) inputPhone.value = res.phone_number || '';
    if (inputAddress) inputAddress.value = res.service_address || '';
    if (inputBedrooms) inputBedrooms.value = res.bedrooms !== undefined ? `${res.bedrooms} Bedroom(s)` : 'N/A';
    if (inputBathrooms) inputBathrooms.value = res.bathrooms !== undefined ? `${res.bathrooms} Bathroom(s)` : 'N/A';
    if (inputFrequency) inputFrequency.value = res.frequency || 'One-time';
    if (inputPrice) inputPrice.value = res.total_price ? `$${Number(res.total_price).toFixed(2)}` : '$0.00';
    if (inputDatetime) inputDatetime.value = `${res.service_date}T${res.preferred_time || '09:00'}`;
    if (textareaNotes) textareaNotes.value = res.special_instructions || '';

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

async function updateModalStatus(newStatus) {
    const modal = document.getElementById('reservation-modal');
    const targetId = currentReservationId || modal?.dataset?.reservationId;

    if (!targetId) {
        Modal.error('Reservation ID is missing.', 'Error');
        return;
    }

    closeModal();
    await handleQuickStatusUpdate(targetId, newStatus);
}

async function handleQuickStatusUpdate(id, newStatus) {
    try {
        await API.reservations.update(id, { status: newStatus });

        await loadDashboardData();

        Modal.success(`Reservation status updated to ${newStatus}.`, 'Success');
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
        case 'COMPLETED': return 'bg-emerald-100 text-emerald-800';
        case 'CANCELLED': return 'bg-error-container text-on-error-container';
        case 'REJECTED': return 'bg-surface-variant text-on-surface-variant border border-outline-variant/50';
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