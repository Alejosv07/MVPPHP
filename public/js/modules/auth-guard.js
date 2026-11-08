(() => {
    // Client-side guard for UX only. Real protection is enforced by the API (Bearer token).
    const publicPages = ['login.html', 'index.html'];
    const currentPath = window.location.pathname;
    const isPublicPage = currentPath.endsWith('/') || publicPages.some(page => currentPath.endsWith(page));

    function readSession() {
        try {
            const raw = localStorage.getItem('purenest_user');
            const user = raw && raw !== 'undefined' ? JSON.parse(raw) : null;
            if (!user || !user.token) return null;

            // Token = base64url(payload).signature ; check expiry locally
            const payload = JSON.parse(atob(user.token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
            if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
            return user;
        } catch (e) {
            return null;
        }
    }

    const user = readSession();

    if (!user) {
        localStorage.removeItem('purenest_user');
        localStorage.removeItem('luxuriapure_user');
        if (!isPublicPage) {
            window.location.replace('login.html');
        }
        return;
    }

    const role = (user.role || '').toUpperCase();
    if (role === 'STAFF' && !currentPath.includes('employee-execution.html') && !isPublicPage) {
        window.location.replace('employee-execution.html');
    }
})();
