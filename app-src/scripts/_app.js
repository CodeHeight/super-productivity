/**
 * @ngdoc overview
 * @name superProductivity
 * @description
 * # superProductivity
 *
 * Main module of the application.
 */

(function() {
  'use strict';

  // Electron stuff
  // require ipcRenderer if available
  if (typeof require === 'function') {
    window.isElectron = true;

    const { ipcRenderer } = require('electron');
    window.ipcRenderer = ipcRenderer;
  }

  // app initialization
  angular
    .module('superProductivity', [
      'ngAnimate',
      'ngAria',
      'ngResource',
      'ui.router',
      'ngMaterial',
      'ngMdIcons',
      'as.sortable',
      'angularMoment',
      'hc.marked',
      'mwl.calendar'
    ])
    .config(configMdTheme)
    .config(configMarked)
    .config(fixUnhandledRejectionError)
    .run(initGlobalModels)
    .run(initPollJiraTaskUpdates)
    .run(initPollGitTaskUpdates)
    .run(initTimeTracking)
    .run(initMousewheelZoomForElectron)
    .run(initGlobalShortcuts)
    .run(initAutomaticSyncIfEnabled)
    .run(initAutomaticBackupsIfEnabled)
    .run(initElectronErrorHandling)
    .run(sendAppReadyToElectron)
    .run(preventMultipleInstances)
    .run(setStartedTime)
    .run(checkIfLatestVersion)
    .run(showWelcomeDialog)
    .run(goToWorkViewIfTasks);

  /* @ngInject */
  function configMarked(markedProvider) {
    markedProvider.setRenderer({
      link: function(href, title, text) {
        return '<a href="' + href + '"' + (title ? ' title="' + title + '"' : ' ') + 'target="_blank" external-link class="md-accent">' + text + '</a>';
      }
    });
  }

  /* @ngInject */
  function configMdTheme($mdThemingProvider, THEMES) {
    $mdThemingProvider.theme('default')
      .primaryPalette('blue');
    //.dark();

    let themes = THEMES;
    for (let index = 0; index < themes.length; ++index) {
      $mdThemingProvider.theme(themes[index] + '-theme')
        .primaryPalette(themes[index]);
      $mdThemingProvider.enableBrowserColor({
        theme: themes[index] + '-theme', // Default is 'default'
        palette: 'accent', // Default is 'primary', any basic material palette and extended palettes are available
        hue: '400' // Default is '800'
      });
      $mdThemingProvider.theme(themes[index] + '-dark')
        .primaryPalette(themes[index])
        .dark();
      $mdThemingProvider.enableBrowserColor({
        theme: themes[index] + '-dark', // Default is 'default'
        palette: 'accent', // Default is 'primary', any basic material palette and extended palettes are available
        hue: '400' // Default is '800'
      });
    }

    $mdThemingProvider.alwaysWatchTheme(true);
  }

  function fixUnhandledRejectionError($qProvider) {
    $qProvider.errorOnUnhandledRejections(false);
  }

  /* @ngInject */
  function initGlobalModels(Projects, InitGlobalModels, AppStorage, $rootScope) {
    // sync initially
    $rootScope.r = AppStorage.s;

    Projects.getAndUpdateCurrent();

    InitGlobalModels();
  }

  /* @ngInject */
  function initGlobalShortcuts($document, Dialogs, $rootScope, CheckShortcutKeyCombo, IS_ELECTRON, $state) {
    $document.bind('keydown', (ev) => {
      // only trigger if not in typing mode
      if (ev.target.tagName !== 'INPUT' && ev.target.tagName !== 'TEXTAREA') {
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.addNewTask)) {
          Dialogs('ADD_TASK', undefined, true);
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.openProjectNotes)) {
          Dialogs('NOTES', undefined, true);
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.openDistractionPanel)) {
          Dialogs('DISTRACTIONS', undefined, true);
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.showHelp)) {
          Dialogs('HELP', { template: 'PAGE' }, true);
        }

        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.goToDailyPlanner)) {
          $state.go('daily-planner');
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.goToWorkView)) {
          $state.go('work-view');
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.goToDailyAgenda)) {
          $state.go('daily-agenda');
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.goToSettings)) {
          $state.go('settings');
        }
        if (CheckShortcutKeyCombo(ev, $rootScope.r.keys.goToFocusMode)) {
          $state.go('pomodoro-focus');
        }
      }

      // special hidden dev tools combo to use them for production
      if (IS_ELECTRON) {
        if (CheckShortcutKeyCombo(ev, 'Ctrl+Shift+J')) {
          window.ipcRenderer.send('TOGGLE_DEV_TOOLS');
        }
      }
    });

    // Register electron shortcut(s)
    const IPC_REGISTER_GLOBAL_SHORTCUT_EVENT = 'REGISTER_GLOBAL_SHORTCUT';
    if (IS_ELECTRON && $rootScope.r.keys && $rootScope.r.keys.globalShowHide) {
      window.ipcRenderer.send(IPC_REGISTER_GLOBAL_SHORTCUT_EVENT, $rootScope.r.keys.globalShowHide);
    }
  }

  /* @ngInject */
  function initTimeTracking(TimeTracking) {
    TimeTracking.init();
  }

  /* @ngInject */
  function initPollJiraTaskUpdates($rootScope, Jira, IS_ELECTRON, $interval, JIRA_UPDATE_POLL_INTERVAL) {
    if (IS_ELECTRON) {
      // one initial call
      if (Jira.isSufficientJiraSettings()) {
        Jira.checkForUpdates($rootScope.r.tasks);
      }

      $interval(() => {
        if (Jira.isSufficientJiraSettings()) {
          Jira.checkForUpdates($rootScope.r.tasks);
        }
      }, JIRA_UPDATE_POLL_INTERVAL);
    }
  }

  /* @ngInject */
  function initPollGitTaskUpdates($rootScope, Git, $interval, GIT_UPDATE_POLL_INTERVAL) {
    // one initial
    if ($rootScope.r.git.projectDir && $rootScope.r.git.repo) {
      Git.checkAndUpdateTasks($rootScope.r.tasks);
    }

    $interval(() => {
      if ($rootScope.r.git.projectDir && $rootScope.r.git.repo) {
        Git.checkAndUpdateTasks($rootScope.r.tasks);
      }
    }, GIT_UPDATE_POLL_INTERVAL);
  }

  /* @ngInject */
  function showWelcomeDialog($rootScope, Dialogs) {
    if ($rootScope.r.uiHelper.isShowWelcomeDialog) {
      Dialogs('WELCOME', undefined, true);
    }
  }

  /* @ngInject */
  function goToWorkViewIfTasks($state, Tasks) {
    const todaysTasks = Tasks.getUndoneToday();
    if (todaysTasks && todaysTasks.length > 0) {
      $state.go('work-view');
    }
  }

  /* @ngInject */
  function initMousewheelZoomForElectron($document, $window, IS_ELECTRON) {
    if (IS_ELECTRON) {
      const { webFrame } = require('electron');

      $window.Hamster($document[0]).wheel(function(event, delta, deltaX, deltaY) {
        if (event.originalEvent && event.originalEvent.ctrlKey) {
          const zoomFactor = webFrame.getZoomFactor();
          if (deltaY === 1) {
            webFrame.setZoomFactor(zoomFactor + 0.05);
          } else if (deltaY === -1) {
            webFrame.setZoomFactor(zoomFactor - 0.05);
          }
        }
      });
    }
  }

  /* @ngInject */
  function initAutomaticBackupsIfEnabled(IS_ELECTRON, AppStorage) {
    if (IS_ELECTRON) {
      AppStorage.initBackupsIfEnabled();
    }
  }

  /* @ngInject */
  function initAutomaticSyncIfEnabled(IS_ELECTRON, AppStorage) {
    if (IS_ELECTRON) {
      AppStorage.initSyncIfEnabled();
    }
  }

  /* @ngInject */
  function checkIfLatestVersion(IS_ELECTRON, $http, Git, VERSION, $mdToast, Util) {
    if (!IS_ELECTRON) {
      return;
    }

    const DOWNLOAD_URL = 'https://github.com/johannesjo/super-productivity/releases';

    function compareVersion(a, b) {
      const pa = a.split('.');
      const pb = b.split('.');
      for (let i = 0; i < 3; i++) {
        let na = Number(pa[i]);
        let nb = Number(pb[i]);
        if (na > nb) {
          return 1;
        } else if (nb > na) {
          return -1;
        } else if (!isNaN(na) && isNaN(nb)) {
          return 1;
        } else if (isNaN(na) && !isNaN(nb)) {
          return -1;
        }
      }
      return 0;
    }

    Git.getLatestSpRelease().then((res) => {
      const latestReleaseData = res && res.data;
      const latestVersionStr = latestReleaseData && latestReleaseData.name;
      if (latestVersionStr) {
        const isNew = (compareVersion(latestVersionStr, VERSION) > 0);
        if (isNew) {
          const toast = $mdToast.simple()
            .textContent(`There is a new Version of Super Productivity (${latestVersionStr}) available.`)
            .action('Download')
            .hideDelay(20000)
            .position('bottom');

          $mdToast.show(toast)
            .then(function(response) {
              if (response === 'ok') {
                Util.openExternalUrl(DOWNLOAD_URL);
              }
            })
            // we need an empty catch to prevent the unhandled rejection error
            .catch(() => {
            });
        }
      }
    });
  }

  function setStartedTime($rootScope, $timeout) {
    $timeout(() => {
      const moment = window.moment;
      const startedTime = $rootScope.r.startedTimeToday;

      if (startedTime && moment(startedTime).isSame(moment(), 'day')) {
        // refresh to moment object
        $rootScope.r.startedTimeToday = moment(startedTime);
      } else {
        // set to now
        $rootScope.r.startedTimeToday = moment();
      }
    });
  }

  function preventMultipleInstances() {
    const KEY = 'SP_MULTI_INSTANCE_KEY';
    const SHUTDOWN_KEY = 'SP_MULTI_INSTANCE_SHUTDOWN_KEY';
    if (window.addEventListener) { // IE9, FF, Chrome, Safari, Opera
      window.addEventListener('storage', onStorageChanged, false);
    }
    else if (window.attachEvent) {
      window.attachEvent('onstorage', onStorageChanged); // IE 8
    }

    function onStorageChanged(ev) {
      let isClosing = false;

      // we're the second instance so 'close' if not done already
      if (ev.key === SHUTDOWN_KEY) {
        if (!isClosing) {
          isClosing = true;
          //alert('You already have another instance open! This could lead to a lot of problems. Please close this tab asap!');
          window.location.assign('https://github.com/johannesjo/super-productivity');
        }
      }

      // means we're the original instance
      else if (ev.key === KEY) {
        // 'send' shutdown_key to shutdown other instance
        localStorage.setItem(SHUTDOWN_KEY, 'Something');

        // remove to allow this to work next time
        setTimeout(() => {
          localStorage.removeItem(SHUTDOWN_KEY);
        }, 50);

      }

    }

    localStorage.setItem(KEY, Date.now());
  }

  function initElectronErrorHandling(SimpleToast, IS_ELECTRON) {
    const ERROR_EV = 'ELECTRON_ERROR';
    if (IS_ELECTRON) {
      window.ipcRenderer.on(ERROR_EV, (ev, errorData) => {
        SimpleToast('ERROR', 'Electron Error: ' + errorData.error);
        console.error('Electron Error: ' + errorData.error);
        console.log('Stacktrace: ', errorData.stack);
      });
    }
  }

  function sendAppReadyToElectron(IS_ELECTRON) {
    const APP_READY = 'APP_READY';
    if (IS_ELECTRON) {
      window.ipcRenderer.send(APP_READY, {});
    }
  }

})();
