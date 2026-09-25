import { API } from './api.js';
import { Modal } from './modal.js';

let currentViewType = 'client';
let allRatingsData = [];

let isIndividualView = false;
let individualEntityId = null;
let individualEntityName = '';

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDateToEmpty();
    await loadAllRatingsData();
});

function setDefaultDateToEmpty() {
    const dateInput = document.getElementById('filterDate');
    if (dateInput) {
        dateInput.value = '';
    }
}

async function loadAllRatingsData() {
    try {
        const search = document.getElementById('filterSearch')?.value || '';
        
        const response = await API.reservations.getAll(null, null, search);
        
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

function populateYearDropdown(data) {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;

    const currentSelectedYear = yearSelect.value;
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

    yearsSet.add(new Date().getFullYear());

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });

    if (currentSelectedYear) {
        yearSelect.value = currentSelectedYear;
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

window.applyFilters = function() {
    if (isIndividualView) {
        updateIndividualProfileData();
    }
    loadAllRatingsData();
};

window.resetFiltersToToday = function() {
    const yearEl = document.getElementById('filterYear');
    const monthEl = document.getElementById('filterMonth');
    const searchEl = document.getElementById('filterSearch');

    if (yearEl) yearEl.value = '';
    if (monthEl) monthEl.value = '';
    if (searchEl) searchEl.value = '';
    
    setDefaultDateToEmpty();

    if (isIndividualView) {
        updateIndividualProfileData();
    }
    loadAllRatingsData();
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
    const container = tbody?.closest('.bg-surface-container-lowest');
    
    if (!tbody) return;

    const filterYear = document.getElementById('filterYear')?.value || '';
    const filterMonth = document.getElementById('filterMonth')?.value || '';
    const filterDate = document.getElementById('filterDate')?.value || '';

    const filtered = data.filter(item => {
        const dateStr = item.service_date || item.created_at || '';
        if (!dateStr) return false;

        const itemDate = new Date(dateStr);
        const itemYear = itemDate.getFullYear().toString();
        const itemMonth = (itemDate.getMonth() + 1).toString();
        const itemDayFormatted = itemDate.toISOString().split('T')[0];

        if (filterYear && filterYear !== '' && itemYear !== filterYear) return false;
        if (filterMonth && filterMonth !== '' && itemMonth !== filterMonth) return false;
        if (filterDate && filterDate !== '' && itemDayFormatted !== filterDate) return false;

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

    let mobileCardsContainer = document.getElementById('ratingsMobileCards');
    if (!mobileCardsContainer && container) {
        mobileCardsContainer = document.createElement('div');
        mobileCardsContainer.id = 'ratingsMobileCards';
        mobileCardsContainer.className = 'grid grid-cols-1 gap-4 md:hidden mt-4';
        container.appendChild(mobileCardsContainer);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-on-surface-variant">No records found for the selected filters.</td></tr>`;
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML = `<div class="p-6 text-center text-on-surface-variant bg-surface-container-low rounded-lg">No records found for the selected filters.</div>`;
        }
        return;
    }

    const tableWrapper = tbody.closest('.overflow-x-auto');
    if (tableWrapper) {
        tableWrapper.className = 'hidden md:block overflow-x-auto';
    }

    tbody.innerHTML = '';
    let cardsHTML = '';

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
        const safeTargetName = escapeHTML(targetName);
        const safeNotes = escapeHTML(notes);
        const safeService = escapeHTML(serviceName);

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
            nameLink.textContent = safeTargetName;
            nameLink.className = 'hover:text-primary-fixed hover:underline text-left focus:outline-none cursor-pointer';
            nameLink.onclick = () => showIndividualHistory(entityId, targetName);
            nameCell.appendChild(nameLink);
        } else {
            nameCell.textContent = safeTargetName;
        }
        tr.appendChild(nameCell);

        const ratingCell = document.createElement('td');
        ratingCell.className = 'py-3 px-4';
        ratingCell.innerHTML = `<div class="flex items-center gap-1">${generateStarsHTML(rating)} <span class="text-xs font-bold ml-1">(${rating}/5)</span></div>`;
        tr.appendChild(ratingCell);

        const notesCell = document.createElement('td');
        notesCell.className = 'py-3 px-4 max-w-xs truncate';
        notesCell.title = safeNotes;
        notesCell.textContent = safeNotes;
        tr.appendChild(notesCell);

        const serviceCell = document.createElement('td');
        serviceCell.className = 'py-3 px-4 text-xs';
        serviceCell.textContent = safeService;
        tr.appendChild(serviceCell);

        tbody.appendChild(tr);

        cardsHTML += `
            <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 space-y-3 shadow-sm">
                <div class="flex justify-between items-start border-b border-outline-variant/10 pb-2">
                    <div>
                        <span class="text-xs font-bold text-primary">#${id}</span>
                        <div class="text-[11px] text-on-surface-variant">${date}</div>
                    </div>
                    <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">${safeService}</span>
                </div>
                <div>
                    <div class="text-xs font-label-caps text-on-surface-variant">${currentViewType === 'client' ? 'Client' : 'Staff Member'}</div>
                    <div class="text-sm font-semibold text-primary">
                        ${!isIndividualView && entityId ? `<button type="button" onclick="window.triggerIndividualView(${entityId}, '${safeTargetName.replace(/'/g, "\\'")}')" class="hover:underline text-left text-primary">${safeTargetName}</button>` : safeTargetName}
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    ${generateStarsHTML(rating)} <span class="text-xs font-bold ml-1">(${rating}/5)</span>
                </div>
                <div class="bg-surface-container-lowest p-3 rounded border border-outline-variant/10 text-xs text-on-surface-variant">
                    <span class="font-bold block text-primary mb-1">Notes / Comments:</span>
                    ${safeNotes}
                </div>
            </div>
        `;
    });

    if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = cardsHTML;
    }
}

window.triggerIndividualView = function(entityId, entityName) {
    showIndividualHistory(entityId, entityName);
};

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}