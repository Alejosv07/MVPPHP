/**
 *
 * @param {string} path - Path's component
 * @returns {Promise<string>} Content html
 */
export async function loadComponent(path) {
    try {
        const result = await fetch(path);
        if (!result.ok) throw new Error(`Error HTTP: ${result.status}`);
        
        return await result.text();
    } catch (error) {
        console.error('Error al cargar el HTML:', error);
        return "";
    }
}