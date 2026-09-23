import { API } from './api.js';
import { Modal } from './modal.js';

let currentDate = new Date();
let globalReservations = [];
let globalBlockedDates = [];
let globalStaffList = [];
let currentFilter = 'ALL';
let activeSelectedCell = null;
let currentReservationId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadSystemScheduleData();
    await loadStaffList();
    await loadCalendarData();
    setupEventListeners();
});

async function loadSystemScheduleData() {
    try {
        const response = await API.systemSchedule.get();
        if (!response) return;
        const data = response.data || response;
        let rawDates = data.blocked_specific_dates || [];
        if (typeof rawDates === 'string') {
            try { rawDates = JSON.parse(rawDates); } catch (e) { rawDates = []; }
        }
        globalBlockedDates = Array.isArray(rawDates) ? rawDates : [];
    } catch (error) {
        console.error('Error loading system schedule restrictions:', error);
        globalBlockedDates = [];
    }
}

async function loadStaffList() {
    try {
        const response = await API.admins.getAll();
        let staffList = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            staffList = response.data || response.admins || [];
        }
        globalStaffList = Array.isArray(staffList) ? staffList : [];
    } catch (e) {
        console.error('Error loading staff list for mapping:', e);
        globalStaffList = [];
    }
}

async function loadCalendarData() {
    try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        const response = await API.reservations.getAll(month, year);

        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.reservations || [];
        }

        globalReservations = Array.isArray(rawData) ? rawData : [];

        renderCalendar();
        renderAgenda();
    } catch (error) {
        console.error('Error loading calendar data:', error);
        globalReservations = [];
    }
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthTitleEl = document.querySelector('section h3.font-headline-sm');
    if (monthTitleEl) {
        monthTitleEl.textContent = `${monthNames[month]} ${year}`;
    }

    const legendContainer = document.querySelector('section div.px-6.lg\\:p-0.flex.flex-wrap.gap-4');
    if (legendContainer) {
        legendContainer.innerHTML = `
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-tertiary-fixed-dim"></span><span class="text-on-surface-variant">Pending</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-primary-fixed-dim"></span><span class="text-on-surface-variant">Confirmed</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-blue-300"></span><span class="text-on-surface-variant">Initiated/Way</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-purple-300"></span><span class="text-on-surface-variant">Rescheduled</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-300"></span><span class="text-on-surface-variant">Completed</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-error-container"></span><span class="text-on-surface-variant">Cancelled/Rejected</span></div>
        `;
    }

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const calendarGrid = document.querySelectorAll('section .grid-cols-7')[1];
    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';

    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('div');
        blank.className = 'aspect-square p-2 rounded-lg bg-transparent';
        calendarGrid.appendChild(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        const isSystemBlocked = globalBlockedDates.includes(dateKey);
        const dayReservations = globalReservations.filter(r => r.service_date === dateKey);
        const totalCount = dayReservations.length;

        const dayCell = document.createElement('div');

        let badgeHTML = '';
        let cellClass = 'aspect-square p-1 md:p-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest hover:border-primary cursor-pointer transition-colors flex flex-col justify-between group day-slot overflow-hidden';

        if (isSystemBlocked) {
            cellClass = 'aspect-square p-1 md:p-2 rounded-lg border border-outline-variant/30 bg-surface-dim opacity-75 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:border-error transition-colors';
            badgeHTML = `<div class="w-full bg-error-container text-on-error-container text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Blocked</div>`;
        } else if (totalCount > 0) {
            if (totalCount === 1) {
                const singleRes = dayReservations[0];
                const status = singleRes.status;
                if (status === 'CONFIRMED') {
                    cellClass = 'aspect-square p-1 md:p-2 rounded-lg bg-primary-fixed-dim border border-primary-fixed hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
                    badgeHTML = `<div class="w-full bg-primary-container text-on-primary-container text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Confirmed</div>`;
                } else if (status === 'PENDING') {
                    cellClass = 'aspect-square p-1 md:p-2 rounded-lg bg-surface-container-lowest border border-tertiary-fixed-dim hover:border-tertiary-container cursor-pointer transition-colors flex flex-col justify-between relative day-slot overflow-hidden';
                    badgeHTML = `<div class="w-full bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Pending</div>`;
                } else if (status === 'COMPLETED') {
                    cellClass = 'aspect-square p-1 md:p-2 rounded-lg bg-emerald-50 border border-emerald-300 hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
                    badgeHTML = `<div class="w-full bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Completed</div>`;
                } else if (status === 'INITIATED' || status === 'ON_THE_WAY') {
                    cellClass = 'aspect-square p-1 md:p-2 rounded-lg bg-blue-50 border border-blue-300 hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
                    badgeHTML = `<div class="w-full bg-blue-100 text-blue-800 text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">${status.replace(/_/g, ' ')}</div>`;
                } else if (status === 'RESCHEDULED') {
                    cellClass = 'aspect-square p-1 md:p-2 rounded-lg bg-purple-50 border border-purple-300 hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
                    badgeHTML = `<div class="w-full bg-purple-100 text-purple-800 text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Rescheduled</div>`;
                } else {
                    cellClass = 'aspect-square p-1 md:p-2 rounded-lg bg-error-container/20 border border-error/40 hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
                    badgeHTML = `<div class="w-full bg-error-container text-on-error-container text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">${status}</div>`;
                }
            } else {
                badgeHTML = `
                <div class="w-full bg-surface-variant text-on-surface-variant text-[10px] font-bold px-1 py-0.5 rounded-sm truncate mt-auto flex items-center justify-between">
                    <span>${totalCount} Res.</span>
                </div>`;
            }
        }

        dayCell.className = cellClass;
        let bgPattern = isSystemBlocked ? `<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9Ij4KPHJlY3Qgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0jZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+')] opacity-20 pointer-events-none"></div>` : '';

        dayCell.innerHTML = `
            ${bgPattern}
            <span class="font-body-md text-xs md:text-sm text-on-surface z-10">${day}</span>
            ${badgeHTML}
        `;

        dayCell.addEventListener('click', (e) => {
            highlightSelectedDay(e.currentTarget);
            filterAgendaByDate(dateKey);

            if (isSystemBlocked) {
                promptToggleBlockDate(dateKey, true);
            } else if (dayReservations.length > 0) {
                if (dayReservations.length === 1) {
                    openReservationDetailModal(dayReservations[0]);
                } else {
                    showMobileDayAgendaModal(dateKey, dayReservations);
                }
            } else {
                promptToggleBlockDate(dateKey, false);
            }
        });

        calendarGrid.appendChild(dayCell);
    }
}

