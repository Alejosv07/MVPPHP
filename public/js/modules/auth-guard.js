(()=> {
    const publicPages = [
        '/purenest/public/login.html',
        '/purenest/public/index.html',
        '/purenest/public/'
    ];

    const currentPath = window.location.pathname;
    const user = localStorage.getItem('purenest_user');

    const isPublicPage = publicPages.some(page => currentPath.endsWith(page) || currentPath === page);

    if (!user && !isPublicPage) {
        window.location.href = 'http://localhost/purenest/public/login.html';
    }

    document.addEventListener('DOMContentLoaded', () => {
    const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
    
    if (!rawUser) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = JSON.parse(rawUser);
        const role = (user.role || '').toUpperCase();
        const currentPage = window.location.pathname;
        if ((role === 'STAFF' || role === 'EMPLOYEE') && !currentPage.includes('employee-execution.html')) {
            window.location.href = 'employee-execution.html';
        }
    } catch (e) {
        console.error('Error in auth guard', e);
    }
});
})();