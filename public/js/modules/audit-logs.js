import { API } from './api.js';
import { Modal } from './modal.js';

let allLogs = [];
let allHistory = [];
let currentScope = 'all';

let currentLogPage = 1;
let currentHistoryPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupDrawerHandlers();
    setupQuickScopeFilters();
    setupAdvancedFilters();
    await loadAuditData();
});

async function loadAuditData() {
    try {
        const [logsResponse, historyResponse] = await Promise.all([
            API.audit.getLogs(),
            API.audit.getHistory()
        ]);

        allLogs = Array.isArray(logsResponse) ? logsResponse : (logsResponse.data || []);
        allHistory = Array.isArray(historyResponse) ? historyResponse : (historyResponse.data || []);

        applyScopeFilter('all');

    } catch (error) {
        console.error('Error loading audit data:', error);
        Modal.error('Failed to load cryptographic audit logs from the server.', 'Sync Error');
    }
}

function setupQuickScopeFilters() {
    const buttons = document.querySelectorAll('.quick-scope-btn');
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => {
                b.className = 'quick-scope-btn px-3 py-1 rounded-full text-xs font-medium bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high transition-colors';
            });
            e.target.className = 'quick-scope-btn px-3 py-1 rounded-full text-xs font-medium bg-primary-container text-on-primary';

            const scope = e.target.getAttribute('data-scope');
            applyScopeFilter(scope);
        });
    });
}

function setupAdvancedFilters() {
    const searchInput = document.querySelector('input[placeholder*="Search by User"]');
    const actionSelect = document.querySelectorAll('select')[0];
    const entitySelect = document.querySelectorAll('select')[1];

    const startDateInput = document.getElementById('filter-date-start');
    const endDateInput = document.getElementById('filter-date-end');
    const historySearchInput = document.querySelector('input[placeholder*="Filter e.g. #RES-"]');

    if (searchInput) searchInput.addEventListener('input', () => applyFilters());
    if (actionSelect) actionSelect.addEventListener('change', () => applyFilters());
    if (entitySelect) entitySelect.addEventListener('change', () => applyFilters());

    if (startDateInput) startDateInput.addEventListener('change', () => applyFilters());
    if (endDateInput) endDateInput.addEventListener('change', () => applyFilters());
    if (historySearchInput) historySearchInput.addEventListener('input', () => applyFilters());

    const resetBtn = document.querySelector('button[title="Reset Filters"]');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (actionSelect) actionSelect.value = '';
            if (entitySelect) entitySelect.value = '';
            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            if (historySearchInput) historySearchInput.value = '';
            applyFilters();
        });
    }
}

function applyScopeFilter(scope) {
    currentScope = scope;
    applyFilters();
}

