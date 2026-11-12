import { API } from './api.js';

/**
 * Admin actions for one reservation, shared by the Reservations list, the Dashboard and the Calendar.
 * The buttons shown depend on the status, mirroring the rules enforced by the API (BookingRules.php):
 *
 *   PENDING → QUOTED → CONFIRMED → ON_THE_WAY → INITIATED → COMPLETED
 *   RESCHEDULED = new date waiting for confirmation · CANCELLED / REJECTED / COMPLETED = closed
 *
 * Every action is two steps (choose → review → send) so no email goes out by accident.
 */

const ACTIONS = {
    quote: {
        to: 'QUOTED', icon: 'payments', needs: 'price', style: 'primary-soft',
        label: (r) => Number(r.total_price) > 0 ? 'Send new quote' : 'Send quote',
        help: 'The customer receives the price with Confirm, Reschedule and Cancel buttons. Nothing is booked until they confirm.',
        send: 'Send quote',
    },
    confirm: {
        to: 'CONFIRMED', icon: 'event_available', needs: 'price-if-missing', style: 'primary',
        label: (r) => r.status === 'RESCHEDULED' ? 'Confirm new date' : 'Confirm booking',
        help: (r) => r.status === 'RESCHEDULED'
            ? 'Confirms the new date. The customer and the assigned cleaner are emailed.'
            : 'Use this when the customer accepted by phone or message. The booking becomes confirmed, the customer gets the confirmation and the assigned cleaner gets the job.',
        send: 'Confirm',
    },
    reschedule: {
        to: 'RESCHEDULED', icon: 'event_repeat', needs: 'date', style: 'neutral',
        label: () => 'Reschedule',
        help: (r) => Number(r.total_price) > 0
            ? 'The customer is asked to confirm the new date. If a cleaner was already going, they are told to hold until it is confirmed.'
            : 'The customer is told about the new date; send the quote afterwards.',
        send: 'Send new date',
    },
    complete: {
        to: 'COMPLETED', icon: 'task_alt', needs: null, style: 'neutral',
        label: () => 'Mark completed',
        help: 'Use only if the cleaner could not close the job. The customer is asked to rate the service.',
        send: 'Mark completed',
    },
    cancel: {
        to: 'CANCELLED', icon: 'event_busy', needs: 'reason', style: 'danger',
        label: () => 'Cancel',
        help: 'For a booking that will not happen (customer asked by phone, emergency...). The reason is included in the email to the customer; the cleaner is told not to go.',
        send: 'Cancel reservation',
        reasonLabel: 'Reason (sent to the customer)',
    },
    reject: {
        to: 'REJECTED', icon: 'block', needs: 'reason', style: 'danger',
        label: () => 'Reject request',
        help: 'For a request we cannot take (fully booked, outside our area...). The reason is included in the email to the customer.',
        send: 'Reject request',
        reasonLabel: 'Reason (sent to the customer)',
    },
};

const BY_STATUS = {
    PENDING:     ['quote', 'confirm', 'reschedule', 'reject', 'cancel'],
    QUOTED:      ['confirm', 'quote', 'reschedule', 'reject', 'cancel'],
    RESCHEDULED: ['confirm', 'reschedule', 'quote', 'reject', 'cancel'],
    CONFIRMED:   ['reschedule', 'quote', 'complete', 'cancel'],
    ON_THE_WAY:  ['complete', 'cancel'],
    INITIATED:   ['complete'],
};

const NEXT_STEP = {
    PENDING: 'New request: send a quote, or reject it.',
    QUOTED: 'Quote sent. Waiting for the customer to press Confirm.',
    RESCHEDULED: 'Date change waiting for confirmation. If the customer asked for it, check availability and confirm it.',
    CONFIRMED: 'Booked. The assigned cleaner will mark On the way / Started / Completed.',
    ON_THE_WAY: 'The cleaner is on the way.',
    INITIATED: 'The cleaning is in progress.',
    COMPLETED: 'Completed. This reservation is closed.',
    CANCELLED: 'Cancelled. This reservation is closed.',
    REJECTED: 'Rejected. This reservation is closed.',
};

const CLOSED = ['COMPLETED', 'CANCELLED', 'REJECTED'];

const STYLES = {
    primary: 'bg-primary text-on-primary border-primary hover:bg-primary/90',
    'primary-soft': 'bg-primary-fixed text-primary-container border-primary-fixed hover:bg-primary-fixed/80',
    neutral: 'bg-surface-container text-on-surface border-outline-variant/50 hover:bg-surface-variant',
    danger: 'bg-transparent text-error border-error/30 hover:bg-error-container',
};

export const STATUS_LABELS = {
    PENDING: 'Pending', QUOTED: 'Quote sent', CONFIRMED: 'Confirmed', ON_THE_WAY: 'On the way',
    INITIATED: 'In progress', RESCHEDULED: 'Rescheduled', COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected',
};

