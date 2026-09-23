import { API } from './api.js';
import { Modal } from './modal.js';

let blockedSpecificDates = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadSystemSchedule();
    setupSpecificDateManager();
    setupScheduleFormSubmit();
});

async function loadSystemSchedule() {
    try {
        const response = await API.systemSchedule.get();
        console.log("Datos recibidos del backend:", response);

        if (!response) return;

        const data = response.data || response;

        let rawDays = data.global_blocked_days || [];
        if (typeof rawDays === 'string') {
            try { rawDays = JSON.parse(rawDays); } catch (e) { rawDays = []; }
        }
        const blockedDaysArray = Array.isArray(rawDays) ? rawDays.map(String) : [];
        
        document.querySelectorAll('input[name="global_blocked_days"]').forEach(cb => {
            cb.checked = blockedDaysArray.includes(String(cb.value));
        });

        document.getElementById('globalBlockTimeStart').value = data.global_block_time_start || '';
        document.getElementById('globalBlockTimeEnd').value = data.global_block_time_end || '';

        let rawDates = data.blocked_specific_dates || [];
        if (typeof rawDates === 'string') {
            try { rawDates = JSON.parse(rawDates); } catch (e) { rawDates = []; }
        }
        
        blockedSpecificDates = Array.isArray(rawDates) ? rawDates : [];
        renderBlockedDatesTable();

    } catch (error) {
        console.error('Error loading system schedule:', error);
        Modal.error('Failed to load global system schedule settings.', 'Connection Error');
    }
}

function setupSpecificDateManager() {
    const btnAdd = document.getElementById('btnAddSpecificDate');
    const dateInput = document.getElementById('specificDateInput');

    if (!btnAdd || !dateInput) return;

    btnAdd.addEventListener('click', () => {
        const val = dateInput.value;
        if (!val) {
            Modal.error('Please select a valid date from the calendar.', 'Validation Error');
            return;
        }

        if (!blockedSpecificDates.includes(val)) {
            blockedSpecificDates.push(val);
            blockedSpecificDates.sort();
            renderBlockedDatesTable();
        } else {
            Modal.error('This date is already added to the restriction list.', 'Duplicate Date');
        }
        dateInput.value = '';
    });
}

function renderBlockedDatesTable() {
    const tbody = document.getElementById('blockedDatesTableBody');
    if (!tbody) return;

    if (blockedSpecificDates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-6 text-center text-on-surface-variant italic text-xs">
                    No specific blocked dates found. Add one above.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    blockedSpecificDates.forEach((dateStr, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low/50 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-4 font-medium text-on-surface-variant">${index + 1}</td>
            <td class="py-3 px-4 font-semibold text-primary flex items-center gap-2">
                <span class="material-symbols-outlined text-sm text-on-surface-variant">calendar_month</span>
                ${dateStr}
            </td>
            <td class="py-3 px-4 text-right">
                <button type="button" class="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors remove-date-btn cursor-pointer" data-index="${index}">
                    <span class="material-symbols-outlined text-[16px]">delete</span> Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Activar eventos de eliminación para cada fila de la tabla
    tbody.querySelectorAll('.remove-date-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            blockedSpecificDates.splice(idx, 1);
            renderBlockedDatesTable();
        });
    });
}

function setupScheduleFormSubmit() {
    const form = document.getElementById('systemScheduleForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const checkedDays = Array.from(document.querySelectorAll('input[name="global_blocked_days"]:checked'))
            .map(cb => cb.value);

        const startTime = document.getElementById('globalBlockTimeStart').value;
        const endTime = document.getElementById('globalBlockTimeEnd').value;

        const payload = {
            global_blocked_days: checkedDays,
            global_block_time_start: startTime || '',
            global_block_time_end: endTime || '',
            blocked_specific_dates: blockedSpecificDates
        };

        const submitBtn = document.getElementById('btnSaveSchedule');
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            await API.systemSchedule.save(payload);
            Modal.show({
                type: 'success',
                title: 'Schedule Updated',
                message: 'Global system availability restrictions and specific calendar dates have been successfully saved.',
                confirmText: 'OK',
                showCancel: false
            });
        } catch (error) {
            console.error(error);
            Modal.error(error.message || 'Failed to save system schedule.', 'Error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}