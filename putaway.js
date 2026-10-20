(function () {
  function renderOptions() {
    var db = window.WMS.getDb();
    if (!db) return;

    var materialSelect = document.getElementById('putawayMaterial');
    var locationSelect = document.getElementById('putawayLocation');
    if (!materialSelect || !locationSelect) return;

    materialSelect.innerHTML = '<option value="">-- Select Material --</option>' + (db.materials || []).map(function (material) {
      return '<option value="' + material.id + '">' + material.name + '</option>';
    }).join('');

    locationSelect.innerHTML = '<option value="">-- Select Location --</option>' + (db.locations || []).map(function (location) {
      return '<option value="' + location.id + '">' + location.name + ' (' + location.zone + ')</option>';
    }).join('');
  }

  function renderTable() {
    var db = window.WMS.getDb();
    if (!db) return;
    var tableBody = document.getElementById('putawayTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    (db.putaways || []).slice(0, 10).forEach(function (record) {
      var material = window.WMS.getMaterialById(db.materials, record.materialId);
      var location = window.WMS.getLocationById(db.locations, record.locationId);
      var row = document.createElement('tr');
      row.innerHTML = '<td>' + window.WMS.formatDate(record.createdAt) + '</td>' +
        '<td>' + (material ? material.name : '-') + '</td>' +
        '<td>' + (location ? location.name : '-') + '</td>' +
        '<td>' + window.WMS.formatQty(record.qty || 0) + '</td>';
      tableBody.appendChild(row);
    });
  }

  function bindForm() {
    var form = document.getElementById('putawayForm');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var db = window.WMS.getDb();
      var materialId = document.getElementById('putawayMaterial').value;
      var locationId = document.getElementById('putawayLocation').value;
      var qty = Number(document.getElementById('putawayQty').value || 0);
      var remarks = document.getElementById('putawayRemarks').value.trim();

      if (!materialId || !locationId || qty <= 0) {
        window.WMS.notify('Choose material, location, and valid quantity', 'error');
        return;
      }

      var material = window.WMS.getMaterialById(db.materials, materialId);
      db.putaways.unshift({
        id: window.WMS.makeId('pa'),
        materialId: materialId,
        locationId: locationId,
        qty: qty,
        remarks: remarks,
        createdAt: new Date().toISOString()
      });

      var existingStock = (db.stock || []).find(function (row) {
        return row.materialId === materialId && row.locationId === locationId;
      });
      if (existingStock) {
        existingStock.qty = Number(existingStock.qty || 0) + qty;
      } else {
        db.stock.push({
          id: window.WMS.makeId('stock'),
          materialId: materialId,
          locationId: locationId,
          qty: qty,
          lotNo: 'PUTAWAY-' + String(Date.now()).slice(-6),
          lastUpdated: new Date().toISOString(),
          status: window.WMS.setStockStatus(qty, Number(material ? material.reorderLevel : 0))
        });
      }

      window.WMS.recordMovement(db, 'Putaway', materialId, locationId, qty, 'PUTAWAY', remarks || 'Putaway');
      window.WMS.addActivity(db, 'Putaway', 'Putaway ' + qty + ' ' + (material ? material.uom : '') + ' to ' + (window.WMS.getLocationById(db.locations, locationId) || {}).name);
      window.WMS.saveDb(db);
      form.reset();
      window.WMS.notify('Putaway saved', 'success');
      renderOptions();
      renderTable();
      window.WMS.app.refreshAllModules();
    });
  }

  window.WMS.putawayModule = {
    init: function () {
      renderOptions();
      renderTable();
      bindForm();
    },
    render: function () {
      renderOptions();
      renderTable();
    }
  };
})();
