(function () {
  function addCell(row, value) {
    var cell = document.createElement('td');
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
  }

  function addEmptyRow(body, columns, text) {
    var row = document.createElement('tr');
    var cell = addCell(row, text);
    cell.colSpan = columns;
    cell.className = 'empty-state';
    body.appendChild(row);
  }

  function renderStatusCell(row, status) {
    var cell = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'status-badge ' + window.WMS.statusClass(status);
    badge.textContent = status;
    cell.appendChild(badge);
    row.appendChild(cell);
  }

  function getMaterialRows(db) {
    return (db.materials || []).map(function (material) {
      var stock = window.WMS.getMaterialStock(db, material.id);
      var minimum = Number(material.reorderLevel || 0);
      return {
        material: material,
        stock: stock,
        minimum: minimum,
        status: window.WMS.getStockStatus(stock, minimum)
      };
    });
  }

  function renderStats(db, rows) {
    var today = window.WMS.todayLocalDate();
    var todayMovements = (db.movements || []).filter(function (movement) {
      return window.WMS.localDateKey(movement.createdAt || movement.date) === today;
    });
    var inbound = todayMovements.filter(function (movement) {
      return window.WMS.getMovementType(movement) === 'IN';
    });
    var outbound = todayMovements.filter(function (movement) {
      return window.WMS.getMovementType(movement) === 'OUT';
    });
    var sumQty = function (items) {
      return items.reduce(function (sum, item) {
        return sum + Math.abs(window.WMS.getMovementQty(item));
      }, 0);
    };
    var values = {
      totalMaterialsStat: rows.length,
      totalStockStat: rows.reduce(function (sum, row) { return sum + row.stock; }, 0),
      availableStockStat: rows.filter(function (row) { return row.status === 'AMAN'; }).reduce(function (sum, row) { return sum + row.stock; }, 0),
      lowStockStat: rows.filter(function (row) { return row.status === 'LOW STOCK'; }).length,
      outOfStockStat: rows.filter(function (row) { return row.status === 'OUT OF STOCK'; }).length,
      todayInStat: sumQty(inbound),
      todayOutStat: sumQty(outbound),
      todayTransactionsStat: todayMovements.length,
      todayInCount: inbound.length + ' transaksi',
      todayOutCount: outbound.length + ' transaksi',
      dashboardDate: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    };
    Object.keys(values).forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      element.textContent = id === 'dashboardDate' || id === 'todayInCount' || id === 'todayOutCount'
        ? values[id]
        : window.WMS.formatQty(values[id]);
    });
  }

  function renderStockTable(rows) {
    var body = document.getElementById('dashboardStockBody');
    if (!body) return;
    body.innerHTML = '';
    if (!rows.length) {
      addEmptyRow(body, 4, 'Belum ada data bahan baku.');
      return;
    }
    rows.forEach(function (rowData) {
      var row = document.createElement('tr');
      addCell(row, rowData.material.name);
      addCell(row, window.WMS.formatQty(rowData.stock) + ' ' + rowData.material.uom);
      addCell(row, window.WMS.formatQty(rowData.minimum) + ' ' + rowData.material.uom);
      renderStatusCell(row, rowData.status);
      body.appendChild(row);
    });
  }

  function renderPriority(rows) {
    var body = document.getElementById('priorityStockBody');
    if (!body) return;
    body.innerHTML = '';
    var priority = rows.filter(function (row) { return row.status !== 'AMAN'; }).sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'OUT OF STOCK' ? -1 : 1;
      var aRatio = a.minimum > 0 ? a.stock / a.minimum : 0;
      var bRatio = b.minimum > 0 ? b.stock / b.minimum : 0;
      return aRatio - bRatio;
    });
    if (!priority.length) {
      addEmptyRow(body, 6, 'Semua bahan baku berada dalam kondisi aman.');
      return;
    }
    priority.forEach(function (item) {
      var row = document.createElement('tr');
      addCell(row, item.material.code);
      addCell(row, item.material.name);
      addCell(row, item.material.category);
      addCell(row, window.WMS.formatQty(item.stock) + ' ' + item.material.uom);
      addCell(row, window.WMS.formatQty(item.minimum) + ' ' + item.material.uom);
      renderStatusCell(row, item.status);
      body.appendChild(row);
    });
  }

  function renderMovementChart(db) {
    var chart = document.getElementById('movementChart');
    if (!chart) return;
    chart.innerHTML = '';
    var days = [];
    var now = new Date();
    for (var offset = 6; offset >= 0; offset -= 1) {
      var date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      var key = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      days.push({
        key: key,
        label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
        incoming: 0,
        outgoing: 0
      });
    }
    (db.movements || []).forEach(function (movement) {
      var key = window.WMS.localDateKey(movement.createdAt || movement.date);
      var day = days.find(function (item) { return item.key === key; });
      if (!day) return;
      var qty = Math.abs(window.WMS.getMovementQty(movement));
      if (window.WMS.getMovementType(movement) === 'IN') day.incoming += qty;
      if (window.WMS.getMovementType(movement) === 'OUT') day.outgoing += qty;
    });
    var max = Math.max(1, ...days.map(function (day) { return Math.max(day.incoming, day.outgoing); }));
    days.forEach(function (day) {
      var column = document.createElement('div');
      column.className = 'chart-day';
      var bars = document.createElement('div');
      bars.className = 'chart-bars';
      [['in', day.incoming], ['out', day.outgoing]].forEach(function (data) {
        var bar = document.createElement('div');
        bar.className = 'chart-bar chart-bar-' + data[0];
        bar.style.height = Math.max(data[1] ? 5 : 2, (data[1] / max) * 100) + '%';
        bar.title = (data[0] === 'in' ? 'Masuk: ' : 'Keluar: ') + window.WMS.formatQty(data[1]);
        bars.appendChild(bar);
      });
      var label = document.createElement('span');
      label.textContent = day.label;
      column.appendChild(bars);
      column.appendChild(label);
      chart.appendChild(column);
    });
  }

  function renderCategoryChart(rows) {
    var chart = document.getElementById('categoryChart');
    if (!chart) return;
    chart.innerHTML = '';
    var categories = {};
    rows.forEach(function (row) {
      var category = row.material.category || 'Lainnya';
      if (!categories[category]) categories[category] = { qty: 0, items: 0 };
      categories[category].qty += row.stock;
      categories[category].items += 1;
    });
    var entries = Object.keys(categories).map(function (name) {
      return { name: name, qty: categories[name].qty, items: categories[name].items };
    }).sort(function (a, b) { return b.qty - a.qty; });
    var max = Math.max(1, ...entries.map(function (entry) { return entry.qty; }));
    if (!entries.length) {
      var empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'Belum ada data kategori.';
      chart.appendChild(empty);
      return;
    }
    entries.forEach(function (entry, index) {
      var item = document.createElement('div');
      item.className = 'category-item';
      var top = document.createElement('div');
      top.className = 'category-item-top';
      var title = document.createElement('strong');
      title.textContent = entry.name;
      var value = document.createElement('span');
      value.textContent = window.WMS.formatQty(entry.qty) + ' unit · ' + entry.items + ' item';
      var track = document.createElement('div');
      track.className = 'progress-track';
      var fill = document.createElement('span');
      fill.className = 'progress-fill progress-color-' + (index % 5);
      fill.style.width = (entry.qty / max * 100) + '%';
      top.appendChild(title);
      top.appendChild(value);
      track.appendChild(fill);
      item.appendChild(top);
      item.appendChild(track);
      chart.appendChild(item);
    });
  }

  function renderActivity(db) {
    var body = document.getElementById('recentActivityBody');
    if (!body) return;
    body.innerHTML = '';
    var movements = (db.movements || []).slice().sort(function (a, b) {
      return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
    }).slice(0, 8);
    if (!movements.length) {
      addEmptyRow(body, 5, 'Belum ada aktivitas transaksi.');
      return;
    }
    movements.forEach(function (movement) {
      var material = window.WMS.getMaterialById(db.materials, movement.materialId);
      var type = window.WMS.getMovementType(movement);
      var qty = window.WMS.getMovementQty(movement);
      var row = document.createElement('tr');
      addCell(row, window.WMS.formatDateTime(movement.createdAt || movement.date));
      addCell(row, movement.referenceNo || type);
      addCell(row, material ? material.name : 'Bahan dihapus');
      addCell(row, (qty > 0 ? '+' : '') + window.WMS.formatQty(qty) + ' ' + (material ? material.uom : ''));
      var typeCell = addCell(row, '');
      var badge = document.createElement('span');
      badge.className = 'status-badge ' + (type === 'IN' ? 'status-safe' : type === 'OUT' ? 'status-low' : 'status-adjustment');
      badge.textContent = type;
      typeCell.appendChild(badge);
      body.appendChild(row);
    });
  }

  function render() {
    var db = window.WMS.getDb();
    if (!db) return;
    var rows = getMaterialRows(db);
    renderStats(db, rows);
    renderStockTable(rows);
    renderPriority(rows);
    renderMovementChart(db);
    renderCategoryChart(rows);
    renderActivity(db);
  }

  window.WMS.dashboardModule = {
    init: render,
    render: render
  };
})();
