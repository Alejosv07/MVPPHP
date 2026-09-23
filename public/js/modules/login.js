import { API } from './api.js';
import { Modal } from './modal.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const alertMessage = document.getElementById('alert-message');
    const submitBtn = document.getElementById('submitBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!email || !password) {
                showAlert('Please enter both email and password.', 'error');
                return;
            }

            showAlert('Verifying credentials...', 'info');
            submitBtn.disabled = true;

            try {
                const response = await API.auth.login(email, password);
                showAlert('Login successful! Redirecting...', 'success');
                localStorage.setItem('purenest_user', JSON.stringify(response.data.user));

                setTimeout(() => {
                    window.location.href = 'admin-index.html';
                }, 1000);

            } catch (error) {
                let friendlyMessage = 'An unexpected error occurred. Please try again.';
                
                const errLower = (error.message || '').toLowerCase();
                if (errLower.includes('401') || errLower.includes('invalid credentials') || errLower.includes('credenciales')) {
                    friendlyMessage = 'Incorrect email or password. Please check your credentials and try again.';
                } else if (errLower.includes('404') || errLower.includes('not found')) {
                    friendlyMessage = 'No account found with this email address.';
                } else if (errLower.includes('422') || errLower.includes('required')) {
                    friendlyMessage = 'Please fill in all required fields properly.';
                }

                showAlert(friendlyMessage, 'error');
                submitBtn.disabled = false;
            }
        });
    }

    let recoveryEmailStored = '';

    const formRequest = document.getElementById('form-request');
    if (formRequest) {
        formRequest.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('recovery-email');
            recoveryEmailStored = emailInput.value.trim();

            if (!recoveryEmailStored) return;

            const submitBtnReq = formRequest.querySelector('button[type="submit"]');
            submitBtnReq.disabled = true;
            submitBtnReq.textContent = 'Sending...';

            try {
                const response = await API.auth.requestPasswordReset(recoveryEmailStored);
                
                let msg = 'A recovery code has been generated. Please check your inbox.';
                if (response && response.code) {
                    msg += ` (Test code: ${response.code})`;
                }
                
                Modal.success(msg, 'Token Generated');

                switchTab('reset');
                startTokenTimer();
            } catch (error) {
                Modal.error('We could not process your request at this moment. Please verify your email and try again.', 'Error');
            } finally {
                submitBtnReq.disabled = false;
                submitBtnReq.innerHTML = '<span>Send Security Token</span><span class="material-symbols-outlined text-[18px]">send</span>';
            }
        });
    }

    const formReset = document.getElementById('form-reset');
    if (formReset) {
        formReset.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pinBoxes = document.querySelectorAll('.pin-box');
            let tokenCode = '';
            pinBoxes.forEach(box => tokenCode += box.value);

            if (tokenCode.length < 6) {
                Modal.warning('Please enter the full 6-digit security code.', 'Incomplete Code');
                return;
            }

            const newPass = document.getElementById('new-pass').value;
            const confirmPass = document.getElementById('confirm-pass').value;

            if (newPass.length < 8 || !/[A-Z]/.test(newPass) || newPass !== confirmPass) {
                Modal.warning('Your new password must meet all security criteria and match confirmation.', 'Validation Error');
                return;
            }

            try {
                await API.auth.resetPassword({
                    code: tokenCode,
                    password: newPass
                });

                document.getElementById('section-reset').classList.add('hidden');
                document.getElementById('section-success').classList.remove('hidden');

            } catch (error) {
                Modal.error('The verification code is invalid or has expired. Please request a new one.', 'Reset Failed');
            }
        });
    }
});

window.toggleView = function(viewName) {
    const loginView = document.getElementById('login-view');
    const recoveryView = document.getElementById('recovery-view');

    if (viewName === 'recovery') {
        loginView.classList.add('hidden');
        recoveryView.classList.remove('hidden');
    } else {
        recoveryView.classList.add('hidden');
        loginView.classList.remove('hidden');
    }
};

window.switchTab = function(tabName) {
    const sectionReq = document.getElementById('section-request');
    const sectionRes = document.getElementById('section-reset');
    const tabReqBtn = document.getElementById('tab-request-btn');
    const tabResBtn = document.getElementById('tab-reset-btn');

    if (tabName === 'request') {
        sectionReq.classList.remove('hidden');
        sectionRes.classList.add('hidden');
        tabReqBtn.className = "flex-1 py-2.5 px-4 rounded-lg font-label-caps text-label-caps uppercase tracking-wider text-center transition-all bg-surface-container-lowest text-on-surface shadow-sm font-semibold flex items-center justify-center gap-2";
        tabResBtn.className = "flex-1 py-2.5 px-4 rounded-lg font-label-caps text-label-caps uppercase tracking-wider text-center transition-all text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-2";
    } else {
        sectionReq.classList.add('hidden');
        sectionRes.classList.remove('hidden');
        tabResBtn.className = "flex-1 py-2.5 px-4 rounded-lg font-label-caps text-label-caps uppercase tracking-wider text-center transition-all bg-surface-container-lowest text-on-surface shadow-sm font-semibold flex items-center justify-center gap-2";
        tabReqBtn.className = "flex-1 py-2.5 px-4 rounded-lg font-label-caps text-label-caps uppercase tracking-wider text-center transition-all text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-2";
    }
};

