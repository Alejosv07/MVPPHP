import { loadComponent } from './loader.js';

async function initApp() {
    const navContainer = document.getElementById("nav-container");
    const footerContainer = document.getElementById("footer-container");

    const [navHtml, footerHtml] = await Promise.all([
        loadComponent('components/navbar.html'),
        loadComponent('components/footer.html')
    ]);

    if (navContainer) navContainer.outerHTML = navHtml;
    if (footerContainer) footerContainer.outerHTML = footerHtml;
}

document.addEventListener('DOMContentLoaded', initApp);