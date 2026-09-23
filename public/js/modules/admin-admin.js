import { API } from './api.js';
import { Modal } from './modal.js';

let allAdmins = [];
let currentFilteredAdmins = [];
let currentEditingId = null;
let currentPage = 1;
const pageSize = 5;

document.addEventListener('DOMContentLoaded', async () => {
    await loadAdminsData();
    setupEventListeners();
    setupFilters();
});

async function loadAdminsData() {
    try {
        const response = await API.admins.getAll();

        if (Array.isArray(response)) {
            allAdmins = response;
        } else if (response && typeof response === 'object') {
            allAdmins = response.data || response.admins || [];
        } else {
            allAdmins = [];
        }

        updateCounters(allAdmins);
        applyFiltersAndPagination();
    } catch (error) {
        console.error('Failed to load administrators:', error);
        Modal.error('Failed to load administrators from the server.');
    }
}

function updateCounters(admins) {
    const total = admins.length;
    const active = admins.filter(a => Number(a.is_active) === 1).length;
    const pendingTokens = admins.filter(a => a.reset_code && a.reset_code !== 'None' && a.reset_code !== '').length;
    const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

    const cards = document.querySelectorAll('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div');
    if (cards.length >= 4) {
        cards[0].querySelector('.font-headline-md').textContent = total;
        cards[1].querySelector('.font-headline-md').textContent = active;
        cards[1].querySelector('span').textContent = `${activePct}%`;
        cards[2].querySelector('.font-headline-md').textContent = admins.filter(a => a.role === 'ADMIN').length;
        cards[3].querySelector('.font-headline-md').textContent = pendingTokens;
    }
}

