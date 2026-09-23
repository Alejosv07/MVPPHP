import { loadComponent } from './loader.js';

async function initApp() {
    const sideBarContainer = document.getElementById("sideAdminMenu");
    if (!sideBarContainer) return;

    try {
        const rawUser = localStorage.getItem('purenest_user') || localStorage.getItem('luxuriapure_user');
        let role = '';
        if (rawUser) {
            try {
                const user = JSON.parse(rawUser);
                role = (user.role || '').toUpperCase();
            } catch (e) {
                role = '';
            }
        }

        const componentPath = (role === 'STAFF' || role === 'EMPLOYEE') 
            ? 'components/sidebar-staff.html' 
            : 'components/sidebar-admin.html';

        const [sideMenuHtml] = await Promise.all([
            loadComponent(componentPath)
        ]);

        if (sideMenuHtml) {
            sideBarContainer.insertAdjacentHTML('beforebegin', sideMenuHtml);
            sideBarContainer.remove();

            const sidebar = document.querySelector('aside');
            if (sidebar) {
                sidebar.id = 'mobile-sidebar';
                sidebar.className = 'flex flex-col py-8 gap-unit bg-surface-container dark:bg-surface-container-highest shadow-sm fixed inset-y-0 left-0 h-full w-64 z-50 border-r border-surface-container-low dark:border-surface-container transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out';
            }

            const sidebarHeader = document.querySelector('aside > div:first-child');
            if (sidebarHeader && !sidebarHeader.querySelector('.md\\:hidden')) {
                sidebarHeader.classList.add('justify-between');
                const closeBtn = document.createElement('button');
                closeBtn.className = 'md:hidden text-on-surface-variant hover:text-primary p-2';
                closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
                closeBtn.onclick = () => {
                    document.getElementById('mobile-sidebar')?.classList.add('-translate-x-full');
                    document.getElementById('sidebar-backdrop')?.classList.add('hidden');
                };
                sidebarHeader.appendChild(closeBtn);
            }

            highlightActiveMenu();
            initLogout();
        }
    } catch (error) {
        console.error('Error al cargar la barra lateral:', error);
    }
}

function highlightActiveMenu() {
    const currentPage = window.location.pathname.split('/').pop() || 'admin-index.html';
    const navLinks = document.querySelectorAll('aside nav a, aside .mt-auto a');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');

        if (href === currentPage) {
            link.className = "flex items-center gap-3 py-3 w-full rounded-r-lg group text-primary dark:text-primary-fixed font-bold border-l-4 border-primary pl-4 translate-x-1 duration-200";
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.add('fill');
        } else if (href && href !== '#') {
            link.className = "flex items-center gap-3 py-3 w-full rounded-r-lg group text-on-surface-variant dark:text-outline-muted pl-4 hover:bg-surface-bright dark:hover:bg-surface-dim transition-all";
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.remove('fill');
        }
    });
}

function initLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('purenest_user');
            localStorage.removeItem('luxuriapure_user');
            window.location.href = 'http://localhost/purenest/public/login.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', initApp);