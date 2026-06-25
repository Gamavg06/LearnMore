// js/resenas.js
import { saveReview, subscribeReviews, subscribeGuides } from './guides.js';
import { translate } from './language.js';

let reviews = [];
let guides = [];
let selectedStars = 0;
let activeTab = 'platform';

function init() {
  subscribeReviews((items) => {
    reviews = items;
    renderReviews();
  });

  subscribeGuides((items) => {
    guides = items;
    renderReviews();
  });

  // Tab switching
  document.querySelectorAll('.review-tab-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.review-tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      activeTab = this.dataset.tab;
      renderReviews();
    });
  });

  const starBtns = Array.from(document.querySelectorAll('.star'));

  starBtns.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      selectedStars = parseInt(this.dataset.val);
      updateStars(starBtns);
    });
    btn.addEventListener('mouseenter', function () {
      highlightStars(starBtns, parseInt(this.dataset.val));
    });
  });

  const starContainer = document.getElementById('starContainer');
  if (starContainer) {
    starContainer.addEventListener('mouseleave', function () {
      updateStars(starBtns);
    });
  }

  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      submitReview(starBtns);
    });
  }
}

// Ejecutar inicialización inmediatamente
init();

function highlightStars(btns, n) {
  btns.forEach(b => {
    const on = parseInt(b.dataset.val) <= n;
    b.textContent = on ? '★' : '☆';
    b.classList.toggle('active', on);
  });
}

function updateStars(btns) {
  btns.forEach(b => {
    const on = parseInt(b.dataset.val) <= selectedStars;
    b.textContent = on ? '★' : '☆';
    b.classList.toggle('active', on);
  });
}

function submitReview(starBtns) {
  const name    = document.getElementById('nameInput').value.trim();
  const comment = document.getElementById('commentInput').value.trim();
  const err     = document.getElementById('errorMsg');

  if (!name || !comment || !selectedStars) {
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';

  const review = {
    name,
    comment,
    stars: selectedStars,
    created_at: new Date().toISOString()
  };

  saveReview(review).then((id) => {
    document.getElementById('nameInput').value    = '';
    document.getElementById('commentInput').value = '';
    selectedStars = 0;
    updateStars(starBtns);

    // Optimistic UI update: show the review instantly in the list
    const optimisticReview = {
      id,
      ...review,
      status: "nuevo",
      reply: null
    };
    if (!reviews.some(r => String(r.id) === String(id))) {
      reviews = [optimisticReview, ...reviews];
      renderReviews();
    }
  }).catch((error) => {
    alert("Error al guardar reseña: " + error.message);
  });
}

function starsHTML(n) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="review-star">${i < n ? '★' : '☆'}</span>`
  ).join('');
}

function renderReviews() {
  const list = document.getElementById('reviewsList');
  if (!list) return;

  const filteredReviews = reviews.filter(r => {
    const isGuide = r.comment && r.comment.startsWith('[guide:');
    return activeTab === 'guides' ? isGuide : !isGuide;
  });

  if (!filteredReviews.length) {
    const emptyMsg = activeTab === 'platform'
      ? (translate("profile.noReviews") !== "profile.noReviews" ? translate("profile.noReviews") : "No hay reseñas de la plataforma todavía.")
      : (translate("nav.home") === "Inicio" ? "No hay reseñas de guías todavía." : "No guide reviews yet.");
    list.innerHTML = `<p class="no-reviews">${emptyMsg}</p>`;
    return;
  }

  list.innerHTML = filteredReviews
    .sort((a, b) => new Date(b.created_at || b.date || b.created_at) - new Date(a.created_at || a.date || a.created_at))
    .map(r => {
      const dateStr = r.created_at 
        ? new Date(r.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
        : r.date || '';

      let cleanComment = r.comment || '';
      let guideBadgeHtml = '';

      if (activeTab === 'guides') {
        const match = cleanComment.match(/^\[guide:(.+?)\]\s*/);
        if (match) {
          const guideId = match[1];
          cleanComment = cleanComment.replace(match[0], '');
          const guide = guides.find(g => String(g.id) === String(guideId));
          if (guide) {
            guideBadgeHtml = `<span class="pill" style="margin-left: 8px; font-size: 0.75rem; border: 1px solid var(--accent-border-soft); color: var(--accent); font-weight: bold; padding: 2px 8px; border-radius: 12px; display: inline-block;">📖 ${guide.title}</span>`;
          } else {
            guideBadgeHtml = `<span class="pill" style="margin-left: 8px; font-size: 0.75rem; border: 1px solid var(--border); color: var(--muted); padding: 2px 8px; border-radius: 12px; display: inline-block;">📖 Guía #${guideId}</span>`;
          }
        }
      }

      return `
      <div class="review-card">
        <div class="review-header">
          <div class="review-avatar">${(r.name || 'A').charAt(0).toUpperCase()}</div>
          <div class="review-meta">
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
              <strong>${r.name || translate("profile.anonymous")}</strong>
              ${guideBadgeHtml}
            </div>
            <small>${dateStr}</small>
          </div>
          <div class="review-stars">${starsHTML(r.stars)}</div>
        </div>
        <p class="review-comment">${cleanComment}</p>
        ${r.reply ? `
          <div class="review-reply-box" style="margin-top: 10px; padding: 10px; border-left: 3px solid var(--accent); background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.9rem;">
            <strong style="color: var(--accent); font-size: 0.85rem;">${translate("profile.adminReply")}</strong>
            <p style="margin: 4px 0 0; opacity: 0.9; line-height: 1.4;">${r.reply}</p>
          </div>
        ` : ''}
      </div>
      `;
    }).join('');
}

window.addEventListener("learnmore:language-change", () => {
  renderReviews();
});