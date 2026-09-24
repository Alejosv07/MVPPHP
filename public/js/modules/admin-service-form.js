import { API } from './api.js';
import { Modal } from './modal.js';

let editingServiceId = null;
let selectedImageFile = null;
let selectedServiceFeatures = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadFeaturesDropdown();
    setupImageUploader();
    setupStatusToggle();
    setupCategoryModal();
    setupFeatureModal();
    setupFeatureSelection();

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
        let rawData = response.data || response || [];
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
    }
}

async function loadFeaturesDropdown() {
    const select = document.getElementById('serviceFeatureSelect');
    if (!select) return;

    try {
        const response = await API.features.getAll();
        let features = response.data || response || [];
        select.innerHTML = '<option value="">Select a feature to add...</option>';
        if (Array.isArray(features)) {
            features.forEach(feat => {
                const opt = document.createElement('option');
                opt.value = feat.id;
                opt.textContent = feat.name;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Error loading features:', e);
    }
}

function setupFeatureSelection() {
    const addBtn = document.getElementById('btnAddServiceFeature');
    const select = document.getElementById('serviceFeatureSelect');

    console.log('Feature select:', select);
    console.log('Feature add button:', addBtn);

    if (!addBtn || !select) {
        console.error('No se encontró el selector o botón de features.');
        return;
    }

    addBtn.addEventListener('click', () => {
        console.log('CLICK EN ADD FEATURE');

        const featureId = select.value;
        const selectedOption = select.options[select.selectedIndex];
        const featureText = selectedOption
            ? selectedOption.textContent
            : '';

        console.log('Feature ID:', featureId);
        console.log('Feature name:', featureText);

        if (!featureId) {
            console.warn('No hay ninguna feature seleccionada.');
            return;
        }

        const alreadyExists = selectedServiceFeatures.some(
            f => String(f.id) === String(featureId)
        );

        if (!alreadyExists) {
            selectedServiceFeatures.push({
                id: featureId,
                name: featureText
            });
        }

        console.log(
            'FEATURES SELECCIONADAS:',
            selectedServiceFeatures
        );

        renderSelectedFeatures();

        select.value = '';
    });
}

function renderSelectedFeatures() {
    const container = document.getElementById('selectedFeaturesContainer');
    if (!container) return;

    container.innerHTML = '';
    selectedServiceFeatures.forEach((feat, index) => {
        const badge = document.createElement('div');
        badge.className = 'flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-medium text-primary';
        badge.innerHTML = `
            <span>✔ ${escapeHTML(feat.name)}</span>
            <button type="button" class="text-red-500 hover:opacity-80" data-index="${index}">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        `;

        badge.querySelector('button').addEventListener('click', () => {
            selectedServiceFeatures.splice(index, 1);
            renderSelectedFeatures();
        });

        container.appendChild(badge);
    });
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
        document.getElementById('serviceDuration').value = Number(service.estimated_duration_hours || service.duration || 1.0).toFixed(1);
        document.getElementById('serviceCategory').value = service.category_id || '';

        const isActive = Number(service.is_active) === 1 || service.status === 'ACTIVE';
        document.getElementById('serviceStatus').checked = isActive;
        document.getElementById('statusLabel').textContent = isActive ? 'Active' : 'Inactive';

        try {
            const featRes = await API.features.getByService(editingServiceId);
            selectedServiceFeatures = featRes.data || featRes || [];
            renderSelectedFeatures();
        } catch (err) {
            console.error('Error loading service features:', err);
        }

        const previewImg = document.getElementById('imagePreview');
        const previewContainer = previewImg ? previewImg.closest('.aspect-video') : null;
        if (previewImg && previewContainer && service.image_url) {
            let imgUrl = service.image_url;

            if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
                const fixedPath = imgUrl.startsWith('/uploads/') ? `/public${imgUrl}` : imgUrl;
                imgUrl = `${window.location.origin}${fixedPath}`;
            }

            previewImg.src = imgUrl;
            previewContainer.style.display = 'flex';
        }
    } catch (error) {
        console.error(error);
        Modal.error('Failed to load service details for editing.', 'Error');
    }
}

function setupCategoryModal() {
    const modal = document.getElementById('categoryModal');
    const btnOpen = document.getElementById('btnManageCategories');
    const btnClose = document.getElementById('closeCategoryModal');
    const btnCancelEdit = document.getElementById('btnCancelCategoryEdit');
    const form = document.getElementById('categoryForm');

    if (!modal || !btnOpen) return;

    btnOpen.addEventListener('click', () => {
        modal.classList.remove('hidden');
        renderCategoriesListInModal();
    });

    const closeModal = () => {
        modal.classList.add('hidden');
        resetCategoryForm();
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', resetCategoryForm);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const catId = document.getElementById('categoryId').value;
        const nameInput = document.getElementById('categoryNameInput').value.trim();
        if (!nameInput) return;

        try {
            const storedUser = JSON.parse(localStorage.getItem('purenest_user') || '{}');
            const payload = { name: nameInput, user_id: storedUser.id || null };

            if (catId) {
                await API.categories.update(catId, payload);
            } else {
                await API.categories.create(payload);
            }

            resetCategoryForm();
            await loadCategories();
            renderCategoriesListInModal();
        } catch (error) {
            Modal.error(error.message || 'Failed to save category.', 'Error');
        }
    });
}

