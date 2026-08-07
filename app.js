document.addEventListener('DOMContentLoaded', () => {
  // Estado inicial con las fichas y datos completos
  let cards = [
    {
      id: 1,
      title: "Comida saludable: 101 recetas sanas para tener un menú saludable de lunes a domingo",
      description: "Menú saludable y recetas equilibradas.",
      url: "https://www.directoalpaladar.com/recetario...",
      category: "Comida Sana",
      favorite: true,
      readLater: false,
      notes: "Recetas muy útiles para organizar la semana.",
      image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80"
    },
    {
      id: 2,
      title: "TikTok - Rutina Activa en Silla",
      description: "20 toques alternando los pies | Rutina en silla",
      url: "https://www.tiktok.com",
      category: "Ejercicios en Casa",
      favorite: false,
      readLater: true,
      notes: "Ejercicios rápidos de movilidad.",
      image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=150&auto=format&fit=crop&q=80"
    },
    {
      id: 3,
      title: "Vídeos Divertidos - Selección Semanal",
      description: "Recopilación de momentos graciosos para desconectar.",
      url: "https://www.youtube.com",
      category: "Vídeos Divertidos",
      favorite: false,
      readLater: false,
      notes: "",
      image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=150&auto=format&fit=crop&q=80"
    }
  ];

  let currentFilter = 'all';
  let currentCategory = null;

  const cardsGrid = document.getElementById('cards-grid');
  const fichaCounter = document.getElementById('ficha-counter');
  const progressFill = document.getElementById('progress-fill');
  const showingCounter = document.getElementById('showing-counter');
  const sectionTitle = document.getElementById('section-title');
  const urlInput = document.getElementById('url-input');
  const btnSave = document.getElementById('btn-save-card');

  function renderCards() {
    let filtered = cards.filter(card => {
      if (currentCategory) {
        return card.category === currentCategory;
      }
      if (currentFilter === 'favorites') return card.favorite;
      if (currentFilter === 'readLater') return card.readLater;
      return true; // 'all'
    });

    cardsGrid.innerHTML = '';
    
    if (filtered.length === 0) {
      cardsGrid.innerHTML = '<p style="color: #6b7280; font-size: 14px; grid-column: 1/-1;">No hay fichas en esta vista.</p>';
    } else {
      filtered.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card-item';
        cardEl.innerHTML = `
          <span class="card-top-tag">${card.category.toUpperCase()}</span>
          <div class="card-content-box">
            <img src="${card.image}" class="card-thumb" alt="Miniatura">
            <div class="card-details">
              <h3>${card.title}</h3>
              <p>${card.description}</p>
              <a href="${card.url}" target="_blank" class="card-link">${card.url}</a>
            </div>
          </div>
          <div class="card-footer-actions">
            <button class="card-btn-action ${card.favorite ? 'active-fav' : ''}" onclick="toggleFavorite(${card.id})" title="Favorito">⭐</button>
            <button class="card-btn-action" onclick="toggleReadLater(${card.id})" title="Leer más tarde">📌</button>
            <button class="card-btn-action" onclick="openEditModal(${card.id})" title="Editar">✏️</button>
            <button class="card-btn-action" onclick="deleteCard(${card.id})" title="Eliminar">🗑️</button>
          </div>
        `;
        cardsGrid.appendChild(cardEl);
      });
    }

    // Contadores generales
    const totalCount = cards.length;
    fichaCounter.textContent = totalCount;
    progressFill.style.width = `${Math.min((totalCount / 15) * 100, 100)}%`;
    showingCounter.textContent = `Mostrando ${filtered.length} ficha(s)`;

    if (currentCategory) {
      sectionTitle.textContent = `Categoría: ${currentCategory}`;
    } else if (currentFilter === 'favorites') {
      sectionTitle.textContent = `Fichas Favoritas`;
    } else if (currentFilter === 'readLater') {
      sectionTitle.textContent = `Leer Más Tarde`;
    } else {
      sectionTitle.textContent = `Últimas Fichas Incorporadas`;
    }
  }

 // Guardar nueva ficha desde la barra superior con detección inteligente de URL
  if (btnSave && urlInput) {
    btnSave.addEventListener('click', () => {
      const val = urlInput.value.trim();
      if (!val) {
        alert('Por favor, introduce un enlace o título válido.');
        return;
      }

      let finalTitle = val;
      let finalUrl = val;
      let finalDesc = 'Ficha añadida manualmente desde el panel principal.';

      // Si el usuario introduce una URL válida
      if (val.startsWith('http://') || val.startsWith('https://')) {
        try {
          const urlObj = new URL(val);
          finalTitle = `Recursos de ${urlObj.hostname}`;
          finalDesc = `Enlace directo guardado desde ${urlObj.hostname}`;
        } catch (e) {
          finalTitle = val;
        }
      } else {
        finalUrl = 'https://inboxzero.es/recurso/' + encodeURIComponent(val.toLowerCase().replace(/\s+/g, '-'));
      }

      const newCard = {
        id: Date.now(),
        title: finalTitle,
        description: finalDesc,
        url: finalUrl,
        category: currentCategory || 'Comida Sana',
        favorite: false,
        readLater: false,
        notes: '',
        image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=150&auto=format&fit=crop&q=80'
      };

      cards.unshift(newCard);
      urlInput.value = '';
      currentCategory = null;
      currentFilter = 'all';
      renderCards();
    });

    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnSave.click();
    });
  }
  // Funciones globales de acción en tarjetas
  window.toggleFavorite = (id) => {
    const card = cards.find(c => c.id === id);
    if (card) {
      card.favorite = !card.favorite;
      renderCards();
    }
  };

  window.toggleReadLater = (id) => {
    const card = cards.find(c => c.id === id);
    if (card) {
      card.readLater = !card.readLater;
      renderCards();
    }
  };

  window.deleteCard = (id) => {
    if (confirm('¿Estás seguro de eliminar esta ficha?')) {
      cards = cards.filter(c => c.id !== id);
      renderCards();
    }
  };

  // Apertura del modal de edición completo
  window.openEditModal = (id) => {
    const card = cards.find(c => c.id === id);
    if (card) {
      document.getElementById('edit-card-id').value = card.id;
      document.getElementById('edit-title-input').value = card.title;
      document.getElementById('edit-desc-input').value = card.description;
      document.getElementById('edit-category-select').value = card.category;
      document.getElementById('edit-new-category-input').value = '';
      document.getElementById('edit-image-input').value = card.image;
      document.getElementById('edit-preview-img').src = card.image;
      document.getElementById('edit-fav-check').checked = card.favorite;
      document.getElementById('edit-read-check').checked = card.readLater;
      document.getElementById('edit-notes-input').value = card.notes || '';
      document.getElementById('edit-visit-link').href = card.url;

      document.getElementById('modal-edit').classList.add('active');
    }
  };

  // Guardar cambios desde el modal de edición
  const btnSaveEdit = document.getElementById('btn-save-edit');
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', () => {
      const id = parseInt(document.getElementById('edit-card-id').value);
      const card = cards.find(c => c.id === id);
      if (card) {
        card.title = document.getElementById('edit-title-input').value;
        card.description = document.getElementById('edit-desc-input').value;
        
        const newCat = document.getElementById('edit-new-category-input').value.trim();
        if (newCat) {
          card.category = newCat;
        } else {
          card.category = document.getElementById('edit-category-select').value;
        }

        card.image = document.getElementById('edit-image-input').value;
        document.getElementById('edit-preview-img').src = card.image;

        card.favorite = document.getElementById('edit-fav-check').checked;
        card.readLater = document.getElementById('edit-read-check').checked;
        card.notes = document.getElementById('edit-notes-input').value;

        document.getElementById('modal-edit').classList.remove('active');
        renderCards();
      }
    });
  }

  // Filtros desde menú lateral y desplegable
  document.querySelectorAll('.filter-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilter = link.getAttribute('data-filter');
      currentCategory = null;
      renderCards();
      document.querySelectorAll('.dropdown-wrapper').forEach(w => w.classList.remove('active'));
    });
  });

  document.querySelectorAll('.filter-cat').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      currentCategory = link.getAttribute('data-cat');
      currentFilter = 'all';
      renderCards();
      document.querySelectorAll('.dropdown-wrapper').forEach(w => w.classList.remove('active'));
    });
  });

  // Control del desplegable "Mi Biblioteca"
  const btnLibraryDrop = document.getElementById('btn-library-drop');
  const dropdownWrapper = btnLibraryDrop.closest('.dropdown-wrapper');

  btnLibraryDrop.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownWrapper.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    dropdownWrapper.classList.remove('active');
  });

  // Control de Modales (Ayuda, Login, Suscribete, Editar)
  const setupModal = (btnId, modalId) => {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    if (btn && modal) {
      btn.addEventListener('click', () => modal.classList.add('active'));
    }
  };

  setupModal('btn-help-modal', 'modal-help');
  setupModal('btn-login-modal', 'modal-login');
  setupModal('btn-subscribe-modal', 'modal-subscribe');

  // Cerrar modales
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-close');
      document.getElementById(modalId).classList.remove('active');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  // Render inicial
  renderCards();
});