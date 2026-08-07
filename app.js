let cardsData = [
    {
        id: 1,
        title: "Comida saludable: 101 recetas sanas para tener un menú saludable de lunes a domingo",
        description: "Menú saludable y recetas equilibradas.",
        url: "https://www.directoalpaladar.com/recetario...",
        image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300",
        category: "Comida Sana",
        favorite: true,
        readLater: false,
        notes: ""
    },
    {
        id: 2,
        title: "TikTok - Rutina Activa en Silla",
        description: "20 toques alternando los pies | Rutina en silla",
        url: "https://www.tiktok.com",
        image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300",
        category: "Ejercicios en Casa",
        favorite: false,
        readLater: true,
        notes: ""
    },
    {
        id: 3,
        title: "Ranking Best Shark Moments",
        description: "Vídeo corto de YouTube con los mejores momentos de tiburones.",
        url: "https://youtube.com/shorts",
        image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=300",
        category: "Vídeos Divertidos",
        favorite: false,
        readLater: false,
        notes: ""
    }
];

let customCategories = ["Ejercicios en Casa", "Vídeos Divertidos", "Comida Sana"];
let currentFilter = 'latest';

// Elementos DOM
const cardsContainer = document.getElementById('cards-container');
const urlInput = document.getElementById('url-input');
const btnCapture = document.getElementById('btn-capture');
const sidebarCategoriesList = document.getElementById('sidebar-categories-list');

// Modales
const editModal = document.getElementById('edit-modal');
const helpModal = document.getElementById('help-modal');
const loginModal = document.getElementById('login-modal');
const subscribeModal = document.getElementById('subscribe-modal');

// Botones Header
const btnLibraryDrop = document.getElementById('btn-library-drop');
const dropdownLibraryMenu = document.getElementById('dropdown-library-menu');
const dropCategoriesList = document.getElementById('drop-categories-list');
const btnHelpModal = document.getElementById('btn-help-modal');
const btnLoginModal = document.getElementById('btn-login-modal');
const btnSubscribeModal = document.getElementById('btn-subscribe-modal');

// Botones Cierre Modales
const closeEdit = document.getElementById('close-edit');
const closeHelp = document.getElementById('close-help');
const closeLogin = document.getElementById('close-login');
const closeSubscribe = document.getElementById('close-subscribe');

// Desplegable Mi Biblioteca
btnLibraryDrop.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownLibraryMenu.classList.toggle('show');
});

window.closeAllDropdowns = () => {
    dropdownLibraryMenu.classList.remove('show');
};

// Actualiza contadores del menú lateral, barra de progreso y menú desplegable
function updateSidebarCounters() {
    const totalCount = cardsData.length;
    const favsCount = cardsData.filter(c => c.favorite).length;
    const readCount = cardsData.filter(c => c.readLater).length;

    // Contadores en Sidebar
    document.getElementById('count-all').innerText = totalCount;
    document.getElementById('count-favs').innerText = favsCount;
    document.getElementById('count-read').innerText = readCount;

    // Contadores en Desplegable Mi Biblioteca
    document.getElementById('drop-count-all').innerText = totalCount;
    document.getElementById('drop-count-favs').innerText = favsCount;
    document.getElementById('drop-count-read').innerText = readCount;

    // Barra de Progreso
    const maxFichas = 15;
    document.getElementById('ficha-counter').innerText = totalCount;
    const percentage = Math.min((totalCount / maxFichas) * 100, 100);
    document.getElementById('progress-bar-fill').style.width = percentage + '%';

    // Lista de Categorías (Sidebar y Desplegable)
    sidebarCategoriesList.innerHTML = '';
    dropCategoriesList.innerHTML = '';

    customCategories.forEach(cat => {
        const count = cardsData.filter(c => c.category === cat).length;
        
        // Elemento para Sidebar
        const li = document.createElement('li');
        if (currentFilter === 'cat-' + cat) li.classList.add('active');
        li.innerHTML = `
            <a href="#" onclick="applyLibraryFilter('cat-${cat}')">
                <span>📁 ${cat}</span>
                <span class="badge">${count}</span>
            </a>
        `;
        sidebarCategoriesList.appendChild(li);

        // Elemento para Desplegable Header
        const dropItem = document.createElement('a');
        dropItem.href = '#';
        dropItem.innerHTML = `
            <span>📁 ${cat}</span>
            <span class="badge">${count}</span>
        `;
        dropItem.onclick = (e) => {
            e.preventDefault();
            applyLibraryFilter('cat-' + cat);
            closeAllDropdowns();
        };
        dropCategoriesList.appendChild(dropItem);
    });
}

