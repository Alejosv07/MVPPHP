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
})();