function applyFilters() {
    currentLogPage = 1;
    currentHistoryPage = 1;
    const now = new Date();
    let filteredLogs = [...allLogs];
    let filteredHistory = [...allHistory];

    if (currentScope === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() >= startOfDay);
        filteredHistory = filteredHistory.filter(h => new Date(h.created_at).getTime() >= startOfDay);
    } else if (currentScope === '24h') {
        const last24h = now.getTime() - (24 * 60 * 60 * 1000);
        filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() >= last24h);
        filteredHistory = filteredHistory.filter(h => new Date(h.created_at).getTime() >= last24h);
    } else if (currentScope === '7d') {
        const last7d = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() >= last7d);
        filteredHistory = filteredHistory.filter(h => new Date(h.created_at).getTime() >= last7d);
    }

    const searchInput = document.querySelector('input[placeholder*="Search by User"]');
    const actionSelect = document.querySelectorAll('select')[0];
    const entitySelect = document.querySelectorAll('select')[1];

    if (searchInput && searchInput.value.trim() !== '') {
        const query = searchInput.value.toLowerCase();
        filteredLogs = filteredLogs.filter(l => {
            const userName = (l.user_name || '').toLowerCase();
            const entityId = String(l.entity_id || '').toLowerCase();
            const ip = (l.ip_address || '').toLowerCase();
            const details = JSON.stringify(l.details || '').toLowerCase();
            return userName.includes(query) || entityId.includes(query) || ip.includes(query) || details.includes(query);
        });
    }

    if (actionSelect && actionSelect.value !== '') {
        const selectedAction = actionSelect.value.toUpperCase();
        filteredLogs = filteredLogs.filter(l => (l.action || '').toUpperCase() === selectedAction);
    }

    if (entitySelect && entitySelect.value !== '') {
        const selectedEntity = entitySelect.value.toLowerCase();
        filteredLogs = filteredLogs.filter(l => (l.entity_type || '').toLowerCase() === selectedEntity);
    }

    const startDateInput = document.getElementById('filter-date-start');
    const endDateInput = document.getElementById('filter-date-end');

    if (startDateInput && startDateInput.value) {
        const startTime = new Date(startDateInput.value).setHours(0, 0, 0, 0);
        filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() >= startTime);
        filteredHistory = filteredHistory.filter(h => new Date(h.created_at).getTime() >= startTime);
    }

    if (endDateInput && endDateInput.value) {
        const endTime = new Date(endDateInput.value).setHours(23, 59, 59, 999);
        filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() <= endTime);
        filteredHistory = filteredHistory.filter(h => new Date(h.created_at).getTime() <= endTime);
    }

    const historySearchInput = document.querySelector('input[placeholder*="Filter e.g. #RES-"]');
    if (historySearchInput && historySearchInput.value.trim() !== '') {
        const rawQuery = historySearchInput.value.toLowerCase().trim();
        const cleanQuery = rawQuery.replace(/[^a-z0-9]/g, '');

        filteredHistory = filteredHistory.filter(h => {
            const resIdNum = String(h.reservation_id || '').toLowerCase();
            const resIdFull = `#res-${resIdNum}`.replace(/[^a-z0-9]/g, '');
            const hstIdNum = String(h.id || '').toLowerCase();
            const hstIdFull = `#hst-${hstIdNum}`.replace(/[^a-z0-9]/g, '');
            const userName = (h.user_name || '').toLowerCase();
            const comment = (h.comment || '').toLowerCase();
            const newStatus = (h.new_status || '').toLowerCase();

            return resIdNum.includes(cleanQuery) ||
                resIdFull.includes(cleanQuery) ||
                hstIdNum.includes(cleanQuery) ||
                hstIdFull.includes(cleanQuery) ||
                userName.includes(rawQuery) ||
                comment.includes(rawQuery) ||
                newStatus.includes(rawQuery);
        });
    }

    renderStatistics(allLogs, allHistory);
    renderLogsTable(filteredLogs);
    renderHistoryTable(filteredHistory);
}

