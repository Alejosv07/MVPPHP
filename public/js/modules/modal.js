class GlobalModal {
    constructor() {
        this.init();
    }

    init() {
        if (document.getElementById('purenest-global-modal')) return;

        const modalHTML = `
            <div id="purenest-global-modal" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm opacity-0 pointer-events-none transition-all duration-200">
                <div id="modal-card" class="w-full max-w-sm sm:max-w-md bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-2xl border border-outline-variant/30 transform scale-95 transition-all duration-200 flex flex-col gap-4">
                    <div class="flex items-start gap-3">
                        <div id="modal-icon-container" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0">
                            <span id="modal-icon" class="material-symbols-outlined text-xl sm:text-2xl">info</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 id="modal-title" class="text-base sm:text-lg font-bold text-on-surface truncate">Notification</h3>
                            <p id="modal-message" class="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed break-words"></p>
                        </div>
                    </div>
                    <div id="modal-extra-content" class="hidden w-full"></div>
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
                        <button id="modal-btn-cancel" class="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-outline-variant/50 text-xs sm:text-sm font-semibold text-on-surface-variant hover:bg-surface-variant transition-colors">
                            Cancel
                        </button>
                        <button id="modal-btn-confirm" class="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all shadow-sm">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        this.overlay = document.getElementById('purenest-global-modal');
        this.card = document.getElementById('modal-card');
        this.iconContainer = document.getElementById('modal-icon-container');
        this.icon = document.getElementById('modal-icon');
        this.title = document.getElementById('modal-title');
        this.message = document.getElementById('modal-message');
        this.extraContent = document.getElementById('modal-extra-content');
        this.btnCancel = document.getElementById('modal-btn-cancel');
        this.btnConfirm = document.getElementById('modal-btn-confirm');

        this.btnCancel.addEventListener('click', () => this.close());
    }

    show({ type = 'info', title, message, confirmText = 'Confirm', showCancel = true, htmlContent = '', onConfirm }) {
        this.resetTheme();

        this.title.textContent = title;
        this.message.textContent = message;
        this.btnConfirm.textContent = confirmText;

        if (htmlContent) {
            this.extraContent.innerHTML = htmlContent;
            this.extraContent.classList.remove('hidden');
        } else {
            this.extraContent.classList.add('hidden');
            this.extraContent.innerHTML = '';
        }

        this.btnCancel.style.display = showCancel ? 'block' : 'none';

        switch (type) {
            case 'danger':
                this.iconContainer.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 bg-red-100 text-red-600';
                this.icon.textContent = 'error';
                this.btnConfirm.className = 'px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm';
                break;

            case 'success':
                this.iconContainer.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700';
                this.icon.textContent = 'check_circle';
                this.btnConfirm.className = 'px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm';
                break;

            case 'warning':
                this.iconContainer.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 bg-amber-100 text-amber-700';
                this.icon.textContent = 'warning';
                this.btnConfirm.className = 'px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm';
                break;

            default:
                this.iconContainer.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-700';
                this.icon.textContent = 'info';
                this.btnConfirm.className = 'px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm';
                break;
        }

        const newConfirmBtn = this.btnConfirm.cloneNode(true);
        this.btnConfirm.parentNode.replaceChild(newConfirmBtn, this.btnConfirm);
        this.btnConfirm = newConfirmBtn;

        this.btnConfirm.addEventListener('click', async () => {
            if (onConfirm) {
                this.btnConfirm.disabled = true;
                this.btnConfirm.classList.add('opacity-50');
                
                try {
                    const shouldClose = await onConfirm();
                    if (shouldClose === false) {
                        this.resetTheme();
                        return;
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    this.resetTheme();
                }
            }
            this.close();
        });

        this.overlay.classList.remove('opacity-0', 'pointer-events-none');
        this.card.classList.remove('scale-95');
        this.card.classList.add('scale-100');
    }

    close() {
        this.overlay.classList.add('opacity-0', 'pointer-events-none');
        this.card.classList.remove('scale-100');
        this.card.classList.add('scale-95');
    }

    resetTheme() {
        this.btnConfirm.disabled = false;
        this.btnConfirm.classList.remove('opacity-50');
    }

    success(message, title = 'Success!') {
        this.show({
            type: 'success',
            title,
            message,
            confirmText: 'OK',
            showCancel: false
        });
    }

    error(message, title = 'Error Occurred') {
        this.show({
            type: 'danger',
            title,
            message,
            confirmText: 'Close',
            showCancel: false
        });
    }

    warning(message, title = 'Warning') {
        this.show({
            type: 'warning',
            title,
            message,
            confirmText: 'Understand',
            showCancel: false
        });
    }
}

export const Modal = new GlobalModal();