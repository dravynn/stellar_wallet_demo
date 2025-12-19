/**
 * Modal utility for creating and managing modals
 */

export function showModal(title, content, onConfirm = null, onCancel = null) {
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Store callbacks
  overlay.dataset.onConfirm = onConfirm ? 'true' : '';
  overlay.dataset.onCancel = onCancel ? 'true' : '';
  
  if (onConfirm) {
    window._modalConfirm = onConfirm;
  }
  if (onCancel) {
    window._modalCancel = onCancel;
  }
}

export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.style.display = 'none';
  document.body.style.overflow = '';
  
  delete window._modalConfirm;
  delete window._modalCancel;
}

export function createInputModal(title, fields, onSubmit) {
  const formHTML = fields.map(field => `
    <div class="form-group">
      <label for="${field.id}">${field.label}</label>
      ${field.type === 'textarea' ? 
        `<textarea id="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>${field.value || ''}</textarea>` :
        `<input type="${field.type || 'text'}" id="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" value="${field.value || ''}" ${field.required ? 'required' : ''} />`
      }
      ${field.help ? `<small class="form-help">${field.help}</small>` : ''}
    </div>
  `).join('');
  
  const content = `
    <form id="modalForm">
      ${formHTML}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit</button>
      </div>
    </form>
  `;
  
  showModal(title, content);
  
  const form = document.getElementById('modalForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {};
    fields.forEach(field => {
      const input = document.getElementById(field.id);
      data[field.id] = field.type === 'number' ? parseFloat(input.value) : input.value;
    });
    onSubmit(data);
    closeModal();
  });
}

export function createConfirmModal(title, message, onConfirm) {
  const content = `
    <p>${message}</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="handleConfirm()">Confirm</button>
    </div>
  `;
  
  showModal(title, content);
  
  window.handleConfirm = () => {
    onConfirm();
    closeModal();
    delete window.handleConfirm;
  };
}

// Initialize modal event listeners
function initModalListeners() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('modalOverlay');
      if (overlay && overlay.style.display === 'flex') {
        closeModal();
      }
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModalListeners);
} else {
  initModalListeners();
}
