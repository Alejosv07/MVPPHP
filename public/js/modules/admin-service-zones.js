import { API } from './js/modules/api.js';

document.addEventListener('DOMContentLoaded', () => {
    loadZones();
    setupForm();
});

async function loadZones() {
    const tbody = document.getElementById('zonesTableBody');
    try {
        const zones = await API.serviceZones.getAll();
        tbody.innerHTML = '';

        if (!zones || zones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-on-surface-variant">No service zones registered.</td></tr>`;
            return;
        }

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
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-error">Failed to load service zones.</td></tr>`;
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
    if (confirm('Are you sure you want to delete this service zone and its neighborhoods?')) {
        try {
            await API.serviceZones.delete(id);
            loadZones();
        } catch (err) {
            alert('Error deleting zone: ' + err.message);
        }
    }
};

function setupForm() {
    const form = document.getElementById('zoneForm');
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
            } else {
                await API.serviceZones.create(payload);
            }
            closeZoneModal();
            loadZones();
        } catch (err) {
            alert('Error saving zone: ' + err.message);
        }
    });
}