import { API } from './api.js';
import { Modal } from './modal.js';

document.addEventListener('DOMContentLoaded', () => {
    initDailyOperations();
});

async function initDailyOperations() {
    await populateDynamicFilters();
    populateDaysSelector();
    await loadReservations();
    setupFilters();
    setupClearFiltersTrigger();
}

function getLoggedUser() {
    try {
        const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user') || localStorage.getItem('user');
        if (!rawUser) return null;

        if (rawUser.trim().startsWith('{')) {
            return JSON.parse(rawUser);
        }
        return { id: rawUser, role: 'EMPLOYEE' };
    } catch (e) {
        return null;
    }
}

async function populateDynamicFilters() {
    try {
        const response = await API.reservations.getAll();
        const allReservations = Array.isArray(response) ? response : (response.data || []);
        const loggedUser = getLoggedUser();
        const isAdmin = loggedUser && loggedUser.role && loggedUser.role.toUpperCase() === 'ADMIN';

        const selects = document.querySelectorAll('select');
        const monthSelect = selects[1];
        const yearSelect = selects[2];
        const serviceSelect = selects[3];
        const statusSelect = selects[4];

        const availableMonths = new Set();
        const availableYears = new Set();
        const availableServices = new Set();
        const availableStatuses = new Set();

        const today = new Date();
        const currentYearStr = String(today.getFullYear());
        const currentMonthNum = today.getMonth() + 1;

        availableYears.add(currentYearStr);
        availableMonths.add(currentMonthNum);

        allReservations.forEach(res => {
            if (!isAdmin && loggedUser && loggedUser.id) {
                const resAssignedId = res.assigned_to || res.employee_id || res.user_id;
                if (resAssignedId && String(resAssignedId) !== String(loggedUser.id)) {
                    return;
                }
            }

            if (res.service_date) {
                const parts = res.service_date.split('-');
                if (parts.length >= 3) {
                    availableYears.add(parts[0]);
                    availableMonths.add(Number(parts[1]));
                }
            }
            if (res.service_name) {
                availableServices.add(res.service_name.trim());
            }
            if (res.status) {
                const cleanStatus = res.status.trim().toUpperCase();
                if (cleanStatus !== 'PENDING') {
                    availableStatuses.add(cleanStatus);
                }
            }
        });

        const monthNames = [
            { num: 1, name: 'January' }, { num: 2, name: 'February' },
            { num: 3, name: 'March' }, { num: 4, name: 'April' },
            { num: 5, name: 'May' }, { num: 6, name: 'June' },
            { num: 7, name: 'July' }, { num: 8, name: 'August' },
            { num: 9, name: 'September' }, { num: 10, name: 'October' },
            { num: 11, name: 'November' }, { num: 12, name: 'December' }
        ];

        if (monthSelect) {
            monthSelect.innerHTML = '<option value="all">All Months</option>';
            monthNames.forEach(m => {
                if (availableMonths.has(m.num)) {
                    monthSelect.innerHTML += `<option value="${m.name.toLowerCase()}">${m.name}</option>`;
                }
            });
            const currentMonthObj = monthNames.find(m => m.num === currentMonthNum);
            if (currentMonthObj) {
                monthSelect.value = currentMonthObj.name.toLowerCase();
            }
        }

        if (yearSelect) {
            const sortedYears = Array.from(availableYears).sort((a, b) => b - a);
            yearSelect.innerHTML = '<option value="all">All Years</option>';
            sortedYears.forEach(year => {
                yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
            });
            yearSelect.value = currentYearStr;
        }

        if (serviceSelect) {
            serviceSelect.innerHTML = '<option value="all">All Services</option>';
            availableServices.forEach(serviceName => {
                const optionValue = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                serviceSelect.innerHTML += `<option value="${optionValue}" data-raw-name="${serviceName}">${serviceName}</option>`;
            });
        }

        if (statusSelect) {
            statusSelect.innerHTML = '<option value="all">All Statuses</option>';
            availableStatuses.forEach(statusKey => {
                const formattedLabel = statusKey.replace(/_/g, ' ');
                statusSelect.innerHTML += `<option value="${statusKey}">${formattedLabel}</option>`;
            });
        }

    } catch (error) {
        console.error('Error populating dynamic filters:', error);
    }
}

