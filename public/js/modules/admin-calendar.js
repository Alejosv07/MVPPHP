import { API } from './api.js';
import { Modal } from './modal.js';

let currentDate = new Date();
let globalReservations = [];
let currentFilter = 'ALL';
let activeSelectedCell = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCalendarData();
    setupEventListeners();
});

async function loadCalendarData() {
    try {
        const response = await API.reservations.getAll();

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

        const dayReservations = globalReservations.filter(r => r.service_date === dateKey);
        const hasConfirmed = dayReservations.some(r => r.status === 'CONFIRMED');
        const hasPending = dayReservations.some(r => r.status === 'PENDING');
        const hasCompleted = dayReservations.some(r => r.status === 'COMPLETED');
        const totalCount = dayReservations.length;

        const dayCell = document.createElement('div');

        let badgeHTML = '';
        if (totalCount > 0) {
            if (totalCount === 1) {
                const singleRes = dayReservations[0];
                if (singleRes.status === 'CONFIRMED') {
                    badgeHTML = `<div class="w-full bg-primary-container text-on-primary-container text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Confirmed</div>`;
                } else if (singleRes.status === 'PENDING') {
                    badgeHTML = `<div class="w-full bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Pending</div>`;
                } else if (singleRes.status === 'COMPLETED') {
                    badgeHTML = `<div class="w-full bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">Completed</div>`;
                } else {
                    badgeHTML = `<div class="w-full bg-error-container text-on-error-container text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded-sm truncate mt-auto">${singleRes.status}</div>`;
                }
            } else {
                badgeHTML = `
                    <div class="w-full bg-surface-variant text-on-surface-variant text-[10px] font-bold px-1 py-0.5 rounded-sm truncate mt-auto flex items-center justify-between">
                        <span>${totalCount} Res.</span>
                    </div>`;
            }
        }

        // Estilos de celda según estado prioritario
        if (hasConfirmed && totalCount === 1) {
            dayCell.className = 'aspect-square p-2 rounded-lg bg-primary-fixed-dim border border-primary-fixed hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
        } else if (hasPending && totalCount === 1) {
            dayCell.className = 'aspect-square p-2 rounded-lg bg-surface-container-lowest border border-tertiary-fixed-dim hover:border-tertiary-container cursor-pointer transition-colors flex flex-col justify-between relative day-slot overflow-hidden';
        } else if (hasCompleted && totalCount === 1) {
            dayCell.className = 'aspect-square p-2 rounded-lg bg-emerald-50 border border-emerald-300 hover:brightness-95 cursor-pointer transition-all flex flex-col justify-between shadow-sm relative day-slot overflow-hidden';
        } else {
            dayCell.className = 'aspect-square p-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest hover:border-primary cursor-pointer transition-colors flex flex-col justify-between group day-slot overflow-hidden';
        }

        dayCell.innerHTML = `
            <span class="font-body-md text-on-surface">${day}</span>
            ${badgeHTML}
        `;

        dayCell.addEventListener('click', (e) => {
            highlightSelectedDay(e.currentTarget);
            filterAgendaByDate(dateKey);

            if (window.innerWidth < 768) {
                showMobileDayAgendaModal(dateKey, dayReservations);
            }
        });

        calendarGrid.appendChild(dayCell);
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
    } else if (res.status === 'CANCELLED' || res.status === 'REJECTED') {
        indicatorColor = 'bg-error';
        badgeClasses = 'bg-error-container text-on-error-container';
    }

    const dateHeader = formatDateHeader(res.service_date);
    const timeRange = formatTimeRange(res.preferred_time);
    
    item.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}"></div>
        <div class="pl-3">
            <div class="flex justify-between items-start mb-2">
                <p class="font-label-caps text-[10px] text-on-surface-variant">${dateHeader}</p>
                <span class="px-2 py-0.5 ${badgeClasses} rounded text-[10px] font-bold uppercase tracking-wider">${res.status}</span>
            </div>
            <h4 class="font-body-md font-medium text-on-surface mb-1">${escapeHTML(res.service_name || 'Standard Cleaning')}</h4>
            <p class="font-body-md text-sm text-on-surface-variant mb-2">${timeRange}</p>
        </div>
    `;

    item.addEventListener('click', () => openStatusModal(res));
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
        list = list.filter(r => r.status === currentFilter);
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

    if (reservations.length === 0) {
        Modal.show({
            type: 'info',
            title: `Schedule for ${formattedDate}`,
            message: 'No reservations booked for this day.',
            confirmText: 'Close',
            showCancel: false
        });
        return;
    }

    let itemsHTML = `<div class="space-y-3 max-h-[350px] overflow-y-auto pr-1 mt-2">`;
    reservations.forEach(res => {
        const isConfirmed = res.status === 'CONFIRMED';
        const badgeClasses = isConfirmed ? 'bg-primary-fixed-dim/20 text-on-primary-fixed-variant' : 'bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant';
        itemsHTML += `
            <div class="p-3 rounded-lg border border-outline-variant/30 bg-surface flex flex-col gap-1 text-left cursor-pointer hover:bg-surface-variant/30" onclick="window.triggerModalStatusFromMobile(${res.id})">
                <div class="flex justify-between items-center">
                    <span class="text-[11px] font-bold text-primary">${escapeHTML(res.service_name || 'Standard Cleaning')}</span>
                    <span class="px-2 py-0.5 ${badgeClasses} rounded text-[9px] font-bold uppercase">${res.status}</span>
                </div>
                <span class="text-xs text-on-surface-variant">${formatTimeRange(res.preferred_time)}</span>
            </div>
        `;
    });
    itemsHTML += `</div>`;

    window.triggerModalStatusFromMobile = (id) => {
        Modal.close();
        const res = globalReservations.find(r => r.id === id);
        if (res) openStatusModal(res);
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
        headerButtons[0].addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });

        headerButtons[1].addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    const filterPills = document.querySelectorAll('.overflow-x-auto button');
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(p => {
                p.className = 'px-4 py-1.5 rounded-full bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant font-label-caps text-[10px] whitespace-nowrap transition-colors';
            });

            e.currentTarget.className = 'px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-caps text-[10px] whitespace-nowrap';

            currentFilter = e.currentTarget.textContent.trim().toUpperCase();
            renderAgenda();
        });
    });
}

function filterAgendaByDate(dateStr) {
    const filtered = globalReservations.filter(r => r.service_date === dateStr);
    renderAgenda(filtered);
}

function openStatusModal(reservation) {
    const resId = `#RES-${String(reservation.id).padStart(4, '0')}`;
    const service = reservation.service_name || 'Standard Cleaning';
    const dateTime = `${reservation.service_date} @ ${reservation.preferred_time || '09:00 AM'}`;
    const email = reservation.email || 'balrking07@gmail.com';

    Modal.show({
        type: 'warning',
        title: `Update ${resId}`,
        message: `${service} - ${dateTime} (${email})`,
        confirmText: 'Save & Notify Email',
        htmlContent: `
            <div class="flex flex-col gap-1.5 mt-2">
                <label class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Select New Status</label>
                <select id="modal-status-select" class="w-full p-2.5 rounded-xl border border-outline-variant/50 bg-surface text-xs sm:text-sm font-medium">
                    <option value="PENDING" ${reservation.status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                    <option value="CONFIRMED" ${reservation.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option>
                    <option value="COMPLETED" ${reservation.status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
                    <option value="CANCELLED" ${reservation.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
                    <option value="REJECTED" ${reservation.status === 'REJECTED' ? 'selected' : ''}>REJECTED</option>
                </select>
            </div>
        `,
        onConfirm: async () => {
            const newStatus = document.getElementById('modal-status-select').value;
            try {
                const user = JSON.parse(localStorage.getItem('purenest_user') || '{}');
                await API.reservations.updateStatus(reservation.id, newStatus, user.id || null, `Status changed to ${newStatus} from Calendar`);

                await loadCalendarData();

                Modal.show({
                    type: 'success',
                    title: 'Status Updated',
                    message: `Reservation status changed to ${newStatus} and email notification sent.`,
                    confirmText: 'OK',
                    showCancel: false
                });
            } catch (err) {
                Modal.show({
                    type: 'danger',
                    title: 'Update Failed',
                    message: err.message || 'Could not update reservation status.',
                    confirmText: 'Close',
                    showCancel: false
                });
            }
        }
    });
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