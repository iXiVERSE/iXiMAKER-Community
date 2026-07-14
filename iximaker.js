// Gestion des onglets
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Génère un identifiant unique entier basé sur le timestamp
function generateUniqueID() {
    return Math.floor(Date.now() * 1000 + Math.random() * 1000);
}

// Échappe les caractères HTML sensibles pour éviter l'injection de balises
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Affiche un toast/message de notification temporaire
function showMessage(message) {
    const div = document.createElement('div');
    div.className = 'success-message';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.remove();
    }, 3000);
}

// Fonction générique pour réduire/agrandir un élément repliable
function toggleCollapse(id) {
    const element = document.getElementById(id);
    if (!element) return;
    const isCollapsed = element.classList.toggle('collapsed');

    // Désactive le drag & drop pour les sections quand elles sont ouvertes
    if (element.classList.contains('section-step') || 
        element.classList.contains('section-topic') || 
        element.classList.contains('section-action') || 
        element.classList.contains('section-course')) {
        element.draggable = isCollapsed;
        element.classList.remove('dragging');
    }
}

// Modifie le textContent d'un élément HTML de façon sécurisée (avec repli par défaut)
function setSafeTextContent(elementId, value) {
    const elem = document.getElementById(elementId);
    if (elem) {
        elem.textContent = value || 0;
    }
}
