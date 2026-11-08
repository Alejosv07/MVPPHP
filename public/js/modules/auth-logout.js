document.addEventListener('DOMContentLoaded', () => {
    const btnLogout = document.getElementById('btnLogout');

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('purenest_user');
            localStorage.removeItem('luxuriapure_user');
            window.location.href = 'index.html';
        });
    }
});