function populateDaysSelector() {
    const selects = document.querySelectorAll('select');
    const daySelect = selects[0];
    const monthSelect = selects[1];
    const yearSelect = selects[2];

    if (!daySelect) return;

    const today = new Date();
    const currentDay = today.getDate();
    const year = yearSelect && yearSelect.value !== 'all' ? Number(yearSelect.value) : today.getFullYear();

    let monthIndex = today.getMonth();
    if (monthSelect && monthSelect.value && monthSelect.value !== 'all') {
        const monthNum = getMonthNumber(monthSelect.value);
        if (monthNum) monthIndex = monthNum - 1;
    }

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    daySelect.innerHTML = `
        <option value="all">All Days</option>
        <option value="${currentDay}">Today (${currentDay})</option>
    `;

    for (let d = 1; d <= daysInMonth; d++) {
        if (d !== currentDay) {
            daySelect.innerHTML += `<option value="${d}">${d}</option>`;
        }
    }

    daySelect.value = String(currentDay);
}

async function loadReservations() {
    try {
        const selects = document.querySelectorAll('select');
        const daySelect = selects[0];
        const monthSelect = selects[1];
        const yearSelect = selects[2];
        const serviceSelect = selects[3];
        const statusSelect = selects[4];

        const today = new Date();
        const currentYear = String(today.getFullYear());
        const currentMonthNum = today.getMonth() + 1;
        const currentDayNum = today.getDate();

        let queryMonth = monthSelect && monthSelect.value !== 'all' ? getMonthNumber(monthSelect.value) : currentMonthNum;
        let queryYear = yearSelect && yearSelect.value !== 'all' ? yearSelect.value : currentYear;

        let reservations = await API.reservations.getAll(queryMonth, queryYear);
        let data = Array.isArray(reservations) ? reservations : (reservations.data || []);

        const loggedUser = getLoggedUser();
        const isAdmin = loggedUser && loggedUser.role && loggedUser.role.toUpperCase() === 'ADMIN';

        let targetDay = daySelect && daySelect.value && daySelect.value !== 'all' ? Number(daySelect.value) : currentDayNum;

        let serviceId = serviceSelect && serviceSelect.value !== 'all' ? serviceSelect.value : null;
        let selectedServiceRawName = '';
        if (serviceSelect && serviceSelect.selectedOptions && serviceSelect.selectedOptions[0]) {
            selectedServiceRawName = serviceSelect.selectedOptions[0].getAttribute('data-raw-name') || serviceSelect.value;
        }

        let statusFilter = statusSelect && statusSelect.value !== 'all' ? statusSelect.value.trim().toUpperCase() : null;

        data = data.filter(res => {
            if (!res.service_date) return false;

            if (!isAdmin && loggedUser && loggedUser.id) {
                const resAssignedId = res.assigned_to ?? res.employee_id ?? res.user_id;
                if (resAssignedId !== undefined && resAssignedId !== null && String(resAssignedId) !== String(loggedUser.id)) {
                    return false;
                }
            }

            const normalizedResStatus = (res.status || '').trim().toUpperCase();

            if (normalizedResStatus === 'PENDING') {
                return false;
            }

            const [resYear, resMonth, resDay] = res.service_date.split('-').map(Number);

            if (daySelect && daySelect.value !== 'all' && resDay !== targetDay) {
                return false;
            }
            if (queryMonth && resMonth !== Number(queryMonth)) {
                return false;
            }
            if (queryYear && resYear !== Number(queryYear)) {
                return false;
            }

            if (serviceId && serviceId !== 'all') {
                const normalizedService = (res.service_name || '').toLowerCase();
                const targetService = (selectedServiceRawName || serviceId).toLowerCase();
                if (!normalizedService.includes(targetService)) {
                    return false;
                }
            }

            if (statusFilter && normalizedResStatus !== statusFilter) {
                return false;
            }

            return true;
        });

        renderReservationsTable(data);
        updateDashboardMetrics(data);

    } catch (error) {
        console.error('Error loading reservations in live query:', error);
        renderReservationsTable([]);
    }
}

