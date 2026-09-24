import { API } from './api.js';
import { Modal } from './modal.js';

document.addEventListener('DOMContentLoaded', () => {
    loadZones();
    setupForm();

    const btnNewZone = document.getElementById('btnNewZone');
    if (btnNewZone) {
        btnNewZone.addEventListener('click', () => {
            openZoneModal();
        });
    }
});

async function loadZones() {
    const tbody = document.getElementById('zonesTableBody');
    const mobileContainer = document.getElementById('mobile-zones-container');
    
    try {
        const response = await API.serviceZones.getAll();
        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.service_zones || [];
        }
        const zones = Array.isArray(rawData) ? rawData : [];
        
        if (tbody) tbody.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';

        if (zones.length === 0) {
            const emptyMsg = `<tr><td colspan="5" class="py-6 text-center text-on-surface-variant">No service zones registered.</td></tr>`;
            if (tbody) tbody.innerHTML = emptyMsg;
            if (mobileContainer) mobileContainer.innerHTML = `<div class="p-6 text-center text-on-surface-variant">No service zones registered.</div>`;
            return;
        }

        if (tbody) {
            zones.forEach(z => {
                const areasList = z.areas ? z.areas.map(a => `<span class="px-2 py-0.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs font-medium text-primary">${a.area_name}</span>`).join(' ') : 'No areas';

                tbody.innerHTML += `
                    <tr class="hover:bg-surface-warm/5 transition-colors">
                        <td class="py-4 px-6 text-sm font-bold text-primary">#ZONE-${z.id}</td>
                        <td class="py-4 px-6 text-sm font-medium text-on-background">${z.city_name}</td>
                        <td class="py-4 px-6 text-sm text-on-surface-variant font-bold">${z.state_code}</td>
                        <td class="py-4 px-6 text-sm flex flex-wrap gap-1.5 max-w-md">${areasList}</td>
                        <td class="py-4 px-6 text-sm text-right space-x-2">
                            <button onclick='editZone(${JSON.stringify(z)})' class="p-1.5 bg-primary-fixed/30 text-primary rounded hover:bg-primary-fixed transition-colors">
                                <span class="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button onclick="deleteZone(${z.id})" class="p-1.5 bg-error-container text-error rounded hover:bg-error/20 transition-colors">
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        if (mobileContainer) {
            zones.forEach(z => {
                const areasList = z.areas ? z.areas.map(a => `<span class="px-2 py-0.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs font-medium text-primary">${a.area_name}</span>`).join(' ') : 'No areas';

                const cardDiv = document.createElement('div');
                cardDiv.className = 'p-5 space-y-4 hover:bg-surface-warm/50 transition-colors';
                cardDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-medium text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md">#ZONE-${z.id}</span>
                        <span class="font-bold text-sm text-on-surface-variant">${z.state_code}</span>
                    </div>
                    
                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider">City / Region</span>
                        <span class="font-semibold text-primary text-base">${z.city_name}</span>
                    </div>

                    <div>
                        <span class="block text-[11px] font-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">Allowed Areas</span>
                        <div class="flex flex-wrap gap-1.5">${areasList}</div>
                    </div>

                    <div class="pt-2 flex justify-end gap-2">
                        <button onclick='editZone(${JSON.stringify(z)})' class="flex-1 py-2 px-3 rounded-lg bg-surface-container text-primary font-label-caps text-xs flex items-center justify-center gap-1.5 hover:bg-primary hover:text-on-primary transition-all">
                            <span class="material-symbols-outlined text-sm">edit</span>
                            <span>Edit</span>
                        </button>
                        <button onclick="deleteZone(${z.id})" class="py-2 px-3 rounded-lg bg-error-container text-error font-label-caps text-xs flex items-center justify-center gap-1.5 hover:bg-error hover:text-on-error transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span>
                            <span>Delete</span>
                        </button>
                    </div>
                `;
                mobileContainer.appendChild(cardDiv);
            });
        }

    } catch (err) {
        console.error(err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-error">Failed to load service zones.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="p-6 text-center text-error">Failed to load service zones.</div>`;
    }
}

window.openZoneModal = function (zone = null) {
    document.getElementById('zoneModal').classList.remove('hidden');
    document.getElementById('zoneModal').classList.remove('pointer-events-none');
    if (zone) {
        document.getElementById('modalTitle').textContent = 'Edit Service Zone';
        document.getElementById('zoneId').value = zone.id;
        document.getElementById('cityName').value = zone.city_name;
        document.getElementById('stateCode').value = zone.state_code;
        document.getElementById('zoneAreas').value = zone.areas ? zone.areas.map(a => a.area_name).join('\n') : '';
    } else {
        document.getElementById('modalTitle').textContent = 'Add New Service Zone';
        document.getElementById('zoneForm').reset();
        document.getElementById('zoneId').value = '';
        document.getElementById('stateCode').value = 'VA';
    }
};

window.closeZoneModal = function () {
    document.getElementById('zoneModal').classList.add('hidden');
    document.getElementById('zoneModal').classList.add('pointer-events-none');
};

window.editZone = function (zone) {
    openZoneModal(zone);
};

window.deleteZone = async function (id) {
    Modal.show({
        type: 'warning',
        title: 'Delete Service Zone',
        message: 'Are you sure you want to delete this service zone and its neighborhoods?',
        confirmText: 'Delete',
        showCancel: true,
        onConfirm: async () => {
            try {
                await API.serviceZones.delete(id);
                loadZones();
                Modal.success('Service zone deleted successfully.', 'Deleted');
            } catch (err) {
                Modal.error('Error deleting zone: ' + err.message, 'Error');
            }
        }
    });
};

function setupForm() {
    const form = document.getElementById('zoneForm');

    const cancelButtons = document.querySelectorAll('#zoneModal button');
    cancelButtons.forEach(btn => {
        if (btn.textContent.trim() === 'Cancel') {
            btn.addEventListener('click', () => closeZoneModal());
        }
    });

    const closeIcon = document.getElementById('closeModalBtn') || document.querySelector('#zoneModal .material-symbols-outlined')?.closest('button');
    if (closeIcon) {
        closeIcon.addEventListener('click', () => closeZoneModal());
    }


    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('zoneId').value;
        const city_name = document.getElementById('cityName').value.trim();
        const state_code = document.getElementById('stateCode').value.trim();
        const rawAreas = document.getElementById('zoneAreas').value;

        const areas = rawAreas.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

        const payload = { city_name, state_code, areas };

        try {
            if (id) {
                await API.serviceZones.update(id, payload);
                Modal.success('Service zone updated successfully.', 'Updated');
            } else {
                await API.serviceZones.create(payload);
                Modal.success('Service zone created successfully.', 'Created');
            }
            closeZoneModal();
            loadZones();
        } catch (err) {
            Modal.error('Error saving zone: ' + err.message, 'Error');
        }
    });
}