function applyFiltersAndPagination() {
    const searchInput = document.querySelector('input[placeholder*="Search"]');
    const selects = document.querySelectorAll('select');
    const roleSelect = selects[0];
    const statusSelect = selects[1];
    const tokenSelect = selects[2];

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const roleVal = roleSelect ? roleSelect.value.trim() : 'All Roles';
    const statusVal = statusSelect ? statusSelect.value.trim() : 'All Statuses';
    const tokenVal = tokenSelect ? tokenSelect.value.trim() : 'All';

    currentFilteredAdmins = allAdmins.filter(admin => {
        const matchesSearch = !query ||
            (admin.name && admin.name.toLowerCase().includes(query)) ||
            (admin.email && admin.email.toLowerCase().includes(query));

        let matchesRole = true;
        if (roleVal !== 'All Roles' && roleVal !== '') {
            matchesRole = admin.role.toUpperCase() === roleVal.toUpperCase();
        }

        let matchesStatus = true;
        if (statusVal.includes('Active')) {
            matchesStatus = Number(admin.is_active) === 1;
        } else if (statusVal.includes('Inactive')) {
            matchesStatus = Number(admin.is_active) === 0;
        }

        let matchesToken = true;
        const hasToken = admin.reset_code && admin.reset_code !== 'None' && admin.reset_code !== '';
        if (tokenVal.includes('Active Reset Token')) {
            matchesToken = hasToken;
        } else if (tokenVal.includes('No Token')) {
            matchesToken = !hasToken;
        } else if (tokenVal.includes('Expired Token')) {
            matchesToken = admin.reset_expires_at && new Date(admin.reset_expires_at) < new Date();
        }

        return matchesSearch && matchesRole && matchesStatus && matchesToken;
    });

    const totalPages = Math.ceil(currentFilteredAdmins.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedAdmins = currentFilteredAdmins.slice(startIndex, startIndex + pageSize);

    renderTable(paginatedAdmins);
    renderPaginationControls(currentFilteredAdmins.length);
}

function renderTable(admins) {
    const tbody = document.querySelector('table tbody');
    let mobileContainer = document.getElementById('mobile-admins-container');

    if (!tbody) return;
    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    if (admins.length === 0) {
        const emptyMsg = `<tr><td colspan="7" class="py-8 text-center text-on-surface-variant italic">No administrators found matching the criteria.</td></tr>`;
        tbody.innerHTML = emptyMsg;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="py-8 text-center text-on-surface-variant italic">No administrators found matching the criteria.</div>`;
        return;
    }

    admins.forEach(admin => {
        const initials = admin.name ? admin.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD';
        const isActive = Number(admin.is_active) === 1;
        const hasToken = admin.reset_code && admin.reset_code !== 'None' && admin.reset_code !== '';

        const tr = document.createElement('tr');
        tr.className = `hover:bg-surface-container-low/30 transition-colors group ${!isActive ? 'opacity-75' : ''} ${hasToken ? 'bg-tertiary-fixed/5' : ''}`;

        tr.innerHTML = `
            <td class="py-4 px-5">
                <div class="flex items-center space-x-3">
                    <div class="w-9 h-9 rounded-full bg-surface-warm border border-outline-variant/30 flex items-center justify-center font-bold text-[12px] text-primary">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-medium text-primary text-body-md">${escapeHTML(admin.name)}</p>
                        <p class="text-on-surface-variant text-[12px]">${escapeHTML(admin.email)}</p>
                    </div>
                </div>
            </td>
            <td class="py-4 px-5 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-1 rounded-DEFAULT text-[11px] font-medium ${admin.role === 'ADMIN' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'} font-label-caps uppercase tracking-wider">
                    ${escapeHTML(admin.role)}
                </span>
            </td>
            <td class="py-4 px-5 whitespace-nowrap font-mono text-[12px] text-on-surface-variant">
                <div class="flex items-center gap-1.5">
                    <span class="tracking-widest text-primary">••••••••••••</span>
                    <span class="text-[10px] text-on-surface-variant/70 font-sans border border-outline-variant/40 px-1 rounded">bcrypt</span>
                </div>
            </td>
            <td class="py-4 px-5 whitespace-nowrap text-on-surface-variant text-[13px]">
                ${hasToken ? `<span class="inline-flex items-center gap-1 text-[11px] font-medium bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 py-0.5 rounded-full border border-tertiary-fixed-dim/30">Active (${escapeHTML(admin.reset_code)})</span>` : '<span class="text-outline-muted italic">None</span>'}
            </td>
            <td class="py-4 px-5 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium ${isActive ? 'bg-primary-fixed text-primary-container border border-primary-fixed-dim/30' : 'bg-surface-container-highest text-secondary border border-outline-variant/40'}">
                    <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary-container' : 'bg-secondary'}"></span> ${isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="py-4 px-5 whitespace-nowrap text-[12px] text-on-surface-variant">
                <p><span class="font-medium text-primary">Created:</span> ${formatDate(admin.created_at)}</p>
                <p class="text-on-surface-variant/80"><span class="font-medium text-primary">Updated:</span> ${formatDate(admin.updated_at)}</p>
            </td>
            <td class="py-4 px-5 text-right whitespace-nowrap">
                <div class="flex justify-end space-x-1">
                    <button class="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded transition-colors btn-edit" data-id="${admin.id}" title="Edit Administrator">
                        <span class="material-symbols-outlined text-[19px]">edit</span>
                    </button>
                    <button class="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded transition-colors btn-status" data-id="${admin.id}" data-active="${admin.is_active}" title="Toggle Status">
                        <span class="material-symbols-outlined text-[19px]">toggle_on</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        if (mobileContainer) {
            const cardDiv = document.createElement('div');
            cardDiv.className = `p-5 space-y-4 hover:bg-surface-warm/50 transition-colors border-b border-outline-variant/20 ${!isActive ? 'opacity-75' : ''} ${hasToken ? 'bg-tertiary-fixed/5' : ''}`;

            cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-DEFAULT text-[11px] font-medium ${admin.role === 'ADMIN' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'} font-label-caps uppercase tracking-wider">
                        ${escapeHTML(admin.role)}
                    </span>
                    <div>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium ${isActive ? 'bg-primary-fixed text-primary-container border border-primary-fixed-dim/30' : 'bg-surface-container-highest text-secondary border border-outline-variant/40'}">
                            <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary-container' : 'bg-secondary'}"></span> ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>

                <div class="flex items-center space-x-3 pt-1">
                    <div class="w-10 h-10 rounded-full bg-surface-warm border border-outline-variant/30 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-semibold text-primary text-sm">${escapeHTML(admin.name)}</p>
                        <p class="text-on-surface-variant text-xs">${escapeHTML(admin.email)}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-outline-variant/10">
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Reset Token</span>
                        <span class="text-xs">${hasToken ? `<span class="text-accent-rust font-medium">Active (${escapeHTML(admin.reset_code)})</span>` : '<span class="text-outline-muted italic">None</span>'}</span>
                    </div>
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">Timestamps</span>
                        <span class="text-[11px] text-on-surface-variant block">C: ${formatDate(admin.created_at)}</span>
                        <span class="text-[11px] text-on-surface-variant block">U: ${formatDate(admin.updated_at)}</span>
                    </div>
                </div>

                <div class="pt-2 flex gap-2">
                    <button class="flex-1 py-2 px-3 rounded-lg bg-surface-container text-primary font-label-caps text-xs flex items-center justify-center gap-1 hover:bg-primary hover:text-on-primary transition-all btn-edit" data-id="${admin.id}">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                        <span>Edit</span>
                    </button>
                    <button class="flex-1 py-2 px-3 rounded-lg bg-surface-container-high text-on-surface font-label-caps text-xs flex items-center justify-center gap-1 hover:bg-surface-variant transition-all btn-status" data-id="${admin.id}" data-active="${admin.is_active}">
                        <span class="material-symbols-outlined text-[16px]">toggle_on</span>
                        <span>Toggle Status</span>
                    </button>
                </div>
            `;
            mobileContainer.appendChild(cardDiv);
        }
    });

    attachTableActionListeners();
}
function renderPaginationControls(totalItems) {
    const infoSpan = document.getElementById('pagination-info');
    const container = document.getElementById('pagination-buttons');
    if (!infoSpan || !container) return;

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    infoSpan.textContent = `Showing ${startItem} to ${endItem} of ${totalItems} administrators`;

    let html = `
        <button class="p-1 text-on-surface-variant hover:text-primary transition-colors ${currentPage === 1 ? 'text-outline-muted cursor-not-allowed' : ''}" 
                id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="w-7 h-7 rounded bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center">${i}</button>`;
        } else {
            html += `<button class="w-7 h-7 rounded text-on-surface-variant hover:bg-surface-container-low text-[12px] flex items-center justify-center page-number" data-page="${i}">${i}</button>`;
        }
    }

    html += `
        <button class="p-1 text-on-surface-variant hover:text-primary transition-colors ${currentPage === totalPages || totalPages === 0 ? 'text-outline-muted cursor-not-allowed' : ''}" 
                id="next-page" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
    `;

    container.innerHTML = html;

    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                applyFiltersAndPagination();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                applyFiltersAndPagination();
            }
        });
    }

    document.querySelectorAll('.page-number').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentPage = Number(e.currentTarget.getAttribute('data-page'));
            applyFiltersAndPagination();
        });
    });
}

function setupFilters() {
    const searchInput = document.querySelector('input[placeholder*="Search"]');
    const selects = document.querySelectorAll('select');
    const roleSelect = selects[0];
    const statusSelect = selects[1];
    const tokenSelect = selects[2];

    const triggerFilter = () => {
        currentPage = 1;
        applyFiltersAndPagination();
    };

    if (searchInput) searchInput.addEventListener('input', triggerFilter);
    if (roleSelect) roleSelect.addEventListener('change', triggerFilter);
    if (statusSelect) statusSelect.addEventListener('change', triggerFilter);
    if (tokenSelect) tokenSelect.addEventListener('change', triggerFilter);

    const clearBtn = document.querySelector('button[title="Clear filters"]');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (roleSelect) roleSelect.selectedIndex = 0;
            if (statusSelect) statusSelect.selectedIndex = 0;
            if (tokenSelect) tokenSelect.selectedIndex = 0;
            currentPage = 1;
            applyFiltersAndPagination();
        });
    }
}

function setupEventListeners() {
    const btnIssueReset = document.getElementById('btnIssueReset');
    if (btnIssueReset) {
        btnIssueReset.addEventListener('click', async () => {
            if (!currentEditingId) {
                Modal.warning('You must select an administrator to issue a reset link.', 'No Admin Selected');
                return;
            }

            try {
                const response = await API.admins.issueResetToken(currentEditingId);

                Modal.success('Password reset link issued successfully!', 'Token Generated');

                const responseData = response.data || response;

                if (responseData && responseData.reset_code) {
                    const modal = document.querySelector('div.fixed.inset-0.z-50');
                    if (modal) {
                        const inputs = modal.querySelectorAll('.bg-surface-warm\\/50 input');
                        if (inputs.length >= 2) {
                            inputs[0].value = responseData.reset_code;
                            inputs[1].value = responseData.reset_expires_at || 'In 2 hours';
                        }
                    }
                }

                await loadAdminsData();
            } catch (error) {
                Modal.error('Failed to issue reset link: ' + (error.message || 'Unknown error'), 'Error');
            }
        });
    }
    const printBtn = document.getElementById('printAdminsBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
    const modal = document.querySelector('div.fixed.inset-0.z-50');
    if (!modal) return;

    modal.classList.add('hidden');

    const btnNew = document.querySelector('header a[href="admin-reservation.html"]') || document.querySelector('header button:not(.border)');
    if (btnNew) {
        btnNew.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }

    const closeElements = modal.querySelectorAll('button.p-1\\.5, button.border');
    closeElements.forEach(el => el.addEventListener('click', closeModal));

    const footerButtons = modal.querySelectorAll('.border-t button');
    const actualSaveBtn = footerButtons[footerButtons.length - 1];

    if (actualSaveBtn) {
        actualSaveBtn.addEventListener('click', async () => {
            await saveAdminForm();
        });
    }

    const toggleBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('modal-password');
    const passwordIcon = document.getElementById('togglePasswordIcon');

    if (toggleBtn && passwordInput && passwordIcon) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            passwordIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
        });
    }

    const btnGenerate = document.getElementById('generatePasswordBtn');
    if (btnGenerate && passwordInput) {
        btnGenerate.addEventListener('click', () => {
            const securePassword = generateSecurePassword();
            passwordInput.value = securePassword;
            passwordInput.type = 'text';
            if (passwordIcon) passwordIcon.textContent = 'visibility_off';
            setTimeout(() => {
                passwordInput.type = 'password';
                if (passwordIcon) passwordIcon.textContent = 'visibility';
            }, 2000);
        });
    }
}

function openModal(admin = null) {
    const modal = document.querySelector('div.fixed.inset-0.z-50');
    if (!modal) return;

    currentEditingId = admin ? admin.id : null;

    const title = modal.querySelector('h3');
    if (title) title.textContent = admin ? 'Edit Administrator' : 'New Administrator';

    const inputs = modal.querySelectorAll('input:not([readonly]), select');
    if (inputs.length >= 4) {
        inputs[0].value = admin ? admin.name : '';
        inputs[1].value = admin ? admin.email : '';
        inputs[2].value = '';
        inputs[3].value = admin ? admin.role : 'ADMIN';
    }

    const resetInputs = modal.querySelectorAll('.bg-surface-warm\\/50 input');
    if (resetInputs.length >= 2) {
        if (admin && admin.reset_code && admin.reset_code !== 'None') {
            resetInputs[0].value = admin.reset_code;
            resetInputs[1].value = admin.reset_expires_at || '—';
        } else {
            resetInputs[0].value = 'None (No pending token)';
            resetInputs[1].value = '—';
        }
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.querySelector('div.fixed.inset-0.z-50');
    if (modal) modal.classList.add('hidden');
    currentEditingId = null;
}

async function saveAdminForm() {
    const modal = document.querySelector('div.fixed.inset-0.z-50');
    const inputs = modal.querySelectorAll('input:not([readonly]), select');

    const payload = {
        name: inputs[0].value.trim(),
        email: inputs[1].value.trim(),
        password: inputs[2].value.trim(),
        role: inputs[3].value,
        is_active: 1
    };

    if (!payload.name || !payload.email) {
        Modal.warning('Please fill in all required fields.', 'Missing Fields');
        return;
    }

    if (!currentEditingId && !payload.password) {
        Modal.warning('Password is required for new administrators.', 'Missing Password');
        return;
    }

    try {
        if (currentEditingId) {
            if (!payload.password) delete payload.password;
            await API.admins.update(currentEditingId, payload);
            Modal.success('Administrator updated successfully!', 'Updated');
        } else {
            await API.admins.create(payload);
            Modal.success('Administrator created successfully!', 'Created');
        }
        closeModal();
        await loadAdminsData();
    } catch (error) {
        Modal.error('Error saving administrator: ' + error.message, 'Operation Failed');
    }
}

function attachTableActionListeners() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const admin = allAdmins.find(a => String(a.id) === String(id));
            if (admin) openModal(admin);
        });
    });

    document.querySelectorAll('.btn-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const currentActive = e.currentTarget.getAttribute('data-active');
            const newActive = Number(currentActive) === 1 ? 0 : 1;
            try {
                await API.admins.update(id, { is_active: newActive });
                await loadAdminsData();
            } catch (err) {
                Modal.error('Failed to toggle administrator status.', 'Error');
            }
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');

            Modal.show({
                type: 'danger',
                title: 'Delete Administrator',
                message: 'Are you sure you want to delete this administrator? This action cannot be undone.',
                confirmText: 'Delete',
                showCancel: true,
                onConfirm: async () => {
                    try {
                        await API.admins.delete(id);
                        await loadAdminsData();
                        Modal.success('Administrator deleted successfully.', 'Deleted');
                    } catch (err) {
                        Modal.error('Failed to delete administrator.', 'Error');
                    }
                }
            });
        });
    });
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}