import { API } from './api.js';
import { Modal } from './modal.js';

let allReservations = [];
let filteredReservations = [];
let globalStaffList = [];
let globalServicesList = [];
let currentStatusTab = 'ALL';
let activeReservationId = null;
let activeActionMode = null;

let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupModalActions();
    await loadStaffList();
    await loadServicesList();
    await loadReservationsData();
});

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

async function loadServicesList() {
    try {
        const response = await API.services.getAll();
        let servicesList = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            servicesList = response.data || response.services || [];
        }
        globalServicesList = Array.isArray(servicesList) ? servicesList : [];
    } catch (e) {
        console.error('Error loading services list:', e);
        globalServicesList = [];
    }
}

async function loadReservationsData() {
    try {
        const response = await API.reservations.getAll();

        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.reservations || [];
        }

        allReservations = Array.isArray(rawData) ? rawData : [];

        populateDynamicYears();
        setCurrentMonthAndYearDefaults();
        applyAllFilters();
    } catch (error) {
        console.error(error);
        Modal.error('Failed to load reservations list.', 'Data Error');
    }
}

function populateDynamicYears() {
    const yearSelect = document.querySelectorAll('select')[0];
    if (!yearSelect) return;

    const yearsSet = new Set();
    allReservations.forEach(res => {
        if (res.service_date) {
            const y = new Date(res.service_date).getFullYear();
            if (!isNaN(y)) yearsSet.add(y);
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    yearSelect.innerHTML = '<option value="">All Years</option>';
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });
}

function setCurrentMonthAndYearDefaults() {
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonthIndex = now.getMonth() + 1;

    const selects = document.querySelectorAll('select');
    const yearSelect = selects[0];
    const monthSelect = selects[1];

    if (yearSelect && yearSelect.querySelector(`option[value="${currentYear}"]`)) {
        yearSelect.value = currentYear;
    }

    if (monthSelect) {
        monthSelect.value = currentMonthIndex.toString();
    }

    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs[0]) dateInputs[0].value = '';
    if (dateInputs[1]) dateInputs[1].value = '';
}

function setupEventListeners() {
    const tabsContainer = document.querySelector('.overflow-x-auto.w-full');
    if (tabsContainer) {
        const tabs = tabsContainer.querySelectorAll('button');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => {
                    t.className = 'px-4 py-2 font-body-md text-body-md text-on-surface-variant hover:text-primary hover:bg-surface-container-low/50 rounded-lg whitespace-nowrap transition-colors';
                });
                e.currentTarget.className = 'px-4 py-2 font-body-md text-body-md font-medium text-primary bg-surface-container-low rounded-lg whitespace-nowrap transition-colors';

                currentStatusTab = e.currentTarget.textContent.trim().toUpperCase().replace(/\s+/g, '_');
                currentPage = 1;
                applyAllFilters();
            });
        });
    }

    const searchInput = document.querySelector('input[placeholder*="Search"]');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            applyAllFilters();
        });
    }

    const applyBtn = document.getElementById('btn-apply-filters');
    if (applyBtn) {
        applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = 1;
            applyAllFilters();
        });
    }

    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setCurrentMonthAndYearDefaults();
            const searchInput = document.querySelector('input[placeholder*="Search"]');
            if (searchInput) searchInput.value = '';
            currentPage = 1;
            applyAllFilters();
        });
    }

    const paginationBtns = document.querySelectorAll('.p-4.border-t button');
    if (paginationBtns.length >= 2) {
        paginationBtns[0].addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTablePage();
            }
        });

        paginationBtns[1].addEventListener('click', () => {
            const maxPage = Math.ceil(filteredReservations.length / itemsPerPage);
            if (currentPage < maxPage) {
                currentPage++;
                renderTablePage();
            }
        });
    }
}

