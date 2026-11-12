import { API } from './api.js';
import { Modal } from './modal.js';
import { renderReservationActions, statusBadge, formatDateTime } from './reservation-actions.js';

let allReservations = [];
let filteredReservations = [];
let globalStaffList = [];
let globalServicesList = [];
let currentStatusTab = 'ALL';
let activeReservationId = null;


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

                currentStatusTab = e.currentTarget.dataset.status || 'ALL';
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
    const closeModal = () => {
        if (modal) modal.classList.add('hidden', 'pointer-events-none');
        activeReservationId = null;
    };
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
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
        if (currentStatusTab !== 'ALL' && res.status !== currentStatusTab) {
            return false;
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

    renderReservationActions(document.getElementById('modal-actions'), res, {
        staffList: globalStaffList,
        onDone: async (message) => {
            modal.classList.add('hidden', 'pointer-events-none');
            activeReservationId = null;
            await loadReservationsData();
            Modal.success(message || 'Reservation updated.', 'Done');
        },
    });

    modal.classList.remove('hidden', 'pointer-events-none');
}

function getStatusBadge(status) {
    return statusBadge(status);
}

function formatDate(dateStr, timeStr) {
    return formatDateTime(dateStr, timeStr);
}


function getInitials(name) {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'GS';
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}