async function renderCategoriesListInModal() {
    const container = document.getElementById('categoriesListContainer');
    if (!container) return;
    container.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-4">Loading categories...</p>';

    try {
        const response = await API.categories.getAll();
        let cats = response.data || response || [];
        container.innerHTML = '';
        cats.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 text-sm';
            item.innerHTML = `
                <span class="font-medium text-primary">${escapeHTML(cat.name)}</span>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn-edit-cat p-1 text-on-surface-variant hover:text-primary transition-colors" data-id="${cat.id}" data-name="${escapeHTML(cat.name)}">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button type="button" class="btn-delete-cat p-1 text-red-500 hover:opacity-80 transition-colors" data-id="${cat.id}">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.btn-edit-cat').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('categoryId').value = btn.getAttribute('data-id');
                document.getElementById('categoryNameInput').value = btn.getAttribute('data-name');
                document.getElementById('btnSaveCategory').textContent = 'Update Category';
                document.getElementById('btnCancelCategoryEdit').classList.remove('hidden');
            });
        });

        container.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this category?')) {
                    await API.categories.delete(btn.getAttribute('data-id'));
                    await loadCategories();
                    renderCategoriesListInModal();
                }
            });
        });
    } catch (e) {
        container.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Error loading categories.</p>';
    }
}

function resetCategoryForm() {
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryNameInput').value = '';
    document.getElementById('btnSaveCategory').textContent = 'Add Category';
    document.getElementById('btnCancelCategoryEdit').classList.add('hidden');
}

// --- GESTIÓN DE MODAL Y CRUD DE FEATURES MAESTRAS ---
function setupFeatureModal() {
    const modal = document.getElementById('featureModal');
    const btnOpen = document.getElementById('btnManageFeatures');
    const btnClose = document.getElementById('closeFeatureModal');
    const btnCancelEdit = document.getElementById('btnCancelFeatureEdit');
    const form = document.getElementById('featureForm');

    if (!modal || !btnOpen) return;

    btnOpen.addEventListener('click', () => {
        modal.classList.remove('hidden');
        renderFeaturesListInModal();
    });

    const closeModal = () => {
        modal.classList.add('hidden');
        resetFeatureForm();
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', resetFeatureForm);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const featId = document.getElementById('featureId').value;
        const nameInput = document.getElementById('featureNameInput').value.trim();
        if (!nameInput) return;

        try {
            const payload = { name: nameInput };
            if (featId) {
                await API.features.update(featId, payload);
            } else {
                await API.features.create(payload);
            }

            resetFeatureForm();
            await loadFeaturesDropdown();
            renderFeaturesListInModal();
        } catch (error) {
            Modal.error(error.message || 'Failed to save feature.', 'Error');
        }
    });
}

async function renderFeaturesListInModal() {
    const container = document.getElementById('featuresListContainer');
    if (!container) return;
    container.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-4">Loading features...</p>';

    try {
        const response = await API.features.getAll();
        let features = response.data || response || [];
        container.innerHTML = '';
        features.forEach(feat => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 text-sm';
            item.innerHTML = `
                <span class="font-medium text-primary">${escapeHTML(feat.name)}</span>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn-edit-feat p-1 text-on-surface-variant hover:text-primary transition-colors" data-id="${feat.id}" data-name="${escapeHTML(feat.name)}">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button type="button" class="btn-delete-feat p-1 text-red-500 hover:opacity-80 transition-colors" data-id="${feat.id}">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.btn-edit-feat').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('featureId').value = btn.getAttribute('data-id');
                document.getElementById('featureNameInput').value = btn.getAttribute('data-name');
                document.getElementById('btnSaveFeature').textContent = 'Update Feature';
                document.getElementById('btnCancelFeatureEdit').classList.remove('hidden');
            });
        });

        container.querySelectorAll('.btn-delete-feat').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this feature master?')) {
                    await API.features.delete(btn.getAttribute('data-id'));
                    await loadFeaturesDropdown();
                    renderFeaturesListInModal();
                }
            });
        });
    } catch (e) {
        container.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Error loading features.</p>';
    }
}

function resetFeatureForm() {
    document.getElementById('featureId').value = '';
    document.getElementById('featureNameInput').value = '';
    document.getElementById('btnSaveFeature').textContent = 'Add Feature';
    document.getElementById('btnCancelFeatureEdit').classList.add('hidden');
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('serviceName').value.trim();
        const description = document.getElementById('serviceDescription').value.trim();
        const price = document.getElementById('servicePrice').value.trim();
        const duration = document.getElementById('serviceDuration').value;
        const categoryId = document.getElementById('serviceCategory').value;
        const isActive = document.getElementById('serviceStatus').checked ? 1 : 0;

        if (!name || !description || !price || !categoryId) {
            Modal.error('Please fill out all required fields.', 'Validation Error');
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

            console.log('FEATURES SELECCIONADAS:', selectedServiceFeatures);
            formData.append('feature_ids', JSON.stringify(selectedServiceFeatures.map(f => f.id)));

            if (selectedImageFile) {
                formData.append('image', selectedImageFile);
            }

            if (editingServiceId) {
                formData.append('_method', 'PUT');
                for (const [key, value] of formData.entries()) {
                    console.log('FORM DATA:', key, value);
                }
                await API.services.update(editingServiceId, formData, true);
                Modal.show({
                    type: 'success',
                    title: 'Service Updated',
                    message: 'The service was updated successfully.',
                    confirmText: 'Back to List',
                    showCancel: false,
                    onConfirm: () => window.location.href = 'admin-services-index.html'
                });
            } else {
                for (const [key, value] of formData.entries()) {
                    console.log('FORM DATA:', key, value);
                }
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
            Modal.error(error.message || 'An error occurred while saving the service.', 'Save Error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}