// Aplica el filtro seleccionado
window.applyLibraryFilter = (filterType) => {
    currentFilter = filterType;
    document.querySelectorAll('aside .nav-links li').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-filter') === filterType) {
            el.classList.add('active');
        }
    });
    renderApp();
};

// Renderizado general de la aplicación
function renderApp() {
    updateSidebarCounters();
    cardsContainer.innerHTML = '';

    let filteredCards = cardsData;
    let title = "Todas las fichas";

    if (currentFilter === 'latest') {
        title = "Últimas Fichas Incorporadas";
    } else if (currentFilter === 'favorites') {
        filteredCards = cardsData.filter(c => c.favorite);
        title = "Favoritos";
    } else if (currentFilter === 'readlater') {
        filteredCards = cardsData.filter(c => c.readLater);
        title = "Leer más tarde";
    } else if (currentFilter.startsWith('cat-')) {
        const catName = currentFilter.replace('cat-', '');
        filteredCards = cardsData.filter(c => c.category === catName);
        title = `Categoría: ${catName}`;
    }

    document.getElementById('section-heading-title').innerText = title;
    document.getElementById('showing-text').innerText = `Mostrando ${filteredCards.length} ficha(s)`;

    if (filteredCards.length === 0) {
        cardsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">No hay fichas en esta sección.</div>`;
        return;
    }

    filteredCards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        
        const favClass = card.favorite ? 'active-fav' : '';
        const readClass = card.readLater ? 'active-read' : '';

        cardEl.innerHTML = `
            <div class="card-top">
                <img src="${card.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300'}" class="card-thumb" alt="Thumb" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300'">
                <div class="card-info">
                    <span class="card-category-tag">${card.category || 'General'}</span>
                    <h4 class="card-title">${card.title}</h4>
                    <p class="card-desc">${card.description || 'Sin descripción disponible.'}</p>
                    <a href="${card.url}" target="_blank" class="card-url">${card.url}</a>
                </div>
            </div>
            <div class="card-footer-row">
                <div class="card-actions-box">
                    <button class="card-action-btn ${favClass}" onclick="toggleFavorite(${card.id})" title="Marcar Favorito">⭐</button>
                    <button class="card-action-btn ${readClass}" onclick="toggleReadLater(${card.id})" title="Leer más tarde">📌</button>
                    <button class="card-action-btn" onclick="openEditModal(${card.id})" title="Editar Ficha">✏️</button>
                    <button class="card-action-btn" onclick="deleteCard(${card.id})" title="Eliminar Ficha">🗑️</button>
                </div>
            </div>
        `;
        cardsContainer.appendChild(cardEl);
    });
}

// Acciones sobre tarjetas
window.toggleFavorite = (id) => {
    const card = cardsData.find(c => c.id === id);
    if (card) {
        card.favorite = !card.favorite;
        renderApp();
    }
};

window.toggleReadLater = (id) => {
    const card = cardsData.find(c => c.id === id);
    if (card) {
        card.readLater = !card.readLater;
        renderApp();
    }
};

window.deleteCard = (id) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta ficha?')) {
        cardsData = cardsData.filter(c => c.id !== id);
        renderApp();
    }
};

// Captura de nueva ficha
btnCapture.addEventListener('click', () => {
    const val = urlInput.value.trim();
    if (!val) return;

    const newCard = {
        id: Date.now(),
        title: val.startsWith('http') ? `Ficha guardada: ${new URL(val).hostname}` : val,
        description: "Contenido capturado automáticamente.",
        url: val.startsWith('http') ? val : `https://${val}`,
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300",
        category: customCategories[0] || "General",
        favorite: false,
        readLater: false,
        notes: ""
    };

    cardsData.unshift(newCard);
    urlInput.value = '';
    renderApp();
});