function setupModalActions() {
    const modal = document.getElementById('reservation-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const backdrop = document.getElementById('modal-backdrop');

    const closeModal = () => {
        if (modal) modal.classList.add('hidden', 'pointer-events-none');
        activeReservationId = null;
        activeActionMode = null;
        const container = document.getElementById('modal-action-inputs');
        if (container) container.classList.add('hidden');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    const btnQuoteAction = document.getElementById('modal-btn-quote-action');
    const btnRescheduleAction = document.getElementById('modal-btn-reschedule-action');
    const btnCancelAction = document.getElementById('modal-btn-reject-action');

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
                if (container) container.classList.remove('hidden');
                if (pWrapper) pWrapper.classList.remove('hidden');
                if (rWrapper) rWrapper.classList.add('hidden');
                if (resWrapper) resWrapper.classList.add('hidden');

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
            const currentRes = allReservations.find(r => String(r.id) === String(activeReservationId));
            const currentStatus = currentRes ? currentRes.status : 'PENDING';

            activeActionMode = null;
            if (container) container.classList.add('hidden');
            if (pWrapper) pWrapper.classList.add('hidden');
            newBtnQuote.innerHTML = '<span class="material-symbols-outlined text-sm">payments</span> Set Price & Quote';

            await updateModalStatusWithDetails(activeReservationId, currentStatus, {
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
                if (container) container.classList.remove('hidden');
                if (resWrapper) resWrapper.classList.remove('hidden');
                if (pWrapper) pWrapper.classList.add('hidden');
                if (rWrapper) rWrapper.classList.add('hidden');

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

            activeActionMode = null;
            if (container) container.classList.add('hidden');
            if (resWrapper) resWrapper.classList.add('hidden');
            newBtnReschedule.innerHTML = '<span class="material-symbols-outlined text-sm">event_repeat</span> Reschedule Service';

            await updateModalStatusWithDetails(activeReservationId, 'RESCHEDULED', {
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
                if (container) container.classList.remove('hidden');
                if (rWrapper) rWrapper.classList.remove('hidden');
                if (pWrapper) pWrapper.classList.add('hidden');
                if (resWrapper) resWrapper.classList.add('hidden');

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

            activeActionMode = null;
            if (container) container.classList.add('hidden');
            if (rWrapper) rWrapper.classList.add('hidden');
            newBtnCancel.innerHTML = '<span class="material-symbols-outlined text-sm">cancel</span> Rejected Service';

            await updateModalStatusWithDetails(activeReservationId, 'REJECTED', {
                staff_id: staffIdVal ? Number(staffIdVal) : null,
                comment: `Cancelled by admin. Reason: ${reasonVal}`
            });
        });
    }
}

function applyAllFilters() {
    const selects = document.querySelectorAll('select');
    const yearVal = selects[0]?.value || '';
    const monthVal = selects[1]?.value || '';
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startDateVal = dateInputs[0]?.value || '';
    const endDateVal = dateInputs[1]?.value || '';

    const searchInput = document.querySelector('input[placeholder*="Search"]');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    filteredReservations = allReservations.filter(res => {
        if (currentStatusTab !== 'ALL') {
            if (currentStatusTab === 'CANCELLED') {
                if (res.status !== 'CANCELLED' && res.status !== 'REJECTED') return false;
            } else if (res.status !== currentStatusTab) {
                return false;
            }
        }

        if (query) {
            const fullName = `${res.first_name || ''} ${res.last_name || ''}`.toLowerCase();
            const resIdStr = `#res-${String(res.id).padStart(4, '0')}`.toLowerCase();
            if (!fullName.includes(query) && !resIdStr.includes(query)) {
                return false;
            }
        }

        if (yearVal && res.service_date) {
            const resYear = new Date(res.service_date).getFullYear().toString();
            if (resYear !== yearVal) return false;
        }

        if (monthVal && res.service_date) {
            const resMonth = new Date(res.service_date).getMonth() + 1;
            if (resMonth.toString() !== monthVal) return false;
        }

        if (startDateVal && res.service_date < startDateVal) return false;
        if (endDateVal && res.service_date > endDateVal) return false;

        return true;
    });

    renderTablePage();
}

function renderTablePage() {
    const tbody = document.querySelector('table tbody');
    const mobileContainer = document.getElementById('mobile-reservations-container');
    const footerSpan = document.querySelector('.p-4.border-t span');
    const paginationBtns = document.querySelectorAll('.p-4.border-t button');
    
    if (!tbody) return;

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    const totalEntries = filteredReservations.length;
    const maxPage = Math.ceil(totalEntries / itemsPerPage) || 1;

    if (currentPage > maxPage) currentPage = maxPage;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalEntries);
    const pageReservations = filteredReservations.slice(startIdx, endIdx);

    if (footerSpan) {
        footerSpan.textContent = totalEntries > 0
            ? `Showing ${startIdx + 1} to ${endIdx} of ${totalEntries} entries`
            : `Showing 0 to 0 of 0 entries`;
    }

    if (paginationBtns.length >= 2) {
        if (currentPage <= 1) {
            paginationBtns[0].classList.add('opacity-40', 'cursor-not-allowed');
            paginationBtns[0].disabled = true;
        } else {
            paginationBtns[0].classList.remove('opacity-40', 'cursor-not-allowed');
            paginationBtns[0].disabled = false;
        }

        if (currentPage >= maxPage || totalEntries === 0) {
            paginationBtns[1].classList.add('opacity-40', 'cursor-not-allowed');
            paginationBtns[1].disabled = true;
        } else {
            paginationBtns[1].classList.remove('opacity-40', 'cursor-not-allowed');
            paginationBtns[1].disabled = false;
        }
    }

    if (pageReservations.length === 0) {
        const emptyMsg = `
            <div class="py-12 text-center text-on-surface-variant font-body-md w-full">
                No reservations found matching your criteria.
            </div>
        `;
        tbody.innerHTML = `<tr><td colspan="7">${emptyMsg}</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = emptyMsg;
        return;
    }

    pageReservations.forEach(res => {
        const customerName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || 'Guest Customer';
        const serviceName = res.service_name || 'Standard Premium Cleaning';
        const formattedDate = formatDate(res.service_date, res.preferred_time);
        const initials = getInitials(customerName);

        const sId = res.staff_id || res.admin_id;
        let foundStaffName = res.staff_name || res.admin_name || res.assigned_staff_name;
        if (!foundStaffName && sId && globalStaffList.length > 0) {
            const matchedStaff = globalStaffList.find(st => Number(st.id) === Number(sId));
            if (matchedStaff) foundStaffName = matchedStaff.name;
        }

        const staffDisplay = foundStaffName
            ? `<span class="text-on-background font-medium">${escapeHTML(foundStaffName)}</span>`
            : `<span class="text-on-surface-variant/60 italic">Unassigned</span>`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low/30 transition-colors group border-b border-outline-variant/20';
        tr.innerHTML = `
            <td class="py-4 px-6 font-body-md text-body-md font-medium text-primary whitespace-nowrap">
                #RES-${String(res.id).padStart(4, '0')}
            </td>
            <td class="py-4 px-6">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20 text-on-surface-variant font-label-caps text-[10px]">
                        ${initials}
                    </div>
                    <span class="font-body-md text-body-md text-on-background whitespace-nowrap">
                        ${escapeHTML(customerName)}
                    </span>
                </div>
            </td>
            <td class="py-4 px-6 font-body-md text-body-md text-on-surface-variant">
                ${escapeHTML(serviceName)}
            </td>
            <td class="py-4 px-6 font-body-md text-body-md text-on-surface-variant">
                ${staffDisplay}
            </td>
            <td class="py-4 px-6 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                ${formattedDate}
            </td>
            <td class="py-4 px-6">
                ${getStatusBadge(res.status)}
            </td>
            <td class="py-4 px-6 text-right whitespace-nowrap">
                <div class="flex justify-end space-x-2">
                    <button class="btn-view-details p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer" title="View Details" data-id="${res.id}">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                    <a href="admin-reservation.html?id=${res.id}" class="p-1 text-on-surface-variant hover:text-primary transition-colors" title="Edit">
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                    </a>
                </div>
            </td>
        `;

        const viewBtnDesktop = tr.querySelector('.btn-view-details');
        if (viewBtnDesktop) {
            viewBtnDesktop.addEventListener('click', () => showReservationDetailsModal(res));
        }
        tbody.appendChild(tr);

        if (mobileContainer) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'p-5 space-y-4 hover:bg-surface-warm/50 transition-colors border-b border-outline-variant/20';
            cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-medium text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md">#RES-${String(res.id).padStart(4, '0')}</span>
                    <div>${getStatusBadge(res.status)}</div>
                </div>

                <div class="flex items-center space-x-3 pt-1">
                    <div class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20 text-on-surface-variant font-label-caps text-xs shrink-0">
                        ${initials}
                    </div>
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Customer</span>
                        <span class="font-semibold text-primary text-sm">${escapeHTML(customerName)}</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-sm pt-1 border-t border-outline-variant/10">
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Service Type</span>
                        <span class="text-on-surface text-xs font-medium">${escapeHTML(serviceName)}</span>
                    </div>
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Staff Assigned</span>
                        <span class="text-xs">${staffDisplay}</span>
                    </div>
                </div>

                <div class="pt-1 border-t border-outline-variant/10">
                    <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Date & Time</span>
                    <span class="text-on-surface-variant text-xs">${formattedDate}</span>
                </div>

                <div class="pt-2 flex gap-2">
                    <button class="flex-1 py-2.5 px-4 rounded-lg bg-surface-container text-primary font-label-caps text-xs flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-all btn-view-mobile" data-id="${res.id}">
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                        <span>View Details</span>
                    </button>
                    <a href="admin-reservation.html?id=${res.id}" class="py-2.5 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-caps text-xs flex items-center justify-center gap-1 hover:bg-surface-variant transition-all">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                        <span>Edit</span>
                    </a>
                </div>
            `;

            const viewBtnMobile = cardDiv.querySelector('.btn-view-mobile');
            if (viewBtnMobile) {
                viewBtnMobile.addEventListener('click', () => showReservationDetailsModal(res));
            }
            mobileContainer.appendChild(cardDiv);
        }
    });
}

