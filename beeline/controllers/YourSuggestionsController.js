export default [
  '$scope',
  '$ionicPopup',
  'MapOptions',
  function (
    // Angular Tools
    $scope,
    $ionicPopup,
    MapOptions
  ) {
    // ------------------------------------------------------------------------
    // Helper Functions
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // Data Initialization
    // ------------------------------------------------------------------------
    $scope.data = {
      suggestions: [1, 2, 3],
    }

    $scope.map = MapOptions.defaultMapOptions({

    })

    // ------------------------------------------------------------------------
    // Ionic events
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // Watchers
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // UI Hooks
    // ------------------------------------------------------------------------
    $scope.popupDeleteConfirmation = function () {
      $ionicPopup.confirm({
        title: 'Are you sure you want to delete the suggestions?',
      })
    }
  },
]
