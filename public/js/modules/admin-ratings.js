import { API } from './api.js';
import { Modal } from './modal.js';

let currentViewType = 'client';
let allRatingsData = [];

let isIndividualView = false;
let individualEntityId = null;
let individualEntityName = '';

document.addEventListener('DOMContentLoaded', async () => {
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

function populateYearDropdown(data) {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;

    yearSelect.innerHTML = '<option value="">All Years</option>';

    const yearsSet = new Set();
    data.forEach(item => {
        const dateStr = item.service_date || item.created_at || '';
        if (dateStr) {
            const year = new Date(dateStr).getFullYear();
            if (!isNaN(year)) {
                yearsSet.add(year);
            }
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    if (sortedYears.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.disabled = true;
        opt.textContent = "- No records found -";
        yearSelect.appendChild(opt);
    } else {
        sortedYears.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        });
    }
}

window.switchRatingTab = function(type) {
    if (currentViewType === type) return;
    
    currentViewType = type;
    exitIndividualView();

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
        const year = document.getElementById('filterYear')?.value || '';
        const month = document.getElementById('filterMonth')?.value || '';
        const search = document.getElementById('filterSearch')?.value || '';

        const response = await API.reservations.getAll(month, year, search);
        
        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.ratings || response.reservations || [];
        }
        
        allRatingsData = Array.isArray(rawData) ? rawData : [];
        populateYearDropdown(allRatingsData);
        renderRatingsTable(allRatingsData);
    } catch (err) {
        console.error('Error loading ratings:', err);
        Modal.error('Could not load rating history.', 'Connection Error');
    }
}

window.applyFilters = function() {
    if (isIndividualView) {
        updateIndividualProfileData();
    }
    renderRatingsTable(allRatingsData);
};

window.resetFiltersToToday = function() {
    document.getElementById('filterYear').value = '';
    document.getElementById('filterMonth').value = '';
    setDefaultDateToToday();
    if (isIndividualView) {
        updateIndividualProfileData();
    }
    renderRatingsTable(allRatingsData);
};

function showIndividualHistory(entityId, entityName) {
    isIndividualView = true;
    individualEntityId = entityId;
    individualEntityName = entityName;

    document.getElementById('mainHeaderSection').classList.add('opacity-50', 'pointer-events-none');
    document.getElementById('individualProfileSection').classList.remove('hidden');
    
    updateIndividualProfileData();
    renderRatingsTable(allRatingsData);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.exitIndividualView = function() {
    isIndividualView = false;
    individualEntityId = null;
    individualEntityName = '';
    
    document.getElementById('mainHeaderSection').classList.remove('opacity-50', 'pointer-events-none');
    document.getElementById('individualProfileSection').classList.add('hidden');
    
    renderRatingsTable(allRatingsData);
}

function updateIndividualProfileData() {
    const allEntityRecords = allRatingsData.filter(item => {
        const id = currentViewType === 'client' ? (item.customer_id || item.client_id) : item.staff_id;
        return id === individualEntityId;
    });

    const avgData = calculateDetailedStats(allEntityRecords);

    document.getElementById('profileEntityName').textContent = individualEntityName;
    document.getElementById('profileTotalCount').textContent = `based on ${avgData.count} services`;
    
    const avgDisplay = document.getElementById('profileAvgRatingDisplay');
    avgDisplay.innerHTML = generateStarsHTML(avgData.average, 'text-lg') + 
                           `<span class="text-sm font-bold ml-1">(${avgData.average.toFixed(1)}/5)</span>`;
}

function calculateDetailedStats(records) {
    if (records.length === 0) return { average: 0, count: 0 };
    
    let totalRating = 0;
    let count = 0;
    
    records.forEach(item => {
        const rating = currentViewType === 'client' 
            ? Number(item.customer_rating || item.rating || 0)
            : Number(item.staff_rating || 0);
            
        if (rating > 0) {
            totalRating += rating;
            count++;
        }
    });
    
    return {
        average: count > 0 ? totalRating / count : 0,
        count: count
    };
}

function generateStarsHTML(rating, sizeClass = 'text-sm') {
    let starsHTML = '';
    const fullRating = Math.round(rating * 2) / 2;

    for (let i = 1; i <= 5; i++) {
        let icon = 'star_outline';
        if (fullRating >= i) {
            icon = 'star';
        } else if (fullRating >= i - 0.5) {
            icon = 'star_half';
        }
        
        starsHTML += `<span class="material-symbols-outlined text-yellow-500 ${sizeClass}" style="font-variation-settings: 'FILL' ${icon === 'star_outline' ? '0' : '1'};">${icon}</span>`;
    }
    return starsHTML;
}

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

        if (isIndividualView) {
            const itemId = currentViewType === 'client' ? (item.customer_id || item.client_id) : item.staff_id;
            if (itemId !== individualEntityId) return false;
        }

        const ratingVal = currentViewType === 'client' 
            ? Number(item.customer_rating || item.rating || 0)
            : Number(item.staff_rating || 0);

        return ratingVal > 0;
    });

    countLabel.textContent = isIndividualView 
        ? `Showing ${filtered.length} historical records for ${individualEntityName}`
        : `Showing ${filtered.length} global records`;

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
        const entityId = currentViewType === 'client' ? (item.customer_id || item.client_id) : item.staff_id;

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

        const tr = document.createElement('tr');
        tr.className = 'border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors';
        
        const idCell = document.createElement('td');
        idCell.className = 'py-3 px-4 font-medium text-primary';
        idCell.innerHTML = `#${id}<br><span class="text-[11px] text-on-surface-variant font-normal">${date}</span>`;
        tr.appendChild(idCell);

        const nameCell = document.createElement('td');
        nameCell.className = 'py-3 px-4 font-semibold text-primary';
        
        if (!isIndividualView && entityId) {
            const nameLink = document.createElement('button');
            nameLink.type = 'button';
            nameLink.textContent = escapeHTML(targetName);
            nameLink.className = 'hover:text-primary-fixed hover:underline text-left focus:outline-none cursor-pointer';
            nameLink.onclick = () => showIndividualHistory(entityId, targetName);
            nameCell.appendChild(nameLink);
        } else {
            nameCell.textContent = escapeHTML(targetName);
        }
        tr.appendChild(nameCell);

        const ratingCell = document.createElement('td');
        ratingCell.className = 'py-3 px-4';
        ratingCell.innerHTML = `<div class="flex items-center gap-1">${generateStarsHTML(rating)} <span class="text-xs font-bold ml-1">(${rating}/5)</span></div>`;
        tr.appendChild(ratingCell);

        const notesCell = document.createElement('td');
        notesCell.className = 'py-3 px-4 max-w-xs truncate';
        notesCell.title = escapeHTML(notes);
        notesCell.textContent = escapeHTML(notes);
        tr.appendChild(notesCell);

        const serviceCell = document.createElement('td');
        serviceCell.className = 'py-3 px-4 text-xs';
        serviceCell.textContent = escapeHTML(serviceName);
        tr.appendChild(serviceCell);

        tbody.appendChild(tr);
    });
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}