function renderStatistics(logs, history) {
    const totalRecordsEl = document.getElementById('stat-total-records');
    if (totalRecordsEl) totalRecordsEl.textContent = allLogs.length.toLocaleString();

    const tabTotalEl = document.getElementById('tab-total-count');
    if (tabTotalEl) tabTotalEl.textContent = allLogs.length.toLocaleString();

    const statusShiftsEl = document.getElementById('stat-status-shifts');
    if (statusShiftsEl) statusShiftsEl.textContent = allHistory.length.toLocaleString();

    const tabHistoryEl = document.getElementById('tab-history-count');
    if (tabHistoryEl) tabHistoryEl.textContent = allHistory.length.toLocaleString();

    const deleteOpsEl = document.getElementById('stat-delete-ops');
    if (deleteOpsEl) {
        const deletes = allLogs.filter(l => l.action && l.action.toUpperCase() === 'DELETE').length;
        deleteOpsEl.textContent = deletes;
    }

    const topInitialsEl = document.getElementById('stat-top-initials');
    const topNameEl = document.getElementById('stat-top-name');
    const topCountEl = document.getElementById('stat-top-count');

    if (allLogs.length > 0) {
        const operatorCounts = {};
        allLogs.forEach(log => {
            const name = log.user_name || 'System Daemon';
            operatorCounts[name] = (operatorCounts[name] || 0) + 1;
        });

        let topOperator = 'System Daemon';
        let maxCount = 0;
        for (const [name, count] of Object.entries(operatorCounts)) {
            if (count > maxCount) {
                maxCount = count;
                topOperator = name;
            }
        }

        const initials = topOperator.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        if (topInitialsEl) topInitialsEl.textContent = initials;
        if (topNameEl) topNameEl.textContent = topOperator;
        if (topCountEl) topCountEl.textContent = `${maxCount} Executions`;
    } else {
        if (topInitialsEl) topInitialsEl.textContent = '--';
        if (topNameEl) topNameEl.textContent = 'No activity';
        if (topCountEl) topCountEl.textContent = '0 Executions';
    }
}
function renderLogsTable(logs) {
    const tbody = document.getElementById('activity-logs-tbody');
    let mobileContainer = document.getElementById('mobile-logs-container');

    if (!tbody) return;
    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    const totalItems = logs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentLogPage > totalPages) currentLogPage = totalPages;

    const startIndex = (currentLogPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedLogs = logs.slice(startIndex, endIndex);

    const pageStartEl = document.getElementById('page-start');
    const pageEndEl = document.getElementById('page-end');
    const pageTotalEl = document.getElementById('page-total');
    if (pageStartEl) pageStartEl.textContent = totalItems === 0 ? 0 : startIndex + 1;
    if (pageEndEl) pageEndEl.textContent = endIndex;
    if (pageTotalEl) pageTotalEl.textContent = totalItems.toLocaleString();

    if (paginatedLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-on-surface-variant italic">No activity logs found for this period.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="py-8 text-center text-on-surface-variant italic">No activity logs found for this period.</div>`;
        renderLogsPaginationControls(totalPages, logs);
        return;
    }

    paginatedLogs.forEach(log => {
        const initials = log.user_name ? log.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'SYS';

        let actionBg = 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
        if (log.action === 'DELETE') actionBg = 'bg-error-container text-on-error-container';
        if (log.action === 'CREATE') actionBg = 'bg-primary-fixed text-on-primary-fixed';
        if (log.action === 'LOGIN') actionBg = 'bg-secondary-container text-on-secondary-container';

        // 1. Escritorio (Fila de Tabla)
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-high/40 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-mono font-medium text-xs text-on-surface-variant">#LOG-${log.id}</td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-medium text-xs">
                        ${initials}
                    </div>
                    <div class="flex flex-col">
                        <span class="font-medium text-on-surface">${escapeHTML(log.user_name || 'System Daemon')}</span>
                        <span class="font-mono text-[11px] text-outline">USR-${log.user_id || '00'}</span>
                    </div>
                </div>
            </td>
            <td class="py-4 px-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${actionBg}">
                    ${escapeHTML(log.action)}
                </span>
            </td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-surface-container-high font-mono text-[12px] text-on-surface-variant">${escapeHTML(log.entity_type || 'N/A')}</span>
                    <span class="text-outline">→</span>
                    <span class="font-mono font-semibold text-accent-rust text-[12px]">#${escapeHTML(String(log.entity_id || '0'))}</span>
                </div>
            </td>
            <td class="py-4 px-4">
                <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-primary-fixed-dim"></span>
                    <span class="font-mono text-xs text-on-surface">${escapeHTML(log.ip_address || '127.0.0.1')}</span>
                </div>
            </td>
            <td class="py-4 px-6 font-mono text-xs text-on-surface-variant">
                ${formatDate(log.created_at)}
            </td>
            <td class="py-4 px-6 text-right">
                <button class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all text-xs font-medium text-on-surface" onclick="openDrawerWithPayload('${log.id}')">
                    <span class="material-symbols-outlined text-[14px]">code</span>
                    <span>Inspect</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        // 2. Móvil (Tarjeta Adaptativa)
        if (mobileContainer) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'p-5 space-y-3 hover:bg-surface-warm/50 transition-colors border-b border-outline-variant/20';
            cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-mono font-semibold text-xs text-on-surface-variant">#LOG-${log.id}</span>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${actionBg}">
                        ${escapeHTML(log.action)}
                    </span>
                </div>
                <div class="flex items-center space-x-3 pt-1">
                    <div class="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-medium text-xs shrink-0">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-semibold text-primary text-sm">${escapeHTML(log.user_name || 'System Daemon')}</p>
                        <p class="text-outline text-[11px] font-mono">USR-${log.user_id || '00'}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-outline-variant/10 font-mono">
                    <div>
                        <span class="block text-[10px] font-label-caps text-outline uppercase">Entity Target</span>
                        <span class="text-on-surface">${escapeHTML(log.entity_type || 'N/A')} <span class="text-accent-rust">#${escapeHTML(String(log.entity_id || '0'))}</span></span>
                    </div>
                    <div>
                        <span class="block text-[10px] font-label-caps text-outline uppercase">Origin IP</span>
                        <span class="text-on-surface">${escapeHTML(log.ip_address || '127.0.0.1')}</span>
                    </div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
                    <span class="font-mono text-[11px] text-outline">${formatDate(log.created_at)}</span>
                    <button class="px-3 py-1.5 rounded-lg bg-surface-container text-primary font-medium flex items-center gap-1 hover:bg-primary hover:text-on-primary transition-all text-xs" onclick="openDrawerWithPayload('${log.id}')">
                        <span class="material-symbols-outlined text-[14px]">code</span>
                        <span>Inspect Payload</span>
                    </button>
                </div>
            `;
            mobileContainer.appendChild(cardDiv);
        }
    });

    renderLogsPaginationControls(totalPages, logs);
}

function renderHistoryTable(history) {
    const tbody = document.getElementById('reservation-history-tbody');
    let mobileHistoryContainer = document.getElementById('mobile-history-container');

    if (!tbody) return;
    tbody.innerHTML = '';
    if (mobileHistoryContainer) mobileHistoryContainer.innerHTML = '';

    const totalItems = history.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;

    const startIndex = (currentHistoryPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedHistory = history.slice(startIndex, endIndex);

    const pageStartEl = document.getElementById('history-page-start');
    const pageEndEl = document.getElementById('history-page-end');
    const pageTotalEl = document.getElementById('history-page-total');
    if (pageStartEl) pageStartEl.textContent = totalItems === 0 ? 0 : startIndex + 1;
    if (pageEndEl) pageEndEl.textContent = endIndex;
    if (pageTotalEl) pageTotalEl.textContent = totalItems.toLocaleString();

    if (paginatedHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-on-surface-variant italic">No reservation history records for this period.</td></tr>`;
        if (mobileHistoryContainer) mobileHistoryContainer.innerHTML = `<div class="py-8 text-center text-on-surface-variant italic">No reservation history records for this period.</div>`;
        renderHistoryPaginationControls(totalPages, history);
        return;
    }

    paginatedHistory.forEach(item => {
        let newStatusBg = 'bg-primary-fixed text-on-primary-fixed';
        if (item.new_status === 'CANCELLED' || item.new_status === 'REJECTED') {
            newStatusBg = 'bg-error-container text-on-error-container';
        } else if (item.new_status === 'COMPLETED') {
            newStatusBg = 'bg-primary-container text-on-primary';
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-high/40 transition-colors border-b border-outline-variant/10';
        tr.innerHTML = `
            <td class="py-3.5 px-6 font-mono text-xs text-outline">#HST-${item.id}</td>
            <td class="py-3.5 px-6 font-mono font-semibold text-accent-rust">#RES-${item.reservation_id}</td>
            <td class="py-3.5 px-6">
                <span class="inline-flex items-center gap-1.5 font-medium">
                    <span class="text-on-surface-variant font-mono text-xs">${escapeHTML(item.previous_status || 'INIT')}</span>
                    <span class="text-error text-xs">→</span>
                    <span class="px-2 py-0.5 rounded text-[11px] ${newStatusBg} font-semibold">${escapeHTML(item.new_status)}</span>
                </span>
            </td>
            <td class="py-3.5 px-6 font-medium">${escapeHTML(item.user_name || 'System Automated')}</td>
            <td class="py-3.5 px-6 text-on-surface-variant max-w-xs truncate">${escapeHTML(item.comment || 'No remarks provided.')}</td>
            <td class="py-3.5 px-6 font-mono text-xs text-right text-outline">${formatDate(item.created_at)}</td>
        `;
        tbody.appendChild(tr);

        if (mobileHistoryContainer) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'p-5 space-y-3 hover:bg-surface-warm/50 transition-colors border-b border-outline-variant/20';
            cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-mono text-xs text-outline font-semibold">#HST-${item.id}</span>
                    <span class="font-mono font-semibold text-accent-rust text-xs">Reservation #RES-${item.reservation_id}</span>
                </div>
                <div class="flex items-center justify-between bg-surface-container-low/50 p-2.5 rounded-xl">
                    <span class="text-[11px] font-label-caps text-outline uppercase">Transition:</span>
                    <span class="inline-flex items-center gap-1 font-medium">
                        <span class="text-on-surface-variant font-mono text-xs">${escapeHTML(item.previous_status || 'INIT')}</span>
                        <span class="text-error text-xs">→</span>
                        <span class="px-2 py-0.5 rounded text-[11px] ${newStatusBg} font-semibold">${escapeHTML(item.new_status)}</span>
                    </span>
                </div>
                <div class="text-xs space-y-1">
                    <p class="text-on-surface"><span class="font-semibold">Agent:</span> ${escapeHTML(item.user_name || 'System Automated')}</p>
                    <p class="text-on-surface-variant"><span class="font-semibold text-on-surface">Remark:</span> ${escapeHTML(item.comment || 'No remarks provided.')}</p>
                </div>
                <div class="pt-2 border-t border-outline-variant/10 flex justify-end text-[11px] font-mono text-outline">
                    ${formatDate(item.created_at)}
                </div>
            `;
            mobileHistoryContainer.appendChild(cardDiv);
        }
    });

    renderHistoryPaginationControls(totalPages, history);
}
function renderLogsPaginationControls(totalPages, logs) {
    const paginationContainer = document.getElementById('pagination-buttons');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = `w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant text-xs ${currentLogPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}`;
    prevBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">chevron_left</span>`;
    prevBtn.disabled = currentLogPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentLogPage > 1) {
            currentLogPage--;
            renderLogsTable(logs);
        }
    });
    paginationContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentLogPage - 1 && i <= currentLogPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = i === currentLogPage
                ? 'w-8 h-8 rounded-lg bg-primary-container text-on-primary font-medium text-xs'
                : 'w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-xs';
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentLogPage = i;
                renderLogsTable(logs);
            });
            paginationContainer.appendChild(pageBtn);
        } else if (i === currentLogPage - 2 || i === currentLogPage + 2) {
            const span = document.createElement('span');
            span.className = 'px-1 text-on-surface-variant text-xs';
            span.textContent = '...';
            paginationContainer.appendChild(span);
        }
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant text-xs ${currentLogPage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}`;
    nextBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">chevron_right</span>`;
    nextBtn.disabled = currentLogPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentLogPage < totalPages) {
            currentLogPage++;
            renderLogsTable(logs);
        }
    });
    paginationContainer.appendChild(nextBtn);
}