window.handlePinInput = function(element, index) {
    const value = element.value;
    if (value && index < 5) {
        const nextInput = document.querySelector(`.pin-box[data-index="${index + 1}"]`);
        if (nextInput) nextInput.focus();
    }
};

window.handlePinBackspace = function(event, index) {
    if (event.key === 'Backspace' && !event.target.value && index > 0) {
        const prevInput = document.querySelector(`.pin-box[data-index="${index - 1}"]`);
        if (prevInput) {
            prevInput.focus();
            prevInput.value = '';
        }
    }
};

window.pasteToken = async function() {
    try {
        const text = await navigator.clipboard.readText();
        const cleanText = text.trim().replace(/[^a-zA-Z0-9]/g, '');
        const pinBoxes = document.querySelectorAll('.pin-box');
        
        pinBoxes.forEach((box, idx) => {
            if (cleanText[idx]) {
                box.value = cleanText[idx];
            }
        });
    } catch (err) {
        console.error('Error pasting token:', err);
    }
};

function startTokenTimer() {
    let duration = 15 * 60;
    const timerDisplay = document.getElementById('token-timer');
    if (!timerDisplay) return;

    clearInterval(window.tokenInterval);

    window.tokenInterval = setInterval(() => {
        let minutes = parseInt(duration / 60, 10);
        let seconds = parseInt(duration % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = `${minutes}:${seconds}`;

        if (--duration < 0) {
            clearInterval(window.tokenInterval);
            timerDisplay.textContent = "Expired";
        }
    }, 1000);
}

window.validatePasswordStrength = function(password) {
    const lenRule = document.getElementById('rule-len');
    const capsRule = document.getElementById('rule-caps');
    const strengthBar = document.getElementById('strength-bar');
    const strengthLabel = document.getElementById('strength-label');

    let score = 0;

    if (password.length >= 8) {
        lenRule.querySelector('span.material-symbols-outlined').textContent = 'check_circle';
        lenRule.classList.remove('text-on-surface-variant');
        lenRule.classList.add('text-primary');
        score++;
    } else {
        lenRule.querySelector('span.material-symbols-outlined').textContent = 'radio_button_unchecked';
        lenRule.classList.add('text-on-surface-variant');
        lenRule.classList.remove('text-primary');
    }

    if (/[A-Z]/.test(password)) {
        capsRule.querySelector('span.material-symbols-outlined').textContent = 'check_circle';
        capsRule.classList.remove('text-on-surface-variant');
        capsRule.classList.add('text-primary');
        score++;
    } else {
        capsRule.querySelector('span.material-symbols-outlined').textContent = 'radio_button_unchecked';
        capsRule.classList.add('text-on-surface-variant');
        capsRule.classList.remove('text-primary');
    }

    window.validateMatch();

    const confirm = document.getElementById('confirm-pass').value;
    const isMatch = password && password === confirm;

    if (password.length >= 8 && /[A-Z]/.test(password) && isMatch) {
        score++;
    }

    if (score <= 1) {
        strengthBar.style.width = '10%';
        strengthBar.className = 'h-full bg-error transition-all duration-300';
        strengthLabel.textContent = 'Weak';
    } else if (score === 2) {
        strengthBar.style.width = '60%';
        strengthBar.className = 'h-full bg-amber-500 transition-all duration-300';
        strengthLabel.textContent = 'Moderate';
    } else {
        strengthBar.style.width = '100%';
        strengthBar.className = 'h-full bg-primary transition-all duration-300';
        strengthLabel.textContent = 'Strong';
    }
};

window.validateMatch = function() {
    const pass = document.getElementById('new-pass').value;
    const confirm = document.getElementById('confirm-pass').value;
    const matchRule = document.getElementById('rule-match');

    if (pass && pass === confirm) {
        matchRule.querySelector('span.material-symbols-outlined').textContent = 'check_circle';
        matchRule.classList.remove('text-on-surface-variant');
        matchRule.classList.add('text-primary');
    } else {
        matchRule.querySelector('span.material-symbols-outlined').textContent = 'radio_button_unchecked';
        matchRule.classList.add('text-on-surface-variant');
        matchRule.classList.remove('text-primary');
    }
};

window.togglePassVisibility = function(fieldId, btn) {
    const input = document.getElementById(fieldId);
    const icon = btn.querySelector('span');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
};

window.resendToken = function() {
    Modal.success('A new security code has been resent to your email.', 'Code Resent');
    startTokenTimer();
};

function showAlert(message, type) {
    const alertMessage = document.getElementById('alert-message');
    if (!alertMessage) return;
    alertMessage.textContent = message;
    alertMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700', 'bg-blue-100', 'text-blue-700');

    if (type === 'error') {
        alertMessage.classList.add('bg-red-100', 'text-red-700');
    } else if (type === 'success') {
        alertMessage.classList.add('bg-green-100', 'text-green-700');
    } else {
        alertMessage.classList.add('bg-blue-100', 'text-blue-700');
    }
}