async function showReservationDetailsModal(res) {
    activeReservationId = res.id;
    const modal = document.getElementById('reservation-modal');
    if (!modal) return;

    document.getElementById('modal-title').textContent = `Reservation #RES-${String(res.id).padStart(4, '0')}`;

    const statusBadgeContainer = document.getElementById('modal-status-badge');
    if (statusBadgeContainer) {
        statusBadgeContainer.innerHTML = getStatusBadge(res.status);
    }

    const inputName = document.getElementById('modal-fullname');
    const inputEmail = document.getElementById('modal-email');
    const inputPhone = document.getElementById('modal-phone');
    const inputAddress = document.getElementById('modal-address');
    const inputBedrooms = document.getElementById('modal-bedrooms');
    const inputBathrooms = document.getElementById('modal-bathrooms');
    const inputFrequency = document.getElementById('modal-frequency');
    const inputPrice = document.getElementById('modal-price');
    const inputModalPriceSet = document.getElementById('modal-input-price');
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
    if (inputModalPriceSet) inputModalPriceSet.value = res.total_price && Number(res.total_price) > 0 ? res.total_price : '';
    if (inputDatetime) inputDatetime.value = `${res.service_date || ''}T${res.preferred_time ? res.preferred_time.substring(0, 5) : '09:00'}`;
    if (textareaNotes) textareaNotes.value = res.special_instructions || '';

    const serviceSelect = document.getElementById('modal-service');
    if (serviceSelect) {
        serviceSelect.innerHTML = '';
        globalServicesList.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            serviceSelect.appendChild(opt);
        });

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

    let bookingDetailsContainer = document.querySelector('#reservation-modal .grid.grid-cols-1.md\\:grid-cols-2.gap-8 > div:nth-child(2) .flex.flex-col.gap-4');
    if (bookingDetailsContainer && !document.getElementById('modal-staff-container')) {
        const staffDiv = document.createElement('div');
        staffDiv.id = 'modal-staff-container';
        staffDiv.className = 'flex flex-col gap-2';
        staffDiv.innerHTML = `
            <label class="text-xs font-label-caps text-outline uppercase">Assigned Staff</label>
            <div class="flex gap-2">
                <select id="modal-staff" class="flex-1 px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface focus:border-primary focus:ring-0 transition-all font-body-md text-on-surface">
                    <option value="">-- Unassigned --</option>
                </select>
                <button id="modal-btn-assign-staff" class="px-4 py-3 rounded-lg border border-primary bg-primary text-on-primary font-label-caps text-label-caps hover:bg-primary/90 transition-all flex items-center justify-center gap-1 cursor-pointer">
                    <span class="material-symbols-outlined text-sm">person_add</span> Assign
                </button>
            </div>
        `;
        bookingDetailsContainer.prepend(staffDiv);
    }

    const staffSelect = document.getElementById('modal-staff');
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

    const btnAssignStaff = document.getElementById('modal-btn-assign-staff');
    if (btnAssignStaff) {
        const newBtnAssign = btnAssignStaff.cloneNode(true);
        btnAssignStaff.parentNode.replaceChild(newBtnAssign, btnAssignStaff);

        newBtnAssign.addEventListener('click', async () => {
            const staffIdVal = document.getElementById('modal-staff')?.value;

            try {
                await updateModalStatusWithDetails(activeReservationId, res.status, {
                    staff_id: staffIdVal ? Number(staffIdVal) : null,
                    comment: staffIdVal ? `Assigned staff ID ${staffIdVal}` : 'Staff unassigned',
                    total_price: res.total_price ? Number(res.total_price) : 0.00,
                    service_date: res.service_date,
                    preferred_time: res.preferred_time
                });

                modal.classList.add('hidden', 'pointer-events-none');
                await loadReservationsData();
                applyAllFilters();
                Modal.success('Staff assignment updated successfully.', 'Success');
            } catch (err) {
                Modal.error(err.message || 'Failed to assign staff.', 'Error');
            }
        });
    }

    modal.classList.remove('hidden', 'pointer-events-none');
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

        const modal = document.getElementById('reservation-modal');
        if (modal) modal.classList.add('hidden', 'pointer-events-none');

        await loadReservationsData();
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        (timeStr ? ` · ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '');
}

function getInitials(name) {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'GS';
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}