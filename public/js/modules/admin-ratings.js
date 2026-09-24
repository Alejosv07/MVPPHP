import { API } from './api.js';
import { Modal } from './modal.js';

let currentViewType = 'client';
let allRatingsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    populateYearDropdown();
    setDefaultDateToToday();
    await loadRatingsData();
});

function setDefaultDateToToday() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('filterDate');
    if (dateInput) {
        dateInput.value = todayStr;
    }
}

function populateYearDropdown() {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }
}

window.switchRatingTab = function(type) {
    currentViewType = type;
    const clientBtn = document.getElementById('tabClientBtn');
    const staffBtn = document.getElementById('tabStaffBtn');
    const tableTitle = document.getElementById('tableTitle');
    const targetHeaderName = document.getElementById('targetHeaderName');

    if (type === 'client') {
        clientBtn.className = 'px-4 py-2 rounded-md text-xs font-bold bg-primary text-on-primary transition-colors';
        staffBtn.className = 'px-4 py-2 rounded-md text-xs font-bold text-primary hover:bg-surface-container transition-colors';
        tableTitle.textContent = 'Ratings History (Clients)';
        targetHeaderName.textContent = 'Client';
    } else {
        staffBtn.className = 'px-4 py-2 rounded-md text-xs font-bold bg-primary text-on-primary transition-colors';
        clientBtn.className = 'px-4 py-2 rounded-md text-xs font-bold text-primary hover:bg-surface-container transition-colors';
        tableTitle.textContent = 'Ratings History (Staff / Cleaners)';
        targetHeaderName.textContent = 'Staff Member';
    }
    renderRatingsTable(allRatingsData);
};

async function loadRatingsData() {
    try {
        const response = await API.ratings.getAll ? await API.ratings.getAll() : await API.reservations.getAll();
        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.ratings || response.reservations || [];
        }
        allRatingsData = Array.isArray(rawData) ? rawData : [];
        renderRatingsTable(allRatingsData);
    } catch (err) {
        console.error('Error loading ratings:', err);
        Modal.error('Could not load rating history.', 'Connection Error');
    }
}

window.applyFilters = function() {
    renderRatingsTable(allRatingsData);
};

window.resetFiltersToToday = function() {
    document.getElementById('filterYear').value = '';
    document.getElementById('filterMonth').value = '';
    setDefaultDateToToday();
    renderRatingsTable(allRatingsData);
};

function renderRatingsTable(data) {
    const tbody = document.getElementById('ratingsTableBody');
    const countLabel = document.getElementById('resultCount');
    if (!tbody) return;

    const filterYear = document.getElementById('filterYear').value;
    const filterMonth = document.getElementById('filterMonth').value;
    const filterDate = document.getElementById('filterDate').value;

    const filtered = data.filter(item => {
        const dateStr = item.service_date || item.created_at || '';
        if (!dateStr) return false;

        const itemDate = new Date(dateStr);
        const itemYear = itemDate.getFullYear().toString();
        const itemMonth = (itemDate.getMonth() + 1).toString();
        const itemDayFormatted = itemDate.toISOString().split('T')[0];

        if (filterYear && itemYear !== filterYear) return false;
        if (filterMonth && itemMonth !== filterMonth) return false;
        if (filterDate && itemDayFormatted !== filterDate) return false;

        const ratingVal = currentViewType === 'client' 
            ? Number(item.customer_rating || item.rating || 0)
            : Number(item.staff_rating || 0);

        return ratingVal > 0;
    });

    countLabel.textContent = `Showing ${filtered.length} records`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-on-surface-variant">No records found for the selected filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(item => {
        const id = item.id || item.reservation_id || '---';
        const date = item.service_date || item.created_at || 'N/A';
        
        let targetName = 'Anonymous';
        let rating = 0;
        let notes = '';

        if (currentViewType === 'client') {
            targetName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.client_name || 'Client';
            rating = Number(item.customer_rating || item.rating || 0);
            notes = item.customer_notes || item.notes || 'No client notes';
        } else {
            targetName = item.staff_name || item.cleaner_name || 'Staff Member';
            rating = Number(item.staff_rating || 0);
            notes = item.staff_notes || item.internal_notes || 'No internal notes';
        }

        const serviceName = item.service_name || 'General Service';

        let starsHTML = '';
        for (let i = 0; i < 5; i++) {
            const isFilled = i < rating ? "1" : "0";
            starsHTML += `<span class="material-symbols-outlined text-yellow-500 text-sm" style="font-variation-settings: 'FILL' ${isFilled};">star</span>`;
        }

        const tr = document.createElement('tr');
        tr.className = 'border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-4 font-medium text-primary">#${id}<br><span class="text-[11px] text-on-surface-variant font-normal">${date}</span></td>
            <td class="py-3 px-4 font-semibold text-primary">${escapeHTML(targetName)}</td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-1">${starsHTML} <span class="text-xs font-bold ml-1">(${rating}/5)</span></div>
            </td>
            <td class="py-3 px-4 max-w-xs truncate" title="${escapeHTML(notes)}">${escapeHTML(notes)}</td>
            <td class="py-3 px-4 text-xs">${escapeHTML(serviceName)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}