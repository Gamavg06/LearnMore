// js/resenas.js
import { saveReview, subscribeReviews } from './guides.js';

let reviews = [];
let selectedStars = 0;

document.addEventListener('DOMContentLoaded', async function () {
  subscribeReviews((items) => {
    reviews = items;
    renderReviews();
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
});

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

  saveReview(review).then(() => {
    document.getElementById('nameInput').value    = '';
    document.getElementById('commentInput').value = '';
    selectedStars = 0;
    updateStars(starBtns);
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

  if (!reviews.length) {
    list.innerHTML = '<p class="no-reviews">Aún no hay reseñas. ¡Sé el primero!</p>';
    return;
  }

list.innerHTML = reviews.map(r => {
    const dateStr = r.created_at 
      ? new Date(r.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
      : r.date || '';
    return `
    <div class="review-card">
      <div class="review-header">
        <div class="review-avatar">${r.name.charAt(0).toUpperCase()}</div>
        <div class="review-meta">
          <strong>${r.name}</strong>
          <small>${dateStr}</small>
        </div>
        <div class="review-stars">${starsHTML(r.stars)}</div>
      </div>
      <p class="review-comment">${r.comment}</p>
    </div>
    `;
  }).join('');
}