function renderHistoryPaginationControls(totalPages, history) {
    const paginationContainer = document.getElementById('history-pagination-buttons');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = `w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant text-xs ${currentHistoryPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}`;
    prevBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">chevron_left</span>`;
    prevBtn.disabled = currentHistoryPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentHistoryPage > 1) {
            currentHistoryPage--;
            renderHistoryTable(history);
        }
    });
    paginationContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentHistoryPage - 1 && i <= currentHistoryPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = i === currentHistoryPage
                ? 'w-8 h-8 rounded-lg bg-primary-container text-on-primary font-medium text-xs'
                : 'w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-xs';
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentHistoryPage = i;
                renderHistoryTable(history);
            });
            paginationContainer.appendChild(pageBtn);
        } else if (i === currentHistoryPage - 2 || i === currentHistoryPage + 2) {
            const span = document.createElement('span');
            span.className = 'px-1 text-on-surface-variant text-xs';
            span.textContent = '...';
            paginationContainer.appendChild(span);
        }
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant text-xs ${currentHistoryPage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}`;
    nextBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">chevron_right</span>`;
    nextBtn.disabled = currentHistoryPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentHistoryPage < totalPages) {
            currentHistoryPage++;
            renderHistoryTable(history);
        }
    });
    paginationContainer.appendChild(nextBtn);
}

