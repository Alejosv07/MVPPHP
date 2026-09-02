import { loadComponent } from './loader.js';

async function initApp() {
    const sideBarContainer = document.getElementById("sideAdminMenu");
    if (!sideBarContainer) return;

    try {
        const [sideMenuHtml] = await Promise.all([
            loadComponent('components/sidebar-admin.html')
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

            injectMobileBottomNav();

            highlightActiveMenu();
            initLogout();
        }
    } catch (error) {
        console.error('Error al cargar la barra lateral:', error);
    }
}

function injectMobileBottomNav() {
    if (document.getElementById('mobile-bottom-nav')) return;

    const currentPage = window.location.pathname.split('/').pop() || 'admin-index.html';

    const navHTML = `
    <nav id="mobile-bottom-nav" class="fixed bottom-4 left-4 right-4 z-30 flex items-center gap-2 px-3 py-2 bg-surface-container-lowest/90 backdrop-blur-md rounded-full shadow-xl border border-outline-variant/20 overflow-x-auto scrollbar-none print:hidden md:hidden">
        
        <a class="flex flex-col items-center justify-center shrink-0 ${currentPage === 'admin-index.html' ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-2' : 'text-on-surface-variant px-3 py-2'} active:scale-90 transition-transform" href="admin-index.html">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' ${currentPage === 'admin-index.html' ? '1' : '0'};">dashboard</span>
            <span class="font-label-caps text-[10px] mt-0.5">Dashboard</span>
        </a>

        <a class="flex flex-col items-center justify-center shrink-0 ${currentPage === 'admin-calendar.html' ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-2' : 'text-on-surface-variant px-3 py-2'} active:scale-90 transition-transform" href="admin-calendar.html">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' ${currentPage === 'admin-calendar.html' ? '1' : '0'};">calendar_today</span>
            <span class="font-label-caps text-[10px] mt-0.5">Calendar</span>
        </a>

        <a class="flex flex-col items-center justify-center shrink-0 ${currentPage === 'admin-reservation-index.html' ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-2' : 'text-on-surface-variant px-3 py-2'} active:scale-90 transition-transform" href="admin-reservation-index.html">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' ${currentPage === 'admin-reservation-index.html' ? '1' : '0'};">event_available</span>
            <span class="font-label-caps text-[10px] mt-0.5">Reservations</span>
        </a>

        <a class="flex flex-col items-center justify-center shrink-0 ${currentPage === 'admin-services-index.html' ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-2' : 'text-on-surface-variant px-3 py-2'} active:scale-90 transition-transform" href="admin-services-index.html">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' ${currentPage === 'admin-services-index.html' ? '1' : '0'};">cleaning_services</span>
            <span class="font-label-caps text-[10px] mt-0.5">Services</span>
        </a>

        <a class="flex flex-col items-center justify-center shrink-0 ${currentPage === 'admin-statitics.html' ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-2' : 'text-on-surface-variant px-3 py-2'} active:scale-90 transition-transform" href="admin-statitics.html">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' ${currentPage === 'admin-statitics.html' ? '1' : '0'};">bar_chart</span>
            <span class="font-label-caps text-[10px] mt-0.5">Stats</span>
        </a>

    </nav>`;

    document.body.insertAdjacentHTML('beforeend', navHTML);
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
            window.location.href = 'http://localhost/purenest/public/login.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', initApp);