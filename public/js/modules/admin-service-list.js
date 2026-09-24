import { API } from './api.js';
import { Modal } from './modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadServices();
});

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    try {
        const response = await API.services.getAll();

        let rawData = response;

        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.services || [];
        }

        const services = Array.isArray(rawData) ? rawData : [];

        if (services.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 text-center text-on-surface-variant font-body-md">
                    No services found. Click "NEW SERVICE" to create one.
                </div>
            `;
            return;
        }

        grid.innerHTML = '';

        services.forEach(service => {
            const isActive =
                Number(service.is_active) === 1 ||
                service.status === 'ACTIVE';

            const price =
                service.price_per_hour ||
                service.price ||
                service.base_price ||
                0;

            const minHours =
                service.estimated_duration_hours ||
                service.min_hours ||
                service.duration ||
                1;

            const imageUrl = getImageUrl(service.image_url);

            const card = document.createElement('div');

            card.className =
                'bg-surface-container-lowest rounded-lg soft-shadow border border-outline-variant/30 flex flex-col h-full hover:border-primary/50 transition-colors overflow-hidden group';

            card.innerHTML = `
                <div class="w-full h-48 relative overflow-hidden bg-surface-container-high flex items-center justify-center border-b border-outline-variant/20">

                    ${imageUrl ? `
                        <img
                            src="${imageUrl}"
                            alt="${escapeHTML(service.name)}"
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ` : `
                        <div class="flex flex-col items-center justify-center text-on-surface-variant/60 text-sm font-medium">
                            <span class="material-symbols-outlined text-4xl mb-1">
                                image_not_supported
                            </span>
                            <span>No Image Uploaded</span>
                        </div>
                    `}

                    <div class="absolute top-3 right-3">
                        <span class="px-3 py-1 rounded-full font-label-caps text-label-caps backdrop-blur-md ${
                            isActive
                                ? 'bg-primary/90 text-on-primary'
                                : 'bg-surface-container-highest/90 text-on-surface-variant'
                        }">
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>

                <div class="p-6 flex flex-col flex-grow">

                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-headline-sm text-headline-sm text-on-surface">
                            ${escapeHTML(service.name)}
                        </h4>
                    </div>

                    <p class="font-body-md text-body-md text-on-surface-variant mb-6 flex-grow line-clamp-3">
                        ${escapeHTML(
                            service.description || 'No description provided.'
                        )}
                    </p>

                    <div class="flex justify-between items-center font-body-md text-body-md mb-6 pt-4 border-t border-surface-variant">

                        <span class="text-on-surface font-semibold text-lg">
                            $${Number(price).toFixed(2)}
                            <span class="text-xs text-on-surface-variant font-normal">
                                / hr
                            </span>
                        </span>

                        <span class="text-on-surface-variant flex items-center gap-1 text-sm">
                            <span class="material-symbols-outlined text-sm">
                                schedule
                            </span>

                            ${minHours} hrs min
                        </span>
                    </div>

                    <div class="flex gap-3">

                        <button
                            class="btn-view-details p-2 border border-outline-variant/50 hover:bg-surface-variant rounded text-on-surface-variant transition-colors"
                            title="View Details"
                        >
                            <span class="material-symbols-outlined text-[20px]">
                                visibility
                            </span>
                        </button>

                        <a
                            href="admin-services.html?id=${service.id}"
                            class="flex-1 bg-surface-container hover:bg-surface-variant text-on-surface font-label-caps text-label-caps py-2 rounded transition-colors text-center flex items-center justify-center"
                        >
                            Edit
                        </a>

                        <button
                            class="btn-toggle-status flex-1 border border-outline-variant/50 hover:bg-surface-variant text-on-surface-variant font-label-caps text-label-caps py-2 rounded transition-colors text-center"
                        >
                            ${isActive ? 'Deactivate' : 'Activate'}
                        </button>

                    </div>
                </div>
            `;

            const btnView = card.querySelector('.btn-view-details');

            if (btnView) {
                btnView.addEventListener('click', () => {
                    showServiceDetailsModal(service);
                });
            }

            const btnToggle = card.querySelector('.btn-toggle-status');

            if (btnToggle) {
                btnToggle.addEventListener('click', () => {
                    toggleServiceStatus(service, isActive);
                });
            }

            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading services:', error);

        Modal.error(
            error.message || 'Failed to load services list.',
            'Error'
        );
    }
}

function showServiceDetailsModal(service) {
    const isActive =
        Number(service.is_active) === 1 ||
        service.status === 'ACTIVE';

    const price =
        service.price_per_hour ||
        service.price ||
        service.base_price ||
        0;

    const minHours =
        service.estimated_duration_hours ||
        service.min_hours ||
        service.duration ||
        1;

    const imageUrl = getImageUrl(service.image_url);

    const htmlString = `
        <div class="space-y-4 text-left font-body-md text-body-md text-on-surface-variant">

            <div class="w-full h-48 rounded-lg overflow-hidden bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">

                ${imageUrl ? `
                    <img
                        src="${imageUrl}"
                        alt="${escapeHTML(service.name)}"
                        class="w-full h-full object-cover"
                    />
                ` : `
                    <div class="flex flex-col items-center justify-center text-on-surface-variant/60 text-sm font-medium">

                        <span class="material-symbols-outlined text-4xl mb-1">
                            image_not_supported
                        </span>

                        <span>No Image Available</span>

                    </div>
                `}

            </div>

            <div class="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-lg border border-outline-variant/20">

                <div>
                    <p class="font-label-caps text-[11px] text-outline-muted uppercase">
                        Service Name
                    </p>

                    <p class="font-medium text-on-background">
                        ${escapeHTML(service.name)}
                    </p>
                </div>

                <div>
                    <p class="font-label-caps text-[11px] text-outline-muted uppercase">
                        Status
                    </p>

                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${
                        isActive
                            ? 'bg-primary-fixed text-primary-container border-primary-fixed-dim/30'
                            : 'bg-surface-container-highest text-on-surface border-outline-variant/50'
                    }">
                        ${isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </div>

                <div>
                    <p class="font-label-caps text-[11px] text-outline-muted uppercase">
                        Rate per Hour
                    </p>

                    <p class="font-medium text-on-background">
                        $${Number(price).toFixed(2)} / hr
                    </p>
                </div>

                <div>
                    <p class="font-label-caps text-[11px] text-outline-muted uppercase">
                        Est. Duration
                    </p>

                    <p class="font-medium text-on-background">
                        ${minHours} Hours Min
                    </p>
                </div>

            </div>

            <div class="bg-surface-container-low p-4 rounded-lg border border-outline-variant/20">

                <p class="font-label-caps text-[11px] text-outline-muted uppercase mb-1">
                    Description
                </p>

                <p class="font-medium text-on-background">
                    ${escapeHTML(
                        service.description || 'No description provided.'
                    )}
                </p>

            </div>

        </div>
    `;

    Modal.show({
        type: 'info',
        title: `Service Details #${String(service.id).padStart(4, '0')}`,
        message: '',
        confirmText: 'Close',
        showCancel: false
    });

    const modalMessageEl =
        document.getElementById('modalMessage') ||
        document.querySelector('.modal-message') ||
        document.querySelector('[id*="modal"] p');

    if (modalMessageEl) {
        modalMessageEl.innerHTML = htmlString;
    }
}

