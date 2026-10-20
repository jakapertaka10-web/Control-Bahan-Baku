(function () {
  var appModules = [
    window.WMS.dashboardModule,
    window.WMS.materialsModule,
    window.WMS.receivingModule,
    window.WMS.issuingModule,
    window.WMS.stockModule,
    window.WMS.movementModule,
    window.WMS.opnameModule,
    window.WMS.reportsModule
  ].filter(Boolean);

  function updateHeader() {
    var title = document.getElementById('pageTitle');
    var activeView = document.querySelector('.nav-btn.active');
    if (title && activeView) {
      var icon = activeView.querySelector('.nav-icon');
      title.textContent = activeView.textContent.replace(icon ? icon.textContent : '', '').trim();
    }
  }

  function bindViewSwitching() {
    function openView(selected, button) {
      document.querySelectorAll('.nav-btn').forEach(function (item) {
        item.classList.toggle('active', item === button);
      });
      document.querySelectorAll('.view').forEach(function (view) {
        view.classList.toggle('active', view.id === selected + '-view');
      });
      updateHeader();
    }

    document.querySelectorAll('.nav-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        var selected = button.getAttribute('data-view');
        openView(selected, button);
      });
    });
    document.querySelectorAll('[data-go-view]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var selected = button.getAttribute('data-go-view');
        var navButton = document.querySelector('.nav-btn[data-view="' + selected + '"]');
        if (navButton) openView(selected, navButton);
      });
    });
  }

  function bindResetDemoData() {
    var resetButton = document.getElementById('resetDbBtn');
    if (!resetButton) return;

    resetButton.addEventListener('click', function () {
      var confirmed = window.confirm('Reset the local demo database? This will overwrite existing local data.');
      if (!confirmed) return;
      var db = window.WMS.buildDemoDb();
      window.WMS.saveDb(db);
      window.location.reload();
    });
  }

  function refreshAllModules() {
    appModules.forEach(function (module) {
      if (module && typeof module.render === 'function') {
        module.render();
      }
    });
    var lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) {
      lastUpdated.textContent = 'Data tersimpan';
    }
  }

  function initialize() {
    window.WMS.ensureDb();
    bindViewSwitching();
    bindResetDemoData();
    updateHeader();

    appModules.forEach(function (module) {
      if (module && typeof module.init === 'function') {
        module.init();
      }
    });

    refreshAllModules();
    window.WMS.notify('WMS ready', 'success');
  }

  window.WMS.app = {
    init: initialize,
    refreshAllModules: refreshAllModules
  };

  initialize();
})();
