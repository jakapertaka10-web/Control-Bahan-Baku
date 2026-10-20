(function () {
  function render() {
    var db = window.WMS.getDb();
    if (!db) return;

    var tableBody = document.getElementById('locationsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    (db.locations || []).forEach(function (location) {
      var row = document.createElement('tr');
      row.innerHTML = '<td>' + (location.name || '-') + '</td>' +
        '<td>' + (location.zone || '-') + '</td>' +
        '<td>' + (location.rack || '-') + '</td>' +
        '<td><div class="table-actions"><button class="table-btn" type="button" data-action="edit-location" data-id="' + location.id + '">Edit</button>' +
        '<button class="danger-btn" type="button" data-action="delete-location" data-id="' + location.id + '">Delete</button></div></td>';
      tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="edit-location"]').forEach(function (button) {
      button.addEventListener('click', function () {
        var locationId = button.getAttribute('data-id');
        var location = (db.locations || []).find(function (item) {
          return item.id === locationId;
        });
        if (!location) return;

        document.getElementById('locationId').value = location.id;
        document.getElementById('locationName').value = location.name || '';
        document.getElementById('locationZone').value = location.zone || '';
        document.getElementById('locationRack').value = location.rack || '';
        document.getElementById('cancelLocationEdit').classList.remove('hidden');
      });
    });

    tableBody.querySelectorAll('[data-action="delete-location"]').forEach(function (button) {
      button.addEventListener('click', function () {
        var locationId = button.getAttribute('data-id');
        var shouldDelete = window.confirm('Delete location?');
        if (!shouldDelete) return;

        var db = window.WMS.getDb();
        db.locations = (db.locations || []).filter(function (item) {
          return item.id !== locationId;
        });
        window.WMS.saveDb(db);
        window.WMS.addActivity(db, 'Delete', 'Deleted location record');
        window.WMS.saveDb(db);
        window.WMS.app.refreshAllModules();
      });
    });
  }

  function bindForm() {
    var form = document.getElementById('locationForm');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var db = window.WMS.getDb();
      var locationId = document.getElementById('locationId').value;
      var payload = {
        name: document.getElementById('locationName').value.trim(),
        zone: document.getElementById('locationZone').value.trim(),
        rack: document.getElementById('locationRack').value.trim()
      };

      if (!payload.name || !payload.zone) {
        window.WMS.notify('Location name and zone are required', 'error');
        return;
      }

      if (locationId) {
        var existing = (db.locations || []).find(function (item) {
          return item.id === locationId;
        });
        if (existing) {
          Object.assign(existing, payload);
          window.WMS.addActivity(db, 'Update', 'Updated location ' + payload.name);
          window.WMS.notify('Location updated', 'success');
        }
      } else {
        db.locations.push(Object.assign({ id: window.WMS.makeId('loc') }, payload));
        window.WMS.addActivity(db, 'Create', 'Added location ' + payload.name);
        window.WMS.notify('Location saved', 'success');
      }

      window.WMS.saveDb(db);
      form.reset();
      document.getElementById('locationId').value = '';
      document.getElementById('cancelLocationEdit').classList.add('hidden');
      render();
      window.WMS.app.refreshAllModules();
    });

    document.getElementById('cancelLocationEdit').addEventListener('click', function () {
      form.reset();
      document.getElementById('locationId').value = '';
      document.getElementById('cancelLocationEdit').classList.add('hidden');
    });
  }

  window.WMS.locationsModule = {
    init: function () {
      bindForm();
      render();
    },
    render: render
  };
})();