async function toggleServiceStatus(service, currentIsActive) {
    const actionText = currentIsActive
        ? 'deactivate'
        : 'activate';

    const newStatus = currentIsActive ? 0 : 1;

    Modal.show({
        type: 'confirm',

        title: `${actionText.toUpperCase()} Service`,

        message: `Are you sure you want to ${actionText} "${service.name}"?`,

        confirmText: currentIsActive
            ? 'Deactivate'
            : 'Activate',

        cancelText: 'Cancel',

        onConfirm: async () => {
            try {
                const storedUser = JSON.parse(
                    localStorage.getItem('purenest_user') || '{}'
                );

                const currentUserId = storedUser.id || null;

                await API.services.update(service.id, {
                    ...service,
                    is_active: newStatus,
                    user_id: currentUserId
                });

                Modal.show({
                    type: 'success',

                    title: 'Status Updated',

                    message: `Service "${service.name}" has been ${
                        currentIsActive
                            ? 'deactivated'
                            : 'activated'
                    }.`,

                    confirmText: 'OK',

                    showCancel: false
                });

                await loadServices();

            } catch (err) {
                console.error(err);

                Modal.error(
                    err.message ||
                    `Failed to ${actionText} service.`,
                    'Action Failed'
                );
            }
        }
    });
}

/**
 * Converts relative image paths from the API
 * into absolute URLs using the current domain.
 *
 * Example:
 * /uploads/image.webp
 *
 * becomes:
 * https://cleaning.mutechlabs.com/uploads/image.webp
 *
 * while absolute URLs are kept unchanged.
 */
function getImageUrl(imageUrl) {
    if (!imageUrl) {
        return null;
    }

    if (
        imageUrl.startsWith('http://') ||
        imageUrl.startsWith('https://')
    ) {
        return imageUrl;
    }

    return `${window.location.origin}${imageUrl}`;
}

function escapeHTML(str) {
    return str
        ? str.replace(
            /[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        )
        : '';
}