function promptToggleBlockDate(dateStr, isAlreadyBlocked) {
    const actionText = isAlreadyBlocked ? 'Unblock this date in the system?' : 'Block this date globally in the system?';
    Modal.show({
        type: isAlreadyBlocked ? 'info' : 'warning',
        title: `Manage Date: ${dateStr}`,
        message: actionText,
        confirmText: isAlreadyBlocked ? 'Unblock Date' : 'Block Date',
        showCancel: true,
        onConfirm: async () => {
            if (isAlreadyBlocked) {
                globalBlockedDates = globalBlockedDates.filter(d => d !== dateStr);
            } else {
                if (!globalBlockedDates.includes(dateStr)) {
                    globalBlockedDates.push(dateStr);
                    globalBlockedDates.sort();
                }
            }

            try {
                await API.systemSchedule.save({ blocked_specific_dates: globalBlockedDates });
                await loadCalendarData();
                Modal.success(`Date ${dateStr} successfully updated.`, 'System Schedule');
            } catch (err) {
                Modal.error(err.message || 'Failed to update system schedule restrictions.', 'Error');
            }
        }
    });
}

async function openReservationDetailModal(res) {
    currentReservationId = res.id;
    const modal = document.createElement('div');
    modal.id = 'dynamic-reservation-detail-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';

    modal.innerHTML = `
        <div class="relative bg-surface-container-lowest w-full max-w-4xl rounded-xl soft-shadow overflow-hidden flex flex-col max-h-[90vh]">
            <header class="px-8 py-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-warm">
                <div class="flex items-center gap-4">
                    <h2 class="font-headline-sm text-headline-sm text-primary">Reservation #RES-${String(res.id).padStart(4, '0')}</h2>
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-label-caps ${getStatusBadgeClass(res.status)}">${res.status}</span>
                </div>
                <button class="text-outline hover:text-primary transition-colors" id="close-dyn-modal">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </header>
            <div class="flex-1 overflow-y-auto p-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="flex flex-col gap-6">
                        <h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Customer Details</h3>
                        <div class="flex flex-col gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Full Name</label>
                                <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${escapeHTML(res.first_name || res.customer_name || '')}">
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Email Address</label>
                                <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="email" value="${escapeHTML(res.email || '')}">
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Phone Number</label>
                                <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="tel" value="${escapeHTML(res.phone_number || '')}">
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Service Address</label>
                                <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${escapeHTML(res.service_address || '')}">
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col gap-6">
                        <h3 class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Booking Details</h3>
                        <div class="flex flex-col gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Service Type</label>
                                <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${escapeHTML(res.service_name || 'Standard Cleaning')}">
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Assigned Staff</label>
                                <div class="flex gap-2">
                                    <select id="dyn-modal-staff" class="flex-1 px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface focus:border-primary focus:ring-0 transition-all font-body-md text-on-surface">
                                        <option value="">-- Unassigned --</option>
                                    </select>
                                    <button id="dyn-modal-btn-assign-staff" class="px-4 py-3 rounded-lg border border-primary bg-primary text-on-primary font-label-caps text-label-caps hover:bg-primary/90 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                        <span class="material-symbols-outlined text-sm">person_add</span> Assign
                                    </button>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-2">
                                    <label class="text-xs font-label-caps text-outline uppercase">Bedrooms</label>
                                    <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${res.bedrooms !== undefined ? res.bedrooms : 'N/A'}">
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-xs font-label-caps text-outline uppercase">Bathrooms</label>
                                    <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${res.bathrooms !== undefined ? res.bathrooms : 'N/A'}">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-2">
                                    <label class="text-xs font-label-caps text-outline uppercase">Frequency</label>
                                    <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${escapeHTML(res.frequency || 'One-time')}">
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-xs font-label-caps text-outline uppercase">Total Price</label>
                                    <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md font-bold text-primary" type="text" value="${res.total_price ? '$' + Number(res.total_price).toFixed(2) : 'Pending Quote'}">
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-label-caps text-outline uppercase">Date & Time</label>
                                <input class="pointer-events-none w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface-bright font-body-md" type="text" value="${res.service_date} @ ${res.preferred_time || '09:00 AM'}">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-12 pt-8 border-t border-outline-variant/30 flex flex-wrap gap-4">
                    <div class="w-full flex flex-col gap-4">
                        <div id="modal-action-inputs" class="flex flex-col gap-3 p-4 rounded-xl bg-surface-variant/30 border border-outline-variant/30 hidden">
                            <div id="price-input-wrapper" class="flex flex-col gap-1.5 hidden">
                                <label class="text-xs font-label-caps text-primary font-bold uppercase">Set Real Price ($)</label>
                                <input type="number" step="0.01" id="modal-input-price" placeholder="e.g. 150.00" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface focus:border-primary focus:ring-0 font-body-md" value="${res.total_price || ''}">
                            </div>
                            <div id="reschedule-input-wrapper" class="flex flex-col gap-1.5 hidden">
                                <label class="text-xs font-label-caps text-gold font-bold uppercase">Select New Date & Time</label>
                                <input type="datetime-local" id="modal-input-reschedule-datetime" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface focus:border-primary focus:ring-0 font-body-md">
                            </div>
                            <div id="reason-input-wrapper" class="flex flex-col gap-1.5 hidden">
                                <label class="text-xs font-label-caps text-error font-bold uppercase">Rejected Reason / Notes</label>
                                <textarea id="modal-input-reason" placeholder="Explain why the service is being cancelled..." class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface focus:border-primary focus:ring-0 font-body-md resize-none" rows="2"></textarea>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-3 justify-end">
                            <button id="dyn-modal-btn-quote" class="px-5 py-2.5 rounded-lg border border-primary-fixed bg-primary-fixed text-primary-container font-label-caps text-label-caps hover:bg-primary-fixed/80 transition-all flex items-center justify-center gap-2 cursor-pointer"><span class="material-symbols-outlined text-sm">payments</span> Set Price & Quote</button>
                            <button id="dyn-modal-btn-reschedule" class="flex-1 md:flex-none px-6 py-3 rounded-lg border border-outline-variant/50 bg-surface-container text-navy font-label-caps text-label-caps hover:bg-surface-variant transition-all flex items-center justify-center gap-2 cursor-pointer"><span class="material-symbols-outlined text-sm">event_repeat</span> Reschedule Service</button>
                            <button id="dyn-modal-btn-reject" class="px-5 py-2.5 rounded-lg border border-error/30 text-error font-label-caps text-label-caps hover:bg-error-container transition-all flex items-center justify-center gap-2 cursor-pointer"><span class="material-symbols-outlined text-sm">cancel</span> Rejected Service</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#close-dyn-modal');
    closeBtn.addEventListener('click', () => modal.remove());

    const staffSelect = modal.querySelector('#dyn-modal-staff');
    if (staffSelect) {
        staffSelect.innerHTML = '<option value="">-- Unassigned --</option>';
        if (Array.isArray(globalStaffList)) {
            globalStaffList.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.name} (${u.role || 'STAFF'})`;
                staffSelect.appendChild(opt);
            });
        }
        staffSelect.value = res.staff_id || res.admin_id || "";
    }

    setupDynModalActions(modal, res);
}

