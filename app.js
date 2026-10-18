document.addEventListener('DOMContentLoaded', function () {
  if (window.EventSource && window.location.pathname !== '/login') {
    const stockEvents = new EventSource('/events');
    stockEvents.addEventListener('stock-change', function () {
      window.location.reload();
    });
  }

  const receivingProduct = document.querySelector('#receivingProduct');
  const receivingSupplier = document.querySelector('#receivingSupplier');
  if (receivingProduct && receivingSupplier) {
    const applyPrimarySupplier = function () {
      const supplierId = receivingProduct.selectedOptions[0]?.dataset.supplierId;
      if (supplierId && Array.from(receivingSupplier.options).some(option => option.value === supplierId)) {
        receivingSupplier.value = supplierId;
      }
    };
    receivingProduct.addEventListener('change', applyPrimarySupplier);
    applyPrimarySupplier();
  }

  if (document.querySelector('[data-quick-action]')) {
    document.querySelectorAll('[data-quick-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        const target = button.dataset.quickAction;
        const forms = document.querySelectorAll('form');
        const match = Array.from(forms).find(form => form.dataset.form === target);
        if (match) {
          match.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const firstInput = match.querySelector('input, select, textarea');
          if (firstInput) firstInput.focus();
        }
      });
    });
  }
});
