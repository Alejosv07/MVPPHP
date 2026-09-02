import { API } from './api.js';
import { Modal } from './modal.js';

let allReservations = [];
let filteredReservations = [];
let currentStatusTab = 'ALL';
let activeReservationId = null;

let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupModalActions();
    await loadReservationsData();
});

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
        monthSelect.selectedIndex = currentMonthIndex;
    }
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
                
                currentStatusTab = e.currentTarget.textContent.trim().toUpperCase();
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

    const applyBtn = document.querySelector('button.bg-primary.h-10');
    if (applyBtn) {
        applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
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
        if (modal) modal.classList.add('hidden');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    const actionButtons = ['btn-confirm-res', 'btn-pending-res', 'btn-complete-res', 'btn-reject-res', 'btn-cancel-res'];
    actionButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', async () => {
                if (!activeReservationId) return;
                const newStatus = btn.getAttribute('data-status');
                
                try {
                    await API.reservations.update(activeReservationId, { status: newStatus });
                    
                    const resObj = allReservations.find(r => String(r.id) === String(activeReservationId));
                    if (resObj) resObj.status = newStatus;

                    if (modal) modal.classList.add('hidden');
                    applyAllFilters();

                    Modal.show({
                        type: 'success',
                        title: 'Status Updated',
                        message: `Reservation status changed to ${newStatus}.`,
                        confirmText: 'OK',
                        showCancel: false
                    });
                } catch (err) {
                    console.error(err);
                    Modal.error(err.message || 'Failed to update reservation status.', 'Error');
                }
            });
        }
    });
}

function applyAllFilters() {
    const selects = document.querySelectorAll('select');
    const yearVal = selects[0]?.value || '';
    const monthVal = selects[1]?.selectedIndex ? selects[1].selectedIndex : ''; 
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
            if (resMonth !== monthVal) return false;
        }

        if (startDateVal && res.service_date < startDateVal) return false;
        if (endDateVal && res.service_date > endDateVal) return false;

        return true;
    });

    renderTablePage();
}

function renderTablePage() {
    const tbody = document.querySelector('table tbody');
    const footerSpan = document.querySelector('.p-4.border-t span');
    const paginationBtns = document.querySelectorAll('.p-4.border-t button');
    if (!tbody) return;

    tbody.innerHTML = '';

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
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-on-surface-variant font-body-md">
                    No reservations found matching your criteria.
                </td>
            </tr>
        `;
        return;
    }

    pageReservations.forEach(res => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low/30 transition-colors group border-b border-outline-variant/20';

        const customerName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || res.customer_name || 'Guest Customer';
        const serviceName = res.service_name || 'Standard Premium Cleaning';
        const formattedDate = formatDate(res.service_date, res.preferred_time);
        const initials = getInitials(customerName);

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
            <td class="py-4 px-6 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                ${formattedDate}
            </td>
            <td class="py-4 px-6">
                ${getStatusBadge(res.status)}
            </td>
            <td class="py-4 px-6 text-right whitespace-nowrap">
                <div class="flex justify-end space-x-2">
                    <button class="btn-view-details p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer" title="View Details">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                    <a href="admin-reservation.html?id=${res.id}" class="p-1 text-on-surface-variant hover:text-primary transition-colors" title="Edit">
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                    </a>
                </div>
            </td>
        `;

        const viewBtn = tr.querySelector('.btn-view-details');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => showReservationDetailsModal(res));
        }

        tbody.appendChild(tr);
    });
}

async function showReservationDetailsModal(res) {
    activeReservationId = res.id;
    const modal = document.getElementById('reservation-modal');
    if (!modal) return;

    document.getElementById('modal-title').textContent = `Reservation #RES-${String(res.id).padStart(4, '0')}`;
    document.getElementById('modal-status-badge').innerHTML = getStatusBadge(res.status);
    
    document.getElementById('modal-fullname').value = `${res.first_name || ''} ${res.last_name || ''}`.trim();
    document.getElementById('modal-email').value = res.email || '';
    document.getElementById('modal-phone').value = res.phone_number || '';
    document.getElementById('modal-address').value = res.service_address || '';
    
    document.getElementById('modal-bedrooms').value = res.bedrooms !== undefined ? `${res.bedrooms} Bedroom(s)` : 'N/A';
    document.getElementById('modal-bathrooms').value = res.bathrooms !== undefined ? `${res.bathrooms} Bathroom(s)` : 'N/A';
    document.getElementById('modal-frequency').value = res.frequency || 'One-time';
    document.getElementById('modal-price').value = res.total_price ? `$${Number(res.total_price).toFixed(2)}` : 'N/A';
    document.getElementById('modal-datetime').value = `${res.service_date || ''} ${res.preferred_time || ''}`.trim();
    document.getElementById('modal-notes').value = res.special_instructions || 'None specified.';

    const serviceSelect = document.getElementById('modal-service');
    if (serviceSelect) {
        try {
            const response = await API.services.getAll();
            let rawData = response;
            if (response && typeof response === 'object' && !Array.isArray(response)) {
                rawData = response.data || response.services || [];
            }
            const services = Array.isArray(rawData) ? rawData : [];
            
            serviceSelect.innerHTML = '';
            services.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                if (String(s.id) === String(res.service_id) || s.name === res.service_name) {
                    opt.selected = true;
                }
                serviceSelect.appendChild(opt);
            });
        } catch (e) {
            serviceSelect.innerHTML = `<option value="">${escapeHTML(res.service_name || 'Standard Cleaning')}</option>`;
        }
    }

    modal.classList.remove('hidden');
}

function getStatusBadge(status) {
    let classes = 'bg-surface-container-highest text-on-surface border-outline-variant/50';
    switch (status) {
        case 'CONFIRMED':
            classes = 'bg-primary-fixed text-primary-container border-primary-fixed-dim/30';
            break;
        case 'PENDING':
            classes = 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary-fixed-dim/30';
            break;
        case 'COMPLETED':
            classes = 'bg-emerald-100 text-emerald-800 border-emerald-300/30';
            break;
        case 'CANCELLED':
        case 'REJECTED':
            classes = 'bg-error-container text-on-error-container border-error-container/30';
            break;
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${classes}">${status}</span>`;
}

function formatDate(dateStr, timeStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
           (timeStr ? ` · ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '');
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}