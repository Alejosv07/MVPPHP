document.addEventListener('DOMContentLoaded', () => {
    const btnLogout = document.getElementById('btnLogout');

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('purenest_user');
            window.location.href = 'http://localhost/purenest/public/index.html'; // o tu vista de login
        });
    }
});