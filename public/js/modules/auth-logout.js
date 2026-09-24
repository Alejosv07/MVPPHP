document.addEventListener('DOMContentLoaded', () => {
    const btnLogout = document.getElementById('btnLogout');

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('purenest_user');
            window.location.href = `${window.location.origin}/index.html`;
        });
    }
});