function setupDynModalActions(modal, res) {
    const btnQuote = modal.querySelector('#dyn-modal-btn-quote');
    const btnReschedule = modal.querySelector('#dyn-modal-btn-reschedule');
    const btnReject = modal.querySelector('#dyn-modal-btn-reject');
    const btnAssignStaff = modal.querySelector('#dyn-modal-btn-assign-staff');

    const container = modal.querySelector('#modal-action-inputs');
    const pWrapper = modal.querySelector('#price-input-wrapper');
    const rWrapper = modal.querySelector('#reason-input-wrapper');
    const resWrapper = modal.querySelector('#reschedule-input-wrapper');

    let activeAction = null;

    if (btnAssignStaff) {
        btnAssignStaff.addEventListener('click', async () => {
            const staffIdVal = modal.querySelector('#dyn-modal-staff')?.value;
            modal.remove();
            await updateReservationAction(res.id, res.status, {
                staff_id: staffIdVal ? Number(staffIdVal) : null,
                comment: staffIdVal ? `Assigned staff ID ${staffIdVal}` : 'Staff unassigned'
            });
        });
    }

    btnQuote.addEventListener('click', async () => {
        if (activeAction !== 'quote') {
            activeAction = 'quote';
            container.classList.remove('hidden');
            pWrapper.classList.remove('hidden');
            rWrapper.classList.add('hidden');
            resWrapper.classList.add('hidden');
            btnQuote.innerHTML = '<span class="material-symbols-outlined text-sm">send</span> Send Quote & Notify';
            return;
        }

        const priceVal = modal.querySelector('#modal-input-price').value;
        if (!priceVal || Number(priceVal) <= 0) {
            Modal.error('Please enter a valid price greater than $0.00.', 'Validation Error');
            return;
        }

        const staffIdVal = modal.querySelector('#dyn-modal-staff')?.value;
        modal.remove();
        await updateReservationAction(res.id, res.status, {
            total_price: Number(priceVal),
            staff_id: staffIdVal ? Number(staffIdVal) : null,
            comment: `Admin assigned/updated total price to $${Number(priceVal).toFixed(2)}`
        });
    });

    btnReschedule.addEventListener('click', async () => {
        if (activeAction !== 'reschedule') {
            activeAction = 'reschedule';
            container.classList.remove('hidden');
            resWrapper.classList.remove('hidden');
            pWrapper.classList.add('hidden');
            rWrapper.classList.add('hidden');
            btnReschedule.innerHTML = '<span class="material-symbols-outlined text-sm">send</span> Confirm Reschedule';
            return;
        }

        const dtVal = modal.querySelector('#modal-input-reschedule-datetime').value;
        if (!dtVal) {
            Modal.error('Please select a new date and time for the reservation.', 'Validation Error');
            return;
        }

        const [datePart, timePart] = dtVal.split('T');
        const serviceDate = datePart;
        const preferredTime = timePart ? (timePart.length === 5 ? timePart + ':00' : timePart) : '09:00:00';
        const staffIdVal = modal.querySelector('#dyn-modal-staff')?.value;

        modal.remove();
        await updateReservationAction(res.id, 'RESCHEDULED', {
            service_date: serviceDate,
            preferred_time: preferredTime,
            staff_id: staffIdVal ? Number(staffIdVal) : null,
            comment: `Rescheduled by admin to ${serviceDate} at ${preferredTime}`
        });
    });

    btnReject.addEventListener('click', async () => {
        if (activeAction !== 'reject') {
            activeAction = 'reject';
            container.classList.remove('hidden');
            rWrapper.classList.remove('hidden');
            pWrapper.classList.add('hidden');
            resWrapper.classList.add('hidden');
            btnReject.innerHTML = '<span class="material-symbols-outlined text-sm">send</span> Confirm Rejection';
            return;
        }

        const reasonVal = modal.querySelector('#modal-input-reason').value.trim();
        if (!reasonVal) {
            Modal.error('Please provide a reason for cancelling the service.', 'Validation Error');
            return;
        }

        const staffIdVal = modal.querySelector('#dyn-modal-staff')?.value;
        modal.remove();
        await updateReservationAction(res.id, 'REJECTED', {
            staff_id: staffIdVal ? Number(staffIdVal) : null,
            comment: `Cancelled by admin. Reason: ${reasonVal}`
        });
    });
}

