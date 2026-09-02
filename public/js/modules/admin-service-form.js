import { API } from './api.js';
import { Modal } from './modal.js';

let editingServiceId = null;
let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    setupImageUploader();
    setupStatusToggle();

    const urlParams = new URLSearchParams(window.location.search);
    editingServiceId = urlParams.get('id');

    if (editingServiceId) {
        await setupEditMode(editingServiceId);
    }

    setupFormEvents();
});

async function loadCategories() {
    const categorySelect = document.getElementById('serviceCategory');
    if (!categorySelect) return;

    try {
        const response = await API.categories.getAll();
        categorySelect.innerHTML = '<option value="">Select a category...</option>';

        let rawData = response;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            rawData = response.data || response.categories || [];
        }

        if (Array.isArray(rawData)) {
            rawData.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                categorySelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        categorySelect.innerHTML = '<option value="">Failed to load categories</option>';
    }
}

function setupImageUploader() {
    const dropArea = document.getElementById('imageDropArea');
    const fileInput = document.getElementById('imageInput');
    const previewImg = document.getElementById('imagePreview');

    if (!dropArea || !fileInput) return;

    dropArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];

        if (file) {
            if (!file.type.startsWith('image/')) {
                Modal.error('Please select a valid image file (JPG, PNG, WebP).', 'Invalid File');
                fileInput.value = '';
                selectedImageFile = null;
                return;
            }

            selectedImageFile = file;

            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                const container = previewImg.closest('.aspect-video');
                if (container) container.style.display = 'flex';
            };

            reader.readAsDataURL(file);
            clearError('imageDropArea');
        }
    });
}

function setupStatusToggle() {
    const checkbox = document.getElementById('serviceStatus');
    const label = document.getElementById('statusLabel');

    if (checkbox && label) {
        checkbox.addEventListener('change', () => {
            label.textContent = checkbox.checked ? 'Active' : 'Inactive';
        });
    }
}

async function setupEditMode(id) {
    try {
        const response = await API.services.getById(id);
        const service = response.data || response;

        if (!service) return;

        editingServiceId = service.id || id;

        document.getElementById('pageTitle').textContent = `Edit Service #${editingServiceId}`;
        document.getElementById('pageSubtitle').textContent = 'Update details for this catalog offering.';
        document.getElementById('btnSubmit').textContent = 'Update Service';

        document.getElementById('serviceName').value = service.name || '';
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('servicePrice').value = service.price_per_hour || service.price || '';

        if (service.estimated_duration_hours || service.duration) {
            const duration = service.estimated_duration_hours || service.duration;
            document.getElementById('serviceDuration').value = Number(duration).toFixed(1);
        } else {
            document.getElementById('serviceDuration').value = '1.0';
        }

        document.getElementById('serviceCategory').value = service.category_id || '';

        const isActive = Number(service.is_active) === 1 || service.status === 'ACTIVE';
        const checkbox = document.getElementById('serviceStatus');
        const label = document.getElementById('statusLabel');

        if (checkbox && label) {
            checkbox.checked = isActive;
            label.textContent = isActive ? 'Active' : 'Inactive';
        }

        const previewImg = document.getElementById('imagePreview');
        const previewContainer = previewImg ? previewImg.closest('.aspect-video') : null;

        if (previewImg && previewContainer) {
            if (service.image_url && service.image_url.trim() !== '') {
                previewImg.src = service.image_url.startsWith('http')
                    ? service.image_url
                    : `http://localhost/purenest/public${service.image_url}`;

                previewContainer.style.display = 'flex';
            } else {
                previewImg.src = '';
                previewContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error(error);
        Modal.error('Failed to load service details for editing.', 'Error');
    }
}

function showError(inputId, message) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    inputEl.classList.add('border-red-500');

    let errorEl = inputEl.parentNode.querySelector('.field-error-msg');

    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'field-error-msg text-xs text-red-500 mt-1 font-medium';
        inputEl.parentNode.appendChild(errorEl);
    }

    errorEl.textContent = message;
}

function clearError(inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    inputEl.classList.remove('border-red-500');

    const errorEl = inputEl.parentNode.querySelector('.field-error-msg');
    if (errorEl) errorEl.remove();
}

function clearAllErrors() {
    ['serviceName', 'serviceDescription', 'servicePrice', 'serviceCategory'].forEach(clearError);
}

function setupFormEvents() {
    const form = document.getElementById('serviceForm');
    const cancelBtn = document.getElementById('btnCancel');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            window.location.href = 'admin-services-index.html';
        });
    }

    if (!form) return;

    ['serviceName', 'serviceDescription', 'servicePrice', 'serviceCategory'].forEach(id => {
        const el = document.getElementById(id);

        if (el) {
            el.addEventListener('input', () => clearError(id));
            el.addEventListener('change', () => clearError(id));
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const name = document.getElementById('serviceName').value.trim();
        const description = document.getElementById('serviceDescription').value.trim();
        const price = document.getElementById('servicePrice').value.trim();
        const duration = document.getElementById('serviceDuration').value;
        const categoryId = document.getElementById('serviceCategory').value;
        const isActive = document.getElementById('serviceStatus').checked ? 1 : 0;

        let hasError = false;
        let firstInvalidId = null;

        const markInvalid = (id, msg) => {
            showError(id, msg);

            if (!hasError) {
                hasError = true;
                firstInvalidId = id;
            }
        };

        if (!name) markInvalid('serviceName', 'Service name is required.');
        if (!description) markInvalid('serviceDescription', 'Description is required.');
        if (!price || Number(price) <= 0) markInvalid('servicePrice', 'Enter a valid hourly price.');
        if (!categoryId) markInvalid('serviceCategory', 'Please select a category.');

        if (hasError) {
            const el = document.getElementById(firstInvalidId);

            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus({ preventScroll: true });
            }

            Modal.error('Please fix the highlighted errors before submitting.', 'Validation Error');
            return;
        }

        const btnSubmit = document.getElementById('btnSubmit');

        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            const formData = new FormData();

            formData.append('name', name);
            formData.append('description', description);
            formData.append('price_per_hour', price);
            formData.append('estimated_duration_hours', duration);
            formData.append('category_id', categoryId);
            formData.append('is_active', isActive);

            if (selectedImageFile) {
                formData.append('image', selectedImageFile);
            }

            if (editingServiceId) {
                formData.append('_method', 'PUT');

                await API.services.update(
                    editingServiceId,
                    formData,
                    true
                );

                Modal.show({
                    type: 'success',
                    title: 'Service Updated',
                    message: 'The service was updated successfully.',
                    confirmText: 'Back to List',
                    showCancel: false,
                    onConfirm: () => window.location.href = 'admin-services-index.html'
                });
            } else {
                await API.services.create(formData, true);

                Modal.show({
                    type: 'success',
                    title: 'Service Created',
                    message: 'New service created successfully.',
                    confirmText: 'Back to List',
                    showCancel: false,
                    onConfirm: () => window.location.href = 'admin-services-index.html'
                });
            }
        } catch (error) {
            console.error(error);
            Modal.error(
                error.message || 'An error occurred while saving the service.',
                'Save Error'
            );
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}