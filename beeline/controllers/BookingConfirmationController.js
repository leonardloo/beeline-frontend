export default [
  '$scope',
  '$state',
  '$ionicHistory',
  '$ionicPlatform',
  function(
    $scope,
    $state,
    $ionicHistory,
    $ionicPlatform
  ) {
    $scope.$on('$ionicView.afterEnter', () => {
      $ionicHistory.clearHistory()

      // Back button goes back to routes list
      var deregister = $ionicPlatform.registerBackButtonAction(() => {
        $state.go('tabs.routes')
      }, 101)
      $scope.$on('$ionicView.beforeLeave', deregister)
    })
  },
]