async function updateReservationAction(targetId, newStatus, extraData = {}) {
    try {
        const rawUser = localStorage.getItem('luxuriapure_user') || localStorage.getItem('purenest_user');
        const user = (rawUser && rawUser !== 'undefined') ? JSON.parse(rawUser) : {};
        const currentUserId = user.id || null;

        await API.reservations.update(targetId, {
            status: newStatus,
            user_id: currentUserId,
            ...extraData
        });

        await loadCalendarData();
        Modal.success('Reservation updated successfully and email notification sent.', 'Success');
    } catch (err) {
        Modal.error(err.message || 'Failed to update reservation status.', 'Update Error');
    }
}

function buildAgendaItemCard(res) {
    const item = document.createElement('div');
    item.className = 'p-4 rounded-lg border border-outline-variant/30 bg-surface hover:shadow-md transition-all cursor-pointer relative overflow-hidden';

    let indicatorColor = 'bg-surface-variant';
    let badgeClasses = 'bg-surface-variant text-on-surface';

    if (res.status === 'CONFIRMED') {
        indicatorColor = 'bg-primary-fixed-dim';
        badgeClasses = 'bg-primary-fixed-dim/20 text-on-primary-fixed-variant';
    } else if (res.status === 'PENDING') {
        indicatorColor = 'bg-tertiary-fixed-dim';
        badgeClasses = 'bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant';
    } else if (res.status === 'COMPLETED') {
        indicatorColor = 'bg-emerald-400';
        badgeClasses = 'bg-emerald-100 text-emerald-800';
    } else if (res.status === 'INITIATED' || res.status === 'ON_THE_WAY') {
        indicatorColor = 'bg-blue-400';
        badgeClasses = 'bg-blue-100 text-blue-800';
    } else if (res.status === 'RESCHEDULED') {
        indicatorColor = 'bg-purple-400';
        badgeClasses = 'bg-purple-100 text-purple-800';
    } else if (res.status === 'CANCELLED' || res.status === 'REJECTED') {
        indicatorColor = 'bg-error';
        badgeClasses = 'bg-error-container text-on-error-container';
    }

    const dateHeader = formatDateHeader(res.service_date);
    const timeRange = formatTimeRange(res.preferred_time);

    const sId = res.staff_id || res.admin_id;
    let foundStaffName = res.staff_name || res.admin_name || res.assigned_staff_name;

    if (!foundStaffName && sId && globalStaffList.length > 0) {
        const matchedStaff = globalStaffList.find(st => Number(st.id) === Number(sId));
        if (matchedStaff) {
            foundStaffName = matchedStaff.name;
        }
    }

    const hasStaff = foundStaffName || sId;
    const staffDisplay = hasStaff 
        ? `<span class="text-primary font-medium">Assigned: ${escapeHTML(foundStaffName || 'Staff ID #' + sId)}</span>` 
        : `<span class="text-error">Unassigned</span>`;

    const iconHtml = hasStaff 
        ? '<span class="material-symbols-outlined text-[16px] text-primary">person</span>' 
        : '<span class="material-symbols-outlined text-[16px] text-error">warning</span>';

    item.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}"></div>
        <div class="pl-3">
            <div class="flex justify-between items-start mb-2">
                <p class="font-label-caps text-[10px] text-on-surface-variant">${dateHeader}</p>
                <span class="px-2 py-0.5 ${badgeClasses} rounded text-[10px] font-bold uppercase tracking-wider">${res.status}</span>
            </div>
            <h4 class="font-body-md font-medium text-on-surface mb-1">${escapeHTML(res.service_name || 'Standard Cleaning')}</h4>
            <p class="font-body-md text-sm text-on-surface-variant mb-2">${timeRange}</p>
            <div class="flex items-center gap-2 text-xs">
                ${iconHtml}
                <span class="font-body-md text-xs text-on-surface-variant">${staffDisplay}</span>
            </div>
        </div>
    `;

    item.addEventListener('click', () => openReservationDetailModal(res));
    return item;
}

function highlightSelectedDay(cellElement) {
    if (activeSelectedCell) {
        activeSelectedCell.classList.remove('ring-4', 'ring-primary', 'ring-offset-2');
    }
    activeSelectedCell = cellElement;
    activeSelectedCell.classList.add('ring-4', 'ring-primary', 'ring-offset-2');
}

function renderAgenda(filteredList = null) {
    const agendaContainer = document.querySelector('section.flex-col .space-y-4');
    if (!agendaContainer) return;

    agendaContainer.className = 'space-y-4 overflow-y-auto max-h-[600px] flex-1 pr-2 scrollbar-thin';
    agendaContainer.innerHTML = '';

    let list = filteredList || globalReservations;

    if (currentFilter !== 'ALL') {
        if (currentFilter === 'CANCELLED') {
            list = list.filter(r => r.status === 'CANCELLED' || r.status === 'REJECTED');
        } else {
            list = list.filter(r => r.status === currentFilter);
        }
    }

    if (list.length === 0) {
        agendaContainer.innerHTML = `
            <div class="p-6 text-center text-on-surface-variant font-body-md">
                No reservations found for this selection.
            </div>
        `;
        return;
    }

    list.forEach(res => {
        const item = buildAgendaItemCard(res);
        agendaContainer.appendChild(item);
    });
}

function showMobileDayAgendaModal(dateStr, reservations) {
    const formattedDate = formatDateHeader(dateStr);
    let itemsHTML = `<div class="space-y-3 max-h-[350px] overflow-y-auto pr-1 mt-2">`;
    reservations.forEach(res => {
        itemsHTML += `
            <div class="p-3 rounded-lg border border-outline-variant/30 bg-surface flex flex-col gap-1 text-left cursor-pointer hover:bg-surface-variant/30" onclick="window.triggerModalStatusFromMobile(${res.id})">
                <div class="flex justify-between items-center">
                    <span class="text-[11px] font-bold text-primary">${escapeHTML(res.service_name || 'Standard Cleaning')}</span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase">${res.status}</span>
                </div>
                <span class="text-xs text-on-surface-variant">${formatTimeRange(res.preferred_time)}</span>
            </div>
        `;
    });
    itemsHTML += `</div>`;

    window.triggerModalStatusFromMobile = (id) => {
        Modal.close();
        const res = globalReservations.find(r => r.id === id);
        if (res) openReservationDetailModal(res);
    };

    Modal.show({
        type: 'info',
        title: `Reservations (${formattedDate})`,
        message: `Total: ${reservations.length} service(s) scheduled.`,
        confirmText: 'Close',
        showCancel: false,
        htmlContent: itemsHTML
    });
}

function setupEventListeners() {
    const headerButtons = document.querySelectorAll('section div.flex.items-center.gap-4 button');
    if (headerButtons.length >= 2) {
        headerButtons[0].addEventListener('click', async () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            activeSelectedCell = null;
            await loadCalendarData();
        });

        headerButtons[1].addEventListener('click', async () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            activeSelectedCell = null;
            await loadCalendarData();
        });
    }

    const filterContainer = document.querySelector('section.flex-col .overflow-x-auto');
    if (filterContainer) {
        filterContainer.innerHTML = `
            <button class="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-caps text-[10px] whitespace-nowrap">All</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">Pending</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">Confirmed</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">Initiated</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">On The Way</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">Rescheduled</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">Completed</button>
            <button class="px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors">Cancelled</button>
        `;

        const filterPills = filterContainer.querySelectorAll('button');
        filterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                filterPills.forEach(p => {
                    p.className = 'px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors';
                });

                e.currentTarget.className = 'px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-caps text-[10px] whitespace-nowrap';
                currentFilter = e.currentTarget.textContent.trim().toUpperCase().replace(/\s+/g, '_');

                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const monthlyReservations = globalReservations.filter(r => {
                    if (!r.service_date) return false;
                    const [resYear, resMonth] = r.service_date.split('-').map(Number);
                    return resYear === year && (resMonth - 1) === month;
                });

                renderAgenda(monthlyReservations);
            });
        });
    }
}

function filterAgendaByDate(dateStr) {
    const filtered = globalReservations.filter(r => r.service_date === dateStr);
    renderAgenda(filtered);
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

function formatDateHeader(dateStr) {
    if (!dateStr) return 'SEP 00, 2026';
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function formatTimeRange(timeStr) {
    if (!timeStr) return '10:00 AM - 2:00 PM';
    const start = new Date(`2000-01-01T${timeStr}`);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    return `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}