function setupTabs() {
    const tabActivityBtn = document.getElementById('tab-activity-btn');
    const tabHistoryBtn = document.getElementById('tab-history-btn');
    const sectionActivity = document.getElementById('section-activity-logs');
    const sectionHistory = document.getElementById('section-reservation-history');

    if (!tabActivityBtn || !tabHistoryBtn || !sectionActivity || !sectionHistory) return;

    tabActivityBtn.addEventListener('click', () => {
        sectionActivity.classList.remove('hidden');
        sectionActivity.classList.add('flex');
        sectionHistory.classList.add('hidden');
        sectionHistory.classList.remove('flex');

        tabActivityBtn.className = 'w-full flex items-center gap-2 px-6 py-2.5 rounded-xl font-label-caps text-label-caps tracking-wider uppercase transition-all bg-surface-container-lowest text-on-surface shadow-sm font-bold';
        tabHistoryBtn.className = 'w-full flex items-center gap-2 px-6 py-2.5 rounded-xl font-label-caps text-label-caps tracking-wider uppercase text-on-surface-variant hover:text-on-surface transition-all font-semibold';
    });

    tabHistoryBtn.addEventListener('click', () => {
        sectionActivity.classList.add('hidden');
        sectionActivity.classList.remove('flex');
        sectionHistory.classList.remove('hidden');
        sectionHistory.classList.add('flex');

        tabHistoryBtn.className = 'w-full flex items-center gap-2 px-6 py-2.5 rounded-xl font-label-caps text-label-caps tracking-wider uppercase transition-all bg-surface-container-lowest text-on-surface shadow-sm font-bold';
        tabActivityBtn.className = 'w-full flex items-center gap-2 px-6 py-2.5 rounded-xl font-label-caps text-label-caps tracking-wider uppercase text-on-surface-variant hover:text-on-surface transition-all font-semibold';
    });
}