function renderReservationsTable(reservations) {
    const tbody = document.querySelector('tbody.divide-y');
    let mobileContainer = document.getElementById('mobile-reservations-container');

    if (!tbody) return;
    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    if (!Array.isArray(reservations) || reservations.length === 0) {
        const emptyMsg = `
            <tr>
                <td colspan="6" class="py-8 text-center text-outline text-xs">
                    No reservations found matching the selected filters.
                </td>
            </tr>`;
        tbody.innerHTML = emptyMsg;
        if (mobileContainer) {
            mobileContainer.innerHTML = `<div class="py-8 text-center text-outline text-xs">No reservations found matching the selected filters.</div>`;
        }
        return;
    }

    reservations.forEach(res => {
        const formattedId = String(res.id || 0).padStart(4, '0');
        const initials = getInitials(res.first_name || 'N', res.last_name || 'A');
        const statusKey = (res.status || '').trim().toUpperCase();
        const statusConfig = getStatusUIConfig(statusKey);
        const statusDisplayLabel = statusKey.replace(/_/g, ' ');

        const isDisabled = statusKey === 'COMPLETED' || statusKey === 'CANCELLED';
        const disabledClass = isDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:bg-surface-container-high';
        const disabledAttr = isDisabled ? 'disabled' : '';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low/45 transition-colors cursor-pointer';
        tr.onclick = () => selectReservation(res.id);

        tr.innerHTML = `
            <td class="py-4 px-4 align-top">
                <div class="font-headline-sm text-[16px] text-on-surface font-semibold">${res.preferred_time || '08:00 AM'}</div>
                <div class="text-xs text-outline font-medium">${res.frequency || 'One-time'}</div>
            </td>
            
            <td class="py-4 px-4 align-top">
                <div class="font-label-caps text-[11px] text-accent-rust tracking-wider uppercase">#RES-${formattedId}</div>
                <div class="flex items-center gap-2 mt-1">
                    <div class="w-7 h-7 rounded-full bg-primary-fixed text-on-primary-fixed font-bold text-xs flex items-center justify-center">
                        ${initials}
                    </div>
                    <div>
                        <div class="font-body-md text-body-md font-semibold text-on-surface leading-tight">
                            ${res.first_name || 'No Name'} ${res.last_name || ''}
                        </div>
                        <div class="text-xs text-outline">${res.phone_number || 'No Phone'}</div>
                    </div>
                </div>
            </td>

            <td class="py-4 px-4 align-top max-w-[200px]">
                <div class="font-medium text-xs text-on-surface">${res.service_name || 'General Service'}</div>
                <div class="text-xs text-outline truncate mt-0.5">${res.service_address || 'No Address'}</div>
            </td>

            <td class="py-4 px-4 align-top">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.class}">
                    <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                    ${statusDisplayLabel}
                </span>
            </td>

            <td class="py-4 px-4 align-top">
                <div class="flex items-center justify-center gap-1">
                    <button ${disabledAttr} onclick="event.stopPropagation(); updateStatus(${res.id}, 'ON_THE_WAY')" class="p-1.5 rounded bg-surface-container ${disabledClass} text-on-surface transition-colors" title="${isDisabled ? 'Action Disabled' : 'Mark On The Way'}">
                        <span class="material-symbols-outlined text-[16px]">local_shipping</span>
                    </button>
                    <button ${disabledAttr} onclick="event.stopPropagation(); updateStatus(${res.id}, 'INITIATED')" class="p-1.5 rounded bg-surface-container ${disabledClass} text-on-surface transition-colors" title="${isDisabled ? 'Action Disabled' : 'Mark Initiated'}">
                        <span class="material-symbols-outlined text-[16px]">play_arrow</span>
                    </button>
                    <button ${disabledAttr} onclick="event.stopPropagation(); updateStatus(${res.id}, 'COMPLETED')" class="p-1.5 rounded bg-surface-container ${disabledClass} text-on-surface transition-colors" title="${isDisabled ? 'Action Disabled' : 'Mark Completed'}">
                        <span class="material-symbols-outlined text-[16px]">check_circle</span>
                    </button>
                </div>
            </td>

            <td class="py-4 px-4 align-top text-right">
                <button class="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
                    <span class="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        if (mobileContainer) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'p-4 space-y-3 hover:bg-surface-warm/50 transition-colors border-b border-outline-variant/20 cursor-pointer';
            cardDiv.onclick = () => selectReservation(res.id);

            cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-label-caps text-xs text-accent-rust uppercase font-semibold">#RES-${formattedId}</span>
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig.class}">
                        <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                        ${statusDisplayLabel}
                    </span>
                </div>

                <div class="flex items-center space-x-3 pt-1">
                    <div class="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed font-bold text-xs flex items-center justify-center shrink-0">
                        ${initials}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-primary text-sm truncate">${res.first_name || 'No Name'} ${res.last_name || ''}</p>
                        <p class="text-outline text-xs">${res.phone_number || 'No Phone'}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="font-headline-sm text-sm font-semibold text-on-surface">${res.preferred_time || '08:00 AM'}</div>
                        <div class="text-[11px] text-outline">${res.frequency || 'One-time'}</div>
                    </div>
                </div>

                <div class="text-xs pt-2 border-t border-outline-variant/10 space-y-1">
                    <p class="font-medium text-on-surface">${res.service_name || 'General Service'}</p>
                    <p class="text-outline truncate">${res.service_address || 'No Address'}</p>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                    <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                        <button ${disabledAttr} onclick="updateStatus(${res.id}, 'ON_THE_WAY')" class="p-2 rounded bg-surface-container ${disabledClass} text-on-surface transition-colors" title="Mark On The Way">
                            <span class="material-symbols-outlined text-[16px]">local_shipping</span>
                        </button>
                        <button ${disabledAttr} onclick="updateStatus(${res.id}, 'INITIATED')" class="p-2 rounded bg-surface-container ${disabledClass} text-on-surface transition-colors" title="Mark Initiated">
                            <span class="material-symbols-outlined text-[16px]">play_arrow</span>
                        </button>
                        <button ${disabledAttr} onclick="updateStatus(${res.id}, 'COMPLETED')" class="p-2 rounded bg-surface-container ${disabledClass} text-on-surface transition-colors" title="Mark Completed">
                            <span class="material-symbols-outlined text-[16px]">check_circle</span>
                        </button>
                    </div>
                    <span class="text-xs font-semibold text-primary flex items-center gap-1">
                        <span>Details</span>
                        <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                    </span>
                </div>
            `;
            mobileContainer.appendChild(cardDiv);
        }
    });
}

