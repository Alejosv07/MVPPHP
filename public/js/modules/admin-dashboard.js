import { API } from './api.js';
import { Modal } from './modal.js';
import { renderReservationActions, statusBadge, statusBadgeClass, formatDateTime, STATUS_LABELS } from './reservation-actions.js';

let currentReservationId = null;
let globalReservations = [];

document.addEventListener('DOMContentLoaded', async () => {
    const rawUser = localStorage.getItem('luxuriapure_user') || localStorage.getItem('purenest_user');
    const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
    const headerTitle = document.querySelector('header h1');
    if (headerTitle && user.name) {
        headerTitle.textContent = `Hi, ${user.name.split(' ')[0]}.`;
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
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const todayCount = reservations.filter(r => r.service_date === todayStr).length;
    // Needs the office: requests without a quote and date changes waiting for confirmation
    const pendingCount = reservations.filter(r => r.status === 'PENDING' || r.status === 'RESCHEDULED').length;
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

let globalStaffList = null;

function setupModalListeners() {
    const modal = document.getElementById('reservation-modal');
    if (!modal) return;
    modal.querySelectorAll('[btn-close]').forEach(btn => btn.addEventListener('click', closeModal));
}

async function getStaffList() {
    if (globalStaffList) return globalStaffList;
    try {
        const response = await API.admins.getAll();
        const list = Array.isArray(response) ? response : (response?.data || response?.admins || []);
        globalStaffList = Array.isArray(list) ? list : [];
    } catch (e) {
        console.error('Error loading staff list:', e);
        globalStaffList = [];
    }
    return globalStaffList;
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
        headerStatus.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-label-caps ${statusBadgeClass(res.status)}`;
        headerStatus.textContent = STATUS_LABELS[res.status] || res.status;
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
    if (inputPrice) inputPrice.value = res.total_price && Number(res.total_price) > 0 ? `$${Number(res.total_price).toFixed(2)}` : 'Pending Quote';
    if (inputDatetime) inputDatetime.value = formatDateTime(res.service_date, res.preferred_time);
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

    renderReservationActions(document.getElementById('modal-actions'), res, {
        staffList: await getStaffList(),
        onDone: async (message) => {
            closeModal();
            await loadDashboardData();
            Modal.success(message || 'Reservation updated.', 'Done');
        },
    });

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

function getStatusBadge(status) {
    return statusBadge(status);
}

function formatDate(dateStr, timeStr) {
    return formatDateTime(dateStr, timeStr);
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}