const drawer = document.getElementById('inspector-drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const drawerPanel = document.getElementById('drawer-panel');
const drawerLogId = document.getElementById('drawer-log-id');

window.openDrawerWithPayload = function (logId) {
    const log = allLogs.find(l => String(l.id) === String(logId));
    if (!log) return;

    if (drawerLogId) {
        drawerLogId.textContent = `#LOG-${log.id} • ${log.entity_type || 'mutation'} payload`;
    }

    const actorEl = document.getElementById('drawer-actor-identity');
    if (actorEl) {
        const userName = log.user_name || 'System Daemon';
        const userId = log.user_id ? `#USR-${log.user_id}` : '#USR-00';
        actorEl.textContent = `${userName} (${userId})`;
    }

    const ipLocationEl = document.getElementById('drawer-ip-location');
    if (ipLocationEl) {
        ipLocationEl.textContent = log.ip_address || '127.0.0.1';
    }

    const cryptoStampEl = document.getElementById('drawer-crypto-stamp');
    if (cryptoStampEl) {
        const hash = log.crypto_hash || log.hash || log.signature || `SHA256: 8f4b23c91a0-${log.id}`;
        cryptoStampEl.textContent = hash.length > 15 ? `${hash.substring(0, 10)}...` : hash;
        cryptoStampEl.title = hash;
    }

    let detailsObj = {};
    try {
        if (typeof log.details === 'string') {
            detailsObj = JSON.parse(log.details);
        } else if (typeof log.details === 'object' && log.details !== null) {
            detailsObj = log.details;
        } else {
            detailsObj = { action: log.action, entity: log.entity_type, id: log.entity_id };
        }
    } catch (e) {
        detailsObj = { raw_details: log.details };
    }

    const prevCodeEl = document.getElementById('drawer-previous-state');
    const newCodeEl = document.getElementById('drawer-new-state');

    if (prevCodeEl && newCodeEl) {
        const prevState = detailsObj.previous || detailsObj.previous_state || detailsObj.old || { status: log.action || "INIT" };
        const newState = detailsObj.current || detailsObj.new_state || detailsObj.new || detailsObj;

        prevCodeEl.textContent = JSON.stringify(prevState, null, 2);
        newCodeEl.textContent = JSON.stringify(newState, null, 2);
    }

    const jsonContainer = document.getElementById('drawer-full-json');
    if (jsonContainer) {
        jsonContainer.textContent = JSON.stringify({
            event_id: `LOG-${log.id}`,
            user_id: log.user_id,
            user_name: log.user_name,
            action: log.action,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            ip_address: log.ip_address,
            created_at: log.created_at,
            details: detailsObj
        }, null, 2);
    }

    if (drawer && drawerBackdrop && drawerPanel) {
        drawer.classList.remove('opacity-0', 'pointer-events-none');
        drawerBackdrop.classList.remove('opacity-0', 'pointer-events-none');
        drawerPanel.classList.remove('translate-x-full');
    }
};

window.closeDrawer = function () {
    if (drawer && drawerBackdrop && drawerPanel) {
        drawerPanel.classList.add('translate-x-full');
        drawerBackdrop.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            drawer.classList.add('opacity-0', 'pointer-events-none');
        }, 280);
    }
};

window.copyJsonPayload = function (elemId) {
    const el = document.getElementById(elemId);
    if (!el) return;
    const text = el.innerText || el.textContent;

    navigator.clipboard.writeText(text).then(() => {
        Modal.success('Raw payload data successfully copied to your clipboard.', 'Copied!');
    }).catch(err => {
        console.error('Copy failed', err);
        Modal.error('Could not copy payload to clipboard.', 'Error');
    });
};

function setupDrawerHandlers() {
    const toggleBtn = document.getElementById('toggle-stream');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            toggleBtn.classList.toggle('rotate-180');
            await loadAuditData();
            Modal.success('Live ingestion stream re-synchronized successfully.', 'Stream Updated');
        });
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}