export function statusBadgeClass(status) {
    switch (status) {
        case 'PENDING': return 'bg-tertiary-fixed text-tertiary-container';
        case 'QUOTED': return 'bg-orange-100 text-orange-800';
        case 'CONFIRMED': return 'bg-primary-fixed text-primary-container';
        case 'INITIATED': return 'bg-blue-100 text-blue-800';
        case 'ON_THE_WAY': return 'bg-amber-100 text-amber-800';
        case 'RESCHEDULED': return 'bg-purple-100 text-purple-800';
        case 'COMPLETED': return 'bg-emerald-100 text-emerald-800';
        case 'CANCELLED': return 'bg-error-container text-on-error-container';
        case 'REJECTED': return 'bg-surface-variant text-on-surface-variant border border-outline-variant/55';
        default: return 'bg-surface-variant text-on-surface-variant';
    }
}

export function statusBadge(status) {
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-label-caps tracking-wide ${statusBadgeClass(status)}">${escapeHTML(STATUS_LABELS[status] || status || '')}</span>`;
}

/** "Fri, Nov 20, 2026 · 10:00 AM" */
export function formatDateTime(dateStr, timeStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(`${dateStr}T${(timeStr || '00:00').substring(0, 5)}:00`);
    if (isNaN(d)) return dateStr;
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return timeStr ? `${date} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : date;
}

/**
 * Renders the staff picker + status actions into `container`.
 * @param {HTMLElement} container
 * @param {object} res reservation row from the API
 * @param {{staffList?: Array, onDone: (message: string) => void}} opts
 */
export function renderReservationActions(container, res, { staffList = [], onDone }) {
    const status = res.status || 'PENDING';
    const closed = CLOSED.includes(status);
    const actions = BY_STATUS[status] || [];
    const hasPrice = Number(res.total_price) > 0;
    const staffOptions = staffList
        .filter(u => u.is_active === undefined || Number(u.is_active) === 1)
        .map(u => `<option value="${u.id}" ${String(u.id) === String(res.staff_id || '') ? 'selected' : ''}>${escapeHTML(u.name)} (${escapeHTML(u.role || 'STAFF')})</option>`)
        .join('');

    container.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex items-start gap-2 p-3 rounded-lg bg-surface-container-low text-sm text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-primary">info</span>
                <span>${escapeHTML(NEXT_STEP[status] || '')}</span>
            </div>
            <div data-ra="error" role="alert" class="hidden p-3 rounded-lg bg-error-container text-on-error-container text-sm"></div>

            ${closed ? '' : `
            <div class="flex flex-col gap-2">
                <label class="text-xs font-label-caps text-outline uppercase">Assigned cleaner</label>
                <div class="flex gap-2">
                    <select data-ra="staff" class="flex-1 min-w-0 px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface font-body-md text-on-surface">
                        <option value="">-- Unassigned --</option>${staffOptions}
                    </select>
                    <button type="button" data-ra="assign" class="px-4 py-3 rounded-lg border border-primary bg-primary text-on-primary font-label-caps text-label-caps hover:bg-primary/90 transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-sm">person_add</span> Save
                    </button>
                </div>
                <p class="text-xs text-outline">${['CONFIRMED', 'ON_THE_WAY', 'INITIATED'].includes(status)
                    ? 'The cleaner is emailed when assigned or removed.'
                    : 'The cleaner is emailed only once the booking is confirmed.'}</p>
            </div>`}

            <div data-ra="form" class="hidden flex-col gap-3 p-4 rounded-xl bg-surface-variant/30 border border-outline-variant/30">
                <p data-ra="help" class="text-sm text-on-surface-variant"></p>
                <div data-ra="price-wrap" class="hidden flex-col gap-1.5">
                    <label class="text-xs font-label-caps text-primary font-bold uppercase">Price ($)</label>
                    <input data-ra="price" type="number" min="1" step="0.01" placeholder="e.g. 150.00" value="${hasPrice ? Number(res.total_price).toFixed(2) : ''}"
                        class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface font-body-md">
                </div>
                <div data-ra="date-wrap" class="hidden grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-label-caps text-primary font-bold uppercase">New date</label>
                        <input data-ra="date" type="date" min="${todayISO()}" value="${escapeHTML(res.service_date || '')}"
                            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface font-body-md">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-label-caps text-primary font-bold uppercase">Time</label>
                        <input data-ra="time" type="time" value="${escapeHTML((res.preferred_time || '09:00').substring(0, 5))}"
                            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface font-body-md">
                    </div>
                </div>
                <div data-ra="reason-wrap" class="hidden flex-col gap-1.5">
                    <label data-ra="reason-label" class="text-xs font-label-caps text-error font-bold uppercase"></label>
                    <textarea data-ra="reason" rows="2" maxlength="500" placeholder="e.g. We are fully booked that week."
                        class="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface font-body-md resize-none"></textarea>
                </div>
                <div class="flex flex-wrap gap-2 justify-end">
                    <button type="button" data-ra="back" class="px-4 py-2.5 rounded-lg border border-outline-variant/50 font-label-caps text-label-caps hover:bg-surface-variant cursor-pointer">Back</button>
                    <button type="button" data-ra="send" class="px-5 py-2.5 rounded-lg border font-label-caps text-label-caps flex items-center gap-2 cursor-pointer"></button>
                </div>
            </div>

            <div data-ra="buttons" class="flex flex-wrap gap-3 justify-end">
                ${actions.map(key => {
                    const a = ACTIONS[key];
                    return `<button type="button" data-action="${key}" class="px-5 py-2.5 rounded-lg border ${STYLES[a.style]} font-label-caps text-label-caps transition-all flex items-center gap-2 cursor-pointer">
                        <span class="material-symbols-outlined text-sm">${a.icon}</span> ${escapeHTML(a.label(res))}</button>`;
                }).join('')}
            </div>
        </div>`;

    const $ = (name) => container.querySelector(`[data-ra="${name}"]`);
    const form = $('form');
    const buttons = $('buttons');
    let current = null;

    const show = (el, on) => { el.classList.toggle('hidden', !on); el.classList.toggle('flex', on && !el.classList.contains('grid')); };

    const fail = (message) => {
        const box = $('error');
        box.textContent = message;
        box.classList.remove('hidden');
        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const clearError = () => $('error').classList.add('hidden');

    const open = (key) => {
        clearError();
        current = key;
        const a = ACTIONS[key];
        $('help').textContent = typeof a.help === 'function' ? a.help(res) : a.help;
        show($('price-wrap'), a.needs === 'price' || (a.needs === 'price-if-missing' && !hasPrice));
        $('date-wrap').classList.toggle('hidden', a.needs !== 'date');
        show($('reason-wrap'), a.needs === 'reason');
        $('reason-label').textContent = a.reasonLabel || 'Reason';
        const send = $('send');
        send.className = `px-5 py-2.5 rounded-lg border ${STYLES[a.style === 'primary-soft' ? 'primary' : a.style]} font-label-caps text-label-caps flex items-center gap-2 cursor-pointer`;
        send.innerHTML = `<span class="material-symbols-outlined text-sm">send</span> ${escapeHTML(a.send)}`;
        show(form, true);
        buttons.classList.add('hidden');
        const firstField = [...form.querySelectorAll('input, textarea')].find(el => el.offsetParent !== null);
        (firstField || send).focus();
    };

    const close = () => {
        clearError();
        current = null;
        show(form, false);
        buttons.classList.remove('hidden');
    };

    const submit = async (payload, button) => {
        button.disabled = true;
        button.classList.add('opacity-50');
        const { _message, ...body } = payload;
        try {
            await API.reservations.update(res.id, body);
            onDone(_message);
        } catch (err) {
            fail(err.message || 'Could not update the reservation.');
        } finally {
            button.disabled = false;
            button.classList.remove('opacity-50');
        }
    };

    buttons.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => open(btn.dataset.action)));
    $('back').addEventListener('click', close);

    $('send').addEventListener('click', (e) => {
        const a = ACTIONS[current];
        const payload = { status: a.to };

        if (a.needs === 'price' || (a.needs === 'price-if-missing' && !hasPrice)) {
            const price = Number($('price').value);
            if (!(price > 0)) return fail('Please enter a price greater than $0.');
            payload.total_price = price;
            payload.comment = `${a.send}: $${price.toFixed(2)}`;
        }
        if (a.needs === 'date') {
            const date = $('date').value;
            const time = $('time').value;
            if (!date || !time) return fail('Please choose the new date and time.');
            if (date === res.service_date && time === (res.preferred_time || '').substring(0, 5)) {
                return fail('Choose a different date or time.');
            }
            payload.service_date = date;
            payload.preferred_time = `${time}:00`;
            payload.comment = `Rescheduled by admin to ${date} ${time}`;
        }
        if (a.needs === 'reason') {
            const reason = $('reason').value.trim();
            if (!reason) return fail('Please write the reason. It is included in the email to the customer.');
            payload.reason = reason;
            payload.comment = `${a.send} by admin.`;
        }
        payload.comment = payload.comment || `${a.send} by admin`;
        payload._message = {
            QUOTED: 'Quote sent to the customer.',
            CONFIRMED: 'Booking confirmed. The customer and the assigned cleaner have been emailed.',
            RESCHEDULED: 'New date sent to the customer.',
            COMPLETED: 'Marked as completed. The customer has been asked for a rating.',
            CANCELLED: 'Reservation cancelled. The customer has been emailed.',
            REJECTED: 'Request rejected. The customer has been emailed.',
        }[a.to];
        submit(payload, e.currentTarget);
    });

    const assign = $('assign');
    if (assign) {
        assign.addEventListener('click', (e) => {
            const value = $('staff').value;
            if (String(value) === String(res.staff_id || '')) return fail('That cleaner is already assigned.');
            submit({
                status,
                staff_id: value ? Number(value) : null,
                comment: value ? `Assigned cleaner #${value}` : 'Cleaner unassigned',
                _message: value ? 'Cleaner assigned.' : 'Cleaner removed from this job.',
            }, e.currentTarget);
        });
    }
}

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
