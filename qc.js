(function () {
  function renderOptions() {
    var db = window.WMS.getDb();
    if (!db) return;
    var select = document.getElementById('qcMaterial');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Material --</option>' + (db.materials || []).map(function (material) {
      return '<option value="' + material.id + '">' + material.name + '</option>';
    }).join('');
  }

  function renderTable() {
    var db = window.WMS.getDb();
    if (!db) return;
    var tableBody = document.getElementById('qcTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    (db.qc || []).slice(0, 10).forEach(function (record) {
      var material = window.WMS.getMaterialById(db.materials, record.materialId);
      var row = document.createElement('tr');
      row.innerHTML = '<td>' + window.WMS.formatDate(record.createdAt) + '</td>' +
        '<td>' + (material ? material.name : '-') + '</td>' +
        '<td><span class="tag ' + String(record.status || 'Pass').toLowerCase() + '">' + (record.status || 'Pass') + '</span></td>' +
        '<td>' + (record.inspector || '-') + '</td>' +
        '<td>' + (record.remarks || '-') + '</td>';
      tableBody.appendChild(row);
    });
  }

  function bindForm() {
    var form = document.getElementById('qcForm');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var db = window.WMS.getDb();
      var materialId = document.getElementById('qcMaterial').value;
      var status = document.getElementById('qcStatus').value;
      var inspector = document.getElementById('qcInspector').value.trim();
      var remarks = document.getElementById('qcRemarks').value.trim();

      if (!materialId) {
        window.WMS.notify('Select a material for QC', 'error');
        return;
      }

      db.qc.unshift({
        id: window.WMS.makeId('qc'),
        materialId: materialId,
        status: status,
        inspector: inspector || 'QA Team',
        remarks: remarks,
        createdAt: new Date().toISOString()
      });

      window.WMS.addActivity(db, 'QC', 'Recorded QC status ' + status + ' for ' + (window.WMS.getMaterialById(db.materials, materialId) || {}).name);
      window.WMS.saveDb(db);
      form.reset();
      window.WMS.notify('QC saved', 'success');
      renderOptions();
      renderTable();
      window.WMS.app.refreshAllModules();
    });
  }

  window.WMS.qcModule = {
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
