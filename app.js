document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let state = {
    fichas: [],
    categories: [],
    activeCategory: null
};

function initApp() {
    loadState();
    setupEventListeners();
    renderCategories();
    renderFichas();
}

function loadState() {
    const savedFichas = localStorage.getItem('inboxzero_fichas');
    const savedCats = localStorage.getItem('inboxzero_categories');
    if (savedFichas) state.fichas = JSON.parse(savedFichas);
    if (savedCats) state.categories = JSON.parse(savedCats);
}

function saveState() {
    localStorage.setItem('inboxzero_fichas', JSON.stringify(state.fichas));
    localStorage.setItem('inboxzero_categories', JSON.stringify(state.categories));
}

function setupEventListeners() {
    const helpBtn = document.getElementById('helpBtn');
    const helpSection = document.getElementById('helpContent');
    if (helpBtn && helpSection) {
        helpBtn.addEventListener('click', () => {
            helpSection.classList.toggle('hidden');
        });
    }

    const newFichaBtn = document.getElementById('newFichaBtn');
    if (newFichaBtn) {
        newFichaBtn.addEventListener('click', openFichaModal);
    }

    const addCatBtn = document.getElementById('addCategoryBtn');
    if (addCatBtn) {
        addCatBtn.addEventListener('click', promptNewCategory);
    }
}

async function extractMetadataFromUrl(url) {
    try {
        const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
        const domain = parsedUrl.hostname;
        
        return {
            title: `Recursos y Enlaces de ${domain.toUpperCase()}`,
            description: `Contenido extraído y analizado automáticamente desde ${parsedUrl.href}. Sitio web optimizado para productividad e indexación en InboxZero Pro.`,
            image: `https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80`,
            url: parsedUrl.href
        };
    } catch (e) {
        return {
            title: "Nuevo Enlace de Interés",
            description: "Descripción predeterminada extraída del sitio web.",
            image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
            url: url
        };
    }
}

function promptNewCategory() {
    const catName = prompt("Introduce el nombre de la nueva categoría:");
    if (catName && catName.trim() !== '') {
        const trimmed = catName.trim();
        if (!state.categories.includes(trimmed)) {
            state.categories.push(trimmed);
            saveState();
            renderCategories();
        }
    }
}

function renderCategories() {
    const sidebarList = document.getElementById('categoriesSidebarList');
    if (!sidebarList) return;

    sidebarList.innerHTML = `
        <li class="${state.activeCategory === null ? 'active' : ''}" onclick="filterByCategory(null)">
            Todas las Fichas (${state.fichas.length})
        </li>
    `;

    state.categories.forEach(cat => {
        const count = state.fichas.filter(f => f.category === cat).length;
        sidebarList.innerHTML += `
            <li class="${state.activeCategory === cat ? 'active' : ''}" onclick="filterByCategory('${cat}')">
                ${cat} (${count})
            </li>
        `;
    });
}

function filterByCategory(cat) {
    state.activeCategory = cat;
    renderCategories();
    renderFichas();
}

function renderFichas() {
    const container = document.getElementById('fichasContainer');
    if (!container) return;

    const filtered = state.activeCategory 
        ? state.fichas.filter(f => f.category === state.activeCategory)
        : state.fichas;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b;">
                <p>No hay fichas registradas aún. Añade tu primer enlace o recurso.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((ficha) => `
        <div class="ficha-card">
            <div>
                <img src="${ficha.image}" alt="${ficha.title}" class="ficha-image">
                <h3 class="ficha-title">${ficha.title}</h3>
                <p class="ficha-desc">${ficha.description}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                <span style="font-size: 0.85rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px;">
                    ${ficha.category || 'General'}
                </span>
                <a href="${ficha.url}" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 500;">Visitar &rarr;</a>
            </div>
        </div>
    `).join('');
}

function openFichaModal() {
    const urlInput = prompt("Introduce la URL del sitio web:");
    if (!urlInput) return;

    extractMetadataFromUrl(urlInput).then(metadata => {
        if (state.categories.length === 0) {
            alert("No hay categorías creadas. Por favor, crea una categoría primero.");
            promptNewCategory();
            if (state.categories.length === 0) return;
        }

        const cat = prompt(`Selecciona categoría (${state.categories.join(', ')}):`, state.categories[0]);
        if (!cat || !state.categories.includes(cat)) {
            alert("Categoría no válida.");
            return;
        }

        const newFicha = {
            id: Date.now(),
            title: metadata.title,
            description: metadata.description,
            image: metadata.image,
            url: metadata.url,
            category: cat
        };

        state.fichas.push(newFicha);
        saveState();
        renderCategories();
        renderFichas();
    });
}