window.selectReservation = async function (id) {
    try {
        const response = await API.reservations.getById(id);
        const res = response && response.data ? response.data : response;
        if (!res) return;

        const detailsPanel = document.querySelector('.xl\\:col-span-4');
        if (!detailsPanel) return;

        const resId = res.id || res.reservation_id || 0;
        const formattedId = String(resId).padStart(4, '0');

        const firstName = res.first_name || res.nombre || res.client_name || 'No';
        const lastName = res.last_name || res.apellido || '';
        const initials = getInitials(firstName, lastName);

        const phone = res.phone_number || res.telefono || res.phone || 'No Phone';
        const totalPrice = res.total_price || res.precio_total || res.total || '0.00';

        const serviceName = res.service_name || res.nombre_servicio || 'General Service';
        const serviceDate = res.service_date || res.fecha_servicio || 'N/A';
        const preferredTime = res.preferred_time || res.hora || '08:00 AM';
        const serviceAddress = res.service_address || res.direccion || 'No Address Provided';
        const instructions = res.special_instructions || res.notas || res.observaciones || 'No additional instructions provided.';

        const statusKey = (res.status || res.estado || 'INITIATED').trim().toUpperCase();
        const statusConfig = getStatusUIConfig(statusKey);
        const statusDisplayLabel = statusKey.replace(/_/g, ' ');

        const isInitiated = statusKey === 'INITIATED';
        const disabledClass = isInitiated ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed pointer-events-none';
        const disabledAttr = isInitiated ? '' : 'disabled';
        const buttonText = isInitiated ? 'Mark Completed & Notify Customer' : 'Service Not Initiated';

        detailsPanel.innerHTML = `
            <div class="flex items-start justify-between pb-4 bg-surface-container-low/30 -mx-6 -mt-6 p-6 rounded-t-xl">
                <div>
                    <span class="font-label-caps text-label-caps uppercase text-accent-rust">Detail</span>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface mt-1">#RES-${formattedId}</h3>
                    <p class="text-xs text-outline mt-0.5">Booked via System Database</p>
                </div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.class}">
                    <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse"></span>
                    ${statusDisplayLabel}
                </span>
            </div>

            <div class="space-y-3">
                <span class="font-label-caps text-label-caps uppercase text-outline">Customer & Access</span>
                <div class="flex items-center gap-3 p-3.5 rounded-lg bg-surface-container-low">
                    <div class="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed font-bold text-sm flex items-center justify-center flex-shrink-0">
                        ${initials}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-body-md text-body-md font-semibold text-on-surface truncate">${firstName} ${lastName}</div>
                        <div class="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                            <span class="material-symbols-outlined text-[14px]">call</span>
                            <span>${phone}</span>
                        </div>
                    </div>
                    <div class="px-2.5 py-1 bg-surface-container rounded text-center">
                        <div class="text-[10px] uppercase font-semibold text-outline">Total</div>
                        <div class="text-xs font-bold text-on-surface">$${totalPrice}</div>
                    </div>
                </div>
            </div>

            <div class="space-y-3">
                <span class="font-label-caps text-label-caps uppercase text-outline">Sanctuary Specifications</span>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between py-1.5 bg-surface-container-low/50 px-3 rounded">
                        <span class="text-outline">Service Tier</span>
                        <span class="font-semibold text-on-surface">${serviceName}</span>
                    </div>
                    <div class="flex justify-between py-1.5 bg-surface-container-low/50 px-3 rounded">
                        <span class="text-outline">Scheduled Window</span>
                        <span class="font-semibold text-on-surface">${serviceDate} • ${preferredTime}</span>
                    </div>
                    <div class="flex flex-col py-2 bg-surface-container-low/50 px-3 rounded space-y-1">
                        <span class="text-outline">Address</span>
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(serviceAddress)}" target="_blank" rel="noopener noreferrer" class="flex items-start gap-1.5 text-on-surface font-semibold hover:text-accent-rust transition-colors group" title="Open in Google Maps">
                            <span class="material-symbols-outlined text-[16px] text-accent-rust flex-shrink-0 group-hover:scale-110 transition-transform">location_on</span>
                            <span class="underline underline-offset-2">${serviceAddress}</span>
                        </a>
                    </div>
                </div>
            </div>

            <div class="p-3.5 rounded-lg bg-surface-container-low space-y-1.5">
                <div class="flex items-center gap-1 text-xs font-semibold text-accent-rust">
                    <span class="material-symbols-outlined text-[16px]">pets</span>
                    <span>Residence Notes</span>
                </div>
                <p class="text-xs text-on-surface-variant leading-relaxed">
                    "${instructions}"
                </p>
            </div>

            <div class="pt-2">
                <button ${disabledAttr} onclick="updateStatus(${resId}, 'COMPLETED')" class="w-full py-3 rounded-lg bg-primary text-on-primary font-label-caps text-label-caps tracking-wider flex items-center justify-center gap-2 ${disabledClass} shadow-sm transition-all" id="complete-btn-detail">
                    <span class="material-symbols-outlined text-[18px]">verified</span>
                    <span>${buttonText}</span>
                </button>
                <p class="text-[11px] text-center text-outline mt-2">Sends standardized departure status update.</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading reservation details:', error);
    }
}

window.updateStatus = async function (id, newStatus) {
    if (newStatus === 'COMPLETED') {
        showCompletionRatingModal(id);
        return;
    }

    try {
        const loggedUser = getLoggedUser();
        await API.reservations.update(id, { 
            status: newStatus,
            user_id: loggedUser ? loggedUser.id : null 
        });
        await loadReservations();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Could not update status.');
    }
};

function showCompletionRatingModal(reservationId) {
    const modalContent = `
        <div class="space-y-4 text-left pt-2">
            <div>
                <label class="block text-xs font-semibold text-outline uppercase mb-1">Rate the Customer / Service Experience (1 - 5 Stars)</label>
                <select id="modalStaffRating" class="w-full bg-surface-container-low p-2 rounded border border-outline-variant text-on-surface">
                    <option value="5">⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                    <option value="4">⭐⭐⭐⭐ (4 - Very Good)</option>
                    <option value="3">⭐⭐⭐ (3 - Average)</option>
                    <option value="2">⭐⭐ (2 - Below Expectations)</option>
                    <option value="1">⭐ (1 - Poor)</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-semibold text-outline uppercase mb-1">Staff Notes / Observations (Optional)</label>
                <textarea id="modalStaffNotes" rows="3" placeholder="Add any details about the property, client cooperation, or special conditions..." class="w-full bg-surface-container-low p-2 rounded border border-outline-variant text-on-surface text-sm"></textarea>
            </div>
        </div>
    `;

    Modal.show({
        type: 'info',
        title: 'Complete Reservation & Review',
        message: 'Please provide your final evaluation before closing this service ticket.',
        htmlContent: modalContent,
        confirmText: 'Submit & Complete',
        showCancel: true,
        onConfirm: async () => {
            const rating = document.getElementById('modalStaffRating').value;
            const notes = document.getElementById('modalStaffNotes').value.trim();
            const loggedUser = getLoggedUser();

            try {
                await API.reservations.update(reservationId, { 
                    status: 'COMPLETED',
                    user_id: loggedUser ? loggedUser.id : null 
                });

                try {
                    await API.ratings.submitStaffRating(reservationId, {
                        staff_rating: Number(rating),
                        staff_notes: notes,
                        staff_id: loggedUser ? loggedUser.id : null
                    });
                } catch (ratingErr) {
                    console.warn('Could not save rating via endpoint:', ratingErr);
                }

                Modal.close();
                await loadReservations();

                const detailsPanel = document.querySelector('.xl\\:col-span-4');
                if (detailsPanel) {
                    detailsPanel.innerHTML = `<div class="text-center py-10 text-outline text-xs">Select a reservation to view details.</div>`;
                }
            } catch (error) {
                console.error('Error completing reservation:', error);
                alert('An error occurred while completing the reservation.');
            }
            return false;
        }
    });
}

function setupFilters() {
    const selects = document.querySelectorAll('select');
    selects.forEach((select, index) => {
        select.addEventListener('change', () => {
            if (index === 1 || index === 2) {
                populateDaysSelector();
            }
            loadReservations();
        });
    });
}

function setupClearFiltersTrigger() {
    const clearButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
        btn.textContent.includes('Clear filters') || btn.querySelector('.material-symbols-outlined')?.textContent === 'restart_alt'
    );

    clearButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            populateDynamicFilters();
            populateDaysSelector();
            loadReservations();

            const detailsPanel = document.querySelector('.xl\\:col-span-4');
            if (detailsPanel) {
                detailsPanel.innerHTML = `
                    <div class="text-center py-10 text-outline text-xs">
                        Select a reservation to view details.
                    </div>
                `;
            }
        });
    });
}

function getMonthNumber(monthName) {
    const months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
    };
    return months[monthName.toLowerCase()] || new Date().getMonth() + 1;
}

function getInitials(firstName = '', lastName = '') {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getStatusUIConfig(status) {
    const s = (status || '').trim().toUpperCase();
    switch (s) {
        case 'CONFIRMED':
            return { class: 'bg-primary-fixed text-primary-container' };
        case 'INITIATED':
            return { class: 'bg-blue-100 text-blue-800' };
        case 'ON_THE_WAY':
            return { class: 'bg-amber-100 text-amber-800' };
        case 'RESCHEDULED':
            return { class: 'bg-purple-100 text-purple-800' };
        case 'COMPLETED':
            return { class: 'bg-emerald-100 text-emerald-800' };
        case 'CANCELLED':
            return { class: 'bg-error-container text-on-error-container' };
        case 'REJECTED':
            return { class: 'bg-surface-variant text-on-surface-variant border border-outline-variant/55' };
        default:
            return { class: 'bg-surface-container text-on-surface-variant' };
    }
}

function updateDashboardMetrics(reservations) {
    if (!Array.isArray(reservations)) return;

    const total = reservations.length;
    const pendingCount = reservations.filter(res => {
        const s = (res.status || '').trim().toUpperCase();
        return s === 'CONFIRMED';
    }).length;

    const activeCount = reservations.filter(res => {
        const s = (res.status || '').trim().toUpperCase();
        return s === 'INITIATED' || s === 'ON_THE_WAY';
    }).length;

    const completedCount = reservations.filter(res => {
        const s = (res.status || '').trim().toUpperCase();
        return s === 'COMPLETED';
    }).length;

    const elTotal = document.getElementById('metric-total');
    const elPending = document.getElementById('metric-pending');
    const elActive = document.getElementById('metric-active');
    const elCompleted = document.getElementById('metric-completed');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pendingCount;
    if (elActive) elActive.textContent = activeCount;
    if (elCompleted) elCompleted.textContent = completedCount;
}