// Edición de Ficha Modal
window.openEditModal = (id) => {
    const card = cardsData.find(c => c.id === id);
    if (!card) return;

    document.getElementById('edit-id').value = card.id;
    document.getElementById('edit-title').value = card.title;
    document.getElementById('edit-desc').value = card.description;
    document.getElementById('edit-image').value = card.image || '';
    document.getElementById('edit-fav').checked = card.favorite;
    document.getElementById('edit-read').checked = card.readLater;
    document.getElementById('edit-notes').value = card.notes || '';
    document.getElementById('edit-open-web').href = card.url;

    const selectCat = document.getElementById('edit-category-select');
    selectCat.innerHTML = '';
    customCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        if (cat === card.category) opt.selected = true;
        selectCat.appendChild(opt);
    });

    document.getElementById('edit-new-category-input').value = '';
    updatePreviewFromInput(card.image);

    editModal.style.display = 'flex';
};

window.updatePreviewFromInput = (url) => {
    const img = document.getElementById('edit-preview-banner');
    const placeholder = document.getElementById('preview-placeholder');

    if (url && url.trim() !== '') {
        img.src = url;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        img.style.display = 'none';
        placeholder.style.display = 'flex';
    }
};

window.handleImageError = (img) => {
    img.style.display = 'none';
    document.getElementById('preview-placeholder').style.display = 'flex';
};

document.getElementById('btn-save-edit').addEventListener('click', () => {
    const id = parseInt(document.getElementById('edit-id').value);
    const card = cardsData.find(c => c.id === id);
    if (!card) return;

    card.title = document.getElementById('edit-title').value;
    card.description = document.getElementById('edit-desc').value;
    card.image = document.getElementById('edit-image').value;
    card.favorite = document.getElementById('edit-fav').checked;
    card.readLater = document.getElementById('edit-read').checked;
    card.notes = document.getElementById('edit-notes').value;

    const newCatInput = document.getElementById('edit-new-category-input').value.trim();
    if (newCatInput !== '') {
        if (!customCategories.includes(newCatInput)) {
            customCategories.push(newCatInput);
        }
        card.category = newCatInput;
    } else {
        card.category = document.getElementById('edit-category-select').value;
    }

    editModal.style.display = 'none';
    renderApp();
});

// MANEJO DE MODALES DEL HEADER
btnHelpModal.addEventListener('click', () => helpModal.style.display = 'flex');
btnLoginModal.addEventListener('click', () => loginModal.style.display = 'flex');
btnSubscribeModal.addEventListener('click', () => subscribeModal.style.display = 'flex');

// Envíos de Formulario
window.handleLoginSubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    alert(`Sesión iniciada correctamente para: ${email}`);
    loginModal.style.display = 'none';
};

window.handleSubscribeSubmit = (e) => {
    e.preventDefault();
    const captchaVal = parseInt(document.getElementById('sub-captcha').value);
    if (captchaVal !== 7) {
        alert('El resultado de la verificación captcha es incorrecto. Por favor introduce 7.');
        return;
    }
    alert('Registro verificado correctamente. Redirigiendo a la pasarela de pago segura de Stripe (Modo pruebas)...');
    window.open('https://stripe.com', '_blank');
    subscribeModal.style.display = 'none';
};

// Eventos de Cierre
closeEdit.addEventListener('click', () => editModal.style.display = 'none');
closeHelp.addEventListener('click', () => helpModal.style.display = 'none');
closeLogin.addEventListener('click', () => loginModal.style.display = 'none');
closeSubscribe.addEventListener('click', () => subscribeModal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.style.display = 'none';
    if (e.target === helpModal) helpModal.style.display = 'none';
    if (e.target === loginModal) loginModal.style.display = 'none';
    if (e.target === subscribeModal) subscribeModal.style.display = 'none';
    closeAllDropdowns();
});

// Inicialización
renderApp();